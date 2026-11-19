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
      if(l.from===code&&now>=D.ci.open-5*MIN&&now<=D.P+3*MIN) deps.push({a,l,D,N,fn});
      if(l.to===code&&i===fl.li&&now>=D.arr-25*MIN&&now<D.arr) arrs.push({a,l,D,N,fn,soon:true}); }); }
  // vols déjà posés : leurs passagers sont encore dans l'aérogare (immigration, bagages, douane)
  try{ for(const x of (typeof pfArrivals==='function'?pfArrivals():[])){ const D=x.D; if(!D||!D.B||D.B.code!==code) continue; if(now>D.cus.close+15*MIN) continue;
      arrs.push({a:x.a||{id:D.key},l:null,D,N:D.total||0,fn:x.fno||x.fn||'',soon:false}); } }catch(e){}
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
/* ---------- PLAN DE L'AÉROGARE (coordonnées « monde » fixes : 1 unité ≈ 0,6 m) ----------
   x 0–640 : départs (bas → haut : parvis, hall d'enregistrement, sûreté, police / couloir national,
   zone d'embarquement avec commerces, portes) ; x 660–1000 : arrivées (haut → bas : couloir,
   immigration, salle des bagages, douane, hall des arrivées, parvis). Les avions sont au-dessus (y < 0).
   La taille de l'aéroport change l'équipement : petit aéroport = moins de bornes, de lignes de sûreté,
   de guichets, pas de duty free ; grand aéroport = salon business, plus de commerces. */
const TW={W:1000,H:1300,top:-170};
function tmPOI(cls){ const P=[], add=(k,x0,y0,x1,y1,lab,ico,o)=>{ const p={k,x0,y0,x1,y1,lab,ico,...(o||{})}; P.push(p); return p; };
  const small=cls<=2, big=cls>=4, nK=small?4:10, nL=small?3:6, nB=small?3:6, nA=small?3:5;
  for(let i=0;i<nK;i++){ const x=40+i*(560/nK); add('kiosk',x,1176,x+32,1192,'Borne d’enregistrement automatique','🖥️'); }
  add('info',560,1200,630,1228,'Comptoir d’information','ℹ️'); add('wc',8,1196,60,1228,'Toilettes (hall public)','🚻'); add('cafe',70,1198,170,1228,'Café du hall','☕');
  add('fids',250,1196,350,1210,'Écran des départs','📺');
  for(let i=0;i<nL;i++){ const bw=640/nL, x=bw*i+(bw-80)/2; add('xray',x,846,x+60,862,'Scanner à bagages (rayons X) — ligne '+(i+1),'🧳',{lane:i}); add('arch',x+64,840,x+80,868,'Portique de détection — ligne '+(i+1),'🚪',{lane:i}); }
  for(let i=0;i<nB;i++){ const x=340+i*(300/nB); add('booth',x,736,x+34,756,'Guichet de police aux frontières '+(i+1),'🛂'); }
  if(!small){ add('dutyfree',14,440,190,520,'Duty free (parfums, alcool, chocolat)','🛍️'); add('resto',310,440,470,540,'Restaurant','🍽️'); add('pharma',480,440,560,490,'Pharmacie','💊'); }
  add('cafe',200,440,300,500,'Café — viennoiseries','☕'); add('press',570,440,630,490,'Presse — librairie','📚');
  if(big){ add('lounge',480,500,630,590,'Salon business (accès réservé)','🛋️'); add('resto',14,530,190,590,'Restaurant rapide','🍔'); }
  add('wc',14,612,80,690,'Toilettes','🚻'); add('prayer',90,612,170,690,'Salle de prière','🕌'); add('wc',566,612,630,690,'Toilettes','🚻');
  add('seats',190,600,550,690,'Salle d’attente commune','💺'); add('fids',240,560,400,574,'Écran des départs','📺');
  for(let i=0;i<nA;i++){ const x=680+i*(240/nA); add('booth',x,300,x+32,318,'Guichet d’immigration '+(i+1),'🛂',{arr:1}); }
  if(!small) add('egate',930,296,990,322,'Sas automatiques (passeports biométriques)','🛂',{arr:1});
  add('lost',860,800,990,840,'Litiges bagages (valises perdues ou abîmées)','📋',{arr:1});
  add('green',680,880,830,900,'Douane — couloir vert (rien à déclarer)','🟢',{arr:1}); add('red',850,880,990,900,'Douane — couloir rouge (à déclarer)','🔴',{arr:1});
  add('wc',940,1010,995,1060,'Toilettes (arrivées)','🚻',{arr:1}); add('change',680,1010,760,1050,'Bureau de change','💱',{arr:1}); add('cafe',770,1010,860,1050,'Café des arrivées','☕',{arr:1});
  add('taxi',680,1240,990,1270,'Station de taxis','🚕',{arr:1}); add('car',870,1010,930,1050,'Location de voitures','🚗',{arr:1});
  return {P,nL,nB,nA,small,big}; }
