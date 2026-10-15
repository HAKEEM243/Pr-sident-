/* =========================================================
   Sky Empire — 🎬 Voyage illustré (2D) en camion ou en train
   Une vue de côté dessinée, comme un jeu mobile : le ciel suit
   l'heure (aube, jour, coucher de soleil, nuit étoilée), collines
   au loin, forêt équatoriale ou savane selon la région, villages
   (maisons à toit de tôle, église, marché, kiosques), villes aux
   arrêts, ponts sur les rivières, et votre camion ou votre train
   aux couleurs de votre compagnie. Léger : aucune 3D.
   ========================================================= */
'use strict';
const VD={on:false, raf:0, d:0, sp:10, last:0, mode:'truck', line:null, len:1, stops:[], path:null, cv:null, ctx:null, W:0, H:0, dpr:1, smoke:[], h0:8};
const vdRnd=(a,b)=>{ let h=(a*374761393+b*668265263+0x9e3779b9)|0; h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16; return (h>>>0)/4294967296; };
const vdLerp=(a,b,t)=>a+(b-a)*t;
const vdMix=(c1,c2,t)=>{ const p=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)], a=p(c1), b=p(c2); return `rgb(${a.map((v,i)=>Math.round(vdLerp(v,b[i],t))).join(',')})`; };

/* ---------- le parcours ---------- */
function vdBuild(mode,line){
  const p=trPath(mode,line.a,line.b); if(!p) return null;
  const cum=[0]; for(let i=1;i<p.pts.length;i++) cum.push(cum[i-1]+trGc(p.pts[i-1],p.pts[i])*1000*(mode==='train'?1.15:1.35));
  return {len:cum[cum.length-1], stops:p.pts.map((n,i)=>({name:n.name, d:cum[i], pop:n.popK||50, lat:n.lat})), pts:p.pts, cum};
}
function vdLatAt(d){ const P=VD.path; for(let i=1;i<P.cum.length;i++) if(d<=P.cum[i]){ const f=(d-P.cum[i-1])/Math.max(1,P.cum[i]-P.cum[i-1]); return vdLerp(P.pts[i-1].lat,P.pts[i].lat,f); } return P.pts[P.pts.length-1].lat; }
const vdForest=d=>Math.abs(vdLatAt(d))<3.2;   // près de l'équateur : forêt dense ; ailleurs : savane

/* ---------- ciel ---------- */
function vdHour(){ return (VD.h0+VD.d/1000/(VD.mode==='train'?40:60))%24; }   // le temps du voyage avance avec les kilomètres
function vdSky(g,W,H){
  const h=vdHour(), K=[[0,'#0b1026','#1e2a4a'],[5,'#1e2a4a','#3b4a7a'],[6.3,'#f59e0b','#fde68a'],[8,'#60a5fa','#dbeafe'],[16,'#3b82f6','#bfdbfe'],[17.8,'#f97316','#fcd34d'],[19,'#4c1d95','#f472b6'],[20.3,'#0b1026','#1e2a4a'],[24,'#0b1026','#1e2a4a']];
  let i=0; while(i<K.length-2&&h>=K[i+1][0]) i++; const t=(h-K[i][0])/(K[i+1][0]-K[i][0]);
  const top=vdMix(K[i][1],K[i+1][1],t), bot=vdMix(K[i][2],K[i+1][2],t);
  const gr=g.createLinearGradient(0,0,0,H*0.62); gr.addColorStop(0,top); gr.addColorStop(1,bot); g.fillStyle=gr; g.fillRect(0,0,W,H*0.62);
  const night=h<5.8||h>20; VD.night=night;
  if(night){ g.fillStyle='#fff'; for(let k=0;k<70;k++){ const x=vdRnd(k,1)*W, y=vdRnd(k,2)*H*0.45, tw=0.5+0.5*Math.sin(performance.now()/600+k); g.globalAlpha=0.3+0.6*tw; g.fillRect(x,y,1.6,1.6); } g.globalAlpha=1;
    g.fillStyle='#f8fafc'; g.beginPath(); g.arc(W*0.8,H*0.12,14,0,7); g.fill(); g.fillStyle=top; g.beginPath(); g.arc(W*0.8+6,H*0.11,12,0,7); g.fill(); }
  else { const a=(h-6)/14, sx=W*(0.05+0.9*a), sy=H*0.5-Math.sin(a*Math.PI)*H*0.4; const sg=g.createRadialGradient(sx,sy,2,sx,sy,60); sg.addColorStop(0,'rgba(255,248,220,1)'); sg.addColorStop(0.25,'rgba(253,224,71,.9)'); sg.addColorStop(1,'rgba(253,224,71,0)'); g.fillStyle=sg; g.beginPath(); g.arc(sx,sy,60,0,7); g.fill(); }
  // nuages qui dérivent
  g.fillStyle=night?'rgba(148,163,184,.25)':'rgba(255,255,255,.85)';
  for(let k=0;k<6;k++){ const x=((vdRnd(k,9)*W*2-(VD.d*0.02+performance.now()*0.004)*(0.5+vdRnd(k,3)))%(W*1.6)+W*1.6)%(W*1.6)-W*0.3, y=H*(0.06+vdRnd(k,4)*0.22), s=0.6+vdRnd(k,5);
    for(let j=0;j<4;j++){ g.beginPath(); g.ellipse(x+j*18*s,y+(j%2?4:0)*s,22*s,12*s,0,0,7); g.fill(); } }
}
/* ---------- collines (parallaxe) ---------- */
function vdHills(g,W,H,f,base,amp,period,col,seed){
  const s=VD.sc, off=VD.d*f; g.fillStyle=col; g.beginPath(); g.moveTo(0,H);
  for(let x=0;x<=W+8;x+=8){ const wx=(x/s+off)/period; const y=base-amp*(0.55*Math.sin(wx+seed)+0.3*Math.sin(wx*2.3+seed*2)+0.15*Math.sin(wx*5.1+seed*3)); g.lineTo(x,y); }
  g.lineTo(W,H); g.closePath(); g.fill();
}
/* ---------- éléments dessinés ---------- */
function vdPalm(g,x,y,h,dark){ g.strokeStyle=dark||'#7c5a3a'; g.lineWidth=Math.max(2,h*0.07); g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+h*0.18,y-h*0.5,x+h*0.08,y-h); g.stroke();
  const tx=x+h*0.08, ty=y-h; g.fillStyle=dark||'#2f6b2f'; for(let k=0;k<7;k++){ const a=-Math.PI*0.95+k*Math.PI*0.32+Math.sin(performance.now()/900+x)*0.05; g.beginPath(); g.moveTo(tx,ty); g.quadraticCurveTo(tx+Math.cos(a)*h*0.35,ty+Math.sin(a)*h*0.35-h*0.12,tx+Math.cos(a)*h*0.55,ty+Math.sin(a)*h*0.55+h*0.1); g.quadraticCurveTo(tx+Math.cos(a)*h*0.3,ty+Math.sin(a)*h*0.3,tx,ty); g.fill(); }
  if(!dark){ g.fillStyle='#8b5a2b'; g.beginPath(); g.arc(tx-2,ty+3,h*0.035,0,7); g.arc(tx+3,ty+4,h*0.035,0,7); g.fill(); } }
