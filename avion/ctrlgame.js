/* =========================================================
   Sky Empire — 🕵️ Poste de contrôle (mini-jeu)
   Vous êtes l'agent : 8 passagers d'un de vos vols se présentent.
   1. 🚪 Documents à la porte (c'est la compagnie qui les vérifie avant
      l'embarquement) : la personne devant vous ressemble-t-elle à la photo ?
      Passeport encore valide ? Nom et vol de la carte d'embarquement ?
      Visa quand il faut, carnet de vaccination fièvre jaune pour l'Afrique
      centrale et de l'Ouest ?
   2. 🧳 Rayons X du bagage cabine : couteau, grande bouteille, arme,
      feux d'artifice, gros ciseaux… → fouille.
   Bonnes décisions : image +, amendes évitées. Erreurs : un passager mal
   documenté laissé partir = amende transporteur ; un passager en règle refusé
   = indemnité. Passagers et documents fictifs.
   ========================================================= */
'use strict';
const CG={s:null};
const CG_FACES=['🧑🏿','👩🏿','👨🏿','🧔🏿','👵🏿','👴🏿','🧑🏾','👩🏾','👨🏾','🧑🏽','👩🏽','👨🏽','🧑🏻','👩🏻','👨🏻','🧔🏻','👱🏻‍♀️','👩🏼‍🦱','🧑🏼‍🦰','👨🏾‍🦲'];
const CG_DEF={exp:'Passeport expiré',name:'Le nom sur la carte d’embarquement ne correspond pas au passeport',flight:'La carte d’embarquement est pour un autre vol',novisa:'Visa obligatoire absent',visaexp:'Visa expiré',yf:'Pas de carnet de vaccination fièvre jaune',photo:'Ce n’est pas la personne de la photo du passeport'};
const CG_BAD=[['knife','🔪 couteau'],['bottle','🧴 grande bouteille (plus de 100 ml)'],['gun','🔫 arme à feu'],['fire','🎆 feux d’artifice'],['scis','✂️ gros ciseaux']];
const cgD=(d,m,y)=>`${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
function cgCases(ac){
  const man=flightManifest(ac,40); if(!man||!man.rows||!man.rows.length) return null; const leg=man.leg, A=AP(leg.from), B=AP(leg.to), intl=A.cc!==B.cc;
  const now=new Date(S.time), Y=now.getUTCFullYear(), M=now.getUTCMonth()+1, D=now.getUTCDate(), r=pfRng('cg|'+ac.id+'|'+leg.dep+'|'+(CG.n=(CG.n||0)+1));
  const fno=`${S.company.code}${flightNumber(ac)}`, yfNeed=typeof PF_YF!=='undefined'&&PF_YF.has(B.cc)&&intl;
  const rows=man.rows.slice().sort(()=>r()-0.5).slice(0,8);
  return {ac,fno,A,B,intl,leg,list:rows.map(x=>{
    const needVisa=intl&&x.visa==='Visa obtenu', face=CG_FACES[Math.floor(r()*CG_FACES.length)];
    const c={x,face,photo:face,needVisa,yfNeed,passExp:cgD(1+Math.floor(r()*27),1+Math.floor(r()*12),Y+1+Math.floor(r()*7)),bpName:`${x.last.toUpperCase()}/${x.first.toUpperCase()}`,bpFlight:fno,
      visa:needVisa?{ok:true,until:cgD(1+Math.floor(r()*27),1+Math.floor(r()*12),Y+1)}:null,yf:yfNeed?'✅ Vacciné(e) le '+cgD(1+Math.floor(r()*27),1+Math.floor(r()*12),Y-1-Math.floor(r()*9)):null,def:null};
    if(r()<0.42){ const opts=['exp','name','flight','photo'].concat(needVisa?['novisa','visaexp']:[]).concat(yfNeed?['yf']:[]), d=opts[Math.floor(r()*opts.length)]; c.def=d;
      if(d==='exp') c.passExp=cgD(Math.min(D,27),M>1?M-1:12,M>1?Y:Y-1);
      if(d==='name'){ const L=x.last.toUpperCase(); const i=Math.max(1,Math.floor(L.length/2)); c.bpName=`${L.slice(0,i-1)}${L[i]||'E'}${L[i-1]}${L.slice(i+1)}/${x.first.toUpperCase()}`; if(c.bpName.split('/')[0]===L) c.bpName=L+'E/'+x.first.toUpperCase(); }
      if(d==='flight') c.bpFlight=`${S.company.code}${flightNumber(ac)+1+Math.floor(r()*40)}`;
      if(d==='photo'){ let f; do{ f=CG_FACES[Math.floor(r()*CG_FACES.length)]; }while(f===face); c.photo=f; }
      if(d==='novisa') c.visa=null;
      if(d==='visaexp') c.visa={ok:false,until:cgD(Math.min(D,27),M>1?M-1:12,M>1?Y:Y-1)};
      if(d==='yf') c.yf=null; }
    // bagage cabine
    const items=[['clothes'],['clothes'],[r()<0.7?'laptop':'book'],['phone'],[r()<0.5?'cable':'shoes'],[r()<0.4?'bottleS':'keys']];
    c.bad=r()<0.3?CG_BAD[Math.floor(r()*CG_BAD.length)]:null; if(c.bad) items.push([c.bad[0]]);
    c.items=items.map(i=>i[0]); c.seed=Math.floor(r()*1e9); return c; })};
}
// image rayons X (couleurs : orange = organique, bleu = métal, vert = mélange)
function cgXray(c){
  const cv=document.createElement('canvas'); cv.width=640; cv.height=380; const g=cv.getContext('2d'); let s=c.seed; const r=()=>((s=(s*16807)%2147483647)/2147483647);
  g.fillStyle='#0a0f1e'; g.fillRect(0,0,640,380); g.fillStyle='rgba(120,170,255,.08)'; g.fillRect(40,40,560,300); g.strokeStyle='rgba(120,180,255,.55)'; g.lineWidth=6; g.strokeRect(40,40,560,300);
  g.fillStyle='rgba(80,140,255,.5)'; g.fillRect(290,22,60,20); g.fillRect(60,60,8,260); g.fillRect(572,60,8,260);
  const O='rgba(255,150,40,', B='rgba(60,140,255,', Gr='rgba(70,220,140,';
  const at=()=>[90+r()*400,80+r()*200];
  for(const it of c.items){ const [x,y]=at(); g.save(); g.translate(x,y); g.rotate((r()-0.5)*1.2);
    if(it==='clothes'){ g.fillStyle=O+'.35)'; for(let k=0;k<5;k++){ g.beginPath(); g.ellipse(r()*90,r()*60,40+r()*30,22+r()*20,r()*3,0,7); g.fill(); } }
    else if(it==='laptop'){ g.fillStyle=Gr+'.55)'; g.fillRect(0,0,170,110); g.fillStyle=B+'.8)'; g.fillRect(10,85,150,14); g.fillRect(20,15,30,10); }
    else if(it==='book'){ g.fillStyle=O+'.6)'; g.fillRect(0,0,90,120); }
    else if(it==='phone'){ g.fillStyle=Gr+'.7)'; g.fillRect(0,0,34,68); g.fillStyle=B+'.9)'; g.fillRect(6,40,22,18); }
    else if(it==='cable'){ g.strokeStyle=B+'.8)'; g.lineWidth=4; g.beginPath(); for(let k=0;k<6;k++) g.arc(20,20,10+k*3,0,4); g.stroke(); g.fillStyle=Gr+'.7)'; g.fillRect(40,0,30,24); }
    else if(it==='shoes'){ g.fillStyle=O+'.55)'; g.beginPath(); g.ellipse(0,0,55,22,0,0,7); g.ellipse(20,40,55,22,0,0,7); g.fill(); g.fillStyle=B+'.6)'; g.fillRect(-40,-4,6,8); }
    else if(it==='bottleS'){ g.fillStyle=O+'.75)'; g.fillRect(0,10,18,40); g.fillRect(4,0,10,12); }
    else if(it==='keys'){ g.strokeStyle=B+'.95)'; g.lineWidth=5; g.beginPath(); g.arc(0,0,12,0,7); g.stroke(); g.fillStyle=B+'.95)'; g.fillRect(10,-3,34,6); g.fillRect(36,-3,4,10); }
    else if(it==='knife'){ g.fillStyle=B+'1)'; g.beginPath(); g.moveTo(0,0); g.lineTo(110,6); g.lineTo(110,16); g.lineTo(0,18); g.closePath(); g.fill(); g.fillStyle=O+'.8)'; g.fillRect(-55,2,55,16); }
    else if(it==='bottle'){ g.fillStyle=O+'.8)'; g.fillRect(0,26,60,150); g.fillRect(18,0,24,30); g.fillStyle=B+'.7)'; g.fillRect(16,-6,28,8); }
    else if(it==='gun'){ g.fillStyle=B+'1)'; g.fillRect(0,0,120,26); g.fillRect(0,0,28,78); g.fillRect(38,26,14,22); g.fillStyle=B+'.6)'; g.fillRect(118,6,14,14); }
    else if(it==='fire'){ for(let k=0;k<6;k++){ g.fillStyle=O+'.85)'; g.fillRect(k*16,0,12,70); g.fillStyle=Gr+'.9)'; g.fillRect(k*16+3,-10,6,12); } g.strokeStyle=B+'.8)'; g.lineWidth=2; g.beginPath(); g.moveTo(0,-10); g.bezierCurveTo(40,-50,70,-30,100,-12); g.stroke(); }
    else if(it==='scis'){ g.strokeStyle=B+'1)'; g.lineWidth=7; g.beginPath(); g.moveTo(0,0); g.lineTo(110,30); g.moveTo(0,40); g.lineTo(110,10); g.stroke(); g.lineWidth=5; g.beginPath(); g.arc(-12,-4,12,0,7); g.moveTo(0,44); g.arc(-12,44,12,0,7); g.stroke(); }
    g.restore(); }
  // grain du scanner
  const im=g.getImageData(0,0,640,380), d=im.data; for(let i=0;i<d.length;i+=4){ const n=(r()-0.5)*18; d[i]+=n; d[i+1]+=n; d[i+2]+=n; } g.putImageData(im,0,0);
  return cv.toDataURL('image/jpeg',0.85);
}
function cgDocs(c,s){
  const x=c.x, nat=COUNTRIES[x.nat]||['—','','🏳️'], card='background:#f8fafc;color:#0f172a;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.35;box-shadow:0 2px 8px rgba(0,0,0,.35)';
  const pass=`<div style="${card};border-top:6px solid #1e3a8a"><div style="display:flex;justify-content:space-between"><b>PASSEPORT · ${esc(nat[0]).toUpperCase()}</b><span>${nat[2]}</span></div>
    <div style="display:flex;gap:8px;margin-top:4px"><div style="font-size:40px;background:#e2e8f0;border-radius:6px;padding:2px 6px">${c.photo}</div><div>Nom <b>${esc(x.last.toUpperCase())}</b><br>Prénom <b>${esc(x.first)}</b><br>Né${x.F?'e':''} le <b>${esc(x.dob||'—')}</b><br>N° <b>${esc(x.passNo||'—')}</b><br>Expire le <b style="color:#b91c1c">${c.passExp}</b></div></div></div>`;
  const bp=`<div style="${card};border-left:6px solid #f59e0b"><b>🎫 CARTE D’EMBARQUEMENT</b><br>Passager <b>${esc(c.bpName)}</b><br>Vol <b>${esc(c.bpFlight)}</b> · ${esc(s.A.code)} → ${esc(s.B.code)} · siège <b>${esc(x.seat)}</b></div>`;
  const visa=s.intl?(c.needVisa||c.def==='novisa'?(c.visa?`<div style="${card};border-left:6px solid #16a34a"><b>🛂 VISA · ${esc(s.B.city)}</b><br>Entrées : 1 · Valable jusqu’au <b style="color:#b91c1c">${c.visa.until}</b></div>`:`<div style="${card};opacity:.7"><b>🛂 Visa</b><br><i>aucun visa dans le passeport</i></div>`):`<div style="${card};opacity:.7"><b>🛂 Visa</b><br>pas de visa requis pour ce passeport</div>`):'';
  const yf=c.yfNeed?(c.yf?`<div style="${card};border-left:6px solid #eab308"><b>💉 CARNET INTERNATIONAL DE VACCINATION</b><br>Fièvre jaune : ${c.yf}</div>`:`<div style="${card};opacity:.7"><b>💉 Carnet de vaccination</b><br><i>non présenté</i></div>`):'';
  return `<div style="display:grid;gap:8px">${pass}${bp}${visa}${yf}</div>`;
}
function cgRender(){
  const s=CG.s; if(!s) return; const el=document.getElementById('cgRoot'); const c=s.list[s.i];
  let h=`<div class="small mut">Vol ${esc(s.fno)} · ${esc(s.A.city)} → ${esc(s.B.city)} · ${s.intl?'🌍 international':'🏠 intérieur'} · date du jour ${new Date(S.time).toLocaleDateString('fr-FR')}</div>
    <div class="row" style="justify-content:space-between;margin:6px 0"><b>Passager ${Math.min(s.i+1,s.list.length)} / ${s.list.length}</b><span>✅ ${s.ok} · ❌ ${s.ko} · ⭐ ${s.pts} pts</span></div>`;
  if(s.fb) h+=`<div class="card" style="margin:6px 0;border-left:5px solid ${s.fb.good?'#22c55e':'#ef4444'}">${s.fb.t}</div>`;
  const bar='position:sticky;bottom:0;background:var(--bg2,#0f172a);padding:8px 0;margin:0;z-index:2';
  if(s.i>=s.list.length){ h+=cgEnd(); }
  else if(s.step==='doc'){
    h+=`<div class="card" style="text-align:center"><div style="font-size:64px;line-height:1">${c.face}</div><div class="small">Devant vous : <b>${esc(c.x.first)} ${esc(c.x.last)}</b>, ${c.x.age} ans</div></div>${cgDocs(c,s)}
      <div class="small mut" style="margin:6px 0">Vérifiez : photo = personne ? passeport valide aujourd’hui ? nom et vol de la carte ? ${s.intl?'visa si demandé ? ':''}${c.yfNeed?'carnet fièvre jaune ?':''}</div>
      <div class="btns" style="${bar}"><button class="btn" data-act="cgDoc" data-v="1">✅ Embarquer</button><button class="btn" data-act="cgDoc" data-v="0" style="background:#b91c1c">⛔ Refuser</button></div>`;
  } else if(s.step==='xray'){
    h+=`<div class="card"><b>🧳 Rayons X — bagage cabine de ${esc(c.x.first)}</b><img src="${cgXray(c)}" style="width:100%;border-radius:8px;margin-top:6px"><div class="small mut">Orange : matières organiques (vêtements, liquides) · bleu : métal · vert : mélange (électronique)</div></div>
      <div class="btns" style="${bar}"><button class="btn" data-act="cgBag" data-v="1">✅ Laisser passer</button><button class="btn" data-act="cgBag" data-v="0" style="background:#b45309">🔍 Fouiller</button></div>`;
  }
  if(el){ el.innerHTML=h; const sc=el.closest('.mbody'); if(sc) sc.scrollTop=0; } else showModal('🕵️ Poste de contrôle',`<div id="cgRoot">${h}</div>`,true);
}
function cgEnd(){
  const s=CG.s; if(!s.paid){ s.paid=true; const money=s.money; if(money) book(money>0?'annexes':'incidents',money); S.reputation=clamp((S.reputation||50)+s.rep,0,100);
    S.cgBest=Math.max(S.cgBest||0,s.pts); logMsg(`🕵️ Poste de contrôle ${s.fno} : ${s.ok} bonnes décisions, ${s.ko} erreurs (${s.pts} pts).`,'info'); try{ save(); }catch(e){} }
  const grade=s.ko===0?'🏆 Agent parfait !':s.ko<=2?'👍 Bon travail':'😬 À revoir';
  return `<div class="card" style="text-align:center"><div style="font-size:42px">${grade.split(' ')[0]}</div><b>${grade.slice(grade.indexOf(' ')+1)}</b><br>${s.ok} bonnes décisions · ${s.ko} erreurs · <b>${s.pts} points</b> (record : ${S.cgBest||s.pts})
    <div class="small" style="margin-top:6px">${s.log.map(t=>'• '+t).join('<br>')}</div><div class="small" style="margin-top:6px">Bilan : ${s.money>=0?'+':''}${fmtMoney(s.money)} · image ${s.rep>=0?'+':''}${s.rep.toFixed(2)}</div></div>
    <div class="btns"><button class="btn" data-act="cgStart">🔁 Un autre vol</button><button class="btn" data-act="closeModal">Fermer</button></div>`;
}
function cgStart(acId){
  const fl=S.fleet.filter(a=>a.status==='flight'&&a.flight&&a.flight.legs[a.flight.li]&&a.flight.legs[a.flight.li].pax);
  const pref=acId&&fl.find(a=>a.id===acId), dep=typeof pfDepartures==='function'?pfDepartures().map(x=>x.a):[];
  const ac=pref||dep[Math.floor(Math.random()*dep.length)]||fl.find(a=>{ const l=a.flight.legs[a.flight.li]; return AP(l.from).cc!==AP(l.to).cc; })||fl[Math.floor(Math.random()*fl.length)];
  if(!ac){ toast('Aucun vol avec des passagers en ce moment : envoyez un avion sur une ligne.','info'); return; }
  const k=cgCases(ac); if(!k){ toast('Pas de passagers sur ce vol (cargo).','info'); return; }
  CG.s={...k,i:0,step:'doc',ok:0,ko:0,pts:0,money:0,rep:0,log:[],fb:null,t0:performance.now()}; cgRender();
}
const cgGood=(s,t,pts,rep)=>{ s.ok++; s.pts+=pts; s.rep+=rep; s.fb={good:true,t}; };
const cgBad=(s,t,money,rep,logt)=>{ s.ko++; s.money+=money; s.rep+=rep; s.fb={good:false,t}; s.log.push(logt); };
Object.assign(ACTIONS,{
  cgStart:d=>cgStart(d&&d.id),
  cgDoc:d=>{ const s=CG.s; if(!s) return; const c=s.list[s.i], board=d.v==='1', fast=performance.now()-s.t0<12000;
    if(c.def&&!board){ cgGood(s,`✅ Bien vu ! ${CG_DEF[c.def]}. Refusé à l’embarquement : vous évitez une amende transporteur.`,fast?15:10,0.06); s.i++; s.step='doc'; }
    else if(c.def&&board){ cgBad(s,`❌ Raté : ${CG_DEF[c.def]}. Il sera refoulé à l’arrivée → amende transporteur et billet retour (−3 500 $).`,-3500,-0.12,`${c.x.first} ${c.x.last} : ${CG_DEF[c.def]} (laissé passer)`); s.i++; s.step='doc'; }
    else if(!c.def&&!board){ cgBad(s,`❌ Ce passager était en règle : refus abusif, indemnité de 600 $ et plainte.`,-600,-0.1,`${c.x.first} ${c.x.last} : refusé à tort`); s.i++; s.step='doc'; }
    else { cgGood(s,`✅ Documents en règle. Passage aux rayons X du bagage cabine…`,fast?10:6,0.02); s.step='xray'; }
    s.t0=performance.now(); cgRender(); },
  cgBag:d=>{ const s=CG.s; if(!s) return; const c=s.list[s.i], pass=d.v==='1';
    if(c.bad&&!pass) cgGood(s,`✅ Fouille : ${c.bad[1]} trouvé${/bouteille|arme/.test(c.bad[1])?'e':''} et confisqué${/bouteille|arme/.test(c.bad[1])?'e':''}.`,12,0.05);
    else if(c.bad&&pass) cgBad(s,`❌ Il y avait ${c.bad[1]} dans le sac ! Découvert à bord par l’équipage : incident de sûreté (−2 000 $).`,-2000,-0.2,`${c.x.first} ${c.x.last} : ${c.bad[1]} non vu`);
    else if(!c.bad&&!pass) cgBad(s,`❌ Fouille pour rien : rien d’interdit. Le passager a perdu 10 minutes, il râle.`,0,-0.03,`${c.x.first} ${c.x.last} : fouille inutile`);
    else cgGood(s,`✅ Rien d’interdit : bon voyage !`,8,0.02);
    s.i++; s.step='doc'; s.t0=performance.now(); cgRender(); },
});
function cgHook(){ if(cgHook.done) return; cgHook.done=true;
  // boutons : carte Aérogare (onglet Passagers) et fenêtre de départ d'un vol
  if(typeof pfCardHtml==='function'){ const _c=pfCardHtml; pfCardHtml=function(){ const h=_c.apply(this,arguments); return h+`<div class="card"><b>🕵️ Poste de contrôle</b> <span class="small mut">— jouez l’agent : documents à la porte puis rayons X${S.cgBest?' · record '+S.cgBest+' pts':''}</span><div class="btns"><button class="btn" data-act="cgStart">🎮 Jouer</button></div></div>`; }; }
  if(typeof pfHtml==='function'){ const _h=pfHtml; pfHtml=function(D,side,acId){ const h=_h.apply(this,arguments); return side==='dep'&&acId?`<div class="btns"><button class="btn sm" data-act="cgStart" data-id="${acId}">🕵️ Jouer l’agent de porte sur ce vol</button></div>`+h:h; }; }
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ cgHook(); }catch(e){ console.warn(e); } },0));
