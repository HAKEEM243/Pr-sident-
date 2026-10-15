/* =========================================================
   Sky Empire — 🚚🚢 filiales de transport (camions, bateaux)
   Votre compagnie peut créer des filiales :
   - 🚚 Camions : du fret par la route vers toutes les villes de la RDC
     (routes goudronnées rapides, pistes lentes, pire à la saison des pluies).
   - 🚢 Bateaux : barges sur le fleuve Congo et le Kasaï, bateaux sur les
     lacs Kivu et Tanganyika, caboteurs depuis Matadi vers les ports du monde.
   Chaque semaine : tonnes transportées, recettes, carburant, équipages,
   usure, pannes, événements. Les lignes se voient sur la carte 2D.
   ========================================================= */
'use strict';
// ports : [id, ville, lat, lon, réseau, pays, habitants (milliers)]
const TR_PORTS=[
  ['KIN','Kinshasa',-4.30,15.31,'riv','CD',17000],['BZV','Brazzaville',-4.27,15.28,'riv','CG',2400],['BDD','Bandundu',-3.32,17.38,'riv','CD',150],['ILE','Ilebo',-4.33,20.58,'riv','CD',130],
  ['MBA','Mbandaka',0.05,18.26,'riv','CD',800],['LIS','Lisala',2.15,21.51,'riv','CD',100],['BUM','Bumba',2.19,22.47,'riv','CD',200],['KIS','Kisangani',0.52,25.19,'riv','CD',1600],['BGI','Bangui',4.37,18.56,'riv','CF',900],
  ['MAT','Matadi',-5.82,13.46,'sea','CD',500],['BOM','Boma',-5.85,13.05,'sea','CD',300],['BAN','Banana',-6.01,12.40,'sea','CD',30],['PNR','Pointe-Noire',-4.78,11.86,'sea','CG',1200],
  ['LAD','Luanda',-8.80,13.23,'sea','AO',9000],['LOS','Lagos',6.45,3.39,'sea','NG',15000],['ABJ','Abidjan',5.30,-4.01,'sea','CI',5600],['DUR','Durban',-29.87,31.03,'sea','ZA',3900],
  ['ANR','Anvers',51.23,4.40,'sea','BE',1000],['RTM','Rotterdam',51.92,4.48,'sea','NL',650],['LEH','Le Havre',49.49,0.11,'sea','FR',170],['DXB','Dubaï',25.00,55.06,'sea','AE',3600],
  ['SHA','Shanghai',31.23,121.47,'sea','CN',24000],['MBA2','Mombasa',-4.04,39.67,'sea','KE',1200],['DAR','Dar es Salaam',-6.82,39.29,'sea','TZ',7000],
  ['GOM','Goma',-1.68,29.22,'kiv','CD',700],['BKV','Bukavu',-2.51,28.86,'kiv','CD',1100],
  ['UVI','Uvira',-3.40,29.14,'tan','CD',700],['KAL','Kalemie',-5.93,29.19,'tan','CD',300],['KIG','Kigoma',-4.88,29.63,'tan','TZ',250],['BJM','Bujumbura',-3.38,29.36,'tan','BI',1000],
];
// le fleuve : on navigue de port en port le long des cours d'eau (Kinshasa ⇄ Matadi est impossible : rapides)
const TR_RIVER=[['KIN','BZV'],['KIN','BDD'],['BDD','ILE'],['KIN','MBA'],['MBA','LIS'],['LIS','BUM'],['BUM','KIS'],['MBA','BGI']];
// gares (réseau ferré réel : Matadi–Kinshasa, SNCC du Katanga et du Kasaï, chemin de fer de Benguela vers Lobito, ligne vers la Zambie)
const TR_STATIONS=[['MAT','Matadi',-5.82,13.46,'CD',500],['KIN','Kinshasa',-4.33,15.31,'CD',17000],['LUB','Lubumbashi',-11.66,27.48,'CD',2900],['LIK','Likasi',-10.98,26.73,'CD',600],['TEN','Tenke',-10.60,26.12,'CD',30],
  ['KWZ','Kolwezi',-10.71,25.47,'CD',600],['DIL','Dilolo',-10.70,22.33,'CD',40],['LOB','Lobito',-12.35,13.55,'AO',400],['KAM','Kamina',-8.74,24.99,'CD',200],['KBL','Kabalo',-6.05,26.92,'CD',40],['KAL','Kalemie',-5.93,29.19,'CD',300],
  ['KND','Kindu',-2.95,25.92,'CD',300],['MWD','Mwene-Ditu',-7.00,23.45,'CD',250],['KGA','Kananga',-5.90,22.42,'CD',1500],['ILE','Ilebo',-4.33,20.58,'CD',130],['SAK','Sakania',-12.75,28.56,'CD',30],['NDL','Ndola',-12.97,28.64,'ZM',600],
  ['KIS','Kisangani',0.52,25.19,'CD',1600],['UBU','Ubundu',-0.36,25.48,'CD',50]];
