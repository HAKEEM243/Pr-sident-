/* =========================================================
   Sky Empire — ⚔️ Ennemi juré
   La compagnie qui vous prend le plus de passagers à votre hub devient
   votre ennemie jurée. Elle a un caractère (Requin, Renard, Reine du
   ciel, Conquérant, Flambeur), un PDG qui vous écrit, une hostilité
   qui monte quand vous la battez, et un « match du mois » contre vous.
   Ses coups se voient vraiment :
   • 🛫 raid sur votre hub : ses avions décollent de votre aéroport ;
   • 🏷️ blitz : guerre des prix + vols en plus sur votre meilleure ligne ;
   • 👑 vitrine : service de luxe (elle attire plus de passagers) ;
   • 📰 rumeurs : votre image baisse, vous pouvez porter plainte ;
   • 🎲 pari : de l'argent réel sur le match du mois.
   Vos réponses (pression sur l'aéroport, contre-campagne, trêve,
   plainte) changent vraiment les parts de marché. Tout est fictif.
   ========================================================= */
'use strict';
const RL_STYLES={
  requin:{ic:'🦈',t:'Le Requin',d:'casse les prix et attaque vos meilleures lignes',ops:{blitz:4,raid:2,rumeur:0.5,vitrine:0.5,pari:1},
    q:['Sur mes lignes, le moins cher gagne. Toujours.','Je sens le sang : vos avions volent à moitié vides.','Vos tarifs ? Je les divise par deux demain.']},
  renard:{ic:'🦊',t:'Le Renard',d:'rumeurs et coups tordus',ops:{rumeur:4,raid:1.5,blitz:1,pari:1,vitrine:0.5},
    q:['Dans ce métier, la réputation se perd en une nuit.','Les journalistes m’adorent. Et vous ?','Je ne fais jamais la guerre de face.']},
  reine:{ic:'👑',t:'La Reine du ciel',d:'prestige, luxe et service à bord',ops:{vitrine:4,raid:1,blitz:0.5,rumeur:0.5,pari:1},
    q:['Mes passagers boivent du champagne. Les vôtres ?','La classe ne s’achète pas, elle se vole.','On ne rivalise pas avec l’élégance.']},
  conquerant:{ic:'🚀',t:'Le Conquérant',d:'envahit votre hub avec de nouvelles lignes',ops:{raid:4,blitz:1.5,vitrine:1,rumeur:0.5,pari:1},
    q:['Votre hub sera bientôt le mien.','Chaque porte libre dans votre aéroport porte mon nom.','J’ouvre une ligne par mois. Et vous ?']},
  joueur:{ic:'🎲',t:'Le Flambeur',d:'paris, défis et coups de poker',ops:{pari:4,blitz:1.5,raid:1.5,rumeur:1,vitrine:1},
    q:['Je parie que vous ne tiendrez pas l’année.','Tapis ! Qui suit ?','La chance sourit aux audacieux… donc à moi.']},
};
const RL_OP={raid:'🛫 Raid sur votre hub',blitz:'🏷️ Blitz tarifaire',vitrine:'👑 Service de luxe',rumeur:'📰 Campagne de rumeurs',pari:'🎲 Pari du mois'};
const rlState=()=>S.rl||(S.rl={nem:null,hos:30,w:0,l:0,ops:[],m:null,shield:[],bet:null,cool:0});
const rlHub=()=>(S.hubs||[]).slice().sort((a,b)=>AP(b).traffic-AP(a).traffic)[0]||S.company.hub;
const rlScale=()=>clamp(Math.abs(S.cash||0)*0.004,150000,8e6);
const rlMoney=v=>Math.round(v/1e4)*1e4;
function rlStyle(e){ if(!e) return RL_STYLES.renard; if(e.rlStyle&&RL_STYLES[e.rlStyle]) return RL_STYLES[e.rlStyle];
  const p=typeof personaOf==='function'?personaOf(e.code).k:'legacy', ks=['renard','joueur','conquerant','requin'];
  e.rlStyle=p==='lcc'?'requin':p==='premium'?'reine':p==='startup'?'conquerant':ks[hashStr(e.code)%ks.length]; return RL_STYLES[e.rlStyle]; }
const rlNem=()=>{ const st=rlState(), e=st.nem&&aiBy(st.nem); return e&&e.status!=='dead'?e:null; };
const rlOn=()=>!!(S.ai&&S.ai.list&&S.routes&&(typeof drive!=='function'||drive()>0));

