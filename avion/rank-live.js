/* =========================================================
   Sky Empire — 🏆 classement en direct
   Les chiffres du classement bougent avec le temps du jeu, à chaque
   seconde affichée :
   • patrimoine des autres compagnies : leur résultat de la semaine
     s'accumule heure par heure (au lieu d'arriver d'un coup le lundi),
     avec les petites variations de la journée (billets vendus, carburant) ;
   • passagers/jour : les vôtres = voyageurs réellement débarqués sur les
     24 dernières heures de jeu ; ceux des concurrents suivent le rythme
     de la journée (pointes le matin et le soir, creux la nuit) ;
   • le tableau se redessine chaque seconde quand il est à l'écran.
   ========================================================= */
'use strict';
const RL={log:[], at:0};
const rlHash=s=>{ let h=7; for(const c of String(s)) h=(h*31+c.charCodeAt(0))%9973; return h; };
// rythme de la journée (heure locale approximative de la compagnie) : ≈ 0,55 la nuit, ≈ 1,25 aux pointes
function rlDay(hub,t){ const A=hub&&AP(hub), tz=A?((A.utc!==undefined&&A.utc!==null&&A.utc!=='')?+A.utc:A.lon/15):0, h=(((t/HOUR+tz)%24)+24)%24;
  return 0.55+0.4*Math.exp(-((h-8.5)**2)/8)+0.38*Math.exp(-((h-18)**2)/9)+0.18*Math.exp(-((h-13)**2)/12); }
// voyageurs débarqués sur les 24 dernières heures de jeu
function rlMyPax(fallback){
  const t=S.time, L=RL.log; while(L.length&&L[0][0]<t-DAY) L.shift();
  const span=Math.min(DAY,t-RL.at); if(!RL.at||span<2*HOUR) return fallback;
  const n=L.reduce((s,x)=>s+x[1],0); return Math.round(n*DAY/Math.max(span,HOUR));
}
function rlHook(){ if(rlHook.done||typeof aiRows!=='function') return; rlHook.done=true;
  // compteur des passagers débarqués
  if(typeof completeLeg==='function'){ const _cl=completeLeg; completeLeg=function(ac){ try{ const fl=ac.flight, l=fl&&fl.legs[fl.li], p=l&&l.pax; if(p&&!ac.ownerCode){ const n=(p.f||0)+(p.j||0)+(p.w||0)+(p.y||0); if(n){ if(!RL.at) RL.at=S.time; RL.log.push([S.time,n]); } } }catch(e){} return _cl.apply(this,arguments); }; }
  const _ar=aiRows; aiRows=function(){
    const rows=_ar.apply(this,arguments), t=S.time, ws=typeof weekStart==='function'?weekStart(t):t-(t%(7*DAY)), fr=clamp((t-ws)/(7*DAY),0,1);
    for(const r of rows){
      if(r.me){ if(!RL.at) RL.at=S.time; r.pax=rlMyPax(r.pax); continue; }
      const e=r.e||{}, k=rlHash(r.code);
      const wiggle=Math.sin(t/HOUR*0.9+k)*0.0022+Math.sin(t/(11*MIN)+k*0.37)*0.0007;            // ventes et dépenses de la journée
      r.value=Math.max(10e6,(r.value+(e.lastOperatingResult||0)*fr)*(1+wiggle));
      r.pax=Math.round((r.pax||0)*rlDay(r.hub,t)*(1+Math.sin(t/(17*MIN)+k)*0.02));
      r.growth=typeof rankGrowth==='function'?rankGrowth(r.value,e):r.growth;
    }
    rows.sort((a,b)=>b.value-a.value);
    rows.forEach((r,i)=>{ r.rank=i+1; const p=S.ai&&S.ai.rank&&S.ai.rank[r.code]; r.delta=p?p-(i+1):0; });
    return rows;
  };
  // bandeau « en direct » en haut du classement
  if(typeof pNews==='function'){ const _pn=pNews; pNews=function(){ const h=_pn.apply(this,arguments); if((UI.newsTab||'actu')!=='rank') return h;
    const live=`<div class="small" style="margin:4px 0 8px"><span style="color:#f87171">●</span> <b>En direct</b> · ${fmtDate(S.time)} ${typeof fmtTime==='function'?fmtTime(S.time):''} UTC · les chiffres bougent avec le temps du jeu</div>`;
    return h.replace('<div class="rank-overview">',live+'<div class="rank-overview">'); }; }
  // redessin chaque seconde quand le classement est affiché
  setInterval(()=>{ try{
    if(typeof S==='undefined'||!S||UI.tab!=='news'||(UI.newsTab||'actu')!=='rank') return;
    const P=document.getElementById('panel'); if(P&&P.classList.contains('hide')) return;
    if(document.hidden||performance.now()-(UI.touchAt||0)<1500) return;
    const a=document.activeElement; if(a&&/INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
    renderPanel(); }catch(e){} },1000);
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ rlHook(); }catch(e){ console.warn(e); } },0));
