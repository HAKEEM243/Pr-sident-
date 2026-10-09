/* =========================================================
   Sky Empire — 🎨 atelier de livrée et 📸 mode photo
   ========================================================= */
'use strict';
function toHex(c){ if(!c) return '#1e5ba8'; if(c[0]==='#') return c.length===4?'#'+[...c.slice(1)].map(x=>x+x).join(''):c.slice(0,7);
  const m=c.match(/[\d.]+/g); if(!m) return '#1e5ba8'; const [h,s,l]=[m[0]/360,m[1]/100,m[2]/100], q=l<.5?l*(1+s):l+s-l*s, p=2*l-q;
  const f=t=>{ t=(t+1)%1; return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p; }; return '#'+[f(h+1/3),f(h),f(h-1/3)].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join(''); }
function defaultLivery(){ const c=toHex(S.company.color); return {body:'#ffffff', tail:c, stripe:c, engine:'#e5e7eb', style:'classique'}; }
function currentLivery(){ return S.livery||defaultLivery(); }
const LV_PRESETS=[
  ['Classique', l=>({body:'#ffffff',tail:l.tail,stripe:l.tail,engine:'#e5e7eb',style:'classique'})],
  ['Congo', ()=>({body:'#ffffff',tail:'#007fff',stripe:'#f7d618',engine:'#ce1021',style:'double'})],
  ['Ciel', ()=>({body:'#eaf4ff',tail:'#0ea5e9',stripe:'#0369a1',engine:'#ffffff',style:'ventre'})],
  ['Nuit & or', ()=>({body:'#111827',tail:'#d4a72c',stripe:'#d4a72c',engine:'#1f2937',style:'classique'})],
  ['Sable', ()=>({body:'#f5efe3',tail:'#9a3412',stripe:'#b45309',engine:'#e7e5e4',style:'queue'})],
  ['Émeraude', ()=>({body:'#ffffff',tail:'#047857',stripe:'#10b981',engine:'#047857',style:'ventre'})],
  ['Rouge vif', ()=>({body:'#ffffff',tail:'#dc2626',stripe:'#dc2626',engine:'#dc2626',style:'double'})],
  ['Épuré', l=>({body:'#ffffff',tail:l.tail,stripe:l.tail,engine:'#f1f5f9',style:'sans'})],
];
const LV_STYLES=[['classique','Bande latérale'],['double','Double liseré'],['ventre','Ventre coloré'],['queue','Arrière coloré'],['sans','Épuré']];
function liverySvg(l){
  const st=l.style, b=l.body, t=l.tail, s=l.stripe, e=l.engine;
  return `<svg viewBox="0 0 320 120" class="lv-svg"><defs><linearGradient id="lvsh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
    <clipPath id="lvbody"><path d="M18 62 Q22 44 52 42 L262 42 Q282 42 298 56 Q302 62 296 66 Q282 78 262 78 L52 78 Q22 78 18 62 Z"/></clipPath></defs>
    <path d="M232 44 L262 6 L282 6 L276 44 Z" fill="${t}"/>
    <path d="M250 50 L300 40 L304 46 L262 58 Z" fill="${t}" opacity=".9"/>
    <g clip-path="url(#lvbody)"><rect x="0" y="40" width="320" height="40" fill="${b}"/>
      ${st==='classique'?`<rect x="0" y="63" width="320" height="5" fill="${s}"/>`:''}
      ${st==='double'?`<rect x="0" y="62" width="320" height="4" fill="${s}"/><rect x="0" y="56" width="320" height="2" fill="${t}"/>`:''}
      ${st==='ventre'?`<rect x="0" y="64" width="320" height="16" fill="${s}"/>`:''}
      ${st==='queue'?`<path d="M200 40 L320 40 L320 80 L240 80 Z" fill="${s}"/>`:''}
      ${[...Array(24)].map((_,i)=>`<rect x="${64+i*8}" y="52" width="4" height="5" rx="1.5" fill="#1e293b" opacity=".85"/>`).join('')}
      <path d="M22 54 Q30 48 44 48 L46 54 Z" fill="#0f172a"/>
      <rect x="0" y="40" width="320" height="40" fill="url(#lvsh)"/></g>
    <path d="M110 68 L178 66 L120 100 L104 100 Z" fill="#cbd5e1" stroke="#94a3b8" stroke-width=".6"/>
    <rect x="114" y="80" width="44" height="14" rx="7" fill="${e}" stroke="#64748b" stroke-width=".6"/><ellipse cx="114" cy="87" rx="3" ry="7" fill="#1f2937"/>
    <text x="150" y="38" font-size="11" font-weight="700" fill="${t}" text-anchor="middle" font-family="system-ui">${esc(S.company.name).slice(0,22)}</text></svg>`;
}
function liveryHtml(){
  const l=UI.lv||(UI.lv={...currentLivery()});
  const col=(k,lab)=>`<label class="lv-c"><input type="color" value="${toHex(l[k])}" data-in="lv.${k}"><span>${lab}</span></label>`;
  return `<div class="lv-prev" id="lvPrev">${liverySvg(l)}</div>
    <h4>Modèles</h4><div class="chips">${LV_PRESETS.map(([n],i)=>`<button class="chip" data-act="lvPreset" data-i="${i}">${n}</button>`).join('')}</div>
    <h4>Couleurs</h4><div class="lv-cols">${col('body','Fuselage')}${col('tail','Dérive')}${col('stripe','Bande')}${col('engine','Moteurs')}</div>
    <h4>Style</h4><div class="chips">${LV_STYLES.map(([k,n])=>`<button class="chip ${l.style===k?'on':''}" data-act="lvStyle" data-k="${k}">${n}</button>`).join('')}</div>
    <div class="btns"><button class="btn gold" data-act="lvSave">✅ Peindre toute la flotte</button><button class="btn" data-act="lvReset">↺ Par défaut</button></div>
    <p class="small mut">La livrée s’applique à tous vos avions en vue 3D, et la couleur de la dérive devient la couleur de votre compagnie sur la carte.</p>`;
}
function lvRefresh(){ const p=document.getElementById('lvPrev'); if(p) p.innerHTML=liverySvg(UI.lv); }

