/* =========================================================
   Rail Empire — base de jeu de train (même architecture que Sky Empire)
   Principe clé : la position d'un train est une FONCTION DU TEMPS (position(train,t)),
   calculée à partir de l'horaire. Pas d'état « en route » à sauvegarder : on peut
   accélérer, mettre en pause, fermer le jeu et rattraper le temps sans rien casser.
   ========================================================= */
'use strict';
const MIN=60e3, HOUR=3600e3, DAY=24*HOUR, WEEK=7*DAY;
const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- données : gares (nom, lat, lon, habitants en millions) ---------- */
const STATIONS={PAR:['Paris',48.857,2.352,11],LYO:['Lyon',45.764,4.836,2.3],MRS:['Marseille',43.297,5.370,1.8],BDX:['Bordeaux',44.838,-0.579,1.3],LIL:['Lille',50.629,3.057,1.2],STR:['Strasbourg',48.585,7.735,0.8],NTE:['Nantes',47.218,-1.554,0.9],TLS:['Toulouse',43.605,1.444,1.4],BRU:['Bruxelles',50.846,4.357,2.1],LON:['Londres',51.507,-0.128,9],FRA:['Francfort',50.107,8.664,2.3],GVA:['Genève',46.210,6.143,0.6]};
/* modèles : places, vitesse max km/h, accélération m/s², prix M$, coût d'exploitation $/km */
const MODELS={TER:{name:'TER Regiolis',seats:220,vmax:160,acc:0.7,price:9,cpk:9},IC:{name:'Intercités',seats:380,vmax:200,acc:0.5,price:18,cpk:14},TGV:{name:'TGV Duplex',seats:508,vmax:300,acc:0.45,price:35,cpk:22},VMAX:{name:'Train à grande vitesse 360',seats:600,vmax:360,acc:0.4,price:60,cpk:30}};
const TURN=25*MIN;                                       // temps d'arrêt en gare avant le retour

/* ---------- géométrie ---------- */
const rad=x=>x*Math.PI/180;
function gcDist(a,b){ const A=STATIONS[a],B=STATIONS[b],dl=rad(B[2]-A[2]),dp=rad(B[1]-A[1]),h=Math.sin(dp/2)**2+Math.cos(rad(A[1]))*Math.cos(rad(B[1]))*Math.sin(dl/2)**2; return 2*6371*Math.asin(Math.sqrt(h)); }
const trackKm=(a,b)=>gcDist(a,b)*1.18;                  // la voie serpente : un peu plus long que la ligne droite
function lerpPt(a,b,f){ const A=STATIONS[a],B=STATIONS[b]; return [A[1]+(B[1]-A[1])*f, A[2]+(B[2]-A[2])*f]; }

/* ---------- profil de vitesse : accélération → palier → freinage (cache) ---------- */
const _prof=new Map();
function profile(km,m){                                  // retourne {T, s(t)} : distance parcourue (km) au temps t (ms)
  const key=m.name+'|'+Math.round(km); if(_prof.has(key)) return _prof.get(key);
  const v=m.vmax/3.6, a=m.acc, d=km*1000, ta=v/a, da=v*v/(2*a);
  let T,fn;
  if(2*da>=d){ const tp=Math.sqrt(d/a); T=2*tp; fn=t=>{ t/=1000; return (t<tp? 0.5*a*t*t : d-0.5*a*(2*tp-t)**2)/1000; }; }   // trop court pour atteindre la vitesse max
  else { const tc=(d-2*da)/v; T=2*ta+tc; fn=t=>{ t/=1000; return (t<ta? 0.5*a*t*t : t<ta+tc? da+v*(t-ta) : d-0.5*a*(T-t)**2)/1000; }; }
  const P={T:T*1000,s:t=>fn(Math.max(0,Math.min(T*1000,t)))}; _prof.set(key,P); return P;
}

/* ---------- état du jeu (un seul objet, sérialisé tel quel) ---------- */
let S=null;
function newGame(){ S={v:1,time:Date.UTC(2026,0,5,5,0),cash:200e6,speed:60,paused:false,lastReal:Date.now(),trains:[],lines:[],seq:1,log:[]}; save(); }
const save=()=>{ S.lastReal=Date.now(); try{ localStorage.setItem('rail-save',JSON.stringify(S)); localStorage.setItem('rail-lr',String(Date.now())); }catch(e){} };
function load(){ try{ const o=JSON.parse(localStorage.getItem('rail-save')||'null'); if(o&&o.v===1){ S=o; return true; } }catch(e){} return false; }

