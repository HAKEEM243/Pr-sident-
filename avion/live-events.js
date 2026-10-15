/* =========================================================
   Sky Empire — ⚡ événements en vol : vous décidez en direct
   De temps en temps, un de vos avions en vol vous pose un problème :
   panne, orage, passager malade, ministre qui veut l'avion…
   Le jeu se met en pause, vous choisissez, et la décision a des
   conséquences (argent, image, retards, gouvernement).
   Sans réponse au bout de 90 secondes, le commandant prend la
   décision prudente. Fréquence réglable dans Compagnie → Réglages.
   ========================================================= */
'use strict';
const LV_FREQ={off:['Désactivés',0],rare:['Rares',1],normal:['Normaux',2],often:['Fréquents',3]};
const LV_TYPES=[
  {k:'engine',i:'🔥',t:'Alarme moteur',w:3,
   txt:(ac,L)=>`Le commandant du ${fnTxt(ac)} (${L.from} → ${L.to}) signale une <b>alarme sur le moteur n° 2</b>. L’avion vole normalement pour l’instant.`,
   opts:[{k:'divert',l:'🛬 Se poser à l’aéroport le plus proche',safe:true,run:(ac,L)=>{ const c=lvDivCost(ac); book('incidents',-c); lvLate(4); ac.condition=Math.max(0,ac.condition-2); return `Atterrissage de précaution réussi. Les passagers repartent sur un autre vol : ${fmtMoney(c)} et 4 vols en retard. Le moteur sera contrôlé.`; }},
         {k:'go',l:'✈️ Continuer jusqu’à destination',run:(ac,L)=>{ if(Math.random()<0.18){ const c=Math.round(lvDivCost(ac)*3); book('incidents',-c); S.reputation=clamp(S.reputation-3,0,100); ac.condition=Math.max(0,ac.condition-12); return `⚠️ Le moteur a dû être coupé en vol : atterrissage d’urgence à destination, presse négative (image −3), réparations ${fmtMoney(c)}.`; } return 'Le vol arrive sans problème : vous avez économisé un déroutement.'; }}]},
  {k:'storm',i:'🌩️',t:'Orage sur la route',w:4,
   txt:(ac,L)=>`Une grosse ligne d’orages barre la route du ${fnTxt(ac)} (${L.from} → ${L.to}). Le contournement ajoute environ 25 minutes de vol.`,
   opts:[{k:'around',l:'↪️ Contourner l’orage',safe:true,run:(ac)=>{ const c=Math.round(modelOf(ac).burn*0.4*(typeof fuelPrice==='function'?fuelPrice():0.8)); book('carburant',-c); lvLate(1); return `Contournement réussi : ${fmtMoney(c)} de kérosène en plus, un petit retard, des passagers rassurés.`; }},
         {k:'through',l:'⚡ Passer au travers',run:()=>{ if(Math.random()<0.35){ S.reputation=clamp(S.reputation-2,0,100); lvReview(1,'Turbulences terribles, des gens ont eu très peur. Plus jamais !'); return '😱 Fortes turbulences : plusieurs passagers blessés légèrement, avis furieux, image −2.'; } return 'Quelques secousses, mais tout le monde arrive à l’heure.'; }}]},
  {k:'sick',i:'🩺',t:'Passager malade',w:3,
   txt:(ac,L)=>`À bord du ${fnTxt(ac)} (${L.from} → ${L.to}), un passager fait un malaise grave. Un médecin est présent dans la cabine.`,
   opts:[{k:'divert',l:'🏥 Dérouter vers un hôpital',safe:true,run:(ac)=>{ const c=Math.round(lvDivCost(ac)*0.8); book('incidents',-c); lvLate(3); S.reputation=clamp(S.reputation+2,0,100); lvReview(5,'L’équipage a tout fait pour sauver un passager malade. Bravo, humainement exemplaire.'); return `Le passager est soigné à temps. La presse salue votre équipage : image +2 (coût ${fmtMoney(c)}).`; }},
         {k:'go',l:'🧑‍⚕️ Continuer avec le médecin',run:()=>{ if(Math.random()<0.3){ S.reputation=clamp(S.reputation-4,0,100); return '😔 L’état du passager s’est aggravé avant l’arrivée. La famille porte plainte : image −4.'; } S.reputation=clamp(S.reputation+0.5,0,100); return 'Le médecin stabilise le passager jusqu’à l’arrivée. Ouf.'; }}]},
  {k:'minister',i:'🏛️',t:'Un ministre veut votre avion',w:2,home:true,
   txt:(ac,L)=>`Le ministre des Transports de ${typeof ccName==='function'?ccName(homeCC()):'votre pays'} veut réquisitionner le ${fnTxt(ac)} dès son arrivée pour une mission officielle de 3 jours. Ses passagers prévus devront être replacés.`,
   opts:[{k:'yes',l:'🤝 Accepter',run:(ac)=>{ const c=Math.round(modelOf(ac).seats*180); book('incidents',-c); lvGov(+8); return `Le ministre vous remercie : relation avec le gouvernement +8 (coût des passagers replacés : ${fmtMoney(c)}).`; }},
         {k:'no',l:'🙅 Refuser poliment',safe:true,run:()=>{ lvGov(-6); return 'Le ministre est vexé : relation avec le gouvernement −6. Vos passagers voyagent comme prévu.'; }}]},
  {k:'vip',i:'⭐',t:'Une star à bord',w:2,
   txt:(ac,L)=>`Une célébrité voyage en classe économique sur le ${fnTxt(ac)} (${L.from} → ${L.to}). Son équipe demande un surclassement gratuit, en échange d’une publication sur ses réseaux.`,
   opts:[{k:'yes',l:'🥂 Surclasser gratuitement',run:()=>{ S.reputation=clamp(S.reputation+1.5,0,100); lvReview(5,'Accueil royal à bord, merci à tout l’équipage !'); return 'La star publie des photos de votre cabine : image +1,5.'; }},
         {k:'no',l:'💳 Proposer un surclassement payant',safe:true,run:()=>{ if(Math.random()<0.5){ book('annexes',1200); return 'La star paie son surclassement (1 200 $).'; } S.reputation=clamp(S.reputation-1,0,100); return 'La star se moque de votre compagnie en ligne : image −1.'; }}]},
];
const fnTxt=ac=>`vol ${S.company.code}${typeof flightNumber==='function'?flightNumber(ac):''} (${esc(ac.reg)})`;
const lvDivCost=ac=>Math.round((15e3+modelOf(ac).seats*120)/100)*100;
function lvLate(n){ S.stats.late=(S.stats.late||0)+n; }
function lvGov(d){ const cc=homeCC(); S.dev=S.dev||{c:{},rel:{},log:[],wk:0,tier:{},last:{}}; S.dev.rel[cc]=clamp((S.dev.rel[cc]===undefined?55:S.dev.rel[cc])+d,0,100); }
function lvReview(stars,text){ (S.reviews=S.reviews||[]).unshift({t:S.time,stars,name:'Passager',nat:homeCC(),route:'—',cls:'y',text,job:'voyageur'}); if(S.reviews.length>80) S.reviews.length=80; }
const LV={cur:null, timer:null, nextAt:0};
function lvTick(){
  if(typeof booted==='undefined'||!booted||!S||!S.fleet||UI.modal||!$('#modal').hidden||UI.catching||document.hidden||S.paused||document.body.classList.contains('piloting')) return;
  const f=LV_FREQ[S.lvFreq||'normal'][1]; if(!f) return;
  const now=Date.now(); if(!LV.nextAt){ LV.nextAt=now+(6-f)*60e3; return; } if(now<LV.nextAt) return;
  LV.nextAt=now+(f===3?4:f===2?9:20)*60e3*(0.7+Math.random()*0.6);   // environ toutes les 9 minutes réelles en « normal »
  const fly=S.fleet.filter(a=>a.status==='flight'&&a.flight&&a.flight.legs&&a.flight.legs[a.flight.li]&&a.flight.legs[a.flight.li].pax); if(!fly.length) return;
  const ac=pick(fly), L=ac.flight.legs[ac.flight.li];
  const types=LV_TYPES.filter(t=>!t.home||AP(L.from).cc===homeCC()||AP(L.to).cc===homeCC()); let r=Math.random()*types.reduce((s,t)=>s+t.w,0), T=types[0]; for(const t of types){ r-=t.w; if(r<=0){ T=t; break; } }
  lvShow(T,ac,L);
}
function lvShow(T,ac,L){
  LV.cur={T,id:ac.id,L}; LV.wasPaused=S.paused; S.paused=true; let left=90;
  const html=()=>`<p>${T.txt(ac,L)}</p><div class="small mut">⏸️ Le jeu est en pause. Sans réponse dans <b id="lvLeft">${left}</b> s, le commandant choisit la solution prudente.</div>
    <div class="btns col">${T.opts.map(o=>`<button class="btn ${o.safe?'':'gold'}" data-act="lvPick" data-k="${o.k}">${o.l}</button>`).join('')}</div>
    <div class="btns"><button class="btn sm" data-act="lvSee">👀 Voir l’avion</button></div>`;
  showModal(`${T.i} ${T.t}`, html());
  clearInterval(LV.timer); LV.timer=setInterval(()=>{ left--; const el=document.getElementById('lvLeft'); if(el) el.textContent=left; if(left<=0){ const o=T.opts.find(x=>x.safe)||T.opts[0]; lvResolve(o.k,true); } },1000);
}
function lvResolve(k,auto){
  const c=LV.cur; if(!c) return; clearInterval(LV.timer); LV.cur=null; S.paused=!!LV.wasPaused;
  const ac=S.fleet.find(a=>a.id===c.id), o=c.T.opts.find(x=>x.k===k)||c.T.opts[0];
  let res='Situation réglée.'; try{ if(ac) res=o.run(ac,c.L); }catch(e){ console.warn(e); }
  S.lvLog=S.lvLog||[]; S.lvLog.unshift({t:S.time,txt:`${c.T.i} ${c.T.t} — ${auto?'(décision du commandant) ':''}${o.l.replace(/^\S+\s/,'')} : ${res}`}); if(S.lvLog.length>20) S.lvLog.length=20;
  logMsg(`${c.T.i} ${c.T.t} : ${res}`, /⚠️|😱|😔|vexé|moque/.test(res)?'warn':'ok');
  showModal(`${c.T.i} ${c.T.t}`, `<p><b>${esc(o.l)}</b>${auto?' <span class="mut small">(le commandant a décidé)</span>':''}</p><p>${res}</p><div class="btns"><button class="btn gold" data-act="closeModal">OK</button></div>`);
  renderTop();
}
function registerLiveEventActions(){
  Object.assign(ACTIONS,{
    lvPick:d=>lvResolve(d.k,false),
    lvSee:()=>{ const c=LV.cur; if(!c) return; const id=c.id; const T=c.T; LV._inSee=true; try{ closeModal(); } finally{ LV._inSee=false; } if(UI.mobile) setTab('map'); try{ selectPlane(id); followPlane=true; }catch(e){}
      setTimeout(()=>{ if(LV.cur) { const ac=S.fleet.find(a=>a.id===id); if(ac) showModal(`${T.i} ${T.t}`, `<p>${T.txt(ac,c.L)}</p><div class="btns col">${T.opts.map(o=>`<button class="btn ${o.safe?'':'gold'}" data-act="lvPick" data-k="${o.k}">${o.l}</button>`).join('')}</div>`); } },4000); },
    lvFreq:d=>{ S.lvFreq=d.k; LV.nextAt=0; renderPanel(); toast('⚡ Événements en vol : '+LV_FREQ[d.k][0],'info'); },
  });
}
// si la fenêtre est fermée sans répondre (croix), la décision prudente s'applique
{ const _cm=closeModal; closeModal=function(){ const r=_cm.apply(this,arguments); if(LV.cur&&!LV._inSee){ const c=LV.cur, o=c.T.opts.find(x=>x.safe)||c.T.opts[0]; setTimeout(()=>{ if(LV.cur===c) lvResolve(o.k,true); },0); } return r; }; }
setInterval(()=>{ try{ lvTick(); }catch(e){ console.warn('events',e); } },15000);