// file d'attente en serpentin dans un rectangle (entrée en bas → sortie en haut)
function tmSnake(x0,y0,x1,y1,rows){ const pts=[]; for(let r=0;r<rows;r++){ const y=y1-(r+0.5)*(y1-y0)/rows; if(r%2===0) pts.push({x:x0,y},{x:x1,y}); else pts.push({x:x1,y},{x:x0,y}); } return pts; }
function tmPath(pts){ let L=0; const seg=[]; for(let i=1;i<pts.length;i++){ const d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y); seg.push(d); L+=d; } return {pts,seg,L}; }
function tmPathAt(P,u){ let d=Math.max(0,Math.min(1,u))*P.L; for(let i=0;i<P.seg.length;i++){ if(d<=P.seg[i]){ const a=P.pts[i], b=P.pts[i+1], k=P.seg[i]?d/P.seg[i]:0; return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k}; } d-=P.seg[i]; } return P.pts[P.pts.length-1]; }
function tmLayout(F){
  const nd=Math.max(1,F.deps.length), na=Math.max(1,F.arrs.length), cls=(AP(TM.code)||{}).cls||3, Q=tmPOI(cls), L={poi:Q.P, nL:Q.nL, nB:Q.nB, small:Q.small, big:Q.big, deps:[], arrs:[]};
  F.deps.forEach((f,i)=>{ const bw=640/nd, x0=i*bw+3, x1=(i+1)*bw-3;
    const ck={x0:x0+4,x1:x1-4,y:1012}, q=tmPath(tmSnake(ck.x0+2,1032,ck.x1-2,1148,6).reverse());
    const lounge={x0,x1,y0:44,y1:392}, seats=[]; for(let yy=lounge.y0+92;yy<lounge.y1-30;yy+=16) for(let xx=x0+8;xx<x1-8;xx+=9) seats.push({x:xx,y:yy});
    const desk={x:(x0+x1)/2,y:lounge.y0+40}, bq=tmPath(tmSnake(x0+8,desk.y+10,x1-8,desk.y+44,2).reverse());   // file d'embarquement devant le comptoir de porte
    L.deps.push({f,x0,x1,ck,q,lounge,seats,desk,bq,door:{x:(x0+x1)/2,y:lounge.y0-2}}); });
  F.arrs.forEach((f,i)=>{ const bw=340/na, x0=660+i*bw+3, x1=660+(i+1)*bw-3, cx=(x0+x1)/2;
    L.arrs.push({f,x0,x1,door:{x:cx,y:38},belt:{cx:(i%2)?915:745,cy:500+Math.floor(i/2)*150,rx:60,ry:32,n:i+1}}); });
  L.secQ=tmPath(tmSnake(20,880,620,940,4).reverse()); L.polQ=tmPath(tmSnake(330,760,630,800,3).reverse()); L.immQ=tmPath(tmSnake(670,330,990,400,4).reverse());
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
      const x={i,tIn,online,bags,kiosk,r:r(),wc:r()<0.12,alarm:r()<0.1}; sc.push(x);
      if(online&&!bags){ x.ckStart=x.ckDone=tIn+MIN; } else ckL.push({x,arr:tIn+(kiosk?3.5:1.5)*MIN}); }
    tmServe(ckL,Math.max(1,Math.min(6,D.ci.desks||Math.ceil(f.N/55))),o=>(o.x.bags?2.2:1.4)*MIN*(0.7+0.6*o.x.r));
    for(const o of ckL){ o.x.ckStart=o.start; o.x.ckDone=o.done; W.ck.push([o.arr,o.start-o.arr]); }
    // embarquement par zones : priorité (affaires, familles), puis zones 1 à 4
    const win=Math.max(MIN,(D.gate.last-D.gate.open)/5);
    for(const x of sc){ x.zone=x.i<f.N*0.08?0:1+Math.floor((x.i/Math.max(1,f.N))*4); x.board=D.gate.open+x.zone*win+x.r*win*0.9;
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
  k.walk(s.x,s.y,'se rend à la porte '+D.gate.name).stay(board-1.5*MIN,'assis à la porte, attend l’appel ('+zl+')',1);
  k.queue(g.bq,board-12000,'file d’embarquement — '+zl).walk(g.desk.x+tmJ(r,-6,6),g.desk.y,'présente sa carte d’embarquement').stay(k.t+10000,'contrôle de la carte à la porte').walk(g.door.x,g.door.y,'embarque par la passerelle');
  k.K[k.K.length-1].out=1; return k.K; }
