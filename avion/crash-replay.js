/* =========================================================
   Sky Empire — 🎬 reconstitution d'accident au ralenti
   Touchez un accident (💥 🔥 ⚠️ sur la carte, onglet Accidents des
   actualités, ou fenêtre d'accident) : une vidéo reconstitue ce qui
   s'est passé, vue de côté, avec ralenti automatique aux instants
   clés, transcription du cockpit, altitude et vitesse, pompiers,
   évacuation… Scénarios : sortie de piste, feu moteur (chute ou retour
   réussi), orage et givrage (décrochage), fumée en cabine, atterrissage
   dur. C'est une reconstitution FICTIVE calculée par le jeu.
   ========================================================= */
'use strict';
const CR={on:false};
const crS=(a,b,t)=>{ const x=Math.max(0,Math.min(1,(t-a)/(b-a))); return x*x*(3-2*x); };
const crL=(a,b,u)=>a+(b-a)*u;
const crHash=s=>{ let h=7; for(const c of String(s)) h=(h*31+c.charCodeAt(0))%100003; return h; };
function crKind(c){ if(c.kind) return {excursion:'excursion',dur:'hard',fatal:'storm',evac:'smoke'}[c.kind]||c.kind; const h=crHash(c.id||c.t);
  return c.sev==='fatal'?(h%2?'engine':'storm'):c.sev==='hull'?'excursion':(h%2?'smoke':'engine_ok'); }

