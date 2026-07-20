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
    const participantRef=db.collection("participants").doc();
    const publicCode=Math.random().toString(36).slice(2,8).toUpperCase();
    await db.runTransaction(async tx=>{
      const refs=numbers.map(n=>db.collection("numbers").doc(numId(n)));
      const docs=await Promise.all(refs.map(ref=>tx.get(ref)));
      docs.forEach((doc,i)=>{
        if(doc.exists&&doc.data().status!=="available") throw new Error(`El número ${numId(numbers[i])} ya no está disponible.`);
      });
      tx.set(participantRef,{
        name:String(payload.name||"").trim(),phone:String(payload.phone||"").replace(/\D/g,""),numbers,
        total:Number(payload.total||numbers.length*200),status:"reserved",publicCode,receiptMethod:"whatsapp",
        receiptData:String(payload.receiptData||""),receiptName:String(payload.receiptName||""),
        receiptType:String(payload.receiptType||""),receiptSize:Number(payload.receiptSize||0),
        notes:"",createdAt:now(),updatedAt:now()
      });
      refs.forEach((ref,i)=>tx.set(ref,{
        number:numbers[i],status:"reserved",participantId:participantRef.id,participantName:String(payload.name||"").trim(),
        phone:String(payload.phone||"").replace(/\D/g,""),reservedAt:now(),updatedAt:now()
      },{merge:true}));
    });
    return {participantId:participantRef.id,publicCode,numbers};
  }
  function listenCollection(name,orderField,callback){
    init();let q=db.collection(name);if(orderField)q=q.orderBy(orderField,"desc");
    return q.onSnapshot(s=>callback(s.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error(name,e));
  }
  function listenNumbers(cb,onError){init();return db.collection("numbers").orderBy("number").onSnapshot(s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),e=>{console.error("numbers",e);if(onError)onError(e);});}
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
      const p=pDoc.data(),numberStatus=status==="available"?"available":status;
      tx.update(pRef,{status:status==="available"?"released":status,paidAt:status==="paid"?now():p.paidAt||null,updatedAt:now()});
      (p.numbers||[]).forEach(n=>tx.update(db.collection("numbers").doc(numId(n)),{
        status:numberStatus,participantId:status==="available"?"":id,participantName:status==="available"?"":p.name,
        phone:status==="available"?"":p.phone,updatedAt:now()
      }));
    });
    const b=db.batch();audit(b,"Estado",`Participante cambiado a ${status}`,id);await b.commit();
  }
  async function updateParticipant(id,changes){
    init();const ref=db.collection("participants").doc(id),doc=await ref.get();if(!doc.exists)throw new Error("Participante no encontrado.");
    const p=doc.data(),batch=db.batch();batch.update(ref,{...changes,updatedAt:now()});
    (p.numbers||[]).forEach(n=>batch.update(db.collection("numbers").doc(numId(n)),{participantName:changes.name||p.name,phone:changes.phone||p.phone,updatedAt:now()}));
    audit(batch,"Participante","Datos actualizados",id);await batch.commit();
  }
  async function updateNumber(number,changes){init();const batch=db.batch();batch.update(db.collection("numbers").doc(numId(number)),{...changes,updatedAt:now()});audit(batch,"Número",`${numId(number)} actualizado`);await batch.commit();}
  async function registerDraw(draw){init();const ref=db.collection("draws").doc(),batch=db.batch();batch.set(ref,{...draw,createdAt:now()});audit(batch,"Sorteo",`Ganador ${numId(draw.winnerNumber)}`,draw.participantId||"");await batch.commit();return{id:ref.id,...draw,createdAt:new Date().toISOString()};}
  window.RifaFirebase={isConfigured:()=>ready,ensureNumbers,registerParticipant,listenNumbers,listenParticipants,listenAudit,listenDraws,login,logout,onAuth,setParticipantStatus,updateParticipant,updateNumber,registerDraw};
})();
