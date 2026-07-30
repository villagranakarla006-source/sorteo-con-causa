(function(){
  "use strict";

  const cfg=window.RIFA_CONFIG||{};
  const TOTAL=Number(cfg.totalNumbers||500);
  const PRICE=Number(cfg.ticketPrice||200);
  const ui=window.RifaUI||{};
  const firebaseEnabled=cfg.mode==="firebase"&&window.RifaFirebase&&RifaFirebase.isConfigured();
  const selectionKey="rifa-selected-v12-rc2";
  const $=selector=>document.querySelector(selector);
  const fmt=n=>String(Number(n)).padStart(3,"0");

  let selected=new Set();
  try{ selected=new Set(JSON.parse(localStorage.getItem(selectionKey)||"[]").map(Number)); }catch(_){ selected=new Set(); }
  let records=Array.from({length:TOTAL},(_,i)=>({number:i+1,status:"available"}));
  let activeStart=null;
  let lastReceiptFile=null;
  let lastWhatsappMessage="";
  let lastWhatsappUrl="";
  let registrationMode="pay_now";

  const grid=$("#numberGrid");
  const tabs=$("#rangeTabs");
  const dialog=$("#registrationDialog");
  const form=$("#registrationForm");
  const receiptFileInput=$("#receiptFile");
  const receiptShareActions=$("#receiptShareActions");
  const openWhatsappButton=$("#openWhatsappButton");
  const numberSearch=$("#numberSearch");
  const numberSearchStatus=$("#numberSearchStatus");
  const transferPaymentSection=$("#transferPaymentSection");
  const cashPaymentSection=$("#cashPaymentSection");

  function saveSelection(){ localStorage.setItem(selectionKey,JSON.stringify([...selected])); }
  function loadLocal(){ if(window.RifaLocalDB) records=RifaLocalDB.load().numbers; }

  function setMode(text,isFirebase=false){
    const banner=$("#modeBanner");
    if(!banner)return;
    banner.textContent=text;
    banner.classList.toggle("firebase",isFirebase);
  }

  function renderTabs(){
    tabs.innerHTML="";
    for(let start=1;start<=TOTAL;start+=100){
      const button=document.createElement("button");
      button.type="button";
      button.textContent=`${fmt(start)}–${fmt(Math.min(start+99,TOTAL))}`;
      button.className=start===activeStart?"active":"";
      button.addEventListener("click",()=>{activeStart=start;renderTabs();renderGrid();});
      tabs.appendChild(button);
    }
  }

  function renderGrid(){
    const query=(numberSearch?.value||"").replace(/\D/g,"");
    grid.innerHTML="";
    if(!query&&!activeStart){
      grid.innerHTML='<p class="range-prompt">Selecciona un bloque para mostrar sus números.</p>';
      return;
    }
    const start=query?1:activeStart;
    const end=query?TOTAL:Math.min(activeStart+99,TOTAL);
    let visible=0;

    for(let number=start;number<=end;number++){
      if(query&&!fmt(number).includes(query)&&!String(number).includes(query))continue;
      const row=records[number-1]||{number,status:"available"};
      const button=document.createElement("button");
      button.type="button";
      button.dataset.number=String(number);
      button.className=`number ${row.status||"available"}`;

      if(row.status==="paid") button.innerHTML=`<span class="paid-heart" aria-hidden="true">♥</span><span class="paid-number">${fmt(number)}</span>`;
      else button.textContent=fmt(number);

      if(row.status!=="available"){
        selected.delete(number);
        button.disabled=true;
      }else{
        if(selected.has(number))button.classList.add("selected");
        button.addEventListener("click",()=>{
          selected.has(number)?selected.delete(number):selected.add(number);
          saveSelection();
          renderGrid();
          updateSelectionSummary();
        });
      }
      grid.appendChild(button);
      visible++;
    }
    saveSelection();
    if(query&&numberSearchStatus){
      numberSearchStatus.innerHTML=visible?`Se encontraron <strong>${visible}</strong> coincidencias.`:"No se encontraron números con esa búsqueda.";
    }
  }

  function updateSelectionSummary(){
    const numbers=[...selected].sort((a,b)=>a-b);
    $("#selectedNumbers").textContent=numbers.length?numbers.map(fmt).join(", "):"Ninguno";
    const payNow=$("#payNowButton");
    const reserve=$("#reserveNumbersButton");
    if(payNow)payNow.disabled=!numbers.length;
    if(reserve)reserve.disabled=!numbers.length;
    const actionHelp=$("#boardActionHelp");
    if(actionHelp)actionHelp.textContent=numbers.length?"Elige cómo deseas continuar con los números seleccionados.":"Primero selecciona uno o más números para pagar o apartar.";
    const clear=$("#clearSelectionButton");
    if(clear)clear.disabled=!numbers.length;
    const hidden=$("#selectedNumbersInput");
    if(hidden)hidden.value=numbers.join(",");
  }

  function updatePaymentMethodUI(){
    const isReservation=registrationMode==="reserve";
    const fieldset=$("#paymentMethodFieldset");
    const notice=$("#reservationNotice");
    if(fieldset)fieldset.hidden=isReservation;
    if(notice)notice.hidden=!isReservation;
    const method=form?.querySelector('input[name="paymentMethod"]:checked')?.value||"transferencia";
    const isTransfer=method==="transferencia";
    if(transferPaymentSection)transferPaymentSection.hidden=isReservation||!isTransfer;
    if(cashPaymentSection)cashPaymentSection.hidden=isReservation||isTransfer;
    if(receiptFileInput)receiptFileInput.required=!isReservation&&isTransfer;
    if((isReservation||!isTransfer)&&receiptFileInput)receiptFileInput.value="";
  }

  function resetForm({close=false}={}){
    form?.reset();
    updatePaymentMethodUI();
    const status=$("#formStatus");
    if(status){status.textContent="";status.className="form-status";}
    lastReceiptFile=null;
    lastWhatsappMessage="";
    lastWhatsappUrl="";
    if(receiptShareActions)receiptShareActions.hidden=true;
    const submit=$("#submitRegistration");
    if(submit){submit.hidden=false;submit.disabled=false;}
    if(close&&dialog?.open)dialog.close();
  }

  function clearSelection(){
    selected.clear();
    saveSelection();
    if(numberSearch)numberSearch.value="";
    if(numberSearchStatus)numberSearchStatus.textContent="";
    resetForm({close:true});
    updateSelectionSummary();
    renderGrid();
  }

  function openDialog(mode="pay_now"){
    const numbers=[...selected].sort((a,b)=>a-b);
    if(!numbers.length)return;
    registrationMode=mode;
    resetForm();
    const title=$("#registrationDialogTitle");
    const modeInput=$("#registrationMode");
    const submit=$("#submitRegistration");
    if(modeInput)modeInput.value=mode;
    if(title)title.textContent=mode==="reserve"?"Aparta tus números":"Paga tu participación ahora";
    if(submit)submit.textContent=mode==="reserve"?"Apartar números por 7 días":"Registrar pago";
    updatePaymentMethodUI();
    $("#modalSelectedNumbers").textContent=numbers.map(fmt).join(", ");
    $("#ticketCount").textContent=String(numbers.length);
    $("#paymentTotal").textContent=`$${(numbers.length*PRICE).toLocaleString("es-MX")} MXN`;
    $("#selectedNumbersInput").value=numbers.join(",");
    dialog.showModal();
  }

  async function prepareReceiptForPanel(file){
    if(!file)return "";
    const type=String(file.type||"").toLowerCase();

    // Los PDF pequeños pueden guardarse directamente en Firestore.
    if(type.includes("pdf")){
      if(file.size>500*1024)return "";
      return await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result||""));
        reader.onerror=()=>reject(new Error("No fue posible leer el comprobante."));
        reader.readAsDataURL(file);
      });
    }

    // Las fotografías se reducen antes de guardarlas para respetar el límite de Firestore.
    if(type.startsWith("image/")){
      const objectUrl=URL.createObjectURL(file);
      try{
        const image=await new Promise((resolve,reject)=>{
          const img=new Image();
          img.onload=()=>resolve(img);
          img.onerror=()=>reject(new Error("No fue posible procesar la imagen del comprobante."));
          img.src=objectUrl;
        });
        const maxSide=1100;
        const scale=Math.min(1,maxSide/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height));
        const canvas=document.createElement("canvas");
        canvas.width=Math.max(1,Math.round((image.naturalWidth||image.width)*scale));
        canvas.height=Math.max(1,Math.round((image.naturalHeight||image.height)*scale));
        const ctx=canvas.getContext("2d",{alpha:false});
        ctx.fillStyle="#fff";
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(image,0,0,canvas.width,canvas.height);

        let quality=.78;
        let data=canvas.toDataURL("image/jpeg",quality);
        while(data.length>420000&&quality>.36){
          quality-=.08;
          data=canvas.toDataURL("image/jpeg",quality);
        }
        if(data.length>500000)throw new Error("La imagen del comprobante es demasiado grande. Toma una captura más ligera e inténtalo de nuevo.");
        return data;
      }finally{
        URL.revokeObjectURL(objectUrl);
      }
    }

    if(file.size>500*1024)return "";
    return await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||""));
      reader.onerror=()=>reject(new Error("No fue posible leer el comprobante."));
      reader.readAsDataURL(file);
    });
  }

  function downloadFile(file){
    if(!file)return;
    const url=URL.createObjectURL(file);
    const link=document.createElement("a");
    link.href=url;
    link.download=file.name||"comprobante";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function buildMessage(name,phone,numbers,total,paymentMethod){
    return `Hola. 💗\n\nEnvío notificación de registro.\nNombre: ${name}\nTeléfono: ${phone}\nNúmeros seleccionados: ${numbers.map(fmt).join(", ")}\nTotal: $${total.toLocaleString("es-MX")} MXN\nMétodo de pago: ${paymentMethod==="efectivo"?"Efectivo":"Transferencia"}.\n\nMis números quedaron APARTADOS en amarillo, en espera de confirmación.\n\nGracias por apoyar esta causa, tu participación es esperanza de vida.`;
  }

  async function shareMessageAndReceipt(){
    if(!lastReceiptFile){
      alert("Selecciona primero la imagen o PDF del comprobante.");
      receiptFileInput?.click();
      return;
    }
    try{
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[lastReceiptFile]}))){
        await navigator.share({title:"Comprobante — Rifa con Causa",text:lastWhatsappMessage,files:[lastReceiptFile]});
        return;
      }
    }catch(error){
      if(error?.name==="AbortError")return;
    }
    downloadFile(lastReceiptFile);
    window.open(lastWhatsappUrl,"_blank","noopener");
    alert("Se abrió WhatsApp y se descargó el comprobante. Usa el clip de WhatsApp para adjuntar el archivo descargado.");
  }

  openWhatsappButton?.addEventListener("click",event=>{
    event.preventDefault();
    if(!lastWhatsappUrl){
      alert("Primero completa tu registro para generar la notificación.");
      return;
    }
    // Abrir siempre el chat de la organizadora en la misma pestaña.
    // Esto evita que los navegadores móviles bloqueen la ventana emergente.
    window.location.assign(lastWhatsappUrl);
  });

  $("#payNowButton")?.addEventListener("click",()=>openDialog("pay_now"));
  $("#reserveNumbersButton")?.addEventListener("click",()=>openDialog("reserve"));
  $("#showPayment")?.addEventListener("click",()=>selected.size?openDialog("pay_now"):$("#tablero")?.scrollIntoView({behavior:"smooth"}));
  $("#clearSelectionButton")?.addEventListener("click",clearSelection);
  $("#closeDialog")?.addEventListener("click",()=>dialog.close());
  $("#copyClabe")?.addEventListener("click",async event=>{
    try{await navigator.clipboard.writeText(cfg.clabe);event.currentTarget.textContent="CLABE copiada";}
    catch(_){prompt("Copia la CLABE:",cfg.clabe);}
  });
  numberSearch?.addEventListener("input",()=>{numberSearch.value=(numberSearch.value||"").replace(/\D/g,"").slice(0,3);renderGrid();});
  numberSearch?.addEventListener("keydown",event=>{
    if(event.key!=="Enter")return;
    event.preventDefault();
    const exact=Number((numberSearch.value||"").replace(/\D/g,""));
    if(exact<1||exact>TOTAL)return;
    const row=records[exact-1]||{status:"available"};
    if(row.status!=="available"){
      numberSearchStatus.textContent=`El número ${fmt(exact)} no está disponible.`;
      return;
    }
    selected.add(exact);saveSelection();renderGrid();updateSelectionSummary();
    numberSearchStatus.innerHTML=`Número <strong>${fmt(exact)}</strong> seleccionado.`;
  });
  form?.querySelectorAll('input[name="paymentMethod"]').forEach(input=>input.addEventListener("change",updatePaymentMethodUI));

  form?.addEventListener("submit",async event=>{
    event.preventDefault();
    const submit=$("#submitRegistration");
    const status=$("#formStatus");
    const name=$("#participantName").value.trim();
    const phone=$("#participantPhone").value.replace(/\D/g,"");
    const numbers=[...selected].sort((a,b)=>a-b);
    const mode=registrationMode;
    const paymentMethod=mode==="reserve"?"":(form.querySelector('input[name="paymentMethod"]:checked')?.value||"transferencia");
    const collaborator=(document.querySelector("#participantCollaborator")?.value||"").trim();
    const file=receiptFileInput?.files?.[0]||null;

    status.className="form-status";
    if(!numbers.length){status.textContent="Selecciona al menos un número.";return;}
    if(name.length<3){status.textContent="Escribe tu nombre completo.";return;}
    if(phone.length!==10){status.textContent="Escribe un teléfono de 10 dígitos.";return;}
    if(mode==="pay_now"&&paymentMethod==="transferencia"&&!file){status.textContent="Para pagar por transferencia debes adjuntar el comprobante.";return;}
    if(file&&file.size>10*1024*1024){status.textContent="El comprobante debe pesar menos de 10 MB.";return;}

    submit.disabled=true;
    ui.setLoading?.(submit,true,"Registrando…");
    status.textContent="Guardando tu registro y apartando tus números…";

    try{
      const total=numbers.length*PRICE;
      // Guarda una copia optimizada del comprobante para mostrarla en la ficha administrativa.
      // El comprobante se guarda únicamente para revisión administrativa.
      let receiptData=await prepareReceiptForPanel(file);
      if(firebaseEnabled){
        await RifaFirebase.registerParticipant({name,phone,numbers,total,registrationMode:mode,paymentMethod,collaborator,receiptData,receiptName:file?.name||"",receiptType:file?.type||"",receiptSize:file?.size||0});
      }else{
        if(!window.RifaLocalDB)throw new Error("No fue posible iniciar el registro.");
        if(file&&!receiptData&&file.size<=2*1024*1024){
          receiptData=await new Promise((resolve,reject)=>{
            const reader=new FileReader();
            reader.onload=()=>resolve(reader.result);
            reader.onerror=()=>reject(new Error("No fue posible leer el comprobante."));
            reader.readAsDataURL(file);
          });
        }
        RifaLocalDB.reserve(numbers,{name,phone,total,registrationMode:mode,paymentMethod,collaborator,receiptData,receiptName:file?.name||"",receiptType:file?.type||""});
        loadLocal();
      }

      lastReceiptFile=file;
      lastWhatsappMessage=mode==="reserve"
        ?`Hola. 💗

Envío notificación de registro y apartado.
Nombre: ${name}
Teléfono: ${phone}
Números apartados: ${numbers.map(fmt).join(", ")}
Total: $${total.toLocaleString("es-MX")} MXN

Tengo 7 días para completar el pago desde el botón Pagos pendientes del tablero.

Gracias por apoyar esta causa, tu participación es esperanza de vida.`
        :buildMessage(name,phone,numbers,total,paymentMethod);
      lastWhatsappUrl=`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(lastWhatsappMessage)}`;
      openWhatsappButton.href=lastWhatsappUrl;
      receiptShareActions.hidden=false;
      if(openWhatsappButton){
        openWhatsappButton.className="button primary full whatsapp-main-action whatsapp-main-action--active";
        openWhatsappButton.textContent="Enviar notificación de registro";
        openWhatsappButton.href=lastWhatsappUrl;
      }

      selected.clear();
      saveSelection();
      updateSelectionSummary();
      renderGrid();
      submit.hidden=true;
      status.className="form-status success";
      const nextStep="Ahora presiona el botón resaltado <strong>Enviar notificación de registro</strong>.";
      if(mode==="reserve"){
        status.innerHTML=`<strong>¡Tus números quedaron apartados! 💗</strong><br><br><strong>Números:</strong> ${numbers.map(fmt).join(", ")}<br><strong>Total:</strong> $${total.toLocaleString("es-MX")} MXN<br><strong>Plazo:</strong> 7 días para completar el pago.<br>${collaborator?`<strong>Colaborador:</strong> ${collaborator}<br>`:""}<br>Cuando estés lista(o), regresa al tablero y presiona <strong>Pagos pendientes</strong> usando el mismo teléfono.<br><br>${nextStep}`;
      }else{
        const methodLabel=paymentMethod==="efectivo"?"Efectivo":"Transferencia";
        const receiptState=file?"Comprobante recibido para revisión.":"Pago pendiente en efectivo.";
        status.innerHTML=`<strong>¡Gracias de corazón por tu valioso apoyo! 💗</strong><br><br>Tu participación fue recibida correctamente.<br><strong>Números:</strong> ${numbers.map(fmt).join(", ")}<br><strong>Total:</strong> $${total.toLocaleString("es-MX")} MXN<br><strong>Método de pago:</strong> ${methodLabel}<br><strong>Estatus:</strong> ${receiptState}<br>${collaborator?`<strong>Colaborador:</strong> ${collaborator}<br>`:""}<br>${nextStep}`;
      }
      ui.toast?.("Registro realizado correctamente.","success");

      setTimeout(()=>receiptShareActions.scrollIntoView({behavior:"smooth",block:"nearest"}),100);
    }catch(error){
      console.error(error);
      status.className="form-status error";
      const message=String(error?.message||"");
      status.textContent=message.includes("permission")||message.includes("PERMISSION_DENIED")
        ?"Firebase rechazó el registro. Es necesario habilitar las reglas públicas de registro en Firestore."
        :message||"No fue posible realizar el registro. Intenta nuevamente.";
      ui.toast?.(status.textContent,"error");
    }finally{
      ui.setLoading?.(submit,false);
      if(!submit.hidden)submit.disabled=false;
    }
  });

  const completeDialog=$("#completePaymentDialog");
  const completeForm=$("#completePaymentForm");
  let pendingLookup=null;

  function selectedPendingIds(){
    return [...document.querySelectorAll('input[name="pendingParticipant"]:checked')].map(input=>input.value);
  }
  function updatePendingSelectionSummary(){
    if(!pendingLookup)return;
    const ids=selectedPendingIds();
    const selectedRecords=pendingLookup.records.filter(record=>ids.includes(record.participantId));
    const totalNumbers=selectedRecords.reduce((sum,record)=>sum+record.numbers.length,0);
    const total=totalNumbers*PRICE;
    const totalBox=$("#pendingSelectedTotal");
    if(totalBox)totalBox.textContent=`Seleccionados: ${selectedRecords.length} apartado(s) · ${totalNumbers} número(s) · $${total.toLocaleString("es-MX")} MXN`;
    const submit=$("#submitCompletePayment");
    if(submit)submit.disabled=!ids.length;
  }

  $("#openCompletePayment")?.addEventListener("click",()=>completeDialog?.showModal());
  $("#closeCompletePayment")?.addEventListener("click",()=>completeDialog?.close());
  $("#findPendingRegistration")?.addEventListener("click",async()=>{
    const phone=( $("#completePaymentPhone")?.value||"" ).replace(/\D/g,"");
    const status=$("#completePaymentStatus");
    status.textContent="Buscando apartados…";
    try{
      if(!firebaseEnabled)throw new Error("Esta función requiere conexión con Firebase.");
      const rows=await RifaFirebase.findParticipationByPhone(phone);
      const pending=rows.filter(r=>r.status==="reserved"&&r.participantId);
      if(!pending.length)throw new Error("No encontramos números pendientes con ese teléfono.");

      const grouped=new Map();
      pending.forEach(row=>{
        if(!grouped.has(row.participantId))grouped.set(row.participantId,{participantId:row.participantId,name:row.participantName||"Participante",numbers:[]});
        grouped.get(row.participantId).numbers.push(Number(row.number));
      });
      const records=[...grouped.values()].map(record=>({...record,numbers:record.numbers.sort((a,b)=>a-b)}));
      pendingLookup={phone,records,name:records[0]?.name||"Participante"};

      const summary=$("#pendingRegistrationSummary");
      summary.hidden=false;
      summary.innerHTML=`<div class="pending-registration-total"><strong>${pendingLookup.name}</strong><br>Encontramos ${records.length} apartado(s) pendiente(s).</div>${records.map((record,index)=>`<label class="pending-registration-option"><input type="checkbox" name="pendingParticipant" value="${record.participantId}" checked><span><strong>Apartado ${index+1}</strong><span>Números: ${record.numbers.map(fmt).join(", ")}</span><span>Total: $${(record.numbers.length*PRICE).toLocaleString("es-MX")} MXN</span></span></label>`).join("")}<label class="pending-registration-option"><input type="checkbox" id="selectAllPending" checked><span><strong>Seleccionar todos</strong><span>Marca o desmarca todos los apartados pendientes.</span></span></label><div class="pending-registration-total" id="pendingSelectedTotal"></div>`;
      summary.querySelectorAll('input[name="pendingParticipant"]').forEach(input=>input.addEventListener("change",()=>{
        const all=[...summary.querySelectorAll('input[name="pendingParticipant"]')];
        const selectAll=$("#selectAllPending");
        if(selectAll)selectAll.checked=all.every(item=>item.checked);
        updatePendingSelectionSummary();
      }));
      $("#selectAllPending")?.addEventListener("change",event=>{
        summary.querySelectorAll('input[name="pendingParticipant"]').forEach(input=>input.checked=event.currentTarget.checked);
        updatePendingSelectionSummary();
      });

      $("#completePaymentMethodFieldset").hidden=false;
      $("#completeReceiptLabel").hidden=false;
      $("#submitCompletePayment").hidden=false;
      updateCompletePaymentMethodUI();
      updatePendingSelectionSummary();
      status.textContent="Selecciona uno, varios o todos los apartados que deseas pagar.";
    }catch(error){pendingLookup=null;$("#pendingRegistrationSummary").hidden=true;$("#completePaymentMethodFieldset").hidden=true;$("#completeReceiptLabel").hidden=true;$("#submitCompletePayment").hidden=true;status.textContent=error.message||"No fue posible buscar los apartados.";}
  });
  function updateCompletePaymentMethodUI(){
    const method=completeForm?.querySelector('input[name="completePaymentMethod"]:checked')?.value||"transferencia";
    const label=$("#completeReceiptLabel");
    const input=$("#completeReceiptFile");
    if(label)label.hidden=method!=="transferencia";
    if(input){input.required=method==="transferencia";if(method!=="transferencia")input.value="";}
  }
  completeForm?.querySelectorAll('input[name="completePaymentMethod"]').forEach(input=>input.addEventListener("change",updateCompletePaymentMethodUI));

  completeForm?.addEventListener("submit",async event=>{
    event.preventDefault();
    const status=$("#completePaymentStatus"),file=$("#completeReceiptFile")?.files?.[0]||null;
    const paymentMethod=completeForm.querySelector('input[name="completePaymentMethod"]:checked')?.value||"transferencia";
    const participantIds=selectedPendingIds();
    if(!pendingLookup){status.textContent="Busca primero tus apartados.";return;}
    if(!participantIds.length){status.textContent="Selecciona al menos un apartado pendiente.";return;}
    if(paymentMethod==="transferencia"&&!file){status.textContent="Adjunta una imagen o PDF del comprobante.";return;}
    if(file&&file.size>10*1024*1024){status.textContent="El comprobante debe pesar menos de 10 MB.";return;}
    const button=$("#submitCompletePayment");button.disabled=true;status.textContent=paymentMethod==="transferencia"?"Guardando comprobante…":"Registrando notificación de pago en efectivo…";
    try{
      const receiptData=file?await prepareReceiptForPanel(file):"";
      const result=await RifaFirebase.completePaymentByPhone({phone:pendingLookup.phone,participantIds,paymentMethod,receiptData,receiptName:file?.name||"",receiptType:file?.type||"",receiptSize:file?.size||0});
      const methodText=paymentMethod==="efectivo"?"pago en efectivo":"comprobante de pago";
      const message=`Hola. 💗\n\nEnvío notificación de ${methodText}.\nNombre: ${result.name}\nTeléfono: ${pendingLookup.phone}\nNúmeros: ${(result.numbers||[]).map(fmt).join(", ")}\nTotal: $${Number(result.total||0).toLocaleString("es-MX")} MXN.\n\nGracias por apoyar esta causa, tu participación es esperanza de vida.`;
      status.innerHTML=`<strong>${paymentMethod==="transferencia"?"Comprobante guardado":"Notificación registrada"} correctamente.</strong><br>Se abrirá WhatsApp para avisar a la organizadora.`;
      setTimeout(()=>window.location.assign(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(message)}`),500);
    }catch(error){status.textContent=error.message||"No fue posible completar el pago.";button.disabled=false;}
  });

  renderTabs();
  updateSelectionSummary();

  if(firebaseEnabled){
    setMode("Firebase: sincronización en tiempo real",true);
    RifaFirebase.listenNumbers(rows=>{
      if(rows?.length){
        const normalized=Array.from({length:TOTAL},(_,i)=>({number:i+1,status:"available"}));
        rows.forEach(row=>{const n=Number(row.number);if(n>=1&&n<=TOTAL)normalized[n-1]=row;});
        records=normalized;
      }
      renderGrid();
    },()=>{setMode("Sin conexión con Firebase");renderGrid();});
  }else{
    setMode("Modo local: datos guardados en este navegador");
    loadLocal();renderGrid();
    window.addEventListener("rifa-local-change",()=>{loadLocal();renderGrid();});
  }
})();

(function enhanceSite(){
  const menuToggle=document.getElementById("menuToggle"),nav=document.getElementById("mainNav");
  menuToggle?.addEventListener("click",()=>{const open=nav.classList.toggle("open");menuToggle.setAttribute("aria-expanded",String(open));menuToggle.textContent=open?"×":"☰";});
  nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");menuToggle?.setAttribute("aria-expanded","false");if(menuToggle)menuToggle.textContent="☰";}));
  document.getElementById("shareRaffle")?.addEventListener("click",()=>{
    const url="https://villagranakarla006-source.github.io/sorteo-con-causa/";
    const text=[
      "Hola. 💗",
      "",
      "Quiero invitarte a apoyar una causa muy especial.",
      "",
      "Cada número tiene un costo de $200 MXN y podrás participar para ganar una Dodge Journey 2013.",
      "",
      "Elige tu número aquí:",
      "",
      url
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener");
  });
  if("IntersectionObserver" in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target);}}),{threshold:.12});
    document.querySelectorAll(".reveal").forEach(el=>observer.observe(el));
  }else document.querySelectorAll(".reveal").forEach(el=>el.classList.add("visible"));
})();
