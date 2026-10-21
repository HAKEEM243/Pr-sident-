/* =========================================================
   Sky Empire — 🛂 contrôle des passagers EN DIRECT
   En haut de l'écran « Contrôle des passagers », pour le pays choisi :
   • arrivées depuis minuit (heure locale) : le compteur monte minute
     par minute, au rythme de la journée (pointes le matin et le soir) ;
   • dernière heure, file au contrôle, attente, refoulés du jour ;
   • tableau des dernières arrivées : compagnie, provenance, passagers,
     temps au contrôle, refus — vos vrais vols (⭐) et ceux des autres.
   Les arrivées des autres compagnies sont simulées à partir des parts
   de marché et des provenances estimées du pays (données fictives).
   ========================================================= */
'use strict';
const PL={mine:[]};
const plH=(...a)=>{ let h=17; for(const c of a.join('|')) h=(h*131+c.charCodeAt(0))%1000003; h^=h>>>16; h=Math.imul(h,0x7feb352d); h^=h>>>15; h=Math.imul(h,0x846ca68b); h^=h>>>16; return (h>>>0)%1000003; };   // bien mélangé : deux minutes voisines donnent des vols différents
// rythme horaire des arrivées (heure locale), normalisé sur 24 h
const PL_CURVE=(()=>{ const c=[]; for(let h=0;h<24;h++) c.push(0.25+0.9*Math.exp(-((h-8)**2)/7)+0.85*Math.exp(-((h-18.5)**2)/8)+0.45*Math.exp(-((h-13)**2)/10)+(h<5?-0.1:0)); const s=c.reduce((a,b)=>a+b,0); return c.map(v=>v/s); })();
const plRate=h=>{ const i=Math.floor(h)%24, u=h-Math.floor(h); return PL_CURVE[i]*(1-u)+PL_CURVE[(i+1)%24]*u; };   // part de la journée par heure
function plFrac(h){ let f=0; for(let i=0;i<Math.floor(h);i++) f+=PL_CURVE[i]; return f+PL_CURVE[Math.floor(h)%24]*(h-Math.floor(h)); }
function plTz(cc){ const a=(typeof cAirports==='function'?cAirports(cc):[])[0], A=a&&AP(a); return A?((A.utc!==undefined&&A.utc!==null&&A.utc!=='')?+A.utc:A.lon/15):0; }
function plPick(list,r){ let t=0; for(const x of list) t+=x.share; let v=r*t; for(const x of list){ v-=x.share; if(v<=0) return x; } return list[list.length-1]; }
// refus d'entrée sur UN vol : même calcul pour vos vols et ceux des autres compagnies
// (plus fréquents quand on arrive d'un pays plus pauvre ; tirage aléatoire mais stable pour un même vol)
const PL_WHY=[['🛂 Visa absent ou expiré',30],['📕 Passeport invalide ou abîmé',16],['🧾 Motif du séjour non justifié',14],['💵 Pas assez d’argent pour le séjour',9],['🎫 Pas de billet retour',8],['🕵️ Faux documents',7],['🚫 Interdit de territoire',5],['💉 Carnet de vaccination (fièvre jaune)',11]];
function plRate2(from,to){ const inc=c=>typeof incomeOf==='function'?incomeOf(c):1, md=typeof moodOf==='function'&&moodOf(to)?moodOf(to).tension||0:0;
  return clamp((0.004+Math.max(0,inc(to)-inc(from))*0.012)*(1+md*2),0.002,0.08); }
