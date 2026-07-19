(function(){
"use strict";
const cfg=window.RIFA_CONFIG||{},PRICE=Number(cfg.ticketPrice||200),TOTAL=Number(cfg.totalNumbers||500);
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const fmt=n=>String(Number(n)||0).padStart(3,"0");
const money=n=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(n||0));
const dateFmt=s=>s?new Date(s).toLocaleString("es-MX"):"—";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
let data,records=[],participants=[],currentParticipantId="",lastWinnerText="";

function loadData(){data=RifaLocalDB.load();records=data.numbers||[];participants=data.participants||[];participants.forEach(p=>(p.numbers||[]).forEach(n=>{const r=records[n-1];if(r&&r.status==="available"&&p.status!=="released"){r.status=p.status==="paid"?"paid":"reserved";r.participantId=p.id;r.participantName=p.name;r.phone=p.phone}}))}
function counts(){return{available:records.filter(r=>r.status==="available").length,reserved:records.filter(r=>r.status==="reserved").length,paid:records.filter(r=>r.status==="paid").length}}
function label(s){return s==="available"?"Disponible":s==="reserved"?"Apartado":s==="paid"?"Pagado":s==="released"?"Liberado":s||"Sin estado"}
function showView(id){$$(".tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===id));$$(".view").forEach(v=>v.hidden=v.id!==id);renderAll()}
function renderStats(){const c=counts();$("#available").textContent=c.available;$("#reserved").textContent=c.reserved;$("#paid").textContent=c.paid;$("#total").textContent=money(c.paid*PRICE)}
function renderDashboard(){
 const c=counts(),assigned=c.reserved+c.paid,pct=Math.round(assigned/TOTAL*100);
 $("#progressPercent").textContent=pct+"%";$("#progressBar").style.width=pct+"%";$("#progressPaid").textContent=`${c.reserved} apartados · ${c.paid} pagados · ${assigned} asignados en total`;
 [["available",c.available],["reserved",c.reserved],["paid",c.paid]].forEach(([k,v])=>{const p=Math.round(v/TOTAL*100);$("#"+k+"Bar").style.width=p+"%";$("#"+k+"Pct").textContent=p+"%"});
 const recent=(data.audit||[]).slice(0,8);
 $("#recentActivity").innerHTML=recent.length?recent.map(a=>`<div class="activity-item"><strong>${esc(a.action)}: ${esc(a.detail)}</strong><span>${dateFmt(a.at||a.createdAt)}</span></div>`).join(""):'<div class="empty-state">Todavía no hay movimientos.</div>';
}
function renderNumbers(){
 const q=($("#search").value||"").trim().toLowerCase(),f=$("#filter").value;
 const list=records.filter(r=>(f==="all"||r.status===f)&&(!q||`${r.number} ${fmt(r.number)} ${r.participantName||""} ${r.phone||""}`.toLowerCase().includes(q)));
 $("#numberResultCount").textContent=`${list.length} resultados`;
 $("#table").innerHTML=list.map(r=>`<tr><td><strong>${fmt(r.number)}</strong></td><td><span class="badge ${esc(r.status)}">${label(r.status)}</span></td><td>${esc(r.participantName||"—")}</td><td>${esc(r.phone||"—")}</td><td>${dateFmt(r.updatedAt||r.reservedAt)}</td><td><button type="button" data-n="${r.number}" class="edit-number">Editar</button></td></tr>`).join("");
 $$(".edit-number").forEach(b=>b.onclick=()=>openEdit(Number(b.dataset.n)));
}
function renderParticipants(){
 const q=($("#participantSearch").value||"").trim().toLowerCase(),f=$("#participantFilter").value,sf=$("#participantStatusFilter").value;
 const list=participants.filter(p=>{
   const matchF=f==="all"||p.status===f;
   const matchSf=!sf||p.status===sf||(sf==="available"&&p.status==="released");
   const text=`${p.name||""} ${p.phone||""} ${(p.numbers||[]).join(" ")} ${(p.numbers||[]).map(fmt).join(" ")}`.toLowerCase();
   return matchF&&matchSf&&(!q||text.includes(q));
 }).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
 $("#participantResultCount").textContent=`${list.length} participantes`;
 $("#participantCards").innerHTML=list.length?list.map(p=>`<article class="participant-card"><div class="card-top"><div><h3>${esc(p.name)}</h3><p>${esc(p.phone)}</p></div><span class="badge ${esc(p.status)}">${label(p.status)}</span></div><p class="numbers">${(p.numbers||[]).map(fmt).join(", ")||"Sin números"}</p><p>Registrado: ${dateFmt(p.createdAt)}</p><p>Comprobante: <strong>${p.receiptData?"Adjunto":"No adjunto"}</strong></p><div class="card-actions"><span class="amount">${money(p.total)}</span><button type="button" data-p="${esc(p.id)}" class="view-participant">Ver ficha</button></div></article>`).join(""):'<p class="empty-state">No hay participantes con ese filtro.</p>';
 $$(".view-participant").forEach(b=>b.onclick=()=>openParticipant(b.dataset.p));
}
function renderHistory(){const rows=data.audit||[];$("#historyTable").innerHTML=rows.length?rows.map(a=>`<tr><td>${dateFmt(a.at||a.createdAt)}</td><td>${esc(a.action)}</td><td>${esc(a.detail)}</td><td>${esc(a.participantId||"—")}</td></tr>`).join(""):'<tr><td colspan="4">Todavía no hay movimientos registrados.</td></tr>'}
function renderDraw(){
 const eligible=records.filter(r=>r.status==="paid"),ids=new Set(eligible.map(r=>r.participantId).filter(Boolean)),draws=data.draws||[],last=draws[0];
 $("#eligibleCount").textContent=eligible.length;$("#eligibleParticipants").textContent=ids.size;$("#lastWinner").textContent=last?fmt(last.winnerNumber):"—";
 $("#drawStatus").textContent=eligible.length?`Listo: ${eligible.length} números pagados participan.`:"Aún no hay números pagados. Confirma pagos desde Participantes.";
 $("#drawHistory").innerHTML=draws.length?draws.map(d=>`<tr><td>${dateFmt(d.createdAt)}</td><td><b>${fmt(d.winnerNumber)}</b></td><td>${esc(d.participantName||"—")}</td><td>${esc(d.phone||"—")}</td><td>${d.eligibleCount||0}</td></tr>`).join(""):'<tr><td colspan="5">Todavía no se ha realizado ningún sorteo.</td></tr>';
 if(last)showWinner(last);else $("#winnerCard").hidden=true;
}
function renderAll(){loadData();renderStats();renderDashboard();renderNumbers();renderParticipants();renderHistory();renderDraw()}
function openEdit(n){const r=records.find(x=>x.number===n);if(!r)return;$("#editNumber").value=n;$("#editTitle").textContent=`Número ${fmt(n)}`;$("#editStatus").value=r.status;$("#editName").value=r.participantName||"";$("#editPhone").value=r.phone||"";$("#editNotes").value=r.notes||"";$("#editDialog").showModal()}
function openParticipant(id){
 loadData();const p=participants.find(x=>x.id===id);if(!p)return;currentParticipantId=id;
 $("#participantId").value=id;$("#participantTitle").textContent=p.name||"Participante";$("#participantNameEdit").value=p.name||"";$("#participantPhoneEdit").value=p.phone||"";$("#participantNotesEdit").value=p.notes||"";$("#participantNumbers").textContent=(p.numbers||[]).map(fmt).join(", ")||"Sin números";$("#participantTotal").textContent=money(p.total);$("#participantCreated").textContent=dateFmt(p.createdAt);$("#participantPaidAt").textContent=dateFmt(p.paidAt);
 const box=$("#receiptPreview");
 if(!p.receiptData)box.innerHTML='<div class="empty-state">Sin comprobante adjunto.</div>';
 else{
   const preview=(p.receiptType||"").includes("pdf")?`<iframe src="${p.receiptData}" title="Comprobante PDF"></iframe>`:`<img src="${p.receiptData}" alt="Comprobante de pago">`;
   box.innerHTML=`${preview}<div class="receipt-admin-actions"><a href="${p.receiptData}" download="${esc(p.receiptName||"comprobante")}" class="secondary-btn">Descargar</a><button type="button" id="openReceiptNew" class="secondary-btn">Abrir aparte</button></div>`;
   $("#openReceiptNew").onclick=()=>window.open(p.receiptData,"_blank","noopener");
 }
 $("#participantDialog").showModal();
}
function showWinner(d){$("#winnerCard").hidden=false;$("#winnerName").textContent=d.participantName||"Participante";$("#winnerNumber").textContent=fmt(d.winnerNumber);$("#winnerPhone").textContent=d.phone||"—";$("#winnerDate").textContent=dateFmt(d.createdAt);lastWinnerText=`Rifa con Causa\nNúmero ganador: ${fmt(d.winnerNumber)}\nParticipante: ${d.participantName||"—"}\nTeléfono: ${d.phone||"—"}\nFecha: ${dateFmt(d.createdAt)}`}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}

$("#loginForm").onsubmit=e=>{e.preventDefault();if($("#user").value.trim()===cfg.adminUser&&$("#password").value===cfg.adminPassword){sessionStorage.setItem("rifa-admin-auth","1");$("#loginView").hidden=true;$("#dashboardView").hidden=false;renderAll()}else $("#loginStatus").textContent="Usuario o contraseña incorrectos."};
$("#logout").onclick=()=>{sessionStorage.removeItem("rifa-admin-auth");$("#dashboardView").hidden=true;$("#loginView").hidden=false};
$$(".tab-btn").forEach(b=>b.onclick=()=>showView(b.dataset.view));$$("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
$("#editForm").onsubmit=e=>{e.preventDefault();RifaLocalDB.updateNumber(Number($("#editNumber").value),{status:$("#editStatus").value,participantName:$("#editName").value.trim(),phone:$("#editPhone").value.trim(),notes:$("#editNotes").value.trim()||((records.find(r=>r.number===Number($("#editNumber").value))||{}).notes||"")});$("#editDialog").close();renderAll()};
$("#cancelEdit").onclick=()=>$("#editDialog").close();
$("#participantForm").onsubmit=e=>{e.preventDefault();RifaLocalDB.updateParticipant($("#participantId").value,{name:$("#participantNameEdit").value.trim(),phone:$("#participantPhoneEdit").value.trim(),notes:$("#participantNotesEdit").value.trim()||((participants.find(p=>p.id===$("#participantId").value)||{}).notes||"")});$("#participantDialog").close();renderAll()};
$("#closeParticipant").onclick=()=>$("#participantDialog").close();
$("#markPaid").onclick=()=>{RifaLocalDB.setParticipantStatus(currentParticipantId||$("#participantId").value,"paid");$("#participantDialog").close();renderAll()};
$("#markReserved").onclick=()=>{RifaLocalDB.setParticipantStatus(currentParticipantId||$("#participantId").value,"reserved");$("#participantDialog").close();renderAll()};
$("#releaseParticipant").onclick=()=>{if(confirm("¿Liberar todos los números?")){RifaLocalDB.setParticipantStatus(currentParticipantId||$("#participantId").value,"available");$("#participantDialog").close();renderAll()}};
$("#runDraw").onclick=()=>{loadData();const eligible=records.filter(r=>r.status==="paid");if(!eligible.length){$("#drawStatus").textContent="No hay números pagados disponibles.";return}if(!confirm(`Se elegirá un ganador entre ${eligible.length} números pagados. ¿Continuar?`))return;const box=$("#drawNumber");box.classList.add("spinning");$("#runDraw").disabled=true;let ticks=0;const timer=setInterval(()=>{box.textContent=fmt(eligible[Math.floor(Math.random()*eligible.length)].number);if(++ticks>=18){clearInterval(timer);const winner=eligible[Math.floor(Math.random()*eligible.length)],p=participants.find(x=>x.id===winner.participantId)||{},draw=RifaLocalDB.registerDraw({winnerNumber:winner.number,participantId:winner.participantId,participantName:winner.participantName||p.name||"",phone:winner.phone||p.phone||"",eligibleCount:eligible.length});box.textContent=fmt(winner.number);box.classList.remove("spinning");$("#runDraw").disabled=false;renderAll();showWinner(draw)}},90)};
$("#copyWinner").onclick=async()=>{try{await navigator.clipboard.writeText(lastWinnerText);$("#copyWinner").textContent="Resultado copiado"}catch(_){prompt("Copia el resultado:",lastWinnerText)}};
$("#printAct").onclick=()=>{const d=(RifaLocalDB.load().draws||[])[0];if(!d){alert("Todavía no hay resultado.");return}const w=window.open("","_blank");w.document.write(`<html><body style="font-family:Arial;padding:50px"><h1>Acta de Sorteo</h1><h2>Número ganador: ${fmt(d.winnerNumber)}</h2><p>Ganador: ${esc(d.participantName||"Participante")}</p><p>Teléfono: ${esc(d.phone||"—")}</p><p>Fecha: ${dateFmt(d.createdAt)}</p><script>window.print()<\/script></body></html>`);w.document.close()};
$("#search").oninput=renderNumbers;$("#filter").onchange=renderNumbers;$("#participantSearch").oninput=renderParticipants;$("#participantFilter").onchange=renderParticipants;$("#participantStatusFilter").onchange=renderParticipants;
$("#resetData").onclick=()=>{if(confirm("Esto borrará todos los datos locales. ¿Continuar?")){RifaLocalDB.reset();renderAll()}};
$("#exportCsv").onclick=()=>{const rows=[["Número","Estado","Participante","Teléfono"],...records.map(r=>[fmt(r.number),r.status,r.participantName||"",r.phone||""])],csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");download("reporte-rifa.csv","\ufeff"+csv,"text/csv;charset=utf-8")};
$("#exportExcel").onclick=()=>{const participantMap=new Map(participants.map(p=>[p.id,p]));const rows=records.map(r=>{const p=participantMap.get(r.participantId)||{};const notes=[r.notes||"",p.notes||""].filter(Boolean).join(" | ");return `<tr><td>${fmt(r.number)}</td><td>${r.status}</td><td>${esc(r.participantName||p.name||"")}</td><td>${esc(r.phone||p.phone||"")}</td><td>${esc(notes)}</td></tr>`}).join("");download("reporte-rifa.xls",`\ufeff<html><body><table border="1"><tr><th>Número</th><th>Estado</th><th>Participante</th><th>Teléfono</th><th>Notas</th></tr>${rows}</table></body></html>`,"application/vnd.ms-excel")};
$("#exportHistory").onclick=()=>download("historial-rifa.json",JSON.stringify(data.audit||[],null,2),"application/json");
$("#exportBackup").onclick=()=>download(`respaldo-rifa-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(RifaLocalDB.load(),null,2),"application/json");
$("#importBackup").onchange=async e=>{const file=e.target.files[0];if(!file)return;if(!confirm("¿Restaurar esta copia?"))return;try{RifaLocalDB.importData(await file.text());alert("Respaldo restaurado.");renderAll()}catch(_){alert("Archivo inválido.")}e.target.value=""};
window.addEventListener("storage",renderAll);window.addEventListener("rifa-local-change",renderAll);
window.addEventListener("focus",renderAll);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)renderAll()});
setInterval(()=>{
  if(!$("#dashboardView")?.hidden)renderAll();
},1500);
if(sessionStorage.getItem("rifa-admin-auth")==="1"){$("#loginView").hidden=true;$("#dashboardView").hidden=false;renderAll()}
})();