(function(){
'use strict';
const cfg=window.RIFA_CONFIG||{};
const fmt=n=>String(Number(n)||0).padStart(3,'0');
const clean=s=>String(s??'').trim();
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src});
function fitText(ctx,text,maxWidth,startSize,minSize=22){let size=startSize;do{ctx.font=`700 ${size}px Arial`;if(ctx.measureText(text).width<=maxWidth)return size;size-=2}while(size>=minSize);return minSize}
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
async function createTicket(participant){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1536;const ctx=canvas.getContext('2d');
 const bg=await loadImage('../assets/boleto-confirmacion.png');ctx.drawImage(bg,0,0,1024,1536);
 // Rebuild the variable information block so every ticket contains real data.
 ctx.fillStyle='rgba(255,255,255,.98)';rounded(ctx,26,603,971,340,24);
 ctx.strokeStyle='#0b8b8d';ctx.lineWidth=2;ctx.strokeRect(27,604,969,338);
 ctx.fillStyle='#eefafa';rounded(ctx,742,612,240,315,20);
 ctx.fillStyle='#0b7f82';rounded(ctx,760,625,205,52,14);
 ctx.fillStyle='#fff';ctx.font='800 28px Arial';ctx.textAlign='center';ctx.fillText('VERIFICA TU BOLETO',862,660);
 ctx.textAlign='left';ctx.fillStyle='#087d80';ctx.font='800 22px Arial';
 const name=clean(participant.name)||'Participante';const nums=(participant.numbers||[]).map(fmt).join(', ');const folio=`RCC-${new Date().getFullYear()}-${String(participant.id||Date.now()).replace(/[^a-z0-9]/gi,'').slice(-8).toUpperCase()}`;
 const paidAt=participant.paidAt?.toDate?participant.paidAt.toDate():participant.paidAt?new Date(participant.paidAt):new Date();
 const date=paidAt.toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
 const total=Number(participant.total||((participant.numbers||[]).length*Number(cfg.ticketPrice||200)));
 const fields=[['PARTICIPANTE:',name,70,650,560],['NÚMERO(S) ASIGNADO(S):',nums,70,755,560],['FECHA DE CONFIRMACIÓN:',date,70,860,560],['FOLIO ÚNICO:',folio,455,650,265],['IMPORTE:',`$${total.toLocaleString('es-MX')}.00 MXN`,455,755,265],['ESTADO:','PAGO CONFIRMADO',455,860,265]];
 fields.forEach(([label,value,x,y,w])=>{ctx.fillStyle='#087d80';ctx.font='800 22px Arial';ctx.fillText(label,x,y);const size=fitText(ctx,value,w,30,18);ctx.font=`700 ${size}px Arial`;ctx.fillStyle=value==='PAGO CONFIRMADO'?'#178a28':'#101827';ctx.fillText(value,x,y+40)});
 // QR verification code.
 const verifyUrl=`${location.origin}${location.pathname.replace(/admin\/index\.html$|admin\.html$/,'')}consulta.html?telefono=${encodeURIComponent(clean(participant.phone||''))}`;
 const holder=document.createElement('div');holder.style.position='fixed';holder.style.left='-9999px';document.body.appendChild(holder);
 new QRCode(holder,{text:verifyUrl,width:180,height:180,correctLevel:QRCode.CorrectLevel.H});
 await new Promise(r=>setTimeout(r,80));const qr=holder.querySelector('canvas, img');if(qr)ctx.drawImage(qr,772,697,180,180);holder.remove();
 ctx.textAlign='center';ctx.fillStyle='#1d2939';ctx.font='600 18px Arial';ctx.fillText('Escanea para consultar',862,900);ctx.fillText('tu participación',862,924);
 canvas.dataset.folio=folio;return canvas;
}
function filename(p,folio){const n=(p.numbers||[]).map(fmt).join('-')||'boleto';return `boleto-${n}-${folio}.png`.replace(/[^a-z0-9.-]/gi,'-')}
async function downloadTicket(p){const c=await createTicket(p);const a=document.createElement('a');a.href=c.toDataURL('image/png',.95);a.download=filename(p,c.dataset.folio);a.click();return c}
async function shareTicket(p){const c=await createTicket(p);const blob=await new Promise(r=>c.toBlob(r,'image/png',.95));const file=new File([blob],filename(p,c.dataset.folio),{type:'image/png'});const nums=(p.numbers||[]).map(fmt).join(', ');const msg=`Hola ${clean(p.name)||'participante'} 💗\n\nTu pago fue verificado correctamente. Tus números ${nums} ya están confirmados como PAGADOS.\n\nTe compartimos tu boleto digital de participación. Gracias por apoyar esta causa.`;
 try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:'Boleto digital — Rifa con Causa',text:msg,files:[file]});return}}
 catch(e){if(e?.name==='AbortError')return}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg)}`,'_blank','noopener');alert('Se descargó el boleto y se abrió WhatsApp. Adjunta la imagen descargada usando el clip.');
}
window.RifaTicket={createTicket,downloadTicket,shareTicket};
})();
