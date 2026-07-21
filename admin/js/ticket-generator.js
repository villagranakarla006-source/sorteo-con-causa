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
  loadImage('../assets/karla-organizadora-original.jpeg')
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

 // Panel oficial simplificado, sin folio ni código.
 ctx.fillStyle='rgba(255,255,255,.99)';rounded(ctx,730,575,266,385,22);ctx.strokeStyle='#0c8b91';ctx.lineWidth=2;ctx.strokeRect(731,576,264,383);
 ctx.fillStyle='#0b7f82';rounded(ctx,752,594,223,50,12);ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='800 24px Arial';ctx.fillText('BOLETO OFICIAL',864,627);
 ctx.fillStyle='#164e63';ctx.font='800 19px Arial';ctx.fillText('RIFA CON CAUSA',864,688);
 ctx.fillStyle='#1d2939';ctx.font='700 17px Arial';ctx.fillText('Conserva este boleto',864,748);ctx.fillText('hasta el día del sorteo.',864,777);
 ctx.fillStyle='#087d80';ctx.font='800 18px Arial';ctx.fillText('PAGO VERIFICADO',864,848);
 ctx.fillStyle='#16832c';ctx.font='800 24px Arial';ctx.fillText('CONFIRMADO',864,888);

 // Fotografía integrada sin recuadro: bordes suavizados sobre el boleto.
 const photoX=748,photoY=1105,photoW=230,photoH=225;
 ctx.save();
 const srcRatio=karlaPhoto.width/karlaPhoto.height,boxRatio=photoW/photoH;
 let sx=0,sy=0,sw=karlaPhoto.width,sh=karlaPhoto.height;
 if(srcRatio>boxRatio){sw=karlaPhoto.height*boxRatio;sx=(karlaPhoto.width-sw)/2}else{sh=karlaPhoto.width/boxRatio;sy=Math.max(0,(karlaPhoto.height-sh)*0.22)}
 ctx.drawImage(karlaPhoto,sx,sy,sw,sh,photoX,photoY,photoW,photoH);
 // Fundidos suaves para que la foto forme parte del diseño, sin marco visible.
 const fades=[
  [photoX,photoY,photoX+32,photoY,'rgba(255,255,255,.94)','rgba(255,255,255,0)',photoX,photoY,34,photoH],
  [photoX+photoW,photoY,photoX+photoW-32,photoY,'rgba(255,255,255,.94)','rgba(255,255,255,0)',photoX+photoW-34,photoY,34,photoH],
  [photoX,photoY,photoX,photoY+30,'rgba(255,255,255,.9)','rgba(255,255,255,0)',photoX,photoY,photoW,32],
  [photoX,photoY+photoH,photoX,photoY+photoH-38,'rgba(255,255,255,.96)','rgba(255,255,255,0)',photoX,photoY+photoH-40,photoW,40]
 ];
 fades.forEach(([x0,y0,x1,y1,c0,c1,x,y,w,h])=>{const g=ctx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,c0);g.addColorStop(1,c1);ctx.fillStyle=g;ctx.fillRect(x,y,w,h)});
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
