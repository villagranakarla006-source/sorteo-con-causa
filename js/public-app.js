import { getFirebase } from "../../firebase/services.js";

const TOTAL=500, PRICE=200, STORAGE_KEY="rifa-selected-v5";
const selected=new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"));
let records=Array.from({length:TOTAL},(_,i)=>({number:i+1,status:"available"}));
let activeStart=1;

const $=s=>document.querySelector(s);
const grid=$("#numberGrid"), tabs=$("#rangeTabs"), selectedText=$("#selectedNumbers");
const continueButton=$("#continueButton"), dialog=$("#registrationDialog");

function fmt(n){return String(n).padStart(3,"0")}
function saveSelected(){localStorage.setItem(STORAGE_KEY,JSON.stringify([...selected]))}
function renderTabs(){
  tabs.innerHTML="";
  for(let start=1;start<=TOTAL;start+=100){
    const b=document.createElement("button");
    b.type="button"; b.textContent=`${fmt(start)}–${fmt(Math.min(start+99,TOTAL))}`;
    b.className=start===activeStart?"active":"";
    b.onclick=()=>{activeStart=start;renderTabs();renderGrid()};
    tabs.appendChild(b);
  }
}
function renderGrid(){
  grid.innerHTML="";
  for(let n=activeStart;n<=Math.min(activeStart+99,TOTAL);n++){
    const r=records[n-1], b=document.createElement("button");
    b.type="button"; b.className=`number ${r.status}`;
    b.textContent=fmt(n);
    if(r.status!=="available"){selected.delete(n);b.disabled=true}
    else{
      if(selected.has(n)) b.classList.add("selected");
      b.onclick=()=>{selected.has(n)?selected.delete(n):selected.add(n);saveSelected();renderGrid();updateSelection()}
    }
    grid.appendChild(b);
  }
  updateSelection();
}
function updateSelection(){
  const vals=[...selected].sort((a,b)=>a-b);
  selectedText.textContent=vals.length?vals.map(fmt).join(", "):"Ninguno";
  continueButton.disabled=!vals.length;
}
async function loadNumbers(){
  const fb=await getFirebase();
  if(!fb){renderTabs();renderGrid();return}
  const {collection,onSnapshot}=fb.fsMod;
  onSnapshot(collection(fb.db,"numbers"),snap=>{
    if(!snap.empty){
      const next=Array.from({length:TOTAL},(_,i)=>({number:i+1,status:"available"}));
      snap.forEach(doc=>{const d=doc.data(); if(d.number>=1&&d.number<=TOTAL) next[d.number-1]=d});
      records=next; renderGrid();
    }
  });
}
function openDialog(){
  const vals=[...selected].sort((a,b)=>a-b);
  $("#modalSelectedNumbers").textContent=vals.map(fmt).join(", ");
  $("#ticketCount").textContent=vals.length;
  $("#paymentTotal").textContent=`$${(vals.length*PRICE).toLocaleString("es-MX")} MXN`;
  dialog.showModal();
}
continueButton.onclick=openDialog;
$("#showPayment").onclick=()=>selected.size?openDialog():document.querySelector("#tablero").scrollIntoView({behavior:"smooth"});
$("#closeDialog").onclick=()=>dialog.close();
$("#copyClabe").onclick=async()=>{await navigator.clipboard.writeText("002020901009865734");$("#copyClabe").textContent="Copiada"};
$("#numberSearch").oninput=e=>{const n=Number(e.target.value);if(n>=1&&n<=500){activeStart=Math.floor((n-1)/100)*100+1;renderTabs();renderGrid()}};

$("#registrationForm").onsubmit=async e=>{
  e.preventDefault();
  const name=$("#participantName").value.trim(), phone=$("#participantPhone").value.replace(/\D/g,"");
  const nums=[...selected].sort((a,b)=>a-b);
  const status=$("#formStatus");
  if(name.length<3){status.textContent="Escribe tu nombre completo.";return}
  if(phone.length!==10){status.textContent="Escribe un teléfono de 10 dígitos.";return}
  status.textContent="Procesando registro…";

  const fb=await getFirebase();
  if(!fb){
    const msg=`Hola, quiero registrar mi participación.\nNombre: ${name}\nTeléfono: ${phone}\nNúmeros: ${nums.map(fmt).join(", ")}\nTotal: $${(nums.length*PRICE).toLocaleString("es-MX")} MXN`;
    window.open(`https://wa.me/526864257896?text=${encodeURIComponent(msg)}`,"_blank","noopener");
    status.textContent="Registro preparado en WhatsApp. Firebase aún no está configurado.";
    return;
  }

  try{
    const {doc,runTransaction,serverTimestamp,collection,addDoc}=fb.fsMod;
    await fb.fsMod.runTransaction(fb.db,async tx=>{
      for(const n of nums){
        const ref=doc(fb.db,"numbers",String(n));
        const snap=await tx.get(ref);
        if(snap.exists() && snap.data().status!=="available") throw new Error(`El número ${fmt(n)} ya no está disponible.`);
      }
      for(const n of nums){
        tx.set(doc(fb.db,"numbers",String(n)),{number:n,status:"reserved",participantName:name,phone,updatedAt:serverTimestamp()},{merge:true});
      }
    });

    let receiptUrl="";
    const file=$("#receiptFile").files[0];
    if(file){
      const path=`receipts/${Date.now()}-${file.name}`;
      const storageRef=fb.stMod.ref(fb.storage,path);
      await fb.stMod.uploadBytes(storageRef,file);
      receiptUrl=await fb.stMod.getDownloadURL(storageRef);
    }

    await addDoc(collection(fb.db,"participants"),{
      name,phone,numbers:nums,total:nums.length*PRICE,status:"reserved",receiptUrl,createdAt:serverTimestamp()
    });

    selected.clear();saveSelected();renderGrid();status.textContent="Registro guardado correctamente.";
  }catch(err){status.textContent=err.message||"No fue posible guardar el registro."}
};

loadNumbers();