function vdMango(g,x,y,r,dark){ g.fillStyle=dark||'#6b4a2e'; g.fillRect(x-r*0.1,y-r*0.9,r*0.2,r*0.9); const c=dark||['#2f5d27','#3a6f2c','#2c5422'][Math.floor(vdRnd(Math.round(x),7)*3)];
  g.fillStyle=c; for(const [dx,dy,rr] of [[0,-1.3,0.8],[-0.55,-1.0,0.6],[0.55,-1.05,0.62],[0,-0.85,0.65]]){ g.beginPath(); g.arc(x+dx*r,y+dy*r,rr*r,0,7); g.fill(); }
  if(!dark){ g.fillStyle='rgba(255,255,255,.08)'; g.beginPath(); g.arc(x-r*0.25,y-r*1.55,r*0.35,0,7); g.fill(); } }
function vdAcacia(g,x,y,w,dark){ g.strokeStyle=dark||'#5b4636'; g.lineWidth=Math.max(1.5,w*0.05); g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-w*0.5); g.lineTo(x-w*0.25,y-w*0.75); g.moveTo(x,y-w*0.5); g.lineTo(x+w*0.3,y-w*0.78); g.stroke();
  g.fillStyle=dark||'#6b8e23'; g.beginPath(); g.ellipse(x,y-w*0.82,w*0.6,w*0.13,0,0,7); g.fill(); }
function vdBaobab(g,x,y,h){ g.fillStyle='#8d7462'; g.beginPath(); g.moveTo(x-h*0.18,y); g.quadraticCurveTo(x-h*0.22,y-h*0.5,x-h*0.1,y-h*0.75); g.lineTo(x+h*0.1,y-h*0.75); g.quadraticCurveTo(x+h*0.22,y-h*0.5,x+h*0.18,y); g.fill();
  g.strokeStyle='#8d7462'; g.lineWidth=h*0.04; for(const a of [-0.9,-0.5,-0.1,0.3]){ g.beginPath(); g.moveTo(x,y-h*0.72); g.lineTo(x+Math.sin(a)*h*0.35,y-h*0.72-Math.cos(a)*h*0.25); g.stroke(); }
  g.fillStyle='#5f7f35'; g.beginPath(); g.ellipse(x,y-h*0.98,h*0.38,h*0.1,0,0,7); g.fill(); }
function vdHouse(g,x,y,w,h,wall,roof,lit,seed){ g.fillStyle=wall; g.fillRect(x,y-h,w,h); g.fillStyle='rgba(0,0,0,.12)'; g.fillRect(x,y-h,w*0.08,h);
  g.fillStyle=roof; g.beginPath(); g.moveTo(x-w*0.08,y-h); g.lineTo(x+w*0.18,y-h-h*0.42); g.lineTo(x+w*0.82,y-h-h*0.42); g.lineTo(x+w*1.08,y-h); g.closePath(); g.fill();
  g.strokeStyle='rgba(0,0,0,.18)'; g.lineWidth=1; for(let k=1;k<7;k++){ const fx=x+w*0.18+k*(w*0.64)/7; g.beginPath(); g.moveTo(fx,y-h-h*0.42); g.lineTo(fx+(k<3.5?-1:1)*w*0.1,y-h); g.stroke(); }   // tôle ondulée
  g.fillStyle='#5b4636'; g.fillRect(x+w*0.42,y-h*0.62,w*0.18,h*0.62);   // porte
  g.fillStyle=lit?'#fde68a':'#1f2a3a'; g.fillRect(x+w*0.12,y-h*0.7,w*0.18,h*0.22); g.fillRect(x+w*0.7,y-h*0.7,w*0.18,h*0.22);
  if(lit){ g.fillStyle='rgba(253,230,138,.25)'; g.beginPath(); g.arc(x+w*0.21,y-h*0.6,w*0.25,0,7); g.arc(x+w*0.79,y-h*0.6,w*0.25,0,7); g.fill(); } }
function vdBuilding(g,x,y,w,h,col,lit,seed){ g.fillStyle=col; g.fillRect(x,y-h,w,h); g.fillStyle='rgba(0,0,0,.15)'; g.fillRect(x+w*0.9,y-h,w*0.1,h);
  for(let fy=y-h+6;fy<y-10;fy+=12) for(let fx=x+5;fx<x+w-8;fx+=11){ g.fillStyle=lit&&vdRnd(Math.round(fx),Math.round(fy))<0.55?'#fde68a':'#334155'; g.fillRect(fx,fy,6,7); }
  g.fillStyle='#64748b'; g.fillRect(x-2,y-h-3,w+4,3); }