/* ---------- qui est l'ennemi juré ? celle qui vous prend le plus de passagers chez vous ---------- */
function rlPick(){
  const st=rlState(), hub=rlHub(); let mk=null; try{ mk=typeof apMarket==='function'?apMarket(hub):null; }catch(e){}
  const nat=typeof natRival==='function'?natRival():null;
  const cand=((mk&&mk.list)||[]).filter(x=>!x.me&&x.e&&x.e.status!=='dead'&&!(typeof isAlly==='function'&&isAlly(x.code)))
    .map(x=>({e:x.e,s:x.share/(1+Math.abs(Math.log(Math.max(1,x.e.fleet)/Math.max(3,S.fleet.length))))*(nat&&nat.code===x.code?1.4:1)})).sort((a,b)=>b.s-a.s);
  const e=cand.length?cand[0].e:nat; if(!e) return null;
  if(st.nem!==e.code){ const old=st.nem&&aiBy(st.nem); st.nem=e.code; st.hos=Math.max(25,st.hos*0.5); st.w=0; st.l=0; st.m=null;
    rlEnsureR(e); const sy=rlStyle(e);
    if(!(typeof UI!=='undefined'&&UI.silent)) aiNews(`⚔️ ${e.name} devient votre ennemie jurée à ${keyCity(hub)}${old?` (à la place de ${old.name})`:''} : ${sy.ic} ${sy.t}, elle ${sy.d}.`,'rival',true);
    if(typeof mailPush==='function') mailPush(e,'rlhello',`${sy.ic} Bienvenue dans la cour des grands`,`${pick(sy.q)}<br><br>À partir d’aujourd’hui, chaque mois, on compare qui gagne le plus de part de marché à <b>${esc(keyCity(hub))}</b>. Le perdant paie sa tournée.<br><i>— ${esc(ceoOf(e))}, PDG de ${esc(e.name)} (${sy.t})</i>`,
      [{k:'nice',l:'🤝 Que le meilleur gagne'},{k:'tease',l:'😏 Vous allez perdre'}]); }
  return e;
}
// l'ennemie doit avoir de vrais avions sur la carte (lignes suivies)
function rlEnsureR(e){
  S.rivals=S.rivals||[]; let R=S.rivals.find(x=>x.code===e.code); if(R) return R;
  const hub=rlHub();
  if(typeof AIRLINE_DB!=='undefined'&&AIRLINE_DB[e.code]&&typeof makeRealRival==='function'){ R=makeRealRival(e.code,false);
    R.routes=R.routes.sort((x,y)=>((y.a===hub||y.b===hub)-(x.a===hub||x.b===hub))).slice(0,40); }
  else R={name:e.name, code:e.code, color:e.color||'#64748b', hub:e.hub, local:false, real:false, cash:e.cash, fleet:e.fleet, quality:1, rep:e.rep, paxDay:0, revDay:0, network:e.routes,
    routes:((S.ai.extra||{})[e.code]||[]).slice(0,30).map(k=>({a:k.slice(0,3),b:k.slice(3),freq:2}))};
  R.nem=true; S.rivals.push(R); S.ai.ver++; return R;
}
const rlR=()=>{ const e=rlNem(); return e&&(S.rivals||[]).find(x=>x.code===e.code); };
const rlBump=R=>{ if(R) R._v=(R._v||0)+1; if(S.ai) S.ai.ver++; };