const TR_RAIL=[['MAT','KIN'],['LUB','LIK'],['LIK','TEN'],['TEN','KWZ'],['KWZ','DIL'],['DIL','LOB'],['TEN','KAM'],['KAM','KBL'],['KBL','KAL'],['KBL','KND'],['KAM','MWD'],['MWD','KGA'],['KGA','ILE'],['LUB','SAK'],['SAK','NDL'],['KIS','UBU']];
const TR_MINES=['KWZ','LIK','LUB','TEN'], TR_EXPORT=['LOB','NDL','MAT'];
const trEdge=(a,b)=>a<b?a+'-'+b:b+'-'+a;
const TR_NET={riv:'fleuve Congo et Kasaï',sea:'mer',kiv:'lac Kivu',tan:'lac Tanganyika'};
const TR_MODES={
  truck:{name:'Camions', icon:'🚚', unit:'camion', depot:'dépôt', d1:'d’un dépôt', dNew:'Nouveau dépôt', unlock:5e6, depotCost:8e5, crew:150,
    vehicles:[{k:'van',n:'Camionnette 3,5 t',cap:3.5,spd:1.15,cost:45e3,run:0.35},{k:'rigid',n:'Porteur 12 t',cap:12,spd:1,cost:95e3,run:0.55},{k:'semi',n:'Semi-remorque 30 t',cap:30,spd:0.9,cost:150e3,run:0.8},{k:'tank',n:'Citerne 25 000 L',cap:22,spd:0.9,cost:170e3,run:0.85,fuel:true}]},
  train:{name:'Trains', icon:'🚆', unit:'train', depot:'gare', d1:'d’une gare', dNew:'Nouvelle gare', unlock:20e6, depotCost:3e6, crew:0,
    vehicles:[{k:'freight',n:'Train de marchandises 1 000 t',cap:1000,kmh:25,cost:4e6,run:12,crew:1200},{k:'mine',n:'Train minier 2 500 t (cuivre, cobalt)',cap:2500,kmh:20,cost:9e6,run:22,crew:1500},{k:'fast',n:'Train rapide 600 t',cap:600,kmh:40,cost:5e6,run:14,crew:1300}]},
  boat:{name:'Bateaux', icon:'🚢', unit:'bateau', depot:'port', d1:'d’un port', dNew:'Nouveau port', unlock:12e6, depotCost:2e6, crew:0,
    vehicles:[{k:'barge',n:'Barge fluviale 200 t',cap:200,kmh:10,cost:6e5,run:3,crew:600,net:['riv','kiv','tan']},{k:'push',n:'Pousseur + 4 barges 800 t',cap:800,kmh:8,cost:2e6,run:7,crew:1500,net:['riv']},{k:'lake',n:'Bateau de lac 150 t',cap:150,kmh:16,cost:7e5,run:3,crew:500,net:['kiv','tan']},{k:'coaster',n:'Caboteur maritime 3 000 t',cap:3000,kmh:22,cost:6e6,run:18,crew:4000,net:['sea']}]},
};
const trS=()=>{ S.tr=S.tr||{}; for(const m of Object.keys(TR_MODES)) S.tr[m]=S.tr[m]||{on:false,depots:[],fleet:[],lines:[],auto:true,wk:null}; S.tr.log=S.tr.log||[]; return S.tr; };
const trVeh=(mode,k)=>TR_MODES[mode].vehicles.find(v=>v.k===k);
const trLog=(t,kind)=>{ const T=trS(); T.log.unshift({t:S.time,txt:t}); if(T.log.length>30) T.log.length=30; logMsg(t,kind||'info'); };

/* ---------- les lieux ---------- */
let _trTowns=null;
function trTowns(){ if(_trTowns) return _trTowns; const best={};
  for(const c of AIRPORT_CODES){ const A=AP(c); if(!A||A.cc!=='CD') continue; const k=A.city; const p=A.popK||Math.round((A.traffic||0)*400);
    if(!best[k]||p>best[k].p) best[k]={id:c,p}; }
  return _trTowns=Object.values(best).map(x=>x.id); }
