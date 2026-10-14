/* =========================================================
   Sky Empire — Kinshasa (et la rive de Brazzaville) intégrées au jeu
   Les données OpenStreetMap de la ville (≈ 45 000 bâtiments moyens et grands,
   routes principales, parcs, marchés, ≈ 4 000 lieux) sont rangées dans avion/kin/
   en petits fichiers par carré de 0,03°. Quand la 3D demande ces données au
   serveur Overpass pour une zone de Kinshasa, la réponse vient de ces fichiers :
   instantanée, sans dépendre des serveurs publics (souvent lents ou saturés).
   Données © les contributeurs d'OpenStreetMap, licence ODbL 1.0.
   ========================================================= */
'use strict';
const KIN={idx:null, idxP:null, tiles:new Map(), box:[-4.50,15.20,-4.24,15.52]};
function kinIndex(){ if(KIN.idx) return Promise.resolve(KIN.idx); if(!KIN.idxP) KIN.idxP=fetch('kin/index.json').then(r=>r.ok?r.json():null).then(j=>{ KIN.idx=j; return j; }).catch(()=>{ KIN.idxP=null; return null; }); return KIN.idxP; }
function kinTile(i,j){ const k=i+'_'+j; if(KIN.tiles.has(k)) return KIN.tiles.get(k);
  const p=fetch('kin/t'+k+'.json').then(r=>r.ok?r.json():null).catch(()=>null);
  KIN.tiles.set(k,p); const cap=(typeof GQ!=='undefined'&&GQ.mob)?16:40; while(KIN.tiles.size>cap) KIN.tiles.delete(KIN.tiles.keys().next().value);
  return p; }
const KIN_HW=['motorway','trunk','primary','secondary','tertiary'], KIN_LEIS=new Set(['park','garden','pitch','playground','stadium']), KIN_LAND=new Set(['grass','recreation_ground','forest','cemetery']);
function kinDec(arr,s,w){ const g=[]; for(let x=0;x<arr.length;x+=2) g.push({lat:s+arr[x]/1e5, lon:w+arr[x+1]/1e5}); return g; }
// réponse « comme Overpass » pour une requête sur Kinshasa, ou null si la zone n'est pas couverte
async function kinAnswer(q){
  const m=q.match(/\((-?\d+\.\d+),(-?\d+\.\d+),(-?\d+\.\d+),(-?\d+\.\d+)\)/); if(!m) return null;
  const [s,w,n,e]=m.slice(1).map(Number), B=KIN.box, cl=(s+n)/2, co=(w+e)/2;
  // la zone demandée doit être dans Kinshasa (pour les grandes routes, il suffit qu'elle touche la ville)
  const touch=n>B[0]&&s<B[2]&&e>B[1]&&w<B[3], inside=cl>=B[0]&&cl<=B[2]&&co>=B[1]&&co<=B[3];
  if(!touch||(!inside&&!/"highway"/.test(q))) return null;
  const ix=await kinIndex(); if(!ix) return null;
  const T=ix.cell, lim=+((q.match(/out (?:geom|center tags|tags geom|center) (\d+)/)||[])[1]||1e9);
  const kind=/place_of_worship/.test(q)?'o':/"leisure"|"landuse"|marketplace/.test(q)?'p':/"highway"/.test(q)?'r':/"building"/.test(q)?'b':null; if(!kind) return null;
  const hwOk=kind==='r'?new Set(KIN_HW.filter(h=>q.includes(h))):null;
  const tl=[]; for(let i=Math.floor(s/T);i<=Math.floor(n/T);i++) for(let j=Math.floor(w/T);j<=Math.floor(e/T);j++) if(ix.tiles[i+'_'+j]) tl.push([i,j]);
  const data=await Promise.all(tl.map(([i,j])=>kinTile(i,j)));
  const inBox=p=>p.lat>=s&&p.lat<=n&&p.lon>=w&&p.lon<=e, lists=[], seen=new Set();
  data.forEach((t,ti)=>{ if(!t) return; const ts=t.i*T, tw=t.j*T, L=[];
    if(kind==='b') for(const [id,lv,h,ty,name,c] of t.b){ const g=kinDec(c,ts,tw); if(!g.length||!inBox(g[0])) continue; g.push(g[0]);
      const tags={building:ix.types[ty]||'yes'}; if(lv) tags['building:levels']=String(lv); if(h) tags.height=String(h); if(name) tags.name=name; L.push({type:'way',id,tags,geometry:g}); }
    if(kind==='r') for(const [hk,ow,c] of t.r){ const hw=KIN_HW[hk]; if(!hwOk.has(hw)) continue; const g=kinDec(c,ts,tw); if(!g.some(inBox)) continue; L.push({type:'way',id:0,tags:Object.assign({highway:hw},ow?{oneway:'yes'}:{}),geometry:g}); }
    if(kind==='p') for(const [k,id,name,c] of t.p){ if(seen.has(id)) continue; const g=kinDec(c,ts,tw); if(!g.some(inBox)) continue; seen.add(id); g.push(g[0]);
      const tags=k==='marketplace'?{amenity:k}:KIN_LEIS.has(k)?{leisure:k}:KIN_LAND.has(k)?{landuse:k}:{natural:k}; if(name) tags.name=name; L.push({type:'way',id,tags,geometry:g}); }
    if(kind==='o') for(const [k,la,lo,name,rel] of t.o){ const p={lat:ts+la/1e5,lon:tw+lo/1e5}; if(!inBox(p)) continue;
      const tags=k==='hotel'?{tourism:'hotel'}:{amenity:k}; if(name) tags.name=name; if(rel) tags.religion=rel; L.push({type:'node',id:0,lat:p.lat,lon:p.lon,tags}); }
    lists.push(L); });
  // les plus grands bâtiments d'abord dans chaque carré : on prend à tour de rôle dans chaque carré jusqu'à la limite
  const out=[]; for(let r=0;out.length<lim;r++){ let any=false; for(const L of lists){ if(r<L.length){ any=true; out.push(L[r]); if(out.length>=lim) break; } } if(!any) break; }
  return {version:0.6, generator:'Sky Empire (Kinshasa intégrée)', elements:out};
}
// interception des requêtes Overpass pour Kinshasa
{ const _f=window.fetch.bind(window);
  window.fetch=function(url,opt){
    try{ const u=String(url&&url.url||url);
      if(/overpass|interpreter/.test(u)&&opt&&typeof opt.body==='string'&&opt.body.startsWith('data=')){
        const q=decodeURIComponent(opt.body.slice(5).replace(/\+/g,' '));
        return kinAnswer(q).then(js=>js?new Response(JSON.stringify(js),{status:200,headers:{'Content-Type':'application/json'}}):_f(url,opt)).catch(()=>_f(url,opt)); }
    }catch(e){}
    return _f(url,opt); }; }