/* ---------- scénarios : vitesse (m/s), altitude (m), assiette (°) et événements ---------- */
function crScenario(kind,c){
  const V=c.victims||0, sev=c.sev, dead=sev==='fatal';
  const S_={kind,T:34,rain:false,night:false,sea:false,td:null,stop:null,impact:null,eng:null,slide:null,trucks:null,ice:null,smoke:null,collapse:null,bounce:null,slow:[],cap:[],lightning:[]};
  if(kind==='excursion'){ Object.assign(S_,{rain:true,td:10,stop:22,eng:20.5,slide:23,trucks:24.5,collapse:19,slow:[[9.4,11],[16.5,21.5]],
      spd:t=>t<10?75:t<17?crL(75,45,(t-10)/7):t<22?crL(45,0,crS(17,22,t)):0,
      alt:t=>t<10?220*Math.pow(1-t/10,1.3):(t>17&&t<21?0.7*Math.abs(Math.sin(t*9))*(21-t)/4:0),
      pit:t=>t<9?3:t<10?6:t<19?0:-4*crS(19,19.6,t),
      cap:[[0,'TWR : Piste mouillée, forte pluie, vent arrière 12 nœuds.'],[4,'CDB : Approche… on est un peu rapides.'],[8.5,'OPL : 50… 30… 10…'],[10.2,'⚠️ Toucher des roues 600 m trop loin, à 146 nœuds'],[13,'CDB : Freinage max ! Inverseurs !'],[15.5,'OPL : On ne va pas s’arrêter !'],[17.1,'💥 L’avion quitte le bout de la piste'],[19,'💥 Le train avant cède'],[20.8,'🔥 Le moteur prend feu'],[23,'CDB : ÉVACUATION ! ÉVACUATION !'],[25,'🚒 Les pompiers de l’aéroport arrivent'],[29,V?`${V} victime${V>1?'s':''}`:'✅ Tous les occupants sont sortis (blessés légers)']]}); }
  else if(kind==='hard'){ Object.assign(S_,{td:10,stop:21,trucks:20,bounce:11,slow:[[9.3,13]],
      spd:t=>t<10?72:t<21?crL(72,0,crS(10,21,t)):0,
      alt:t=>t<10?230*Math.pow(1-t/10,1.6):t<12?7*Math.sin((t-10)/2*Math.PI):0,
      pit:t=>t<9?2:t<10?1:t<12?5-2*(t-10):t<12.3?-3:-1.5,
      cap:[[0,'Approche par vent fort et rafales.'],[6,'⚠️ Rafale : l’avion s’enfonce'],[9.6,'OPL : Trop bas ! Trop vite !'],[10,'💥 Toucher très dur (3 g)'],[10.6,'L’avion rebondit…'],[12,'💥 Deuxième impact : le train est endommagé'],[15,'Les étincelles jaillissent sous le fuselage'],[21,'L’avion s’arrête. Pas de blessé grave.']]}); }
  else if(kind==='engine'||kind==='engine_ok'){ const ok=kind==='engine_ok';
    Object.assign(S_,{eng:6,trucks:ok?29:null,td:ok?26:null,stop:ok?31.5:null,impact:ok?null:27,slow:ok?[[5,8],[25.4,27]]:[[5,8],[25.4,29]],
      spd:t=>ok?(t<22?110:t<26?crL(110,75,crS(22,26,t)):crL(75,0,crS(26,31.5,t))):(t<22?115:crL(115,140,(t-22)/5)),
      alt:t=>ok?(t<6?1800+t*20:t<22?crL(1920,350,crS(8,22,t)):t<26?350*Math.pow(1-(t-22)/4,1.5):0):(t<6?2300+t*15:t<22?crL(2390,1500,crS(12,22,t)):Math.max(0,1500*Math.pow(1-(t-22)/5,1.4))),
      pit:t=>ok?(t<6?8:t<22?2:t<25.5?3:t<26?6:0):(t<6?8:t<16?2:t<22?-6:-24),
      cap:ok?[[0,'Montée initiale après le décollage.'],[5.6,'💥 BANG — le moteur 2 explose'],[7,'⚠️ ALARME FEU MOTEUR 2'],[8.5,'CDB : Mayday, mayday, feu moteur, on revient.'],[12,'OPL : Extincteur 1… extincteur 2… le feu est éteint !'],[18,'Retour vers l’aéroport sur un seul moteur'],[26,'Atterrissage d’urgence'],[29,'🚒 Les pompiers arrosent le moteur'],[31.5,'✅ Aucun blessé']]
        :[[0,'Montée vers l’altitude de croisière.'],[5.6,'💥 BANG — le moteur 2 explose'],[7,'⚠️ ALARME FEU MOTEUR 2'],[8.5,'CDB : Mayday, mayday, feu moteur, on fait demi-tour.'],[12,'OPL : Extincteur 1… extincteur 2… le feu ne s’éteint pas !'],[16,'🔥 Le feu gagne l’aile'],[20,'⚠️ Perte de contrôle'],[23.5,'TERRAIN — PULL UP — PULL UP'],[27,'💥 Impact'],[30,V?`${V} victime${V>1?'s':''}`:'Aucun survivant']]}); }
  else if(kind==='storm'){ const sea=crHash(c.id||'')%2===0;
    Object.assign(S_,{night:true,rain:true,sea,ice:4,impact:30,slow:[[16,20],[28.5,31]],lightning:[2.2,5.1,9.4,13.7,17.2,22.5,26.1],
      spd:t=>t<14?115:t<19?crL(115,70,crS(14,19,t)):crL(70,120,crS(19,30,t)),
      alt:t=>t<19?2900+Math.sin(t*2.3)*25:Math.max(0,2900*(1-Math.pow((t-19)/11,1.7))),
      pit:t=>t<14?2:t<18?crL(2,16,crS(14,18,t)):t<20?crL(16,-30,crS(18,20,t)):-30+Math.sin(t*3)*5,
      cap:[[0,'Croisière de nuit dans une zone orageuse.'],[3,'⚡ Turbulences sévères'],[6,'❄️ Les sondes de vitesse givrent : vitesse affichée fausse'],[10,'OPL : Pilote automatique déconnecté… on perd la vitesse.'],[14,'CDB : Je cabre…'],[17,'⚠️ STALL — STALL — DÉCROCHAGE'],[20,'L’avion chute de 3 000 mètres'],[26,'TERRAIN — PULL UP'],[30,sea?'💥 Impact dans la mer':'💥 Impact dans la forêt'],[32,V?`${V} victime${V>1?'s':''}`:'Aucun survivant']]}); }
  else { // fumée en cabine
    Object.assign(S_,{smoke:3,td:22,stop:28,slide:28.6,trucks:28,slow:[[21.4,23.2],[28.4,30]],
      spd:t=>t<8?120:t<22?crL(120,75,crS(8,22,t)):crL(75,0,crS(22,28,t)),
      alt:t=>t<8?2800:t<22?2800*Math.pow(1-crS(8,22,t),1.1):0,
      pit:t=>t<8?1:t<21?-3:t<22?5:0,
      cap:[[0,'Croisière normale.'],[3,'🔥 Odeur de brûlé, puis fumée en cabine (batterie)'],[6,'CDB : Mayday, fumée en cabine, déroutement immédiat !'],[10,'PNC : Masques à oxygène ! Restez assis !'],[16,'Descente d’urgence vers l’aéroport le plus proche'],[22,'Atterrissage d’urgence'],[28.6,'CDB : Évacuation par les toboggans !'],[31.5,V?`${V} victime${V>1?'s':''}`:'✅ Tout le monde est sorti, quelques blessés légers']]}); }
  S_.night=S_.night||(crHash(c.id||'n')%3===0);
  // position le long du sol : intégration de la vitesse
  const dt=0.05, n=Math.ceil(S_.T/dt)+2, X=new Float32Array(n); for(let i=1;i<n;i++) X[i]=X[i-1]+S_.spd((i-1)*dt)*dt;
  S_.X=t=>{ const f=Math.max(0,Math.min(n-1.001,t/dt)), i=f|0; return X[i]+(X[i+1]-X[i])*(f-i); };
  if(S_.td!=null){ const xt=S_.X(S_.td); S_.rw=kind==='excursion'?[xt-700,S_.X(17)]:[xt-350,xt+3200]; }
  return S_;
}

