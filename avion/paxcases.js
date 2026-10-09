/* =========================================================
   Sky Empire — Service client : cas passagers à gérer
   Des situations réelles sur VOS vols en cours (surréservation,
   bagage perdu, urgence médicale, célébrité, passager ivre,
   réclamation…). Le passager concerné vient du manifeste du vol.
   Vos choix coûtent ou rapportent : argent, image, avis, actualités.
   ========================================================= */
'use strict';
const PAX_SENDER={code:'PAX', name:'Service client', color:'#0e7490'};
function paxPick(filter){
  const fl=S.fleet.filter(a=>a.status==='flight'&&a.flight&&a.flight.legs[a.flight.li]&&a.flight.legs[a.flight.li].pax);
  for(let i=0;i<6&&fl.length;i++){ const ac=pick(fl), m=flightManifest(ac); if(!m||!m.rows||!m.rows.length) continue;
    const rows=filter?m.rows.filter(filter):m.rows; if(rows.length) return {ac,m,r:pick(rows)}; }
  return null;
}
const fnOf=ac=>`${S.company.code}${flightNumber(ac)}`;
function paxMail(kind,x,subj,body,opts,extra){
  const e={...PAX_SENDER, ceo:`${x.r.first} ${x.r.last}`};
  return mailPush(e,kind,subj,`<div class="paxcase"><div>${body}</div></div>`,opts,{acId:x.ac.id, ri:x.r.i, pname:`${x.r.first} ${x.r.last}`, pF:!!x.r.F, pav:x.r.avatar||'🧑', exp:S.time+2*DAY, ...(extra||{})});
}
function review(x,stars,text){
  (S.reviews=S.reviews||[]).unshift({t:S.time,stars,name:x.first+' '+x.last.charAt(0)+'.',nat:x.nat,route:x.route||'',cls:x.cls||'y',text,job:x.job||''});
  if(S.reviews.length>80) S.reviews.length=80;
}
const rep=d=>{ S.reputation=clamp(S.reputation+d,0,100); };

