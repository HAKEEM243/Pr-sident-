/* =========================================================
   Sky Empire — le directeur du monde
   Une IA qui fait vivre la planète semaine après semaine :
   - chaque pays a sa population, sa richesse et son économie (essor,
     récession) qui évoluent : la demande de voyages monte ou baisse ;
   - des tensions peuvent tourner à la guerre : l'espace aérien ferme,
     des réfugiés partent vers les pays voisins ;
   - des catastrophes (séisme, cyclone, éruption, épidémie…) ferment
     des aéroports puis provoquent des évacuations ;
   - elle dose le rythme selon votre partie : plus de défis quand tout
     vous réussit, des occasions quand vous êtes en difficulté.
   Tout est fictif : ce ne sont pas des prévisions réelles.
   ========================================================= */
'use strict';
// population de départ (millions, estimations arrondies) des principaux pays ; ailleurs, un indice
const WD_POP={CN:1410,IN:1440,US:340,ID:280,PK:240,NG:230,BR:212,BD:173,RU:144,ET:130,MX:130,JP:124,EG:114,PH:116,CD:110,VN:100,IR:90,TR:86,DE:84,TH:72,GB:68,FR:68,TZ:68,ZA:63,IT:59,KE:56,CO:52,MM:54,KR:52,SD:50,UG:49,ES:48,DZ:46,AR:46,IQ:45,AF:42,PL:37,CA:40,MA:38,SA:33,UA:37,AO:37,UZ:36,PE:34,MY:34,GH:34,MZ:34,YE:34,NP:30,VE:28,CM:29,CI:31,MG:31,AU:27,NE:27,LK:22,BF:23,ML:23,CL:20,MW:21,ZM:21,SN:18,TD:18,SO:18,ZW:17,GN:14,RW:14,BJ:14,BI:13,TN:12,BO:12,BE:12,HT:12,CU:11,SS:11,DO:11,CZ:11,GR:10,JO:11,PT:10,SE:10,AE:10,HU:10,IL:10,TG:9,CH:9,AT:9,SG:6,CG:6,GA:2.4,QA:2.7};
const WD_LVL=[['Calme',0.5],['Normal',1],['Mouvementé',1.6]];
const wdLevel=()=>WD_LVL[S.wdLevel===undefined?1:S.wdLevel][1];
const wdC=cc=>S.wd&&S.wd.c[cc];
let _wdL=null; const wdList=()=>_wdL||(_wdL=Object.keys(COUNTRIES).filter(cc=>cAirports(cc).length&&countryTraffic(cc)>0.03));
// croissance annuelle de la population et de la richesse selon le niveau de revenu (pays pauvres : population jeune qui augmente vite)
function wdNew(cc){ const lv=incomeOf(cc); return {pop:1, rich:1, pr:[0.028,0.018,0.008,0.003][lv]+rnd(-0.004,0.004), rr:[0.03,0.035,0.03,0.015][lv]+rnd(-0.015,0.015), reg:'normal', regUntil:0, f:1, war:0, dis:null, tense:0}; }
function wdInit(){
  if(S.wd&&S.wd.v===1){ for(const cc of wdList()) if(!S.wd.c[cc]) S.wd.c[cc]=wdNew(cc); return; }
  const c={};
  for(const cc of wdList()) c[cc]=wdNew(cc);
  S.wd={v:1, c, wars:[], dis:[], log:[], heat:1, quiet:0, lastType:'', week:-1, deals:[], hist:[]};
}
// facteur de demande d'un pays (calculé une fois par semaine)
function wdCompute(cc){ const x=wdC(cc); if(!x) return 1;
  let f=Math.pow(x.pop,0.8)*Math.pow(x.rich,1.1)*(x.reg==='boom'?1.15:x.reg==='recession'?0.82:x.reg==='reconstruction'?1.2:1);
  if(x.tense) f*=0.8; if(x.war) f*=0.25;
  if(x.dis){ const d=x.dis; f*= d.until>S.time ? d.dem : 1; }
  if(x.evac>S.time) f*=1.7;                     // départs en masse (évacuation, réfugiés)
  return clamp(f,0.15,2.6); }
const wdF=cc=>{ const x=wdC(cc); return x?x.f:1; };
const wdClosedCc=cc=>{ const x=wdC(cc); return !!(x&&x.war&&x.closed); };