/* ---------- match du mois : passagers par jour à votre hub ---------- */
function rlScoreNow(){
  const e=rlNem(), hub=rlHub(); if(!e) return null; let mk=null; try{ mk=apMarket(hub); }catch(err){ return null; }
  const me=mk.list.find(x=>x.me), th=mk.list.find(x=>x.code===e.code);
  return {shMe:me?me.share*100:0, shThem:th?th.share*100:0};
}
function rlDaily(){
  const st=rlState(), e=rlNem(); if(!e) return; const mkey=monthKey(S.time);
  if(!st.m||st.m.key!==mkey){ if(st.m&&st.m.n>0&&st.m.code===e.code) rlMonthEnd(st.m); const s0=rlScoreNow()||{shMe:0,shThem:0}; st.m={key:mkey,code:e.code,a0:s0.shMe,b0:s0.shThem,a:s0.shMe,b:s0.shThem,n:0,day:-1}; }
  const day=Math.floor(S.time/DAY); if(st.m.day===day) return; st.m.day=day;
  const s=rlScoreNow(); if(!s) return; st.m.a=s.shMe; st.m.b=s.shThem; st.m.n++;
}
function rlMonthEnd(m){
  const st=rlState(), e=rlNem(); if(!e||m.n<5) return; const sy=rlStyle(e), da=m.a-m.a0, db=m.b-m.b0, win=da>=db, hub=keyCity(rlHub()), pp=v=>(v>=0?'+':'−')+Math.abs(v).toFixed(1).replace('.',',')+' pt', pa=pp(da), pb=pp(db);
  const revenge=st.revenge; st.revenge=false;
  if(win){ st.w++; st.hos=clamp(st.hos+15,0,100); const rp=revenge?4:2; S.reputation=clamp(S.reputation+rp,0,100);
    aiNews(`🏆 Match du mois à ${hub} : ${S.company.name} bat ${e.name} (votre part de marché ${pa}, la sienne ${pb}). Image +${rp}${revenge?' (revanche promise, revanche tenue !)':''}.`,'rival',true);
    if(typeof mailPush==='function') mailPush(e,'rlbanter',`${sy.ic} Vous avez gagné… cette fois`,`Votre part à ${esc(hub)} : ${pa} ce mois-ci, la mienne ${pb}. Profitez-en.<br>${pick(sy.q)}<br><b>Mon conseil : surveillez vos arrières ce mois-ci.</b>`,[{k:'nice',l:'🙂 Rester fair-play'},{k:'tease',l:'😏 Enfoncer le clou'}]);
    rlRetreat(e);   // battue, elle abandonne ses lignes de raid qui ne rapportent rien
  } else { st.l++; st.hos=clamp(st.hos+5,0,100); S.reputation=clamp(S.reputation-1,0,100);
    aiNews(`📉 Match du mois à ${hub} : ${e.name} vous bat (sa part de marché ${pb}, la vôtre ${pa}). Image −1.`,'rival',true);
    if(typeof mailPush==='function') mailPush(e,'rlloss',`${sy.ic} Le mois est à moi`,`À ${esc(hub)}, ma part de marché a bougé de ${pb} ce mois-ci, la vôtre de ${pa}.<br>${pick(sy.q)}`,[{k:'revenge',l:'😤 Promettre la revanche (image ×2 si vous gagnez)'},{k:'nice',l:'🙂 Féliciter'}]); }
  const b=st.bet; if(b&&b.key===m.key){ st.bet=null;
    if(win){ book('ventes',b.stake); logMsg(`🎲 Pari gagné contre ${e.name} : ${fmtMoney(b.stake)} encaissés.`,'ok'); e.cash-=b.stake; }
    else { book('incidents',-b.stake); logMsg(`🎲 Pari perdu contre ${e.name} : ${fmtMoney(b.stake)} versés.`,'bad'); e.cash+=b.stake; } }
}

/* ---------- les coups de l'ennemie ---------- */
function rlWeekly(){
  if(!rlOn()) return; const st=rlState(); { const cur=rlNem(), sc=cur&&rlScoreNow(); if(!cur||(typeof isAlly==='function'&&isAlly(cur.code))||(sc&&sc.shThem<0.005&&(st.pick||0)+60*DAY<S.time)){ st.pick=S.time; rlPick(); } }
  const e=rlNem(); if(!e) return; st.hos=clamp(st.hos-1.5,0,100);
  rlOpsEnd();
  if(typeof inTruce==='function'&&(inTruce(e.code)||isAlly(e.code))) return;
  // en perte et très hostile : elle propose la paix
  if((e.mavg||0)<-0.04&&st.hos>55&&Math.random()<0.18&&!(S.inbox||[]).some(m=>m.kind==='rlpeace'&&m.st==='new')){ const fee=rlMoney(rlScale()*1.5);
    mailPush(e,'rlpeace',`🕊️ Et si on arrêtait ?`,`Nos actionnaires s’impatientent : cette guerre nous coûte cher à tous les deux.<br>Je vous propose une <b>paix de 4 mois</b> : je retire mes lignes de raid de ${esc(keyCity(rlHub()))} et je vous verse <b>${fmtMoney(fee)}</b> de dédommagement.`,[{k:'ok',l:`🕊️ Accepter (+${fmtMoney(fee)})`},{k:'no',l:'⚔️ Refuser : je veux tout'}],{fee}); return; }
  if(st.ops.some(o=>!o.done)||S.time<(st.cool||0)) return;
  const D=typeof drive==='function'?drive():2, p=(0.22+st.hos/220)*(0.4+D/4)*((e.mavg||0)<-0.1?0.5:1);
  if(Math.random()>p) return;
  const sy=rlStyle(e), w=Object.entries(sy.ops).filter(([k])=>rlCan(k,e)); if(!w.length) return;
  const k=wpick(w.map(([k,v])=>({k,w:v}))).k; rlPlan(k,e); st.cool=S.time+rndi(8,16)*DAY;
}
function rlCan(k,e){ const hub=rlHub();
  if(k==='raid') return typeof aiAirportMarketOpen!=='function'||aiAirportMarketOpen(hub,true);
  if(k==='blitz') return rlBestLine()!=null;
  if(k==='pari') return !rlState().bet&&S.cash>500000;
  return true; }
