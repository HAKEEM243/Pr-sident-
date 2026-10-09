/* =========================================================
   Sky Empire — 🗓️ calendrier des vols
   Une semaine quadrillée : un jour par ligne, 24 h par jour, un bloc
   par rotation (aller-retour) de chaque avion, aux heures locales du hub.
   Le nombre de vols correspond exactement aux « fois par semaine » programmés.
   ========================================================= */
'use strict';
UI.calW=0; UI.calAc='';
const calColor=i=>`hsl(${(i*57+200)%360},70%,52%)`;
function calData(off){
  const ws=weekStart(S.time)+off*7*DAY, W=7*DAY, days=Array.from({length:7},()=>({blocks:[],dep:0})), legend=[], routes={};
  let idx=0;
  for(const ac of S.fleet){
    const plan=(ac.plan||[]).filter(p=>p.weekly>0&&S.routes.some(r=>r.id===p.routeId)); if(!plan.length){ continue; }
    const col=calColor(idx++); if(UI.calAc&&UI.calAc!==ac.id){ legend.push({ac,col,off:true,plan}); continue; }
    legend.push({ac,col,plan});
    for(const p of plan){
      const r=S.routes.find(x=>x.id===p.routeId), cyc=routeCycleHours(r,ac)*HOUR, name=r.stops.join('⇄');
      routes[name]=(routes[name]||0)+p.weekly;
      for(const s of planSlots(ac,p)){
        let start=s, left=cyc, d=Math.floor(start/DAY);
        days[Math.min(6,d)].dep++;
        while(left>0&&d<7){ const t0=start-d*DAY, len=Math.min(left,DAY-t0); days[d].blocks.push({t0,len,col,reg:ac.reg,name,start:s,total:cyc,first:left===cyc}); left-=len; start+=len; d++; }
      }
    }
  }
  return {ws,days,legend,routes};
}
function calHtml(){
  const off=UI.calW||0, D=calData(off), todayI=off===0?Math.floor((S.time-D.ws)/DAY):-1;
  const hh=x=>String(Math.floor(x/HOUR)%24).padStart(2,'0')+':'+String(Math.round(x%HOUR/MIN)).padStart(2,'0');
  // pistes : les blocs qui se chevauchent sont empilés sur des lignes différentes
  for(const d of D.days){ const ends=[]; d.blocks.sort((a,b)=>a.t0-b.t0); for(const b of d.blocks){ let l=ends.findIndex(e=>e<=b.t0+1); if(l<0){ l=ends.length; ends.push(0); } ends[l]=b.t0+b.len; b.lane=l; } d.lanes=Math.max(1,ends.length); }
  const rows=D.days.map((d,i)=>{ const dt=new Date(D.ws+i*DAY);
    return `<div class="cal-row${i===todayI?' today':''}"><div class="cal-day"><b>${WEEK_DAYS[i]} ${dt.getUTCDate()}</b><small>${d.dep} dép.</small></div><div class="cal-track" style="height:${d.lanes*22+8}px">${[0,6,12,18].map(h=>`<i class="cal-grid" style="left:${h/24*100}%"></i>`).join('')}${d.blocks.map(b=>`<span class="cal-blk" style="top:${4+b.lane*22}px;height:19px;left:${b.t0/DAY*100}%;width:${Math.max(1.5,b.len/DAY*100)}%;background:${b.col}" title="${esc(b.reg)} · ${esc(b.name)} · départ ${hh(b.start%DAY)} · rotation ${Math.round(b.total/HOUR*10)/10} h">${b.first&&b.len/DAY>0.11?esc(b.reg.slice(-3))+' '+hh(b.t0):''}</span>`).join('')}</div></div>`; }).join('');
  const total=D.days.reduce((s,d)=>s+d.dep,0);
  const rts=Object.entries(D.routes).map(([n,w])=>`<div class="small"><b>${esc(n)}</b> : ${w} aller-retour${w>1?'s':''} par semaine = ${w*2} vols</div>`).join('');
  const chips=D.legend.map(l=>`<button class="chip ${l.off?'':'on'}" style="${l.off?'':`border-color:${l.col}`}" data-act="calAc" data-id="${l.ac.id}"><i class="dot" style="background:${l.col}"></i>${esc(l.ac.reg)} · ${l.plan.map(p=>p.weekly+'×').join(' ')}</button>`).join('');
  const wk=new Date(D.ws), we=new Date(D.ws+6*DAY);
  return `<div class="cal-nav"><button class="btn sm" data-act="calWeek" data-d="-1" ${off<=0?'disabled':''}>◀</button><b>${off===0?'Cette semaine':'Semaine +'+off} · ${wk.getUTCDate()}/${wk.getUTCMonth()+1} → ${we.getUTCDate()}/${we.getUTCMonth()+1}</b><button class="btn sm" data-act="calWeek" data-d="1" ${off>=7?'disabled':''}>▶</button></div>
    <div class="cal-hours"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></div>
    <div class="cal">${rows}</div>
    <div class="small mut" style="margin:6px 0">Heures locales du hub de chaque avion. Un bloc = une rotation (aller + retour). Au total : <b>${total} rotations</b> cette semaine.</div>
    ${rts||'<div class="mut small">Aucun avion programmé : ouvrez une ligne, un avion libre y est placé automatiquement.</div>'}
    <div class="chips" style="margin-top:8px">${chips}</div>`;
}
MODALS.calendar=()=>showModal('🗓️ Calendrier des vols',calHtml(),true);
Object.assign(ACTIONS,{
  calendar:()=>openM('calendar'),
  calWeek:d=>{ UI.calW=Math.max(0,Math.min(7,(UI.calW||0)+(+d.d))); openM('calendar'); },
  calAc:d=>{ UI.calAc=UI.calAc===d.id?'':d.id; openM('calendar'); },
});