/* ---------- branchements sur le reste du jeu ---------- */
{ const _dm=demandMult; demandMult=function(a,b){ let k=_dm(a,b); if(S.wd){ const A=AP(a), B=AP(b); k*=Math.sqrt(wdF(A.cc)*wdF(B.cc)); } return k; }; }
{ const _cs=classSplit; classSplit=function(a,b){ const s=_cs(a,b); if(!S.wd) return s; const r=Math.sqrt((wdC(AP(a).cc)||{rich:1}).rich*(wdC(AP(b).cc)||{rich:1}).rich), m=clamp(Math.pow(r,1.5),0.5,2);
  const j=s.j*m, f=s.f*m; return {y:1-j-f,j,f}; }; }
{ const _ac=airportClosed; airportClosed=function(code){ if(_ac(code)) return true; const a=AP(code); return !!(a&&S.wd&&wdClosedCc(a.cc)); }; }
if(typeof moodTraffic==='function'){ const _mt=moodTraffic; moodTraffic=function(cc){ if(S.wd&&wdClosedCc(cc)) return 0; return _mt(cc)*(S.wd?Math.sqrt(wdF(cc)):1); }; }

/* ---------- l'IA qui dose le rythme ---------- */
function wdPace(){
  const W=S.wd; let me=null; try{ me=aiRows().find(r=>r.me); }catch(e){}
  W.hist.unshift(S.cash); if(W.hist.length>6) W.hist.length=6;
  const trend=W.hist.length>=4?(W.hist[0]-W.hist[3])/Math.max(5e6,Math.abs(W.hist[3])):0;
  // le joueur domine : le monde se complique ; il souffre : il respire et des occasions arrivent
  let h=1; if(me&&me.rank<=3) h+=0.35; if(trend>0.15) h+=0.25; if(S.cash<0||trend<-0.2) h-=0.45;
  W.heat=clamp(h,0.4,1.8)*wdLevel(); W.mood=S.cash<0||trend<-0.2?'aide':h>1.3?'défi':'équilibre';
  return W.heat;
}
function wdNote(txt,kind,important){ const W=S.wd; W.log.unshift({t:S.time,txt}); if(W.log.length>40) W.log.length=40; aiNews(txt,kind||'news',important); }
const myCc=()=>new Set([...(S.hubs||[]).map(h=>AP(h).cc),...S.routes.flatMap(r=>r.stops.map(c=>AP(c).cc))]);
const hubCc=()=>new Set((S.hubs||[]).map(h=>AP(h).cc));
function wdPick(list,w){ let t=w.reduce((s,v)=>s+v,0), x=Math.random()*t; for(let i=0;i<list.length;i++){ x-=w[i]; if(x<=0) return list[i]; } return list[0]; }
const neighbors=(cc,km)=>{ const a=mainAirport(cc); if(!a) return []; return wdList().filter(o=>o!==cc&&mainAirport(o)&&dist(a,mainAirport(o))<km).sort((x,y)=>countryTraffic(y)-countryTraffic(x)); };

/* ---------- économie et population : chaque semaine ---------- */
function wdEconomy(){
  const W=S.wd;
  for(const [cc,x] of Object.entries(W.c)){
    x.pop*=1+x.pr/52;
    const reg=x.reg==='boom'?0.05:x.reg==='recession'?-0.06:x.reg==='reconstruction'?0.07:0;
    x.rich*=1+(x.rr+reg)/52+rnd(-0.002,0.002); x.rich=clamp(x.rich,0.4,3);
    if(x.reg!=='normal'&&x.regUntil<S.time){ const was=x.reg; x.reg='normal';
      if(was==='recession') wdNote(`📈 ${ccWith(cc)} sort de la récession : les voyageurs reviennent.`,'news',myCc().has(cc)); }
    // changements de cycle économique (rares)
    if(x.reg==='normal'&&!x.war&&Math.random()<0.004*wdLevel()){
      const boom=Math.random()<0.55; x.reg=boom?'boom':'recession'; x.regUntil=S.time+rndi(10,40)*7*DAY;
      const why=boom?pick(['un afflux d’investissements étrangers','la découverte d’un gisement','l’essor du tourisme','une réforme économique réussie','la hausse des prix des matières premières']):pick(['la chute des prix des matières premières','une crise bancaire','une forte inflation','la dévaluation de la monnaie','une dette publique hors de contrôle']);
      wdNote(boom?`💹 ${ccWith(cc)} en plein essor grâce à ${why} : la classe moyenne voyage plus, la demande grimpe.`:`📉 ${ccWith(cc)} entre en récession (${why}) : moins de voyages d’affaires et de loisirs.`, boom?'news':'warn', myCc().has(cc)); }
  }
}