function tmArrKF(g,i,L,lost){
  const f=g.f, D=f.D, r=pfRng(D.key+'|tma'+i), N=Math.max(1,f.N), k=tmKF(), bags=r()<0.85, b=g.belt;
  k.at(D.arr+5*MIN+(i/N)*14*MIN,g.door.x,g.door.y,'descend de l’avion').walk(tmJ(r,g.x0+4,g.x1-4),220,'marche dans le couloir des arrivées');
  if(D.intl){ const e=!L.small&&r()<0.2, immB=Math.max(k.t+3*MIN,D.imm.open)+r()*Math.max(4*MIN,(D.imm.close-D.imm.open)*0.8);
    if(e){ const q=L.poi.find(p=>p.k==='egate'); k.walk(tmJ(r,q.x0,q.x1),q.y1+6,'sas automatique').stay(k.t+40000,'passe le sas biométrique'); }
    else{ const bs=L.poi.filter(p=>p.k==='booth'&&p.arr), bo=bs[Math.floor(r()*bs.length)]; k.queue(L.immQ,immB-MIN,'fait la queue à l’immigration').walk((bo.x0+bo.x1)/2,bo.y1+6,'au guichet d’immigration').stay(k.t+60000,'contrôle du passeport et du visa'); } }
  const an=r()*6.283, bp={x:b.cx+Math.cos(an)*(b.rx+10),y:b.cy+Math.sin(an)*(b.ry+10)};
  const bagT=bags?Math.max(k.t+2*MIN,D.bag.first+r()*(D.bag.last-D.bag.first)):k.t+MIN;
  k.walk(bp.x,bp.y,bags?'va au tapis n° '+b.n:'traverse la salle des bagages').stay(lost?D.bag.last+3*MIN:bagT,bags?'attend sa valise au tapis n° '+b.n:'sans bagage en soute');
  if(lost){ const q=tmIn(L.poi.find(p=>p.k==='lost'),r); k.walk(q.x,q.y,'⚠️ sa valise n’est pas arrivée').stay(k.t+(8+r()*8)*MIN,'⚠️ déclare sa valise perdue au comptoir litiges'); }
  const red=r()<0.06, ch=L.poi.find(p=>p.k===(red?'red':'green'));
  k.walk(tmJ(r,ch.x0+5,ch.x1-5),ch.y0-6,red?'couloir rouge : déclare des marchandises':'passe la douane (couloir vert)');
  if(red||r()<0.04) k.stay(k.t+(3+r()*6)*MIN,'🔎 contrôle des bagages par la douane');
  k.walk(tmJ(r,680,990),tmJ(r,1080,1200),'hall des arrivées'); if(r()<0.45) k.stay(k.t+(1+r()*5)*MIN,'retrouve sa famille');
  k.walk(tmJ(r,690,980),1262,'sort de l’aéroport (taxis, parking)'); k.K[k.K.length-1].out=1;
  return {K:k.K,bags:bags&&!lost,bagT}; }
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
      const P=tmPath([{x:cx,y:g.ck.y-16},{x:cx,y:978},{x:-14,y:978},{x:-14,y:-28},{x:g.door.x+20,y:-28},{x:g.door.x+20,y:-46}]); B.push({t0:x.ckDone,P,dur:P.L/3.2*1000,c:TM_BAGC[i%8],load:Math.min(D.P-3*MIN,x.ckDone+P.L/3.2*1000)}); }); }
  for(const a of L.arrs){ if(a.f.soon) continue; const b=a.belt; for(const p of TM.ppl) if(p.f===a.f&&p.bagT&&p.hasBag){ const tB=Math.max(a.f.D.bag.first,p.bagT-(1+((p.i*7)%5))*MIN);
      const P=tmPath([{x:a.door.x+20,y:-46},{x:a.door.x+20,y:-28},{x:1014,y:-28},{x:1014,y:b.cy},{x:b.cx+b.rx,y:b.cy}]), dur=P.L/3.2*1000; B.push({t0:tB-dur,P,dur,c:TM_BAGC[p.i%8],belt:b,tB,pick:p.bagT,p}); } }
  return B; }
function tmBuild(){ const F=tmFlights(TM.code), L=tmLayout(F), ppl=[];
  tmSched(L);
  L.deps.forEach((g,fi)=>{ g.f.col=TM_COL[fi%TM_COL.length]; for(let i=0;i<g.sched.length;i++) ppl.push({f:g.f,i,K:tmDepKF(g,i,L),c:g.f.col,sk:TM_SKIN[(i*7+fi)%TM_SKIN.length],dep:1,bag:g.sched[i].bags,ckDone:g.sched[i].ckDone,kid:i%9===4}); });
  L.arrs.forEach((g,fi)=>{ g.f.col=TM_COL[(fi+5)%TM_COL.length]; if(g.f.soon) return; const nLost=Math.min(3,g.f.D.bag&&g.f.D.bag.lost||0);
    for(let i=0;i<Math.min(g.f.N,1600);i++){ const R=tmArrKF(g,i,L,i<nLost); ppl.push({f:g.f,i,K:R.K,c:g.f.col,sk:TM_SKIN[(i*5+fi)%TM_SKIN.length],dep:0,bag:R.bags,hasBag:R.bags,bagT:R.bagT,kid:i%9===4}); } });
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
const TM_ZONES=[['🗺️ Vue générale',{x0:0,y0:-170,x1:1000,y1:1300}],['🎫 Enregistrement',{x0:0,y0:990,x1:640,y1:1300}],['🔍 Sûreté',{x0:0,y0:820,x1:640,y1:960}],['🛂 Police',{x0:300,y0:700,x1:640,y1:820}],
  ['🛍️ Boutiques',{x0:0,y0:420,x1:640,y1:700}],['🚪 Portes',{x0:0,y0:-170,x1:640,y1:400}],['🛬 Arrivées',{x0:660,y0:-170,x1:1000,y1:420}],['🧳 Bagages',{x0:660,y0:420,x1:1000,y1:860}],['🛃 Douane / sortie',{x0:660,y0:860,x1:1000,y1:1300}]];
function tmFocus(R){ const cv=TM.cv; if(!cv) return; const w=cv.clientWidth, h=cv.clientHeight, s=Math.min(w/(R.x1-R.x0),h/(R.y1-R.y0))*0.96;
  TM.goal={s,x:(R.x0+R.x1)/2-w/(2*s),y:(R.y0+R.y1)/2-h/(2*s)}; }
function tmCamStep(){ const c=TM.cam, g=TM.goal; if(!g) return; const k=0.18; c.s+=(g.s-c.s)*k; c.x+=(g.x-c.x)*k; c.y+=(g.y-c.y)*k; if(Math.abs(g.s-c.s)<g.s*0.002&&Math.abs(g.x-c.x)<0.5&&Math.abs(g.y-c.y)<0.5){ Object.assign(c,g); TM.goal=null; } }
function tmZoomAt(f,sx,sy){ const c=TM.cam, w=TM.cv.clientWidth, h=TM.cv.clientHeight, fit=Math.min(w/TW.W,h/(TW.H-TW.top)), ns=Math.max(fit*0.8,Math.min(fit*14,c.s*f)); const wx=c.x+sx/c.s, wy=c.y+sy/c.s; c.s=ns; c.x=wx-sx/ns; c.y=wy-sy/ns; TM.goal=null; }
/* ---------- informations (passager, vol, équipement) ---------- */
function tmInfo(html){ const el=document.getElementById('tmInfo'); if(!el) return; el.innerHTML=html?`<button class="btn" data-tmx style="float:right;padding:2px 8px">✖</button>${html}`:''; el.hidden=!html; const x=el.querySelector('[data-tmx]'); if(x) x.onclick=()=>{ TM.sel=null; TM.selF=null; tmInfo(''); }; }
function tmInfoFlight(g){ const f=g.f, D=f.D, now=tmNow(), st={}; for(const p of TM.ppl) if(p.f===f){ const q=tmAt(p.K,now); if(q) st[q.st]=(st[q.st]||0)+1; }
  const top=Object.entries(st).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>`<div>• ${v} ${esc(k)}</div>`).join('');
  const inc=(TM.inc||[]).filter(x=>x.f===f&&now>=x.at-2*MIN).map(x=>`<div style="color:#fca5a5">⚠️ ${String(x.t).replace(/<[^>]+>/g,'')}</div>`).join('');
  const bg=(TM.bags||[]).filter(b=>g.sched?b.load&&b.P.pts[5]&&Math.abs(b.P.pts[5].x-(g.door.x+20))<1:b.p&&b.p.f===f), loaded=g.sched?bg.filter(b=>now>=b.t0+b.dur).length:bg.filter(b=>now>=b.tB).length;
  tmInfo(`<b>✈️ ${esc(f.fn)}</b> ${f.riv?esc(f.riv.name||''):'(votre compagnie)'}<br>${esc(D.A.city)} → ${esc(D.B.city)} · ${f.N} passagers${D.intl?' · international':' · national'}<br>`+
    (g.sched?`Porte ${esc(D.gate.name)} · embarquement ${tmHM(D.gate.open)} · fermeture ${tmHM(D.gate.close)}${tmDelay(f)?` · <b style="color:#f87171">retard +${tmDelay(f)} min</b>`:''}<br>🧳 ${loaded}/${bg.length} valises chargées en soute<br>`:`🧳 ${loaded}/${bg.length} valises livrées sur le tapis ${g.belt.n}<br>`)+
    `<div class="small" style="margin-top:4px">${top||'Aucun passager dans l’aérogare pour l’instant.'}</div>${inc?'<div class="small" style="margin-top:4px">'+inc+'</div>':''}`); }
