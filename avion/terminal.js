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
  let D=null; try{ D=pfData(a,l); }catch(e){} TM.cache[k]={D,at:performance.now()}; return D; }
// vols de vos avions qui passent par cet aéroport en ce moment
function tmFlights(code){
  const now=tmNow(), deps=[], arrs=[];
  for(const a of S.fleet){ const fl=a.flight; if(!fl||!fl.legs) continue;
    fl.legs.forEach((l,i)=>{ if(i<fl.li) return; if(l.from!==code&&l.to!==code) return; const D=tmD(a,l); if(!D) return;
      const N=D.total||Math.round((modelOf(a).seats||150)*0.8), fn=S.company.code+(typeof flightNumber==='function'?flightNumber(a):'');
      const man=()=>{ try{ return typeof manifestFor==='function'?manifestFor(a,l):null; }catch(e){ return null; } }, info={reg:a.reg,model:modelOf(a).name,acId:a.id};
      if(l.from===code&&now>=D.ci.open-5*MIN&&now<=D.P+3*MIN) deps.push({a,l,D,N,fn,man:man(),...info});
      if(l.to===code&&i===fl.li&&now>=D.arr-25*MIN&&now<D.arr) arrs.push({a,l,D,N,fn,soon:true,...info}); }); }
  // vols déjà posés : leurs passagers sont encore dans l'aérogare (immigration, bagages, douane)
  try{ for(const x of (typeof pfArrivals==='function'?pfArrivals():[])){ const D=x.D; if(!D||!D.B||D.B.code!==code) continue; if(now>D.cus.close+15*MIN) continue;
      let man=null; try{ if(x.leg&&typeof manifestFor==='function') man=manifestFor({id:x.acId},x.leg); }catch(e){}
      arrs.push({a:{id:D.key},l:null,D,N:D.total||0,fn:x.fno||x.fn||'',soon:false,man,reg:x.reg,model:x.model,acId:x.acId}); } }catch(e){}
  const F={deps,arrs,cancel:[]}; try{ tmRivals(code,now,F); }catch(e){}
  try{ for(const a of S.fleet) if(a.loc===code&&a.status!=='flight'&&a.blocked&&/grève|annul/i.test(a.blocked)) F.cancel.push({fn:S.company.code+(typeof flightNumber==='function'?flightNumber(a):''),dest:a.reg||'',why:a.blocked}); }catch(e){}
  try{ const w=typeof towerWx==='function'?towerWx(code):null; if(w&&w.st) for(const f of F.deps) if(f.riv){ const dl=25+hashStr(f.D.key)%50; f.dl=dl; f.dlw='orage'; for(const k of ['P']) f.D[k]+=dl*MIN; f.D.gate.open+=dl*MIN; f.D.gate.last+=dl*MIN; f.D.gate.close+=dl*MIN; } }catch(e){}
  F.deps.sort((x,y)=>x.D.P-y.D.P); F.deps=F.deps.slice(0,10); F.arrs=F.arrs.slice(0,5); return F;
}
// vols des autres compagnies : horaires réels du jeu (rivalSched), passagers estimés selon l'avion
function tmFakeD(key,A,B,P,arr,N){ const intl=A.cc!==B.cc, h=hashStr(key);
  return {key,A,B,intl,P,arr,total:N,ci:{open:P-(intl?180:120)*MIN,close:P-(intl?60:40)*MIN,online:Math.round(N*0.3)},sec:{close:P-25*MIN},pol:{close:P-20*MIN},
    gate:{name:String.fromCharCode(66+h%5)+(1+h%28),open:P-40*MIN,last:P-14*MIN,close:P-6*MIN,noShow:h%3},
    imm:{open:arr+6*MIN,close:arr+(N>200?55:40)*MIN},bag:{first:arr+(14+h%6)*MIN,last:arr+(30+h%14)*MIN},cus:{close:arr+70*MIN}}; }
function tmFakeMan(D,N,m){ try{ const j=Math.round(N*0.08); return manifestFor({id:'R'+D.key},{from:D.A.code,to:D.B.code,dep:D.P,pax:{f:0,j,w:0,y:N-j}}); }catch(e){ return null; } }
function tmRivals(code,now,F){
  if(typeof rivFlight!=='function') return; const A0=AP(code); let nd=0, na=0;
  for(const R of S.rivals||[]) for(const r of R.routes||[]){ if(nd>=6&&na>=3) return; if(r.a!==code&&r.b!==code) continue; const K=rivalSched(r); if(!K) continue; const fromA=r.a===code;
    for(let i=0;i<K.nP;i++) for(const kind of ['d','a']){ const dir=kind==='d'?(fromA?'AB':'BA'):(fromA?'BA':'AB'), x0=rivFlight(R,r,i,dir,0); if(!x0) continue;
      const ref=kind==='d'?x0.P:x0.arr, c0=Math.floor((now+(kind==='d'?180*MIN:0)-ref)/K.P);
      for(const cyc of [c0,c0-1]){ const fl=rivFlight(R,r,i,dir,cyc); if(!fl) continue; const other=AP(kind==='d'?fl.to:fl.from); if(!other) continue;
        if(kind==='d'&&nd<6&&now>=fl.P-185*MIN&&now<=fl.P+3*MIN){ const D=tmFakeD(fl.key,A0,other,fl.P,fl.arr,fl.N); F.deps.push({a:{id:fl.ac.id},l:null,D,N:fl.N,fn:fl.fn,riv:R,man:fl.man,model:fl.ac.modelName,reg:fl.ac.reg,acId:fl.ac.id}); nd++; }
        if(kind==='a'&&na<3&&now>=fl.arr-20*MIN&&now<=fl.arr+70*MIN){ const D=tmFakeD(fl.key,other,A0,fl.P,fl.arr,fl.N); F.arrs.push({a:{id:fl.ac.id},l:null,D,N:fl.N,fn:fl.fn,riv:R,man:fl.man,model:fl.ac.modelName,reg:fl.ac.reg,acId:fl.ac.id,soon:now<fl.arr}); na++; } } } }
}
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
function tmTheme(code){ const A=AP(code)||{}, reg0=(COUNTRIES[A.cc]&&COUNTRIES[A.cc][1])||'EU', me=['MA','DZ','TN','EG','AE','SA','QA','OM','KW','BH','JO','LB','TR','IR','IQ','LY'].includes(A.cc), reg=me?'ME':reg0==='SA'?'NA':reg0==='OC'?'EU':reg0, h=hashStr(code||'X');
  const P={AF:{floor:['#efe4cc','#eadcc0','#f1e7d3'],acc:['#0e7490','#b45309','#15803d'],pat:['terrazzo','checker','grid'],deco:['palmiers','fontaine','fresque']},
    EU:{floor:['#eceff3','#e9e7e2','#eef0f2'],acc:['#1d4ed8','#0f172a','#7c3aed'],pat:['grid','diag','grid'],deco:['oeuvre','ecran','jardin']},
    NA:{floor:['#eef2f7','#e7ebef','#f0ede8'],acc:['#1e40af','#b91c1c','#0369a1'],pat:['grid','checker','diag'],deco:['ecran','oeuvre','fontaine']},
    ME:{floor:['#f3eadb','#f1e6d0','#efe3cc'],acc:['#b45309','#065f46','#9a3412'],pat:['marbre','marbre','checker'],deco:['fontaine','palmiers','oeuvre']},
    AS:{floor:['#eef2f1','#f0ece4','#e9eef0'],acc:['#dc2626','#047857','#4338ca'],pat:['bois','grid','bois'],deco:['jardin','oeuvre','ecran']}}[reg]||null;
  const T=P||{floor:['#e7e5e4'],acc:['#334155'],pat:['grid'],deco:['oeuvre']}, k=n=>T[n][h%T[n].length];
  return {reg,floor:k('floor'),acc:k('acc'),pat:T.pat[(h>>3)%T.pat.length],deco:T.deco[(h>>5)%T.deco.length],tile:[18,24,30][(h>>7)%3],carpet:['#7c2d12','#1e3a8a','#14532d','#581c87','#9f1239'][(h>>9)%5],mx:(h>>13)&1,my:(h>>14)&1,shape:(()=>{ const c=A.cls||2, L=c<=2?['lineaire']:c>=4?['jetee','satellite','L','jetee','lineaire']:['lineaire','L','jetee']; return L[(h>>19)%L.length]; })(),facade:['droite','courbe','dents'][(h>>15)%3],seat:['rangees','ilots'][(h>>17)%2],canopy:['plat','ondule','arcs'][(h>>18)%3],shops:TM_SHOPS[reg]||TM_SHOPS.EU,swap:(h>>11)%3,name:A.name||('Aéroport de '+(A.city||code)),city:A.city||code,flag:(COUNTRIES[A.cc]&&COUNTRIES[A.cc][2])||'🌍'}; }
const tmOps=code=>{ S.tmOps=S.tmOps||{}; return S.tmOps[code]||(S.tmOps[code]={sec:0,pol:0,ck:0}); };
function tmPOI(cls){ const ops=tmOps(TM.code); const P=[], add=(k,x0,y0,x1,y1,lab,ico,o)=>{ const p={k,x0,y0,x1,y1,lab,ico,...(o||{})}; P.push(p); return p; };
  const small=cls<=2, big=cls>=4, nK=small?4:10, nL=Math.min(8,(small?3:6)+ops.sec), nB=Math.min(8,(small?3:6)+ops.pol), nA=small?3:5;
  for(let i=0;i<nK;i++){ const x=40+i*(560/nK); add('kiosk',x,1176,x+32,1192,'Borne d’enregistrement automatique','🖥️'); }
  add('info',560,1200,630,1228,'Comptoir d’information','ℹ️'); add('wc',8,1196,60,1228,'Toilettes (hall public)','🚻'); add('cafe',70,1198,170,1228,'Café du hall','☕');
  add('fids',250,1196,350,1210,'Écran des départs','📺');
  for(let i=0;i<nL;i++){ const bw=640/nL, x=bw*i+(bw-80)/2; add('xray',x,846,x+60,862,'Scanner à bagages (rayons X) — ligne '+(i+1),'🧳',{lane:i}); add('arch',x+64,840,x+80,868,'Portique de détection — ligne '+(i+1),'🚪',{lane:i}); }
  for(let i=0;i<nB;i++){ const x=340+i*(300/nB); add('booth',x,736,x+34,756,'Guichet de police aux frontières '+(i+1),'🛂'); }
  { const TH=tmTheme(TM.code), L3=[[14,440,190,520],[310,440,470,540],[200,440,300,500]], o=[[0,1,2],[1,0,2],[2,1,0]][TH.swap], sl=k=>{ const x=TH.shops.find(z=>z[0]===k); return x?x[1]:k; }, sp=t=>[t.replace(/^\S+\s/,''),t.split(' ')[0]];
    if(!small){ const [l1,i1]=sp(sl('dutyfree')), [l2,i2]=sp(sl('resto')); add('dutyfree',...L3[o[0]],l1,i1); add('resto',...L3[o[1]],l2,i2); const [l4,i4]=sp(sl('pharma')); add('pharma',480,440,560,490,l4,i4); }
    const [l3,i3]=sp(sl('cafe')), [l5,i5]=sp(sl('press')); add('cafe',...(small?[200,440,300,500]:L3[o[2]]),l3,i3); add('press',570,440,630,490,l5,i5); }
  if(big){ add('lounge',480,500,630,590,'Salon business (accès réservé)','🛋️'); add('resto',14,530,190,590,'Restaurant rapide','🍔'); }
  add('wc',14,612,80,690,'Toilettes','🚻'); add('prayer',90,612,170,690,'Salle de prière','🕌'); add('wc',566,612,630,690,'Toilettes','🚻');
  add('seats',190,600,550,690,'Salle d’attente commune','💺'); add('fids',240,560,400,574,'Écran des départs','📺');
  // ARRIVÉES : contrôle sanitaire, immigration (nationaux / étrangers / sas), salle des bagages, douane, hall d'accueil
  add('health',680,250,800,266,'Contrôle sanitaire — carnet de vaccination fièvre jaune, caméra thermique','🩺',{arr:1});
  const nN=small?2:3, nF=small?2:3;
  for(let i=0;i<nN;i++){ const x=676+i*(130/nN); add('booth',x,300,x+30,318,'Guichet immigration — passeports nationaux '+(i+1),'🛂',{arr:1,nat:1}); }
  for(let i=0;i<nF;i++){ const x=820+i*(130/nF); add('booth',x,300,x+30,318,'Guichet immigration — passeports étrangers '+(i+1),'🛂',{arr:1,nat:0}); }
  if(!small) add('egate',880,256,950,276,'Sas automatiques (passeports biométriques)','🛂',{arr:1});
  add('trolley',668,800,720,840,'Chariots à bagages','🛒',{arr:1}); add('lost',900,800,995,840,'Litiges bagages (valises perdues ou abîmées)','📋',{arr:1});
  add('green',680,880,830,900,'Douane — couloir vert (rien à déclarer)','🟢',{arr:1}); add('red',850,880,990,900,'Douane — couloir rouge (à déclarer)','🔴',{arr:1});
  add('xrayc',900,912,950,928,'Scanner de la douane (bagages contrôlés)','🧳',{arr:1});
  add('change',668,1150,740,1190,'Bureau de change','💱',{arr:1}); add('cafe',750,1150,840,1190,'Café des arrivées','☕',{arr:1}); add('car',850,1150,920,1190,'Location de voitures','🚗',{arr:1});
  add('wc',930,1150,995,1190,'Toilettes (arrivées)','🚻',{arr:1}); add('info',668,1100,740,1130,'Accueil — informations, hôtels','ℹ️',{arr:1});
  add('taxi',680,1244,990,1272,'Station de taxis et bus','🚕',{arr:1});
  return {P,nL,nB,nA,small,big}; }
