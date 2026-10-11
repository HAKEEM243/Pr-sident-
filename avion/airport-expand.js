/* =========================================================
   Sky Empire — agrandir les aéroports de vos pays
   Dans les pays où vous avez un hub, vous pouvez agrandir les
   aéroports en 5 étapes (chantiers réels avec durée et coût) :
   1. extension du terminal, 2. nouvelle jetée, 3. deuxième piste,
   4. terminal 2, 5. ville aéroportuaire.
   Effets : plus de voyageurs, plus de portes, moins de retards
   (piste dédiée aux arrivées), plus grands avions, et l'aéroport
   grandit aussi en 3D.
   ========================================================= */
'use strict';
const XP_STEPS=[
  {k:'xp1', icon:'🏗️', name:'Extension du terminal', days:60, cost:a=>14e6+a.traffic*6e6, traffic:1.12, gates:4, desc:'Terminal agrandi : +12 % de voyageurs dans cet aéroport, 4 portes de plus.'},
  {k:'xp2', icon:'🛬', name:'Nouvelle jetée d’embarquement', days:90, cost:a=>28e6+a.traffic*9e6, traffic:1.15, gates:8, desc:'Une jetée avec passerelles : +15 % de voyageurs, 8 portes de plus, embarquement plus rapide.'},
  {k:'xp3', icon:'🛫', name:'Deuxième piste parallèle', days:150, cost:a=>60e6+a.traffic*12e6, traffic:1.10, gates:0, desc:'Une piste réservée aux arrivées, l’autre aux départs : beaucoup moins d’attente au sol et en l’air (visible en 3D).'},
  {k:'xp4', icon:'🏢', name:'Terminal 2', days:240, cost:a=>120e6+a.traffic*25e6, traffic:1.25, gates:12, desc:'Un second terminal : +25 % de voyageurs, 12 portes, et l’aéroport monte d’une classe (avions plus gros).'},
  {k:'xp5', icon:'🌆', name:'Ville aéroportuaire', days:120, cost:a=>80e6+a.traffic*10e6, traffic:1.15, gates:0, desc:'Hôtels, centre d’affaires, train rapide vers la ville : +15 % de voyageurs, surtout en classe Affaires.'},
  {k:'xp6', icon:'🏬', name:'Terminal 3', days:240, cost:a=>150e6+a.traffic*25e6, traffic:1.20, gates:10, desc:'Un troisième terminal à l’autre bout des pistes : +20 % de voyageurs, 10 portes (visible en 3D et sur la carte).'},
  {k:'xp7', icon:'🏙️', name:'Terminal 4', days:300, cost:a=>200e6+a.traffic*30e6, traffic:1.20, gates:12, desc:'Un quatrième terminal derrière le terminal 1 : +20 % de voyageurs, 12 portes. Votre aéroport devient une plaque tournante mondiale.'},
];
const XPN=XP_STEPS.length;
const xpHubCountries=()=>new Set((S.hubs||[]).map(h=>AP(h)&&AP(h).cc));
// chaque étape devient un chantier du jeu (même système que les autres investissements)
XP_STEPS.forEach((st,i)=>{ UPGRADES[st.k]={name:`${st.name} (étape ${i+1}/${XPN})`, icon:st.icon, days:st.days, cost:a=>Math.round(st.cost(a)/1e5)*1e5,
  can:a=>xpHubCountries().has(a.cc)&&(a.xp||0)===i&&a.cls>=2&&!(S.projects||[]).some(p=>p.code===a.code&&p.type.startsWith('xp')),
  desc:st.desc, apply:a=>{ a.xp=i+1; a.traffic=+(a.traffic*st.traffic).toFixed(3); a.gatesX=XP_STEPS.slice(0,i+1).reduce((t,x)=>t+x.gates,0); if(st.k==='xp3') a.rw2=true; if(st.k==='xp4') a.cls=Math.min(5,a.cls+1); if(st.k==='xp5'){ a.lounge=true; a.terminal=true; } xpRefresh(a.code); }}; });