function rlBestLine(){ const L=(S.routes||[]).filter(r=>typeof routeAircraft!=='function'||routeAircraft(r).length); if(!L.length) return null;
  return L.slice().sort((x,y)=>(y.stats.rev-y.stats.cost)-(x.stats.rev-x.stats.cost))[0]; }
// coups annoncés par votre service de veille (vous avez le temps de répondre)
function rlPlan(k,e){
  const st=rlState(), sy=rlStyle(e), hub=rlHub(), id=uid(), due=S.time+rndi(2,4)*DAY, sc=rlScale(), op={id,k,code:e.code,due,t:S.time};
  const intel={code:'VEILLE',name:'Service de veille',ceo:'Votre service de veille',color:'#0ea5e9'};
  if(k==='raid'){ op.hub=hub; st.ops.push(op);
    mailPush(intel,'rlop',`📡 ${e.name} prépare un raid sur ${keyCity(hub)}`,`Nos sources sont formelles : <b>${esc(e.name)}</b> (${sy.ic} ${sy.t}) va ouvrir <b>deux lignes au départ de votre hub ${esc(keyCity(hub))}</b> le <b>${fmtDate(due)}</b>. Ses avions décolleront de chez vous et prendront vos passagers.<br>Que faisons-nous ?`,
      [{k:'lobby',l:`🏛️ Pression sur l’aéroport (${fmtMoney(rlMoney(sc))}, 1 chance sur 2 de bloquer)`},{k:'shield',l:`📣 Contre-campagne 45 j (${fmtMoney(rlMoney(sc*1.4))})`},{k:'let',l:'Laisser venir'}],{op:id,c1:rlMoney(sc),c2:rlMoney(sc*1.4)});
  } else if(k==='blitz'){ const r=rlBestLine(); op.a=r.stops[0]; op.b=r.stops[r.stops.length-1]; st.ops.push(op);
    mailPush(intel,'rlop',`📡 Blitz tarifaire en vue sur ${keyCity(op.a)}–${keyCity(op.b)}`,`<b>${esc(e.name)}</b> vise votre ligne la plus rentable, <b>${esc(keyCity(op.a))} – ${esc(keyCity(op.b))}</b> : à partir du <b>${fmtDate(due)}</b>, billets bradés et <b>2 vols de plus par jour</b> pendant 3 semaines.`,
      [{k:'shield',l:`📣 Contre-campagne sur la ligne (${fmtMoney(rlMoney(sc*0.8))})`},{k:'truce',l:`🕊️ Proposer une trêve (${fmtMoney(rlMoney(sc*2))})`},{k:'let',l:'💪 Tenir bon'}],{op:id,c2:rlMoney(sc*0.8),c3:rlMoney(sc*2)});
  } else if(k==='vitrine'){ op.due=S.time; st.ops.push(op); rlExec(op); }
  else if(k==='rumeur'){ op.due=S.time; st.ops.push(op); rlExec(op); }
  else if(k==='pari'){ op.due=S.time; op.done=true; st.ops.push(op); const stake=rlMoney(clamp(S.cash*0.03,250000,25e6));
    mailPush(e,'rlbet',`${sy.ic} Un petit pari ?`,`${pick(sy.q)}<br>Je parie <b>${fmtMoney(stake)}</b> que ${esc(e.name)} gagnera plus de part de marché que vous à <b>${esc(keyCity(hub))}</b> ce mois-ci. Le score s’affiche en direct dans votre fiche « Ennemi juré ».`,
      [{k:'ok',l:`🎲 Tenu (${fmtMoney(stake)})`},{k:'no',l:'Refuser'}],{stake}); }
}
function rlExec(op){
  const st=rlState(), e=aiBy(op.code); op.done=true; if(!e||e.status==='dead') return; const R=rlEnsureR(e), sy=rlStyle(e);
  if(op.blocked){ aiNews(`🏛️ ${e.name} renonce à son raid sur ${keyCity(op.hub)} : l’aéroport lui refuse les créneaux.`,'rival',true); return; }
  if(op.k==='raid'){
    const hub=op.hub, mine=new Set((S.routes||[]).flatMap(r=>r.stops.includes(hub)?r.stops:[]));
    const cand=(AP_ROUTES[hub]||AIRPORT_CODES).filter(c=>c!==hub&&AP(c)&&AP(c).cls>=2&&dist(hub,c)>200&&dist(hub,c)<(e.fleet>=60?7000:3500)&&!carriersOn(hub,c).includes(e.code)&&!(typeof airspaceViolation==='function'&&airspaceViolation(e.code,hub,c)))
      .sort((x,y)=>(mine.has(y)-mine.has(x))||marketDemand(hub,y)-marketDemand(hub,x)).slice(0,2);
    if(!cand.length) return; op.lines=[];
    for(const c of cand){ const key=pairKey(hub,c); (S.ai.extra[e.code]=S.ai.extra[e.code]||[]).push(key); e.routes++; R.routes.push({a:hub,b:c,freq:3,rl:op.id}); op.lines.push(c); }
    op.until=S.time+60*DAY; rlBump(R);
    aiNews(`🛫 Raid : ${e.name} débarque à ${keyCity(hub)} avec ${cand.map(keyCity).join(' et ')} (3 vols par jour chacune). Ses avions décollent de votre hub — regardez la carte.`,'rival',true);
    if(typeof toast==='function'&&!UI.silent) toast(`🛫 ${esc(e.name)} attaque ${esc(keyCity(hub))} : ses avions décollent de chez vous (⚔️ Ennemi juré)`,'rival');
  } else if(op.k==='blitz'){
    const key=pairKey(op.a,op.b); S.ai.wars=S.ai.wars||{}; op.until=S.time+21*DAY;
    S.ai.wars[e.code+key]={code:e.code,a:op.a,b:op.b,until:op.until,kind:'prix'};
    let rt=R.routes.find(x=>pairKey(x.a,x.b)===key); if(!rt){ rt={a:op.a,b:op.b,freq:0,rl:op.id}; R.routes.push(rt); (S.ai.extra[e.code]=S.ai.extra[e.code]||[]).push(key); op.added=true; }
    rt.freq=(rt.freq||0)+2; op.extra=2; rlBump(R);
    aiNews(`🏷️ Blitz : ${e.name} brade ses billets et ajoute 2 vols par jour sur ${keyCity(op.a)}–${keyCity(op.b)}, votre meilleure ligne.`,'rival',true);
  } else if(op.k==='vitrine'){
    op.until=S.time+60*DAY; op.q0=R.quality||1; R.quality=+(op.q0*1.15).toFixed(3); e.rep=clamp((e.rep||60)+3,10,95); rlBump(R);
    aiNews(`👑 ${e.name} lance un service de luxe (sièges-lits, chef étoilé, salon VIP) : ses vols attirent plus de passagers pendant 2 mois.`,'rival',true);
    mailPush(e,'rlvitrine',`${sy.ic} Avez-vous goûté notre champagne ?`,`${pick(sy.q)}<br>Nos passagers ont désormais droit à un salon privé et à un menu de chef. Les vôtres ont droit… à un sandwich ?`,
      [{k:'lounge',l:`🥂 Répliquer : ouvrir un salon VIP 60 j (${fmtMoney(rlMoney(rlScale()*1.2))})`},{k:'nice',l:'Ignorer'}],{op:op.id,c2:rlMoney(rlScale()*1.2)});
  } else if(op.k==='rumeur'){
    const hit=3; S.reputation=clamp(S.reputation-hit,0,100); op.hit=hit; op.over=true;
    const what=pick(['vos avions seraient mal entretenus','vos pilotes seraient épuisés','vos repas auraient rendu des passagers malades','vous seriez au bord de la faillite']);
    aiNews(`📰 Des articles anonymes affirment que ${what}. Votre image chute de ${hit} points. On murmure que ${e.name} est derrière.`,'rival',true);
    mailPush({code:'COM',name:'Communication',ceo:'Votre directrice de la communication',color:'#a855f7'},'rlrumor',`📰 Rumeurs contre nous`,`La presse affirme que ${what}. C’est faux, et tout indique que <b>${esc(e.name)}</b> a lancé la rumeur. Image <b>−${hit}</b>.`,
      [{k:'sue',l:`⚖️ Porter plainte (${fmtMoney(rlMoney(rlScale()*0.6))}, 60 % de chances)`},{k:'deny',l:`📣 Démenti officiel (${fmtMoney(rlMoney(rlScale()*0.25))}, rend 1,5 point)`},{k:'no',l:'Ignorer'}],{op:op.id,c1:rlMoney(rlScale()*0.6),c2:rlMoney(rlScale()*0.25)});
  }
}
// fins des coups : le blitz s'arrête, la vitrine aussi ; le raid reste tant qu'il rapporte
function rlOpsEnd(){
  const st=rlState();
  for(const op of st.ops){ if(!op.done||op.over||!op.until||op.until>S.time) continue; const e=aiBy(op.code), R=e&&(S.rivals||[]).find(x=>x.code===e.code);
    if(op.k==='blitz'&&R){ const key=pairKey(op.a,op.b), rt=R.routes.find(x=>pairKey(x.a,x.b)===key); if(rt){ rt.freq=Math.max(0,rt.freq-(op.extra||0)); if(op.added||rt.freq<=0){ R.routes=R.routes.filter(x=>x!==rt); if(S.ai.extra[e.code]) S.ai.extra[e.code]=S.ai.extra[e.code].filter(x=>x!==key); } } rlBump(R); op.over=true;
      aiNews(`🕊️ Fin du blitz de ${e.name} sur ${keyCity(op.a)}–${keyCity(op.b)} : vols supplémentaires retirés.`,'rival'); }
    else if(op.k==='vitrine'&&R){ R.quality=op.q0||1; rlBump(R); op.over=true; }
    else if(op.k!=='raid') op.over=true; }
  st.ops=st.ops.filter(o=>!(o.over&&S.time-o.t>90*DAY));
}
function rlRetreat(e,all){ const st=rlState(), R=(S.rivals||[]).find(x=>x.code===e.code); if(!R) return; let n=0;
  for(const op of st.ops){ if(op.k!=='raid'||op.over||!op.lines||op.code!==e.code) continue; if(!all&&op.until>S.time) continue;
    for(const c of op.lines){ const key=pairKey(op.hub,c); R.routes=R.routes.filter(x=>!(x.rl===op.id&&pairKey(x.a,x.b)===key)); if(S.ai.extra[e.code]) S.ai.extra[e.code]=S.ai.extra[e.code].filter(x=>x!==key); e.routes=Math.max(0,e.routes-1); n++; }
    op.over=true; }
  if(n){ rlBump(R); aiNews(`🚪 ${e.name} se retire de ${keyCity(rlHub())} : ${n} ligne${n>1?'s':''} de raid fermée${n>1?'s':''}. Ses avions ne décollent plus de chez vous.`,'rival',true); } }