function vdChurch(g,x,y,s,lit){ vdHouse(g,x,y,s*1.6,s*0.9,'#f5f5f4','#7b2f22',lit); g.fillStyle='#f5f5f4'; g.fillRect(x+s*0.05,y-s*1.9,s*0.38,s*1.9); g.fillStyle='#7b2f22'; g.beginPath(); g.moveTo(x,y-s*1.9); g.lineTo(x+s*0.24,y-s*2.35); g.lineTo(x+s*0.48,y-s*1.9); g.fill();
  g.fillStyle='#1f2933'; g.fillRect(x+s*0.22,y-s*2.65,s*0.04,s*0.3); g.fillRect(x+s*0.15,y-s*2.56,s*0.18,s*0.04); }
function vdStall(g,x,y,s,c){ g.fillStyle='#6b4a2e'; g.fillRect(x,y-s*0.45,s*1.1,s*0.45*0.25); g.fillRect(x+s*0.05,y-s*0.35,s*0.06,s*0.35); g.fillRect(x+s*0.99,y-s*0.35,s*0.06,s*0.35);
  for(let k=0;k<5;k++){ g.fillStyle=['#f59e0b','#16a34a','#dc2626','#facc15','#ea580c'][(k+Math.round(x))%5]; g.beginPath(); g.arc(x+s*(0.15+k*0.2),y-s*0.5,s*0.08,0,7); g.fill(); }
  g.fillStyle='#4b3a2a'; g.fillRect(x+s*0.52,y-s*1.1,s*0.05,s*0.65); g.fillStyle=c; g.beginPath(); g.moveTo(x-s*0.15,y-s*0.95); g.quadraticCurveTo(x+s*0.55,y-s*1.45,x+s*1.25,y-s*0.95); g.closePath(); g.fill(); }
function vdKiosk(g,x,y,s,txt,c){ g.fillStyle='#e9c9a6'; g.fillRect(x,y-s,s*1.4,s); g.fillStyle=c; g.fillRect(x-s*0.1,y-s*1.32,s*1.6,s*0.34); g.fillStyle='#fff'; g.font=`bold ${Math.max(7,s*0.2)}px sans-serif`; g.textAlign='center'; g.fillText(txt,x+s*0.7,y-s*1.08); g.fillStyle='#1f2a3a'; g.fillRect(x+s*0.2,y-s*0.75,s*1.0,s*0.4); }
function vdPerson(g,x,y,s,c,t){ const sw=Math.sin(t)*s*0.12; g.fillStyle=c; g.fillRect(x-s*0.12,y-s*0.95,s*0.24,s*0.5); g.fillStyle='#3b2a20'; g.beginPath(); g.arc(x,y-s*1.1,s*0.13,0,7); g.fill();
  g.strokeStyle='#3b2a20'; g.lineWidth=Math.max(1,s*0.07); g.beginPath(); g.moveTo(x,y-s*0.45); g.lineTo(x+sw,y); g.moveTo(x,y-s*0.45); g.lineTo(x-sw,y); g.stroke(); }

/* ---------- le plan proche : village, ville, nature ---------- */
function vdPark(g,x,y,w,s,night,seed){ g.fillStyle=night?'#1f4d2a':'#4ade80'; g.fillRect(x,y-1.2*s,w,1.4*s); g.fillStyle=night?'#245c31':'#86efac'; g.fillRect(x+w*0.05,y-1*s,w*0.9,0.5*s);
  g.strokeStyle='#e5e7eb'; g.lineWidth=1; g.beginPath(); for(let k=0;k<=w;k+=1.6*s){ g.moveTo(x+k,y); g.lineTo(x+k,y-2.4*s); } g.moveTo(x,y-2*s); g.lineTo(x+w,y-2*s); g.stroke();
  vdMango(g,x+w*0.18,y-1*s,4.5*s); vdPalm(g,x+w*0.55,y-1*s,13*s); vdMango(g,x+w*0.85,y-1*s,3.8*s);
  g.fillStyle='#78350f'; g.fillRect(x+w*0.32,y-2.2*s,4*s,0.5*s); g.fillRect(x+w*0.32,y-1.7*s,0.4*s,1.2*s); g.fillRect(x+w*0.32+3.6*s,y-1.7*s,0.4*s,1.2*s);
  g.fillStyle='#64748b'; g.fillRect(x+w*0.7,y-7*s,0.4*s,6*s); g.fillStyle=night?'#fde68a':'#e5e7eb'; g.beginPath(); g.arc(x+w*0.7+0.2*s,y-7.2*s,0.9*s,0,7); g.fill();
  if(night){ const rg=g.createRadialGradient(x+w*0.7,y-7*s,0,x+w*0.7,y-7*s,8*s); rg.addColorStop(0,'rgba(253,230,138,.45)'); rg.addColorStop(1,'rgba(253,230,138,0)'); g.fillStyle=rg; g.fillRect(x+w*0.7-8*s,y-15*s,16*s,16*s); }
  g.fillStyle='#fff'; g.font=`bold ${Math.max(8,1.4*s)}px sans-serif`; g.textAlign='center'; g.fillText('Jardin public',x+w*0.5,y-3*s); }
