/* =========================================================
   Sky Empire — 🌍 qui vient dans chaque pays, et pourquoi
   Pour chaque nationalité qui arrive dans un pays : nombre estimé de
   voyageurs par an, motifs (affaires, famille, tourisme, études,
   travail, soins, religion, humanitaire) et une explication concrète
   (mines, diaspora, commerce frontalier, pèlerinage…).
   Estimations du jeu, inspirées de liens réels entre pays.
   ========================================================= */
'use strict';
// ce qui attire dans un pays
const NW_DEST={
  CD:{mines:'cuivre et cobalt du Katanga, or et coltan de l’Est',tour:'gorilles des Virunga, fleuve Congo, chutes',hum:1},
  CG:{oil:'pétrole de Pointe-Noire',tour:'parcs d’Odzala, Brazzaville'},AO:{oil:'pétrole et diamants',tour:'Luanda, plages'},
  ZM:{mines:'cuivre de la Copperbelt',tour:'chutes Victoria'},ZA:{mines:'or, platine, sièges des multinationales',tour:'Le Cap, safaris',med:1,study:1},
  NG:{oil:'pétrole du delta du Niger, Lagos la capitale des affaires',tour:'Lagos, Nollywood'},GA:{oil:'pétrole et bois'},CM:{tour:'Kribi, monts'},
  KE:{tour:'safaris du Masaï Mara, plages de Mombasa',biz:'Nairobi, siège régional des ONU et ONG'},TZ:{tour:'Kilimandjaro, Zanzibar, Serengeti',biz:'port de Dar es Salaam'},
  RW:{tour:'gorilles, Kigali',biz:'commerce avec Goma'},UG:{tour:'gorilles, source du Nil'},ET:{biz:'Addis-Abeba, siège de l’Union africaine',tour:'Lalibela'},
  EG:{tour:'pyramides, Nil, mer Rouge',study:1,med:1},MA:{tour:'Marrakech, désert',study:1},SN:{tour:'Dakar, plages'},CI:{biz:'cacao, port d’Abidjan'},
  SA:{relig:'La Mecque et Médine (hajj, omra)',oil:'pétrole',work:1},AE:{biz:'Dubaï, plaque tournante du commerce',tour:'Dubaï, shopping',work:1,hub:1},QA:{hub:1,work:1,biz:'gaz'},
  TR:{tour:'Istanbul, côtes',med:1,biz:'textile et BTP'},FR:{tour:'Paris, Côte d’Azur',study:1,med:1,biz:'affaires et institutions'},BE:{study:1,med:1,biz:'Bruxelles, institutions européennes'},
  GB:{study:1,biz:'la City de Londres',tour:'Londres'},US:{study:1,biz:'affaires',tour:'New York, Floride'},CA:{study:1,work:1},CN:{biz:'usines et marchés de gros (Canton, Yiwu)',study:1},
  IN:{med:1,biz:'pharmacie et informatique',study:1},DE:{study:1,biz:'industrie',med:1},IT:{tour:'Rome, Venise'},ES:{tour:'plages, Barcelone'},TH:{tour:'plages, Bangkok'},
  JP:{tour:'Tokyo, Kyoto',biz:'technologie'},IL:{relig:'Jérusalem, lieux saints'},VA:{relig:'Rome, le Vatican'},BR:{tour:'Rio'},
};
// liens particuliers « nationalité > pays »
const NW_LINK={
  'CN>CD':['business',3,'mines de cuivre et de cobalt au Katanga, chantiers de routes et d’immeubles'],'IN>CD':['business',2,'commerce, pharmacies, télécoms'],
  'LB>CD':['business',3,'commerce et import-export (famille installée depuis longtemps)'],'BE>CD':['family',1.8,'liens historiques, familles belgo-congolaises, affaires, coopération'],
  'FR>CD':['business',1.6,'affaires, ambassade, familles franco-congolaises'],'ZA>CD':['business',2.2,'mines et supermarchés'],'US>CD':['humanitarian',2,'ONG, agences de l’ONU, ambassade, mines'],
  'RW>CD':['business',2.5,'commerce transfrontalier avec Goma et Bukavu'],'UG>CD':['business',2,'commerce par l’Est (Beni, Bunia)'],'BI>CD':['business',2,'commerce avec Uvira et Bukavu'],
  'AO>CD':['family',2,'familles des deux côtés de la frontière, commerce'],'CG>CD':['family',2.5,'Brazzaville en face de Kinshasa : familles, commerce, fêtes'],
  'TZ>CD':['business',2,'marchandises du port de Dar es Salaam'],'ZM>CD':['business',2.5,'cuivre de la Copperbelt, commerce avec Lubumbashi'],'TR>CD':['business',2,'BTP et commerce'],
  'CD>BE':['family',2.5,'grande diaspora congolaise à Bruxelles (Matongé), études'],'CD>FR':['family',2.2,'diaspora congolaise, études, santé'],'CD>ZA':['work',2,'travail et études à Johannesburg'],
  'CD>AE':['business',3,'achats à Dubaï pour revendre à Kinshasa'],'CD>CN':['business',3,'achats de marchandises à Canton et Yiwu'],'CD>IN':['medical',4,'soins médicaux à Delhi et Chennai'],
  'CD>TR':['business',2,'commerce, soins et études à Istanbul'],'CD>CG':['family',3,'familles et commerce de l’autre côté du fleuve'],'CD>KE':['business',2,'affaires à Nairobi'],
  'CD>SA':['pilgrim',3,'pèlerinage des musulmans congolais'],'CD>IL':['pilgrim',4,'pèlerinage chrétien en Terre sainte'],'CD>US':['family',1.8,'diaspora, études, visites'],
  'CD>CA':['study',2,'études et immigration au Québec'],'CD>RW':['business',2,'commerce entre Goma et Gisenyi'],'CD>UG':['business',2,'commerce avec Kampala'],
};
const NW_PURP={business:'💼 Affaires',tourism:'🏖️ Tourisme',family:'👪 Famille et amis',study:'🎓 Études',work:'🛠️ Travail',medical:'🏥 Soins',pilgrim:'🕌 Religion',humanitarian:'🤝 Humanitaire'};
function nwKm(a,b){ const x=typeof mainAirport==='function'?mainAirport(a):null, y=typeof mainAirport==='function'?mainAirport(b):null; return x&&y?dist(x,y):3000; }
// les motifs d'une nationalité pour un pays, avec une explication
function natWhy(n,cc){
  const lv=c=>typeof incomeOf==='function'?incomeOf(c):1, F=NW_DEST[cc]||{}, link=NW_LINK[n+'>'+cc];
  if(n===cc) return {mix:{family:0.55,business:0.2,tourism:0.1,work:0.08,study:0.04,medical:0.03},why:`ils rentrent chez eux : famille, vacances, fin d’études ou de mission à l’étranger`};
  const m={...purposeMix('mid',lv(n),lv(cc),nwKm(n,cc),n,cc)};
  if(F.mines||F.oil) m.business*=1.6; if(F.tour) m.tourism*=1.3; if(F.study) m.study*=1.6; if(F.med) m.medical*=1.8; if(F.relig) m.pilgrim*=F.relig&&cc==='SA'?3:2; if(F.work) m.work*=1.8; if(F.hum) m.humanitarian*=1.5;
  const dia=typeof DIASPORA!=='undefined'&&((DIASPORA[cc]||[]).includes(n)||(DIASPORA[n]||[]).includes(cc)); if(dia) m.family*=1.8;
  if(link) m[link[0]]*=link[1];
  const s=Object.values(m).reduce((a,b)=>a+b,0); for(const k in m) m[k]/=s;
  const top=Object.entries(m).sort((a,b)=>b[1]-a[1])[0][0];
  const txt=link?link[2]:{business:F.mines?`affaires dans les mines (${F.mines})`:F.oil?`affaires dans le pétrole (${F.oil})`:F.biz?`affaires (${F.biz})`:'commerce et affaires',
    tourism:F.tour?`tourisme : ${F.tour}`:'découvrir le pays',family:dia?'diaspora et familles installées des deux côtés':'rendre visite à la famille et aux amis',
    study:'études dans les universités et grandes écoles',work:F.work?'emplois sur place (chantiers, services)':'travail et contrats sur place',medical:'soins dans des hôpitaux spécialisés',
    pilgrim:F.relig?`pèlerinage : ${F.relig}`:'voyages religieux',humanitarian:'ONG, agences de l’ONU, missions médicales'}[top];
  return {mix:m,why:txt};
}
function natWhyHtml(cc,im){
  if(!im||!im.nat) return ''; const arr=Math.max(1000,(typeof countryTraffic==='function'?countryTraffic(cc):1)*1e6*0.5*(typeof wdF==='function'?wdF(cc):1));   // arrivées par an ≈ moitié du trafic des aéroports du pays
  const rows=im.nat.filter(x=>x.cc!=='??'&&COUNTRIES[x.cc]).slice(0,12), C=COUNTRIES[cc];
  return `<h3>🌍 Qui vient ${cc==='CD'?'au Congo':'en '+esc(C[0])} et pourquoi ?</h3><div class="small mut">Estimations du jeu : ≈ ${arr>=1e6?(arr/1e6).toFixed(1).replace('.',',')+' millions':num(Math.round(arr/1000)*1000)} d’arrivées par avion par an, réparties par nationalité, avec leurs raisons principales.</div>
  ${rows.map(x=>{ const W=natWhy(x.cc,cc), top=Object.entries(W.mix).sort((a,b)=>b[1]-a[1]).slice(0,3), yr=arr*x.share;
    return `<div class="card small"><div class="row" style="justify-content:space-between;gap:6px"><b>${natName(x.cc)}${x.cc===cc?' <span class="mut">(retour au pays)</span>':''}</b><span><b>${Math.round(x.share*100)} %</b> · ≈ ${yr>=1e6?(yr/1e6).toFixed(1).replace('.',',')+' M':num(Math.round(yr/100)*100)} / an</span></div>
      <div class="pbar-row"><span class="pb"><i style="width:${Math.min(100,x.share*200)}%"></i></span></div>
      <div>${top.map(([k,v])=>`<span class="chip" style="padding:1px 7px">${NW_PURP[k]} ${Math.round(v*100)} %</span>`).join(' ')}</div>
      <div class="mut">➜ ${esc(W.why)}</div></div>`; }).join('')}`;
}
function nwHook(){ if(nwHook.done||typeof pPax!=='function') return; nwHook.done=true;
  const _pp=pPax; pPax=function(){ const h=_pp(), cc=UI.paxCountry||homeCC(); let im=null; try{ im=countryImmigration(cc); }catch(e){} if(!im) return h; const add=natWhyHtml(cc,im), mark='<h3>Qui sont les voyageurs ?</h3>';
    return h.includes(mark)?h.replace(mark,add+mark):h+add; };
  // accès direct depuis la fiche « votre pays »
  if(typeof countryAirHtml==='function'){ const _ca=countryAirHtml; countryAirHtml=function(cc){ const h=_ca(cc); if(!h) return h; const c=cc||homeCC(); return h+`<div class="btns sm"><button class="btn sm" data-act="nwOpen" data-cc="${c}">🌍 Qui vient ${c==='CD'?'au Congo':'en '+esc(COUNTRIES[c][0])} et pourquoi ?</button></div>`; }; }
  Object.assign(ACTIONS,{ nwOpen:d=>{ UI.paxCountry=d.cc; try{ closeModal(); }catch(e){} if(typeof setTab==='function') setTab('pax'); } });
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ nwHook(); }catch(e){ console.warn(e); } },0));