function rlHourly(){ if(!rlOn()) return; const st=rlState(); for(const op of st.ops) if(!op.done&&op.due<=S.time) rlExec(op); rlDaily(); }

/* ---------- vos réponses ont un vrai effet sur les parts de marché ---------- */
const rlShieldOn=(code,a,b)=>(rlState().shield||[]).some(s=>s.until>S.time&&s.code===code&&(s.pair?s.pair===pairKey(a,b):(a===s.hub||b===s.hub)));
{ const _wf=typeof warFactor==='function'?warFactor:null; if(_wf) warFactor=function(code,a,b){ let f=_wf(code,a,b); if(S.rl&&rlShieldOn(code,a,b)) f*=0.65; return f; }; }
function rlAnswer(m,k){
  const st=rlState(), e=aiBy(m.code)||rlNem(), op=m.op&&st.ops.find(o=>o.id===m.op), pay=c=>{ if(S.cash<c){ toast('Trésorerie insuffisante','bad'); return false; } book('marketing',-c); return true; };
  const N=e?e.name:'votre rivale';
  if(m.kind==='rlop'){
    if(k==='lobby'){ if(!pay(m.c1)) return null; if(op&&Math.random()<0.5+(AP(op.hub||rlHub()).xp||0)*0.04){ op.blocked=true; st.hos=clamp(st.hos+5,0,100); return `🏛️ Réussi : l’aéroport refusera les créneaux à ${N}. Le raid n’aura pas lieu.`; } return `🏛️ Échec : ${N} a obtenu ses créneaux. Le raid aura lieu le ${op?fmtDate(op.due):'jour prévu'}.`; }
    if(k==='shield'){ if(!pay(m.c2)) return null; const pair=op&&op.k==='blitz'?pairKey(op.a,op.b):null; (st.shield=st.shield||[]).push({code:op?op.code:m.code,hub:op&&op.hub||rlHub(),pair,until:S.time+45*DAY});
      return `📣 Contre-campagne lancée pour 45 jours : ${N} attire 35 % de passagers en moins ${pair?`sur ${keyCity(op.a)}–${keyCity(op.b)}`:`à ${keyCity(rlHub())}`}.`; }
    if(k==='truce'){ if(!pay(m.c3)) return null; S.truce=S.truce||{}; S.truce[op?op.code:m.code]=S.time+90*DAY; if(op){ op.done=true; op.over=true; } st.hos=clamp(st.hos-30,0,100); return `🕊️ Trêve de 3 mois signée avec ${N} : le blitz est annulé.`; }
    return `Vous laissez ${N} venir.`;
  }
  if(m.kind==='rlbet'){ if(k==='ok'){ st.bet={stake:m.stake,key:monthKey(S.time)}; st.hos=clamp(st.hos+5,0,100); return `🎲 Pari tenu : ${fmtMoney(m.stake)} sur le match du mois contre ${N}.`; } return `Vous refusez le pari. ${N} vous traite de poule mouillée dans la presse.`; }
  if(m.kind==='rlrumor'){ if(!e) return 'Traité.';
    if(k==='sue'){ if(!pay(m.c1)) return null; if(Math.random()<0.6){ const dmg=m.c1*3; book('ventes',dmg); S.reputation=clamp(S.reputation+3,0,100); e.rep=clamp(e.rep-5,10,95); e.cash-=dmg; aiNews(`⚖️ Procès gagné : ${e.name} condamnée pour diffamation envers ${S.company.name}, ${fmtMoney(dmg)} de dommages.`,'rival',true); return `⚖️ Gagné ! ${fmtMoney(dmg)} de dommages, image +3, et celle de ${N} −5.`; } return `⚖️ Plainte rejetée faute de preuves. Les frais sont perdus.`; }
    if(k==='deny'){ if(!pay(m.c2)) return null; S.reputation=clamp(S.reputation+1.5,0,100); return '📣 Démenti publié : image +1,5.'; }
    return 'Vous laissez passer la rumeur.'; }
  if(m.kind==='rlvitrine'){ if(k==='lounge'){ if(!pay(m.c2)) return null; (st.shield=st.shield||[]).push({code:m.code,hub:rlHub(),until:S.time+60*DAY}); S.reputation=clamp(S.reputation+1,0,100); return `🥂 Salon VIP ouvert à ${keyCity(rlHub())} pour 60 jours : ${N} perd son avantage chez vous, image +1.`; } return 'Vous ignorez la provocation.'; }
  if(m.kind==='rlpeace'){ if(!e) return 'Traité.'; if(k==='ok'){ S.truce=S.truce||{}; S.truce[e.code]=S.time+120*DAY; book('ventes',m.fee); e.cash-=m.fee; st.hos=10; rlRetreat(e,true); return `🕊️ Paix de 4 mois avec ${N} : ${fmtMoney(m.fee)} encaissés, ses lignes de raid sont fermées.`; }
    st.hos=clamp(st.hos+10,0,100); return `⚔️ Vous refusez la paix : ${N} est furieuse.`; }
  if(m.kind==='rlloss'&&k==='revenge'){ st.revenge=true; return '😤 Revanche promise : si vous gagnez le mois prochain, image ×2.'; }
  if(k==='tease'){ st.hos=clamp(st.hos+6,0,100); S.reputation=clamp(S.reputation+(Math.random()<0.6?0.6:-0.6),0,100); return `😏 Votre réplique fait le buzz. ${N} est piquée au vif (hostilité +6).`; }
  st.hos=clamp(st.hos-3,0,100); S.reputation=clamp(S.reputation+0.3,0,100); return '🙂 Échange cordial. Image +0,3.';
}
function rlHook(){ if(rlHook.done||typeof mailAnswer!=='function') return; rlHook.done=true;
  const _ma=mailAnswer; mailAnswer=function(id,k){ const m=(S.inbox||[]).find(x=>x.id===id);
    if(!m||m.st!=='new'||!m.kind||!m.kind.startsWith('rl')) return _ma(id,k);
    const res=rlAnswer(m,k); if(res===null) return; m.st='done'; m.res=res; logMsg(res,'ok');
    renderMailBadge(); if(UI.modal==='inbox') openM('inbox'); if(typeof renderPanel==='function') renderPanel(); };
  if(typeof aiWeekly==='function'){ const _aw=aiWeekly; aiWeekly=function(){ const wk=S.ai&&S.ai.lastWeek; _aw(); try{ if(S.ai&&S.ai.lastWeek!==wk) rlWeekly(); }catch(e){ console.warn(e); } }; }
  if(typeof aiHourly==='function'){ const _ah=aiHourly; aiHourly=function(){ _ah(); try{ rlHourly(); }catch(e){ console.warn(e); } }; }
  if(typeof natRivalHtml==='function'){ const _nh=natRivalHtml; natRivalHtml=function(){ let h=''; try{ h=rlCardHtml(); }catch(e){ console.warn(e); } return h||_nh(); }; }
  Object.assign(ACTIONS,{ rlMap:()=>{ const h=AP(rlHub()); try{ closeModal(); }catch(e){} if(typeof MAPOPT!=='undefined') MAPOPT.rival=true; if(typeof map!=='undefined'&&map) map.setView([h.lat,h.lon],9); toast('⚔️ Les avions de votre ennemie sont à sa couleur sur la carte','info'); },
    rlOpen:()=>showModal('⚔️ Ennemi juré', rlCardHtml(true)||'<p>Pas encore d’ennemie jurée : ouvrez des lignes depuis votre hub.</p>', true) });
}