function tmInfoPOI(p){ let n=0; for(const z of TM.pts||[]){ const x=z[0], y=z[1]; if(x>=p.x0-40&&x<=p.x1+40&&y>=p.y0-40&&y<=p.y1+60) n++; }
  const now=tmNow(), W=TM.L.W||{}, wt=p.k==='xray'||p.k==='arch'?tmWait(W.sec||[],now):p.k==='booth'&&!p.arr?tmWait(W.pol||[],now):0;
  const extra={kiosk:'Imprime cartes d’embarquement et étiquettes bagages.',xray:'Bacs, ordinateurs et liquides scannés.',arch:'Alarme → palpation par un agent.',booth:'Passeport, visa, tampon de sortie ou d’entrée.',egate:'Pour les passeports biométriques.',green:'Passage libre, contrôles aléatoires.',red:'Déclaration obligatoire, fouille des bagages.',lost:'Déclaration de bagage perdu, indemnité, livraison à domicile.',lounge:'Réservé aux passagers en classe affaires.'}[p.k]||'';
  tmInfo(`<b>${p.ico} ${esc(p.lab)}</b><br>👥 environ ${n} personne${n>1?'s':''} autour en ce moment${wt?` · attente ~${wt} min`:''}${extra?'<br><span class="small">'+extra+'</span>':''}`); }
/* ---------- rendu (phase 4 : personnages animés, mobilier, avions) ---------- */
function tmPlane(g,x,y,col){ g.save(); g.translate(x,y); g.fillStyle='#f8fafc'; g.strokeStyle='#64748b'; g.lineWidth=1;
  g.beginPath(); g.ellipse(0,-50,7,52,0,0,6.283); g.fill(); g.stroke(); g.beginPath(); g.moveTo(-6,-58); g.lineTo(-52,-40); g.lineTo(-52,-34); g.lineTo(-6,-42); g.moveTo(6,-58); g.lineTo(52,-40); g.lineTo(52,-34); g.lineTo(6,-42); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-3,-96); g.lineTo(-18,-104); g.lineTo(-18,-100); g.lineTo(-2,-90); g.moveTo(3,-96); g.lineTo(18,-104); g.lineTo(18,-100); g.lineTo(2,-90); g.fill(); g.stroke();
  g.fillStyle='#94a3b8'; g.fillRect(-26,-52,6,10); g.fillRect(20,-52,6,10);   // réacteurs
  g.fillStyle=col; g.fillRect(-1.5,-102,3,12); g.fillRect(-7,-60,14,3); g.restore(); }
