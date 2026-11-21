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
   Plan détaillé vu de dessus (2D, fluide sur téléphone) : comptoirs, bornes, files à
   poteaux, scanners et portiques, police, commerces, restaurants, toilettes, salles
   d'attente, passerelles et avions, tapis à bagages, douane, hall des arrivées.
   Navigation : vue générale, zones, pincer pour zoomer, glisser pour se déplacer ;
   touchez un passager, un vol (tableau, porte) ou un équipement.
   ========================================================= */
'use strict';
const TM={open:false, code:null, cache:{}, raf:0, sel:null, dpr:1};
const TM_COL=['#f59e0b','#38bdf8','#a78bfa','#34d399','#f472b6','#fb7185','#facc15','#60a5fa','#4ade80','#c084fc'];
const TM_SKIN=['#5b3a24','#7a4a2a','#3f2516','#8d5a3b','#c99a73','#e8c2a0'];
const tmNow=()=>typeof gSimNow==='function'&&typeof G!=='undefined'&&G?gSimNow():S.time;
const tmHM=t=>{ try{ return fmtTime(t).split(' ').pop(); }catch(e){ const d=new Date(t); return d.getUTCHours()+':'+String(d.getUTCMinutes()).padStart(2,'0'); } };
function tmD(a,l){ const k=a.id+'|'+l.dep, c=TM.cache[k]; if(c&&performance.now()-c.at<20000) return c.D;
  let D=null; try{ D=pfData(a,l); const s2=legProf(l,modelOf(a)).segs.find(x=>x.ph===2); const pr=legProf(l,modelOf(a)); if(D&&s2) D.tko=l.dep+s2.t0; const s8=pr.segs.find(x=>x.ph===8); if(D&&s8) D.td=l.dep+s8.t0;
    const ho=pr.segs.find(x=>x.hold==='out'), hi=pr.segs.find(x=>x.hold==='in'), ga=pr.segs.find(x=>x.ga); if(D){ D.hold=ho?[l.dep+ho.t0,l.dep+ho.t1]:null; D.holdIn=hi?[l.dep+hi.t0,l.dep+hi.t1]:null; D.ga=ga?[l.dep+ga.t0,l.dep+ga.t1]:null; D.late=Math.round(((l.hOut||0)+(l.hIn||0)+(l.ga||0))/MIN); } }catch(e){} TM.cache[k]={D,at:performance.now()}; return D; }   // tko : décollage réel (comme en 3D)
// vols de vos avions qui passent par cet aéroport en ce moment
function tmFlights(code){
  const now=tmNow(), deps=[], arrs=[];
  for(const a of S.fleet){ const fl=a.flight; if(!fl||!fl.legs) continue;
    fl.legs.forEach((l,i)=>{ if(i<fl.li) return; if(l.from!==code&&l.to!==code) return; const D=tmD(a,l); if(!D) return;
      const N=D.total||Math.round((modelOf(a).seats||150)*0.8), fn=S.company.code+(typeof flightNumber==='function'?flightNumber(a):'');
      const man=()=>{ try{ return typeof manifestFor==='function'?manifestFor(a,l):null; }catch(e){ return null; } }, info={reg:a.reg,model:modelOf(a).name,acId:a.id};
      if(l.from===code&&now>=D.ci.open-5*MIN&&now<=Math.max(D.P+3*MIN,(D.tko||0)+MIN)) deps.push({a,l,D,N,fn,man:man(),...info});
      if(l.to===code&&i===fl.li&&now>=Math.min(D.arr-25*MIN,D.holdIn?D.holdIn[0]-5*MIN:Infinity)&&now<D.arr) arrs.push({a,l,D,N,fn,soon:true,...info}); }); }
  // vols posés récemment (tous) : passagers à l'immigration, aux bagages, à la douane, puis sortie
  const seen=new Set();
  try{ for(const x of S.tmRecent||[]){ if(x.leg.to!==code||now-x.t>80*MIN||now<x.t-2*MIN) continue; const a=S.fleet.find(z=>z.id===x.acId); if(!a) continue; const D0=tmD(a,x.leg); if(!D0) continue;
      const sh=x.t-D0.arr, mv=o=>{ const r={...o}; for(const k of ['open','close','first','last']) if(r[k]!=null) r[k]+=sh; return r; }, D={...D0,arr:x.t,imm:mv(D0.imm),bag:mv(D0.bag),cus:mv(D0.cus)};
      if(seen.has(D.key)) continue; seen.add(D.key); let man=null; try{ man=manifestFor({id:x.acId},x.leg); }catch(e){}
      arrs.push({a:{id:D.key},l:null,D,N:D.total||0,fn:x.fn,soon:false,man,reg:x.reg,model:x.model,acId:x.acId}); } }catch(e){}
  // vols déjà posés : leurs passagers sont encore dans l'aérogare (immigration, bagages, douane)
  try{ for(const x of (typeof pfArrivals==='function'?pfArrivals():[])){ const D=x.D; if(!D||!D.B||D.B.code!==code) continue; if(now>D.cus.close+15*MIN||seen.has(D.key)) continue; seen.add(D.key);
      let man=null; try{ if(x.leg&&typeof manifestFor==='function') man=manifestFor({id:x.acId},x.leg); }catch(e){}
      arrs.push({a:{id:D.key},l:null,D,N:D.total||0,fn:x.fno||x.fn||'',soon:false,man,reg:x.reg,model:x.model,acId:x.acId}); } }catch(e){}
  const F={deps,arrs,cancel:[]}; try{ tmRivals(code,now,F); }catch(e){}
  try{ for(const a of S.fleet) if(a.loc===code&&a.status!=='flight'&&a.blocked&&/grève|annul/i.test(a.blocked)) F.cancel.push({fn:S.company.code+(typeof flightNumber==='function'?flightNumber(a):''),dest:a.reg||'',why:a.blocked}); }catch(e){}
  try{ const w=null; if(w&&w.st) for(const f of F.deps) if(f.riv){ const dl=25+hashStr(f.D.key)%50; f.dl=dl; f.dlw='orage'; for(const k of ['P']) f.D[k]+=dl*MIN; f.D.gate.open+=dl*MIN; f.D.gate.last+=dl*MIN; f.D.gate.close+=dl*MIN; } }catch(e){}
  const allD=F.deps.slice(); F.deps=tmMix(F.deps,16,x=>(x.D.tko||x.D.P+8*MIN)<now-MIN?1e13+x.D.P:x.D.P).sort((x,y)=>x.D.P-y.D.P); { const gs=new Set(F.deps); F.later=allD.filter(f=>!gs.has(f)&&f.D.P>now).sort((x,y)=>x.D.P-y.D.P).slice(0,24); } /* départs : d'abord les vols encore à la porte (passagers dans l'aérogare) */ F.arrs=tmMix(F.arrs,8,x=>Math.abs(x.D.arr-(now-6*MIN))).sort((x,y)=>x.D.arr-y.D.arr); /* arrivées : ceux qui vont se poser (atterrissage visible sur la piste) et ceux qui viennent d'atterrir */
  try{ F.rivN=typeof rivPresentShown==='function'?rivPresentShown(code,now).length:0; }catch(e){ F.rivN=0; }
  try{ const shown=new Set([...F.deps,...F.arrs].map(f=>f.acId)); F.parked=S.fleet.filter(a=>{ if(shown.has(a.id)) return false; const fl=a.flight, lg=fl&&fl.legs&&fl.legs[fl.li]; if(a.status==='flight'&&lg) return lg.from===code&&now<lg.dep; return a.loc===code; }).slice(0,10).map(a=>({a,reg:a.reg,model:modelOf(a).name,why:a.status==='maint'?'en maintenance':a.status==='flight'?'en attente de son prochain vol':'stationné'})); }catch(e){ F.parked=[]; }
  return F;
}
// vols des autres compagnies : horaires réels du jeu (rivalSched), passagers estimés selon l'avion
function tmFakeD(key,A,B,P,arr,N,X){ const intl=A.cc!==B.cc, h=hashStr(key), P0=X&&X.P0||P;
  return {key,A,B,intl,P,arr,total:N,...(X?{tko:X.tko,td:X.td,holdIn:X.holdIn,ga:X.ga,late:X.late}:{}),ci:{open:P0-(intl?180:120)*MIN,close:P0-(intl?60:40)*MIN,online:Math.round(N*0.3)},sec:{close:P-25*MIN},pol:{close:P-20*MIN},
    gate:{name:String.fromCharCode(66+h%5)+(1+h%28),open:P-40*MIN,last:P-14*MIN,close:P-6*MIN,noShow:h%3},
    imm:{open:arr+6*MIN,close:arr+(N>200?55:40)*MIN},bag:{first:arr+(14+h%6)*MIN,last:arr+(30+h%14)*MIN},cus:{close:arr+70*MIN}}; }
function tmFakeMan(D,N,m){ try{ const j=Math.round(N*0.08); return manifestFor({id:'R'+D.key},{from:D.A.code,to:D.B.code,dep:D.P,pax:{f:0,j,w:0,y:N-j}}); }catch(e){ return null; } }
// le manifeste n'est calculé que pour les vols vraiment affichés (sinon l'ouverture est très lente)
function tmLazy(o,fl){ let m; Object.defineProperty(o,'man',{get(){ return m!==undefined?m:(m=fl.man||null); },set(v){ m=v; },enumerable:true,configurable:true}); return o; }
function tmRivals(code,now,F){
  if(typeof rivFlight!=='function') return; const A0=AP(code); let nd=0, na=0; const L=typeof rivRoutesAt==='function'?rivRoutesAt(code):[], seen=new Set();
  // les compagnies concurrentes du jeu, puis toutes les compagnies réelles qui desservent l'aéroport (les mêmes avions que sur la carte)
  for(const [R,r] of L){ if(nd>=40&&na>=24) break; const K=rivalSched(r); if(!K) continue; const fromA=r.a===code;
    for(let i=0;i<K.nP;i++) for(const kind of ['d','a']){ const dir=kind==='d'?(fromA?'AB':'BA'):(fromA?'BA':'AB'), x0=rivFlight(R,r,i,dir,0); if(!x0) continue;
      const ref=kind==='d'?x0.P:x0.arr, c0=Math.floor((now+(kind==='d'?180*MIN:0)-ref)/K.P);
      for(const cyc of [c0,c0-1]){ { const tt=rivTimes(K,r,i,dir,cyc); if(kind==='d'?(now<tt.P-190*MIN||now>tt.P+45*MIN):(now<tt.arr-60*MIN||now>tt.arr+75*MIN)) continue; }   /* hors de la fenêtre affichée : pas besoin de tout calculer */
        const fl=rivFlight(R,r,i,dir,cyc); if(!fl||fl.ops===false) continue;   /* vol annulé : aéroport fermé à l'heure prévue */ const other=AP(kind==='d'?fl.to:fl.from); if(!other) continue;
        if(kind==='d'&&nd<40&&now>=fl.P-185*MIN-(fl.depLate||0)*MIN&&now<=Math.max(fl.P+3*MIN,(fl.tko||0)+4*MIN)){ const D=tmFakeD(fl.key,A0,other,fl.P,fl.arr,fl.N,fl); try{ const pv=rivFlight(R,r,i,dir==='AB'?'BA':'AB',dir==='AB'?cyc-1:cyc); if(pv) D.prevArr=pv.arr; }catch(e){} F.deps.push(tmLazy({rr:fl.r,ri:fl.i,dl:fl.depLate||0,dlw:fl.depLate?(fl.vip?'mouvement présidentiel':fl.fuel?'pénurie de kérosène':fl.wxD?'météo':''):'',a:{id:fl.ac.id},l:null,D,N:fl.N,fn:fl.fn,riv:R,model:fl.ac.modelName,reg:fl.ac.reg,acId:fl.ac.id},fl)); nd++; }
        if(kind==='a'&&na<24&&now>=Math.min(fl.arr-20*MIN,fl.holdIn?fl.holdIn[0]-5*MIN:Infinity)&&now<=fl.arr+70*MIN){ const D=tmFakeD(fl.key,other,A0,fl.P,fl.arr,fl.N,fl); F.arrs.push(tmLazy({rr:fl.r,ri:fl.i,a:{id:fl.ac.id},l:null,D,N:fl.N,fn:fl.fn,riv:R,model:fl.ac.modelName,reg:fl.ac.reg,acId:fl.ac.id,soon:now<fl.arr},fl)); na++; } } } }
}
// garde un mélange réaliste : vos vols n'occupent pas toutes les portes quand d'autres compagnies partent aussi
function tmMix(list,n,key){ list.sort((x,y)=>key(x)-key(y));
  // ⭐ le vol Air France Paris ⇄ Kinshasa (passager vedette) est toujours affiché
  const pin=list.filter(f=>f.riv&&f.acId&&typeof tmStarOn==='function'&&tmStarOn({id:f.acId})).slice(0,2); if(pin.length){ const rest=tmMix(list.filter(f=>!pin.includes(f)),n-pin.length,key); return [...pin,...rest].sort((x,y)=>key(x)-key(y)); } const own=list.filter(f=>!f.riv), riv=list.filter(f=>f.riv); if(!riv.length||!own.length) return list.slice(0,n);
  const nOwn=Math.min(own.length,Math.max(Math.ceil(n*0.5),n-riv.length)); return [...own.slice(0,nOwn),...riv.slice(0,n-nOwn)].sort((x,y)=>key(x)-key(y)); }
/* ---------- PLAN DE L'AÉROGARE (coordonnées « monde » fixes : 1 unité ≈ 0,6 m) ----------
   x 0–640 : départs (bas → haut : parvis, hall d'enregistrement, sûreté, police / couloir national,
   zone d'embarquement avec commerces, portes) ; x 660–1000 : arrivées (haut → bas : couloir,
   immigration, salle des bagages, douane, hall des arrivées, parvis). Les avions sont au-dessus (y < 0).
   La taille de l'aéroport change l'équipement : petit aéroport = moins de bornes, de lignes de sûreté,
   de guichets, pas de duty free ; grand aéroport = salon business, plus de commerces. */
const TW={W:1000,H:1300,top:-300};
// THÈME de l'aérogare : dépend de la région, du pays et de l'aéroport (sol, matériaux, couleurs, boutiques, décor)
const TM_SHOPS={AF:[['dutyfree','🧵 Boutique de pagnes'],['resto','🍗 Maquis — grillades'],['cafe','☕ Café du pays'],['pharma','🎨 Artisanat local'],['press','📚 Presse']],
  EU:[['dutyfree','💄 Parfumerie — duty free'],['resto','🍷 Brasserie'],['cafe','🥐 Boulangerie'],['pharma','🍫 Chocolatier'],['press','📚 Librairie']],
  NA:[['dutyfree','🛍️ Duty free'],['resto','🍔 Burgers'],['cafe','☕ Coffee shop'],['pharma','🎧 Électronique'],['press','📰 News & books']],
  ME:[['dutyfree','💍 Bijouterie — duty free'],['resto','🥙 Grill oriental'],['cafe','☕ Café oriental'],['pharma','🌴 Dattes et douceurs'],['press','🧴 Parfums d’Orient']],
  AS:[['dutyfree','🛍️ Duty free'],['resto','🍜 Nouilles'],['cafe','🍵 Maison de thé'],['pharma','🍱 Bento'],['press','📚 Presse']]};
// orientation du plan : départs à gauche ou à droite, pistes en haut ou en bas (symétries autour du centre du monde)
const tmFx=x=>TM.th&&TM.th.mx?1000-x:x, tmFy=y=>TM.th&&TM.th.my?1000-y:y;
function tmTheme(code){ const T=tmTheme0(code); if(code==='FIH'){ T.mx=0; T.my=0; T.shape='ndjili'; } return T; }   /* N'Djili : plan réel (OpenStreetMap) */
function tmTheme0(code){ const A=AP(code)||{}, reg0=(COUNTRIES[A.cc]&&COUNTRIES[A.cc][1])||'EU', me=['MA','DZ','TN','EG','AE','SA','QA','OM','KW','BH','JO','LB','TR','IR','IQ','LY'].includes(A.cc), reg=me?'ME':reg0==='SA'?'NA':reg0==='OC'?'EU':reg0, h=hashStr(code||'X');
  const P={AF:{floor:['#efe4cc','#eadcc0','#f1e7d3'],acc:['#0e7490','#b45309','#15803d'],pat:['terrazzo','checker','grid'],deco:['palmiers','fontaine','fresque']},
    EU:{floor:['#eceff3','#e9e7e2','#eef0f2'],acc:['#1d4ed8','#0f172a','#7c3aed'],pat:['grid','diag','grid'],deco:['oeuvre','ecran','jardin']},
    NA:{floor:['#eef2f7','#e7ebef','#f0ede8'],acc:['#1e40af','#b91c1c','#0369a1'],pat:['grid','checker','diag'],deco:['ecran','oeuvre','fontaine']},
    ME:{floor:['#f3eadb','#f1e6d0','#efe3cc'],acc:['#b45309','#065f46','#9a3412'],pat:['marbre','marbre','checker'],deco:['fontaine','palmiers','oeuvre']},
    AS:{floor:['#eef2f1','#f0ece4','#e9eef0'],acc:['#dc2626','#047857','#4338ca'],pat:['bois','grid','bois'],deco:['jardin','oeuvre','ecran']}}[reg]||null;
  const T=P||{floor:['#e7e5e4'],acc:['#334155'],pat:['grid'],deco:['oeuvre']}, k=n=>T[n][h%T[n].length];
  return {reg,floor:k('floor'),acc:k('acc'),pat:T.pat[(h>>3)%T.pat.length],deco:T.deco[(h>>5)%T.deco.length],tile:[18,24,30][(h>>7)%3],carpet:['#7c2d12','#1e3a8a','#14532d','#581c87','#9f1239'][(h>>9)%5],mx:(h>>13)&1,my:0,shape:(()=>{ const c=A.cls||2, L=c<=2?['lineaire']:c>=4?['jetee','satellite','L','jetee','lineaire']:['lineaire','L','jetee']; return L[(h>>19)%L.length]; })(),facade:['droite','courbe','dents'][(h>>15)%3],seat:['rangees','ilots'][(h>>17)%2],canopy:['plat','ondule','arcs'][(h>>18)%3],shops:TM_SHOPS[reg]||TM_SHOPS.EU,swap:(h>>11)%3,name:A.name||('Aéroport de '+(A.city||code)),city:A.city||code,flag:(COUNTRIES[A.cc]&&COUNTRIES[A.cc][2])||'🌍'}; }
const tmOps=code=>{ S.tmOps=S.tmOps||{}; return S.tmOps[code]||(S.tmOps[code]={sec:0,pol:0,ck:0}); };
function tmPOI(cls){ const ops=tmOps(TM.code); const P=[], add=(k,x0,y0,x1,y1,lab,ico,o)=>{ const p={k,x0,y0,x1,y1,lab,ico,...(o||{})}; P.push(p); return p; };
  const small=cls<=2, big=cls>=4, nK=small?4:10, nL=Math.min(8,(small?3:6)+ops.sec), nB=Math.min(8,(small?3:6)+ops.pol), nA=small?3:5;
  for(let i=0;i<nK;i++){ const x=40+i*(560/nK); add('kiosk',x,1176,x+32,1192,'Borne d’enregistrement automatique','🖥️'); }
  add('info',560,1200,630,1228,'Comptoir d’information','ℹ️'); add('wc',8,1196,60,1228,'Toilettes (hall public)','🚻'); add('cafe',70,1198,170,1228,'Café du hall','☕');
  add('fids',232,1194,556,1233,'Grand écran des départs','📺',{big:1});
  for(let i=0;i<nL;i++){ const bw=640/nL, x=bw*i+(bw-80)/2; add('xray',x,846,x+60,862,'Scanner à bagages (rayons X) — ligne '+(i+1),'🧳',{lane:i}); add('arch',x+64,840,x+80,868,'Portique de détection — ligne '+(i+1),'🚪',{lane:i}); }
  for(let i=0;i<nB;i++){ const x=340+i*(300/nB); add('booth',x,736,x+34,756,'Guichet de police aux frontières '+(i+1),'🛂'); }
  { const TH=tmTheme(TM.code), L3=[[14,440,190,520],[310,440,470,540],[200,440,300,500]], o=[[0,1,2],[1,0,2],[2,1,0]][TH.swap], sl=k=>{ const x=TH.shops.find(z=>z[0]===k); return x?x[1]:k; }, sp=t=>[t.replace(/^\S+\s/,''),t.split(' ')[0]];
    if(!small){ const [l1,i1]=sp(sl('dutyfree')), [l2,i2]=sp(sl('resto')); add('dutyfree',...L3[o[0]],l1,i1); add('resto',...L3[o[1]],l2,i2); const [l4,i4]=sp(sl('pharma')); add('pharma',480,440,560,490,l4,i4); }
    const [l3,i3]=sp(sl('cafe')), [l5,i5]=sp(sl('press')); add('cafe',...(small?[200,440,300,500]:L3[o[2]]),l3,i3); add('press',570,440,630,490,l5,i5); }
  if(big){ add('lounge',480,500,630,590,'Salon business (accès réservé)','🛋️'); add('resto',14,530,190,590,'Restaurant rapide','🍔'); }
  add('wc',14,612,80,690,'Toilettes','🚻'); add('prayer',90,612,170,690,'Salle de prière','🕌'); add('wc',566,612,630,690,'Toilettes','🚻');
  add('seats',190,600,550,690,'Salle d’attente commune','💺'); add('transfer',196,576,330,594,'Comptoir de la compagnie (vols manqués, transferts)','🎫'); add('fids',240,560,400,574,'Écran des départs','📺');
  // ARRIVÉES : contrôle sanitaire, immigration (nationaux / étrangers / sas), salle des bagages, douane, hall d'accueil
  add('health',680,250,800,266,'Contrôle sanitaire — carnet de vaccination fièvre jaune, caméra thermique','🩺',{arr:1});
  const nN=small?2:3, nF=small?2:3;
  for(let i=0;i<nN;i++){ const x=676+i*(130/nN); add('booth',x,300,x+30,318,'Guichet immigration — passeports nationaux '+(i+1),'🛂',{arr:1,nat:1}); }
  for(let i=0;i<nF;i++){ const x=820+i*(130/nF); add('booth',x,300,x+30,318,'Guichet immigration — passeports étrangers '+(i+1),'🛂',{arr:1,nat:0}); }
  if(!small) add('egate',880,256,950,276,'Sas automatiques (passeports biométriques)','🛂',{arr:1});
  add('trolley',668,800,720,840,'Chariots à bagages','🛒',{arr:1}); add('lost',900,800,995,840,'Litiges bagages (valises perdues ou abîmées)','📋',{arr:1});
  add('green',680,880,830,900,'Douane — couloir vert (rien à déclarer)','🟢',{arr:1}); add('red',850,880,990,900,'Douane — couloir rouge (à déclarer)','🔴',{arr:1});
  add('xrayc',900,912,950,928,'Scanner de la douane (bagages contrôlés)','🧳',{arr:1});
  add('fidsA',672,1124,756,1140,'Écran des arrivées','📺',{arr:1}); add('atm',940,1102,990,1124,'Distributeurs de billets','🏧',{arr:1}); add('atm',180,1200,222,1228,'Distributeur de billets','🏧');
  add('change',668,1150,740,1190,'Bureau de change','💱',{arr:1}); add('cafe',750,1150,840,1190,'Café des arrivées','☕',{arr:1}); add('car',850,1150,920,1190,'Location de voitures','🚗',{arr:1});
  add('wc',930,1150,995,1190,'Toilettes (arrivées)','🚻',{arr:1}); add('info',668,1100,740,1130,'Accueil — informations, hôtels','ℹ️',{arr:1});
  add('taxi',680,1244,990,1272,'Station de taxis et bus','🚕',{arr:1});
  return {P,nL,nB,nA,small,big}; }
// file d'attente en serpentin dans un rectangle (entrée en bas → sortie en haut)
function tmSnake(x0,y0,x1,y1,rows){ const pts=[]; for(let r=0;r<rows;r++){ const y=y1-(r+0.5)*(y1-y0)/rows; if(r%2===0) pts.push({x:x0,y},{x:x1,y}); else pts.push({x:x1,y},{x:x0,y}); } return pts; }
function tmPath(pts){ let L=0; const seg=[]; for(let i=1;i<pts.length;i++){ const d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y); seg.push(d); L+=d; } return {pts,seg,L}; }
function tmPathAt(P,u){ let d=Math.max(0,Math.min(1,u))*P.L; for(let i=0;i<P.seg.length;i++){ if(d<=P.seg[i]){ const a=P.pts[i], b=P.pts[i+1], k=P.seg[i]?d/P.seg[i]:0; return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k}; } d-=P.seg[i]; } return P.pts[P.pts.length-1]; }
// N'Djili (FIH) d'après OpenStreetMap : une seule piste 06/24 ; au sud, du sud-ouest au nord-est : aire 1 et aérogare de la MONUSCO,
// aérogare internationale, aérogare nationale, pavillon présidentiel (VIP), tour de contrôle, aire 3 et hangar.
// L'aire 2 compte 16 postes numérotés, sans passerelle télescopique : on va à l'avion à pied ou en bus de piste.
const TM_NDJ_PN=[9,10,11,12,1,13,2,3,4,14,5,6,15,7,16,8];
// N'Djili : chaque avion sur SON poste de la 3D (même rangée le long de la piste, même ordre, mêmes écarts de 85 m → 100 px)
const NDJ_CX=450, NDJ_K=100/85, NDJ_R1=-410;   /* seconde rangée de l'aire éloignée : de l'autre côté de la voie de circulation, nez vers la piste (comme en 3D) */
function ndjDir(){ try{ const ap=apronOf('FIH'); return ap&&ap.rw&&ap.rw.hdg<180?1:-1; }catch(e){ return 1; } }   /* +1 : la gauche de l'écran est au sud-ouest (MONUSCO), comme en vrai */
function ndjX(p){ try{ const ap=apronOf('FIH'); if(!p||!ap||!ap.rw) return null; return NDJ_CX+ndjDir()*(toRw(ap.rw,p).a-ap.a)*NDJ_K; }catch(e){ return null; } }
// rangée du poste : 0 = rangée des postes, 1 = deuxième rangée de l'aire éloignée (plus près de la piste)
function ndjY(p){ try{ const ap=apronOf('FIH'); if(!p||!p.remote||!ap||!ap.rw) return -64; const row=Math.round(Math.abs(toRw(ap.rw,p).x-ap.x)/95); return row>=1?NDJ_R1:-64; }catch(e){ return -64; } }
function ndjGate(f,code,arr){ try{ if(f.acId){ const ac=S.fleet.find(x=>x.id===f.acId); if(ac) return gateSlot(code,ac,arr?!!f.D.intl:(typeof depIntl==='function'?depIntl(ac,ac.flight):!!f.D.intl)); }
    if(f.rr){ const intl=AP(f.rr.a).cc!==AP(f.rr.b).cc; return typeof rivGatePt==='function'?rivGatePt(code,f.rr,f.ri,arr?f.D.arr:f.D.P-MIN,intl):gateSlot(code,{id:f.rr.a+f.rr.b+f.ri},intl); } }catch(e){} return null; }
// les postes de la 3D (une porte tous les 85 m), numérotés de gauche à droite
function ndjStands(){ const code='FIH', key=(AP(code)||{}).xp||0; if(TM._nds&&TM._nds.key===key) return TM._nds.l; const g=(typeof apGates==='function'&&apGates(code))||[], n=g.length||22, l=[];
  for(let k=0;k<n;k++){ const x=ndjX(slotPt(code,k)); if(x!=null) l.push({k,x}); } l.sort((a,b)=>a.x-b.x); l.forEach((s2,j)=>{ s2.pn=j+1; }); TM._nds={key,l}; return l; }
const ndjPn=x=>{ let b=null,bd=1e9; for(const s2 of ndjStands()){ const d=Math.abs(s2.x-x); if(d<bd){ bd=d; b=s2; } } return b&&bd<20?b.pn:''; };
const TM_PK_X=118, TM_PK_Y=120;   /* postes de l'aire éloignée : un gros porteur tient sans toucher ses voisins */
function tmStairs(st,f){ const sc=tmPSc(f), up=Math.abs((st.a||0)-Math.PI)<0.1; return up?{x:st.x+12*sc+5,y:st.y+15*sc}:{x:st.x-12*sc-5,y:st.y-15*sc}; }   /* avion tourné vers la piste : porte avant gauche de l'autre côté */   /* pied de l'escalier, porte avant gauche */
function tmLayout(F){
  const nd=Math.max(1,F.deps.length), na=Math.max(1,F.arrs.length), cls=(AP(TM.code)||{}).cls||3, Q=tmPOI(cls), L={poi:Q.P, nL:Q.nL, nB:Q.nB, small:Q.small, big:Q.big, deps:[], arrs:[]};
  TM.th=TM.th||tmTheme(TM.code); const shape=TM.code==='FIH'?'ndjili':L.small?'lineaire':TM.th.shape; L.shape=shape;
  // jetée ou satellite : le grand hall vers les portes devient un vrai hall (restauration, duty free, détente, jeux, tapis roulant)
  if(shape==='jetee'||shape==='satellite'){ const H=(k,x0,y0,x1,y1,lab,ico)=>L.poi.push({k,x0,y0,x1,y1,lab,ico,hall:1});
    H('resto',20,56,284,170,'Food court · cuisines du monde','🍲'); H('seats',20,188,284,300,'Espace détente','🛋️'); H('kids',20,318,150,392,'Aire de jeux pour enfants','🧸'); H('wc',164,318,284,392,'Toilettes','🚻');
    H('dutyfree',356,56,620,170,'Grand duty free','🛍️'); H('cafe',356,188,620,284,'Café panoramique','☕'); H('press',356,302,476,392,'Librairie · presse','📚'); H('pharma',496,302,620,392,'Pharmacie','💊'); L.hall=1; } L.top=-300; L.bx0=-40; L.bx1=1040;
  L.kin=(AP(TM.code)||{}).cc==='CD'; if(L.kin){ for(const x of [40,135,230,325]) L.poi.push({k:'ebola',x0:x,y0:1242,x1:x+70,y1:1252,lab:'Contrôle Ebola · QR code',ico:'🦠'}); L.poi.push({k:'ebola',x0:500,y0:1242,x1:570,y1:1252,lab:'Contrôle Ebola · QR code',ico:'🦠'}); }   /* aéroports congolais : QR code Ebola obligatoire avant le voyage */
  L.tf=L.hall?tmTransitFrac(TM.code):0; if(L.tf) L.poi.push({k:'tsec',arr:1,x0:664,y0:226,x1:800,y1:240,lab:'Contrôle des correspondances (transit)',ico:'🔁'});   /* grands hubs : les passagers en correspondance restent côté piste */
  const seatGrid=(x0,x1,y0,y1)=>{ const out=[]; if(TM.th.seat==='ilots'){ for(let yy=y0+18;yy<y1-12;yy+=40) for(let xx=x0+18;xx<x1-12;xx+=32) for(let k=0;k<8;k++){ const a=k/8*6.283; out.push({x:xx+Math.cos(a)*11,y:yy+Math.sin(a)*11}); } }
    if(!out.length) for(let yy=y0+6;yy<y1-6;yy+=15) for(let xx=x0+8;xx<x1-8;xx+=9) out.push({x:xx,y:yy}); return out; };
  // porte « en haut » (façade, aile, satellite) : avion nez vers le bâtiment, passerelle au milieu
  const topGate=(f,x0,x1,y0,y1,via)=>{ const lounge={x0,x1,y0,y1}, desk={x:(x0+x1)/2,y:y0+40}, door={x:(x0+x1)/2,y:y0-2};
    return {f,x0,x1,lounge,seats:seatGrid(x0,x1,y0+86,y1-24),desk,bq:tmPath(tmSnake(x0+8,desk.y+10,x1-8,desk.y+44,2)),door,stand:{x:door.x,y:y0-104,a:0},push:186,turn:door.x<320?1:-1,via}; };
  // porte « sur le côté » (jetée) : avion garé le long de la jetée
  const sideGate=(f,x0,x1,y0,y1,left,via)=>{ const ym=(y0+y1)/2, lounge={x0,x1,y0,y1}, dx=left?x0:x1, desk={x:left?x0+22:x1-22,y:ym-18}, door={x:dx,y:ym};
    return {f,x0,x1,lounge,seats:seatGrid(x0+4,x1-4,ym,y1),desk,bq:tmPath(tmSnake(left?x0+34:x0+6,y0+30,left?x1-6:x1-34,ym-4,2).reverse()),door,stand:{x:left?x0-40:x1+40,y:ym,a:left?-Math.PI/2:Math.PI/2},push:90,turn:left?-1:1,via}; };
  const ckOrd=F.deps.map((f,i)=>i).sort((a,b)=>{ const A=tmAirline(F.deps[a]), B=tmAirline(F.deps[b]); return (B.own-A.own)||A.name.localeCompare(B.name)||F.deps[a].D.P-F.deps[b].D.P; }), ckPos=[]; ckOrd.forEach((i,k)=>ckPos[i]=k);
  const ndRank=[]; if(shape==='ndjili'){ F.deps.map((f,i)=>i).sort((a,b)=>((!F.deps[a].D.intl)-(!F.deps[b].D.intl))||a-b).forEach((i,j)=>ndRank[i]=j); L.ndDom=F.deps.filter(f=>!f.D.intl).length; }
  F.deps.forEach((f,i)=>{ let g;
    if(shape==='jetee'){ const k=Math.floor(i/2), left=i%2===0, y1=-k*120-12, y0=y1-100, ym=(y0+y1)/2; g=sideGate(f,left?150:380,left?260:490,y0,y1,left,[{x:320,y:405,st:'se dirige vers la jetée'},{x:320,y:-4,st:'entre dans la jetée'},{x:320,y:ym,st:'marche dans la jetée'}]); L.pierEnd=Math.min(L.pierEnd||0,y0-14); }
    else if(shape==='satellite'){ const sw=Math.max(440,Math.min(960,nd*120)), sx0=320-sw/2, bw=sw/nd, x0=sx0+i*bw+3, x1=sx0+(i+1)*bw-3; L.satX=[sx0-10,sx0+sw+10]; g=topGate(f,x0,x1,-690,-478,[{x:320,y:405,st:'se dirige vers la navette'},{x:320,y:-4,st:'prend la navette automatique'},{x:320,y:-456,st:'dans la navette vers le satellite',v:9},{x:320,y:-520,st:'entre dans le satellite'}]); }
    else if(shape==='L'){ const bw=1060/nd, x0=-420+i*bw+3, x1=-420+(i+1)*bw-3, wing=x1<=10; g=topGate(f,x0,x1,44,392,wing?[{x:24,y:404,st:'se dirige vers l’aile des portes'},{x:-20,y:300,st:'passe dans l’aile des portes'}]:null); }
    else if(shape==='ndjili'){ const bw=640/nd, j=ndRank[i], x0=j*bw+3, x1=(j+1)*bw-3; g=topGate(f,x0,x1,44,392,null); const gp=ndjGate(f,TM.code,0), gx=ndjX(gp), sx=gx!=null?gx:-550+((i*7)%16)*100, sy=ndjY(gp), up=sy<TM_TWY; g.stand={x:sx,y:sy,a:up?Math.PI:0}; g.push=up?TM_TWY-sy:Math.max(60,sy-TM_TWY+4); g.turn=(sx<NDJ_CX?-1:1)*(up?-1:1); g.pn=ndjPn(sx)||'éloigné'; g.dom=!f.D.intl; }   /* son poste en 3D ; salle d'embarquement : internationaux à gauche, nationaux à droite */
    else { const bw=640/nd, x0=i*bw+3, x1=(i+1)*bw-3; g=topGate(f,x0,x1,44,392,null); }
    if(shape!=='ndjili'&&shape!=='jetee'&&g.x1-g.x0+6<84&&i%2===1){ g.stand={...g.stand,y:g.stand.y-115}; g.push=Math.max(60,g.push-115); }   /* portes serrées : un poste sur deux dans une seconde rangée, décalée (les ailes ne se touchent plus) */
    L.deps.push(g); });
  L.later=(F.later||[]).map(f=>({f,later:1}));
  { const grp=new Map(); for(const g of [...L.deps,...L.later]){ const A=tmAirline(g.f); if(!grp.has(A.name)) grp.set(A.name,{A,fl:[]}); grp.get(A.name).fl.push(g); }
    const G=[...grp.values()].sort((a,b)=>(b.A.own-a.A.own)||a.A.name.localeCompare(b.A.name)), tot=G.reduce((t,x)=>t+Math.min(4,x.fl.length)+1,0); let x=0;
    L.ckGroups=G.map((gr,ix)=>{ const w=610*(Math.min(4,gr.fl.length)+1)/Math.max(1,tot), cx0=x+3, cx1=x+w-3; x+=w; const ck={x0:cx0+4,x1:cx1-4,y:1012}, q=tmPath(tmSnake(ck.x0+2,1032,ck.x1-2,1148,6)), o={A:gr.A,fl:gr.fl,ck,q,cx0,cx1,z:'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.min(23,ix)]};
      for(const g of gr.fl){ g.ck=ck; g.q=q; g.cx0=cx0; g.cx1=cx1; g.grp=o; } return o; }); }
  if(shape==='jetee') L.top=Math.min(-300,(L.pierEnd||-200)-150); if(shape==='satellite'){ L.top=-1020; L.bx0=Math.min(-40,(L.satX||[0])[0]-60); L.bx1=Math.max(1040,(L.satX||[0,0])[1]+60); } if(shape==='L') L.bx0=-460;
  L.cargo=cls>=3; L.vip=TM.code==='FIH'||TM.code==='FBM'; if(L.cargo||L.vip) L.bx1+=230;   /* à droite du tarmac : terminal fret (et salon d'honneur à Kinshasa et Lubumbashi) */
  if(shape==='ndjili') L.top-=200;   /* place pour la seconde rangée de l'aire éloignée, au-dessus de la voie */
  if(shape==='ndjili') L.poi.push({k:'visa',arr:1,x0:676,y0:46,x1:800,y1:150,lab:'Visa à l’arrivée · 90 $',ico:'🛂'});   /* N'Djili : salle des visas à l'arrivée pour les étrangers */
  if(shape==='ndjili'){ L.nd=1; const xs=ndjStands().map(s2=>s2.x).concat(L.deps.map(d=>d.stand.x),L.arrs.map(a=>a.door.x)); L.bx0=Math.min(-1240,Math.min(...xs)-200); L.bx1=Math.max(2120,Math.max(...xs)+200); }   /* N'Djili : aire 1 (MONUSCO) à gauche, aire 2 devant les aérogares, aire 3 et fret à droite */
  { const np=Math.round(((F.parked||[]).length+(F.rivN||0))*1.15)+1, per=Math.max(1,Math.floor((L.bx1-40-(L.bx0+60))/TM_PK_X)+1), rows=Math.min(8,Math.ceil(np/per)); if(np>1) L.top-=58+rows*TM_PK_Y; L.parkRows=rows; L.parkPer=per; }   /* assez de rangées de postes éloignés pour tous les avions présents (comme en 3D) */   // postes éloignés pour les avions stationnés
  L.parkTop=L.top; L.rwyY=L.top-64; L.rwyA=L.rwyY-80; L.top-=216;   /* deux pistes au-dessus de l'aire de stationnement : décollages (la plus proche) et atterrissages */
  TW.top=L.top;
  const aCols=na>4?Math.ceil(na/2):na, aSlot=[]; { const sl=[]; for(let c=0;c<aCols;c+=2) sl.push(c); for(let c=1;c<aCols;c+=2) sl.push(aCols+c); for(let c=1;c<aCols;c+=2) sl.push(c); for(let c=0;c<aCols;c+=2) sl.push(aCols+c);   /* gros porteurs jamais côte à côte */
    const ord=F.arrs.map((f,i)=>i).sort((a,b)=>(tmPSc(F.arrs[b])>=0.95)-(tmPSc(F.arrs[a])>=0.95)||a-b); ord.forEach((i,j)=>aSlot[i]=sl[j]!=null?sl[j]:j); }
  F.arrs.forEach((f,i)=>{ const bw=340/na, x0=660+i*bw+3, x1=660+(i+1)*bw-3, si=aSlot[i], row=si<aCols?0:1, col=row?si-aCols:si, sw=340/aCols, cx=row?Math.min(992,660+(col+1)*sw):660+(col+0.5)*sw;   /* arrivées : deux rangées décalées, 85 px entre deux avions */
    const BP=[(i%2)?915:745,492+Math.floor((i%8)/2)*92]; if(L.nd){ const gp=ndjGate(f,TM.code,1), gx=ndjX(gp), ax=gx!=null?gx:850+((i*5)%8)*100; L.arrs.push({f,x0,x1,door:{x:ax,y:38},sy:ndjY(gp),ent:{x:830,y:4},pn:ndjPn(ax)||'éloigné',belt:{cx:BP[0],cy:BP[1],rx:56,ry:24,n:i+1}}); return; } L.arrs.push({f,x0,x1,door:{x:cx,y:38},sy:row?-175:-60,belt:{cx:BP[0],cy:BP[1],rx:56,ry:24,n:i+1}}); });
  if(L.nd) for(const a of L.arrs){ L.bx0=Math.min(L.bx0,a.door.x-200); L.bx1=Math.max(L.bx1,a.door.x+200); }   /* aire éloignée : le tarmac va jusqu'au dernier avion */
  L.rx0=L.bx0; L.rx1=L.bx1; L.bx0-=780; L.bx1+=420;   /* raquettes d'attente au bout de la voie de circulation, des deux côtés */
  L.secQ=tmPath(tmSnake(600,880,110,940,4));   /* entrée côté couloir, avance vers les scanners */ L.secQp=tmPath([{x:38,y:944},{x:38,y:900},{x:24,y:900},{x:24,y:878}]); L.polQ=tmPath(tmSnake(330,760,630,800,3)); L.immQn=tmPath(tmSnake(672,334,808,404,4).reverse()); L.immQf=tmPath(tmSnake(818,334,955,404,4).reverse());
  return L; }
/* ---------- SIMULATION DES FILES (phase 2) : guichets en nombre limité, premier arrivé premier servi ----------
   Comptoirs du vol (D.ci.desks), lignes de sûreté communes, guichets de police communs : quand
   beaucoup de passagers arrivent en même temps, la file s'allonge vraiment, et l'attente s'affiche. */
function tmServe(list,servers,svc){ const free=new Array(Math.max(1,servers)).fill(-Infinity); list.sort((a,b)=>a.arr-b.arr);
  for(const x of list){ let k=0; for(let j=1;j<free.length;j++) if(free[j]<free[k]) k=j; x.start=Math.max(x.arr,free[k]); x.done=x.start+svc(x); free[k]=x.done; } }
// part des passagers en correspondance (vols internationaux) dans les grands hubs
const TM_HUB={ADD:0.6,DOH:0.65,DXB:0.55,IST:0.5,CDG:0.32,AMS:0.38,FRA:0.4,LHR:0.3,NBO:0.3,JNB:0.25,CMN:0.3};
function tmTransitFrac(code){ if(TM_HUB[code]) return TM_HUB[code]; try{ if(S.company&&S.company.hub===code) return 0.2; }catch(e){} return 0; }
// arrivée tardive à l'aéroport : rare, mais plus fréquente dans les villes embouteillées aux heures de pointe, sous la pluie, pour les hommes d'affaires pressés
const TM_TRAFFIC={FIH:2.2,LOS:2.2,NBO:1.8,CAI:1.8,LAD:1.6,DLA:1.5,DKR:1.4,ABJ:1.4,ACC:1.4,FBM:1.3,CGK:1.8,MNL:1.8,DAC:1.8,BKK:1.5,DEL:1.6,BOM:1.6,KHI:1.6,IST:1.5,MEX:1.6,GRU:1.5,LIM:1.5,BOG:1.5};
// gravité des embouteillages du jour (déterministe) : certains jours, la ville est bloquée
function tmJam(code,t){ const tr=TM_TRAFFIC[code]||1; if(tr<=1) return {f:1,lvl:0}; const L=new Date(t+(typeof tzAt==='function'?tzAt(code,t):1)*HOUR), key=code+L.getUTCFullYear()+'-'+L.getUTCMonth()+'-'+L.getUTCDate(), h=(typeof ahH==='function'?ahH('jam'+key):hashStr(key))%100;
  return h<15?{f:3.2,lvl:2}:h<45?{f:1.5,lvl:1}:{f:1,lvl:0}; }
function tmLateArr(D,x,row,i){ const code=TM.code, r=pfRng(D.key+'|late'+i), u=r(), tr=TM_TRAFFIC[code]||1, jam=tmJam(code,D.ci.close), h=typeof ahLocalHour==='function'?ahLocalHour(code,D.ci.close):12, rush=(h>=6.5&&h<9.5)||(h>=16&&h<19.5);
  let wet=false; try{ if(TM._wxK!==code+'|'+Math.floor(tmNow()/(30*MIN))){ TM._wxK=code+'|'+Math.floor(tmNow()/(30*MIN)); const w=typeof towerWx==='function'?towerWx(code):null; TM._wet=!!(w&&(w.st||w.vis<4000)); } wet=TM._wet&&Math.abs(D.ci.close-tmNow())<3*HOUR; }catch(e){}
  let p=0.012*tr*(rush?(tr>1?1.6:1.25):1)*(wet?1.5:1)*(h<5||h>=22?0.6:1); if(row){ if(row.purp==='business') p*=1.4; if((row.age||35)>=65) p*=0.5; if(row.purp==='family') p*=0.8; }
  p*=jam.f; p=Math.min(jam.lvl===2?0.2:0.08,p); if(u>=p) return null;
  const why=wet?'la pluie a bloqué la circulation':jam.lvl===2?'énormes embouteillages : la ville est bloquée':tr>1&&rush?'embouteillages sur la route de l’aéroport':['réveil trop tard','taxi arrivé en retard','a oublié son passeport et a dû faire demi-tour','s’est trompé d’heure de vol'][Math.floor(r()*4)];
  return {t:D.ci.close+(4+r()*22)*MIN,why}; }
function tmSched(L){
  const secL=[], polL=[], W={ck:[],sec:[],pol:[]};
  const ALL=[...L.deps,...(L.later||[])];
  for(const g of ALL){ const f=g.f, D=f.D, N=Math.min(f.N,1600), sc=[], ckL=[]; g._ckL=ckL; g.sched=sc;
    for(let i=0;i<N;i++){ const r=pfRng(D.key+'|sc'+i), tIn=D.ci.open+(D.ci.close-D.ci.open)*Math.pow(r(),0.85)*0.97, online=r()<(D.ci.online||0)/Math.max(1,f.N), bags=r()<0.8, kiosk=!(online&&!bags)&&(online||r()<0.3);
      const row=f.man&&f.man.rows&&f.man.rows[i]; const x={i,tIn,online,bags:row?row.bags>0:bags,kiosk,r:r(),wc:r()<0.12,alarm:r()<0.1,row}; if(row&&row.star){ x.tIn=D.ci.open+12*MIN; x.alarm=false; x.wc=false; } if(row){ x.kiosk=!(online&&!x.bags)&&(online||x.r<0.3); }
      if(L.tf&&D.intl&&!(row&&row.star)&&pfRng(D.key+'|tr'+i)()<L.tf){ x.transit=1; x.online=true; x.bags=false; x.kiosk=false; x.wc=false; x.alarm=false; const rm=pfRng(D.key+'|trm'+i)(); if(rm<0.04&&!g.later){ x.missed=1; x.tIn=D.gate.close+(2+rm*400)*MIN; } }   /* en correspondance : pas d'enregistrement ni de sûreté côté ville, valises transférées d'avion à avion */
      if(!x.transit&&!(row&&row.star)){ const lt=tmLateArr(D,x,row,i); if(lt){ x.tIn=lt.t; x.late=lt.why; if(!(x.online&&!x.bags)) x.kiosk=false; } }   /* arrive trop tard : ça dépend des embouteillages, de la pluie, du voyageur… */
      sc.push(x); if(x.transit){ x.ckStart=x.ckDone=x.tIn; continue; }
      if(x.online&&!x.bags){ x.ckStart=x.ckDone=x.tIn+MIN; } else ckL.push({x,arr:x.tIn+(x.kiosk?3.5:1.5)*MIN}); }   /* heure réelle d'arrivée (retard compris) */
    g._desks=Math.max(1,Math.max(D.ci.desks||0,Math.ceil(f.N/35))); }
  for(const gr of L.ckGroups||[]){ const list=[].concat(...gr.fl.map(g=>g._ckL||[])); gr.desks=Math.max(1,Math.min(200,gr.fl.reduce((t,g)=>t+(g._desks||1),0)+tmOps(TM.code).ck));   /* une grande compagnie ouvre autant de comptoirs que nécessaire à son hub */ tmServe(list,gr.desks,o=>(o.x.bags?1.8:1.2)*MIN*(0.7+0.6*o.x.r));
    for(const o of list){ o.x.ckStart=o.start; o.x.ckDone=o.done; W.ck.push([o.arr,o.start-o.arr]); } }
  for(const g of ALL){ const f=g.f, D=f.D, sc=g.sched;
    // embarquement par zones : priorité (affaires, familles), puis zones 1 à 4
    const win=Math.max(MIN,(D.gate.last-D.gate.open)/5);
    const maxRow=Math.max(1,...sc.map(x=>x.row?parseInt(x.row.seat)||1:1));
    for(const x of sc){ const rw=x.row; x.zone=rw?((rw.cls==='f'||rw.cls==='j'||rw.assist||rw.age<6)?0:1+Math.min(3,Math.floor((1-(parseInt(rw.seat)||1)/(maxRow+1))*4))):(x.i<f.N*0.08?0:1+Math.floor((x.i/Math.max(1,f.N))*4)); x.board=D.gate.open+x.zone*win+x.r*win*0.9;
      if(!x.transit) secL.push({x,arr:x.ckDone+(x.wc?7:3)*MIN,D}); }
    g.sched=sc; }
  const depN=ALL.reduce((a,g)=>a+g.sched.length,0), intlN=ALL.reduce((a,g)=>a+g.sched.filter(x=>g.f.D.intl||(x.row&&g.f.D.A&&x.row.nat!==g.f.D.A.cc)).length,0); L.secCap=Math.max(L.nL,Math.min(80,Math.ceil(depN/150))); L.polCap=Math.max(L.nB,Math.min(80,Math.ceil(intlN/70)));   /* grand hub chargé : on ouvre plus de lignes de sûreté et de guichets de police */
  { const pr=secL.filter(o=>o.x.zone===0), nm=secL.filter(o=>o.x.zone!==0); tmServe(pr,1,o=>0.3*MIN*(0.6+0.8*o.x.r)); tmServe(nm,Math.max(1,L.secCap-1),o=>0.35*MIN*(0.6+0.8*o.x.r)); } for(const o of secL){ o.x.secStart=o.start; o.x.secDone=o.done+(o.x.alarm?2.5*MIN:0)+0.6*MIN; W.sec.push([o.arr,o.start-o.arr]); if(o.D.intl||(o.x.row&&o.D.A&&o.x.row.nat!==o.D.A.cc)) polL.push({x:o.x,arr:o.x.secDone+1.5*MIN}); }
  tmServe(polL,L.polCap||L.nB,o=>0.5*MIN*(0.6+0.8*o.x.r)); for(const o of polL){ o.x.polStart=o.start; o.x.polDone=o.done; W.pol.push([o.arr,o.start-o.arr]); }
  L.W=W; }
function tmWait(list,now){ let s=0,n=0; for(const [a,w] of list) if(a>now-25*MIN&&a<=now){ s+=w; n++; } return n?Math.round(s/n/MIN):0; }
// ---------- passagers : itinéraire complet avec comportements ----------
function tmSpd(row){ if(!row) return 1; const a=row.age||35; let v=a>=78?0.55:a>=66?0.75:a>=55?0.9:a<10?0.95:1; if(row.purp==='business') v*=1.18; if(row.assist) v*=0.8; return v*(0.93+((row.i*37)%15)/100); }
function tmKF(sp){ const K=[]; let t=0, x=0, y=0; sp=sp||1;
  const o={K, sp, at(tt,px,py,st){ t=tt; x=px; y=py; K.push({t,x,y,st}); return o; },
    walk(px,py,st,v){ const d=Math.hypot(px-x,py-y), dt=Math.max(8000,d/((v||2)*(v?1:sp))*1000); t+=dt; x=px; y=py; K.push({t,x,y,st,walk:1}); return o; },
    stay(tt,st,sit){ t=Math.max(t+4000,tt); K.push({t,x,y,st,sit}); return o; },
    queue(P,tt,st){ const a=P.pts[0]; o.walk(a.x,a.y,st); t=Math.max(t+6000,tt); const e=P.pts[P.pts.length-1]; x=e.x; y=e.y; K.push({t,x,y,st,path:P,q:1}); return o; },
    get t(){ return t; } }; return o; }
const tmJ=(r,a,b)=>a+(b-a)*r();
function tmPick(L,k,r){ const c=L.poi.filter(p=>p.k===k&&!p.arr); return c.length?c[Math.floor(r()*c.length)]:null; }
function tmIn(p,r){ return {x:tmJ(r,p.x0+4,p.x1-4),y:tmJ(r,p.y0+4,p.y1-4)}; }
const TM_AISLE=1163, TM_COR=626;   /* allée sous les files, couloir vers la sûreté */
function tmDepKF(g,i,L){
  const f=g.f, D=f.D, sc=g.sched[i], r=pfRng(D.key+'|tm'+i), N=f.N, k=tmKF(tmSpd(sc.row)), intl=D.intl;
  if(sc.transit){ if(tmTransitDep(k,g,sc,r,L)) return k.K; } else {
  const kinX=L.kin?pfRng(D.key+'|lane'+i)():1, fast=L.kin&&sc.row&&(sc.row.wealth==='rich'||sc.row.purp==='business')&&kinX<0.8;
  k.at(sc.tIn,L.kin?(fast?tmJ(r,470,620):tmJ(r,30,430)):tmJ(r,30,610),1290,sc.late?'⏰ arrive en retard à l’aéroport ('+sc.late+')':L.kin?(fast?'arrive par la voie rapide (payante, militaires) : dépose-minute 10 $':'arrive par la voie normale : il y a du monde'):'arrive à l’aéroport'+(sc.bags?' avec ses valises':''));
  if(L.kin){ const bs=L.poi.filter(p=>p.k==='ebola'&&(fast?p.x0>=500:p.x0<500)), b=bs[Math.floor(pfRng(D.key+'|eb'+i)()*bs.length)]; if(b){ k.walk(tmJ(r,b.x0+4,b.x1-4),b.y1+6,'contrôle Ebola : présente son QR code de santé').stay(k.t+(15+r()*30)*1000,'🦠 contrôle Ebola : l’agent scanne son QR code');
      if(pfRng(D.key+'|ebx'+i)()<0.006&&!(sc.row&&sc.row.star)){ k.stay(k.t+(4+r()*4)*MIN,'⛔ pas de QR code Ebola valide : voyage refusé').walk(tmJ(r,30,430),1295,'repart sans pouvoir voyager'); k.K[k.K.length-1].out=1; return k.K; } } }
  if(sc.online&&!sc.bags) k.walk(tmJ(r,40,600),TM_AISLE+tmJ(r,-3,3),'carte d’embarquement sur le téléphone');
  else{ if(sc.kiosk){ const ks=L.poi.filter(p=>p.k==='kiosk'), kb=ks[Math.floor(r()*ks.length)]; k.walk((kb.x0+kb.x1)/2,kb.y1+6,'va à une borne automatique').stay(k.t+(1.5+r()*1.5)*MIN,'imprime sa carte d’embarquement'); }
    { const e=g.q.pts[0]; k.walk(e.x,TM_AISLE,'va vers les comptoirs '+(g.grp?g.grp.z+' · ':'')+tmAirline(f).name); }   /* rejoint SA file par l'allée, sans traverser celle des autres compagnies */
    k.queue(g.q,sc.ckStart,'fait la queue à l’enregistrement · '+tmAirline(f).name);
    if(sc.ckStart>D.ci.close+3*MIN){ const inf=L.poi.find(p=>p.k==='info'&&!p.arr), q=tmIn(inf,r); k.walk(tmJ(r,g.ck.x0+3,g.ck.x1-3),g.ck.y+12,'au comptoir').stay(k.t+MIN,'⛔ enregistrement clôturé : vol manqué').walk(g.cx1-2,g.ck.y+14,'repart par le côté').walk(g.cx1-2,TM_AISLE,'repart par l’allée')
        .walk(q.x,q.y-10,'va au comptoir d’information').stay(k.t+(8+r()*8)*MIN,'⚠️ se fait replacer sur un autre vol').walk(tmJ(r,30,610),1290,'quitte l’aéroport'); k.K[k.K.length-1].out=1; return k.K; }
    k.walk(tmJ(r,g.ck.x0+3,g.ck.x1-3),g.ck.y+12,'au comptoir · '+tmAirline(f).name).stay(sc.ckDone,sc.bags?'enregistre ses bagages':'enregistrement');
    k.walk(g.cx1-2,g.ck.y+14,'repart par le côté de sa file').walk(g.cx1-2,TM_AISLE,'rejoint l’allée'); }
  if(sc.wc){ const w=L.poi.find(p=>p.k==='wc'&&p.y0>1100); const q=tmIn(w,r); k.walk(q.x,q.y,'va aux toilettes').stay(k.t+(3+r()*2)*MIN,'aux toilettes').walk(q.x,TM_AISLE,'revient dans l’allée'); }
  k.walk(TM_COR,TM_AISLE,'longe le hall vers la sûreté').walk(TM_COR,952,'couloir vers la sûreté');   /* par le couloir, jamais à travers les comptoirs */
  const prio=sc.zone===0&&L.nL>1, lane=prio?0:(L.nL>1?1+Math.floor(r()*(L.nL-1)):0), xr=L.poi.find(p=>p.k==='xray'&&p.lane===lane), ar=L.poi.find(p=>p.k==='arch'&&p.lane===lane);
  k.queue(prio?L.secQp:L.secQ,sc.secStart,prio?'coupe-file prioritaire à la sûreté':'fait la queue à la sûreté').walk(xr.x0+20,xr.y1+6,'pose ses affaires dans les bacs').stay(k.t+30000,'pose ses affaires au scanner').walk((ar.x0+ar.x1)/2,ar.y0-4,'passe le portique');
  if(sc.alarm) k.stay(k.t+2.5*MIN,'⚠️ alarme : palpation de sécurité');
  if(sc.polStart){ const fo=!intl; const bs=L.poi.filter(p=>p.k==='booth'&&!p.arr), b=bs[Math.floor(r()*bs.length)];
    k.queue(L.polQ,sc.polStart,'fait la queue à la police aux frontières').walk((b.x0+b.x1)/2,b.y0-6,'au guichet de police').stay(Math.max(k.t+30000,sc.polDone),fo?'étranger sur un vol national : contrôle du passeport et du visa par la police':'contrôle du passeport'); if(fo) k.walk(tmJ(r,40,300),760,'rejoint le couloir des vols nationaux'); }
  else k.walk(tmJ(r,40,300),760,'couloir des vols nationaux'); }
  const noShow=i>=N-(D.gate.noShow||0); let board=sc.board, gateA=Math.max(k.t+4*MIN,D.gate.open-(2+r()*16)*MIN); if(board<gateA+2*MIN) gateA=board-2*MIN;
  if(tmDelay(f)&&r()<0.14&&k.t<gateA-14*MIN){ const tr=L.poi.find(p=>p.k==='transfer'), q=tr&&tmIn(tr,r); if(q) k.walk(q.x,q.y-12,'vol retardé : va se renseigner').stay(k.t+(2+r()*3)*MIN,'demande des nouvelles du vol retardé au comptoir de la compagnie'); }
  const acts=['dutyfree','cafe','resto','wc','pharma','press','seats','prayer','lounge',...(L.hall&&sc.row&&sc.row.purp==='family'?['kids','kids']:[])], W={kids:'avec les enfants à l’aire de jeux',dutyfree:'fait du shopping au duty free',cafe:'prend un café',resto:'mange au restaurant',wc:'aux toilettes',pharma:'à la pharmacie',press:'achète un journal',seats:'attend dans la salle commune',prayer:'à la salle de prière',lounge:'se détend au salon business'};
  let guard=0; while(k.t<gateA-6*MIN&&guard++<12){ /* flâne côté piste jusqu'à l'approche de l'embarquement */ let a=acts[Math.floor(r()*acts.length)]; if(a==='lounge'&&sc.zone!==0) a='seats'; const p=tmPick(L,a,r); if(!p||tmClosed(a,k.t)) continue; const q=tmIn(p,r), dur=(a==='resto'?20:a==='cafe'?10:a==='wc'?4:a==='seats'||a==='lounge'||a==='kids'?18:7)*(0.6+r()*0.8)*MIN;
    k.walk(q.x,q.y,'se dirige vers : '+p.lab).stay(Math.min(gateA-3*MIN,k.t+dur),W[a]||p.lab,a==='resto'||a==='cafe'||a==='seats'||a==='lounge'); if(a==='dutyfree'||a==='pharma'||a==='press') k.K.shopT=k.K.shopT||k.t; }
  if(g.later&&k.t>D.gate.close-2.5*MIN){ const tr=L.poi.find(p=>p.k==='transfer'), q=tmIn(tr,r); k.walk(q.x,q.y-12,'⚠️ trop tard : son vol est fermé').stay(k.t+(10+r()*10)*MIN,'⚠️ a raté son vol, se fait replacer au comptoir de la compagnie'); k.K[k.K.length-1].out=1; return k.K; }   /* trop en retard : même règle que pour les vols qui ont déjà leur porte */
  if(g.later){ const p=tmPick(L,'seats',r), q=p?tmIn(p,r):{x:tmJ(r,200,540),y:tmJ(r,610,680)}; { const lp=k.K[k.K.length-1], eta=k.t+Math.max(8000,Math.hypot(q.x-lp.x,q.y-lp.y)/(2*k.sp)*1000)+MIN; if(eta>D.gate.close-2.5*MIN){ const tr=L.poi.find(p=>p.k==='transfer'), q2=tmIn(tr,r); k.walk(q2.x,q2.y-12,'⚠️ trop tard : son vol est fermé').stay(k.t+(10+r()*10)*MIN,'⚠️ a raté son vol, se fait replacer au comptoir de la compagnie'); k.K[k.K.length-1].out=1; return k.K; } } k.walk(q.x,q.y,'regarde les écrans : porte pas encore affichée').stay(Math.max(k.t+MIN,D.gate.open-MIN),'attend l’affichage de sa porte (vol '+f.fn+')',1); return k.K; }   /* la porte est attribuée avant l'embarquement : le trajet est alors recalculé jusqu'à l'avion */
  if(noShow){ k.stay(D.gate.close+20*MIN,'⚠️ ne s’est pas présenté à la porte'); return k.K; }
  const s=g.seats[(i*37)%Math.max(1,g.seats.length)]||{x:(g.x0+g.x1)/2,y:200}, zl=sc.zone===0?'priorité (affaires, familles)':'zone '+sc.zone;
  { let px=k.K[k.K.length-1].x, py=k.K[k.K.length-1].y, d=0; for(const v of [...(g.via||[]),s]){ d+=Math.hypot(v.x-px,v.y-py)/(v.v||2*k.sp); px=v.x; py=v.y; } const est=k.t+d*1000+8000;
    if(est>D.gate.close-2.5*MIN){ const tr=L.poi.find(p=>p.k==='transfer'), q=tmIn(tr,r); k.walk(q.x,q.y-12,'⚠️ trop tard : la porte '+D.gate.name+' est fermée').stay(k.t+(10+r()*10)*MIN,'⚠️ a raté son vol, se fait replacer au comptoir de la compagnie'); k.K[k.K.length-1].out=1; return k.K; }
    if(est>board-1.5*MIN) board=Math.min(D.gate.close-150000,est+40000); }   /* marge : file et contrôle de la carte avant la fermeture */
  for(const v of g.via||[]) k.walk(v.x,v.y,v.st,v.v);
  if(r()<0.08&&k.t<board-14*MIN){ const top=g.door.y<g.lounge.y0+4, wp=top?{x:g.door.x+tmJ(r,-50,50),y:g.door.y+9}:{x:g.door.x+(g.door.x<=g.lounge.x0+1?9:-9),y:g.door.y+tmJ(r,6,44)}; k.walk(wp.x,wp.y,'se rend à la porte '+D.gate.name).stay(Math.min(board-6*MIN,k.t+(4+r()*10)*MIN),'regarde les avions par la baie vitrée'); }
  k.walk(s.x,s.y,'se rend à la porte '+D.gate.name).stay(board-1.5*MIN,'assis à la porte, attend l’appel ('+zl+')',1);
  { const n0=k.K.length, l0=k.K[n0-1]; k.queue(g.bq,board-12000,'file d’embarquement — '+zl); const lq=k.K[k.K.length-1], tDesk=k.t+Math.max(8000,Math.hypot(g.desk.x-lq.x,g.desk.y-lq.y)/(2*k.sp)*1000+300); if(tDesk+7000>D.gate.close){ k.K.length=n0; k.at(l0.t,l0.x,l0.y,l0.st); const tr=L.poi.find(p=>p.k==='transfer'), q2=tmIn(tr,r); k.walk(q2.x,q2.y-12,'⚠️ trop tard : la porte '+D.gate.name+' est fermée').stay(k.t+(10+r()*10)*MIN,'⚠️ a raté son vol, se fait replacer au comptoir de la compagnie'); k.K[k.K.length-1].out=1; return k.K; } }   /* arrivé après la fermeture de la porte : vol manqué */
  k.walk(g.desk.x+tmJ(r,-6,6),g.desk.y,'présente sa carte d’embarquement').stay(k.t+10000,'contrôle de la carte à la porte').walk(g.door.x,g.door.y,L.nd?'sort sur le tarmac':'entre dans la passerelle');
  if(L.nd){ k.walk(g.door.x+tmJ(r,-10,10),g.door.y+12,'palpation par un agent de sécurité avant le bus').stay(k.t+(20+r()*25)*1000,'🔎 palpation : l’agent vérifie qu’il n’a rien d’interdit sur lui'); tmApronDep(k,g,r); } else { const st=g.stand, n={x:-Math.sin(st.a),y:Math.cos(st.a)}; k.walk(st.x+n.x*4,st.y+n.y*4,'marche dans la passerelle jusqu’à l’avion',1.6); }
  k.K[k.K.length-1].out=1; return k.K; }
// correspondance au départ : descend d'un autre vol, contrôle de transit, porte dans le mur central, hall, puis comme les autres jusqu'à sa porte
const TM_TRDOOR=[[724,190,'🔁 suit le panneau « Correspondances »'],[652,210,'franchit l’accès des correspondances'],[630,210,'entre en zone internationale, côté piste']];
function tmTransitDep(k,g,sc,r,L){ const D=g.f.D, ts=L.poi.find(p=>p.k==='tsec'), to=D.B.city;
  k.at(sc.tIn,tmJ(r,780,900),188,'🔁 descend de son premier vol : correspondance pour '+to);
  k.walk(TM_TRDOOR[0][0],TM_TRDOOR[0][1],TM_TRDOOR[0][2]).walk(tmJ(r,ts.x0+4,ts.x1-4),ts.y0-4,'contrôle des correspondances').stay(k.t+(1+r()*1.5)*MIN,'contrôle de sûreté des correspondances (bagage à main au scanner)');
  for(const [x,y,st] of TM_TRDOOR.slice(1)) k.walk(x,y,st);
  k.walk(tmJ(r,360,600),tmJ(r,200,270),'traverse le hall').walk(320,405,'descend vers les commerces').walk(tmJ(r,300,600),432,'zone des commerces · correspondance pour '+to);
  if(sc.missed){ const tr=L.poi.find(p=>p.k==='transfer'), q=tmIn(tr,r), b=tmPick(L,'seats',r), z=b?tmIn(b,r):{x:tmJ(r,200,540),y:tmJ(r,610,680)};
    const hl=typeof ahLocalHour==='function'?ahLocalHour(TM.code,k.t):12, nuit=hl>=18||hl<4;   /* le soir : plus de vol avant demain */
    k.walk(q.x,q.y-12,'⚠️ correspondance manquée : son premier vol est arrivé en retard').stay(k.t+(10+r()*12)*MIN,nuit?'⚠️ au comptoir de transfert : replacé sur le vol de demain':'⚠️ au comptoir de transfert : replacé sur un vol plus tard dans la journée');
    if(nuit) k.walk(z.x,z.y,'cherche un banc pour la nuit').stay(k.t+(4+r()*4)*HOUR,'😴 dort sur un banc en attendant son vol de demain',1);
    else k.walk(z.x,z.y,'s’installe dans la salle d’attente').stay(k.t+(2+r()*3)*HOUR,'attend son nouveau vol (correspondance manquée)',1);
    k.K[k.K.length-1].out=1; return true; }
  return false; }
// sans passerelle (N'Djili) : à pied si l'avion est proche, sinon bus de piste (départs groupés toutes les 2 minutes : tous les passagers d'un bus roulent ensemble)
const TM_BUS_T=2*MIN;
function tmApronDep(k,g,r){ const D=g.f.D, s=tmStairs(g.stand,g.f), bx=g.door.x, by=-14, far=true, dl=D.P-20000;   /* tout le monde à bord 20 s avant le repoussage */
  if(far){ k.walk(bx+tmJ(r,-6,6),by+tmJ(r,-2,6),'sort sur le tarmac : bus de piste pour le poste '+g.pn); k.walk(bx,by,'monte dans le bus de piste'); const tS=k.t, t0=D.gate.open, dist=Math.hypot(s.x+18-bx,s.y+14-by);
    let vb=Math.max(9,dist/150), rideT=Math.max(8000,dist/vb*1000), tb=t0+Math.ceil((tS+15000-t0)/TM_BUS_T)*TM_BUS_T; const latest=dl-rideT-18000;
    if(tb>latest){ tb=Math.max(tS+4000,latest); if(tb+rideT+18000>dl){ rideT=Math.max(8000,dl-18000-tb); vb=dist/(rideT/1000); } }   /* en retard : dernier bus, tout de suite et plus vite */
    k.stay(tb,'🚌 dans le bus de piste, attend le départ'); k.K[k.K.length-1].bus=1;
    k.walk(s.x+18,s.y+14,'🚌 dans le bus de piste vers le poste '+g.pn,vb); k.K[k.K.length-1].bus=1; k.walk(s.x+tmJ(r,2,10),s.y+tmJ(r,4,10),'descend du bus au pied de l’avion',3); }
  else { const tx=s.x+tmJ(r,2,10), ty=s.y+tmJ(r,4,12), dd=Math.hypot(tx-k.K[k.K.length-1].x,ty-k.K[k.K.length-1].y), left=dl-10000-k.t; k.walk(tx,ty,'marche sur le tarmac jusqu’à l’avion (poste '+g.pn+')',left>8000&&dd/(2*k.sp)*1000>left?dd/(left/1000):undefined); }
  k.walk(s.x,s.y,'monte l’escalier de l’avion',1.2); }
function tmArrKF(g,i,L,lost){
  const f=g.f, D=f.D, r=pfRng(D.key+'|tma'+i), N=Math.max(1,f.N), row0=f.man&&f.man.rows&&f.man.rows[i], bags0=r()<0.85, k=tmKF(tmSpd(row0)), bags=row0?row0.bags>0:bags0, b=g.belt, intl=D.intl;
  const row=f.man&&f.man.rows&&f.man.rows[i], yf=intl&&typeof PF_YF!=='undefined'&&PF_YF.has(D.B.cc), nat=row?row.nat===D.B.cc:r()<0.45, refused=intl&&!nat&&i>=N-((D.imm&&D.imm.refused)||0);
  if(L.nd&&g.ent){ const E=g.ent, s=tmStairs({x:g.door.x,y:g.sy,a:g.sy<TM_TWY?Math.PI:0},f), far=true;   /* à N'Djili, toujours le bus de piste */ k.at(D.arr+5*MIN+(i/N)*14*MIN,s.x,s.y,'descend l’escalier de l’avion');
    if(far){ const b0=D.arr+6*MIN, bx=s.x+18, by=s.y+14; k.walk(bx+tmJ(r,-6,6),by+tmJ(r,4,10),'attend le bus de piste au pied de l’avion'); const tb=b0+Math.ceil((k.t+15000-b0)/TM_BUS_T)*TM_BUS_T;
      k.walk(bx,by,'monte dans le bus de piste'); k.stay(tb,'🚌 dans le bus de piste, attend le départ'); k.K[k.K.length-1].bus=1; k.walk(E.x,-16,'🚌 dans le bus de piste vers l’aérogare',Math.max(9,Math.hypot(E.x-bx,-16-by)/150)); k.K[k.K.length-1].bus=1; k.walk(E.x+tmJ(r,-10,10),-4,'descend du bus devant l’aérogare'); }
    else k.walk(E.x+tmJ(r,-10,10),-4,'marche sur le tarmac vers l’aérogare');
    k.walk(E.x+tmJ(r,-8,8),38,'entre dans l’aérogare (arrivées)').walk(E.x+tmJ(r,-8,8),120,'couloir des arrivées');
    const vz=L.poi.find(p=>p.k==='visa'), forg=intl&&(row?row.nat!=='CD':pfRng(D.key+'|nat'+i)()<0.4); if(vz&&forg){ if(pfRng(D.key+'|visa'+i)()<0.35){ const z=tmIn(vz,r); k.walk(z.x,z.y,'salle des visas à l’arrivée').stay(k.t+(15+Math.pow(r(),1.6)*75)*MIN,'🛂 attend son visa à l’arrivée (90 $)',1).walk(E.x+tmJ(r,-8,8),160,'visa obtenu : vers l’immigration'); } else k.walk(E.x+tmJ(r,-8,8),150,'a déjà son visa (obtenu avant le voyage) : direct à l’immigration'); } }   /* environ 1 étranger sur 3 prend le visa à l'arrivée, les autres l'ont déjà */
  else k.at(D.arr+5*MIN+(i/N)*14*MIN,g.door.x,(g.sy||-60)+3,'sort de l’avion par la porte avant').walk(g.door.x,g.door.y,'marche dans la passerelle',1.6).walk(g.door.x+tmJ(r,-8,8),120,'marche dans la jetée');
  const tx=Math.min(980,Math.max(676,L.nd&&g.ent?g.ent.x:g.door.x)); k.walk(tx,186,'monte sur le tapis roulant').walk(820+tmJ(r,-6,6),186,'sur le tapis roulant',3.6);
  if(L.tf&&intl&&!lost&&L.poi.some(p=>p.k==='tsec')&&pfRng(D.key+'|tra'+i)()<L.tf){ const ts=L.poi.find(p=>p.k==='tsec'), NX=[...L.deps,...(L.later||[])].filter(g2=>g2.f.D.intl&&g2.f.D.P>D.arr+50*MIN), nx=NX.length?NX[i%NX.length]:null, dest=nx?' pour '+nx.f.D.B.city:'';
    k.walk(TM_TRDOOR[0][0],TM_TRDOOR[0][1],TM_TRDOOR[0][2]+dest).walk(tmJ(r,ts.x0+4,ts.x1-4),ts.y0-4,'contrôle des correspondances (reste en zone internationale)').stay(k.t+(1+r()*1.5)*MIN,'contrôle de sûreté des correspondances (bagage à main au scanner)');
    for(const [x,y,st] of TM_TRDOOR.slice(1)) k.walk(x,y,st);
    const hp=L.poi.filter(p=>p.hall&&['cafe','dutyfree','seats','resto'].includes(p.k)), h=hp.length&&r()<0.6?hp[Math.floor(r()*hp.length)]:null;
    if(h){ const z=tmIn(h,r); k.walk(z.x,z.y,'se dirige vers : '+h.lab).stay(k.t+(8+r()*25)*MIN,'en correspondance'+dest+' : '+h.lab,h.k!=='dutyfree'); }
    k.walk(320,tmJ(r,180,300),'rejoint le tapis roulant de la jetée').walk(320,-4,'🔁 part vers la porte de son vol en correspondance'+dest+' (valises transférées directement)',3.6); k.K[k.K.length-1].out=1; return {K:k.K,bags:false,bagT:0}; }   /* ne passe ni l'immigration, ni les bagages, ni la douane */
  const ctl=intl||(!!row&&!nat), IM=D.imm||{open:D.arr+8*MIN,close:D.arr+40*MIN};
  if(!ctl){ k.walk(983,232,'arrivées nationales (sans contrôle)').walk(983,430,'couloir des arrivées nationales'); }
  else{ if(yf){ const h=L.poi.find(p=>p.k==='health'); k.walk(tmJ(r,h.x0+6,h.x1-6),h.y1+6,'contrôle sanitaire').stay(k.t+20000,'montre son carnet de vaccination fièvre jaune');
      if(r()<0.012) k.stay(k.t+(5+r()*5)*MIN,'⚠️ pas de carnet fièvre jaune : vaccination sur place'); }
    const immB=Math.max(k.t+2*MIN,IM.open)+r()*Math.max(4*MIN,(IM.close-IM.open)*(nat?0.5:0.85)), eg=!nat&&!L.small&&r()<0.25;
    if(eg){ const q=L.poi.find(p=>p.k==='egate'); k.walk(tmJ(r,q.x0+4,q.x1-4),q.y1+6,'sas automatique').stay(k.t+40000,'passe le sas biométrique'); }
    else{ const bs=L.poi.filter(p=>p.k==='booth'&&p.arr&&!!p.nat===nat), bo=bs[Math.floor(r()*bs.length)];
      k.queue(nat?L.immQn:L.immQf,immB-MIN,nat?'file des passeports nationaux':'file des passeports étrangers').walk((bo.x0+bo.x1)/2,bo.y1+6,'au guichet d’immigration').stay(k.t+(nat?40000:75000),nat?'contrôle du passeport':intl?'contrôle du passeport, du visa et des empreintes':'étranger arrivé d’un vol national : contrôle du passeport et du visa');
      if(refused){ k.stay(k.t+(8+r()*6)*MIN,'⛔ refus d’entrée : sera renvoyé par le prochain vol').walk(820,200,'escorté vers la zone de retour par la police'); k.K[k.K.length-1].out=1; return {K:k.K,bags:false,bagT:0}; } } }
  if(bags&&r()<0.6){ const t=L.poi.find(p=>p.k==='trolley'), q=tmIn(t,r); k.walk(q.x,q.y,'va chercher un chariot').stay(k.t+12000,'prend un chariot à bagages'); }
  const an=r()*6.283, bp={x:b.cx+Math.cos(an)*(b.rx+10),y:b.cy+Math.sin(an)*(b.ry+10)};
  const bagT=bags?Math.max(k.t+2*MIN,D.bag.first+r()*(D.bag.last-D.bag.first)):k.t+MIN;
  k.walk(bp.x,bp.y,bags?'va au tapis n° '+b.n:'traverse la salle des bagages').stay(lost?D.bag.last+3*MIN:bagT,bags?'attend sa valise au tapis n° '+b.n:'sans bagage en soute');
  if(lost){ const q=tmIn(L.poi.find(p=>p.k==='lost'),r); k.walk(q.x,q.y,'⚠️ sa valise n’est pas arrivée').stay(k.t+(8+r()*8)*MIN,'⚠️ déclare sa valise perdue au comptoir litiges'); }
  if(L.kin&&bags&&!lost&&pfRng(D.key+'|port'+i)()<0.3){ k.stay(k.t+(1+r()*2)*MIN,'💵 un porteur prend ses valises et réclame de l’argent (5 000 FC ou 10 $)'); }   /* Kinshasa : porteurs qui demandent un pourboire */
  const red=r()<0.06, ch=L.poi.find(p=>p.k===(red?'red':'green'));
  k.walk(tmJ(r,ch.x0+5,ch.x1-5),ch.y0-6,red?'couloir rouge : déclare des marchandises':'passe la douane (couloir vert)');
  if(red||r()<0.04){ const xc=L.poi.find(p=>p.k==='xrayc'); k.walk(xc.x0-6,xc.y1+4,'bagages passés au scanner de la douane').stay(k.t+(3+r()*6)*MIN,'🔎 contrôle des bagages par la douane'); }
  k.walk(830+tmJ(r,-12,12),1000,'franchit la porte des arrivées');
  if(r()<0.5) k.walk(tmJ(r,676,990),tmJ(r,1062,1095),'cherche sa famille dans la foule').stay(k.t+(1+r()*5)*MIN,'retrouve sa famille 🤗');
  else if(r()<0.18){ const a=L.poi.find(p=>p.k==='atm'&&p.arr); if(a){ const z=tmIn(a,r); k.walk(z.x,a.y1+5,'va au distributeur de billets').stay(k.t+(1+r()*1.5)*MIN,'retire de l’argent au distributeur'); } }
  else if(r()<0.2){ const p=L.poi.filter(p=>p.arr&&['change','cafe','car','info','wc'].includes(p.k)), q=p[Math.floor(r()*p.length)], z=tmIn(q,r); k.walk(z.x,z.y-12,'va vers : '+q.lab).stay(k.t+(2+r()*6)*MIN,q.lab); }
  k.walk(tmJ(r,690,980),1258,'monte dans un taxi ou un bus'); k.K[k.K.length-1].out=1;
  return {K:k.K,bags:bags&&!lost,bagT}; }
// famille et chauffeurs qui attendent derrière la barrière des arrivées
// PERSONNEL : agents d'enregistrement, agents de porte, sûreté, police, immigration, santé, douane, litiges, nettoyage, patrouilles
const TM_ROLE={mil:['#4d5d27','Militaire (FARDC)'],ck:['#1e3a8a','Agent d’enregistrement'],gate:['#1e3a8a','Agent d’embarquement'],sec:['#111827','Agent de sûreté'],pol:['#1d4ed8','Policier aux frontières'],imm:['#1d4ed8','Agent d’immigration'],
  health:['#f8fafc','Agent sanitaire'],cus:['#065f46','Douanier'],lost:['#1e3a8a','Agent litiges bagages'],info:['#0e7490','Agent d’accueil'],clean:['#f59e0b','Agent d’entretien'],porter:['#b45309','Porteur de bagages'],patrol:['#1d4ed8','Patrouille de police']};
function tmStaff(L,now){ const out=[], T0=now-14*HOUR, T1=now+14*HOUR, add=(role,x,y,st)=>out.push({staff:role,i:out.length,K:[{t:T0,x,y,st},{t:T1,x,y,st}],c:TM_ROLE[role][0],sk:TM_SKIN[out.length%TM_SKIN.length],dep:3});
  for(const gr of L.ckGroups||[]){ const n=Math.max(1,Math.min(12,gr.desks||gr.fl.length*2)); for(let k=0;k<n;k++) add('ck',gr.ck.x0+(k+0.5)*(gr.ck.x1-gr.ck.x0)/n,gr.ck.y-2,'au comptoir '+gr.A.name+' ('+gr.fl.map(g=>g.f.fn).slice(0,4).join(', ')+')'); }
  for(const g of L.deps){ const D=g.f.D; if(L.nd) add('sec',g.door.x+9,g.door.y+12,'palpe les passagers avant le bus de piste (porte '+D.gate.name+')');
    add('gate',g.desk.x-7,g.desk.y-9,'à la porte '+D.gate.name+' (vol '+g.f.fn+')'); add('gate',g.desk.x+7,g.desk.y-9,'à la porte '+D.gate.name+' (vol '+g.f.fn+')'); }
  for(const p of L.poi){ const cx=(p.x0+p.x1)/2;
    if(p.k==='xray') add('sec',p.x0+30,p.y0-7,'contrôle les bagages au scanner'); else if(p.k==='arch') add('sec',cx,p.y1+9,'au portique : palpations');
    else if(p.k==='booth') add(p.arr?'imm':'pol',cx,p.arr?p.y0+8:p.y1-8,p.arr?'contrôle les passeports à l’arrivée':'tamponne les passeports au départ');
    else if(p.k==='health') add('health',cx,p.y0+7,'vérifie les carnets de vaccination'); else if(p.k==='green'||p.k==='red') add('cus',p.k==='red'?p.x1-12:p.x0+12,p.y1+8,'surveille le couloir '+(p.k==='red'?'rouge':'vert'));
    else if(p.k==='lost') add('lost',cx,p.y0+8,'enregistre les déclarations de bagages perdus'); else if(p.k==='info') add('info',cx,p.y0+8,'renseigne les voyageurs'); else if(p.k==='transfer') add('info',cx,p.y0+8,'replace les passagers qui ont raté leur vol'); else if(p.k==='tsec') add('sec',cx,p.y1+5,'contrôle les passagers en correspondance'); else if(p.k==='ebola') add('health',cx,p.y0-4,'scanne les QR codes Ebola'); else if(p.k==='visa'){ add('imm',p.x0+20,p.y0+10,'délivre les visas à l’arrivée (90 $)'); add('imm',p.x1-20,p.y0+10,'encaisse les frais de visa (90 $)'); } }
  // nettoyage et patrouilles : se déplacent toutes les 3 minutes
  const zonesW=[[20,1000,620,1220],[20,430,620,690],[680,980,990,1220],[680,440,990,840]];
  for(let k=0;k<7;k++){ const role=k<5?'clean':'patrol', z=zonesW[k%4], K=[]; for(let t=Math.floor((now-40*MIN)/(3*MIN))*3*MIN;t<now+3*HOUR;t+=3*MIN){ const r=pfRng('st'+k+'|'+t); K.push({t,x:z[0]+r()*(z[2]-z[0]),y:z[1]+r()*(z[3]-z[1]),st:role==='clean'?'nettoie le sol':'patrouille dans l’aérogare',walk:1}); }
    out.push({staff:role,i:out.length,K,c:TM_ROLE[role][0],sk:TM_SKIN[k%TM_SKIN.length],dep:3}); }
  for(let k=0;k<4;k++){ const z=k<2?[680,470,990,860]:[680,1000,990,1230], K=[]; for(let t=Math.floor((now-40*MIN)/(4*MIN))*4*MIN;t<now+3*HOUR;t+=4*MIN){ const r=pfRng('po'+k+'|'+t); K.push({t,x:z[0]+r()*(z[2]-z[0]),y:z[1]+r()*(z[3]-z[1]),st:L.kin?'porteur : « Je porte ta valise ? » puis réclame de l’argent':'porteur : propose de porter les valises',walk:1}); }
    out.push({staff:'porter',i:out.length,K,c:TM_ROLE.porter[0],sk:TM_SKIN[(k*2)%TM_SKIN.length],dep:3}); }
  if(L.kin){ add('mil',470,1262,'militaire : garde la barrière de la voie rapide'); add('mil',610,1262,'militaire : contrôle les voitures de la voie rapide');   /* Kinshasa : militaires FARDC */
    const zm=[[20,1238,640,1296],[20,1000,620,1220],[680,1000,990,1230],[20,430,620,690]]; for(let k=0;k<6;k++){ const z=zm[k%4], K=[]; for(let t=Math.floor((now-40*MIN)/(5*MIN))*5*MIN;t<now+3*HOUR;t+=5*MIN){ const r=pfRng('mil'+k+'|'+t); K.push({t,x:z[0]+r()*(z[2]-z[0]),y:z[1]+r()*(z[3]-z[1]),st:'militaire en patrouille',walk:1}); } out.push({staff:'mil',i:out.length,K,c:TM_ROLE.mil[0],sk:TM_SKIN[(k+1)%TM_SKIN.length],dep:3}); } }
  return out; }
// familles : les enfants marchent avec le parent qui les précède dans le manifeste, et certains couples voyagent ensemble
function tmFamilies(ppl){ let prev=null;
  for(const p of ppl){ if(p.dep!==0&&p.dep!==1){ prev=null; continue; } const w=p.row;
    if(prev&&prev.f===p.f&&w&&prev.row&&!prev.kid&&(()=>{ const cc=p.dep?p.f.D.A.cc:p.f.D.B.cc; return (w.nat===cc)===(prev.row.nat===cc); })()&&(w.age<16||(w.purp==='family'&&prev.row.purp==='family'&&(p.i*7)%10<4))){ const dx=w.age<16?3.5:4.5, dy=w.age<16?2.5:0.5, lead=prev;
      p.lead=lead; p.fdx=dx; p.fdy=dy; p.fsuf=w.age<16?' (avec sa famille)':' (en couple)'; p.K=lead.K.map(k=>k.bus?{...k,st:k.st+p.fsuf}:{...k,x:k.x+dx,y:k.y+dy,st:k.st+p.fsuf}); p.K.shopT=lead.K.shopT; p.ckDone=lead.ckDone; if(p.dep===0){ p.bagT=lead.bagT; p.hasBag=false; p.bag=false; } else p.bag=false; p.fam=1; continue; }
    prev=p; } }
// équipages : pilotes et personnel de cabine (briefing à la porte, embarquement avant les passagers ; sortie après eux à l'arrivée)
function tmCrews(L){ const out=[];
  for(const g of L.deps){ const D=g.f.D, n=2+Math.min(10,Math.ceil(g.f.N/50)), r=pfRng(D.key+'|crew');
    for(let i=0;i<n;i++){ const pil=i<2, k=tmKF(), t0=D.gate.open-(48+i*0.4)*MIN; k.at(t0,630,560+i*3,(pil?'pilote':'personnel de cabine')+' du vol '+g.f.fn+' : arrive par l’accès équipage');
      for(const v of g.via||[]) k.walk(v.x,v.y,'équipage du vol '+g.f.fn+' en route vers la porte',2.4);
      k.walk(g.desk.x+tmJ(r,-14,14),g.desk.y+18+i*2,'équipage du vol '+g.f.fn+' : se rend à la porte '+D.gate.name,2.4).stay(D.gate.open-28*MIN,pil?'briefing des pilotes à la porte':'briefing de l’équipage de cabine').walk(g.door.x,g.door.y,L.nd?'rejoint l’avion en minibus équipage, avant les passagers':'monte à bord avant les passagers',2.2); k.K[k.K.length-1].out=1;
      out.push({crew:pil?(i===0?'Commandant de bord':'Copilote'):'Personnel de cabine',f:g.f,i,K:k.K,c:pil?'#0f172a':(g.f.riv&&g.f.riv.color)||'#b91c1c',sk:TM_SKIN[(i*3+1)%TM_SKIN.length],dep:4}); } }
  for(const a of L.arrs){ if(a.f.soon) continue; const D=a.f.D, n=2+Math.min(10,Math.ceil(a.f.N/50));
    for(let i=0;i<n;i++){ const pil=i<2, k=tmKF(); k.at(D.arr+19*MIN+i*12000,a.ent?a.ent.x:a.door.x,a.ent?a.ent.y:a.door.y,a.ent?'équipage du vol '+a.f.fn+' : déposé par le minibus équipage':'équipage du vol '+a.f.fn+' : quitte l’avion après les passagers').walk(985,226,'équipage : couloir réservé',2.6).walk(985,1250,'équipage : sortie par le couloir du personnel',2.6); k.K[k.K.length-1].out=1;
      out.push({crew:pil?(i===0?'Commandant de bord':'Copilote'):'Personnel de cabine',f:a.f,i,K:k.K,c:pil?'#0f172a':(a.f.riv&&a.f.riv.color)||'#b91c1c',sk:TM_SKIN[(i*5+2)%TM_SKIN.length],dep:4}); } }
  return out; }
function tmGreeters(L,ppl){ const out=[], byF=new Map(); for(const p of ppl||[]) if(p.dep===0&&!p.fam&&p.row){ const j=p.K.findIndex(k=>/^retrouve sa famille/.test(k.st)); if(j>1){ (byF.get(p.f)||byF.set(p.f,[]).get(p.f)).push([p,j]); } }
  L.arrs.forEach((g,fi)=>{ const D=g.f.D, n=Math.min(45,Math.round(g.f.N*0.18)), cand=byF.get(g.f)||[];
    for(let i=0;i<n;i++){ const r=pfRng(D.key+'|gr'+i), k=tmKF(), x=tmJ(r,672,994); if(x>806&&x<854) continue;
      k.at(D.arr-tmJ(r,10,35)*MIN,tmJ(r,690,980),1258,'arrive pour accueillir un proche').walk(x,tmJ(r,1008,1048),'attend derrière la barrière').stay(D.arr+tmJ(r,25,70)*MIN,(i%3===0?'tient une pancarte « '+(i%2?'Bienvenue':'Taxi / chauffeur')+' »':'attend un passager du vol '+g.f.fn)).walk(tmJ(r,690,980),1258,'repart');
      const tg=cand[i]&&cand[i][0].K[cand[i][1]-1].t>k.K[1].t+MIN?cand[i]:null; let nm='';
      if(tg){ const [p,j]=tg, w=p.row, who=w.first+' '+w.last, sign=i%3===0, K=k.K, wait=K[1]; nm=String(w.last||'').toUpperCase();
        // le passager vient vers la personne qui l'attend…
        p.K[j-1].x=wait.x+3; p.K[j-1].y=wait.y+5; p.K[j].x=wait.x+3; p.K[j].y=wait.y+5; p.K[j].st=(sign?'retrouve son chauffeur':'retrouve sa famille')+' 🤗'; p._gm=1;
        // …qui l'attend jusqu'à son arrivée, le serre dans ses bras, puis repart avec lui jusqu'au taxi
        K.length=2; K.push({t:p.K[j-1].t,x:wait.x,y:wait.y,st:sign?'tient une pancarte « '+nm+' »':'attend '+who+' (vol '+g.f.fn+')'},{t:p.K[j].t,x:wait.x,y:wait.y,st:(sign?'accueille ':'serre dans ses bras ')+who+' 🤗'});
        for(let m=j+1;m<p.K.length;m++){ const a=p.K[m]; K.push({t:a.t,x:a.x-4,y:a.y+2,st:'repart avec '+who,walk:a.walk}); } K[K.length-1].out=1; }
      else { k.K[k.K.length-1].out=1; }
      out.push({signName:nm,f:g.f,i,K:k.K,c:TM_COL[(i*3)%TM_COL.length],sk:TM_SKIN[i%TM_SKIN.length],dep:2,sign:i%3===0,greet:1}); } }); return out; }
const TM_CAT=new Map();
function tmCat(st,q){ const key=(q?'q':'-')+st; let v=TM_CAT.get(key); if(v===undefined){ v=q?(/enregistrement/.test(st)?'ck':/sûreté|coupe-file/.test(st)?'sec':/police/.test(st)?'pol':/embarquement/.test(st)?'board':/passeports/.test(st)?'imm':''):(/attend sa valise/.test(st)?'belt':''); if(TM_CAT.size>5000) TM_CAT.clear(); TM_CAT.set(key,v); } return v; }
function tmAt(K,now){ if(now<K[0].t||now>K[K.length-1].t) return null;
  let k0=K._k||1; if(k0>=K.length||K[k0-1].t>now) k0=1;
  for(let k=k0;k<K.length;k++) if(now<=K[k].t){ K._k=k; const a=K[k-1], b=K[k], u=(now-a.t)/Math.max(1,b.t-a.t);
      if(b.path){ const q=tmPathAt(b.path,u); return {x:q.x,y:q.y,st:b.st,walk:0,q:1}; }
      if(b.walk) return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,st:b.st,walk:1,vx:b.x-a.x,vy:b.y-a.y,bus:b.bus};
      return {x:b.x,y:b.y,st:b.st,sit:b.sit,bus:b.bus}; }
  return null; }
/* ---------- BAGAGES (phase 3) : chaque valise a son trajet ----------
   Départ : comptoir → tapis derrière les comptoirs → tri bagages (le long de la façade) → soute de l'avion.
   Arrivée : soute → tri → tapis de livraison où elle tourne jusqu'à ce que son passager la prenne ;
   les valises perdues n'arrivent jamais (le passager va au comptoir litiges). */
const TM_BAGC=['#1f2937','#7f1d1d','#1e3a8a','#14532d','#713f12','#6b21a8','#be185d','#0f766e'];
function tmBags(L){ const B=[];
  for(const g of L.later||[]){ const D=g.f.D; (g.sched||[]).forEach((x,i)=>{ if(!x.bags) return; const cx=tmJ(pfRng(D.key+'|bx'+i),g.ck.x0+3,g.ck.x1-3), P=tmPath([{x:cx,y:g.ck.y-16},{x:cx,y:978},{x:-14,y:978},{x:-14,y:700}]); B.push({t0:x.ckDone,P,dur:P.L/3.2*1000,c:TM_BAGC[i%8],load:x.ckDone+P.L/3.2*1000,g}); }); }
  for(const g of L.deps){ const D=g.f.D; g.sched.forEach((x,i)=>{ if(!x.bags) return; const cx=tmJ(pfRng(D.key+'|bx'+i),g.ck.x0+3,g.ck.x1-3);
      const st=g.stand, n={x:-Math.sin(st.a),y:Math.cos(st.a)}, hx=st.x-n.x*40, hy=st.y-n.y*40, P=tmPath(L.nd?[{x:cx,y:g.ck.y-16},{x:cx,y:978},{x:-14,y:978},{x:-14,y:-26},{x:st.x+22,y:-26},{x:st.x+22,y:st.y-34}]:[{x:cx,y:g.ck.y-16},{x:cx,y:978},{x:-14,y:978},{x:-14,y:hy},{x:hx,y:hy}]); B.push({t0:x.ckDone,P,dur:P.L/3.2*1000,c:TM_BAGC[i%8],load:Math.min(D.P-3*MIN,x.ckDone+P.L/3.2*1000),g}); }); }
  for(const a of L.arrs){ if(a.f.soon) continue; const b=a.belt; for(const p of TM.ppl) if(p.f===a.f&&p.bagT&&p.hasBag){ const tB=Math.max(a.f.D.bag.first,p.bagT-(1+((p.i*7)%5))*MIN);
      const P=tmPath([{x:a.door.x+20,y:L.nd?a.sy-34:-46},{x:a.door.x+20,y:-28},{x:1014,y:-28},{x:1014,y:b.cy},{x:b.cx+b.rx,y:b.cy}]), dur=P.L/3.2*1000; B.push({t0:tB-dur,P,dur,c:TM_BAGC[p.i%8],belt:b,tB,pick:p.bagT,p}); } }
  return B; }
function tmSkin(row,d){ if(!row) return d; const reg=COUNTRIES[row.nat]&&COUNTRIES[row.nat][1], h=(row.i*7)%3; return reg==='AF'?['#5b3a24','#7a4a2a','#3f2516'][h]:reg==='EU'||reg==='NA'||reg==='OC'?['#f1d3b8','#e8c2a0','#d9b38c'][h]:reg==='AS'?['#e0b88f','#d4a373','#c99a73'][h]:['#c99a73','#8d5a3b','#e8c2a0'][h]; }
/* ---------- PERSONNAGES : silhouettes humaines tirées de la fiche du passager ----------
   Sexe, âge, origine, richesse et motif du voyage décident des cheveux, de la tenue et des accessoires :
   costume-cravate pour les voyages d'affaires, pagne ou boubou, foulard, sac à dos d'étudiant, canne,
   poussette, téléphone à la main… Le personnel porte son uniforme (gilet jaune, casquette, galons). */
const TM_HAIR=['#1c1917','#292524','#3f2a1d','#57391f','#7c4a21','#a16207','#d6b56b','#78716c'];
const TM_TOP=['#1e3a8a','#0f766e','#7f1d1d','#334155','#f8fafc','#a16207','#4338ca','#be123c','#15803d','#64748b','#ea580c','#e2e8f0','#0e7490','#6b21a8'];
const TM_BOT=['#1f2937','#334155','#1e3a8a','#57534e','#0f172a','#78716c','#3f3f46','#1e40af'];
const TM_PAGNE=[['#ea580c','#facc15'],['#15803d','#fde047'],['#1d4ed8','#f97316'],['#9d174d','#fbbf24'],['#7c2d12','#22d3ee'],['#6d28d9','#fde68a']];
function tmLook(p){ if(p.look) return p.look; const w=p.row, r=pfRng('lk'+(w?w.name+w.i:'')+'|'+p.i+'|'+(p.staff||p.crew||p.dep)), pk=a=>a[Math.floor(r()*a.length)];
  const reg=w?(COUNTRIES[w.nat]&&COUNTRIES[w.nat][1])||'EU':(p.sk&&/^#[5-8]/.test(p.sk)?'AF':pk(['AF','AF','EU','AS'])), fem=w?!!w.F:r()<0.45, age=w?w.age:(p.kid?8:22+Math.floor(r()*40));
  const L={fem,age,reg,kid:age<12,teen:age>=12&&age<18,old:age>=66,sc:age<4?0.55:age<8?0.66:age<12?0.76:age<15?0.88:1,top:pk(TM_TOP),bot:pk(TM_BOT),shoe:pk(['#111827','#1f2937','#78350f','#f8fafc']),hairC:pk(age>=62?['#d4d4d8','#a8a29e','#e7e5e4']:reg==='AF'||reg==='AS'?TM_HAIR.slice(0,3):TM_HAIR)};
  if(age>=50&&age<62&&r()<0.4) L.hairC='#a8a29e';
  // coiffure
  L.hair=fem?(reg==='AF'?pk(['tresses','tresses','chignon','afro','court','foulard']):reg==='ME'?pk(['voile','voile','long','chignon']):pk(['long','long','chignon','court','queue'])):(age>=55&&r()<0.4?'chauve':reg==='AF'?pk(['ras','ras','court','afro']):pk(['court','court','ras','court']));
  if(reg==='ME'&&!fem&&r()<0.3) L.hair='keffieh';
  if(L.kid&&L.hair==='chauve') L.hair='court';
  // tenue
  const purp=w&&w.purp, rich=w&&w.wealth==='rich';
  if(!L.kid&&((purp==='business'&&r()<0.8)||(rich&&r()<0.12))){ L.suit=1; L.top=pk(['#0f172a','#1e293b','#334155','#1c1917','#1e3a8a']); L.bot=L.top; L.tie=pk(['#b91c1c','#1d4ed8','#a16207','#475569','#15803d']); L.shirt=pk(['#f8fafc','#e0f2fe','#f1f5f9']); if(fem&&r()<0.5){ L.tie=0; L.skirt=1; } L.shoe='#111827'; L.case=r()<0.6; }
  else if(fem&&!L.kid&&reg==='AF'&&r()<0.55){ L.pagne=pk(TM_PAGNE); if(r()<0.6&&L.hair!=='foulard') L.hair='gele'; L.dress=1; }
  else if(!fem&&!L.kid&&reg==='AF'&&r()<0.14){ L.boubou=pk(TM_PAGNE); }
  else if(fem&&!L.kid&&r()<0.35) L.dress=1;
  if(reg==='ME'&&fem&&L.hair==='voile'&&r()<0.5){ L.dress=1; L.top=pk(['#0f172a','#1c1917','#44403c','#1e3a8a']); }
  if(L.hair==='keffieh'){ L.boubou=['#f8fafc','#e5e7eb']; }
  if(purp==='study'||((L.teen||age<30)&&purp==='tourism'&&r()<0.5)) L.pack=pk(['#1d4ed8','#b91c1c','#111827','#15803d','#ea580c']);
  if(age<40&&!L.kid&&r()<0.18) L.phones=1;
  L.phone=!L.kid&&age<70&&r()<(age<35?0.75:0.45);
  if(L.old&&r()<0.45) L.cane=1;
  if(w&&/poussette/.test(w.assist||'')) L.stroller=1;
  if(age>=40&&r()<0.25) L.glasses=1;
  if(!fem&&age>=25&&r()<0.22&&!L.suit) L.beard=1;
  if(!fem&&!L.kid&&r()<0.12&&L.hair!=='chauve'&&!L.suit&&L.hair!=='keffieh') L.cap=pk(['#111827','#b91c1c','#1d4ed8','#f8fafc']);
  // uniformes
  if(p.staff){ const c=p.c; L.suit=0; L.dress=0; L.pagne=0; L.boubou=0; L.pack=0; L.phones=0; L.phone=0; L.cane=0; L.cap=0; L.top=c; L.bot=p.staff==='health'?'#e2e8f0':'#1f2937';
    if(p.staff==='clean'||p.staff==='porter') L.vest='#facc15'; else if(p.staff==='sec') L.vest=0, L.top='#111827', L.band='SÛRETÉ'; else if(p.staff==='pol'||p.staff==='imm'||p.staff==='patrol') L.hat='#1e3a8a', L.top='#1d4ed8', L.bot='#1e3a8a';
    else if(p.staff==='cus') L.hat='#065f46'; else if(p.staff==='assist') L.vest='#22d3ee'; else if(p.staff==='ck'||p.staff==='gate'||p.staff==='info'||p.staff==='lost'){ L.scarf=fem?'#facc15':0; L.tie=fem?0:'#facc15'; L.shirt='#f8fafc'; L.suit=1; if(fem&&r()<0.6) L.skirt=1; if(fem) L.hair='chignon'; }
    if(p.staff==='health'){ L.top='#f8fafc'; L.mask=1; } }
  if(p.crew){ const pil=/Comm|Cop/.test(p.crew), c=p.c; L.suit=1; L.shirt='#f8fafc'; L.pack=0; L.phones=0; L.phone=0; L.cane=0; L.cap=0; L.case=0; L.roll=1;
    if(pil){ L.top='#0f172a'; L.bot='#0f172a'; L.tie='#0f172a'; L.shirt='#f8fafc'; L.hat='#0f172a'; L.gold=/Comm/.test(p.crew)?4:3; if(L.hair==='voile'||L.hair==='gele'||L.hair==='foulard') L.hair='chignon'; }
    else { L.top=c; L.bot=fem?c:'#0f172a'; L.tie=fem?0:'#f8fafc'; L.scarf=fem?'#f8fafc':0; if(fem){ L.skirt=1; L.hair='chignon'; } L.dress=0; L.pagne=0; } }
  if(p.greet){ L.case=0; L.roll=0; }
  return (p.look=L); }
// dessine une personne en vue de 3/4 haut : pieds au point (x, y+r*1.7), tête en haut
function tmHuman(g,p,q,x,y,r,now,px,carry){ const L=tmLook(p), k=r*L.sc, sit=q.sit, walk=q.walk, ph=walk?Math.sin(now/(150/(p.look.old?0.7:1))+p.i):0;
  if(q.vx) p.face=q.vx<0?-1:1; else if(p.face==null) p.face=(p.i%2)?1:-1; const fx=p.face;
  const feet=y+r*1.7, hip=feet-k*1.25*(sit?0.45:1), sh=hip-k*1.35, hy=sh-k*0.62, hr=k*0.5, bw=k*(L.fem?0.62:0.72)*(L.kid?0.95:1);
  g.fillStyle='rgba(0,0,0,.16)'; g.beginPath(); g.ellipse(x,feet,k*0.95,k*0.36,0,0,6.283); g.fill();
  if(px<2.2){ // vue de loin : silhouette simple, couleurs de la tenue
    g.fillStyle=L.pagne?L.pagne[0]:L.boubou?L.boubou[0]:L.top; g.beginPath(); g.ellipse(x,(hip+sh)/2+k*0.2,bw*1.05,k*1.05,0,0,6.283); g.fill();
    g.fillStyle=p.sk; g.beginPath(); g.arc(x,hy,hr*1.15,0,6.283); g.fill(); return; }
  g.lineCap='round';
  // poussette (devant), chariot
  if(L.stroller&&!sit){ const sx=x+fx*k*1.7; g.strokeStyle='#334155'; g.lineWidth=k*0.18; g.beginPath(); g.moveTo(x+fx*k*0.55,sh+k*0.7); g.lineTo(sx,hip); g.stroke(); g.fillStyle='#475569'; g.fillRect(sx-k*0.55,hip-k*0.4,k*1.1,k*0.8); g.fillStyle='#0ea5e9'; g.beginPath(); g.arc(sx+fx*k*0.2,hip-k*0.35,k*0.55,Math.PI,0); g.fill(); g.fillStyle='#111'; g.beginPath(); g.arc(sx-k*0.45,feet-k*0.15,k*0.18,0,6.283); g.arc(sx+k*0.45,feet-k*0.15,k*0.18,0,6.283); g.fill(); }
  // sac à dos (derrière)
  if(L.pack&&!sit){ g.fillStyle=L.pack; g.beginPath(); g.roundRect?g.roundRect(x-fx*bw*1.1-k*0.32,sh+k*0.1,k*0.65,k*0.95,k*0.18):g.rect(x-fx*bw*1.1-k*0.32,sh+k*0.1,k*0.65,k*0.95); g.fill(); }
  // jambes
  const lw=k*0.3, legC=L.bot, sk=p.sk;
  if(sit){ g.strokeStyle=legC; g.lineWidth=lw; g.beginPath(); g.moveTo(x-bw*0.4,hip); g.lineTo(x-bw*0.4+fx*k*0.55,hip+k*0.15); g.lineTo(x-bw*0.4+fx*k*0.6,feet-k*0.1); g.moveTo(x+bw*0.4,hip); g.lineTo(x+bw*0.4+fx*k*0.55,hip+k*0.15); g.lineTo(x+bw*0.4+fx*k*0.6,feet-k*0.1); g.stroke(); }
  else { const s1=ph*k*0.45; g.strokeStyle=(L.dress||L.skirt||L.pagne)?sk:legC; g.lineWidth=(L.dress||L.skirt||L.pagne)?lw*0.75:lw; g.beginPath(); g.moveTo(x-bw*0.35,hip); g.lineTo(x-bw*0.35+s1,feet-k*0.12); g.moveTo(x+bw*0.35,hip); g.lineTo(x+bw*0.35-s1,feet-k*0.12); g.stroke();
    g.fillStyle=L.shoe; g.beginPath(); g.ellipse(x-bw*0.35+s1+fx*k*0.08,feet-k*0.08,k*0.22,k*0.12,0,0,6.283); g.ellipse(x+bw*0.35-s1+fx*k*0.08,feet-k*0.08,k*0.22,k*0.12,0,0,6.283); g.fill(); }
  // corps : chemise / veste / robe / pagne / boubou
  const topC=L.pagne?L.pagne[0]:L.boubou?L.boubou[0]:L.top;
  g.fillStyle=topC; g.beginPath();
  if((L.dress||L.pagne||L.boubou)&&!sit){ const hem=L.boubou?feet-k*0.25:hip+k*0.7; g.moveTo(x-bw*0.85,sh+k*0.05); g.lineTo(x+bw*0.85,sh+k*0.05); g.lineTo(x+bw*1.15,hem); g.lineTo(x-bw*1.15,hem); g.closePath(); }
  else { g.moveTo(x-bw,sh+k*0.12); g.quadraticCurveTo(x,sh-k*0.12,x+bw,sh+k*0.12); g.lineTo(x+bw*0.82,hip+k*0.08); g.lineTo(x-bw*0.82,hip+k*0.08); g.closePath(); }
  g.fill(); g.strokeStyle='rgba(15,23,42,.35)'; g.lineWidth=Math.max(0.25,k*0.06); g.stroke();
  if(L.skirt&&!sit){ g.fillStyle=L.bot; g.beginPath(); g.moveTo(x-bw*0.82,hip); g.lineTo(x+bw*0.82,hip); g.lineTo(x+bw*0.95,hip+k*0.55); g.lineTo(x-bw*0.95,hip+k*0.55); g.closePath(); g.fill(); }
  if(L.pagne||L.boubou){ const c2=(L.pagne||L.boubou)[1]; g.fillStyle=c2; for(let j=0;j<3;j++){ const yy=sh+k*(0.35+j*0.42); g.fillRect(x-bw*0.8,yy,bw*1.6,k*0.1); } }
  if(L.suit){ g.fillStyle=L.shirt||'#f8fafc'; g.beginPath(); g.moveTo(x-bw*0.32,sh+k*0.02); g.lineTo(x+bw*0.32,sh+k*0.02); g.lineTo(x,sh+k*0.62); g.closePath(); g.fill(); if(L.tie){ g.strokeStyle=L.tie; g.lineWidth=k*0.14; g.beginPath(); g.moveTo(x,sh+k*0.08); g.lineTo(x,sh+k*0.62); g.stroke(); } if(L.scarf){ g.fillStyle=L.scarf; g.beginPath(); g.arc(x,sh+k*0.12,k*0.22,0,6.283); g.fill(); } }
  if(px>4.5){ const bk=x-fx*bw*0.02; g.fillStyle='rgba(15,23,42,.16)'; g.beginPath(); g.moveTo(bk,sh+k*0.02); g.lineTo(x-fx*bw*0.98,sh+k*0.14); g.lineTo(x-fx*bw*0.8,hip+k*0.08); g.lineTo(bk,hip+k*0.08); g.closePath(); g.fill();   /* côté à l'ombre */
    if(!L.suit&&!L.pagne&&!L.boubou&&!L.dress&&!L.vest){ g.fillStyle='rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x-bw*0.3,sh+k*0.02); g.lineTo(x,sh+k*0.28); g.lineTo(x+bw*0.3,sh+k*0.02); g.closePath(); g.fill(); g.fillStyle='rgba(15,23,42,.45)'; for(const yy of [0.45,0.75,1.05]) { g.beginPath(); g.arc(x,sh+k*yy,k*0.045,0,6.283); g.fill(); } }   /* col et boutons */
    if(!L.dress&&!L.pagne&&!L.boubou&&!L.skirt&&!sit){ g.fillStyle='#1c1917'; g.fillRect(x-bw*0.82,hip-k*0.02,bw*1.64,k*0.1); g.fillStyle='#d4a54a'; g.fillRect(x-k*0.07,hip-k*0.03,k*0.14,k*0.12); } }   /* ceinture */
  if(L.vest){ g.fillStyle=L.vest; g.fillRect(x-bw*0.85,sh+k*0.15,bw*1.7,k*1.0); g.fillStyle='#e5e7eb'; g.fillRect(x-bw*0.85,sh+k*0.68,bw*1.7,k*0.12); }
  if(L.band){ g.fillStyle='#facc15'; g.fillRect(x-bw*0.9,sh+k*0.3,bw*0.45,k*0.18); }
  if(L.gold){ g.fillStyle='#facc15'; for(let j=0;j<Math.min(4,L.gold);j++){ g.fillRect(x-bw*1.05,sh+k*(0.05+j*0.09),k*0.22,k*0.05); g.fillRect(x+bw*1.05-k*0.22,sh+k*(0.05+j*0.09),k*0.22,k*0.05); } }
  // bras (balancent à l'opposé des jambes) et mains
  const slv=L.pagne?L.pagne[0]:L.boubou?L.boubou[0]:L.top, aw=k*0.24, a1=-ph*k*0.4;
  const hands=[[x-bw*1.02+(sit?fx*k*0.3:a1*0.4),hip+k*(sit?-0.1:0.05)+(sit?0:-Math.abs(a1)*0.15),x-bw*0.95,sh+k*0.15],[x+bw*1.02+(sit?fx*k*0.3:-a1*0.4),hip+k*(sit?-0.1:0.05),x+bw*0.95,sh+k*0.15]];
  const useP=L.phone&&!walk&&(sit||q.q); if(useP){ hands[fx>0?1:0][0]=x+fx*bw*0.5; hands[fx>0?1:0][1]=sh+k*0.45; }
  if(L.cane&&walk){ hands[fx>0?1:0][0]=x+fx*bw*1.3; }
  g.strokeStyle=slv; g.lineWidth=aw; g.beginPath(); for(const h of hands){ g.moveTo(h[2],h[3]); g.lineTo(h[0],h[1]); } g.stroke();
  g.fillStyle=sk; for(const h of hands){ g.beginPath(); g.arc(h[0],h[1],k*0.15,0,6.283); g.fill(); }
  const hand=hands[fx>0?1:0];
  if(useP){ g.fillStyle='#0f172a'; g.fillRect(hand[0]-k*0.14,hand[1]-k*0.32,k*0.28,k*0.42); g.fillStyle='rgba(125,211,252,.95)'; g.fillRect(hand[0]-k*0.1,hand[1]-k*0.28,k*0.2,k*0.32); if(TM.night){ g.fillStyle='rgba(186,230,253,.18)'; g.beginPath(); g.arc(hand[0],hand[1]-k*0.6,k*0.7,0,6.283); g.fill(); } }
  if(L.cane&&!sit){ g.strokeStyle='#78350f'; g.lineWidth=k*0.1; g.beginPath(); g.moveTo(hand[0],hand[1]); g.lineTo(hand[0]+fx*k*0.15,feet); g.stroke(); }
  // cou + tête
  g.fillStyle=sk; g.fillRect(x-k*0.13,hy+hr*0.6,k*0.26,sh-hy-hr*0.5);
  const head=()=>{ g.fillStyle=sk; g.beginPath(); g.ellipse(x,hy,hr*0.92,hr,0,0,6.283); g.fill(); };
  const H=L.hair, hc=L.hairC;
  if(H==='afro'){ g.fillStyle=hc; g.beginPath(); g.arc(x-fx*hr*0.1,hy-hr*0.2,hr*1.35,0,6.283); g.fill(); }
  if(H==='long'){ g.fillStyle=hc; g.beginPath(); g.ellipse(x-fx*hr*0.15,hy+hr*0.6,hr*1.05,hr*1.45,0,0,6.283); g.fill(); }
  if(H==='tresses'){ g.strokeStyle=hc; g.lineWidth=k*0.12; g.beginPath(); for(const d of [-0.8,-0.3,0.3,0.8]){ g.moveTo(x+d*hr,hy); g.lineTo(x+d*hr*1.1-fx*hr*0.2,hy+hr*1.9); } g.stroke(); }
  if(H==='voile'||H==='foulard'){ g.fillStyle=H==='voile'?(L.dress?L.top:'#334155'):(L.pagne?L.pagne[1]:'#7c3aed'); g.beginPath(); g.ellipse(x,hy+hr*0.25,hr*1.28,hr*1.4,0,0,6.283); g.fill(); }
  if(H==='keffieh'){ g.fillStyle='#f8fafc'; g.beginPath(); g.ellipse(x,hy+hr*0.3,hr*1.25,hr*1.45,0,0,6.283); g.fill(); }
  head();
  if(L.beard){ g.fillStyle=hc; g.beginPath(); g.ellipse(x+fx*hr*0.2,hy+hr*0.55,hr*0.6,hr*0.4,0,0,6.283); g.fill(); }
  if(H==='voile'||H==='foulard'||H==='keffieh'){ g.fillStyle=H==='keffieh'?'#f8fafc':(H==='voile'?(L.dress?L.top:'#334155'):(L.pagne?L.pagne[1]:'#7c3aed')); g.beginPath(); g.arc(x,hy,hr*1.05,Math.PI*1.05,Math.PI*1.95); g.fill(); if(H==='keffieh'){ g.strokeStyle='#111'; g.lineWidth=k*0.08; g.beginPath(); g.arc(x,hy-hr*0.2,hr*0.95,Math.PI*1.1,Math.PI*1.9); g.stroke(); } }
  else if(H==='gele'){ const c=L.pagne?L.pagne[1]:'#f59e0b'; g.fillStyle=c; g.beginPath(); g.ellipse(x-fx*hr*0.15,hy-hr*0.75,hr*1.25,hr*0.85,-fx*0.2,0,6.283); g.fill(); g.fillStyle=L.pagne?L.pagne[0]:'#b45309'; g.fillRect(x-hr*1.0,hy-hr*0.62,hr*2.0,hr*0.16); }
  else if(H==='chauve'){ g.fillStyle=hc; g.beginPath(); g.arc(x-fx*hr*0.6,hy,hr*0.45,Math.PI*0.6,Math.PI*1.4); g.fill(); }
  else { g.fillStyle=hc; g.beginPath(); const top=H==='ras'?0.35:0.0; g.arc(x-fx*hr*0.12,hy-hr*0.1,hr*(H==='ras'?0.98:1.04),Math.PI*(1.0+top*0.1)-fx*0.25,Math.PI*(2.0-top*0.1)-fx*0.25); g.closePath(); g.fill();
    if(H==='chignon'){ g.beginPath(); g.arc(x-fx*hr*0.75,hy-hr*0.55,hr*0.45,0,6.283); g.fill(); }
    if(H==='queue'){ g.strokeStyle=hc; g.lineWidth=k*0.22; g.beginPath(); g.moveTo(x-fx*hr*0.8,hy-hr*0.2); g.lineTo(x-fx*hr*1.4,hy+hr*0.8); g.stroke(); } }
  if(L.cap&&!L.hat){ g.fillStyle=L.cap; g.beginPath(); g.arc(x,hy-hr*0.25,hr*0.98,Math.PI,0); g.fill(); g.fillRect(x+(fx>0?0:-hr*1.5),hy-hr*0.35,hr*1.5,hr*0.22); }
  if(L.hat){ g.fillStyle=L.hat; g.beginPath(); g.ellipse(x,hy-hr*0.6,hr*1.12,hr*0.5,0,0,6.283); g.fill(); g.fillStyle='#0f172a'; g.fillRect(x-hr*0.9,hy-hr*0.45,hr*1.8,hr*0.22); if(L.gold){ g.fillStyle='#facc15'; g.fillRect(x-hr*0.25,hy-hr*0.85,hr*0.5,hr*0.25); } }
  if(px>4.5){ // visage : yeux tournés vers la marche, lunettes, masque, écouteurs
    if(!/voile|foulard|keffieh|gele/.test(L.hair||'')){ g.fillStyle=sk; g.beginPath(); g.arc(x-fx*hr*0.86,hy+hr*0.1,hr*0.2,0,6.283); g.fill(); }   /* oreille */
    g.strokeStyle='rgba(17,24,39,.7)'; g.lineWidth=k*0.05; g.beginPath(); const ex0=x+fx*hr*0.28; g.moveTo(ex0-hr*0.36,hy-hr*0.2); g.lineTo(ex0-hr*0.1,hy-hr*0.24); g.moveTo(ex0+hr*0.1,hy-hr*0.24); g.lineTo(ex0+hr*0.36,hy-hr*0.2); g.stroke();   /* sourcils */
    g.strokeStyle='rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(ex0+fx*hr*0.1,hy+hr*0.05); g.lineTo(ex0+fx*hr*0.2,hy+hr*0.3); g.stroke();   /* nez */
    g.fillStyle='rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(x+fx*hr*0.3,hy-hr*0.35,hr*0.35,hr*0.18,0,0,6.283); g.fill();   /* reflet de lumière */
    g.fillStyle='#111827'; const ex=x+fx*hr*0.28, ey=hy+hr*0.05; g.beginPath(); g.arc(ex-hr*0.22,ey,hr*0.09,0,6.283); g.arc(ex+hr*0.22,ey,hr*0.09,0,6.283); g.fill();
    if(L.glasses){ g.strokeStyle='#111827'; g.lineWidth=k*0.05; g.beginPath(); g.arc(ex-hr*0.22,ey,hr*0.18,0,6.283); g.moveTo(ex+hr*0.4,ey); g.arc(ex+hr*0.22,ey,hr*0.18,0,6.283); g.stroke(); }
    if(L.mask){ g.fillStyle='#bae6fd'; g.fillRect(x-hr*0.6,hy+hr*0.25,hr*1.2,hr*0.45); }
    else { g.strokeStyle='rgba(120,30,30,.6)'; g.lineWidth=k*0.05; g.beginPath(); g.moveTo(ex-hr*0.15,hy+hr*0.5); g.lineTo(ex+hr*0.15,hy+hr*0.5); g.stroke(); } }
  if(L.phones){ g.strokeStyle='#111827'; g.lineWidth=k*0.12; g.beginPath(); g.arc(x,hy,hr*1.08,Math.PI*1.05,Math.PI*1.95); g.stroke(); g.fillStyle='#111827'; g.fillRect(x-hr*1.2,hy-hr*0.2,hr*0.3,hr*0.5); g.fillRect(x+hr*0.9,hy-hr*0.2,hr*0.3,hr*0.5); }
  // bagages : valise à roulettes tirée derrière, attaché-case, étiquette à la couleur du vol
  if(carry||L.roll&&walk){ const bx=x-fx*(bw+k*0.9), cw=k*0.75, ch=k*1.05; g.strokeStyle='#475569'; g.lineWidth=k*0.07; const bh=hands[fx>0?0:1]; g.beginPath(); g.moveTo(bh[0],bh[1]); g.lineTo(bx,feet-ch-k*0.05); g.stroke();
    g.fillStyle=L.roll?'#1f2937':(TM_BAGC[p.i%8]); g.fillRect(bx-cw/2,feet-ch,cw,ch); if(px>4.5){ g.fillStyle='rgba(255,255,255,.22)'; for(const dx of [-0.25,0,0.25]) g.fillRect(bx+cw*dx-k*0.02,feet-ch+k*0.08,k*0.04,ch-k*0.16); g.fillStyle='#111827'; g.fillRect(bx-k*0.16,feet-ch-k*0.1,k*0.32,k*0.08); g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(bx-cw/2,feet-k*0.12,cw,k*0.12); } g.fillStyle=p.c; g.fillRect(bx+cw/2-k*0.12,feet-ch+k*0.1,k*0.18,k*0.28); g.fillStyle='#111'; g.beginPath(); g.arc(bx-cw*0.3,feet,k*0.09,0,6.283); g.arc(bx+cw*0.3,feet,k*0.09,0,6.283); g.fill(); }
  else if(L.case&&!sit){ g.fillStyle='#3f2a1d'; g.fillRect(hand[0]-k*0.35,hand[1],k*0.7,k*0.5); }
  if(p.dep===1&&p.K.shopT&&now>p.K.shopT&&!sit){ const h=hands[fx>0?0:1]; g.fillStyle='#db2777'; g.fillRect(h[0]-k*0.3,h[1],k*0.6,k*0.65); g.fillStyle='#fbcfe8'; g.fillRect(h[0]-k*0.3,h[1],k*0.6,k*0.12); }
}
// écrans d'information : les vrais vols, qui défilent
// état d'un départ, identique partout (écrans, portes)
function tmDepStatus(f,now){ const D=f.D; if(now>=D.P&&D.tko&&now<D.tko) return D.hold&&now>=D.hold[0]?['ATTENTE DÉCOLLAGE','#f59e0b']:['ROULE','#94a3b8']; if(D.tko&&now>=D.tko) return ['DÉCOLLÉ','#64748b'];
  if(now>D.gate.close) return ['FERMÉ','#94a3b8']; if(now>D.gate.last) return ['DERNIER APPEL','#f87171']; if(now>D.gate.open) return ['EMBARQUEMENT','#22c55e'];
  if(tmDelay(f)) return ['RETARD '+tmDelay(f)+' MIN'+(f.dlw?' (MÉTÉO)':''),'#fb923c']; if(now>D.ci.close) return ['ENREG. CLOS','#cbd5e1']; if(now>D.ci.open) return ['ENREGISTREMENT','#38bdf8']; return ['À L’HEURE','#e5e7eb']; }
// grand tableau des départs (comme dans les vrais halls) : heure, vol, destination, comptoirs ou porte, état
function tmFidsBig(p,now,g,fit){ const w=p.x1-p.x0, h=p.y1-p.y0, MX=!!(TM.th&&TM.th.mx); g.fillStyle='#1e293b'; g.fillRect(p.x0-1.5,p.y0-1.5,w+3,h+3); g.fillStyle='#050a14'; g.fillRect(p.x0,p.y0,w,h);
  const X=(a,b)=>p.x0+w*(MX?1-a-b:a);   /* colonnes dans le bon ordre même dans un plan en miroir */
  const F=TM.F||{deps:[],later:[]}, L=TM.L||{}, list=[...F.deps,...(F.later||[])].filter(f=>!f.D.tko||now<f.D.tko+2*MIN).sort((a,b)=>a.D.P-b.D.P), rows=6, hh=h/(rows+1.3), C=[[0,0.12],[0.12,0.15],[0.27,0.31],[0.58,0.15],[0.73,0.27]];
  fit('🛫 DÉPARTS · DEPARTURES',X(0,0.6),p.y0+0.5,w*0.6,hh*1.1,'#facc15',null); fit(tmHM(now),X(0.86,0.13),p.y0+0.5,w*0.13,hh*1.1,'#facc15',null);
  ['HEURE','VOL','DESTINATION','ENREG./PORTE','STATUT'].forEach((t,k)=>fit(t,X(C[k][0],C[k][1])+1,p.y0+hh*1.15,w*C[k][1]-2,hh*0.55,'#94a3b8',null,1));
  const page=Math.floor(now/8000)%Math.max(1,Math.ceil(list.length/rows));
  for(let j=0;j<rows;j++){ const f=list[page*rows+j]; if(!f) break; const y=p.y0+hh*(1.3+j), D=f.D, A=tmAirline(f), gd=(L.deps||[]).find(d=>d.f===f), gr=gd?gd.grp:((L.later||[]).find(d=>d.f===f)||{}).grp, st=tmDepStatus(f,now);
    if(j%2){ g.fillStyle='rgba(148,163,184,.08)'; g.fillRect(p.x0,y,w,hh); }
    const where=now>=D.ci.close-5*MIN&&gd?'Porte '+D.gate.name:gr?'Comptoirs '+gr.z:gd?'Porte '+D.gate.name:'—', cx=X(C[1][0],C[1][1]);
    fit(tmHM(D.P),X(C[0][0],C[0][1])+1,y,w*C[0][1]-2,hh,'#fde68a',null); g.fillStyle=A.col; g.fillRect(MX?cx+w*C[1][1]-hh*0.7:cx+1,y+hh*0.2,hh*0.6,hh*0.6); fit(f.fn,MX?cx:cx+hh*0.75,y,w*C[1][1]-hh*0.8,hh,'#fff',null);
    fit(D.B.city,X(C[2][0],C[2][1])+1,y,w*C[2][1]-2,hh,'#fff',null); fit(where,X(C[3][0],C[3][1])+1,y,w*C[3][1]-2,hh,'#e5e7eb',null,1); fit(st[0],X(C[4][0],C[4][1])+1,y,w*C[4][1]-2,hh,st[1],null); }
  if(list.length>rows) fit(`page ${page+1}/${Math.ceil(list.length/rows)}`,X(0.8,0.19),p.y1-hh*0.75,w*0.19,hh*0.7,'#64748b',null,1); }
function tmFids(p,now,g,fit){ if(p.big) return tmFidsBig(p,now,g,fit); const w=p.x1-p.x0, h=p.y1-p.y0, arr=p.k==='fidsA'; g.fillStyle='#0b1220'; g.fillRect(p.x0,p.y0,w,h); g.strokeStyle='#475569'; g.lineWidth=0.8; g.strokeRect(p.x0,p.y0,w,h);
  const F=TM.F||{deps:[],arrs:[]}, list=arr?[...F.arrs].sort((a,b)=>a.D.arr-b.D.arr):[...F.deps,...(F.later||[])].sort((a,b)=>a.D.P-b.D.P); if(!list.length){ fit(arr?'Arrivées : aucun vol':'Départs : aucun vol',p.x0+1,p.y0+1,w-2,h-2,'#facc15',null); return; }
  const n=3, page=Math.floor(now/6000)%Math.max(1,Math.ceil(list.length/n)), lh=(h-2)/n;
  for(let j=0;j<n;j++){ const f=list[page*n+j]; if(!f) break; const D=f.D; let st, c='#e5e7eb';
    if(arr&&f.soon&&D.holdIn&&now>=D.holdIn[0]&&now<D.holdIn[1]){ st='circuit d’attente +'+Math.round((D.holdIn[1]-D.holdIn[0])/MIN)+' min'; c='#f59e0b'; }
    else if(arr&&f.soon&&D.ga&&now>=D.ga[0]&&now<D.ga[1]){ st='remise de gaz'; c='#f87171'; }
    else if(arr){ st=f.soon?(D.late>0?'retard +'+D.late+' min':'prévu'):!D.bag?'atterri':now<D.bag.first?'atterri':now<D.bag.last?'bagages tapis '+((TM.L&&TM.L.arrs.find(a=>a.f===f)||{belt:{}}).belt.n||''):'terminé'; c=f.soon?'#e5e7eb':'#22c55e'; }
    else if(now>=D.P&&D.tko&&now<D.tko){ st=D.hold&&now>=D.hold[0]?'attente avant décollage':'roule vers la piste'; c=D.hold&&now>=D.hold[0]?'#f59e0b':'#94a3b8'; }
    else { st=now>D.gate.close?'fermé':now>D.gate.last?'dernier appel':now>D.gate.open?'embarquement':tmDelay(f)?'retard '+tmDelay(f)+' min'+(f.dlw?' ('+f.dlw+')':''):now>D.ci.open?'enregistrement':'à l’heure'; c=/retard|dernier/.test(st)?'#f87171':/embarq/.test(st)?'#22c55e':/fermé/.test(st)?'#94a3b8':'#facc15'; }
    fit(`${tmHM(arr?D.arr:D.P)} ${f.fn} ${arr?D.A.city:D.B.city} · ${st}`,p.x0+1,p.y0+1+j*lh,w-2,lh,c,null); } }
// décor : poubelles, fontaines d'eau, panneaux « sol glissant » quand il pleut
// parvis : taxis, voitures, navettes et bus qui déposent et reprennent les voyageurs
// route d'accès à l'aéroport : voitures, taxis, bus, motos ; fluide la nuit, bouchée aux heures de pointe et les jours d'embouteillages
function tmRoad(g,L,now){ const y=1318, x0=-700, x1=1700, len=x1-x0, code=TM.code, hl=typeof ahLocalHour==='function'?ahLocalHour(code,now):12, tr=TM_TRAFFIC[code]||1, J=tmJam(code,now);
  const rush=(hl>=6.5&&hl<9.5)||(hl>=16&&hl<19.5), night=hl<5||hl>=23, dens=Math.min(1,(night?0.15:rush?0.6:0.35)*(tr>1?1.3:1)*J.f), jam=dens>0.7;
  g.fillStyle='#2b2f36'; g.fillRect(x0,y-14,len,44); g.fillStyle='#e5e7eb'; for(let x=x0;x<x1;x+=40) g.fillRect(x,y+7,20,1.6); g.fillStyle='#9ca3af'; g.fillRect(x0,y-15,len,1.2); g.fillRect(x0,y+29,len,1.2);
  g.fillStyle='#e5e7eb'; g.font='700 9px system-ui'; g.fillText((code==='FIH'?'Boulevard Lumumba':'Route de l’aéroport')+(jam?' — embouteillage':''),x0+20,y-18);
  const kin=code==='FIH'||((AP(code)||{}).cc==='CD'); if(kin) tmKinStreet(g,y,x0,x1,now,jam);
  const C=kin?['#facc15','#facc15','#facc15','#facc15','#1e293b','#e2e8f0','#facc15','#991b1b','#facc15','#1d4ed8']:['#facc15','#facc15','#e2e8f0','#1e293b','#991b1b','#2563eb','#f8fafc','#16a34a','#facc15','#475569'];   /* Kinshasa : surtout des taxis jaunes, et les taxis-bus bleus */
  for(const lane of [0,1]){ const dir=lane?-1:1, gap=jam?20:50/Math.max(0.2,dens)*0.5+16, v=jam?(2+Math.sin(now/9000+lane)*2):(night?55:28), n=Math.floor(len/gap);
    for(let k=0;k<n;k++){ const h=(k*2654435761+lane*97)>>>0, ty=h%11, w=ty===9?26:ty===10?8:13, off=((k*gap+dir*now/1000*v)%len+len)%len, x=x0+(dir>0?off:len-off), yy=lane?y+13:y-6;
      if((h>>>4)%100>dens*100+25) continue; g.fillStyle='rgba(0,0,0,.3)'; g.fillRect(x+1,yy+1,w,ty===10?3:6); g.fillStyle=ty===10?'#111827':C[ty%C.length]; g.fillRect(x,yy,w,ty===10?3:6); g.fillStyle='rgba(15,23,42,.6)'; if(ty!==10) g.fillRect(x+(dir>0?w*0.6:w*0.15),yy+1,w*0.25,4);
      if(kin&&ty===9){ g.fillStyle='#facc15'; g.fillRect(x,yy+3.6,w,1.2); }   /* taxi-bus bleu et jaune */
      if(jam&&(h>>>9)%5===0){ g.fillStyle='#ef4444'; g.fillRect(dir>0?x-1:x+w,yy+1,1.2,1.5); } } }
  if(kin&&jam){ for(let k=0;k<7;k++){ const h=(k*40503)>>>0, x=x0+((h%len)+Math.sin(now/7000+k)*40), yy=y+8.5; tmStreetGuy(g,x,yy,h,now,1); } } }   /* vendeurs sur la ligne entre les deux files, sans toucher les voitures */   /* vendeurs entre les voitures dans les bouchons */
// une personne de la rue vue de dessus : vendeur avec sa bassine sur la tête, ou passant
function tmStreetGuy(g,x,y,h,now,load){ const sk=['#5b3a24','#7a4a2a','#3f2516'][h%3], cl=['#dc2626','#2563eb','#16a34a','#f59e0b','#7c3aed','#0e7490','#be185d'][(h>>>3)%7], st=Math.sin(now/180+h)*0.8;
  g.fillStyle='rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x+0.8,y+3.6,2.6,1.2,0,0,6.283); g.fill(); g.fillStyle=cl; g.fillRect(x-1.8,y-1+st*0.2,3.6,4.2); g.fillStyle=sk; g.beginPath(); g.arc(x,y-2.2,1.5,0,6.283); g.fill();
  if(load){ g.fillStyle=['#e5e7eb','#94a3b8','#f59e0b','#22c55e'][(h>>>6)%4]; g.beginPath(); g.arc(x,y-3.4,2.6,0,6.283); g.fill(); g.fillStyle=['#fde68a','#93c5fd','#fca5a5','#bbf7d0'][(h>>>8)%4]; for(let j=0;j<3;j++){ g.beginPath(); g.arc(x-1+j,y-3.6+(j%2)*0.6,0.7,0,6.283); g.fill(); } } }
// Kinshasa : trottoir en latérite, étals sous parasols, vendeurs ambulants, pousse-pousse, palmiers, panneau
function tmKinStreet(g,y,x0,x1,now,jam){ const ys=y+31, len=x1-x0;
  g.fillStyle='#9a6b45'; g.fillRect(x0,ys,len,40); g.fillStyle='rgba(60,35,15,.25)'; for(let k=0;k<160;k++){ const h=(k*2246822507)>>>0; g.fillRect(x0+(h%len),ys+((h>>>8)%38),2+(h>>>12)%3,1.2); }
  const goods=['Unités · recharges','Eau pure','Pain','Arachides','Pagnes','Chikwangue','Brochettes','Change','Fruits','Beignets','Habits','Chaussures'];
  for(let x=x0+30,k=0;x<x1-30;x+=58,k++){ const h=(k*2654435761)>>>0, uc=['#dc2626','#2563eb','#facc15','#16a34a','#f97316','#7c3aed'][h%6];
    g.fillStyle='#78350f'; g.fillRect(x-9,ys+14,18,8); g.fillStyle=['#fde68a','#86efac','#fca5a5','#93c5fd','#fdba74'][(h>>>4)%5]; for(let j=0;j<6;j++) g.fillRect(x-8+j*2.8,ys+15+(j%2)*3,2,2);   /* étal et marchandise */
    g.fillStyle='rgba(0,0,0,.2)'; g.beginPath(); g.arc(x+2,ys+11,8,0,6.283); g.fill(); g.fillStyle=uc; g.beginPath(); g.arc(x,ys+9,8,0,6.283); g.fill(); g.strokeStyle='rgba(255,255,255,.6)'; g.lineWidth=0.5; g.beginPath(); for(let a=0;a<6;a++){ g.moveTo(x,ys+9); g.lineTo(x+Math.cos(a)*8,ys+9+Math.sin(a)*8); } g.stroke();   /* parasol */
    tmStreetGuy(g,x+12,ys+20,h,now,0); g.font='700 5px system-ui'; g.fillStyle='#fff7ed'; g.fillText(goods[(h>>>7)%goods.length],x-14,ys+36);
    if(k%8===3){ g.fillStyle='#14532d'; for(let a=0;a<6;a++){ g.beginPath(); g.ellipse(x+29+Math.cos(a)*7,ys+8+Math.sin(a)*7,7,2.4,a,0,6.283); g.fill(); } g.fillStyle='#713f12'; g.beginPath(); g.arc(x+29,ys+8,1.8,0,6.283); g.fill(); } }   /* palmier */
  for(let k=0;k<48;k++){ const h=(k*40503+7)>>>0, sp=(h%2?1:-1)*(6+(h>>>4)%8), x=x0+(((h%len)+sp*now/1000)%len+len)%len, yy=ys+4+((h>>>9)%30); tmStreetGuy(g,x,yy,h,now,(h>>>11)%3===0); }   /* passants et vendeurs ambulants */
  for(let k=0;k<3;k++){ const h=(k*97531)>>>0, x=x0+(((h%len)+(k%2?1:-1)*now/1000*5)%len+len)%len, yy=ys+30; g.fillStyle='#a16207'; g.fillRect(x-7,yy-3,14,6); g.fillStyle='#374151'; g.beginPath(); g.arc(x-5,yy+3,1.5,0,6.283); g.arc(x+5,yy+3,1.5,0,6.283); g.fill(); g.fillStyle='#e5e7eb'; g.fillRect(x-5,yy-5,10,3); tmStreetGuy(g,x+10,yy,h,now,0); }   /* pousse-pousse chargés */
  { const bx=x0+len*0.62; g.fillStyle='#374151'; g.fillRect(bx+28,ys+2,2,24); g.fillRect(bx+70,ys+2,2,24); g.fillStyle='#0369a1'; g.fillRect(bx+18,ys-8,64,14); g.fillStyle='#facc15'; g.fillRect(bx+18,ys+4,64,2); g.font='700 6px system-ui'; g.fillStyle='#fff'; g.fillText('Bienvenue à Kinshasa',bx+21,ys+1); } }   /* panneau */

// parvis des aéroports congolais : voie normale (tout le monde) et voie rapide payante gardée par les militaires
function tmKinCurb(g){ for(const p of (TM.L&&TM.L.poi)||[]) if(p.k==='ebola'){ g.fillStyle='rgba(0,0,0,.2)'; g.fillRect(p.x0+1.5,p.y0+1.5,p.x1-p.x0,p.y1-p.y0); g.fillStyle='#ecfdf5'; g.fillRect(p.x0,p.y0,p.x1-p.x0,p.y1-p.y0); g.strokeStyle='#059669'; g.lineWidth=0.8; g.strokeRect(p.x0,p.y0,p.x1-p.x0,p.y1-p.y0); g.font='700 5.2px system-ui'; g.fillStyle='#065f46'; g.fillText('🦠 Ebola · QR code',p.x0+3,p.y0+7); }   /* tables du contrôle Ebola */
  g.fillStyle='#57534e'; g.fillRect(448,1238,4,60); g.fillStyle='#dc2626'; for(let y=1240;y<1296;y+=8) g.fillRect(448,y,4,4);
  g.fillStyle='#f8fafc'; g.fillRect(452,1258,60,2); g.fillStyle='#dc2626'; for(let x=452;x<512;x+=10) g.fillRect(x,1258,5,2);   /* barrière */
  g.fillStyle='#e7e5e4'; g.fillRect(620,1246,18,14); g.fillStyle='#1e3a8a'; g.fillRect(620,1246,18,3); g.font='700 5px system-ui'; g.fillStyle='#111827'; g.fillText('Péage',622,1256);
  g.font='700 7px system-ui'; g.fillStyle='#fde68a'; g.fillText('Voie rapide · payante (10 $) · militaires',458,1300); g.fillStyle='#e5e7eb'; g.fillText('Voie normale · tout le monde',40,1300); }
function tmCurb(g,now){ const V=[['taxi','#facc15',14,7],['taxi','#facc15',14,7],['car','#e2e8f0',14,7],['car','#1e293b',14,7],['car','#991b1b',14,7],['bus','#0e7490',30,9],['taxi','#2563eb',14,7],['navette','#f8fafc',24,9],['car','#64748b',14,7]];
  for(let k=0;k<V.length;k++){ const [t,c,w,h]=V[k], lane=k%2, sp=lane?0.018:0.024, per=1200/sp, u=((now+k*per/V.length)%per)/per, x0=-60+u*1180;
    let x=x0; const stop=lane?[[160,0.1],[470,0.1],[760,0.1],[900,0.1]]:[[260,0.1],[820,0.1]]; for(const [sx] of stop) if(Math.abs(x0-sx)<10) x=sx;   // s'arrête au trottoir
    const y=lane?1266:1286; g.fillStyle='rgba(15,23,42,.3)'; g.fillRect(x+1.5,y+1.5,w,h); g.fillStyle=c; g.fillRect(x,y,w,h); g.fillStyle='rgba(15,23,42,.65)'; g.fillRect(x+w*0.62,y+1,w*0.22,h-2); if(t==='bus'||t==='navette'){ g.fillStyle='rgba(186,230,253,.8)'; for(let j=0;j<4;j++) g.fillRect(x+2+j*(w-8)/4,y+1,(w-8)/4-1,1.4); } if(t==='taxi'){ g.fillStyle='#111'; g.fillRect(x+w*0.3,y+h/2-1,2,2); } } }
// panneaux d'orientation jaunes (comme dans les vrais aéroports), affiches touristiques, drapeaux des provenances
function tmWay(g,L,TH,fit){ const Y=(t,x0,y0,x1,y1)=>{ g.fillStyle='rgba(15,23,42,.25)'; g.fillRect(x0+1.5,y0+1.5,x1-x0,y1-y0); fit(t,x0,y0,x1-x0,y1-y0,'#111827','#facc15'); };
  Y('↑ Sûreté · Portes   |   Security · Gates',340,1152,630,1166); Y('↑ Portes · Gates   🚻 Toilettes   ☕ Cafés',330,820,630,832);
  Y('↓ Douane · Sortie   |   Customs · Exit',680,846,890,858); Y('🚕 Taxis · 🚌 Bus · 🅿️ Parking',664,1194,850,1208);
  const A=AP(TM.code)||{}, C=COUNTRIES[A.cc]||[A.city||''], sub={AF:'Fleuves · forêts · rumba · hospitalité',EU:'Musées · gastronomie · patrimoine',NA:'Grands espaces · villes · culture',AS:'Temples · saveurs · traditions',ME:'Désert · souks · architecture',SA:'Plages · carnaval · nature',OC:'Lagons · récifs · grands espaces'}[TH.reg]||'Tourisme · culture · gastronomie';
  const PIM=typeof myApPicImg==='function'?myApPicImg(TM.code):null, PCAP=typeof myApCap==='function'?myApCap(TM.code):'';
  const portrait=(x0,y0,w,h,cap)=>{ g.fillStyle='rgba(15,23,42,.35)'; g.fillRect(x0+2,y0+2,w,h); g.fillStyle='#b45309'; g.fillRect(x0,y0,w,h); g.fillStyle='#fde68a'; g.fillRect(x0+1.5,y0+1.5,w-3,h-3); const ih=cap?h*0.8:h-5; g.save(); g.translate(x0+w/2,0); if(TH.mx) g.scale(-1,1); g.drawImage(PIM,-w/2+2.5,y0+2.5,w-5,ih-0.5); g.restore(); if(cap) fit(cap,x0+2.5,y0+ih+2.5,w-5,h-ih-5,'#111827',null); };
  for(const [x0,y0,x1,y1] of [[860,1196,996,1230]]){ const gr=g.createLinearGradient(x0,y0,x1,y1); gr.addColorStop(0,'#0e7490'); gr.addColorStop(0.55,'#f59e0b'); gr.addColorStop(1,'#be185d'); g.fillStyle=gr; g.fillRect(x0,y0,x1-x0,y1-y0); g.strokeStyle='#e5e7eb'; g.lineWidth=1.2; g.strokeRect(x0,y0,x1-x0,y1-y0);
    fit(`${TH.flag} Découvrez ${C[0]}`,x0+3,y0+3,x1-x0-6,(y1-y0)*0.5,'#fff',null); fit(sub,x0+3,y0+(y1-y0)*0.55,x1-x0-6,(y1-y0)*0.35,'#fef3c7',null,1); }   // affiche lumineuse
  const fl=[...new Set((TM.F?TM.F.arrs:[]).map(f=>f.D&&f.D.A&&f.D.A.cc).filter(Boolean))].slice(0,10).map(cc=>{ try{ return String.fromCodePoint(...[...cc.toUpperCase()].map(c=>127397+c.charCodeAt(0))); }catch(e){ return ''; } }).join(' ');
  if(fl) fit(fl,700,1003,260,9,'#111827',null);   // drapeaux des pays de provenance des vols du jour
}
// postes éloignés : vos avions stationnés + les avions des autres compagnies présents à l'aéroport mais pas à une porte du plan (comme en 3D)
function tmParked(g,L,now){ const P=((TM.F&&TM.F.parked)||[]).map(p=>({reg:p.reg,col:(S.company&&S.company.color)||'#b91c1c',sc:tmPSc({model:p.model,N:modelOf(p.a).seats}),tag:p.a.status==='maint'?' 🔧':''}));
  try{ if(typeof rivPresent==='function'){ const onStand=new Set(); for(const d of L.deps||[]) if(d.f.reg&&tmDepPlane(d,now)) onStand.add(d.f.reg); for(const a of L.arrs||[]) if(a.f.reg&&tmArrPlane(a,now)) onStand.add(a.f.reg);
      for(const x of rivPresentShown(TM.code,now)) if(!onStand.has(x.reg)) P.push({reg:x.reg,col:x.col,sc:x.cat==='prop'?0.5:x.cat==='wb'?1:0.66,tag:''}); TM.remote=P.map(p=>p.reg); } }catch(e){ console.warn(e); }
  if(L.nd){ const occ=[]; for(const d of L.deps||[]) if(tmDepPlane(d,now)) occ.push([d.stand.x,d.stand.y]); for(const a of L.arrs||[]) if(tmArrPlane(a,now)) occ.push([a.door.x,a.sy]); { const pq=tmPres(now); if(pq) occ.push([pq.X,-64]); }   /* poste de l'avion présidentiel */
    const used=new Set(), N=((typeof apGates==='function'&&apGates(TM.code))||[]).length||40, own=((TM.F&&TM.F.parked)||[]).slice().sort((a,b)=>a.a.id<b.a.id?-1:1), gp=new Map();
    for(const p of own) gp.set(p.reg,gateSlot(TM.code,p.a));   /* comme sur la carte et en 3D : vos avions garés, un poste chacun */
    try{ for(const x of rivPresentShown(TM.code,now)) if(x.gate&&!gp.has(x.reg)) gp.set(x.reg,x.gate); }catch(e){}
    const rest=[]; for(const p of P){ const q=gp.get(p.reg), x=ndjX(q), y=ndjY(q); if(x!=null&&!occ.some(o=>Math.abs(o[0]-x)<60&&o[1]===y)){ occ.push([x,y]); tmPlane(g,x,y,p.col,y<TM_TWY?Math.PI:0,p.sc); g.fillStyle='#f8fafc'; g.font='700 7px system-ui'; g.fillText(p.reg+p.tag,x+6,y<TM_TWY?y+12:y-4); } else rest.push(p); }
    P.length=0; P.push(...rest); if(!P.length) return; }   /* N'Djili : chaque avion garé à son poste de la 3D ; s'il est pris, sur une aire éloignée */
  if(!P.length) return; const x0=(L.rx0!=null?L.rx0:L.bx0)+60, step=TM_PK_X, per=L.parkPer||Math.max(1,Math.floor(((L.rx1!=null?L.rx1:L.bx1)-40-x0)/step)+1);
  P.forEach((p,k)=>{ const row=Math.floor(k/per); if(row>7) return; const x=x0+(k%per)*step, y=(L.parkTop!=null?L.parkTop:L.top)+30+row*TM_PK_Y; tmPlane(g,x,y,p.col,Math.PI,p.sc); g.fillStyle='#f8fafc'; g.font='700 7px system-ui'; g.fillText(p.reg+p.tag,x-14,y-8); }); }
// une valise vue de dessus : valise rigide (nervures, poignée, roulettes), sac de voyage (sangle), sac à dos, carton scotché, étiquette du vol
function tmBagDraw(g,x,y,b,s){ const i=(b.p&&b.p.i)||(b.c?b.c.length:0)+Math.round(x*7+y*3), t=((b.p?b.p.i:0)+Math.floor(b.t0/1000))%7, c=b.c||'#1f2937';
  g.fillStyle='rgba(15,23,42,.25)'; g.fillRect(x-2.6,y-1.6,6.4,5);
  if(t<=2){ g.fillStyle=c; g.fillRect(x-3.2,y-2.4,6.4,4.8); g.strokeStyle='rgba(255,255,255,.28)'; g.lineWidth=0.35; g.beginPath(); for(const dx of [-1.6,0,1.6]){ g.moveTo(x+dx,y-2.2); g.lineTo(x+dx,y+2.2); } g.stroke(); g.fillStyle='#111827'; g.fillRect(x-1.2,y-3,2.4,0.7); g.fillRect(x-3.3,y+2,0.9,0.7); g.fillRect(x+2.4,y+2,0.9,0.7); }   // valise rigide
  else if(t===3){ g.fillStyle=c; g.beginPath(); g.ellipse(x,y,3.6,2.3,0,0,6.283); g.fill(); g.strokeStyle='#111827'; g.lineWidth=0.45; g.beginPath(); g.moveTo(x-2.4,y-1.6); g.quadraticCurveTo(x,y-3.6,x+2.4,y-1.6); g.stroke(); g.strokeStyle='rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x-3,y); g.lineTo(x+3,y); g.stroke(); }   // sac de voyage
  else if(t===4){ g.fillStyle='#c8a26b'; g.fillRect(x-3,y-2.6,6,5.2); g.fillStyle='rgba(120,90,40,.9)'; g.fillRect(x-3,y-0.35,6,0.7); g.fillRect(x-0.35,y-2.6,0.7,5.2); }   // carton scotché
  else if(t===5){ g.fillStyle=c; g.beginPath(); g.roundRect?g.roundRect(x-2.4,y-2.8,4.8,5.6,1.4):g.rect(x-2.4,y-2.8,4.8,5.6); g.fill(); g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x-1.8,y+0.3,3.6,2); }   // sac à dos
  else { g.fillStyle=c; g.fillRect(x-3.6,y-2.2,7.2,4.4); g.fillStyle='rgba(255,255,255,.2)'; g.fillRect(x-3.6,y-2.2,7.2,1); g.fillStyle='#111827'; g.fillRect(x-1,y-2.8,2,0.6); }   // grande valise souple
  if(s>2.6){ const fc=(b.p&&b.p.f&&b.p.f.col)||(b.g&&b.g.f&&b.g.f.col)||'#facc15'; g.fillStyle=fc; g.fillRect(x+2,y-3.4,1.4,1.8); g.fillStyle='#fff'; g.fillRect(x+2.2,y-3.2,1,0.6); } }   // étiquette à la couleur du vol
function tmLight(g,L,TH){ const hr=tmLocalHour(), night=hr<6||hr>=18.5;
  if(!night){ const k=(hr-12)/6, a=Math.max(0.03,0.09-Math.abs(k)*0.04); g.fillStyle=`rgba(255,247,214,${a})`; g.beginPath(); for(let x=-40;x<1000;x+=48){ g.moveTo(x,2); g.lineTo(x+26,2); g.lineTo(x+26+k*70,150); g.lineTo(x+k*70,150); } g.fill(); }   // rayons du soleil par la façade vitrée
  else { for(let x=40;x<1000;x+=90) for(let y=70;y<1220;y+=130){ if(x>636&&x<664) continue; const gr=g.createRadialGradient(x,y,0,x,y,46); gr.addColorStop(0,'rgba(253,224,141,.16)'); gr.addColorStop(1,'rgba(253,224,141,0)'); g.fillStyle=gr; g.fillRect(x-46,y-46,92,92); }   // éclairage intérieur
    for(let x=L.bx0+60;x<L.bx1;x+=200){ const y=Math.max(L.top+40,-170), gr=g.createRadialGradient(x,y,0,x,y,120); gr.addColorStop(0,'rgba(254,240,138,.22)'); gr.addColorStop(1,'rgba(254,240,138,0)'); g.fillStyle=gr; g.fillRect(x-120,y-120,240,240); g.fillStyle='#fef9c3'; g.beginPath(); g.arc(x,y,2.5,0,6.283); g.fill(); } }   // mâts d'éclairage du tarmac
}
function tmDecor(L,now,g,fit){
  const bins=[[20,1170],[630,1170],[640,980],[180,700],[560,700],[640,600],[10,600],[700,1210],[990,1210],[670,940],[990,940],[660,470]];
  for(const [x,y] of bins){ g.fillStyle='#475569'; g.beginPath(); g.arc(x,y,3.2,0,6.283); g.fill(); g.fillStyle='#22c55e'; g.beginPath(); g.arc(x,y,1.6,0,6.283); g.fill(); }
  for(const p of L.poi) if(p.k==='wc'){ const x=p.x1+5, y=(p.y0+p.y1)/2; g.fillStyle='#e2e8f0'; g.fillRect(x-3,y-4,6,8); g.fillStyle='#38bdf8'; g.fillRect(x-2,y-3,4,2.5); }
  if(TM.rain) for(const [x,y] of [[160,1224],[480,1224],[760,1224],[930,1224]]){ g.fillStyle='#facc15'; g.beginPath(); g.moveTo(x,y-7); g.lineTo(x+5,y+3); g.lineTo(x-5,y+3); g.closePath(); g.fill(); g.strokeStyle='#111827'; g.lineWidth=0.6; g.stroke(); fit('Sol glissant',x-14,y+4,28,6,'#111827','rgba(250,204,21,.9)'); } }
function tmAirline(f){ if(f._al) return f._al; const own=!f.riv, code=own?((S.company&&S.company.code)||String(f.fn||'').replace(/\d+$/,'')):String(f.fn||'').replace(/\d{3}$/,''), R=own?null:((S.rivals||[]).find(x=>x.code===code)||(f.riv&&f.riv.code===code?f.riv:null));
  const name=own?((S.company&&S.company.name)||code):(R&&R.name)||(typeof airlineName==='function'?airlineName(code):'')||(f.riv&&f.riv.name)||code;
  const col=own?((S.company&&S.company.color)||'#b91c1c'):(R&&R.color)||['#0f766e','#7c2d12','#1e3a8a','#6d28d9','#9d174d','#166534','#b45309','#0e7490'][hashStr(code)%8];
  return (f._al={code,name,col,own}); }
const tmFKey=F=>(F.later||[]).map(f=>f.D.key).join(',')+'#'+F.deps.map(f=>f.D.key+':'+Math.round(f.D.P/60000)+':'+Math.round((f.D.tko||0)/60000)).join(',')+'|'+F.arrs.map(f=>f.D.key+':'+(f.soon?1:0)+':'+Math.round(f.D.arr/60000)).join(',');
// construction en petits morceaux (générateur) : en cours de partie elle se fait sur plusieurs images, sans figer l'écran
function tmBuild(F0){ const it=tmBuildGen(F0); while(!it.next().done); }
function* tmBuildGen(F0){ TM.builtT=tmNow(); const F=F0||tmFlights(TM.code), L=tmLayout(F), ppl=[]; TM.fkey=tmFKey(F); TM.full=performance.now();
  for(const g of [...L.deps,...L.arrs]){ void g.f.man; yield; }   // fiches des passagers, un vol à la fois
  tmSched(L); yield;
  const DG=[...L.deps,...(L.later||[])]; for(let fi=0;fi<DG.length;fi++){ const g=DG[fi]; g.f.col=TM_COL[fi%TM_COL.length]; for(let i=0;i<g.sched.length;i++){ const rw=g.sched[i].row; ppl.push({f:g.f,i,row:rw,K:tmDepKF(g,i,L),c:g.f.col,sk:tmSkin(rw,TM_SKIN[(i*7+fi)%TM_SKIN.length]),dep:1,bag:g.sched[i].bags,ckDone:g.sched[i].ckDone,kid:rw?rw.age<12:i%9===4}); } yield; }
  for(let fi=0;fi<L.arrs.length;fi++){ const g=L.arrs[fi]; g.f.col=TM_COL[(fi+5)%TM_COL.length]; if(g.f.soon) continue; const nLost=Math.min(3,g.f.D.bag&&g.f.D.bag.lost||0);
    for(let i=0;i<Math.min(g.f.N,1600);i++){ const R=tmArrKF(g,i,L,i<nLost), rw=g.f.man&&g.f.man.rows&&g.f.man.rows[i]; ppl.push({f:g.f,i,row:rw,K:R.K,c:g.f.col,sk:tmSkin(rw,TM_SKIN[(i*5+fi)%TM_SKIN.length]),dep:0,bag:R.bags,hasBag:R.bags,bagT:R.bagT,kid:rw?rw.age<12:i%9===4}); } yield; }
  try{ tmFamilies(ppl); }catch(e){}
  try{ ppl.push(...tmGreeters(L,ppl)); for(const p of ppl) if(p.fam&&p.lead&&p.lead._gm){ const sh=p.K.shopT; p.K=p.lead.K.map(k=>k.bus?{...k,st:k.st+p.fsuf}:{...k,x:k.x+p.fdx,y:k.y+p.fdy,st:k.st+p.fsuf}); p.K.shopT=sh; } }catch(e){ console.warn(e); }   // la famille suit le passager vers la personne qui l'attend
  try{ ppl.push(...tmStaff(L,tmNow())); }catch(e){}
  try{ ppl.push(...tmCrews(L)); }catch(e){}
  try{ for(const p of ppl.slice()) if(p.row&&/fauteuil/.test(p.row.assist||'')){ p.wheel=1; ppl.push({staff:'assist',i:ppl.length,K:p.K.map(k=>({...k,x:k.x-5,y:k.y+3,st:'pousse le fauteuil roulant de '+p.row.first+' '+p.row.last})),c:'#0e7490',sk:TM_SKIN[p.i%TM_SKIN.length],dep:3}); } }catch(e){}
  TM.F=F; TM.L=L; TM.ppl=ppl; TM.bags=tmBags(L);
  try{ const st=ppl.find(p=>p.row&&p.row.star&&p.f); if(st&&TM.starKey!==st.f.D.key){ TM.starKey=st.f.D.key; toast(`⭐ <b>Merveil Hakeem Dianzenza</b> est dans l’aérogare (vol ${esc(st.f.fn)} ${st.dep?'vers Paris':'en provenance de Paris'}) : cherchez l’étoile dorée !`); } }catch(e){}
  // l'avion arrivé reste au poste tant que ses passagers et ses valises ne sont pas tous sortis
  for(const d of L.deps){ d.showFrom=Math.max(d.f.D.gate.open-40*MIN,(d.f.D.prevArr||0)+2*MIN); try{ const ac=d.f.a, l=d.f.l; if(ac&&l&&ac.flight){ const legs=ac.flight.legs, i=legs.indexOf(l), pv=i>0?legs[i-1]:null; d.showFrom=pv&&pv.to===TM.code?pv.dep+legProf(pv,modelOf(ac)).total:-Infinity; } }catch(e){} }
  for(const a of L.arrs){ if(!a.f.soon||!a.f.reg) continue; const nx=L.deps.find(d=>d.f.reg===a.f.reg&&d.f.D.P>a.f.D.arr); if(nx) nx.showFrom=Math.max(nx.showFrom===-Infinity?0:(nx.showFrom||0),a.f.D.arr+45*MIN); }   // pas encore posé : il ne peut pas déjà être à sa porte de départ
  for(const a of L.arrs){ if(a.f.soon) continue; const D=a.f.D; let u=Math.max(D.arr+60*MIN,(D.bag&&D.bag.last||0)+10*MIN); for(const p of ppl) if(p.f===a.f&&p.dep!==1&&p.K.length) u=Math.max(u,p.K[p.K.length-1].t); for(const b of TM.bags) if(b.belt===a.belt) u=Math.max(u,b.t0+5*MIN); a.until=Math.min(u,D.arr+4*HOUR);
    const own=a.f.acId&&S.fleet.find(x=>x.id===a.f.acId); if(own) a.until=D.arr+4*HOUR;
    const nx=a.f.reg&&L.deps.find(d=>d.f.reg===a.f.reg&&d.f.D.P>D.arr); if(nx){ let lb=0; for(const b of TM.bags) if(b.belt===a.belt) lb=Math.max(lb,b.t0); a.until=Math.min(a.until,Math.max(D.arr+25*MIN,lb+2*MIN,Math.min(nx.f.D.gate.open-15*MIN,D.arr+45*MIN))); nx.showFrom=Math.max(nx.showFrom===-Infinity?0:nx.showFrom,Math.max(D.arr+40*MIN,a.until)+4*MIN+30000); a.next=nx; if(L.nd&&Math.abs(nx.stand.x-a.door.x)<5){ a.same=1; nx.showFrom=Math.max(D.arr+40*MIN,a.until)+1000; } } } TM.built=performance.now();   /* N'Djili : même poste qu'en 3D, l'avion reste au poste entre l'arrivée et le départ */
  // incidents des vols (Aérogare en direct) : affichés sur le plan au bon moment
  TM.inc=[]; try{ for(const g of L.deps) if(g.f.l&&g.f.D.rows) for(const x of pfIncidents(g.f.D,'dep')) TM.inc.push({x:g.desk.x+18,y:g.desk.y-10,at:x.at,t:x.t,f:g.f});
    for(const a of L.arrs) if(a.f.D.rows) for(const x of pfIncidents(a.f.D,'arr')) TM.inc.push({x:x.id==='lost'?925:a.door.x,y:x.id==='lost'?790:60,at:x.at,t:x.t,f:a.f}); }catch(e){}
  tmBoard(); }
const tmDelay=f=>f.dl||(f.l&&f.l.hOut>8*MIN?Math.round(f.l.hOut/MIN):0);
function tmBoard(){ const el=document.getElementById('tmBoard'); if(!el||!TM.F) return; const F=TM.F, now=tmNow();
  const zoneNow=D=>{ const win=Math.max(MIN,(D.gate.last-D.gate.open)/5), z=Math.floor((now-D.gate.open)/win); return z<=0?'priorité':'zone '+Math.min(4,z); };
  const stD=f=>{ const D=f.D, dl=tmDelay(f); return (dl?`<b style="color:#f87171">Retardé +${dl} min${f.dlw?' ('+f.dlw+')':''}</b> · `:'')+(now<D.ci.close?'🎫 Enregistrement':now<D.gate.open?'🛍️ Salle d’attente':now<D.gate.last?'🚪 Embarquement '+zoneNow(D):now<D.gate.close?'⚠️ Dernier appel':'✈️ Porte fermée'); };
  const own=f=>` <span style="color:#94a3b8">${esc(f.riv?(f.riv.name||''):(S.company.name||''))}</span>`, row=(c,a,b,d,e,k)=>`<tr data-tmf="${k}"><td><i style="background:${c}"></i></td><td><b>${a}</b></td><td>${b}</td><td>${d}</td><td>${e}</td></tr>`;
  const cx=(F.cancel||[]).map(c=>`<tr><td><i style="background:#ef4444"></i></td><td><b>${esc(c.fn)}</b></td><td>${esc(c.dest)}</td><td></td><td><b style="color:#f87171">❌ Annulé</b> · ${esc(c.why)}</td></tr>`).join('');
  el.innerHTML=(F.deps.length||cx?`<table><tr><th></th><th>Départ</th><th>Destination</th><th>Porte</th><th>Statut</th></tr>${F.deps.map((f,i)=>row(f.col,tmHM(f.D.P)+' '+esc(f.fn),esc(f.D.B.city)+' · '+f.N+' pax'+own(f),esc(f.D.gate.name),stD(f),'d'+i)).join('')}${cx}</table>`:'<div class="small mut">Aucun départ dans les 3 prochaines heures.</div>')
    +(F.arrs.length?`<table><tr><th></th><th>Arrivée</th><th>Provenance</th><th>Tapis</th><th>Statut</th></tr>${F.arrs.map((f,i)=>row(f.col,tmHM(f.D.arr)+' '+esc(f.fn),esc(f.D.A.city)+' · '+f.N+' pax'+own(f),String(i+1),f.soon?'🛬 Atterrit bientôt':now<f.D.bag.first?'🛂 Immigration':now<f.D.bag.last?'🧳 Bagages en livraison':'🛃 Douane / sortie','a'+i)).join('')}</table>`:'');
  el.querySelectorAll('[data-tmf]').forEach(tr=>tr.onclick=()=>{ const k=tr.dataset.tmf, g=k[0]==='d'?TM.L.deps[+k.slice(1)]:TM.L.arrs[+k.slice(1)]; if(g){ TM.selF=g.f; tmInfoFlight(g); tmFocus(k[0]==='d'?{x0:g.x0,y0:-150,x1:g.x1,y1:400}:{x0:660,y0:-150,x1:1000,y1:800}); TM.moved=1; } }); }
/* ---------- caméra : vue générale, zones, zoom, déplacement ---------- */
const TM_ZONES=[['🗺️ Vue générale',{x0:0,y0:-300,x1:1000,y1:1300}],['🛫 Pistes et postes',{x0:-40,y0:-300,x1:1040,y1:60}],['🎫 Enregistrement',{x0:0,y0:990,x1:640,y1:1300}],['🔍 Sûreté',{x0:0,y0:820,x1:640,y1:960}],['🛂 Police',{x0:300,y0:700,x1:640,y1:820}],
  ['🛍️ Boutiques',{x0:0,y0:420,x1:640,y1:700}],['🚪 Portes',{x0:0,y0:-200,x1:640,y1:400}],['🛬 Arrivées',{x0:660,y0:-200,x1:1000,y1:240}],['🛂 Immigration',{x0:660,y0:230,x1:1000,y1:430}],['🧳 Bagages',{x0:660,y0:420,x1:1000,y1:860}],['🛃 Douane',{x0:660,y0:850,x1:1000,y1:970}],['🤗 Hall des arrivées',{x0:660,y0:960,x1:1000,y1:1300}]];
function tmZoneRect(i){ const z=TM_ZONES[i], L=TM.L; if(!L) return z[1]; const nm=z[0];
  if(nm.includes('Vue générale')) return L.nd?{x0:-300,y0:L.top,x1:1300,y1:1350}:{x0:L.rx0!=null?L.rx0:L.bx0,y0:L.top,x1:L.rx1!=null?L.rx1:L.bx1,y1:1350}; if(nm.includes('Pistes')) return {x0:L.bx0,y0:L.top,x1:L.bx1,y1:60};
  if(nm.includes('Portes')){ let a=1e9,b=-1e9,c=1e9,e=-1e9; for(const d of L.deps){ a=Math.min(a,d.lounge.x0,d.stand.x-110); b=Math.max(b,d.lounge.x1,d.stand.x+110); c=Math.min(c,d.lounge.y0,d.stand.y-110); e=Math.max(e,d.lounge.y1); } return a<b?{x0:a,y0:c,x1:b,y1:e}:z[1]; } return z[1]; }
function tmFocus(R0){ const cv=TM.cv; if(!cv) return; const PT=96, PB=50; const xa=tmFx(R0.x0), xb=tmFx(R0.x1), ya=tmFy(R0.y0), yb=tmFy(R0.y1), R={x0:Math.min(xa,xb),x1:Math.max(xa,xb),y0:Math.min(ya,yb),y1:Math.max(ya,yb)}; const w=cv.clientWidth, h=cv.clientHeight, hu=Math.max(100,h-PT-PB), s=Math.min(w/(R.x1-R.x0),hu/(R.y1-R.y0))*0.97;
  TM.goal={s,x:(R.x0+R.x1)/2-w/(2*s),y:(R.y0+R.y1)/2-(PT+hu/2)/s}; }
function tmCamStep(){ const c=TM.cam, g=TM.goal; if(!g) return; const k=0.18; c.s+=(g.s-c.s)*k; c.x+=(g.x-c.x)*k; c.y+=(g.y-c.y)*k; if(Math.abs(g.s-c.s)<g.s*0.002&&Math.abs(g.x-c.x)<0.5&&Math.abs(g.y-c.y)<0.5){ Object.assign(c,g); TM.goal=null; } }
function tmZoomAt(f,sx,sy){ const c=TM.cam, w=TM.cv.clientWidth, h=TM.cv.clientHeight, LL=TM.L||{bx0:-40,bx1:1040}, fit=Math.min(w/(LL.bx1-LL.bx0),Math.max(100,h-146)/(TW.H-TW.top)), base=Math.min(w/1080,Math.max(100,h-146)/1600), ns=Math.max(Math.min(fit,base)*0.95,Math.min(base*16,c.s*f));   /* zoom maximal calculé sur le bâtiment (pas sur la largeur du tarmac) : on voit toujours bien les gens */ const wx=c.x+sx/c.s, wy=c.y+sy/c.s; c.s=ns; c.x=wx-sx/ns; c.y=wy-sy/ns; TM.goal=null; }
/* ---------- informations (passager, vol, équipement) ---------- */
function tmInfo(html){ const el=document.getElementById('tmInfo'); if(!el) return; el.innerHTML=html?`<button class="btn" data-tmx style="float:right;padding:2px 8px">✖</button>${html}`:''; el.hidden=!html; const x=el.querySelector('[data-tmx]'); if(x) x.onclick=()=>{ TM.sel=null; TM.selF=null; TM.dash=false; tmInfo(''); }; }
// rotation de l'avion au sol, étape par étape, avec l'avancement en direct
function tmTurn(f,dep,now){ const D=f.D, L=dep?[['🅿️ Avion au poste, cales et groupe électrique',D.ci.open-60*MIN,D.P-4*MIN],['🧹 Nettoyage de la cabine',D.gate.open-95*MIN,D.gate.open-70*MIN],['🍱 Camion traiteur : chargement des repas',D.gate.open-75*MIN,D.gate.open-25*MIN],['⛽ Avitaillement en carburant',D.P-60*MIN,D.P-22*MIN],['💧 Eau potable et vidange des toilettes',D.gate.open-40*MIN,D.gate.open-8*MIN],['🧳 Chargement des bagages en soute',D.ci.open+20*MIN,D.P-8*MIN],['🚶 Embarquement des passagers',D.gate.open,D.gate.close],['🚪 Portes fermées, passerelle retirée',D.gate.close,D.P-MIN],['🚜 Repoussage et mise en route',D.P,D.P+3*MIN]]
    :[['🛬 Atterrissage et roulage',D.arr-6*MIN,D.arr],['🅿️ Arrivée au poste, passerelle accolée',D.arr,D.arr+4*MIN],['🚶 Débarquement des passagers',D.arr+5*MIN,D.arr+20*MIN],['🧳 Déchargement des bagages',D.arr+3*MIN,(D.bag&&D.bag.last)||D.arr+40*MIN],['🛄 Livraison au tapis',(D.bag&&D.bag.first)||D.arr+15*MIN,(D.bag&&D.bag.last)||D.arr+40*MIN],['🧹 Nettoyage et préparation du vol suivant',D.arr+20*MIN,D.arr+50*MIN]];
  L.sort((a,b)=>a[1]-b[1]); return '<div class="small" style="margin-top:6px"><b>Rotation au sol</b>'+L.map(([t,a,b])=>{ const done=now>=b, on=now>=a&&now<b, pc=on?Math.round((now-a)/Math.max(1,b-a)*100):0; return `<div style="color:${done?'#94a3b8':on?'#facc15':'#cbd5e1'}">${done?'✓':on?'●':'○'} ${tmHM(a)} ${t}${on?` · ${pc} %`:''}</div>`; }).join('')+'</div>'; }
// ce que pense la personne, selon ce qu'elle vit en ce moment (et son humeur dans sa fiche)
// humeur selon ce que la personne vit VRAIMENT : temps passé dans la file, retard de son vol, attente de sa valise, file passée vite…
// renvoie {lvl:-2..2, t:texte} ; lvl -2 = excédé, +2 = ravi
// paroles variées : une phrase parmi plusieurs, qui change toutes les ~3 minutes de jeu (on ne répète pas toujours la même chose)
const tmSay=(p,now,list)=>list[((p.i||0)*7+Math.floor(now/(3*MIN))+((p.i||0)%5))%list.length];
function tmMood(p,q,now){ if(!p||!p.K||p.staff||p.crew) return null; const K=p.K, k=Math.min(K._k||1,K.length-1), st=q.st||'', w=p.row, D=p.f&&p.f.D, grumpy=w&&/énerv|impatient/.test(w.mood||'')?1:0, m=x=>Math.round(x/MIN);
  const seg0=K[k-1]?K[k-1].t:now, here=now-seg0;   // depuis combien de temps elle fait ce qu'elle fait
  if(/raté|trop tard|clôturé/.test(st)){ const late=K[0]&&/arrive en retard/.test(K[0].st), jamW=late&&/embouteillage|bloquée/.test(K[0].st);
    return {lvl:-2,t:tmSay(p,now,[...(jamW?['Ces embouteillages sur le boulevard… je le savais !','Deux heures dans les bouchons pour rater mon avion !','Ce trafic de Kinshasa, c’est pas possible !']:[]),'Putain, j’ai raté mon vol ! Je n’y crois pas…','Nzambe na ngai… l’avion est parti sans moi.','Je vais devoir racheter un billet ? Pas question !','Ma famille m’attend à l’arrivée… je les appelle comment ?','Bon, on respire. Il y aura bien un autre vol.','Ils n’ont pas pu attendre deux minutes ?','Je savais que j’aurais dû partir plus tôt.','Mon patron ne va jamais me croire.'])}; }
  if(/perdue|pas arrivée/.test(st)) return {lvl:-2,t:'Putain, ma valise n’est pas arrivée ! Trois heures de vol pour ça…'};
  if(q.q){ const lim=grumpy?8:12;
    if(here>2.2*lim*MIN) return {lvl:-2,t:tmSay(p,now,[`Putain, ça fait ${m(here)} minutes que je fais la queue ! J’en ai marre.`,`${m(here)} minutes debout… mes pieds !`,'Il n’y a qu’un seul guichet ouvert ou quoi ?','Eh ! Monsieur, ça avance devant ?',`Ça fait ${m(here)} minutes, je vais rater mon avion !`,'Mama na ngai, cette file ne bouge pas…'])};
    if(here>lim*MIN) return {lvl:-1,t:tmSay(p,now,[`${m(here)} minutes déjà… ça n’avance pas.`,'Patience… patience…','J’aurais dû faire l’enregistrement en ligne.','Ça avance doucement, bon.','Encore un peu et c’est mon tour.'])};
    if(here<3*MIN) return {lvl:0,t:''}; }
  if(/attend sa valise/.test(st)){ if(here>(grumpy?15:22)*MIN) return {lvl:-2,t:tmSay(p,now,[`Putain, ${m(here)} minutes au tapis et toujours pas ma valise !`,'Toutes les valises sont sorties sauf la mienne…','Ils l’ont mise dans un autre avion ou quoi ?','Je ne bouge pas d’ici sans ma valise.'])}; if(here>12*MIN) return {lvl:-1,t:tmSay(p,now,['Elle arrive quand, cette valise ?','La mienne est noire… comme toutes les autres.','Ah, celle-là ? Non, ce n’est pas la mienne.'])}; }
  if(p.dep===1&&D){ const dl=tmDelay(p.f); if(dl>=30&&/porte|attend|assis|café|restaurant|duty|salle/.test(st)) return {lvl:-2,t:`Encore ${dl} minutes de retard${p.f.dlw?' à cause de la météo':''}… j’en ai marre, j’ai un rendez-vous !`};
    if(dl>=12&&/porte|assis/.test(st)) return {lvl:-1,t:`${dl} minutes de retard, bon… on fait avec.`}; }
  // file d'attente qui vient de se terminer : rapide ou interminable ?
  for(let j=k-1;j>=1;j--){ if(now-K[j].t>8*MIN) break; if(K[j].q){ const d=K[j].t-K[j-1].t; if(d<5*MIN) return {lvl:2,t:tmSay(p,now,['Ah, c’est passé vite aujourd’hui ! Super.','Même pas cinq minutes, c’est rare !','Merci, très efficace aujourd’hui.'])}; if(d>25*MIN) return {lvl:-1,t:tmSay(p,now,[`Enfin ! ${m(d)} minutes de queue… quelle galère.`,'Ouf, enfin passé.','Bon, ça c’est fait. Un café maintenant.'])}; break; } }
  if(/attend son visa/.test(st)&&here>45*MIN) return {lvl:-2,t:tmSay(p,now,[`${m(here)} minutes pour un visa !`,'Une heure et demie dans cette salle… incroyable.','90 dollars et toujours rien !'])};
  if(/voyage refusé/.test(st)) return {lvl:-2,t:tmSay(p,now,['Mon QR code… il ne passe pas !','Pas de voyage sans QR code ? Mais je l’avais !'])};
  if(/retrouve|serre dans ses bras/.test(st)) return {lvl:2,t:tmSay(p,now,['Quel bonheur de vous revoir !','Mbote ! Ça fait tellement longtemps !','Les enfants ont tellement grandi !','Mama ! Tu m’as manqué !'])};
  if(p.dep===0&&/monte dans un taxi/.test(st)&&p.bagT&&p.K[0]&&p.bagT-p.K[0].t<40*MIN) return {lvl:2,t:'Sorti en moins de 40 minutes, c’est rapide pour une fois !'};
  return null; }
const TM_MOOD_EMO={'-2':'😤','-1':'😒','2':'😄'};
function tmThought(p,q){ { const M=tmMood(p,q,tmNow()); if(M&&M.t) return `<br><span class="small" style="color:${M.lvl<=-2?'#fca5a5':M.lvl<0?'#fcd34d':M.lvl>0?'#86efac':'#cbd5e1'}">${TM_MOOD_EMO[M.lvl]||'💭'} « ${esc(M.t)} »</span>`; } const st=q.st||'', w=p.row, angry=w&&/énerv|impatient/.test(w.mood||''), D=p.f&&p.f.D, now=tmNow(); let t='';
  if(p.staff||p.crew) return '';
  if(p.greet) t=/serre|accueille/.test(st)?'Enfin ! Tu as fait bon voyage ?':/repart/.test(st)?'On rentre, la voiture est garée devant.':'Il devrait sortir d’une minute à l’autre…';
  else if(/raté|trop tard|clôturé/.test(st)) t=tmSay(p,now,['Je n’y crois pas… il va falloir trouver un autre vol.','Le prochain vol est quand ?','Je vais dormir ici s’il le faut.']);
  else if(/pas présenté/.test(st)) t='Je n’ai pas vu l’heure passer… mon vol !';
  else if(/enregistrement/.test(st)) t=w&&w.bags>1?tmSay(p,now,['Pourvu que mes valises ne dépassent pas 23 kg…','Si c’est trop lourd, je mets le pagne dans le sac à main.','J’ai trop acheté de cadeaux…']):tmSay(p,now,['J’espère que ça va avancer plus vite.','Passeport, billet… tout est là.','Une place côté hublot, s’il vous plaît.']);
  else if(/sûreté|coupe-file/.test(st)) t='Ai-je bien enlevé la bouteille d’eau de mon sac ?';
  else if(/contrôle Ebola/.test(st)) t=tmSay(p,now,['J’ai bien mon QR code… il est où sur mon téléphone ?','Sans ce QR code, pas de voyage.','La batterie de mon téléphone, pourvu qu’elle tienne !']);
  else if(/visa/.test(st)) t=tmSay(p,now,['90 dollars pour un visa…','Ça fait combien de temps que j’attends ?','Ils appellent les noms quand ?']);
  else if(/porteur/.test(st)) t=tmSay(p,now,['Il veut combien ? Dix dollars ? Non !','Je n’ai rien demandé, moi…','Bon, 5 000 francs et c’est tout.']);
  else if(/voie rapide/.test(st)) t=tmSay(p,now,['Payer pour déposer… c’est Kin.','Au moins ici ça avance.']);
  else if(/voie normale/.test(st)) t=tmSay(p,now,['Que de monde !','Pardon, pardon, laissez passer…']);
  else if(/alarme|palpation/.test(st)) t=tmSay(p,now,['C’est sûrement ma ceinture…','Encore une fouille ? Je n’ai rien du tout !','Allez-y, je n’ai rien à cacher.','Ils fouillent tout le monde aujourd’hui.','Doucement, doucement…']);
  else if(/police|passeport|immigration|visa/.test(st)) t=w&&D&&w.nat!==(p.dep?D.A.cc:D.B.cc)?'Passeport, visa… j’espère que tout est en ordre.':'Ça devrait aller vite avec mon passeport.';
  else if(/attend l’appel|assis à la porte/.test(st)&&D) t=`Encore ${Math.max(0,Math.round((D.gate.open-now)/MIN))} min avant l’embarquement.`+(tmDelay(p.f)?' Et ce retard…':'');
  else if(/embarquement|carte d’embarquement/.test(st)) t='Siège '+(w?w.seat:'')+', j’espère qu’il y aura de la place pour mon sac.';
  else if(/passerelle/.test(st)) t=p.dep?'C’est parti !':'Enfin arrivé.';
  else if(/attend sa valise/.test(st)) t='Elle est où, ma valise ?';
  else if(/perdue|pas arrivée/.test(st)) t='Ma valise n’est pas arrivée… super.';
  else if(/douane/.test(st)) t='Rien à déclarer, j’espère qu’ils ne vont pas fouiller.';
  else if(/retrouve/.test(st)) t='Ça fait du bien de vous revoir !';
  else if(/duty free|shopping/.test(st)) t=tmSay(p,now,['Un petit cadeau pour la famille…','C’est cher ici !','Un parfum pour ma femme, elle va adorer.','Je regarde seulement…']);
  else if(/café|restaurant|mange/.test(st)) t=tmSay(p,now,['J’ai le temps de manger quelque chose.','Un café bien serré, ça réveille.','Le poulet mayo n’est pas mal ici.','Encore 30 minutes, tranquille.']);
  else if(/toilettes/.test(st)) t='Avant le vol, c’est plus prudent.';
  else if(/baie vitrée/.test(st)) t='Regarde, c’est peut-être notre avion !';
  else if(/monte dans un taxi/.test(st)) t=tmSay(p,now,['Direction la maison.','Chauffeur, on évite le boulevard, il y a des bouchons !','Enfin rentré à Kinshasa.','Je vais dormir comme un bébé ce soir.']);
  else if(/bus de piste/.test(st)) t=tmSay(p,now,['Encore un bus…','On est serrés comme des sardines !','L’avion est loin, dis donc.','Je vois l’avion !']);
  else if(/arrive en retard/.test(st)) t=tmSay(p,now,['Vite, vite, vite !','Pourvu que l’enregistrement soit encore ouvert !','Ce chauffeur a pris le pire chemin…']);
  else if(/arrive à l’aéroport/.test(st)) t=tmSay(p,now,['Bon, où est l’enregistrement ?','On est en avance, parfait.','Il y a du monde aujourd’hui !','J’espère que je n’ai rien oublié à la maison…']);
  if(!t) return ''; if(angry&&!/raté|perdue/.test(st)) t+=' (et j’en ai déjà marre)'; return `<br><span class="small" style="color:#cbd5e1">💭 « ${esc(t)} »</span>`; }
function tmInfoFlight(g){ const f=g.f, D=f.D, now=tmNow(), st={}; for(const p of TM.ppl) if(p.f===f){ const q=tmAt(p.K,now); if(q) st[q.st]=(st[q.st]||0)+1; }
  const top=Object.entries(st).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>`<div>• ${v} ${esc(k)}</div>`).join('');
  const inc=(TM.inc||[]).filter(x=>x.f===f&&now>=x.at-2*MIN).map(x=>`<div style="color:#fca5a5">⚠️ ${String(x.t).replace(/<[^>]+>/g,'')}</div>`).join('');
  const bg=(TM.bags||[]).filter(b=>g.sched?b.g===g:b.p&&b.p.f===f), loaded=g.sched?bg.filter(b=>now>=b.t0+b.dur).length:bg.filter(b=>now>=b.tB).length;
  tmInfo(`<b>✈️ ${esc(f.fn)}</b> ${esc(tmAirline(f).name)}${f.riv?'':' (votre compagnie)'}${f.reg?' · '+esc(f.reg):''}${f.model?' · '+esc(f.model):''}<br>${esc(D.A.city)} → ${esc(D.B.city)} · ${f.N} passagers${D.intl?' · international':' · national'}<br>`+
    (g.sched?`Porte ${esc(D.gate.name)} · embarquement ${tmHM(D.gate.open)} · fermeture ${tmHM(D.gate.close)}${tmDelay(f)?` · <b style="color:#f87171">retard +${tmDelay(f)} min</b>`:''}<br>🧳 ${loaded}/${bg.length} valises chargées en soute<br>`:`🧳 ${loaded}/${bg.length} valises livrées sur le tapis ${g.belt.n}<br>`)+
    tmTurn(f,!!g.sched,now)+`<div class="small" style="margin-top:4px">${top||'Aucun passager dans l’aérogare pour l’instant.'}</div>${inc?'<div class="small" style="margin-top:4px">'+inc+'</div>':''}`+
    (f.acId&&(f.riv||(f.l&&(S.fleet.find(a=>a.id===f.acId)||{flight:null}).flight&&(S.fleet.find(a=>a.id===f.acId)).flight.legs[(S.fleet.find(a=>a.id===f.acId)).flight.li]===f.l))?`<button class="btn" data-tmman="${esc(f.acId)}" style="margin-top:6px">📋 Manifeste complet (${f.N} passagers)</button>`:''));
  const bt=document.querySelector('[data-tmman]'); if(bt) bt.onclick=()=>{ const id=bt.dataset.tmman; tmClose(); try{ ACTIONS.manifest({id}); }catch(e){} }; }
function tmInfoPOI(p){ let n=0; for(const z of TM.pts||[]){ const x=z[0], y=z[1]; if(x>=p.x0-40&&x<=p.x1+40&&y>=p.y0-40&&y<=p.y1+60) n++; }
  const now=tmNow(), W=TM.L.W||{}, wt=p.k==='xray'||p.k==='arch'?tmWait(W.sec||[],now):p.k==='booth'&&!p.arr?tmWait(W.pol||[],now):0;
  const extra={kiosk:'Imprime cartes d’embarquement et étiquettes bagages.',xray:'Bacs, ordinateurs et liquides scannés.',arch:'Alarme → palpation par un agent.',booth:'Passeport, visa, tampon de sortie ou d’entrée.',egate:'Pour les passeports biométriques.',green:'Passage libre, contrôles aléatoires.',red:'Déclaration obligatoire, fouille des bagages.',lost:'Déclaration de bagage perdu, indemnité, livraison à domicile.',lounge:'Réservé aux passagers en classe affaires.'}[p.k]||'';
  tmInfo(`<b>${p.ico} ${esc(p.lab)}</b><br>👥 environ ${n} personne${n>1?'s':''} autour en ce moment${wt?` · attente ~${wt} min`:''}${extra?'<br><span class="small">'+extra+'</span>':''}`); }
/* ---------- rendu (phase 4 : personnages animés, mobilier, avions) ---------- */
// taille de l'avion selon le modèle (régional, moyen-courrier, gros porteur)
function tmPSc(f){ if(!f) return 0.66; if(f._psc) return f._psc; const m=String(f.model||''), N=f.N||0;
  const v=/ATR|Dash|DHC|Q400|CRJ|E1[4-9]\d|ERJ|Fokker|F50|Saab|Beech|Cessna|Twin/i.test(m)||(N&&N<75)?0.5:/A3[345]\d|A380|B7[4678]\d|747|767|777|787|A33|A35|B77|B78|B74|IL-?96|MD-?11/i.test(m)||N>240?1:0.66; return (f._psc=v); }
// avion vu de dessus : nez au point (x, y), queue vers l'arrière ; livrée de la compagnie (dérive, capots, bande)
function tmPlane(g,x,y,col,ang,sc,lit,fl){ sc=sc||0.66; g.save(); g.translate(x,y); if(ang) g.rotate(ang); g.scale(sc,sc);
  const wing=(s)=>{ g.moveTo(5*s,-38); g.lineTo(54*s,-66); g.lineTo(54*s,-71); g.lineTo(5*s,-60); }, stab=(s)=>{ g.moveTo(2.5*s,-88); g.lineTo(19*s,-100); g.lineTo(19*s,-104); g.lineTo(2*s,-99); };
  // ombre portée
  g.fillStyle='rgba(15,23,42,.28)'; g.save(); g.translate(5,6); g.beginPath(); g.ellipse(0,-50,7,52,0,0,6.283); wing(1); wing(-1); stab(1); stab(-1); g.fill(); g.restore();
  // ailes et empennage
  g.fillStyle='#e2e8f0'; g.strokeStyle='#94a3b8'; g.lineWidth=0.8; g.beginPath(); wing(1); wing(-1); stab(1); stab(-1); g.fill(); g.stroke();
  // réacteurs sous les ailes (capots à la couleur de la compagnie)
  const eng=sc>=0.9?[[-18,-44],[18,-44],[-34,-54],[34,-54]].slice(0,2):sc<=0.5?[[-16,-44],[16,-44]]:[[-17,-44],[17,-44]];
  for(const [ex,ey] of eng){ g.fillStyle='#475569'; g.beginPath(); g.ellipse(ex,ey,4.2,9,0,0,6.283); g.fill(); g.fillStyle=col; g.fillRect(ex-4.2,ey-3,8.4,4); g.fillStyle='#0f172a'; g.beginPath(); g.ellipse(ex,ey+8,3,1.4,0,0,6.283); g.fill(); }
  // fuselage avec dégradé (volume)
  const gr=g.createLinearGradient(-7,0,7,0); gr.addColorStop(0,'#cbd5e1'); gr.addColorStop(0.45,'#ffffff'); gr.addColorStop(1,'#cbd5e1'); g.fillStyle=gr; g.beginPath(); g.ellipse(0,-50,7,52,0,0,6.283); g.fill(); g.strokeStyle='#94a3b8'; g.lineWidth=0.7; g.stroke();
  // livrée : bande sur le dos, dérive colorée, cockpit
  g.fillStyle=col; g.globalAlpha=0.85; g.fillRect(-1.6,-90,3.2,62); g.globalAlpha=1; g.beginPath(); g.moveTo(-2.5,-104); g.lineTo(2.5,-104); g.lineTo(2,-84); g.lineTo(-2,-84); g.closePath(); g.fill();
  g.fillStyle='#0f172a'; g.beginPath(); g.moveTo(-4,-6); g.quadraticCurveTo(0,-2,4,-6); g.lineTo(3.4,-9); g.quadraticCurveTo(0,-7,-3.4,-9); g.closePath(); g.fill();
  { let zt=1; try{ const T=g.getTransform(); zt=Math.hypot(T.a,T.b); }catch(e){}
    if(zt>2.2){ // vu de près : volets, carénages, portes, issues de secours, lignes de panneaux, nom de la compagnie et immatriculation
      g.strokeStyle='rgba(71,85,105,.55)'; g.lineWidth=0.5; g.beginPath(); for(const s2 of [1,-1]){ g.moveTo(10*s2,-60.5); g.lineTo(50*s2,-70); g.moveTo(26*s2,-63.5); g.lineTo(26*s2,-67.5); g.moveTo(40*s2,-66.5); g.lineTo(40*s2,-70); } g.stroke();   // volets et ailerons
      g.fillStyle='rgba(148,163,184,.55)'; g.beginPath(); g.ellipse(0,-50,6.2,8,0,0,6.283); g.fill();   // carénage de voilure
      g.strokeStyle='rgba(100,116,139,.35)'; g.lineWidth=0.35; g.beginPath(); for(let yy=-16;yy>-94;yy-=7){ const hw=Math.max(1.2,7*Math.sqrt(Math.max(0,1-Math.pow((yy+50)/52,2)))); g.moveTo(-hw,yy); g.lineTo(hw,yy); } g.stroke();   // panneaux du fuselage
      g.fillStyle='#64748b'; for(const [dy,s2] of [[-14,-1],[-14,1],[-82,-1],[-82,1]]) g.fillRect(s2>0?5.2:-6.6,dy,1.4,3.2);   // portes avant et arrière
      g.fillStyle='#ef4444'; for(const s2 of [-1,1]) g.fillRect(s2>0?5.6:-6.8,-46,1.2,1.8);   // issues de secours au-dessus des ailes
      g.fillStyle='#334155'; g.beginPath(); g.arc(0,-101.5,1,0,6.283); g.fill();   // sortie de l'APU
      if(fl){ const A=(()=>{ try{ return tmAirline(fl); }catch(e){ return null; } })(); g.save(); g.rotate(-Math.PI/2); g.fillStyle=col; g.font='700 3.6px system-ui'; const nm=String((A&&A.name)||'').toUpperCase().slice(0,22); g.fillText(nm,22,1.3); g.restore();   // nom de la compagnie sur le toit
        if(fl.reg){ g.save(); g.translate(-33,-58); g.rotate(-0.5); g.fillStyle='#334155'; g.font='700 3.4px system-ui'; g.fillText(fl.reg,-8,1); g.restore(); } }   // immatriculation sur l'aile
      g.fillStyle='#1e293b'; g.fillRect(-1.2,-9.5,2.4,2.2); }   // pare-brise central
  }
  // feux de position (rouge à gauche, vert à droite) et feu anticollision quand l'avion roule
  g.fillStyle='#22c55e'; g.beginPath(); g.arc(-54,-69,1.8,0,6.283); g.fill(); g.fillStyle='#ef4444'; g.beginPath(); g.arc(54,-69,1.8,0,6.283); g.fill();
  if(lit){ g.fillStyle='rgba(239,68,68,.9)'; g.beginPath(); g.arc(0,-60,2.6,0,6.283); g.fill(); g.fillStyle='rgba(239,68,68,.25)'; g.beginPath(); g.arc(0,-60,7,0,6.283); g.fill(); }
  g.restore(); }
// véhicules de piste autour d'un avion garé, selon l'horaire réel du vol
function tmGSE(g,pl,f,now,arr){ const D=f.D, sc=tmPSc(f); g.save(); g.translate(pl.x,pl.y); g.rotate(pl.a||0); g.scale(sc,sc);
  const truck=(x,y,w,h,cab,body,lab)=>{ g.fillStyle='rgba(15,23,42,.25)'; g.fillRect(x+2,y+2,w,h); g.fillStyle=body; g.fillRect(x,y,w,h); g.fillStyle=cab; g.fillRect(x,y+h-h*0.28,w,h*0.28); g.fillStyle='rgba(15,23,42,.6)'; g.fillRect(x+w*0.15,y+h-h*0.2,w*0.7,h*0.08); };
  const cone=(x,y)=>{ g.fillStyle='#f97316'; g.beginPath(); g.arc(x,y,1.6,0,6.283); g.fill(); g.fillStyle='#fff'; g.beginPath(); g.arc(x,y,0.7,0,6.283); g.fill(); };
  const cart=(x,y,c)=>{ g.fillStyle='#9ca3af'; g.fillRect(x,y,8,6); g.fillStyle=c; g.fillRect(x+1,y+1,6,4); };
  const end=arr?(D.bag&&D.bag.last||D.arr+40*MIN):D.P-4*MIN, st=arr?D.arr+2*MIN:D.ci.open+20*MIN;
  if(now>st-6*MIN&&now<end+20*MIN){ cone(-56,-62); cone(56,-62); cone(0,-112); g.fillStyle='#facc15'; g.fillRect(-3,4,6,2); }   // plots et cales
  if(!arr&&now<D.P-5*MIN){ truck(-16,2,9,8,'#facc15','#e5e7eb'); g.strokeStyle='#111827'; g.lineWidth=0.8; g.beginPath(); g.moveTo(-8,6); g.lineTo(-5,0); g.stroke(); }   // groupe électrique au nez
  // bagages : tapis de chargement, tracteur et chariots
  const bgOn=arr?(now>D.arr+3*MIN&&now<end):(now>st&&now<D.P-8*MIN);
  if(bgOn){ g.fillStyle='#374151'; g.save(); g.translate(8,-22); g.rotate(-0.5); g.fillRect(0,-2,20,4); g.fillStyle='#facc15'; g.fillRect(16,-3,6,6); g.restore();
    const n=3, k0=Math.floor(now/40000)%2; g.fillStyle='#facc15'; g.fillRect(28,-4,7,7); for(let k=0;k<n;k++) cart(36+k*10,-4,['#1f2937','#7f1d1d','#1e3a8a','#14532d'][(k+k0)%4]); cart(36+n*10,-4,'#fde047');   /* dernier chariot : sacs de courrier */
    if(sc>=0.95){ const a0=arr?D.arr+3*MIN:st, a1=arr?end:D.P-8*MIN, pr=Math.max(0,Math.min(1,(now-a0)/Math.max(MIN,a1-a0))), left=arr?Math.round(pr*4):4-Math.round(pr*4);   // gros porteur : élévateur et conteneurs (ULD) chargés en soute arrière
      g.fillStyle='#334155'; g.fillRect(6,-88,16,11); g.fillStyle='#facc15'; g.fillRect(6,-88,16,2); g.fillStyle='#e2e8f0'; g.fillRect(9,-85,10,6); g.fillStyle='#facc15'; g.fillRect(24,-86,6,7);
      for(let k=0;k<left;k++){ const x=32+k*11; g.fillStyle='#64748b'; g.fillRect(x,-88,10,10); g.fillStyle='#cbd5e1'; g.fillRect(x+1,-87,8,6); g.strokeStyle='rgba(15,23,42,.4)'; g.lineWidth=0.4; g.strokeRect(x,-88,10,10); } } }
  if(!arr){ // traiteur (repas) à la porte arrière, avitaillement à l'aile, eaux et toilettes
    if(now>D.gate.open-75*MIN&&now<D.gate.open-25*MIN){ truck(9,-86,12,16,'#f8fafc','#e2e8f0'); g.fillStyle=col0(f); g.fillRect(9,-82,12,3); }
    if(now>D.P-60*MIN&&now<D.P-22*MIN){ truck(-50,-92,12,26,'#b91c1c','#f1f5f9'); g.strokeStyle='#111827'; g.lineWidth=0.8; g.beginPath(); g.moveTo(-38,-80); g.quadraticCurveTo(-30,-74,-26,-66); g.stroke(); }
    if(now>D.gate.open-40*MIN&&now<D.gate.open-8*MIN) truck(-20,-100,9,12,'#1d4ed8','#93c5fd'); }
  else if(now>D.arr+20*MIN&&now<D.arr+50*MIN) truck(-20,-100,9,12,'#1d4ed8','#93c5fd');
  g.restore(); }
// escalier mobile (camion-escalier) contre la porte avant gauche
function tmStairsDraw(g,st,f){ const sc=tmPSc(f); if(Math.abs((st.a||0)-Math.PI)<0.1){ g.save(); g.translate(st.x,st.y); g.rotate(Math.PI); g.translate(-st.x,-st.y); tmStairsDraw(g,{x:st.x,y:st.y,a:0},f); g.restore(); return; } const x1=st.x-5*sc, y=st.y-15*sc; g.fillStyle='rgba(15,23,42,.3)'; g.fillRect(x1-12,y-2,12,7); g.fillStyle='#e5e7eb'; g.fillRect(x1-13,y-3,12,6); g.strokeStyle='#64748b'; g.lineWidth=0.5; g.beginPath(); for(let k=1;k<6;k++){ g.moveTo(x1-13+k*2,y-3); g.lineTo(x1-13+k*2,y+3); } g.stroke(); g.fillStyle='#facc15'; g.fillRect(x1-19,y-3,6,6); }
// bus de piste (N'Djili)
function tmBusDraw(g,x,y,now){ g.fillStyle='rgba(15,23,42,.35)'; g.fillRect(x-17,y-4,38,15); g.fillStyle='#f8fafc'; g.fillRect(x-19,y-7,38,14); g.strokeStyle='#334155'; g.lineWidth=0.6; g.strokeRect(x-19,y-7,38,14); g.fillStyle='#0369a1'; g.fillRect(x-19,y+3,38,4); g.fillStyle='rgba(30,58,138,.8)'; for(let k=0;k<7;k++) g.fillRect(x-17+k*5,y-5,3.6,4); g.fillStyle='#64748b'; g.fillRect(x-8,y-1,4,8); g.fillRect(x+6,y-1,4,8); g.fillStyle='#facc15'; g.fillRect(x+15,y-7,4,3); g.fillStyle='#fff'; g.font='700 3.4px system-ui'; g.fillText('BUS PISTE',x-17,y+6.4); }
// passerelle télescopique : rotonde côté bâtiment, tunnel vitré, cabine côté avion
function tmBridge(g,x0,y0,x1,y1){ g.lineCap='butt'; g.strokeStyle='rgba(15,23,42,.25)'; g.lineWidth=10; g.beginPath(); g.moveTo(x0+3,y0+3); g.lineTo(x1+3,y1+3); g.stroke(); g.strokeStyle='#64748b'; g.lineWidth=9; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke(); g.strokeStyle='#94a3b8'; g.lineWidth=5; g.stroke(); g.strokeStyle='rgba(125,211,252,.6)'; g.lineWidth=1.2; g.stroke();
  g.fillStyle='#475569'; g.beginPath(); g.arc(x0,y0,6,0,6.283); g.fill(); g.fillStyle='#334155'; g.beginPath(); g.arc(x1,y1,5,0,6.283); g.fill(); }
const col0=f=>{ try{ return tmAirline(f).col; }catch(e){ return f.col||'#b91c1c'; } };
function tmAfterSel(p,now){ const el=document.getElementById('tmInfo'); if(!el||el.hidden) return; const K=p.K, items=[];
  for(let k=0;k<K.length;k++){ const lab=K[k].st, t=k===0?K[0].t:K[k-1].t; if(items.length&&items[items.length-1].lab===lab) continue; items.push({lab,t,end:K[k].t}); }
  const cur=items.findIndex(x=>now>=x.t&&now<=x.end), from=Math.max(0,cur-4), list=items.slice(from,from+12);
  const tl=list.map((x,j)=>{ const k=from+j, st=k<cur?'✓':k===cur?'●':'○', col=k<cur?'#94a3b8':k===cur?'#facc15':'#64748b'; return `<div style="color:${col}">${st} ${tmHM(x.t)} — ${esc(x.lab)}</div>`; }).join('');
  const d=document.createElement('div'); d.className='small'; d.style.cssText='margin-top:6px;border-top:1px solid rgba(148,163,184,.25);padding-top:4px';
  d.innerHTML=`<b>🧭 Parcours</b>${tl}<button class="btn" data-tmfol style="margin-top:6px">${TM.follow===p?'⏹️ Arrêter de suivre':'🎯 Suivre cette personne'}</button>`; el.appendChild(d);
  d.querySelector('[data-tmfol]').onclick=()=>{ TM.follow=TM.follow===p?null:p; TM.selAt=0; }; }
// suivi à la caméra
function tmFollowStep(now,w,h){ const p=TM.follow; if(!p) return; const q=tmAt(p.K,now); if(!q){ TM.follow=null; return; }
  const c=TM.cam, fit=Math.min(w/TW.W,h/(TW.H-TW.top)), s=Math.max(c.s,fit*4.5), tx=tmFx(q.x)-w/(2*s), ty=tmFy(q.y)-h/(2*s); c.s+=(s-c.s)*0.12; c.x+=(tx-c.x)*0.12; c.y+=(ty-c.y)*0.12; TM.goal=null; }
// annonces de l'aéroport (bandeau + voix)
function tmAnnounce(now){ const F=TM.F; if(!F) return; const last=TM.annT||now; TM.annT=now; if(now<=last) return; const ev=[];
  for(const f of F.deps){ const D=f.D, to=D.B.city, gt=D.gate.name;
    ev.push([D.gate.open,`Embarquement immédiat du vol ${f.fn} à destination de ${to}, porte ${gt}. Passagers prioritaires d’abord.`],[D.gate.last,`Dernier appel pour le vol ${f.fn} à destination de ${to}. Présentez-vous immédiatement porte ${gt}.`],[D.gate.close,`Le vol ${f.fn} à destination de ${to} est fermé.`]);
    if(tmDelay(f)) ev.push([D.ci.open+20*MIN,`Le vol ${f.fn} à destination de ${to} est retardé de ${tmDelay(f)} minutes.`]); }
  for(const f of F.arrs){ const D=f.D; ev.push([D.arr,`Le vol ${f.fn} en provenance de ${D.A.city} vient d’atterrir.`]); if(D.bag) ev.push([D.bag.first,`Les bagages du vol ${f.fn} en provenance de ${D.A.city} sont livrés au tapis numéro ${F.arrs.indexOf(f)+1}.`]); }
  const due=ev.filter(([t])=>t>last&&t<=now).sort((a,b)=>a[0]-b[0]); if(!due.length) return; const msg=due[due.length-1][1];
  const EN=m=>m.replace(/^Embarquement immédiat du vol (\S+) à destination de (.+), porte (\S+)\..*/,'Now boarding flight $1 to $2, gate $3.').replace(/^Dernier appel pour le vol (\S+) à destination de (.+)\. Présentez-vous immédiatement porte (\S+)\./,'Final call for flight $1 to $2, gate $3.')
    .replace(/^Le vol (\S+) à destination de (.+) est fermé\./,'Flight $1 to $2 is now closed.').replace(/^Le vol (\S+) à destination de (.+) est retardé de (\d+) minutes\./,'Flight $1 to $2 is delayed by $3 minutes.')
    .replace(/^Le vol (\S+) en provenance de (.+) vient d’atterrir\./,'Flight $1 from $2 has landed.').replace(/^Les bagages du vol (\S+) en provenance de (.+) sont livrés au tapis numéro (\d+)\./,'Baggage from flight $1 ($2) is on belt $3.');
  const big=(AP(TM.code)||{}).cls>=3, en=big||/international/.test(msg)?EN(msg):''; 
  const b=document.getElementById('tmAnn'); if(b){ b.innerHTML='📢 '+esc(msg)+(en&&en!==msg?'<br><span style="font-weight:500">🇬🇧 '+esc(en)+'</span>':''); b.hidden=false; clearTimeout(TM.annTO); TM.annTO=setTimeout(()=>{ b.hidden=true; },9000); }
  if(TM.voice&&typeof fx2Say==='function') try{ fx2Say(msg,'fr',0.9); if(en&&en!==msg) fx2Say(en,'en',0.9); }catch(e){} }
// avion au départ : au poste → repoussage → virage → roulage ; avion à l'arrivée : roulage → virage → entrée au poste
const TM_TWY=-250;
function tmDepPlane(d,now){ const D=d.f.D, P=D.P, st=d.stand, n={x:-Math.sin(st.a),y:Math.cos(st.a)}; if(now<(d.showFrom!=null?d.showFrom:D.gate.open-40*MIN)) return null; if(now<P) return {x:st.x,y:st.y,a:st.a,at:1};
  const u=now-P, px=st.x-n.x*d.push, py=st.y-n.y*d.push; if(u<2.5*MIN){ const k=u/(2.5*MIN); return {x:st.x-n.x*d.push*k,y:st.y-n.y*d.push*k,a:st.a,push:1}; }
  if(u<3*MIN){ const rt0=d._rt||(d._rt=tmTaxiRoute(d,px,py,st.a+d.turn*Math.PI/2)); let at=st.a+d.turn*Math.PI/2; if(rt0&&rt0.pts.length>1){ const A=rt0.pts[0], B=rt0.pts[1]; at=Math.atan2(-(B.x-A.x),B.y-A.y); let df=((at-st.a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI; at=st.a+df; } return {x:px,y:py,a:st.a+(at-st.a)*(u-2.5*MIN)/(0.5*MIN)}; } const a2=st.a+d.turn*Math.PI/2, end=(D.hold?D.hold[0]:(D.tko||P+7*MIN)), tx=Math.max(4*MIN,end-P-3*MIN), wt=D.hold?Math.max(0,(D.tko||end)-end):0, k=Math.min(1,(u-3*MIN)/tx);   // roule jusqu'au point d'arrêt, attend son tour, décolle
  const Lr=TM.L, rt=d._rt||(d._rt=tmTaxiRoute(d,px,py,a2)); if(Lr&&Lr.rx0!=null&&rt){   /* jusqu'à la raquette d'attente par la voie de circulation, puis attente en épi (jamais en file collée) */
    const hx=rt.hx, bx=rt.bx, tw=rt.tw, h0=P+3*MIN+tx, pe=rt.pts[rt.pts.length-1], ae=hx<0?Math.PI/2:-Math.PI/2;
    const bay=()=>{ const j=tmHoldRank(d,now,hx), sx=bx+hx*(70+j*120), sy=tw-64, sa=hx<0?3*Math.PI/4:-3*Math.PI/4, w=Math.min(1,(now-h0)/20000); return w>=1?{x:sx,y:sy,a:sa,hold:true}:{x:pe.x+(sx-pe.x)*w,y:pe.y+(sy-pe.y)*w,a:ae+(sa-ae)*w}; };   /* places en épi espacées de 120 px (un gros porteur incliné tient) */
    const taxiAt=t2=>{ const k2=Math.min(1,(t2-P-3*MIN)/tx); let dd=rt.len*k2; for(let j=1;j<rt.pts.length;j++){ const A=rt.pts[j-1], B=rt.pts[j], sl=Math.hypot(B.x-A.x,B.y-A.y); if(dd<=sl||j===rt.pts.length-1){ const w=sl?Math.min(1,dd/sl):1; return {x:A.x+(B.x-A.x)*w,y:A.y+(B.y-A.y)*w,a:Math.atan2(-(B.x-A.x),B.y-A.y)}; } dd-=sl; } return {x:pe.x,y:pe.y,a:ae}; };
    const tk=D.tko||end, ry=Lr.rwyY, LU=40000, dirIn=-hx;
    if(now>=tk&&d.f.rr&&typeof rivalPos==='function'&&now<tk+4*MIN){ const q=rivalPos(d.f.rr,d.f.ri,now); if(q&&q.gnd&&q.ph<=1) return bay(); }   /* la piste est encore occupée en 3D : il attend */
    if(ry==null||now<tk-LU){ if(u<3*MIN+tx) return taxiAt(now); if(u<3*MIN+tx+wt) return bay(); return null; }
    if(now<tk){ const t1=tk-LU, s0=(t1<P+3*MIN+tx?taxiAt(t1):(wt>0?(function(){ const o=now; return bay(); })():{x:pe.x,y:pe.y,a:ae})), w=(now-t1)/LU;   /* s'aligne sur la piste */
      if(w<0.6){ const v=w/0.6; return {x:s0.x+(bx-s0.x)*v,y:s0.y+(ry-s0.y)*v,a:Math.PI}; } const v=(w-0.6)/0.4, ai=dirIn>0?-Math.PI/2:Math.PI/2; return {x:bx,y:ry,a:Math.PI+(ai+(ai<0?2*Math.PI:0)-Math.PI)*v}; }
    const sct=(now-tk)/1000, rl=tmRwys(Lr).len; if(sct<46){ const air=Math.max(0,Math.min(1,(sct-28)/16)); return {x:bx+dirIn*Math.min(rl*0.85,0.55*sct*sct),y:ry,a:dirIn>0?-Math.PI/2:Math.PI/2,air}; }   /* accélère, décolle avant le bout de la piste */   /* roulage au décollage, puis envol */
    return null; }   /* rt.tw : voie A, ou voie B du satellite */
  if(u<3*MIN+tx+wt) return {x:px-Math.sin(a2)*650*k,y:py+Math.cos(a2)*650*k,a:a2,hold:k>=1&&wt>0};
  if(d.f.rr&&typeof rivalPos==='function'&&u<3*MIN+tx+wt+4*MIN){ const q=rivalPos(d.f.rr,d.f.ri,now); if(q&&q.gnd&&q.ph<=1) return {x:px-Math.sin(a2)*650,y:py+Math.cos(a2)*650,a:a2,hold:true}; }   // la piste est occupée en 3D : il attend encore
  return null; }
// itinéraire de roulage jusqu'à la raquette : le long de la voie (A, ou B pour le satellite), ou d'abord par la voie de la jetée
function tmTaxiRoute(d,px,py,a2){ const Lr=TM.L; if(!Lr||Lr.rx0==null) return null; const tw=Math.abs(py+980)<20?-980:TM_TWY, pts=[{x:px,y:py}]; let hx;
  if(Math.abs(py-tw)<20&&Math.abs(Math.cos(a2))<0.02) hx=-Math.sin(a2)<0?-1:1;
  else if(Lr.shape==='jetee'&&Math.abs(Math.sin(a2))<0.02){ hx=px<320?-1:1; pts.push({x:px,y:tw}); }
  if(hx!=null&&Lr.rwyY!=null&&tw===TM_TWY) hx=-1;   /* tous vers la piste des décollages */
  else return null;
  const bx=hx<0?Lr.rx0-30:Lr.rx1+30; pts.push({x:bx,y:tw}); let len=0; for(let j=1;j<pts.length;j++) len+=Math.hypot(pts[j].x-pts[j-1].x,pts[j].y-pts[j-1].y); return {pts,len,hx,bx,tw}; }
// rang dans la raquette d'attente : les avions arrivés avant attendent plus près de la piste
// piste : béton, axe, seuils, numéros, bretelles vers la voie de circulation, balisage la nuit
function tmRwys(L){ const LD=Math.min(1800,L.rx1-L.rx0+200); return {d:{x0:L.rx0-70,x1:L.rx0-70+LD,y:L.rwyY}, a:{x0:L.rx1+70-LD,x1:L.rx1+70,y:L.rwyA}, len:LD}; }
// deux pistes : décollages (la plus proche, côté gauche) et atterrissages (côté droit), bretelles vers la voie de circulation, balisage la nuit
function tmRunwayDraw(g,L,txt){ const W=tmRwys(L); let n1='',n2='';
  try{ const r=runwaysOf(TM.code)[0]; if(r){ const a=Math.round(((r.hdg%360)+360)%360/10)||36, b=((a+17)%36)+1; n1=String(Math.min(a,b)).padStart(2,'0'); n2=String(Math.max(a,b)).padStart(2,'0'); } }catch(e){}
  const link=(bx,y)=>{ g.fillStyle='#3f4b5c'; g.fillRect(bx-14,y,28,TM_TWY-y); g.strokeStyle='#facc15'; g.lineWidth=1.2; g.beginPath(); g.moveTo(bx,y+22); g.lineTo(bx,TM_TWY); g.stroke(); g.fillStyle='#facc15'; g.fillRect(bx-12,y+30,24,3); };
  link(L.rx0-30,W.d.y); link(L.rx1+30,W.a.y);
  const rwy=(R2,lab)=>{ const {x0,x1,y}=R2; g.fillStyle='#1f2937'; g.fillRect(x0,y-24,x1-x0,48); g.fillStyle='#e5e7eb'; for(let x=x0+60;x<x1-60;x+=60) g.fillRect(x,y-1.2,32,2.4); for(const xe of [x0+6,x1-36]) for(let k=0;k<8;k++) g.fillRect(xe,y-21+k*5.5,30,3); g.fillRect(x0,y-24,x1-x0,1.2); g.fillRect(x0,y+22.8,x1-x0,1.2); txt(lab,x0+50,y-30,11,'#e5e7eb',1);
    if(TM.night){ g.fillStyle='#fef3c7'; for(let x=x0;x<x1;x+=50){ g.fillRect(x,y-25,2,2); g.fillRect(x,y+23,2,2); } g.fillStyle='#22c55e'; g.fillRect(x0,y-24,3,48); g.fillStyle='#ef4444'; g.fillRect(x1-3,y-24,3,48); } };
  rwy(W.a,'🛬 Piste des atterrissages'+(n2?' · '+n1+'L':'')); rwy(W.d,'🛫 Piste des décollages'+(n1?' · '+n1+'R':'')); }
function tmHoldRank(d,now,hx){ let j=0; for(const e of TM.L.deps){ if(e===d) continue; const E=e.f.D, u=now-E.P; if(u<3*MIN||u>((E.tko||E.P+7*MIN)-E.P)+4*MIN) continue; if(e._rt){ if(e._rt.hx!==hx) continue; } else if(TM.L.rwyY==null){ const a2=e.stand.a+e.turn*Math.PI/2; if(Math.abs(Math.cos(a2))>=0.02) continue; if((-Math.sin(a2)<0?-1:1)!==hx) continue; }   /* avec la piste des décollages, tous attendent à la même raquette */ if(E.P<d.f.D.P||(E.P===d.f.D.P&&e.f.fn<d.f.fn)) j++; } return j; }
function tmArrPlane(a,now){ const Lr=TM.L; if(Lr&&Lr.rwyY!=null&&Lr.rx0!=null) return tmArrPlaneR(a,now,Lr);
  const A=a.f.D.arr, sy=a.sy||-60, U=Math.max(A+40*MIN,a.until||0), T0=Math.min(A-MIN,a.f.D.td||A-6*MIN), TX=A-T0; if(now<T0||now>U+4*MIN) return null;
  if(now>U){ if(a.same) return null; const u=(now-U)/(4*MIN); return u<0.5?{x:a.door.x,y:sy+(TM_TWY-sy)*u*2,a:0,push:1}:{x:a.door.x+700*(u-0.5)*2,y:TM_TWY,a:Math.PI/2}; }   // repoussé puis remorqué une fois vide
  if(now<A&&a.f.rr&&typeof rivalPos==='function'){ const q=rivalPos(a.f.rr,a.f.ri,now); if(q&&!q.gnd) return null; }   // encore en l'air en 3D
  if(now>=A) return {x:a.door.x,y:sy,a:0,at:1};
  const u=A-now; if(u>2*MIN) return {x:a.door.x+700*(u-2*MIN)/Math.max(MIN,TX-2*MIN),y:TM_TWY,a:Math.PI/2}; if(u>1.5*MIN) return {x:a.door.x,y:TM_TWY,a:Math.PI/2*(u-1.5*MIN)/(0.5*MIN)};   // roule depuis le toucher des roues (comme en 3D)
  return {x:a.door.x,y:TM_TWY+(sy-TM_TWY)*(1-u/(1.5*MIN)),a:0}; }
// avec la piste : approche, toucher des roues, freinage, bretelle, roulage jusqu'au poste (mêmes heures qu'en 3D)
function tmArrPlaneR(a,now,Lr){ const D=a.f.D, A=D.arr, sy=a.sy||-60, U=Math.max(A+40*MIN,a.until||0), td=Math.min(A-3*MIN,D.td||A-6*MIN); if(now<td-90000||now>U+4*MIN) return null;
  if(now>U){ if(a.same) return null; const u=(now-U)/(4*MIN); return u<0.5?{x:a.door.x,y:sy+(TM_TWY-sy)*u*2,a:sy<TM_TWY?Math.PI:0,push:1}:{x:a.door.x+700*(u-0.5)*2,y:TM_TWY,a:Math.PI/2}; }   // repoussé puis remorqué une fois vide
  if(now<td&&a.f.rr&&typeof rivalPos==='function'){ const q=rivalPos(a.f.rr,a.f.ri,now); if(q&&!q.gnd&&(q.holding||q.ph<6)) return null; }   // encore en attente ou loin en 3D
  if(now>=A) return {x:a.door.x,y:sy,a:sy<TM_TWY?Math.PI:0,at:1};
  const ex=Lr.rx1+30, dir=1, ry=Lr.rwyA!=null?Lr.rwyA:Lr.rwyY, aR=-Math.PI/2, tdd=Math.min(1500,tmRwys(Lr).len-170);
  if(now<td-60000){ const w=(now-(td-90000))/30000; return {x:ex-dir*(tdd+800*(1-w)),y:ry,a:aR,air:1-w}; }   /* en finale, puis toucher des roues */
  if(now<td){ const s2=(now-(td-60000))/60000, e=1-(1-s2)*(1-s2); return {x:ex-dir*tdd*(1-e),y:ry,a:aR}; }   /* freinage sur la piste des atterrissages */
  const tE=A-2*MIN; if(now<tE){ const L1=Math.abs(TM_TWY-ry), L2=Math.abs(a.door.x-ex), w=Math.min(1,(now-td)/Math.max(30000,tE-td)), dd=w*(L1+L2); if(dd<L1) return {x:ex,y:ry+(TM_TWY-ry)*dd/L1,a:0}; return {x:ex+(a.door.x-ex)*(dd-L1)/Math.max(1,L2),y:TM_TWY,a:a.door.x<ex?Math.PI/2:-Math.PI/2}; }
  const u=A-now, at=a.door.x<ex?Math.PI/2:-Math.PI/2, ta=sy<TM_TWY?Math.PI:0; if(u>1.5*MIN) return {x:a.door.x,y:TM_TWY,a:ta+(at-ta)*(u-1.5*MIN)/(0.5*MIN)};
  return {x:a.door.x,y:TM_TWY+(sy-TM_TWY)*(1-u/(1.5*MIN)),a:ta}; }
function tmClosed(k,t){ if(typeof apTermOpenAt==='function'&&!apTermOpenAt(TM.code,t||tmNow())&&/^(dutyfree|resto|cafe|pharma|press|lounge|change|car|kids|atm)$/.test(k)) return true; const A=AP(TM.code)||{}, tz=typeof tzAt==='function'?tzAt(TM.code,t||tmNow()):(A.utc!=null?A.utc:Math.round((A.lon||0)/15)), h=((((t||tmNow())/HOUR+tz)%24)+24)%24, big=(A.cls||2)>=4;
  if(big) return (k==='press'||k==='pharma')&&h>=1&&h<5; return {dutyfree:h<5.5||h>=23,resto:h<5||h>=23.5,cafe:h>=0.5&&h<4.5,pharma:h<6||h>=22,press:h<6||h>=21}[k]||false; }
// horloge et calendrier bien visibles : jour de la semaine, date, heure et minute ; heure locale de l'aéroport
const TM_JOURS=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'], TM_MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
// ✈️ avion présidentiel (Boeing 737 blanc « République démocratique du Congo », bande bleu-jaune-rouge) : poste réservé devant le pavillon présidentiel, à Kinshasa
// pendant un mouvement présidentiel il décolle (départ du président) ou atterrit (retour), pistes fermées aux autres ; mêmes heures et même poste qu'en 3D quand il est garé
function tmPresWin(now){ if(typeof ahVip!=='function') return null; for(let h=-4;h<=4;h+=0.5){ const w=ahVip('FIH',now+h*HOUR); if(!w) continue; const dep=(ahH('pres'+w.s)%2)===0, a0=dep?w.s-150*MIN:w.s+3*MIN, a1=dep?w.s+22*MIN:w.e+150*MIN; if(now>=a0&&now<a1) return {w,dep}; } return null; }
// garé au pavillon à l'instant t ? (pour la 3D, même si l'aérogare n'est pas ouverte)
function tmPresAt(t){ const P=tmPresWin(t); if(!P) return false; const w=P.w; return P.dep?t<w.s+8*MIN:t>=w.s+16*MIN; }
function tmPres(now){ if(TM.code!=='FIH'||!TM.L||!TM.L.nd) return null; const P=tmPresWin(now); if(!P) return null; const w=P.w, key=w.s+'|'+P.dep; let o=TM._pres;
  if(!o||o.key!==key){ const X=ndjX(slotPt('FIH',typeof RIV_PRES_K!=='undefined'?RIV_PRES_K:13)); o=TM._pres={key,dep:P.dep,X,
      d:{f:{D:{P:w.s+8*MIN,tko:w.s+20*MIN,gate:{open:w.s-40*MIN}},fn:'RDC 001'},stand:{x:X,y:-64,a:0},push:182,turn:-1,showFrom:w.s-150*MIN},
      a:{f:{D:{arr:w.s+16*MIN,td:w.s+10*MIN}},door:{x:X,y:38},sy:-64,until:w.e+150*MIN,same:1}}; }
  const q=o.dep?tmDepPlane(o.d,now):tmArrPlaneR(o.a,now,TM.L); return q?{...q,dep:o.dep,X:o.X}:null; }
function tmPresDraw(g,q){ const sc=0.7, air=q.air||0, s2=sc*(1+air*0.55); if(air>0){ g.save(); g.globalAlpha=0.22*(1-air*0.5); g.fillStyle='#020617'; g.translate(q.x+air*22,q.y+air*30); g.rotate(q.a); g.beginPath(); g.ellipse(0,-50*sc,8*sc,46*sc,0,0,6.283); g.ellipse(0,-50*sc,52*sc,7*sc,0,0,6.283); g.fill(); g.restore(); }
  tmPlane(g,q.x,q.y,'#0369a1',q.a,s2,1,null); g.save(); g.translate(q.x,q.y); g.rotate(q.a||0); g.scale(s2,s2); for(const [dx,c] of [[-3.2,'#0ea5e9'],[-2.1,'#facc15'],[-1.1,'#dc2626']]){ g.fillStyle=c; g.fillRect(dx,-86,0.9,76); g.fillRect(-dx-0.9,-86,0.9,76); } g.restore();   /* bande aux couleurs du drapeau */
  if(q.at||q.hold){ g.font='700 7px system-ui'; g.fillStyle='#fef08a'; g.fillText('🇨🇩 Avion présidentiel · République démocratique du Congo',q.x+18,q.y-58); } }
// mouvement présidentiel : cortège (motards, berlines noires, ambulance) devant le salon d'honneur, tapis rouge
function tmVipDraw(g,L,now,E){ const x0=1052, y0=L.nd?-24:-52, on=E.vipOn; g.save();
  g.fillStyle='#b91c1c'; g.fillRect(x0+60,y0+8,14,90); g.fillStyle='#facc15'; g.fillRect(x0+60,y0+8,2,90); g.fillRect(x0+72,y0+8,2,90);   // tapis rouge vers le salon d'honneur
  const n=on?7:4; for(let k=0;k<n;k++){ const x=x0+k*22, y=y0-6, moto=k===0||k===n-1; g.fillStyle='rgba(15,23,42,.3)'; g.fillRect(x+1,y+1,moto?6:16,moto?3:8); g.fillStyle=moto?'#e5e7eb':(k===n-2&&on?'#f8fafc':'#0f172a'); g.fillRect(x,y,moto?6:16,moto?3:8); if(!moto){ g.fillStyle='rgba(148,163,184,.8)'; g.fillRect(x+3,y+1,4,6); } if(moto||k===1){ g.fillStyle=(Math.floor(now/250+k)%2)?'#3b82f6':'#ef4444'; g.fillRect(x+(moto?2:6),y-1.5,3,1.5); } }
  for(let k=0;k<6;k++){ const px=x0+40+k*7, py=y0+4+(k%2)*94; g.fillStyle='#14532d'; g.beginPath(); g.arc(px,py,2.2,0,6.283); g.fill(); }   // garde républicaine
  g.font='700 7px system-ui'; g.fillStyle='#fecaca'; g.fillText(on?'🚨 Cortège présidentiel':'🚨 Cortège en attente',x0,y0-12); g.restore(); }
// N'Djili : aire 1 et aérogare de la MONUSCO, tour de contrôle, hangar de l'aire 3, noms des aires (OpenStreetMap)
function tmNdjDraw(g,L,now,fit){
  g.fillStyle='rgba(15,23,42,.3)'; g.fillRect(-1196,34,200,90); g.fillStyle='#f1f5f9'; g.fillRect(-1200,30,200,90); g.fillStyle='#1d4ed8'; g.fillRect(-1200,30,200,8); fit('🇺🇳 Aérogare MONUSCO (ONU)',-1190,62,180,16,'#fff','#1d4ed8'); fit('Aire 1 · vols des Nations unies',-1190,86,180,10,'#334155');
  fit('AIRE 1 · aire éloignée',-1260,-262,170,14,'#fde047','rgba(15,23,42,.55)'); { const xs=ndjStands().map(s2=>s2.x); fit('AIRE 2 · postes éloignés · accès à pied ou en bus de piste',Math.min(...xs)-30,-200,420,14,'#fde047','rgba(15,23,42,.55)'); } fit('AIRE 3 · aire éloignée',1740,-262,170,14,'#fde047','rgba(15,23,42,.55)');
  { const tx=1290, ty=60; g.fillStyle='rgba(15,23,42,.3)'; g.fillRect(tx-12,ty-8,30,52); g.fillStyle='#e5e7eb'; g.fillRect(tx-14,ty-10,28,50); g.fillStyle='#1e293b'; g.beginPath(); g.arc(tx,ty-10,16,0,6.283); g.fill(); g.fillStyle='rgba(125,211,252,.85)'; g.beginPath(); g.arc(tx,ty-10,12,0,6.283); g.fill(); fit('Tour de contrôle',tx-40,ty+44,80,10,'#fff','#0f172a'); }
  g.fillStyle='rgba(15,23,42,.3)'; g.fillRect(1984,46,100,80); g.fillStyle='#78716c'; g.fillRect(1980,42,100,80); g.strokeStyle='rgba(255,255,255,.2)'; g.beginPath(); for(let x=1986;x<2080;x+=8){ g.moveTo(x,42); g.lineTo(x,122); } g.stroke(); fit('Hangar · maintenance',1986,76,88,12,'#fff','#292524');
  { const nd=Math.max(1,L.deps.length), nDom=L.ndDom||0, bw=640/nd, xi=(nd-nDom)*bw;
    if(nd-nDom>0) fit('🌍 Vols internationaux',4,14,Math.max(20,xi-8),14,'#fff','#1d4ed8');
    if(nDom>0){ fit('🇨🇩 Vols nationaux',xi+4,14,Math.max(20,640-xi-8),14,'#fff','#15803d'); g.fillStyle='rgba(22,163,74,.08)'; g.fillRect(xi,30,640-xi,370); g.strokeStyle='#15803d'; g.lineWidth=2; g.strokeRect(xi+1,30,640-xi-2,370); } }
  }
// terminal fret : entrepôt, palettes et conteneurs (ULD), chariots élévateurs, camions, courrier ; salon d'honneur
function tmCargoDraw(g,L,now,fit){ let X=L.nd?1740:1060;
  if(L.cargo){ g.save(); if(L.nd) g.translate(0,272);   /* N'Djili : fret côté bâtiments, comme en 3D */ g.fillStyle='rgba(15,23,42,.3)'; g.fillRect(X+4,-226,200,80); g.fillStyle='#64748b'; g.fillRect(X,-230,200,80); g.strokeStyle='rgba(255,255,255,.18)'; g.lineWidth=1; g.beginPath(); for(let x=X+10;x<X+200;x+=12){ g.moveTo(x,-230); g.lineTo(x,-150); } g.stroke();
    g.fillStyle='#334155'; for(let k=0;k<6;k++) g.fillRect(X+12+k*31,-152,20,4);   // portes de quai
    fit('📦 Terminal fret',X+40,-200,120,16,'#fff','#0f172a'); fit('📮 Courrier · La Poste',X+52,-176,96,9,'#1e293b','#fde047');
    const ph=Math.floor(now/20000);
    for(let k=0;k<14;k++){ const x=X+8+(k%7)*22, y=-138+Math.floor(k/7)*16, v=(k*7+ph)%5; if(v===0) continue; g.fillStyle='#94a3b8'; g.fillRect(x,y,16,11); g.fillStyle=v%2?'#cbd5e1':'#e2e8f0'; g.fillRect(x+1,y+1,14,7); if(v===3){ g.fillStyle='#a16207'; g.fillRect(x+2,y+2,12,5); } g.strokeStyle='rgba(15,23,42,.35)'; g.strokeRect(x,y,16,11); }   // conteneurs et palettes filmées
    for(let k=0;k<2;k++){ const t=(now/(9000+k*2500)+k*0.5)%2, u=t<1?t:2-t, fx=X+20+u*130, fy=-102+k*8; g.fillStyle='#f59e0b'; g.fillRect(fx,fy,9,6); g.fillStyle='#111827'; g.fillRect(fx+9,fy+1,3,4); }   // chariots élévateurs
    for(let k=0;k<2;k++){ const tx=X+166+k*17; g.fillStyle='rgba(15,23,42,.3)'; g.fillRect(tx+2,-138,12,40); g.fillStyle='#e5e7eb'; g.fillRect(tx,-140,12,32); g.fillStyle=k?'#1d4ed8':'#b91c1c'; g.fillRect(tx,-108,12,9); }   // camions de fret à quai
    g.restore(); }
  X=1060; if(L.nd) tmNdjDraw(g,L,now,fit);
  if(L.vip){ g.fillStyle='rgba(15,23,42,.3)'; g.fillRect(X+44,50,150,100); g.fillStyle='#f5f5f4'; g.fillRect(X+40,46,150,100); g.fillStyle='#b45309'; g.fillRect(X+40,46,150,8); g.fillStyle='#a8a29e'; for(let x=X+48;x<X+190;x+=18) g.fillRect(x,58,4,30);
    g.fillStyle='#b91c1c'; g.fillRect(X+52,46,14,40); fit(L.nd?'🏛️ Pavillon présidentiel':'🏛️ Salon d’honneur',X+70,100,110,14,'#fff','#7c2d12'); fit('Accueil des personnalités',X+70,118,110,8,'#44403c'); }
  }
function tmClockHtml(t){ const d=new Date(t), A=AP(TM.code)||{}, tz=typeof tzAt==='function'?tzAt(TM.code,t):(A.utc!=null?A.utc:Math.round((A.lon||0)/15)), L=new Date(t+tz*HOUR), hm=x=>String(x.getUTCHours()).padStart(2,'0')+':'+String(x.getUTCMinutes()).padStart(2,'0');
  if(!document.getElementById('tmBlinkCss')){ const st=document.createElement('style'); st.id='tmBlinkCss'; st.textContent='@keyframes tmblink{50%{opacity:.25}}.tmblink{animation:tmblink 1s steps(1) infinite}'; document.head.appendChild(st); }
  const big=hm(d).replace(':','<span class="tmblink">:</span>');
  return `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:2px"><span style="font:800 22px/1 ui-monospace,Menlo,monospace;color:#fde047;letter-spacing:1px">${big}</span><span style="font-weight:800;color:#fff;text-transform:capitalize">${TM_JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${TM_MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}</span><span style="color:#64748b;font-size:10px">v${typeof GAME_VER!=='undefined'?GAME_VER:''}</span>${tz?`<span style="color:#93c5fd;font-weight:600">· ${esc(A.city||'')} ${hm(L)} (heure locale${typeof ahDst==='function'&&ahDst(TM.code,t)?', heure d’été':''})</span>`:''}</div>${(()=>{ const H=typeof apHours==='function'?apHours(TM.code):null; if(!H) return '<div style="color:#86efac;font-weight:600;font-size:12px">🟢 Pistes et aérogare ouvertes 24 h/24</div>'; const op=apOpenAt(TM.code,t), to=apTermOpenAt(TM.code,t);
      if(op) return `<div style="color:#86efac;font-weight:600;font-size:12px">🟢 Pistes ouvertes jusqu’à ${ahHM(H.c)} (heure locale)${H.kind==='curfew'?' · puis couvre-feu, aérogare ouverte':' · pas de balisage lumineux'}</div>`;
      if(H.kind==='curfew') return `<div style="color:#fbbf24;font-weight:800;font-size:13px">🌙 Couvre-feu : aucun décollage ni atterrissage jusqu’à ${ahHM(H.o)} (heure locale) · l’aérogare reste ouverte</div>`;
      return to?`<div style="color:#fbbf24;font-weight:800;font-size:13px">🌙 Pistes fermées (pas de balisage) · premier vol à ${ahHM(H.o)} · aérogare ouverte jusqu’à ${ahHM(H.term.c)}</div>`:`<div style="color:#f87171;font-weight:800;font-size:13px">🔒 Aérogare fermée la nuit · ouverture à ${ahHM(H.term.o)}, premier vol à ${ahHM(H.o)} (heure locale)</div>`; })()}${tmEvHtml(t)}`; }
// événements du moment (les mêmes que ceux qui retardent les vols sur la carte et en 3D)
function tmEv(t){ const c=TM.code, k=c+'|'+Math.floor(t/MIN); if(TM._evK===k) return TM._ev; TM._evK=k;
  const v=typeof ahVip==='function'?ahVip(c,t):null, pw=typeof ahPower==='function'?ahPower(c,t):null, fu=typeof ahFuel==='function'?ahFuel(c,t):null;
  return TM._ev={vip:v, vipOn:!!(v&&t>=v.s&&t<v.e), vipSoon:!!(v&&t<v.s), pw, fu, why:typeof ahDemandWhy==='function'?ahDemandWhy(c,'',t):''}; }
function tmEvHtml(t){ const E=tmEv(t), c=TM.code, hm=x=>ahHM(ahLocalHour(c,x)), out=[], row=(col,txt)=>out.push(`<div style="color:${col};font-weight:700;font-size:12px">${txt}</div>`);
  if(E.vipOn) row('#f87171',`🚨 Mouvement présidentiel : pistes fermées jusqu’à ${hm(E.vip.e)} · cortège sur le tarmac, salon d’honneur · les avions attendent`);
  else if(E.vipSoon) row('#fbbf24',`🚨 Mouvement présidentiel prévu à ${hm(E.vip.s)} : pistes fermées environ ${Math.round((E.vip.e-E.vip.s)/MIN)} min`);
  else if(E.vip) row('#fbbf24',`🚨 Mouvement présidentiel terminé à ${hm(E.vip.e)} : le trafic reprend, avec des retards`);
  { const P=tmPresWin(t); if(P&&TM.code==='FIH') row('#fde68a',P.dep?`✈️ Avion présidentiel au pavillon : décollage à ${hm(P.w.s+20*MIN)}`:`✈️ Avion présidentiel : atterrissage à ${hm(P.w.s+9*MIN)}, puis au pavillon présidentiel`); }
  { const J=tmJam(c,t); if(J.lvl===2) row('#f87171','🚗 Embouteillages monstres aujourd’hui : beaucoup de passagers risquent de rater leur vol'); else if(J.lvl===1) row('#fbbf24','🚗 Circulation difficile aujourd’hui sur la route de l’aéroport'); }
  if(E.pw) row('#fbbf24',`⚡ Coupure de courant depuis ${hm(E.pw.s)} : l’aérogare tourne sur le groupe électrogène (éclairage de secours)`);
  if(E.fu) row('#fb923c',`⛽ Pénurie de kérosène : vols retardés${E.fu.sev===2?', certains annulés':''}`);
  if(E.why) row('#93c5fd',`📈 Affluence : ${esc(E.why)}`);
  return out.join(''); }
function tmLocalHour(){ const t=tmNow(); if(typeof ahLocalHour==='function') return ahLocalHour(TM.code,t); const A=AP(TM.code)||{}, tz=A.utc!=null?A.utc:Math.round((A.lon||0)/15); return (((t/HOUR+tz)%24)+24)%24; }
const TM_OPS=[['sec','🔍 Lignes de sûreté',2500],['pol','🛂 Guichets de police (départ)',1800],['ck','🎫 Comptoirs par vol',900]];
function tmDash(){ const L=TM.L, c=TM.cnt||{}, W=L.W||{}, now=tmNow(), o=tmOps(TM.code);
  const val={sec:[L.nL,c.sec,tmWait(W.sec||[],now)],pol:[L.nB,c.pol,tmWait(W.pol||[],now)],ck:[o.ck,c.ck,tmWait(W.ck||[],now)]};
  tmInfo(`<b>📊 Gestion de l’aérogare</b><div class="small mut">Renforcez les équipes : les files raccourcissent tout de suite. Chaque renfort est payé une fois.</div>`+
    TM_OPS.map(([k,l,cost])=>`<div style="display:flex;align-items:center;gap:6px;margin-top:6px"><div style="flex:1"><b>${l}</b><br><span class="small">${k==='ck'?'+'+val.ck[0]+' en renfort':val[k][0]+' ouvert(e)s'} · ${val[k][1]||0} en file · attente ~${val[k][2]} min</span></div>`+
      `<button class="btn" data-op="${k}" data-d="-1">➖</button><button class="btn" data-op="${k}" data-d="1">➕ ${fmtMoney(cost)}</button></div>`).join('')+
    `<div style="margin-top:8px"><button class="btn" data-heat>${TM.heat?'🌡️ Masquer la carte de chaleur':'🌡️ Carte de chaleur de la foule'}</button></div>`);
  const el=document.getElementById('tmInfo'); el.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>{ const k=b.dataset.op, d=+b.dataset.d, cap=k==='ck'?4:2; if(d>0&&o[k]>=cap) return toast('Maximum atteint pour cet aéroport','warn'); if(d<0&&o[k]<=0) return;
      o[k]+=d; if(d>0){ const cost=TM_OPS.find(x=>x[0]===k)[2]; try{ book('admin',-cost); logMsg(`🏢 Renfort à ${AP(TM.code).city} : ${TM_OPS.find(x=>x[0]===k)[1]} (+1) — ${fmtMoney(cost)}`,'info'); }catch(e){} } TM.built=0; TM.dashAt=0; });
  const h=el.querySelector('[data-heat]'); if(h) h.onclick=()=>{ TM.heat=!TM.heat; TM.dashAt=0; }; }
// résolution adaptative : si le téléphone peine (moins de ~18 images/s), l'image est un peu moins fine mais fluide
function tmAdapt(dF){ if(dF>400||document.hidden) return; TM.fa=(TM.fa||33)*0.94+dF*0.06; TM.fn=(TM.fn||0)+1; if(TM.fn%40) return; const tn=performance.now();
  if(TM.fa>56&&TM.dpr>1.01){ TM.dprHi=TM.dpr; TM.dpr=Math.max(1,TM.dpr-0.25); TM.fa=40; TM.dprAt=tn; }
  else if(TM.fa<36&&tn-(TM.dprAt||0)>8000&&TM.dpr+0.25<(TM.dprHi||TM.dprMax||2)+0.001&&TM.dpr+0.25<=(TM.dprMax||2)&&TM.dpr+0.25<(TM.dprHi||9)){ TM.dpr+=0.25; TM.dprAt=tn; } }
function tmDraw(){
  if(!TM.open) return; TM.raf=requestAnimationFrame(tmDraw); { const tn=performance.now(); if(TM.lastF&&tn-TM.lastF<30) return; const dF=TM.lastF?tn-TM.lastF:33; TM.lastF=tn; tmAdapt(dF); }   // 30 images par seconde au plus
  const cv=TM.cv; if(!cv) return; const w=cv.clientWidth, h=cv.clientHeight; if(!w||!h) return;
  if(!TM.built){ TM.job=null; tmBuild(); } else if(TM.job){ const t0=performance.now(); try{ while(performance.now()-t0<7){ if(TM.job.next().done){ TM.job=null; break; } } }catch(e){ TM.job=null; console.warn('aérogare',e); } }
  else if(performance.now()-TM.built>15000||Math.abs(tmNow()-(TM.builtT||0))>10*MIN){ /* au moins toutes les 10 min de jeu, quelle que soit la vitesse */ const F=tmFlights(TM.code); if(tmFKey(F)!==TM.fkey||performance.now()-(TM.full||0)>90000) TM.job=tmBuildGen(F); else TM.built=performance.now(); }
  if(cv.width!==Math.round(w*TM.dpr)||cv.height!==Math.round(h*TM.dpr)){ cv.width=Math.round(w*TM.dpr); cv.height=Math.round(h*TM.dpr); if(!TM.cam||!TM.moved){ TM.cam={s:1,x:0,y:0}; tmFocus(tmZoneRect(0)); Object.assign(TM.cam,TM.goal); TM.goal=null; } }
  tmFollowStep(tmNow(),w,h); tmCamStep(); const c=TM.cam, main=cv.getContext('2d'), L=TM.L, F=TM.F, now=tmNow(), s=c.s; let g=main;
  const prep=(x,bg)=>{ x.setTransform(TM.dpr,0,0,TM.dpr,0,0); if(bg){ x.fillStyle='#1e293b'; x.fillRect(0,0,w,h); }
    x.setTransform(TM.dpr*s,0,0,TM.dpr*s,-c.x*TM.dpr*s,-c.y*TM.dpr*s);
    const T0=TM.th||(TM.th=tmTheme(TM.code)); if(!TM._ft) TM._ft=CanvasRenderingContext2D.prototype.fillText; x.fillText=TM._ft;
    if(T0.mx||T0.my){ x.translate(T0.mx?1000:0,T0.my?1000:0); x.scale(T0.mx?-1:1,T0.my?-1:1); const ft=TM._ft;
      x.fillText=function(t,xx,y){ this.save(); this.translate(xx,y); this.scale(T0.mx?-1:1,T0.my?-1:1); if(T0.mx) this.textAlign='right'; ft.call(this,t,0,0); this.restore(); }; } };
  const font=(px,b)=>{ g.font=`${b?'700 ':''}${px}px system-ui`; }, txt=(t,x,y,px,col,b)=>{ font(px,b); g.fillStyle=col||'#334155'; g.fillText(t,x,y); };
  const fit=(t,x0,y0,w,h,col,bg,nb)=>{ if(w<4||h<3) return; if(bg){ g.fillStyle=bg; g.fillRect(x0,y0,w,h); } if(h*s<3.5||w*s<6) return; let px=h*0.72; g.font=`${nb?'':'700 '}${px}px system-ui`; const mw=g.measureText(t).width; if(mw>w-4){ px*=(w-4)/mw; g.font=`${nb?'':'700 '}${px}px system-ui`; }
    if(px*s<2.6) return; g.fillStyle=col||'#111827'; g.fillText(t,x0+2,y0+h/2+((TM.th&&TM.th.my)?-1:1)*px*0.36); };
  const TH=TM.th||(TM.th=tmTheme(TM.code)), MV=[];
  const drawStatic=()=>{
  // tarmac, chariots à bagages, avions
  g.fillStyle='#475569'; g.fillRect(L.bx0,TW.top,L.bx1-L.bx0,-TW.top+30); if(L.shape==='L'){ g.fillRect(L.bx0,0,460,420); } g.strokeStyle='#facc15'; g.lineWidth=1.2; g.setLineDash([]); g.beginPath(); g.moveTo(L.bx0,TM_TWY); g.lineTo(L.bx1,TM_TWY); g.stroke();   // axe de la voie de circulation
  txt('— Voie de circulation A —',430,TM_TWY-8,10,'#facc15',1);
  if(L.rwyY!=null) tmRunwayDraw(g,L,txt);
  { g.strokeStyle='#facc15'; g.lineWidth=1;
    if(L.shape==='jetee'){ g.beginPath(); for(const x of [20,620]){ g.moveTo(x,-6); g.lineTo(x,L.top+30); } g.moveTo(20,L.top+30); g.lineTo(620,L.top+30); g.stroke(); }
    if(L.shape==='satellite'){ g.beginPath(); g.moveTo(L.bx0,-980); g.lineTo(L.bx1,-980); g.stroke(); txt('— Voie de circulation B —',260,-988,10,'#facc15',1); }
    if(L.nd){ g.beginPath(); for(const s2 of ndjStands()){ g.moveTo(s2.x,-64); g.lineTo(s2.x,TM_TWY); } g.stroke(); for(const s2 of ndjStands()){ g.fillStyle='#f8fafc'; g.fillRect(s2.x-10,-62,20,2.5); txt('P'+s2.pn,s2.x-8,-50,8,'#fde047',1); } }   /* les 16 postes de l'aire 2, numérotés */
    for(const d of L.deps){ const st=d.stand, n={x:-Math.sin(st.a),y:Math.cos(st.a)}; g.beginPath(); g.moveTo(st.x,st.y); g.lineTo(st.x-n.x*d.push,st.y-n.y*d.push); g.stroke(); txt((d.pn?'Poste '+d.pn+' · ':'')+d.f.D.gate.name+(d.f.reg?' · '+d.f.reg:''),st.x+6,st.y-4,7,'#f8fafc',1); }   // ligne du poste
    for(const [x,nm,y1] of L.arrs.map(a=>[a.door.x,a.pn?'Poste '+a.pn:'A'+a.belt.n,a.ent?a.sy:-6])){ g.beginPath(); g.moveTo(x,TM_TWY); g.lineTo(x,y1); g.stroke(); g.fillStyle='#f8fafc'; g.fillRect(x-10,y1-2,20,2.5); txt(nm,x+12,y1-8,8,'#f8fafc',1); } }   // ligne d'entrée au poste, barre d'arrêt
  { const hr=tmLocalHour(), night=hr<6||hr>=18.5, dusk=!night&&(hr<7||hr>=17.5); TM.night=night;
    if(night||dusk){ g.fillStyle=night?'rgba(2,6,23,.6)':'rgba(124,45,18,.25)'; g.fillRect(L.bx0,TW.top,L.bx1-L.bx0,-TW.top+30); if(night){ g.fillStyle='#4ade80'; for(let x=L.bx0+20;x<L.bx1;x+=30){ g.beginPath(); g.arc(x,TM_TWY,1.8,0,6.283); g.fill(); } g.fillStyle='#fde68a'; for(let x=L.bx0+20;x<L.bx1;x+=80){ g.beginPath(); g.arc(x,TW.top+12,2.4,0,6.283); g.fill(); } } }
    let wx=null; try{ wx=typeof towerWx==='function'?towerWx(TM.code):null; }catch(e){} TM.storm=!!(wx&&wx.st); TM.rain=TM.storm||!!(wx&&wx.vis<4000);
  }
  g.strokeStyle='rgba(148,163,184,.6)'; g.lineWidth=3; g.beginPath(); g.moveTo(-14,978); g.lineTo(-14,-28); g.lineTo(1014,-28); g.lineTo(1014,700); g.stroke();   // circuit du tri bagages
  // bâtiment : sol carrelé, piliers, murs
  g.fillStyle=TH.floor; g.fillRect(0,0,1000,1236);
  { const t=TH.tile; g.lineWidth=0.5;   // revêtement de sol propre à l'aéroport
    if(TH.pat==='checker'){ g.fillStyle='rgba(0,0,0,.035)'; g.beginPath(); for(let x=0;x<1000;x+=t) for(let y=0;y<1236;y+=t) if(((x+y)/t)%2===0) g.rect(x,y,t,t); g.fill(); }
    else if(TH.pat==='diag'){ g.strokeStyle='rgba(0,0,0,.06)'; g.beginPath(); for(let k=-1236;k<1000;k+=t*1.5){ g.moveTo(k,0); g.lineTo(k+1236,1236); } g.stroke(); }
    else if(TH.pat==='terrazzo'){ g.fillStyle='rgba(120,90,60,.12)'; g.beginPath(); for(let k=0;k<2600;k++){ const x=(k*97)%1000, y=(k*61)%1236; g.rect(x,y,1.6,1.6); } g.fill(); }
    else if(TH.pat==='marbre'){ g.strokeStyle='rgba(150,120,80,.16)'; g.beginPath(); for(let k=0;k<70;k++){ const x=(k*137)%1000, y=(k*89)%1236; g.moveTo(x,y); g.bezierCurveTo(x+30,y+10,x+50,y+40,x+90,y+35); } g.stroke(); g.strokeStyle='rgba(0,0,0,.05)'; g.beginPath(); for(let x=0;x<=1000;x+=t*2){ g.moveTo(x,0); g.lineTo(x,1236); } g.stroke(); }
    else if(TH.pat==='bois'){ g.strokeStyle='rgba(120,80,40,.10)'; g.beginPath(); for(let y=0;y<=1236;y+=6){ g.moveTo(0,y); g.lineTo(1000,y); } g.stroke(); }
    else { g.strokeStyle='rgba(0,0,0,.06)'; g.beginPath(); for(let x=0;x<=1000;x+=t){ g.moveTo(x,0); g.lineTo(x,1236); } for(let y=0;y<=1236;y+=t){ g.moveTo(0,y); g.lineTo(1000,y); } g.stroke(); } }
  g.fillStyle='#d6d3d1'; g.fillRect(0,1236,1000,64); fit('🚶 Parvis — dépose minute',4,1266,300,16,'#44403c',null);
  // enseigne lisible à toutes les échelles (taille constante à l'écran)
  const sign=(t,x,y,col)=>{ const px=(s<0.9?9.5:11)/s; g.font=`700 ${px}px system-ui`; const w=g.measureText(t).width+px*0.9, hh=px*1.5; g.fillStyle=col||TH.acc; g.globalAlpha=0.92; g.beginPath(); if(g.roundRect) g.roundRect(x,y,w,hh,hh*0.3); else g.rect(x,y,w,hh); g.fill(); g.globalAlpha=1; g.fillStyle='#fff'; g.fillText(t,x+px*0.45,y+px*1.1); return hh; };
  TM.signs=[['🎫 Hall d’enregistrement',4,1150,330,1172,'ck'],['🔍 Contrôle de sûreté',4,943,330,962,'sec'],[TH.flag+' Couloir des vols nationaux',4,703,316,724,null],['🛂 Police aux frontières',324,703,636,724,'pol'],
    ['🛍️ Commerces et salle d’attente',4,421,636,438,null],['🛬 Couloir des arrivées',664,204,996,222,null],['🛂 Immigration',664,404,996,419,'imm'],['🧳 Livraison des bagages',664,423,996,442,'belt'],['🛃 Douane',664,934,996,955,null],['🤝 Hall des arrivées',664,966,996,990,null]];
  const zone=(x0,y0,x1,y1,col)=>{ g.fillStyle=col; g.globalAlpha=0.55; g.fillRect(x0,y0,x1-x0,y1-y0); g.globalAlpha=1; };
  zone(0,990,640,1236,'#f5f5f4','Hall d’enregistrement','🎫'); zone(0,820,640,965,'#dbeafe','Contrôle de sûreté','🔍'); zone(0,700,320,815,'#f1f5f9','Couloir — vols nationaux',TH.flag);
  zone(320,700,640,815,'#ede9fe','Police aux frontières — zone internationale','🛂'); zone(0,420,640,700,'#fafaf9','',null);  zone(0,0,640,410,'#f8fafc','',null);
  zone(660,0,1000,240,'#f1f5f9','Couloir des arrivées','🛬'); zone(660,240,1000,420,'#ede9fe','Immigration','🛂'); zone(660,420,1000,860,'#f8fafc','Livraison des bagages','🧳');
  zone(660,860,1000,960,'#dcfce7','Douane','🛃'); zone(660,960,1000,1236,'#fef9c3','Hall des arrivées · accueil','🤝');
  { const MU=typeof myApMural==='function'?myApMural(TM.code):null; if(MU){ const art=(cx,y0,h,al)=>{ const w=h*MU.width/MU.height; g.globalAlpha=al; g.save(); g.translate(cx,0); if(TH.mx) g.scale(-1,1); g.drawImage(MU,-w/2,y0,w,h); g.restore(); g.globalAlpha=1; };   /* jamais à l'envers dans un plan en miroir */
      art(320,992,242,0.85);   /* une seule image : la grande peinture du hall d'enregistrement */ } }   /* fresque peinte au sol des halls, d'après la photo choisie par le joueur */
  const walls=[[640,0,20,1236],[0,410,640,10],[0,965,640,25],[0,815,640,5],[660,240,340,4],[660,420,340,4],[660,860,340,4],[660,960,340,4]];
  g.fillStyle='rgba(0,0,0,.12)'; for(const w of walls) g.fillRect(w[0]+3,w[1]+3,w[2],w[3]);   // ombre des murs
  g.fillStyle='#57534e'; for(const w of walls) g.fillRect(...w); g.fillStyle=TH.acc; g.fillRect(645,0,10,1236);   // mur central à la couleur de l'aéroport
  g.fillStyle='#78716c'; g.fillRect(0,975,640,6); txt('↔ tapis vers le tri bagages',8,972,8,'#e7e5e4');
  if(L.tf){ g.fillStyle='#f1f5f9'; g.fillRect(638,200,24,20); g.strokeStyle='#0ea5e9'; g.lineWidth=1.5; g.strokeRect(638,200,24,20); fit('🔁 Correspondances · Transit',664,242,64,8,'#fff','#0369a1'); fit('🔁 Transit',598,190,40,8,'#fff','#0369a1'); }   /* porte des correspondances : de l'arrivée directement vers la zone d'embarquement */
  { g.fillStyle='#a8a29e'; for(let x=80;x<640;x+=160){ for(const y of [1100,600]) g.fillRect(x-3,y-3,6,6); } for(let x=740;x<1000;x+=120) g.fillRect(x-3,1150-3,6,6);   // piliers
    g.fillStyle='#4d7c0f'; for(const [x,y] of [[6,1000],[634,1000],[6,700],[634,705],[666,1100],[994,1100],[300,1232],[340,1232]]){ g.beginPath(); g.arc(x,y,5,0,6.283); g.fill(); } }   // plantes
  { const gr=g.createLinearGradient(0,-4,0,8); gr.addColorStop(0,'#7dd3fc'); gr.addColorStop(1,'rgba(125,211,252,0)'); g.fillStyle=gr; g.fillRect(0,-3,1000,11);   // façade vitrée
    g.strokeStyle='#0ea5e9'; g.lineWidth=3; g.beginPath(); if(TH.facade==='courbe'){ g.moveTo(0,0); g.quadraticCurveTo(500,-26,1000,0); } else if(TH.facade==='dents'){ for(let x=0;x<=1000;x+=50){ g.lineTo(x,x%100?-10:0); } } else { g.moveTo(0,0); g.lineTo(1000,0); } g.stroke();
    g.fillStyle='rgba(30,41,59,.25)'; g.beginPath(); if(TH.canopy==='ondule'){ g.moveTo(0,1236); for(let x=0;x<=1000;x+=25) g.lineTo(x,1242+Math.sin(x/40)*5); g.lineTo(1000,1236); } else if(TH.canopy==='arcs'){ g.moveTo(0,1236); for(let x=0;x<1000;x+=100) g.quadraticCurveTo(x+50,1256,x+100,1236); } else { g.rect(0,1236,1000,10); } g.fill(); }   // auvent du parvis
  // décor propre à l'aéroport : dans le hall des arrivées et le hall d'enregistrement
  { const dx=830, dy=1112; if(TH.deco==='fontaine'){ g.fillStyle='#bae6fd'; g.beginPath(); g.arc(dx,dy,22,0,6.283); g.fill(); g.strokeStyle='#64748b'; g.lineWidth=2; g.stroke(); g.strokeStyle='rgba(255,255,255,.8)'; g.lineWidth=1; for(let k=0;k<3;k++){ g.beginPath(); g.arc(dx,dy,6+k*5+((now/300)%5),0,6.283); g.stroke(); } }
    else if(TH.deco==='palmiers'){ for(const [x,y] of [[dx-24,dy],[dx+24,dy],[dx,dy-18],[310,1206]]){ g.fillStyle='#78350f'; g.beginPath(); g.arc(x,y,3,0,6.283); g.fill(); g.fillStyle='#15803d'; for(let a=0;a<6;a++){ g.beginPath(); g.ellipse(x+Math.cos(a)*8,y+Math.sin(a)*8,9,3.5,a,0,6.283); g.fill(); } } }
    else if(TH.deco==='jardin'){ g.fillStyle='#86efac'; g.fillRect(dx-34,dy-16,68,32); g.fillStyle='#166534'; for(let k=0;k<9;k++){ g.beginPath(); g.arc(dx-28+k*7,dy-8+((k*5)%16),3.5,0,6.283); g.fill(); } g.fillStyle='#a8a29e'; g.fillRect(dx-2,dy-16,4,32); }
    else if(TH.deco==='ecran'){ g.fillStyle='#0f172a'; g.fillRect(dx-40,dy-14,80,28); const hue=(now/80)%360; g.fillStyle=`hsl(${hue},70%,55%)`; g.fillRect(dx-36,dy-10,72,20); { g.fillStyle='#fff'; g.font='700 7px system-ui'; g.fillText('Bienvenue à '+TH.city,dx-34,dy+3); } }
    else if(TH.deco==='fresque'){ const cols=['#dc2626','#facc15','#16a34a','#2563eb','#ea580c']; for(let k=0;k<5;k++){ g.fillStyle=cols[k]; g.fillRect(668+k*66,1196,62,10); } }
    else { g.fillStyle=TH.acc; g.beginPath(); g.moveTo(dx,dy-24); g.lineTo(dx+18,dy+14); g.lineTo(dx-18,dy+14); g.closePath(); g.fill(); g.fillStyle='#e7e5e4'; g.beginPath(); g.arc(dx,dy+2,6,0,6.283); g.fill(); } }
  // tapis des salles d'embarquement (couleur de l'aéroport)
  g.fillStyle=TH.carpet; g.globalAlpha=0.12; g.fillRect(0,40,640,360); g.globalAlpha=1;
  // formes du bâtiment : jetée, satellite avec navette, aile en L
  { const wall=(x0,y0,x1,y1)=>{ g.fillStyle='rgba(0,0,0,.14)'; g.fillRect(x0+3,y0+3,x1-x0,y1-y0); g.fillStyle=TH.floor; g.fillRect(x0,y0,x1-x0,y1-y0); g.strokeStyle='#57534e'; g.lineWidth=3; g.strokeRect(x0,y0,x1-x0,y1-y0); };
    if(L.shape==='jetee'){ const ye=L.pierEnd||-140; wall(260,ye,380,0); g.fillStyle='#57534e'; g.fillRect(150,ye,110,-ye); g.fillRect(380,ye,110,-ye); for(const d of L.deps){ g.fillStyle=TH.floor; g.fillRect(d.lounge.x0,d.lounge.y0,d.lounge.x1-d.lounge.x0,d.lounge.y1-d.lounge.y0); }
      g.fillStyle='rgba(148,163,184,.5)'; for(let y=ye+20;y<-10;y+=40) g.fillRect(300,y,40,14);   // tapis roulants de la jetée
      TM.signs.push(['🛬 Jetée',262,ye+2,378,ye+18,null],['🚶 Hall vers la jetée',4,8,636,30,null]); }
    else if(L.shape==='satellite'){ const sxa=(L.satX||[100,540]); wall(sxa[0],-700,sxa[1],-460); wall(300,-460,340,0); const k=(now/26000)%2, ty=-456+(k<1?k:2-k)*440; g.fillStyle='#e5e7eb'; g.fillRect(304,ty,32,30); g.fillStyle=TH.acc; g.fillRect(304,ty+4,32,6); g.fillStyle='#38bdf8'; g.fillRect(306,ty+14,28,8);   // navette automatique
      TM.signs.push(['🛰️ Satellite',sxa[0]+4,-475,sxa[1]-4,-462,null],['🚝 Navette automatique',346,-300,560,-282,null],['🛍️ Hall de transfert vers le satellite',4,8,636,30,null]); }
    else if(L.shape==='L'){ wall(-420,0,0,410); TM.signs.push(['📐 Aile des portes',-416,394,-4,409,null]); } }
  // portes au départ
  for(const d of L.deps){ const f=d.f, D=f.D, sel=TM.selF===f; const lg=d.lounge; g.fillStyle=f.col; g.globalAlpha=sel?0.28:0.13; g.fillRect(lg.x0,lg.y0,lg.x1-lg.x0,lg.y1-lg.y0); g.globalAlpha=1;
    g.strokeStyle='#94a3b8'; g.lineWidth=1; g.strokeRect(lg.x0,lg.y0,lg.x1-lg.x0,lg.y1-lg.y0);
    g.fillStyle='rgba(100,116,139,.45)'; g.beginPath(); if(TH.seat==='ilots'){ for(const p of d.seats){ g.moveTo(p.x+2.6,p.y); g.arc(p.x,p.y,2.6,0,6.283); } g.fill(); } else { for(const p of d.seats) g.rect(p.x-3.2,p.y-1,6.4,3); g.fill(); g.fillStyle='#334155'; g.beginPath(); for(const p of d.seats) g.rect(p.x-3.2,p.y-2.6,6.4,1.5); g.fill(); }
    { g.strokeStyle='rgba(30,41,59,.25)'; g.lineWidth=0.6; const P=d.bq.pts; g.beginPath(); for(let k=0;k<P.length;k+=2){ g.moveTo(P[k].x,P[k].y+5); g.lineTo(P[k+1]?P[k+1].x:P[k].x,P[k].y+5); } g.stroke(); }
    g.fillStyle='#334155'; g.fillRect(d.desk.x-14,d.desk.y-4,28,8); 
    if(d.lounge.y1-d.lounge.y0>150) fit(D.B.city+' '+tmHM(D.P),d.lounge.x0+4,d.lounge.y0+60,Math.min(56,d.lounge.x1-d.lounge.x0-8),12,'#22c55e','#0f172a');   // écran de porte
    { const pl=tmDepPlane(d,now), st=d.stand, n={x:-Math.sin(st.a),y:Math.cos(st.a)}, nx=st.x+n.x*2, ny=st.y+n.y*2;
      if(pl&&pl.at){ tmPlane(g,pl.x,pl.y,col0(f),pl.a,tmPSc(f),0,f); tmGSE(g,pl,f,now,0); }
      { const rt=pl&&pl.at?Math.min(1,Math.max(0,(now-D.gate.close)/(2*MIN))):1, fr=1-0.7*rt, ex=d.door.x+(nx-d.door.x)*fr, ey=d.door.y+(ny-d.door.y)*fr; if(L.nd){ if(pl&&pl.at) tmStairsDraw(g,st,f); } else tmBridge(g,d.door.x,d.door.y,ex,ey); } }
    { const lw=d.lounge.x1-d.lounge.x0-4; fit(`${D.gate.name} → ${D.B.city}`,d.lounge.x0+2,d.lounge.y0+2,lw,13,'#0f172a','rgba(255,255,255,.8)'); const gs=D.tko&&now>=D.P&&now<D.tko?(D.hold&&now>=D.hold[0]?['ATTENTE DÉCOLLAGE','#d97706']:['ROULE VERS LA PISTE','#475569']):now>D.gate.close?['FERMÉ','#64748b']:now>D.gate.last?['DERNIER APPEL','#dc2626']:now>D.gate.open?['EMBARQUEMENT','#16a34a']:tmDelay(f)?['RETARD '+tmDelay(f)+' MIN','#d97706']:now>D.ci.open?['ENREGISTREMENT','#2563eb']:['À L’HEURE','#334155'];
      fit(`${tmHM(D.P)} · ${f.fn}`,d.lounge.x0+2,d.lounge.y0+15,lw*0.45,10,'#334155','rgba(255,255,255,.6)',1); fit(gs[0],d.lounge.x0+2+lw*0.47,d.lounge.y0+15,lw*0.53,10,'#fff',gs[1]); }
  }
  for(const gr of L.ckGroups||[]){ const d=gr; g.fillStyle=gr.A.col; g.globalAlpha=0.12; g.fillRect(d.cx0,1000,d.cx1-d.cx0,160); g.globalAlpha=1;
    g.fillStyle='#1f2937'; g.fillRect(d.ck.x0,d.ck.y-6,d.ck.x1-d.ck.x0,10); g.fillStyle='#78716c'; g.fillRect(d.ck.x0,d.ck.y-16,d.ck.x1-d.ck.x0,6);
    { g.strokeStyle='rgba(30,64,175,.45)'; g.lineWidth=0.8; const P=d.q.pts; g.beginPath(); for(let k=0;k<P.length;k+=2){ g.moveTo(P[k].x,P[k].y+8); g.lineTo(P[k+1]?P[k+1].x:P[k].x,P[k].y+8); } g.stroke(); g.fillStyle='#475569'; g.beginPath(); for(const q of P){ g.moveTo(q.x+1.1,q.y+8); g.arc(q.x,q.y+8,1.1,0,6.283); } g.fill(); }   // sangles et poteaux
    fit(gr.fl.slice().sort((a,b)=>a.f.D.P-b.f.D.P).map(x=>x.f.fn+' '+x.f.D.B.city).join(' · '),d.ck.x0,d.ck.y-6,d.ck.x1-d.ck.x0,10,'#fff',null);
 }
  for(const gr of L.ckGroups||[]){ fit(gr.z+' · '+gr.A.name+(gr.fl.length>1?` · ${gr.fl.length} vols`:''),gr.ck.x0,983,gr.ck.x1-gr.ck.x0,11,'#fff',gr.A.col);
    const open=gr.fl.some(x=>now>=x.f.D.ci.open&&now<x.f.D.ci.close); if(!open){ const nx=gr.fl.map(x=>x.f.D.ci.open).filter(t=>t>now).sort((a,b)=>a-b)[0]; g.fillStyle='rgba(71,85,105,.55)'; g.fillRect(gr.ck.x0,gr.ck.y-6,gr.ck.x1-gr.ck.x0,10); fit(nx?'Fermé · ouvre à '+tmHM(nx):'Fermé',gr.ck.x0,gr.ck.y+6,gr.ck.x1-gr.ck.x0,8,'#fff','rgba(30,41,59,.85)'); } }   /* comptoirs fermés quand aucun vol n'est en enregistrement */   /* un bandeau par compagnie */
  if(0){ const cs=[...L.deps].sort((a,b)=>a.ck.x0-b.ck.x0); for(let k=0;k<cs.length;){ const A=tmAirline(cs[k].f); let j=k; while(j+1<cs.length&&tmAirline(cs[j+1].f).name===A.name) j++; const x0=cs[k].ck.x0, x1=cs[j].ck.x1; fit(A.name+(j>k?` · ${j-k+1} vols`:''),x0,983,x1-x0,11,'#fff',A.col); k=j+1; } }   // un bandeau par compagnie
  // arrivées : jetée, tapis roulant, couloir national, barrière d'accueil, taxis
  g.fillStyle='#cbd5e1'; g.fillRect(668,176,322,20); g.fillStyle='#94a3b8'; for(let x=672;x<820;x+=14){ const o=(now/400)%14; g.fillRect(x+o,182,6,8); } for(let x=830;x<986;x+=14){ const o=(now/400)%14; g.fillRect(x+14-o,182,6,8); }
  txt('⇢ tapis roulant ⇠',800,172,9,'#334155',1);
  g.fillStyle='#1e3a8a'; g.fillRect(676,322,128,10); g.fillRect(822,322,130,10); txt(TH.flag+' Passeports nationaux',678,330,7,'#fff',1); txt('🌍 Passeports étrangers',824,330,7,'#fff',1);
  { g.strokeStyle='rgba(30,41,59,.3)'; g.lineWidth=0.7; for(const P of [L.immQn.pts,L.immQf.pts]){ g.beginPath(); for(let k=0;k<P.length;k+=2){ g.moveTo(P[k].x,P[k].y+7); g.lineTo(P[k+1]?P[k+1].x:P[k].x,P[k].y+7); } g.stroke(); } }
  g.fillStyle='#e2e8f0'; g.fillRect(968,232,30,190); txt(TH.flag+' Nat.',970,250,8,'#334155',1);
  g.fillStyle='#57534e'; g.fillRect(660,998,146,4); g.fillRect(854,998,146,4); txt('🚪 Sortie des arrivées',808,994,9,'#0f172a',1);
  g.fillStyle='#78716c'; g.fillRect(666,1236,334,4);
  for(let k=0;k<7;k++){ const ph=(now/90000+k*0.31)%1, x=700+k*42+(ph<0.12?ph*800:0); if(x<1000){ g.fillStyle=k%3===2?'#f8fafc':'#facc15'; g.fillRect(x-9,1278,18,10); g.fillStyle='#1f2937'; g.fillRect(x-6,1280,12,3); } }   // taxis
  for(const a of L.arrs){ const f=a.f, b=a.belt; { const pl=tmArrPlane(a,now); if(pl&&pl.at){ tmPlane(g,pl.x,pl.y,col0(f),pl.a,tmPSc(f),0,f); tmGSE(g,pl,f,now,1); } if(L.nd){ if(pl&&pl.at) tmStairsDraw(g,{x:a.door.x,y:a.sy,a:pl.a},f); } else tmBridge(g,a.door.x,36,a.door.x,pl&&pl.at?(a.sy||-60)+2:-14); }
    fit(f.D.A.city+' · '+f.fn,a.x0+1,52,a.x1-a.x0-2,11,'#0f172a','rgba(255,255,255,.75)');
    g.strokeStyle='#334155'; g.lineWidth=10; g.beginPath(); g.ellipse(b.cx,b.cy,b.rx,b.ry,0,0,6.283); g.stroke(); g.strokeStyle=f.col; g.lineWidth=2; g.stroke();
    fit(('Tapis '+b.n+' · '+f.fn+' · '+f.D.A.city),b.cx-34,b.cy-b.ry-24,68,13,now>f.D.bag.first&&now<f.D.bag.last?'#22c55e':'#facc15','#0f172a');  }
  // équipements et commerces
  for(const p of L.poi){ const col={kiosk:'#0ea5e9',xray:'#475569',arch:'#94a3b8',booth:'#7c3aed',egate:'#6d28d9',wc:'#cbd5e1',cafe:'#fde68a',resto:'#fed7aa',dutyfree:'#fbcfe8',pharma:'#bbf7d0',press:'#e9d5ff',prayer:'#e0e7ff',seats:'#f1f5f9',info:'#bae6fd',green:'#86efac',red:'#fca5a5',change:'#fde68a',taxi:'#facc15',car:'#cbd5e1',lost:'#fecaca',lounge:'#d6d3d1',fids:'#0f172a',transfer:'#bae6fd',health:'#fef08a',trolley:'#d1d5db',xrayc:'#475569',atm:'#cbd5e1',fidsA:'#0f172a',kids:'#bbf7d0',ebola:'#d1fae5',visa:'#fef3c7'}[p.k]||'#e5e7eb';
    g.fillStyle=col; g.fillRect(p.x0,p.y0,p.x1-p.x0,p.y1-p.y0); g.strokeStyle='rgba(51,65,85,.5)'; g.lineWidth=0.6; g.strokeRect(p.x0,p.y0,p.x1-p.x0,p.y1-p.y0);
    if(/^(dutyfree|cafe|resto|pharma|press|lounge|change|car)$/.test(p.k)){ const sh=p.k==='pharma'?'#16a34a':p.k==='dutyfree'?'#be185d':p.k==='press'?'#7c3aed':p.k==='lounge'?'#44403c':'#b45309'; g.fillStyle=sh; g.fillRect(p.x0,p.y1-3,p.x1-p.x0,3); g.fillStyle='rgba(255,255,255,.55)'; for(let x=p.x0+3;x<p.x1-3;x+=8) g.fillRect(x,p.y1-2.4,4,1.8);   // devanture
      if(/dutyfree|pharma|press/.test(p.k)){ g.fillStyle='rgba(51,65,85,.28)'; g.beginPath(); for(let y=p.y0+20;y<p.y1-10;y+=12) g.rect(p.x0+8,y,p.x1-p.x0-16,3); g.fill(); } }   // rayons
    if(p.k==='kids'){ g.fillStyle='#f472b6'; g.beginPath(); g.arc(p.x0+30,p.y0+40,10,0,6.283); g.fill(); g.fillStyle='#60a5fa'; g.fillRect(p.x0+60,p.y0+28,40,8); g.fillStyle='#facc15'; g.beginPath(); g.moveTo(p.x0+90,p.y1-10); g.lineTo(p.x0+110,p.y1-40); g.lineTo(p.x0+118,p.y1-10); g.fill(); }   // toboggan, balles, tunnel
    if(p.k==='resto'||p.k==='cafe'){ g.fillStyle='rgba(120,53,15,.35)'; g.beginPath(); for(let x=p.x0+10;x<p.x1-6;x+=18) for(let y=p.y0+16;y<p.y1-6;y+=16){ g.moveTo(x+3.5,y); g.arc(x,y,3.5,0,6.283); } g.fill(); }
    if(p.k==='seats'||p.k==='lounge'){ g.fillStyle='rgba(100,116,139,.4)'; for(let y=p.y0+12;y<p.y1-4;y+=12) g.fillRect(p.x0+8,y,p.x1-p.x0-16,3); }
    if(p.k==='xray'){ g.fillStyle='#1e293b'; g.fillRect(p.x0+18,p.y0+3,24,10); g.fillStyle='#64748b'; for(let k=0;k<3;k++) g.fillRect(p.x0+2+((now/1500+k*7)%16),p.y0+5,4,6); }   // bacs qui avancent
    if(p.k==='fids'||p.k==='fidsA'){ tmFids(p,now,g,fit); continue; }
    if(tmClosed(p.k,now)){ g.fillStyle='#9ca3af'; g.fillRect(p.x0,p.y0,p.x1-p.x0,p.y1-p.y0); g.strokeStyle='rgba(55,65,81,.5)'; g.lineWidth=0.5; g.beginPath(); for(let yy=p.y0+3;yy<p.y1;yy+=3){ g.moveTo(p.x0,yy); g.lineTo(p.x1,yy); } g.stroke(); fit('🔒 Fermé · '+p.lab.split(' (')[0],p.x0+2,p.y0+2,p.x1-p.x0-4,Math.min(12,(p.y1-p.y0)*0.45),'#fff','rgba(31,41,55,.85)'); continue; }
    const nm=p.lab.split(' (')[0].split(' —')[0], bw=p.x1-p.x0, bh=p.y1-p.y0;
    if(bw>=44&&bh>=14) fit(p.ico+' '+nm,p.x0+2,p.y0+2,bw-4,Math.min(13,bh*0.42),'#111827','rgba(255,255,255,.85)');
    else fit(p.ico,p.x0,p.y0,Math.min(bw,bh+6),Math.min(bh,14),'#111827',null); }
  // bandeaux de titre des zones (place réservée, nombre de personnes en file)
  { const C2=TM.cnt||{}; for(const [t,x0,y0,x1,y1,k] of TM.signs){ const v=k?C2[k]:0; fit(t+(v?` · ${v} en file`:''),x0,y0,x1-x0,y1-y0,'#fff',TH.acc); } }
  fit(`${TH.flag} ${TH.name}`,4,1240,640,22,'#fff','#0f172a');
  tmLight(g,L,TH);
  tmWay(g,L,TH,fit);
  tmParked(g,L,now);
  if(L.cargo||L.vip) tmCargoDraw(g,L,now,fit);
  { g.fillStyle='rgba(148,163,184,.28)'; g.fillRect(614,996,24,170); g.fillRect(0,TM_AISLE-6,640,12); g.fillStyle='rgba(51,65,85,.55)'; for(let y=1150;y>1004;y-=22){ g.beginPath(); g.moveTo(620,y); g.lineTo(626,y-8); g.lineTo(632,y); g.closePath(); g.fill(); } fit('↑ Sûreté',612,1110,28,8,'#fff','#0e7490'); }   /* allée et couloir vers la sûreté */
  if(L.hall){ g.fillStyle='#94a3b8'; g.fillRect(304,40,32,356); g.fillStyle='#cbd5e1'; for(let y=48;y<392;y+=14){ g.beginPath(); g.moveTo(310,y+8); g.lineTo(320,y); g.lineTo(330,y+8); g.lineTo(326,y+8); g.lineTo(320,y+4); g.lineTo(314,y+8); g.closePath(); g.fill(); } fit('⇡ tapis roulant vers les portes',300,396,40,6,'#334155',null); }   // tapis roulant du hall
  if(TM.rain){ g.fillStyle='rgba(148,197,255,.10)'; g.fillRect(L.bx0,TW.top,L.bx1-L.bx0,-TW.top-2); g.strokeStyle='rgba(226,232,240,.10)'; g.lineWidth=2; g.beginPath(); for(let k=0;k<60;k++){ const x=L.bx0+((k*157)%(L.bx1-L.bx0)), y=TW.top+((k*89)%(-TW.top)); g.moveTo(x,y); g.lineTo(x+1,y+14); } g.stroke(); }   // tarmac mouillé, reflets
  tmDecor(L,now,g,fit);
  { g.strokeStyle='#b45309'; g.lineWidth=1; g.beginPath(); g.moveTo(14,946); g.lineTo(14,876); g.moveTo(50,946); g.lineTo(50,906); g.stroke(); fit('⭐ Coupe-file prioritaire',4,866,96,9,'#fff','#b45309'); }
  };
  // décor fixe mis en cache : redessiné seulement si la vue bouge, ou toutes les 1,5 s (les avions qui roulent sont dessinés à chaque image)
  const DP=L.deps.map(d=>tmDepPlane(d,now)), AP2=L.arrs.map(a=>tmArrPlane(a,now));
  { const key=[s,c.x,c.y,cv.width,cv.height,TM.built,TM.heat,DP.map(p=>p?(p.at?1:2):0).join(''),AP2.map(p=>p?(p.at?1:2):0).join('')].join('|'), stable=key===TM.camKey, tn=performance.now(); TM.camKey=key; TM.cacheOn=stable;
    if(stable){ if(!TM.sc||TM.sc.width!==cv.width||TM.sc.height!==cv.height){ TM.sc=document.createElement('canvas'); TM.sc.width=cv.width; TM.sc.height=cv.height; TM.scKey=null; }
      if(TM.scKey!==key||tn-(TM.scAt||0)>1500){ g=TM.sc.getContext('2d'); prep(g,true); drawStatic(); TM.scKey=key; TM.scAt=tn; TM.scCam={s,x:c.x,y:c.y,d:TM.dpr,w:cv.width,h:cv.height}; g=main; }
      main.setTransform(1,0,0,1,0,0); main.drawImage(TM.sc,0,0); prep(main,false); }
    else if(TM.sc&&TM.scCam&&TM.scCam.w===cv.width&&TM.scCam.h===cv.height&&TM.scKey&&Math.abs(Math.log(s/TM.scCam.s))<0.9){   /* caméra en mouvement : on déplace l'image déjà dessinée (fluide), le décor exact revient dès l'arrêt */
      const C0=TM.scCam, k=(s*TM.dpr)/(C0.s*C0.d); main.setTransform(1,0,0,1,0,0); main.fillStyle='#1e293b'; main.fillRect(0,0,cv.width,cv.height); main.setTransform(k,0,0,k,(C0.x-c.x)*s*TM.dpr,(C0.y-c.y)*s*TM.dpr); main.drawImage(TM.sc,0,0); prep(main,false); TM.moveDraw=1; }
    else { prep(main,true); drawStatic(); }
    tmCurb(g,now); if(L.kin) tmKinCurb(g); tmRoad(g,L,now);
    // avions qui roulent ou sont repoussés : position recalculée à chaque image
    const fly=(pl,f)=>{ const sc=tmPSc(f), air=pl.air||0; if(air>0){ g.save(); g.globalAlpha=0.22*(1-air*0.5); g.fillStyle='#020617'; g.translate(pl.x+air*22,pl.y+air*30); g.rotate(pl.a); g.beginPath(); g.ellipse(0,-50*sc,8*sc,46*sc,0,0,6.283); g.ellipse(0,-50*sc,52*sc,7*sc,0,0,6.283); g.fill(); g.restore(); } tmPlane(g,pl.x,pl.y,col0(f),pl.a,sc*(1+air*0.55),1,f); };   /* en l'air : plus gros, ombre décalée au sol */
    DP.forEach((pl,k)=>{ if(!pl||pl.at) return; if(pl.push){ g.save(); g.translate(pl.x,pl.y); g.rotate(pl.a); g.fillStyle='#facc15'; g.fillRect(-4,2,8,10); g.restore(); } fly(pl,L.deps[k].f); });
    AP2.forEach((pl,k)=>{ if(pl&&!pl.at) fly(pl,L.arrs[k].f); });
    { const pq=tmPres(now); if(pq){ tmPresDraw(g,pq); if(pq.at) tmStairsDraw(g,{x:pq.x,y:pq.y,a:0},{model:'B737',N:150}); } }   /* avion présidentiel */
    if(TM.storm){ g.strokeStyle='rgba(191,219,254,.55)'; g.lineWidth=1; g.beginPath(); for(let k=0;k<90;k++){ const x=L.bx0+((k*137+now/9)%(L.bx1-L.bx0)), y=TW.top+((k*71+now/4)%(-TW.top+30)); g.moveTo(x,y); g.lineTo(x-3,y+9); } g.stroke(); } }
  { const E=tmEv(now); if(E.vipOn||E.vipSoon) tmVipDraw(g,L,now,E); }
  // valises : tapis, tri, soutes, tapis de livraison
  for(const b of TM.bags||[]){ let q=null;
    if(now>=b.t0&&now<b.t0+b.dur) q=tmPathAt(b.P,(now-b.t0)/b.dur);
    else if(b.belt&&now>=b.t0+b.dur&&now<b.pick){ const an=(now-b.tB)/26000+(b.p.i%10)*0.63; q={x:b.belt.cx+Math.cos(an)*b.belt.rx,y:b.belt.cy+Math.sin(an)*b.belt.ry}; }
    if(!q) continue; { const X=tmFx(q.x), Y=tmFy(q.y); if(X<c.x-10||X>c.x+w/s+10||Y<c.y-10||Y>c.y+h/s+10) continue; }   /* seulement les valises à l'écran */
    if(s<1.6){ g.fillStyle=b.c; g.fillRect(q.x-3,q.y-2.4,6,4.8); continue; }
    tmBagDraw(g,q.x,q.y,b,s); }
  // incidents en cours
  for(const x of TM.inc||[]) if(now>=x.at&&now<x.at+20*MIN){ const pr=3+Math.sin(now/300)*1.5; g.fillStyle='rgba(239,68,68,.85)'; g.beginPath(); g.arc(x.x,x.y,7+pr,0,6.283); g.fill(); txt('!',x.x-2,x.y+4,11,'#fff',1); }
  // passagers (animés)
  // vue de loin : la couche des personnages n'est recalculée que 8 fois par seconde (ce sont de petits points)
  const toPl=(3.3*s<2.2)&&TM.cacheOn, plSkip=toPl&&TM.pl&&TM.plKey===TM.camKey&&(performance.now()-TM.plAt<Math.max(3.3*s<1.8?120:80,TM.plGap||0)||(TM.plF||0)<2); if(plSkip) TM.plF=(TM.plF||0)+1;   // au plus 1 image sur 3 recalcule la foule (évite l'emballement sur un téléphone lent)
  let n=0, nd=0, na=0; let pts=[], cnt={ck:0,sec:0,pol:0,board:0,imm:0,belt:0}; const BUS=new Map(), FB={}, r00=3.3, vx0=c.x-10, vy0=c.y-10, vx1=c.x+w/s+10, vy1=c.y+h/s+10, legs=true;
  const plMove=!TM.cacheOn&&(3.3*s<2.2)&&TM.pl&&TM.plCam&&TM.plCam.w===cv.width&&TM.plCam.h===cv.height&&TM.pts&&TM.nn&&Math.abs(Math.log(s/TM.plCam.s))<0.9;
  if(plMove){ const C0=TM.plCam, k=(s*TM.dpr)/(C0.s*C0.d); main.setTransform(k,0,0,k,(C0.x-c.x)*s*TM.dpr,(C0.y-c.y)*s*TM.dpr); main.drawImage(TM.pl,0,0); prep(main,false); [n,nd,na]=TM.nn; pts=TM.pts; cnt=TM.cnt; }   /* foule de loin pendant un déplacement : image précédente déplacée */
  else if(plSkip){ main.setTransform(1,0,0,1,0,0); main.drawImage(TM.pl,0,0); prep(main,false); [n,nd,na]=TM.nn; pts=TM.pts; cnt=TM.cnt; } else {
  const _plT0=performance.now();
  if(toPl){ if(!TM.pl||TM.pl.width!==cv.width||TM.pl.height!==cv.height){ TM.pl=document.createElement('canvas'); TM.pl.width=cv.width; TM.pl.height=cv.height; } g=TM.pl.getContext('2d'); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,cv.width,cv.height); prep(g,false); }
  const rtN=performance.now();
  for(const p of TM.ppl){ let q; if(!toPl&&p._off&&rtN-p._qr<320&&p._qt<=now) q=p._q; else { q=tmAt(p.K,now); p._q=q; p._qr=rtN; p._qt=now; p._off=false; } if(!q) continue;   /* hors de l'écran : position recalculée ~3 fois/s seulement */ if(p.crew){ cnt.crew=(cnt.crew||0)+1; } else if(p.staff){ cnt.staff=(cnt.staff||0)+1; } else if(p.greet){ cnt.greet=(cnt.greet||0)+1; } else { n++; p.dep?nd++:na++; }
    { const k=tmCat(q.st,q.q); if(k) cnt[k]++; }
    if(q.bus){ const bk=Math.round(q.x/10)+','+Math.round(q.y/10); if(!BUS.has(bk)) BUS.set(bk,[q.x,q.y]); continue; }   /* dans le bus de piste : on dessine le bus, pas les passagers */
    const x=q.x+((p.i*13)%7-3)*0.7, y=q.y+((p.i*7)%5-2)*0.7; pts.push([x,y,p,q]); { const X=tmFx(x), Y=tmFy(y); if(X<vx0||X>vx1||Y<vy0||Y>vy1){ if(p._qr===rtN) p._off=X<vx0-60||X>vx1+60||Y<vy0-60||Y>vy1+60; continue; } }
    const r0=r00, px=r0*s, ph=q.walk?Math.sin(now/140+p.i):0, carry=(p.dep===1?(p.bag&&now<p.ckDone):(p.dep===0&&p.hasBag&&now>=p.bagT&&!p.trol)), L=tmLook(p);
    const trol=p.staff==='porter'||(p.dep===1&&p.row&&p.row.bags>=2&&now<p.ckDone)||(!p.dep&&p.hasBag&&now>=p.bagT);   // chariot à bagages poussé devant soi
    if(trol&&px>=2.2){ const fx=p.face||1, tx=x+fx*r0*1.6, ty=y+r0*1.0; g.fillStyle='#94a3b8'; g.fillRect(tx-r0*0.9,ty-r0*0.35,r0*1.8,r0*0.7); g.fillStyle=TM_BAGC[p.i%8]; g.fillRect(tx-r0*0.75,ty-r0*1.05,r0*1.5,r0*0.75); if(p.row&&p.row.bags>=2){ g.fillStyle=TM_BAGC[(p.i+3)%8]; g.fillRect(tx-r0*0.6,ty-r0*1.6,r0*1.2,r0*0.6); } g.fillStyle='#111'; g.beginPath(); g.arc(tx-r0*0.7,ty+r0*0.45,r0*0.16,0,6.283); g.arc(tx+r0*0.7,ty+r0*0.45,r0*0.16,0,6.283); g.fill(); }
    if(p.wheel&&px>=2.2){ g.strokeStyle='#475569'; g.lineWidth=0.7; g.fillStyle='#64748b'; g.fillRect(x-r0*0.9,y+r0*0.2,r0*1.8,r0*0.35); g.beginPath(); g.arc(x-r0*0.85,y+r0*1.0,r0*0.68,0,6.283); g.moveTo(x+r0*1.53,y+r0*1.0); g.arc(x+r0*0.85,y+r0*1.0,r0*0.68,0,6.283); g.stroke(); }
    const rain=TM.rain&&y>1196&&!p.staff;
    if(p.row&&p.row.star){ const sz=9/s+2, sy=y-r0*4-sz; g.fillStyle='#facc15'; g.strokeStyle='#78350f'; g.lineWidth=1/s+0.3; g.beginPath(); for(let j=0;j<10;j++){ const a=-Math.PI/2+j*Math.PI/5, rr=j%2?sz*0.42:sz; g.lineTo(x+Math.cos(a)*rr,sy+Math.sin(a)*rr); } g.closePath(); g.fill(); g.stroke(); }   // ⭐ Merveil Hakeem Dianzenza
    if(px<2.2){ const L3=tmLook(p), k3=r0*L3.sc, bc=L3.pagne?L3.pagne[0]:L3.boubou?L3.boubou[0]:L3.top; (FB[bc]||(FB[bc]=[])).push(x,y+r0*1.7-k3*1.9,k3*0.7,k3*1.05); (FB[p.sk]||(FB[p.sk]=[])).push(x,y+r0*1.7-k3*3.2,k3*0.6,k3*0.6); continue; }
    tmHuman(g,p,p.wheel?{...q,sit:1}:q,x,y,r0,now,px,carry&&!trol);
    if(px>=4.5&&!p.staff&&!p.crew){ const M=tmMood(p,q,now), e=M&&TM_MOOD_EMO[M.lvl]; if(e&&(M.lvl<=-2||M.lvl>=2||p.i%3===0)){ const by=y-r0*5.6; g.fillStyle='rgba(255,255,255,.92)'; g.beginPath(); g.arc(x+r0*1.2,by,r0*1.15,0,6.283); g.fill(); g.beginPath(); g.moveTo(x+r0*0.5,by+r0*0.8); g.lineTo(x+r0*0.2,by+r0*1.7); g.lineTo(x+r0*1.1,by+r0*1.0); g.fill(); g.font=`${r0*1.5}px system-ui`; g.fillText(e,x+r0*0.45,by+r0*0.55); } }   /* bulle d'humeur */
    if(p.staff==='patrol'&&p.i%2&&px>=2.2){ const fx=p.face||1, dx=x+fx*r0*1.6, dy=y+r0*1.25, lg=q.walk?Math.sin(now/90)*r0*0.25:0; g.fillStyle='#78350f'; g.beginPath(); g.ellipse(dx,dy,r0*0.85,r0*0.38,0,0,6.283); g.fill(); g.beginPath(); g.arc(dx+fx*r0*0.85,dy-r0*0.3,r0*0.32,0,6.283); g.fill(); g.strokeStyle='#78350f'; g.lineWidth=r0*0.16; g.beginPath(); g.moveTo(dx-r0*0.5,dy); g.lineTo(dx-r0*0.5+lg,dy+r0*0.55); g.moveTo(dx+r0*0.5,dy); g.lineTo(dx+r0*0.5-lg,dy+r0*0.55); g.moveTo(dx-fx*r0*0.85,dy-r0*0.1); g.lineTo(dx-fx*r0*1.2,dy-r0*0.4); g.stroke(); g.strokeStyle='#111827'; g.lineWidth=0.4; g.beginPath(); g.moveTo(x+fx*r0*0.7,y+r0*0.4); g.lineTo(dx+fx*r0*0.7,dy-r0*0.3); g.stroke(); }   // chien détecteur et sa laisse
    if(rain&&px>=2.2){ const L2=tmLook(p), top=y+r0*1.7-r0*L2.sc*3.9; g.fillStyle=['#111827','#1d4ed8','#b91c1c','#15803d','#7c3aed'][p.i%5]; g.beginPath(); g.arc(x,top,r0*1.5,Math.PI,0); g.fill(); g.strokeStyle='#111'; g.lineWidth=0.4; g.beginPath(); g.moveTo(x,top); g.lineTo(x,top+r0*1.6); g.stroke(); }
    if(p.sign&&!q.walk){ const L2=tmLook(p), top=y+r0*1.7-r0*L2.sc*4.4; g.fillStyle='#fff'; g.fillRect(x-r0*1.6,top-r0*1.3,r0*3.2,r0*1.3); g.strokeStyle='#334155'; g.lineWidth=0.4; g.strokeRect(x-r0*1.6,top-r0*1.3,r0*3.2,r0*1.3); if(px>5&&p.signName){ let fs=r0*0.8; g.font=`700 ${fs}px system-ui`; let tw=g.measureText(p.signName).width; if(tw>r0*3){ fs*=r0*3/tw; g.font=`700 ${fs}px system-ui`; tw=r0*3; } g.fillStyle='#111'; g.fillText(p.signName,x-tw/2,top-r0*0.38); } else if(px>4){ g.fillStyle='#111'; for(let j=0;j<3;j++) g.fillRect(x-r0*1.2+j*r0*0.85,top-r0*0.8,r0*0.6,r0*0.25); } } }
  for(const c in FB){ const a=FB[c]; g.fillStyle=c; g.beginPath(); for(let j=0;j<a.length;j+=4) g.rect(a[j]-a[j+2],a[j+1]-a[j+3],a[j+2]*2,a[j+3]*2); g.fill(); }
  for(const [x,y] of BUS.values()) tmBusDraw(g,x,y,now);
  TM.pts=pts; TM.cnt=cnt; TM.nn=[n,nd,na];
  if(toPl){ g=main; main.setTransform(1,0,0,1,0,0); main.drawImage(TM.pl,0,0); prep(main,false); TM.plKey=TM.camKey; TM.plAt=performance.now(); TM.plF=0; TM.plCam={s,x:c.x,y:c.y,d:TM.dpr,w:cv.width,h:cv.height}; TM.plGap=Math.min(260,Math.max(0,(TM.plAt-_plT0)*4)); } }   /* foule de loin : au plus ~25 % du temps de calcul */
  { const E=tmEv(now); if(E.pw){ g.fillStyle='rgba(2,6,23,.42)'; g.fillRect(0,0,1000,1236); g.fillStyle=(Math.floor(now/700)%2)?'#22c55e':'#16a34a'; for(const [x,y] of [[320,412],[320,968],[650,600],[830,958],[100,700],[830,1236]]){ g.fillRect(x-7,y-3,14,6); }
      g.fillStyle='#365314'; g.fillRect(1006,560,26,40); g.fillStyle='#facc15'; g.fillRect(1010,566,18,6); g.fillStyle='rgba(148,163,184,.5)'; const sm=(now/400)%12; g.beginPath(); g.arc(1019,552-sm,4+sm*0.4,0,6.283); g.fill(); g.font='700 7px system-ui'; g.fillStyle='#fde047'; g.fillText('Groupe électrogène',1004,612); } }   /* coupure : pénombre, panneaux de sortie de secours, groupe électrogène qui fume */
  if(TM.heat){ const G2={}; for(const z of pts){ if(z[2].staff) continue; const k=Math.floor(z[0]/40)+','+Math.floor(z[1]/40); G2[k]=(G2[k]||0)+1; }
    for(const [k,v] of Object.entries(G2)){ const [cx,cy]=k.split(',').map(Number), a=Math.min(0.75,v/25); g.fillStyle=v>18?`rgba(239,68,68,${a})`:v>8?`rgba(249,115,22,${a})`:`rgba(250,204,21,${a*0.8})`; g.fillRect(cx*40,cy*40,40,40); } }
  if(TM.dash&&(!TM.dashAt||performance.now()-TM.dashAt>1500)){ TM.dashAt=performance.now(); tmDash(); }
  if(TM.sel){ const hit=pts.find(z=>z[2]===TM.sel); if(hit&&TM.sel.K){ const K=TM.sel.K; g.lineWidth=1.6/s+0.6; g.strokeStyle='rgba(100,116,139,.7)'; g.setLineDash([]); g.beginPath(); let started=false; for(const k of K){ if(k.t>now) break; started?g.lineTo(k.x,k.y):g.moveTo(k.x,k.y); started=true; } g.lineTo(hit[0],hit[1]); g.stroke(); g.strokeStyle='rgba(239,68,68,.85)'; g.setLineDash([5/s+2,4/s+2]); g.beginPath(); g.moveTo(hit[0],hit[1]); for(const k of K) if(k.t>now) g.lineTo(k.x,k.y); g.stroke(); g.setLineDash([]); }
    if(hit){ g.strokeStyle='#ef4444'; g.lineWidth=2/s; g.beginPath(); g.arc(hit[0],hit[1],10/s+4,0,6.283); g.stroke(); const q=hit[3], p=hit[2];
      if(!TM.selAt||performance.now()-TM.selAt>700){ TM.selAt=performance.now(); const sc=p.dep&&TM.L.deps.find(d=>d.f===p.f), zz=sc&&sc.sched[p.i];
        if(p.crew){ tmInfo(`<b>👨‍✈️ ${esc(p.crew)}</b> · ${esc(tmAirline(p.f).name)} · vol ${esc(p.f.fn)}<br>${p.dep===4&&p.f.D?esc(p.f.D.A.city)+' → '+esc(p.f.D.B.city):''}<br>En ce moment : <b>${esc(q.st)}</b>${tmThought(p,q)}`); } else if(p.staff==='assist'){ tmInfo(`<b>♿ Agent d’assistance</b><br>En ce moment : <b>${esc(q.st)}</b>${tmThought(p,q)}`); } else if(p.staff){ tmInfo(`<b>${p.staff==='clean'?'🧹':p.staff==='sec'?'🛡️':p.staff==='cus'?'🛃':p.staff==='pol'||p.staff==='imm'||p.staff==='patrol'?'👮':p.staff==='health'?'🩺':'🧑‍💼'} ${TM_ROLE[p.staff][1]}</b><br>En ce moment : <b>${esc(q.st)}</b>${tmThought(p,q)}`); } else if(p.greet){ tmInfo(`<b>🤗 Accueille un passager</b><br>Vol ${esc(p.f.fn)} de ${esc(p.f.D.A.city)}<br>En ce moment : <b>${esc(q.st)}</b>${tmThought(p,q)}`); } else if(p.row){ const w=p.row, cl={f:'👑 Première',j:'💼 Affaires',w:'💺 Premium',y:'💺 Économique'}[w.cls]||'';
          tmInfo(`<div style="display:flex;gap:8px;align-items:center"><div style="font-size:30px">${w.avatar||'🧍'}</div><div><b>${esc(w.first)} ${esc(w.last)}</b> · ${w.age} ans ${COUNTRIES[w.nat]?COUNTRIES[w.nat][2]:''}<br><span class="small">${esc(w.job)}</span></div></div>`+
            `✈️ <b>${esc(tmAirline(p.f).name)}</b> · vol <b>${esc(p.f.fn)}</b>${p.f.reg?' · '+esc(p.f.reg):''} · ${p.dep?esc(p.f.D.A.city)+' → '+esc(p.f.D.B.city):'arrivé de '+esc(p.f.D.A.city)}<br>Siège <b>${esc(w.seat)}</b> · ${cl}${zz?` · embarquement ${zz.zone===0?'prioritaire':'zone '+zz.zone}`:''}<br>🧳 ${w.bags?w.bags+' bagage'+(w.bags>1?'s':'')+' en soute':'bagage cabine seulement'}${w.assist?' · ♿ '+esc(w.assist):''}<br><span class="small mut">${esc(w.story||'')}</span><br>En ce moment : <b>${esc(q.st)}</b>${tmThought(p,q)}`+
            (p.f.acId&&(p.f.riv||(p.f.l&&p.f.l===((S.fleet.find(a=>a.id===p.f.acId)||{}).flight||{legs:[]}).legs[(S.fleet.find(a=>a.id===p.f.acId)||{flight:{li:0}}).flight.li]))?`<br><button class="btn" data-tmcard="${esc(p.f.acId)}|${p.i}" style="margin-top:6px">🪪 Fiche complète</button>`:'')); const bt=document.querySelector('[data-tmcard]'); if(bt) bt.onclick=()=>{ const [id,ii]=bt.dataset.tmcard.split('|'); tmClose(); try{ ACTIONS.paxCard({id,i:ii}); }catch(e){} }; }
        else tmInfo(`<b>🧍 Passager${p.kid?' (enfant)':''}</b><br>✈️ <b>${esc(tmAirline(p.f).name)}</b> · vol ${esc(p.f.fn)} · ${p.dep?esc(p.f.D.A.city)+' → '+esc(p.f.D.B.city):'arrivé de '+esc(p.f.D.A.city)}${zz?` · embarquement ${zz.zone===0?'prioritaire':'zone '+zz.zone}`:''}<br>${p.bag||p.hasBag?'🧳 bagage en soute':'🎒 bagage cabine seulement'}<br>En ce moment : <b>${esc(q.st)}</b>${tmThought(p,q)}`); } } else { TM.sel=null; tmInfo(''); } }
  if(TM.sel&&TM.selAt&&performance.now()-TM.selAt<30&&!TM.sel.staff) tmAfterSel(TM.sel,now);
  tmAnnounce(now);
  const hd=document.getElementById('tmCount'); if(hd&&(!TM.cAt||performance.now()-TM.cAt>800)){ TM.cAt=performance.now(); const W=L.W||{};
    hd.innerHTML=tmClockHtml(now)+`${document.getElementById('tmPanel')&&document.getElementById('tmPanel').hidden?'📋':'✖'} 👥 ${n.toLocaleString('fr-FR')} personnes · ${nd} départ · ${na} arrivée<br><span style="color:#cbd5e1;font-weight:500">🎫 ${cnt.ck} en file (~${tmWait(W.ck||[],now)} min) · 🔍 ${cnt.sec} (~${tmWait(W.sec||[],now)} min) · 🛂 ${cnt.pol} (~${tmWait(W.pol||[],now)} min) · 🚪 ${cnt.board} · 🛂 arrivées ${cnt.imm} · 🧳 ${cnt.belt} au tapis · 🤗 ${cnt.greet||0} accueillent · 👮 ${cnt.staff||0} agents · 👨‍✈️ ${cnt.crew||0} équipage</span>`; if(Math.random()<0.15) tmBoard(); }
}
function tmOpen(code){
  code=code||tmNearest(); if(!code||typeof pfData!=='function') return; TM.code=code; TM.th=null; TM.open=true; TM.sel=null; TM.selF=null; TM.built=0; TM.cam=null; TM.goal=null; TM.moved=0; TM.dprMax=Math.min(2,window.devicePixelRatio||1); TM.dpr=('ontouchstart' in window)&&TM.dprMax>1.5?1.5:TM.dprMax; TM.dprHi=0; TM.dprAt=performance.now(); TM.job=null; TM.fa=33;
  let ov=document.getElementById('tmOv'); if(ov) ov.remove();
  ov=document.createElement('div'); ov.id='tmOv'; const A=AP(code);
  ov.innerHTML=`<style>#tmOv{position:fixed;inset:0;z-index:2000;background:#0b1220;color:#e2e8f0;overflow:hidden}
#tmCv{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
#tmTop{position:absolute;left:6px;right:6px;top:calc(6px + env(safe-area-inset-top));display:flex;align-items:center;gap:4px;z-index:3}
#tmTop b{flex:1;font:700 13px system-ui;background:rgba(8,14,26,.82);border-radius:10px;padding:7px 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#tmTop button{flex:0 0 auto}#tmTop button,#tmZones button{background:rgba(8,14,26,.82);color:#fff;border:1px solid rgba(148,163,184,.35);border-radius:10px;font:600 13px system-ui;padding:6px 8px;min-width:34px}
#tmTop button.on{border-color:#facc15;color:#facc15}
#tmZones{position:absolute;left:6px;right:6px;bottom:calc(6px + env(safe-area-inset-bottom));display:flex;gap:5px;overflow-x:auto;z-index:3;-webkit-overflow-scrolling:touch}#tmZones button{flex:0 0 auto;white-space:nowrap;font-size:12px;padding:6px 9px;border-radius:14px}
#tmCount{position:absolute;left:6px;right:6px;top:calc(48px + env(safe-area-inset-top));z-index:3;background:rgba(8,14,26,.78);border-radius:10px;padding:4px 8px;font:600 11px system-ui;color:#93c5fd;cursor:pointer}
#tmPanel{position:absolute;left:6px;right:6px;top:calc(96px + env(safe-area-inset-top));z-index:4;max-height:46vh;overflow:auto;background:rgba(8,14,26,.94);border:1px solid rgba(148,163,184,.35);border-radius:12px;padding:6px 8px}
#tmBoard{font:12px system-ui}#tmBoard table{width:100%;border-collapse:collapse;margin-bottom:4px}#tmBoard th{text-align:left;color:#facc15;font-weight:600;font-size:11px}
#tmBoard tr[data-tmf]{cursor:pointer}#tmBoard td{padding:2px 4px;border-top:1px solid rgba(148,163,184,.15);font-family:ui-monospace,monospace;font-size:11px}#tmBoard td i{display:inline-block;width:9px;height:9px;border-radius:2px}
#tmSearch{position:relative;margin-bottom:6px}#tmSearch input{width:100%;box-sizing:border-box;padding:7px 10px;border-radius:10px;border:1px solid rgba(148,163,184,.35);background:#111827;color:#fff;font:13px system-ui}
#tmRes{background:#0f172a;border:1px solid rgba(148,163,184,.35);border-radius:10px;max-height:34vh;overflow:auto;margin-top:4px}#tmRes button{display:block;width:100%;text-align:left;padding:7px 10px;font:12px system-ui;border-radius:0}
#tmAnn{position:absolute;left:8px;right:8px;top:calc(96px + env(safe-area-inset-top));z-index:3;background:rgba(250,204,21,.95);color:#111827;border-radius:10px;padding:6px 10px;font:600 12px system-ui;box-shadow:0 2px 8px rgba(0,0,0,.4)}
#tmInfo{position:absolute;left:8px;right:8px;bottom:calc(52px + env(safe-area-inset-bottom));z-index:4;background:rgba(8,14,26,.94);border:1px solid rgba(148,163,184,.35);border-radius:12px;padding:8px 10px;font:13px system-ui;max-height:42%;overflow:auto}</style>
<canvas id="tmCv"></canvas>
<div id="tmTop"><b>🏢 ${esc(A.city)} <span style="color:#94a3b8">${esc(code)}</span></b><button data-tpan title="Vols et recherche">📋</button><button data-tdash title="Gestion">📊</button><button data-tsp>⏱️</button><button data-tvo>🔈</button><button data-tz="-">➖</button><button data-tz="+">➕</button><button data-tm="x">✖</button></div>
<div id="tmCount" title="Toucher pour voir les vols"></div>
<div id="tmPanel" hidden><div id="tmSearch"><input type="search" placeholder="🔎 Chercher un passager : nom, vol, siège…" data-tms><div id="tmRes" hidden></div></div><div id="tmBoard"></div></div>
<div id="tmAnn" hidden></div><div id="tmInfo" hidden></div>
<div id="tmZones">${TM_ZONES.map((z,i)=>`<button data-tzn="${i}">${z[0]}</button>`).join('')}</div>`;
  document.body.appendChild(ov); TM.cv=ov.querySelector('#tmCv');
  ov.querySelector('[data-tm="x"]').onclick=tmClose;
  { const cnt=ov.querySelector('#tmCount'), pan=ov.querySelector('#tmPanel'), pb=ov.querySelector('[data-tpan]'); const tg=()=>{ pan.hidden=!pan.hidden; pb.classList.toggle('on',!pan.hidden); }; cnt.onclick=tg; pb.onclick=tg; }
  ov.querySelector('[data-tdash]').onclick=()=>{ TM.dash=!TM.dash; TM.sel=null; TM.follow=null; TM.dashAt=0; if(!TM.dash) tmInfo(''); };
  // vitesse du temps (celle du jeu) et voix des annonces
  const SP=[['realiste','×1'],['x5','×5'],['standard','×60']], spB=ov.querySelector('[data-tsp]'), lab=()=>{ const x=SP.find(z=>z[0]===S.speed), m=typeof SPEEDS!=='undefined'&&SPEEDS[S.speed]; spB.textContent='⏱️ '+(x?x[1]:m?'×'+m.mult:'×?'); }; lab();   /* trois vitesses dans l'aérogare : ×1, ×5, ×60 */
  spB.onclick=()=>{ const i=SP.findIndex(z=>z[0]===S.speed); S.speed=SP[(i+1)%SP.length][0]; S.paused=false; lab(); try{ renderTop(); }catch(e){} };
  TM.voice=!!(typeof FX!=='undefined'&&FX.soundOn); const voB=ov.querySelector('[data-tvo]'); voB.textContent=TM.voice?'🔈':'🔇'; voB.onclick=()=>{ TM.voice=!TM.voice; voB.textContent=TM.voice?'🔈':'🔇'; if(typeof fxAudioUnlock==='function') fxAudioUnlock(); };
  // recherche d'un passager
  const si=ov.querySelector('[data-tms]'), res=ov.querySelector('#tmRes');
  si.oninput=()=>{ const q=si.value.trim().toLocaleLowerCase('fr'); if(q.length<2){ res.hidden=true; return; } const now=tmNow(), out=[];
    for(const p of TM.ppl||[]){ if(!p.row) continue; const w=p.row; if((w.first+' '+w.last+' '+p.f.fn+' '+w.seat).toLocaleLowerCase('fr').includes(q)){ out.push(p); if(out.length>=60) break; } }
    out.sort((a,b)=>(tmAt(b.K,now)?1:0)-(tmAt(a.K,now)?1:0)); out.length=Math.min(out.length,10);
    res.innerHTML=out.length?out.map((p,k)=>{ const qq=tmAt(p.K,now); return `<button class="btn" data-k="${k}">${p.row.avatar||'🧍'} <b>${esc(p.row.first)} ${esc(p.row.last)}</b> · ${esc(p.f.fn)} · ${esc(p.row.seat)} — <span style="color:${qq?'#86efac':'#94a3b8'}">${qq?esc(qq.st):now<p.K[0].t?'pas encore à l’aéroport':'a quitté l’aérogare'}</span></button>`; }).join(''):'<div class="small" style="padding:8px">Aucune personne trouvée.</div>';
    res.hidden=false; res.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{ const p=out[+b.dataset.k]; res.hidden=true; si.blur(); if(tmAt(p.K,tmNow())){ TM.sel=p; TM.selAt=0; TM.follow=p; TM.moved=1; } else tmInfo(`<b>${esc(p.row.first)} ${esc(p.row.last)}</b> n’est pas dans l’aérogare en ce moment (vol ${esc(p.f.fn)}).`); }); };
  ov.querySelectorAll('[data-tzn]').forEach(b=>b.onclick=()=>(TM.moved=1)&&tmFocus(tmZoneRect(+b.dataset.tzn)));
  ov.querySelectorAll('[data-tz]').forEach(b=>b.onclick=()=>{ if(TM.cam) tmZoomAt(b.dataset.tz==='+'?1.5:1/1.5,TM.cv.clientWidth/2,TM.cv.clientHeight/2); });
  // doigts : déplacer (1 doigt), pincer pour zoomer (2 doigts), toucher pour sélectionner ; molette sur ordinateur
  const P=new Map(); let moved=0, pinch=null;
  TM.cv.addEventListener('pointerdown',e=>{ TM.moved=1; TM.follow=null; TM.cv.setPointerCapture(e.pointerId); P.set(e.pointerId,{x:e.clientX,y:e.clientY}); moved=0; TM.goal=null; if(P.size===2){ const [a,b]=[...P.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y)}; } });
  TM.cv.addEventListener('pointermove',e=>{ const o=P.get(e.pointerId); if(!o||!TM.cam) return; const r=TM.cv.getBoundingClientRect();
    if(P.size>=2&&pinch){ P.set(e.pointerId,{x:e.clientX,y:e.clientY}); const [a,b]=[...P.values()], d=Math.hypot(a.x-b.x,a.y-b.y); if(pinch.d>10) tmZoomAt(d/pinch.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top); pinch.d=d; moved=99; return; }
    const dx=e.clientX-o.x, dy=e.clientY-o.y; moved+=Math.abs(dx)+Math.abs(dy); TM.cam.x-=dx/TM.cam.s; TM.cam.y-=dy/TM.cam.s; P.set(e.pointerId,{x:e.clientX,y:e.clientY}); });
  const up=e=>{ const had=P.has(e.pointerId); P.delete(e.pointerId); if(P.size<2) pinch=null; if(!had||moved>8||!TM.cam) return;
    const r=TM.cv.getBoundingClientRect(), wx=tmFx(TM.cam.x+(e.clientX-r.left)/TM.cam.s), wy=tmFy(TM.cam.y+(e.clientY-r.top)/TM.cam.s); let best=null, bd=(16/TM.cam.s)**2;
    for(const z of TM.pts||[]){ const d=(z[0]-wx)**2+(z[1]-wy)**2; if(d<bd){ bd=d; best=z[2]; } }
    if(best){ TM.sel=best; TM.selAt=0; TM.dash=false; return; } TM.sel=null; if(TM.dash) return;
    const g=(TM.L.deps.find(d=>(wx>=d.lounge.x0&&wx<=d.lounge.x1&&wy>=d.lounge.y0&&wy<=d.lounge.y1)||Math.hypot(wx-d.stand.x,wy-d.stand.y)<60))||(TM.L.arrs.find(a=>wx>=a.x0&&wx<=a.x1&&wy>=-130&&wy<=60));
    if(g){ TM.selF=g.f; tmInfoFlight(g); return; }
    const p=TM.L.poi.find(p=>wx>=p.x0&&wx<=p.x1&&wy>=p.y0&&wy<=p.y1); if(p){ tmInfoPOI(p); return; } TM.selF=null; tmInfo(''); };
  TM.cv.addEventListener('pointerup',up); TM.cv.addEventListener('pointercancel',e=>{ P.delete(e.pointerId); pinch=null; });
  TM.cv.addEventListener('wheel',e=>{ e.preventDefault(); const r=TM.cv.getBoundingClientRect(); if(TM.cam) tmZoomAt(e.deltaY<0?1.15:1/1.15,e.clientX-r.left,e.clientY-r.top); },{passive:false});
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
      h.setInputAction(e=>{ try{ const p=G.viewer.scene.pick(e.position), c=p&&p.id&&p.id._term; if(c) tmOpen(c); const rv=p&&p.id&&p.id._rv; if(rv&&typeof rivFlightAt==='function'){ const fl=rivFlightAt(rv.R,rv.r,rv.i,S.time); if(fl) toast(`✈️ <b>${esc(fl.fn)}</b> ${esc(rv.R.name||'')} · ${esc(fl.ac.reg)}${fl.ac.modelName?' · '+esc(fl.ac.modelName):''}<br>${esc(AP(fl.from).city)} → ${esc(AP(fl.to).city)} · ${fl.N} passagers <button class="btn" data-act="manifest" data-id="${esc(fl.ac.id)}">📋 Manifeste</button>`,'info'); } const x=p&&p.id&&p.id._pax; if(x) toast(`🧍 <b>${esc(x.name)}</b>, ${x.age} ans ${COUNTRIES[x.nat]?COUNTRIES[x.nat][2]:''} · vol ${esc(x.fn)} · siège <b>${esc(x.seat)}</b> <button class="btn" data-act="paxCard" data-id="${esc(x.acId)}" data-i="${x.i}">🪪 Fiche</button>`,'info'); }catch(x){} }, C.ScreenSpaceEventType.LEFT_CLICK); }catch(e){} }
}
if(typeof window!=='undefined') window.addEventListener('load',()=>{
  // chaque atterrissage est mémorisé (avion, vol, heure) pour remplir l'aérogare d'arrivée
  if(typeof onFlightDone==='function'){ const _o=onFlightDone; onFlightDone=function(ac,leg){ try{ if(ac&&leg&&leg.pax){ let t=S.time; try{ t=Math.min(S.time,leg.dep+legProf(leg,modelOf(ac)).total); }catch(e){} const R=(S.tmRecent=(S.tmRecent||[]).filter(x=>S.time-x.t<3*HOUR)); R.push({acId:ac.id,reg:ac.reg,model:modelOf(ac).name,fn:S.company.code+(typeof flightNumber==='function'?flightNumber(ac):''),leg:{from:leg.from,to:leg.to,dep:leg.dep,pax:{...leg.pax},dist:leg.dist},t}); if(R.length>150) R.splice(0,R.length-150); } }catch(e){} return _o.apply(this,arguments); }; }
  setInterval(()=>{ try{ tmTick(); }catch(e){} },1000);
  try{ Object.assign(ACTIONS,{termOpen:d=>{ try{ closeModal(); }catch(e){} tmOpen(d&&d.code); }}); }catch(e){}
  // accès sans la 3D : fiche de chaque aéroport (carte 2D) et carte « Aérogare en direct » (onglet passagers)
  const btn=c=>`<button class="btn" data-act="termOpen" data-code="${esc(c)}" style="margin:4px 0">🏢 Voir l’intérieur de l’aérogare</button>`;
  if(typeof airportHtml==='function'){ const _a=airportHtml; airportHtml=function(code){ const h=_a.apply(this,arguments); try{ return btn(code)+h; }catch(e){ return h; } }; }
  if(typeof pfCardHtml==='function'){ const _p=pfCardHtml; pfCardHtml=function(){ const h=_p.apply(this,arguments);
      try{ const hubs=[...new Set([S.company.hub,...(S.hubs||[])])].filter(Boolean).slice(0,6);
        const sn=typeof tmStarNext==='function'?tmStarNext():null, snH=sn&&sn.length?`<div class="small" style="margin-top:6px">⭐ <b>Merveil Hakeem Dianzenza</b> : ${sn.map(f=>`${esc(f.fn)} ${esc(AP(f.from).city)} → ${esc(AP(f.to).city)} le ${esc(typeof fmtTime==='function'?fmtTime(f.P):tmHM(f.P))}`).join(' · ')}</div>`:'';
        return `<div class="card"><b>🏢 Intérieur des aérogares</b> <span class="small mut">— la foule en direct, sans passer par la 3D</span><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${hubs.map(c=>`<button class="btn" data-act="termOpen" data-code="${esc(c)}">🏢 ${esc(AP(c).city)}</button>`).join('')}</div>${snH}</div>`+h; }catch(e){ return h; } }; }
});

// ⭐ Passager vedette : Merveil Hakeem Dianzenza, écrivain renommé, voyage sur chaque vol Air France Paris ⇄ Kinshasa.
// Une seule identité : 25 ans au début (il vieillit d'un an à chaque nouvelle année du jeu), même siège, même passeport, même profil sur tous les vols.
// son vrai programme : Paris → Kinshasa (1er vol Air France du jour), séjour de 10 jours, retour à Paris, et il revient 30 jours après le départ
const TM_STAR_CYCLE=30, TM_STAR_STAY=10;
// voyages demandés en plus du programme : premier vol Air France de la journée après l'heure indiquée (heure locale du départ)
const TM_STAR_TRIPS=[{y:2026,m:9,d:11,from:'FIH',to:'CDG',after:8}];   /* dimanche 11 octobre 2026 : Kinshasa → Paris */
let _stx={k:null,ids:[]};
function tmStarExtra(){ try{ const [R,r]=tmStarRoute(), K=rivalSched(r); if(!K) return []; if(_stx.k===r) return _stx.ids; const ids=[];
    for(const T of TM_STAR_TRIPS){ const mid=Date.UTC(T.y,T.m,T.d,12), tz=typeof tzAt==='function'?tzAt(T.from,mid):1, d0=Date.UTC(T.y,T.m,T.d)-tz*HOUR+T.after*HOUR, d1=Date.UTC(T.y,T.m,T.d)-tz*HOUR+DAY, dir=r.a===T.from?'AB':'BA'; if(r.a!==T.from&&r.b!==T.from) continue; let best=null;
      for(let i=0;i<K.nP;i++){ const c0=Math.floor((d0-K.anchors[i])/K.P)-1; for(let c=c0;c<c0+4;c++){ const f=rivFlight(R,r,i,dir,c); if(f&&f.ops!==false&&f.P>=d0&&f.P<d1&&(!best||f.P<best.P)) best=f; } } if(best) ids.push(best.ac.id); }
    _stx={k:r,ids}; return ids; }catch(e){ return []; } }
function tmStarOn(ac){ if(ac&&tmStarExtra().includes(ac.id)) return true; const m=/^RAF(?:CDGFIH|FIHCDG)(\d+)(AB|BA)(-?\d+)$/.exec(ac&&ac.id||''); if(!m||m[1]!=='0') return false; const c=((+m[3]%TM_STAR_CYCLE)+TM_STAR_CYCLE)%TM_STAR_CYCLE, toFIH=(m[2]==='AB')===/^RAFCDGFIH/.test(ac.id);
  return toFIH?c===0:c===TM_STAR_STAY; }
function tmStarRoute(){ const R0=(S.rivals||[]).find(x=>x.code==='AF'), r0=R0&&(R0.routes||[]).find(x=>(x.a==='CDG'&&x.b==='FIH')||(x.a==='FIH'&&x.b==='CDG')); return r0?[R0,r0]:[ghostAirline('AF'),ghostRouteOf('AF','FIH','CDG')]; }
function tmStarNext(){ try{ const [R,r]=tmStarRoute(), K=rivalSched(r); if(!K) return null; const now=S.time, c0=Math.floor((now-K.anchors[0])/K.P)-1, out=[];
    for(let c=c0;c<c0+TM_STAR_CYCLE+2&&out.length<2;c++){ const cc=((c%TM_STAR_CYCLE)+TM_STAR_CYCLE)%TM_STAR_CYCLE; for(const dir of ['AB','BA']){ const f=rivFlight(R,r,0,dir,c); if(!f||!tmStarOn(f.ac)) continue; if(f.arr+90*MIN<now) continue; out.push(f); } }
    for(const id of tmStarExtra()){ const m=/(\d+)(AB|BA)(-?\d+)$/.exec(id); if(!m) continue; const f=rivFlight(R,r,+m[1],m[2],+m[3]); if(f&&f.arr+90*MIN>=now&&!out.some(x=>x.ac.id===id)) out.push(f); }   /* voyages demandés */
    return out.sort((a,b)=>a.P-b.P).slice(0,3); }catch(e){ return null; } }
function tmStarId(leg){ const yr=new Date(S.time).getUTCFullYear(); if(!S.starBY) S.starBY=yr-25; const age=yr-S.starBY, nr='non renseigné', toP=leg.to==='CDG';
  return {star:true,first:'Merveil Hakeem',last:'Dianzenza ⭐',name:'Merveil Hakeem Dianzenza ⭐',F:false,age,nat:'CD',passportCC:'CD',home:'Kinshasa',born:'Kinshasa',dob:'1er janvier '+S.starBY,avatar:'👨🏾',
    job:'écrivain renommé',purp:'business',wealth:'rich',cls:'j',seat:'2A',bags:1,bag:18,meal:'Repas standard',assist:'',tier:'Platinum',miles:186400,langs:'français, lingala, anglais',marital:nr,mood:'ravi(e)',moodWhy:'',
    story:toP?'Rencontres littéraires et séances de dédicaces à Paris pour son nouveau roman.':'Retour à Kinshasa après une tournée littéraire à Paris.',
    visa:toP?'Visa Schengen valide (passeport talent)':'Pas de visa requis (Congolais)',phone:nr,mail:nr,emerg:nr,health:nr,social:nr,passNo:'CD'+String(hashStr('MHD'+S.starBY)%10000000).padStart(7,'0'),passExp:S.starBY+35,
    allergy:'',pet:'',fear:'',hobbies:['écriture','lecture'],income:0,kids:0,anecdote:'signe des autographes en attendant son vol',music:nr,food:nr,seatmate:nr,study:'lettres',with_:'seul',conn:'',ent:'relit le manuscrit de son prochain livre'}; }
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ if(typeof manifestFor!=='function'||manifestFor._star) return; const _m=manifestFor;
  manifestFor=function(ac,leg){ const out=_m.apply(this,arguments); try{ if(out&&out.rows&&out.rows.length>6&&leg&&tmStarOn(ac)){
      Object.assign(out.rows[5],tmStarId(leg)); } }catch(e){} return out; };
  manifestFor._star=true; }catch(e){ console.warn('passager vedette',e); } },30));
