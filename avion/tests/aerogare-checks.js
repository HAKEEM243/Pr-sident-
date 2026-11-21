#!/usr/bin/env node
/* =========================================================
   Sky Empire — contrôles automatiques avant chaque mise en ligne
   Lancer :  node avion/tests/aerogare-checks.js
   (Playwright + Chromium nécessaires ; le serveur local est démarré tout seul)
   Chaque contrôle doit afficher ✅ ; un seul ❌ = on ne met pas en ligne.
   ========================================================= */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..'), APP=path.join(ROOT,'avion'), PORT=8799;
let fails=0; const ok=(c,lab,extra)=>{ console.log((c?'✅ ':'❌ ')+lab+(extra?' — '+extra:'')); if(!c) fails++; };

// 1. syntaxe de tous les fichiers du jeu
const files=fs.readdirSync(APP).filter(f=>f.endsWith('.js'));
let bad=[]; for(const f of files){ try{ execFileSync(process.execPath,['--check',path.join(APP,f)],{stdio:'pipe'}); }catch(e){ bad.push(f); } }
ok(!bad.length,'Syntaxe des '+files.length+' fichiers',bad.join(', '));

// 2. serveur local
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{ const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0])); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(PORT);

(async()=>{ let b;
  try{ const {chromium,devices}=require('playwright'); const exe='/opt/pw-browsers/chromium';
    b=await chromium.launch(fs.existsSync(exe)?{executablePath:exe}:{});
    const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'}), p=await ctx.newPage(), errs=[];
    p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
    await ctx.route('**/*',r=>r.request().url().startsWith('http://localhost')?r.continue():r.abort());
    await p.goto(`http://localhost:${PORT}/avion/index.html`); await p.waitForTimeout(1500);
    await p.evaluate(()=>{ UI.ng=null; newGameModal(); UI.ng.hub='FIH'; }); await p.click('[data-act="ngGo"]'); await p.waitForTimeout(1500);
    await p.evaluate(()=>{ try{ ACTIONS.guideSkip&&ACTIONS.guideSkip(); }catch(e){} window.maybeShowDecision=()=>{}; S.cash+=1e9; try{ closeModal(); }catch(e){} });
    const id=await p.evaluate(()=>{ const ac=addAircraft('A20N',{hub:'FIH'}); for(let k=0;k<4;k++) S.pilots.push(makePilot(['A320'])); const rt=openLine(['FIH','BZV']); S.fleet.forEach(a=>a.plan=[]); ac.readyAt=0; dispatchRoute(ac,rt,1,S.time); return ac.id; });

    // 3. aérogares : passagers visibles au départ et à l'arrivée, nombre de vols conforme
    const ap=await p.evaluate(async()=>{ const o=[]; for(const c of ['FIH','BZV','ADD','CDG','NBO']){ TM.code=null; tmOpen(c); await new Promise(r=>setTimeout(r,1300)); const pp=TM.ppl||[]; o.push({c,dep:pp.filter(x=>x.dep===1).length,arr:pp.filter(x=>x.dep===0).length,vis:(TM.pts||[]).length,nd:TM.F.deps.length,na:TM.F.arrs.length}); tmClose(); } return o; });
    for(const a of ap) ok(a.vis>50&&a.dep>0&&a.nd<=16&&a.na<=8,'Aérogare '+a.c+' : passagers visibles',`${a.vis} visibles, ${a.dep} départ, ${a.arr} arrivée, ${a.nd}/${a.na} vols`);

    // 4. règles : étrangers à la police, personne vers une porte fermée
    const r=await p.evaluate(()=>{ S.time=S.time; TM.code='FIH'; TM.cache={}; TM.built=0; tmBuild(); let fd=0,fp=0,late=0,n=0;
      for(const q of TM.ppl){ if(!q.f||!q.row) continue; const D=q.f.D; if(q.dep===1){ n++; if(!D.intl&&q.row.nat!==D.A.cc){ fd++; if(q.K.some(k=>/police/.test(k.st))) fp++; } if(q.K.some(k=>k.t>D.gate.close+1000&&/porte |embarquement|passerelle/.test(k.st)&&!/fermée|pas présenté/.test(k.st))) late++; } }
      return {n,fd,fp,late}; });
    ok(r.fd===r.fp,'Étrangers des vols nationaux contrôlés par la police',`${r.fp}/${r.fd}`); ok(r.late===0,'Aucun passager vers une porte fermée',`${r.late} sur ${r.n}`);

    // 4 bis. chaque vol reçoit sa porte avant l'ouverture de son embarquement
    const gt=await p.evaluate(()=>{ const T0=S.time; let n=0,bad=0; for(const code of ['FIH','ADD']) for(let t=T0;t<T0+6*HOUR;t+=20*MIN){ S.time=t; TM.code=code; TM.cache={}; const F=tmFlights(code); for(const f of F.later||[]){ n++; if(t>=f.D.gate.open-MIN) bad++; } } S.time=T0; return {n,bad}; });
    ok(gt.bad===0,'Chaque vol a sa porte avant l’embarquement',`${gt.bad} vol(s) sans porte à l’embarquement sur ${gt.n} vols en attente`);

    // 4 ter. chaque passager passe par les comptoirs de SA compagnie (jamais à travers la file d'une autre)
    const ck=await p.evaluate(()=>{ TM.code='FIH'; TM.cache={}; TM.built=0; tmBuild(); let n=0,bad=0;
      for(const q of TM.ppl){ if(q.dep!==1||!q.f) continue; const g=TM.L.deps.find(d=>d.f===q.f)||(TM.L.later||[]).find(d=>d.f===q.f); if(!g||g.cx0==null) continue; n++; const K=q.K, tEnd=(K.find(k=>/sûreté|coupe-file/.test(k.st))||K[K.length-1]).t;
        for(let t=K[0].t;t<tEnd;t+=20000){ const z=tmAt(K,t); if(z&&z.y>1026&&z.y<1154&&z.x<612&&(z.x<g.cx0-6||z.x>g.cx1+6)){ bad++; break; } } }
      return {n,bad}; });
    ok(ck.bad===0,'Chaque passager passe par les comptoirs de SA compagnie',`${ck.bad} passager(s) traversent la file d’une autre compagnie sur ${ck.n}`);

    // 5. vos avions : l'aérogare montre ce que montre la 3D (départ et arrivée, avec retards)
    const c3=await p.evaluate(id=>{ const ac=S.fleet.find(a=>a.id===id), l=ac.flight.legs[0], T0=S.time; l.hOut=15*MIN; l.hIn=20*MIN; l.ga=6*MIN; const ARR=l.dep+legProf(l,modelOf(ac)).total; let bad=0,n=0,done=false; S.tmRecent=S.tmRecent||[];
      for(const code of ['FIH','BZV']) for(let t=T0-30*MIN;t<T0+5*HOUR;t+=10*MIN){ S.time=t; if(code==='BZV'&&!done&&t>=ARR){ done=true; S.tmRecent.push({acId:ac.id,reg:ac.reg,model:modelOf(ac).name,fn:S.company.code+flightNumber(ac),leg:{from:l.from,to:l.to,dep:l.dep,pax:l.pax,dist:l.dist},t:ARR}); ac.status='idle'; ac.loc='BZV'; }
        TM.code=code; TM.cache={}; TM.built=0; TM.th=null; tmBuild(); const fl=ac.flight, lg=fl.legs[fl.li]; let g3=false; if(ac.status==='flight'){ const st=flightState(ac,t); if(lg.from===code&&(t<lg.dep||(st&&st.phase<=1))) g3=true; if(lg.to===code&&st&&st.phase>=8) g3=true; } else g3=ac.loc===code;
        let tm=false; for(const d of TM.L.deps) if(d.f.acId===id&&tmDepPlane(d,t)) tm=true; for(const a of TM.L.arrs) if(a.f.acId===id&&tmArrPlane(a,t)) tm=true; if((TM.F.parked||[]).some(x=>x.a.id===id)) tm=true; n++; if(g3!==tm) bad++; }
      S.time=T0; ac.status='flight'; return {n,bad}; },id);
    ok(c3.bad===0,'Vos avions : aérogare = 3D (avec attente, circuit d’attente, remise de gaz)',`${c3.bad} écart(s) sur ${c3.n}`);

    // 6. autres compagnies : heures identiques à la carte et à la 3D (rivalPos)
    const rv=await p.evaluate(()=>{ const code='FIH', L=[], seen=new Set(); for(const bb of AP_ROUTES[code]||[]) for(const c of carriersOn(code,bb)){ const k=c+pairKey(code,bb); if(seen.has(k)) continue; seen.add(k); L.push([ghostAirline(c),ghostRouteOf(c,code,bb)]); }
      const _b=atcRivalBlocked; atcRivalBlocked=()=>false; let n=0,bad=0;
      for(const [R,r] of L.slice(0,25)){ const K=rivalSched(r); if(!K) continue; for(let i=0;i<K.nP;i++) for(const dir of ['AB','BA']) for(let cyc=Math.floor((S.time-K.anchors[i])/K.P), e=cyc+3; cyc<e; cyc++){ const f=rivFlight(R,r,i,dir,cyc); if(!f) continue; n++; const q=t=>rivalPos(r,i,t);
        if(q(f.P-MIN)) bad++; const a=q(f.P+MIN); if(!(a&&a.ph<=1)) bad++; if(f.tko){ const c=q(f.tko+20000); if(!(c&&c.ph===2)) bad++; } if(f.td){ const c=q(f.td+20000); if(!(c&&c.ph===8)) bad++; } if(q(f.arr+MIN)) bad++; } }
      atcRivalBlocked=_b; return {n,bad}; });
    ok(rv.bad===0,'Autres compagnies : heures identiques carte / 3D / aérogare',`${rv.bad} écart(s) sur ${rv.n} vols`);

    // 6 bis. avions des autres compagnies : ceux de l'aérogare sont ceux de la 3D (garés à leur porte ou en train de rouler), et inversement
    const r3=await p.evaluate(()=>{ const code='FIH', T0=S.time, A=AP(code); let n=0,bad=0,miss=0;
      for(let t=T0;t<T0+3*HOUR;t+=15*MIN){ S.time=t; TM.code=code; TM.cache={}; TM.built=0; tmBuild(); const sh=rivPresentShown(code,t), pres=new Set(sh.map(x=>x.reg)), mov=new Set();
        for(const [R,r] of rivRoutesAt(code)){ const K=rivalSched(r); if(!K) continue; for(let i=0;i<K.nP;i++){ const q=rivalPos(r,i,t); if(q&&q.gnd&&gcDist(q.p,A)<12) mov.add(rivReg(R,r,i)); } }
        const stand=new Set(); for(const d of TM.L.deps) if(d.f.riv&&d.f.reg&&tmDepPlane(d,t)) stand.add(d.f.reg); for(const a of TM.L.arrs) if(a.f.riv&&a.f.reg&&tmArrPlane(a,t)) stand.add(a.f.reg);
        for(const r of stand){ n++; if(!pres.has(r)&&!mov.has(r)) bad++; }
        const per=TM.L.parkPer||1, rem=sh.filter(x=>!stand.has(x.reg)).length+(TM.F.parked||[]).length; if(rem>Math.min(8,TM.L.parkRows||0)*per) miss++; }
      S.time=T0; return {n,bad,miss}; });
    ok(r3.bad===0&&r3.miss===0,'Autres compagnies : mêmes avions garés dans l’aérogare et en 3D',`${r3.bad} avion(s) de l’aérogare absents en 3D sur ${r3.n} ; ${r3.miss} débordement(s) des postes éloignés`);

    // 6 ter. horaires : aucun vol ne décolle ni n'atterrit dans un aéroport fermé (autres compagnies et vos vols) ; heure d'été correcte
    const hz=await p.evaluate(()=>{ let n=0,bad=0; const seen=new Set();
      for(const code of ['MJM','KGA','FRA']) for(const [R,r] of rivRoutesAt(code)){ const k=(r.c||R.code)+r.a+r.b; if(seen.has(k)) continue; seen.add(k); const K=rivalSched(r); if(!K) continue;
        for(let i=0;i<K.nP;i++){ const c0=Math.floor((S.time-K.anchors[i])/K.P); for(let c=c0;c<c0+3;c++) for(const dir of ['AB','BA']){ const f=rivFlight(R,r,i,dir,c); if(!f||f.ops===false) continue; n++; if(!apOpenAt(f.from,f.P0)||!apOpenAt(f.to,f.arr-(f.late||0)*MIN)) bad++; } } }
      const mid=(MODELS.find(m=>m.fam==='TURBO')||{}).id, ac=addAircraft(mid,{hub:'FIH'}); for(let k=0;k<3;k++) S.pilots.push(makePilot([modelOf(ac).fam])); S.staff.pnc=(S.staff.pnc||0)+60;
      const rt=openLine(['FIH','MJM']); ac.readyAt=0; const t=S.time+(((22-ahLocalHour('FIH',S.time))+24)%24)*HOUR; dispatchRoute(ac,rt,1,t); const l=ac.flight&&ac.flight.legs[0], own=!!l&&apOpenAt('MJM',l.dep+legProf(l,modelOf(ac)).total)&&apOpenAt('FIH',l.dep);
      const dst=tzAt('CDG',Date.UTC(2026,0,15))===1&&tzAt('CDG',Date.UTC(2026,6,15))===2&&tzAt('FIH',Date.UTC(2026,6,15))===1;
      return {n,bad,own,dst}; });
    ok(hz.bad===0&&hz.own&&hz.dst,'Horaires : aucun vol dans un aéroport fermé, heure d’été correcte',`${hz.bad} vol(s) concurrents aux heures fermées sur ${hz.n} ; votre vol de nuit reporté : ${hz.own} ; heure d’été : ${hz.dst}`);

    // 6 quater. réalités : mouvement présidentiel (aucun décollage ni atterrissage pendant la fermeture), pénurie de kérosène (vol annulé partout), affluence, correspondances
    const rz=await p.evaluate(()=>{ const o={vN:0,vBad:0,wins:0,over:0,fN:0,fBad:0,dem:false,own:false,tr:0,trBad:0,trA:0}; const T0=S.time, _b=atcRivalBlocked; atcRivalBlocked=()=>false;
      { const ws=new Set(); for(let h=0;h<12*24;h++){ const w=ahVip('FIH',T0+h*HOUR); if(w) ws.add(w.s); } o.wins=ws.size; }
      for(const [R,r] of rivRoutesAt('FIH').slice(0,30)){ const K=rivalSched(r); if(!K) continue; for(let i=0;i<K.nP;i++){ const c0=Math.floor((T0-K.anchors[i])/K.P); for(let c=c0;c<c0+Math.ceil(12*DAY/K.P);c++) for(const dir of ['AB','BA']){ const f=rivFlight(R,r,i,dir,c); if(!f||f.ops===false) continue;
        if(f.late>56) o.over++; if(f.tko&&f.from==='FIH'){ o.vN++; if(ahVipHit('FIH',f.tko,f.tko+MIN)) o.vBad++; } if(f.td&&f.to==='FIH'){ o.vN++; if(ahVipHit('FIH',f.td-90000,f.td)) o.vBad++; } } } }
      const seen=new Set(); for(const code of ['FKI','GOM','FBM','MJM','KGA','FKW']) for(const [R,r] of rivRoutesAt(code).slice(0,15)){ const K=rivalSched(r), k=(r.c||'')+r.a+r.b; if(!K||!K.fu||seen.has(k)) continue; seen.add(k);
        for(let i=0;i<K.nP;i++){ const c0=Math.floor((T0-K.anchors[i])/K.P); for(let c=c0;c<c0+Math.ceil(40*DAY/K.P);c++){ if(rivOps(K,r,i,c)||(K.cf&&!rivOpsAt(r,K,K.anchors[i],c))) continue; o.fN++; const f=rivFlight(R,r,i,'AB',c); if(f.ops!==false) o.fBad++; if(rivalPos(r,i,f.P+5*MIN)) o.fBad++; } } }
      atcRivalBlocked=_b;
      const D=(y,m,d,h)=>Date.UTC(y,m,d,h); o.dem=ahDemand('FIH','CDG',D(2026,2,13,8))>ahDemand('FIH','CDG',D(2026,2,10,8))&&ahDemand('FIH','CDG',D(2026,2,13,0))<ahDemand('FIH','CDG',D(2026,2,13,8))&&ahDemand('FIH','CDG',D(2026,11,18,8))>ahDemand('FIH','CDG',D(2026,2,13,8))&&ahDemand('FIH','JED',D(2026,4,20,8))>1.5;
      { let t=T0, w=null; for(let k=0;k<24*20&&!w;k++){ t+=HOUR; w=ahVip('FIH',t); } const ac=addAircraft('A20N',{hub:'FIH'}); for(let k=0;k<3;k++) S.pilots.push(makePilot([modelOf(ac).fam])); S.staff.pnc=(S.staff.pnc||0)+60; const rt=S.routes.find(x=>x.stops.join()==='FIH,BZV')||openLine(['FIH','BZV']); ac.readyAt=0; o.ownErr=dispatchRoute(ac,rt,1,w.s-12*MIN)||'';
        const m=modelOf(ac); o.own=!!(ac.flight&&ac.flight.legs.every(l=>{ const pr=legProf(l,m), s2=pr.segs.find(x=>x.ph===2), s7=pr.segs.find(x=>x.ph===7), s8=pr.segs.find(x=>x.ph===8); return !ahVipHit(l.from,l.dep+s2.t0,l.dep+s2.t1)&&!ahVipHit(l.to,l.dep+s7.t0,l.dep+s8.t0); })); }
      S.time=T0+(((11-ahLocalHour('ADD',T0))+24)%24)*HOUR; TM.code='ADD'; TM.th=null; TM.cache={}; TM.built=0; tmBuild(); const ts=TM.L.poi.some(x=>x.k==='tsec');
      for(const q of TM.ppl){ if(q.staff||q.crew||q.lead) continue; const tr=q.K.some(k=>/correspondance/i.test(k.st)); if(!tr) continue; if(q.dep) o.tr++; else o.trA++;
        if(q.K.some(k=>/enregistr|à la sûreté|police|immigration|passeport|douane|tapis n°|taxi/i.test(k.st))) o.trBad++; const last=q.K[q.K.length-1].st; if(q.dep&&!/passerelle|banc|nouveau vol|ne s’est pas présenté|raté|affichage de sa porte/.test(last)) o.trBad++; if(!q.dep&&!/jetée|correspondance/.test(last)) o.trBad++; }
      o.ts=ts; S.time=T0; TM.code='FIH'; TM.th=null; TM.cache={}; TM.built=0; return o; });
    ok(rz.wins>0&&rz.vN>50&&rz.vBad===0&&rz.over===0,'Mouvement présidentiel : aucun avion ne décolle ni n’atterrit pistes fermées',`${rz.vBad} vol(s) pendant la fermeture sur ${rz.vN} ; ${rz.wins} fermeture(s) en 12 jours ; ${rz.over} retard(s) > 56 min`);
    ok(rz.fN>0&&rz.fBad===0,'Pénurie de kérosène : vol annulé = absent de la carte, de la 3D et de l’aérogare',`${rz.fBad} écart(s) sur ${rz.fN} annulation(s)`);
    ok(rz.own,'Vos vols : décalés pendant un mouvement présidentiel',`${rz.own} ${rz.ownErr||''}`);
    ok(rz.dem,'Affluence selon le jour, l’heure et la saison (vendredi, nuit, Noël, pèlerinage)',`${rz.dem}`);
    ok(rz.ts&&rz.tr>50&&rz.trA>10&&rz.trBad===0,'Correspondances (Addis-Abeba) : ni enregistrement, ni immigration, ni douane',`${rz.tr} au départ, ${rz.trA} à l’arrivée, ${rz.trBad} erreur(s)`);

    // 6 quinquies. N'Djili : chaque avion sur son poste de la 3D, jamais deux avions au même poste, bus de piste, tout le monde à bord avant le repoussage, coin des vols nationaux
    const nj=await p.evaluate(()=>{ const T0=S.time; TM.code='FIH'; TM.th=null; TM.cache={}; TM.built=0; tmBuild(); const L=TM.L; let late=0,n=0,bus=0,arrBus=0,mism=0,ov=0,pairs=0;
      for(const q of TM.ppl){ if(!q.f) continue; if(q.dep===0&&q.K.some(k=>k.bus)) arrBus++; if(q.dep!==1) continue; const last=q.K[q.K.length-1]; if(/escalier/.test(last.st)){ n++; if(last.t>q.f.D.P+1000) late++; } if(q.K.some(k=>k.bus)) bus++; }
      for(const d of L.deps){ const gp=ndjGate(d.f,'FIH',0); if(gp&&Math.abs(ndjX(gp)-d.stand.x)>1) mism++; } for(const a of L.arrs){ const gp=ndjGate(a.f,'FIH',1); if(gp&&Math.abs(ndjX(gp)-a.door.x)>1) mism++; }
      for(let t=T0;t<T0+3*HOUR;t+=10*MIN){ const P=[]; for(const d of L.deps){ const q=tmDepPlane(d,t); if(q&&q.at) P.push([d.stand.x,d.stand.y,d.f.reg]); } for(const a of L.arrs){ const q=tmArrPlane(a,t); if(q&&q.at) P.push([a.door.x,a.sy,a.f.reg]); }
        for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++){ pairs++; if(Math.abs(P[i][0]-P[j][0])<60&&P[i][1]===P[j][1]&&P[i][2]!==P[j][2]) ov++; } }
      let gOv=0; { const code='FIH', x=Math.floor((T0+ahStd(code)*HOUR-12*HOUR)/DAY), M=rivGateBlock(code,x,true), byK=new Map(); for(const Lv of M.values()) for(const v of Lv) (byK.get(v.k)||byK.set(v.k,[]).get(v.k)).push(v); for(const [k,Lv] of byK) if(k<rivGateN(code)) for(let i=0;i<Lv.length;i++) for(let j=i+1;j<Lv.length;j++) if(Lv[i].s<Lv[j].e&&Lv[j].s<Lv[i].e) gOv++; }
      return {shape:L.shape,n,late,bus,arrBus,mism,ov,pairs,gOv,dom:L.ndDom||0}; });
    ok(nj.shape==='ndjili'&&nj.n>100&&nj.late===0&&nj.bus>0&&nj.arrBus>0&&nj.mism===0&&nj.ov===0&&nj.gOv===0,'N’Djili : chaque avion à son poste de la 3D, jamais deux au même poste, bus de piste, à bord avant le repoussage',`${nj.mism} poste(s) différent(s) de la 3D ; ${nj.ov} chevauchement(s) sur ${nj.pairs} ; ${nj.gOv} double(s) attribution(s) ; ${nj.late} en retard sur ${nj.n} ; ${nj.bus}/${nj.arrBus} en bus ; ${nj.dom} vol(s) nationaux`);

    // 6 sexies. aucun avion collé à un autre : aux postes et dans les raquettes d'attente (jamais en file serrée sur la voie de circulation)
    const cl=await p.evaluate(()=>{ const T0=S.time, o={};
      /* emprise réelle de l'avion dessiné : envergure 108 × longueur 104 (× échelle), nez au point donné ; chevauchement si les emprises se recouvrent (marge 15 %) */
      const box=(q,f)=>{ const sc=tmPSc(f), dx=-Math.sin(q.a||0), dy=Math.cos(q.a||0), cx=q.x-dx*52*sc, cy=q.y-dy*52*sc, hw=Math.abs(dy)*54*sc+Math.abs(dx)*52*sc, hh=Math.abs(dx)*54*sc+Math.abs(dy)*52*sc; return [cx,cy,f.reg,hw,hh]; };
      const hit=(A,B)=>Math.abs(A[0]-B[0])<(A[3]+B[3])*0.85&&Math.abs(A[1]-B[1])<(A[4]+B[4])*0.85;
      for(const code of ['FIH','ADD','BZV','NBO','CDG','LTN']){ S.time=T0+(((9-ahLocalHour(code,T0))+24)%24)*HOUR; TM.code=code; TM.th=null; TM.cache={}; TM.built=0; tmBuild(); const L=TM.L, t0=S.time; let ov=0,n=0,hold=0;
        for(let t=t0;t<t0+3*HOUR;t+=5*MIN){ const P=[]; for(const d of L.deps){ const q=tmDepPlane(d,t); if(q&&(q.at||q.hold)){ P.push(box(q,d.f)); if(q.hold) hold++; } } for(const a of L.arrs){ const q=tmArrPlane(a,t); if(q&&q.at) P.push(box(q,a.f)); }
          for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++){ n++; if(P[i][2]!==P[j][2]&&hit(P[i],P[j])) ov++; } }
        o[code]={ov,n,hold}; } S.time=T0; TM.code='FIH'; TM.th=null; TM.cache={}; TM.built=0; return o; });
    ok(Object.values(cl).every(x=>x.ov===0)&&cl.FIH.n>50,'Aucun avion collé : postes et raquettes d’attente (6 aéroports, emprise réelle des avions)',Object.entries(cl).map(([c,x])=>`${c} ${x.ov}/${x.n}`).join(' · '));

    // 6 septies. zoom : on peut toujours zoomer assez pour voir les gens en détail, même à Kinshasa (tarmac très large)
    const zm=await p.evaluate(async()=>{ const o={}; for(const c of ['FIH','ADD']){ TM.code=null; TM.th=null; tmOpen(c); await new Promise(r=>setTimeout(r,2500)); const w=TM.cv.clientWidth, h=TM.cv.clientHeight; for(let k=0;k<50;k++) tmZoomAt(1.25,w/2,h/2); o[c]=Math.round(3.3*TM.cam.s*10)/10; tmClose(); } return o; });
    ok(zm.FIH>=12&&zm.ADD>=12,'Zoom : les personnes assez grandes pour être bien vues (Kinshasa, Addis-Abeba)',`taille d’une personne au zoom maximal : Kinshasa ${zm.FIH} px, Addis-Abeba ${zm.ADD} px`);

    // 7. pas d'avion en double, pas de valise sortant d'un poste vide
    const dv=await p.evaluate(()=>{ const T0=S.time; let dup=0,orph=0; for(let t=T0;t<T0+8*HOUR;t+=30*MIN){ S.time=t; TM.code='FIH'; TM.cache={}; TM.built=0; tmBuild(); const regs={};
        for(const d of TM.L.deps){ if(tmDepPlane(d,t)&&d.f.reg) regs[d.f.reg]=(regs[d.f.reg]||0)+1; } for(const a of TM.L.arrs){ if(tmArrPlane(a,t)&&a.f.reg) regs[a.f.reg]=(regs[a.f.reg]||0)+1; }
        for(const v of Object.values(regs)) if(v>1) dup++;
        for(const a of TM.L.arrs){ if(a.f.soon) continue; const pl=tmArrPlane(a,t); if(pl&&pl.at) continue; for(const B of TM.bags) if(B.belt===a.belt&&t>=B.t0&&t<B.t0+B.dur*0.15){ orph++; break; } } }
      S.time=T0; return {dup,orph}; });
    ok(dv.dup===0,'Aucun avion affiché en double',`${dv.dup}`); ok(dv.orph===0,'Aucune valise sortant d’un poste vide',`${dv.orph}`);

    // 8. passager vedette : une seule identité, un vol à la fois
    const st=await p.evaluate(()=>{ const n=tmStarNext()||[]; const id=tmStarId({to:'FIH'}); return {n:n.length,age:id.age,job:id.job}; });
    ok(st.n>=1&&st.job==='écrivain renommé','Passager vedette : prochain vol annoncé, identité fixe',`${st.n} vol(s), ${st.age} ans`);

    ok(!errs.length,'Aucune erreur JavaScript dans le jeu',errs.slice(0,3).join(' | '));

    // 8 bis. construire un aéroport dans son pays (et pas à l'étranger), y ouvrir une ligne, racheter un aéroport, photo dans l'aérogare
    const ma=await p.evaluate(async()=>{ const o={}; let msg=''; const T=window.toast; window.toast=m=>{ msg=String(m); }; myApPicked(48.85,2.35); o.refusEtranger=/pas dans votre pays/.test(msg); window.toast=T; try{ closeModal(); }catch(e){}
      const m=myApBuild('m','Ville test','Aéroport test',-5.2,21.4); o.lance=typeof m==='object'; S.time=Math.max(S.time,m.done+HOUR); dailyTick(); o.ouvert=!!AP(m.code)&&AIRPORT_CODES.includes(m.code)&&runwaysOf(m.code).length>0;
      const ac=addAircraft('A20N',{hub:'FIH'}); for(let j=0;j<3;j++) S.pilots.push(makePilot(['A320'])); S.staff.pnc=(S.staff.pnc||0)+60; const rt=openLine(['FIH',m.code]); ac.readyAt=0; o.vol=dispatchRoute(ac,rt,1,S.time)||'ok';
      TM.code=null; tmOpen(m.code); await new Promise(r=>setTimeout(r,1500)); o.aerogare=(TM.ppl||[]).length; tmClose();
      const c0=S.cash; o.rachat=myApBuy('LAD')===true&&S.cash<c0;
      const cv=document.createElement('canvas'); cv.width=40; cv.height=50; cv.getContext('2d').fillRect(0,0,40,50); localStorage.setItem('se-appic-FIH',cv.toDataURL('image/jpeg')); TM.picImg=null; TM.code=null; tmOpen('FIH'); await new Promise(r=>setTimeout(r,2000)); o.photo=!!(TM.picImg&&TM.picImg.ok); tmClose(); localStorage.removeItem('se-appic-FIH'); o.code=m.code; return o; });
    ok(ma.refusEtranger&&ma.lance&&ma.ouvert&&ma.vol==='ok'&&ma.aerogare>0&&ma.rachat&&ma.photo,'Mes aéroports : construire (refusé à l’étranger), voler, racheter, photo',JSON.stringify(ma));

    // 9. sauvegarde puis rechargement (comme quand on ferme et rouvre le jeu) : tout doit continuer sans erreur
    await p.evaluate(()=>{ for(const R of S.rivals||[]) for(const r of R.routes||[]){ const K=rivalSched(r); if(K) for(let i=0;i<K.nP;i++) for(let t=S.time;t<S.time+DAY;t+=20*MIN) rivalPos(r,i,t); } save(); });
    const e0=errs.length; await p.reload(); await p.waitForTimeout(4000);
    const rl=await p.evaluate(async()=>{ const o={}; o.loaded=!!(typeof S!=='undefined'&&S&&S.fleet&&S.fleet.length); o.myAp=(S.myAp||[]).every(m=>!!AP(m.code))&&(S.myAp||[]).length>0; let n=0;
      for(const R of S.rivals||[]) for(const r of R.routes||[]){ const K=rivalSched(r); if(!K) continue; for(let i=0;i<K.nP;i++) for(let t=S.time;t<S.time+DAY;t+=15*MIN){ rivalPos(r,i,t); n++; } }
      o.n=n; try{ closeModal(); }catch(e){} TM.code=null; tmOpen('FIH'); await new Promise(r=>setTimeout(r,2500)); o.vis=(TM.pts||[]).length; tmClose(); return o; });
    ok(rl.loaded&&rl.myAp&&rl.vis>50&&errs.length===e0,'Après sauvegarde et rechargement : carte, 3D et aérogare sans erreur',`${rl.n} positions calculées, ${rl.vis} passagers visibles${errs.length>e0?' · '+errs.slice(e0,e0+2).join(' | '):''}`);

    // 10. heure de pointe à votre hub : beaucoup de gros porteurs de votre compagnie → assez de comptoirs, pas d'attente interminable à l'enregistrement
    const pk=await p.evaluate(()=>{ let t=S.time; while(new Date(t+HOUR).getUTCDay()!==5) t+=DAY; t+=(((20.5-ahLocalHour('FIH',t))+24)%24)*HOUR; const T0=S.time; S.time=t-3*HOUR;
      const D=['BZV','LAD','NBO','ADD','JNB','FBM','GOM','FKI','MJM','KGA','CDG','BRU','DLA','LOS','ACC','ABJ','DKR','CMN','DXB','IST']; S.staff.pnc=(S.staff.pnc||0)+900;
      for(let k=0;k<20;k++){ try{ const ac=addAircraft(k%2?'B77W':'A388',{hub:'FIH'}); for(let j=0;j<4;j++) S.pilots.push(makePilot([modelOf(ac).fam])); let rt=S.routes.find(x=>x.stops.join()==='FIH,'+D[k]); if(!rt) rt=openLine(['FIH',D[k]]); if(!rt||!rt.stops) continue; ac.readyAt=0; dispatchRoute(ac,rt,1,t-60*MIN+k*6*MIN); }catch(e){} }
      S.time=t; TM.code='FIH'; TM.th=null; TM.cache={}; TM.built=0; tmBuild(); let mx=0, own=0, missed=0, n=0;
      for(const g of TM.L.ckGroups){ const list=[].concat(...g.fl.map(x=>x._ckL||[])); for(const o of list) mx=Math.max(mx,o.start-o.arr); if(g.A.own) own=list.length; }
      for(const g of [...TM.L.deps,...TM.L.later]) for(const x of g.sched){ n++; if(x.ckStart>g.f.D.ci.close+3*MIN) missed++; } S.time=T0; return {mx:Math.round(mx/MIN),own,missed,n}; });
    ok(pk.own>2000&&pk.mx<=45&&pk.missed===0,'Heure de pointe à votre hub : assez de comptoirs d’enregistrement',`${pk.own} passagers de votre compagnie, attente maximale ${pk.mx} min, ${pk.missed} vol(s) manqué(s) à l’enregistrement sur ${pk.n}`);
  }catch(e){ ok(false,'Le test lui-même a planté',e.message); }
  finally{ try{ b&&await b.close(); }catch(e){} srv.close(); console.log(fails?`\n❌ ${fails} contrôle(s) en échec : NE PAS mettre en ligne.`:'\n✅ Tous les contrôles sont bons.'); process.exit(fails?1:0); }
})();
