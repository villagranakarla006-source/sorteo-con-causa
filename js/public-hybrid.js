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

  const grid=$("#numberGrid");
  const tabs=$("#rangeTabs");
  const dialog=$("#registrationDialog");
  const form=$("#registrationForm");
  const receiptFileInput=$("#receiptFile");
  const receiptShareActions=$("#receiptShareActions");
  const shareReceiptButton=$("#shareReceiptButton");
  const downloadReceiptButton=$("#downloadReceiptButton");
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
    $("#continueButton").disabled=!numbers.length;
    const clear=$("#clearSelectionButton");
    if(clear)clear.disabled=!numbers.length;
    const hidden=$("#selectedNumbersInput");
    if(hidden)hidden.value=numbers.join(",");
  }

  function updatePaymentMethodUI(){
    const method=form?.querySelector('input[name="paymentMethod"]:checked')?.value||"transferencia";
    const isTransfer=method==="transferencia";
    if(transferPaymentSection)transferPaymentSection.hidden=!isTransfer;
    if(cashPaymentSection)cashPaymentSection.hidden=isTransfer;
    if(receiptFileInput)receiptFileInput.required=isTransfer;
    if(!isTransfer&&receiptFileInput)receiptFileInput.value="";
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

  function openDialog(){
    const numbers=[...selected].sort((a,b)=>a-b);
    if(!numbers.length)return;
    resetForm();
    $("#modalSelectedNumbers").textContent=numbers.map(fmt).join(", ");
    $("#ticketCount").textContent=String(numbers.length);
    $("#paymentTotal").textContent=`$${(numbers.length*PRICE).toLocaleString("es-MX")} MXN`;
    $("#selectedNumbersInput").value=numbers.join(",");
    dialog.showModal();
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

  function buildMessage(name,phone,numbers,total){
    return `¡Gracias de corazón por tu valioso apoyo! 💗\n\nTu participación fue recibida correctamente y significa mucho para nosotros.\nNombre: ${name}\nTeléfono: ${phone}\nNúmeros seleccionados: ${numbers.map(fmt).join(", ")}\nTotal: $${total.toLocaleString("es-MX")} MXN\nComprobante: adjunto para revisión.\n\nTus números permanecerán en color amarillo como APARTADOS mientras revisamos el comprobante. Cuando el pago sea confirmado, cambiarán a color rosa/rojo como PAGADOS.\n\nTu generosidad hace una diferencia. Gracias por ser parte de esta causa.`;
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

  $("#continueButton")?.addEventListener("click",openDialog);
  $("#showPayment")?.addEventListener("click",()=>selected.size?openDialog():$("#tablero")?.scrollIntoView({behavior:"smooth"}));
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
  shareReceiptButton?.addEventListener("click",shareMessageAndReceipt);
  downloadReceiptButton?.addEventListener("click",()=>downloadFile(lastReceiptFile));

  form?.addEventListener("submit",async event=>{
    event.preventDefault();
    const submit=$("#submitRegistration");
    const status=$("#formStatus");
    const name=$("#participantName").value.trim();
    const phone=$("#participantPhone").value.replace(/\D/g,"");
    const numbers=[...selected].sort((a,b)=>a-b);
    const paymentMethod=form.querySelector('input[name="paymentMethod"]:checked')?.value||"transferencia";
    const file=receiptFileInput?.files?.[0]||null;

    status.className="form-status";
    if(!numbers.length){status.textContent="Selecciona al menos un número.";return;}
    if(name.length<3){status.textContent="Escribe tu nombre completo.";return;}
    if(phone.length!==10){status.textContent="Escribe un teléfono de 10 dígitos.";return;}
    if(paymentMethod==="transferencia"&&!file){status.textContent="Adjunta la imagen o PDF de tu comprobante.";receiptFileInput?.focus();return;}
    if(file&&file.size>10*1024*1024){status.textContent="El comprobante debe pesar menos de 10 MB.";return;}

    submit.disabled=true;
    ui.setLoading?.(submit,true,"Registrando…");
    status.textContent="Guardando tu registro y apartando tus números…";

    try{
      const total=numbers.length*PRICE;
      let receiptData="";
      // Firestore admite documentos de hasta 1 MB. Guardamos una copia visible en el panel
      // cuando el comprobante es pequeño; el archivo original siempre queda listo para compartir.
      if(file&&file.size<=600*1024){
        receiptData=await new Promise((resolve,reject)=>{
          const reader=new FileReader();
          reader.onload=()=>resolve(reader.result);
          reader.onerror=()=>reject(new Error("No fue posible leer el comprobante."));
          reader.readAsDataURL(file);
        });
      }
      if(firebaseEnabled){
        await RifaFirebase.registerParticipant({name,phone,numbers,total,paymentMethod,receiptData,receiptName:file?.name||"",receiptType:file?.type||"",receiptSize:file?.size||0});
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
        RifaLocalDB.reserve(numbers,{name,phone,total,paymentMethod,receiptData,receiptName:file?.name||"",receiptType:file?.type||""});
        loadLocal();
      }

      lastReceiptFile=file;
      lastWhatsappMessage=buildMessage(name,phone,numbers,total,paymentMethod);
      lastWhatsappUrl=`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(lastWhatsappMessage)}`;
      openWhatsappButton.href=lastWhatsappUrl;
      receiptShareActions.hidden=false;
      if(shareReceiptButton){
        shareReceiptButton.hidden=paymentMethod!=="transferencia";
        shareReceiptButton.className=paymentMethod==="transferencia"
          ? "button primary full whatsapp-main-action whatsapp-main-action--active"
          : "button secondary full";
      }
      if(openWhatsappButton){
        openWhatsappButton.className=paymentMethod==="transferencia"
          ? "button secondary full whatsapp-secondary-action"
          : "button primary full whatsapp-main-action whatsapp-main-action--active";
        openWhatsappButton.textContent=paymentMethod==="transferencia"
          ? "Abrir WhatsApp: enviar solo mensaje"
          : "Abrir WhatsApp con mi mensaje";
      }
      if(downloadReceiptButton)downloadReceiptButton.hidden=paymentMethod!=="transferencia";

      selected.clear();
      saveSelection();
      updateSelectionSummary();
      renderGrid();
      submit.hidden=true;
      status.className="form-status success";
      const methodLabel=paymentMethod==="efectivo"?"Efectivo":"Transferencia";
      const nextStep=paymentMethod==="efectivo"?"Ahora presiona <strong>Abrir WhatsApp: enviar solo mensaje</strong> para avisar a la administradora.":"Ahora presiona el botón resaltado <strong>Abrir WhatsApp: enviar mensaje y comprobante</strong>.";
      status.innerHTML=`<strong>¡Gracias de corazón por tu valioso apoyo! 💗</strong><br><br>Tu participación fue recibida correctamente.<br><strong>Números apartados:</strong> ${numbers.map(fmt).join(", ")}<br><strong>Total:</strong> $${total.toLocaleString("es-MX")} MXN<br><strong>Método de pago:</strong> ${methodLabel}<br><strong>Estatus:</strong> APARTADOS en amarillo, en espera de confirmación del pago.<br><br>${nextStep}`;
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
