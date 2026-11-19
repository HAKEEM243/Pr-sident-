/* =========================================================
   Sky Empire — 🏢 intérieur de l'aérogare, passager par passager
   Touchez un terminal en 3D (ou le bouton 🏢 Aérogare) : plan vu de dessus
   de l'aérogare, avec CHAQUE passager de vos vols dessiné :
   • DÉPARTS : arrivée par l'entrée → enregistrement au comptoir de son vol
     → sûreté → police (vols internationaux) → zone d'attente → porte
     d'embarquement → embarquement (il quitte le plan par la passerelle) ;
   • ARRIVÉES : sortie de l'avion → immigration → tapis à bagages → douane
     → sortie de l'aéroport.
   Les horaires viennent du vol (« Aérogare en direct ») : un vol de 800
   passagers = 800 personnes. Tableau des départs et arrivées en haut,
   touchez une personne pour voir son vol et son étape.
   Plan simplifié (pas en 3D) pour rester fluide sur téléphone.
   ========================================================= */
'use strict';
const TM={open:false, code:null, cache:{}, raf:0, sel:null, dpr:1};
const TM_COL=['#f59e0b','#38bdf8','#a78bfa','#34d399','#f472b6','#fb7185','#facc15','#60a5fa','#4ade80','#c084fc'];
const TM_SKIN=['#5b3a24','#7a4a2a','#3f2516','#8d5a3b','#c99a73','#e8c2a0'];
const tmNow=()=>typeof gSimNow==='function'&&typeof G!=='undefined'&&G?gSimNow():S.time;
const tmHM=t=>{ try{ return fmtTime(t).split(' ').pop(); }catch(e){ const d=new Date(t); return d.getUTCHours()+':'+String(d.getUTCMinutes()).padStart(2,'0'); } };
function tmD(a,l){ const k=a.id+'|'+l.dep, c=TM.cache[k]; if(c&&performance.now()-c.at<20000) return c.D;
  let D=null; try{ D=pfData(a,l); }catch(e){} TM.cache[k]={D,at:performance.now()}; return D; }
// vols de vos avions qui passent par cet aéroport en ce moment
function tmFlights(code){
  const now=tmNow(), deps=[], arrs=[];
  for(const a of S.fleet){ const fl=a.flight; if(!fl||!fl.legs) continue;
    fl.legs.forEach((l,i)=>{ if(i<fl.li) return; if(l.from!==code&&l.to!==code) return; const D=tmD(a,l); if(!D) return;
      const N=D.total||Math.round((modelOf(a).seats||150)*0.8), fn=S.company.code+(typeof flightNumber==='function'?flightNumber(a):'');
      if(l.from===code&&now>=D.ci.open-5*MIN&&now<=D.P+3*MIN) deps.push({a,l,D,N,fn});
      if(l.to===code&&i===fl.li&&now>=D.arr-25*MIN&&now<D.arr) arrs.push({a,l,D,N,fn,soon:true}); }); }
  // vols déjà posés : leurs passagers sont encore dans l'aérogare (immigration, bagages, douane)
  try{ for(const x of (typeof pfArrivals==='function'?pfArrivals():[])){ const D=x.D; if(!D||!D.B||D.B.code!==code) continue; if(now>D.cus.close+15*MIN) continue;
      arrs.push({a:x.a||{id:D.key},l:null,D,N:D.total||0,fn:x.fno||x.fn||'',soon:false}); } }catch(e){}
  const F={deps,arrs}; try{ tmRivals(code,now,F); }catch(e){}
  F.deps.sort((x,y)=>x.D.P-y.D.P); F.deps=F.deps.slice(0,10); F.arrs=F.arrs.slice(0,5); return F;
}
// vols des autres compagnies : horaires réels du jeu (rivalSched), passagers estimés selon l'avion
function tmFakeD(key,A,B,P,arr,N){ const intl=A.cc!==B.cc, h=hashStr(key);
  return {key,A,B,intl,P,arr,total:N,ci:{open:P-(intl?180:120)*MIN,close:P-(intl?60:40)*MIN,online:Math.round(N*0.3)},sec:{close:P-25*MIN},pol:{close:P-20*MIN},
    gate:{name:String.fromCharCode(66+h%5)+(1+h%28),open:P-40*MIN,last:P-14*MIN,close:P-6*MIN,noShow:h%3},
    imm:{open:arr+6*MIN,close:arr+(N>200?55:40)*MIN},bag:{first:arr+(14+h%6)*MIN,last:arr+(30+h%14)*MIN},cus:{close:arr+70*MIN}}; }