function tmDraw(){
  if(!TM.open) return; TM.raf=requestAnimationFrame(tmDraw);
  const cv=TM.cv; if(!cv) return; const w=cv.clientWidth, h=cv.clientHeight; if(!w||!h) return;
  if(cv.width!==Math.round(w*TM.dpr)||cv.height!==Math.round(h*TM.dpr)){ cv.width=Math.round(w*TM.dpr); cv.height=Math.round(h*TM.dpr); if(!TM.cam||!TM.moved){ TM.cam={s:1,x:0,y:0}; tmFocus(TM_ZONES[0][1]); Object.assign(TM.cam,TM.goal); TM.goal=null; } }
  if(!TM.built||performance.now()-TM.built>15000) tmBuild();
  tmCamStep(); const c=TM.cam, g=cv.getContext('2d'), L=TM.L, F=TM.F, now=tmNow(), s=c.s;
  g.setTransform(TM.dpr,0,0,TM.dpr,0,0); g.fillStyle='#1e293b'; g.fillRect(0,0,w,h);
  g.setTransform(TM.dpr*s,0,0,TM.dpr*s,-c.x*TM.dpr*s,-c.y*TM.dpr*s);
  const font=(px,b)=>{ g.font=`${b?'700 ':''}${px}px system-ui`; }, txt=(t,x,y,px,col,b)=>{ if(px*s<6) return; font(px,b); g.fillStyle=col||'#334155'; g.fillText(t,x,y); };
  // tarmac, chariots à bagages, avions
  g.fillStyle='#475569'; g.fillRect(-40,TW.top,1080,-TW.top+30); g.strokeStyle='#facc15'; g.lineWidth=1.2; g.setLineDash([10,8]); g.beginPath(); g.moveTo(-40,-130); g.lineTo(1040,-130); g.stroke(); g.setLineDash([]);
  g.strokeStyle='rgba(148,163,184,.6)'; g.lineWidth=3; g.beginPath(); g.moveTo(-14,978); g.lineTo(-14,-28); g.lineTo(1014,-28); g.lineTo(1014,700); g.stroke();   // circuit du tri bagages
  // bâtiment : sol carrelé, piliers, murs
  g.fillStyle='#e7e5e4'; g.fillRect(0,0,1000,1236); if(s>0.9){ g.strokeStyle='rgba(120,113,108,.12)'; g.lineWidth=0.5; g.beginPath(); for(let x=0;x<=1000;x+=20){ g.moveTo(x,0); g.lineTo(x,1236); } for(let y=0;y<=1236;y+=20){ g.moveTo(0,y); g.lineTo(1000,y); } g.stroke(); }
  g.fillStyle='#d6d3d1'; g.fillRect(0,1236,1000,64); txt('🚶 Parvis — dépose minute',8,1258,12,'#44403c',1);
  const zone=(x0,y0,x1,y1,col,lab,ico)=>{ g.fillStyle=col; g.fillRect(x0,y0,x1-x0,y1-y0); if(lab) txt((ico?ico+' ':'')+lab,x0+6,y0+14,12,'#0f172a',1); };
  zone(0,990,640,1236,'#f5f5f4','Hall d’enregistrement','🎫'); zone(0,820,640,965,'#dbeafe','Contrôle de sûreté','🔍'); zone(0,700,320,815,'#f1f5f9','Couloir — vols nationaux','🇨🇩');
  zone(320,700,640,815,'#ede9fe','Police aux frontières — zone internationale','🛂'); zone(0,420,640,700,'#fafaf9','Zone d’embarquement · commerces','🛍️'); zone(0,0,640,410,'#f8fafc','',null);
  zone(660,0,1000,240,'#f1f5f9','Couloir des arrivées','🛬'); zone(660,240,1000,420,'#ede9fe','Immigration','🛂'); zone(660,420,1000,860,'#f8fafc','Salle de livraison des bagages','🧳');
  zone(660,860,1000,960,'#dcfce7','Douane','🛃'); zone(660,960,1000,1236,'#fef9c3','Hall des arrivées · accueil','🤝');
  g.fillStyle='#57534e'; g.fillRect(640,0,20,1236); g.fillRect(0,410,640,10); g.fillRect(0,965,640,25); g.fillRect(0,815,640,5); g.fillRect(660,240,340,4); g.fillRect(660,420,340,4); g.fillRect(660,860,340,4); g.fillRect(660,960,340,4);
  g.fillStyle='#78716c'; g.fillRect(0,975,640,6); txt('↔ tapis vers le tri bagages',8,972,8,'#e7e5e4');
  if(s>0.8){ g.fillStyle='#a8a29e'; for(let x=80;x<640;x+=160){ for(const y of [1100,600]) g.fillRect(x-3,y-3,6,6); } for(let x=740;x<1000;x+=120) g.fillRect(x-3,1150-3,6,6);   // piliers
    g.fillStyle='#4d7c0f'; for(const [x,y] of [[6,1000],[634,1000],[6,700],[634,705],[666,1100],[994,1100],[300,1232],[340,1232]]){ g.beginPath(); g.arc(x,y,5,0,6.283); g.fill(); } }   // plantes
  g.strokeStyle='#38bdf8'; g.lineWidth=4; g.beginPath(); g.moveTo(0,1); g.lineTo(1000,1); g.stroke();
  // portes au départ
  for(const d of L.deps){ const f=d.f, D=f.D, sel=TM.selF===f; g.fillStyle=f.col; g.globalAlpha=sel?0.28:0.13; g.fillRect(d.x0,d.lounge.y0,d.x1-d.x0,d.lounge.y1-d.lounge.y0); g.fillRect(d.x0,1000,d.x1-d.x0,160); g.globalAlpha=1;
    g.strokeStyle='#94a3b8'; g.lineWidth=1; g.strokeRect(d.x0,d.lounge.y0,d.x1-d.x0,d.lounge.y1-d.lounge.y0);
    g.fillStyle='rgba(100,116,139,.45)'; for(const p of d.seats) g.fillRect(p.x-3,p.y-2,6,4);
    if(s>0.9){ g.strokeStyle='rgba(30,41,59,.25)'; g.lineWidth=0.6; const P=d.bq.pts; g.beginPath(); for(let k=0;k<P.length;k+=2){ g.moveTo(P[k].x,P[k].y+5); g.lineTo(P[k+1]?P[k+1].x:P[k].x,P[k].y+5); } g.stroke(); }
    g.fillStyle='#334155'; g.fillRect(d.desk.x-14,d.desk.y-4,28,8); g.fillStyle='#64748b'; g.fillRect(d.door.x-5,-60,10,62);
    g.fillStyle='#0f172a'; g.fillRect(d.x0+4,d.lounge.y0+60,Math.min(46,d.x1-d.x0-8),12); if(s>1.2){ g.fillStyle='#22c55e'; font(6,1); g.fillText((D.B.city+' '+tmHM(D.P)).slice(0,14),d.x0+6,d.lounge.y0+69); }   // écran de porte
    if(now>D.gate.open-40*MIN&&now<D.P+2*MIN) tmPlane(g,d.door.x,-60,f.col);
    txt(`${D.gate.name} → ${D.B.city}`,d.x0+4,d.lounge.y0+16,11,'#0f172a',1); txt(`${tmHM(D.P)} · ${f.fn}${tmDelay(f)?' · retard':''}`,d.x0+4,d.lounge.y0+30,10,tmDelay(f)?'#b91c1c':'#334155');
    g.fillStyle='#1f2937'; g.fillRect(d.ck.x0,d.ck.y-6,d.ck.x1-d.ck.x0,10); g.fillStyle='#78716c'; g.fillRect(d.ck.x0,d.ck.y-16,d.ck.x1-d.ck.x0,6);
    if(s>0.7){ g.strokeStyle='rgba(30,41,59,.35)'; g.lineWidth=0.8; const P=d.q.pts; g.beginPath(); for(let k=0;k<P.length;k+=2){ g.moveTo(P[k].x,P[k].y+8); g.lineTo(P[k+1]?P[k+1].x:P[k].x,P[k].y+8); } g.stroke(); }
    txt('→ '+D.B.city,d.x0+4,1172,10,'#0f172a',1); }
  for(const a of L.arrs){ const f=a.f, b=a.belt; g.fillStyle='#64748b'; g.fillRect(a.door.x-5,-60,10,98); if(f.soon?now>f.D.arr-3*MIN:now<f.D.arr+40*MIN) tmPlane(g,a.door.x,-60,f.col);
    txt(f.D.A.city,a.x0+2,60,10,'#0f172a',1);
    g.strokeStyle='#334155'; g.lineWidth=10; g.beginPath(); g.ellipse(b.cx,b.cy,b.rx,b.ry,0,0,6.283); g.stroke(); g.strokeStyle=f.col; g.lineWidth=2; g.stroke(); txt('Tapis '+b.n+' · '+f.D.A.city,b.cx-b.rx,b.cy-b.ry-10,10,'#0f172a',1); }
  // équipements et commerces
  for(const p of L.poi){ const col={kiosk:'#0ea5e9',xray:'#475569',arch:'#94a3b8',booth:'#7c3aed',egate:'#6d28d9',wc:'#cbd5e1',cafe:'#fde68a',resto:'#fed7aa',dutyfree:'#fbcfe8',pharma:'#bbf7d0',press:'#e9d5ff',prayer:'#e0e7ff',seats:'#f1f5f9',info:'#bae6fd',green:'#86efac',red:'#fca5a5',change:'#fde68a',taxi:'#facc15',car:'#cbd5e1',lost:'#fecaca',lounge:'#d6d3d1',fids:'#0f172a'}[p.k]||'#e5e7eb';
    g.fillStyle=col; g.fillRect(p.x0,p.y0,p.x1-p.x0,p.y1-p.y0); g.strokeStyle='rgba(51,65,85,.5)'; g.lineWidth=0.6; g.strokeRect(p.x0,p.y0,p.x1-p.x0,p.y1-p.y0);
    if(p.k==='resto'||p.k==='cafe'){ g.fillStyle='rgba(120,53,15,.35)'; for(let x=p.x0+10;x<p.x1-6;x+=18) for(let y=p.y0+16;y<p.y1-6;y+=16){ g.beginPath(); g.arc(x,y,3.5,0,6.283); g.fill(); } }
    if(p.k==='seats'||p.k==='lounge'){ g.fillStyle='rgba(100,116,139,.4)'; for(let y=p.y0+12;y<p.y1-4;y+=12) g.fillRect(p.x0+8,y,p.x1-p.x0-16,3); }
    if(p.k==='xray'&&s>0.8){ g.fillStyle='#1e293b'; g.fillRect(p.x0+18,p.y0+3,24,10); g.fillStyle='#64748b'; for(let k=0;k<3;k++) g.fillRect(p.x0+2+((now/1500+k*7)%16),p.y0+5,4,6); }   // bacs qui avancent
    if(p.k==='fids'&&s>1){ for(let k=0;k<3;k++){ g.fillStyle=['#facc15','#22c55e','#38bdf8'][k]; g.fillRect(p.x0+3,p.y0+3+k*3.5,(p.x1-p.x0)*0.6,1.5); } continue; }
    const big=p.x1-p.x0>45; if(big) txt(p.ico+' '+p.lab.split(' (')[0].split(' —')[0],p.x0+3,p.y0+12,9,'#1f2937',1); else if(s>1.6) txt(p.ico,p.x0+2,p.y0+12,9); }
  // valises : tapis, tri, soutes, tapis de livraison
  for(const b of TM.bags||[]){ let q=null;
    if(now>=b.t0&&now<b.t0+b.dur) q=tmPathAt(b.P,(now-b.t0)/b.dur);
    else if(b.belt&&now>=b.t0+b.dur&&now<b.pick){ const an=(now-b.tB)/26000+(b.p.i%10)*0.63; q={x:b.belt.cx+Math.cos(an)*b.belt.rx,y:b.belt.cy+Math.sin(an)*b.belt.ry}; }
    if(!q) continue; g.fillStyle=b.c; g.fillRect(q.x-3,q.y-2.4,6,4.8); }
  // incidents en cours
  for(const x of TM.inc||[]) if(now>=x.at&&now<x.at+20*MIN){ const pr=3+Math.sin(now/300)*1.5; g.fillStyle='rgba(239,68,68,.85)'; g.beginPath(); g.arc(x.x,x.y,7+pr,0,6.283); g.fill(); txt('!',x.x-2,x.y+4,11,'#fff',1); }
  // passagers (animés)
  let n=0, nd=0, na=0; const pts=[], cnt={ck:0,sec:0,pol:0,board:0,imm:0,belt:0}, r00=Math.max(2.2,Math.min(5,3.6/Math.sqrt(Math.max(0.3,s)))), vx0=c.x-10, vy0=c.y-10, vx1=c.x+w/s+10, vy1=c.y+h/s+10, legs=s>1.4;
  for(const p of TM.ppl){ const q=tmAt(p.K,now); if(!q) continue; n++; p.dep?nd++:na++;
    if(q.q){ const t=q.st; if(/enregistrement/.test(t)) cnt.ck++; else if(/sûreté/.test(t)) cnt.sec++; else if(/police/.test(t)) cnt.pol++; else if(/embarquement/.test(t)) cnt.board++; else if(/immigration/.test(t)) cnt.imm++; } else if(/attend sa valise/.test(q.st)) cnt.belt++;
    const x=q.x+((p.i*13)%7-3)*0.7, y=q.y+((p.i*7)%5-2)*0.7; pts.push([x,y,p,q]); if(x<vx0||x>vx1||y<vy0||y>vy1) continue;
    if(s<0.6){ g.fillStyle=p.c; g.fillRect(x-1.5,y-1.5,3,3); continue; }
    const r0=p.kid?r00*0.7:r00, ph=q.walk?Math.sin(now/140+p.i):0;
    g.fillStyle='rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(x,y+r0*1.6,r0*1.1,r0*0.45,0,0,6.283); g.fill();
    if(legs&&!q.sit){ g.strokeStyle='#1f2937'; g.lineWidth=r0*0.35; g.beginPath(); g.moveTo(x-r0*0.3,y+r0*0.8); g.lineTo(x-r0*0.3+ph*r0*0.5,y+r0*1.7); g.moveTo(x+r0*0.3,y+r0*0.8); g.lineTo(x+r0*0.3-ph*r0*0.5,y+r0*1.7); g.stroke(); }
    g.fillStyle=p.c; g.beginPath(); g.ellipse(x,y+(q.sit?r0*0.3:0),r0*0.95,q.sit?r0*0.9:r0*1.35,0,0,6.283); g.fill();
    g.fillStyle=p.sk; g.beginPath(); g.arc(x,y-r0*1.25,r0*0.7,0,6.283); g.fill();
    const carry=s>1.3&&(p.dep?(p.bag&&now<p.ckDone):(p.hasBag&&now>=p.bagT));
    if(carry){ g.fillStyle='#1f2937'; g.fillRect(x+r0*1.1,y-r0*0.2,r0*0.9,r0*1.3); } }
  TM.pts=pts;
  if(TM.sel){ const hit=pts.find(z=>z[2]===TM.sel); if(hit){ g.strokeStyle='#ef4444'; g.lineWidth=2/s; g.beginPath(); g.arc(hit[0],hit[1],10/s+4,0,6.283); g.stroke(); const q=hit[3], p=hit[2];
      if(!TM.selAt||performance.now()-TM.selAt>700){ TM.selAt=performance.now(); const sc=p.dep&&TM.L.deps.find(d=>d.f===p.f), zz=sc&&sc.sched[p.i];
        tmInfo(`<b>🧍 Passager${p.kid?' (enfant)':''}${p.f.riv?' · '+esc(p.f.riv.name||''):''}</b><br>Vol ${esc(p.f.fn)} · ${p.dep?esc(p.f.D.A.city)+' → '+esc(p.f.D.B.city):'arrivé de '+esc(p.f.D.A.city)}${zz?` · embarquement ${zz.zone===0?'prioritaire':'zone '+zz.zone}`:''}<br>${p.bag||p.hasBag?'🧳 bagage en soute':'🎒 bagage cabine seulement'}<br>En ce moment : <b>${esc(q.st)}</b>`); } } else { TM.sel=null; tmInfo(''); } }
  const hd=document.getElementById('tmCount'); if(hd&&(!TM.cAt||performance.now()-TM.cAt>800)){ TM.cAt=performance.now(); const W=L.W||{};
    hd.innerHTML=`👥 ${n.toLocaleString('fr-FR')} personnes · ${nd} départ · ${na} arrivée · ${tmHM(now)}<br><span style="color:#cbd5e1;font-weight:500">🎫 ${cnt.ck} en file (~${tmWait(W.ck||[],now)} min) · 🔍 ${cnt.sec} (~${tmWait(W.sec||[],now)} min) · 🛂 ${cnt.pol} (~${tmWait(W.pol||[],now)} min) · 🚪 ${cnt.board} · 🧳 ${cnt.belt} au tapis</span>`; if(Math.random()<0.15) tmBoard(); }
}
function tmOpen(code){
  code=code||tmNearest(); if(!code||typeof pfData!=='function') return; TM.code=code; TM.open=true; TM.sel=null; TM.selF=null; TM.built=0; TM.cam=null; TM.goal=null; TM.moved=0; TM.dpr=Math.min(2,window.devicePixelRatio||1);
  let ov=document.getElementById('tmOv'); if(ov) ov.remove();
  ov=document.createElement('div'); ov.id='tmOv'; const A=AP(code);
  ov.innerHTML=`<style>#tmOv{position:fixed;inset:0;z-index:2000;background:#0b1220;display:flex;flex-direction:column;color:#e2e8f0;padding-top:env(safe-area-inset-top)}
#tmOv header{display:flex;align-items:center;gap:6px;padding:6px 8px}#tmOv header b{font:700 14px system-ui;flex:1}#tmOv header button{min-width:40px;padding:6px}
#tmZones{display:flex;gap:5px;overflow-x:auto;padding:0 8px 6px;-webkit-overflow-scrolling:touch}#tmZones button{white-space:nowrap;font:600 12px system-ui;padding:5px 9px;border-radius:14px}
#tmBoard{max-height:17vh;overflow:auto;padding:0 8px 4px;font:12px system-ui}#tmBoard table{width:100%;border-collapse:collapse;margin-bottom:4px}#tmBoard th{text-align:left;color:#facc15;font-weight:600;font-size:11px}
#tmBoard tr[data-tmf]{cursor:pointer}#tmBoard td{padding:2px 4px;border-top:1px solid rgba(148,163,184,.15);font-family:ui-monospace,monospace;font-size:11px}#tmBoard td i{display:inline-block;width:9px;height:9px;border-radius:2px}
#tmCount{padding:2px 8px 4px;font:600 12px system-ui;color:#93c5fd}#tmWrap{flex:1;position:relative;min-height:0}#tmCv{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
#tmInfo{position:absolute;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));background:rgba(8,14,26,.94);border:1px solid rgba(148,163,184,.35);border-radius:12px;padding:8px 10px;font:13px system-ui;max-height:40%;overflow:auto}</style>
<header><b>🏢 Aérogare de ${esc(A.city)} (${esc(code)})</b><button class="btn" data-tz="-">➖</button><button class="btn" data-tz="+">➕</button><button class="btn" data-tm="x">✖</button></header>
<div id="tmZones">${TM_ZONES.map((z,i)=>`<button class="btn" data-tzn="${i}">${z[0]}</button>`).join('')}</div><div id="tmBoard"></div><div id="tmCount"></div>
<div id="tmWrap"><canvas id="tmCv"></canvas><div id="tmInfo" hidden></div></div>`;
  document.body.appendChild(ov); TM.cv=ov.querySelector('#tmCv');
  ov.querySelector('[data-tm="x"]').onclick=tmClose;
  ov.querySelectorAll('[data-tzn]').forEach(b=>b.onclick=()=>(TM.moved=1)&&tmFocus(TM_ZONES[+b.dataset.tzn][1]));
  ov.querySelectorAll('[data-tz]').forEach(b=>b.onclick=()=>{ if(TM.cam) tmZoomAt(b.dataset.tz==='+'?1.5:1/1.5,TM.cv.clientWidth/2,TM.cv.clientHeight/2); });
  // doigts : déplacer (1 doigt), pincer pour zoomer (2 doigts), toucher pour sélectionner ; molette sur ordinateur
  const P=new Map(); let moved=0, pinch=null;
  TM.cv.addEventListener('pointerdown',e=>{ TM.moved=1; TM.cv.setPointerCapture(e.pointerId); P.set(e.pointerId,{x:e.clientX,y:e.clientY}); moved=0; TM.goal=null; if(P.size===2){ const [a,b]=[...P.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y)}; } });
  TM.cv.addEventListener('pointermove',e=>{ const o=P.get(e.pointerId); if(!o||!TM.cam) return; const r=TM.cv.getBoundingClientRect();
    if(P.size>=2&&pinch){ P.set(e.pointerId,{x:e.clientX,y:e.clientY}); const [a,b]=[...P.values()], d=Math.hypot(a.x-b.x,a.y-b.y); if(pinch.d>10) tmZoomAt(d/pinch.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top); pinch.d=d; moved=99; return; }
    const dx=e.clientX-o.x, dy=e.clientY-o.y; moved+=Math.abs(dx)+Math.abs(dy); TM.cam.x-=dx/TM.cam.s; TM.cam.y-=dy/TM.cam.s; P.set(e.pointerId,{x:e.clientX,y:e.clientY}); });
  const up=e=>{ const had=P.has(e.pointerId); P.delete(e.pointerId); if(P.size<2) pinch=null; if(!had||moved>8||!TM.cam) return;
    const r=TM.cv.getBoundingClientRect(), wx=TM.cam.x+(e.clientX-r.left)/TM.cam.s, wy=TM.cam.y+(e.clientY-r.top)/TM.cam.s; let best=null, bd=(16/TM.cam.s)**2;
    for(const z of TM.pts||[]){ const d=(z[0]-wx)**2+(z[1]-wy)**2; if(d<bd){ bd=d; best=z[2]; } }
    if(best){ TM.sel=best; TM.selAt=0; return; } TM.sel=null;
    const g=(TM.L.deps.find(d=>wx>=d.x0&&wx<=d.x1&&wy>=-130&&wy<=d.lounge.y1))||(TM.L.arrs.find(a=>wx>=a.x0&&wx<=a.x1&&wy>=-130&&wy<=60));
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
