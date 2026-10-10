/* =========================================================
   Sky Empire — duel ligne par ligne
   Chaque semaine, les compagnies présentes sur vos lignes observent
   votre prix, vos fréquences et votre part de marché, puis répondent :
   elles s'alignent sur vos baisses de prix, ajoutent des vols quand vous
   en ajoutez, remontent leurs tarifs quand vous ne les menacez pas, et
   lâchent prise quand leur trésorerie ne suit plus.
   L'intensité suit le réglage Rivalité (Plus → Options).
   ========================================================= */
'use strict';
const DUEL_TXT={match:'aligne ses prix sur les vôtres',freq:'ajoute des vols pour vous contrer',cut:'casse ses prix pour reprendre des passagers',milk:'remonte ses tarifs (vous ne la menacez pas)',hold:'tient ses positions',broke:'n’a plus les moyens de suivre'};
function duelOf(code,a,b){ const D=S.ai&&S.ai.duel; return D&&D[code+pairKey(a,b)]; }
// attractivité supplémentaire d'un rival sur une ligne (prix et fréquences ajustés)
function duelFactor(code,a,b,freq){ const d=duelOf(code,a,b); if(!d) return 1; return priceFactor(d.px)*Math.sqrt(Math.max(0.2,(freq+d.fq)/Math.max(0.2,freq))); }
function duelFq(code,a,b){ const d=duelOf(code,a,b); return d?d.fq:0; }
function duelWeekly(){
  const ai=S.ai; if(!ai||!S.routes) return; const Dv=typeof drive==='function'?drive():1; ai.duel=ai.duel||{};
  if(!Dv){ ai.duel={}; return; }
  let news=0; const seen=new Set();
  for(const r of S.routes){
    if(!routeAircraft(r).length) continue;
    const a=r.stops[0], b=r.stops[r.stops.length-1], key=pairKey(a,b); if(seen.has(key)) continue; seen.add(key);
    let mk=null; try{ mk=legMarket(r,a,b); }catch(e){ continue; }
    const sh=mk.y.share, myP=mk.y.ratio, myF=mk.freq;
    const xs=rivalsOn(a,b), fair=1/(xs.length+1);                     // part « normale » si tout le monde se valait
    for(const x of xs){
      const code=x.R.code, e=aiBy(code); if(typeof isAlly==='function'&&isAlly(code)) continue;
      const k=code+key, d=ai.duel[k]||(ai.duel[k]={px:1,fq:0,mode:'hold',t:S.time});
      if(Math.random()>0.45+0.15*Dv) continue;                          // elles ne réagissent pas toutes chaque semaine
      const old=d.mode, poor=e&&(e.cash<0||(e.debt||0)>=3);
      if(poor){ d.px=Math.min(1,d.px+0.06); d.fq=Math.max(0,d.fq-0.5); d.mode='broke'; }
      else if(sh>fair*1.35){                                                  // vous dominez : riposte
        if(myP<0.97&&d.px>myP*0.99){ d.px=Math.max(0.68,Math.min(d.px,myP*(1-0.01*Dv))); d.mode='match'; }
        else if(myF>x.freq+d.fq&&d.fq<1+Dv*1.5){ d.fq=Math.min(1+Dv*1.5,d.fq+(Dv>=3?1:0.5)); d.mode='freq'; }
        else { d.px=Math.max(0.7,d.px-0.03*Dv); d.mode='cut'; }
        if(e) e.cash-=(1-d.px)*x.freq*7*rnd(0.4,0.8)*1e6*(e.fleet>=60?1:0.4);   // la riposte coûte de l'argent
      } else if(sh<fair*0.6){ d.px=Math.min(1.12,d.px+0.04); d.fq=Math.max(0,d.fq-0.5); d.mode='milk'; }
      else { d.px+=(1-d.px)*0.25; d.fq=Math.max(0,d.fq-0.25); d.mode='hold'; }
      d.t=S.time;
      if(d.mode!==old&&news<2&&(d.mode==='match'||d.mode==='freq'||d.mode==='cut')){ news++;
        const nm=e?e.name:x.R.name, pc=Math.round((1-d.px)*100);
        aiNews(d.mode==='match'?`🧠 ${nm} s’aligne sur vos prix ${keyCity(a)}–${keyCity(b)} (−${pc} %).`
          :d.mode==='freq'?`🧠 ${nm} ajoute des vols ${keyCity(a)}–${keyCity(b)} pour contrer votre fréquence (+${d.fq.toFixed(1).replace('.',',')} vol/j).`
          :`🧠 ${nm} baisse ses tarifs ${keyCity(a)}–${keyCity(b)} (−${pc} %) pour reprendre des passagers.`,'rival',Dv>=2); }
    }
  }
  for(const k of Object.keys(ai.duel)) if(S.time-ai.duel[k].t>60*DAY) delete ai.duel[k];
}
// ligne « Concurrence » dans le détail d'une ligne
function duelNote(a,b){
  const out=[]; for(const x of rivalsOn(a,b)){ const d=duelOf(x.R.code,a,b); if(!d) continue;
    const pc=Math.round((d.px-1)*100);
    out.push(`<div class="small">🧠 <b>${esc(x.R.name)}</b> : prix ${pc>0?'+':pc<0?'−':''}${Math.abs(pc)} % · ${(x.freq+d.fq).toFixed(1).replace('.',',')} vol/j · <i>${DUEL_TXT[d.mode]||''}</i></div>`); }
  return out.length?`<h3>Ce que font vos concurrents</h3>${out.join('')}`:'';
}