/* ---------- ouverture ---------- */
function crashReplay(id){
  const c=(S.ai&&S.ai.crashes||[]).find(x=>x.id===id||String(x.t)===String(id)); if(!c) return toast&&toast('Accident introuvable','bad');
  const kind=crKind(c), sc=crScenario(kind,c), e=c.mine?null:aiBy(c.code), col=c.mine?(S.company.color||'#ffd60a'):(e&&e.color)||(typeof airlineColor==='function'?airlineColor(c.code):'#64748b');
  const big=/A38|747|777|A35|787|A33|A34|767/.test(c.model||''), L=big?62:38;
  crClose(); Object.assign(CR,{on:true,c,sc,col,L,t:0,spd:0.5,auto:true,play:true,parts:[],last:performance.now(),seek:true});
  const ov=document.createElement('div'); ov.id='crOv'; ov.style.cssText='position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;touch-action:none';
  ov.innerHTML=`<canvas id="crCv" style="flex:1;width:100%;display:block"></canvas>
    <div style="display:flex;gap:6px;align-items:center;padding:8px 10px calc(8px + env(safe-area-inset-bottom));background:#0b1220;color:#fff;font:600 13px system-ui;flex-wrap:wrap">
      <button id="crPlay" class="btn sm">⏸️</button><input id="crSeek" type="range" min="0" max="${sc.T}" step="0.05" value="0" style="flex:1;min-width:120px">
      <button class="btn sm crSp" data-v="1">×1</button><button class="btn sm crSp gold" data-v="0.5">×0,5</button><button class="btn sm crSp" data-v="0.25">×0,25</button>
      <button id="crAuto" class="btn sm gold">🐢 ralenti auto</button><button id="crX" class="btn sm">✖</button></div>`;
  document.body.appendChild(ov);
  const cv=ov.querySelector('#crCv'), fit=()=>{ const r=cv.getBoundingClientRect(), d=Math.min(2,window.devicePixelRatio||1); cv.width=r.width*d; cv.height=r.height*d; CR.dpr=d; }; fit(); CR.fit=fit; window.addEventListener('resize',fit);
  ov.querySelector('#crX').onclick=crClose;
  ov.querySelector('#crPlay').onclick=()=>{ if(CR.t>=sc.T){ CR.t=0; CR.seek=true; } CR.play=!CR.play; ov.querySelector('#crPlay').textContent=CR.play?'⏸️':'▶️'; };
  ov.querySelector('#crSeek').oninput=ev=>{ CR.t=+ev.target.value; CR.seek=true; };
  ov.querySelector('#crAuto').onclick=ev=>{ CR.auto=!CR.auto; ev.target.classList.toggle('gold',CR.auto); };
  ov.querySelectorAll('.crSp').forEach(b=>b.onclick=()=>{ CR.spd=+b.dataset.v; ov.querySelectorAll('.crSp').forEach(x=>x.classList.toggle('gold',x===b)); });
  if(typeof S!=='undefined'&&S){ CR.wasPaused=S.paused; S.paused=true; }
  requestAnimationFrame(crFrame);
}
function crClose(){ const o=document.getElementById('crOv'); if(o) o.remove(); if(CR.fit) window.removeEventListener('resize',CR.fit); if(CR.on&&typeof S!=='undefined'&&S) S.paused=!!CR.wasPaused; CR.on=false; }