// les caches qui dépendent de l'aéroport sont recalculés
function xpRefresh(code){ try{ delete _rwCache[code]; delete _apron[code]; _pathCache.clear(); const cc=AP(code).cc; if(typeof _cTraffic!=='undefined') delete _cTraffic[cc]; }catch(e){}
  // la 3D et la carte 2D se redessinent tout de suite (nouvelle piste, nouveaux terminaux)
  try{ if(typeof G!=='undefined'&&G&&G.apNear) G.apNear.c={lat:-89,lon:0}; }catch(e){}
  try{ if(typeof _rwDrawn!=='undefined') _rwDrawn=null; if(typeof drawRunways==='function'&&typeof map!=='undefined'&&map) setTimeout(()=>{ try{ drawRunways(true); }catch(e){} },50); }catch(e){} }
// emplacement des terminaux (repère de la piste principale : a = le long de la piste, x = de côté), partagé par la 3D et la 2D
function apTerminals(code){ const A=AP(code), ap=apronOf(code), r=ap&&ap.rw; if(!A||!r) return [];
  const s=ap.side, gx=ap.x, a0=ap.a, xp=A.xp||0, span=Math.round((A.cls>=3?1900:700)*(1+0.1*Math.min(5,xp))), out=[{n:'T1',a:a0,x:gx+s*72,L:span}];
  if(xp>=4){ const L=Math.round(span*0.55); out.push({n:'T2',a:a0+span/2+L/2+260,x:gx+s*110,L}); }
  if(xp>=6){ const L=Math.round(span*0.55); out.push({n:'T3',a:a0-span/2-L/2-260,x:gx+s*110,L}); }
  if(xp>=7){ const L=Math.round(span*0.7); out.push({n:'T4',a:a0,x:gx+s*360,L}); }
  return out.map(t=>({...t,r,s})); }

/* ---------- deuxième piste : parallèle, à 1 050 m, du côté opposé à l'aérogare ---------- */
{ const _rw=runwaysOf; runwaysOf=function(code){ const out=_rw(code); const a=AP(code); if(!a||!a.rw2||out._xp||!out.length) return out;
  out._xp=true;
  const main=out.reduce((x,y)=>y.len>x.len?y:x,out[0]), ap=apronOf(code), side=(ap&&ap.rw===main?-ap.side:-1);
  const p1=fromRw(main,0,side*1050), p2=fromRw(main,main.len,side*1050), id=String(main.id||'').replace(/\D/g,'')||'09';
  const opp=out.find(r=>r.thr===main.end)||null, oid=opp?String(opp.id||'').replace(/\D/g,''):'27';
  out.push({id:id+(side>0?'R':'L'), hdg:main.hdg, thr:p1, end:p2, len:main.len, wid:main.wid||45, hard:true, xp:true},
           {id:oid+(side>0?'L':'R'), hdg:(main.hdg+180)%360, thr:p2, end:p1, len:main.len, wid:main.wid||45, hard:true, xp:true});
  out._xp=true; return out; }; }
// pistes spécialisées : les arrivées se posent sur la nouvelle piste, les départs gardent l'ancienne
let _xpCall=-1;
{ const _lp=legPath; legPath=function(leg,m){ _xpCall=0; try{ return _lp(leg,m); } finally{ _xpCall=-1; } }; }
{ const _br=bestRunway; bestRunway=function(code,course,m){ const role=_xpCall>=0?(_xpCall++===0?'dep':'arr'):null; const a=AP(code);
  if(!a||!a.rw2) return _br(code,course,m);
  const all=runwaysOf(code), real=all.filter(r=>!r.xp), virt=all.filter(r=>r.xp);
  const pickIn=list=>list.slice().sort((x,y)=>angDiff(x.hdg,course)-angDiff(y.hdg,course))[0];
  return role==='arr'&&virt.length? pickIn(virt) : (pickIn(real)||_br(code,course,m)); }; }