function tmRivals(code,now,F){
  if(typeof rivalSched!=='function') return; const A0=AP(code); let nd=0, na=0;
  for(const R of S.rivals||[]) for(const r of R.routes||[]){ if(nd>=6&&na>=3) return; if(r.a!==code&&r.b!==code) continue; const K=rivalSched(r); if(!K) continue;
    const N=Math.round(((K.m&&K.m.seats)||150)*(0.7+(hashStr(r.a+r.b)%20)/100)), fromA=r.a===code, other=AP(fromA?r.b:r.a); if(!other) continue;
    for(let i=0;i<K.nP;i++){ const base=K.anchors[i]-K.bA;
      const offDep=fromA?K.bA:K.pA.total+K.turn+K.bB, offArr=fromA?K.pA.total+K.turn+K.pB.total:K.pA.total;
      for(const kind of ['d','a']){ const off=kind==='d'?offDep:offArr, n=Math.floor((now+(kind==='d'?180*MIN:-60*MIN)-base-off)/K.P);
        for(const nn of [n,n+1]){ const t=base+off+nn*K.P;
          if(kind==='d'&&nd<6&&now>=t-185*MIN&&now<=t+3*MIN){ const D=tmFakeD(R.code+r.a+r.b+i+nn+'d',A0,other,t,t+K.pA.total,N); F.deps.push({a:{id:D.key},l:null,D,N,fn:(R.code||'')+(100+hashStr(r.a+r.b+i)%800),riv:R}); nd++; }
          if(kind==='a'&&na<3&&now>=t&&now<=t+70*MIN){ const D=tmFakeD(R.code+r.a+r.b+i+nn+'a',other,A0,t-K.pA.total,t,N); F.arrs.push({a:{id:D.key},l:null,D,N,fn:(R.code||'')+(100+hashStr(r.b+r.a+i)%800),riv:R}); na++; } } } } }
}
// plan : zones en pixels
function tmZones(w,h,nd,na,intl){
  const wd=na?Math.round(w*0.64):w, Z={w,h,wd};
  Z.gate={y0:h*0.03,y1:h*0.19}; Z.hall={y0:h*0.23,y1:intl?h*0.39:h*0.47}; Z.pol={y0:h*0.42,y1:h*0.48}; Z.sec={y0:h*0.52,y1:h*0.61}; Z.ck={y0:h*0.65,y1:h*0.86}; Z.ent=h*0.97;
  Z.band=i=>{ const bw=wd/Math.max(1,nd); return [i*bw+4,(i+1)*bw-4]; };
  Z.aband=i=>{ const bw=(w-wd)/Math.max(1,na); return [wd+i*bw+4,wd+(i+1)*bw-4]; };
  Z.ar={gate:[h*0.03,h*0.14], imm:[h*0.24,h*0.36], belt:[h*0.45,h*0.66], cus:[h*0.74,h*0.82], exit:h*0.97};
  return Z; }