/* ---------- guerres ---------- */
function wdWarTick(){
  const W=S.wd, heat=W.heat, mine=myCc(), hubs=hubCc();
  for(const w of W.wars.slice()){
    if(w.stage==='tension'&&w.next<=S.time){
      const x=w.ccs.map(wdC);
      if(Math.random()<0.65){ w.stage='war'; w.next=S.time+rndi(5,26)*7*DAY;
        for(const c of w.ccs){ const y=wdC(c); y.tense=0; y.war=1; y.closed=!hubs.has(c); y.reg='recession'; y.regUntil=w.next+rndi(8,20)*7*DAY; y.rich*=0.92; }
        const nb=[...new Set(w.ccs.flatMap(c=>neighbors(c,1600)))].filter(c=>!w.ccs.includes(c)).slice(0,4);
        for(const c of nb){ const y=wdC(c); if(y) y.evac=Math.max(y.evac||0,S.time+rndi(4,10)*7*DAY); }
        w.nb=nb;
        const names=w.ccs.map(ccWith).join(' et ');
        wdNote(w.ccs.length>1?`⚔️ GUERRE : ${names} entrent en conflit. Espace aérien fermé${w.ccs.some(c=>hubs.has(c))?' (sauf votre hub, sous protection)':''} ; des réfugiés fuient vers ${nb.map(ccName).join(', ')||'les pays voisins'}.`
          :`⚔️ GUERRE CIVILE en ${names} : l’espace aérien est fermé, les habitants fuient vers ${nb.map(ccName).join(', ')||'les pays voisins'}.`,'bad',true);
        if(Math.random()<0.7) wdMission(w.ccs[0],'war',`La guerre a éclaté en ${ccName(w.ccs[0])} ; des milliers de civils et d’étrangers sont bloqués à ${keyCity(mainAirport(w.ccs[0]))}`);
        const hit=S.routes.filter(r=>r.stops.some(c=>w.ccs.includes(AP(c).cc))&&!r.stops.some(c=>hubs.has(AP(c).cc)));
        if(hit.length) logMsg(`⚔️ ${hit.length} de vos lignes sont suspendues par la guerre (${hit.slice(0,3).map(r=>r.stops.join('⇄')).join(', ')}). Les vols vers les pays voisins sont pleins de réfugiés.`,'bad');
      } else { W.wars=W.wars.filter(v=>v!==w); for(const c of w.ccs){ const y=wdC(c); if(y) y.tense=0; }
        wdNote(`🕊️ Les tensions retombent entre ${w.ccs.map(ccName).join(' et ')} : accord de dernière minute, le ciel reste ouvert.`,'news',w.ccs.some(c=>mine.has(c))); }
    } else if(w.stage==='war'&&w.next<=S.time){
      W.wars=W.wars.filter(v=>v!==w);
      for(const c of w.ccs){ const y=wdC(c); if(!y) continue; y.war=0; y.closed=false; y.reg='reconstruction'; y.regUntil=S.time+rndi(20,52)*7*DAY; y.pop*=0.97; }
      wdNote(`🕊️ Cessez-le-feu : ${w.ccs.map(ccWith).join(' et ')} ${w.ccs.length>1?'rouvrent leur':'rouvre son'} espace aérien. Reconstruction : ONG, ingénieurs et familles affluent, la demande repart fort.`,'news',true);
    } else if(w.stage==='war'){
      for(const c of w.ccs){ const e=aiAlive().find(a=>a.cc===c); if(e&&Math.random()<0.3){ e.cash-=e.fleet*0.4e6; e.rep=clamp(e.rep-1,10,95); } }
    }
  }
  if(W.wars.length>=2) return;
  if(Math.random()<0.02*heat){
    const BIG=new Set(['CN','IN','US','RU','JP','BR','DE','GB','FR']);
    const cand=wdList().filter(cc=>countryTraffic(cc)>0.2&&incomeOf(cc)<=2&&!BIG.has(cc)&&!wdC(cc).war&&!wdC(cc).tense&&!hubs.has(cc));
    if(!cand.length) return; const a=wdPick(cand,cand.map(cc=>[2.4,1.6,0.8][incomeOf(cc)]||0.5));
    const nb=neighbors(a,1800).filter(c=>!hubs.has(c)&&!BIG.has(c)&&incomeOf(c)<=2&&!wdC(c).war);
    const ccs=Math.random()<0.55&&nb.length?[a,pick(nb)]:[a];
    for(const c of ccs) wdC(c).tense=1;
    W.wars.push({ccs,stage:'tension',next:S.time+rndi(1,3)*7*DAY,start:S.time});
    const why=ccs.length>1?pick(['un différend frontalier','le contrôle d’un gisement','un incident militaire à la frontière','une querelle sur un fleuve']):pick(['une élection contestée','une rébellion armée','un coup d’État manqué']);
    wdNote(ccs.length>1?`🪖 Bruits de bottes entre ${ccs.map(ccWith).join(' et ')} (${why}). Les réservations chutent ; l’espace aérien pourrait fermer dans les semaines à venir.`
      :`🪖 ${ccWith(a)} : ${why}, le pays est au bord de la guerre civile. Les compagnies s’inquiètent.`,'warn',ccs.some(c=>mine.has(c)));
    W.quiet=0; W.lastType='war';
  }
}

