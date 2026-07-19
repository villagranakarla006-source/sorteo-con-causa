(function(){
 const cfg=window.RIFA_CONFIG||{},TOTAL=cfg.totalNumbers||500,PRICE=cfg.ticketPrice||200,ui=window.RifaUI||{};
 const useFirebase=cfg.mode==="firebase"&&window.RifaFirebase&&RifaFirebase.isConfigured();
 const selectionKey="rifa-selected-v6",selected=new Set(JSON.parse(localStorage.getItem(selectionKey)||"[]"));
 const $=s=>document.querySelector(s),fmt=n=>String(n).padStart(3,"0");
 let records=Array.from({length:TOTAL},(_,i)=>({number:i+1,status:"available"})),activeStart=1;
 const grid=$("#numberGrid"),tabs=$("#rangeTabs"),dialog=$("#registrationDialog");
 let lastReceiptFile=null,lastWhatsappMessage="";
 const receiptShareActions=$("#receiptShareActions");
 const shareReceiptButton=$("#shareReceiptButton");
 const downloadReceiptButton=$("#downloadReceiptButton");

 function downloadReceiptFile(file){
   if(!file)return;
   const url=URL.createObjectURL(file),a=document.createElement("a");
   a.href=url;a.download=file.name||"comprobante";document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 shareReceiptButton?.addEventListener("click",async()=>{
   if(!lastReceiptFile){alert("No hay comprobante para compartir.");return}
   try{
     if(navigator.canShare?.({files:[lastReceiptFile]})&&navigator.share){
       await navigator.share({title:"Comprobante — Rifa con Causa",text:lastWhatsappMessage,files:[lastReceiptFile]});
     }else{
       downloadReceiptFile(lastReceiptFile);
       window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(lastWhatsappMessage)}`,"_blank","noopener");
       alert("El comprobante se descargó. Adjunta ese archivo en WhatsApp.");
     }
   }catch(err){
     if(err?.name!=="AbortError"){
       downloadReceiptFile(lastReceiptFile);
       alert("El archivo se descargó para que lo adjuntes manualmente.");
     }
   }
 });
 downloadReceiptButton?.addEventListener("click",()=>downloadReceiptFile(lastReceiptFile));

 $("#modeBanner").textContent=useFirebase?"Modo Firebase: sincronización en tiempo real":"Modo local: los datos permanecen en este navegador";
 if(useFirebase)$("#modeBanner").classList.add("firebase");

 function saveSel(){localStorage.setItem(selectionKey,JSON.stringify([...selected]))}
 function loadLocal(){records=RifaLocalDB.load().numbers}
 function renderTabs(){tabs.innerHTML="";for(let s=1;s<=TOTAL;s+=100){const b=document.createElement("button");b.type="button";b.textContent=`${fmt(s)}–${fmt(Math.min(s+99,TOTAL))}`;b.className=s===activeStart?"active":"";b.onclick=()=>{activeStart=s;renderTabs();renderGrid()};tabs.appendChild(b)}}
 function renderGrid(){
   const query=(document.querySelector("#numberSearch")?.value||"").replace(/\D/g,"");
   grid.innerHTML="";
   const start=query?1:activeStart;
   const end=query?TOTAL:Math.min(activeStart+99,TOTAL);
   let visible=0;
   for(let n=start;n<=end;n++){
     if(query&&!String(n).padStart(3,"0").includes(query)&&!String(n).includes(query))continue;
     const r=records[n-1]||{number:n,status:"available"},b=document.createElement("button");
     b.type="button";b.dataset.number=n;b.className=`number ${r.status}`;
     if(r.status==="paid")b.innerHTML=`<span class="paid-heart" aria-hidden="true">♥</span><span class="paid-number">${fmt(n)}</span>`;
     else b.textContent=fmt(n);
     if(r.status!=="available"){selected.delete(n);b.disabled=true}else{if(selected.has(n))b.classList.add("selected");b.onclick=()=>{selected.has(n)?selected.delete(n):selected.add(n);saveSel();renderGrid();update()}}
     grid.appendChild(b);visible++;
   }
   const status=document.querySelector("#numberSearchStatus");
   if(query&&status)status.innerHTML=visible?`Se encontraron <strong>${visible}</strong> coincidencias. Selecciona un número disponible para continuar.`:"No se encontraron números con esa búsqueda.";
 }
 function update(){const a=[...selected].sort((x,y)=>x-y);$("#selectedNumbers").textContent=a.length?a.map(fmt).join(", "):"Ninguno";$("#continueButton").disabled=!a.length}
 function openDialog(){const a=[...selected].sort((x,y)=>x-y);$("#modalSelectedNumbers").textContent=a.map(fmt).join(", ");$("#ticketCount").textContent=a.length;$("#paymentTotal").textContent=`$${(a.length*PRICE).toLocaleString("es-MX")} MXN`;dialog.showModal()}
 $("#continueButton").onclick=openDialog;$("#showPayment").onclick=()=>selected.size?openDialog():$("#tablero").scrollIntoView({behavior:"smooth"});
 $("#closeDialog").onclick=()=>dialog.close();
 $("#copyClabe").onclick=async()=>{try{ui.setLoading?.($("#submitRegistration"),true,"Registrando…");await navigator.clipboard.writeText(cfg.clabe);$("#copyClabe").textContent="Copiada"}catch(_){prompt("Copia la CLABE:",cfg.clabe)}};
 const numberSearch=$("#numberSearch"),numberSearchStatus=$("#numberSearchStatus");
 numberSearch?.addEventListener("input",()=>{const clean=(numberSearch.value||"").replace(/\D/g,"").slice(0,3);numberSearch.value=clean;renderGrid()});
 numberSearch?.addEventListener("keydown",e=>{if(e.key!=="Enter")return;e.preventDefault();const exact=Number((numberSearch.value||"").replace(/\D/g,""));if(exact<1||exact>TOTAL)return;const record=records[exact-1]||{status:"available"};if(record.status==="available"){selected.add(exact);saveSel();renderGrid();update();numberSearchStatus.innerHTML=`Número <strong>${fmt(exact)}</strong> seleccionado. Ya puedes continuar con el registro.`}});

 $("#registrationForm").onsubmit=async e=>{
   e.preventDefault();

   const submitButton=$("#submitRegistration");
   const name=$("#participantName").value.trim();
   const phone=$("#participantPhone").value.replace(/\D/g,"");
   const nums=[...selected].sort((a,b)=>a-b);
   const status=$("#formStatus");
   const file=null;

   status.className="form-status";

   if(!nums.length){
     status.textContent="Selecciona al menos un número.";
     return;
   }
   if(name.length<3){
     status.textContent="Escribe tu nombre completo.";
     return;
   }
   if(phone.length!==10){
     status.textContent="Escribe un teléfono de 10 dígitos.";
     return;
   }

   ui.setLoading?.(submitButton,true,"Guardando…");
   submitButton.disabled=true;
   status.textContent="Guardando registro y apartando números…";

   try{
     let savedRecord;

     if(useFirebase){
       savedRecord=await RifaFirebase.registerParticipant({
         name,
         phone,
         numbers:nums,
         total:nums.length*PRICE
       });
     }else{
       if(!window.RifaLocalDB){
         throw new Error("No se pudo iniciar la base local. Cierra y vuelve a abrir la página.");
       }

       let receiptData="",receiptName="",receiptType="";
       if(file){
         if(file.size>2*1024*1024){
           throw new Error("En modo local el comprobante debe pesar menos de 2 MB.");
         }
         receiptData=await new Promise((resolve,reject)=>{
           const reader=new FileReader();
           reader.onload=()=>resolve(reader.result);
           reader.onerror=()=>reject(new Error("No fue posible leer el comprobante."));
           reader.readAsDataURL(file);
         });
         receiptName=file.name;
         receiptType=file.type;
       }

       savedRecord=RifaLocalDB.reserve(nums,{
         name,
         phone,
         total:nums.length*PRICE,
         receiptData,
         receiptName,
         receiptType
       });

       const verification=RifaLocalDB.load();
       const savedParticipant=verification.participants.find(p=>p.id===savedRecord.id);
       const numbersReserved=nums.every(n=>verification.numbers[n-1]?.status==="reserved");

       if(!savedParticipant||!numbersReserved){
         throw new Error("El registro no pudo verificarse correctamente.");
       }

       records=verification.numbers;
       renderGrid();
     }

     const total=nums.length*PRICE;
     const msg=`¡Gracias de corazón por tu valioso apoyo! 💗\n\nTu participación fue recibida correctamente y significa mucho para nosotros.\nNombre: ${name}\nTeléfono: ${phone}\nNúmeros seleccionados: ${nums.map(fmt).join(", ")}\nTotal: $${total.toLocaleString("es-MX")} MXN\nComprobante: lo enviaré por WhatsApp para revisión.\n\nTus números permanecerán en color amarillo como APARTADOS mientras revisamos el comprobante. Cuando el pago sea confirmado, cambiarán a color rosa/rojo como PAGADOS.\n\nTu generosidad hace una diferencia. Gracias por ser parte de esta causa.`;

     lastReceiptFile=file||null;
     lastWhatsappMessage=msg;
     if(receiptShareActions)receiptShareActions.hidden=true;

     selected.clear();
     saveSel();
     update();
     renderGrid();

     $("#participantName").value="";
     $("#participantPhone").value="";
     

     status.className="form-status success";
     status.innerHTML=`<strong>¡Gracias por tu apoyo!</strong><br>Tu participación fue recibida correctamente y significa mucho para nosotros.<br><strong>Números apartados:</strong> ${nums.map(fmt).join(", ")}.<br>Por ahora aparecerán en color amarillo. Cuando se confirme el pago cambiarán a color rosa/rojo como pagados.`;

     ui.toast?.("Registro guardado y números apartados.","success");

     setTimeout(()=>{try{dialog.close()}catch(_){}},1800);

     const whatsappUrl=`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg)}`;
     const whatsappWindow=window.open(whatsappUrl,"_blank","noopener");
     if(!whatsappWindow){
       status.innerHTML+=`<br><a href="${whatsappUrl}" target="_blank" rel="noopener">Abrir WhatsApp</a>`;
     }
   }catch(err){
     status.className="form-status error";
     status.textContent=err.message||"No fue posible guardar el registro.";
     ui.toast?.(status.textContent,"error");
   }finally{
     ui.setLoading?.(submitButton,false);
     submitButton.disabled=false;
   }
 };

 renderTabs();
 if(useFirebase){RifaFirebase.listenNumbers(rows=>{records=rows;renderGrid()})}
 else{loadLocal();renderGrid();window.addEventListener("rifa-local-change",()=>{loadLocal();renderGrid()})}
})();


(function enhanceV9(){
 const menuToggle=document.getElementById("menuToggle"),nav=document.getElementById("mainNav");
 menuToggle?.addEventListener("click",()=>{
   const open=nav.classList.toggle("open");
   menuToggle.setAttribute("aria-expanded",String(open));
   menuToggle.textContent=open?"×":"☰";
 });
 nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");menuToggle?.setAttribute("aria-expanded","false");if(menuToggle)menuToggle.textContent="☰"}));

 const lightbox=document.getElementById("imageLightbox"),lightboxImage=document.getElementById("lightboxImage"),lightboxCaption=document.getElementById("lightboxCaption");
 const galleryItems=[...document.querySelectorAll("#galeria-premio [data-image]")];
 let galleryIndex=0;
 function openImage(src,label){
   if(!lightbox)return;
   const found=galleryItems.findIndex(el=>el.dataset.image===src);
   galleryIndex=found>=0?found:0;
   lightboxImage.src=src;
   if(lightboxCaption)lightboxCaption.textContent=label||galleryItems[galleryIndex]?.querySelector("span")?.textContent||"Dodge Journey 2013";
   lightbox.showModal();
 }
 function moveGallery(step){
   if(!galleryItems.length)return;
   galleryIndex=(galleryIndex+step+galleryItems.length)%galleryItems.length;
   const item=galleryItems[galleryIndex];
   lightboxImage.src=item.dataset.image;
   if(lightboxCaption)lightboxCaption.textContent=item.querySelector("span")?.textContent||"Dodge Journey 2013";
 }
 galleryItems.forEach(el=>el.addEventListener("click",()=>openImage(el.dataset.image,el.querySelector("span")?.textContent)));
 document.getElementById("closeLightbox")?.addEventListener("click",()=>lightbox.close());
 document.getElementById("prevGalleryImage")?.addEventListener("click",()=>moveGallery(-1));
 document.getElementById("nextGalleryImage")?.addEventListener("click",()=>moveGallery(1));
 document.addEventListener("keydown",e=>{if(!lightbox?.open)return;if(e.key==="ArrowLeft")moveGallery(-1);if(e.key==="ArrowRight")moveGallery(1);if(e.key==="Escape")lightbox.close()});
 lightbox?.addEventListener("click",e=>{if(e.target===lightbox)lightbox.close()});

 document.getElementById("shareRaffle")?.addEventListener("click",async()=>{
   const data={title:"Rifa con Causa",text:"Participa para ganar una Dodge Journey 2013. Tu generosidad hace una diferencia. Gracias por ser parte de esta causa.",url:location.href.split("#")[0]};
   try{
     if(navigator.share){await navigator.share(data)}
     else{await navigator.clipboard.writeText(data.url);window.RifaUI?.toast("Enlace copiado para compartir.","success")}
   }catch(e){if(e.name!=="AbortError")window.RifaUI?.toast("No fue posible compartir.","error")}
 });

 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target)}}),{threshold:.12});
 document.querySelectorAll(".reveal").forEach(el=>observer.observe(el));
})();