// ---------------------------------------------------------
// Les quartiers : OpenStreetMap compte ≈ 750 000 maisons dans Kinshasa, trop pour être rangées dans le jeu.
// On garde le nombre réel de maisons par carré de 0,015° (index.json, « d ») et on bâtit des maisons
// basses à cette densité, en évitant le fleuve, les grandes routes, les aéroports et les vrais bâtiments.
const KIN_NOFILL=[[-4.400,15.410,-4.368,15.480],[-4.336,15.312,-4.316,15.342]];   // pistes de N'djili et de Ndolo
function kinWater(la,lo){ if(typeof CONGO_RIVER==='undefined') return false; let inside=false;
  for(const poly of CONGO_RIVER) for(const r of poly){ for(let a=0,b=r.length-1;a<r.length;b=a++){ const [xa,ya]=r[a], [xb,yb]=r[b]; if((ya>la)!==(yb>la)&&lo<(xb-xa)*(la-ya)/(yb-ya)+xa) inside=!inside; } }
  return inside; }
async function kinFill(c,budget,real){
  const ix=await kinIndex(); if(!ix||!ix.d) return [];
  const T=ix.cell, D=ix.dcell||0.015, i=Math.floor((c.s+c.n)/2/T), j=Math.floor((c.w+c.e)/2/T);
  const t=ix.tiles[i+'_'+j]?await kinTile(i,j):null;
  // cases déjà prises (~11 m) : vrais bâtiments et grandes routes
  const cs=0.0001, occ=new Set(), mark=(la,lo,r)=>{ const a=Math.floor(la/cs), b=Math.floor(lo/cs); for(let x=-r;x<=r;x++) for(let y=-r;y<=r;y++) occ.add((a+x)*100000+(b+y)); };
  for(const el of real||[]){ const g=el.geometry; if(!g) continue; let s=90,w=180,n=-90,e=-180; for(const p of g){ if(p.lat<s)s=p.lat; if(p.lat>n)n=p.lat; if(p.lon<w)w=p.lon; if(p.lon>e)e=p.lon; }
    for(let la=s;la<=n+cs;la+=cs) for(let lo=w;lo<=e+cs;lo+=cs) mark(la,lo,0); }
  if(t) for(const [hk,ow,arr] of t.r){ const g=kinDec(arr,t.i*T,t.j*T), r=hk<=2?2:1;
    for(let k=1;k<g.length;k++){ const A=g[k-1], B=g[k], st=Math.max(1,Math.ceil(Math.hypot(B.lat-A.lat,B.lon-A.lon)/(cs*0.7))); for(let q=0;q<=st;q++) mark(A.lat+(B.lat-A.lat)*q/st, A.lon+(B.lon-A.lon)*q/st, r); } }
  const out=[], K=111320, hsh=(x,y,z)=>{ let h=(x*374761393+y*668265263+z*2147483647)|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; };
  let tot=0; const subs=[];
  for(let a=Math.floor(c.s/D+1e-9);a*D<c.n-1e-9;a++) for(let b=Math.floor(c.w/D+1e-9);b*D<c.e-1e-9;b++){ const N=ix.d[a+'_'+b]||0; if(!N) continue;
    const fr=(Math.min(c.n,(a+1)*D)-Math.max(c.s,a*D))*(Math.min(c.e,(b+1)*D)-Math.max(c.w,b*D))/(D*D); if(fr<=0) continue; subs.push([a,b,N,fr]); tot+=N*fr; }
  for(const [a,b,N,fr] of subs){
    const want=Math.min(budget*N*fr/tot, N*fr*0.9); if(want<1) continue;
    const s0=a*D, w0=b*D, la0=s0+D/2, lo0=w0+D/2, cl=Math.cos(la0*Math.PI/180), H=D*K, W=D*K*cl;
    const th=(hsh(a,b,7)-0.5)*0.5, ct=Math.cos(th), sn=Math.sin(th), sp=Math.max(13,Math.sqrt(H*W/N));
    // la partie du carré qui tombe dans cette case, en mètres autour du centre du carré
    const y0=(Math.max(c.s,s0)-la0)*K, y1=(Math.min(c.n,s0+D)-la0)*K, x0=(Math.max(c.w,w0)-lo0)*K*cl, x1=(Math.min(c.e,w0+D)-lo0)*K*cl, m=0.3*Math.max(x1-x0,y1-y0);
    const u0=Math.floor((x0-m)/sp), u1=Math.ceil((x1+m)/sp), v0=Math.floor((y0-m)/sp), v1=Math.ceil((y1+m)/sp), pr=want/Math.max(1,(x1-x0)*(y1-y0)/(sp*sp));
    for(let u=u0;u<=u1;u++) for(let v=v0;v<=v1;v++){
      if(hsh(u+a*977,v+b*631,1)>pr) continue;
      // grille légèrement tournée, comme les parcelles des quartiers ; position fixe d'une visite à l'autre
      const x=(u+0.5+(hsh(u,v,2)-0.5)*0.25)*sp, y=(v+0.5+(hsh(u,v,3)-0.5)*0.25)*sp, xr=x*ct-y*sn, yr=x*sn+y*ct;
      if(xr<x0||xr>=x1||yr<y0||yr>=y1) continue;
      const la=la0+yr/K, lo=lo0+xr/(K*cl);
      if(occ.has(Math.floor(la/cs)*100000+Math.floor(lo/cs))) continue;
      if(KIN_NOFILL.some(z=>la>z[0]&&la<z[2]&&lo>z[1]&&lo<z[3])||kinWater(la,lo)) continue;
      const r=hsh(u,v,4), hw=(5+hsh(u,v,5)*4.5)/2, hl=(6.5+hsh(u,v,6)*6)/2, f=hsh(u,v,8)<0.5?th:th+Math.PI/2, cf=Math.cos(f), sf=Math.sin(f);
      const g=[[-hw,-hl],[hw,-hl],[hw,hl],[-hw,hl],[-hw,-hl]].map(([px,py])=>({lat:la+(px*sf+py*cf)/K, lon:lo+(px*cf-py*sf)/(K*cl)}));
      const tags=r<0.05?{building:'apartments','building:levels':String(2+Math.floor(hsh(u,v,9)*3))}:{building:'house','building:levels':r<0.82?'1':'2'};
      out.push({type:'way',id:9e12+a*1e10+b*1e6+(u+500)*1000+(v+500),tags,geometry:g}); }
  }
  return out;
}
