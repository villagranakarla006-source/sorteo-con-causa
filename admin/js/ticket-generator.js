(function(){
'use strict';
const cfg=window.RIFA_CONFIG||{};
const fmt=n=>String(Number(n)||0).padStart(3,'0');
const clean=s=>String(s??'').trim();
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src});
function fitText(ctx,text,maxWidth,startSize,minSize=18){let size=startSize;do{ctx.font=`700 ${size}px Arial`;if(ctx.measureText(text).width<=maxWidth)return size;size-=2}while(size>=minSize);return minSize}
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
async function createTicket(participant){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1536;const ctx=canvas.getContext('2d');
 const [bg,karlaPhoto]=await Promise.all([
  loadImage('../assets/boleto-confirmacion.png'),
  loadImage('../assets/karla-organizadora-sin-fondo.png')
 ]);
 ctx.drawImage(bg,0,0,1024,1536);
 const name=clean(participant.name)||'Participante';
 const nums=(participant.numbers||[]).map(fmt).join(', ');
 const paidAt=participant.paidAt?.toDate?participant.paidAt.toDate():participant.paidAt?new Date(participant.paidAt):new Date();
 const date=paidAt.toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
 const time=paidAt.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
 const total=Number(participant.total||((participant.numbers||[]).length*Number(cfg.ticketPrice||200)));

 // Datos reales del participante. Se eliminaron folio y código de seguridad.
 ctx.fillStyle='rgba(255,255,255,.985)';rounded(ctx,28,575,686,385,22);
 ctx.strokeStyle='#0c8b91';ctx.lineWidth=2;ctx.strokeRect(29,576,684,383);
 ctx.beginPath();ctx.moveTo(390,598);ctx.lineTo(390,935);ctx.strokeStyle='#50aeb2';ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
 const drawField=(label,value,x,y,w,green=false)=>{ctx.textAlign='left';ctx.fillStyle='#087d80';ctx.font='800 20px Arial';ctx.fillText(label,x,y);const size=fitText(ctx,value,w,28,17);ctx.font=`700 ${size}px Arial`;ctx.fillStyle=green?'#16832c':'#101827';ctx.fillText(value,x,y+38)};
 drawField('PARTICIPANTE:',name,75,625,285);
 drawField('NÚMERO(S) ASIGNADO(S):',nums,75,740,285);
 drawField('FECHA DE CONFIRMACIÓN:',date,75,855,285);ctx.fillStyle='#101827';ctx.font='700 22px Arial';ctx.fillText(time,75,927);
 drawField('IMPORTE:',`$${total.toLocaleString('es-MX',{minimumFractionDigits:2})} MXN`,430,660,250);
 drawField('ESTADO:','PAGO CONFIRMADO',430,790,250,true);

 // El recuadro derecho muestra el comprobante verificado dentro del boleto.
 ctx.fillStyle='rgba(255,255,255,.99)';rounded(ctx,730,575,266,385,22);ctx.strokeStyle='#0c8b91';ctx.lineWidth=2;ctx.strokeRect(731,576,264,383);
 ctx.fillStyle='#0b7f82';rounded(ctx,744,594,238,50,12);ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='800 20px Arial';ctx.fillText('COMPROBANTE VERIFICADO',863,626);
 const receipt=participant.receiptData||participant.receiptUrl||participant.comprobanteData||participant.comprobanteUrl||'';
 const receiptType=clean(participant.receiptType).toLowerCase();
 const isPdf=receiptType.includes('pdf')||String(receipt).startsWith('data:application/pdf');
 if(receipt&&!isPdf){
  try{
   const receiptImg=await loadImage(receipt);
   const boxX=750,boxY=660,boxW=226,boxH=260;
   ctx.save();ctx.beginPath();ctx.roundRect(boxX,boxY,boxW,boxH,12);ctx.clip();
   const rr=receiptImg.width/receiptImg.height,br=boxW/boxH;let dx=boxX,dy=boxY,dw=boxW,dh=boxH;
   if(rr>br){dh=boxW/rr;dy=boxY+(boxH-dh)/2}else{dw=boxH*rr;dx=boxX+(boxW-dw)/2}
   ctx.fillStyle='#f5f7fa';ctx.fillRect(boxX,boxY,boxW,boxH);ctx.drawImage(receiptImg,dx,dy,dw,dh);ctx.restore();
   ctx.strokeStyle='#e84c7f';ctx.lineWidth=2;ctx.strokeRect(boxX,boxY,boxW,boxH);
  }catch(e){
   ctx.fillStyle='#164e63';ctx.font='800 19px Arial';ctx.fillText('COMPROBANTE',863,755);ctx.fillText('NO DISPONIBLE',863,787);
  }
 }else{
  ctx.fillStyle='#164e63';ctx.font='800 18px Arial';ctx.fillText(isPdf?'COMPROBANTE PDF':'SIN COMPROBANTE',863,755);
  ctx.fillStyle='#16832c';ctx.font='800 22px Arial';ctx.fillText('PAGO CONFIRMADO',863,815);
 }

 // Fotografía de Karla recortada, sin fondo ni recuadro.
 const photoX=742,photoY=1070,photoW=250,photoH=270;
 ctx.save();
 // Recorte centrado en rostro y cabello para integrarlo en el espacio original.
 const sx=220,sy=175,sw=Math.min(790,karlaPhoto.width-220),sh=Math.min(1040,karlaPhoto.height-175);
 ctx.globalAlpha=.98;ctx.drawImage(karlaPhoto,sx,sy,sw,sh,photoX,photoY,photoW,photoH);
 ctx.restore();
 return canvas;
}
function filename(p){const n=(p.numbers||[]).map(fmt).join('-')||'boleto';return `boleto-${n}-confirmado.png`.replace(/[^a-z0-9.-]/gi,'-')}
async function downloadTicket(p){const c=await createTicket(p);const a=document.createElement('a');a.href=c.toDataURL('image/png',.95);a.download=filename(p);a.click();return c}
async function shareTicket(p){
 const c=await createTicket(p);const blob=await new Promise(r=>c.toBlob(r,'image/png',.95));const file=new File([blob],filename(p),{type:'image/png'});const nums=(p.numbers||[]).map(fmt).join(', ');
 const msg=`Hola ${clean(p.name)||'participante'} 💗\n\nTu pago fue verificado correctamente. Tus números ${nums} ya están confirmados como PAGADOS.\n\nTe compartimos tu boleto digital de participación. Gracias por apoyar esta causa.`;
 try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:'Boleto digital — Rifa con Causa',text:msg,files:[file]});return}}catch(e){if(e?.name==='AbortError')return}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);const phone=String(p.phone||'').replace(/\D/g,'');const whatsappPhone=phone.length===10?'52'+phone:phone;window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(msg)}`,'_blank','noopener');alert('Se descargó el boleto y se abrió WhatsApp. Adjunta la imagen descargada usando el clip.');
}
window.RifaTicket={createTicket,downloadTicket,shareTicket};
})();