// trajet d'un passager : images-clés {t,x,y,st}
function tmDepKF(f,fi,i,Z){
  const D=f.D, r=pfRng(D.key+'|tm'+i), N=f.N, [bx0,bx1]=Z.band(fi), bw=bx1-bx0, J=(a,b)=>a+(b-a)*r();
  const tIn=D.ci.open+(D.ci.close-D.ci.open)*Math.pow(r(),0.85)*0.97, online=r()<(D.ci.online||0)/Math.max(1,N);
  const ckEnd=online?tIn+2*MIN:tIn+(3+r()*14)*MIN, secA=ckEnd+3*MIN, secB=Math.min(Math.max(secA+2*MIN,D.sec.close),secA+(4+r()*14)*MIN);
  const polB=D.intl?secB+(3+r()*9)*MIN:secB, noShow=i>=N-(D.gate.noShow||0);
  let board=D.gate.open+(D.gate.close-D.gate.open)*Math.pow(r(),1.1), gateA=Math.max(polB+4*MIN,D.gate.open-(5+r()*30)*MIN);
  if(board<gateA+MIN) gateA=board-MIN;
  const lane=Math.floor(r()*6), xl=Z.wd*(lane+0.5)/6, ent={x:J(Z.wd*0.1,Z.wd*0.9),y:Z.ent}, ck={x:J(bx0+bw*0.15,bx1-bw*0.15),y:online?J(Z.ck.y0+20,Z.ck.y1):J(Z.ck.y0+18,Z.ck.y1-4)};
  const sec={x:xl+J(-Z.wd/16,Z.wd/16),y:J(Z.sec.y0+6,Z.sec.y1)}, pol={x:J(Z.wd*0.1,Z.wd*0.9),y:J(Z.pol.y0,Z.pol.y1)}, hall={x:J(8,Z.wd-8),y:J(Z.hall.y0+10,Z.hall.y1)}, hall2={x:J(8,Z.wd-8),y:J(Z.hall.y0+10,Z.hall.y1)};
  const seat={x:J(bx0+6,bx1-6),y:J(Z.gate.y0+14,Z.gate.y1)}, door={x:(bx0+bx1)/2,y:Z.gate.y0-6};
  const K=[{t:tIn,...ent,st:'arrive à l’aéroport'},{t:tIn+1.5*MIN,...ck,st:online?'dépose ses bagages':'fait la queue à l’enregistrement'},{t:ckEnd,...ck,st:'enregistre ses bagages'},
    {t:secA,...sec,st:'fait la queue à la sûreté'},{t:secB,...sec,st:'passe le portique de sûreté'}];
  if(D.intl) K.push({t:secB+1.5*MIN,...pol,st:'fait la queue à la police'},{t:polB,...pol,st:'contrôle du passeport'});
  K.push({t:polB+2*MIN,...hall,st:'se promène en zone d’attente'},{t:Math.max(polB+3*MIN,gateA-2*MIN),...hall2,st:'en zone d’attente (boutiques)'});
  if(noShow){ K.push({t:D.gate.close+20*MIN,...hall2,st:'⚠️ ne s’est pas présenté à la porte'}); return K; }
  K.push({t:gateA,...seat,st:'attend à la porte'},{t:board,...seat,st:'attend l’embarquement'},{t:board+1.2*MIN,...door,st:'embarque',out:1});
  for(let k=1;k<K.length;k++) if(K[k].t<K[k-1].t+5000) K[k].t=K[k-1].t+5000;
  return K; }
function tmArrKF(f,fi,i,Z){
  const D=f.D, r=pfRng(D.key+'|tma'+i), N=Math.max(1,f.N), [bx0,bx1]=Z.aband(fi), J=(a,b)=>a+(b-a)*r();
  const tOff=D.arr+5*MIN+(i/N)*14*MIN, door={x:(bx0+bx1)/2,y:Z.ar.gate[0]}, g={x:J(bx0+4,bx1-4),y:J(Z.ar.gate[0]+6,Z.ar.gate[1])};
  const imm={x:J(Z.wd+8,Z.w-8),y:J(Z.ar.imm[0],Z.ar.imm[1])}, immB=D.intl?Math.max(tOff+3*MIN,D.imm.open)+r()*Math.max(4*MIN,(D.imm.close-D.imm.open)*0.8):tOff+2*MIN;
  const cx=(bx0+bx1)/2, cy=(Z.ar.belt[0]+Z.ar.belt[1])/2, an=r()*6.283, rad=Math.min(bx1-bx0,Z.ar.belt[1]-Z.ar.belt[0])*0.42, belt={x:cx+Math.cos(an)*rad,y:cy+Math.sin(an)*rad*0.8};
  const bags=r()<0.85, bagT=bags?Math.max(immB+2*MIN,D.bag.first+r()*(D.bag.last-D.bag.first)):immB+2*MIN, cus={x:J(Z.wd+8,Z.w-8),y:J(Z.ar.cus[0],Z.ar.cus[1])}, ex={x:J(Z.wd+10,Z.w-10),y:Z.ar.exit};
  const K=[{t:tOff,...door,st:'descend de l’avion'},{t:tOff+1.5*MIN,...g,st:'marche vers l’immigration'}];
  if(D.intl) K.push({t:tOff+3*MIN,...imm,st:'fait la queue à l’immigration'},{t:immB,...imm,st:'contrôle du passeport et du visa'});
  K.push({t:immB+2*MIN,...belt,st:bags?'attend sa valise au tapis':'passe sans bagage'},{t:bagT,...belt,st:bags?'récupère sa valise':'passe sans bagage'},
    {t:bagT+2*MIN,...cus,st:'passe la douane'},{t:bagT+4*MIN,...ex,st:'sort de l’aéroport',out:1});
  for(let k=1;k<K.length;k++) if(K[k].t<K[k-1].t+5000) K[k].t=K[k-1].t+5000;
  return K; }