// file d'attente en serpentin dans un rectangle (entrée en bas → sortie en haut)
function tmSnake(x0,y0,x1,y1,rows){ const pts=[]; for(let r=0;r<rows;r++){ const y=y1-(r+0.5)*(y1-y0)/rows; if(r%2===0) pts.push({x:x0,y},{x:x1,y}); else pts.push({x:x1,y},{x:x0,y}); } return pts; }
function tmPath(pts){ let L=0; const seg=[]; for(let i=1;i<pts.length;i++){ const d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y); seg.push(d); L+=d; } return {pts,seg,L}; }
function tmPathAt(P,u){ let d=Math.max(0,Math.min(1,u))*P.L; for(let i=0;i<P.seg.length;i++){ if(d<=P.seg[i]){ const a=P.pts[i], b=P.pts[i+1], k=P.seg[i]?d/P.seg[i]:0; return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k}; } d-=P.seg[i]; } return P.pts[P.pts.length-1]; }
function tmLayout(F){
  const nd=Math.max(1,F.deps.length), na=Math.max(1,F.arrs.length), cls=(AP(TM.code)||{}).cls||3, Q=tmPOI(cls), L={poi:Q.P, nL:Q.nL, nB:Q.nB, small:Q.small, big:Q.big, deps:[], arrs:[]};
  TM.th=TM.th||tmTheme(TM.code); const shape=L.small?'lineaire':TM.th.shape; L.shape=shape; L.top=-300; L.bx0=-40; L.bx1=1040;
  const seatGrid=(x0,x1,y0,y1)=>{ const out=[]; if(TM.th.seat==='ilots'){ for(let yy=y0+18;yy<y1-12;yy+=40) for(let xx=x0+18;xx<x1-12;xx+=32) for(let k=0;k<8;k++){ const a=k/8*6.283; out.push({x:xx+Math.cos(a)*11,y:yy+Math.sin(a)*11}); } }
    if(!out.length) for(let yy=y0+6;yy<y1-6;yy+=15) for(let xx=x0+8;xx<x1-8;xx+=9) out.push({x:xx,y:yy}); return out; };
  // porte « en haut » (façade, aile, satellite) : avion nez vers le bâtiment, passerelle au milieu
  const topGate=(f,x0,x1,y0,y1,via)=>{ const lounge={x0,x1,y0,y1}, desk={x:(x0+x1)/2,y:y0+40}, door={x:(x0+x1)/2,y:y0-2};
    return {f,x0,x1,lounge,seats:seatGrid(x0,x1,y0+86,y1-24),desk,bq:tmPath(tmSnake(x0+8,desk.y+10,x1-8,desk.y+44,2).reverse()),door,stand:{x:door.x,y:y0-104,a:0},push:186,turn:door.x<320?1:-1,via}; };
  // porte « sur le côté » (jetée) : avion garé le long de la jetée
  const sideGate=(f,x0,x1,y0,y1,left,via)=>{ const ym=(y0+y1)/2, lounge={x0,x1,y0,y1}, dx=left?x0:x1, desk={x:left?x0+22:x1-22,y:ym-18}, door={x:dx,y:ym};
    return {f,x0,x1,lounge,seats:seatGrid(x0+4,x1-4,ym,y1),desk,bq:tmPath(tmSnake(left?x0+34:x0+6,y0+6,left?x1-6:x1-34,ym-6,2).reverse()),door,stand:{x:left?x0-40:x1+40,y:ym,a:left?-Math.PI/2:Math.PI/2},push:90,turn:left?-1:1,via}; };
  F.deps.forEach((f,i)=>{ let g;
    if(shape==='jetee'){ const k=Math.floor(i/2), left=i%2===0, y1=-k*120-12, y0=y1-100, ym=(y0+y1)/2; g=sideGate(f,left?150:380,left?260:490,y0,y1,left,[{x:320,y:405,st:'se dirige vers la jetée'},{x:320,y:-4,st:'entre dans la jetée'},{x:320,y:ym,st:'marche dans la jetée'}]); L.pierEnd=Math.min(L.pierEnd||0,y0-14); }
    else if(shape==='satellite'){ const sw=Math.max(440,Math.min(960,nd*120)), sx0=320-sw/2, bw=sw/nd, x0=sx0+i*bw+3, x1=sx0+(i+1)*bw-3; L.satX=[sx0-10,sx0+sw+10]; g=topGate(f,x0,x1,-690,-478,[{x:320,y:405,st:'se dirige vers la navette'},{x:320,y:-4,st:'prend la navette automatique'},{x:320,y:-456,st:'dans la navette vers le satellite',v:9},{x:320,y:-520,st:'entre dans le satellite'}]); }
    else if(shape==='L'){ const bw=1060/nd, x0=-420+i*bw+3, x1=-420+(i+1)*bw-3, wing=x1<=10; g=topGate(f,x0,x1,44,392,wing?[{x:24,y:404,st:'se dirige vers l’aile des portes'},{x:-20,y:300,st:'passe dans l’aile des portes'}]:null); }
    else { const bw=640/nd, x0=i*bw+3, x1=(i+1)*bw-3; g=topGate(f,x0,x1,44,392,null); }
    const bw2=640/nd, cx0=i*bw2+3, cx1=(i+1)*bw2-3; g.ck={x0:cx0+4,x1:cx1-4,y:1012}; g.q=tmPath(tmSnake(g.ck.x0+2,1032,g.ck.x1-2,1148,6).reverse()); g.cx0=cx0; g.cx1=cx1;
    L.deps.push(g); });
  if(shape==='jetee') L.top=Math.min(-300,(L.pierEnd||-200)-150); if(shape==='satellite'){ L.top=-1020; L.bx0=Math.min(-40,(L.satX||[0])[0]-60); L.bx1=Math.max(1040,(L.satX||[0,0])[1]+60); } if(shape==='L') L.bx0=-460;
  TW.top=L.top;
  F.arrs.forEach((f,i)=>{ const bw=340/na, x0=660+i*bw+3, x1=660+(i+1)*bw-3, cx=(x0+x1)/2;
    const BP=[[745,500],[915,500],[745,640],[915,640],[830,768]][i%5]; L.arrs.push({f,x0,x1,door:{x:cx,y:38},belt:{cx:BP[0],cy:BP[1],rx:58,ry:30,n:i+1}}); });
  L.secQ=tmPath(tmSnake(20,880,620,940,4).reverse()); L.polQ=tmPath(tmSnake(330,760,630,800,3).reverse()); L.immQn=tmPath(tmSnake(672,334,808,404,4).reverse()); L.immQf=tmPath(tmSnake(818,334,955,404,4).reverse());
  return L; }
/* ---------- SIMULATION DES FILES (phase 2) : guichets en nombre limité, premier arrivé premier servi ----------
   Comptoirs du vol (D.ci.desks), lignes de sûreté communes, guichets de police communs : quand
   beaucoup de passagers arrivent en même temps, la file s'allonge vraiment, et l'attente s'affiche. */
function tmServe(list,servers,svc){ const free=new Array(Math.max(1,servers)).fill(-Infinity); list.sort((a,b)=>a.arr-b.arr);
  for(const x of list){ let k=0; for(let j=1;j<free.length;j++) if(free[j]<free[k]) k=j; x.start=Math.max(x.arr,free[k]); x.done=x.start+svc(x); free[k]=x.done; } }
function tmSched(L){
  const secL=[], polL=[], W={ck:[],sec:[],pol:[]};
  for(const g of L.deps){ const f=g.f, D=f.D, N=Math.min(f.N,1600), sc=[], ckL=[];
    for(let i=0;i<N;i++){ const r=pfRng(D.key+'|sc'+i), tIn=D.ci.open+(D.ci.close-D.ci.open)*Math.pow(r(),0.85)*0.97, online=r()<(D.ci.online||0)/Math.max(1,f.N), bags=r()<0.8, kiosk=!(online&&!bags)&&(online||r()<0.3);
      const row=f.man&&f.man.rows&&f.man.rows[i]; const x={i,tIn,online,bags:row?row.bags>0:bags,kiosk,r:r(),wc:r()<0.12,alarm:r()<0.1,row}; if(row){ x.kiosk=!(online&&!x.bags)&&(online||x.r<0.3); } sc.push(x);
      if(online&&!bags){ x.ckStart=x.ckDone=tIn+MIN; } else ckL.push({x,arr:tIn+(kiosk?3.5:1.5)*MIN}); }
    tmServe(ckL,Math.max(1,Math.min(8,(D.ci.desks||Math.ceil(f.N/55))+tmOps(TM.code).ck)),o=>(o.x.bags?2.2:1.4)*MIN*(0.7+0.6*o.x.r));
    for(const o of ckL){ o.x.ckStart=o.start; o.x.ckDone=o.done; W.ck.push([o.arr,o.start-o.arr]); }
    // embarquement par zones : priorité (affaires, familles), puis zones 1 à 4
    const win=Math.max(MIN,(D.gate.last-D.gate.open)/5);
    const maxRow=Math.max(1,...sc.map(x=>x.row?parseInt(x.row.seat)||1:1));
    for(const x of sc){ const rw=x.row; x.zone=rw?((rw.cls==='f'||rw.cls==='j'||rw.assist||rw.age<6)?0:1+Math.min(3,Math.floor((1-(parseInt(rw.seat)||1)/(maxRow+1))*4))):(x.i<f.N*0.08?0:1+Math.floor((x.i/Math.max(1,f.N))*4)); x.board=D.gate.open+x.zone*win+x.r*win*0.9;
      secL.push({x,arr:x.ckDone+(x.wc?7:3)*MIN,D}); }
    g.sched=sc; }
  tmServe(secL,L.nL,o=>0.7*MIN*(0.6+0.8*o.x.r)); for(const o of secL){ o.x.secStart=o.start; o.x.secDone=o.done+(o.x.alarm?2.5*MIN:0)+0.6*MIN; W.sec.push([o.arr,o.start-o.arr]); if(o.D.intl) polL.push({x:o.x,arr:o.x.secDone+1.5*MIN}); }
  tmServe(polL,L.nB,o=>0.9*MIN*(0.6+0.8*o.x.r)); for(const o of polL){ o.x.polStart=o.start; o.x.polDone=o.done; W.pol.push([o.arr,o.start-o.arr]); }
  L.W=W; }
function tmWait(list,now){ let s=0,n=0; for(const [a,w] of list) if(a>now-25*MIN&&a<=now){ s+=w; n++; } return n?Math.round(s/n/MIN):0; }
// ---------- passagers : itinéraire complet avec comportements ----------
function tmKF(){ const K=[]; let t=0, x=0, y=0;
  const o={K, at(tt,px,py,st){ t=tt; x=px; y=py; K.push({t,x,y,st}); return o; },
    walk(px,py,st,v){ const d=Math.hypot(px-x,py-y), dt=Math.max(8000,d/(v||2)*1000); t+=dt; x=px; y=py; K.push({t,x,y,st,walk:1}); return o; },
    stay(tt,st,sit){ t=Math.max(t+4000,tt); K.push({t,x,y,st,sit}); return o; },
    queue(P,tt,st){ const a=P.pts[0]; o.walk(a.x,a.y,st); t=Math.max(t+6000,tt); const e=P.pts[P.pts.length-1]; x=e.x; y=e.y; K.push({t,x,y,st,path:P,q:1}); return o; },
    get t(){ return t; } }; return o; }
