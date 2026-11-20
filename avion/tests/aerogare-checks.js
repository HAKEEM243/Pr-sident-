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

    // 9. sauvegarde puis rechargement (comme quand on ferme et rouvre le jeu) : tout doit continuer sans erreur
    await p.evaluate(()=>{ for(const R of S.rivals||[]) for(const r of R.routes||[]){ const K=rivalSched(r); if(K) for(let i=0;i<K.nP;i++) for(let t=S.time;t<S.time+DAY;t+=20*MIN) rivalPos(r,i,t); } save(); });
    const e0=errs.length; await p.reload(); await p.waitForTimeout(4000);
    const rl=await p.evaluate(async()=>{ const o={}; o.loaded=!!(typeof S!=='undefined'&&S&&S.fleet&&S.fleet.length); let n=0;
      for(const R of S.rivals||[]) for(const r of R.routes||[]){ const K=rivalSched(r); if(!K) continue; for(let i=0;i<K.nP;i++) for(let t=S.time;t<S.time+DAY;t+=15*MIN){ rivalPos(r,i,t); n++; } }
      o.n=n; try{ closeModal(); }catch(e){} TM.code=null; tmOpen('FIH'); await new Promise(r=>setTimeout(r,2500)); o.vis=(TM.pts||[]).length; tmClose(); return o; });
    ok(rl.loaded&&rl.vis>50&&errs.length===e0,'Après sauvegarde et rechargement : carte, 3D et aérogare sans erreur',`${rl.n} positions calculées, ${rl.vis} passagers visibles${errs.length>e0?' · '+errs.slice(e0,e0+2).join(' | '):''}`);
  }catch(e){ ok(false,'Le test lui-même a planté',e.message); }
  finally{ try{ b&&await b.close(); }catch(e){} srv.close(); console.log(fails?`\n❌ ${fails} contrôle(s) en échec : NE PAS mettre en ligne.`:'\n✅ Tous les contrôles sont bons.'); process.exit(fails?1:0); }
})();