function tmAt(K,now){ if(now<K[0].t||now>K[K.length-1].t) return null;
  for(let k=1;k<K.length;k++) if(now<=K[k].t){ const a=K[k-1], b=K[k], u=(now-a.t)/Math.max(1,b.t-a.t), same=a.x===b.x&&a.y===b.y;
      return {x:a.x+(b.x-a.x)*u, y:a.y+(b.y-a.y)*u, st:same?a.st:b.st, walk:!same}; }
  return null; }
function tmBuild(){ const F=tmFlights(TM.code), cv=TM.cv, w=cv.clientWidth, h=cv.clientHeight, intl=F.deps.some(f=>f.D.intl), Z=tmZones(w,h,F.deps.length,F.arrs.length,intl);
  const ppl=[]; F.deps.forEach((f,fi)=>{ f.col=TM_COL[fi%TM_COL.length]; for(let i=0;i<Math.min(f.N,1600);i++) ppl.push({f,i,K:tmDepKF(f,fi,i,Z),c:f.col,sk:TM_SKIN[(i*7+fi)%TM_SKIN.length],dep:1}); });
  F.arrs.forEach((f,fi)=>{ f.col=TM_COL[(fi+5)%TM_COL.length]; if(f.soon) return; for(let i=0;i<Math.min(f.N,1600);i++) ppl.push({f,i,K:tmArrKF(f,fi,i,Z),c:f.col,sk:TM_SKIN[(i*5+fi)%TM_SKIN.length],dep:0}); });
  TM.F=F; TM.Z=Z; TM.ppl=ppl; TM.built=performance.now(); TM.w=w; TM.h=h; tmBoard(); }
function tmBoard(){ const el=document.getElementById('tmBoard'); if(!el) return; const F=TM.F, now=tmNow();
  const stD=D=>now<D.ci.close?'🎫 Enregistrement':now<D.gate.open?'🛍️ Salle d’attente':now<D.gate.last?'🚪 Embarquement':now<D.gate.close?'⚠️ Dernier appel':'✈️ Porte fermée';
  const own=f=>f.riv?` <span style="color:#94a3b8">${esc(f.riv.name||'')}</span>`:' <span style="color:#facc15">★</span>', row=(c,a,b,d,e)=>`<tr><td><i style="background:${c}"></i></td><td><b>${a}</b></td><td>${b}</td><td>${d}</td><td>${e}</td></tr>`;
  el.innerHTML=(F.deps.length?`<table><tr><th></th><th>Départ</th><th>Destination</th><th>Porte</th><th>Statut</th></tr>${F.deps.map(f=>row(f.col,tmHM(f.D.P)+' '+esc(f.fn),esc(f.D.B.city)+' · '+f.N+' pax'+own(f),esc(f.D.gate.name),stD(f.D))).join('')}</table>`:'<div class="small mut">Aucun départ dans les 3 prochaines heures.</div>')
    +(F.arrs.length?`<table><tr><th></th><th>Arrivée</th><th>Provenance</th><th></th><th>Statut</th></tr>${F.arrs.map(f=>row(f.col,tmHM(f.D.arr)+' '+esc(f.fn),esc(f.D.A.city)+' · '+f.N+' pax'+own(f),'',f.soon?'🛬 Atterrit bientôt':now<f.D.bag.first?'🛂 Immigration':now<f.D.bag.last?'🧳 Bagages':'🛃 Douane / sortie')).join('')}</table>`:''); }