const tmJ=(r,a,b)=>a+(b-a)*r();
function tmPick(L,k,r){ const c=L.poi.filter(p=>p.k===k&&!p.arr); return c.length?c[Math.floor(r()*c.length)]:null; }
function tmIn(p,r){ return {x:tmJ(r,p.x0+4,p.x1-4),y:tmJ(r,p.y0+4,p.y1-4)}; }
function tmDepKF(g,i,L){
  const f=g.f, D=f.D, sc=g.sched[i], r=pfRng(D.key+'|tm'+i), N=f.N, k=tmKF(), intl=D.intl;
  k.at(sc.tIn,tmJ(r,30,610),1290,'arrive à l’aéroport'+(sc.bags?' avec ses valises':''));
  if(sc.online&&!sc.bags) k.walk(tmJ(r,40,600),1100,'carte d’embarquement sur le téléphone');
  else{ if(sc.kiosk){ const ks=L.poi.filter(p=>p.k==='kiosk'), kb=ks[Math.floor(r()*ks.length)]; k.walk((kb.x0+kb.x1)/2,kb.y1+6,'va à une borne automatique').stay(k.t+(1.5+r()*1.5)*MIN,'imprime sa carte d’embarquement'); }
    k.queue(g.q,sc.ckStart,'fait la queue à l’enregistrement'); k.walk(tmJ(r,g.ck.x0+3,g.ck.x1-3),g.ck.y+12,'au comptoir').stay(sc.ckDone,sc.bags?'enregistre ses bagages':'enregistrement'); }
  if(sc.wc){ const w=L.poi.find(p=>p.k==='wc'&&p.y0>1100); const q=tmIn(w,r); k.walk(q.x,q.y,'va aux toilettes').stay(k.t+(3+r()*2)*MIN,'aux toilettes'); }
  const lane=Math.floor(r()*L.nL), xr=L.poi.find(p=>p.k==='xray'&&p.lane===lane), ar=L.poi.find(p=>p.k==='arch'&&p.lane===lane);
  k.queue(L.secQ,sc.secStart,'fait la queue à la sûreté').walk(xr.x0+20,xr.y1+6,'pose ses affaires dans les bacs').stay(k.t+30000,'pose ses affaires au scanner').walk((ar.x0+ar.x1)/2,ar.y0-4,'passe le portique');
  if(sc.alarm) k.stay(k.t+2.5*MIN,'⚠️ alarme : palpation de sécurité');
  if(intl&&sc.polStart){ const bs=L.poi.filter(p=>p.k==='booth'&&!p.arr), b=bs[Math.floor(r()*bs.length)];
    k.queue(L.polQ,sc.polStart,'fait la queue à la police aux frontières').walk((b.x0+b.x1)/2,b.y0-6,'au guichet de police').stay(Math.max(k.t+30000,sc.polDone),'contrôle du passeport'); }
  else k.walk(tmJ(r,40,300),760,'couloir des vols nationaux');
  const noShow=i>=N-(D.gate.noShow||0); let board=sc.board, gateA=Math.max(k.t+4*MIN,D.gate.open-(5+r()*30)*MIN); if(board<gateA+2*MIN) gateA=board-2*MIN;
  const acts=['dutyfree','cafe','resto','wc','pharma','press','seats','prayer','lounge'], W={dutyfree:'fait du shopping au duty free',cafe:'prend un café',resto:'mange au restaurant',wc:'aux toilettes',pharma:'à la pharmacie',press:'achète un journal',seats:'attend dans la salle commune',prayer:'à la salle de prière',lounge:'se détend au salon business'};
  let guard=0; while(k.t<gateA-6*MIN&&guard++<5){ let a=acts[Math.floor(r()*acts.length)]; if(a==='lounge'&&sc.zone!==0) a='seats'; const p=tmPick(L,a,r); if(!p) continue; const q=tmIn(p,r), dur=(a==='resto'?20:a==='cafe'?10:a==='wc'?4:a==='seats'||a==='lounge'?18:7)*(0.6+r()*0.8)*MIN;
    k.walk(q.x,q.y,'se dirige vers : '+p.lab).stay(Math.min(gateA-3*MIN,k.t+dur),W[a]||p.lab,a==='resto'||a==='cafe'||a==='seats'||a==='lounge'); }
  if(noShow){ k.stay(D.gate.close+20*MIN,'⚠️ ne s’est pas présenté à la porte'); return k.K; }
  const s=g.seats[(i*37)%Math.max(1,g.seats.length)]||{x:(g.x0+g.x1)/2,y:200}, zl=sc.zone===0?'priorité (affaires, familles)':'zone '+sc.zone;
  for(const v of g.via||[]) k.walk(v.x,v.y,v.st,v.v);
  k.walk(s.x,s.y,'se rend à la porte '+D.gate.name).stay(board-1.5*MIN,'assis à la porte, attend l’appel ('+zl+')',1);
  k.queue(g.bq,board-12000,'file d’embarquement — '+zl).walk(g.desk.x+tmJ(r,-6,6),g.desk.y,'présente sa carte d’embarquement').stay(k.t+10000,'contrôle de la carte à la porte').walk(g.door.x,g.door.y,'embarque par la passerelle');
  k.K[k.K.length-1].out=1; return k.K; }
function tmArrKF(g,i,L,lost){
  const f=g.f, D=f.D, r=pfRng(D.key+'|tma'+i), N=Math.max(1,f.N), k=tmKF(), row0=f.man&&f.man.rows&&f.man.rows[i], bags0=r()<0.85, bags=row0?row0.bags>0:bags0, b=g.belt, intl=D.intl;
  const row=f.man&&f.man.rows&&f.man.rows[i], yf=intl&&typeof PF_YF!=='undefined'&&PF_YF.has(D.B.cc), nat=row?row.nat===D.B.cc:r()<0.45, refused=intl&&!nat&&i>=N-((D.imm&&D.imm.refused)||0);
  k.at(D.arr+5*MIN+(i/N)*14*MIN,g.door.x,g.door.y,'descend de l’avion par la passerelle').walk(g.door.x+tmJ(r,-8,8),120,'marche dans la jetée');
  const tx=Math.min(980,Math.max(676,g.door.x)); k.walk(tx,186,'monte sur le tapis roulant').walk(820+tmJ(r,-6,6),186,'sur le tapis roulant',3.6);
  if(!intl){ k.walk(983,232,'arrivées nationales (sans contrôle)').walk(983,430,'couloir des arrivées nationales'); }
  else{ if(yf){ const h=L.poi.find(p=>p.k==='health'); k.walk(tmJ(r,h.x0+6,h.x1-6),h.y1+6,'contrôle sanitaire').stay(k.t+20000,'montre son carnet de vaccination fièvre jaune');
      if(r()<0.012) k.stay(k.t+(5+r()*5)*MIN,'⚠️ pas de carnet fièvre jaune : vaccination sur place'); }
    const immB=Math.max(k.t+2*MIN,D.imm.open)+r()*Math.max(4*MIN,(D.imm.close-D.imm.open)*(nat?0.5:0.85)), eg=!nat&&!L.small&&r()<0.25;
    if(eg){ const q=L.poi.find(p=>p.k==='egate'); k.walk(tmJ(r,q.x0+4,q.x1-4),q.y1+6,'sas automatique').stay(k.t+40000,'passe le sas biométrique'); }
    else{ const bs=L.poi.filter(p=>p.k==='booth'&&p.arr&&!!p.nat===nat), bo=bs[Math.floor(r()*bs.length)];
      k.queue(nat?L.immQn:L.immQf,immB-MIN,nat?'file des passeports nationaux':'file des passeports étrangers').walk((bo.x0+bo.x1)/2,bo.y1+6,'au guichet d’immigration').stay(k.t+(nat?40000:75000),nat?'contrôle du passeport':'contrôle du passeport, du visa et des empreintes');
      if(refused){ k.stay(k.t+(8+r()*6)*MIN,'⛔ refus d’entrée : sera renvoyé par le prochain vol').walk(820,200,'escorté vers la zone de retour par la police'); k.K[k.K.length-1].out=1; return {K:k.K,bags:false,bagT:0}; } } }
  if(bags&&r()<0.6){ const t=L.poi.find(p=>p.k==='trolley'), q=tmIn(t,r); k.walk(q.x,q.y,'va chercher un chariot').stay(k.t+12000,'prend un chariot à bagages'); }
  const an=r()*6.283, bp={x:b.cx+Math.cos(an)*(b.rx+10),y:b.cy+Math.sin(an)*(b.ry+10)};
  const bagT=bags?Math.max(k.t+2*MIN,D.bag.first+r()*(D.bag.last-D.bag.first)):k.t+MIN;
  k.walk(bp.x,bp.y,bags?'va au tapis n° '+b.n:'traverse la salle des bagages').stay(lost?D.bag.last+3*MIN:bagT,bags?'attend sa valise au tapis n° '+b.n:'sans bagage en soute');
  if(lost){ const q=tmIn(L.poi.find(p=>p.k==='lost'),r); k.walk(q.x,q.y,'⚠️ sa valise n’est pas arrivée').stay(k.t+(8+r()*8)*MIN,'⚠️ déclare sa valise perdue au comptoir litiges'); }
  const red=r()<0.06, ch=L.poi.find(p=>p.k===(red?'red':'green'));
  k.walk(tmJ(r,ch.x0+5,ch.x1-5),ch.y0-6,red?'couloir rouge : déclare des marchandises':'passe la douane (couloir vert)');
  if(red||r()<0.04){ const xc=L.poi.find(p=>p.k==='xrayc'); k.walk(xc.x0-6,xc.y1+4,'bagages passés au scanner de la douane').stay(k.t+(3+r()*6)*MIN,'🔎 contrôle des bagages par la douane'); }
  k.walk(830+tmJ(r,-12,12),1000,'franchit la porte des arrivées');
  if(r()<0.5) k.walk(tmJ(r,676,990),tmJ(r,1062,1095),'cherche sa famille dans la foule').stay(k.t+(1+r()*5)*MIN,'retrouve sa famille 🤗');
  else if(r()<0.2){ const p=L.poi.filter(p=>p.arr&&['change','cafe','car','info','wc'].includes(p.k)), q=p[Math.floor(r()*p.length)], z=tmIn(q,r); k.walk(z.x,z.y-12,'va vers : '+q.lab).stay(k.t+(2+r()*6)*MIN,q.lab); }
  k.walk(tmJ(r,690,980),1258,'monte dans un taxi ou un bus'); k.K[k.K.length-1].out=1;
  return {K:k.K,bags:bags&&!lost,bagT}; }
// famille et chauffeurs qui attendent derrière la barrière des arrivées
// PERSONNEL : agents d'enregistrement, agents de porte, sûreté, police, immigration, santé, douane, litiges, nettoyage, patrouilles
const TM_ROLE={ck:['#1e3a8a','Agent d’enregistrement'],gate:['#1e3a8a','Agent d’embarquement'],sec:['#111827','Agent de sûreté'],pol:['#1d4ed8','Policier aux frontières'],imm:['#1d4ed8','Agent d’immigration'],
  health:['#f8fafc','Agent sanitaire'],cus:['#065f46','Douanier'],lost:['#1e3a8a','Agent litiges bagages'],info:['#0e7490','Agent d’accueil'],clean:['#f59e0b','Agent d’entretien'],patrol:['#1d4ed8','Patrouille de police']};
function tmStaff(L,now){ const out=[], T0=now-14*HOUR, T1=now+14*HOUR, add=(role,x,y,st)=>out.push({staff:role,i:out.length,K:[{t:T0,x,y,st},{t:T1,x,y,st}],c:TM_ROLE[role][0],sk:TM_SKIN[out.length%TM_SKIN.length],dep:3});
  for(const g of L.deps){ const D=g.f.D, n=Math.max(1,Math.min(8,(D.ci.desks||Math.ceil(g.f.N/55))+tmOps(TM.code).ck));
    for(let k=0;k<n;k++) add('ck',g.ck.x0+(k+0.5)*(g.ck.x1-g.ck.x0)/n,g.ck.y-2,'au comptoir du vol '+g.f.fn+' → '+D.B.city);
    add('gate',g.desk.x-7,g.desk.y-9,'à la porte '+D.gate.name+' (vol '+g.f.fn+')'); add('gate',g.desk.x+7,g.desk.y-9,'à la porte '+D.gate.name+' (vol '+g.f.fn+')'); }
  for(const p of L.poi){ const cx=(p.x0+p.x1)/2;
    if(p.k==='xray') add('sec',p.x0+30,p.y0-7,'contrôle les bagages au scanner'); else if(p.k==='arch') add('sec',cx,p.y1+9,'au portique : palpations');
    else if(p.k==='booth') add(p.arr?'imm':'pol',cx,p.arr?p.y0+8:p.y1-8,p.arr?'contrôle les passeports à l’arrivée':'tamponne les passeports au départ');
    else if(p.k==='health') add('health',cx,p.y0+7,'vérifie les carnets de vaccination'); else if(p.k==='green'||p.k==='red') add('cus',p.k==='red'?p.x1-12:p.x0+12,p.y1+8,'surveille le couloir '+(p.k==='red'?'rouge':'vert'));
    else if(p.k==='lost') add('lost',cx,p.y0+8,'enregistre les déclarations de bagages perdus'); else if(p.k==='info') add('info',cx,p.y0+8,'renseigne les voyageurs'); }
  // nettoyage et patrouilles : se déplacent toutes les 3 minutes
  const zonesW=[[20,1000,620,1220],[20,430,620,690],[680,980,990,1220],[680,440,990,840]];
  for(let k=0;k<7;k++){ const role=k<5?'clean':'patrol', z=zonesW[k%4], K=[]; for(let t=Math.floor((now-40*MIN)/(3*MIN))*3*MIN;t<now+3*HOUR;t+=3*MIN){ const r=pfRng('st'+k+'|'+t); K.push({t,x:z[0]+r()*(z[2]-z[0]),y:z[1]+r()*(z[3]-z[1]),st:role==='clean'?'nettoie le sol':'patrouille dans l’aérogare',walk:1}); }
    out.push({staff:role,i:out.length,K,c:TM_ROLE[role][0],sk:TM_SKIN[k%TM_SKIN.length],dep:3}); }
  return out; }
