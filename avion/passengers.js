/* ============================================================
   PASSAGERS & IMMIGRATION
   Qui voyage vers un pays : nationalité, richesse, motif du voyage,
   classe, compagnie choisie, prix payé, fréquence des voyages.
   Les volumes viennent du modèle de demande du jeu ; la répartition
   est une estimation (voyageurs et fiches fictifs, générés par le jeu).
   ============================================================ */

/* ---------- niveau de revenu par pays : 0 faible · 1 moyen inférieur · 2 moyen supérieur · 3 élevé ---------- */
const INCOME_LVL={};
(function(){
  const set=(lvl,codes)=>codes.split(' ').forEach(c=>INCOME_LVL[c]=lvl);
  set(3,'US CA GB IE FR DE NL BE LU CH AT IT ES PT DK SE NO FI IS JP KR AU NZ SG HK MO IL AE QA KW BH SA OM CY MT SI EE LV LT CZ SK PL HR HU GR UY CL PA SC TW BN PR GU BM KY BS AW CW MC LI SM AD GI FO GL NC PF RE GP MQ GF');
  set(2,'CN BR MX AR CO PE EC CR DO TH MY TR RU KZ BG RO RS BY AL BA ME MK GE AM AZ IR IQ LB JO DZ LY ZA BW NA GA GQ MU JM CU PY SR FJ MV TM XK TT BB GD LC VC AG KN DM BZ GY WS TO DZ TN');
  set(1,'IN ID PH VN BD PK LK NP EG MA NG GH CI SN CM KE ZM ZW AO CG BO HN GT SV NI UZ KG TJ MN UA MD LA KH MM PG TL BT DJ MR LS SZ CV ST VU SB FM KI PS HT');
  set(0,'CD CF TD NE ML BF GN SL LR TG BJ GW GM SS SD SO ER ET UG RW BI MW MZ MG TZ KM YE AF SY KP');
})();
const incomeOf=cc=>INCOME_LVL[cc]!==undefined?INCOME_LVL[cc]:1;
const INCOME_LABEL=['revenu faible','revenu moyen inférieur','revenu moyen supérieur','revenu élevé'];