/* ---------- boucle ---------- */
function crFrame(now){
  if(!CR.on) return; requestAnimationFrame(crFrame);
  const sc=CR.sc, dtR=Math.min(0.05,(now-CR.last)/1000); CR.last=now;
  const slow=CR.auto&&sc.slow.some(([a,b])=>CR.t>=a&&CR.t<=b); CR.slow=slow;
  if(CR.play&&CR.t<sc.T){ const d=dtR*CR.spd*(slow?0.3:1); CR.t=Math.min(sc.T,CR.t+d); crStep(d); if(CR.t>=sc.T){ CR.play=false; const b=document.getElementById('crPlay'); if(b) b.textContent='🔁'; } }
  if(CR.seek){ CR.parts=[]; CR.seek=false; CR.boomDone=!!(sc.impact!=null&&CR.t>sc.impact+1); for(let i=0;i<40;i++) crStep(0.03); }
  const sk=document.getElementById('crSeek'); if(sk&&document.activeElement!==sk) sk.value=CR.t;
  crDraw();
}
// état de l'avion à l'instant t
function crState(t){ const sc=CR.sc; return {x:sc.X(t), alt:Math.max(0,sc.alt(t)), pit:sc.pit(t), v:sc.spd(t)}; }
const crRot=(p,dx,dy)=>{ const a=-p.pit*Math.PI/180; return {x:p.x+dx*Math.cos(a)-dy*Math.sin(a), y:p.alt+dx*Math.sin(a)+dy*Math.cos(a)}; };
// particules : feu, fumée, étincelles, débris, eau, pluie de verre…
function crEmit(type,x,y,n,o){ for(let i=0;i<n;i++) CR.parts.push({type,x:x+(Math.random()-0.5)*(o&&o.r||2),y:y+(Math.random()-0.5)*(o&&o.r||2),vx:(o&&o.vx||0)+(Math.random()-0.5)*(o&&o.sv||4),vy:(o&&o.vy||0)+(Math.random()-0.5)*(o&&o.sv||4)+(o&&o.up||0),life:0,max:(o&&o.max||1.5)*(0.6+Math.random()*0.8),s:(o&&o.s||2)*(0.6+Math.random()*0.8)}); }
function crStep(d){
  const sc=CR.sc, t=CR.t, p=crState(t), L=CR.L, alive=sc.impact==null||t<sc.impact;
  if(alive){
    const engOn=sc.eng!=null&&t>=sc.eng&&!(sc.kind==='engine_ok'&&t>12.5&&t<29), E=crRot(p,-L*0.05,-L*0.06), k=d*60;
    if(engOn){ crEmit('fire',E.x,E.y,Math.ceil(2*k),{r:2,vx:-p.v*0.15,sv:3,up:2,max:0.5,s:3+(t>16&&sc.kind==='engine'?3:0)}); crEmit('smoke',E.x,E.y,Math.ceil(1*k),{r:2,vx:-p.v*0.6,sv:2,up:1,max:3,s:6}); }
    if(sc.kind==='engine_ok'&&t>12.5&&t<26) crEmit('smoke',E.x,E.y,1,{r:1,vx:-p.v*0.6,sv:1,up:0.5,max:1.5,s:3});
    if(sc.kind==='engine'&&t>16){ const W=crRot(p,-L*0.1,-L*0.02); crEmit('fire',W.x,W.y,Math.ceil(3*k),{r:L*0.25,vx:-p.v*0.2,sv:4,up:2,max:0.5,s:5}); }
    if(sc.eng!=null&&t>=sc.eng&&t<sc.eng+0.15) crEmit('debris',E.x,E.y,25,{r:2,vx:-p.v*0.3,sv:40,up:10,max:3,s:1.5});
    if(sc.smoke!=null&&t>=sc.smoke&&(sc.stop==null||t<sc.stop+3)){ const Q=crRot(p,(Math.random()-0.3)*L*0.6,L*0.03); crEmit('smoke',Q.x,Q.y,Math.ceil(k),{r:1,vx:-p.v*0.5,sv:1,up:0.4,max:2.5,s:3}); }
    if(p.alt<0.5&&p.v>8&&sc.td!=null&&t>=sc.td){ const G=crRot(p,L*0.05,-L*0.08); const off=sc.rw&&(p.x>sc.rw[1]);
      if(t<sc.td+0.6) crEmit('tire',G.x-L*0.1,0.5,Math.ceil(3*k),{r:1,vx:-p.v*0.2,sv:2,up:1,max:1.6,s:4});
      if(off||(sc.collapse!=null&&t>sc.collapse)||(sc.bounce!=null&&t>12)) crEmit(off?'dirt':'spark',G.x+(sc.collapse&&t>sc.collapse?L*0.4:0),0.3,Math.ceil(3*k),{r:2,vx:-p.v*0.3,sv:8,up:6,max:off?1.2:0.5,s:off?3:1.2}); }
    if(sc.ice!=null&&t>sc.ice&&t<20&&Math.random()<0.3*k){ const I=crRot(p,0,L*0.02); crEmit('ice',I.x,I.y,1,{r:L*0.4,vx:-p.v*0.1,sv:1,max:0.6,s:1}); }
  } else {
    // impact : boule de feu, débris, colonne de fumée
    const x0=sc.X(sc.impact);
    if(!CR.boomDone){ { CR.boomDone=true; crEmit('fire',x0,6,140,{r:30,vx:20,sv:60,up:25,max:1.6,s:14}); crEmit('debris',x0,4,80,{r:8,vx:40,sv:90,up:40,max:4,s:3}); if(sc.sea) crEmit('water',x0,1,120,{r:10,vx:10,sv:50,up:60,max:2.2,s:3}); } }
    crEmit('fire',x0+(Math.random()-0.5)*60,1,Math.ceil(2*d*60),{r:8,sv:4,up:6,max:0.8,s:8}); crEmit('smoke',x0+(Math.random()-0.5)*50,4,Math.ceil(d*60),{r:10,vx:6,sv:3,up:10,max:6,s:16});
  }
  if(sc.trucks!=null&&t>sc.trucks+3){ const F=sc.stop!=null?sc.X(sc.stop):p.x; crEmit('water',F+L*0.9,12,Math.ceil(d*40),{r:1,vx:-28,sv:3,up:14,max:1.3,s:1.6}); }
  for(const q of CR.parts){ q.life+=d; q.x+=q.vx*d; q.y+=q.vy*d; if(q.type==='debris'||q.type==='spark'||q.type==='dirt'||q.type==='water'){ q.vy-=25*d; if(q.y<0){ q.y=0; q.vy*=-0.25; q.vx*=0.6; } } else if(q.type==='smoke'){ q.vy+=1.5*d; q.vx*=0.995; q.s+=d*3.5; } else if(q.type==='fire'){ q.vy+=4*d; } }
  CR.parts=CR.parts.filter(q=>q.life<q.max); if(CR.parts.length>1400) CR.parts.splice(0,CR.parts.length-1400);
}