/* premier plan : buissons, bananiers, termitières, hautes herbes (défilent plus vite) */
function vdFront(g,W,H,fy,night){ const s=VD.sc*1.5, f=1.5, d=VD.d, T=15, x0=d-VD.vx/(VD.sc*f)-20, x1=x0+W/(VD.sc*f)+40, forest=vdForest(d), dk=c=>night?vdMix(c,'#0b1026',0.6):c;
  const lay=(fy2,col,amp)=>{ g.fillStyle=col; g.beginPath(); g.moveTo(0,H); for(let x=0;x<=W+8;x+=8){ const wx=(x/(VD.sc*f))+x0; g.lineTo(x,fy2+Math.sin(wx*0.07)*amp+Math.sin(wx*0.19)*amp*0.5); } g.lineTo(W,H); g.fill(); };
  lay(fy+H*0.06,dk(forest?'#24521f':'#7a7a32'),6); 
  for(let t=Math.floor(x0/T);t<=Math.floor(x1/T);t++){ const r=k=>vdRnd(t,k+500), wx=t*T+r(1)*T, X=VD.vx+(wx-d)*VD.sc*f, Y=fy+H*(0.13+r(2)*0.12), k=r(3);
    if(X<-80||X>W+80) continue;
    if(k<0.3){ g.fillStyle=dk(forest?'#166534':'#4d7c0f'); for(let j=0;j<4;j++){ g.beginPath(); g.arc(X+(j-1.5)*2.2*s,Y-1.2*s-(j%2)*1.1*s,2.4*s,0,7); g.fill(); } }
    else if(k<0.5&&forest){ g.strokeStyle=dk('#365314'); g.lineWidth=0.6*s; g.beginPath(); g.moveTo(X,Y); g.lineTo(X,Y-9*s); g.stroke(); g.fillStyle=dk('#22c55e'); for(let j=0;j<5;j++){ const a=-Math.PI/2+(j-2)*0.55; g.beginPath(); g.ellipse(X+Math.cos(a)*3.4*s,Y-9*s+Math.sin(a)*3.4*s,4*s,1.2*s,a,0,7); g.fill(); } }
    else if(k<0.5){ g.fillStyle=dk('#b45309'); g.beginPath(); g.moveTo(X-3*s,Y); g.quadraticCurveTo(X-1*s,Y-9*s,X,Y-10*s); g.quadraticCurveTo(X+1.5*s,Y-8*s,X+3*s,Y); g.fill(); g.fillStyle='rgba(0,0,0,.15)'; g.fillRect(X,Y-9*s,1.2*s,9*s); }
    else if(k<0.85){ g.strokeStyle=dk(forest?'#4d7c0f':'#ca8a04'); g.lineWidth=1.6; for(let j=0;j<7;j++){ g.beginPath(); g.moveTo(X+j*1.2*s,Y); g.quadraticCurveTo(X+j*1.2*s+(j%2?1:-1)*s,Y-3*s,X+j*1.2*s+(j%3-1)*2*s,Y-(4+r(10+j)*4)*s); g.stroke(); } }
    else if(r(4)<0.5){ g.fillStyle=dk('#a16207'); g.fillRect(X,Y-3*s,0.5*s,3*s); g.fillRect(X+5*s,Y-3*s,0.5*s,3*s); g.fillRect(X-0.5*s,Y-2.7*s,6.5*s,0.4*s); g.fillRect(X-0.5*s,Y-1.6*s,6.5*s,0.4*s); }
  }
  lay(fy+H*0.2,dk(forest?'#1a3d17':'#6b6b2a'),4);
}
/* silhouette de la ville qui approche, au loin */
function vdSkyline(g,W,H,night){ const d=VD.d; let best=null; for(const st of VD.stops){ const k=Math.abs(st.d-d); if(k<9000&&(!best||k<best.k)) best={st,k}; } if(!best) return;
  const st=best.st, a=Math.max(0,1-best.k/9000), n=Math.min(40,8+Math.round(Math.sqrt(st.pop)*0.6)), cx=VD.vx+(st.d-d)*VD.sc*0.25, sw=n*W*0.012+W*0.2;
  g.save(); g.globalAlpha=a*0.85; for(let i=0;i<n;i++){ const r=k=>vdRnd(i,k+st.name.length*31), bw=(5+r(1)*9)*VD.sc*0.4, bh=(st.pop>2000?14:7)*VD.sc*(0.4+r(2)*1.1)*0.5, x=cx-sw/2+r(3)*sw, y=H*0.6;
    g.fillStyle=night?'#1e2440':vdMix('#94a3b8','#64748b',r(4)); g.fillRect(x,y-bh,bw,bh); if(night){ g.fillStyle='#fde68a'; for(let j=0;j<5;j++) if(r(10+j)<0.6) g.fillRect(x+bw*r(20+j)*0.8,y-bh*r(30+j)*0.9-3,2,2); } }
  g.restore(); }
