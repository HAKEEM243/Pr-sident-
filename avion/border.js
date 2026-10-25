/* =========================================================
   Sky Empire — 🛂 Poste frontière (contrôle des passagers à l'arrivée)
   Intégré au jeu, sans score ni chronomètre : vous choisissez un de vos
   vols et vous pouvez contrôler TOUS ses passagers, un par un, comme un
   agent à l'aéroport d'arrivée (DGM et DGDA à Kinshasa, PAF et Douane à
   Paris…). Pour chaque passager, un dossier complet :
   • passeport (photo, identité, numéro, dates, bande MRZ, puce, tampons)
     ou carte d'identité pour un compatriote ;
   • visa d'entrée (pour la RDC : visa d'ambassade ou e-visa DGM, type,
     durée de séjour, entrées, numéro, passeport associé, hologramme) ;
   • carte d'embarquement ; fiche d'arrivée (adresse, motif, durée,
     profession) ; contrôle sanitaire (température, certificat OMS de
     vaccination fièvre jaune : date, lot, centre) ; autorisation parentale
     pour un mineur seul ;
   • douane : déclaration (devises, marchandises), bagages (couleur, poids,
     étiquette, contenu à la fouille).
   Décisions : admettre, refuser l'entrée, contrôle approfondi, orienter
   vers le service médical ; en douane : laisser passer ou fouiller, puis
   saisie et amende. Les anomalies sont rares (comme en vrai) ; une erreur
   a des conséquences réalistes pour votre compagnie (renvoi du passager à
   vos frais, indemnité, amende).
   Quand un de vos avions atterrit, le jeu propose parfois de le contrôler
   (réglable : jamais, rarement, parfois). Passagers et documents fictifs.
   ========================================================= */
'use strict';
const BC={cache:{}, view:null, seen:new Set(), lastAsk:0};
const BC_FACES=['🧑🏿','👩🏿','👨🏿','🧔🏿','👵🏿','👴🏿','🧑🏾','👩🏾','👨🏾','🧑🏽','👩🏽','👨🏽','🧑🏻','👩🏻','👨🏻','🧔🏻','👱🏻‍♀️','👩🏼‍🦱','🧑🏼‍🦰','👨🏾‍🦲'];
const BC_NOVISA_CD=new Set(['KE','UG','TZ','RW','BI','ZW','MU','SC','ZM']);   // exemptés ou accord régional (simplifié)
const BC_VTYPE={business:'Affaires',tourism:'Tourisme',family:'Visite familiale',study:'Études',work:'Établissement (travail)',medical:'Soins médicaux',pilgrim:'Tourisme',humanitarian:'Mission humanitaire'};
const BC_SAY={business:['Des réunions avec un client.','Un salon professionnel.','La signature d’un contrat.'],tourism:['Des vacances.','Visiter le pays.','Du tourisme, quelques jours.'],family:['Voir ma famille.','Le mariage de ma sœur.','Rendre visite à mes parents.'],study:['Mes études à l’université.','La rentrée universitaire.'],work:['Un nouveau poste dans une entreprise.','Un chantier de plusieurs mois.'],medical:['Une opération à l’hôpital.','Des examens médicaux.'],pilgrim:['Un pèlerinage.','Une visite religieuse.'],humanitarian:['Une mission avec une ONG.','Une campagne de vaccination.']};
const BC_KIN=['Gombe, avenue du Commerce','Limete, 7e rue','Ngaliema, quartier Ma Campagne','Lingwala, avenue Kasa-Vubu','Bandalungwa, avenue Kimbondo','Kintambo, Magasin','Hôtel Pullman, Gombe','Hôtel Memling, Gombe','Hôtel Fleuve Congo, Gombe','Kinshasa, Matonge','Mont-Ngafula, cité Mama Mobutu'];
const BC_YFC=['Institut Pasteur','Centre de vaccinations internationales','Hôpital général de référence','Service de santé aux frontières','Clinique du voyageur'];
const BC_CONTRA_CD=[['📱 12 téléphones neufs dans leur boîte (quantité commerciale)',2500],['💊 Médicaments sans ordonnance (2 kg)',800],['💎 Pierres brutes sans certificat',6000],['🧴 Cosmétiques éclaircissants interdits',600],['📦 Pagnes en gros non déclarés (40 pièces)',1200]];
const BC_CONTRA_EU=[['🥩 Viande de brousse fumée (interdite)',900],['🚬 6 cartouches de cigarettes (au-delà du quota)',700],['👜 Sacs de marque contrefaits',1500],['🐘 Objet en ivoire (CITES)',5000],['🐟 Poissons fumés et chenilles séchées (produits animaux)',300]];
// visage cohérent avec le passager : sexe, âge, origine (teint), coiffure
function bcFace(x,r,avoid){ const reg=(COUNTRIES[x.nat]&&COUNTRIES[x.nat][1])||'EU', tones=(typeof TONES!=='undefined'&&TONES[reg])||['🏽'], F=!!x.F, a=x.age;
  const V=a<13?[[F?'👧':'👦','']]:a>=65?[[F?'👵':'👴','']]:F?[['👩',''],['👩','\u200d🦱']].concat(reg==='EU'||reg==='NA'?[['👩','\u200d🦰']]:[]).concat(a>45?[['👩','\u200d🦳']]:[]):[['👨',''],['👨','\u200d🦱'],['👨','\u200d🦲'],['🧔','']];
  for(let k=0;k<12;k++){ const v=V[Math.floor(r()*V.length)], t=tones[Math.floor(r()*tones.length)], e=v[0]+t+v[1]; if(e!==avoid) return e; }
  const t2=['🏻','🏼','🏽','🏾','🏿'].find(t=>(V[0][0]+t+V[0][1])!==avoid); return V[0][0]+t2+V[0][1]; }
