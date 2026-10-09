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
  poor:['étudiant boursier','commerçant ambulant','ouvrier','agriculteur','travailleur saisonnier','chauffeur','artisan','employé de maison','petit exportateur','vendeuse de marché','mineur artisanal']};
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
function flightManifest(ac){
  const fl=ac&&ac.flight; if(!fl) return null;
  const leg=fl.legs[fl.li]; if(!leg) return null;
  const pax=leg.pax; if(!pax) return {leg, cargo:true};
  const total=pax.f+pax.j+pax.w+pax.y;
  const pr=paxProfile(leg.from,leg.to), rnd=seeded(hashS(ac.id+'|'+leg.dep+'|'+leg.from+leg.to));
  const A=AP(leg.from), B=AP(leg.to), rt=ac.flight.routeId&&S.routes.find(r=>r.id===ac.flight.routeId);
  const pm=(rt&&rt.pm)||{};
  const rows=[], N=Math.min(total,60), classSeq=[]; for(const [k,n] of [['f',pax.f],['j',pax.j],['w',pax.w],['y',pax.y]]) for(let i=0;i<n;i++) classSeq.push(k);
  const pool=cc=>{ const P=NAME_POOLS[cc]||NAME_POOLS[COUNTRIES[cc]&&COUNTRIES[cc][1]]||NAME_POOLS.EU; return P; };
  const seatRow={f:1,j:4,w:12,y:20}; const used={};
  for(let i=0;i<N;i++){
    const k=classSeq[Math.floor(i*classSeq.length/N)];
    const wealth= k==='f'? pickW(rnd,[['rich',.86],['mid',.14]]) : k==='j'? pickW(rnd,[['rich',.55],['mid',.4],['poor',.05]]) : k==='w'? pickW(rnd,[['rich',.1],['mid',.7],['poor',.2]]) : pickW(rnd,[['rich',pr.wealth.rich*.35],['mid',pr.wealth.mid*1.1],['poor',pr.wealth.poor*1.3]]);
    const nat=pickW(rnd,pr.nat.filter(n=>n.cc!=='??').map(n=>[n.cc,n.share])) || A.cc;
    const pmx=purposeMix(wealth,pr.lvlFrom,pr.lvlTo,pr.km,A.cc,B.cc);
    const purp=pickW(rnd,Object.entries(pmx));
    const [a0,a1]=AGE_RANGE[purp]; const age=Math.round(a0+rnd()*(a1-a0));
    const P=pool(nat), name=`${P[0][Math.floor(rnd()*P[0].length)]} ${P[1][Math.floor(rnd()*P[1].length)]}`;
    const trips=Math.max(.3,tripsPerYear(wealth,purp)*(0.6+rnd()*0.8));
    const base=idealPrice(leg.from,leg.to,k==='w'?'y':k)*(k==='w'?1.35:1), mult=(pm[k==='w'?'y':k]??1)*(0.9+rnd()*0.22)*(k==='y'&&wealth==='poor'?0.92:1);
    const row=(seatRow[k]+((used[k]=(used[k]||0)+1)>>2)), seat=row+'ABCDEF'[(used[k]-1)%6];
    const visaReq = pr.lvlTo>pr.lvlFrom && A.cc!==B.cc && rnd()<0.62;
    rows.push({name, sex:rnd()<.5?'F':'M', age, nat, wealth, purp, cls:k, seat, price:base*mult, trips, channel:pick2(rnd,BOOKING[wealth]), job:pick2(rnd,PROF[wealth]),
      bag:Math.round((purp==='tourism'?22:purp==='business'?12:purp==='work'?30:20)*(0.6+rnd()*0.9)), visa:visaReq?'Visa obtenu':'Pas de visa requis', lastTrip:Math.max(1,Math.round(12/trips*(0.5+rnd())))});
  }
  return {leg, from:A, to:B, total, shown:N, pr, rows};
}
const pick2=(rnd,arr)=>arr[Math.floor(rnd()*arr.length)];

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
  const A=m.from, B=m.to, pr=m.pr;
  const hdr=`<div class="small mut">Vol ${esc(S.company.code)}${flightNumber(ac)} · ${esc(A.city)} → ${esc(B.city)} · <b>${m.total}</b> passagers à bord · ${m.shown} fiches affichées. <b>Passagers fictifs</b> générés par le jeu à partir des statistiques du marché.</div>`;
  const wc={rich:0,mid:0,poor:0}, nc={}; for(const r of m.rows){ wc[r.wealth]++; nc[r.nat]=(nc[r.nat]||0)+1; }
  const sum=`<div class="chips">${Object.entries(nc).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,n])=>`<span class="chip">${COUNTRIES[c]?COUNTRIES[c][2]:'🌍'} ${n}</span>`).join('')}<span class="chip">🟣 ${wc.rich}</span><span class="chip">🔵 ${wc.mid}</span><span class="chip">🟠 ${wc.poor}</span></div>`;
  const clsL={f:'👑 1ʳᵉ',j:'💼 Aff.',w:'💺 Prem. éco',y:'💺 Éco'};
  return hdr+sum+`<div class="manifest">${m.rows.map(r=>`<div class="mrow"><div class="mh"><b>${esc(r.name)}</b> <span class="mut">${r.sex} · ${r.age} ans</span> <span class="mseat">${r.seat}</span></div>
    <div class="small">${COUNTRIES[r.nat]?COUNTRIES[r.nat][2]:'🌍'} ${esc(COUNTRIES[r.nat]?COUNTRIES[r.nat][0]:r.nat)} · ${esc(r.job)} · <span class="w-${r.wealth}">${WEALTH_LABEL[r.wealth]}</span></div>
    <div class="small mut">${PURPOSE_LABEL[r.purp]} · ${clsL[r.cls]} · billet <b>${fmtMoney(r.price)}</b> (${esc(r.channel)}) · ${r.bag} kg · ${r.visa}</div>
    <div class="small mut">Voyage ≈ ${r.trips.toFixed(1).replace('.',',')} fois par an (dernier vol il y a ~${r.lastTrip} mois)</div></div>`).join('')}</div>${m.total>m.shown?`<div class="small mut">… et ${m.total-m.shown} autres passagers.</div>`:''}`;
}
function registerPaxActions(){ Object.assign(ACTIONS,{
  paxCountry:d=>{ UI.paxCountry=d.cc; renderPanel(); },
  paxUnit:d=>{ UI.paxUnit=d.k; renderPanel(); },
  manifest:d=>{ const ac=findAc(d.id); if(ac) showModal(`📋 Manifeste ${ac.reg}`, manifestHtml(ac), true); },
  paxLine:d=>{ showModal('🛂 Profil des passagers', paxProfileHtml(d.a,d.b), true); },
}); Object.assign(INPUTS,{ paxCountry:el=>{ UI.paxCountry=el.value; renderPanel(); } }); }
