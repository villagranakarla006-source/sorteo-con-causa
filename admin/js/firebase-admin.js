(function(){
 const $=s=>document.querySelector(s),fmt=n=>String(n).padStart(3,"0"),money=n=>`$${Number(n||0).toLocaleString("es-MX")} MXN`;
 let numbers=[],participants=[];
 if(!RifaFirebase.isConfigured()){$("#firebaseError").textContent="Completa firebase/firebase-config.js antes de usar este panel."}

 $("#firebaseLoginForm").onsubmit=async e=>{e.preventDefault();$("#firebaseError").textContent="";try{await RifaFirebase.login($("#firebaseEmail").value,$("#firebasePassword").value)}catch(err){$("#firebaseError").textContent=err.message}};
 $("#firebaseLogout").onclick=()=>RifaFirebase.logout();
 $("#initNumbers").onclick=async()=>{try{await RifaFirebase.ensureNumbers();alert("Los 500 números están listos.")}catch(err){alert(err.message)}};

 function render(){
   const q=$("#firebaseSearch").value.trim().toLowerCase(),f=$("#firebaseFilter").value;
   const list=participants.filter(p=>(f==="all"||p.status===f)&&(!q||`${p.name} ${p.phone} ${(p.numbers||[]).join(" ")}`.toLowerCase().includes(q)));
   $("#firebaseCards").innerHTML=list.map(p=>`<article class="participant-card"><div class="card-top"><div><h3>${p.name}</h3><p>${p.phone}</p></div><span class="badge ${p.status}">${p.status}</span></div><p class="numbers">${(p.numbers||[]).map(fmt).join(", ")}</p><p>${money(p.total)}</p><div class="card-actions"><button data-id="${p.id}" data-s="paid">Confirmar pago</button><button data-id="${p.id}" data-s="released" class="danger">Liberar</button>${p.receiptUrl?`<a href="${p.receiptUrl}" target="_blank" rel="noopener">Ver comprobante</a>`:""}</div></article>`).join("")||"<p>No hay participantes.</p>";
   document.querySelectorAll("[data-s]").forEach(b=>b.onclick=async()=>{try{await RifaFirebase.setParticipantStatus(b.dataset.id,b.dataset.s)}catch(err){alert(err.message)}});
   const a=numbers.filter(n=>n.status==="available").length,r=numbers.filter(n=>n.status==="reserved").length,p=numbers.filter(n=>n.status==="paid").length;
   $("#fa").textContent=a;$("#fr").textContent=r;$("#fp").textContent=p;$("#ft").textContent=money(p*((window.RIFA_CONFIG&&RIFA_CONFIG.ticketPrice)||200));
 }
 $("#firebaseSearch").oninput=render;$("#firebaseFilter").onchange=render;

 RifaFirebase.onAuth(user=>{
   $("#firebaseLogin").hidden=!!user;$("#firebasePanel").hidden=!user;
   if(user){RifaFirebase.listenNumbers(x=>{numbers=x;render()});RifaFirebase.listenParticipants(x=>{participants=x;render()})}
 });
})();