/* ---------- catastrophes et évacuations ---------- */
const DIS=[
  {k:'quake',w:3,ico:'🌍',name:'Séisme',shut:[3,10],dem:0.5,len:[3,6],evac:[2,5],rich:0.96,txt:(cc,city)=>`un séisme de magnitude ${(6+Math.random()*2).toFixed(1).replace('.',',')} frappe la région de ${city}`},
  {k:'cyclone',w:3,ico:'🌀',name:'Cyclone',shut:[2,6],dem:0.6,len:[2,4],evac:[1,3],rich:0.98,txt:(cc,city)=>`un cyclone dévaste les côtes près de ${city}`},
  {k:'flood',w:3,ico:'🌊',name:'Inondations',shut:[1,4],dem:0.7,len:[3,6],evac:[1,3],rich:0.98,txt:(cc,city)=>`des inondations historiques submergent ${city}`},
  {k:'volcano',w:1.5,ico:'🌋',name:'Éruption',shut:[4,12],dem:0.55,len:[2,5],evac:[1,3],rich:0.99,txt:(cc,city)=>`une éruption volcanique couvre le ciel de cendres autour de ${city}`},
  {k:'epidemic',w:2,ico:'🦠',name:'Épidémie',shut:[0,0],dem:0.45,len:[6,14],evac:[0,0],rich:0.97,txt:(cc,city)=>`une épidémie se propage depuis ${city} ; quarantaines et contrôles sanitaires`},
  {k:'famine',w:1.5,poor:true,ico:'🌾',name:'Sécheresse',shut:[0,0],dem:0.8,len:[8,16],evac:[3,8],rich:0.97,txt:(cc,city)=>`une sécheresse sévère frappe le pays ; l’aide humanitaire s’organise depuis ${city}`},
];
function wdDisTick(){
  const W=S.wd, mine=myCc();
  for(const d of W.dis.slice()) if(d.until<S.time){ W.dis=W.dis.filter(x=>x!==d); const x=wdC(d.cc); if(x) x.dis=null;
    wdNote(`✅ ${ccWith(d.cc)} : fin de la crise (${d.name.toLowerCase()}), la vie reprend son cours.`,'news',mine.has(d.cc)); }
  if(W.dis.length>=3||Math.random()>0.05*W.heat) return;
  let t=wdPick(DIS,DIS.map(x=>x.w)); if(t.k===W.lastDis) t=pick(DIS);
  const pool=wdList().filter(c=>countryTraffic(c)>0.2).filter(c=>!t.poor||incomeOf(c)<=1); if(!pool.length) return; const cc=wdPick(pool,pool.map(c=>Math.sqrt(countryTraffic(c)+1)*(incomeOf(c)<=1?1.6:1))); const x=wdC(cc); if(!x||x.dis||x.war) return;
  const hub=mainAirport(cc), city=keyCity(hub), len=rndi(t.len[0],t.len[1])*7*DAY;
  const d={cc,k:t.k,name:t.name,ico:t.ico,until:S.time+len,dem:t.dem,start:S.time}; W.dis.push(d); x.dis=d; x.rich*=t.rich;
  if(t.shut[1]){ const days=rndi(t.shut[0],t.shut[1]); shutAirport(hub,days); if(t.k==='volcano') for(const c of cAirports(cc).slice(1,4)) shutAirport(c,days); }
  if(t.evac[1]) x.evac=S.time+(t.shut[0]||0)*DAY+rndi(t.evac[0],t.evac[1])*7*DAY;
  wdNote(`${t.ico} ${t.name.toUpperCase()} — ${ccWith(cc)} : ${t.txt(cc,city)}.${t.shut[1]?` L’aéroport de ${city} est fermé quelques jours.`:''}${t.evac[1]?' Ensuite, beaucoup d’habitants devront partir : les vols au départ seront pleins.':' Les voyages s’effondrent.'}`,'bad',true);
  W.quiet=0; W.lastType='dis'; W.lastDis=t.k;
  if(S.fleet.length&&!hubCc().has(cc)) wdMission(cc,t.evac[1]?'evac':'aid',`${t.name} à ${keyCity(hub)} : ${t.txt(cc,city)}`);
}
/* ---------- missions RÉELLES : vos avions partent vraiment ----------
   Accepter une mission envoie un de vos avions : il décolle de sa base, vole jusqu'au pays
   en crise (couloir humanitaire, même si l'espace aérien est fermé), embarque les évacués et
   revient. On le voit sur la carte et en 3D, avec sa liste de passagers. Payé à l'atterrissage. */