/* ---------- dessin ---------- */
function crDraw(){
  const cv=document.getElementById('crCv'); if(!cv) return; const g=cv.getContext('2d'), d=CR.dpr||1, W=cv.width/d, H=cv.height/d; g.setTransform(d,0,0,d,0,0);
  const sc=CR.sc, t=CR.t, p=crState(t), L=CR.L, alive=sc.impact==null||t<sc.impact, ix=sc.impact!=null?sc.X(sc.impact):0;
  let z=Math.min(W/(L*(W<H?2.6:5)),H/(L*3)); if(CR.slow) z*=1.25;
  const camX=(alive?p.x:ix)+W*0.05/z, camY=Math.max(alive?p.alt:0,0.17*H/z);
  let shx=0, shy=0; const shake=(sc.impact!=null&&t>sc.impact&&t<sc.impact+1.5?8*(1-(t-sc.impact)/1.5):0)+(sc.kind==='storm'&&t<19?2:0)+(sc.collapse!=null&&t>17&&t<22?2.5:0)+(sc.bounce!=null&&t>10&&t<12.5?3:0);
  if(shake){ shx=(Math.random()-0.5)*shake; shy=(Math.random()-0.5)*shake; }
  const SX=x=>W/2+(x-camX)*z+shx, SY=y=>H/2-(y-camY)*z+shy, gY=SY(0);
  // ciel
  const night=sc.night, sky=g.createLinearGradient(0,0,0,H); if(night){ sky.addColorStop(0,'#020617'); sky.addColorStop(1,sc.kind==='storm'?'#1e293b':'#172554'); } else { sky.addColorStop(0,sc.rain?'#64748b':'#2563eb'); sky.addColorStop(1,sc.rain?'#94a3b8':'#bae6fd'); }
  g.fillStyle=sky; g.fillRect(0,0,W,H);
  if(night&&!sc.rain){ g.fillStyle='#fff'; for(let i=0;i<60;i++){ const sx=((i*97+13)%W), sy=((i*53+7)%(H*0.6)); g.fillRect(sx,sy,1,1); } }
  // nuages en parallaxe
  for(let i=0;i<9;i++){ const px=((i*331-camX*z*0.15)%(W+300)+W+300)%(W+300)-150, py=40+(i*71)%(H*0.45)+(-camY*z*0.08)%60; g.fillStyle=night?'rgba(51,65,85,0.55)':sc.rain?'rgba(100,116,139,0.6)':'rgba(255,255,255,0.75)'; g.beginPath(); for(let k=0;k<4;k++) g.arc(px+k*26,py+(k%2)*6,22+(k%3)*6,0,7); g.fill(); }
  // éclairs
  const flash=sc.lightning.some(x=>t>x&&t<x+0.12); if(flash){ g.fillStyle='rgba(255,255,255,0.55)'; g.fillRect(0,0,W,H); g.strokeStyle='#fff'; g.lineWidth=2; g.beginPath(); let lx=W*0.3+crHash(Math.floor(t))%200, ly=0; g.moveTo(lx,ly); while(ly<H*0.6){ lx+=(Math.random()-0.5)*40; ly+=30; g.lineTo(lx,ly); } g.stroke(); }
  // relief lointain, sol, mer
  if(gY<H+40){
    g.fillStyle=night?'#0f172a':'#64748b'; g.beginPath(); g.moveTo(0,gY); for(let x=0;x<=W;x+=20){ const wx=(x-W/2)/z*0.3+camX*0.3; g.lineTo(x,gY-30-18*Math.sin(wx*0.004)-12*Math.sin(wx*0.011)); } g.lineTo(W,gY); g.fill();
    if(sc.sea&&sc.kind==='storm'){ g.fillStyle=night?'#082f49':'#0369a1'; g.fillRect(0,gY,W,H-gY); g.strokeStyle='rgba(255,255,255,0.25)'; for(let i=0;i<20;i++){ const yy=gY+6+i*9, o=(t*40+i*37)%40; g.beginPath(); for(let x=-o;x<W;x+=40){ g.moveTo(x,yy); g.quadraticCurveTo(x+10,yy-3,x+20,yy); } g.stroke(); } }
    else { g.fillStyle=night?'#14532d':'#4d7c0f'; g.fillRect(0,gY,W,H-gY); if(!sc.td){ for(let i=0;i<40;i++){ const wx=Math.floor((camX-W/z)/30)*30+i*30, x=SX(wx); g.fillStyle=night?'#052e16':'#166534'; g.beginPath(); g.arc(x,gY-6,7+(crHash(wx)%5),0,7); g.fill(); } } }
    if(sc.rw){ const a=SX(sc.rw[0]), b=SX(sc.rw[1]); g.fillStyle='#374151'; g.fillRect(a,gY-1,b-a,6); g.fillStyle='#e5e7eb'; for(let x=sc.rw[0];x<sc.rw[1];x+=60){ const sx=SX(x); if(sx>-20&&sx<W+20) g.fillRect(sx,gY+1,14*z/1.5,1.5); }
      g.fillStyle='#ef4444'; for(let k=0;k<6;k++) g.fillRect(b+k*3,gY-3,2,2); g.fillStyle='#22c55e'; for(let k=0;k<6;k++) g.fillRect(a-k*3,gY-3,2,2);
      // aérogare et tour au loin
      g.fillStyle=night?'#1e293b':'#cbd5e1'; g.fillRect(SX(sc.rw[0]+900),gY-26,160*z/3,20); g.fillRect(SX(sc.rw[0]+1300),gY-60,8,54); g.fillRect(SX(sc.rw[0]+1300)-6,gY-70,20,12);
      if(sc.kind==='excursion'){ g.strokeStyle='#a3a3a3'; g.beginPath(); for(let k=0;k<12;k++){ const fx=SX(sc.rw[1]+120+k*6); g.moveTo(fx,gY); g.lineTo(fx,gY-8); } g.stroke(); } }
  }
  // pompiers et ambulances
  if(sc.trucks!=null&&t>sc.trucks){ const F=sc.stop!=null?sc.X(sc.stop):p.x, u=crS(sc.trucks,sc.trucks+4,t);
    for(let k=0;k<2;k++){ const tx=SX(F+L*(1.6+k*0.7)+(1-u)*400), ty=gY-2; g.fillStyle='#dc2626'; g.fillRect(tx-14,ty-12,28,10); g.fillRect(tx-20,ty-9,7,7); g.fillStyle='#111'; g.beginPath(); g.arc(tx-12,ty-1,3,0,7); g.arc(tx+10,ty-1,3,0,7); g.fill();
      g.fillStyle=Math.floor(t*6+k)%2?'#3b82f6':'#ef4444'; g.fillRect(tx-6,ty-15,10,3); } }
  // l'avion (ou l'épave)
  if(alive) crPlane(g,SX(p.x),SY(p.alt),p.pit,L*z,{col:CR.col,gear:p.alt<300,ice:sc.ice!=null&&t>sc.ice+2&&t<22,collapse:sc.collapse!=null&&t>sc.collapse,night});
  else { g.fillStyle='#1f2937'; for(let k=0;k<7;k++){ const wx=ix+(k-3)*L*0.5+crHash(k)%20; g.save(); g.translate(SX(wx),gY-3); g.rotate((crHash(k*7)%60-30)*Math.PI/180); g.fillRect(-L*z*0.08,-3,L*z*0.16,6); g.restore(); } }
  // évacuation : toboggans et passagers qui s'éloignent
  if(sc.slide!=null&&t>sc.slide&&alive){ const F=crRot(p,L*0.32,-L*0.03); g.strokeStyle='#facc15'; g.lineWidth=3; g.beginPath(); g.moveTo(SX(F.x),SY(F.y)); g.lineTo(SX(F.x+6),gY); g.stroke();
    const n=Math.min(24,Math.floor((t-sc.slide)*3)); for(let i=0;i<n;i++){ const age=t-sc.slide-i/3, dir=i%2?1:-0.4, px=SX(F.x+6+dir*age*4+(i%5)), py=gY-1; g.fillStyle=['#f8fafc','#dc2626','#2563eb','#facc15','#16a34a'][i%5]; g.fillRect(px-1.5,py-7,3,5); g.fillStyle='#7a4a2a'; g.beginPath(); g.arc(px,py-9,1.8,0,7); g.fill(); g.strokeStyle='#111827'; g.lineWidth=1; const st=Math.sin(age*14)*2; g.beginPath(); g.moveTo(px,py-2); g.lineTo(px-st,py+1); g.moveTo(px,py-2); g.lineTo(px+st,py+1); g.stroke(); } }
  // particules
  for(const q of CR.parts){ const x=SX(q.x), y=SY(q.y), a=1-q.life/q.max; if(x<-60||x>W+60||y<-60||y>H+60) continue;
    if(q.type==='smoke'){ g.fillStyle=`rgba(${sc.kind==='smoke'?'150,150,160':'55,55,60'},${0.16*a})`; g.beginPath(); g.arc(x,y,q.s*z*0.42+2,0,7); g.fill(); }
    else if(q.type==='fire'){ g.globalCompositeOperation='lighter'; g.fillStyle=`rgba(255,${70+Math.floor(150*a)},${Math.floor(40*a)},${0.5*a})`; g.beginPath(); g.arc(x,y,q.s*z*0.32*(0.4+a)+1,0,7); g.fill(); g.globalCompositeOperation='source-over'; }
    else if(q.type==='spark'){ g.fillStyle=`rgba(255,220,120,${a})`; g.fillRect(x,y,2,2); }
    else if(q.type==='dirt'){ g.fillStyle=`rgba(101,67,33,${a})`; g.fillRect(x,y,3,3); }
    else if(q.type==='debris'){ g.fillStyle='#374151'; g.fillRect(x,y,3,2); }
    else if(q.type==='water'){ g.fillStyle=`rgba(186,230,253,${0.8*a})`; g.fillRect(x,y,2,2); }
    else if(q.type==='tire'){ g.fillStyle=`rgba(200,200,200,${0.5*a})`; g.beginPath(); g.arc(x,y,4+q.life*8,0,7); g.fill(); }
    else if(q.type==='ice'){ g.fillStyle=`rgba(224,242,254,${a})`; g.fillRect(x,y,2,2); } }
  // pluie
  if(sc.rain){ g.strokeStyle='rgba(203,213,225,0.45)'; g.lineWidth=1; g.beginPath(); for(let i=0;i<140;i++){ const rx=(i*73+t*900)%W, ry=(i*131+t*1400)%H; g.moveTo(rx,ry); g.lineTo(rx-4,ry+12); } g.stroke(); }
  // flash de l'explosion
  if(sc.impact!=null&&t>sc.impact&&t<sc.impact+0.3){ g.fillStyle=`rgba(255,200,120,${0.7*(1-(t-sc.impact)/0.3)})`; g.fillRect(0,0,W,H); }
  if(sc.eng!=null&&t>sc.eng&&t<sc.eng+0.12){ g.fillStyle='rgba(255,230,180,0.5)'; g.fillRect(0,0,W,H); }
  // vignette
  const vg=g.createRadialGradient(W/2,H/2,Math.min(W,H)*0.35,W/2,H/2,Math.max(W,H)*0.75); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.55)'); g.fillStyle=vg; g.fillRect(0,0,W,H);
  crHud(g,W,H,p,alive);
}
// avion vu de côté, nez vers la droite
function crPlane(g,x,y,pit,len,o){
  g.save(); g.translate(x,y); g.rotate(-pit*Math.PI/180); const s=len/40;
  g.scale(s,s);
  // train
  if(o.gear){ g.strokeStyle='#374151'; g.lineWidth=1.2; g.beginPath(); g.moveTo(2,1.5); g.lineTo(2,4); if(!o.collapse){ g.moveTo(15,1.2); g.lineTo(15,4); } g.stroke(); g.fillStyle='#111'; g.beginPath(); g.arc(2,4.3,1.1,0,7); g.arc(3.8,4.3,1.1,0,7); if(!o.collapse) g.arc(15,4.3,0.9,0,7); g.fill(); }
  // dérive (couleur de la compagnie)
  g.fillStyle=o.col; g.beginPath(); g.moveTo(-16,-1.5); g.lineTo(-20,-9); g.lineTo(-16.5,-9); g.lineTo(-11,-1.5); g.fill();
  // fuselage
  const fg=g.createLinearGradient(0,-2.5,0,2.5); fg.addColorStop(0,o.night?'#cbd5e1':'#ffffff'); fg.addColorStop(1,o.night?'#64748b':'#cbd5e1'); g.fillStyle=fg;
  g.beginPath(); g.moveTo(-20,-1.6); g.lineTo(14,-2.4); g.quadraticCurveTo(20,-2.2,20.5,0.2); g.quadraticCurveTo(19.5,2.3,14,2.4); g.lineTo(-14,2.2); g.quadraticCurveTo(-18,1.8,-20,-0.2); g.closePath(); g.fill();
  g.fillStyle=o.col; g.fillRect(-14,0.6,28,0.7);   // liseré
  g.fillStyle='#0f172a'; for(let i=-12;i<13;i+=1.6) g.fillRect(i,-1.1,0.7,0.8);   // hublots
  g.beginPath(); g.moveTo(17.6,-1.4); g.lineTo(19.6,-0.9); g.lineTo(19.3,-0.3); g.lineTo(17.4,-0.6); g.fill();  // cockpit
  // aile et moteur
  g.fillStyle=o.ice?'#e0f2fe':'#94a3b8'; g.beginPath(); g.moveTo(-4,0.6); g.lineTo(6,0.4); g.lineTo(-6,2.6); g.closePath(); g.fill();
  g.fillStyle='#475569'; g.beginPath(); g.ellipse(-1.5,2.4,3.2,1.1,0,0,7); g.fill(); g.fillStyle='#1f2937'; g.fillRect(1.4,1.6,0.5,1.6);
  if(o.ice){ g.fillStyle='rgba(255,255,255,0.8)'; g.fillRect(17,-2.3,2,0.6); }
  // feux de navigation
  if(o.night){ g.fillStyle=Math.floor(performance.now()/500)%2?'#ef4444':'#fff'; g.beginPath(); g.arc(-19.5,-8.8,0.5,0,7); g.fill(); }
  g.restore();
}
function crHud(g,W,H,p,alive){
  const sc=CR.sc, c=CR.c, t=CR.t, mm=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  g.font='700 12px system-ui'; g.fillStyle='rgba(0,0,0,0.5)'; g.fillRect(8,8,W-16,46);
  g.fillStyle='#ef4444'; if(Math.floor(performance.now()/600)%2) { g.beginPath(); g.arc(18,20,4,0,7); g.fill(); }
  g.fillStyle='#fff'; g.fillText(`RECONSTITUTION · ${c.name} · ${c.model}`,28,24);
  g.font='600 11px system-ui'; g.fillStyle='#cbd5e1'; g.fillText(`${keyCity(c.a)} → ${keyCity(c.b)} · ${typeof fmtDate==='function'?fmtDate(c.t):''} · T+${mm(t)}`,28,42);
  // instruments
  g.fillStyle='rgba(0,0,0,0.5)'; g.fillRect(8,60,112,46); g.fillStyle='#4ade80'; g.font='700 12px ui-monospace,monospace';
  g.fillText(`ALT ${alive?Math.round(p.alt*3.28).toLocaleString('fr-FR'):'0'} ft`,14,78); g.fillText(`VIT ${alive?Math.round(p.v*1.944):0} kt`,14,96);
  if(CR.slow||CR.spd<1){ g.fillStyle='#facc15'; g.font='800 13px system-ui'; g.fillText(`🐢 RALENTI ×${String(+(CR.spd*(CR.slow?0.3:1)).toFixed(2)).replace('.',',')}`,W-150,78); }
  // sous-titres (transcription du cockpit)
  const cap=sc.cap.filter(x=>x[0]<=t).pop(); if(cap&&t-cap[0]<5){ g.font='700 15px system-ui'; const txt=cap[1], words=txt.split(' '), lines=[]; let cur=''; for(const w of words){ const tr=cur?cur+' '+w:w; if(g.measureText(tr).width>W-50){ lines.push(cur); cur=w; } else cur=tr; } lines.push(cur);
    const bh=lines.length*20+14, by=H-bh-16; g.fillStyle='rgba(0,0,0,0.65)'; g.fillRect(14,by,W-28,bh); g.fillStyle=/💥|⚠️|STALL|PULL UP|🔥/.test(txt)?'#fca5a5':'#fff'; lines.forEach((l,i)=>g.fillText(l,24,by+22+i*20)); }
  // carton d'ouverture et bilan
  if(t<2.5){ g.fillStyle=`rgba(0,0,0,${0.75*(1-crS(1.8,2.5,t))})`; g.fillRect(0,0,W,H); g.fillStyle='#fff'; g.font='800 20px system-ui'; g.textAlign='center'; g.fillText(c.sev==='fatal'?'💥 Accident mortel':c.sev==='hull'?'🔥 Avion détruit':'⚠️ Incident',W/2,H/2-14); g.font='600 14px system-ui'; g.fillText(`${c.name} · ${c.model}`,W/2,H/2+12); g.fillText('Reconstitution fictive — ralenti',W/2,H/2+34); g.textAlign='left'; }
  if(t>=sc.T-0.01){ g.fillStyle='rgba(2,6,23,0.85)'; g.fillRect(16,H*0.22,W-32,H*0.42); g.fillStyle='#fff'; g.font='800 16px system-ui'; g.fillText('📋 Rapport d’enquête (fictif)',28,H*0.22+30);
    g.font='600 13px system-ui'; const cause={excursion:'Atterrissage long et trop rapide sur piste mouillée, freinage insuffisant.',hard:'Rafale de vent en courte finale, toucher trop dur et rebond.',engine:'Rupture d’une aube de turbine, feu moteur non maîtrisé.',engine_ok:'Rupture d’une aube de turbine ; feu éteint, équipage exemplaire.',storm:'Givrage des sondes de vitesse en zone orageuse, décrochage.',smoke:'Emballement thermique d’une batterie en soute.'}[sc.kind];
    const lines=[`Compagnie : ${c.name}`,`Avion : ${c.model}`,`Vol : ${keyCity(c.a)} → ${keyCity(c.b)}`,`Bilan : ${c.victims?c.victims+' victimes':'aucune victime'}`,`Cause probable : ${cause}`];
    let y=H*0.22+56; for(const l of lines){ const ws=l.split(' '); let cur=''; for(const w of ws){ const tr=cur?cur+' '+w:w; if(g.measureText(tr).width>W-60){ g.fillText(cur,28,y); y+=18; cur=w; } else cur=tr; } g.fillText(cur,28,y); y+=22; } }
}