/* ---------- lignes, trains et calendrier (heures de départ du poste, fixes) ---------- */
function openLine(a,b,model,weekly){
  const m=MODELS[model], n=Math.max(1,Math.ceil(weekly/7)), cost=m.price*1e6*n;     // un train pour ~7 aller-retours par semaine
  if(S.cash<cost) return 'Trésorerie insuffisante : il faut '+(cost/1e6)+' M$';
  S.cash-=cost; const line={id:S.seq++,a,b,model,weekly}; S.lines.push(line);
  for(let i=0;i<n;i++) S.trains.push({id:S.seq++,line:line.id,idx:i,of:n}); return null;
}
// départs de la semaine d'un train : heures locales fixes, réparties sur les jours (comme planSlots dans Sky Empire)
function slots(line,train){ const per=Math.ceil(line.weekly/train.of), out=[], h=(5+((line.id*7+train.idx*5)%12))*HOUR;
  for(let k=0;k<per;k++){ const idx=train.idx+k*train.of; if(idx>=line.weekly) continue; out.push(Math.floor(idx*7/line.weekly)*DAY+h+(train.idx%3)*15*MIN); } return out.sort((x,y)=>x-y); }
const weekStart=t=>Math.floor((t+3*DAY)/WEEK)*WEEK-3*DAY;                        // lundi 00:00 UTC
function legsOf(train,t0,t1){                                                      // tous les trajets qui touchent [t0,t1]
  const line=S.lines.find(l=>l.id===train.line); if(!line) return []; const m=MODELS[line.model], km=trackKm(line.a,line.b), P=profile(km,m), out=[];
  for(let ws=weekStart(t0)-WEEK; ws<=t1; ws+=WEEK) for(const s of slots(line,train)){
    const d1=ws+s, a1=d1+P.T, d2=a1+TURN, a2=d2+P.T;
    out.push({from:line.a,to:line.b,dep:d1,arr:a1,km,P,m,line},{from:line.b,to:line.a,dep:d2,arr:a2,km,P,m,line}); }
  return out.filter(l=>l.arr>=t0&&l.dep<=t1);
}
function position(train,t){ for(const l of legsOf(train,t,t)){ if(t>=l.dep&&t<=l.arr){ const s=l.P.s(t-l.dep); return {pos:lerpPt(l.from,l.to,s/l.km),leg:l,kmh:Math.round((l.P.s(t-l.dep+1000)-s)*3600)}; } } return null; }

/* ---------- économie : chaque trajet terminé rapporte (billets) et coûte (énergie, personnel) ---------- */
function demand(a,b){ const A=STATIONS[a],B=STATIONS[b]; return 1800*Math.sqrt(A[3]*B[3])/Math.pow(Math.max(60,gcDist(a,b))/200,0.9); }   // modèle gravitaire simplifié : voyageurs par jour
function settle(l,count){ const per=demand(l.line.a,l.line.b)/Math.max(1,l.line.weekly/7)/2, pax=Math.round(Math.min(l.m.seats,per)), fare=10+l.km*0.17;
  const rev=pax*fare, cost=l.km*l.m.cpk*(0.6+l.m.seats/800); S.cash+=rev-cost; return {pax,rev,cost}; }   // coût = énergie + personnel + usure, par trajet
function advance(dt){ let target=S.time+dt; while(S.time<target){ const step=Math.min(5*MIN,target-S.time), t0=S.time; S.time+=step;
  for(const tr of S.trains) for(const l of legsOf(tr,t0+1,S.time)) if(l.arr>t0&&l.arr<=S.time) settle(l); } }
function catchUp(){ let lr=S.lastReal; try{ const b=+localStorage.getItem('rail-lr'); if(b&&b>lr) lr=b; }catch(e){} const dt=Math.min(Date.now()-lr,30*DAY); if(dt>5000&&!S.paused) advance(dt); S.lastReal=Date.now(); return dt; }

/* ---------- interface ---------- */
let map,mk={},lineLayer,UIMSG='';
const fmtT=t=>new Date(t).toISOString().slice(5,16).replace('T',' ');
const fmtMoney=v=>(v<0?'-':'')+'$'+(Math.abs(v)>=1e9?(Math.abs(v)/1e9).toFixed(2)+' Md':Math.abs(v)>=1e6?(Math.abs(v)/1e6).toFixed(1)+' M':Math.round(Math.abs(v)/1e3)+' k');
function renderTop(){ $('#clock').textContent=fmtT(S.time)+' UTC'; $('#cash').textContent=fmtMoney(S.cash);
  $('#speeds').innerHTML=[['Réaliste',1],['Standard',60],['Rapide',600],['Turbo',3600],['⏸',0]].map(([l,v])=>`<button class="${(v===0?S.paused:!S.paused&&S.speed===v)?'on':''}" data-sp="${v}">${l}</button>`).join(' '); }
