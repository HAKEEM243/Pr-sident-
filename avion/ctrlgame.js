/* =========================================================
   Sky Empire — 🕵️ Poste de contrôle (mini-jeu)
   Vous êtes l'agent : 8 passagers d'un de vos vols se présentent.
   1. 🚪 Documents à la porte (c'est la compagnie qui les vérifie avant
      l'embarquement) : la personne devant vous ressemble-t-elle à la photo ?
      Passeport encore valide ? Nom et vol de la carte d'embarquement ?
      Visa quand il faut, carnet de vaccination fièvre jaune pour l'Afrique
      centrale et de l'Ouest ?
      Aussi : carte d'identité pour les vols intérieurs, tampons et bande
      lisible (MRZ), visa (type, numéro de passeport, dates), certificat de
      vaccination (date, centre), autorisation de sortie pour les mineurs,
      carte d'embarquement (date, destination, porte, zone), motif annoncé.
   2. 🧳 Rayons X du bagage cabine : couteau, grande bouteille, arme,
      munitions, marteau, pistolet électrique, feux d'artifice… → fouille.
   Grades (Stagiaire → Inspecteur en chef) : plus de passagers et des pièges
   plus subtils ; série de bonnes réponses 🔥 et chronomètre pour les bonus.
   Bonnes décisions : image +, amendes évitées. Erreurs : un passager mal
   documenté laissé partir = amende transporteur ; un passager en règle refusé
   = indemnité. Passagers et documents fictifs.
   ========================================================= */
'use strict';
const CG={s:null};
const CG_FACES=['🧑🏿','👩🏿','👨🏿','🧔🏿','👵🏿','👴🏿','🧑🏾','👩🏾','👨🏾','🧑🏽','👩🏽','👨🏽','🧑🏻','👩🏻','👨🏻','🧔🏻','👱🏻‍♀️','👩🏼‍🦱','🧑🏼‍🦰','👨🏾‍🦲'];
const CG_DEF={exp:'Document d’identité expiré',name:'Le nom sur la carte d’embarquement ne correspond pas au passeport',flight:'La carte d’embarquement est pour un autre vol',novisa:'Visa obligatoire absent',visaexp:'Visa expiré',yf:'Pas de carnet de vaccination fièvre jaune',photo:'Ce n’est pas la personne de la photo',
  visano:'Le visa a été délivré pour un autre numéro de passeport (faux visa ou passeport changé)',bpdate:'La carte d’embarquement est datée d’un autre jour',bpdest:'La carte d’embarquement est pour une autre destination',visatype:'Le motif annoncé ne correspond pas au type de visa',
  minor:'Mineur voyageant seul sans autorisation de sortie du territoire',damaged:'Passeport abîmé (page des données décollée) : document non valable',yfdate:'Vaccin fièvre jaune fait il y a moins de 10 jours : pas encore valable'};
