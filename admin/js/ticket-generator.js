(function(){
'use strict';
const cfg=window.RIFA_CONFIG||{};
const fmt=n=>String(Number(n)||0).padStart(3,'0');
const clean=s=>String(s??'').trim();

function loadImage(src, useCors=false){
 return new Promise((resolve,reject)=>{
  const i=new Image();
  if(useCors && /^https?:/i.test(String(src))) i.crossOrigin='anonymous';
  i.onload=()=>resolve(i);
  i.onerror=()=>reject(new Error('No se pudo cargar la imagen: '+src));
  i.src=src;
 });
}

async function loadReceiptImage(src){
 const value=String(src||'').trim();
 if(!value) throw new Error('Sin comprobante');
 if(value.startsWith('data:image/')) return loadImage(value);
 if(/^https?:/i.test(value)){
  try{
   const response=await fetch(value,{mode:'cors',cache:'no-store'});
   if(!response.ok) throw new Error('HTTP '+response.status);
   const blob=await response.blob();
   if(!blob.type.startsWith('image/')) throw new Error('El comprobante no es una imagen');
   const objectUrl=URL.createObjectURL(blob);
   try{return await loadImage(objectUrl)}finally{setTimeout(()=>URL.revokeObjectURL(objectUrl),1000)}
  }catch(fetchError){
   // Segundo intento usando CORS anónimo. Si tampoco funciona, el boleto se genera sin miniatura.
   return loadImage(value,true);
  }
 }
 return loadImage(value);
}

function fitText(ctx,text,maxWidth,startSize,minSize=18){let size=startSize;do{ctx.font=`700 ${size}px Arial`;if(ctx.measureText(text).width<=maxWidth)return size;size-=2}while(size>=minSize);return minSize}
function roundPath(ctx,x,y,w,h,r){
 r=Math.max(0,Math.min(r,w/2,h/2));
 ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function rounded(ctx,x,y,w,h,r){roundPath(ctx,x,y,w,h,r);ctx.fill()}

async function createTicket(participant){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1536;const ctx=canvas.getContext('2d');
 if(!ctx) throw new Error('El navegador no permite crear el boleto.');
 const [bg,karlaPhoto]=await Promise.all([
  loadImage('../assets/boleto-confirmacion.png'),
  loadImage('../assets/karla-organizadora-sin-fondo.png')
 ]);
 ctx.drawImage(bg,0,0,1024,1536);
 const name=clean(participant.name)||'Participante';
 const nums=(participant.numbers||[]).map(fmt).join(', ');
 const paidAt=participant.paidAt?.toDate?participant.paidAt.toDate():participant.paidAt?new Date(participant.paidAt):new Date();
 const validPaidAt=Number.isNaN(paidAt.getTime())?new Date():paidAt;
 const date=validPaidAt.toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
 const time=validPaidAt.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
 const total=Number(participant.total||((participant.numbers||[]).length*Number(cfg.ticketPrice||200)));

 ctx.fillStyle='rgba(255,255,255,.985)';rounded(ctx,28,575,686,385,22);
 ctx.strokeStyle='#0c8b91';ctx.lineWidth=2;ctx.strokeRect(29,576,684,383);
 ctx.beginPath();ctx.moveTo(390,598);ctx.lineTo(390,935);ctx.strokeStyle='#50aeb2';ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
 const drawField=(label,value,x,y,w,green=false)=>{ctx.textAlign='left';ctx.fillStyle='#087d80';ctx.font='800 20px Arial';ctx.fillText(label,x,y);const size=fitText(ctx,value,w,28,17);ctx.font=`700 ${size}px Arial`;ctx.fillStyle=green?'#16832c':'#101827';ctx.fillText(value,x,y+38)};
 drawField('PARTICIPANTE:',name,75,625,285);
 drawField('NÚMERO(S) ASIGNADO(S):',nums,75,740,285);
 drawField('FECHA DE CONFIRMACIÓN:',date,75,855,285);ctx.fillStyle='#101827';ctx.font='700 22px Arial';ctx.fillText(time,75,927);
 drawField('IMPORTE:',`$${total.toLocaleString('es-MX',{minimumFractionDigits:2})} MXN`,430,660,250);
 drawField('ESTADO:','PAGO CONFIRMADO',430,790,250,true);

 ctx.fillStyle='rgba(255,255,255,.99)';rounded(ctx,730,575,266,385,22);ctx.strokeStyle='#0c8b91';ctx.lineWidth=2;ctx.strokeRect(731,576,264,383);
 ctx.fillStyle='#0b7f82';rounded(ctx,744,594,238,50,12);ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='800 18px Arial';ctx.fillText('COMPROBANTE VERIFICADO',863,626);
 const receipt=participant.receiptData||participant.receiptUrl||participant.comprobanteData||participant.comprobanteUrl||'';
 const receiptType=clean(participant.receiptType).toLowerCase();
 const isPdf=receiptType.includes('pdf')||String(receipt).startsWith('data:application/pdf');
 if(receipt&&!isPdf){
  try{
   const receiptImg=await loadReceiptImage(receipt);
   const boxX=750,boxY=660,boxW=226,boxH=260;
   ctx.save();roundPath(ctx,boxX,boxY,boxW,boxH,12);ctx.clip();
   const rr=receiptImg.width/receiptImg.height,br=boxW/boxH;let dx=boxX,dy=boxY,dw=boxW,dh=boxH;
   if(rr>br){dh=boxW/rr;dy=boxY+(boxH-dh)/2}else{dw=boxH*rr;dx=boxX+(boxW-dw)/2}
   ctx.fillStyle='#f5f7fa';ctx.fillRect(boxX,boxY,boxW,boxH);ctx.drawImage(receiptImg,dx,dy,dw,dh);ctx.restore();
   ctx.strokeStyle='#e84c7f';ctx.lineWidth=2;ctx.strokeRect(boxX,boxY,boxW,boxH);
  }catch(e){
   console.warn('No se pudo insertar la miniatura del comprobante:',e);
   ctx.fillStyle='#164e63';ctx.font='800 18px Arial';ctx.fillText('COMPROBANTE',863,755);ctx.fillText('VERIFICADO',863,787);
   ctx.fillStyle='#16832c';ctx.font='800 22px Arial';ctx.fillText('PAGO CONFIRMADO',863,835);
  }
 }else{
  ctx.fillStyle='#164e63';ctx.font='800 18px Arial';ctx.fillText(isPdf?'COMPROBANTE PDF':'SIN COMPROBANTE',863,755);
  ctx.fillStyle='#16832c';ctx.font='800 22px Arial';ctx.fillText('PAGO CONFIRMADO',863,815);
 }

 const photoX=742,photoY=1070,photoW=250,photoH=270;
 ctx.save();
 const sx=Math.min(220,Math.max(0,karlaPhoto.width-1)),sy=Math.min(175,Math.max(0,karlaPhoto.height-1));
 const sw=Math.max(1,Math.min(790,karlaPhoto.width-sx)),sh=Math.max(1,Math.min(1040,karlaPhoto.height-sy));
 ctx.globalAlpha=.98;ctx.drawImage(karlaPhoto,sx,sy,sw,sh,photoX,photoY,photoW,photoH);ctx.restore();
 return canvas;
}
function filename(p){const n=(p.numbers||[]).map(fmt).join('-')||'boleto';return `boleto-${n}-confirmado.png`.replace(/[^a-z0-9.-]/gi,'-')}
function canvasBlob(canvas){return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('No se pudo convertir el boleto en imagen.')),'image/png',.95)}catch(e){reject(e)}})}
function triggerDownload(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
async function downloadTicket(p){const c=await createTicket(p);const blob=await canvasBlob(c);triggerDownload(blob,filename(p));return c}
async function shareTicket(p){
 const c=await createTicket(p),blob=await canvasBlob(c),file=new File([blob],filename(p),{type:'image/png'}),nums=(p.numbers||[]).map(fmt).join(', ');
 const msg=`Hola ${clean(p.name)||'participante'} 💗\n\nTu pago fue verificado correctamente. Tus números ${nums} ya están confirmados como PAGADOS.\n\nTe compartimos tu boleto digital de participación. Gracias por apoyar esta causa.`;
 try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:'Boleto digital — Rifa con Causa',text:msg,files:[file]});return}}catch(e){if(e?.name==='AbortError')return;console.warn(e)}
 triggerDownload(blob,file.name);
 const phone=String(p.phone||'').replace(/\D/g,''),whatsappPhone=phone.length===10?'52'+phone:phone;
 window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(msg)}`,'_blank','noopener');
 alert('Se descargó el boleto y se abrió WhatsApp. Adjunta la imagen descargada usando el clip.');
}
window.RifaTicket={createTicket,downloadTicket,shareTicket};
})();
