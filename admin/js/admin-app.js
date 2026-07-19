import { getFirebase } from "../../firebase/services.js";
const PRICE=200; let fb=null, records=[];
const $=s=>document.querySelector(s), fmt=n=>String(n).padStart(3,"0");
function label(s){return s==="available"?"⬜ Disponible":s==="reserved"?"🟨 Apartado":"🩷 Pagado"}
async function init(){
  fb=await getFirebase();
  if(!fb){$("#loginStatus").textContent="Firebase aún no está configurado.";return}
  fb.authMod.onAuthStateChanged(fb.auth,user=>{
    $("#loginView").hidden=!!user; $("#dashboardView").hidden=!user;
    if(user) subscribe();
  });
}
$("#loginForm").onsubmit=async e=>{e.preventDefault();try{await fb.authMod.signInWithEmailAndPassword(fb.auth,$("#email").value,$("#password").value)}catch(err){$("#loginStatus").textContent=err.message}};
$("#logout").onclick=()=>fb.authMod.signOut(fb.auth);
function subscribe(){
  fb.fsMod.onSnapshot(fb.fsMod.collection(fb.db,"numbers"),snap=>{
    records=[];snap.forEach(d=>records.push(d.data()));records.sort((a,b)=>a.number-b.number);render();
  });
}
function render(){
  const q=$("#search").value.trim().toLowerCase(), f=$("#filter").value;
  const list=records.filter(r=>(f==="all"||r.status===f)&&(!q||`${r.number} ${r.participantName||""} ${r.phone||""}`.toLowerCase().includes(q)));
  $("#table").innerHTML=list.map(r=>`<tr><td><strong>${fmt(r.number)}</strong></td><td><span class="badge ${r.status}">${label(r.status)}</span></td><td>${r.participantName||"—"}</td><td>${r.phone||"—"}</td><td><button data-n="${r.number}" class="edit">Editar</button></td></tr>`).join("");
  document.querySelectorAll(".edit").forEach(b=>b.onclick=()=>openEdit(Number(b.dataset.n)));
  const a=records.filter(r=>r.status==="available").length,rr=records.filter(r=>r.status==="reserved").length,p=records.filter(r=>r.status==="paid").length;
  $("#available").textContent=a;$("#reserved").textContent=rr;$("#paid").textContent=p;$("#total").textContent=`$${(p*PRICE).toLocaleString("es-MX")} MXN`;
}
function openEdit(n){const r=records.find(x=>x.number===n);$("#editNumber").value=n;$("#editTitle").textContent=`Número ${fmt(n)}`;$("#editStatus").value=r.status;$("#editName").value=r.participantName||"";$("#editPhone").value=r.phone||"";$("#editNotes").value=r.notes||"";$("#editDialog").showModal()}
$("#editForm").onsubmit=async e=>{e.preventDefault();const n=Number($("#editNumber").value);await fb.fsMod.setDoc(fb.fsMod.doc(fb.db,"numbers",String(n)),{number:n,status:$("#editStatus").value,participantName:$("#editName").value.trim(),phone:$("#editPhone").value.trim(),notes:$("#editNotes").value.trim(),updatedAt:fb.fsMod.serverTimestamp()},{merge:true});$("#editDialog").close()};
$("#cancelEdit").onclick=()=>$("#editDialog").close();$("#search").oninput=render;$("#filter").onchange=render;
$("#seed").onclick=async()=>{if(!confirm("¿Crear o completar los 500 números en Firestore?"))return;const batch=fb.fsMod.writeBatch(fb.db);for(let n=1;n<=500;n++)batch.set(fb.fsMod.doc(fb.db,"numbers",String(n)),{number:n,status:"available"},{merge:true});await batch.commit();alert("500 números preparados.")};
init();