const CG_BAD=[['knife','🔪 couteau'],['bottle','🧴 grande bouteille (plus de 100 ml)'],['gun','🔫 arme à feu'],['fire','🎆 feux d’artifice'],['scis','✂️ gros ciseaux'],['hammer','🔨 marteau'],['bullets','💥 munitions'],['taser','⚡ pistolet à impulsion électrique']];
// grades : plus vous montez, plus il y a de passagers et de pièges subtils
const CG_RANKS=[[0,'🎓 Stagiaire',8],[300,'👮 Agent',8],[800,'⭐ Agent confirmé',10],[1600,'🎖️ Chef de poste',10],[3000,'🦅 Superviseur',12],[5000,'👑 Inspecteur en chef',12]];
const cgLvl=()=>{ const t=S.cgTotal||0; let i=0; while(i<CG_RANKS.length-1&&t>=CG_RANKS[i+1][0]) i++; return i; };
const CG_VISA={business:'Affaires',tourism:'Tourisme',family:'Visite familiale',study:'Études',work:'Travail',medical:'Soins médicaux',pilgrim:'Tourisme',humanitarian:'Mission'};
const CG_SAY={business:['Je viens pour des réunions avec un client.','Un salon professionnel.','Je signe un contrat cette semaine.'],tourism:['Vacances !','Je viens visiter le pays.','Tourisme, une semaine.'],family:['Je rends visite à ma famille.','Le mariage de ma sœur.','Voir mes parents.'],study:['Je commence mes études à l’université.','Je suis étudiant, c’est la rentrée.'],work:['Je commence un nouveau travail.','Un chantier de six mois.'],medical:['Une opération à l’hôpital.','Des examens médicaux.'],pilgrim:['Un pèlerinage.','Une visite religieuse.'],humanitarian:['Une mission avec une ONG.','Une campagne de vaccination.']};
const CG_YFC=['Institut Pasteur','Centre de vaccinations internationales','Hôpital général','Service de santé aux frontières','Clinique du voyageur'];
const cgD=(d,m,y)=>`${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
function cgCases(ac){
  const man=flightManifest(ac,40); if(!man||!man.rows||!man.rows.length) return null; const leg=man.leg, A=AP(leg.from), B=AP(leg.to), intl=A.cc!==B.cc, lv=cgLvl(), N=CG_RANKS[lv][2];
  const now=new Date(S.time), Y=now.getUTCFullYear(), M=now.getUTCMonth()+1, D=now.getUTCDate(), r=pfRng('cg|'+ac.id+'|'+leg.dep+'|'+(CG.n=(CG.n||0)+1)), R=(a,b)=>a+Math.floor(r()*(b-a+1));
  const fno=`${S.company.code}${flightNumber(ac)}`, yfNeed=typeof PF_YF!=='undefined'&&PF_YF.has(B.cc)&&intl, today=cgD(D,M,Y);
  const gates=typeof apGates==='function'?apGates(leg.from):null, gi=typeof gateIdx==='function'?gateIdx(leg.from,ac,intl):0, gate=((gates&&gates[gi]&&gates[gi].t)||'T1').replace('T','')+String.fromCharCode(65+gi%6)+(gi+1);
  const rows=man.rows.slice().sort(()=>r()-0.5).slice(0,N);
  const prev=d=>{ const t=new Date(Date.UTC(Y,M-1,D)-d*86400000); return cgD(t.getUTCDate(),t.getUTCMonth()+1,t.getUTCFullYear()); };
  return {ac,fno,A,B,intl,leg,gate,today,lv,list:rows.map(x=>{
    const idCard=!intl&&x.nat===A.cc, needVisa=intl&&x.visa==='Visa obtenu', face=CG_FACES[R(0,CG_FACES.length-1)], ey=Y+R(1,7), em=R(1,12), ed=R(1,27), minor=x.age<18;
    const c={x,face,photo:face,idCard,needVisa,yfNeed,minor,passNo:x.passNo||((x.nat||'XX')+R(1000000,9999999)),passExp:cgD(ed,em,ey),issued:cgD(ed,em,ey-10),bpName:`${x.last.toUpperCase()}/${x.first.toUpperCase()}`,bpFlight:fno,bpDate:today,bpDest:B.code,
      zone:x.cls==='f'||x.cls==='j'?1:R(2,5),board:fmtTime(leg.dep+R(0,20)*MIN),purp:x.purp,say:(CG_SAY[x.purp]||CG_SAY.tourism)[R(0,1)],
      stamps:Array.from({length:R(1,4)},()=>{ const L=Object.keys(COUNTRIES); const k=L[R(0,L.length-1)]; return COUNTRIES[k][2]; }),
      visa:needVisa?{type:CG_VISA[x.purp]||'Tourisme',no:'V'+R(10000000,99999999),pass:null,from:prev(R(20,90)),until:cgD(R(1,27),R(1,12),Y+1),entries:r()<0.5?'1':'Multiples'}:null,
      yf:yfNeed?{date:prev(R(400,3600)),no:'YF-'+R(100000,999999),centre:CG_YFC[R(0,CG_YFC.length-1)]}:null,
      ast:minor&&intl?{parent:pfName(x.nat,r),until:cgD(R(1,27),R(1,12),Y+1)}:null,def:null};
    if(c.visa) c.visa.pass=c.passNo;
    const rate=0.38+lv*0.03;
    if(r()<rate){ const opts=['exp','name','flight','photo'].concat(lv>=1?['bpdate','damaged']:[]).concat(lv>=2?['bpdest']:[]).concat(needVisa?['novisa','visaexp'].concat(lv>=2?['visano','visatype']:[]):[]).concat(yfNeed?['yf'].concat(lv>=3?['yfdate']:[]):[]).concat(minor&&intl?['minor']:[]);
      const d=opts[R(0,opts.length-1)]; c.def=d;
      if(d==='exp') c.passExp=prev(R(3,200));
      if(d==='name'){ const L=x.last.toUpperCase(); const i=Math.max(1,Math.floor(L.length/2)); c.bpName=`${L.slice(0,i-1)}${L[i]||'E'}${L[i-1]}${L.slice(i+1)}/${x.first.toUpperCase()}`; if(c.bpName.split('/')[0]===L) c.bpName=L+'E/'+x.first.toUpperCase(); }
      if(d==='flight') c.bpFlight=`${S.company.code}${flightNumber(ac)+R(1,40)}`;
      if(d==='photo'){ let f; do{ f=CG_FACES[R(0,CG_FACES.length-1)]; }while(f===face); c.photo=f; }
      if(d==='novisa') c.visa=null;
      if(d==='visaexp') c.visa.until=prev(R(2,60));
      if(d==='visano') c.visa.pass=(x.nat||'XX')+R(1000000,9999999);
      if(d==='visatype'){ const o=Object.keys(CG_SAY).filter(k=>CG_VISA[k]!==c.visa.type); c.say=CG_SAY[o[R(0,o.length-1)]][0]; }
      if(d==='bpdate') c.bpDate=prev(R(1,3));
      if(d==='bpdest'){ const alt=AIRPORT_CODES.filter(k=>k!==B.code&&AP(k).cls>=3); c.bpDest=alt[R(0,alt.length-1)]||'NBO'; }
      if(d==='yf') c.yf=null;
      if(d==='yfdate') c.yf.date=prev(R(1,8));
      if(d==='minor') c.ast=null;
      if(d==='damaged') c.damaged=true; }
    // bagage cabine (objets autorisés variés)
    const ok=['clothes','clothes',r()<0.7?'laptop':'book','phone',r()<0.5?'cable':'shoes',r()<0.4?'bottleS':'keys',r()<0.3?'umbrella':r()<0.5?'power':'coins'];
    c.bad=r()<0.27+lv*0.02?CG_BAD[R(0,CG_BAD.length-1)]:null; if(c.bad) ok.push(c.bad[0]);
    c.items=ok; c.seed=R(1,1e9); return c; })};
}
// image rayons X (couleurs : orange = organique, bleu = métal, vert = mélange)
function cgXray(c){
  const cv=document.createElement('canvas'); cv.width=640; cv.height=380; const g=cv.getContext('2d'); let s=c.seed; const r=()=>((s=(s*16807)%2147483647)/2147483647);
  g.fillStyle='#0a0f1e'; g.fillRect(0,0,640,380); g.fillStyle='rgba(120,170,255,.08)'; g.fillRect(40,40,560,300); g.strokeStyle='rgba(120,180,255,.55)'; g.lineWidth=6; g.strokeRect(40,40,560,300);
  g.fillStyle='rgba(80,140,255,.5)'; g.fillRect(290,22,60,20); g.fillRect(60,60,8,260); g.fillRect(572,60,8,260);
  const O='rgba(255,150,40,', B='rgba(60,140,255,', Gr='rgba(70,220,140,';
  const at=()=>[90+r()*400,80+r()*200];
  for(const it of c.items){ const [x,y]=at(); g.save(); g.translate(x,y); g.rotate((r()-0.5)*1.2);
    if(it==='clothes'){ g.fillStyle=O+'.35)'; for(let k=0;k<5;k++){ g.beginPath(); g.ellipse(r()*90,r()*60,40+r()*30,22+r()*20,r()*3,0,7); g.fill(); } }
    else if(it==='laptop'){ g.fillStyle=Gr+'.55)'; g.fillRect(0,0,170,110); g.fillStyle=B+'.8)'; g.fillRect(10,85,150,14); g.fillRect(20,15,30,10); }
    else if(it==='book'){ g.fillStyle=O+'.6)'; g.fillRect(0,0,90,120); }
    else if(it==='phone'){ g.fillStyle=Gr+'.7)'; g.fillRect(0,0,34,68); g.fillStyle=B+'.9)'; g.fillRect(6,40,22,18); }
    else if(it==='cable'){ g.strokeStyle=B+'.8)'; g.lineWidth=4; g.beginPath(); for(let k=0;k<6;k++) g.arc(20,20,10+k*3,0,4); g.stroke(); g.fillStyle=Gr+'.7)'; g.fillRect(40,0,30,24); }
    else if(it==='shoes'){ g.fillStyle=O+'.55)'; g.beginPath(); g.ellipse(0,0,55,22,0,0,7); g.ellipse(20,40,55,22,0,0,7); g.fill(); g.fillStyle=B+'.6)'; g.fillRect(-40,-4,6,8); }
    else if(it==='bottleS'){ g.fillStyle=O+'.75)'; g.fillRect(0,10,18,40); g.fillRect(4,0,10,12); }
    else if(it==='keys'){ g.strokeStyle=B+'.95)'; g.lineWidth=5; g.beginPath(); g.arc(0,0,12,0,7); g.stroke(); g.fillStyle=B+'.95)'; g.fillRect(10,-3,34,6); g.fillRect(36,-3,4,10); }
    else if(it==='knife'){ g.fillStyle=B+'1)'; g.beginPath(); g.moveTo(0,0); g.lineTo(110,6); g.lineTo(110,16); g.lineTo(0,18); g.closePath(); g.fill(); g.fillStyle=O+'.8)'; g.fillRect(-55,2,55,16); }
    else if(it==='bottle'){ g.fillStyle=O+'.8)'; g.fillRect(0,26,60,150); g.fillRect(18,0,24,30); g.fillStyle=B+'.7)'; g.fillRect(16,-6,28,8); }
    else if(it==='gun'){ g.fillStyle=B+'1)'; g.fillRect(0,0,120,26); g.fillRect(0,0,28,78); g.fillRect(38,26,14,22); g.fillStyle=B+'.6)'; g.fillRect(118,6,14,14); }
    else if(it==='fire'){ for(let k=0;k<6;k++){ g.fillStyle=O+'.85)'; g.fillRect(k*16,0,12,70); g.fillStyle=Gr+'.9)'; g.fillRect(k*16+3,-10,6,12); } g.strokeStyle=B+'.8)'; g.lineWidth=2; g.beginPath(); g.moveTo(0,-10); g.bezierCurveTo(40,-50,70,-30,100,-12); g.stroke(); }
    else if(it==='scis'){ g.strokeStyle=B+'1)'; g.lineWidth=7; g.beginPath(); g.moveTo(0,0); g.lineTo(110,30); g.moveTo(0,40); g.lineTo(110,10); g.stroke(); g.lineWidth=5; g.beginPath(); g.arc(-12,-4,12,0,7); g.moveTo(0,44); g.arc(-12,44,12,0,7); g.stroke(); }
    else if(it==='umbrella'){ g.strokeStyle=B+'.9)'; g.lineWidth=4; g.beginPath(); g.moveTo(0,0); g.lineTo(160,0); g.stroke(); g.lineWidth=2; for(let k=0;k<7;k++){ g.beginPath(); g.moveTo(10,0); g.lineTo(150,-14+k*4.6); g.stroke(); } g.fillStyle=O+'.6)'; g.fillRect(-18,-6,20,12); }
    else if(it==='power'){ g.fillStyle=Gr+'.8)'; g.fillRect(0,0,70,40); g.fillStyle=B+'.8)'; g.fillRect(4,6,10,28); }
    else if(it==='coins'){ g.fillStyle=B+'.9)'; for(let k=0;k<7;k++){ g.beginPath(); g.arc(k*9,(k%2)*8,8,0,7); g.fill(); } }
    else if(it==='hammer'){ g.fillStyle=O+'.75)'; g.fillRect(0,-6,120,12); g.fillStyle=B+'1)'; g.fillRect(110,-22,26,44); }
    else if(it==='bullets'){ g.fillStyle=B+'1)'; for(let k=0;k<8;k++){ g.fillRect(k*12,0,8,26); g.beginPath(); g.arc(k*12+4,0,4,Math.PI,0); g.fill(); } }
    else if(it==='taser'){ g.fillStyle=Gr+'.8)'; g.fillRect(0,0,90,30); g.fillRect(0,0,24,60); g.fillStyle=B+'1)'; g.fillRect(84,8,16,4); g.fillRect(84,18,16,4); g.fillRect(30,6,20,16); }
    g.restore(); }
  // grain du scanner
  const im=g.getImageData(0,0,640,380), d=im.data; for(let i=0;i<d.length;i+=4){ const n=(r()-0.5)*18; d[i]+=n; d[i+1]+=n; d[i+2]+=n; } g.putImageData(im,0,0);
  return cv.toDataURL('image/jpeg',0.85);
}
function cgDocs(c,s){
  const x=c.x, nat=COUNTRIES[x.nat]||['—','','🏳️'], card='background:#f8fafc;color:#0f172a;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.4;box-shadow:0 2px 8px rgba(0,0,0,.35)', sx=x.F?'F':'M';
  const mrz=(`P<${x.nat||'XXX'}${x.last.toUpperCase().replace(/[^A-Z]/g,'')}<<${x.first.toUpperCase().replace(/[^A-Z]/g,'')}`+'<'.repeat(44)).slice(0,44), mrz2=(`${c.passNo}<${x.nat}${(x.dob||'').replace(/\D/g,'').slice(-2)}${sx}`+'<'.repeat(44)).slice(0,44);
  const doc=c.idCard?`<div style="${card};border-top:6px solid #0e7490"><div style="display:flex;justify-content:space-between"><b>CARTE D’IDENTITÉ · ${esc(nat[0]).toUpperCase()}</b><span>${nat[2]}</span></div>
      <div style="display:flex;gap:8px;margin-top:4px"><div style="font-size:40px;background:#e2e8f0;border-radius:6px;padding:2px 6px">${c.photo}</div><div>Nom <b>${esc(x.last.toUpperCase())}</b> · Prénom <b>${esc(x.first)}</b><br>Sexe <b>${sx}</b> · Né${x.F?'e':''} le <b>${esc(x.dob||'—')}</b><br>N° <b>${esc(c.passNo)}</b><br>Expire le <b style="color:#b91c1c">${c.passExp}</b></div></div></div>`
    :`<div style="${card};border-top:6px solid #1e3a8a;${c.damaged?'transform:rotate(-2deg);background:linear-gradient(135deg,#f8fafc 70%,#d6cfc4 70%);':''}"><div style="display:flex;justify-content:space-between"><b>PASSEPORT · ${esc(nat[0]).toUpperCase()}</b><span>${nat[2]}</span></div>
      <div style="display:flex;gap:8px;margin-top:4px"><div style="font-size:40px;background:#e2e8f0;border-radius:6px;padding:2px 6px;height:max-content">${c.photo}</div><div>Nom <b>${esc(x.last.toUpperCase())}</b><br>Prénom <b>${esc(x.first)}</b> · Sexe <b>${sx}</b><br>Nationalité <b>${esc(x.nat)}</b><br>Né${x.F?'e':''} le <b>${esc(x.dob||'—')}</b> à ${esc(x.born||x.home||'—')}<br>N° <b>${esc(c.passNo)}</b><br>Délivré le ${c.issued} · Expire le <b style="color:#b91c1c">${c.passExp}</b></div></div>
      ${c.damaged?'<div style="color:#b91c1c;font-weight:700;margin-top:4px">⚠️ page des données décollée et déchirée</div>':''}
      <div style="font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.5px;margin-top:4px;word-break:break-all;background:#eef2f7;padding:3px;border-radius:4px">${esc(mrz)}<br>${esc(mrz2)}</div>
      <div style="margin-top:3px">Tampons : ${c.stamps.map(f=>`<span style="display:inline-block;border:2px dashed #7c3aed;border-radius:50%;padding:1px 4px;margin:1px;opacity:.8">${f}</span>`).join('')}</div></div>`;
  const bars=Array.from({length:34},(_,i)=>`<i style="display:inline-block;width:${(i*7)%3+1}px;height:22px;background:#0f172a;margin-right:1px"></i>`).join('');
  const bp=`<div style="${card};border-left:6px solid #f59e0b"><div style="display:flex;justify-content:space-between"><b>🎫 CARTE D’EMBARQUEMENT</b><b>${esc(S.company.name)}</b></div>
    Passager <b>${esc(c.bpName)}</b><br>Vol <b>${esc(c.bpFlight)}</b> · le <b>${esc(c.bpDate)}</b><br>${esc(s.A.code)} → <b>${esc(c.bpDest)}</b> · Porte <b>${esc(s.gate)}</b> · Embarquement ${esc(c.board)} · Zone <b>${c.zone}</b><br>Siège <b>${esc(x.seat)}</b> · ${({f:'Première',j:'Affaires',w:'Premium',y:'Économique'})[x.cls]||''}<div style="margin-top:4px">${bars}</div></div>`;
  const v=c.visa, visa=s.intl?(c.needVisa||c.def==='novisa'?(v?`<div style="${card};border-left:6px solid #16a34a;background:linear-gradient(135deg,#ecfdf5,#f8fafc)"><div style="display:flex;justify-content:space-between"><b>🛂 VISA · ${esc(s.B.city.toUpperCase())}</b><span style="font-size:22px">${c.photo}</span></div>
      Type <b>${esc(v.type)}</b> · Entrées : ${v.entries}<br>N° visa ${esc(v.no)} · pour passeport n° <b>${esc(v.pass)}</b><br>Valable du ${v.from} au <b style="color:#b91c1c">${v.until}</b></div>`:`<div style="${card};opacity:.7"><b>🛂 Visa</b><br><i>aucun visa dans le passeport</i></div>`):`<div style="${card};opacity:.7"><b>🛂 Visa</b><br>pas de visa requis pour ce passeport</div>`):'';
  const yf=c.yfNeed?(c.yf?`<div style="${card};border-left:6px solid #eab308;background:#fefce8"><b>💉 CERTIFICAT INTERNATIONAL DE VACCINATION (OMS)</b><br>Fièvre jaune · vacciné(e) le <b>${c.yf.date}</b><br>N° ${esc(c.yf.no)} · ${esc(c.yf.centre)} <span style="border:2px solid #1d4ed8;color:#1d4ed8;border-radius:50%;padding:0 4px;font-size:10px">🩺 cachet</span><br><span class="small">Valable à vie, 10 jours après la vaccination</span></div>`:`<div style="${card};opacity:.7"><b>💉 Carnet de vaccination</b><br><i>non présenté</i></div>`):'';
  const ast=c.minor&&s.intl?(c.ast?`<div style="${card};border-left:6px solid #db2777"><b>👨‍👧 AUTORISATION DE SORTIE DU TERRITOIRE</b><br>Mineur(e) autorisé(e) à voyager seul(e) par <b>${esc(c.ast.parent)}</b> (parent) · jusqu’au ${c.ast.until}</div>`:`<div style="${card};opacity:.7"><b>👨‍👧 Autorisation parentale</b><br><i>non présentée</i></div>`):'';
  const q=s.intl?`<div style="${card};background:#e0f2fe"><b>🗣️ Vous :</b> « Quel est le motif de votre voyage ? »<br><b>${esc(x.first)} :</b> « ${esc(c.say)} »</div>`:'';
  return `<div style="display:grid;gap:8px">${doc}${bp}${visa}${yf}${ast}${q}</div>`;
}
function cgRender(){
  const s=CG.s; if(!s) return; const el=document.getElementById('cgRoot'); const c=s.list[s.i];
  let h=`<div class="small mut">Vol ${esc(s.fno)} · ${esc(s.A.city)} → ${esc(s.B.city)} · ${s.intl?'🌍 international':'🏠 intérieur'} · date du jour ${new Date(S.time).toLocaleDateString('fr-FR')}</div>
    <div class="row" style="justify-content:space-between;margin:6px 0"><b>Passager ${Math.min(s.i+1,s.list.length)} / ${s.list.length}</b><span>✅ ${s.ok} · ❌ ${s.ko} · ⭐ ${s.pts} pts${s.streak>=2?` · 🔥 ${s.streak}`:''}</span></div>
    <div class="small mut">Grade : <b>${CG_RANKS[s.lv][1]}</b> · Porte ${esc(s.gate)}</div>`;
  if(s.fb) h+=`<div class="card" style="margin:6px 0;border-left:5px solid ${s.fb.good?'#22c55e':'#ef4444'}">${s.fb.t}</div>`;
  const bar='position:sticky;bottom:0;background:var(--bg2,#0f172a);padding:8px 0;margin:0;z-index:2';
  if(s.i>=s.list.length){ h+=cgEnd(); }
  else if(s.step==='doc'){
    h+=`<style>@keyframes cgT{from{width:100%}to{width:0}}</style><div style="height:5px;background:rgba(148,163,184,.25);border-radius:3px;overflow:hidden;margin:4px 0"><div style="height:100%;background:#22c55e;animation:cgT 12s linear forwards"></div></div>
      <div class="card" style="text-align:center"><div style="font-size:64px;line-height:1">${c.face}</div><div class="small">Devant vous : <b>${esc(c.x.first)} ${esc(c.x.last)}</b>, ${c.x.age} ans${c.minor?' · voyage seul(e)':''}</div></div>${cgDocs(c,s)}
      <div class="small mut" style="margin:6px 0">Vérifiez : photo = personne ? document valide aujourd’hui (${s.today}) et en bon état ? nom, date, vol et destination de la carte ? ${s.intl?'visa : bon numéro de passeport, dates, type = motif annoncé ? ':''}${c.yfNeed?'vaccin fièvre jaune fait depuis plus de 10 jours ? ':''}${c.minor&&s.intl?'autorisation parentale ?':''}</div>
      <div class="btns" style="${bar}"><button class="btn" data-act="cgDoc" data-v="1">✅ Embarquer</button><button class="btn" data-act="cgDoc" data-v="0" style="background:#b91c1c">⛔ Refuser</button></div>`;
  } else if(s.step==='xray'){
    h+=`<div class="card"><b>🧳 Rayons X — bagage cabine de ${esc(c.x.first)}</b><img src="${cgXray(c)}" style="width:100%;border-radius:8px;margin-top:6px"><div class="small mut">Orange : matières organiques (vêtements, liquides) · bleu : métal · vert : mélange (électronique)</div></div>
      <div class="btns" style="${bar}"><button class="btn" data-act="cgBag" data-v="1">✅ Laisser passer</button><button class="btn" data-act="cgBag" data-v="0" style="background:#b45309">🔍 Fouiller</button></div>`;
  }
  if(el){ el.innerHTML=h; const sc=el.closest('.mbody'); if(sc) sc.scrollTop=0; } else showModal('🕵️ Poste de contrôle',`<div id="cgRoot">${h}</div>`,true);
}
function cgEnd(){
  const s=CG.s; if(!s.paid){ s.paid=true; const money=s.money; if(money) book(money>0?'annexes':'incidents',money); S.reputation=clamp((S.reputation||50)+s.rep,0,100);
    const lv0=cgLvl(); S.cgTotal=(S.cgTotal||0)+s.pts; const lv1=cgLvl(); s.promo=lv1>lv0?CG_RANKS[lv1][1]:null;
    S.cgBest=Math.max(S.cgBest||0,s.pts); logMsg(`🕵️ Poste de contrôle ${s.fno} : ${s.ok} bonnes décisions, ${s.ko} erreurs (${s.pts} pts).`,'info'); try{ save(); }catch(e){} }
  const grade=s.ko===0?'🏆 Agent parfait !':s.ko<=2?'👍 Bon travail':'😬 À revoir';
  return `<div class="card" style="text-align:center"><div style="font-size:42px">${grade.split(' ')[0]}</div><b>${grade.slice(grade.indexOf(' ')+1)}</b><br>${s.ok} bonnes décisions · ${s.ko} erreurs · <b>${s.pts} points</b> (record : ${S.cgBest||s.pts})
    <div class="small" style="margin-top:6px">${s.log.map(t=>'• '+t).join('<br>')}</div><div class="small" style="margin-top:6px">Bilan : ${s.money>=0?'+':''}${fmtMoney(s.money)} · image ${s.rep>=0?'+':''}${s.rep.toFixed(2)}</div>
    ${s.promo?`<div style="font-size:18px;margin-top:8px">🎉 Promotion : <b>${s.promo}</b> !<br><span class="small">Plus de passagers et des pièges plus subtils vous attendent.</span></div>`:''}
    ${(()=>{ const lv=cgLvl(), nx=CG_RANKS[lv+1]; return `<div class="small" style="margin-top:6px">Grade : <b>${CG_RANKS[lv][1]}</b> · ${S.cgTotal} pts au total${nx?` · prochain grade ${nx[1]} à ${nx[0]} pts`:''}</div>`; })()}</div>
    <div class="btns"><button class="btn" data-act="cgStart">🔁 Un autre vol</button><button class="btn" data-act="closeModal">Fermer</button></div>`;
}
function cgStart(acId){
  const fl=S.fleet.filter(a=>a.status==='flight'&&a.flight&&a.flight.legs[a.flight.li]&&a.flight.legs[a.flight.li].pax);
  const pref=acId&&fl.find(a=>a.id===acId), dep=typeof pfDepartures==='function'?pfDepartures().map(x=>x.a):[];
  const ac=pref||dep[Math.floor(Math.random()*dep.length)]||fl.find(a=>{ const l=a.flight.legs[a.flight.li]; return AP(l.from).cc!==AP(l.to).cc; })||fl[Math.floor(Math.random()*fl.length)];
  if(!ac){ toast('Aucun vol avec des passagers en ce moment : envoyez un avion sur une ligne.','info'); return; }
  const k=cgCases(ac); if(!k){ toast('Pas de passagers sur ce vol (cargo).','info'); return; }
  CG.s={...k,i:0,step:'doc',ok:0,ko:0,pts:0,money:0,rep:0,log:[],fb:null,streak:0,t0:performance.now()}; cgRender();
}
const cgGood=(s,t,pts,rep)=>{ s.ok++; s.streak=(s.streak||0)+1; const bonus=Math.min(10,2*(s.streak-1)); s.pts+=pts+bonus; s.rep+=rep; s.fb={good:true,t:t+(bonus?` <b>🔥 série ×${s.streak} : +${bonus}</b>`:'')}; };
const cgBad=(s,t,money,rep,logt)=>{ s.ko++; s.streak=0; s.money+=money; s.rep+=rep; s.fb={good:false,t}; s.log.push(logt); };
Object.assign(ACTIONS,{
  cgStart:d=>cgStart(d&&d.id),
  cgDoc:d=>{ const s=CG.s; if(!s) return; const c=s.list[s.i], board=d.v==='1', fast=performance.now()-s.t0<12000;
    if(c.def&&!board){ cgGood(s,`✅ Bien vu ! ${CG_DEF[c.def]}. Refusé à l’embarquement : vous évitez une amende transporteur.`,fast?15:10,0.06); s.i++; s.step='doc'; }
    else if(c.def&&board){ cgBad(s,`❌ Raté : ${CG_DEF[c.def]}. Il sera refoulé à l’arrivée → amende transporteur et billet retour (−3 500 $).`,-3500,-0.12,`${c.x.first} ${c.x.last} : ${CG_DEF[c.def]} (laissé passer)`); s.i++; s.step='doc'; }
    else if(!c.def&&!board){ cgBad(s,`❌ Ce passager était en règle : refus abusif, indemnité de 600 $ et plainte.`,-600,-0.1,`${c.x.first} ${c.x.last} : refusé à tort`); s.i++; s.step='doc'; }
    else { cgGood(s,`✅ Documents en règle. Passage aux rayons X du bagage cabine…`,fast?10:6,0.02); s.step='xray'; }
    s.t0=performance.now(); cgRender(); },
  cgBag:d=>{ const s=CG.s; if(!s) return; const c=s.list[s.i], pass=d.v==='1';
    if(c.bad&&!pass) cgGood(s,`✅ Fouille : ${c.bad[1]} → retiré du sac et confisqué par la sûreté.`,12,0.05);
    else if(c.bad&&pass) cgBad(s,`❌ Il y avait ${c.bad[1]} dans le sac ! Découvert à bord par l’équipage : incident de sûreté (−2 000 $).`,-2000,-0.2,`${c.x.first} ${c.x.last} : ${c.bad[1]} non vu`);
    else if(!c.bad&&!pass) cgBad(s,`❌ Fouille pour rien : rien d’interdit. Le passager a perdu 10 minutes, il râle.`,0,-0.03,`${c.x.first} ${c.x.last} : fouille inutile`);
    else cgGood(s,`✅ Rien d’interdit : bon voyage !`,8,0.02);
    s.i++; s.step='doc'; s.t0=performance.now(); cgRender(); },
});
function cgHook(){ if(cgHook.done) return; cgHook.done=true;
  // boutons : carte Aérogare (onglet Passagers) et fenêtre de départ d'un vol
  if(typeof pfCardHtml==='function'){ const _c=pfCardHtml; pfCardHtml=function(){ const h=_c.apply(this,arguments); return h+`<div class="card"><b>🕵️ Poste de contrôle</b> <span class="small mut">— jouez l’agent : documents à la porte puis rayons X · grade ${CG_RANKS[cgLvl()][1]}${S.cgBest?' · record '+S.cgBest+' pts':''}</span><div class="btns"><button class="btn" data-act="cgStart">🎮 Jouer</button></div></div>`; }; }
  if(typeof pfHtml==='function'){ const _h=pfHtml; pfHtml=function(D,side,acId){ const h=_h.apply(this,arguments); return side==='dep'&&acId?`<div class="btns"><button class="btn sm" data-act="cgStart" data-id="${acId}">🕵️ Jouer l’agent de porte sur ce vol</button></div>`+h:h; }; }
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ cgHook(); }catch(e){ console.warn(e); } },0));
