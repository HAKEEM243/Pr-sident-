/* =========================================================
   Sky Empire — 🛃 Aérogare en direct : le parcours de vos passagers
   Pour chacun de vos vols, minute par minute :
   AU DÉPART
   1. 🎫 Enregistrement : comptoirs, enregistrement en ligne, bagages
      (poids, excédents payés), file d'attente ;
   2. 🔍 Sûreté : files, portiques, alarmes, palpations, tests d'explosifs,
      objets confisqués ;
   3. 🛂 Police aux frontières (vols internationaux) : guichets, passeports
      contrôlés, signalements, refus de sortie ;
   4. 🚪 Porte d'embarquement : porte, embarquement par zones, dernier
      appel, passagers absents et bagages débarqués, porte fermée.
   À L'ARRIVÉE
   5. 🛂 Immigration (DGM à Kinshasa, PAF à Paris…) : guichets, attente,
      carnet de vaccination fièvre jaune, refus d'entrée et leurs motifs ;
   6. 🧳 Bagages : tapis, première et dernière valise, bagages perdus ;
   7. 🛃 Douane (DGDA à Kinshasa, Douane française…) : couloir vert/rouge,
      contrôles, chien renifleur, saisies et amendes.
   Des incidents vous demandent une décision (retardataires, surréservation,
   passeport expiré, bagage perdu…) : argent et image en dépendent.
   Les passagers refusés à l'entrée sont ramenés à vos frais (amende
   transporteur), comme dans la réalité. Données fictives générées par le jeu.
   ========================================================= */
'use strict';
const PF={arr:[], at:0};
const PF_AG={CD:['DGM (Direction générale de migration)','DGDA (Douanes)','🇨🇩'],FR:['Police aux frontières (PAF)','Douane française','🇫🇷'],BE:['Police fédérale (contrôle frontière)','Douane belge','🇧🇪'],
  CG:['Police des frontières (DST)','Douanes congolaises','🇨🇬'],US:['CBP (US Customs and Border Protection)','CBP Agriculture & Douane','🇺🇸'],GB:['UK Border Force','HMRC (douane)','🇬🇧'],
  CH:['Police des frontières','Office fédéral de la douane (OFDF)','🇨🇭'],AE:['GDRFA (immigration)','Dubai Customs','🇦🇪'],ZA:['Home Affairs (immigration)','SARS Customs','🇿🇦'],KE:['Immigration Kenya','KRA Customs','🇰🇪'],
  ET:['Immigration éthiopienne','Douanes éthiopiennes','🇪🇹'],TR:['Polis (contrôle des passeports)','Gümrük (douane)','🇹🇷'],MA:['DGSN (police aux frontières)','Douane marocaine','🇲🇦'],AO:['SME (migration)','AGT Douanes','🇦🇴']};