function tmGreeters(L){ const out=[]; L.arrs.forEach((g,fi)=>{ const D=g.f.D, n=Math.min(45,Math.round(g.f.N*0.18));
    for(let i=0;i<n;i++){ const r=pfRng(D.key+'|gr'+i), k=tmKF(), x=tmJ(r,672,994); if(x>806&&x<854) continue;
      k.at(D.arr-tmJ(r,10,35)*MIN,tmJ(r,690,980),1258,'arrive pour accueillir un proche').walk(x,tmJ(r,1008,1048),'attend derrière la barrière').stay(D.arr+tmJ(r,25,70)*MIN,(i%3===0?'tient une pancarte « '+(i%2?'Bienvenue':'Taxi / chauffeur')+' »':'attend un passager du vol '+g.f.fn)).walk(tmJ(r,690,980),1258,'repart');
      k.K[k.K.length-1].out=1; out.push({f:g.f,i,K:k.K,c:TM_COL[(i*3)%TM_COL.length],sk:TM_SKIN[i%TM_SKIN.length],dep:2,sign:i%3===0,greet:1}); } }); return out; }
function tmAt(K,now){ if(now<K[0].t||now>K[K.length-1].t) return null;
  for(let k=1;k<K.length;k++) if(now<=K[k].t){ const a=K[k-1], b=K[k], u=(now-a.t)/Math.max(1,b.t-a.t);
      if(b.path){ const q=tmPathAt(b.path,u); return {x:q.x,y:q.y,st:b.st,walk:0,q:1}; }
      if(b.walk) return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,st:b.st,walk:1};
      return {x:b.x,y:b.y,st:b.st,sit:b.sit}; }
  return null; }
/* ---------- BAGAGES (phase 3) : chaque valise a son trajet ----------
   Départ : comptoir → tapis derrière les comptoirs → tri bagages (le long de la façade) → soute de l'avion.
   Arrivée : soute → tri → tapis de livraison où elle tourne jusqu'à ce que son passager la prenne ;
   les valises perdues n'arrivent jamais (le passager va au comptoir litiges). */
const TM_BAGC=['#1f2937','#7f1d1d','#1e3a8a','#14532d','#713f12','#6b21a8','#be185d','#0f766e'];
function tmBags(L){ const B=[];
  for(const g of L.deps){ const D=g.f.D; g.sched.forEach((x,i)=>{ if(!x.bags) return; const cx=tmJ(pfRng(D.key+'|bx'+i),g.ck.x0+3,g.ck.x1-3);
      const st=g.stand, n={x:-Math.sin(st.a),y:Math.cos(st.a)}, hx=st.x-n.x*40, hy=st.y-n.y*40, P=tmPath([{x:cx,y:g.ck.y-16},{x:cx,y:978},{x:-14,y:978},{x:-14,y:hy},{x:hx,y:hy}]); B.push({t0:x.ckDone,P,dur:P.L/3.2*1000,c:TM_BAGC[i%8],load:Math.min(D.P-3*MIN,x.ckDone+P.L/3.2*1000),g}); }); }
  for(const a of L.arrs){ if(a.f.soon) continue; const b=a.belt; for(const p of TM.ppl) if(p.f===a.f&&p.bagT&&p.hasBag){ const tB=Math.max(a.f.D.bag.first,p.bagT-(1+((p.i*7)%5))*MIN);
      const P=tmPath([{x:a.door.x+20,y:-46},{x:a.door.x+20,y:-28},{x:1014,y:-28},{x:1014,y:b.cy},{x:b.cx+b.rx,y:b.cy}]), dur=P.L/3.2*1000; B.push({t0:tB-dur,P,dur,c:TM_BAGC[p.i%8],belt:b,tB,pick:p.bagT,p}); } }
  return B; }
function tmSkin(row,d){ if(!row) return d; const reg=COUNTRIES[row.nat]&&COUNTRIES[row.nat][1], h=(row.i*7)%3; return reg==='AF'?['#5b3a24','#7a4a2a','#3f2516'][h]:reg==='EU'||reg==='NA'||reg==='OC'?['#f1d3b8','#e8c2a0','#d9b38c'][h]:reg==='AS'?['#e0b88f','#d4a373','#c99a73'][h]:['#c99a73','#8d5a3b','#e8c2a0'][h]; }
function tmBuild(){ const F=tmFlights(TM.code), L=tmLayout(F), ppl=[];
  tmSched(L);
  L.deps.forEach((g,fi)=>{ g.f.col=TM_COL[fi%TM_COL.length]; for(let i=0;i<g.sched.length;i++){ const rw=g.sched[i].row; ppl.push({f:g.f,i,row:rw,K:tmDepKF(g,i,L),c:g.f.col,sk:tmSkin(rw,TM_SKIN[(i*7+fi)%TM_SKIN.length]),dep:1,bag:g.sched[i].bags,ckDone:g.sched[i].ckDone,kid:rw?rw.age<12:i%9===4}); } });
  L.arrs.forEach((g,fi)=>{ g.f.col=TM_COL[(fi+5)%TM_COL.length]; if(g.f.soon) return; const nLost=Math.min(3,g.f.D.bag&&g.f.D.bag.lost||0);
    for(let i=0;i<Math.min(g.f.N,1600);i++){ const R=tmArrKF(g,i,L,i<nLost), rw=g.f.man&&g.f.man.rows&&g.f.man.rows[i]; ppl.push({f:g.f,i,row:rw,K:R.K,c:g.f.col,sk:tmSkin(rw,TM_SKIN[(i*5+fi)%TM_SKIN.length]),dep:0,bag:R.bags,hasBag:R.bags,bagT:R.bagT,kid:rw?rw.age<12:i%9===4}); } });
  try{ ppl.push(...tmGreeters(L)); }catch(e){}
  try{ ppl.push(...tmStaff(L,tmNow())); }catch(e){}
  TM.F=F; TM.L=L; TM.ppl=ppl; TM.bags=tmBags(L); TM.built=performance.now();
  // incidents des vols (Aérogare en direct) : affichés sur le plan au bon moment
  TM.inc=[]; try{ for(const g of L.deps) if(g.f.l&&g.f.D.rows) for(const x of pfIncidents(g.f.D,'dep')) TM.inc.push({x:g.desk.x+18,y:g.desk.y-10,at:x.at,t:x.t,f:g.f});
    for(const a of L.arrs) if(a.f.D.rows) for(const x of pfIncidents(a.f.D,'arr')) TM.inc.push({x:x.id==='lost'?925:a.door.x,y:x.id==='lost'?790:60,at:x.at,t:x.t,f:a.f}); }catch(e){}
  tmBoard(); }
const tmDelay=f=>f.dl||(f.l&&f.l.hOut>8*MIN?Math.round(f.l.hOut/MIN):0);
function tmBoard(){ const el=document.getElementById('tmBoard'); if(!el||!TM.F) return; const F=TM.F, now=tmNow();
  const zoneNow=D=>{ const win=Math.max(MIN,(D.gate.last-D.gate.open)/5), z=Math.floor((now-D.gate.open)/win); return z<=0?'priorité':'zone '+Math.min(4,z); };
  const stD=f=>{ const D=f.D, dl=tmDelay(f); return (dl?`<b style="color:#f87171">Retardé +${dl} min${f.dlw?' ('+f.dlw+')':''}</b> · `:'')+(now<D.ci.close?'🎫 Enregistrement':now<D.gate.open?'🛍️ Salle d’attente':now<D.gate.last?'🚪 Embarquement '+zoneNow(D):now<D.gate.close?'⚠️ Dernier appel':'✈️ Porte fermée'); };
  const own=f=>f.riv?` <span style="color:#94a3b8">${esc(f.riv.name||'')}</span>`:' <span style="color:#facc15">★</span>', row=(c,a,b,d,e,k)=>`<tr data-tmf="${k}"><td><i style="background:${c}"></i></td><td><b>${a}</b></td><td>${b}</td><td>${d}</td><td>${e}</td></tr>`;
  const cx=(F.cancel||[]).map(c=>`<tr><td><i style="background:#ef4444"></i></td><td><b>${esc(c.fn)}</b></td><td>${esc(c.dest)}</td><td></td><td><b style="color:#f87171">❌ Annulé</b> · ${esc(c.why)}</td></tr>`).join('');
  el.innerHTML=(F.deps.length||cx?`<table><tr><th></th><th>Départ</th><th>Destination</th><th>Porte</th><th>Statut</th></tr>${F.deps.map((f,i)=>row(f.col,tmHM(f.D.P)+' '+esc(f.fn),esc(f.D.B.city)+' · '+f.N+' pax'+own(f),esc(f.D.gate.name),stD(f),'d'+i)).join('')}${cx}</table>`:'<div class="small mut">Aucun départ dans les 3 prochaines heures.</div>')
    +(F.arrs.length?`<table><tr><th></th><th>Arrivée</th><th>Provenance</th><th>Tapis</th><th>Statut</th></tr>${F.arrs.map((f,i)=>row(f.col,tmHM(f.D.arr)+' '+esc(f.fn),esc(f.D.A.city)+' · '+f.N+' pax'+own(f),String(i+1),f.soon?'🛬 Atterrit bientôt':now<f.D.bag.first?'🛂 Immigration':now<f.D.bag.last?'🧳 Bagages en livraison':'🛃 Douane / sortie','a'+i)).join('')}</table>`:'');
  el.querySelectorAll('[data-tmf]').forEach(tr=>tr.onclick=()=>{ const k=tr.dataset.tmf, g=k[0]==='d'?TM.L.deps[+k.slice(1)]:TM.L.arrs[+k.slice(1)]; if(g){ TM.selF=g.f; tmInfoFlight(g); tmFocus(k[0]==='d'?{x0:g.x0,y0:-150,x1:g.x1,y1:400}:{x0:660,y0:-150,x1:1000,y1:800}); TM.moved=1; } }); }
/* ---------- caméra : vue générale, zones, zoom, déplacement ---------- */
const TM_ZONES=[['🗺️ Vue générale',{x0:0,y0:-300,x1:1000,y1:1300}],['🛫 Pistes et postes',{x0:-40,y0:-300,x1:1040,y1:60}],['🎫 Enregistrement',{x0:0,y0:990,x1:640,y1:1300}],['🔍 Sûreté',{x0:0,y0:820,x1:640,y1:960}],['🛂 Police',{x0:300,y0:700,x1:640,y1:820}],
  ['🛍️ Boutiques',{x0:0,y0:420,x1:640,y1:700}],['🚪 Portes',{x0:0,y0:-200,x1:640,y1:400}],['🛬 Arrivées',{x0:660,y0:-200,x1:1000,y1:240}],['🛂 Immigration',{x0:660,y0:230,x1:1000,y1:430}],['🧳 Bagages',{x0:660,y0:420,x1:1000,y1:860}],['🛃 Douane',{x0:660,y0:850,x1:1000,y1:970}],['🤗 Hall des arrivées',{x0:660,y0:960,x1:1000,y1:1300}]];
function tmZoneRect(i){ const z=TM_ZONES[i], L=TM.L; if(!L) return z[1]; const nm=z[0];
  if(nm.includes('Vue générale')) return {x0:L.bx0,y0:L.top,x1:L.bx1,y1:1300}; if(nm.includes('Pistes')) return {x0:L.bx0,y0:L.top,x1:L.bx1,y1:60};
  if(nm.includes('Portes')){ let a=1e9,b=-1e9,c=1e9,e=-1e9; for(const d of L.deps){ a=Math.min(a,d.lounge.x0,d.stand.x-110); b=Math.max(b,d.lounge.x1,d.stand.x+110); c=Math.min(c,d.lounge.y0,d.stand.y-110); e=Math.max(e,d.lounge.y1); } return a<b?{x0:a,y0:c,x1:b,y1:e}:z[1]; } return z[1]; }
function tmFocus(R0){ const cv=TM.cv; if(!cv) return; const xa=tmFx(R0.x0), xb=tmFx(R0.x1), ya=tmFy(R0.y0), yb=tmFy(R0.y1), R={x0:Math.min(xa,xb),x1:Math.max(xa,xb),y0:Math.min(ya,yb),y1:Math.max(ya,yb)}; const w=cv.clientWidth, h=cv.clientHeight, s=Math.min(w/(R.x1-R.x0),h/(R.y1-R.y0))*0.96;
  TM.goal={s,x:(R.x0+R.x1)/2-w/(2*s),y:(R.y0+R.y1)/2-h/(2*s)}; }