const bcD=(t)=>{ const d=new Date(t); return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`; };
// --- les passagers d'un vol (liste complète, mise en mémoire) ---
function bcFlight(ac){
  const leg=ac&&ac.flight&&ac.flight.legs[ac.flight.li]; if(!leg||!leg.pax) return null;
  const key=pfK(ac,leg); if(BC.cache[key]) return BC.cache[key];
  const total=leg.pax.f+leg.pax.j+leg.pax.w+leg.pax.y, man=flightManifest(ac,total); if(!man||!man.rows) return null;
  const A=AP(leg.from), B=AP(leg.to), f={key,acId:ac.id,fno:`${S.company.code}${flightNumber(ac)}`,leg:{from:leg.from,to:leg.to,dep:leg.dep},A,B,intl:A.cc!==B.cc,rows:man.rows,total:man.rows.length,arr:leg.dep+legProf(leg,modelOf(ac)).total};
  BC.cache[key]=f; const ks=Object.keys(BC.cache); if(ks.length>6) delete BC.cache[ks[0]]; return f;
}
// dossier d'un passager (stable) avec ses éventuelles anomalies
function bcCase(f,i){
  f.cases=f.cases||{}; if(f.cases[i]) return f.cases[i];
  const x=f.rows[i], r=pfRng(f.key+'|bc|'+i), R=(a,b)=>a+Math.floor(r()*(b-a+1)), now=S.time, Y=new Date(now).getUTCFullYear(), day=86400000;
  const national=x.nat===f.B.cc, cd=f.B.cc==='CD', minor=x.age<18&&!/accompagn/.test(x.marital||'');
  const needVisa=f.intl&&!national&&(cd?!BC_NOVISA_CD.has(x.nat):x.visa==='Visa obtenu'), yfNeed=f.intl&&typeof PF_YF!=='undefined'&&PF_YF.has(f.B.cc);
  const face=bcFace(x,r), stay=x.purp==='work'||x.purp==='study'?R(90,365):R(5,28), passNo=x.passNo||((x.nat||'XX')+R(1000000,9999999));
  const c={i,x,face,photo:face,national,minor,needVisa,yfNeed,passNo,passExp:now+R(200,2500)*day,issued:now-R(300,3000)*day,damaged:false,
    bpName:`${x.last.toUpperCase()}/${x.first.toUpperCase()}`,bpFlight:f.fno,bpDate:f.leg.dep,bpTo:f.B.code,
    visa:needVisa?{kind:cd?(r()<0.55?'e-Visa DGM (visa électronique)':`Ambassade de la RDC — ${(COUNTRIES[x.nat]||[x.nat])[0]}`):`Consulat — ${(COUNTRIES[f.B.cc]||[''])[0]}`,type:BC_VTYPE[x.purp]||'Tourisme',days:x.purp==='work'||x.purp==='study'?365:R(0,1)?30:60,entries:r()<0.5?'Une entrée':'Entrées multiples',no:(cd?'RDC-':'V')+R(10000000,99999999),pass:passNo,from:now-R(10,80)*day,until:now+R(30,330)*day}:null,
    card:{addr:cd?BC_KIN[R(0,BC_KIN.length-1)]:`${f.B.city}, ${['hôtel du centre','chez un parent','résidence universitaire','appartement loué'][R(0,3)]}`,purp:x.purp,stay,job:x.job},
    say:(BC_SAY[x.purp]||BC_SAY.tourism)[R(0,1)],
    health:{temp:+(36.1+r()*1.1).toFixed(1),yf:yfNeed?{date:now-R(400,4000)*day,lot:'YF'+R(1000,9999)+'-'+R(10,99),centre:BC_YFC[R(0,BC_YFC.length-1)],doc:pfName(x.nat,r)}:null},
    ast:minor&&f.intl?{parent:pfName(x.nat,r)}:null,
    decl:{cash:x.cash||R(50,900),goods:x.declare||'rien à déclarer'},
    bags:(x.bagList&&x.bagList.length?x.bagList:x.bags?Array.from({length:x.bags},()=>({tag:'XX'+R(100000,999999),kg:R(8,23),what:'vêtements et affaires personnelles',color:'noir'})):[]).map(b=>({...b})),
    stamps:Array.from({length:R(0,5)},()=>{ const L=Object.keys(COUNTRIES); return COUNTRIES[L[R(0,L.length-1)]][2]; }),
    imm:null, cus:null};
  // anomalies rares (≈ 6 % à l'immigration, ≈ 1 % santé, ≈ 5 % en douane)
  if(r()<0.06){ const o=['exp','photo','bpname','damaged'].concat(needVisa?['novisa','visaexp','visano','visatype','stay']:[]).concat(yfNeed?['yf','yfdate']:[]).concat(c.ast?['minor']:[]), d=o[R(0,o.length-1)]; c.imm=d;
    if(d==='exp') c.passExp=now-R(3,300)*day; if(d==='photo') c.photo=bcFace(x,r,face);
    if(d==='bpname'){ const L=x.last.toUpperCase(), k=Math.max(1,Math.floor(L.length/2)); c.bpName=`${L.slice(0,k-1)}${L[k]||'E'}${L[k-1]}${L.slice(k+1)}/${x.first.toUpperCase()}`; if(c.bpName.split('/')[0]===L) c.bpName=L+'E/'+x.first.toUpperCase(); }
    if(d==='damaged') c.damaged=true; if(d==='novisa') c.visa=null; if(d==='visaexp') c.visa.until=now-R(2,60)*day; if(d==='visano') c.visa.pass=(x.nat||'XX')+R(1000000,9999999);
    if(d==='visatype'){ const o2=Object.keys(BC_SAY).filter(k=>BC_VTYPE[k]!==c.visa.type); c.say=BC_SAY[o2[R(0,o2.length-1)]][0]; }
    if(d==='stay') c.card.stay=c.visa.days+R(15,90); if(d==='yf') c.health.yf=null; if(d==='yfdate') c.health.yf.date=now-R(1,8)*day; if(d==='minor') c.ast=null; }
  if(r()<0.012) c.health.temp=+(38.1+r()*1.2).toFixed(1);
  if(f.intl&&r()<0.05){ const L=f.B.cc==='CD'||(typeof PF_YF!=='undefined'&&PF_YF.has(f.B.cc))?BC_CONTRA_CD:BC_CONTRA_EU; if(r()<0.35){ c.cus={kind:'cash',hidden:R(11,40)*1000}; } else { const k=L[R(0,L.length-1)]; c.cus={kind:'goods',item:k[0],fine:k[1],bag:R(0,Math.max(0,c.bags.length-1))}; } }
  return f.cases[i]=c;
}
const BC_WHY={exp:'passeport expiré',photo:'la photo du passeport n’est pas cette personne',bpname:'le nom de la carte d’embarquement ne correspond pas',damaged:'passeport abîmé, non valable',novisa:'pas de visa d’entrée',visaexp:'visa expiré',visano:'visa délivré pour un autre passeport (faux visa probable)',visatype:'motif déclaré différent du type de visa',stay:'séjour prévu plus long que le visa',yf:'pas de certificat de vaccination fièvre jaune',yfdate:'vaccin fièvre jaune fait il y a moins de 10 jours (pas encore valable)',minor:'mineur seul sans autorisation parentale'};
// --- décisions (enregistrées dans la sauvegarde) ---
function bcSt(f){ S.bc=S.bc||{}; const k=f.key; if(!S.bc[k]){ S.bc[k]={imm:{},cus:{},med:{},t:S.time,fno:f.fno,from:f.A.code,to:f.B.code,acId:f.acId,arr:f.arr,cost:0}; const ks=Object.keys(S.bc); if(ks.length>12) for(const kk of ks.sort((a,b)=>S.bc[a].t-S.bc[b].t).slice(0,ks.length-12)) delete S.bc[kk]; } return S.bc[k]; }
function bcStats(f){ const s=bcSt(f), v=Object.values(s.imm); return {done:v.length, ok:v.filter(x=>x==='ok').length, ref:v.filter(x=>x==='ref').length, seize:Object.values(s.cus).filter(x=>x==='seize').length, med:Object.keys(s.med).length}; }
function bcOutcome(f,c,kind,v){
  const s=bcSt(f); let msg='';
  if(kind==='imm'){ s.imm[c.i]=v;
    if(v==='ref'&&typeof bcDeport==='function') bcDeport(f,c);
    if(v==='ref'&&c.imm){ book('incidents',-900); s.cost=(s.cost||0)+900; msg=`⛔ Entrée refusée : ${BC_WHY[c.imm]}. Le passager repart par votre prochain vol (billet retour à vos frais : 900 $).`; }
    else if(v==='ref'){ book('incidents',-600); s.cost=(s.cost||0)+600; S.reputation=clamp((S.reputation||50)-0.1,0,100); msg=`⛔ Entrée refusée… mais après vérification, ses documents étaient en règle. Plainte du passager : indemnité de 600 $ versée par la compagnie.`; }
    else if(v==='ok'&&c.imm){ (s.later=s.later||[]).push(c.i); msg=`🟩 Tampon d’entrée apposé. Admis${c.x.F?'e':''} sur le territoire.`; }
    else msg=`🟩 Tampon d’entrée apposé. Admis${c.x.F?'e':''} sur le territoire.`; }
  if(kind==='med'){ s.med[c.i]=v; msg=v==='iso'?`🏥 Orienté${c.x.F?'e':''} vers le service médical de l’aéroport pour un examen (fièvre ${c.health.temp} °C).`:'🌡️ Température notée.'; }
  if(kind==='cus'){ s.cus[c.i]=v;
    if(v==='seize'){ if(c.cus){ msg=c.cus.kind==='cash'?`🚫 Devises non déclarées saisies (${fmtMoney(c.cus.hidden)}) et procès-verbal dressé.`:`🚫 Saisie : ${c.cus.item}. Amende douanière : ${fmtMoney(c.cus.fine)} (payée par le passager).`; } else { S.reputation=clamp((S.reputation||50)-0.03,0,100); msg='Rien d’interdit dans les bagages : le passager repart, un peu agacé.'; } }
    else if(v==='free'){ msg='🟢 Sortie par le couloir vert.'; } }
  try{ save(); }catch(e){} return msg;
}
// anomalies laissées passer : signalées plus tard par les autorités (amende transporteur) — appliqué à l'arrivée du vol
function bcLater(f){ const s=bcSt(f), L=(s.later||[]).slice(s.laterN||0); if(!L.length) return; s.laterN=(s.later||[]).length; const n=L.length, fine=n*3000; book('incidents',-fine); s.cost=(s.cost||0)+fine; S.reputation=clamp((S.reputation||50)-0.15*n,0,100);
  logMsg(`🛂 Contrôle a posteriori sur ${f.fno} : ${n} passager${n>1?'s':''} admis par erreur (${L.map(i=>BC_WHY[bcCase(f,i).imm]).join(', ')}). Amende transporteur ${fmtMoney(fine)}.`,'bad'); try{ save(); }catch(e){} }
// --- affichage ---
const bcCard='background:#f8fafc;color:#0f172a;border-radius:10px;padding:9px 11px;font-size:12.5px;line-height:1.45;box-shadow:0 2px 8px rgba(0,0,0,.35)';
// --- 🧑‍✈️ l'adjoint : il signale les endroits à regarder (pas toujours un problème, « on ne sait jamais ») ---
const bcHL=k=>BC.hl&&BC.hl.has(k)?'outline:3px solid #f59e0b;outline-offset:2px;box-shadow:0 0 0 6px rgba(245,158,11,.25);':'';
function bcRow(k,v){ const on=BC.hl&&BC.hl.has(k);
  return `<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed #cbd5e1;${on?'background:#fef08a;border-radius:4px;padding:0 3px;outline:2px solid #f59e0b':''}"><span style="color:#475569">${on?'🔍 ':''}${k}</span><b style="text-align:right">${v}</b></div>`; }
const BC_HLMAP={exp:['Expire le'],photo:['@photo'],bpname:['Passager','Nom'],damaged:['@passport'],novisa:['@visa'],visaexp:['au'],visano:['Pour le passeport n°','N°'],visatype:['Catégorie','@say'],stay:['Durée de séjour','Durée prévue'],yf:['Certificat OMS fièvre jaune'],yfdate:['Vacciné(e) le'],minor:['@ast']};
const BC_HLTXT={'Expire le':'la date d’expiration du passeport','@photo':'la photo par rapport au visage','Passager':'le nom sur la carte d’embarquement','Nom':'le nom du passeport','@passport':'l’état du passeport','@visa':'le visa','au':'la date de fin du visa','Pour le passeport n°':'le n° de passeport écrit sur le visa','N°':'le n° du passeport','Catégorie':'la catégorie du visa','@say':'ce que dit le passager','Durée de séjour':'la durée autorisée par le visa','Durée prévue':'la durée prévue sur la fiche','Certificat OMS fièvre jaune':'le certificat fièvre jaune','Vacciné(e) le':'la date du vaccin','@ast':'l’autorisation parentale','Date':'la date de la carte d’embarquement','Vol':'le n° de vol','De → à':'la destination de la carte','Caméra thermique':'la température','Devises déclarées':'l’argent déclaré','@bags':'les bagages (fouille conseillée)'};
function bcHelp(f,c){
  if(c.help) return c.help; const r=pfRng(f.key+'|help|'+c.i), set=new Set(), why=[];
  const pool=['Expire le','@photo','Passager','Date','De → à'].concat(c.visa?['Pour le passeport n°','Catégorie','au','Durée de séjour']:[]).concat(c.health.yf?['Vacciné(e) le']:[]).concat(f.intl?['Durée prévue']:[]);
  if(c.imm&&r()<0.85) for(const k of BC_HLMAP[c.imm]||[]) set.add(k);
  const extra=c.imm?1:(r()<0.5?1:2); for(let n=0,g=0;n<extra&&g<20;g++){ const k=pool[Math.floor(r()*pool.length)]; if(!set.has(k)){ set.add(k); n++; } }
  if(c.health.temp>=37.8) set.add('Caméra thermique');
  const cs=new Set(); if(c.cus&&r()<0.7) cs.add(c.cus.kind==='cash'?'Devises déclarées':'@bags'); else if(r()<0.12) cs.add('@bags');
  // niveau de risque affiché dans la liste (l'adjoint peut se tromper)
  const noise=r(), miss=r()<0.05, score=(c.imm?(miss?0.05:0.52):0)+(c.cus?0.25:0)+(c.health.temp>=38?0.4:0)+noise*0.35+(r()<0.05?0.4:0);   // l'adjoint se trompe parfois
  const lvl=score>=0.7?3:score>=0.35?2:1;
  return c.help={set,cs,lvl};
}
const bcDot=l=>l===3?'🔴':l===2?'🟡':'🟢';
function bcAideName(){ if(!S.bcAide){ const r=pfRng('aide|'+(S.company&&S.company.code)); S.bcAide=pfName(typeof homeCC==='function'?homeCC():'CD',r); } return S.bcAide; }
function bcAidePanel(f,c,step){
  if(S.bcHelp===false) return ''; const hp=bcHelp(f,c), keys=step==='cus'?[...hp.cs]:[...hp.set];
  const txt=keys.map(k=>BC_HLTXT[k]||k).filter(Boolean);
  return `<div class="card" style="margin:6px 0;border-left:5px solid #f59e0b;background:rgba(245,158,11,.08)">🧑‍✈️ <b>Votre adjoint ${esc(bcAideName())}</b> · risque ${bcDot(hp.lvl)} ${hp.lvl===3?'élevé':hp.lvl===2?'moyen':'faible'}<br>${txt.length?`« Regardez surtout : ${txt.join(', ')}. »`:step==='cus'?'« Rien de particulier pour la douane, couloir vert si vous voulez. »':'« Rien ne m’alerte. »'}<br><small class="mut">Les endroits à vérifier sont surlignés en jaune 🔍 — ce n’est pas forcément un problème, l’adjoint peut aussi se tromper.</small></div>`;
}
function bcDocs(f,c){
  const x=c.x, nat=COUNTRIES[x.nat]||['—','','🏳️'], sx=x.F?'F':'M', now=S.time, dest=COUNTRIES[f.B.cc]||[f.B.city,'','🏳️'];
  const mrz1=(`P<${x.nat}${x.last.toUpperCase().replace(/[^A-Z]/g,'')}<<${x.first.toUpperCase().replace(/[^A-Z]/g,'')}`+'<'.repeat(44)).slice(0,44), mrz2=(`${c.passNo}<${x.nat}${(x.dob||'').replace(/\D/g,'').slice(-2)}${sx}${bcD(c.passExp).replace(/\D/g,'').slice(-6)}`+'<'.repeat(44)).slice(0,44);
  const row=bcRow;
  let h='';
  h+=`<div style="${bcCard};${bcHL('@passport')}border-top:6px solid ${c.national?'#0e7490':'#1e3a8a'};${c.damaged?'background:linear-gradient(135deg,#f8fafc 68%,#d6cfc4 68%);transform:rotate(-1.5deg)':''}">
    <div style="display:flex;justify-content:space-between"><b>${c.national&&!f.intl?'CARTE D’IDENTITÉ':'PASSEPORT'} · ${esc(nat[0]).toUpperCase()}</b><span>${nat[2]} <span title="passeport biométrique">🔲</span></span></div>
    <div style="display:flex;gap:10px;margin-top:5px"><div style="font-size:46px;background:#e2e8f0;border-radius:6px;padding:2px 8px;height:max-content;${bcHL('@photo')}">${c.photo}</div><div style="flex:1">
    ${row('Nom',esc(x.last.toUpperCase()))}${row('Prénom',esc(x.first))}${row('Sexe',sx)}${row('Nationalité',esc(x.nat))}${row('Né'+(x.F?'e':'')+' le',esc(x.dob||'—'))}${row('à',esc(x.born||x.home||'—'))}${row('N°',esc(c.passNo))}${row('Délivré le',bcD(c.issued))}${row('Expire le',`<span style="color:${c.passExp<now?'#b91c1c':'inherit'}">${bcD(c.passExp)}</span>`)}</div></div>
    ${c.damaged?'<div style="color:#b91c1c;font-weight:700;margin-top:4px">⚠️ page des données décollée et déchirée</div>':''}
    <div style="font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.4px;margin-top:5px;word-break:break-all;background:#eef2f7;padding:3px 4px;border-radius:4px">${esc(mrz1)}<br>${esc(mrz2)}</div>
    ${c.stamps.length?`<div style="margin-top:4px">Tampons des pages visas : ${c.stamps.map(s=>`<span style="display:inline-block;border:2px dashed #7c3aed;border-radius:50%;padding:1px 4px;margin:1px;opacity:.85">${s}</span>`).join('')}</div>`:''}</div>`;
  if(f.intl){ const v=c.visa;
    if(c.needVisa||c.imm==='novisa') h+=v?`<div style="${bcCard};${bcHL('@visa')}border-left:6px solid #16a34a;background:linear-gradient(135deg,#ecfdf5,#f0f9ff)"><div style="display:flex;justify-content:space-between"><b>🛂 VISA ${f.B.cc==='CD'?'D’ENTRÉE — RÉPUBLIQUE DÉMOCRATIQUE DU CONGO':'— '+esc(dest[0]).toUpperCase()}</b><span style="font-size:26px">${c.photo}</span></div>
      ${row('Délivré par',esc(v.kind))}${row('Catégorie',esc(v.type))}${row('Durée de séjour',v.days+' jours')}${row('Entrées',v.entries)}${row('N° du visa',esc(v.no))}${row('Pour le passeport n°',esc(v.pass))}${row('Valable du',bcD(v.from))}${row('au',`<span style="color:${v.until<now?'#b91c1c':'inherit'}">${bcD(v.until)}</span>`)}
      <div style="margin-top:3px;font-size:11px;color:#0369a1">✨ hologramme · ${f.B.cc==='CD'?'cachet DGM':'cachet consulaire'}</div></div>`:`<div style="${bcCard};${bcHL('@visa')}opacity:.85"><b>🛂 Visa</b><br><i>aucun visa d’entrée dans le passeport</i></div>`;
    else h+=`<div style="${bcCard};opacity:.75"><b>🛂 Visa</b><br>${c.national?'Ressortissant(e) : pas de visa':f.B.cc==='CD'&&BC_NOVISA_CD.has(x.nat)?'Exempté(e) de visa (accord régional)':'Pas de visa requis pour cette nationalité'}</div>`; }
  h+=`<div style="${bcCard};border-left:6px solid #f59e0b"><b>🎫 CARTE D’EMBARQUEMENT · ${esc(S.company.name)}</b>${row('Passager',esc(c.bpName))}${row('Vol',esc(c.bpFlight))}${row('Date',bcD(c.bpDate))}${row('De → à',`${esc(f.A.code)} → ${esc(c.bpTo)}`)}${row('Siège',esc(x.seat)+' · '+(({f:'Première',j:'Affaires',w:'Premium',y:'Économique'})[x.cls]||''))}</div>`;
  if(f.intl) h+=`<div style="${bcCard};border-left:6px solid #64748b"><b>📝 FICHE D’ARRIVÉE ${f.B.cc==='CD'?'(DGM)':''}</b>${row('Adresse pendant le séjour',esc(c.card.addr))}${row('Motif',(typeof PURPOSE_LABEL!=='undefined'&&PURPOSE_LABEL[c.card.purp])||esc(c.card.purp))}${row('Durée prévue',c.card.stay+' jours')}${row('Profession',esc(c.card.job||'—'))}${row('Provenance',esc(f.A.city))}<div style="font-style:italic;color:#475569;margin-top:2px">Signature : ${esc(x.first[0])}. ${esc(x.last)}</div></div>`;
  const hy=c.health.yf;
  h+=`<div style="${bcCard};border-left:6px solid #eab308;background:#fefce8"><b>🩺 CONTRÔLE SANITAIRE ${f.B.cc==='CD'?'(PNHF — hygiène aux frontières)':''}</b>${row('Caméra thermique',`<span style="color:${c.health.temp>=38?'#b91c1c':'#15803d'}">${c.health.temp} °C</span>`)}
    ${c.yfNeed?(hy?`${row('Certificat OMS fièvre jaune','✅ présenté')}${row('Vacciné(e) le',bcD(hy.date))}${row('Lot du vaccin',esc(hy.lot))}${row('Centre',esc(hy.centre))}${row('Médecin',esc(hy.doc)+' 🩺 cachet')}<div style="font-size:11px;color:#475569">Valable à vie, à partir du 10e jour après la vaccination.</div>`:row('Certificat OMS fièvre jaune','<span style="color:#b91c1c">non présenté</span>')):row('Fièvre jaune','non exigé pour ce pays')}</div>`;
  if(c.minor&&f.intl) h+=c.ast?`<div style="${bcCard};${bcHL('@ast')}border-left:6px solid #db2777"><b>👨‍👧 AUTORISATION DE SORTIE DU TERRITOIRE</b><br>Mineur(e) de ${x.age} ans voyageant seul(e), autorisé(e) par <b>${esc(c.ast.parent)}</b> (parent).</div>`:`<div style="${bcCard};${bcHL('@ast')}opacity:.85"><b>👨‍👧 Autorisation parentale</b><br><i>non présentée (mineur de ${x.age} ans voyageant seul)</i></div>`;
  if(f.intl) h+=`<div style="${bcCard};${bcHL('@say')}background:#e0f2fe"><b>🗣️ Vous :</b> « Quel est le but de votre voyage ? »<br><b>${esc(x.first)} :</b> « ${esc(c.say)} »</div>`;
  return h;
}
function bcCustoms(f,c,searched){
  const row=bcRow;
  let h=`<div style="${bcCard};border-left:6px solid #dc2626"><b>🛃 DÉCLARATION EN DOUANE ${f.B.cc==='CD'?'(DGDA)':''}</b>${row('Devises déclarées',fmtMoney(c.decl.cash))}${row('Marchandises',esc(c.decl.goods))}${row('Bagages en soute',c.bags.length?c.bags.length+' · '+c.bags.reduce((a,b)=>a+b.kg,0)+' kg':'aucun')}<div style="font-size:11px;color:#475569">Au-delà de 10 000 $ en espèces, déclaration obligatoire.</div></div>`;
  h+=c.bags.map((b,k)=>`<div style="${bcCard};${bcHL('@bags')}"><b>🧳 Valise ${k+1}</b> · ${esc(b.color)} · ${b.kg} kg · étiquette <b>${esc(b.tag)}</b>${searched?`<br>Contenu : ${esc(b.what)}${c.cus&&c.cus.kind==='goods'&&c.cus.bag===k?`<br><b style="color:#b91c1c">⚠️ ${esc(c.cus.item)}</b>`:''}`:''}</div>`).join('');
  if(searched) h+=`<div style="${bcCard}"><b>👜 Sac à main / poches</b><br>Portefeuille, téléphone, passeport${c.cus&&c.cus.kind==='cash'?`<br><b style="color:#b91c1c">⚠️ Liasses de billets : ${fmtMoney(c.cus.hidden)} non déclarés</b>`:''}</div>`;
  return h;
}
const bcStatus=(f,i)=>{ const s=bcSt(f), v=s.imm[i], cu=s.cus[i]; return v==='ref'?'⛔ refusé':cu==='seize'?'🚫 saisie':v==='ok'&&cu?'✅ sorti':v==='ok'?'🛃 en douane':s.med[i]?'🏥 médical':'⏳ à contrôler'; };
function bcList(f){
  if(S.time>f.arr) bcLater(f);
  const st=bcStats(f), q=(BC.q||'').toLowerCase(), flt=BC.flt||'todo', s=bcSt(f);
  let idx=f.rows.map((x,i)=>i).filter(i=>{ const x=f.rows[i]; if(q&&!(x.first+' '+x.last).toLowerCase().includes(q)) return false; const v=s.imm[i];
    return flt==='all'?true:flt==='risk'?(!v&&bcHelp(f,bcCase(f,i)).lvl>=2):flt==='todo'?!v:flt==='ref'?v==='ref':flt==='cus'?(v==='ok'&&!s.cus[i]):flt==='seize'?s.cus[i]==='seize':true; });
  const lim=BC.lim||40, more=idx.length>lim; idx=idx.slice(0,lim);
  const chip=(k,l)=>`<button class="chip ${flt===k?'on':''}" data-act="bcFlt" data-k="${k}">${l}</button>`;
  return `<div class="small mut">${esc(f.fno)} · ${esc(f.A.city)} → <b>${esc(f.B.city)}</b> · ${f.intl?'🌍 vol international':'🏠 vol intérieur'} · arrivée ${fmtTime(f.arr)}</div>
    <div class="row" style="gap:6px;align-items:center"><button class="btn sm" data-act="bcHelpT">🧑‍✈️ Adjoint : ${S.bcHelp===false?'désactivé':'activé'}</button>${S.bcHelp!==false?`<small class="mut">🔴 à vérifier en priorité · 🟡 à regarder · 🟢 rien de particulier</small>`:''}</div><div class="card" style="margin:6px 0"><b>${f.B.cc==='CD'?'🇨🇩 DGM · DGDA · PNHF':'🛂 Immigration · 🛃 Douane'}</b> — ${st.done} / ${f.total} contrôlés · ✅ ${st.ok} admis · ⛔ ${st.ref} refusés · 🚫 ${st.seize} saisies · 🏥 ${st.med} au médical</div>
    <div class="chips">${S.bcHelp!==false?chip('risk','🔴🟡 Signalés par l’adjoint'):''}${chip('todo','⏳ À contrôler')}${chip('cus','🛃 En douane')}${chip('ref','⛔ Refusés')}${chip('seize','🚫 Saisies')}${chip('all','Tous')}</div>
    <input data-in="bcQ" placeholder="🔎 Chercher un passager" value="${esc(BC.q||'')}" style="width:100%;margin:6px 0">
    <div>${idx.map(i=>{ const x=f.rows[i]; return `<div class="row" data-act="bcPax" data-i="${i}" style="gap:8px;padding:6px 4px;border-bottom:1px solid rgba(148,163,184,.2);cursor:pointer"><span style="font-size:22px">${bcCase(f,i).face}</span>${S.bcHelp!==false&&!s.imm[i]?`<span title="risque selon l’adjoint">${bcDot(bcHelp(f,bcCase(f,i)).lvl)}</span>`:''}<span class="grow"><b>${esc(x.last.toUpperCase())}</b> ${esc(x.first)} <small class="mut">${COUNTRIES[x.nat]?COUNTRIES[x.nat][2]:''} · ${x.age} ans · siège ${esc(x.seat)}</small></span><small>${bcStatus(f,i)}</small></div>`; }).join('')||'<div class="mut small">Personne dans cette liste.</div>'}</div>
    ${more?`<div class="btns"><button class="btn sm" data-act="bcMore">Afficher plus</button></div>`:''}
    ${f.total-st.done>0?`<div class="btns"><button class="btn sm" data-act="bcAll">✅ Contrôle standard pour les ${f.total-st.done} restants</button></div><div class="small mut">Les autres passagers passent le contrôle habituel des agents de l’aéroport.</div>`:''}`;
}
function bcPaxView(f,i){
  const c=bcCase(f,i), s=bcSt(f), v=s.imm[i], cu=s.cus[i], x=c.x;
  let h=`<div class="row" style="gap:8px;justify-content:space-between"><button class="btn sm" data-act="bcBack">← Liste</button><small class="mut">Passager ${i+1} / ${f.total}</small><button class="btn sm" data-act="bcNext">Suivant →</button></div>
    <div class="card" style="text-align:center;margin:6px 0"><div style="font-size:64px;line-height:1">${c.face}</div><div><b>${esc(x.first)} ${esc(x.last)}</b> · ${x.age} ans${c.minor?' · voyage seul(e)':''}</div><small class="mut">${bcStatus(f,i)}</small></div>`;
  if(BC.msg) h+=`<div class="card" style="margin:6px 0;border-left:5px solid #38bdf8">${BC.msg}</div>`;
  const hp=S.bcHelp===false?null:bcHelp(f,c);
  if(!v) h+=bcAidePanel(f,c,'imm');
  BC.hl=hp&&!v?hp.set:null; h+=`<h3>🛂 Immigration</h3><div style="display:grid;gap:8px">${bcDocs(f,c)}</div>`; BC.hl=null;
  if(!v){
    if(BC.deep===i) h+=`<div style="${bcCard};margin-top:8px;border-left:6px solid #7c3aed"><b>🔎 Contrôle approfondi</b><br>${c.imm==='visano'?'Le numéro du visa n’existe pas dans le fichier '+(f.B.cc==='CD'?'de la DGM':'des visas')+'.':c.imm==='visatype'||c.imm==='stay'?'Le passager hésite et ne présente pas de réservation correspondant à son visa.':c.imm==='photo'?'Les empreintes digitales ne correspondent pas au passeport biométrique.':c.imm?'L’examen confirme : '+BC_WHY[c.imm]+'.':'Réservation d’hôtel, billet retour et moyens de subsistance présentés : tout est cohérent.'}<br>Billet retour : ${c.card.stay<=60?'✅ le '+bcD(S.time+c.card.stay*86400000):'aller simple'} · Argent sur lui : ~${fmtMoney(c.decl.cash)}</div>`;
    h+=`<div class="btns" style="position:sticky;bottom:0;background:var(--bg2,#0f172a);padding:8px 0;z-index:2">${c.health.temp>=38&&!s.med[i]?`<button class="btn" data-act="bcMed" style="background:#b45309">🏥 Orienter vers le médical</button>`:''}<button class="btn" data-act="bcImm" data-v="ok">🟩 Admettre (tampon d’entrée)</button><button class="btn" data-act="bcImm" data-v="ref" style="background:#b91c1c">⛔ Refuser l’entrée</button>${BC.deep!==i?`<button class="btn" data-act="bcDeep">🔎 Contrôle approfondi</button>`:''}</div>`;
  } else if(v==='ok'){
    if(!cu) h+=bcAidePanel(f,c,'cus');
    BC.hl=hp&&!cu?hp.cs:null; h+=`<h3>🛃 Douane</h3><div style="display:grid;gap:8px">${bcCustoms(f,c,BC.search===i||cu==='seize')}</div>`; BC.hl=null;
    if(!cu) h+=`<div class="btns" style="position:sticky;bottom:0;background:var(--bg2,#0f172a);padding:8px 0;z-index:2">${BC.search===i?`<button class="btn" data-act="bcCus" data-v="seize" style="background:#b91c1c">🚫 Saisie et procès-verbal</button><button class="btn" data-act="bcCus" data-v="free">✅ Rien à signaler</button>`:`<button class="btn" data-act="bcCus" data-v="free">🟢 Couloir vert</button><button class="btn" data-act="bcSearch" style="background:#b45309">🔍 Fouiller les bagages</button>`}</div>`;
  }
  return h;
}
function bcRender(top){
  const vw=BC.view; if(!vw) return; const f=BC.cache[vw.key]; if(!f){ toast('Ce vol n’est plus disponible.','info'); return; }
  const body=vw.i==null?bcList(f):bcPaxView(f,vw.i), el=document.getElementById('bcRoot'), title=`🛂 Poste frontière · ${f.fno} → ${f.B.city}`;
  if(el){ el.innerHTML=body; if(top){ const sc=el.closest('.mbody'); if(sc) sc.scrollTop=0; } } else showModal(title,`<div id="bcRoot">${body}</div>`,true);
}
// choix du vol
function bcPick(){
  const fl=S.fleet.filter(a=>a.status==='flight'&&a.flight&&a.flight.legs[a.flight.li]&&a.flight.legs[a.flight.li].pax).map(a=>({a,st:flightState(a),leg:a.flight.legs[a.flight.li]}));
  fl.sort((p,q)=>(AP(q.leg.from).cc!==AP(q.leg.to).cc)-(AP(p.leg.from).cc!==AP(p.leg.to).cc)||q.st.phase-p.st.phase);
  const ph=st=>st.phase>=7?'🛬 atterrit':st.phase>=5?'⬇️ en descente':st.phase>=2?'✈️ en vol':'🚪 à la porte';
  const ask=S.bcAsk||'rare';
  showModal('🛂 Poste frontière',`<div class="small mut">Choisissez un vol : vous contrôlez ses passagers à leur arrivée (immigration, santé, douane). Vous n’êtes jamais obligé : les vols non contrôlés passent le contrôle normal.</div>
    ${fl.slice(0,40).map(({a,st,leg})=>{ const A=AP(leg.from),B=AP(leg.to),p=leg.pax.f+leg.pax.j+leg.pax.w+leg.pax.y; return `<div class="row" style="gap:6px;margin:5px 0"><span class="grow"><b>${S.company.code}${flightNumber(a)}</b> ${esc(A.city)} → ${esc(B.city)} ${A.cc!==B.cc?'🌍':''}<br><small class="mut">${ph(st)} · ${p} passagers</small></span><button class="btn sm" data-act="bcOpen" data-id="${a.id}">🛂 Contrôler</button></div>`; }).join('')||'<div class="mut">Aucun vol avec des passagers en ce moment.</div>'}
    <h3>⚙️ Me proposer un contrôle quand un avion atterrit</h3><div class="chips">${[['never','Jamais'],['rare','Rarement'],['some','Parfois']].map(([k,l])=>`<button class="chip ${ask===k?'on':''}" data-act="bcAskSet" data-k="${k}">${l}</button>`).join('')}</div>`,true);
}
function bcOpen(acId,i){ const ac=S.fleet.find(a=>a.id===acId); const f=bcFlight(ac); if(!f){ toast('Pas de passagers sur ce vol.','info'); return; } BC.view={key:f.key,i:i==null?null:i}; BC.flt=S.bcHelp!==false?'risk':'todo'; BC.q=''; BC.lim=40; BC.msg=''; BC.deep=null; BC.search=null; closeModal(); bcRender(true); }
Object.assign(ACTIONS,{
  bcPick:()=>bcPick(), bcOpen:d=>bcOpen(d.id),
  bcHelpT:()=>{ S.bcHelp=S.bcHelp===false; try{ save(); }catch(e){} if(BC.flt==='risk'&&S.bcHelp===false) BC.flt='todo'; bcRender(); },
  bcAskSet:d=>{ S.bcAsk=d.k; try{ save(); }catch(e){} bcPick(); },
  bcFlt:d=>{ BC.flt=d.k; BC.lim=40; bcRender(); }, bcMore:()=>{ BC.lim=(BC.lim||40)+60; bcRender(); },
  bcPax:d=>{ BC.view.i=+d.i; BC.msg=''; BC.deep=null; BC.search=null; bcRender(true); },
  bcBack:()=>{ BC.view.i=null; BC.msg=''; bcRender(true); },
  bcNext:()=>{ const f=BC.cache[BC.view.key], s=bcSt(f); let j=BC.view.i+1; while(j<f.total&&(s.imm[j]||(BC.flt==='risk'&&bcHelp(f,bcCase(f,j)).lvl<2))) j++; if(j>=f.total){ BC.view.i=null; BC.msg=''; } else { BC.view.i=j; BC.msg=''; } BC.deep=null; BC.search=null; bcRender(true); },
  bcDeep:()=>{ BC.deep=BC.view.i; bcRender(); },
  bcSearch:()=>{ BC.search=BC.view.i; bcRender(); },
  bcMed:()=>{ const f=BC.cache[BC.view.key]; BC.msg=bcOutcome(f,bcCase(f,BC.view.i),'med','iso'); bcRender(true); },
  bcImm:d=>{ const f=BC.cache[BC.view.key]; BC.msg=bcOutcome(f,bcCase(f,BC.view.i),'imm',d.v); if(d.v==='ref'){ ACTIONS.bcNextKeep(); } else bcRender(true); },
  bcNextKeep:()=>{ const m=BC.msg; ACTIONS.bcNext(); BC.msg=m; bcRender(true); },
  bcCus:d=>{ const f=BC.cache[BC.view.key]; BC.msg=bcOutcome(f,bcCase(f,BC.view.i),'cus',d.v); ACTIONS.bcNextKeep(); },
  bcAll:()=>{ const f=BC.cache[BC.view.key], s=bcSt(f); let n=0; for(let i=0;i<f.total;i++) if(!s.imm[i]){ s.imm[i]='ok'; s.cus[i]='free'; n++; } try{ save(); }catch(e){} toast(`✅ ${n} passagers passés au contrôle standard.`,'ok'); bcRender(true); },
  bcLater:d=>{ BC.banner&&BC.banner.remove(); BC.banner=null; },
});
if(typeof INPUTS!=='undefined') Object.assign(INPUTS,{ bcQ:el=>{ BC.q=el.value; const pos=el.selectionStart; bcRender(); const n=document.querySelector('[data-in="bcQ"]'); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch(e){} } } });
// proposition à l'atterrissage : rare, jamais plusieurs à la fois
function bcWatch(){
  if(!S||!S.fleet) return; const ask=S.bcAsk||'rare'; if(ask==='never') return;
  const gap=ask==='some'?8*60000:20*60000, prob=ask==='some'?0.35:0.15, home=typeof homeCC==='function'?homeCC():'CD';
  for(const a of S.fleet){ if(a.status!=='flight'||!a.flight) continue; const leg=a.flight.legs[a.flight.li]; if(!leg||!leg.pax) continue; const k=pfK(a,leg); if(BC.seen.has(k)) continue;
    const st=flightState(a); if(!st||st.phase<6) continue; BC.seen.add(k); if(BC.seen.size>3000) BC.seen.clear();
    const A=AP(leg.from), B=AP(leg.to); if(A.cc===B.cc||!(B.cc===home||(S.hubs||[]).includes(leg.to))) continue;
    if(Date.now()-BC.lastAsk<gap||Math.random()>prob||document.querySelector('#modal:not([hidden]) .mbox')||BC.banner) continue;
    BC.lastAsk=Date.now(); bcBanner(a,leg); break; }
}
function bcBanner(a,leg){
  const A=AP(leg.from), B=AP(leg.to), p=leg.pax.f+leg.pax.j+leg.pax.w+leg.pax.y, el=document.createElement('div');
  el.style.cssText='position:fixed;left:10px;right:10px;top:calc(64px + env(safe-area-inset-top));z-index:3000;background:#0f172a;border:1px solid #334155;border-left:5px solid #38bdf8;border-radius:12px;padding:10px 12px;color:#e2e8f0;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:520px;margin:auto';
  el.innerHTML=`<div>🛬 <b>${S.company.code}${flightNumber(a)}</b> arrive à <b>${esc(B.city)}</b> depuis ${esc(A.city)} · ${p} passagers.<br>Voulez-vous contrôler ce vol à la frontière ?</div><div class="btns" style="margin-top:6px"><button class="btn sm" data-act="bcOpen" data-id="${a.id}">🛂 Contrôler</button><button class="btn sm" data-act="bcLater">Plus tard</button></div>`;
  document.body.appendChild(el); BC.banner=el; setTimeout(()=>{ if(BC.banner===el){ el.remove(); BC.banner=null; } },30000);
  el.addEventListener('click',e=>{ if(e.target.closest('[data-act="bcOpen"]')){ setTimeout(()=>{ el.remove(); if(BC.banner===el) BC.banner=null; },0); } });
}
function bcHook(){ if(bcHook.done) return; bcHook.done=true;
  if(typeof pfCardHtml==='function'){ const _c=pfCardHtml; pfCardHtml=function(){ const h=_c.apply(this,arguments); return h+`<div class="card"><b>🛂 Poste frontière</b> <span class="small mut">— contrôlez vous-même les passagers d’un vol à l’arrivée : passeport, visa, carte d’embarquement, santé (fièvre jaune), douane</span><div class="btns"><button class="btn" data-act="bcPick">🛂 Choisir un vol</button></div></div>`; }; }
  if(typeof manifestHtml==='function'){ const _mh=manifestHtml; manifestHtml=function(ac){ const h=_mh.apply(this,arguments); return ac&&ac.flight?`<div class="btns"><button class="btn" data-act="bcOpen" data-id="${ac.id}">🛂 Contrôler ce vol à la frontière</button></div>`+h:h; }; }
  // conséquences des erreurs : à l'arrivée du vol
  if(typeof onFlightDone==='function'){ const _o=onFlightDone; onFlightDone=function(ac,leg){ try{ const f=BC.cache[pfK(ac,leg)]; if(f) bcLater(f); }catch(e){} return _o.apply(this,arguments); }; }
  setInterval(()=>{ try{ bcWatch(); }catch(e){} },3000);
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ bcHook(); }catch(e){ console.warn(e); } },0));