const VD_WALL=['#e7d8bd','#d9c3a0','#f1e6d0','#c9a27e','#e9c9a6','#f5efe2','#b9c7d8','#e3b78f','#f2c4a0','#cde3c3'], VD_ROOF=['#8c8f93','#7b2f22','#9a9da1','#a4552e','#6e7276','#3f5f7f'];
function vdNear(g,W,H,gy){
  const s=VD.sc, d=VD.d, x0=d-W*0.35/s-30, x1=d+W*0.75/s+30, T=16, night=VD.night;
  const town=VD.stops.find(st=>Math.abs(st.d-d)<2200+Math.min(3000,st.pop));
  const objs=[];
  for(let t=Math.floor(x0/T)-1;t<=Math.floor(x1/T)+1;t++){ const r=k=>vdRnd(t,k), wx=t*T+r(1)*T;
    const nearTown=VD.stops.find(st=>Math.abs(st.d-wx)<1500+Math.min(2500,st.pop)), village=!nearTown&&(Math.floor(wx/1400)%4===0)&&((wx%1400)<420);
    const forest=vdForest(wx);
    if(nearTown){ const big=nearTown.pop>=500, k=r(2);
      if(k<0.07&&Math.floor(wx/600)%3===1) objs.push({x:wx,z:-1,f:'park',w:26+r(3)*14});
      else if(k<0.35&&big) objs.push({x:wx,z:0,f:'bld',w:16+r(3)*14,h:18+r(4)*(nearTown.pop>3000?60:30),c:['#e2e8f0','#cbd5e1','#fde68a','#bfdbfe','#fecaca'][Math.floor(r(5)*5)]});
      else if(k<0.75) objs.push({x:wx,z:0,f:'house',w:9+r(3)*5,h:6+r(4)*3,wall:VD_WALL[Math.floor(r(5)*VD_WALL.length)],roof:VD_ROOF[Math.floor(r(6)*VD_ROOF.length)]});
      else if(k<0.88) objs.push({x:wx,z:1,f:'kiosk',txt:['Boutique','Alimentation','Pharmacie','Coiffure','Phone','Quincaillerie','Restaurant'][Math.floor(r(5)*7)],c:['#dc2626','#2563eb','#16a34a','#7c3aed','#ea580c'][Math.floor(r(6)*5)]});
      else objs.push({x:wx,z:1,f:'palm',h:12+r(3)*4});
      if(r(8)<0.5) objs.push({x:wx+r(9)*T,z:2,f:'person',c:['#dc2626','#2563eb','#f59e0b','#16a34a','#db2777','#f8fafc'][Math.floor(r(10)*6)],sp:r(11)}); }
    else if(village){ const k=r(2); if(r(12)<0.25) continue;
      if(k<0.55) objs.push({x:wx,z:0,f:'house',w:8+r(3)*4,h:5+r(4)*2,wall:VD_WALL[Math.floor(r(5)*VD_WALL.length)],roof:VD_ROOF[Math.floor(r(6)*VD_ROOF.length)]});
      else if(k<0.7) objs.push({x:wx,z:1,f:'stall',c:['#dc2626','#2563eb','#16a34a','#f59e0b','#7c3aed'][Math.floor(r(5)*5)]});
      else if(k<0.78&&Math.floor(wx/1400)%8===0) objs.push({x:wx,z:0,f:'church'});
      else objs.push({x:wx,z:0,f:'mango',r:4+r(3)*2});
      if(r(8)<0.55) objs.push({x:wx+r(9)*T,z:2,f:'person',c:['#dc2626','#2563eb','#f59e0b','#16a34a','#db2777'][Math.floor(r(10)*5)],sp:r(11)}); }
    else { const n=forest?(r(2)<0.75?2:1):(r(2)<0.3?2:r(2)<0.85?1:0);
      for(let j=0;j<n;j++){ const k=r(3+j), xx=wx+r(20+j)*T;
        objs.push(forest?{x:xx,z:0,f:k<0.4?'palm':'mango',h:13+r(30+j)*8,r:4.5+r(40+j)*3}:{x:xx,z:0,f:k<0.35?'acacia':k<0.5?'baobab':k<0.75?'palm':'grass',w:9+r(30+j)*5,h:10+r(40+j)*6}); } }
    if(t%8===0) objs.push({x:t*T,z:3,f:'pole'});
  }
  // panneau d'entrée de ville
  for(const st of VD.stops){ const sx=st.d-1900-Math.min(2500,st.pop); if(sx>x0&&sx<x1) objs.push({x:sx,z:3,f:'sign',txt:st.name}); }
  objs.sort((a,b)=>a.z-b.z);
  let prevPole=null;
  for(const o of objs){ const X=VD.vx+(o.x-d)*s, Y=gy;
    if(o.f==='house') vdHouse(g,X,Y-2,o.w*s,o.h*s,o.wall,o.roof,night&&vdRnd(Math.round(o.x),3)<0.7);
    else if(o.f==='bld') vdBuilding(g,X,Y-2,o.w*s,o.h*s,o.c,night);
    else if(o.f==='park') vdPark(g,X,Y,o.w*s,s,night,Math.round(o.x));
    else if(o.f==='church') vdChurch(g,X,Y-2,9*s,night);
    else if(o.f==='stall') vdStall(g,X,Y,4*s,o.c);
    else if(o.f==='kiosk') vdKiosk(g,X,Y,4*s,o.txt,o.c);
    else if(o.f==='palm') vdPalm(g,X,Y,(o.h||12)*s);
    else if(o.f==='mango') vdMango(g,X,Y,(o.r||5)*s);
    else if(o.f==='acacia') vdAcacia(g,X,Y,o.w*s);
    else if(o.f==='baobab') vdBaobab(g,X,Y,o.h*1.4*s);
    else if(o.f==='grass'){ g.strokeStyle='#a3a33b'; g.lineWidth=1.2; for(let k=0;k<6;k++){ g.beginPath(); g.moveTo(X+k*3,Y); g.lineTo(X+k*3+(k%2?3:-3),Y-6*s*0.4); g.stroke(); } }
    else if(o.f==='person') vdPerson(g,X+Math.sin(performance.now()/2000+o.sp*9)*20,Y+6,1.7*s,o.c,performance.now()/180+o.sp*9);
    else if(o.f==='pole'){ const top=Y-11*s; g.fillStyle='#5b4636'; g.fillRect(X-1.5,top,3,11*s); g.fillRect(X-6,top+3,12,2);
      if(prevPole!==null){ g.strokeStyle='rgba(30,30,30,.55)'; g.lineWidth=1; for(const dy of [3,6]){ g.beginPath(); g.moveTo(prevPole-6+12*(dy===3?0:1),top+dy); g.quadraticCurveTo((prevPole+X)/2,top+dy+10,X-6+12*(dy===3?0:1),top+dy); g.stroke(); } } prevPole=X; }
    else if(o.f==='sign'){ g.fillStyle='#4b5563'; g.fillRect(X,Y-9*s,3,9*s); g.fillRect(X+8*s,Y-9*s,3,9*s); g.fillStyle='#15803d'; g.fillRect(X-2,Y-14*s,10*s+10,6*s); g.strokeStyle='#fff'; g.lineWidth=1.5; g.strokeRect(X,Y-13.5*s,10*s+6,5*s);
      g.fillStyle='#fff'; g.font=`bold ${Math.max(9,2*s)}px sans-serif`; g.textAlign='center'; g.fillText('Bienvenue à',X+5*s+3,Y-11.3*s); g.font=`bold ${Math.max(10,2.6*s)}px sans-serif`; g.fillText(o.txt,X+5*s+3,Y-9*s); }
  }
  return town;
}
/* ---------- route, voie ferrée, rivières ---------- */
function vdRoad(g,W,H,gy){
  const s=VD.sc, d=VD.d;
  // rivière avec pont de temps en temps
  const bridge=[]; for(let t=Math.floor((d-W/s)/9000);t<=Math.floor((d+W/s)/9000)+1;t++){ if(vdRnd(t,77)<0.45) continue; const bx=t*9000+3000+vdRnd(t,78)*3000; bridge.push(bx); }
  g.fillStyle=VD.mode==='train'?'#8b7d6b':'#b45f3a'; g.fillRect(0,gy,W,H*0.02);
  for(const bx of bridge){ const X=VD.vx+(bx-d)*s, w=60*s; if(X+w<0||X-w>W) continue; g.fillStyle='#3b82f6'; g.fillRect(X-w,gy,w*2,H-gy); g.fillStyle='rgba(255,255,255,.35)'; for(let k=0;k<8;k++) g.fillRect(X-w+((k*37+performance.now()*0.02)%(w*2)),gy+20+k*9,18,2); }
  if(VD.mode==='train'){ const ry=gy+H*0.05; g.fillStyle='#8b7d6b'; g.fillRect(0,ry-4,W,14); g.fillStyle='#5b3a1a'; const sp=3*s; for(let x=-((d*s)%sp);x<W;x+=sp) g.fillRect(x,ry-2,sp*0.45,10); g.fillStyle='#9ca3af'; g.fillRect(0,ry-3,W,2.5); g.fillRect(0,ry+5,W,2.5); }
  else { const ry=gy+H*0.03, rh=H*0.07; g.fillStyle='#c9a46a'; g.fillRect(0,ry-3,W,rh+6); g.fillStyle='#3a3e44'; g.fillRect(0,ry,W,rh); g.fillStyle='#f8fafc'; const dl=8*s; for(let x=-((d*s)%(dl*2));x<W;x+=dl*2) g.fillRect(x,ry+rh/2-1,dl,2); }
  for(const bx of bridge){ const X=VD.vx+(bx-d)*s, w=60*s; if(X+w<0||X-w>W) continue; g.fillStyle='#9ca3af'; g.fillRect(X-w,gy-3,w*2,4); for(let k=0;k<=8;k++){ g.fillRect(X-w+k*w/4,gy-14,2.5,12); } g.fillRect(X-w,gy-15,w*2,2.5); }
  // herbes au premier plan
  const fy=VD.mode==='train'?gy+H*0.1:gy+H*0.12; g.fillStyle=vdForest(d)?'#2f5d27':'#8a8a3a'; g.fillRect(0,fy,W,H-fy); g.strokeStyle=vdForest(d)?'#3f7f2f':'#a8a33b'; g.lineWidth=2;
  for(let x=-((d*s*1.3)%14);x<W;x+=14){ const h=6+((Math.round(x+d*s*1.3)*7)%9); g.beginPath(); g.moveTo(x,fy+4); g.lineTo(x-3,fy+4-h); g.moveTo(x+4,fy+4); g.lineTo(x+6,fy+4-h*0.8); g.stroke(); }
}
/* ---------- véhicules ---------- */
function vdWheel(g,x,y,r,a){ g.fillStyle='#111827'; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); g.fillStyle='#9ca3af'; g.beginPath(); g.arc(x,y,r*0.45,0,7); g.fill(); g.strokeStyle='#4b5563'; g.lineWidth=1; for(let k=0;k<4;k++){ const b=a+k*Math.PI/2; g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(b)*r*0.45,y+Math.sin(b)*r*0.45); g.stroke(); } }
function vdTruck(g,x,y,s){ const col=S.company.color||'#2563eb', L=16*s, h=4*s, a=VD.d/(0.5)%(Math.PI*2), bounce=Math.sin(performance.now()/90)*0.6;
  y+=bounce; g.fillStyle='rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x+L*0.5,y+0.8*s,L*0.55,s*0.6,0,0,7); g.fill();
  // remorque
  g.fillStyle='#f1f5f9'; g.fillRect(x,y-h-0.9*s,L*0.72,h); g.fillStyle=col; g.fillRect(x,y-h*0.55-0.9*s,L*0.72,h*0.16); g.fillStyle='rgba(0,0,0,.08)'; g.fillRect(x,y-0.9*s-h*0.1,L*0.72,h*0.1);
  g.fillStyle=col; g.font=`bold ${Math.max(9,1.6*s)}px sans-serif`; g.textAlign='center'; g.fillText(`${S.company.logo||''} ${S.company.name}`.slice(0,22),x+L*0.36,y-h*0.7-0.9*s);
  // cabine
  const cx=x+L*0.74; g.fillStyle=col; g.beginPath(); g.moveTo(cx,y-0.9*s); g.lineTo(cx,y-h-0.6*s); g.lineTo(cx+L*0.15,y-h-0.6*s); g.lineTo(cx+L*0.25,y-h*0.45); g.lineTo(cx+L*0.25,y-0.9*s); g.closePath(); g.fill();
  g.fillStyle=VD.night?'#fde68a':'#bfdbfe'; g.beginPath(); g.moveTo(cx+L*0.12,y-h-0.3*s); g.lineTo(cx+L*0.16,y-h-0.3*s); g.lineTo(cx+L*0.235,y-h*0.5); g.lineTo(cx+L*0.12,y-h*0.5); g.fill();
  g.fillStyle='#1f2937'; g.fillRect(cx+L*0.23,y-h*0.42,L*0.03,h*0.3); g.fillStyle='#fef3c7'; g.fillRect(cx+L*0.245,y-h*0.38,L*0.012,h*0.1);
  g.fillStyle='#374151'; g.fillRect(x,y-1.2*s,L*0.99,0.4*s); g.fillStyle='#9ca3af'; g.fillRect(cx-L*0.01,y-h-1.4*s,L*0.012,h*0.6);
  for(const wx of [0.1,0.22,0.6,0.82,0.94]) vdWheel(g,x+L*wx,y-0.1*s,0.85*s,a);
  if(VD.night){ const bx=cx+L*0.25, by=y-h*0.33; const lg=g.createLinearGradient(bx,by,bx+28*s,by); lg.addColorStop(0,'rgba(254,243,199,.6)'); lg.addColorStop(1,'rgba(254,243,199,0)'); g.fillStyle=lg; g.beginPath(); g.moveTo(bx,by-2); g.lineTo(bx+28*s,by-8*s); g.lineTo(bx+28*s,by+7*s); g.closePath(); g.fill(); }
  // fumée d'échappement
  if(Math.random()<0.25) VD.smoke.push({x:cx-L*0.005,y:y-h-1.4*s,r:1.5,a:0.5}); }