const pfAg=cc=>PF_AG[cc]||['Police des frontières','Douane',(COUNTRIES[cc]&&COUNTRIES[cc][2])||'🌍'];
const PF_YF=new Set('CD CG CM GA CF TD GQ AO NG GH CI BF ML NE SN GN SL LR TG BJ GM GW UG SS ET KE RW BI TZ ZM'.split(' '));   // fièvre jaune exigée (pays d'Afrique centrale et de l'Ouest notamment)
const PF_CONF=[['🧴 Liquides de plus de 100 ml',40],['🔥 Briquet',14],['✂️ Ciseaux à lame longue',9],['🔪 Couteau suisse',8],['🔋 Batterie externe trop puissante',6],['🧰 Outils (tournevis, pince)',6],['🪒 Rasoir à lame',5],['🎆 Feux d’artifice',1]];
const PF_SEIZE_CD=[['📱 Téléphones en quantité commerciale non déclarés',22],['💊 Médicaments sans ordonnance',14],['📦 Marchandises non déclarées (pagnes, cosmétiques)',24],['💵 Devises non déclarées (> 10 000 $)',8],['💎 Minerais / pierres sans certificat',3],['🐾 Produits d’espèces protégées',2]];
const PF_SEIZE_EU=[['🚬 Cigarettes au-delà du quota',26],['🍾 Alcool au-delà du quota',12],['🥩 Viande et produits animaux (interdits)',20],['👜 Contrefaçons (sacs, montres)',14],['💶 Devises non déclarées (> 10 000 €)',7],['🐘 Ivoire / espèces protégées (CITES)',2],['🐟 Poissons fumés et chenilles séchées',12]];
const PF_SEIZE=[['🚬 Tabac au-delà du quota',20],['🍾 Alcool au-delà du quota',12],['🥩 Produits animaux',14],['👜 Contrefaçons',14],['💵 Devises non déclarées',8]];
// tirage pseudo-aléatoire stable pour un même vol
function pfRng(key){ let s=0; for(const c of key) s=(Math.imul(s,31)+c.charCodeAt(0))|0; return ()=>{ s=(s+0x6D2B79F5)|0; let t=Math.imul(s^(s>>>15),1|s); t^=t+Math.imul(t^(t>>>7),61|t); return ((t^(t>>>14))>>>0)/4294967296; }; }
const pfPois=(lam,r)=>{ let p=Math.exp(-lam), c=p, k=0; const u=r(); while(u>c&&k<60){ k++; p*=lam/k; c+=p; } return k; };
const pfPick=(L,r)=>{ let t=L.reduce((a,b)=>a+b[1],0), v=r()*t; for(const x of L){ v-=x[1]; if(v<=0) return x[0]; } return L[0][0]; };
const pfName=(cc,r)=>{ const P=(typeof NAME_POOLS!=='undefined'&&(NAME_POOLS[cc]||NAME_POOLS[COUNTRIES[cc]&&COUNTRIES[cc][1]]||NAME_POOLS.EU))||[['Alex'],['Martin']]; return P[0][Math.floor(r()*P[0].length)]+' '+P[1][Math.floor(r()*P[1].length)]; };
const pfFmt=t=>{ try{ return fmtTime(t); }catch(e){ return new Date(t).toISOString().slice(11,16); } };
const pfK=(ac,leg)=>ac.id+'|'+leg.dep+'|'+leg.from+leg.to;
const pfCl=(x)=>Math.max(0,Math.min(1,x));
// ce qui coûte ou rapporte (excédents de bagages, refoulés) : calcul léger, le même partout
function pfLite(key,leg){ const r=pfRng(key+'|lite'), p=leg.pax||{f:0,j:0,w:0,y:0}, total=p.f+p.j+p.w+p.y, bags=Math.round(p.f*2+p.j*1.6+p.w*1.3+p.y*1.15);
  const A=AP(leg.from), B=AP(leg.to), inc_=c=>typeof incomeOf==='function'?incomeOf(c):1, over=pfPois(bags*0.07,r), refused=A.cc!==B.cc?pfPois(total*(inc_(B.cc)>inc_(A.cc)?0.004:0.001),r):0;
  return {total,bags,over,fee:over*75,refused}; }