function renderPanel(){
  const opts=Object.entries(STATIONS).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('');
  $('#panel').innerHTML=`<h3 style="margin:0">Ouvrir une ligne</h3><div class="row"><select id="fa">${opts}</select>⇄<select id="fb">${opts}</select></div>
   <div class="row"><select id="fm">${Object.entries(MODELS).map(([k,m])=>`<option value="${k}">${m.name} · ${m.price} M$</option>`).join('')}</select><select id="fw">${[3,7,14,21].map(n=>`<option value="${n}" ${n===7?'selected':''}>${n} aller-retours / sem.</option>`).join('')}</select><button id="go">Ouvrir</button></div><div id="msg" class="mut">${esc(UIMSG)}</div>
   <h3>Mes lignes</h3>`+(S.lines.map(l=>{ const m=MODELS[l.model], T=profile(trackKm(l.a,l.b),m).T;
     const tr=S.trains.filter(t=>t.line===l.id), ds=tr.flatMap(t=>slots(l,t).map(s=>s)).sort((x,y)=>x-y).map(s=>['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][Math.floor(s/DAY)]+' '+new Date(s%DAY+0).toISOString().slice(11,16));
     return `<div class="card"><b>${STATIONS[l.a][0]} ⇄ ${STATIONS[l.b][0]}</b> · ${m.name}<div class="mut">${Math.round(trackKm(l.a,l.b))} km · ${Math.round(T/MIN)} min · ${l.weekly} A/R par semaine · ${tr.length} train(s)</div><div class="mut">🗓️ Départs de ${STATIONS[l.a][0]} (UTC) : ${ds.join(' · ')}</div></div>`; }).join('')||'<div class="mut">Aucune ligne : ouvrez-en une ci-dessus.</div>')
   +`<div class="mut" style="margin-top:10px">Base de jeu : positions calculées à partir de l’horaire, trajet = accélération → palier → freinage, rattrapage du temps hors-jeu, sauvegarde locale.</div>`;
  $('#go').onclick=()=>{ const a=$('#fa').value,b=$('#fb').value; if(a===b){ UIMSG='Choisissez deux gares différentes.'; renderPanel(); return; } const e=openLine(a,b,$('#fm').value,+$('#fw').value); UIMSG=e||'Ligne ouverte !'; save(); renderPanel(); drawLines(); };
}
function drawLines(){ if(lineLayer) lineLayer.clearLayers(); for(const l of S.lines) L.polyline([[STATIONS[l.a][1],STATIONS[l.a][2]],[STATIONS[l.b][1],STATIONS[l.b][2]]],{color:'#ffd60a',weight:3,opacity:.8}).addTo(lineLayer); }
function updateTrains(){ const seen=new Set(); for(const tr of S.trains){ const p=position(tr,S.time); if(!p) continue; seen.add(tr.id); let m=mk[tr.id];
    if(!m){ m=mk[tr.id]=L.marker(p.pos,{icon:L.divIcon({className:'',html:'<div style="font-size:22px;filter:drop-shadow(0 0 3px #000)">🚆</div>',iconSize:[24,24]})}).addTo(map); }
    m.setLatLng(p.pos); m.bindTooltip(`${STATIONS[p.leg.from][0]} → ${STATIONS[p.leg.to][0]} · ${p.kmh} km/h`); }
  for(const id of Object.keys(mk)) if(!seen.has(+id)){ map.removeLayer(mk[id]); delete mk[id]; } }
function boot(){
  map=L.map('map',{zoomControl:true}).setView([47,3],5); L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',{maxZoom:19,subdomains:'abcd',attribution:'© OpenStreetMap, © CARTO'}).addTo(map); lineLayer=L.layerGroup().addTo(map);
  for(const [k,v] of Object.entries(STATIONS)) L.circleMarker([v[1],v[2]],{radius:5,color:'#fff',fillColor:'#e11d48',fillOpacity:1,weight:1}).addTo(map).bindTooltip(v[0]);
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-sp]'); if(!b) return; const v=+b.dataset.sp; if(v===0) S.paused=!S.paused; else { S.speed=v; S.paused=false; } renderTop(); });
  renderTop(); renderPanel(); drawLines();
  let last=performance.now(), wall=Date.now();
  setInterval(()=>{ const now=performance.now(), w=Date.now(), gap=w-wall; wall=w; if(gap>15000&&!S.paused){ catchUp(); last=now; }       // appli figée par le téléphone : on rattrape
    else { const dt=Math.min(now-last,3600000); last=now; if(!S.paused) advance(dt*S.speed); S.lastReal=w; }
    renderTop(); updateTrains(); },250);
  setInterval(save,8000); document.addEventListener('visibilitychange',()=>{ if(document.hidden) save(); });
}
if(!load()) newGame(); else catchUp();
window.addEventListener('DOMContentLoaded',boot);