const MISSION_KIND={
  evac:{ic:'🚑',name:'Évacuation',out:[4,12],back:1,mult:1.3,txt:'évacuer les habitants sinistrés'},
  war:{ic:'🛡️',name:'Pont aérien',out:[2,8],back:1,mult:1.9,txt:'rapatrier civils et ressortissants (zone de guerre)'},
  aid:{ic:'📦',name:'Aide humanitaire',out:0.35,back:0.12,mult:1.1,txt:'acheminer médecins et secouristes, ramener des blessés'},
};
let _wdCorr=null;    // pays où un couloir humanitaire est ouvert pendant le départ d'une mission
{ const _ac2=airportClosed; airportClosed=function(code){ if(_wdCorr&&AP(code)&&AP(code).cc===_wdCorr){ const sh=S.ai&&S.ai.shut&&S.ai.shut[code]; if(!(sh>S.time)) return false; } return _ac2(code); }; }
const withCorr=(cc,f)=>{ _wdCorr=cc; try{ return f(); } finally{ _wdCorr=null; } };
function missionFits(a,M){ const m=modelOf(a); if(isCargo(m)||!(m.seats>=20)||a.charterQ||(a.flight&&a.flight.kind==='charter')) return false;
  return !withCorr(M.cc,()=>checkLegs(a,legsFor([a.hub,M.to,a.hub]))); }
function missionEligible(M){ return S.fleet.filter(a=>missionFits(a,M)).sort((x,y)=>((y.status==='idle'&&y.loc===y.hub)-(x.status==='idle'&&x.loc===x.hub))||(modelOf(y).seats-modelOf(x).seats)).slice(0,4); }
function wdMission(cc,kind,why){
  const W=S.wd; W.missions=W.missions||[]; if(W.missions.some(x=>x.cc===cc&&!x.closed)) return;
  const to=mainAirport(cc), K=MISSION_KIND[kind]; if(!to||!S.fleet.length) return;
  const M={id:uid(),cc,to,kind,why,rot:kind==='aid'?rndi(1,2):rndi(2,4),done:0,exp:S.time+4*DAY,acc:false,closed:false};
  const el=missionEligible(M); if(!el.length) return;
  W.missions.push(M);
  const g=typeof govOf==='function'?govOf(cc):{leader:'—'}, sender={code:'GOV'+cc,name:`Gouvernement — ${ccName(cc)}`,color:'#dc2626',ceo:`Président ${g.leader}`};
  const ex=el[0], d=dist(ex.hub,to), per=Math.round((Math.min(modelOf(ex).seats,300)*d*0.16*K.mult*2+(kind==='war'?400000:150000))*(W.mood==='aide'?1.4:1)/1e3)*1e3;
  M.per=per;
  mailPush(sender,'gov-mission',`${K.ic} ${K.name} : ${keyCity(to)} (${ccName(cc)})`,
    `Monsieur le président-directeur général,<br>${esc(why)}. Nous vous demandons d’envoyer un avion pour <b>${K.txt}</b> à <b>${keyCity(to)}</b> : <b>${M.rot} rotation${M.rot>1?'s':''}</b> aller-retour depuis la base de l’avion choisi.<br>`+
    `Votre avion part <b>vraiment</b> : il quitte ses lignes, décolle, se pose à ${keyCity(to)} et revient avec ${kind==='aid'?'des blessés':'les évacués à bord'}. Vous le suivez sur la carte et en 3D. L’État paie environ <b>${fmtMoney(per)}</b> à chaque retour.`+
    (kind==='war'?'<br>⚠️ Zone de guerre : l’avion peut être endommagé au sol.':'')+`<br>— Président ${esc(g.leader)}`,
    [...el.map(a=>({k:'ac:'+a.id,l:`✈️ Envoyer ${a.reg} · ${modelOf(a).name.replace(/^(Airbus|Boeing|Embraer|Bombardier|ATR|De Havilland) /,'')} (${modelOf(a).seats} pl.) · ${a.status==='idle'&&a.loc===a.hub?'prêt':'dès son retour'}`})),{k:'no',l:'Refuser'}],
    {cc,mid:M.id,exp:M.exp});
}
function missionLaunch(M,ac){
  const C=S.charters=S.charters||{offers:[],active:[],done:0}, K=MISSION_KIND[M.kind];
  const o={id:uid(),kind:'mission',mid:M.id,ic:K.ic,who:`${K.name} ${keyCity(M.to)}`,why:M.why,from:ac.hub,to:M.to,pax:modelOf(ac).seats,reward:M.per,rep:2,deadline:S.time+20*DAY,acId:ac.id};
  C.active.push(o); M.acId=ac.id;
  if(ac.status==='idle'&&ac.loc===o.from&&(ac.readyAt||0)<=S.time+5*MIN&&!canFly(ac)){ const e=charterStart(ac,o,S.time); if(e){ C.active=C.active.filter(x=>x!==o); return e; } }
  else ac.charterQ=o.id;
  return null;
}
{ const _gm=govAnswer; govAnswer=function(m,k){ if(m.kind!=='gov-mission') return _gm(m,k);
  const M=(S.wd.missions||[]).find(x=>x.id===m.mid); if(!M||M.closed) return 'La mission n’est plus d’actualité.';
  if(!k.startsWith('ac:')){ M.closed=true; return 'Vous déclinez la mission.'; }
  const ac=S.fleet.find(a=>a.id===k.slice(3)); if(!ac||!missionFits(ac,M)) return '⛔ Cet avion ne peut plus partir (autonomie, piste, équipage ou déjà réservé).';
  M.acc=true; const e=missionLaunch(M,ac); if(e){ M.acc=false; return '⛔ '+e; }
  logMsg(`${MISSION_KIND[M.kind].ic} Mission ${MISSION_KIND[M.kind].name.toLowerCase()} : ${ac.reg} ${ac.status==='flight'&&ac.flight.kind==='charter'?'décolle':'partira dès qu’il sera libre à sa base'} vers ${keyCity(M.to)}.`,'ok');
  return `${MISSION_KIND[M.kind].ic} ${ac.reg} part en mission vers ${keyCity(M.to)} (${M.rot} rotation${M.rot>1?'s':''}). Suivez-le sur la carte !`; }; }
