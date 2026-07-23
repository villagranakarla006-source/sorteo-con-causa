(function(){
  "use strict";
  const cfg=window.FIREBASE_CONFIG||{};
  const ready=Boolean(cfg.apiKey&&cfg.projectId&&window.firebase);
  let app,auth,db;
  const now=()=>firebase.firestore.FieldValue.serverTimestamp();
  const numId=n=>String(Number(n)).padStart(3,"0");

  function init(){
    if(!ready) throw new Error("Firebase todavía no está configurado.");
    if(!app){
      app=firebase.apps.length?firebase.app():firebase.initializeApp(cfg);
      auth=firebase.auth();
      db=firebase.firestore();
      db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
    }
  }
  function audit(batch,action,detail,participantId=""){
    batch.set(db.collection("audit").doc(),{action,detail,participantId,at:now()});
  }
  async function ensureNumbers(){
    init();
    if(!auth.currentUser) throw new Error("Inicia sesión como administradora.");
    const metaRef=db.collection("settings").doc("raffle"),meta=await metaRef.get();
    if(meta.exists&&meta.data().initialized) return;
    for(let start=1;start<=500;start+=400){
      const batch=db.batch();
      for(let n=start;n<Math.min(start+400,501);n++){
        batch.set(db.collection("numbers").doc(numId(n)),{
          number:n,status:"available",participantId:"",participantName:"",phone:"",notes:"",updatedAt:now()
        },{merge:true});
      }
      await batch.commit();
    }
    await metaRef.set({initialized:true,totalNumbers:500,ticketPrice:200,updatedAt:now()},{merge:true});
  }
  async function registerParticipant(payload){
    init();
    const numbers=[...new Set((payload.numbers||[]).map(Number))].sort((a,b)=>a-b);
    if(!numbers.length) throw new Error("Selecciona al menos un número.");
    const phone=String(payload.phone||"").replace(/\D/g,"");
    if(phone.length!==10) throw new Error("Escribe un teléfono de 10 dígitos.");

    // El mismo teléfono puede crear varios apartados independientes.
    // La disponibilidad de cada número sigue validándose dentro de la transacción.

    const participantRef=db.collection("participants").doc();
    const publicCode=Math.random().toString(36).slice(2,8).toUpperCase();
    const registrationMode=payload.registrationMode==="reserve"?"reserve":"pay_now";
    const paymentMethod=registrationMode==="reserve"?"":(payload.paymentMethod==="efectivo"?"efectivo":"transferencia");
    if(registrationMode==="pay_now"&&paymentMethod==="transferencia"&&!payload.receiptData){
      throw new Error("Para pagar por transferencia debes adjuntar el comprobante.");
    }
    await db.runTransaction(async tx=>{
      const refs=numbers.map(n=>db.collection("numbers").doc(numId(n)));
      const docs=await Promise.all(refs.map(ref=>tx.get(ref)));
      docs.forEach((doc,i)=>{
        if(doc.exists&&doc.data().status!=="available") throw new Error(`El número ${numId(numbers[i])} ya no está disponible.`);
      });
      const reservationDate=new Date();
      const expirationDate=new Date(reservationDate.getTime()+7*24*60*60*1000);
      const status=registrationMode==="reserve"?"pending_payment":
        (paymentMethod==="transferencia"?"receipt_received":"pending_cash");
      tx.set(participantRef,{
        name:String(payload.name||"").trim(),phone,numbers,
        total:Number(payload.total||numbers.length*200),status,publicCode,
        registrationMode,paymentMethod,receiptMethod:"panel",collaborator:String(payload.collaborator||"").trim(),
        reservationAt:firebase.firestore.Timestamp.fromDate(reservationDate),
        expiresAt:firebase.firestore.Timestamp.fromDate(expirationDate),
        reminderSent:false,reminderSentAt:null,paymentConfirmedAt:null,ticketGenerated:false,
        ticketSent:false,ticketSentAt:null,ticketResendCount:0,
        receiptData:String(payload.receiptData||""),receiptName:String(payload.receiptName||""),
        receiptType:String(payload.receiptType||""),receiptSize:Number(payload.receiptSize||0),
        receiptReceivedAt:payload.receiptData?now():null,
        notes:"",createdAt:now(),updatedAt:now()
      });
      refs.forEach((ref,i)=>tx.set(ref,{
        number:numbers[i],status:"reserved",participantId:participantRef.id,participantName:String(payload.name||"").trim(),
        phone,reservedAt:now(),updatedAt:now()
      },{merge:true}));
    });
    return {participantId:participantRef.id,publicCode,numbers};
  }
  function listenCollection(name,orderField,callback){
    init();let q=db.collection(name);if(orderField)q=q.orderBy(orderField,"desc");
    return q.onSnapshot(s=>callback(s.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error(name,e));
  }
  function listenNumbers(cb,onError){init();return db.collection("numbers").orderBy("number").onSnapshot(s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),e=>{console.error("numbers",e);if(onError)onError(e);});}
  async function findParticipationByPhone(phone){
    init();
    const normalized=String(phone||"").replace(/\D/g,"");
    if(normalized.length!==10) throw new Error("Escribe un teléfono de 10 dígitos.");

    // La colección numbers es pública para consulta y guarda el teléfono
    // normalizado en cada número apartado. Leemos la colección y filtramos
    // localmente para evitar fallos de permisos/índices en consultas where.
    const snap=await db.collection("numbers").get();
    const rows=snap.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(row=>String(row.phone||"").replace(/\D/g,"")===normalized)
      .filter(row=>row.status!=="available");
    rows.sort((a,b)=>Number(a.number)-Number(b.number));
    return rows;
  }
  const listenParticipants=cb=>listenCollection("participants","createdAt",cb);
  const listenAudit=cb=>listenCollection("audit","at",cb);
  const listenDraws=cb=>listenCollection("draws","createdAt",cb);
  async function login(email,password){init();return auth.signInWithEmailAndPassword(email,password)}
  async function logout(){init();return auth.signOut()}
  function onAuth(cb){init();return auth.onAuthStateChanged(cb)}
  async function setParticipantStatus(id,status){
    init();
    const pRef=db.collection("participants").doc(id);
    await db.runTransaction(async tx=>{
      const pDoc=await tx.get(pRef);if(!pDoc.exists)throw new Error("Participante no encontrado.");
      const p=pDoc.data();
      const release=status==="available"||status==="expired";
      const paid=status==="paid";
      const pending=status==="reserved"||status==="pending_transfer"||status==="pending_cash";
      const participantStatus=release?(status==="expired"?"expired":"released"):
        paid?"paid":
        status==="pending_cash"?"pending_cash":
        status==="pending_transfer"?"pending_transfer":
        (p.paymentMethod==="efectivo"?"pending_cash":"pending_transfer");
      const numberStatus=release?"available":paid?"paid":"reserved";
      tx.update(pRef,{
        status:participantStatus,
        paidAt:paid?now():(p.paidAt||null),
        paymentConfirmedAt:paid?now():(p.paymentConfirmedAt||null),
        expiredAt:status==="expired"?now():(p.expiredAt||null),
        updatedAt:now()
      });
      (p.numbers||[]).forEach(n=>tx.update(db.collection("numbers").doc(numId(n)),{
        status:numberStatus,participantId:release?"":id,participantName:release?"":p.name,
        phone:release?"":p.phone,updatedAt:now()
      }));
    });
    const b=db.batch();audit(b,"Estado",`Participante cambiado a ${status}`,id);await b.commit();
  }


  async function completePaymentByPhone(payload){
    init();
    const phone=String(payload.phone||"").replace(/\D/g,"");
    if(phone.length!==10) throw new Error("Escribe un teléfono de 10 dígitos.");
    const paymentMethod=payload.paymentMethod==="efectivo"?"efectivo":"transferencia";
    if(paymentMethod==="transferencia"&&!payload.receiptData) throw new Error("Adjunta el comprobante de transferencia.");

    const requestedIds=[...new Set((payload.participantIds||[]).map(String).filter(Boolean))];
    if(!requestedIds.length) throw new Error("Selecciona al menos un apartado pendiente.");

    const participantDocs=await Promise.all(requestedIds.map(id=>db.collection("participants").doc(id).get()));
    const valid=participantDocs.filter(doc=>doc.exists).map(doc=>({id:doc.id,...doc.data()})).filter(p=>
      String(p.phone||"").replace(/\D/g,"")===phone && ["pending_payment","reserved"].includes(String(p.status||""))
    );
    if(!valid.length) throw new Error("No encontramos apartados pendientes seleccionados con ese teléfono.");

    const batch=db.batch();
    const allNumbers=[];
    valid.forEach(p=>{
      const changes={paymentMethod,registrationMode:"reserve",updatedAt:now()};
      if(paymentMethod==="transferencia") Object.assign(changes,{status:"receipt_received",receiptData:String(payload.receiptData||""),receiptName:String(payload.receiptName||""),receiptType:String(payload.receiptType||""),receiptSize:Number(payload.receiptSize||0),receiptReceivedAt:now()});
      else Object.assign(changes,{status:"pending_cash",receiptData:"",receiptName:"",receiptType:"",receiptSize:0});
      batch.update(db.collection("participants").doc(p.id),changes);
      audit(batch,paymentMethod==="transferencia"?"Comprobante recibido":"Pago en efectivo notificado",paymentMethod==="transferencia"?"El participante completó el pago por transferencia desde el sitio":"El participante notificó pago en efectivo desde el sitio",p.id);
      (p.numbers||[]).forEach(n=>allNumbers.push(Number(n)));
    });
    await batch.commit();
    allNumbers.sort((a,b)=>a-b);
    return {participantIds:valid.map(p=>p.id),name:valid[0]?.name||"Participante",numbers:allNumbers,total:allNumbers.length*200,paymentMethod};
  }
  async function markTicketSent(id,isResend=false){
    init();
    const ref=db.collection("participants").doc(id),doc=await ref.get();
    if(!doc.exists)throw new Error("Participante no encontrado.");
    const p=doc.data(),batch=db.batch();
    batch.update(ref,{ticketGenerated:true,ticketSent:true,ticketSentAt:now(),ticketResendCount:Number(p.ticketResendCount||0)+(isResend?1:0),updatedAt:now()});
    audit(batch,isResend?"Boleto reenviado":"Boleto enviado",isResend?"Boleto digital reenviado por WhatsApp":"Boleto digital enviado por WhatsApp",id);
    await batch.commit();
  }

  async function markReminderSent(id){
    init();
    const ref=db.collection("participants").doc(id);
    const doc=await ref.get();
    if(!doc.exists) throw new Error("Participante no encontrado.");
    const batch=db.batch();
    batch.update(ref,{reminderDue:false,reminderSent:true,reminderSentAt:now(),updatedAt:now()});
    audit(batch,"Recordatorio","Recordatorio enviado por WhatsApp",id);
    await batch.commit();
  }
  async function processReservationAutomation(){
    init();
    if(!auth.currentUser) return {expired:0,reminders:0};
    const snap=await db.collection("participants").get();
    const current=new Date();
    const reminderLimit=new Date(current.getTime()+24*60*60*1000);
    let expired=0,reminders=0;
    for(const doc of snap.docs){
      const p=doc.data();
      const status=p.status==="reserved"?(p.paymentMethod==="efectivo"?"pending_cash":"pending_transfer"):p.status;
      if(status!=="pending_payment"&&status!=="pending_transfer"&&status!=="pending_cash"&&status!=="receipt_received") continue;
      const expires=p.expiresAt?.toDate?p.expiresAt.toDate():(p.expiresAt?new Date(p.expiresAt):null);
      if(!expires||isNaN(expires)) continue;
      if(expires<=current){
        await db.runTransaction(async tx=>{
          const ref=db.collection("participants").doc(doc.id),fresh=await tx.get(ref);
          if(!fresh.exists) return;
          const data=fresh.data(),st=data.status==="reserved"?(data.paymentMethod==="efectivo"?"pending_cash":"pending_transfer"):data.status;
          if(st!=="pending_payment"&&st!=="pending_transfer"&&st!=="pending_cash"&&st!=="receipt_received") return;
          tx.update(ref,{status:"expired",expiredAt:now(),releasedAt:now(),updatedAt:now()});
          (data.numbers||[]).forEach(n=>tx.update(db.collection("numbers").doc(numId(n)),{status:"available",participantId:"",participantName:"",phone:"",updatedAt:now()}));
        });
        const batch=db.batch();audit(batch,"Liberación automática","Reserva vencida; números liberados",doc.id);await batch.commit();
        expired++;
      }else if(expires<=reminderLimit&&!p.reminderSent&&!p.reminderDue){
        const batch=db.batch();
        batch.update(doc.ref,{reminderDue:true,reminderDueAt:now(),updatedAt:now()});
        audit(batch,"Recordatorio pendiente","La reserva vence en menos de 24 horas",doc.id);
        await batch.commit();
        reminders++;
      }
    }
    return {expired,reminders};
  }

  async function deleteParticipant(id){
    init();
    if(!auth.currentUser) throw new Error("Inicia sesión como administradora.");
    const ref=db.collection("participants").doc(id);
    const doc=await ref.get();
    if(!doc.exists) throw new Error("La ficha ya no existe.");
    const p=doc.data();
    if(!["released","expired"].includes(p.status)) throw new Error("Solo se pueden eliminar fichas liberadas o expiradas.");
    const batch=db.batch();
    batch.delete(ref);
    audit(batch,"Ficha eliminada",`Se eliminó una ficha liberada/expirada de ${p.name||"participante"}`,id);
    await batch.commit();
  }
  async function updateParticipant(id,changes){
    init();const ref=db.collection("participants").doc(id),doc=await ref.get();if(!doc.exists)throw new Error("Participante no encontrado.");
    const p=doc.data(),batch=db.batch();batch.update(ref,{...changes,updatedAt:now()});
    (p.numbers||[]).forEach(n=>batch.update(db.collection("numbers").doc(numId(n)),{participantName:changes.name||p.name,phone:changes.phone||p.phone,updatedAt:now()}));
    audit(batch,"Participante","Datos actualizados",id);await batch.commit();
  }
  async function updateNumber(number,changes){init();const batch=db.batch();batch.update(db.collection("numbers").doc(numId(number)),{...changes,updatedAt:now()});audit(batch,"Número",`${numId(number)} actualizado`);await batch.commit();}
  async function registerDraw(draw){init();const ref=db.collection("draws").doc(),batch=db.batch();batch.set(ref,{...draw,createdAt:now()});audit(batch,"Sorteo",`Ganador ${numId(draw.winnerNumber)}`,draw.participantId||"");await batch.commit();return{id:ref.id,...draw,createdAt:new Date().toISOString()};}
  window.RifaFirebase={isConfigured:()=>ready,ensureNumbers,registerParticipant,completePaymentByPhone,findParticipationByPhone,listenNumbers,listenParticipants,listenAudit,listenDraws,login,logout,onAuth,setParticipantStatus,markTicketSent,markReminderSent,processReservationAutomation,updateParticipant,deleteParticipant,updateNumber,registerDraw};
})();