function vdTrain(g,x,y,s){ const col=S.company.color||'#2563eb', a=VD.d/0.45%(Math.PI*2), n=VD.cars||6, wl=15*s, lh=4.4*s;
  g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x-n*wl,y+0.6*s,n*wl+wl*1.2,s*0.6);
  for(let k=1;k<=n;k++){ const wx=x-k*wl; if(wx>VD.W+50||wx+wl<-50) continue; const tank=k%3===0;
    if(tank){ g.fillStyle='#d4d4d8'; g.beginPath(); g.ellipse(wx+wl*0.5,y-lh*0.55-0.7*s,wl*0.46,lh*0.42,0,0,7); g.fill(); g.fillStyle='#71717a'; g.fillRect(wx+wl*0.47,y-lh*1.02-0.7*s,wl*0.06,lh*0.12); }
    else { g.fillStyle=k%2?col:'#7c2d12'; g.fillRect(wx+wl*0.04,y-lh-0.7*s,wl*0.92,lh); g.fillStyle='rgba(0,0,0,.15)'; for(let j=1;j<5;j++) g.fillRect(wx+wl*0.04+j*wl*0.92/5,y-lh-0.7*s,1.5,lh); if(k%2){ g.fillStyle='#fff'; g.font=`bold ${Math.max(8,1.3*s)}px sans-serif`; g.textAlign='center'; g.fillText(S.company.code||'',wx+wl*0.5,y-lh*0.45-0.7*s); } }
    g.fillStyle='#27272a'; g.fillRect(wx,y-0.9*s,wl,0.35*s); vdWheel(g,wx+wl*0.2,y-0.1*s,0.7*s,a); vdWheel(g,wx+wl*0.8,y-0.1*s,0.7*s,a); }
  // locomotive
  g.fillStyle='#f59e0b'; g.beginPath(); g.moveTo(x,y-0.7*s); g.lineTo(x,y-lh-1.4*s); g.lineTo(x+wl*0.85,y-lh-1.4*s); g.lineTo(x+wl*1.05,y-lh*0.55); g.lineTo(x+wl*1.05,y-0.7*s); g.fill();
  g.fillStyle='#b91c1c'; g.fillRect(x,y-lh*0.62-0.7*s,wl*1.05,lh*0.22); g.fillStyle=VD.night?'#fde68a':'#bfdbfe'; g.fillRect(x+wl*0.72,y-lh-1.1*s,wl*0.14,lh*0.32);
  g.fillStyle='#fff'; g.font=`bold ${Math.max(8,1.3*s)}px sans-serif`; g.textAlign='center'; g.fillText(S.company.code||'SE',x+wl*0.4,y-lh*0.47-0.7*s);
  for(const wx of [0.15,0.38,0.62,0.85]) vdWheel(g,x+wl*wx,y-0.1*s,0.75*s,a);
  if(VD.night){ const bx=x+wl*1.05, by=y-lh*0.7; const lg=g.createLinearGradient(bx,by,bx+40*s,by); lg.addColorStop(0,'rgba(254,243,199,.65)'); lg.addColorStop(1,'rgba(254,243,199,0)'); g.fillStyle=lg; g.beginPath(); g.moveTo(bx,by-2); g.lineTo(bx+40*s,by-10*s); g.lineTo(bx+40*s,by+9*s); g.closePath(); g.fill(); }
  if(Math.random()<0.3) VD.smoke.push({x:x+wl*0.3,y:y-lh-1.6*s,r:2,a:0.55}); }