/* ---------- mode photo (vue 3D) ---------- */
function photoOn(){
  if(!G||!G.follow) return toast('📸 Suivez d’abord un avion en vue 3D','info');
  document.body.classList.add('photo-on'); FX.orbit=false;
  let b=document.getElementById('photoBar'); if(!b){ b=document.createElement('div'); b.id='photoBar'; $('#main').appendChild(b); }
  b.innerHTML=`<button class="gh" data-act="photoShot">📷 Capturer</button><button class="gh" data-act="photoOrbit">🔄 Tour lent</button><button class="gh" data-act="photoOff">✖</button>`;
}
function photoOff(){ document.body.classList.remove('photo-on'); FX.orbit=false; const b=document.getElementById('photoBar'); if(b) b.remove(); }
async function photoShot(){
  const V=G.viewer, sc=V.scene;
  const url=await new Promise(res=>{ const once=()=>{ sc.postRender.removeEventListener(once); res(V.canvas.toDataURL('image/jpeg',0.92)); }; sc.postRender.addEventListener(once); sc.requestRender&&sc.requestRender(); });
  const f=document.createElement('div'); f.className='bolt'; f.style.background='rgba(255,255,255,.8)'; $('#main').appendChild(f); setTimeout(()=>f.remove(),350);
  const name=`sky-empire-${Date.now()}.jpg`;
  try{ const blob=await (await fetch(url)).blob(), file=new File([blob],name,{type:'image/jpeg'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:'Sky Empire'}); return; } }catch(e){ if(e&&e.name==='AbortError') return; }
  const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); toast('📷 Photo enregistrée','ok');
}
function registerStudioActions(){
  MODALS.livery=()=>showModal('🎨 Atelier de livrée', liveryHtml(), true);
  Object.assign(ACTIONS,{
    livery:()=>{ UI.lv={...currentLivery()}; openM('livery'); },
    lvPreset:d=>{ UI.lv=LV_PRESETS[+d.i][1](UI.lv); openM('livery'); },
    lvStyle:d=>{ UI.lv.style=d.k; openM('livery'); },
    lvReset:()=>{ UI.lv=defaultLivery(); openM('livery'); },
    lvSave:()=>{ S.livery={...UI.lv}; S.company.color=S.livery.tail; if(G){ for(const e of G.planes.values()) G.viewer.entities.remove(e); G.planes.clear(); globeSync(true); }
      if(typeof updatePlanes==='function') updatePlanes(); renderTop(); closeModal(); toast('🎨 Toute la flotte est repeinte !','ok'); },
    photo:()=>photoOn(), photoOff:()=>photoOff(), photoShot:()=>photoShot(),
    photoOrbit:()=>{ FX.orbit=!FX.orbit; },
  });
  for(const k of ['body','tail','stripe','engine']) INPUTS['lv.'+k]=el=>{ UI.lv[k]=el.value; lvRefresh(); };
}