function plRefN(pax,from,to,seed){ const lam=pax*plRate2(from,to); let u=((seed*9301+49297)%233280)/233280, p=Math.exp(-lam), c=p, k=0; while(u>c&&k<40){ k++; p*=lam/k; c+=p; } return k; }
function plWhy(seed,cc){ const L=PL_WHY.filter(w=>!(w[0].includes('fièvre')&&!(COUNTRIES[cc]&&COUNTRIES[cc][1]==='AF'))); let t=L.reduce((a,b)=>a+b[1],0), v=(seed%1000)/1000*t; for(const w of L){ v-=w[1]; if(v<=0) return w[0]; } return L[0][0]; }
const plCity=cc=>{ const a=(typeof cAirports==='function'?cAirports(cc):[])[0]; return a&&AP(a)?AP(a).city:(COUNTRIES[cc]?COUNTRIES[cc][0]:cc); };
function plLiveHtml(cc,im){
  if(!im) return '';
  // volume réaliste : la moitié du trafic annuel des aéroports du pays arrive de l'étranger ou d'autres villes (même base que « Qui vient et pourquoi »)
  const perDay=Math.max(40,(typeof countryTraffic==='function'?countryTraffic(cc):1)*1e6*0.5*(typeof wdF==='function'?wdF(cc):1)/365);
  const t=S.time, tz=plTz(cc), loc=t/HOUR+tz, h=((loc%24)+24)%24, day0=t-h*HOUR, wob=1+Math.sin(t/(7*MIN)+plH(cc)%7)*0.03;
  const today=Math.round(perDay*plFrac(h)*wob), lastH=Math.round(perDay*plRate(h)*wob), queue=Math.round(perDay*plRate(h)*25/60);
  const busy=plRate(h)/Math.max(...PL_CURVE), wait=Math.round(6+busy*28*(im.income<=1?1.4:1)+Math.sin(t/(13*MIN))*2), ref=Math.round(today*im.refusal);
  const kp=(l,v,s)=>`<div class="kpi"><div class="kl">${l}</div><div class="kv">${v}</div>${s?`<div class="small mut">${s}</div>`:''}</div>`;
  // dernières arrivées : vos vols réels + vols simulés des autres compagnies (stables d'une seconde à l'autre)
  const fpd=Math.max(4,perDay/170), gap=Math.max(2,Math.round(1440/fpd)), al=(im.airlines||[]).filter(a=>!a.none&&!a.me&&a.share>0), org=(im.orig||[]).filter(o=>COUNTRIES[o.cc]);
  const rows=[]; const m0=Math.floor(t/MIN/gap)*gap;
  if(al.length&&org.length) for(let k=0;k<10;k++){ const m=m0-k*gap, r=plH(cc,m), at=m*MIN; const lh=(((at/HOUR+tz)%24)+24)%24; if(plRate(lh)<0.018&&r%3) continue;
    const a=plPick(al,(r%1000)/1000), o=plPick(org,((r>>10)%1000)/1000), pax=60+(r%240), w=Math.max(3,Math.round(wait*(0.6+((r>>5)%80)/100))), refu=plRefN(pax,o.cc,cc,r);
    rows.push({at,name:a.name,code:a.code,color:a.color,from:o.cc,city:plCity(o.cc),fn:(a.code||'XX')+(100+(r>>3)%800),pax,w,refu,why:refu?plWhy(r>>4,cc):'',me:false}); }
  for(const x of PL.mine) if(x.cc===cc&&x.at>t-6*HOUR&&x.at<=t){ const sd=plH(x.reg||'',Math.round(x.at/MIN)), refu=plRefN(x.pax,x.from,cc,sd); rows.push({...x,w:Math.max(3,Math.round(wait*0.8)),refu,why:refu?plWhy(sd>>4,cc):'',me:true}); }
  rows.sort((a,b)=>b.at-a.at);
  const hhmm=x=>{ const m=((Math.round((x/MIN)+tz*60)%1440)+1440)%1440; return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); };
  const feed=rows.slice(0,10).map(x=>`<div style="padding:5px 0;border-bottom:1px solid #ffffff12"><div class="pbar-row" style="gap:6px;align-items:center"><span class="mut small" style="min-width:42px">${hhmm(x.at)}</span><span class="dot" style="background:${x.color||'#ffd60a'}"></span><span class="grow small">${x.me?'⭐ ':''}<b>${esc(x.name)}</b> ${x.fn?`<span class="mut">${esc(x.fn)}</span>`:x.reg?`<span class="mut">${esc(x.reg)}</span>`:''} · de ${COUNTRIES[x.from]?COUNTRIES[x.from][2]:''} ${esc(x.city||'')}</span><span class="small"><b>${x.pax}</b> pax · ${x.w} min</span></div>
    <div class="small" style="padding-left:48px">${x.refu?`<span class="neg">⛔ ${x.refu} refusé${x.refu>1?'s':''}</span> <span class="mut">· ${esc(x.why)}${x.refu>1?' et autres':''}</span>`:'<span class="mut">✅ tous admis</span>'}</div></div>`).join('');
  // bilan de la journée par compagnie (vos vols réels ; les autres estimés d'après leurs parts)
  const dayMine=PL.mine.filter(x=>x.cc===cc&&x.at>=day0&&x.at<=t), myPax=dayMine.reduce((s0,x)=>s0+x.pax,0), myRef=dayMine.reduce((s0,x)=>s0+plRefN(x.pax,x.from,cc,plH(x.reg||'',Math.round(x.at/MIN))),0);
  const others=al.slice(0,7).map(a=>{ const pax=Math.round(today*a.share), fl=Math.round(pax/165), sd=plH(cc,a.code||a.name,Math.floor(t/HOUR)); return {name:a.name,color:a.color,pax,fl,ref:pax?Math.max(0,Math.round(pax*im.refusal*(0.7+((sd%60)/100)))):0}; }).filter(x=>x.fl>0);
  const tab=[...(dayMine.length?[{name:'⭐ '+S.company.name,color:S.company.color,pax:myPax,fl:dayMine.length,ref:myRef}]:[]),...others].sort((a,b)=>b.pax-a.pax);
  const byAir=tab.length?`<table class="tbl small"><tr><th>Compagnie</th><th>Vols</th><th>Passagers</th><th>Refusés</th><th>Taux</th></tr>${tab.map(x=>`<tr><td><span class="dot" style="background:${x.color}"></span>${esc(x.name)}</td><td>${num(x.fl)}</td><td>${num(x.pax)}</td><td class="${x.ref?'neg':''}">${num(x.ref)}</td><td>${x.pax?(x.ref/x.pax*100).toFixed(2).replace('.',','):'0'} %</td></tr>`).join('')}</table>`:'';
  const refAll=tab.reduce((s0,x)=>s0+x.ref,0)||ref, W=PL_WHY.filter(w=>!(w[0].includes('fièvre')&&!(COUNTRIES[cc]&&COUNTRIES[cc][1]==='AF'))), wt=W.reduce((a,b)=>a+b[1],0);
  const whyBars=W.map(([l,w])=>[l,Math.round(refAll*w/wt)]).filter(x=>x[1]>0).map(([l,n])=>`<div class="pbar-row"><span class="pl">${l}</span><span class="pb"><i style="width:${Math.max(2,Math.round(n/Math.max(1,refAll)*100))}%;background:#f87171"></i></span><b>${num(n)}</b></div>`).join('');
  const nat=(im.nat||[]).filter(x=>COUNTRIES[x.cc]).slice(0,4).map(x=>`${COUNTRIES[x.cc][2]} ${esc(COUNTRIES[x.cc][0])} ${Math.round(x.share*100)} %`).join(' · ');
  const fouil=Math.round(today*0.085), saisies=Math.round(today*0.0016), taxes=Math.round(today*0.11*38);
  return `<section class="card" style="border-color:#f87171"><div class="row" style="justify-content:space-between"><b><span style="color:#f87171">●</span> En direct au contrôle</b><span class="small mut">${hhmm(t)} heure locale · ${fmtDate(t)}</span></div>
  <div class="kpis">
    ${kp('Arrivés depuis minuit',num(today),`≈ ${num(Math.round(perDay))} prévus aujourd’hui`)}
    ${kp('Dernière heure',num(lastH),busy>0.75?'🔴 heure de pointe':busy>0.45?'🟠 trafic soutenu':'🟢 calme')}
    ${kp('Dans la file au contrôle',num(queue),`attente ≈ <b>${wait} min</b>`)}
    ${kp('Refoulés aujourd’hui',num(ref),`${(im.refusal*100).toFixed(1).replace('.',',')} % des arrivées`)}
  </div>
  ${nat?`<div class="small" style="margin:4px 0">👥 Dans la file en ce moment : ${nat}</div>`:''}
  <div class="small mut" style="margin:6px 0 2px">Dernières arrivées (toutes les compagnies)</div>${feed||'<div class="mut small">Aucune arrivée récente.</div>'}
  ${byAir?`<h4 style="margin:10px 0 4px">🧾 Bilan du jour par compagnie</h4>${byAir}`:''}
  ${whyBars?`<h4 style="margin:10px 0 4px">⛔ Pourquoi les passagers sont refusés aujourd’hui</h4>${whyBars}`:''}
  <h4 style="margin:10px 0 4px">🧳 Douane aujourd’hui</h4><div class="small">🔍 ${num(fouil)} bagages fouillés · 🚨 ${num(saisies)} saisies (contrefaçons, argent non déclaré, produits interdits) · 💰 ${fmtMoney(taxes)} de droits et amendes</div>
  <div class="small mut" style="margin-top:4px">⭐ = vos vols (réels). Les vols des autres compagnies sont simulés d’après leurs parts de marché et les provenances estimées. Le même calcul de refus s’applique à toutes les compagnies.</div></section>`;
}
function plHook(){ if(plHook.done||typeof pPax!=='function') return; plHook.done=true;
  if(typeof completeLeg==='function'){ const _cl=completeLeg; completeLeg=function(ac){ try{ const fl=ac.flight, l=fl&&fl.legs[fl.li], p=l&&l.pax; if(p&&!ac.ownerCode&&AP(l.to)){ const n=(p.f||0)+(p.j||0)+(p.w||0)+(p.y||0); if(n){ PL.mine.push({at:S.time,cc:AP(l.to).cc,pax:n,name:S.company.name,color:S.company.color,from:AP(l.from).cc,city:AP(l.from).city,fn:S.company.code+(typeof flightNumber==='function'?flightNumber(ac):''),reg:ac.reg}); if(PL.mine.length>300) PL.mine.splice(0,PL.mine.length-300); } } }catch(e){} return _cl.apply(this,arguments); }; }
  const _pp=pPax; pPax=function(){ const h=_pp.apply(this,arguments); const cc=UI.paxCountry||homeCC(); let im=null; try{ im=countryImmigration(cc); }catch(e){} if(!im) return h;
    const live=plLiveHtml(cc,im); const i=h.indexOf('<h2>'); return i>=0?h.slice(0,i)+live+h.slice(i):h+live; };
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ plHook(); }catch(e){ console.warn(e); } },0));