function tmCamStep(){ const c=TM.cam, g=TM.goal; if(!g) return; const k=0.18; c.s+=(g.s-c.s)*k; c.x+=(g.x-c.x)*k; c.y+=(g.y-c.y)*k; if(Math.abs(g.s-c.s)<g.s*0.002&&Math.abs(g.x-c.x)<0.5&&Math.abs(g.y-c.y)<0.5){ Object.assign(c,g); TM.goal=null; } }
function tmZoomAt(f,sx,sy){ const c=TM.cam, w=TM.cv.clientWidth, h=TM.cv.clientHeight, LL=TM.L||{bx0:-40,bx1:1040}, fit=Math.min(w/(LL.bx1-LL.bx0),h/(TW.H-TW.top)), ns=Math.max(fit*0.8,Math.min(fit*14,c.s*f)); const wx=c.x+sx/c.s, wy=c.y+sy/c.s; c.s=ns; c.x=wx-sx/ns; c.y=wy-sy/ns; TM.goal=null; }
/* ---------- informations (passager, vol, équipement) ---------- */
function tmInfo(html){ const el=document.getElementById('tmInfo'); if(!el) return; el.innerHTML=html?`<button class="btn" data-tmx style="float:right;padding:2px 8px">✖</button>${html}`:''; el.hidden=!html; const x=el.querySelector('[data-tmx]'); if(x) x.onclick=()=>{ TM.sel=null; TM.selF=null; TM.dash=false; tmInfo(''); }; }
function tmInfoFlight(g){ const f=g.f, D=f.D, now=tmNow(), st={}; for(const p of TM.ppl) if(p.f===f){ const q=tmAt(p.K,now); if(q) st[q.st]=(st[q.st]||0)+1; }
  const top=Object.entries(st).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>`<div>• ${v} ${esc(k)}</div>`).join('');
  const inc=(TM.inc||[]).filter(x=>x.f===f&&now>=x.at-2*MIN).map(x=>`<div style="color:#fca5a5">⚠️ ${String(x.t).replace(/<[^>]+>/g,'')}</div>`).join('');
  const bg=(TM.bags||[]).filter(b=>g.sched?b.g===g:b.p&&b.p.f===f), loaded=g.sched?bg.filter(b=>now>=b.t0+b.dur).length:bg.filter(b=>now>=b.tB).length;
  tmInfo(`<b>✈️ ${esc(f.fn)}</b> ${f.riv?esc(f.riv.name||''):'(votre compagnie)'}${f.reg?' · '+esc(f.reg):''}${f.model?' · '+esc(f.model):''}<br>${esc(D.A.city)} → ${esc(D.B.city)} · ${f.N} passagers${D.intl?' · international':' · national'}<br>`+
    (g.sched?`Porte ${esc(D.gate.name)} · embarquement ${tmHM(D.gate.open)} · fermeture ${tmHM(D.gate.close)}${tmDelay(f)?` · <b style="color:#f87171">retard +${tmDelay(f)} min</b>`:''}<br>🧳 ${loaded}/${bg.length} valises chargées en soute<br>`:`🧳 ${loaded}/${bg.length} valises livrées sur le tapis ${g.belt.n}<br>`)+
    `<div class="small" style="margin-top:4px">${top||'Aucun passager dans l’aérogare pour l’instant.'}</div>${inc?'<div class="small" style="margin-top:4px">'+inc+'</div>':''}`+
    (f.acId&&(f.riv||(f.l&&(S.fleet.find(a=>a.id===f.acId)||{flight:null}).flight&&(S.fleet.find(a=>a.id===f.acId)).flight.legs[(S.fleet.find(a=>a.id===f.acId)).flight.li]===f.l))?`<button class="btn" data-tmman="${esc(f.acId)}" style="margin-top:6px">📋 Manifeste complet (${f.N} passagers)</button>`:''));
  const bt=document.querySelector('[data-tmman]'); if(bt) bt.onclick=()=>{ const id=bt.dataset.tmman; tmClose(); try{ ACTIONS.manifest({id}); }catch(e){} }; }
function tmInfoPOI(p){ let n=0; for(const z of TM.pts||[]){ const x=z[0], y=z[1]; if(x>=p.x0-40&&x<=p.x1+40&&y>=p.y0-40&&y<=p.y1+60) n++; }
  const now=tmNow(), W=TM.L.W||{}, wt=p.k==='xray'||p.k==='arch'?tmWait(W.sec||[],now):p.k==='booth'&&!p.arr?tmWait(W.pol||[],now):0;
  const extra={kiosk:'Imprime cartes d’embarquement et étiquettes bagages.',xray:'Bacs, ordinateurs et liquides scannés.',arch:'Alarme → palpation par un agent.',booth:'Passeport, visa, tampon de sortie ou d’entrée.',egate:'Pour les passeports biométriques.',green:'Passage libre, contrôles aléatoires.',red:'Déclaration obligatoire, fouille des bagages.',lost:'Déclaration de bagage perdu, indemnité, livraison à domicile.',lounge:'Réservé aux passagers en classe affaires.'}[p.k]||'';
  tmInfo(`<b>${p.ico} ${esc(p.lab)}</b><br>👥 environ ${n} personne${n>1?'s':''} autour en ce moment${wt?` · attente ~${wt} min`:''}${extra?'<br><span class="small">'+extra+'</span>':''}`); }
/* ---------- rendu (phase 4 : personnages animés, mobilier, avions) ---------- */
function tmPlane(g,x,y,col,ang){ g.save(); g.translate(x,y); if(ang) g.rotate(ang); g.fillStyle='#f8fafc'; g.strokeStyle='#64748b'; g.lineWidth=1;
  g.beginPath(); g.ellipse(0,-50,7,52,0,0,6.283); g.fill(); g.stroke(); g.beginPath(); g.moveTo(-6,-58); g.lineTo(-52,-40); g.lineTo(-52,-34); g.lineTo(-6,-42); g.moveTo(6,-58); g.lineTo(52,-40); g.lineTo(52,-34); g.lineTo(6,-42); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-3,-96); g.lineTo(-18,-104); g.lineTo(-18,-100); g.lineTo(-2,-90); g.moveTo(3,-96); g.lineTo(18,-104); g.lineTo(18,-100); g.lineTo(2,-90); g.fill(); g.stroke();
  g.fillStyle='#94a3b8'; g.fillRect(-26,-52,6,10); g.fillRect(20,-52,6,10);   // réacteurs
  g.fillStyle=col; g.fillRect(-1.5,-102,3,12); g.fillRect(-7,-60,14,3); g.restore(); }
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
  const b=document.getElementById('tmAnn'); if(b){ b.textContent='📢 '+msg; b.hidden=false; clearTimeout(TM.annTO); TM.annTO=setTimeout(()=>{ b.hidden=true; },9000); }
  if(TM.voice&&typeof fx2Say==='function') try{ fx2Say(msg,'fr',0.9); }catch(e){} }
// avion au départ : au poste → repoussage → virage → roulage ; avion à l'arrivée : roulage → virage → entrée au poste
const TM_TWY=-250;
function tmDepPlane(d,now){ const D=d.f.D, P=D.P, st=d.stand, n={x:-Math.sin(st.a),y:Math.cos(st.a)}; if(now<D.gate.open-40*MIN) return null; if(now<P) return {x:st.x,y:st.y,a:st.a,at:1};
  const u=now-P, px=st.x-n.x*d.push, py=st.y-n.y*d.push; if(u<2.5*MIN){ const k=u/(2.5*MIN); return {x:st.x-n.x*d.push*k,y:st.y-n.y*d.push*k,a:st.a,push:1}; }
  if(u<3*MIN) return {x:px,y:py,a:st.a+d.turn*Math.PI/2*(u-2.5*MIN)/(0.5*MIN)}; const a2=st.a+d.turn*Math.PI/2, k=(u-3*MIN)/(4*MIN);
  if(u<7*MIN) return {x:px-Math.sin(a2)*1100*k,y:py+Math.cos(a2)*1100*k,a:a2}; return null; }
function tmArrPlane(a,now){ const A=a.f.D.arr; if(now<A-6*MIN||now>A+40*MIN) return null; if(now>=A) return {x:a.door.x,y:-60,a:0,at:1};
  const u=A-now; if(u>2*MIN) return {x:a.door.x+700*(u-2*MIN)/(4*MIN),y:TM_TWY,a:Math.PI/2}; if(u>1.5*MIN) return {x:a.door.x,y:TM_TWY,a:Math.PI/2*(u-1.5*MIN)/(0.5*MIN)};
  return {x:a.door.x,y:TM_TWY+(-60-TM_TWY)*(1-u/(1.5*MIN)),a:0}; }