/* ---------- accès : carte, actualités, fenêtre d'accident ---------- */
function crHook(){ if(crHook.done) return; crHook.done=true;
  Object.assign(ACTIONS,{ crashReplay:d=>{ try{ closeModal(); }catch(e){} crashReplay(d.id); } });
  window.crashReplay=crashReplay;
  // carte 2D : bouton dans la bulle de chaque accident
  if(typeof crashSync==='function'){ const _cs=crashSync; crashSync=function(){ _cs(); try{ if(crashSync.layer) crashSync.layer.eachLayer(mk=>{ const pp=mk.getPopup&&mk.getPopup(); if(!pp||mk._cr) return; const ll=mk.getLatLng(), c=(S.ai.crashes||[]).find(x=>x.lat!==undefined&&Math.abs(x.lat-ll.lat)<1e-3&&Math.abs(x.lon-ll.lng)<1e-3); if(!c||!c.id) return;
        mk._cr=true; pp.setContent(pp.getContent()+`<br><button class="btn sm gold" style="margin-top:6px" onclick="crashReplay('${c.id}')">▶️ Revoir au ralenti</button>`); }); }catch(e){ console.warn(e); } }; crashSync.layer=_cs.layer; try{ crashSync(); }catch(e){} }
  // actualités → 💥 Accidents : liste à revoir
  if(typeof pNews==='function'){ const _pn=pNews; pNews=function(){ const h=_pn(); if(UI.newsTab!=='crash') return h; const L=(S.ai&&S.ai.crashes||[]).filter(c=>c.id).slice(0,15);
      if(!L.length) return h; const list=`<h3>🎬 Revoir les accidents au ralenti</h3>${L.map(c=>`<div class="row small" style="justify-content:space-between;gap:6px;padding:4px 0;border-bottom:1px solid #ffffff14"><span>${c.sev==='fatal'?'💥':c.sev==='hull'?'🔥':'⚠️'} ${typeof fmtDate==='function'?fmtDate(c.t):''} · <b>${esc(c.name)}</b> · ${esc(c.model)} · ${esc(keyCity(c.a))} → ${esc(keyCity(c.b))}</span><button class="btn sm gold" data-act="crashReplay" data-id="${c.id}">▶️</button></div>`).join('')}`;
      const i=h.indexOf('<div class="simplehelp">Tous les accidents'); return i<0?h+list:h.slice(0,i)+list+h.slice(i); }; }
  // votre propre accident : la fenêtre propose la reconstitution
  if(typeof playerAccident==='function'){ const _pa=playerAccident; playerAccident=function(ac,leg,m,pax){ const n=(S.ai&&S.ai.crashes||[]).length; _pa(ac,leg,m,pax);
      const c=S.ai&&S.ai.crashes&&S.ai.crashes[0]; if(c&&(S.ai.crashes.length>n||c.t===S.time)&&c.mine){ c.kind=c.kind||crGuessPlayerKind(c);
        if(typeof UI!=='undefined'&&!UI.silent){ const m2=document.querySelector('#modal .mbody'); if(m2) m2.insertAdjacentHTML('beforeend',`<div class="btns"><button class="btn gold" data-act="crashReplay" data-id="${c.id}">▶️ Revoir l’accident au ralenti</button></div>`); } } }; }
}
function crGuessPlayerKind(c){ return c.sev==='fatal'?'fatal':c.sev==='hull'?'excursion':'evac'; }
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ crHook(); }catch(e){ console.warn(e); } },0));
