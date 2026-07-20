(function(){
  const KEY="rifa-v5-2-local-data";

  function initial(){
    return {
      numbers:Array.from({length:500},(_,i)=>({
        number:i+1,status:"available",participantId:"",participantName:"",phone:"",notes:"",
        reservedAt:"",paidAt:"",updatedAt:""
      })),
      participants:[],
      audit:[],
      draws:[],
      updatedAt:new Date().toISOString()
    };
  }

  function normalize(data){
    const fresh=initial();
    if(!data || !Array.isArray(data.numbers)) return fresh;

    fresh.numbers = Array.from({length:500},(_,i)=>{
      const old=data.numbers[i]||{};
      return {...fresh.numbers[i],...old,number:i+1};
    });
    fresh.participants = Array.isArray(data.participants)?data.participants:[];
    fresh.audit = Array.isArray(data.audit)?data.audit:[];
    fresh.draws = Array.isArray(data.draws)?data.draws:[];
    fresh.updatedAt = data.updatedAt||new Date().toISOString();
    return fresh;
  }

  function load(){
    try{
      const raw=localStorage.getItem(KEY);
      if(raw) return normalize(JSON.parse(raw));

      // Migración automática desde la versión 5.1.
      const old=localStorage.getItem("rifa-v5-1-local-data");
      if(old){
        const migrated=normalize(JSON.parse(old));
        save(migrated);
        return migrated;
      }
      const data=initial(); save(data); return data;
    }catch(_){
      const data=initial(); save(data); return data;
    }
  }

  function save(data){
    data.updatedAt=new Date().toISOString();
    localStorage.setItem(KEY,JSON.stringify(data));
    window.dispatchEvent(new Event("rifa-local-change"));
  }

  function uid(){
    return "P-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,7).toUpperCase();
  }

  function addAudit(data, action, detail, participantId="", number=""){
    data.audit.unshift({
      id:"A-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),
      action,detail,participantId,number,
      at:new Date().toISOString()
    });
    data.audit=data.audit.slice(0,1000);
  }

  function participantById(data,id){
    return data.participants.find(p=>p.id===id);
  }

  window.RifaLocalDB={
    load,save,
    reset(){const data=initial();save(data);return data},

    importData(raw){
      const parsed=typeof raw==="string"?JSON.parse(raw):raw;
      const data=normalize(parsed);
      addAudit(data,"Restauración","Se restauró una copia de seguridad");
      save(data);
      return data;
    },

    registerDraw(draw){
      const data=load();
      const record={
        id:"S-"+Date.now()+"-"+Math.random().toString(36).slice(2,7).toUpperCase(),
        winnerNumber:Number(draw.winnerNumber),
        participantId:draw.participantId||"",
        participantName:draw.participantName||"",
        phone:draw.phone||"",
        eligibleCount:Number(draw.eligibleCount||0),
        createdAt:new Date().toISOString(),
        status:"official"
      };
      data.draws.unshift(record);
      data.draws=data.draws.slice(0,100);
      addAudit(data,"Sorteo",`Número ganador ${String(record.winnerNumber).padStart(3,"0")}`,record.participantId,record.winnerNumber);
      save(data);
      return record;
    },

    reserve(numbers,participant){
      const data=load();
      for(const n of numbers){
        const row=data.numbers[n-1];
        if(!row||row.status!=="available"){
          throw new Error("El número "+String(n).padStart(3,"0")+" ya no está disponible.");
        }
      }

      const id=uid();
      const now=new Date().toISOString();
      const expiresAt=new Date(Date.now()+5*24*60*60*1000).toISOString();
      const paymentMethod=participant.paymentMethod==="efectivo"?"efectivo":"transferencia";
      const record={
        id,
        name:participant.name,
        phone:participant.phone,
        numbers:[...numbers],
        total:participant.total,
        status:paymentMethod==="efectivo"?"pending_cash":"pending_transfer",
        paymentMethod,
        receiptData:participant.receiptData||"",
        receiptName:participant.receiptName||"",
        receiptType:participant.receiptType||"",
        notes:"",
        createdAt:now,
        reservationAt:now,
        expiresAt,
        reminderSent:false,
        reminderSentAt:"",
        paymentConfirmedAt:"",
        ticketGenerated:false,
        updatedAt:now,
        paidAt:""
      };

      numbers.forEach(n=>{
        Object.assign(data.numbers[n-1],{
          status:"reserved",participantId:id,participantName:record.name,phone:record.phone,
          reservedAt:now,updatedAt:now
        });
      });

      data.participants.push(record);
      addAudit(data,"Registro","Participación registrada",id,numbers.join(","));
      save(data);
      return record;
    },

    updateNumber(number,changes){
      const data=load();
      const row=data.numbers[number-1];
      if(!row) throw new Error("Número no encontrado.");
      const oldStatus=row.status;
      Object.assign(row,changes,{updatedAt:new Date().toISOString()});

      if(row.status==="available"){
        const pid=row.participantId;
        Object.assign(row,{participantId:"",participantName:"",phone:"",reservedAt:"",paidAt:""});
        if(pid){
          const p=participantById(data,pid);
          if(p){
            p.numbers=p.numbers.filter(n=>n!==number);
            p.total=p.numbers.length*((window.RIFA_CONFIG&&window.RIFA_CONFIG.ticketPrice)||200);
            p.updatedAt=new Date().toISOString();
            if(!p.numbers.length) p.status="released";
          }
        }
      }else if(row.participantId){
        const p=participantById(data,row.participantId);
        if(p){
          p.name=row.participantName||p.name;
          p.phone=row.phone||p.phone;
          p.updatedAt=new Date().toISOString();
          const statuses=p.numbers.map(n=>data.numbers[n-1].status);
          p.status=statuses.every(s=>s==="paid")?"paid":statuses.some(s=>s==="reserved")?"reserved":"available";
          if(p.status==="paid"&&!p.paidAt) p.paidAt=new Date().toISOString();
        }
      }

      if(oldStatus!==row.status){
        addAudit(data,"Cambio de estado",`Número ${String(number).padStart(3,"0")}: ${oldStatus} → ${row.status}`,row.participantId,number);
      }else{
        addAudit(data,"Edición",`Se actualizó el número ${String(number).padStart(3,"0")}`,row.participantId,number);
      }
      save(data); return row;
    },

    updateParticipant(id,changes){
      const data=load();
      const p=participantById(data,id);
      if(!p) throw new Error("Participante no encontrado.");
      Object.assign(p,changes,{updatedAt:new Date().toISOString()});
      p.numbers.forEach(n=>{
        const row=data.numbers[n-1];
        if(row){
          row.participantName=p.name;
          row.phone=p.phone;
          row.updatedAt=new Date().toISOString();
        }
      });
      addAudit(data,"Participante","Datos del participante actualizados",id,p.numbers.join(","));
      save(data); return p;
    },

    setParticipantStatus(id,status){
      const data=load();
      const p=participantById(data,id);
      if(!p) throw new Error("Participante no encontrado.");
      const now=new Date().toISOString();

      p.numbers.forEach(n=>{
        const row=data.numbers[n-1];
        if(row){
          const numberStatus=(status==="available"||status==="expired")?"available":status==="paid"?"paid":"reserved";
          row.status=numberStatus;
          row.updatedAt=now;
          if(status==="paid") row.paidAt=now;
          if(status==="available"||status==="expired"){
            Object.assign(row,{participantId:"",participantName:"",phone:"",reservedAt:"",paidAt:""});
          }
        }
      });

      if(status==="available") p.status="released";
      else if(status==="expired") p.status="expired";
      else if(status==="paid") p.status="paid";
      else if(status==="pending_cash") p.status="pending_cash";
      else if(status==="pending_transfer") p.status="pending_transfer";
      else p.status=p.paymentMethod==="efectivo"?"pending_cash":"pending_transfer";
      p.updatedAt=now;
      if(status==="paid"){ p.paidAt=now; p.paymentConfirmedAt=now; }
      if(status==="expired") p.expiredAt=now;
      addAudit(data,"Cambio de estado",`Participación marcada como ${p.status}`,id,p.numbers.join(","));
      save(data); return p;
    }
  };
})();