function trNode(mode,id){
  if(mode==='boat'){ const P=TR_PORTS.find(p=>p[0]===id); return P?{id,name:P[1],lat:P[2],lon:P[3],net:P[4],cc:P[5],popK:P[6]}:null; }
  if(mode==='train'){ if(String(id).startsWith('c:')){ const n=trNode('truck',id.slice(2)); return n?{...n,id}:null; } const P=TR_STATIONS.find(p=>p[0]===id); return P?{id,name:P[1],lat:P[2],lon:P[3],cc:P[4],popK:P[5]}:null; }
  const A=AP(id); if(!A) return null; const pm=typeof cityPop==='function'?cityPop(id):null;
  return {id,name:A.city,lat:A.lat,lon:A.lon,cc:A.cc,popK:pm?pm*1000:(A.popK||Math.max(20,(A.traffic||0)*400))};
}
const trRails=()=>(S&&S.tr&&S.tr.train&&S.tr.train.rails)||[];
const trNodes=mode=>mode==='boat'?TR_PORTS.map(p=>p[0]):mode==='train'?[...TR_STATIONS.map(p=>p[0]),...new Set(trRails().flat().filter(x=>String(x).startsWith('c:')))]:trTowns();
// villes que le train peut atteindre en construisant une voie (toutes les villes de la RDC qui n'ont pas déjà une gare)
function trRailCandidates(){ const st=new Set(TR_STATIONS.map(p=>p[1])), net=new Set(trNodes('train')); return trTowns().filter(c=>!st.has(AP(c).city)&&!net.has('c:'+c)); }
function trRailNearest(cityId){ const A=trNode('truck',cityId); let best=null,bd=1e9; for(const id of trNodes('train')){ const n=trNode('train',id); const d=trGc(A,n); if(d<bd){ bd=d; best=id; } } return {from:best,km:Math.round(bd*1.15)}; }
const TR_RAIL_KM=350e3;   // coût d’un kilomètre de voie neuve
const trGc=(a,b)=>{ const R=6371, r=Math.PI/180, dLa=(b.lat-a.lat)*r, dLo=(b.lon-a.lon)*r; const h=Math.sin(dLa/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };
// routes goudronnées : Kinshasa–Matadi–Kikwit (Ouest), le Katanga minier, Goma–Bukavu
const TR_PAVED=[[-6.3,12.2,-4.0,19.0],[-12.6,25.2,-10.2,28.2],[-2.7,28.6,-1.4,29.5]];
const trPaved=(a,b)=>TR_PAVED.some(z=>[a,b].every(n=>n.lat>=z[0]&&n.lat<=z[2]&&n.lon>=z[1]&&n.lon<=z[3]));
function trRainy(lat){ const m=new Date(S.time).getUTCMonth(); return lat<0? (m>=9||m<=3) : (m>=3&&m<=9); }
// chemin : les camions vont tout droit (× détours), les bateaux suivent le fleuve ou la mer
function trPath(mode,a,b){
  const A=trNode(mode,a), B=trNode(mode,b); if(!A||!B||a===b) return null;
  if(mode==='truck'){ const km=Math.round(trGc(A,B)*1.35); return {km,pts:[A,B],kind:trPaved(A,B)?'paved':'piste'}; }
  const graph=mode==='train'?TR_RAIL.concat(trRails()):(A.net===B.net&&A.net==='riv'?TR_RIVER:null);
  if(mode==='boat'&&A.net!==B.net) return null;
  if(graph){ const adj={}; for(const [x,y] of graph){ (adj[x]=adj[x]||[]).push(y); (adj[y]=adj[y]||[]).push(x); }
    const prev={[a]:null}, q=[a]; while(q.length){ const x=q.shift(); if(x===b) break; for(const y of adj[x]||[]) if(!(y in prev)){ prev[y]=x; q.push(y); } }
    if(!(b in prev)) return null; const ids=[]; for(let x=b;x;x=prev[x]) ids.unshift(x); const pts=ids.map(i=>trNode(mode,i));
    let km=0; for(let i=1;i<pts.length;i++) km+=trGc(pts[i-1],pts[i])*(mode==='train'?1.15:1.45); return {km:Math.round(km),pts,kind:mode==='train'?'rail':'river'}; }
  const f=A.net==='sea'?((A.lon>25)!==(B.lon>25)?1.75:1.25):1.15;   // vers l'océan Indien depuis l'Atlantique : on contourne le cap
  return {km:Math.round(trGc(A,B)*f),pts:[A,B],kind:A.net==='sea'?'sea':'lake'};
}
const trCanUse=(mode,v,path)=>mode!=='boat'||!v.net||v.net.includes(path.kind==='river'?'riv':path.kind==='sea'?'sea':trNode('boat',path.pts[0].id).net);

/* ---------- le calcul d'une ligne ---------- */
function trSpeed(mode,v,path){
  if(mode==='boat') return v.kmh*(path.kind==='river'&&trDryRiver()?0.8:1);
  if(mode==='train'){ const X=trS().train, ed=[]; for(let i=1;i<path.pts.length;i++) ed.push(trEdge(path.pts[i-1].id,path.pts[i].id)); const ok=ed.length?ed.filter(e=>X.rehab&&X.rehab[e]).length/ed.length:0;
    return v.kmh*(1+0.7*ok)*(path.pts.some(p=>p.id==='MAT')?1.4:1); }   // voies réhabilitées : +70 % de vitesse ; Matadi–Kinshasa est en meilleur état
  const rainy=trRainy(path.pts[0].lat)||trRainy(path.pts[1].lat);
  return (path.kind==='paved'?55:22*(rainy?0.7:1))*v.spd;
}
const trDryRiver=()=>{ const m=new Date(S.time).getUTCMonth(); return m>=6&&m<=8; };   // basses eaux de juillet à septembre
function trDemand(mode,line){ const p=trPath(mode,line.a,line.b); if(!p) return 0; const A=p.pts[0], B=p.pts[p.pts.length-1];
  const hubBoost=(S.hubs||[]).some(h=>{ const H=AP(h); return H&&[A,B].some(n=>trGc(H,n)<40); })?1.25:1;   // le fret aérien de vos hubs continue par la route ou le fleuve
  const g=Math.sqrt(Math.max(10,A.popK)*Math.max(10,B.popK));
  let d=mode==='truck'?1.2*g/(1+p.km/500):mode==='train'?2*g/(1+p.km/1500):p.kind==='sea'?3*g/(1+p.km/8000):1.6*g/(1+p.km/1500);
  if(mode==='train'){ const ids=p.pts.map(x=>x.id); if(ids.some(i=>TR_MINES.includes(i))) d*=2; if([A.id,B.id].some(i=>TR_EXPORT.includes(i))) d*=1.5; }   // cuivre et cobalt du Katanga vers les ports
  return Math.round(d*hubBoost); }
const trShare=mode=>mode==='truck'?0.45:mode==='train'?0.7:0.6;
function trRate(mode,p){ return mode==='train'?0.06:mode==='truck'?(p.kind==='paved'?0.09:0.15):p.kind==='sea'?0.03:0.07; }
function trLineCalc(mode,line,vs){
  const p=trPath(mode,line.a,line.b); if(!p) return null;
  let cap=0, run=0, crew=0; const load=mode==='truck'?10:mode==='train'?24:p.kind==='sea'?72:36;
  for(const x of vs){ const v=trVeh(mode,x.k); if(!v||x.down>0) continue; const trip=2*p.km/trSpeed(mode,v,p)+load, trips=(168*(mode==='truck'?0.8:0.9))/trip;
    cap+=v.cap*trips*(x.cond>=40?1:0.7); run+=trips*2*p.km*v.run; crew+=(v.crew||TR_MODES[mode].crew); }
  const dem=trDemand(mode,line)*trShare(mode)*(line.block?0:1), tons=Math.min(cap,dem), fill=cap?tons/cap:0;
  const rev=tons*(p.km*trRate(mode,p)+(mode==='truck'?20:10)), cost=run*(0.35+0.65*fill)+crew;   // un véhicule à moitié vide consomme moins
  return {p,cap:Math.round(cap),dem:Math.round(dem),tons:Math.round(tons),rev:Math.round(rev),cost:Math.round(cost)};
}

/* ---------- chaque semaine ---------- */
function trWeekly(){
  const T=trS(); let totR=0,totC=0;
  for(const [mode,M] of Object.entries(TR_MODES)){ const X=T[mode]; if(!X.on) continue; let R=0,C=0,t=0;
    // événements
    for(const L of X.lines) L.block=0;
    const ev=Math.random();
    if(mode==='truck'&&X.lines.length){ const L=pick(X.lines), p=trPath(mode,L.a,L.b);
      if(p&&p.kind==='piste'&&trRainy(p.pts[0].lat)&&ev<0.12){ L.block=1; trLog(`🌧️ Piste coupée par les pluies entre ${p.pts[0].name} et ${p.pts[1].name} : pas de livraison cette semaine.`,'warn'); }
      else if(ev<0.22&&ev>=0.12){ const k=Math.round(rnd(1e3,4e3)/100)*100; C+=k; trLog(`🚧 Barrières et contrôles sur la route ${p?p.pts[0].name+' – '+p.pts[1].name:''} : ${fmtMoney(k)} de frais.`,'warn'); }
      else if(ev<0.25&&ev>=0.22&&p&&[p.pts[0],p.pts[1]].some(n=>n.lat>-3.5&&n.lon>27)){ const k=Math.round(rnd(1e4,4e4)/100)*100; C+=k; trLog(`⚠️ Un convoi a été attaqué dans l’Est (${p.pts[1].name}) : marchandise perdue, ${fmtMoney(k)}.`,'bad'); } }
    if(mode==='train'&&X.lines.length){ const L=pick(X.lines), p=trPath(mode,L.a,L.b); if(p){ const ed=[]; for(let i=1;i<p.pts.length;i++) ed.push(trEdge(p.pts[i-1].id,p.pts[i].id)); const ok=ed.filter(e=>X.rehab&&X.rehab[e]).length/ed.length;
      if(ev<0.08*(1-0.8*ok)){ L.block=1; const k=Math.round(rnd(5e4,3e5)/1e3)*1e3; C+=k; trLog(`🚧 Déraillement entre ${p.pts[0].name} et ${p.pts[p.pts.length-1].name} : ligne bloquée une semaine, ${fmtMoney(k)} de réparations. Réhabiliter la voie limite ces accidents.`,'bad'); } } }
    if(mode==='boat'&&X.lines.length&&trDryRiver()&&ev<0.3) trLog('🏞️ Basses eaux sur le fleuve : les barges naviguent plus lentement.','warn');
    // lignes
    for(const L of X.lines){ const vs=X.fleet.filter(v=>v.line===L.id), r=trLineCalc(mode,L,vs); if(!r){ L.last=null; continue; } L.last={tons:r.tons,rev:r.rev,cost:r.cost,cap:r.cap,dem:r.dem}; R+=r.rev; C+=r.cost; t+=r.tons;
      L.tot=(L.tot||0)+r.tons;
      for(const v of vs){ const wear=mode==='truck'?(r.p.kind==='paved'?0.6:1.6):mode==='train'?0.8:0.4; v.cond=Math.max(0,(v.cond??100)-wear*rnd(0.7,1.3)); } }
    // pannes et entretien
    for(const v of X.fleet){ if(v.down>0){ v.down--; continue; } const V=trVeh(mode,v.k); if(!V) continue;
      if(X.auto&&v.cond<55){ C+=V.cost*0.06; v.cond=100; continue; }
      if(v.line&&Math.random()<(100-v.cond)/400){ v.down=1; C+=V.cost*0.05; trLog(`🔧 ${M.unit[0].toUpperCase()+M.unit.slice(1)} ${v.name||V.n} en panne : réparé, immobilisé une semaine.`,'warn'); } }
    // les véhicules sans ligne coûtent quand même leur équipage
    for(const v of X.fleet) if(!v.line){ const V=trVeh(mode,v.k); C+=(V&&V.crew||M.crew)*0.5; }
    X.wk={t:S.time,rev:Math.round(R),cost:Math.round(C),tons:Math.round(t)}; X.hist=X.hist||[]; X.hist.push([S.time,Math.round(R-C)]); if(X.hist.length>26) X.hist.shift();
    totR+=R; totC+=C; }
  if(totR) book('transport',Math.round(totR)); if(totC) book('transportFrais',-Math.round(totC));
}

/* ---------- actions ---------- */
let _trSeq=0; const trId=()=>'t'+Date.now().toString(36)+(++_trSeq);
function trCreate(mode){ const X=trS()[mode], M=TR_MODES[mode]; if(X.on) return; if(S.cash<M.unlock) return err(`Il faut ${fmtMoney(M.unlock)} pour créer la filiale.`);
  book('investissements',-M.unlock); X.on=true;
  const start=mode==='boat'?'KIN':mode==='train'?((S.hubs||[]).some(h=>AP(h)&&AP(h).city==='Lubumbashi')?'LUB':'KIN'):(trTowns().find(c=>AP(c).city===AP(S.company.hub).city)||trTowns().slice().sort((a,b)=>trNode('truck',b).popK-trNode('truck',a).popK)[0]);
  if(!X.depots.includes(start)) X.depots.push(start);
  // cadeau de départ : 2 véhicules
  const k=mode==='boat'?'barge':mode==='train'?'freight':'rigid'; for(let i=0;i<2;i++) X.fleet.push({id:trId(),k,cond:100,line:null});
  trLog(`${M.icon} Filiale « ${S.company.name} ${M.name} » créée à ${trNode(mode,start).name}, avec 2 ${trVeh(mode,k).n.toLowerCase()} offerts.`,'ok'); }
function trBuy(mode,k,n){ const X=trS()[mode], V=trVeh(mode,k); const cost=V.cost*n; if(S.cash<cost) return err('Trésorerie insuffisante');
  book('investissements',-cost); for(let i=0;i<n;i++) X.fleet.push({id:trId(),k,cond:100,line:null}); toast(`${TR_MODES[mode].icon} ${n} × ${esc(V.n)} achetés`,'ok'); }
function trOpenLine(mode,a,b){ const X=trS()[mode]; if(!X.depots.includes(a)){ err('La ligne doit partir de l’un de vos '+TR_MODES[mode].depot+'s.'); return null; }
  if(X.lines.some(L=>(L.a===a&&L.b===b)||(L.a===b&&L.b===a))){ err('Cette ligne existe déjà.'); return null; } const p=trPath(mode,a,b); if(!p){ err('Ces deux lieux ne sont pas reliés.'); return null; }
  const L={id:trId(),a,b}; X.lines.push(L);
  // on y met tout de suite les véhicules libres qui peuvent y aller
  const free=X.fleet.filter(v=>!v.line&&trCanUse(mode,trVeh(mode,v.k),p)); for(const v of free.slice(0,mode==='truck'?3:2)) v.line=L.id;
  toast(`${TR_MODES[mode].icon} Ligne ${esc(trNode(mode,a).name)} → ${esc(trNode(mode,b).name)} ouverte`,'ok'); return L; }
function trAssign(mode,lineId,delta){ const X=trS()[mode], L=X.lines.find(x=>x.id===lineId); if(!L) return; const p=trPath(mode,L.a,L.b);
  if(delta>0){ const v=X.fleet.filter(v=>!v.line&&trCanUse(mode,trVeh(mode,v.k),p)).sort((x,y)=>trVeh(mode,y.k).cap-trVeh(mode,x.k).cap)[0]; if(!v) return err('Aucun '+TR_MODES[mode].unit+' libre adapté : achetez-en un.'); v.line=L.id; }
  else { const v=X.fleet.filter(v=>v.line===L.id).sort((x,y)=>trVeh(mode,x.k).cap-trVeh(mode,y.k).cap)[0]; if(v) v.line=null; } }

/* ---------- aperçu : meilleures destinations depuis un dépôt ---------- */
function trSuggest(mode,from,all){
  const X=trS()[mode], vk=mode==='boat'?null:mode==='train'?'freight':'semi';
  const out=[]; for(const id of trNodes(mode)){ if(id===from||X.lines.some(L=>(L.a===from&&L.b===id)||(L.a===id&&L.b===from))) continue; const p=trPath(mode,from,id); if(!p) continue;
    let v=vk?trVeh(mode,vk):TR_MODES.boat.vehicles.find(x=>x.net.includes(p.kind==='river'?'riv':p.kind==='sea'?'sea':trNode('boat',from).net)); if(!v) continue;
    const r=trLineCalc(mode,{a:from,b:id},[{k:v.k,cond:100}]); if(!r) continue; out.push({id,p,r,v,per:r.rev-r.cost}); }
  return all?out.sort((x,y)=>trNode(mode,x.id).name.localeCompare(trNode(mode,y.id).name)):out.sort((x,y)=>y.per-x.per).slice(0,15); }

/* ---------- affichage : 🏢 Compagnie → 🚚 Transport ---------- */
function trHtml(){
  const T=trS(), mode=TR_MODES[UI.trM]?UI.trM:'truck', M=TR_MODES[mode], X=T[mode];
  const tabs=`<div class="chips">${Object.entries(TR_MODES).map(([k,m])=>`<button class="chip ${k===mode?'on':''}" data-act="trM" data-k="${k}">${m.icon} ${m.name}${T[k].on?'':' 🔒'}</button>`).join('')}</div>`;
  const help=`<div class="simplehelp">💡 Votre compagnie peut transporter du <b>fret</b> sans avions : ${mode==='train'?'des trains sur le vrai réseau ferré : Matadi–Kinshasa, le réseau du Katanga et du Kasaï (Lubumbashi, Kolwezi, Kamina, Kananga, Ilebo, Kalemie, Kindu) et les sorties vers les ports de Lobito (Angola) et Ndola (Zambie). Le cuivre et le cobalt du Katanga remplissent les trains. Les voies sont vieilles : les trains sont lents et déraillent parfois ; réhabiliter une voie la rend plus rapide et plus sûre.':''}${mode==='truck'?'des camions vers toutes les villes de la RDC. Les routes goudronnées (Kinshasa–Matadi–Kikwit, Katanga, Goma–Bukavu) sont rapides ; les pistes sont lentes, s’usent vite et coupent parfois à la saison des pluies.':''}${mode==='boat'?'des barges sur le fleuve Congo et le Kasaï (Kinshasa ⇄ Kisangani, Ilebo, Bangui), des bateaux sur les lacs Kivu et Tanganyika, et des caboteurs de Matadi vers les ports d’Afrique, d’Europe et d’Asie.':''} Une ligne part ${M.d1} ; mettez-y des ${M.unit}s ; chaque semaine, ils livrent, encaissent et s’usent. Le fret de vos hubs aériens continue par la route ou le fleuve (+25 % de demande).</div>`;
  if(!X.on) return tabs+help+`<div class="card"><b>${M.icon} Créer « ${esc(S.company.name)} ${M.name} »</b><br><span class="small mut">Coût ${fmtMoney(M.unlock)} · ${mode==='boat'?'port de départ : Kinshasa · 2 barges offertes':mode==='train'?'gare de départ : Kinshasa (ou Lubumbashi si c’est votre hub) · 2 trains de marchandises offerts':'dépôt de départ : votre ville hub · 2 porteurs offerts'}.</span><div class="btns"><button class="btn gold" data-act="trCreate" data-k="${mode}">Créer la filiale · ${fmtMoney(M.unlock)}</button></div></div>`;
  const wk=X.wk, free=X.fleet.filter(v=>!v.line).length, down=X.fleet.filter(v=>v.down>0).length;
  const kpi=(l,v,c='')=>`<div class="kpi"><div class="kl">${l}</div><div class="kv ${c}">${v}</div></div>`;
  const from=X.depots.includes(UI.trFrom)?UI.trFrom:X.depots[0], sug=UI.trAdd?trSuggest(mode,from,UI.trAll):[];
  return tabs+help+`<div class="kpis">${kpi(M.name,`${X.fleet.length}${free?` <span class="small mut">(${free} libres)</span>`:''}`)}${kpi('Lignes',X.lines.length)}${kpi('Tonnes / semaine',wk?num(wk.tons):'—')}${kpi('Résultat semaine',wk?(wk.rev-wk.cost>=0?'+':'')+fmtMoney(wk.rev-wk.cost):'—',wk&&wk.rev-wk.cost<0?'neg':'pos')}</div>
  <h3>${M.icon} Lignes</h3>
  ${X.lines.map(L=>{ const p=trPath(mode,L.a,L.b), n=X.fleet.filter(v=>v.line===L.id).length, l=L.last, A=trNode(mode,L.a), B=trNode(mode,L.b), kind={paved:'🛣️ route goudronnée',piste:'🟫 piste',river:'🌊 fleuve',sea:'🌍 mer',lake:'🏞️ lac',rail:'🛤️ voie ferrée'}[p&&p.kind]||'';
    const est=trLineCalc(mode,L,X.fleet.filter(v=>v.line===L.id));
    return `<div class="card"><div class="row"><div class="grow"><b>${esc(A.name)} → ${esc(B.name)}</b> ${B.cc!=='CD'&&COUNTRIES[B.cc]?COUNTRIES[B.cc][2]:''}<br><span class="small mut">${num(p?p.km:0)} km · ${kind}${p&&p.pts.length>2?' · via '+p.pts.slice(1,-1).map(x=>x.name).join(', '):''}</span></div>
      <div class="btns sm"><button class="btn sm" data-act="trAs" data-id="${L.id}" data-d="-1">−</button><b style="padding:0 6px">${n} ${M.icon}</b><button class="btn sm gold" data-act="trAs" data-id="${L.id}" data-d="1">+</button></div></div>
      <div class="small">Demande ${num(est?est.dem:0)} t/sem · capacité ${num(est?est.cap:0)} t/sem${est&&est.cap>est.dem*1.15?' <span class="warnt">(trop de '+M.unit+'s)</span>':est&&est.cap<est.dem*0.6?' <span class="pos">(ajoutez des '+M.unit+'s)</span>':''}</div>
      <div class="small">${l?`Semaine dernière : <b>${num(l.tons)} t</b> · recettes ${fmtMoney(l.rev)} · frais ${fmtMoney(l.cost)} · <b class="${l.rev-l.cost>=0?'pos':'neg'}">${l.rev-l.cost>=0?'+':''}${fmtMoney(l.rev-l.cost)}</b>`:'<span class="mut">Premiers résultats à la fin de la semaine.</span>'}${L.block?' · 🌧️ coupée cette semaine':''}</div>
      <div class="btns sm">${mode==='train'&&p?(()=>{ const ed=[]; for(let i=1;i<p.pts.length;i++) ed.push([p.pts[i-1],p.pts[i]]); const todo=ed.filter(([x,y])=>!(X.rehab&&X.rehab[trEdge(x.id,y.id)])); const c=Math.round(todo.reduce((s,[x,y])=>s+trGc(x,y)*1.15*15e3,0)/1e5)*1e5; return todo.length?`<button class="btn sm gold" data-act="trRehab" data-id="${L.id}">🛠️ Réhabiliter la voie · ${fmtMoney(c)}</button>`:'<span class="badge ok">🛤️ voie réhabilitée</span>'; })():''}${mode!=='boat'&&n?`<button class="btn sm gold" data-act="vyGo" data-m="${mode}" data-id="${L.id}" data-k="${(X.fleet.find(v=>v.line===L.id)||{}).k||''}">🎬 Voyage en 3D</button>`:''}<button class="btn sm danger" data-act="trClose" data-id="${L.id}">Fermer la ligne</button></div></div>`; }).join('')||'<div class="mut small">Pas encore de ligne : ouvrez-en une ci-dessous.</div>'}
  <div class="btns"><button class="btn ${UI.trAdd?'':'gold'}" data-act="trAdd">${UI.trAdd?'✖ Fermer':'➕ Ouvrir une ligne'}</button></div>
  ${UI.trAdd?`<div class="card"><div class="small">Départ (vos ${M.depot}s) :</div><div class="chips">${X.depots.map(d=>`<button class="chip ${d===from?'on':''}" data-act="trFrom" data-k="${d}">${esc(trNode(mode,d).name)}</button>`).join('')}</div>
    <div class="chips"><button class="chip ${UI.trAll?'':'on'}" data-act="trAll" data-k="0">Les plus rentables</button><button class="chip ${UI.trAll?'on':''}" data-act="trAll" data-k="1">Toutes (A → Z)</button></div>
    ${sug.map(s=>{ const B=trNode(mode,s.id); return `<div class="row" style="padding:5px 0;border-top:1px solid rgba(255,255,255,.06)"><div class="grow small"><b>${esc(B.name)}</b> ${B.cc!=='CD'&&COUNTRIES[B.cc]?COUNTRIES[B.cc][2]:''} · ${num(s.p.km)} km · ${({paved:'goudron',piste:'piste',river:'fleuve',sea:'mer',lake:'lac',rail:'rail'})[s.p.kind]}<br><span class="mut">demande ${num(s.r.dem)} t/sem · 1 ${esc(s.v.n.toLowerCase())} ≈ <span class="${s.per>=0?'pos':'neg'}">${s.per>=0?'+':''}${fmtMoney(s.per)}/sem</span></span></div><button class="btn sm gold" data-act="trOpen" data-a="${from}" data-b="${s.id}">Ouvrir</button></div>`; }).join('')||'<div class="mut small">Aucune destination possible depuis ce '+M.depot+'.</div>'}</div>`:''}
  <h3>🏭 ${M.depot[0].toUpperCase()+M.depot.slice(1)}s</h3>
  <div class="chips">${X.depots.map(d=>`<span class="chip on">${esc(trNode(mode,d).name)}</span>`).join('')}</div>
  <div class="row"><select id="trDepSel" class="grow">${trNodes(mode).filter(id=>!X.depots.includes(id)).map(id=>trNode(mode,id)).sort((a,b)=>b.popK-a.popK).map(n=>`<option value="${n.id}">${esc(n.name)}${n.cc!=='CD'&&COUNTRIES[n.cc]?' '+COUNTRIES[n.cc][2]:''}${mode==='boat'?' · '+TR_NET[n.net]:''}</option>`).join('')}</select><button class="btn sm gold" data-act="trDepot">Ouvrir · ${fmtMoney(M.depotCost)}</button></div>
  ${mode==='train'?(()=>{ const cand=trRailCandidates().map(c=>({c,n:trNode('truck',c),r:trRailNearest(c)})).sort((a,b)=>b.n.popK-a.n.popK); const sel=cand.find(x=>x.c===UI.trRailTo)||cand[0];
    return `<h3>🛤️ Construire une nouvelle voie ferrée</h3><div class="small mut">Le train peut aller dans <b>toutes les villes</b> de la RDC : construisez une voie neuve depuis la gare la plus proche (${fmtMoney(TR_RAIL_KM)} par km). Une voie neuve est rapide et sûre ; la ville devient une gare de votre réseau.</div>
    ${cand.length?`<div class="row"><select class="grow" data-in="trRailTo">${cand.map(x=>`<option value="${x.c}" ${sel&&x.c===sel.c?'selected':''}>${esc(x.n.name)} · ${num(x.r.km)} km depuis ${esc(trNode('train',x.r.from).name)}</option>`).join('')}</select><button class="btn sm gold" data-act="trRailBuild" data-k="${sel?sel.c:''}">Construire · ${fmtMoney(sel?sel.r.km*TR_RAIL_KM:0)}</button></div>`:'<div class="mut small">Toutes les villes sont déjà reliées !</div>'}`; })():''}
  <h3>🛒 Acheter des ${M.unit}s</h3>
  ${M.vehicles.map(v=>{ const own=X.fleet.filter(x=>x.k===v.k); return `<div class="card row"><div class="grow"><b>${esc(v.n)}</b> <span class="mut small">· vous en avez ${own.length}</span><br><span class="small mut">${num(v.cap)} t · ${v.kmh?v.kmh+' km/h':(v.spd>=1.1?'rapide':v.spd>=1?'normal':'lent')} · ${fmtMoney(v.cost)}${v.net?' · '+v.net.map(n=>TR_NET[n]).join(', '):''}${v.fuel?' · livre le kérosène des aéroports de l’intérieur':''}</span></div><div class="btns sm"><button class="btn sm gold" data-act="trBuy" data-k="${v.k}" data-n="1">+1</button><button class="btn sm" data-act="trBuy" data-k="${v.k}" data-n="5">+5</button></div></div>`; }).join('')}
  <div class="card small">${free?`${free} ${M.unit}(s) sans ligne (équipage payé quand même). `:''}${down?`${down} en panne cette semaine. `:''}État moyen : ${X.fleet.length?Math.round(X.fleet.reduce((s,v)=>s+(v.cond??100),0)/X.fleet.length):100} %.
    <label class="tog"><input type="checkbox" data-in="trAuto" data-k="${mode}" ${X.auto?'checked':''}> Entretien automatique (révision à 55 % d’usure : moins de pannes)</label></div>
  <h3>📜 Journal</h3>${T.log.slice(0,8).map(l=>`<div class="small"><span class="mut">${fmtDate(l.t)}</span> ${l.txt}</div>`).join('')||'<div class="mut small">Rien pour l’instant.</div>'}`;
}

/* ---------- carte 2D : lignes et véhicules qui roulent ---------- */
let L_trans=null, _trDraw='';
function trMapDraw(){
  if(typeof map==='undefined'||!map||typeof L==='undefined'||!S||!S.tr) return;
  if(!L_trans) L_trans=L.layerGroup().addTo(map);
  const sig=JSON.stringify(Object.entries(S.tr).filter(([k,x])=>x&&x.lines).map(([k,x])=>[k,x.lines.map(l=>l.id+X0(x,l))]));
  function X0(x,l){ return x.fleet.filter(v=>v.line===l.id).length; }
  if(sig!==_trDraw){ _trDraw=sig; L_trans.clearLayers(); L_trans._mov=[];
    for(const mode of Object.keys(TR_MODES)){ const X=S.tr[mode]; if(!X||!X.on) continue;
      for(const Ln of X.lines){ const p=trPath(mode,Ln.a,Ln.b); if(!p) continue; const ll=p.pts.map(n=>[n.lat,n.lon]);
        L.polyline(ll,{color:mode==='truck'?(p.kind==='paved'?'#f59e0b':'#b45309'):mode==='train'?'#c084fc':'#38bdf8',weight:3,opacity:0.75,dashArray:mode==='truck'?'2 7':mode==='train'?'12 4':'8 6',interactive:false}).addTo(L_trans);
        const n=Math.min(3,X.fleet.filter(v=>v.line===Ln.id).length);
        for(let i=0;i<n;i++){ const mk=L.marker(ll[0],{icon:L.divIcon({className:'trmk',html:TR_MODES[mode].icon,iconSize:mode==='truck'?[26,26]:[18,18]}),interactive:mode==='truck',keyboard:false}).addTo(L_trans); L_trans._mov.push({mk,ll,km:p.km,off:i/n,mode}); } } } }
  // position : aller-retour continu, vitesse accélérée pour qu'on les voie bouger
  const t=(S.time/3600e3);
  for(const m of L_trans._mov||[]){ const per=Math.max(6,m.km/(m.mode==='truck'?35:m.mode==='train'?22:10)); let f=((t/per)+m.off)%2; if(f>1) f=2-f;
    const segs=m.ll.length-1, x=f*segs, i=Math.min(segs-1,Math.floor(x)), u=x-i, A=m.ll[i], B=m.ll[i+1]; m.mk.setLatLng([A[0]+(B[0]-A[0])*u,A[1]+(B[1]-A[1])*u]); }
}
setInterval(()=>{ try{ trMapDraw(); }catch(e){} },1000);

function registerTransportActions(){
  Object.assign(ACTIONS,{
    trM:d=>{ UI.trM=d.k; UI.trAdd=false; renderPanel(); },
    trCreate:d=>{ if(!confirm(`Créer la filiale ${TR_MODES[d.k].name} pour ${fmtMoney(TR_MODES[d.k].unlock)} ?`)) return; trCreate(d.k); renderTop(); renderPanel(); },
    trBuy:d=>{ trBuy(UI.trM||'truck',d.k,+d.n); renderTop(); renderPanel(); },
    trAdd:()=>{ UI.trAdd=!UI.trAdd; renderPanel(); },
    trFrom:d=>{ UI.trFrom=d.k; renderPanel(); },
    trAll:d=>{ UI.trAll=d.k==='1'; renderPanel(); },
    trOpen:d=>{ if(trOpenLine(UI.trM||'truck',d.a,d.b)){ UI.trAdd=false; renderPanel(); } },
    trAs:d=>{ trAssign(UI.trM||'truck',d.id,+d.d); renderPanel(); },
    trClose:d=>{ if(!confirm('Fermer cette ligne ? Les véhicules deviennent libres.')) return; const X=trS()[UI.trM||'truck']; X.lines=X.lines.filter(L=>L.id!==d.id); for(const v of X.fleet) if(v.line===d.id) v.line=null; renderPanel(); },
    trRehab:d=>{ const X=trS().train, L=X.lines.find(x=>x.id===d.id); if(!L) return; const p=trPath('train',L.a,L.b); X.rehab=X.rehab||{}; let c=0; const ed=[];
      for(let i=1;i<p.pts.length;i++){ const e=trEdge(p.pts[i-1].id,p.pts[i].id); if(!X.rehab[e]){ ed.push(e); c+=trGc(p.pts[i-1],p.pts[i])*1.15*15e3; } } c=Math.round(c/1e5)*1e5;
      if(!ed.length) return; if(S.cash<c) return err('Trésorerie insuffisante'); if(!confirm(`Réhabiliter ${ed.length} tronçon(s) de voie pour ${fmtMoney(c)} ? Les trains iront 70 % plus vite et dérailleront beaucoup moins.`)) return;
      book('investissements',-c); for(const e of ed) X.rehab[e]=true; trLog(`🛤️ Voie réhabilitée entre ${p.pts[0].name} et ${p.pts[p.pts.length-1].name} (${fmtMoney(c)}).`,'ok'); renderTop(); renderPanel(); },
    trRailBuild:d=>{ const c=UI.trRailTo||d.k; if(!c) return; const r=trRailNearest(c), cost=r.km*TR_RAIL_KM, n=trNode('truck',c);
      if(S.cash<cost) return err('Trésorerie insuffisante'); if(!confirm(`Construire ${num(r.km)} km de voie ferrée de ${trNode('train',r.from).name} à ${n.name} pour ${fmtMoney(cost)} ?`)) return;
      const X=trS().train; X.rails=X.rails||[]; X.rehab=X.rehab||{}; const id='c:'+c; X.rails.push([r.from,id]); X.rehab[trEdge(r.from,id)]=true; book('investissements',-cost);
      if(!X.depots.includes(id)) X.depots.push(id); UI.trRailTo=null; trLog(`🛤️ Nouvelle voie ferrée : ${trNode('train',r.from).name} → ${n.name} (${num(r.km)} km, ${fmtMoney(cost)}). ${n.name} a sa gare.`,'ok'); renderTop(); renderPanel(); },
    trDepot:()=>{ const mode=UI.trM||'truck', X=trS()[mode], M=TR_MODES[mode], id=(document.getElementById('trDepSel')||{}).value; if(!id) return; if(S.cash<M.depotCost) return err('Trésorerie insuffisante');
      book('investissements',-M.depotCost); X.depots.push(id); UI.trFrom=id; trLog(`🏭 ${M.dNew} à ${trNode(mode,id).name}.`,'ok'); renderTop(); renderPanel(); },
  });
  if(typeof INPUTS!=='undefined') Object.assign(INPUTS,{ trAuto:el=>{ trS()[el.dataset.k].auto=el.checked; }, trRailTo:el=>{ UI.trRailTo=el.value; renderPanel(); } });
}
LED_CATS.transport=['Filiales transport (recettes)',1]; LED_CATS.transportFrais=['Filiales transport (frais)',-1];
{ const _w=weeklyTick; weeklyTick=function(){ const r=_w.apply(this,arguments); try{ trWeekly(); }catch(e){ console.warn('transport',e); } return r; }; }