function tmDraw(){
  if(!TM.open) return; TM.raf=requestAnimationFrame(tmDraw);
  const cv=TM.cv; if(!cv) return; const w=cv.clientWidth, h=cv.clientHeight; if(!w||!h) return;
  if(cv.width!==Math.round(w*TM.dpr)||cv.height!==Math.round(h*TM.dpr)){ cv.width=Math.round(w*TM.dpr); cv.height=Math.round(h*TM.dpr); TM.built=0; }
  if(!TM.built||performance.now()-TM.built>15000||TM.w!==w||TM.h!==h) tmBuild();
  const g=cv.getContext('2d'), Z=TM.Z, F=TM.F, now=tmNow(), zm=TM.z||1; tmClamp(w,h); g.setTransform(TM.dpr,0,0,TM.dpr,0,0); g.fillStyle='#0b1220'; g.fillRect(0,0,w,h); g.setTransform(TM.dpr*zm,0,0,TM.dpr*zm,-TM.px*TM.dpr*zm,-TM.py*TM.dpr*zm);
  // sol et zones
  g.fillStyle='#d6d3d1'; g.fillRect(0,0,w,h); g.fillStyle='#e7e5e4'; g.fillRect(0,Z.ck.y0-6,Z.wd,Z.ent-Z.ck.y0+6);
  const zone=(x0,y0,x1,y1,col,lab)=>{ g.fillStyle=col; g.fillRect(x0,y0,x1-x0,y1-y0); if(lab){ g.fillStyle='rgba(15,23,42,.75)'; g.font='600 11px system-ui'; g.fillText(lab,x0+4,y0+12); } };
  zone(0,Z.hall.y0,Z.wd,Z.hall.y1,'#f5f5f4','🛍️ Zone d’attente · boutiques');
  { const shops=['☕ Café','🛍️ Duty free','💱 Change','📚 Presse','🍔 Snack','💊 Pharmacie','🕌 Prière','📱 Accessoires'], ns=Math.max(3,Math.min(8,Math.floor(Z.wd/70)));
    for(let k=0;k<ns;k++){ const x0=Z.wd*k/ns+4, x1=Z.wd*(k+1)/ns-4; g.fillStyle='#e7e5e4'; g.fillRect(x0,Z.hall.y1-16,x1-x0,14); g.fillStyle='#78716c'; g.font='9px system-ui'; g.fillText(shops[k%shops.length],x0+2,Z.hall.y1-6); } }
  zone(0,Z.sec.y0,Z.wd,Z.sec.y1,'#dbeafe','🔍 Sûreté'); for(let k=0;k<6;k++){ const x=Z.wd*(k+0.5)/6; g.fillStyle='#64748b'; g.fillRect(x-6,Z.sec.y0+2,12,4); g.fillRect(x-1,Z.sec.y0+2,2,Z.sec.y1-Z.sec.y0-4); }
  if(F.deps.some(f=>f.D.intl)){ zone(0,Z.pol.y0,Z.wd,Z.pol.y1,'#ede9fe','🛂 Police aux frontières'); for(let k=0;k<8;k++){ g.fillStyle='#7c3aed'; g.fillRect(Z.wd*(k+0.5)/8-5,Z.pol.y0+1,10,4); } }
  zone(0,Z.ck.y0,Z.wd,Z.ck.y0+14,'#cbd5e1','🎫 Enregistrement');
  g.fillStyle='rgba(15,23,42,.7)'; g.font='600 11px system-ui'; g.fillText('🚶 Entrée de l’aérogare',6,Z.ent-4);
  F.deps.forEach((f,i)=>{ const [x0,x1]=Z.band(i); g.fillStyle=f.col; g.globalAlpha=0.18; g.fillRect(x0,Z.gate.y0,x1-x0,Z.gate.y1-Z.gate.y0); g.fillRect(x0,Z.ck.y0+14,x1-x0,Z.ck.y1-Z.ck.y0-14); g.globalAlpha=1;
    g.fillStyle='rgba(100,116,139,.35)'; for(let yy=Z.gate.y0+16;yy<Z.gate.y1-20;yy+=7) g.fillRect(x0+5,yy,x1-x0-10,2);   // rangées de sièges
    g.fillStyle='#334155'; g.fillRect(x0+4,Z.ck.y0+14,x1-x0-8,5); g.fillStyle=f.col; g.fillRect((x0+x1)/2-10,Z.gate.y0-4,20,6);
    g.fillStyle='#0f172a'; g.font='700 11px system-ui'; const t1=`${f.D.gate.name} → ${f.D.B.city}`, t2=`${tmHM(f.D.P)} · ${f.fn}`; g.fillText(t1.slice(0,Math.max(6,Math.floor((x1-x0)/6.5))),x0+3,Z.gate.y1-14); g.font='10px system-ui'; g.fillText(t2,x0+3,Z.gate.y1-3);
    g.font='600 10px system-ui'; g.fillText(('→ '+f.D.B.city).slice(0,Math.max(5,Math.floor((x1-x0)/6))),x0+4,Z.ck.y1+11); });
  if(F.arrs.length){ g.fillStyle='#e2e8f0'; g.fillRect(Z.wd,0,w-Z.wd,h); g.fillStyle='#94a3b8'; g.fillRect(Z.wd,0,2,h);
    zone(Z.wd+2,Z.ar.imm[0]-14,w,Z.ar.imm[1],'#ede9fe','🛂 Immigration'); zone(Z.wd+2,Z.ar.belt[0]-14,w,Z.ar.belt[1],'#f1f5f9','🧳 Bagages'); zone(Z.wd+2,Z.ar.cus[0]-14,w,Z.ar.cus[1],'#dcfce7','🛃 Douane');
    g.fillStyle='rgba(15,23,42,.7)'; g.font='600 11px system-ui'; g.fillText('🚕 Sortie',Z.wd+6,Z.ar.exit-4);
    F.arrs.forEach((f,i)=>{ const [x0,x1]=Z.aband(i), cx=(x0+x1)/2, cy=(Z.ar.belt[0]+Z.ar.belt[1])/2, rad=Math.min(x1-x0,Z.ar.belt[1]-Z.ar.belt[0])*0.3;
      g.fillStyle=f.col; g.fillRect(cx-8,Z.ar.gate[0]-4,16,6); g.strokeStyle='#475569'; g.lineWidth=5; g.beginPath(); g.ellipse(cx,cy,rad,rad*0.8,0,0,6.283); g.stroke();
      if(now>f.D.bag.first&&now<f.D.bag.last+5*MIN){ const bc=['#1f2937','#7f1d1d','#1e3a8a','#14532d','#713f12']; for(let k=0;k<10;k++){ const an=k/10*6.283+now/40000; g.fillStyle=bc[k%5]; g.fillRect(cx+Math.cos(an)*rad-2.5,cy+Math.sin(an)*rad*0.8-2,5,4); } }   // valises sur le tapis
      g.fillStyle='#0f172a'; g.font='700 10px system-ui'; g.fillText((f.D.A.city).slice(0,Math.max(5,Math.floor((x1-x0)/6))),x0+2,Z.ar.gate[1]+10); }); }
  // passagers
  let n=0, nd=0, na=0; const pts=[]; const area=w*h, s=Math.max(1.3,Math.min(3.4,Math.sqrt(area/Math.max(60,TM.ppl.length))*0.16));
  for(const p of TM.ppl){ const q=tmAt(p.K,now); if(!q) continue; n++; p.dep?nd++:na++;
    const bob=q.walk?Math.sin(now/220+p.i)*0.4:0, x=q.x+((p.i*13)%7-3)*0.4, y=q.y+bob;
    g.fillStyle=p.c; g.fillRect(x-s,y-s*0.2,s*2,s*2.6); g.fillStyle=p.sk; g.beginPath(); g.arc(x,y-s*0.9,s*0.85,0,6.283); g.fill();
    pts.push([x,y,p,q]); }
  TM.pts=pts;
  if(TM.sel){ const hit=pts.find(z=>z[2]===TM.sel); if(hit){ const [x,y,p,q]=hit; g.strokeStyle='#ef4444'; g.lineWidth=2; g.beginPath(); g.arc(x,y-s*0.4,s*3.2,0,6.283); g.stroke();
      g.setTransform(TM.dpr,0,0,TM.dpr,0,0); const sx=(x-TM.px)*zm, sy=(y-TM.py)*zm;
      const txt=`${p.f.riv?(p.f.riv.name||'')+' · ':''}${p.dep?'Vol '+p.f.fn+' → '+p.f.D.B.city:'Vol '+p.f.fn+' de '+p.f.D.A.city} · ${q.st}`; g.font='600 12px system-ui'; const tw=g.measureText(txt).width+12, bx=Math.max(4,Math.min(w-tw-4,sx-tw/2)), by=Math.max(4,sy-34);
      g.fillStyle='rgba(15,23,42,.92)'; g.fillRect(bx,by,tw,22); g.fillStyle='#fff'; g.fillText(txt,bx+6,by+15); } else TM.sel=null; }
  const hd=document.getElementById('tmCount'); if(hd&&(!TM.cAt||performance.now()-TM.cAt>800)){ TM.cAt=performance.now(); hd.textContent=`👥 ${n.toLocaleString('fr-FR')} personnes dans l’aérogare · ${nd} au départ · ${na} à l’arrivée · ${tmHM(now)}`; if(Math.random()<0.2) tmBoard(); }
}
function tmClamp(w,h){ const z=TM.z||1; TM.px=Math.max(0,Math.min(w-w/z,TM.px||0)); TM.py=Math.max(0,Math.min(h-h/z,TM.py||0)); }
function tmOpen(code){
  code=code||tmNearest(); if(!code||typeof pfData!=='function') return; TM.code=code; TM.open=true; TM.sel=null; TM.built=0; TM.z=1; TM.px=0; TM.py=0; TM.dpr=Math.min(2,window.devicePixelRatio||1);
  let ov=document.getElementById('tmOv'); if(ov) ov.remove();
  ov=document.createElement('div'); ov.id='tmOv'; const A=AP(code);
  ov.innerHTML=`<style>#tmOv{position:fixed;inset:0;z-index:2000;background:#0b1220;display:flex;flex-direction:column;color:#e2e8f0;padding-top:env(safe-area-inset-top)}
#tmOv header{display:flex;align-items:center;gap:8px;padding:8px 10px}#tmOv header b{font:700 15px system-ui;flex:1}#tmOv header button{min-width:44px}
#tmBoard{max-height:19vh;overflow:auto;padding:0 10px 6px;font:12px system-ui}#tmBoard table{width:100%;border-collapse:collapse;margin-bottom:4px}#tmBoard th{text-align:left;color:#facc15;font-weight:600;font-size:11px}
#tmBoard td{padding:2px 4px;border-top:1px solid rgba(148,163,184,.15);font-family:ui-monospace,monospace;font-size:11px}#tmBoard td i{display:inline-block;width:9px;height:9px;border-radius:2px}
#tmCount{padding:2px 10px 6px;font:600 12px system-ui;color:#93c5fd}#tmCv{flex:1;width:100%;min-height:0;touch-action:manipulation}</style>
<header><b>🏢 Aérogare de ${esc(A.city)} (${esc(code)})</b><button class="btn" data-tz="-">➖</button><button class="btn" data-tz="+">🔍</button><button class="btn" data-tm="x">✖</button></header><div id="tmBoard"></div><div id="tmCount"></div><canvas id="tmCv"></canvas>`;
  document.body.appendChild(ov); TM.cv=ov.querySelector('#tmCv');
  ov.querySelector('[data-tm="x"]').onclick=tmClose;
  TM.cv.addEventListener('click',e=>{ if(TM.dragged){ TM.dragged=false; return; } const r=TM.cv.getBoundingClientRect(), zm=TM.z||1, x=(e.clientX-r.left)/zm+TM.px, y=(e.clientY-r.top)/zm+TM.py; let best=null, bd=18*18;
    bd=bd/((zm*zm)||1); for(const z of TM.pts||[]){ const d=(z[0]-x)**2+(z[1]-y)**2; if(d<bd){ bd=d; best=z[2]; } } TM.sel=best; });
  // déplacement au doigt quand on a zoomé
  let drag=null; TM.cv.addEventListener('pointerdown',e=>{ drag={x:e.clientX,y:e.clientY,px:TM.px,py:TM.py,m:0}; });
  TM.cv.addEventListener('pointermove',e=>{ if(!drag||(TM.z||1)<=1) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; if(Math.abs(dx)+Math.abs(dy)>6){ drag.m=1; TM.dragged=true; } TM.px=drag.px-dx/TM.z; TM.py=drag.py-dy/TM.z; });
  window.addEventListener('pointerup',()=>{ drag=null; },{once:false});
  ov.querySelectorAll('[data-tz]').forEach(b=>b.onclick=()=>{ const w=TM.cv.clientWidth, h=TM.cv.clientHeight, z0=TM.z||1, z1=Math.max(1,Math.min(4,z0*(b.dataset.tz==='+'?1.6:1/1.6)));
      const cx=TM.px+w/(2*z0), cy=TM.py+h/(2*z0); TM.z=z1; TM.px=cx-w/(2*z1); TM.py=cy-h/(2*z1); });
  // la 3D se met en pause pendant la visite (économise le téléphone)
  try{ if(typeof G!=='undefined'&&G&&G.viewer){ TM.v3=G.viewer; G.viewer.useDefaultRenderLoop=false; } }catch(e){}
  cancelAnimationFrame(TM.raf); tmDraw(); }