/* ---------- interface : où agrandir ---------- */
function xpTabHtml(){
  const ccs=xpHubCountries(); if(!ccs.size) return '';
  const list=AIRPORT_CODES.filter(c=>ccs.has(AP(c).cc)&&AP(c).cls>=2).sort((x,y)=>(S.hubs.includes(y)-S.hubs.includes(x))||(AP(y).traffic-AP(x).traffic)).slice(0,12);
  return `<h3>🏗️ Agrandir les aéroports de vos pays</h3><div class="small mut">Dans les pays où vous avez un hub, vous pouvez agrandir les aéroports en ${XPN} étapes (jusqu’à 4 terminaux). Touchez un aéroport pour lancer le chantier.</div>
    ${list.map(c=>{ const a=AP(c), lv=a.xp||0, pr=(S.projects||[]).find(p=>p.code===c&&p.type.startsWith('xp')), nx=XP_STEPS[lv];
      return `<div class="card row" data-act="openAp" data-c="${c}" style="cursor:pointer"><div class="grow"><b>${esc(a.city)}</b> <span class="mut">${c}${S.hubs.includes(c)?' · 🏢 hub':''}</span><br>
        <span class="small">${'▰'.repeat(lv)}${'▱'.repeat(XPN-lv)} étape ${lv}/${XPN} · ${a.traffic>=1?a.traffic.toFixed(1)+' M':Math.round(a.traffic*1000)+' k'} voyageurs/an${a.rw2?' · 2 pistes':''}</span><br>
        <span class="small ${pr?'warnt':'mut'}">${pr?`🏗️ Chantier en cours : ${XP_STEPS[+pr.type.slice(2)-1].name}, fin le ${fmtDate(pr.until)}`:nx?`Prochaine étape : ${nx.icon} ${nx.name} · ${fmtMoney(UPGRADES[nx.k].cost(a))} · immédiat`:'✅ Aéroport complètement agrandi'}</span></div></div>`; }).join('')}`;
}

function registerXpActions(){
  MODALS.xp=()=>showModal('🏗️ Agrandir mes aéroports', xpTabHtml()||'<p>Achetez d’abord un hub : vous pourrez agrandir les aéroports de ce pays.</p>', true);
  Object.assign(ACTIONS,{ xpOpen:()=>openM('xp') }); }

/* ---------- carte 2D : les nouveaux terminaux se dessinent sur la carte ---------- */
function xp2D(){ if(typeof drawRunways!=='function'||drawRunways._xp) return;
  const _dr=drawRunways; drawRunways=function(force){ const was=_rwDrawn; _dr(force); if(!_rwDrawn||_rwDrawn===was||!L_runways) return;
    const z=map.getZoom(); if(z<13) return; const b=map.getBounds().pad(0.4), c0=map.getCenter().lng, LL=p=>[p.lat,unwrapLon(p.lon,c0)];
    for(const code of AIRPORT_CODES){ const A=AP(code); if(!(A.xp>=1)||!b.contains([A.lat,unwrapLon(A.lon,c0)])) continue;
      for(const t of apTerminals(code)){ const d=t.s*40, pts=[fromRw(t.r,t.a-t.L/2,t.x),fromRw(t.r,t.a+t.L/2,t.x),fromRw(t.r,t.a+t.L/2,t.x+d),fromRw(t.r,t.a-t.L/2,t.x+d)];
        L.polygon(pts.map(LL),{color:'#ffd60a',weight:2,fillColor:'#e7e5e4',fillOpacity:0.85,interactive:false}).addTo(L_runways);
        const c=fromRw(t.r,t.a,t.x+d/2); L.marker(LL(c),{icon:L.divIcon({className:'rwy-label',html:`<span style="background:#111827cc;color:#ffd60a;padding:1px 4px;border-radius:4px;font-weight:700">${t.n}</span>`,iconSize:[30,16],iconAnchor:[15,8]}),interactive:false}).addTo(L_runways); } } };
  drawRunways._xp=true; }
{ const _rx=registerXpActions; registerXpActions=function(){ _rx(); try{ xp2D(); }catch(e){ console.warn(e); } }; }
