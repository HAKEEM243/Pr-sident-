/* =========================================================
   Sky Empire — 🧬 éditeur : l'activité aérienne d'un pays
   Un curseur par pays (0 à 150 %) : à 100 % tout est normal ; en
   dessous, moins de gens veulent y aller ; sous 35 %, les compagnies
   suspendent leurs vols (on ne voit plus leurs avions) ; à 0 %, plus
   aucun vol : les aéroports du pays ferment. Au-dessus de 100 %, le
   pays attire plus de monde. Réversible à tout moment.
   ========================================================= */
'use strict';
const godAct=cc=>{ const o=typeof S!=='undefined'&&S&&S.god&&S.god.ov&&S.god.ov.cc&&S.god.ov.cc[cc]; return o&&o.act!==undefined?o.act:1; };
function godCcDead(a,b){ const A=AP(a), B=AP(b); return !!(A&&B&&(godAct(A.cc)<0.35||godAct(B.cc)<0.35)); }
const actLabel=v=>v<=0?'🛑 Plus aucun vol':v<0.35?'😶 Plus personne ne veut y aller — vols suspendus':v<0.7?'📉 Forte baisse d’activité':v<=1.05?'✈️ Normale':'📈 Le pays attire du monde';
function godHook3(){ if(godHook3.done||typeof godGet!=='function') return; godHook3.done=true;
  { const _g=godGet; godGet=function(t,id,f){ if(t==='cc'&&f==='act') return godAct(id); return _g(t,id,f); }; }
  { const _p=godPut; godPut=function(t,id,f,v){ if(!(t==='cc'&&f==='act')) return _p(t,id,f,v);
      const g=godS(), ov=g.ov.cc[id]=g.ov.cc[id]||{}, o=ov.act===undefined?1:ov.act; v=clamp(+v,0,1.5); ov.act=v; if(S.ai) S.ai.ver++;
      const name=COUNTRIES[id]?COUNTRIES[id][0]:id;
      if(v<=0&&o>0) aiNews(`🛑 ${name} : plus aucun vol. Les aéroports ferment faute de passagers.`,'bad',true);
      else if(v<0.35&&o>=0.35) aiNews(`😶 Plus personne ne veut aller en ${name} : les compagnies suspendent leurs vols.`,'warn',true);
      else if(v>=0.35&&o<0.35) aiNews(`📈 Reprise en ${name} : les compagnies reviennent.`,'news',true); }; }
  { const _c=godCheat; godCheat=function(t,id,f,o,v){ if(t==='cc'&&f==='act'){ const mine=godMineCc().has(id); return mine?(v-o)*10:0; } return _c(t,id,f,o,v); }; }
  // les compagnies ne volent plus vers un pays déserté
  { const _co=carriersOn; carriersOn=function(a,b){ if(S&&S.god&&godCcDead(a,b)) return []; return _co(a,b); }; }
  { const _rs=rivalSig; rivalSig=function(){ const ov=S&&S.god&&S.god.ov&&S.god.ov.cc||{}; return _rs()+'|act'+Object.entries(ov).filter(([,o])=>o.act!==undefined).map(([c,o])=>c+o.act).join(); }; }
  { const _dm=demandMult; demandMult=function(a,b){ let k=_dm(a,b); if(!S||!S.god) return k; return k*Math.sqrt(godAct(AP(a).cc)*godAct(AP(b).cc)); }; }
  { const _ac=airportClosed; airportClosed=function(code){ const A=AP(code); if(A&&S&&S.god&&godAct(A.cc)<=0) return true; return _ac(code); }; }
  // l'onglet Pays de l'éditeur : le curseur d'activité
  { const _h=godHtml; godHtml=function(){ const h=_h(); if((UI.godTab||'me')!=='cc') return h; const cc=COUNTRIES[UI.god_cc]?UI.god_cc:homeCC(), v=godAct(cc);
      const box=`<div class="card"><b>✈️ Activité aérienne ${cc==='CD'?'au Congo':'en '+esc(COUNTRIES[cc][0])}</b>
        <label><b class="gv">${Math.round(v*100)} %</b> — ${actLabel(v)}<input type="range" min="0" max="1.5" step="0.05" data-in="gd" data-t="cc" data-id="${cc}" data-f="act" value="${v}"></label>
        <div class="btns sm"><button class="btn sm danger" data-act="godActSet" data-cc="${cc}" data-v="0">🛑 Plus aucun vol</button><button class="btn sm" data-act="godActSet" data-cc="${cc}" data-v="0.2">😶 Plus personne ne veut y aller</button><button class="btn sm" data-act="godActSet" data-cc="${cc}" data-v="0.5">📉 Forte baisse</button><button class="btn sm gold" data-act="godActSet" data-cc="${cc}" data-v="1">✈️ Normal</button></div>
        <div class="small mut">Sous 35 % : les compagnies suspendent leurs vols vers ce pays (leurs avions disparaissent de la carte). À 0 % : les aéroports ferment, plus aucun vol. Vos propres lignes volent presque vides : à vous de décider.</div></div>`;
      const mark='<h3>'; const i=h.indexOf(mark,h.indexOf('data-k="cc"')); return i<0?h+box:h.slice(0,i)+box+h.slice(i); }; }
  Object.assign(ACTIONS,{ godActSet:d=>{ godSet('cc',d.cc,'act',+d.v); refreshModal(); if(typeof drawAirports==='function') try{ drawAirports(); }catch(e){} } });
  // le curseur met à jour son libellé en direct
  { const _gd=INPUTS.gd; INPUTS.gd=el=>{ _gd(el); if(el.dataset.f==='act'){ const lab=el.closest('label'); if(lab){ const v=+el.value; const b=lab.querySelector('.gv'); if(b) b.textContent=Math.round(v*100)+' %'; } } }; }
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ godHook3(); }catch(e){ console.warn(e); } },40));