/* ---------- fiche « Ennemi juré » ---------- */
function rlCardHtml(full){
  if(!S.rl||!rlOn()) return ''; const e=rlNem(); if(!e) return ''; const st=rlState(), sy=rlStyle(e), s=rlScoreNow()||{shMe:0,shThem:0}, hub=keyCity(rlHub());
  const m=st.m&&st.m.code===e.code?st.m:null, da=m?s.shMe-m.a0:0, db=m?s.shThem-m.b0:0, pp=v=>(v>=0?'+':'−')+Math.abs(v).toFixed(1).replace('.',',')+' pt', lead=da>=db;
  const end=new Date(S.time); end.setUTCMonth(end.getUTCMonth()+1,0);
  const bar=(v,c)=>`<div style="height:9px;border-radius:5px;background:#33415555;overflow:hidden"><div style="height:100%;width:${clamp(v,0,100)}%;background:${c}"></div></div>`;
  const ops=st.ops.filter(o=>!o.over&&!(o.k==='pari')).map(o=>{ const what=RL_OP[o.k]+(o.k==='blitz'?` ${keyCity(o.a)}–${keyCity(o.b)}`:o.k==='raid'&&o.lines?` : ${o.lines.map(keyCity).join(', ')}`:'');
    return `<div class="small">${what} · ${!o.done?`<b class="warnt">dans ${Math.max(0,Math.ceil((o.due-S.time)/DAY))} j</b>`:o.blocked?'bloqué':o.k==='raid'?`depuis le ${fmtDate(o.due)} — battez-la au match du mois pour la chasser`:o.until?`jusqu’au ${fmtDate(o.until)}`:'en cours'}</div>`; }).join('');
  const shields=(st.shield||[]).filter(x=>x.until>S.time).map(x=>`<div class="small pos">📣 Votre contre-campagne ${x.pair?keyCity(x.pair.slice(0,3))+'–'+keyCity(x.pair.slice(3)):'à '+keyCity(x.hub)} jusqu’au ${fmtDate(x.until)}</div>`).join('');
  return `<div class="card small rivalcard"><b>⚔️ Ennemi juré : <span style="color:${e.color||'#ef4444'}">${esc(e.name)}</span></b> · ${sy.ic} ${sy.t}
    <div class="mut">PDG : ${esc(ceoOf(e))} — « ${esc(pick(sy.q))} »</div>
    <div class="grid2"><div>Hostilité : <b>${Math.round(st.hos)} %</b>${bar(st.hos,'#ef4444')}</div><div>Bilan des matchs : <b>${st.w} V – ${st.l} D</b><br><span class="mut">Flotte ${e.fleet} (vous : ${S.fleet.length})</span></div></div>
    <div style="margin-top:6px">🏆 <b>Match du mois à ${esc(hub)}</b> <span class="mut">(fin le ${fmtDate(end.getTime())})</span>${st.bet?` · 🎲 pari ${fmtMoney(st.bet.stake)}`:''}${st.revenge?' · 😤 revanche promise':''}
      <div class="small">Part des passagers à ${esc(hub)} : vous <b>${s.shMe.toFixed(1).replace('.',',')} %</b> ${bar(s.shMe,S.company.color||'#ffd60a')} ${esc(e.name)} <b>${s.shThem.toFixed(1).replace('.',',')} %</b> ${bar(s.shThem,e.color||'#ef4444')}</div>
      <div class="small ${lead?'pos':'neg'}">Progression ce mois-ci : vous <b>${pp(da)}</b> · elle <b>${pp(db)}</b> → ${lead?'vous gagnez':'elle gagne'} pour l’instant. Gagne celui qui progresse le plus : ouvrez des lignes et ajoutez des vols depuis ${esc(hub)}.</div></div>
    ${ops||shields?`<div style="margin-top:6px"><b>Coups en cours</b>${ops}${shields}</div>`:''}
    <div class="row" style="gap:6px;margin-top:6px"><button class="btn sm" data-act="rlMap">🗺️ Voir ses avions</button><button class="btn sm" data-act="inbox">📬 Messages</button>${full?'':'<button class="btn sm" data-act="rlOpen">⚔️ Détails</button>'}</div>
    ${full?`<p class="small mut">Son style : elle ${sy.d}. Ses coups sont annoncés par votre service de veille 2 à 4 jours avant : vous pouvez bloquer un raid, lancer une contre-campagne ou négocier une trêve. Battez-la au match du mois et elle finit par retirer ses lignes de votre hub. Compagnies, PDG et scores sont fictifs (calculés par le jeu).</p>`:''}</div>`;
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ rlHook(); }catch(e){ console.warn(e); } },0));