function tmClose(){ TM.open=false; cancelAnimationFrame(TM.raf); const ov=document.getElementById('tmOv'); if(ov) ov.remove(); TM.ppl=[]; TM.pts=[];
  try{ if(TM.v3&&!TM.v3.isDestroyed()) TM.v3.useDefaultRenderLoop=true; }catch(e){} TM.v3=null; }
function tmNearest(){ try{ const ac=typeof G!=='undefined'&&G&&G.follow&&S.fleet.find(a=>a.id===G.follow), st=ac&&ac.flight&&flightState(ac); if(st) return st.phase<=3?st.from:st.to; }catch(e){} return S.company.hub; }
// bouton 🏢 en vue 3D (avion au sol) et toucher d'un terminal 3D
function tmTick(){
  if(typeof G==='undefined'||!G||!G.viewer) return; const host=document.getElementById('globe'); if(!host||host.hidden) return;
  let b=document.getElementById('tmBtn'); if(!b){ b=document.createElement('button'); b.id='tmBtn'; b.className='btn'; b.textContent='🏢 Aérogare'; b.style.cssText='position:absolute;right:8px;top:calc(46% + env(safe-area-inset-top));z-index:1062;padding:8px 10px;font:600 13px system-ui;border-radius:12px;background:rgba(8,14,26,.85);color:#fff;border:1px solid rgba(148,163,184,.4)'; b.onclick=()=>tmOpen(); host.appendChild(b); }
  let show=false; try{ const ac=G.follow&&S.fleet.find(a=>a.id===G.follow), st=ac&&ac.flight&&flightState(ac); show=!!(st&&(st.phase<=1||st.phase>=7)); }catch(e){}
  b.hidden=!show;
  if(TM.hv!==G.viewer){ TM.hv=G.viewer; try{ const C=Cesium, h=new C.ScreenSpaceEventHandler(G.viewer.scene.canvas);
      h.setInputAction(e=>{ try{ const p=G.viewer.scene.pick(e.position), c=p&&p.id&&p.id._term; if(c) tmOpen(c); }catch(x){} }, C.ScreenSpaceEventType.LEFT_CLICK); }catch(e){} }
}
if(typeof window!=='undefined') window.addEventListener('load',()=>{ setInterval(()=>{ try{ tmTick(); }catch(e){} },1000);
  try{ Object.assign(ACTIONS,{termOpen:d=>{ try{ closeModal(); }catch(e){} tmOpen(d&&d.code); }}); }catch(e){}
  // accès sans la 3D : fiche de chaque aéroport (carte 2D) et carte « Aérogare en direct » (onglet passagers)
  const btn=c=>`<button class="btn" data-act="termOpen" data-code="${esc(c)}" style="margin:4px 0">🏢 Voir l’intérieur de l’aérogare</button>`;
  if(typeof airportHtml==='function'){ const _a=airportHtml; airportHtml=function(code){ const h=_a.apply(this,arguments); try{ return btn(code)+h; }catch(e){ return h; } }; }
  if(typeof pfCardHtml==='function'){ const _p=pfCardHtml; pfCardHtml=function(){ const h=_p.apply(this,arguments);
      try{ const hubs=[...new Set([S.company.hub,...(S.hubs||[])])].filter(Boolean).slice(0,6);
        return `<div class="card"><b>🏢 Intérieur des aérogares</b> <span class="small mut">— la foule en direct, sans passer par la 3D</span><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${hubs.map(c=>`<button class="btn" data-act="termOpen" data-code="${esc(c)}">🏢 ${esc(AP(c).city)}</button>`).join('')}</div></div>`+h; }catch(e){ return h; } }; }
});