/* ---------- générateurs ---------- */
const PAX_CASES=[
  {w:1.2, f:()=>{ const x=paxPick(r=>r.cls==='y'); if(!x) return false; const n=rndi(3,9), c=Math.round(idealPrice(x.m.leg.from,x.m.leg.to,'y')*1.5/10)*10;
    return paxMail('paxOverbook',x,`Surréservation sur le ${fnOf(x.ac)}`,`Le vol ${fnOf(x.ac)} ${esc(x.m.from.city)} → ${esc(x.m.to.city)} a été vendu en surréservation : <b>${n} passagers</b> n’ont pas de siège, dont ${esc(x.r.first)}, furieux${x.r.F?'se':''} au comptoir.<br>Que proposez-vous ?`,
      [{k:'cash',l:`💵 ${fmtMoney(c)} chacun + vol suivant`},{k:'voucher',l:'🎟️ Bon d’achat + hôtel'},{k:'no',l:'🙅 Rien (conditions de vente)'}],{n,c}); }},
  {w:1.3, f:()=>{ const x=paxPick(r=>r.bags>0); if(!x) return false;
    return paxMail('paxBag',x,`Bagage perdu — ${x.r.first} ${x.r.last}`,`« Je suis arrivé${x.r.F?'e':''} à ${esc(x.m.to.city)} avec le ${fnOf(x.ac)}, mais ma valise de ${x.r.bag} kg n’est jamais sortie du tapis. ${x.r.purp==='business'?'J’ai une réunion demain matin, mes costumes sont dedans !':x.r.purp==='family'?'Il y avait tous les cadeaux pour ma famille…':'Tous mes vêtements sont dedans.'} »`,
      [{k:'courier',l:'🚚 Livraison express + 250 $'},{k:'std',l:'📄 Procédure standard (5 à 10 jours)'}]); }},
  {w:0.7, f:()=>{ const x=paxPick(r=>r.age>45); if(!x) return false; const st=flightState(x.ac); if(!st||st.phase<3||st.phase>5) return false;
    const cost=Math.round(rnd(45e3,140e3)/1e3)*1e3;
    return paxMail('paxMed',x,`🚨 Urgence médicale à bord du ${fnOf(x.ac)}`,`${esc(x.r.first)} ${esc(x.r.last)}, ${x.r.age} ans (siège ${x.r.seat}), fait un malaise grave au-dessus de ${st.frac<0.5?esc(x.m.from.city):esc(x.m.to.city)}. ${Math.random()<0.5?'Un médecin s’est présenté parmi les passagers.':'Aucun médecin à bord, l’équipage applique les premiers secours.'}<br>Le commandant demande votre décision.`,
      [{k:'divert',l:`🛬 Dérouter vers l’aéroport le plus proche (≈ ${fmtMoney(cost)})`},{k:'continue',l:'✈️ Continuer jusqu’à destination'}],{cost, exp:S.time+3*HOUR}); }},
  {w:0.8, f:()=>{ const x=paxPick(r=>r.cls==='y'||r.cls==='w'); if(!x) return false;
    const who=pick(['chanteur de rumba très connu','footballeur international','influenceuse aux 3 millions d’abonnés','actrice de Nollywood','humoriste à succès','champion olympique']);
    return paxMail('paxVip',x,`⭐ Une célébrité sur le ${fnOf(x.ac)}`,`${esc(x.r.first)} ${esc(x.r.last)}, <b>${who}</b>, voyage en ${x.r.cls==='w'?'premium éco':'classe éco'} sur le ${fnOf(x.ac)}. Son agent propose : un <b>surclassement gratuit</b> contre une vidéo sur ses réseaux sociaux.`,
      [{k:'upgrade',l:'🥂 Surclasser + accueil VIP'},{k:'no',l:'Refuser poliment'}],{who}); }},
  {w:0.8, f:()=>{ const x=paxPick(r=>r.age>=21); if(!x) return false;
    return paxMail('paxUnruly',x,`🍷 Passager ivre sur le ${fnOf(x.ac)}`,`${esc(x.r.first)} ${esc(x.r.last)} (siège ${x.r.seat}) a bu trop d’alcool, insulte l’équipage et refuse de rester assis${x.r.F?'e':''}. Les passagers autour filment la scène.`,
      [{k:'police',l:'👮 Police à l’arrivée + interdiction de vol'},{k:'calm',l:'☕ L’équipage le calme, on oublie'}]); }},
  {w:1.4, f:()=>{ const x=paxPick(r=>r.mood==='énervé(e)'||r.mood==='impatient(e)'); if(!x) return false;
    return paxMail('paxComplaint',x,`Réclamation — ${fnOf(x.ac)}`,`« ${x.r.moodWhy?esc(x.r.moodWhy.charAt(0).toUpperCase()+x.r.moodWhy.slice(1))+'. ':''}J’ai payé ${fmtMoney(x.r.price)} pour ce billet ${esc(x.m.from.city)} → ${esc(x.m.to.city)} et je suis très déçu${x.r.F?'e':''}. Je voyage ${x.r.trips.toFixed(0)} fois par an, je peux aller ailleurs. »`,
      [{k:'refund',l:`💸 Rembourser 50 % (${fmtMoney(x.r.price/2)})`},{k:'miles',l:'🎁 Offrir 10 000 miles'},{k:'sorry',l:'✉️ Simple lettre d’excuses'}],{price:x.r.price}); }},
  {w:0.9, f:()=>{ const x=paxPick(r=>r.mood==='ravi(e)'||r.mood==='calme'); if(!x) return false;
    return paxMail('paxThanks',x,`💌 Merci à votre équipage !`,`« Je voulais remercier l’équipage du ${fnOf(x.ac)} ${esc(x.m.from.city)} → ${esc(x.m.to.city)}. ${pick(['L’hôtesse a gardé mon enfant calme pendant tout le vol.','Le commandant a pris le temps de nous expliquer la météo.','On m’a retrouvé mon téléphone oublié sous le siège.','C’était mon premier vol, je n’ai jamais eu peur.'])} Bravo ! »`,
      [{k:'share',l:'📣 Partager sur nos réseaux'},{k:'crew',l:'🏅 Prime pour l’équipage (5 000 $)'}]); }},
];
function paxCaseTick(){
  if(!S.fleet||!S.fleet.length) return; S.inbox=S.inbox||[];
  // cas ignorés : le passager s'en souvient
  for(const m of S.inbox||[]) if(m.st==='new'&&m.kind&&m.kind.startsWith('pax')&&m.exp<S.time){ m.st='exp';
    if(['paxComplaint','paxBag','paxOverbook'].includes(m.kind)){ rep(-0.6); review({first:(m.pname||'X').split(' ')[0],last:(m.pname||'X X').split(' ')[1]||'X',nat:'',route:''},1,'Ma réclamation est restée sans réponse. Inadmissible.'); }
    if(m.kind==='paxMed'){ rep(-2); aiNews(`⚠️ Un passager du vol ${m.subj.split('du ')[1]||''} a attendu de longues minutes une décision : l’enquête est ouverte.`,'warn',true); }
  }
  const flying=S.fleet.filter(a=>a.status==='flight').length; if(!flying) return;
  const open=(S.inbox||[]).filter(m=>m.st==='new'&&m.kind&&m.kind.startsWith('pax')).length;
  if(open>=3||Math.random()>Math.min(0.07,0.025+flying*0.002)) return; // ≈ 1 à 2 cas par jour
  for(let i=0;i<3;i++){ const g=wpick(PAX_CASES); if(g.f()) return; }
}