// toutes les données d'un vol (départ + arrivée), stables
function pfData(ac,leg,man){
  const key=pfK(ac,leg), r=pfRng(key), A=AP(leg.from), B=AP(leg.to), intl=A.cc!==B.cc, m=modelOf(ac), prof=legProf(leg,m);
  const P=leg.dep+((prof.segs.find(s=>s.ph===1)||{t0:0}).t0), arr=leg.dep+prof.total;
  const pax=leg.pax||{f:0,j:0,w:0,y:0}, total=pax.f+pax.j+pax.w+pax.y, rows=(man&&man.rows)||[], seats=(typeof acSeats==='function'?Object.values(acSeats(ac)).reduce((a,b)=>a+(+b||0),0):total)||total;
  const rich=rows.length?rows.filter(x=>x.wealth==='rich').length/rows.length:0.2, poor=rows.length?rows.filter(x=>x.wealth==='poor').length/rows.length:0.3;
  const L0=pfLite(key,leg), bags=L0.bags, bagsPer=bags/Math.max(1,total), kg=Math.round(bags*19.5), over=L0.over, fee=L0.fee;
  const online=Math.round(total*pfCl(0.15+rich*0.6+(1-poor)*0.2));
  const ci={open:P-(intl?180:120)*MIN, close:P-(intl?60:40)*MIN, desks:Math.max(2,Math.ceil(total/55)), online, bags, kg, over, fee, agent:pfName(A.cc,r)};
  const alarms=Math.round(total*(0.09+r()*0.06)), conf=pfPois(total*0.07,r), confL={}; for(let i=0;i<conf;i++){ const k=pfPick(PF_CONF,r); confL[k]=(confL[k]||0)+1; }
  const sec={open:ci.open+15*MIN, close:P-25*MIN, lanes:Math.max(2,Math.ceil(total/90)), alarms, pat:Math.round(alarms*0.7), etd:Math.round(total*0.05), conf, confL, agent:pfName(A.cc,r)};
  const ag0=pfAg(A.cc), ag1=pfAg(B.cc);
  const exitRef=intl?pfPois(total*0.0012,r):0, flagged=intl?pfPois(total*0.004,r):0;
  const pol={on:intl, ag:ag0[0], flag:ag0[2], open:sec.open+5*MIN, close:P-20*MIN, booths:Math.max(2,Math.ceil(total/70)), exitRef, flagged, agent:pfName(A.cc,r)};
  const gates=typeof apGates==='function'?apGates(leg.from):null, gi=typeof gateIdx==='function'?gateIdx(leg.from,ac,typeof depIntl==='function'?depIntl(ac,ac.flight):false):0, gt=gates&&gates[gi];
  const noShow=Math.min(4,pfPois(total*0.008,r)), off=noShow?Math.round(noShow*bagsPer):0;
  const gate={name:(gt&&gt.t?gt.t.replace('T','')+'-':'')+String.fromCharCode(65+gi%6)+(gi+1), open:leg.dep, last:leg.dep+(P-leg.dep)*0.82, close:leg.dep+(P-leg.dep)*0.96, noShow, off, agent:pfName(A.cc,r)};
  // arrivée
  const refused=L0.refused, why=[]; for(let i=0;i<refused;i++) why.push(typeof plWhy==='function'?plWhy(Math.floor(r()*1e6),B.cc):'🛂 Visa absent');
  const yf=intl&&PF_YF.has(B.cc), yfMiss=yf?pfPois(total*0.012,r):0, egate=intl?Math.round(total*(B.cc===A.cc?0:pfCl(0.1+r()*0.25))):0;
  const imm={on:intl, ag:ag1[0], flag:ag1[2], open:arr+6*MIN, close:arr+(total>200?55:40)*MIN, booths:Math.max(2,Math.ceil(total/60)), egate, refused, why, yf, yfMiss, agent:pfName(B.cc,r)};
  const lost=pfPois(total*0.004,r), dmg=pfPois(bags*0.003,r);
  const bag={belt:1+Math.floor(r()*9), first:arr+(14+r()*6)*MIN, last:arr+(30+r()*14)*MIN, lost, dmg};
  const SZ=B.cc==='CD'||PF_YF.has(B.cc)?PF_SEIZE_CD:['FR','BE','DE','NL','IT','ES','PT','CH','GB'].includes(B.cc)?PF_SEIZE_EU:PF_SEIZE;
  const red=Math.round(total*(0.03+rich*0.05)), checks=Math.round((total-red)*(0.04+r()*0.05)), nSz=pfPois(total*(intl?0.02:0.004),r), sz={};
  for(let i=0;i<nSz;i++){ const k=pfPick(SZ,r); sz[k]=(sz[k]||0)+1; }
  const dog=r()<0.35, drugs=intl&&r()<0.015, fines=Math.round(nSz*(300+r()*900)/10)*10;
  const cus={ag:ag1[1], flag:ag1[2], open:arr+18*MIN, close:arr+70*MIN, red, checks, sz, nSz, dog, drugs, fines, agent:pfName(B.cc,r)};
  return {key,r,A,B,intl,P,arr,total,seats,rows,ci,sec,pol,gate,imm,bag,cus,m};
}
// progression d'une étape (0 → 1) selon l'heure
const pfProg=(now,a,b)=>pfCl((now-a)/Math.max(1,b-a));
const pfBar=(u,col)=>`<div style="height:8px;border-radius:5px;background:rgba(148,163,184,.25);overflow:hidden;margin:4px 0"><div style="height:100%;width:${Math.round(u*100)}%;background:${col||'#22c55e'};transition:width .8s"></div></div>`;
const pfSt=u=>u<=0?'<span class="mut">⏳ pas encore ouvert</span>':u>=1?'<b style="color:#22c55e">✅ terminé</b>':'<b style="color:#f59e0b">● en cours</b>';
// incidents à décider (stables pour un vol) : id, condition, texte, choix [libellé, effet]
function pfIncidents(D,side){
  const r=pfRng(D.key+'|inc'+side), out=[], names=D.rows.slice(5).map(x=>x.first+' '+x.last), nm=i=>names[i%Math.max(1,names.length)]||'un passager';
  if(side==='dep'){
    if(r()<0.55) out.push({id:'late',at:D.gate.last,t:`🏃 Deux passagers en correspondance arrivent en courant (${esc(nm(1))} et ${esc(nm(2))}) alors que la porte va fermer.`,c:[['⏱️ Attendre 8 minutes',{cash:-1800,rep:0.3,msg:'Les deux passagers ont embarqué, merci à l’équipe au sol.'}],['🚪 Fermer la porte',{rep:-0.25,msg:'Porte fermée : leurs bagages sont débarqués, ils partent sur le vol suivant.'}]]});
    if(D.total>=D.seats*0.96&&r()<0.8) out.push({id:'ob',at:D.gate.open+(D.gate.last-D.gate.open)*0.3,t:`📋 Surréservation : 3 passagers confirmés n’ont pas de siège.`,c:[['🎁 Chercher des volontaires (bon de 300 $ chacun)',{cash:-900,rep:0.15,msg:'Trois volontaires partent demain avec un bon de 300 $.'}],['⛔ Refus d’embarquement (indemnité de 600 $ chacun)',{cash:-1800,rep:-0.5,msg:'Trois passagers refusés à l’embarquement : indemnité versée, ils sont furieux.'}]]});
    if(r()<0.6) out.push({id:'bag',at:D.gate.open+(D.gate.last-D.gate.open)*0.5,t:`🧳 ${esc(nm(3))} a un bagage cabine beaucoup trop grand.`,c:[['🎒 Le mettre en soute gratuitement',{rep:0.08,msg:'Bagage étiqueté et mis en soute, passager content.'}],['💵 Faire payer 60 $',{cash:60,rep:-0.04,msg:'60 $ encaissés, le passager râle un peu.'}]]});
    if(D.intl&&r()<0.4) out.push({id:'pass',at:D.gate.open+(D.gate.last-D.gate.open)*0.6,t:`📕 À la porte, l’agent voit que le passeport de ${esc(nm(4))} est expiré depuis 2 mois.`,c:[['⛔ Refuser l’embarquement',{rep:-0.05,msg:'Passager refusé : c’est la règle, il doit renouveler son passeport.'}],['🤞 Le laisser partir',{risk:[0.65,-4500,'Refoulé à l’arrivée ! Amende transporteur 4 000 $ + billet retour 500 $.'],msg:'Il est parti… espérons que ça passe à l’arrivée.'}]]});
  } else {
    if(D.bag.lost&&r()<0.85) out.push({id:'lost',at:D.bag.last,t:`🧳 La valise de ${esc(nm(6))} n’est pas arrivée (restée à ${esc(D.A.city)}).`,c:[['🚚 Indemnité de 150 $ et livraison à son adresse',{cash:-150,rep:0.2,msg:'Valise livrée le lendemain, passager rassuré.'}],['📝 Simple déclaration de perte',{rep:-0.2,msg:'Déclaration enregistrée. Le passager publie un avis furieux.'}]]});
    if(r()<0.35) out.push({id:'wch',at:D.arr+3*MIN,t:`♿ ${esc(nm(7))} a demandé un fauteuil roulant, mais l’assistance n’est pas là.`,c:[['💨 Payer un agent d’assistance en urgence (120 $)',{cash:-120,rep:0.15,msg:'Assistance arrivée en 5 minutes.'}],['⏳ Le faire attendre',{rep:-0.15,msg:'Le passager a attendu 40 minutes à la porte de l’avion.'}]]});
  }
  return out;
}
function pfApply(D,inc,ci){
  S.pfDone=S.pfDone||{}; const k=D.key+'|'+inc.id; if(S.pfDone[k]!=null) return; const e=inc.c[ci][1]; S.pfDone[k]=ci;
  if(e.cash) book(e.cash>0?'annexes':'incidents',e.cash); if(e.rep) S.reputation=clamp((S.reputation||50)+e.rep,0,100);
  let msg=e.msg; if(e.risk&&Math.random()<e.risk[0]){ book('incidents',e.risk[1]); S.reputation=clamp((S.reputation||50)-0.3,0,100); msg=e.risk[2]; }
  toast(msg,e.cash<0||e.risk?'info':'ok'); logMsg(`🛃 ${D.A.code}→${D.B.code} : ${msg}`,'info'); pfPrune(); try{ save(); }catch(x){}
}
function pfPrune(){ const d=S.pfDone||{}, ks=Object.keys(d); if(ks.length>400) for(const k of ks.slice(0,ks.length-300)) delete d[k]; }
// conséquences automatiques, une seule fois par vol : excédents de bagages, refoulés ramenés à vos frais
function pfAuto(D){
  S.pfDone=S.pfDone||{}; if(S.pfDone[D.key+'|auto']!=null) return; S.pfDone[D.key+'|auto']=1;
  const L0=D.lite||{fee:D.ci.fee,refused:D.imm.refused};
  if(L0.fee) book('annexes',L0.fee);
  if(L0.refused){ const lvl=typeof incomeOf==='function'?incomeOf(D.B.cc):2, f=L0.refused*(lvl>=3?3000:900); book('incidents',-f); logMsg(`🛂 ${L0.refused} passager${L0.refused>1?'s':''} refoulé${L0.refused>1?'s':''} à ${D.B.city} : ramené${L0.refused>1?'s':''} à vos frais (${fmtMoney(f)}).`,'bad'); }
  pfPrune();
}
// liste des passagers et où ils en sont
function pfStream(D,now,side,acId){
  const rows=D.rows.slice(0,14); if(!rows.length) return '';
  return `<div class="pf-list">${rows.map((x,i)=>{ const r=pfRng(D.key+'|p'+i), j=r(); let st='';
    if(side==='dep'){ const tci=D.ci.open+(D.ci.close-D.ci.open)*j*0.95, tsec=tci+(10+r()*25)*MIN, tpol=tsec+(5+r()*15)*MIN, zone=x.cls==='f'||x.cls==='j'||x.tier==='Gold'||x.tier==='Platinum'?1:x.assist?2:3+Math.floor(r()*3), tb=D.gate.open+(D.gate.last-D.gate.open)*((zone-1)/5+r()*0.18);
      st=now<tci?'🏠 en route vers l’aéroport':now<tsec?`🎫 enregistré à ${pfFmt(tci)} ${x.bags?'· '+x.bags+' valise'+(x.bags>1?'s':''):'· sans bagage'}`:now<tpol||(!D.pol.on&&now<D.gate.open)?(r()<0.12?'🔍 sûreté : alarme du portique → palpation':'🔍 sûreté passée'):now<D.gate.open?(D.pol.on?'🛂 passeport tamponné · en salle d’embarquement':'☕ en salle d’embarquement'):now<tb?`⏳ attend la zone ${zone} à la porte ${D.gate.name}`:`✅ embarqué (zone ${zone}) · siège ${x.seat}`; }
    else { const td=D.arr+(3+j*14)*MIN, ti=td+(6+r()*20)*MIN, tb=D.bag.first+(D.bag.last-D.bag.first)*r(), tc=Math.max(ti,tb)+(2+r()*8)*MIN;
      st=now<D.arr?'✈️ en vol':now<td?'🚶 attend de descendre de l’avion':D.imm.on&&now<ti?`🛂 file ${D.imm.ag.split(' ')[0]}${D.imm.yf?' · carnet fièvre jaune':''}`:x.bags&&now<tb?`🧳 attend sa valise au tapis ${D.bag.belt}`:now<tc?(r()<0.06?'🛃 contrôle douane : valise ouverte':'🛃 couloir '+(r()<0.05?'rouge (déclare)':'vert')):'🚕 sorti de l’aéroport'; }
    return `<div class="pf-row" ${side==='dep'&&acId?`data-act="paxCard" data-id="${acId}" data-i="${x.i}" style="cursor:pointer"`:''}><span>${x.avatar||'🧑'}</span><span class="grow"><b>${esc(x.first)} ${esc(x.last)}</b> <small class="mut">${COUNTRIES[x.nat]?COUNTRIES[x.nat][2]:''} ${({f:'1re',j:'Affaires',w:'Premium',y:'Éco'})[x.cls]||''}</small><br><small>${st}</small></span></div>`; }).join('')}</div>`;
}
function pfHtml(D,side,acId,fno){
  const now=typeof gSimNow==='function'&&typeof G!=='undefined'&&G&&G.viewer?gSimNow():S.time, n=D.total, ci=D.ci, sec=D.sec, pol=D.pol, ga=D.gate, im=D.imm, bg=D.bag, cu=D.cus;
  const card=(t,body)=>`<div class="card" style="margin:8px 0">${t}${body}</div>`, li=(k,v)=>`<div class="row" style="justify-content:space-between;gap:8px"><span class="mut">${k}</span><b>${v}</b></div>`;
  const steps=side==='dep'?[['🎫','Enregistrement',pfProg(now,ci.open,ci.close)],['🔍','Sûreté',pfProg(now,sec.open,sec.close)],...(pol.on?[['🛂','Police',pfProg(now,pol.open,pol.close)]]:[]),['🚪','Porte',pfProg(now,ga.open,ga.close)]]
    :[...(im.on?[['🛂','Immigration',pfProg(now,im.open,im.close)]]:[]),['🧳','Bagages',pfProg(now,bg.first-5*MIN,bg.last)],['🛃','Douane',pfProg(now,cu.open,cu.close)]];
  const stepper=`<div class="row" style="gap:4px;flex-wrap:wrap;margin:6px 0">${steps.map(([i,l,u])=>`<span class="chip ${u>0&&u<1?'on':''}" style="${u>=1?'opacity:.75':''}">${i} ${l} ${u>=1?'✅':u>0?Math.round(u*100)+'%':''}</span>`).join('<span class="mut">›</span>')}</div>`;
  let html=`<div class="small mut">${fno} · ${esc(D.A.city)} (${D.A.code}) → ${esc(D.B.city)} (${D.B.code}) · ${n} passagers · ${D.intl?'🌍 international':'🏠 intérieur'} · heure du jeu ${pfFmt(now)}</div>${stepper}`;
  if(side==='dep'){
    const u1=pfProg(now,ci.open,ci.close), u2=pfProg(now,sec.open,sec.close), u3=pfProg(now,pol.open,pol.close), u4=pfProg(now,ga.open+(ga.close-ga.open)*0.2,ga.last), q=Math.round((1-Math.abs(u1-0.45)*2)*Math.max(4,n/12));
    html+=card(`<b>🎫 Enregistrement</b> · ${pfSt(u1)} · ${pfFmt(ci.open)} → ${pfFmt(ci.close)}`,pfBar(u1)+li('Enregistrés',`${Math.round(n*u1)} / ${n} (dont ${Math.round(ci.online*u1)} en ligne)`)+li('Comptoirs ouverts',u1>0&&u1<1?ci.desks:0)+li('File d’attente',u1>0&&u1<1?`~${Math.max(2,q)} min`:'—')+li('Bagages en soute',`${Math.round(ci.bags*u1)} valises · ${Math.round(ci.kg*u1).toLocaleString('fr-FR')} kg`)+li('Excédents de bagage',`${Math.round(ci.over*u1)} × 75 $ = <span style="color:#22c55e">${fmtMoney(Math.round(ci.over*u1)*75)}</span>`)+li('Cheffe de comptoir',esc(ci.agent)));
    html+=card(`<b>🔍 Sûreté (inspection filtrage)</b> · ${pfSt(u2)}`,pfBar(u2,'#38bdf8')+li('Files ouvertes',u2>0&&u2<1?sec.lanes:0)+li('Passagers contrôlés',`${Math.round(n*u2)} / ${n}`)+li('Alarmes au portique',`${Math.round(sec.alarms*u2)} → ${Math.round(sec.pat*u2)} palpations`)+li('Tests d’explosifs (traces)',Math.round(sec.etd*u2))+li('Objets confisqués',Math.round(sec.conf*u2))
      +(sec.conf&&u2>0?`<div class="small">${Object.entries(sec.confL).map(([k,v])=>`${k} × ${Math.max(0,Math.round(v*u2))}`).join(' · ')}</div>`:'')+li('Superviseur sûreté',esc(sec.agent)));
    if(pol.on) html+=card(`<b>🛂 ${pol.flag} ${esc(pol.ag)}</b> · ${pfSt(u3)}`,pfBar(u3,'#a78bfa')+li('Guichets ouverts',u3>0&&u3<1?pol.booths:0)+li('Passeports contrôlés',`${Math.round(n*u3)} / ${n}`)+li('Signalements vérifiés',Math.round(pol.flagged*u3))+li('Refus de sortie',`${Math.round(pol.exitRef*u3)}${pol.exitRef&&u3>=1?' (interdiction de sortie du territoire)':''}`)+li('Officier',esc(pol.agent)));
    const zones=[['1','Première, Affaires, Gold/Platinum'],['2','Familles, assistance'],['3','Rangs du fond'],['4','Rangs du milieu'],['5','Rangs avant']];
    html+=card(`<b>🚪 Porte ${esc(ga.name)}</b> · ${now<ga.open?'<span class="mut">⏳ embarquement à '+pfFmt(ga.open)+'</span>':now>=ga.close?'<b style="color:#ef4444">🔒 porte fermée</b>':now>=ga.last?'<b style="color:#f59e0b">📢 DERNIER APPEL</b>':'<b style="color:#22c55e">🟢 embarquement en cours</b>'}`,
      pfBar(u4,'#f59e0b')+li('Embarqués',`${Math.round((n-ga.noShow)*u4)} / ${n}`)+`<div class="small">${zones.map(([z,l],i)=>`${u4*5>i+1?'✅':u4*5>i?'▶️':'⏳'} zone ${z} : ${l}`).join('<br>')}</div>`
      +li('Passagers absents',now>=ga.close?`${ga.noShow}${ga.off?' → '+ga.off+' bagage'+(ga.off>1?'s':'')+' débarqué'+(ga.off>1?'s':''):''}`:now>=ga.last&&ga.noShow?`${ga.noShow} appelé${ga.noShow>1?'s':''} au micro…`:'—')+li('Agent d’embarquement',esc(ga.agent)));
  } else {
    const ui=pfProg(now,im.open,im.close), ub=pfProg(now,bg.first,bg.last), uc=pfProg(now,cu.open,cu.close);
    html+=card(`<b>🚶 Débarquement</b> · ${now<D.arr?'<span class="mut">✈️ à l’arrivée à '+pfFmt(D.arr)+'</span>':now<D.arr+15*MIN?'<b style="color:#f59e0b">● en cours</b>':'<b style="color:#22c55e">✅ terminé</b>'}`,pfBar(pfProg(now,D.arr,D.arr+15*MIN),'#94a3b8'));
    if(im.on) html+=card(`<b>🛂 ${im.flag} ${esc(im.ag)}</b> · ${pfSt(ui)}`,pfBar(ui,'#a78bfa')+li('Guichets ouverts',ui>0&&ui<1?`${im.booths}${im.egate?' + sas automatiques':''}`:0)+li('Passagers passés',`${Math.round((n-im.refused)*ui)} / ${n}`)+li('Attente',ui>0&&ui<1?`~${Math.round(8+n/im.booths/3)} min`:'—')
      +(im.yf?li('Carnet de vaccination fièvre jaune',`${Math.round(n*ui)} vérifiés · ${Math.round(im.yfMiss*ui)} sans carnet → vaccinés sur place`):'')
      +li('Refus d’entrée',ui>=1?`<span style="color:${im.refused?'#ef4444':'inherit'}">${im.refused}</span>`:Math.round(im.refused*ui))+(im.refused&&ui>=1?`<div class="small">${im.why.map(w=>'⛔ '+esc(w)).join('<br>')}<br><b>➜ Ramenés à vos frais par le prochain vol (amende transporteur).</b></div>`:'')+li('Officier',esc(im.agent)));
    html+=card(`<b>🧳 Livraison des bagages · tapis ${bg.belt}</b> · ${pfSt(ub)}`,pfBar(ub,'#38bdf8')+li('Première valise',pfFmt(bg.first))+li('Dernière valise',pfFmt(bg.last))+li('Bagages perdus',ub>=1?bg.lost:'—')+li('Bagages abîmés',ub>=1?bg.dmg:'—'));
    html+=card(`<b>🛃 ${cu.flag} ${esc(cu.ag)}</b> · ${pfSt(uc)}`,pfBar(uc,'#ef4444')+li('Couloir rouge (à déclarer)',Math.round(cu.red*uc))+li('Contrôles au couloir vert',Math.round(cu.checks*uc))+li('Chien renifleur',cu.dog?'🐕 en service':'—')
      +li('Saisies',Math.round(cu.nSz*uc))+(cu.nSz&&uc>0?`<div class="small">${Object.entries(cu.sz).map(([k,v])=>`${k} × ${Math.max(0,Math.round(v*uc))}`).join('<br>')}</div>`:'')
      +(cu.drugs&&uc>=0.6?`<div class="small" style="color:#ef4444">🚨 Le chien a marqué une valise : stupéfiants découverts, passager remis à la police.</div>`:'')+li('Amendes douanières',uc>=1?fmtMoney(cu.fines):'—')+li('Inspecteur',esc(cu.agent)));
  }
  const inc=pfIncidents(D,side).filter(x=>now>=x.at), done=S.pfDone||{};
  if(inc.length) html+=`<h3>⚠️ À décider</h3>`+inc.map(x=>{ const ch=done[D.key+'|'+x.id]; return `<div class="card" style="margin:6px 0;border-left:4px solid ${ch==null?'#f59e0b':'#64748b'}">${x.t}<div class="btns">${ch==null?x.c.map((c,i)=>`<button class="btn sm" data-act="pfDecide" data-k="${esc(D.key)}" data-side="${side}" data-inc="${x.id}" data-c="${i}">${c[0]}</button>`).join(''):`<span class="small mut">Décision : ${x.c[ch][0]}</span>`}</div></div>`; }).join('');
  html+=`<h3>👥 Les passagers en ce moment</h3>${pfStream(D,now,side,acId)}<div class="small mut">Passagers, agents et chiffres fictifs, générés par le jeu à partir du vol.</div>`;
  return html;
}
// --- où trouver les vols : départs (à la porte) et arrivées (avion posé ou arrivé récemment) ---
function pfDepartures(){ return S.fleet.filter(a=>a.status==='flight'&&a.flight&&a.flight.legs[a.flight.li]&&a.flight.legs[a.flight.li].pax).map(a=>{ const st=flightState(a); return st&&st.phase<=1?{a,st}:null; }).filter(Boolean).slice(0,10); }
function pfArrivals(){ const now=S.time; PF.arr=PF.arr.filter(x=>now<x.D.cus.close+20*MIN); return PF.arr; }
function pfOpen(kind,id){ UI.pf={kind,id}; pfRender(true); }
function pfRender(open){
  const s=UI.pf; if(!s) return; let D=null, title='', acId=null, fno='';
  if(s.kind==='dep'){ const ac=S.fleet.find(a=>a.id===s.id); const leg=ac&&ac.flight&&ac.flight.legs[ac.flight.li]; if(!leg||!leg.pax){ if(open) toast('Ce vol n’est plus au départ.','info'); return; }
    D=pfData(ac,leg,flightManifest(ac,40)); acId=ac.id; fno=`${S.company.code}${flightNumber(ac)}`; title=`🛃 Départ ${fno} · ${D.A.city} → ${D.B.city}`; }
  else { const x=PF.arr.find(z=>z.D.key===s.id); if(!x){ if(open) toast('Ce vol n’est plus à l’arrivée.','info'); return; } D=x.D; fno=x.fno; title=`🛃 Arrivée ${fno} · ${D.B.city}`; }
  const body=`<div id="pfRoot" data-k="${esc(D.key)}">${pfHtml(D,s.kind==='dep'?'dep':'arr',acId,fno)}</div>`;
  const root=document.getElementById('pfRoot');
  if(open||!root) showModal(title,body,true); else root.outerHTML=body;
}
// carte dans l'écran Passagers
function pfCardHtml(){
  const dep=pfDepartures(), arr=pfArrivals(); if(!dep.length&&!arr.length) return `<div class="card"><b>🛃 Aérogare en direct</b><div class="small mut">Aucun de vos vols n’est à l’embarquement ou à l’arrivée en ce moment. Revenez quand un avion est à la porte : enregistrement, sûreté, police, porte, puis immigration, douane et bagages à l’arrivée.</div></div>`;
  return `<div class="card"><b>🛃 Aérogare en direct</b> <span class="small mut">— le parcours de vos passagers, minute par minute</span>
    ${dep.map(({a,st})=>{ const leg=a.flight.legs[a.flight.li]; return `<div class="row" style="gap:6px;margin:4px 0"><span class="grow">🛫 <b>${S.company.code}${flightNumber(a)}</b> ${esc(AP(leg.from).city)} → ${esc(AP(leg.to).city)} <small class="mut">${st.pushback?'repoussage':st.phase===1?'roulage':'à la porte'}</small></span><button class="btn sm" data-act="pfOpen" data-kind="dep" data-id="${a.id}">Suivre</button></div>`; }).join('')}
    ${arr.map(x=>`<div class="row" style="gap:6px;margin:4px 0"><span class="grow">🛬 <b>${esc(x.fno)}</b> ${esc(x.D.A.city)} → ${esc(x.D.B.city)} <small class="mut">arrivé à ${pfFmt(x.D.arr)}</small></span><button class="btn sm" data-act="pfOpen" data-kind="arr" data-id="${esc(x.D.key)}">Suivre</button></div>`).join('')}</div>`;
}
Object.assign(ACTIONS,{
  pfOpen:d=>pfOpen(d.kind,d.id),
  pfDecide:d=>{ let D=null; if(d.side==='dep'){ const ac=S.fleet.find(a=>a.flight&&a.flight.legs[a.flight.li]&&pfK(a,a.flight.legs[a.flight.li])===d.k); if(ac) D=pfData(ac,ac.flight.legs[ac.flight.li],flightManifest(ac,40)); } else { const x=PF.arr.find(z=>z.D.key===d.k); if(x) D=x.D; }
    if(!D) return; const inc=pfIncidents(D,d.side).find(x=>x.id===d.inc); if(inc) pfApply(D,inc,+d.c); pfRender(false); },
});
function pfHook(){ if(pfHook.done) return; pfHook.done=true;
  // arrivée : on garde les passagers du vol pour suivre immigration, bagages et douane
  if(typeof onFlightDone==='function'){ const _o=onFlightDone; onFlightDone=function(ac,leg,info){ try{ if(leg&&leg.pax&&ac.flight){ const nowR=performance.now(), snap=nowR-(PF.snapAt||0)>1500, key=pfK(ac,leg);   // fiche complète : au plus une toutes les 1,5 s (grosses flottes)
          if(!snap){ pfAuto({key,lite:pfLite(key,leg),B:AP(leg.to),A:AP(leg.from)}); return _o.apply(this,arguments); }
          PF.snapAt=nowR; const D=pfData(ac,leg,flightManifest(ac,14)), sh=S.time-D.arr;
          // horaires d'arrivée recalés sur l'arrivée réelle (retards compris)
          for(const o of [D.imm,D.bag,D.cus]) for(const f of ['open','close','first','last']) if(o[f]) o[f]+=sh;
          D.arr=S.time; PF.arr=PF.arr.filter(x=>x.D.key!==D.key); PF.arr.unshift({D,fno:`${S.company.code}${flightNumber(ac)}`}); if(PF.arr.length>8) PF.arr.length=8;
          pfAuto(D); } }catch(e){ console.warn('aérogare',e); } return _o.apply(this,arguments); }; }
  if(typeof pPax==='function'){ const _pp=pPax; pPax=function(){ const h=_pp.apply(this,arguments); try{ return pfCardHtml()+h; }catch(e){ return h; } }; }
  if(typeof manifestHtml==='function'){ const _mh=manifestHtml; manifestHtml=function(ac){ const h=_mh.apply(this,arguments); try{ const st=ac&&ac.flight&&flightState(ac); if(st&&st.phase<=1) return `<div class="btns"><button class="btn" data-act="pfOpen" data-kind="dep" data-id="${ac.id}">🛃 Aérogare en direct</button></div>`+h; }catch(e){} return h; }; }
  // mise à jour en direct de la fenêtre ouverte
  setInterval(()=>{ try{ if(document.getElementById('pfRoot')&&UI.pf) pfRender(false); }catch(e){} },1000);
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ pfHook(); }catch(e){ console.warn(e); } },0));