/* ---------- image ---------- */
function vdDraw(){
  const g=VD.ctx, W=VD.W, H=VD.H; if(!g) return; const s=VD.sc;
  vdSky(g,W,H);
  const forest=vdForest(VD.d), night=VD.night, dim=c=>night?vdMix(c,'#0b1026',0.55):c;
  vdHills(g,W,H,0.03,H*0.42,H*0.06,520,dim(forest?'#6b8fb3':'#a8b4c8'),1);
  vdHills(g,W,H,0.08,H*0.5,H*0.06,260,dim(forest?'#3f6b4a':'#9aa36a'),3);
  // silhouettes de forêt ou de savane au loin
  { const f=0.18, off=VD.d*f, sp=forest?14:40; g.fillStyle=dim(forest?'#24452c':'#6b7a3a');
    for(let wx=Math.floor((off-20)/sp)*sp; (wx-off)*s<W+40; wx+=sp){ const X=(wx-off)*s, r=vdRnd(Math.round(wx),5); if(forest){ g.beginPath(); g.arc(X,H*0.57,(5+r*6)*s*0.5,0,7); g.arc(X+6,H*0.575,(4+r*5)*s*0.5,0,7); g.fill(); } else if(r<0.6) vdAcacia(g,X,H*0.58,(6+r*4)*s*0.7,dim('#5f6b35')); } }
  vdSkyline(g,W,H,night);
  vdHills(g,W,H,0.3,H*0.6,H*0.025,140,dim(forest?'#3d7a35':'#b5a35a'),5);
  const gy=H*0.66; g.fillStyle=dim(forest?'#4a8a3a':'#c2b06a'); g.fillRect(0,H*0.6,W,gy-H*0.6+4);
  const town=vdNear(g,W,H,gy);
  vdRoad(g,W,H,gy);
  // circulation en face (camions) sur la route
  if(VD.mode!=='train'){ const ry=gy+H*0.03+H*0.035; for(let k=0;k<3;k++){ const per=900, wx=((VD.d*2.1+k*300)%per); const X=W+60-(wx/per)*(W+200); g.fillStyle=['#e5e7eb','#facc15','#16a34a'][k]; g.fillRect(X,ry-3.2*s,7*s,2.6*s); g.fillStyle='#1d4ed8'; g.fillRect(X-2.2*s,ry-3.2*s,2.4*s,2.6*s); vdWheel(g,X-1*s,ry-0.4*s,0.6*s,0); vdWheel(g,X+5.5*s,ry-0.4*s,0.6*s,0); } }
  const vy=VD.mode==='train'?gy+H*0.05+3:gy+H*0.03+H*0.06;
  if(VD.mode==='train') vdTrain(g,VD.vx,vy,s); else vdTruck(g,VD.vx-16*s*0.5,vy,s);
  vdFront(g,W,H,VD.mode==='train'?gy+H*0.1:gy+H*0.12,night);
  for(const p of VD.smoke){ g.fillStyle=`rgba(${night?'200,200,210':'120,120,120'},${p.a})`; g.beginPath(); g.arc(p.x,p.y,p.r,0,7); g.fill(); }
  if(night){ g.fillStyle='rgba(11,16,38,.18)'; g.fillRect(0,0,W,H); }
  return town;
}
/* ---------- bandeau ---------- */
function vdHud(town){ const el=document.getElementById('vdHud'); if(!el) return; const A=VD.stops[0], B=VD.stops[VD.stops.length-1], km=Math.round(VD.d/1000), tot=Math.round(VD.len/1000), h=vdHour();
  const marks=VD.stops.map(st=>`<i style="left:${st.d/VD.len*100}%" title="${esc(st.name)}"></i>`).join('');
  el.querySelector('.vdTop').innerHTML=`<b>${VD.mode==='train'?'🚆':'🚚'} ${esc(A.name)} → ${esc(B.name)}</b><span>${km} / ${tot} km · 🕒 ${String(Math.floor(h)).padStart(2,'0')}:${String(Math.floor(h%1*60)).padStart(2,'0')}${town?` · 📍 ${esc(town.name)}`:''}</span>`;
  el.querySelector('.vdBar').innerHTML=`<div style="width:${VD.d/VD.len*100}%"></div>${marks}`;
  el.querySelectorAll('[data-k]').forEach(b=>b.classList.toggle('on',+b.dataset.k===VD.sp)); }