function tmLocalHour(){ const A=AP(TM.code)||{}, tz=A.utc!=null?A.utc:Math.round((A.lon||0)/15); return (((tmNow()/HOUR+tz)%24)+24)%24; }
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
function tmDraw(){
  if(!TM.open) return; TM.raf=requestAnimationFrame(tmDraw);
  const cv=TM.cv; if(!cv) return; const w=cv.clientWidth, h=cv.clientHeight; if(!w||!h) return;
  if(!TM.built||performance.now()-TM.built>15000) tmBuild();
  if(cv.width!==Math.round(w*TM.dpr)||cv.height!==Math.round(h*TM.dpr)){ cv.width=Math.round(w*TM.dpr); cv.height=Math.round(h*TM.dpr); if(!TM.cam||!TM.moved){ TM.cam={s:1,x:0,y:0}; tmFocus(tmZoneRect(0)); Object.assign(TM.cam,TM.goal); TM.goal=null; } }
  tmFollowStep(tmNow(),w,h); tmCamStep(); const c=TM.cam, g=cv.getContext('2d'), L=TM.L, F=TM.F, now=tmNow(), s=c.s;
  g.setTransform(TM.dpr,0,0,TM.dpr,0,0); g.fillStyle='#1e293b'; g.fillRect(0,0,w,h);
  g.setTransform(TM.dpr*s,0,0,TM.dpr*s,-c.x*TM.dpr*s,-c.y*TM.dpr*s);
  { const T0=TM.th||(TM.th=tmTheme(TM.code)); if(!TM._ft) TM._ft=CanvasRenderingContext2D.prototype.fillText; g.fillText=TM._ft;
    if(T0.mx||T0.my){ g.translate(T0.mx?1000:0,T0.my?1000:0); g.scale(T0.mx?-1:1,T0.my?-1:1); const ft=TM._ft;
      g.fillText=function(t,x,y){ this.save(); this.translate(x,y); this.scale(T0.mx?-1:1,T0.my?-1:1); if(T0.mx) this.textAlign='right'; ft.call(this,t,0,0); this.restore(); }; } }
  const font=(px,b)=>{ g.font=`${b?'700 ':''}${px}px system-ui`; }, txt=(t,x,y,px,col,b)=>{ if(px*s<6) return; font(px,b); g.fillStyle=col||'#334155'; g.fillText(t,x,y); };
  // tarmac, chariots à bagages, avions
  g.fillStyle='#475569'; g.fillRect(L.bx0,TW.top,L.bx1-L.bx0,-TW.top+30); if(L.shape==='L'){ g.fillRect(L.bx0,0,460,420); } g.strokeStyle='#facc15'; g.lineWidth=1.2; g.setLineDash([]); g.beginPath(); g.moveTo(-40,TM_TWY); g.lineTo(1040,TM_TWY); g.stroke();   // axe de la voie de circulation
  txt('— Voie de circulation A —',430,TM_TWY-8,10,'#facc15',1);
  { g.strokeStyle='#facc15'; g.lineWidth=1;
    if(L.shape==='jetee'){ g.beginPath(); for(const x of [20,620]){ g.moveTo(x,-6); g.lineTo(x,L.top+30); } g.moveTo(20,L.top+30); g.lineTo(620,L.top+30); g.stroke(); }
    if(L.shape==='satellite'){ g.beginPath(); g.moveTo(L.bx0,-980); g.lineTo(L.bx1,-980); g.stroke(); txt('— Voie de circulation B —',260,-988,10,'#facc15',1); }
    for(const d of L.deps){ const st=d.stand, n={x:-Math.sin(st.a),y:Math.cos(st.a)}; g.beginPath(); g.moveTo(st.x,st.y); g.lineTo(st.x-n.x*d.push,st.y-n.y*d.push); g.stroke(); txt(d.f.D.gate.name,st.x+6,st.y-4,8,'#f8fafc',1); }   // ligne du poste
    for(const [x,nm] of L.arrs.map(a=>[a.door.x,'A'+a.belt.n])){ g.beginPath(); g.moveTo(x,TM_TWY); g.lineTo(x,-6); g.stroke(); g.fillStyle='#f8fafc'; g.fillRect(x-10,-8,20,2.5); txt(nm,x+12,-14,8,'#f8fafc',1); } }   // ligne d'entrée au poste, barre d'arrêt
  { const hr=tmLocalHour(), night=hr<6||hr>=18.5, dusk=!night&&(hr<7||hr>=17.5); TM.night=night;
    if(night||dusk){ g.fillStyle=night?'rgba(2,6,23,.6)':'rgba(124,45,18,.25)'; g.fillRect(-40,TW.top,1080,-TW.top+30); if(night){ g.fillStyle='#4ade80'; for(let x=-20;x<1040;x+=30){ g.beginPath(); g.arc(x,TM_TWY,1.8,0,6.283); g.fill(); } g.fillStyle='#fde68a'; for(let x=-20;x<1040;x+=80){ g.beginPath(); g.arc(x,TW.top+12,2.4,0,6.283); g.fill(); } } }
    let wx=null; try{ wx=typeof towerWx==='function'?towerWx(TM.code):null; }catch(e){} TM.storm=!!(wx&&wx.st);
    if(TM.storm){ g.strokeStyle='rgba(191,219,254,.55)'; g.lineWidth=1; g.beginPath(); for(let k=0;k<90;k++){ const x=((k*137+now/9)%1080)-40, y=TW.top+((k*71+now/4)%(-TW.top+30)); g.moveTo(x,y); g.lineTo(x-3,y+9); } g.stroke(); } }
  g.strokeStyle='rgba(148,163,184,.6)'; g.lineWidth=3; g.beginPath(); g.moveTo(-14,978); g.lineTo(-14,-28); g.lineTo(1014,-28); g.lineTo(1014,700); g.stroke();   // circuit du tri bagages
  // bâtiment : sol carrelé, piliers, murs
  const TH=TM.th||(TM.th=tmTheme(TM.code));
  g.fillStyle=TH.floor; g.fillRect(0,0,1000,1236);
  if(s>0.7){ const t=TH.tile; g.lineWidth=0.5;   // revêtement de sol propre à l'aéroport
    if(TH.pat==='checker'){ g.fillStyle='rgba(0,0,0,.035)'; for(let x=0;x<1000;x+=t) for(let y=0;y<1236;y+=t) if(((x+y)/t)%2===0) g.fillRect(x,y,t,t); }
    else if(TH.pat==='diag'){ g.strokeStyle='rgba(0,0,0,.06)'; g.beginPath(); for(let k=-1236;k<1000;k+=t*1.5){ g.moveTo(k,0); g.lineTo(k+1236,1236); } g.stroke(); }
    else if(TH.pat==='terrazzo'){ g.fillStyle='rgba(120,90,60,.12)'; for(let k=0;k<2600;k++){ const x=(k*97)%1000, y=(k*61)%1236; g.fillRect(x,y,1.6,1.6); } }
    else if(TH.pat==='marbre'){ g.strokeStyle='rgba(150,120,80,.16)'; g.beginPath(); for(let k=0;k<70;k++){ const x=(k*137)%1000, y=(k*89)%1236; g.moveTo(x,y); g.bezierCurveTo(x+30,y+10,x+50,y+40,x+90,y+35); } g.stroke(); g.strokeStyle='rgba(0,0,0,.05)'; g.beginPath(); for(let x=0;x<=1000;x+=t*2){ g.moveTo(x,0); g.lineTo(x,1236); } g.stroke(); }
    else if(TH.pat==='bois'){ g.strokeStyle='rgba(120,80,40,.10)'; g.beginPath(); for(let y=0;y<=1236;y+=6){ g.moveTo(0,y); g.lineTo(1000,y); } g.stroke(); }
    else { g.strokeStyle='rgba(0,0,0,.06)'; g.beginPath(); for(let x=0;x<=1000;x+=t){ g.moveTo(x,0); g.lineTo(x,1236); } for(let y=0;y<=1236;y+=t){ g.moveTo(0,y); g.lineTo(1000,y); } g.stroke(); } }
  g.fillStyle='#d6d3d1'; g.fillRect(0,1236,1000,64); txt('🚶 Parvis — dépose minute',8,1258,12,'#44403c',1);
  // enseigne lisible à toutes les échelles (taille constante à l'écran)
  const sign=(t,x,y,col)=>{ const px=Math.max(7,Math.min(18,12/s)); g.font=`700 ${px}px system-ui`; const w=g.measureText(t).width+px*0.9, hh=px*1.5; g.fillStyle=col||TH.acc; g.globalAlpha=0.92; g.beginPath(); if(g.roundRect) g.roundRect(x,y,w,hh,hh*0.3); else g.rect(x,y,w,hh); g.fill(); g.globalAlpha=1; g.fillStyle='#fff'; g.fillText(t,x+px*0.45,y+px*1.1); return hh; };
  TM.signs=[];
  const zone=(x0,y0,x1,y1,col,lab,ico)=>{ g.fillStyle=col; g.globalAlpha=0.55; g.fillRect(x0,y0,x1-x0,y1-y0); g.globalAlpha=1; if(lab) TM.signs.push([(ico?ico+' ':'')+lab,x0+6,y0+5]); };
  zone(0,990,640,1236,'#f5f5f4','Hall d’enregistrement','🎫'); zone(0,820,640,965,'#dbeafe','Contrôle de sûreté','🔍'); zone(0,700,320,815,'#f1f5f9','Couloir — vols nationaux',TH.flag);
  zone(320,700,640,815,'#ede9fe','Police aux frontières — zone internationale','🛂'); zone(0,420,640,700,'#fafaf9','',null); TM.signs.push(['🛍️ Commerces et salle d’attente',300,548]); zone(0,0,640,410,'#f8fafc','',null);
  zone(660,0,1000,240,'#f1f5f9','Couloir des arrivées','🛬'); zone(660,240,1000,420,'#ede9fe','Immigration','🛂'); zone(660,420,1000,860,'#f8fafc','Salle de livraison des bagages','🧳');
  zone(660,860,1000,960,'#dcfce7','Douane','🛃'); zone(660,960,1000,1236,'#fef9c3','Hall des arrivées · accueil','🤝');
  const walls=[[640,0,20,1236],[0,410,640,10],[0,965,640,25],[0,815,640,5],[660,240,340,4],[660,420,340,4],[660,860,340,4],[660,960,340,4]];
  g.fillStyle='rgba(0,0,0,.12)'; for(const w of walls) g.fillRect(w[0]+3,w[1]+3,w[2],w[3]);   // ombre des murs
  g.fillStyle='#57534e'; for(const w of walls) g.fillRect(...w); g.fillStyle=TH.acc; g.fillRect(645,0,10,1236);   // mur central à la couleur de l'aéroport
  g.fillStyle='#78716c'; g.fillRect(0,975,640,6); txt('↔ tapis vers le tri bagages',8,972,8,'#e7e5e4');
  if(s>0.8){ g.fillStyle='#a8a29e'; for(let x=80;x<640;x+=160){ for(const y of [1100,600]) g.fillRect(x-3,y-3,6,6); } for(let x=740;x<1000;x+=120) g.fillRect(x-3,1150-3,6,6);   // piliers
    g.fillStyle='#4d7c0f'; for(const [x,y] of [[6,1000],[634,1000],[6,700],[634,705],[666,1100],[994,1100],[300,1232],[340,1232]]){ g.beginPath(); g.arc(x,y,5,0,6.283); g.fill(); } }   // plantes
  { const gr=g.createLinearGradient(0,-4,0,8); gr.addColorStop(0,'#7dd3fc'); gr.addColorStop(1,'rgba(125,211,252,0)'); g.fillStyle=gr; g.fillRect(0,-3,1000,11);   // façade vitrée
    g.strokeStyle='#0ea5e9'; g.lineWidth=3; g.beginPath(); if(TH.facade==='courbe'){ g.moveTo(0,0); g.quadraticCurveTo(500,-26,1000,0); } else if(TH.facade==='dents'){ for(let x=0;x<=1000;x+=50){ g.lineTo(x,x%100?-10:0); } } else { g.moveTo(0,0); g.lineTo(1000,0); } g.stroke();
    g.fillStyle='rgba(30,41,59,.25)'; g.beginPath(); if(TH.canopy==='ondule'){ g.moveTo(0,1236); for(let x=0;x<=1000;x+=25) g.lineTo(x,1242+Math.sin(x/40)*5); g.lineTo(1000,1236); } else if(TH.canopy==='arcs'){ g.moveTo(0,1236); for(let x=0;x<1000;x+=100) g.quadraticCurveTo(x+50,1256,x+100,1236); } else { g.rect(0,1236,1000,10); } g.fill(); }   // auvent du parvis
  // décor propre à l'aéroport : dans le hall des arrivées et le hall d'enregistrement
  { const dx=830, dy=1112; if(TH.deco==='fontaine'){ g.fillStyle='#bae6fd'; g.beginPath(); g.arc(dx,dy,22,0,6.283); g.fill(); g.strokeStyle='#64748b'; g.lineWidth=2; g.stroke(); g.strokeStyle='rgba(255,255,255,.8)'; g.lineWidth=1; for(let k=0;k<3;k++){ g.beginPath(); g.arc(dx,dy,6+k*5+((now/300)%5),0,6.283); g.stroke(); } }
    else if(TH.deco==='palmiers'){ for(const [x,y] of [[dx-24,dy],[dx+24,dy],[dx,dy-18],[310,1206]]){ g.fillStyle='#78350f'; g.beginPath(); g.arc(x,y,3,0,6.283); g.fill(); g.fillStyle='#15803d'; for(let a=0;a<6;a++){ g.beginPath(); g.ellipse(x+Math.cos(a)*8,y+Math.sin(a)*8,9,3.5,a,0,6.283); g.fill(); } } }
    else if(TH.deco==='jardin'){ g.fillStyle='#86efac'; g.fillRect(dx-34,dy-16,68,32); g.fillStyle='#166534'; for(let k=0;k<9;k++){ g.beginPath(); g.arc(dx-28+k*7,dy-8+((k*5)%16),3.5,0,6.283); g.fill(); } g.fillStyle='#a8a29e'; g.fillRect(dx-2,dy-16,4,32); }
    else if(TH.deco==='ecran'){ g.fillStyle='#0f172a'; g.fillRect(dx-40,dy-14,80,28); const hue=(now/80)%360; g.fillStyle=`hsl(${hue},70%,55%)`; g.fillRect(dx-36,dy-10,72,20); if(s>0.8){ g.fillStyle='#fff'; g.font='700 7px system-ui'; g.fillText('Bienvenue à '+TH.city,dx-34,dy+3); } }
    else if(TH.deco==='fresque'){ const cols=['#dc2626','#facc15','#16a34a','#2563eb','#ea580c']; for(let k=0;k<5;k++){ g.fillStyle=cols[k]; g.fillRect(668+k*66,1196,62,10); } }
    else { g.fillStyle=TH.acc; g.beginPath(); g.moveTo(dx,dy-24); g.lineTo(dx+18,dy+14); g.lineTo(dx-18,dy+14); g.closePath(); g.fill(); g.fillStyle='#e7e5e4'; g.beginPath(); g.arc(dx,dy+2,6,0,6.283); g.fill(); } }
  // tapis des salles d'embarquement (couleur de l'aéroport)
  g.fillStyle=TH.carpet; g.globalAlpha=0.12; g.fillRect(0,40,640,360); g.globalAlpha=1;
  // formes du bâtiment : jetée, satellite avec navette, aile en L
  { const wall=(x0,y0,x1,y1)=>{ g.fillStyle='rgba(0,0,0,.14)'; g.fillRect(x0+3,y0+3,x1-x0,y1-y0); g.fillStyle=TH.floor; g.fillRect(x0,y0,x1-x0,y1-y0); g.strokeStyle='#57534e'; g.lineWidth=3; g.strokeRect(x0,y0,x1-x0,y1-y0); };
    if(L.shape==='jetee'){ const ye=L.pierEnd||-140; wall(260,ye,380,0); g.fillStyle='#57534e'; g.fillRect(150,ye,110,-ye); g.fillRect(380,ye,110,-ye); for(const d of L.deps){ g.fillStyle=TH.floor; g.fillRect(d.lounge.x0,d.lounge.y0,d.lounge.x1-d.lounge.x0,d.lounge.y1-d.lounge.y0); }
      g.fillStyle='rgba(148,163,184,.5)'; for(let y=ye+20;y<-10;y+=40) g.fillRect(300,y,40,14);   // tapis roulants de la jetée
      TM.signs.push(['🛬 Jetée — portes des deux côtés',268,ye+8]); TM.signs.push(['🚶 Hall vers la jetée',12,40]); }
    else if(L.shape==='satellite'){ const sxa=(L.satX||[100,540]); wall(sxa[0],-700,sxa[1],-460); wall(300,-460,340,0); const k=(now/26000)%2, ty=-456+(k<1?k:2-k)*440; g.fillStyle='#e5e7eb'; g.fillRect(304,ty,32,30); g.fillStyle=TH.acc; g.fillRect(304,ty+4,32,6); g.fillStyle='#38bdf8'; g.fillRect(306,ty+14,28,8);   // navette automatique
      TM.signs.push(['🛰️ Satellite',sxa[0]+10,-450]); TM.signs.push(['🚝 Navette automatique',346,-240]); TM.signs.push(['🛍️ Hall de transfert vers le satellite',12,40]); }
    else if(L.shape==='L'){ wall(-420,0,0,410); TM.signs.push(['📐 Aile des portes',-410,396]); } }
  // portes au départ
  for(const d of L.deps){ const f=d.f, D=f.D, sel=TM.selF===f; const lg=d.lounge; g.fillStyle=f.col; g.globalAlpha=sel?0.28:0.13; g.fillRect(lg.x0,lg.y0,lg.x1-lg.x0,lg.y1-lg.y0); g.fillRect(d.cx0,1000,d.cx1-d.cx0,160); g.globalAlpha=1;
    g.strokeStyle='#94a3b8'; g.lineWidth=1; g.strokeRect(lg.x0,lg.y0,lg.x1-lg.x0,lg.y1-lg.y0);
    g.fillStyle='rgba(100,116,139,.45)'; if(TH.seat==='ilots'){ for(const p of d.seats){ g.beginPath(); g.arc(p.x,p.y,2.6,0,6.283); g.fill(); } } else for(const p of d.seats) g.fillRect(p.x-3,p.y-2,6,4);
    if(s>0.9){ g.strokeStyle='rgba(30,41,59,.25)'; g.lineWidth=0.6; const P=d.bq.pts; g.beginPath(); for(let k=0;k<P.length;k+=2){ g.moveTo(P[k].x,P[k].y+5); g.lineTo(P[k+1]?P[k+1].x:P[k].x,P[k].y+5); } g.stroke(); }
    g.fillStyle='#334155'; g.fillRect(d.desk.x-14,d.desk.y-4,28,8); 
    g.fillStyle='#0f172a'; g.fillRect(d.x0+4,d.lounge.y0+60,Math.min(46,d.x1-d.x0-8),12); if(s>1.2){ g.fillStyle='#22c55e'; font(6,1); g.fillText((D.B.city+' '+tmHM(D.P)).slice(0,14),d.x0+6,d.lounge.y0+69); }   // écran de porte
    { const pl=tmDepPlane(d,now), st=d.stand, n={x:-Math.sin(st.a),y:Math.cos(st.a)}, nx=st.x+n.x*2, ny=st.y+n.y*2;
      g.strokeStyle='#64748b'; g.lineWidth=10; g.beginPath(); if(pl&&pl.at){ g.moveTo(d.door.x,d.door.y); g.lineTo(nx,ny); } else { g.moveTo(d.door.x,d.door.y); g.lineTo(d.door.x+(nx-d.door.x)*0.25,d.door.y+(ny-d.door.y)*0.25); } g.stroke();   // passerelle
      if(pl){ g.save(); g.translate(pl.x,pl.y); g.rotate(pl.a);
        if(pl.at){ if(now>D.ci.open+30*MIN&&now<D.P-3*MIN){ g.fillStyle='#facc15'; g.fillRect(24,16,8,6); g.fillStyle='#9ca3af'; for(let k=0;k<3;k++) g.fillRect(34+k*9,16,7,6); } if(now>D.gate.open-35*MIN&&now<D.gate.open-5*MIN){ g.fillStyle='#dc2626'; g.fillRect(-44,-24,10,18); } }
        if(pl.push){ g.fillStyle='#facc15'; g.fillRect(-4,2,8,10); } g.restore(); tmPlane(g,pl.x,pl.y,f.col,pl.a); } }
    txt(`${D.gate.name} → ${D.B.city}`,d.x0+4,d.lounge.y0+16,11,'#0f172a',1); txt(`${tmHM(D.P)} · ${f.fn}${tmDelay(f)?' · retard':''}`,d.x0+4,d.lounge.y0+30,10,tmDelay(f)?'#b91c1c':'#334155');
    g.fillStyle='#1f2937'; g.fillRect(d.ck.x0,d.ck.y-6,d.ck.x1-d.ck.x0,10); g.fillStyle='#78716c'; g.fillRect(d.ck.x0,d.ck.y-16,d.ck.x1-d.ck.x0,6);
    if(s>0.7){ g.strokeStyle='rgba(30,41,59,.35)'; g.lineWidth=0.8; const P=d.q.pts; g.beginPath(); for(let k=0;k<P.length;k+=2){ g.moveTo(P[k].x,P[k].y+8); g.lineTo(P[k+1]?P[k+1].x:P[k].x,P[k].y+8); } g.stroke(); }
    txt('→ '+D.B.city,d.cx0+4,1172,10,'#0f172a',1); }
  // arrivées : jetée, tapis roulant, couloir national, barrière d'accueil, taxis
  g.fillStyle='#cbd5e1'; g.fillRect(668,176,322,20); g.fillStyle='#94a3b8'; for(let x=672;x<820;x+=14){ const o=(now/400)%14; g.fillRect(x+o,182,6,8); } for(let x=830;x<986;x+=14){ const o=(now/400)%14; g.fillRect(x+14-o,182,6,8); }
  txt('⇢ tapis roulant ⇠',800,172,9,'#334155',1);
  g.fillStyle='#1e3a8a'; g.fillRect(676,322,128,10); g.fillRect(822,322,130,10); txt('🇨🇩 Passeports nationaux',678,330,7,'#fff',1); txt('🌍 Passeports étrangers',824,330,7,'#fff',1);
  if(s>0.7){ g.strokeStyle='rgba(30,41,59,.3)'; g.lineWidth=0.7; for(const P of [L.immQn.pts,L.immQf.pts]){ g.beginPath(); for(let k=0;k<P.length;k+=2){ g.moveTo(P[k].x,P[k].y+7); g.lineTo(P[k+1]?P[k+1].x:P[k].x,P[k].y+7); } g.stroke(); } }
  g.fillStyle='#e2e8f0'; g.fillRect(968,232,30,190); txt('🇨🇩 Nat.',970,250,8,'#334155',1);
  g.fillStyle='#57534e'; g.fillRect(660,998,146,4); g.fillRect(854,998,146,4); txt('🚪 Sortie des arrivées',808,994,9,'#0f172a',1);
  g.fillStyle='#78716c'; g.fillRect(666,1236,334,4);
  for(let k=0;k<7;k++){ const ph=(now/90000+k*0.31)%1, x=700+k*42+(ph<0.12?ph*800:0); if(x<1000){ g.fillStyle=k%3===2?'#f8fafc':'#facc15'; g.fillRect(x-9,1278,18,10); g.fillStyle='#1f2937'; g.fillRect(x-6,1280,12,3); } }   // taxis
  for(const a of L.arrs){ const f=a.f, b=a.belt; { const pl=tmArrPlane(a,now); g.fillStyle='#64748b'; if(pl&&pl.at) g.fillRect(a.door.x-5,-60,10,98); else g.fillRect(a.door.x-5,-14,10,52); if(pl) tmPlane(g,pl.x,pl.y,f.col,pl.a); }
    txt(f.D.A.city,a.x0+2,60,10,'#0f172a',1);
    g.strokeStyle='#334155'; g.lineWidth=10; g.beginPath(); g.ellipse(b.cx,b.cy,b.rx,b.ry,0,0,6.283); g.stroke(); g.strokeStyle=f.col; g.lineWidth=2; g.stroke();
    g.fillStyle='#0f172a'; g.fillRect(b.cx-30,b.cy-b.ry-24,60,13); if(s>1.1){ g.fillStyle=now>f.D.bag.first&&now<f.D.bag.last?'#22c55e':'#facc15'; font(6,1); g.fillText(('Tapis '+b.n+' '+f.fn+' '+f.D.A.city).slice(0,22),b.cx-28,b.cy-b.ry-15); } else txt('Tapis '+b.n,b.cx-14,b.cy-b.ry-14,9,'#facc15',1); }
  // équipements et commerces
  for(const p of L.poi){ const col={kiosk:'#0ea5e9',xray:'#475569',arch:'#94a3b8',booth:'#7c3aed',egate:'#6d28d9',wc:'#cbd5e1',cafe:'#fde68a',resto:'#fed7aa',dutyfree:'#fbcfe8',pharma:'#bbf7d0',press:'#e9d5ff',prayer:'#e0e7ff',seats:'#f1f5f9',info:'#bae6fd',green:'#86efac',red:'#fca5a5',change:'#fde68a',taxi:'#facc15',car:'#cbd5e1',lost:'#fecaca',lounge:'#d6d3d1',fids:'#0f172a',health:'#fef08a',trolley:'#d1d5db',xrayc:'#475569'}[p.k]||'#e5e7eb';
    g.fillStyle=col; g.fillRect(p.x0,p.y0,p.x1-p.x0,p.y1-p.y0); g.strokeStyle='rgba(51,65,85,.5)'; g.lineWidth=0.6; g.strokeRect(p.x0,p.y0,p.x1-p.x0,p.y1-p.y0);
    if(p.k==='resto'||p.k==='cafe'){ g.fillStyle='rgba(120,53,15,.35)'; for(let x=p.x0+10;x<p.x1-6;x+=18) for(let y=p.y0+16;y<p.y1-6;y+=16){ g.beginPath(); g.arc(x,y,3.5,0,6.283); g.fill(); } }
    if(p.k==='seats'||p.k==='lounge'){ g.fillStyle='rgba(100,116,139,.4)'; for(let y=p.y0+12;y<p.y1-4;y+=12) g.fillRect(p.x0+8,y,p.x1-p.x0-16,3); }
    if(p.k==='xray'&&s>0.8){ g.fillStyle='#1e293b'; g.fillRect(p.x0+18,p.y0+3,24,10); g.fillStyle='#64748b'; for(let k=0;k<3;k++) g.fillRect(p.x0+2+((now/1500+k*7)%16),p.y0+5,4,6); }   // bacs qui avancent
    if(p.k==='fids'&&s>1){ for(let k=0;k<3;k++){ g.fillStyle=['#facc15','#22c55e','#38bdf8'][k]; g.fillRect(p.x0+3,p.y0+3+k*3.5,(p.x1-p.x0)*0.6,1.5); } continue; }
    const big=p.x1-p.x0>45, nm=p.lab.split(' (')[0].split(' —')[0];
    if(big&&!['seats','fids'].includes(p.k)){ const px=Math.max(5,Math.min(10,9.5/s)); g.font=`700 ${px}px system-ui`; const t=p.ico+' '+nm, w=Math.min(p.x1-p.x0-4,g.measureText(t).width+px*0.6); g.fillStyle='rgba(255,255,255,.88)'; g.fillRect(p.x0+2,p.y0+2,w,px*1.35); g.fillStyle='#111827'; g.save(); g.beginPath(); g.rect(p.x0+2,p.y0+2,w,px*1.4); g.clip(); g.fillText(t,p.x0+2+px*0.3,p.y0+2+px*1.05); g.restore(); }
    else if(s>1.2) txt(p.ico,p.x0+2,p.y0+12,9); }
  // enseignes des zones (lisibles à toutes les échelles) + compteurs d'activité en vue générale
  { const C2=TM.cnt||{}, badge={'🎫':C2.ck,'🔍':C2.sec,'🛂':null,'🧳':C2.belt}; for(const [t,x,y] of TM.signs){ const k=t.split(' ')[0], v=t.startsWith('🛂 Police')?C2.pol:t.startsWith('🛂 Immigration')?C2.imm:badge[k]; sign(t+(s<1.1&&v?` · ${v} en file`:''),x,y); } }
  sign(`${TH.flag} ${TH.name}`,8,1240,'#0f172a');
  // valises : tapis, tri, soutes, tapis de livraison
  for(const b of TM.bags||[]){ let q=null;
    if(now>=b.t0&&now<b.t0+b.dur) q=tmPathAt(b.P,(now-b.t0)/b.dur);
    else if(b.belt&&now>=b.t0+b.dur&&now<b.pick){ const an=(now-b.tB)/26000+(b.p.i%10)*0.63; q={x:b.belt.cx+Math.cos(an)*b.belt.rx,y:b.belt.cy+Math.sin(an)*b.belt.ry}; }
    if(!q) continue; g.fillStyle=b.c; g.fillRect(q.x-3,q.y-2.4,6,4.8); }
  // incidents en cours
  for(const x of TM.inc||[]) if(now>=x.at&&now<x.at+20*MIN){ const pr=3+Math.sin(now/300)*1.5; g.fillStyle='rgba(239,68,68,.85)'; g.beginPath(); g.arc(x.x,x.y,7+pr,0,6.283); g.fill(); txt('!',x.x-2,x.y+4,11,'#fff',1); }
  // passagers (animés)
  let n=0, nd=0, na=0; const pts=[], cnt={ck:0,sec:0,pol:0,board:0,imm:0,belt:0}, r00=Math.max(2.2,Math.min(5,3.6/Math.sqrt(Math.max(0.3,s)))), vx0=c.x-10, vy0=c.y-10, vx1=c.x+w/s+10, vy1=c.y+h/s+10, legs=s>1.4;
  for(const p of TM.ppl){ const q=tmAt(p.K,now); if(!q) continue; if(p.staff){ cnt.staff=(cnt.staff||0)+1; } else if(p.greet){ cnt.greet=(cnt.greet||0)+1; } else { n++; p.dep?nd++:na++; }
    if(q.q){ const t=q.st; if(/enregistrement/.test(t)) cnt.ck++; else if(/sûreté/.test(t)) cnt.sec++; else if(/police/.test(t)) cnt.pol++; else if(/embarquement/.test(t)) cnt.board++; else if(/passeports/.test(t)) cnt.imm++; } else if(/attend sa valise/.test(q.st)) cnt.belt++;
    const x=q.x+((p.i*13)%7-3)*0.7, y=q.y+((p.i*7)%5-2)*0.7; pts.push([x,y,p,q]); if(x<vx0||x>vx1||y<vy0||y>vy1) continue;
    if(s<0.38){ g.fillStyle=p.c; g.fillRect(x-2.2,y-2.2,4.4,4.4); continue; }
    const r0=p.kid?r00*0.7:r00, ph=q.walk?Math.sin(now/140+p.i):0;
    g.fillStyle='rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(x,y+r0*1.6,r0*1.1,r0*0.45,0,0,6.283); g.fill();
    if(legs&&!q.sit){ g.strokeStyle='#1f2937'; g.lineWidth=r0*0.35; g.beginPath(); g.moveTo(x-r0*0.3,y+r0*0.8); g.lineTo(x-r0*0.3+ph*r0*0.5,y+r0*1.7); g.moveTo(x+r0*0.3,y+r0*0.8); g.lineTo(x+r0*0.3-ph*r0*0.5,y+r0*1.7); g.stroke(); }
    g.fillStyle=p.c; g.beginPath(); g.ellipse(x,y+(q.sit?r0*0.3:0),r0*0.95,q.sit?r0*0.9:r0*1.35,0,0,6.283); g.fill(); if(s>0.9){ g.strokeStyle='rgba(15,23,42,.45)'; g.lineWidth=Math.min(0.8,0.6/s*1.5); g.stroke(); }
    g.fillStyle=p.sk; g.beginPath(); g.arc(x,y-r0*1.25,r0*0.7,0,6.283); g.fill();
    if(p.staff){ g.fillStyle=p.staff==='clean'?'#fbbf24':p.staff==='health'?'#16a34a':'#0f172a'; g.fillRect(x-r0*0.75,y-r0*1.95,r0*1.5,r0*0.45); if(p.staff==='sec'||p.staff==='clean'){ g.fillStyle='#facc15'; g.fillRect(x-r0*0.9,y-r0*0.2,r0*1.8,r0*0.25); } }   // casquette, bande
    if(p.sign&&s>0.9&&!q.walk){ g.fillStyle='#fff'; g.fillRect(x-r0*1.6,y-r0*3.4,r0*3.2,r0*1.3); g.strokeStyle='#334155'; g.lineWidth=0.4; g.strokeRect(x-r0*1.6,y-r0*3.4,r0*3.2,r0*1.3); }
    if(!p.dep&&p.hasBag&&now>=p.bagT&&s>1.1){ g.fillStyle='#9ca3af'; g.fillRect(x-r0*1.4,y+r0*1.0,r0*2.8,r0*0.9); }   // chariot
    const carry=s>1.3&&(p.dep?(p.bag&&now<p.ckDone):(p.hasBag&&now>=p.bagT));
    if(carry){ g.fillStyle='#1f2937'; g.fillRect(x+r0*1.1,y-r0*0.2,r0*0.9,r0*1.3); } }
  TM.pts=pts; TM.cnt=cnt;
  if(TM.heat){ const G2={}; for(const z of pts){ if(z[2].staff) continue; const k=Math.floor(z[0]/40)+','+Math.floor(z[1]/40); G2[k]=(G2[k]||0)+1; }
    for(const [k,v] of Object.entries(G2)){ const [cx,cy]=k.split(',').map(Number), a=Math.min(0.75,v/25); g.fillStyle=v>18?`rgba(239,68,68,${a})`:v>8?`rgba(249,115,22,${a})`:`rgba(250,204,21,${a*0.8})`; g.fillRect(cx*40,cy*40,40,40); } }
  if(TM.dash&&(!TM.dashAt||performance.now()-TM.dashAt>1500)){ TM.dashAt=performance.now(); tmDash(); }
  if(TM.sel){ const hit=pts.find(z=>z[2]===TM.sel); if(hit){ g.strokeStyle='#ef4444'; g.lineWidth=2/s; g.beginPath(); g.arc(hit[0],hit[1],10/s+4,0,6.283); g.stroke(); const q=hit[3], p=hit[2];
      if(!TM.selAt||performance.now()-TM.selAt>700){ TM.selAt=performance.now(); const sc=p.dep&&TM.L.deps.find(d=>d.f===p.f), zz=sc&&sc.sched[p.i];
        if(p.staff){ tmInfo(`<b>${p.staff==='clean'?'🧹':p.staff==='sec'?'🛡️':p.staff==='cus'?'🛃':p.staff==='pol'||p.staff==='imm'||p.staff==='patrol'?'👮':p.staff==='health'?'🩺':'🧑‍💼'} ${TM_ROLE[p.staff][1]}</b><br>En ce moment : <b>${esc(q.st)}</b>`); } else if(p.greet){ tmInfo(`<b>🤗 Accueille un passager</b><br>Vol ${esc(p.f.fn)} de ${esc(p.f.D.A.city)}<br>En ce moment : <b>${esc(q.st)}</b>`); } else if(p.row){ const w=p.row, cl={f:'👑 Première',j:'💼 Affaires',w:'💺 Premium',y:'💺 Économique'}[w.cls]||'';
          tmInfo(`<div style="display:flex;gap:8px;align-items:center"><div style="font-size:30px">${w.avatar||'🧍'}</div><div><b>${esc(w.first)} ${esc(w.last)}</b> · ${w.age} ans ${COUNTRIES[w.nat]?COUNTRIES[w.nat][2]:''}<br><span class="small">${esc(w.job)}</span></div></div>`+
            `Vol <b>${esc(p.f.fn)}</b>${p.f.reg?' · '+esc(p.f.reg):''} · ${p.dep?esc(p.f.D.A.city)+' → '+esc(p.f.D.B.city):'arrivé de '+esc(p.f.D.A.city)}<br>Siège <b>${esc(w.seat)}</b> · ${cl}${zz?` · embarquement ${zz.zone===0?'prioritaire':'zone '+zz.zone}`:''}<br>🧳 ${w.bags?w.bags+' bagage'+(w.bags>1?'s':'')+' en soute':'bagage cabine seulement'}${w.assist?' · ♿ '+esc(w.assist):''}<br><span class="small mut">${esc(w.story||'')}</span><br>En ce moment : <b>${esc(q.st)}</b>`+
            (p.f.acId&&(p.f.riv||(p.f.l&&p.f.l===((S.fleet.find(a=>a.id===p.f.acId)||{}).flight||{legs:[]}).legs[(S.fleet.find(a=>a.id===p.f.acId)||{flight:{li:0}}).flight.li]))?`<br><button class="btn" data-tmcard="${esc(p.f.acId)}|${p.i}" style="margin-top:6px">🪪 Fiche complète</button>`:'')); const bt=document.querySelector('[data-tmcard]'); if(bt) bt.onclick=()=>{ const [id,ii]=bt.dataset.tmcard.split('|'); tmClose(); try{ ACTIONS.paxCard({id,i:ii}); }catch(e){} }; }
        else tmInfo(`<b>🧍 Passager${p.kid?' (enfant)':''}${p.f.riv?' · '+esc(p.f.riv.name||''):''}</b><br>Vol ${esc(p.f.fn)} · ${p.dep?esc(p.f.D.A.city)+' → '+esc(p.f.D.B.city):'arrivé de '+esc(p.f.D.A.city)}${zz?` · embarquement ${zz.zone===0?'prioritaire':'zone '+zz.zone}`:''}<br>${p.bag||p.hasBag?'🧳 bagage en soute':'🎒 bagage cabine seulement'}<br>En ce moment : <b>${esc(q.st)}</b>`); } } else { TM.sel=null; tmInfo(''); } }
  if(TM.sel&&TM.selAt&&performance.now()-TM.selAt<30&&!TM.sel.staff) tmAfterSel(TM.sel,now);
  tmAnnounce(now);
  const hd=document.getElementById('tmCount'); if(hd&&(!TM.cAt||performance.now()-TM.cAt>800)){ TM.cAt=performance.now(); const W=L.W||{};
    hd.innerHTML=`${document.getElementById('tmBoard')&&document.getElementById('tmBoard').hidden?'▼':'▲'} 👥 ${n.toLocaleString('fr-FR')} personnes · ${nd} départ · ${na} arrivée · ${tmHM(now)}<br><span style="color:#cbd5e1;font-weight:500">🎫 ${cnt.ck} en file (~${tmWait(W.ck||[],now)} min) · 🔍 ${cnt.sec} (~${tmWait(W.sec||[],now)} min) · 🛂 ${cnt.pol} (~${tmWait(W.pol||[],now)} min) · 🚪 ${cnt.board} · 🛂 arrivées ${cnt.imm} · 🧳 ${cnt.belt} au tapis · 🤗 ${cnt.greet||0} accueillent · 👮 ${cnt.staff||0} agents</span>`; if(Math.random()<0.15) tmBoard(); }
}
function tmOpen(code){
  code=code||tmNearest(); if(!code||typeof pfData!=='function') return; TM.code=code; TM.th=null; TM.open=true; TM.sel=null; TM.selF=null; TM.built=0; TM.cam=null; TM.goal=null; TM.moved=0; TM.dpr=Math.min(2,window.devicePixelRatio||1);
  let ov=document.getElementById('tmOv'); if(ov) ov.remove();
  ov=document.createElement('div'); ov.id='tmOv'; const A=AP(code);
  ov.innerHTML=`<style>#tmOv{position:fixed;inset:0;z-index:2000;background:#0b1220;display:flex;flex-direction:column;color:#e2e8f0;padding-top:env(safe-area-inset-top)}
#tmOv header{display:flex;align-items:center;gap:6px;padding:6px 8px}#tmOv header b{font:700 14px system-ui;flex:1}#tmOv header button{min-width:40px;padding:6px}
#tmZones{display:flex;gap:5px;overflow-x:auto;padding:0 8px 6px;-webkit-overflow-scrolling:touch}#tmZones button{white-space:nowrap;font:600 12px system-ui;padding:5px 9px;border-radius:14px}
#tmBoard{max-height:17vh;overflow:auto;padding:0 8px 4px;font:12px system-ui}#tmBoard table{width:100%;border-collapse:collapse;margin-bottom:4px}#tmBoard th{text-align:left;color:#facc15;font-weight:600;font-size:11px}
#tmBoard tr[data-tmf]{cursor:pointer}#tmBoard td{padding:2px 4px;border-top:1px solid rgba(148,163,184,.15);font-family:ui-monospace,monospace;font-size:11px}#tmBoard td i{display:inline-block;width:9px;height:9px;border-radius:2px}
#tmCount{padding:2px 8px 4px;font:600 12px system-ui;color:#93c5fd}#tmWrap{flex:1;position:relative;min-height:0}#tmCv{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
#tmSearch{padding:0 8px 6px;position:relative}#tmSearch input{width:100%;box-sizing:border-box;padding:7px 10px;border-radius:10px;border:1px solid rgba(148,163,184,.35);background:#111827;color:#fff;font:13px system-ui}
#tmRes{position:absolute;left:8px;right:8px;top:38px;z-index:5;background:#0f172a;border:1px solid rgba(148,163,184,.35);border-radius:10px;max-height:40vh;overflow:auto}#tmRes button{display:block;width:100%;text-align:left;padding:7px 10px;font:12px system-ui;border-radius:0}
#tmAnn{position:absolute;left:8px;right:8px;top:8px;background:rgba(250,204,21,.95);color:#111827;border-radius:10px;padding:6px 10px;font:600 12px system-ui;box-shadow:0 2px 8px rgba(0,0,0,.4)}
#tmInfo{position:absolute;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));background:rgba(8,14,26,.94);border:1px solid rgba(148,163,184,.35);border-radius:12px;padding:8px 10px;font:13px system-ui;max-height:40%;overflow:auto}</style>
<header><b>🏢 ${esc(A.city)} <span style="color:#94a3b8">${esc(code)}</span></b><button class="btn" data-tdash>📊</button><button class="btn" data-tsp>⏱️</button><button class="btn" data-tvo>🔈</button><button class="btn" data-tz="-">➖</button><button class="btn" data-tz="+">➕</button><button class="btn" data-tm="x">✖</button></header>
<div id="tmZones">${TM_ZONES.map((z,i)=>`<button class="btn" data-tzn="${i}">${z[0]}</button>`).join('')}</div><div id="tmSearch"><input type="search" placeholder="🔎 Chercher un passager : nom, vol, siège…" data-tms><div id="tmRes" hidden></div></div><div id="tmBoard"></div><div id="tmCount" title="Toucher pour replier / déplier le tableau"></div>
<div id="tmWrap"><canvas id="tmCv"></canvas><div id="tmAnn" hidden></div><div id="tmInfo" hidden></div></div>`;
  document.body.appendChild(ov); TM.cv=ov.querySelector('#tmCv');
  ov.querySelector('[data-tm="x"]').onclick=tmClose;
  { const cnt=ov.querySelector('#tmCount'), bd=ov.querySelector('#tmBoard'); cnt.style.cursor='pointer'; cnt.onclick=()=>{ bd.hidden=!bd.hidden; TM.moved=0; }; }
  ov.querySelector('[data-tdash]').onclick=()=>{ TM.dash=!TM.dash; TM.sel=null; TM.follow=null; TM.dashAt=0; if(!TM.dash) tmInfo(''); };
  // vitesse du temps (celle du jeu) et voix des annonces
  const SP=[['realiste','×1'],['lent','×30'],['standard','×60'],['rapide','×600']], spB=ov.querySelector('[data-tsp]'), lab=()=>{ const x=SP.find(z=>z[0]===S.speed); spB.textContent='⏱️ '+(x?x[1]:'×?'); }; lab();
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
if(typeof window!=='undefined') window.addEventListener('load',()=>{ setInterval(()=>{ try{ tmTick(); }catch(e){} },1000);
  try{ Object.assign(ACTIONS,{termOpen:d=>{ try{ closeModal(); }catch(e){} tmOpen(d&&d.code); }}); }catch(e){}
  // accès sans la 3D : fiche de chaque aéroport (carte 2D) et carte « Aérogare en direct » (onglet passagers)
  const btn=c=>`<button class="btn" data-act="termOpen" data-code="${esc(c)}" style="margin:4px 0">🏢 Voir l’intérieur de l’aérogare</button>`;
  if(typeof airportHtml==='function'){ const _a=airportHtml; airportHtml=function(code){ const h=_a.apply(this,arguments); try{ return btn(code)+h; }catch(e){ return h; } }; }
  if(typeof pfCardHtml==='function'){ const _p=pfCardHtml; pfCardHtml=function(){ const h=_p.apply(this,arguments);
      try{ const hubs=[...new Set([S.company.hub,...(S.hubs||[])])].filter(Boolean).slice(0,6);
        return `<div class="card"><b>🏢 Intérieur des aérogares</b> <span class="small mut">— la foule en direct, sans passer par la 3D</span><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${hubs.map(c=>`<button class="btn" data-act="termOpen" data-code="${esc(c)}">🏢 ${esc(AP(c).city)}</button>`).join('')}</div></div>`+h; }catch(e){ return h; } }; }
});