function wdMissionsTick(){ const W=S.wd; W.missions=(W.missions||[]).filter(M=>!(M.closed&&S.time-M.exp>30*DAY)); for(const M of W.missions) if(!M.acc&&!M.closed&&M.exp<S.time) M.closed=true; }

/* ---------- occasions quand vous êtes en difficulté ---------- */
function wdHelp(){
  const W=S.wd; if(W.mood!=='aide'||Math.random()>0.35) return;
  const ccs=[...myCc()].filter(cc=>wdC(cc)&&!wdC(cc).war&&wdC(cc).reg!=='boom'); if(!ccs.length) return;
  const cc=pick(ccs), x=wdC(cc); x.reg='boom'; x.regUntil=S.time+rndi(6,14)*7*DAY;
  wdNote(`💹 Bonne nouvelle pour ${ccWith(cc)} : ${pick(['un grand salon international','une coupe continentale de football','un pèlerinage géant','la saison des fêtes','l’ouverture d’une zone économique spéciale'])} attire des foules : la demande grimpe sur vos lignes.`,'ok',true);
  W.quiet=0;
}

/* ---------- la semaine du directeur ---------- */
function wdWeekly(){
  if(!S.ai||!S.ai.list) return; wdInit(); const W=S.wd;
  const wk=Math.floor(S.time/(7*DAY)); if(W.week===wk) return; W.week=wk;
  wdPace(); wdEconomy(); wdWarTick(); wdDisTick(); wdHelp();
  W.quiet++;
  if(W.quiet>=4){ W.quiet=0; if(Math.random()<0.5) { W.heat*=3; wdDisTick(); W.heat/=3; } }   // jamais plus d'un mois sans grand événement
  wdMissionsTick();
  for(const cc of Object.keys(W.c)) W.c[cc].f=wdCompute(cc);
  if(S.ai) S.ai.ver++;
}
{ const _aw=aiWeekly; aiWeekly=function(){ _aw(); try{ wdWeekly(); }catch(e){ console.warn(e); } }; }