/* ---------- réponses ---------- */
function paxAnswer(m,k){
  const ac=S.fleet.find(a=>a.id===m.acId), mf=ac&&flightManifest(ac), r=mf&&mf.rows&&mf.rows[m.ri];
  const p=r||{first:(m.pname||'').split(' ')[0],last:(m.pname||'').split(' ')[1]||'',nat:'',cls:'y',job:''};
  const rv={...p, route:mf?`${mf.leg.from}→${mf.leg.to}`:''};
  let res='';
  switch(m.kind){
    case 'paxOverbook':
      if(k==='cash'){ book('incidents',-m.n*m.c); rep(0.4); review(rv,4,'Surréservé, mais bien indemnisé et replacé sur le vol suivant. Correct.'); res=`💵 ${m.n} passagers indemnisés (${fmtMoney(m.n*m.c)}). Ils repartent satisfaits.`; }
      else if(k==='voucher'){ book('incidents',-m.n*180); review(rv,3,'Bon d’achat et nuit d’hôtel… on fait avec.'); res=`🎟️ Bons d’achat et hôtel pour ${m.n} passagers (${fmtMoney(m.n*180)}).`; }
      else { rep(-1.5); review(rv,1,'Débarqué sans rien, « conditions de vente » ! Plus jamais.'); if(Math.random()<0.4) aiNews(`😡 Colère à l’aéroport : ${S.company.name} laisse ${m.n} passagers surréservés sans compensation.`,'warn',true); res=`🙅 Aucune compensation. Les passagers sont furieux (image -1,5).`; }
      break;
    case 'paxBag':
      if(k==='courier'){ book('incidents',-(250+rndi(80,220))); rep(0.3); review(rv,4,'Valise perdue mais livrée à mon hôtel le lendemain, avec un dédommagement. Bravo pour la réactivité.'); res=`🚚 Valise retrouvée et livrée sous 24 h à ${p.first}.`; }
      else { rep(-0.3); review(rv,2,'Valise rendue au bout d’une semaine. Service lent.'); res='📄 Dossier ouvert : la valise sera rendue dans quelques jours.'; }
      break;
    case 'paxMed':
      if(k==='divert'){ book('incidents',-m.cost); rep(2); aiNews(`🛬 Le ${m.subj.split('du ')[1]||'vol'} de ${S.company.name} se déroute pour sauver un passager : l’équipage salué pour son sang-froid.`,'news',true); res=`🛬 Déroutement effectué, ${p.first} est pris${r&&r.F?'e':''} en charge à l’hôpital (${fmtMoney(m.cost)}). Image +2.`; }
      else if(Math.random()<0.65){ rep(0.5); res=`✈️ Le vol continue. ${p.first} est stabilisé${r&&r.F?'e':''} et pris${r&&r.F?'e':''} en charge à l’arrivée.`; }
      else { rep(-3); aiNews(`⚠️ Polémique : ${S.company.name} a refusé de dérouter un vol malgré l’état grave d’un passager.`,'warn',true); res=`⚠️ L’état de ${p.first} s’est aggravé pendant le vol. La presse s’en mêle (image -3).`; }
      break;
    case 'paxVip':
      if(k==='upgrade'){ const gain=Math.random()<0.75; rep(gain?1.5:0.3); book('marketing',-rndi(1500,4000)); if(gain) aiNews(`📱 La vidéo de ${p.first} ${p.last} (${m.who}) à bord de ${S.company.name} dépasse le million de vues !`,'news',true); res=gain?`🥂 La vidéo fait le buzz : image +1,5.`:`🥂 Surclassement offert ; la vidéo passe inaperçue.`; }
      else { res='Demande déclinée poliment.'; if(Math.random()<0.25){ rep(-0.6); res+=' La star s’en plaint sur les réseaux (image -0,6).'; } }
      break;
    case 'paxUnruly':
      if(k==='police'){ rep(0.4); res=`👮 ${p.first} ${p.last} est remis${r&&r.F?'e':''} à la police à l’arrivée et interdit${r&&r.F?'e':''} de vol. Les autres passagers applaudissent.`; }
      else { if(Math.random()<0.5){ rep(-1); aiNews(`📹 Une vidéo d’un passager ivre insultant l’équipage de ${S.company.name} circule sur les réseaux.`,'warn',true); res='☕ L’incident est clos… mais la vidéo circule (image -1).'; } else res='☕ Le passager s’est calmé, fin de l’incident.'; }
      break;
    case 'paxComplaint':
      if(k==='refund'){ book('incidents',-m.price/2); rep(0.3); review(rv,4,'Ma réclamation a été prise au sérieux et remboursée. Je reste client.'); res=`💸 ${fmtMoney(m.price/2)} remboursés à ${p.first}.`; }
      else if(k==='miles'){ book('marketing',-120); review(rv,3,'Des miles en compensation, c’est déjà ça.'); res=`🎁 10 000 miles offerts à ${p.first}.`; }
      else { if(Math.random()<0.5){ rep(-0.4); review(rv,2,'Une lettre type d’excuses, sans plus. Décevant.'); } res='✉️ Lettre d’excuses envoyée.'; }
      break;
    case 'paxThanks':
      if(k==='share'){ rep(0.6); res='📣 Le message est partagé : de belles réactions (image +0,6).'; }
      else { book('salaires',-5000); rep(0.3); S.crewMorale=Math.min(100,(S.crewMorale||70)+3); res='🏅 Prime versée à l’équipage, le moral remonte.'; }
      break;
  }
  return res;
}