/* ---------- aléa reproductible (une fiche passager ne change pas à chaque affichage) ---------- */
function seeded(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const hashS=str=>{ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; };
function pickW(rnd,items){ let tot=0; for(const [,w] of items) tot+=w; let r=rnd()*tot; for(const [v,w] of items){ r-=w; if(r<=0) return v; } return items[items.length-1][0]; }

/* ---------- richesse, motifs, fréquences ---------- */
// Part des voyageurs aériens par niveau de richesse, selon le niveau de revenu du pays de départ
const WEALTH_MIX={0:{rich:.22,mid:.38,poor:.40},1:{rich:.16,mid:.46,poor:.38},2:{rich:.13,mid:.52,poor:.35},3:{rich:.24,mid:.56,poor:.20}};
const WEALTH_LABEL={rich:'Aisé',mid:'Classe moyenne',poor:'Modeste'};
const PURPOSES=[['business','💼 Voyage d’affaires'],['tourism','🏖️ Tourisme'],['family','👪 Visite famille / amis'],['study','🎓 Études'],['work','🛠️ Travail / installation'],['medical','🏥 Soins médicaux'],['pilgrim','🕌 Pèlerinage / religion'],['humanitarian','🤝 Mission humanitaire']];
const PURPOSE_LABEL=Object.fromEntries(PURPOSES);
function purposeMix(wealth, lvlFrom, lvlTo, km, ccFrom, ccTo){
  const m={business:.22,tourism:.28,family:.28,study:.05,work:.07,medical:.015,pilgrim:.02,humanitarian:.01};
  if(wealth==='rich'){ m.business*=1.9; m.tourism*=1.4; m.family*=.6; m.work*=.3; }
  if(wealth==='poor'){ m.business*=.35; m.tourism*=.55; m.family*=1.5; m.work*=2.4; m.study*=.9; m.medical*=1.3; }
  if(lvlTo>lvlFrom){ m.work*=1+(lvlTo-lvlFrom)*.8; m.study*=1+(lvlTo-lvlFrom)*.9; m.medical*=1+(lvlTo-lvlFrom)*.8; }
  if(lvlTo<lvlFrom){ m.humanitarian*=2.5; m.business*=1.2; m.tourism*=1.2; }
  if(km<900){ m.business*=1.3; m.family*=1.2; m.tourism*=.8; }
  if(km>6000){ m.family*=1.2; m.study*=1.3; }
  if(['SA','AE','QA','EG','TR','MA','DZ','TN','JO','ID','PK','BD','NG','SN'].includes(ccTo)||['SA'].includes(ccFrom)){ m.pilgrim*=ccTo==='SA'?9:1.5; }
  if(ccTo==='CD'||ccTo==='SS'||ccTo==='CF'||ccTo==='SD'||ccTo==='SO'){ m.humanitarian*=6; m.business*=1.2; }
  const s=Object.values(m).reduce((a,b)=>a+b,0); for(const k in m) m[k]/=s; return m;
}
// Voyages par personne et par an
function tripsPerYear(wealth,purpose){
  const base={business:wealth==='rich'?14:wealth==='mid'?7:4, tourism:wealth==='rich'?3.2:wealth==='mid'?1.6:.5, family:wealth==='rich'?3:wealth==='mid'?1.8:.8, study:2, work:wealth==='rich'?5:1.6, medical:1.3, pilgrim:.6, humanitarian:6};
  return base[purpose]||1.5;
}
const AGE_RANGE={business:[27,62],tourism:[22,72],family:[18,78],study:[17,29],work:[19,48],medical:[4,82],pilgrim:[38,78],humanitarian:[24,58]};
const PROF={rich:['chef d’entreprise','avocat d’affaires','médecin spécialiste','cadre dirigeant','ingénieur pétrolier','banquier','investisseur','diplomate','architecte','promoteur immobilier','armateur'],
  mid:['enseignant','ingénieur','commerçant','infirmier','comptable','consultant','journaliste','technicien','cadre de PME','fonctionnaire','pharmacien','chauffeur-livreur','agent de voyage'],
  poor:['étudiant boursier','commerçant ambulant','ouvrier','agriculteur','travailleur saisonnier','chauffeur','artisan','employé de maison','petit exportateur','vendeur de marché','mineur artisanal']};

/* ---------- cohérence des fiches : genre, métier, âge ---------- */
const FEM_NAMES=new Set(['Christelle','Grâce','Merveille','Rachel','Sarah','Esther','Nathalie','Prisca','Gloire','Ruth','Bénédicte','Amina','Fatou','Aïcha','Grace','Mariam','Zainab','Emma','Sofia','Anna','Elena','Julia','Inès','Yuki','Aisha','Mei','Priya','Linh','Emily','Olivia','Sophia','Chloe','María','Ana','Valentina','Camila','Lucía','Isabela','Mariana','Mia','Charlotte','Ruby','Isla','Aroha','Zoe','Marie','Hannah','Olga','Patience','Gloria','Fatima','Layla','Ngozi','Adaeze','Anjali','Jennifer','Linda','Amelia','Claire','Katrin','Jing','Leïla','Ingrid','Nadia','Isabel','Camille']);
const MASC_NAMES=new Set(['Junior','Trésor','Héritier','Fiston','Dieudonné','Blaise','Serge','Cédric','Fabrice','Olivier','Jonathan','Patrick','Jean-Pierre','Moussa','Kofi','Tunde','Ibrahim','Kwame','Chinedu','Omar','Ahmed','Wei','Ravi','Arjun','Hiroshi','Min-jun','Lucas','Thomas','Marco','Jan','Pierre','Lars','James','Michael','Daniel','Carlos','José','Ethan','João','Mateo','Pedro','Diego','Rafael','Santiago','Jack','Oliver','Noah','Liam','Tane','Harry','David','Chen','Emeka','Rahul','Amit','Khalid','Robert','Lukas','Felix','Antoine','Julien','Mathieu','Kenji','Samuel']);
const isFem=n=>FEM_NAMES.has(n)?true:MASC_NAMES.has(n)?false:/(a|ine|elle|ette|ie|ée|ah)$/i.test(n);
const JOB_F={'chef d’entreprise':'cheffe d’entreprise','avocat d’affaires':'avocate d’affaires','cadre dirigeant':'cadre dirigeante','ingénieur pétrolier':'ingénieure pétrolière','banquier':'banquière','investisseur':'investisseuse','promoteur immobilier':'promotrice immobilière','armateur':'armatrice','enseignant':'enseignante','ingénieur':'ingénieure','commerçant':'commerçante','infirmier':'infirmière','consultant':'consultante','technicien':'technicienne','pharmacien':'pharmacienne','chauffeur-livreur':'chauffeuse-livreuse','agent de voyage':'agente de voyage','étudiant boursier':'étudiante boursière','commerçant ambulant':'commerçante ambulante','ouvrier':'ouvrière','agriculteur':'agricultrice','travailleur saisonnier':'travailleuse saisonnière','chauffeur':'chauffeuse','artisan':'artisane','employé de maison':'employée de maison','petit exportateur':'petite exportatrice','vendeur de marché':'vendeuse de marché','mineur artisanal':'mineuse artisanale','humanitaire (ONG)':'humanitaire (ONG)','logisticien humanitaire':'logisticienne humanitaire','retraité':'retraitée','élève':'élève','étudiant':'étudiante'};
const gj=(job,f)=>f?(JOB_F[job]||job):job;
const gx=(m,f)=>f?m.replace(/\(e\)/g,'e').replace(/\(s\)/g,'s'):m.replace(/\(e\)/g,'');
const STUDENT_JOBS=new Set(['étudiant boursier']);
const TONES={AF:['🏿','🏾','🏾'],EU:['🏻','🏼'],NA:['🏻','🏼','🏽','🏾'],SA:['🏽','🏼'],AS:['🏻','🏽'],OC:['🏻','🏼','🏽']};
function avatarOf(age,f,cc,rnd){ const reg=(COUNTRIES[cc]&&COUNTRIES[cc][1])||'EU', t=pick2(rnd,TONES[reg]||['🏽']);
  const b=age<13?(f?'👧':'👦'):age>=65?(f?'👵':'👴'):(f?'👩':'👨'); return b+t; }
const DECLARE={business:['ordinateur portable professionnel','échantillons commerciaux','documents contractuels'],tourism:['appareil photo','souvenirs','rien à déclarer'],family:['cadeaux pour la famille','pagnes en wax','produits alimentaires du pays','médicaments pour un proche'],study:['ordinateur portable','livres','documents d’inscription'],work:['outils de travail','vêtements pour la saison','contrat de travail'],medical:['dossier médical','médicaments sur ordonnance'],pilgrim:['vêtements de cérémonie','rien à déclarer'],humanitarian:['matériel médical (lettre de l’ONG)','kits d’urgence']};
const CHECKIN={rich:['En ligne (appli)','Comptoir prioritaire','Salon VIP'],mid:['En ligne (appli)','Borne libre-service','Comptoir'],poor:['Comptoir','Comptoir','Borne libre-service']};
const BOOKING={rich:['Appli de la compagnie','Agence premium','Compte entreprise','Programme fidélité (miles)'],mid:['Site comparateur','Agence en ligne','Appli de la compagnie','Compte entreprise'],poor:['Agence locale (espèces)','Revendeur du quartier','Billet offert par la famille','Site comparateur']};

/* ---------- nationalités ---------- */
const _cTraffic={};
function countryTraffic(cc){ if(_cTraffic[cc]!==undefined) return _cTraffic[cc]; let t=0; for(const c of AIRPORT_CODES) if(AP(c).cc===cc) t+=AP(c).traffic; return _cTraffic[cc]=t; }
const _natCache=new Map();
// Nationalités des passagers sur un vol qui part de ccFrom vers ccTo (parts qui totalisent 1)
function natMix(ccFrom, ccTo){
  const k=ccFrom+'>'+ccTo; if(_natCache.has(k)) return _natCache.get(k);
  const same=ccFrom===ccTo, W={};
  const fromShare=same?0.9:0.52, toShare=same?0:0.2;
  W[ccFrom]=fromShare; if(!same) W[ccTo]=toShare;
  const contF=COUNTRIES[ccFrom]&&COUNTRIES[ccFrom][1], contT=COUNTRIES[ccTo]&&COUNTRIES[ccTo][1];
  const cand=Object.keys(COUNTRIES).filter(c=>c!==ccFrom&&c!==ccTo).map(c=>{ const ct=COUNTRIES[c][1]; return [c, Math.pow(countryTraffic(c)+1,0.6)*((ct===contF||ct===contT)?2.2:1)*(c==='FR'||c==='GB'||c==='US'||c==='CN'||c==='IN'?1.4:1)]; })
    .sort((a,b)=>b[1]-a[1]).slice(0,8);
  const tot=cand.reduce((s,x)=>s+x[1],0), rest=1-fromShare-toShare;
  for(const [c,w] of cand) W[c]=(W[c]||0)+rest*0.85*w/tot;
  const out=Object.entries(W).map(([cc,share])=>({cc,share})); const known=out.reduce((s,x)=>s+x.share,0);
  out.push({cc:'??',share:Math.max(0,1-known)});
  out.sort((a,b)=>b.share-a.share); _natCache.set(k,out); return out;
}
const natName=cc=>cc==='??'?'Autres nationalités':(COUNTRIES[cc]?COUNTRIES[cc][2]+' '+COUNTRIES[cc][0]:cc);

/* ---------- compagnies : parts de marché et prix d'une ligne ---------- */
const LCC=new Set('FR U2 W6 VY F9 NK G4 WN AK 6E TO EW PC XQ DY D8 LS HV 5J Y4 VB G3 JQ TR 3K FZ XY J9 SG IX'.split(' '));
const PREMIUM=new Set('EK QR SQ EY CX NH JL LH AF BA KL LX OS SK AY TK KE OZ QF NZ AC DL UA AA AV AM LA SV GF WY'.split(' '));
const fareIndex=code=>LCC.has(code)?0.74:PREMIUM.has(code)?1.12:1;
function lineAirlines(a,b){
  const out=[]; let meShare=0, meRoute=null;
  for(const r of S.routes){ if(r.stops.length===2&&((r.stops[0]===a&&r.stops[1]===b)||(r.stops[0]===b&&r.stops[1]===a))&&routeAircraft(r).length){ meRoute=r; break; } }
  const riv=rivalsOn(a,b);
  if(meRoute){ try{ const m=legMarket(meRoute,a,b); meShare=clamp(m.y.share,0.02,0.97); }catch(e){ meShare=0.2; } }
  const wsum=riv.reduce((s,x)=>s+x.freq*(x.R.quality||1),0)||1;
  for(const x of riv){ out.push({code:x.R.code, name:x.R.name, color:x.R.color, share:(1-meShare)*x.freq*(x.R.quality||1)/wsum, freq:x.freq, price:idealPrice(a,b,'y')*fareIndex(x.R.code)}); }
  if(meRoute){ const pm=meRoute.pm||{}; out.push({code:S.company.code, name:S.company.name, color:S.company.color, share:meShare, freq:routeFreq(meRoute), price:idealPrice(a,b,'y')*(pm.y??meRoute.price??1), me:true}); }
  if(!out.length) out.push({code:'—', name:'Via une escale (pas de vol direct)', color:'#6b7280', share:1, freq:0, price:idealPrice(a,b,'y')*1.25, none:true});
  return out.sort((x,y)=>y.share-x.share);
}

/* ---------- profil complet d'une ligne (sens a → b) ---------- */
function paxProfile(a,b){
  const A=AP(a), B=AP(b), km=dist(a,b), dem=marketDemand(a,b);
  const lf=incomeOf(A.cc), lt=incomeOf(B.cc), mix=WEALTH_MIX[lf];
  const wealth={rich:mix.rich,mid:mix.mid,poor:mix.poor};
  const purpose={}; for(const w of Object.keys(wealth)){ const pm=purposeMix(w,lf,lt,km,A.cc,B.cc); for(const p in pm) purpose[p]=(purpose[p]||0)+pm[p]*wealth[w]; }
  const longH=km>3000, cls={y:1-(wealth.rich*(longH?.5:.32))-(wealth.mid*.1), j:0, f:0};
  cls.j=wealth.rich*(longH?.38:.28)+wealth.mid*.1; cls.f=wealth.rich*(longH?.12:.04); const sc=cls.y+cls.j+cls.f; for(const k in cls) cls[k]/=sc;
  // voyages par an et nombre de voyageurs différents
  let trips=0, wsum=0; for(const w of Object.keys(wealth)){ const pm=purposeMix(w,lf,lt,km,A.cc,B.cc); for(const p in pm){ trips+=wealth[w]*pm[p]*tripsPerYear(w,p); wsum+=wealth[w]*pm[p]; } }
  trips/=wsum||1;
  const airlines=lineAirlines(a,b);
  const fare={y:idealPrice(a,b,'y'), j:idealPrice(a,b,'j'), f:idealPrice(a,b,'f')};
  return {a,b,km,demand:dem,perWeek:dem*7,perMonth:dem*30.4,perYear:dem*365, nat:natMix(A.cc,B.cc), wealth, purpose, cls, fare, trips, uniqueYear:dem*365/Math.max(0.5,trips), airlines, lvlFrom:lf, lvlTo:lt, ccFrom:A.cc, ccTo:B.cc};
}

/* ---------- immigration d'un pays : tous les vols qui y arrivent ---------- */
const _ccCache={};
function countryImmigration(cc){
  const key=cc+'|'+Math.floor(S.time/DAY); if(_ccCache[key]) return _ccCache[key];
  const here=cAirports(cc).slice(0,12);
  if(!here.length) return null;
  const world=AIRPORT_CODES.filter(c=>AP(c).cc!==cc).sort((x,y)=>AP(y).traffic-AP(x).traffic).slice(0,110);
  const pairs=[]; let total=0;
  for(const y of here) for(const x of world){ const d=marketDemand(x,y); if(d>0.5){ pairs.push({x,y,d}); total+=d; } }
  pairs.sort((p,q)=>q.d-p.d);
  const sample=pairs.slice(0,70), sampTot=sample.reduce((s,p)=>s+p.d,0)||1;
  const nat={}, wealth={rich:0,mid:0,poor:0}, purpose={}, cls={y:0,j:0,f:0}, air={}, fare={y:0,j:0,f:0}, orig={}; let trips=0, refusalW=0;
  for(const p of sample){
    const pr=paxProfile(p.x,p.y), w=p.d/sampTot;
    for(const n of pr.nat) nat[n.cc]=(nat[n.cc]||0)+n.share*w;
    for(const k in pr.wealth) wealth[k]+=pr.wealth[k]*w;
    for(const k in pr.purpose) purpose[k]=(purpose[k]||0)+pr.purpose[k]*w;
    for(const k in pr.cls) cls[k]+=pr.cls[k]*w;
    for(const k of ['y','j','f']) fare[k]+=pr.fare[k]*w;
    for(const al of pr.airlines) { const o=air[al.code]||(air[al.code]={code:al.code,name:al.name,color:al.color,share:0,price:0,me:!!al.me}); o.share+=al.share*w; o.price+=al.price*al.share*w; }
    const oc=AP(p.x).cc; orig[oc]=(orig[oc]||0)+w; trips+=pr.trips*w;
    // refus d'entrée : plus fréquents quand un voyageur de pays pauvre arrive dans un pays riche
    const gap=Math.max(0,incomeOf(cc)-pr.lvlFrom); refusalW+=w*(0.004+gap*0.012);
  }
  const moodT=(typeof moodOf==='function'?moodOf(cc).tension:0);
  const airlines=Object.values(air).map(o=>({...o, price:o.share? o.price/o.share : 0})).sort((a,b)=>b.share-a.share);
  const perDay=total, res={cc, perDay, perWeek:perDay*7, perMonth:perDay*30.4, perYear:perDay*365, airports:here.length, nat:Object.entries(nat).map(([c,s])=>({cc:c,share:s})).sort((a,b)=>b.share-a.share),
    wealth, purpose, cls, fare, airlines, orig:Object.entries(orig).map(([c,s])=>({cc:c,share:s})).sort((a,b)=>b.share-a.share), trips, uniqueYear:perDay*365/Math.max(0.5,trips),
    refusal:clamp(refusalW*(1+moodT*2),0.002,0.08), income:incomeOf(cc), topPairs:pairs.slice(0,8)};
  _ccCache[key]=res; return res;
}

/* ---------- manifeste d'un vol : fiches de passagers fictifs ---------- */
const LANG={FR:'français',CD:'français, lingala',CG:'français, lingala',BE:'français, néerlandais',CH:'français, allemand',GB:'anglais',US:'anglais',CA:'anglais, français',DE:'allemand',ES:'espagnol',IT:'italien',PT:'portugais',BR:'portugais',AO:'portugais',CN:'chinois',JP:'japonais',IN:'hindi, anglais',AE:'arabe, anglais',SA:'arabe',EG:'arabe',MA:'arabe, français',NG:'anglais, haoussa',KE:'swahili, anglais',TZ:'swahili',ET:'amharique',RU:'russe',TR:'turc',ZA:'anglais, zoulou',KP:'coréen',KR:'coréen'};
const MEALS=['Menu standard','Végétarien','Halal','Sans gluten','Sans porc','Repas enfant','Casher'];
const FAMILY_REL=['sa mère','son frère','sa sœur','ses grands-parents','son fils étudiant','sa fille','son oncle','un ami d’enfance'];
const BUSINESS_SMALL=['acheter des marchandises à revendre','une foire commerciale','rencontrer un grossiste','livrer une commande à un client','un stage de formation professionnelle','renouveler son stock'];
const BUSINESS_WHY=['un salon professionnel','un rendez-vous avec un fournisseur','un audit chez un client','la négociation d’un contrat','la formation d’une équipe commerciale','une réunion de conseil d’administration','l’ouverture d’un bureau'];
const TOURISM_WHY=['randonnée et nature','plages et détente','visite des musées','un safari','shopping et gastronomie','une croisière sur le fleuve','un festival de musique'];
const STUDY_WHY=['master en droit','licence d’informatique','études de médecine','école d’ingénieurs','école de commerce','doctorat en géologie'];
const MED_WHY=['consultation en cardiologie','suivi d’une opération','bilan de santé complet','soins dentaires spécialisés','examens en oncologie'];
const HUM_WHY=['distribution d’aide alimentaire','campagne de vaccination','construction d’un dispensaire','mission d’évaluation après des inondations'];
const MARITAL=['célibataire','marié(e)','marié(e), 1 enfant','marié(e), 2 enfants','marié(e), 3 enfants','divorcé(e)','en couple'];
function tripStory(p,rnd,A,B,o){
  o=o||{}; const age=o.age||35;
  const city=B.city, days=Math.max(2,Math.round(2+rnd()*(p==='tourism'?12:p==='family'?18:p==='work'?60:p==='study'?200:6)));
  switch(p){
    case 'family': { const rel=FAMILY_REL.filter(r=>!(age<40&&/fils|fille/.test(r))&&!(age>45&&/grands-parents/.test(r))&&!(age>70&&/mère/.test(r))); return `Rend visite à ${pick2(rnd,rel.length?rel:FAMILY_REL)} à ${city} (séjour de ${days} jours).`; }
    case 'business': return `Se rend à ${city} pour ${pick2(rnd,o.wealth&&o.wealth!=='rich'?BUSINESS_SMALL:BUSINESS_WHY)} (${days} jours).`;
    case 'tourism': { const af=COUNTRIES[B.cc]&&COUNTRIES[B.cc][1]==='AF', tw=TOURISM_WHY.filter(x=>af||!/safari|fleuve/.test(x)); return `Séjour de ${days} jours à ${city} : ${pick2(rnd,tw)}.`; }
    case 'study': return `Rentrée universitaire à ${city} : ${o.field||pick2(rnd,STUDY_WHY)} (aller simple, ${o.F?'inscrite':'inscrit'} pour l’année).`;
    case 'work': return `Prend un nouveau poste à ${city} (contrat de ${Math.max(3,Math.round(days/10))} mois).`;
    case 'medical': return `Voyage à ${city} pour ${pick2(rnd,MED_WHY)}.`;
    case 'pilgrim': return `Pèlerinage à ${city} avec un groupe de ${Math.round(10+rnd()*40)} personnes.`;
    default: return `Mission humanitaire à ${city} : ${pick2(rnd,HUM_WHY)}.`;
  }
}
function flightManifest(ac){
  const fl=ac&&ac.flight; if(!fl) return null;
  const leg=fl.legs[fl.li]; if(!leg) return null;
  const pax=leg.pax; if(!pax) return {leg, cargo:true};
  const total=pax.f+pax.j+pax.w+pax.y;
  const pr=paxProfile(leg.from,leg.to), rnd=seeded(hashS(ac.id+'|'+leg.dep+'|'+leg.from+leg.to));
  const A=AP(leg.from), B=AP(leg.to), rt=ac.flight.routeId&&S.routes.find(r=>r.id===ac.flight.routeId);
  const pm=(rt&&rt.pm)||{};
  const rows=[], N=Math.min(total,60), classSeq=[]; for(const [k,n] of [['f',pax.f],['j',pax.j],['w',pax.w],['y',pax.y]]) for(let i=0;i<n;i++) classSeq.push(k);
  const pool=cc=>NAME_POOLS[cc]||NAME_POOLS[COUNTRIES[cc]&&COUNTRIES[cc][1]]||NAME_POOLS.EU;
  const seatRow={f:1,j:4,w:12,y:20}; const used={};
  for(let i=0;i<N;i++){
    const k=classSeq[Math.floor(i*classSeq.length/N)];
    const wealth= k==='f'? pickW(rnd,[['rich',.86],['mid',.14]]) : k==='j'? pickW(rnd,[['rich',.55],['mid',.4],['poor',.05]]) : k==='w'? pickW(rnd,[['rich',.1],['mid',.7],['poor',.2]]) : pickW(rnd,[['rich',pr.wealth.rich*.35],['mid',pr.wealth.mid*1.1],['poor',pr.wealth.poor*1.3]]);
    const nat=pickW(rnd,pr.nat.filter(n=>n.cc!=='??').map(n=>[n.cc,n.share])) || A.cc;
    const pmx=purposeMix(wealth,pr.lvlFrom,pr.lvlTo,pr.km,A.cc,B.cc);
    const purp=pickW(rnd,Object.entries(pmx));
    const [a0,a1]=AGE_RANGE[purp]; const age=Math.round(a0+rnd()*(a1-a0));
    const P=pool(nat), fem=rnd()<(purp==='business'?0.38:purp==='work'?0.42:0.52);
    const fpool=P[0].filter(n=>isFem(n)===fem), first=(fpool.length?fpool:P[0])[Math.floor(rnd()*(fpool.length||P[0].length))], last=P[1][Math.floor(rnd()*P[1].length)], F=isFem(first);
    const trips=Math.max(.3,tripsPerYear(wealth,purp)*(0.6+rnd()*0.8));
    const base=idealPrice(leg.from,leg.to,k==='w'?'y':k)*(k==='w'?1.35:1), mult=(pm[k==='w'?'y':k]??1)*(0.9+rnd()*0.22)*(k==='y'&&wealth==='poor'?0.92:1);
    const row=(seatRow[k]+((used[k]=(used[k]||0)+1)>>2)), seat=row+'ABCDEF'[(used[k]-1)%6];
    const visaReq = pr.lvlTo>pr.lvlFrom && A.cc!==B.cc && rnd()<0.62;
    const home=cAirports(nat).length? AP(pick2(rnd,cAirports(nat).slice(0,6))).city : (COUNTRIES[nat]?COUNTRIES[nat][0]:'—');
    const field=pick2(rnd,STUDY_WHY);
    let job=pick2(rnd,PROF[wealth].filter(j=>purp==='study'||!STUDENT_JOBS.has(j)));
    if(purp==='study') job=gj('étudiant',F)+' ('+field+')';
    else if(age<17) job='élève';
    else if(purp==='humanitarian') job=pick2(rnd,[gj('humanitaire (ONG)',F),gj('logisticien humanitaire',F),'médecin bénévole',gj('infirmier',F)]);
    else if(age>=65) job=gj('retraité',F)+' · '+(F?'ancienne ':'ancien ')+gj(job,F);
    else job=gj(job,F);
    const kids=age<25?0:pick2(rnd,[0,0,1,1,2,3]);
    const tier=pickW(rnd,[['Aucun',trips<2?.8:.4],['Silver',.28],['Gold',wealth==='rich'?.3:.08],['Platinum',wealth==='rich'?.12:.01]]);
    const mood=pickW(rnd,[['ravi(e)',.14],['calme',.55],['impatient(e)',.21],['énervé(e)',.10]]);
    const moodWhy=mood==='énervé(e)'?pick2(rnd,['retard annoncé à l’embarquement','siège qui ne s’incline pas','bagage perdu au dernier vol','prix du billet jugé excessif','repas indisponible']):mood==='impatient(e)'?pick2(rnd,['correspondance serrée','file d’attente à l’embarquement','réunion dès l’arrivée']):mood==='ravi(e)'?pick2(rnd,['surclassement offert','premier voyage en avion','vol avec vue sur la côte','équipage aux petits soins']):'';
    rows.push({i, first, last, name:first+' '+last, age, nat, home, wealth, purp, cls:k, seat, price:base*mult, trips, channel:pick2(rnd,BOOKING[wealth]), job,
      marital:age<17?'mineur'+(F?'e':'')+' accompagné'+(F?'e':''):kids?`${gx('marié(e)',F)}, ${kids} enfant${kids>1?'s':''}`:gx(pick2(rnd,['célibataire','marié(e)','en couple','divorcé(e)']),F), langs:LANG[nat]||'anglais', story:tripStory(purp,rnd,A,B,{age,F,field,wealth}),
      bags:purp==='tourism'?pick2(rnd,[1,2,2,3]):purp==='business'?pick2(rnd,[0,1,1]):pick2(rnd,[1,1,2]), bag:Math.round((purp==='tourism'?22:purp==='business'?12:purp==='work'?30:20)*(0.6+rnd()*0.9)),
      meal:age<12?'Repas enfant':pick2(rnd,MEALS.filter(x=>x!=='Repas enfant')), assist:rnd()<0.04?pick2(rnd,['fauteuil roulant','accompagnement','famille avec poussette']):'', tier, miles:tier==='Aucun'?0:Math.round(5000+rnd()*90000), mood, moodWhy,
      nbWithUs:Math.max(0,Math.round(trips*(0.4+rnd()*2.4)-1)), passportCC:nat, passExp:2026+Math.round(1+rnd()*8),
      visa:visaReq?'Visa obtenu':'Pas de visa requis', lastTrip:Math.max(1,Math.round(12/trips*(0.5+rnd()))),
      F, avatar:avatarOf(age,F,nat,rnd), ...extraDetails(rnd,{age,F,nat,wealth,purp,k,trips,tier,A,B,mood,home,first,last})});
  }
  return {leg, from:A, to:B, total, shown:N, pr, rows};
}
const pick2=(rnd,arr)=>arr[Math.floor(rnd()*arr.length)];
const PX_MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function extraDetails(rnd,o){
  const now=new Date(S.time), yr=now.getUTCFullYear(), byr=yr-o.age, bm=Math.floor(rnd()*12), bd=1+Math.floor(rnd()*28);
  const cities=cAirports(o.nat).slice(0,8).map(c=>AP(c).city); const born=cities.length?pick2(rnd,cities):o.home;
  const L='ABCDEFGHJKLMNPRSTUVWXYZ', passNo=(o.nat||'XX').slice(0,2)+L[Math.floor(rnd()*L.length)]+String(Math.floor(1e6+rnd()*8.99e6));
  const minsBefore=o.wealth==='rich'?Math.round(45+rnd()*60):Math.round(70+rnd()*130);
  const group=o.k==='f'||o.k==='j'?1:o.k==='w'?2:3+Math.floor(rnd()*3);
  let with_='seul'+(o.F?'e':'');
  if(o.age<17) with_=pick2(rnd,['avec ses parents','avec sa mère','avec son père','mineur non accompagné (pris en charge par l’équipage)']);
  else if((o.purp==='tourism'||o.purp==='family')&&rnd()<0.45) with_=pick2(rnd,['avec son conjoint','avec son conjoint et leurs enfants','avec des amis','avec sa sœur','avec son frère']);
  else if(o.purp==='pilgrim') with_='avec un groupe paroissial';
  else if(o.purp==='business'&&rnd()<0.3) with_='avec deux collègues';
  let conn='';
  const onward=((typeof AP_ROUTES!=='undefined'&&AP_ROUTES[o.B.code])||[]).filter(c=>c!==o.A.code&&AP(c));
  if(onward.length>=3&&rnd()<0.22){ const X=AP(pick2(rnd,onward)); conn=`Correspondance à ${o.B.city} vers ${X.city} (${X.code})`; }
  const cash=Math.round((o.wealth==='rich'?800+rnd()*4000:o.wealth==='mid'?200+rnd()*1200:40+rnd()*400)/10)*10;
  const spend=Math.round((o.k==='y'?rnd()*35:rnd()*120)*(o.wealth==='poor'?0.4:1));
  const q=v=>clamp(Math.round(v),1,5), sv=S.service||3;
  const sat={confort:q((o.k==='f'?4.6:o.k==='j'?4.2:o.k==='w'?3.6:3)+rnd()*1.2-0.5), repas:q(sv-0.3+rnd()*1.4), equipage:q(sv+0.2+rnd()*1.2-0.4), ponctualite:q(o.mood==='énervé(e)'?2+rnd():3.4+rnd()*1.6)};
  const hist=[]; const homeAp=cAirports(o.nat)[0]||o.A.code, dests=((typeof AP_ROUTES!=='undefined'&&AP_ROUTES[homeAp])||[]).filter(c=>AP(c));
  const nH=Math.min(3,Math.max(0,Math.round(o.trips)));
  for(let i=0;i<nH&&dests.length;i++){ const dest=pick2(rnd,dests), car=(typeof carriersOn==='function'?carriersOn(homeAp,dest):[]).filter(c=>AIRLINE_DB[c]); const back=new Date(S.time-(1+i*5+Math.floor(rnd()*5))*30.4*DAY);
    hist.push(`${PX_MONTHS[back.getUTCMonth()]} ${back.getUTCFullYear()} · ${AP(homeAp).city} → ${AP(dest).city} · ${car.length?AIRLINE_DB[pick2(rnd,car)][0]:'vol charter'}`); }
  const opinions=o.mood==='énervé(e)'?['« J’attends mieux pour ce prix. »','« Si ça se reproduit, je change de compagnie. »']:o.tier!=='Aucun'?['« Fidèle depuis des années, je recommande. »','« Les miles valent vraiment le coup. »']:o.mood==='ravi(e)'?['« Première fois avec vous, très agréable surprise ! »','« Je reviendrai, c’est sûr. »']:['« Correct, rien à signaler. »','« Le prix a fait la différence. »','« J’ai choisi l’horaire qui m’arrangeait. »'];
  const place=o.seatPref||pick2(rnd,['hublot','couloir','hublot','couloir','milieu']);
  const lodging=o.purp==='family'?pick2(rnd,['chez de la famille','chez des amis']):o.purp==='business'?pick2(rnd,['hôtel réservé par l’entreprise','hôtel d’affaires','appartement de fonction']):o.wealth==='rich'?pick2(rnd,['hôtel de luxe','résidence privée']):pick2(rnd,['hôtel économique','chez la famille','location entre particuliers','auberge']);
  const items=[pick2(rnd,['ordinateur portable','tablette','liseuse','appareil photo','casque audio']),pick2(rnd,['chargeur et batterie externe','trousse de toilette','médicaments','vêtements de rechange']),pick2(rnd,['documents de voyage','cadeaux','guide de voyage','livre','jeux pour enfants'])];
  const fear=rnd()<0.14?pick2(rnd,['peur de l’avion (légère)','peur des turbulences','anxieux au décollage']):'';
  const ent=pick2(rnd,['films','séries','musique','dort pendant le vol','travaille sur son ordinateur','lit','regarde la carte du vol','joue sur son téléphone']);
  const allergy=rnd()<0.1?pick2(rnd,['arachides','fruits de mer','gluten','lactose']):'';
  const drink=pick2(rnd,['eau','jus d’orange','café','thé','soda','verre de vin','bière locale','rien']);
  const wifi=o.wealth==='rich'?rnd()<0.7:rnd()<0.3, insur=o.wealth==='poor'?rnd()<0.2:rnd()<0.65;
  // vie du passager : études, revenus, goûts, famille
  const study=o.age<20?'lycée':pick2(rnd,['baccalauréat','licence','master','école d’ingénieurs','école de commerce','doctorat','formation professionnelle','autodidacte']);
  const income=Math.round((o.wealth==='rich'?90+rnd()*400:o.wealth==='mid'?18+rnd()*60:3+rnd()*14)*1000/100)*100;
  const hobbies=[pick2(rnd,['football','lecture','cuisine','photographie','musique','randonnée','jeux vidéo','jardinage','cinéma','danse','pêche','voyages','basket','peinture'])];
  if(rnd()<0.6) hobbies.push(pick2(rnd,['séries','podcasts','bricolage','course à pied','échecs','couture','théâtre','cuisine du monde']));
  const food=pick2(rnd,['poulet braisé','pizza','pondu et manioc','couscous','sushis','burger','pâtes','riz sauté','poisson grillé','salade composée','curry','brochettes']);
  const music=pick2(rnd,['rumba congolaise','afrobeats','rap','variété française','jazz','classique','pop internationale','gospel','soul','électro','reggae','amapiano']);
  const kids=o.age<24?0:Math.min(5,Math.floor(rnd()*(o.age>35?4:3)));
  const pet=rnd()<0.2?pick2(rnd,['un chien','un chat','des poissons','un perroquet']):'';
  const social=((o.first||'x')[0]+(o.last||'y')).toLowerCase().replace(/[^a-z]/g,'')+Math.floor(10+rnd()*90);
  const firstFlight=o.trips<0.8&&rnd()<0.18;
  const souvenir=pick2(rnd,['des photos du marché','un tableau local','du café','des épices','un maillot de foot','une sculpture','des tissus','des livres','du chocolat','rien de particulier']);
  const next=pick2(rnd,['rejoindre sa famille','une réunion à 14 h','l’hôtel puis une promenade','un mariage','un rendez-vous médical','un entretien d’embauche','des vacances de deux semaines','un salon professionnel','retrouver des amis','un retour chez soi']);
  // carte d'embarquement, bagages détaillés, contact, santé, paiement
  const gate=pick2(rnd,['A','B','C','D','E'])+(1+Math.floor(rnd()*28)), boardMin=(o.k==='f'||o.k==='j')?50:40, seq=1+Math.floor(rnd()*220);
  const bagItems=['vêtements','chaussures','cadeaux','produits de beauté','médicaments','livres','nourriture locale','matériel professionnel','jouets','équipement de sport','souvenirs','produits d’artisanat'];
  const nbags=o.k==='f'?2:o.k==='j'?2:o.wealth==='poor'?(rnd()<0.6?1:0):1+(rnd()<0.4?1:0);
  const bagList=[]; for(let i=0;i<nbags;i++) bagList.push({tag:(L[Math.floor(rnd()*L.length)]+L[Math.floor(rnd()*L.length)])+String(Math.floor(100000+rnd()*899999)),kg:Math.round(8+rnd()*(o.k==='y'?15:22)),what:pick2(rnd,bagItems)+' et '+pick2(rnd,bagItems),color:pick2(rnd,['noir','bleu','rouge','gris','vert','marron','à fleurs','orange'])});
  const phone='+'+(Math.floor(1+rnd()*98))+' '+Math.floor(600+rnd()*399)+' '+Math.floor(100+rnd()*899)+' '+Math.floor(100+rnd()*899);
  const mail=((o.first||'passager')+'.'+(o.last||'x')).toLowerCase().replace(/[^a-z.]/g,'')+Math.floor(rnd()*90)+'@'+pick2(rnd,['mail.com','webmail.net','poste.org','courrier.fr']);
  const emerg=pick2(rnd,['son conjoint','sa mère','son père','sa sœur','son frère','un ami proche','son employeur']);
  const health=pick2(rnd,['aucun problème','aucun problème','aucun problème','vaccins à jour','asthme (inhalateur en poche)','mal de dos','tension artérielle surveillée','diabète (collation prévue)','jambes lourdes : se lèvera souvent']);
  const jetlag=Math.abs(((o.A.lon||0)-(o.B.lon||0))/15);
  const pay=o.wealth==='rich'?pick2(rnd,['carte premium','carte entreprise','virement']):pick2(rnd,['carte bancaire','paiement mobile','espèces à l’agence','carte bancaire']);
  const fare=({f:'P',j:'J',w:'W',y:pick2(rnd,['Y','M','L','Q','T','K'])})[o.k]||'Y', fareCond=o.k==='y'&&'QTKL'.includes(fare)?'non remboursable':o.k==='y'?'modifiable avec frais':'flexible';
  const outfit=pick2(rnd,['costume sombre','tenue décontractée','jean et baskets','robe colorée','tenue traditionnelle','survêtement','chemise à fleurs','uniforme d’entreprise','manteau chaud','tenue de sport']);
  const anecdote=pick2(rnd,['a failli rater son vol à cause des embouteillages','voyage avec une valise prêtée par un cousin','a gagné ce billet à un concours','n’a pas vu sa grand-mère depuis cinq ans','part pour un entretien décisif','fête son anniversaire en vol','a oublié son chargeur à la maison','emporte un gâteau préparé par sa famille','revient d’un long séjour à l’étranger','ne dort jamais en avion','a changé de siège avec un inconnu','écrit un carnet de voyage']);
  const tip=rnd()<0.12?'laisse un petit mot de remerciement à l’équipage':rnd()<0.1?'se plaint poliment de l’attente':'';
  const sleepH=Math.round(rnd()*5*2)/2, seatmate=pick2(rnd,['un voisin silencieux','une famille avec un bébé','un étudiant au casque audio','un homme d’affaires pressé','une voyageuse bavarde','personne : siège voisin libre']);
  return {outfit,anecdote,tip,sleepH,seatmate,study,income,hobbies,food,music,kids,pet,social,firstFlight,souvenir,next,gate,boardMin,seq,bagList,phone,mail,emerg,health,jetlag:Math.round(jetlag*10)/10,pay,fare,fareCond,place,lodging,items,fear,ent,allergy,drink,wifi,insur,dob:`${bd} ${PX_MONTHS[bm]} ${byr}`, born, passNo, checkin:pick2(rnd,CHECKIN[o.wealth]), ciMin:minsBefore, group, with_, conn, declare:pick2(rnd,DECLARE[o.purp]||['rien à déclarer']), cash, spend, sat, hist, opinion:pick2(rnd,opinions),
    control:rnd()<(o.wealth==='poor'?0.06:0.02)?'Contrôle approfondi (vérification du visa)':'Contrôle normal ✅'};
}

/* ---------- affichage ---------- */
const UNITS={day:['jour',1],week:['semaine',7],month:['mois',30.4],year:['an',365]};
const bars=(items,fmt)=>items.map(([label,share,color])=>`<div class="pbar-row"><span class="pl">${label}</span><span class="pb"><i style="width:${Math.max(1,Math.round(share*100))}%;background:${color||'var(--gold)'}"></i></span><b>${fmt?fmt(share):Math.round(share*100)+' %'}</b></div>`).join('');
function volLine(perDay){ const u=UI.paxUnit||'week', [lab,mul]=UNITS[u]; return `<b>${num(Math.round(perDay*mul))}</b> / ${lab}`; }
function unitChips(){ return `<div class="chips">${Object.entries(UNITS).map(([k,[l]])=>`<button class="chip ${(UI.paxUnit||'week')===k?'on':''}" data-act="paxUnit" data-k="${k}">par ${l}</button>`).join('')}</div>`; }
const wealthBars=w=>bars([['🟣 '+WEALTH_LABEL.rich,w.rich,'#a78bfa'],['🔵 '+WEALTH_LABEL.mid,w.mid,'#60a5fa'],['🟠 '+WEALTH_LABEL.poor,w.poor,'#fb923c']]);
const purposeBars=p=>bars(PURPOSES.filter(([k])=>p[k]>0.004).sort((x,y)=>p[y[0]]-p[x[0]]).slice(0,6).map(([k,l])=>[l,p[k]]));
const clsBars=c=>bars([['💺 Économique',c.y],['💼 Affaires',c.j],['👑 Première',c.f]].filter(x=>x[1]>0.002));
const natBars=(n,max=7)=>bars(n.slice(0,max).map(x=>[natName(x.cc),x.share]));
function airlineBars(al,max=8){ return al.slice(0,max).map(a=>`<div class="pbar-row"><span class="pl"><span class="dot" style="background:${a.color}"></span>${esc(a.name)}${a.me?' ⭐':''}</span><span class="pb"><i style="width:${Math.max(1,Math.round(a.share*100))}%;background:${a.color}"></i></span><b>${Math.round(a.share*100)} %</b><span class="mut small pp">${a.price?fmtMoney(a.price):''}</span></div>`).join(''); }

function pPax(){
  const cc=UI.paxCountry||homeCC(), C=COUNTRIES[cc], im=countryImmigration(cc);
  const countries=Object.keys(COUNTRIES).filter(k=>cAirports(k).length).sort((x,y)=>COUNTRIES[x][0].localeCompare(COUNTRIES[y][0]));
  const quick=[...new Set([homeCC(),...S.hubs.map(h=>AP(h).cc),'CD','FR','US','CN','AE','NG','ZA','KP'])].filter(k=>COUNTRIES[k]&&cAirports(k).length);
  const head=`<div class="simplehelp">🛂 <b>Contrôle des passagers</b> : qui arrive dans un pays, d’où il vient, ce qu’il paie, avec quelle compagnie. Les volumes suivent la demande du jeu ; la répartition (richesse, nationalité, motif) est une <b>estimation</b>, les personnes sont fictives.</div>
  <div class="row wrap"><select data-in="paxCountry">${countries.map(k=>`<option value="${k}" ${k===cc?'selected':''}>${COUNTRIES[k][2]} ${COUNTRIES[k][0]}</option>`).join('')}</select></div>
  <div class="chips">${quick.map(k=>`<button class="chip ${k===cc?'on':''}" data-act="paxCountry" data-cc="${k}">${COUNTRIES[k][2]} ${COUNTRIES[k][0]}</button>`).join('')}</div>`;
  if(!im) return head+'<div class="mut">Aucun aéroport avec vols réguliers dans ce pays.</div>';
  const mood=typeof moodOf==='function'?moodOf(cc):null;
  const kp=(l,v,s)=>`<div class="kpi"><div class="kl">${l}</div><div class="kv">${v}</div>${s?`<div class="small mut">${s}</div>`:''}</div>`;
  const myShare=(im.airlines.find(a=>a.me)||{share:0}).share;
  return `${head}
  <h2>${C[2]} ${C[0]} <span class="mut small">· ${INCOME_LABEL[im.income]}</span></h2>
  ${unitChips()}
  <div class="kpis">
    ${kp('Passagers arrivant',volLine(im.perDay),`depuis ${im.orig.length} pays · ${im.airports} aéroport(s)`)}
    ${kp('Voyageurs différents',`≈ ${num(Math.round(im.uniqueYear))} / an`,`chacun voyage ${im.trips.toFixed(1).replace('.',',')} fois par an en moyenne`)}
    ${kp('Refus d’entrée',(im.refusal*100).toFixed(1).replace('.',',')+' %',`≈ ${num(Math.round(im.perDay*im.refusal*(UNITS[UI.paxUnit||'week'][1])))} refoulés / ${UNITS[UI.paxUnit||'week'][0]}`)}
    ${kp('Votre part',(myShare*100).toFixed(1).replace('.',',')+' %','des passagers arrivants')}
    ${kp('Billet moyen',fmtMoney(im.fare.y),`affaires ${fmtMoney(im.fare.j)} · première ${fmtMoney(im.fare.f)}`)}
    ${mood?kp('Climat du pays',moodLabel(mood),mood.note||''):''}
  </div>
  <h3>Qui sont les voyageurs ?</h3>
  <div class="card"><div class="small mut">Richesse des passagers</div>${wealthBars(im.wealth)}</div>
  <div class="card"><div class="small mut">Pourquoi ils voyagent</div>${purposeBars(im.purpose)}</div>
  <div class="card"><div class="small mut">Nationalité des passagers</div>${natBars(im.nat,9)}</div>
  <div class="card"><div class="small mut">Pays de départ des vols</div>${bars(im.orig.slice(0,8).map(x=>[natName(x.cc),x.share]))}</div>
  <h3>Quelle compagnie, à quel prix ?</h3>
  <div class="card"><div class="small mut">Part de marché des compagnies · prix du billet économique moyen</div>${airlineBars(im.airlines,10)}</div>
  <div class="card"><div class="small mut">Classe de voyage</div>${clsBars(im.cls)}</div>
  <h3>Plus grandes liaisons vers ${esc(C[0])}</h3>
  <table class="tbl"><tr><th>Ligne</th><th>Voyageurs</th><th>Prix éco</th></tr>${im.topPairs.map(p=>`<tr><td>${flag(p.x)} ${esc(AP(p.x).city)} → ${esc(AP(p.y).city)}</td><td>${volLine(p.d)}</td><td>${fmtMoney(idealPrice(p.x,p.y,'y'))}</td></tr>`).join('')}</table>`;
}
function paxProfileHtml(a,b){
  const pr=paxProfile(a,b), A=AP(a), B=AP(b);
  return `<div class="card paxprof"><b>🛂 Profil des passagers ${esc(A.city)} → ${esc(B.city)}</b>
    <div class="small mut">${num(Math.round(pr.demand))} voyageurs/jour · ${num(Math.round(pr.perYear))} par an · ≈ ${num(Math.round(pr.uniqueYear))} personnes différentes (${pr.trips.toFixed(1).replace('.',',')} voyages/an chacune)</div>
    <div class="small mut" style="margin-top:6px">Richesse</div>${wealthBars(pr.wealth)}
    <div class="small mut" style="margin-top:6px">Motif</div>${purposeBars(pr.purpose)}
    <div class="small mut" style="margin-top:6px">Nationalité</div>${natBars(pr.nat,5)}
    <div class="small mut" style="margin-top:6px">Compagnies (part · prix éco)</div>${airlineBars(pr.airlines,6)}
    <div class="small mut" style="margin-top:6px">Classe</div>${clsBars(pr.cls)}</div>`;
}
function manifestHtml(ac){
  const m=flightManifest(ac); if(!m) return '<div class="mut">Pas de vol en cours.</div>';
  if(m.cargo) return '<div class="mut">Vol cargo : pas de passagers à bord.</div>';
  const A=m.from, B=m.to, f=UI.manF||'all';
  const wc={rich:0,mid:0,poor:0}, nc={}, cc={f:0,j:0,w:0,y:0}; let rev=0, angry=0, happy=0;
  for(const r of m.rows){ wc[r.wealth]++; nc[r.nat]=(nc[r.nat]||0)+1; cc[r.cls]++; rev+=r.price; if(r.mood==='énervé(e)') angry++; if(r.mood==='ravi(e)') happy++; }
  const avg=rev/Math.max(1,m.rows.length);
  const hdr=`<div class="mf-head"><div class="mf-route">${esc(S.company.code)}${flightNumber(ac)} · <b>${esc(A.city)}</b> → <b>${esc(B.city)}</b></div>
    <div class="kpis mf-k"><div class="kpi"><div class="kl">À bord</div><div class="kv">${m.total}</div></div><div class="kpi"><div class="kl">Billet moyen</div><div class="kv">${fmtMoney(avg)}</div></div>
    <div class="kpi"><div class="kl">Recette estimée</div><div class="kv">${fmtMoney(avg*m.total)}</div></div><div class="kpi"><div class="kl">Humeur</div><div class="kv">😄 ${happy} · 😠 ${angry}</div></div></div></div>`;
  const leg=`<div class="mf-leg"><span>🟣 Aisés <b>${wc.rich}</b></span><span>🔵 Classe moyenne <b>${wc.mid}</b></span><span>🟠 Modestes <b>${wc.poor}</b></span></div>
    <div class="mf-leg">${Object.entries(nc).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([c,n])=>`<span>${COUNTRIES[c]?COUNTRIES[c][2]:'🌍'} ${esc(COUNTRIES[c]?COUNTRIES[c][0]:c)} <b>${n}</b></span>`).join('')}</div>`;
  const F=[['all','Tous'],['f',`👑 1ʳᵉ (${cc.f})`],['j',`💼 Affaires (${cc.j})`],['y',`💺 Éco (${cc.y+cc.w})`],['angry',`😠 Mécontents (${angry})`],['vip','⭐ Fidèles']].filter(([k])=>k==='all'||k==='angry'||k==='vip'||(k==='y'?cc.y+cc.w:cc[k]));
  const filt=`<div class="chips">${F.map(([k,l])=>`<button class="chip ${f===k?'on':''}" data-act="manF" data-id="${ac.id}" data-k="${k}">${l}</button>`).join('')}</div>`;
  const rows=m.rows.filter(r=>f==='all'||(f==='angry'?r.mood==='énervé(e)':f==='vip'?r.tier!=='Aucun':f==='y'?(r.cls==='y'||r.cls==='w'):r.cls===f));
  const clsL={f:'👑 1ʳᵉ',j:'💼 Affaires',w:'💺 Premium',y:'💺 Éco'}, moodI=r=>r.mood==='énervé(e)'?'😠':r.mood==='ravi(e)'?'😄':r.mood==='impatient(e)'?'😬':'🙂';
  return hdr+leg+filt+`<div class="manifest">${rows.map(r=>`<div class="mrow" data-act="paxCard" data-id="${ac.id}" data-i="${r.i}">
    <div class="mr-av">${r.avatar}</div>
    <div class="mr-body"><div class="mh"><b>${esc(r.first)} ${esc(r.last)}</b> <span class="mut">${r.age} ans</span></div>
      <div class="small">${COUNTRIES[r.nat]?COUNTRIES[r.nat][2]:'🌍'} ${esc(r.job)} · <span class="w-${r.wealth}">${WEALTH_LABEL[r.wealth]}</span></div>
      <div class="small mut mr-story">${esc(r.story)}</div>
      <div class="small">${clsL[r.cls]} · <b>${fmtMoney(r.price)}</b> · ${moodI(r)} ${gx(r.mood,r.F)}${r.tier!=='Aucun'?` · ⭐ ${r.tier}`:''}</div></div>
    <div class="mseat">${r.seat}</div></div>`).join('')||'<div class="mut small">Aucun passager dans ce filtre.</div>'}</div>
  <div class="small mut">${m.total>m.shown?`${m.shown} fiches affichées sur ${m.total} passagers. `:''}Passagers fictifs générés à partir des statistiques du marché · touchez une fiche pour tout voir.</div>`;
}
function passengerCardHtml(ac,i){
  const m=flightManifest(ac); if(!m||!m.rows) return '';
  const r=m.rows[i]; if(!r) return '';
  const clsFull={f:'Première',j:'Affaires',w:'Premium éco',y:'Économique'};
  const row=(k,v)=>`<div class="pcrow"><span class="mut">${k}</span><b>${v}</b></div>`;
  const st=n=>`<span class="pst">${'★'.repeat(n)}<i>${'★'.repeat(5-n)}</i></span>`;
  const sat=r.sat||{}, avgS=sat.confort?((sat.confort+sat.repas+sat.equipage+sat.ponctualite)/4):0;
  const nat=COUNTRIES[r.nat]?COUNTRIES[r.nat]:null, dep=leg=>leg;
  const fl=ac.flight&&ac.flight.legs[ac.flight.li], depT=fl?fl.dep:S.time;
  const t=x=>fmtTime(x);
  return `<div class="pcard">
    <div class="pc-head"><div class="pc-av2">${r.avatar}</div><div class="grow"><div class="pc-name">${esc(r.first)} <b>${esc(r.last.toUpperCase())}</b></div>
      <div class="small">${nat?nat[2]+' '+esc(nat[0]):''} · ${r.age} ans · <span class="w-${r.wealth}">${WEALTH_LABEL[r.wealth]}</span></div>
      <div class="small mut">${esc(r.job)}</div></div><div class="pc-seat"><small>SIÈGE</small><b>${r.seat}</b><small>${clsFull[r.cls]}</small></div></div>
    <div class="pc-story">« ${esc(r.story)} »${r.conn?`<br><small>🔁 ${esc(r.conn)}</small>`:''}</div>
    <div class="pc-pass"><div class="pp-top"><span>PASSEPORT · ${nat?esc(nat[0]).toUpperCase():r.nat}</span><span>${nat?nat[2]:''}</span></div>
      <div class="pp-grid"><div><small>Nom</small><b>${esc(r.last.toUpperCase())}</b></div><div><small>Prénom</small><b>${esc(r.first)}</b></div>
      <div><small>Né${r.F?'e':''} le</small><b>${esc(r.dob||'—')}</b></div><div><small>à</small><b>${esc(r.born||r.home)}</b></div>
      <div><small>N°</small><b>${esc(r.passNo||'—')}</b></div><div><small>Expire</small><b>${r.passExp}</b></div></div>
      <div class="pp-mrz">P&lt;${esc((r.nat||'XX'))}${esc(r.last.toUpperCase().replace(/[^A-Z]/g,''))}&lt;&lt;${esc(r.first.toUpperCase().replace(/[^A-Z]/g,''))}&lt;&lt;&lt;&lt;&lt;&lt;</div></div>
    <h4>👤 Profil</h4>${row('Réside à',esc(r.home)+(nat?', '+esc(nat[0]):''))}${row('Situation',esc(r.marital))}${row('Langues',esc(r.langs))}${row('Voyage',esc(r.with_||'—'))}
    <h4>🎫 Ce voyage</h4>${row('Vol',`${esc(S.company.code)}${flightNumber(ac)} · ${esc(m.from.city)} → ${esc(m.to.city)}`)}${row('Motif',PURPOSE_LABEL[r.purp])}${row('Billet payé',fmtMoney(r.price))}${row('Réservé via',esc(r.channel))}
      ${row('Enregistrement',`${esc(r.checkin||'—')} · ${t(depT-(r.ciMin||90)*MIN)} (${r.ciMin||90} min avant)`)}${row('Embarquement',`groupe ${r.group||3}`)}${row('Bagages',r.bags?`${r.bags} en soute · ${r.bag} kg`:'bagage cabine seulement')}${row('Repas',esc(r.meal))}${r.assist?row('Assistance',esc(r.assist)):''}
    <h4>🛃 Douane & immigration</h4>${row('Visa',r.visa)}${row('Contrôle',esc(r.control||'Contrôle normal ✅'))}${row('Déclare',esc(r.declare||'rien à déclarer'))}${row('Argent liquide',fmtMoney(r.cash||0))}
    <h4>📊 Avis sur ce vol</h4><div class="pc-sat"><div><span>Confort</span>${st(sat.confort||3)}</div><div><span>Repas</span>${st(sat.repas||3)}</div><div><span>Équipage</span>${st(sat.equipage||3)}</div><div><span>Ponctualité</span>${st(sat.ponctualite||3)}</div></div>
      <div class="pc-op">${esc(r.opinion||'')} <span class="mut small">· note moyenne ${avgS.toFixed(1).replace('.',',')}/5 · humeur : ${gx(r.mood,r.F)}${r.moodWhy?' ('+esc(r.moodWhy)+')':''}</span></div>
      ${row('Achats à bord',fmtMoney(r.spend||0))}
    <h4>🪪 Sa vie</h4>${row('Études',esc(r.study||'—'))}${row('Revenu annuel',fmtMoney(r.income||0))}${row('Enfants',r.kids?String(r.kids):'aucun')}${r.pet?row('Animal',esc(r.pet)+' à la maison'):''}${row('Loisirs',esc((r.hobbies||[]).join(', ')||'—'))}${row('Plat préféré',esc(r.food||'—'))}${row('Musique',esc(r.music||'—'))}${row('Réseaux',`@${esc(r.social||'—')}`)}${r.firstFlight?row('Premier vol','✨ oui, première fois en avion'):''}${row('Après l’atterrissage',esc(r.next||'—'))}${row('Rapportera',esc(r.souvenir||'—'))}
    <h4>🗣️ Détails de cabine</h4>${row('Tenue',esc(r.outfit||'—'))}${row('Voisin de siège',esc(r.seatmate||'—'))}${row('Sommeil prévu',(r.sleepH||0)>0?String(r.sleepH).replace('.',',')+' h':'ne dort pas')}<div class="pc-story">${esc(r.first)} ${esc(r.anecdote||'')}.${r.tip?` ${esc(r.first)} ${esc(r.tip)}.`:''}</div>
    <h4>⏱️ En ce moment</h4>${(()=>{ const ph=(ac.flight&&flightState(ac,simNow()))?flightState(ac,simNow()).phase:0, L=[['cherche sa place et range son bagage en cabine','écoute les consignes de sécurité, bouclé(e)','serre l’accoudoir pendant la poussée','regarde par le hublot, le sol rapetisse','se détend, '+(r.ent||'regarde le plafond'),'ramasse ses affaires, descente en cours','boucle sa ceinture et redresse le dossier','applaudit ou soupire de soulagement à l’atterrissage','attend la porte et rallume son téléphone']]; const idx=[0,1,2,3,4,4,5,6,7,8].length; const i=Math.min(8,[0,1,2,3,4,4,5,6,7,8][Math.max(0,Math.min(9,ph))]); return `<div class="pc-story">${esc(r.first)} ${esc(L[0][i])}.${r.fear&&ph>=2&&ph<=7?` <small>(${esc(r.fear)})</small>`:''}</div>`; })()}
    <h4>🎟️ Carte d’embarquement</h4><div class="pc-bp"><div class="bp-l"><small>VOL</small><b>${esc(S.company.code)}${flightNumber(ac)}</b><small>DE → À</small><b>${esc(m.from.code||m.from.city)} → ${esc(m.to.code||m.to.city)}</b></div><div class="bp-m"><small>PORTE</small><b>${esc(r.gate||'—')}</b><small>EMBARQUEMENT</small><b>${t(depT-(r.boardMin||40)*MIN)}</b></div><div class="bp-r"><small>SIÈGE</small><b>${r.seat}</b><small>SÉQ.</small><b>${r.seq||'—'}</b></div></div><div class="pc-barcode">${Array.from({length:46},(_,i)=>`<i style="width:${1+((i*7+(r.seq||3))%3)}px"></i>`).join('')}</div>
    ${row('Tarif',`classe ${esc(r.fare||'Y')} · ${esc(r.fareCond||'—')}`)}${row('Paiement',esc(r.pay||'—'))}
    <h4>🧳 Bagages (${(r.bagList||[]).length})</h4>${(r.bagList||[]).map((b,i)=>row(`Valise ${i+1}`,`${esc(b.color)} · ${b.kg} kg · étiquette ${esc(b.tag)}<br><span class="small mut">${esc(b.what)}</span>`)).join('')||row('Soute','aucun bagage en soute')}
    <h4>📇 Contact & santé</h4>${row('Téléphone',esc(r.phone||'—'))}${row('E-mail',esc(r.mail||'—'))}${row('Contact d’urgence',esc(r.emerg||'—'))}${row('Santé',esc(r.health||'—'))}${row('Décalage horaire',(r.jetlag||0)>=1?`${String(r.jetlag).replace('.',',')} h`:'aucun')}
    <h4>🎒 À bord</h4>${row('Place préférée',esc(r.place||'—'))}${row('Dans son sac',esc((r.items||[]).join(', ')||'—'))}${row('Occupation',esc(r.ent||'—'))}${row('Boisson',esc(r.drink||'—'))}${r.allergy?row('Allergie',esc(r.allergy)):''}${r.fear?row('Appréhension',esc(r.fear)):''}${row('Wi-Fi',r.wifi?'se connecte ✅':'hors ligne')}${row('Assurance voyage',r.insur?'oui':'non')}${row('Hébergement',esc(r.lodging||'—'))}
    <h4>🧳 Habitudes de voyage</h4>${row('Voyage',r.trips.toFixed(1).replace('.',',')+' fois par an')}${row('Dernier vol',`il y a ~${r.lastTrip} mois`)}${row('Vols avec vous',r.nbWithUs)}${row('Fidélité',r.tier==='Aucun'?'Aucune carte':`⭐ ${r.tier} · ${num(r.miles)} miles`)}
      ${(r.hist&&r.hist.length)?`<div class="pc-hist">${r.hist.map(h=>`<div>✈️ ${esc(h)}</div>`).join('')}</div>`:''}
    <div class="small mut" style="margin-top:10px">Passager fictif généré par le jeu à partir des statistiques du marché.</div></div>`;
}
function registerPaxActions(){ Object.assign(ACTIONS,{
  paxCountry:d=>{ UI.paxCountry=d.cc; renderPanel(); },
  paxUnit:d=>{ UI.paxUnit=d.k; renderPanel(); },
  manifest:d=>{ if(UI.manFor!==d.id){ UI.manF='all'; UI.manFor=d.id; } const ac=findAc(d.id); if(ac) showModal(`📋 Manifeste ${ac.reg}`, manifestHtml(ac), true); },
  paxCard:d=>{ const ac=findAc(d.id); if(ac) showModal(`🪪 Fiche passager`, passengerCardHtml(ac,+d.i)+`<div class="btns"><button class="btn" data-act="manifest" data-id="${ac.id}">← Retour au manifeste</button></div>`, true); },
  manF:d=>{ UI.manF=d.k; const ac=findAc(d.id); if(ac) showModal(`📋 Manifeste ${ac.reg}`, manifestHtml(ac), true); },
  paxLine:d=>{ showModal('🛂 Profil des passagers', paxProfileHtml(d.a,d.b), true); },
}); Object.assign(INPUTS,{ paxCountry:el=>{ UI.paxCountry=el.value; renderPanel(); } }); }

/* ---------- avis des passagers (après chaque vol, quelques-uns laissent une note) ---------- */
const REV_GOOD=['Équipage adorable, vol à l’heure.','Le repas était excellent, bravo !','Siège confortable, je referai ce trajet.','Embarquement rapide et bagages arrivés tout de suite.','Très bon rapport qualité-prix.','Pilote sympathique, atterrissage tout en douceur.','Personnel au sol aux petits soins.'];
const REV_MID=['Correct sans plus.','Vol sans histoire mais service moyen.','Prix honnête, confort limité.','Un peu serré mais ponctuel.'];
const REV_BAD=['Retard de {d} min sans aucune explication.','Siège inconfortable et repas froid.','Bagage arrivé le lendemain, personne pour m’aider.','Prix trop élevé pour ce service.','Avion vieillissant, cabine fatiguée.','Équipage débordé, attente interminable.'];
function onFlightDone(ac,leg,info){
  try{
    if(!leg.pax||!info||info.paxCount<=0||Math.random()>0.25) return;
    const m=flightManifest(ac); if(!m||!m.rows||!m.rows.length) return;
    const r=pick(m.rows), route=info.route, ratio=route&&route.pm?(route.pm[r.cls==='w'?'y':r.cls]??1):1;
    let sc=3.5+(S.service-3)*0.4+(ac.condition-80)/60-Math.min(2,info.delay/40)-(ratio-1)*1.3+(r.cls==='f'||r.cls==='j'?0.25:0)+(r.mood==='énervé(e)'?-0.8:r.mood==='ravi(e)'?0.7:0)+rnd(-0.6,0.6);
    const stars=clamp(Math.round(sc),1,5), d=Math.round(info.delay);
    const text=stars>=4?pick(REV_GOOD):stars===3?pick(REV_MID):pick(REV_BAD).replace('{d}',Math.max(10,d||rndi(20,90)));
    (S.reviews=S.reviews||[]).unshift({t:S.time,stars,name:r.first+' '+r.last.charAt(0)+'.',nat:r.nat,route:leg.from+'→'+leg.to,cls:r.cls,text,job:r.job});
    if(S.reviews.length>80) S.reviews.length=80;
    S.reputation=clamp(S.reputation+(stars-3)*0.04,0,100);
    if(Math.random()<0.3&&typeof tickerPush==='function') tickerPush(`✈️ ${S.company.code}${flightNumber(ac)} est arrivé à ${AP(leg.to).city} avec ${info.paxCount} passagers.`,'ok');
    if(stars===1||stars===5) logMsg(`${'★'.repeat(stars)}${'☆'.repeat(5-stars)} Avis de ${r.first} (${leg.from}→${leg.to}) : « ${text} »`, stars===5?'ok':'warn');
  }catch(e){}
}
function reviewsHtml(){
  const L=S.reviews||[]; if(!L.length) return '<div class="mut small">Aucun avis pour l’instant : ils arrivent après vos vols.</div>';
  const avg=L.reduce((s,x)=>s+x.stars,0)/L.length, dist=[5,4,3,2,1].map(k=>[k,L.filter(x=>x.stars===k).length/L.length]);
  return `<div class="card"><div class="row"><div style="font-size:30px;font-weight:800">${avg.toFixed(1).replace('.',',')}</div><div class="grow"><div>${'★'.repeat(Math.round(avg))}${'☆'.repeat(5-Math.round(avg))}</div><div class="small mut">${L.length} avis récents</div></div></div>
    ${bars(dist.map(([k,v])=>[`${k} ★`,v,k>=4?'#34d399':k===3?'#fbbf24':'#f87171']))}</div>
  ${L.slice(0,30).map(x=>`<div class="card small"><div class="row"><b class="grow">${COUNTRIES[x.nat]?COUNTRIES[x.nat][2]:'🌍'} ${esc(x.name)} <span class="mut">· ${esc(x.job)}</span></div><span style="color:${x.stars>=4?'#34d399':x.stars===3?'#fbbf24':'#f87171'}">${'★'.repeat(x.stars)}${'☆'.repeat(5-x.stars)}</span></div><div>${esc(x.text)}</div><div class="mut">${esc(x.route)} · ${fmtDate(x.t)}</div></div>`).join('')}`;
}