/* ---------- contexte d'un passager (pour sa fiche) ---------- */
function wdPaxContext(ccFrom,rnd){
  const x=wdC(ccFrom); if(!x) return '';
  if(x.war) return 'fuit la guerre : a quitté sa maison avec deux valises';
  if(x.dis&&x.dis.until>S.time) return `quitte la région après : ${x.dis.name.toLowerCase()}, va chez de la famille`;
  if(x.evac>S.time) return 'évacué(e) : départ organisé en urgence';
  if(x.reg==='reconstruction') return 'revient aider à reconstruire le pays';
  if(x.reg==='boom'&&rnd()<0.3) return 'profite de l’essor économique de son pays pour voyager';
  if(x.reg==='recession'&&rnd()<0.3) return 'a économisé longtemps pour ce billet (crise économique au pays)';
  return '';
}

/* ---------- onglet « Monde » ---------- */
function wdTabHtml(){
  wdInit(); const W=S.wd, mine=myCc();
  const pct=v=>(v>=1?'+':'−')+Math.abs((v-1)*100).toFixed(1).replace('.',',')+' %';
  const popTxt=(cc,x)=>WD_POP[cc]?`${(WD_POP[cc]*x.pop).toFixed(WD_POP[cc]*x.pop<20?1:0).replace('.',',')} M hab.`:`population ${pct(x.pop)}`;
  const rows=Object.entries(W.c).map(([cc,x])=>({cc,x,f:x.f}));
  const up=rows.slice().sort((a,b)=>b.f-a.f).slice(0,8), down=rows.slice().sort((a,b)=>a.f-b.f).slice(0,8);
  const line=r=>`<div class="small">${COUNTRIES[r.cc][2]} <b>${esc(ccName(r.cc))}</b>${mine.has(r.cc)?' ✈️':''} — demande <b>${pct(r.f)}</b> · ${popTxt(r.cc,r.x)} · richesse ${pct(r.x.rich)}${r.x.reg!=='normal'?` · <i>${r.x.reg==='boom'?'essor':r.x.reg==='recession'?'récession':'reconstruction'}</i>`:''}</div>`;
  const wars=W.wars.map(w=>`<div class="al ${w.stage==='war'?'bad':'warn'}">${w.stage==='war'?'⚔️ Guerre':'🪖 Tensions'} : ${w.ccs.map(ccWith).join(' — ')}${w.stage==='war'?' · espace aérien fermé'+(w.nb&&w.nb.length?` · réfugiés vers ${w.nb.map(ccName).join(', ')}`:''):''}</div>`).join('');
  const dis=W.dis.map(d=>`<div class="al warn">${d.ico} ${esc(d.name)} — ${ccWith(d.cc)} jusqu’au ${fmtDate(d.until)}${wdC(d.cc).evac>S.time?' · évacuations en cours (vols pleins au départ)':''}</div>`).join('');
  const deals=(W.missions||[]).filter(M=>M.acc&&!M.closed).map(M=>{ const a=S.fleet.find(x=>x.id===M.acId), st=a&&a.flight&&a.flight.mission===M.id?flightState(a,simNow()):null; return `<div class="al ok">${MISSION_KIND[M.kind].ic} ${MISSION_KIND[M.kind].name} ${keyCity(M.to)} : rotation ${Math.min(M.done+1,M.rot)}/${M.rot} · ${a?esc(a.reg):''} ${st?`en vol ${st.origin} → ${st.dest} (${Math.round(st.progress*100)} %)`:'attend à sa base'} · ${M.saved||0} personnes ramenées${a?` <button class="btn sm" data-act="flSel" data-id="${a.id}">📍 Voir</button>`:''}</div>`; }).join('');
  const moodTxt=W.mood==='aide'?'🤝 Votre compagnie souffre : le monde vous laisse respirer et des occasions arrivent.':W.mood==='défi'?'🔥 Tout vous réussit : le monde devient plus agité pour vous mettre au défi.':'⚖️ Le monde suit son cours.';
  return `<div class="simplehelp">🎬 <b>Directeur du monde</b> — une IA fait vivre la planète : population et richesse de chaque pays, économie (essor, récession), guerres qui ferment l’espace aérien, catastrophes et évacuations. Elle dose le rythme selon votre partie. Événements fictifs.<br>${moodTxt}</div>
    <div class="btns">${WD_LVL.map(([l],i)=>`<button class="btn sm ${(S.wdLevel===undefined?1:S.wdLevel)===i?'gold':''}" data-act="wdLevel" data-k="${i}">${l}</button>`).join('')}</div>
    ${deals}${wars||''}${dis||''}${!wars&&!dis?'<div class="mut small">Aucune guerre ni catastrophe en cours.</div>':''}
    <h3>📈 Où la demande monte</h3>${up.map(line).join('')}
    <h3>📉 Où la demande baisse</h3>${down.map(line).join('')}
    <h3>🗞️ Journal du monde</h3><div class="log">${W.log.slice(0,15).map(l=>`<div class="lg"><span class="mut">${fmtDate(l.t)}</span> ${l.txt}</div>`).join('')||'<div class="mut small">Laissez passer quelques semaines…</div>'}</div>`;
}
// branché après le chargement du module des charters (progress.js)
function wdHookCharters(){ if(wdHookCharters.done||typeof charterStart!=='function') return; wdHookCharters.done=true;
// départ d'une rotation : couloir humanitaire ouvert, passagers adaptés
  { const _cs2=charterStart; charterStart=function(ac,o,t){ if(o.kind!=='mission') return _cs2(ac,o,t);
  const M=(S.wd.missions||[]).find(x=>x.id===o.mid), K=MISSION_KIND[M?M.kind:'evac'], seats=modelOf(ac).seats;
  const e=withCorr(M&&M.cc,()=>_cs2(ac,o,t)); if(e) return e;
  const L=ac.flight.legs, out=typeof K.out==='number'?Math.round(seats*K.out):rndi(K.out[0],K.out[1]);
  L[0].pax={f:0,j:0,w:0,y:Math.min(seats,out)}; L[0].cargo=+(seats*0.04).toFixed(1);                 // aller : secouristes, médecins, matériel
  L[1].pax={f:0,j:0,w:0,y:Math.min(seats,Math.round(seats*K.back*rnd(0.92,1)))};                       // retour : évacués
  ac.flight.mission=o.mid; return null; }; }
// chaque fin de tronçon de mission : arrivée en zone de crise, puis retour payé
  { const _cld=charterLegDone; charterLegDone=function(ac,fl,leg,arr){
  if(!fl.mission) return _cld(ac,fl,leg,arr);
  const W=S.wd, M=(W.missions||[]).find(x=>x.id===fl.mission), C=S.charters, o=C.active.find(x=>x.id===fl.contractId), K=MISSION_KIND[M?M.kind:'evac'];
  if(fl.li===0){   // posé dans le pays en crise
    if(M&&M.kind==='war'&&Math.random()<0.06){ ac.condition=Math.max(10,ac.condition-rndi(20,35)); S.reputation=clamp(S.reputation+1,0,100);
      wdNote(`💥 À ${keyCity(M.to)}, l’avion ${ac.reg} de ${S.company.name} est touché par des éclats sur le tarmac. Personne n’est blessé, l’équipage redécolle avec les évacués ; réparations à prévoir.`,'warn',true); }
    else logMsg(`${K.ic} ${ac.reg} s’est posé à ${keyCity(leg.to)} : embarquement de ${fl.legs[1].pax.y} ${M&&M.kind==='aid'?'blessés':'évacués'}.`,'info');
    return 0; }
  if(fl.li!==fl.legs.length-1||!o) return 0;
  const pay=o.reward; book('subventions',pay); S.stats.pax+=fl.legs[1].pax.y; C.active=C.active.filter(x=>x!==o); C.done=(C.done||0)+1;
  S.reputation=clamp(S.reputation+1.5,0,100);
  if(!M) return pay; M.done++;
  const saved=(M.saved=(M.saved||0)+fl.legs[1].pax.y);
  if(M.done<M.rot&&!M.closed){ const o2={...o,id:uid(),deadline:S.time+15*DAY}; C.active.push(o2); ac.charterQ=o2.id;
    logMsg(`${K.ic} Rotation ${M.done}/${M.rot} terminée : ${fl.legs[1].pax.y} personnes ramenées à ${keyCity(leg.to)} (+${fmtMoney(pay)}). ${ac.reg} repart.`,'ok'); }
  else { M.closed=true; wdNote(`${K.ic} Mission accomplie : ${S.company.name} a ramené ${saved} personnes de ${keyCity(M.to)} en ${M.done} rotation${M.done>1?'s':''}. ${ccName(M.cc)} remercie la compagnie.`,'ok',true); }
  return pay; }; }
}
function registerWorldActions(){ wdHookCharters(); Object.assign(ACTIONS,{ wdLevel:d=>{ S.wdLevel=+d.k; toast('🎬 Monde : '+WD_LVL[S.wdLevel][0],'info'); if(typeof renderPanel==='function') renderPanel(); } }); }