/* ---------- boucle ---------- */
function vdLoop(t){
  if(!VD.on) return; const dt=Math.min(0.1,(t-(VD.last||t))/1000); VD.last=t;
  const base=VD.mode==='train'?13:18; VD.d=Math.min(VD.len,VD.d+base*VD.sp*dt);
  for(const p of VD.smoke){ p.x-=(base*Math.min(VD.sp,10)*VD.sc*0.6+12)*dt; p.y-=14*dt; p.r+=9*dt; p.a-=0.35*dt; } VD.smoke=VD.smoke.filter(p=>p.a>0).slice(-40);
  const town=vdDraw(); if(t-(VD.hudT||0)>250){ VD.hudT=t; vdHud(town); }
  if(VD.d>=VD.len){ vdArrive(); return; }
  VD.raf=requestAnimationFrame(vdLoop);
}
function vdResize(){ const cv=VD.cv; if(!cv) return; const dpr=Math.min(2,window.devicePixelRatio||1); VD.W=cv.clientWidth; VD.H=cv.clientHeight; cv.width=VD.W*dpr; cv.height=VD.H*dpr; VD.ctx=cv.getContext('2d'); VD.ctx.setTransform(dpr,0,0,dpr,0,0); VD.sc=Math.max(3.2,Math.min(VD.W/(VD.H>VD.W?70:95),VD.H/60)); VD.vx=VD.W*(VD.mode==='train'?0.62:0.36); }
function vdArrive(){ const B=VD.stops[VD.stops.length-1], L=VD.line, info=VD.cargo;
  const el=document.getElementById('vdHud'); if(el) el.querySelector('.vdEnd').innerHTML=`<div class="vdDone">🏁 <b>Arrivée à ${esc(B.name)} !</b><br>${info?`📦 ${num(info.tons)} t de ${esc(info.cargo)} livrées.`:''}${L&&L.last?`<br>Cette ligne a rapporté ${fmtMoney(L.last.rev-L.last.cost)} la semaine dernière.`:''}<div class="btns"><button class="btn gold" data-act="vdAgain">🔁 Refaire le voyage</button><button class="btn" data-act="vdClose">Fermer</button></div></div>`; }
function vdStart(mode,lineId,vk){
  const X=S.tr&&S.tr[mode], line=X&&X.lines.find(l=>String(l.id)===String(lineId)); if(!line) return err('Ligne introuvable'); const path=vdBuild(mode,line); if(!path) return err('Route introuvable');
  closeModal(); if(typeof close3D==='function'&&!$('#globe').hidden) try{ close3D(); }catch(e){}
  const veh=X.fleet.find(v=>String(v.line)===String(line.id)), V0=veh&&trVeh(mode,veh.k), hsh=veh?tkHash(veh.id):7;
  Object.assign(VD,{on:true,mode,line,path,len:path.len,stops:path.stops,d:0,sp:VD.sp||10,last:0,smoke:[],cars:mode==='train'?(GQ.mob?6:9):0,h0:((S.time/3600e3)%24+24)%24,
    cargo:V0?{tons:Math.round(V0.cap*(mode==='train'?0.85:0.75)),cargo:typeof TK_GOODS!=='undefined'?TK_GOODS[hsh%TK_GOODS.length]:'marchandises'}:null});
  let ov=document.getElementById('vdOv'); if(ov) ov.remove(); ov=document.createElement('div'); ov.id='vdOv';
  ov.innerHTML=`<canvas id="vdCv"></canvas><div id="vdHud"><div class="vdTop"></div><div class="vdBar"></div><div class="vdBtns">${[1,10,50,200].map(x=>`<button class="chip" data-act="vdSp" data-k="${x}">×${x}</button>`).join('')}<button class="chip" data-act="vdClose">✖ Quitter</button></div><div class="vdEnd"></div></div>`;
  document.body.appendChild(ov); document.body.classList.add('voyage2d'); VD.cv=ov.querySelector('canvas'); vdResize(); window.addEventListener('resize',vdResize);
  cancelAnimationFrame(VD.raf); VD.raf=requestAnimationFrame(vdLoop);
}
function vdClose(){ VD.on=false; cancelAnimationFrame(VD.raf); window.removeEventListener('resize',vdResize); const ov=document.getElementById('vdOv'); if(ov) ov.remove(); document.body.classList.remove('voyage2d'); }
function registerVoyage2dActions(){
  Object.assign(ACTIONS,{
    vyGo:d=>vdStart(d.m,d.id,d.k),   // le voyage est maintenant illustré (2D)
    vdSp:d=>{ VD.sp=+d.k; },
    vdClose:()=>vdClose(),
    vdAgain:()=>{ const m=VD.mode, id=VD.line&&VD.line.id; vdClose(); if(id) vdStart(m,id); },
  });
}
