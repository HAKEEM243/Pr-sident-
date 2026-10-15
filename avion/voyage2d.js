/* =========================================================
   Sky Empire — 🎬 Voyage illustré (2D) en camion ou en train
   Une vue de côté dessinée, façon jeu mobile illustré :
   - lumière qui suit l'heure (aube dorée, plein jour, coucher,
     nuit bleutée où seules les lumières brillent), ombres portées,
     brume du matin, pluie tropicale de temps en temps ;
   - profondeur : montagnes bleutées, collines, villages lointains,
     bord de route détaillé, premier plan qui défile plus vite ;
   - forêt équatoriale près de l'équateur, savane ailleurs ;
   - villages (maisons en briques de terre et toits de paille ou de
     tôle, feu de cuisine, linge, chèvres, mamans avec bassines),
     villes (boutiques peintes, immeubles, jardins publics,
     lampadaires, station-service, panneau de votre compagnie) ;
   - route goudronnée ou piste en latérite rouge, bornes
     kilométriques, rivières en perspective avec pont et pirogue ;
   - circulation : taxis-bus jaunes, motos-taxis, camions chargés
     de sacs et de passagers, pick-up, vélos chargés de charbon.
   Léger : un seul canvas 2D, aucune 3D.
   ========================================================= */
'use strict';
const VD={on:false, raf:0, d:0, sp:10, last:0, tt:0, mode:'truck', line:null, len:1, stops:[], path:null, cv:null, ctx:null, W:0, H:0, smoke:[], h0:8, glow:[], win:[], beams:[]};
const vdRnd=(a,b)=>{ let h=(a*374761393+b*668265263+0x9e3779b9)|0; h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16; return (h>>>0)/4294967296; };
const vdLerp=(a,b,t)=>a+(b-a)*t;
const vdCl=(v,a,b)=>v<a?a:v>b?b:v;
const VD_MC=new Map();
const vdHex=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
const vdH2=a=>'#'+a.map(v=>Math.round(vdCl(v,0,255)).toString(16).padStart(2,'0')).join('');
function vdMix(c1,c2,t){ t=Math.round(vdCl(t,0,1)*40)/40; if(t===0) return c1; if(t===1) return c2; const k=c1+c2+t; let r=VD_MC.get(k); if(r) return r;
  const a=vdHex(c1), b=vdHex(c2); r=vdH2(a.map((v,i)=>vdLerp(v,b[i],t))); if(VD_MC.size>6000) VD_MC.clear(); VD_MC.set(k,r); return r; }
const vdDk=(c,k)=>vdMix(c,'#000000',k), vdLt=(c,k)=>vdMix(c,'#ffffff',k);
// couleur « avant teinte » : ce qui est dessiné sous le filtre de lumière (multiply) ressort avec la couleur voulue
function vdPre(c){ const k='p'+c+VD.T; let r=VD_MC.get(k); if(r) return r; const a=vdHex(c), t=vdHex(VD.T); r=vdH2(a.map((v,i)=>v*255/Math.max(1,t[i]))); VD_MC.set(k,r); return r; }
function vdRR(g,x,y,w,h,r){ r=Math.min(r,w/2,h/2); g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function vdBlobs(g,col,list){ g.fillStyle=col; g.beginPath(); for(const [x,y,r] of list){ g.moveTo(x+r,y); g.arc(x,y,r,0,6.2832); } g.fill(); }
const vdMob=()=>typeof GQ!=='undefined'&&GQ&&GQ.mob;
function vdLight(x,y,r,a,rgb){ if(VD.glow.length<90) VD.glow.push([x,y,r,a==null?0.5:a,rgb||'255,214,140']); }
function vdWin(x,y,w,h){ if(VD.win.length<2500) VD.win.push([x,y,w,h]); }

/* ---------- le parcours ---------- */
function vdBuild(mode,line){
  const p=typeof trLinePath==='function'?trLinePath(mode,line):trPath(mode,line.a,line.b); if(!p) return null;
  const k=mode==='train'?1.15:mode==='boat'?(p.kind==='river'?1.45:1.2):1.35, cum=[0]; for(let i=1;i<p.pts.length;i++) cum.push(cum[i-1]+trGc(p.pts[i-1],p.pts[i])*1000*k);
  return {len:cum[cum.length-1], stops:p.pts.map((n,i)=>({name:n.name, d:cum[i], pop:n.popK||50, lat:n.lat, lon:n.lon, cc:n.cc||'CD'})), pts:p.pts, cum, kind:p.kind};
}
function vdPosAt(d){ const P=VD.path; for(let i=1;i<P.cum.length;i++) if(d<=P.cum[i]){ const f=(d-P.cum[i-1])/Math.max(1,P.cum[i]-P.cum[i-1]); return {lat:vdLerp(P.pts[i-1].lat,P.pts[i].lat,f),lon:vdLerp(P.pts[i-1].lon,P.pts[i].lon,f)}; } const q=P.pts[P.pts.length-1]; return {lat:q.lat,lon:q.lon}; }
const vdLatAt=d=>vdPosAt(d).lat;
const vdForestK=d=>Math.min(VD.fkMax==null?1:VD.fkMax,vdCl((3.6-Math.abs(vdLatAt(d)))/0.8,0,1));
/* ---------- régions : chaque coin du Congo a son décor ---------- */
const VD_REG={
  bas:{n:'🌴 Bas-Congo',d:'collines vertes, manguiers, le fleuve',tint:'#7fae55',tk:0.35,mt:1.15,fk:1,dirt:['#c46a3a','#9a4b26']},
  ouest:{n:'🌾 Kwango-Kwilu',d:'plateaux de savane, champs de manioc',tint:'#c9b46e',tk:0.2,mt:0.55,fk:1,dirt:['#d08a4a','#a8662e']},
  kasai:{n:'💎 Kasaï',d:'terre de sable, ravins et creuseurs de diamants',tint:'#e2b878',tk:0.45,mt:0.5,fk:0.6,dirt:['#e0a463','#b97a3e']},
  katanga:{n:'⛏️ Katanga',d:'pays du cuivre : mines, terrils, camions-citernes',tint:'#a97a45',tk:0.35,mt:0.7,fk:0,dirt:['#a0522d','#7a3b1f']},
  kivu:{n:'🌋 Kivu',d:'volcans, lac et collines de thé',tint:'#3f8f3a',tk:0.5,mt:1.7,fk:0.3,volc:1,lake:1,dirt:['#5a4636','#3f3128']},
  tanganyika:{n:'🌊 Tanganyika',d:'au bord du grand lac',tint:'#6f9a4a',tk:0.35,mt:1.3,fk:0.2,lake:1,dirt:['#b5652e','#8a4a22']},
  cuvette:{n:'🌳 Cuvette centrale',d:'grande forêt et palmeraies',tint:'#2f6b2a',tk:0.2,mt:0.35,fk:1,dirt:['#b5562c','#8f4221']},
  desert:{n:'🏜️ Sahara',d:'dunes, oasis et palmiers-dattiers',tint:'#e8c98c',tk:0.75,mt:0.45,fk:0,dirt:['#e2b878','#c49a5a'],desert:1},
  sahel:{n:'🌵 Sahel',d:'savane sèche et baobabs',tint:'#d9bb7a',tk:0.55,mt:0.4,fk:0,dirt:['#d9a066','#b07a42']},
  est:{n:'🦒 Afrique de l’Est',d:'hauts plateaux, acacias et grands parcs',tint:'#b9a65e',tk:0.4,mt:1.4,fk:0.2,dirt:['#b5562c','#8a3f20']},
  austral:{n:'🌄 Afrique australe',d:'veld, collines sèches et grandes routes',tint:'#c2ae6a',tk:0.45,mt:0.9,fk:0,dirt:['#c27a46','#9a5a30']},
  ouestaf:{n:'🌴 Afrique de l’Ouest',d:'palmeraies, villes animées, latérite',tint:'#6f9a3a',tk:0.3,mt:0.4,fk:0.8,dirt:['#c4552a','#963f1e']},
  nord:{n:'🌾 Savane du Nord',d:'hautes herbes et cases rondes',tint:'#d0b45a',tk:0.35,mt:0.45,fk:0.4,dirt:['#c46a3a','#9a4b26']},
};
function vdRegionAt(d){ const {lat,lon}=vdPosAt(d);
  if(lat>17) return 'desert'; if(lat>12.5) return 'sahel'; if(lat<-17.5) return 'austral'; if(lon>30.8&&lat<6) return 'est'; if(lon<9&&lat>3) return 'ouestaf'; if(lon>30&&lat>=6) return 'sahel';
  if(lon>27.6&&lat>-4.2&&lat<1.2) return 'kivu'; if(lon>27.6&&lat<=-4.2&&lat>-8.5) return 'tanganyika'; if(lat<-8.3&&lon>22) return 'katanga';
  if(lon<16.6&&lat<-3.8) return 'bas'; if(lon>=19.8&&lon<=25.6&&lat<-3.5) return 'kasai'; if(lat>3) return 'nord'; if(Math.abs(lat)<2.6&&lon>16.5) return 'cuvette'; return 'ouest'; }
function vdRegionTick(dt){ const r=vdRegionAt(VD.d); if(!VD.rg){ VD.rg=VD.rgP=r; VD.rgK=1; } if(r!==VD.rg){ VD.rgP=VD.rg; VD.rg=r; VD.rgK=0; } VD.rgK=Math.min(1,VD.rgK+dt*0.6);
  const A=VD_REG[VD.rgP], B=VD_REG[VD.rg], k=VD.rgK; VD.R=B; VD.tint=vdMix(A.tint,B.tint,k); VD.tk=vdLerp(A.tk,B.tk,k); VD.mtA=vdLerp(A.mt,B.mt,k); VD.fkMax=vdLerp(A.fk,B.fk,k); VD.volc=vdLerp(A.volc||0,B.volc||0,k); VD.lake=vdLerp(A.lake||0,B.lake||0,k);
  VD.dirtC=[vdMix(A.dirt[0],B.dirt[0],k),vdMix(A.dirt[1],B.dirt[1],k)]; }   // près de l'équateur : forêt dense ; ailleurs : savane
const vdForest=d=>vdForestK(d)>0.5;
const VD_TR=st=>1500+Math.min(2500,st.pop);
const VD_COAST=/banana|moanda|muanda|pointe-noire|luanda|lobito|benguela|namibe|lagos|abidjan|dakar|accra|lom[eé]|cotonou|douala|kribi|libreville|port-gentil|dar es salaam|mombasa|tanga|durban|le cap|cape town|port elizabeth|gqeberha|east london|maputo|beira|nacala|alger|oran|annaba|tunis|sfax|sousse|casablanca|rabat|tanger|agadir|alexandrie|port-sa[iï]d|djibouti|mogadiscio|conakry|freetown|monrovia|nouakchott|banjul|bissau|walvis|port-soudan|massaoua|tripoli|benghazi|takoradi|lamu|malindi|kilwa|mtwara|quelimane|inhambane|swakopmund|saint-louis|ziguinchor|san-p[eé]dro|grand-bassam|calabar|port harcourt|warri|limbe|bata|cabinda|soyo/i;
function vdZone(w){ for(const st of VD.stops){ const k=Math.abs(st.d-w), R=VD_TR(st); if(k<R) return {t:'town',st,slum:st.pop>=500&&k>R-900}; if(st.pop>=500&&k<R+700) return {t:'town',st,slum:true}; }
  const v=Math.floor(w/1400); if(v%4===0&&(w-v*1400)<450) return {t:'village'}; return {t:'wild'}; }
function vdRoadType(w){ if(VD.mode==='train') return 'rail';
  for(const st of VD.stops){ const k=Math.abs(st.d-w), R=VD_TR(st); if(k<R+2500) return 'tar'; if(st.pop>=800&&k<R+22000) return 'auto'; }   // en ville : rues ; sortie des grandes villes : autoroute
  const seg=Math.floor(w/15000); return vdRnd(seg,5)<VD.dirtP?'dirt':vdRnd(seg,6)<0.22?'auto':'tar'; }
const VD_ROADNAME={auto:'🛣️ autoroute à 2×2 voies',tar:'🛣️ route à deux voies',dirt:'🟫 piste en terre'};
// rivières : franchies tous les ~9 km (une sur deux environ)
function vdRivers(wL,wR){ const out=[]; for(let t=Math.floor(wL/9000)-1;t<=Math.floor(wR/9000)+1;t++){ if(vdRnd(t,77)<0.45) continue; const bx=t*9000+3000+vdRnd(t,78)*3000; if(VD.stops.some(st=>Math.abs(st.d-bx)<VD_TR(st))) continue; out.push(bx); } return out; }
const VD_RIVW=28;   // demi-largeur au premier plan

/* ---------- heure, lumière, météo ---------- */
function vdHour(){ return (VD.h0+VD.d/1000/(VD.mode==='train'?40:60))%24; }   // le temps du voyage avance avec les kilomètres
function vdAmbience(){ const h=vdHour();
  const dark=h<5?1:h<6.6?(6.6-h)/1.6:h<17.8?0:h<19.8?(h-17.8)/2:1;
  const gold=Math.min(1,Math.max(0,1-Math.abs(h-6.7)/1.2)+Math.max(0,1-Math.abs(h-18)/1.2));
  const seg=Math.floor(VD.d/25000), f=(VD.d-seg*25000)/25000, rain=(seg>0&&vdRnd(seg,99)<0.16)?Math.min(1,Math.min(f,1-f)*8):0;
  const dseg=Math.floor(VD.d/40000), df=(VD.d-dseg*40000)/40000, dust=(VD.rg==='desert'||VD.rg==='sahel')&&vdRnd(dseg,77)<0.45?Math.min(1,Math.min(df,1-df)*6):0;
  let T='#ffffff'; T=vdMix(T,'#ffd6a8',gold*0.55*(1-rain)); T=vdMix(T,'#aab3c4',rain*0.55); T=vdMix(T,'#ecc99a',dust*0.45); T=vdMix(T,'#4a5899',dark*0.88);
  Object.assign(VD,{h,dark:vdCl(dark,0,1),gold:gold*(1-rain),rain,dust,night:dark>0.5,T}); }

/* ---------- ciel ---------- */
const VD_SKY=[[0,'#060a1c','#111a36','#1c2646'],[4.8,'#0a1128','#1b2850','#2f3d68'],[5.8,'#28305e','#7a5a8c','#f0a46a'],[6.7,'#3d6fb0','#9cc0e0','#ffd59a'],[8,'#2f74d0','#7fb2ea','#cfe6f7'],[15.5,'#2f6fd0','#86b8ec','#d6eaf8'],[17.3,'#3a5fa8','#d99a6a','#ffc477'],[18.3,'#2d2f6b','#b55a7a','#ff8a4c'],[19.3,'#121a3c','#3b2e5e','#7a4a6a'],[20.2,'#060a1c','#111a36','#1c2646'],[24,'#060a1c','#111a36','#1c2646']];
function vdSky(g,W,H){
  const h=VD.h; let i=0; while(i<VD_SKY.length-2&&h>=VD_SKY[i+1][0]) i++; const t=(h-VD_SKY[i][0])/(VD_SKY[i+1][0]-VD_SKY[i][0]);
  let [top,mid,hor]=[1,2,3].map(j=>vdMix(VD_SKY[i][j],VD_SKY[i+1][j],t));
  if(VD.dust){ top=vdMix(top,'#c9a477',VD.dust*0.6); mid=vdMix(mid,'#d9b88a',VD.dust*0.7); hor=vdMix(hor,'#e6caa0',VD.dust*0.8); }
  if(VD.rain){ top=vdMix(top,'#4b5563',VD.rain*0.8); mid=vdMix(mid,'#6b7280',VD.rain*0.8); hor=vdMix(hor,'#9ca3af',VD.rain*0.7); }
  VD.skyH=hor; VD.skyM=mid;
  const gr=g.createLinearGradient(0,0,0,VD.gy); gr.addColorStop(0,vdPre(top)); gr.addColorStop(0.55,vdPre(mid)); gr.addColorStop(1,vdPre(hor)); g.fillStyle=gr; g.fillRect(0,0,W,VD.gy+2);
  // soleil
  VD.sun=null;
  if(h>5.6&&h<18.9){ const a=(h-5.6)/13.3, sx=W*(0.08+0.84*a), sy=VD.hz-Math.sin(a*Math.PI)*VD.hz*0.82, low=1-Math.sin(a*Math.PI), R=Math.min(W,H)*0.045;
    const sg=g.createRadialGradient(sx,sy,0,sx,sy,R*7); sg.addColorStop(0,`rgba(255,${Math.round(236-low*80)},${Math.round(190-low*130)},${0.6*(1-VD.rain)})`); sg.addColorStop(1,'rgba(255,190,110,0)'); g.fillStyle=sg; g.fillRect(sx-R*7,sy-R*7,R*14,R*14);
    g.globalAlpha=1-VD.rain*0.9; g.fillStyle=vdPre(low>0.7?'#ffb26b':'#fff8dc'); g.beginPath(); g.arc(sx,sy,R,0,7); g.fill(); g.globalAlpha=1; VD.sun={x:sx,y:sy,low}; }
  // nuages : dessous ombré, bords éclairés
  const n=VD.rain?9:6, cTop=vdMix(vdMix('#ffffff','#ffcf9e',VD.gold),'#59627e',Math.max(VD.dark*0.8,VD.rain*0.5)), cSh=vdMix(vdMix('#c8d4e6','#b9728a',VD.gold),'#2b3150',Math.max(VD.dark*0.8,VD.rain*0.7));
  for(let k=0;k<n;k++){ const sp=0.5+vdRnd(k,3), span=W*1.8, x=((vdRnd(k,9)*span-(VD.d*0.015+VD.tt*0.6)*sp)%span+span)%span-W*0.4, y=VD.hz*(0.1+vdRnd(k,4)*0.55), s=(0.6+vdRnd(k,5)*0.9)*Math.min(W,H)/390*(VD.rain?1.4:1);
    vdCloud(g,x,y,s,vdPre(cTop),vdPre(cSh),k); }
  { const seg=Math.floor(VD.d/25000), f=(VD.d-seg*25000)/25000; if(seg>1&&vdRnd(seg-1,99)<0.16&&!(vdRnd(seg,99)<0.16)&&f<0.3&&VD.dark<0.3&&VD.sun){ const a=(1-f/0.3)*0.4*(1-VD.dark/0.3), cx=VD.sun.x<W/2?W*0.72:W*0.28, R2=Math.min(W,H)*0.6, lw=Math.max(3,R2*0.02); g.lineWidth=lw;
    ['#ff3b30','#ff9500','#ffe600','#34c759','#0a84ff','#5856d6','#af52de'].forEach((c,i)=>{ g.strokeStyle=c; g.globalAlpha=a; g.beginPath(); g.arc(cx,VD.hz+30,R2-i*lw,Math.PI,0); g.stroke(); }); g.globalAlpha=1; VD.rainbow=true; } else VD.rainbow=false; }
  { const c=vdPre(vdMix(vdMix('#ffffff','#ffd2a8',VD.gold),'#5a6380',Math.max(VD.dark*0.8,VD.rain*0.5))); g.fillStyle=c; g.globalAlpha=0.75;
    for(let k=0;k<7;k++){ const span=W*1.6, x=((vdRnd(k,61)*span-(VD.d*0.006+VD.tt*0.25)*(0.6+vdRnd(k,62)))%span+span)%span-W*0.3, y=VD.hz*(0.72+vdRnd(k,63)*0.2), w=(30+vdRnd(k,64)*60)*Math.min(W,H)/390;
      g.beginPath(); g.ellipse(x,y,w,w*0.12,0,0,7); g.ellipse(x+w*0.3,y-w*0.06,w*0.45,w*0.1,0,0,7); g.fill(); } g.globalAlpha=1; }
  // oiseaux le jour
  if(VD.dark<0.4&&!VD.rain){ g.strokeStyle=vdPre('#1f2937'); g.lineWidth=1.4; g.beginPath();
    for(let k=0;k<6;k++){ const fx=((VD.tt*7+k*13+vdRnd(Math.floor(VD.tt/90),k)*40)%(W/4+120))*4-120, fy=VD.hz*0.4+Math.sin(VD.tt*0.4+k)*12+(k%3)*14, fl=Math.sin(VD.tt*9+k*2)*3.5;
      g.moveTo(fx-6,fy-fl); g.quadraticCurveTo(fx-2.5,fy-3,fx,fy); g.quadraticCurveTo(fx+2.5,fy-3,fx+6,fy-fl); } g.stroke(); }
}
function vdCloud(g,x,y,s,c,sh,k){ const P=[[0,0,1],[-1.15,0.3,0.68],[1.15,0.25,0.74],[-0.5,-0.4,0.74],[0.6,-0.45,0.82],[1.95,0.42,0.48],[-1.95,0.45,0.44]], u=s*17, flat=y+u*0.62;
  g.save(); g.beginPath(); g.rect(x-u*3,y-u*2,u*6,flat-(y-u*2)); g.clip();
  vdBlobs(g,sh,P.map(([a,b,r])=>[x+a*u,y+b*u+u*0.18,r*u]));
  vdBlobs(g,c,P.map(([a,b,r])=>[x+a*u-u*0.08,y+b*u-u*0.06,r*u*0.86]));
  g.restore(); }

/* ---------- reliefs lointains ---------- */
function vdRidge(g,f,base,amp,per,seed,c1,c2,rough){ const s=VD.sc, off=VD.d*f, W=VD.W;
  const gr=g.createLinearGradient(0,base-amp,0,base+amp*0.6); gr.addColorStop(0,c1); gr.addColorStop(1,c2); g.fillStyle=gr; g.beginPath(); g.moveTo(0,VD.H);
  for(let x=0;x<=W+6;x+=6){ const wx=(x/s+off)/per; g.lineTo(x,base-amp*(0.55*Math.sin(wx+seed)+0.3*Math.sin(wx*2.3+seed*2)+(rough||0.15)*Math.sin(wx*5.1+seed*3)+0.06*Math.sin(wx*13+seed))); }
  g.lineTo(W,VD.H); g.closePath(); g.fill(); }
function vdBiome(c1,c2){ return vdMix(VD.tint?vdMix(c2,VD.tint,VD.tk):c2,c1,VD.fk); }   // c1 forêt, c2 savane
function vdHaze(c,k){ return vdMix(c,vdPre(VD.skyH),k); }
function vdBack(g,W,H){
  const hz=VD.hz, gy=VD.gy, dep=gy-hz;
  // montagnes très loin
  const mb=hz-dep*0.05, ma=Math.min(H*(H>W?0.11:0.07),dep*0.55)*(VD.mtA||1); VD.mtTop=mb-ma*1.15;
  if(VD.oceanOnly){ VD.mtTop=hz-dep*0.3; return; }
  if(VD.volc>0.05) vdVolcans(g,W,mb,ma);
  vdRidge(g,0.012,mb,ma,22,1,vdHaze(vdBiome('#46679a','#6f80a8'),0.3),vdHaze(vdBiome('#46679a','#6f80a8'),0.55),0.25);
  // brume du matin
  if(VD.h>5&&VD.h<9&&!VD.dark){ const a=(1-Math.abs(VD.h-6.8)/2.2)*0.55; if(a>0){ const mg=g.createLinearGradient(0,mb-ma,0,hz+dep*0.3); mg.addColorStop(0,'rgba(255,255,255,0)'); mg.addColorStop(0.6,`rgba(255,250,240,${a})`); mg.addColorStop(1,'rgba(255,250,240,0)'); g.fillStyle=mg; g.fillRect(0,mb-ma,W,ma+dep*0.3+(hz-mb)); } }
  vdRidge(g,0.05,hz+dep*0.04,dep*0.22,13,3,vdHaze(vdBiome('#3c6b55','#97a274'),0.38),vdHaze(vdBiome('#2f5f45','#8e9a62'),0.5));
  // lisière lointaine : canopée de forêt ou acacias épars
  { const f=0.14, off=VD.d*f, s=VD.sc, sp=VD.fk>0.5?9:34, y=hz+dep*0.12, c=vdHaze(vdBiome('#2a5236','#6f7c40'),0.35); const L=[];
    for(let wx=Math.floor((off-VD.vx/s-30)/sp)*sp; VD.vx+(wx-off)*s<W+40; wx+=sp){ const X=VD.vx+(wx-off)*s, r=vdRnd(Math.round(wx),5);
      if(VD.fk>0.5){ L.push([X,y-r*s*1.6,(3+r*3.5)*s*0.55]); L.push([X+sp*s*0.5,y-s*0.6,(2.6+r*2)*s*0.55]); }
      else if(r<0.55) vdAcacia(g,X,y+s,(7+r*5)*s*0.45,c,true); }
    if(L.length) vdBlobs(g,c,L); g.fillStyle=c; g.fillRect(0,y-1,W,dep*0.1); }
  vdSkyline(g,W,H);
  // sol : du lointain brumeux au premier plan
  const gb=vdBiome('#4f8a3c','#c3ae68'), gr=g.createLinearGradient(0,hz+dep*0.15,0,gy); gr.addColorStop(0,vdHaze(gb,0.3)); gr.addColorStop(1,vdDk(gb,0.04)); g.fillStyle=gr; g.fillRect(0,hz+dep*0.15,W,VD.H-(hz+dep*0.15));
  let ck=0; for(const st of VD.stops) if(VD_COAST.test(st.name)) ck=Math.max(ck,1-Math.abs(st.d-VD.d)/14000); VD.coastK=ck;
  if(ck>0&&VD.mode!=='boat') vdSea(g,W,hz,dep,ck);
  const fl=VD.mode==='boat'?1:Math.max(ck>0.3?1:0,vdFleuve(g,W,hz,dep)); vdLandmarks(g,W,hz,dep,fl);
  // champs en rangées au loin (manioc, maïs)
  if(fl<0.3){ const f=0.32, off=VD.d*f, s=VD.sc, y0=hz+dep*0.22, y1=hz+dep*0.4;
    for(let t=Math.floor((off-VD.vx/s-60)/60);t*60<off+(W-VD.vx)/s+60;t++){ if(vdRnd(t,61)<0.55) continue; const X=VD.vx+(t*60-off)*s, w=(25+vdRnd(t,62)*30)*s; g.fillStyle=vdHaze(vdRnd(t,63)<0.5?'#6f9a3a':'#a88a4a',0.3);
      g.beginPath(); g.moveTo(X,y1); g.lineTo(X+w,y1); g.lineTo(X+w*0.92,y0); g.lineTo(X+w*0.08,y0); g.fill(); g.strokeStyle=vdHaze('#4f7a2a',0.35); g.lineWidth=1; g.beginPath(); for(let j=1;j<5;j++){ const yy=y0+(y1-y0)*j/5; g.moveTo(X+w*0.08*(1-j/5),yy); g.lineTo(X+w-w*0.08*(1-j/5),yy); } g.stroke(); } }
}
const VD_RIVERCITY=/kinshasa|matadi|boma|kisangani|mbandaka|brazzaville|kindu|bumba|lisala|ilebo|bandundu|kwamouth|ubundu|banana|moanda/i;
function vdSea(g,W,hz,dep,a){ const s=VD.sc, y0=hz-dep*0.04, y1=hz+dep*0.36; g.save(); g.globalAlpha=Math.min(1,a*1.8);
  const gr=g.createLinearGradient(0,y0,0,y1); gr.addColorStop(0,vdPre(vdMix(VD.skyH,'#7fb8d8',0.4))); gr.addColorStop(0.5,'#2f8fb5'); gr.addColorStop(1,'#4fc3c9'); g.fillStyle=gr; g.fillRect(0,y0,W,y1-y0);
  if(VD.sun&&!VD.rain){ g.fillStyle='rgba(255,245,210,.35)'; for(let k=0;k<10;k++){ const yy=y0+(y1-y0)*k/10, ww=(4+k*2.5)*(0.7+0.3*Math.sin(VD.tt*2+k)); g.fillRect(VD.sun.x-ww,yy,ww*2,1.3); } }
  g.strokeStyle='rgba(255,255,255,.45)'; g.lineWidth=1.2; g.beginPath(); for(let k=0;k<22;k++){ const ry=vdRnd(k,131), y=y0+(y1-y0)*(0.1+ry*0.8), x=((vdRnd(k,132)*W*1.3-VD.d*s*0.08-VD.tt*(4+ry*6))%(W*1.3)+W*1.3)%(W*1.3)-W*0.15, w=6+ry*18; g.moveTo(x,y); g.quadraticCurveTo(x+w/2,y-1.5,x+w,y); } g.stroke();
  // plage : sable, écume, parasols, baigneurs, pirogues
  const by=y1-dep*0.02, f=0.33, off=VD.d*f; g.fillStyle='#f1dba4'; g.beginPath(); g.moveTo(0,by+dep*0.06); for(let x=0;x<=W+8;x+=8) g.lineTo(x,by-dep*0.015*Math.sin((x/s+off)*0.08)); g.lineTo(W,by+dep*0.06); g.fill();
  g.strokeStyle='rgba(255,255,255,.8)'; g.lineWidth=2; g.beginPath(); for(let x=0;x<=W+8;x+=8){ const yy=by-dep*0.015*Math.sin((x/s+off)*0.08)-1-Math.sin(VD.tt*1.5+x*0.03)*1.5; x?g.lineTo(x,yy):g.moveTo(x,yy); } g.stroke();
  for(let t=Math.floor((off-VD.vx/s-40)/26);t*26<off+(W-VD.vx)/s+40;t++){ if(vdRnd(t,141)<0.4) continue; const X=VD.vx+(t*26+vdRnd(t,142)*14-off)*s, q=vdRnd(t,143), b=s*0.55;
    if(q<0.45){ g.fillStyle=['#ef4444','#f59e0b','#22c55e','#3b82f6'][t&3]; g.beginPath(); g.moveTo(X-5*b,by-6*b); g.quadraticCurveTo(X,by-10*b,X+5*b,by-6*b); g.fill(); g.fillStyle='#78350f'; g.fillRect(X-0.2*b,by-6*b,0.4*b,6*b); vdPerson(g,X+3*b,by,b*2.2,VD_CLO[t%9],VD.tt*3+t,t%2?'maman':'homme',t); }
    else if(q<0.7){ g.fillStyle='#5b3a1a'; g.beginPath(); g.moveTo(X-7*b,by-b); g.quadraticCurveTo(X,by+b,X+7*b,by-b); g.fill(); }
    else { vdPerson(g,X,by-dep*0.04,b*2.2,VD_CLO[(t+2)%9],VD.tt*2+t,'kid',t); } }
  g.restore(); }
function vdVolcans(g,W,mb,ma){ const s=VD.sc, f=0.01, off=VD.d*f; g.save(); g.globalAlpha=Math.min(1,VD.volc*1.5);
  for(let k=Math.floor((off-VD.vx/s-120)/160);k<=Math.floor((off+(W-VD.vx)/s+120)/160);k++){ if(vdRnd(k,301)<0.3) continue; const X=VD.vx+(k*160+vdRnd(k,302)*60-off)*s, h=ma*(0.75+vdRnd(k,303)*0.35), w=h*1.6, top=mb-h, c=vdHaze('#4a5a78',0.25), c2=vdHaze('#3a4866',0.35);
    g.fillStyle=c; g.beginPath(); g.moveTo(X-w,mb+2); g.quadraticCurveTo(X-w*0.35,mb-h*0.45,X-w*0.12,top); g.lineTo(X+w*0.12,top); g.quadraticCurveTo(X+w*0.35,mb-h*0.45,X+w,mb+2); g.fill();
    g.fillStyle=c2; g.beginPath(); g.moveTo(X+w*0.12,top); g.quadraticCurveTo(X+w*0.35,mb-h*0.45,X+w,mb+2); g.lineTo(X+w*0.3,mb+2); g.quadraticCurveTo(X+w*0.15,mb-h*0.5,X,top); g.fill();
    g.fillStyle='#2b2f3a'; g.fillRect(X-w*0.12,top-1,w*0.24,3);
    for(let j=0;j<7;j++){ const p=((VD.tt*0.05+j/7)%1); g.fillStyle=`rgba(${VD.dark>0.4?'120,110,120':'235,235,240'},${0.55*(1-p)})`; g.beginPath(); g.arc(X+p*w*0.6+Math.sin(j)*w*0.05,top-p*h*0.9-4,w*0.07+p*w*0.22,0,7); g.fill(); }
    if(k%2===0) vdLight(X,top+2,w*0.35,VD.dark>0.4?0.85:0.2,'255,90,30'); }
  g.restore(); }
function vdLandmarks(g,W,hz,dep,fl){ const R=VD.R; if(!R) return; const s=VD.sc, f=0.3, off=VD.d*f, y=hz+dep*0.36, b=s*0.45;
  // pont suspendu près de Matadi
  for(const st of VD.stops) if(/matadi/i.test(st.name)&&Math.abs(st.d-VD.d)<25000){ const X=VD.vx+(st.d+3000-VD.d)*s*0.06, yb=hz+dep*0.2, L=60*s; g.save(); g.globalAlpha=Math.min(1,(25000-Math.abs(st.d-VD.d))/6000);
    g.strokeStyle=vdHaze('#d9463b',0.3); g.lineWidth=Math.max(2,s*0.5); g.beginPath(); for(const t of [-0.32,0.32]){ g.moveTo(X+L*t,yb); g.lineTo(X+L*t,yb-14*s); } g.stroke(); g.lineWidth=Math.max(1,s*0.2); g.beginPath(); g.moveTo(X-L*0.6,yb-3*s); g.quadraticCurveTo(X-L*0.46,yb-14*s,X-L*0.32,yb-14*s); g.quadraticCurveTo(X,yb-1*s,X+L*0.32,yb-14*s); g.quadraticCurveTo(X+L*0.46,yb-14*s,X+L*0.6,yb-3*s); g.stroke();
    g.fillStyle=vdHaze('#9ca3af',0.3); g.fillRect(X-L*0.6,yb-3*s,L*1.2,s*0.8); g.restore(); }
  if(fl>0.3&&!R.lake) return;
  for(let k=Math.floor((off-VD.vx/s-80)/90);k*90<off+(W-VD.vx)/s+80;k++){ if(vdRnd(k,311)<0.45) continue; const X=VD.vx+(k*90+vdRnd(k,312)*40-off)*s, q=vdRnd(k,313);
    if(VD.rg==='katanga'){ // terril noir et chevalement de mine
      g.fillStyle=vdHaze('#2b2b2e',0.3); g.beginPath(); g.moveTo(X-30*b,y); g.quadraticCurveTo(X-8*b,y-26*b,X,y-28*b); g.quadraticCurveTo(X+8*b,y-26*b,X+30*b,y); g.fill();
      if(q<0.6){ const hx=X+34*b; g.strokeStyle=vdHaze('#6b7280',0.3); g.lineWidth=Math.max(1,b*0.8); g.beginPath(); g.moveTo(hx-6*b,y); g.lineTo(hx,y-30*b); g.lineTo(hx+6*b,y); g.moveTo(hx-4*b,y-10*b); g.lineTo(hx+4*b,y-10*b); g.moveTo(hx-2*b,y-20*b); g.lineTo(hx+2*b,y-20*b); g.moveTo(hx,y-30*b); g.lineTo(X+6*b,y-22*b); g.stroke();
        g.strokeStyle=vdHaze('#9ca3af',0.3); g.beginPath(); g.arc(hx,y-31*b,3*b,0,7); g.stroke(); g.fillStyle=vdHaze('#a3a3a3',0.35); g.fillRect(hx+8*b,y-9*b,14*b,9*b); g.fillStyle=vdHaze('#7c2d12',0.35); g.fillRect(hx+8*b,y-11*b,14*b,2*b); } }
    else if(VD.rg==='kasai'){ if(q<0.55){ g.fillStyle=vdHaze('#c2410c',0.25); g.beginPath(); g.moveTo(X-24*b,y-2*b); for(let j=0;j<=8;j++) g.lineTo(X-24*b+j*6*b,y+(j%2?10:4)*b+vdRnd(k,320+j)*6*b); g.lineTo(X+24*b,y-2*b); g.closePath(); g.fill(); g.fillStyle=vdHaze('#7c2d12',0.3); g.beginPath(); g.moveTo(X-14*b,y+2*b); g.lineTo(X,y+12*b); g.lineTo(X+14*b,y+2*b); g.fill(); }
      else { g.fillStyle=vdHaze('#5b8fb0',0.25); g.beginPath(); g.ellipse(X,y+2*b,14*b,3*b,0,0,7); g.fill(); for(let j=0;j<4;j++) vdPerson(g,X-10*b+j*7*b,y+1*b,6*b,VD_CLO[(k+j)%9],VD.tt*3+j,'homme',k+j); } }
    else if(VD.rg==='kivu'){ g.fillStyle=vdHaze('#3f9a3a',0.25); g.beginPath(); g.moveTo(X-40*b,y+4*b); g.quadraticCurveTo(X,y-30*b,X+40*b,y+4*b); g.fill(); g.strokeStyle=vdHaze('#2f7a2a',0.3); g.lineWidth=Math.max(1,b*0.9); g.beginPath(); for(let j=1;j<7;j++){ const yy=y+4*b-j*4*b, ww=40*b*Math.sqrt(1-j/7.5); g.moveTo(X-ww,yy); g.quadraticCurveTo(X,yy-3*b,X+ww,yy); } g.stroke(); }
    else if(VD.rg==='cuvette'){ for(let j=0;j<7;j++) vdPalm(g,X+j*7*b,y+2*b,16*b,vdHaze('#2f6b2a',0.3),true); }
    else if(VD.rg==='nord'&&q<0.5){ for(let j=0;j<4;j++) vdRoundHut(g,X+j*9*b,y+2*b,6*b,5*b,vdHaze('#a0603a',0.3)); } } }
function vdFleuve(g,W,hz,dep){ let a=VD.lake||0; for(const st of VD.stops) if(VD_RIVERCITY.test(st.name)) a=Math.max(a,1-Math.abs(st.d-VD.d)/22000); if(a<=0) return 0;
  const s=VD.sc, y0=hz+dep*0.15, y1=hz+dep*0.42; g.save(); g.globalAlpha=Math.min(1,a*2.2);
  const gr=g.createLinearGradient(0,y0,0,y1); gr.addColorStop(0,vdPre(VD.skyH)); gr.addColorStop(1,vdMix('#3f6f8f',vdPre(VD.skyH),0.35)); g.fillStyle=gr; g.fillRect(0,y0,W,y1-y0);
  g.fillStyle=vdHaze(vdBiome('#2f5a36','#7d8a52'),0.45); g.fillRect(0,y0-2,W,3); g.fillStyle=vdBiome('#3f7a35','#a8a060'); g.fillRect(0,y1-2,W,4);
  g.strokeStyle='rgba(255,255,255,.3)'; g.lineWidth=1; g.beginPath(); for(let k=0;k<16;k++){ const x=((vdRnd(k,91)*W-VD.d*0.2*s*0.3+VD.tt*4)%W+W)%W, y=y0+(y1-y0)*(0.2+vdRnd(k,92)*0.75); g.moveTo(x,y); g.lineTo(x+8+vdRnd(k,93)*14,y); } g.stroke();
  // bateaux : baleinières colorées, barges poussées, pirogues
  const f=0.2, off=VD.d*f; for(let k=Math.floor((off-VD.vx/s-80)/70);k<=Math.floor((off+(W-VD.vx)/s+80)/70);k++){ if(vdRnd(k,94)<0.35) continue; const typ=vdRnd(k,95), drift=VD.tt*(vdRnd(k,96)<0.5?1.2:-0.8), X=VD.vx+(k*70+vdRnd(k,97)*30-off+drift)*s, y=y0+(y1-y0)*(0.35+vdRnd(k,98)*0.5), b=s*0.6*(0.7+(y-y0)/(y1-y0)*0.7);
    if(typ<0.4){ g.fillStyle='#5b3a1a'; g.beginPath(); g.moveTo(X-12*b,y-b); g.lineTo(X+12*b,y-b); g.lineTo(X+10*b,y); g.lineTo(X-10*b,y); g.fill(); const C=['#dc2626','#2563eb','#facc15','#16a34a']; for(let j=0;j<4;j++){ g.fillStyle=C[(j+k)%4]; g.fillRect(X-10*b+j*5*b,y-4*b,5*b,b*0.7); } g.fillStyle='#e7d3a8'; for(let j=0;j<6;j++) g.fillRect(X-9*b+j*3.2*b,y-3.2*b,b*1.2,b*2.2); }
    else if(typ<0.7){ g.fillStyle='#57534e'; g.fillRect(X-16*b,y-1.6*b,24*b,1.6*b); g.fillStyle='#e5e7eb'; g.fillRect(X+8*b,y-4.5*b,5*b,4.5*b); g.fillStyle='#1e3a8a'; g.fillRect(X+8*b,y-5.3*b,5*b,0.8*b); const C=['#b91c1c','#1d4ed8','#15803d','#f59e0b']; for(let j=0;j<4;j++){ g.fillStyle=C[(j*3+k)%4]; g.fillRect(X-15*b+j*5.6*b,y-4*b,5*b,2.4*b); } if(VD.dark>0.4) vdLight(X+10*b,y-4*b,6*b,0.6); }
    else { g.fillStyle='#3f2a14'; g.beginPath(); g.moveTo(X-5*b,y-b*0.6); g.quadraticCurveTo(X,y+b*0.6,X+5*b,y-b*0.6); g.fill(); vdPerson(g,X,y-b*0.4,b*2,'#16a34a',0,'homme',k); } }
  g.restore(); return a; }
function vdGroundTex(g,y0,y1){ const s=VD.sc, d=VD.d, W=VD.W, gc=vdBiome('#3f7a35','#b5a35a'), dk=vdDk(gc,0.13), lt=vdLt(gc,0.1);
  for(const [f,fy,k] of [[0.42,0.12,0.42],[0.6,0.42,0.56],[0.86,0.86,0.82]]){ const y=y0+(y1-y0)*fy, off=d*f, T=7/k;
    for(let t=Math.floor((off-VD.vx/s-20)/T);t*T<off+(W-VD.vx)/s+20;t++){ const r=j=>vdRnd(t*13+Math.round(f*100),j), X=VD.vx+(t*T+r(1)*T-off)*s, yy=y+(r(2)-0.5)*(y1-y0)*0.2, q=r(3);
      if(q<0.32){ g.fillStyle=dk; g.beginPath(); g.ellipse(X,yy,(4+r(4)*9)*s*k,(0.6+r(5)*0.7)*s*k,0,0,7); g.fill(); }
      else if(q<0.5){ g.fillStyle=lt; g.beginPath(); g.ellipse(X,yy,(3+r(4)*7)*s*k,0.5*s*k,0,0,7); g.fill(); }
      else if(q<0.7) vdGrass(g,X,yy,s*k*0.8,vdBiome('#4d7c0f','#b5a33b'));
      else if(q<0.77) vdBush(g,X,yy,s*k,vdBiome('#2f6b2a','#6b7f2a'));
      else if(q<0.8){ vdBlobs(g,'#8a8378',[[X,yy-s*k*0.4,s*k*0.7],[X+s*k*0.9,yy-s*k*0.25,s*k*0.45]]); } } } }
/* silhouette de la ville qui approche, au loin */
function vdSkyline(g,W,H){ const d=VD.d; let best=null; for(const st of VD.stops){ const k=Math.abs(st.d-d); if(k<10000&&(!best||k<best.k)) best={st,k}; } if(!best) return;
  const st=best.st, a=Math.max(0,1-best.k/10000), n=Math.min(44,8+Math.round(Math.sqrt(st.pop)*0.7)), cx=VD.vx+(st.d-d)*VD.sc*0.22, sw=n*W*0.014+W*0.25, y=VD.hz+(VD.gy-VD.hz)*0.13, s=VD.sc;
  if(VD.dark>0.3) vdLight(cx,y,sw*0.6,0.35*a,'255,170,90');
  g.save(); g.globalAlpha=a; for(let i=0;i<n;i++){ const r=k=>vdRnd(i,k+st.name.length*31), bw=(4+r(1)*8)*s*0.42, bh=(st.pop>2000?16:8)*s*(0.35+r(2)*1.1)*0.5, x=cx-sw/2+r(3)*sw;
    g.fillStyle=vdHaze(vdMix('#94a3b8','#64748b',r(4)),0.45); g.fillRect(x,y-bh,bw,bh); if(r(6)<0.3){ g.fillRect(x+bw*0.4,y-bh-bh*0.25,1.2,bh*0.25); }
    if(VD.dark>0.3) for(let j=0;j<6;j++) if(r(10+j)<0.55) vdWin(x+bw*r(20+j)*0.8,y-bh*r(30+j)*0.9-2,1.6,1.6); }
  g.restore(); }

/* ---------- arbres et plantes ---------- */
const VD_BLOB=[[0,-1.5,.72],[-.62,-1.2,.55],[.64,-1.22,.58],[-.3,-1.92,.5],[.36,-1.9,.52],[0,-1.12,.6],[-.98,-1.45,.36],[1,-1.5,.36]];
function vdTree(g,x,y,r,c,simple){ c=c||'#2f6b2a'; const tr='#5a3d27';
  g.fillStyle=tr; g.beginPath(); g.moveTo(x-r*0.15,y); g.lineTo(x-r*0.07,y-r*1.15); g.lineTo(x+r*0.07,y-r*1.15); g.lineTo(x+r*0.15,y); g.fill();
  if(!simple){ g.strokeStyle=tr; g.lineWidth=Math.max(1,r*0.08); g.beginPath(); g.moveTo(x,y-r*0.75); g.lineTo(x-r*0.45,y-r*1.22); g.moveTo(x,y-r*0.85); g.lineTo(x+r*0.42,y-r*1.32); g.stroke(); }
  vdBlobs(g,vdDk(c,0.3),VD_BLOB.map(([a,b,q])=>[x+a*r+r*0.05,y+b*r+r*0.1,q*r]));
  vdBlobs(g,c,VD_BLOB.map(([a,b,q])=>[x+a*r-r*0.04,y+b*r-r*0.03,q*r*0.88]));
  if(!simple) vdBlobs(g,vdLt(c,0.17),VD_BLOB.filter(b=>b[1]<-1.4).map(([a,b,q])=>[x+a*r-r*0.15,y+b*r-r*0.16,q*r*0.48])); }
function vdPalm(g,x,y,h,c,simple){ c=c||'#2f7a34'; const tx=x+h*0.1, ty=y-h, tw=Math.sin(VD.tt*0.8+x*0.01)*0.04;
  g.strokeStyle='#7a5a3c'; g.lineWidth=Math.max(1.5,h*0.055); g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+h*0.2,y-h*0.55,tx,ty); g.stroke();
  if(!simple&&h>30){ g.strokeStyle='#5f452d'; g.lineWidth=Math.max(1,h*0.06); g.setLineDash([1.2,h*0.05]); g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+h*0.2,y-h*0.55,tx,ty); g.stroke(); g.setLineDash([]); }
  const dk=vdDk(c,0.3), lt=vdLt(c,0.12), N=simple?7:10;
  for(let k=0;k<N;k++){ const a=-Math.PI*1.08+k*(Math.PI*1.16)/(N-1)+tw, len=h*(0.42+0.12*Math.sin(k*2.3)), ex=tx+Math.cos(a)*len, ey=ty+Math.sin(a)*len*0.55+len*0.42, mx=tx+Math.cos(a)*len*0.5, my=ty+Math.sin(a)*len*0.5-len*0.08, wv=len*0.11;
    g.fillStyle=k%2?dk:c; g.beginPath(); g.moveTo(tx,ty); g.quadraticCurveTo(mx-Math.sin(a)*wv,my-wv,ex,ey); g.quadraticCurveTo(mx+Math.sin(a)*wv,my+wv*0.6,tx,ty); g.fill();
    if(!simple){ g.strokeStyle=lt; g.lineWidth=0.8; g.beginPath(); g.moveTo(tx,ty); g.quadraticCurveTo(mx,my,ex,ey); g.stroke(); } }
  if(!simple){ vdBlobs(g,'#6b4423',[[tx-h*0.025,ty+h*0.04,h*0.032],[tx+h*0.03,ty+h*0.045,h*0.032],[tx,ty+h*0.07,h*0.03]]); } }
function vdBanana(g,x,y,h,c){ c=c||'#4caf50'; g.fillStyle='#7c9a3a'; g.fillRect(x-h*0.04,y-h*0.55,h*0.08,h*0.55); const dk=vdDk(c,0.25);
  for(let k=0;k<6;k++){ const a=-Math.PI/2+(k-2.5)*0.48+Math.sin(VD.tt+k)*0.03, L=h*0.55; g.save(); g.translate(x,y-h*0.5); g.rotate(a); g.fillStyle=k%2?c:dk; g.beginPath(); g.ellipse(L*0.5,L*0.05*(k<3?1:-1),L*0.5,L*0.14,0.15*(k<3?1:-1),0,7); g.fill();
    g.strokeStyle=vdLt(c,0.2); g.lineWidth=0.7; g.beginPath(); g.moveTo(0,0); g.lineTo(L*0.95,0); g.stroke(); g.restore(); } }
function vdBigTree(g,x,y,h,c){ c=c||'#2d6a2e'; const tw=h*0.05;   // grand arbre de forêt : tronc clair, contreforts
  g.fillStyle='#b9ab94'; g.beginPath(); g.moveTo(x-tw*2.4,y); g.quadraticCurveTo(x-tw,y-h*0.08,x-tw,y-h*0.2); g.lineTo(x-tw*0.8,y-h*0.78); g.lineTo(x+tw*0.8,y-h*0.78); g.lineTo(x+tw,y-h*0.2); g.quadraticCurveTo(x+tw,y-h*0.08,x+tw*2.6,y); g.fill();
  g.fillStyle='#8f8270'; g.fillRect(x+tw*0.2,y-h*0.78,tw*0.7,h*0.7);
  g.strokeStyle='#8f8270'; g.lineWidth=tw*0.6; g.beginPath(); g.moveTo(x,y-h*0.74); g.lineTo(x-h*0.18,y-h*0.86); g.moveTo(x,y-h*0.76); g.lineTo(x+h*0.2,y-h*0.88); g.stroke();
  const B=[[0,-0.92,0.16],[-0.17,-0.88,0.12],[0.19,-0.89,0.13],[-0.3,-0.86,0.09],[0.32,-0.86,0.1],[0.06,-1,0.11],[-0.1,-0.98,0.1]];
  vdBlobs(g,vdDk(c,0.3),B.map(([a,b,q])=>[x+a*h,y+b*h+h*0.03,q*h])); vdBlobs(g,c,B.map(([a,b,q])=>[x+a*h-h*0.01,y+b*h-h*0.005,q*h*0.88])); vdBlobs(g,vdLt(c,0.15),B.filter(b=>b[1]<-0.9).map(([a,b,q])=>[x+a*h-h*0.035,y+b*h-h*0.04,q*h*0.45])); }
function vdAcacia(g,x,y,w,c,flat){ c=c||'#6b8e23'; g.strokeStyle=flat?c:'#5b4636'; g.lineWidth=Math.max(1.2,w*0.05); g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-w*0.45); g.lineTo(x-w*0.28,y-w*0.76); g.moveTo(x,y-w*0.45); g.lineTo(x+w*0.3,y-w*0.78); g.moveTo(x,y-w*0.5); g.lineTo(x+w*0.05,y-w*0.8); g.stroke();
  if(flat){ g.fillStyle=c; g.beginPath(); g.ellipse(x,y-w*0.84,w*0.6,w*0.12,0,0,7); g.fill(); return; }
  const E=[[0,-0.84,0.62,0.13],[-0.3,-0.88,0.34,0.1],[0.32,-0.9,0.38,0.1]]; g.fillStyle=vdDk(c,0.28); g.beginPath(); for(const [a,b,rx,ry] of E){ g.moveTo(x+a*w+rx*w,y+b*w+w*0.04); g.ellipse(x+a*w,y+b*w+w*0.04,rx*w,ry*w,0,0,7); } g.fill();
  g.fillStyle=c; g.beginPath(); for(const [a,b,rx,ry] of E){ g.moveTo(x+a*w+rx*w*0.92,y+b*w-w*0.01); g.ellipse(x+a*w,y+b*w-w*0.01,rx*w*0.92,ry*w*0.8,0,0,7); } g.fill(); }
function vdBaobab(g,x,y,h){ const gr=g.createLinearGradient(x-h*0.2,0,x+h*0.2,0); gr.addColorStop(0,'#a48b78'); gr.addColorStop(0.6,'#8d7462'); gr.addColorStop(1,'#6e5a4b'); g.fillStyle=gr;
  g.beginPath(); g.moveTo(x-h*0.2,y); g.quadraticCurveTo(x-h*0.25,y-h*0.45,x-h*0.11,y-h*0.72); g.lineTo(x+h*0.11,y-h*0.72); g.quadraticCurveTo(x+h*0.25,y-h*0.45,x+h*0.2,y); g.fill();
  g.strokeStyle='#8d7462'; g.lineWidth=h*0.045; g.lineCap='round'; g.beginPath(); for(const a of [-1,-0.55,-0.1,0.35,0.8]){ g.moveTo(x+a*h*0.1,y-h*0.7); g.quadraticCurveTo(x+a*h*0.25,y-h*0.82,x+Math.sin(a)*h*0.38,y-h*0.72-Math.cos(a)*h*0.26); } g.stroke(); g.lineCap='butt';
  const L=[]; for(const a of [-1,-0.55,-0.1,0.35,0.8]) L.push([x+Math.sin(a)*h*0.38,y-h*0.74-Math.cos(a)*h*0.26,h*0.07]); vdBlobs(g,'#6b8f3a',L); }
function vdGrass(g,x,y,s,c){ c=c||'#a8a33b'; const sw=Math.sin(VD.tt*1.3+x*0.05)*s*0.25;
  for(let pass=0;pass<2;pass++){ g.fillStyle=pass?vdLt(c,0.12):vdDk(c,0.22); g.beginPath();
    for(let k=0;k<9;k++){ const a=(k-4)*0.2+(pass?0.08:-0.05), L=s*(2+((k*7+pass*3)%5)*0.45), bx=x+(k-4)*s*0.22; g.moveTo(bx-s*0.2,y); g.quadraticCurveTo(bx+Math.sin(a)*L*0.5,y-L*0.6,bx+Math.sin(a)*L+sw,y-L); g.quadraticCurveTo(bx+Math.sin(a)*L*0.5+s*0.15,y-L*0.55,bx+s*0.2,y); } g.fill(); } }
function vdBush(g,x,y,s,c){ c=c||'#3f7d2a'; const L=[[x,y-s*1.1,s*1.3],[x-s*1.3,y-s*0.7,s*0.9],[x+s*1.3,y-s*0.75,s*1]]; vdBlobs(g,vdDk(c,0.25),L); vdBlobs(g,c,L.map(([a,b,r])=>[a-s*0.15,b-s*0.15,r*0.8])); }
function vdMound(g,x,y,s){ g.fillStyle='#b4612f'; g.beginPath(); g.moveTo(x-s*2.6,y); g.quadraticCurveTo(x-s*2.2,y-s*1.6,x-s*1.4,y-s*2.2); g.quadraticCurveTo(x-s*1.3,y-s*3.6,x-s*0.6,y-s*4.4); g.quadraticCurveTo(x-s*0.2,y-s*5.6,x+s*0.3,y-s*4.8); g.quadraticCurveTo(x+s*0.6,y-s*3.6,x+s*1.2,y-s*3.1); g.quadraticCurveTo(x+s*1.8,y-s*2.6,x+s*1.9,y-s*1.4); g.quadraticCurveTo(x+s*2.4,y-s*0.8,x+s*2.7,y); g.fill(); vdGrass(g,x-s*2.2,y,s*0.6,'#8a8a3a'); vdGrass(g,x+s*2.2,y,s*0.5,'#8a8a3a'); g.fillStyle='rgba(0,0,0,.14)'; g.beginPath(); g.moveTo(x+s*0.2,y-s*5); g.quadraticCurveTo(x+s*1.1,y-s*2.4,x+s*2.2,y); g.lineTo(x+s*0.6,y); g.fill(); }

/* ---------- maisons, boutiques, immeubles ---------- */
const VD_WALL=['#e7d8bd','#d9c3a0','#f1e6d0','#c9a27e','#e9c9a6','#f5efe2','#b9c7d8','#e3b78f','#f2c4a0','#cde3c3','#f3d77a','#9fc5e8'], VD_ROOF=['#8c8f93','#7b2f22','#9a9da1','#a4552e','#6e7276','#3f5f7f','#2f6f4f'];
function vdHouse(g,x,y,w,h,wall,roof,lit,thatch){
  g.fillStyle=wall; g.fillRect(x,y-h,w,h); g.fillStyle=vdDk(wall,0.2); g.fillRect(x,y-h*0.16,w,h*0.16); g.fillStyle='rgba(0,0,0,.1)'; g.fillRect(x+w*0.9,y-h,w*0.1,h);
  if(thatch){ g.strokeStyle='rgba(0,0,0,.12)'; g.lineWidth=1; g.beginPath(); for(let yy=y-h+h*0.18;yy<y;yy+=h*0.18){ g.moveTo(x,yy); g.lineTo(x+w,yy); } g.stroke();
    g.fillStyle='#c49a52'; g.beginPath(); g.moveTo(x-w*0.14,y-h*0.92); g.quadraticCurveTo(x+w*0.5,y-h*1.95,x+w*1.14,y-h*0.92); g.closePath(); g.fill();
    g.strokeStyle='#9a7536'; g.lineWidth=1; g.beginPath(); for(let k=0;k<9;k++){ const fx=x-w*0.1+k*w*0.15; g.moveTo(fx,y-h*0.94); g.lineTo(x+w*0.5+(fx-x-w*0.5)*0.35,y-h*1.6); } g.stroke();
    g.fillStyle='#b08640'; g.beginPath(); for(let k=0;k<12;k++){ const fx=x-w*0.14+k*w*1.28/12; g.moveTo(fx,y-h*0.93); g.lineTo(fx+w*0.053,y-h*0.8); g.lineTo(fx+w*0.107,y-h*0.93); } g.fill(); }
  else { g.fillStyle='rgba(0,0,0,.2)'; g.fillRect(x,y-h,w,h*0.1);
    const gr=g.createLinearGradient(0,y-h*1.45,0,y-h); gr.addColorStop(0,vdLt(roof,0.18)); gr.addColorStop(1,vdDk(roof,0.12)); g.fillStyle=gr; g.beginPath(); g.moveTo(x-w*0.1,y-h); g.lineTo(x+w*0.15,y-h*1.42); g.lineTo(x+w*0.85,y-h*1.42); g.lineTo(x+w*1.1,y-h); g.closePath(); g.fill();
    g.strokeStyle='rgba(0,0,0,.2)'; g.lineWidth=1; g.beginPath(); for(let k=1;k<9;k++){ const fx=x+w*0.15+k*(w*0.7)/9; g.moveTo(fx,y-h*1.42); g.lineTo(fx+(k<4.5?-1:1)*w*0.1*(Math.abs(k-4.5)/4.5),y-h); } g.stroke();
    if(roof==='#8c8f93'||roof==='#9a9da1'){ g.fillStyle='rgba(146,64,14,.35)'; g.fillRect(x+w*0.3,y-h*1.25,w*0.12,h*0.12); g.fillRect(x+w*0.62,y-h*1.15,w*0.08,h*0.1); } }
  g.fillStyle='#6b4423'; g.fillRect(x+w*0.42,y-h*0.66,w*0.17,h*0.66); g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x+w*0.42,y-h*0.66,w*0.17,h*0.05);
  if(!thatch&&w>20){ const q=vdRnd(Math.round(x*7+w),9); if(q<0.35){ g.fillStyle='#e5e7eb'; g.beginPath(); g.ellipse(x+w*0.78,y-h*1.38,w*0.07,w*0.05,-0.5,0,7); g.fill(); g.strokeStyle='#6b7280'; g.lineWidth=1; g.beginPath(); g.moveTo(x+w*0.78,y-h*1.38); g.lineTo(x+w*0.82,y-h*1.22); g.stroke(); }
    else if(q<0.55){ g.fillStyle='#d1d5db'; g.fillRect(x+w*0.72,y-h*0.42,w*0.16,h*0.16); g.fillStyle='#6b7280'; for(let k=0;k<3;k++) g.fillRect(x+w*0.74,y-h*0.39+k*h*0.04,w*0.12,1); } }
  for(const wx of [0.12,0.71]){ const X=x+w*wx, Y=y-h*0.72, ww=w*0.17, wh=h*0.26; g.fillStyle=lit?'#ffd27a':'#1e293b'; g.fillRect(X,Y,ww,wh); if(lit){ vdWin(X,Y,ww,wh); vdLight(X+ww/2,Y+wh/2,ww*1.6,0.4); }
    g.strokeStyle=thatch?'#5b3a1a':'#e5e7eb'; g.lineWidth=1; g.beginPath(); g.moveTo(X+ww/2,Y); g.lineTo(X+ww/2,Y+wh); g.moveTo(X,Y+wh/2); g.lineTo(X+ww,Y+wh/2); g.stroke(); } }
function vdRoundHut(g,x,y,w,h,wall){ g.fillStyle=wall||'#a0603a'; vdRR(g,x,y-h,w,h,w*0.15); g.fill(); g.fillStyle='rgba(0,0,0,.15)'; g.fillRect(x+w*0.75,y-h,w*0.25,h);
  g.fillStyle='#4a2e1f'; g.fillRect(x+w*0.38,y-h*0.6,w*0.24,h*0.6); g.fillStyle='#c49a52'; g.beginPath(); g.moveTo(x-w*0.2,y-h*0.85); g.lineTo(x+w*0.5,y-h*2.2); g.lineTo(x+w*1.2,y-h*0.85); g.fill();
  g.strokeStyle='#9a7536'; g.lineWidth=1; g.beginPath(); for(let k=1;k<6;k++){ g.moveTo(x+w*0.5,y-h*2.2); g.lineTo(x-w*0.2+k*w*1.4/6,y-h*0.86); } g.stroke(); }
function vdEuca(g,x,y,h){ g.strokeStyle='#d6cfc2'; g.lineWidth=Math.max(1.2,h*0.03); g.beginPath(); g.moveTo(x,y); g.lineTo(x+h*0.02,y-h); g.moveTo(x,y-h*0.6); g.lineTo(x+h*0.12,y-h*0.78); g.stroke();
  const L=[[0,-0.95,0.09],[0.08,-0.82,0.08],[-0.06,-0.75,0.08],[0.02,-0.62,0.07],[0.1,-0.7,0.06]].map(([a,b,r])=>[x+a*h,y+b*h,r*h]); vdBlobs(g,'#5f7f62',L); vdBlobs(g,'#7a9a78',L.map(([a,b,r])=>[a-r*0.2,b-r*0.25,r*0.5])); }
function vdCommerce(g,x,y,s,t,seed){ const sell=()=>vdPerson(g,x-s*1.2,y,2*s,VD_CLO[seed%9],0,seed%2?'maman':'homme',seed);
  if(t==='fuel'){ g.fillStyle='#6b4a2e'; g.fillRect(x,y-s*1.6,s*4,s*0.3); g.fillRect(x+s*0.2,y-s*1.3,s*0.25,s*1.3); g.fillRect(x+s*3.5,y-s*1.3,s*0.25,s*1.3); for(let r=0;r<2;r++) for(let k=0;k<6;k++){ g.fillStyle=r?'#f59e0b':'#facc15'; g.fillRect(x+s*(0.2+k*0.62),y-s*(2.4+r*0.8),s*0.4,s*0.75); g.fillStyle='#dc2626'; g.fillRect(x+s*(0.27+k*0.62),y-s*(2.55+r*0.8),s*0.26,s*0.18); } sell(); }
  else if(t==='charbon'){ const L=[]; for(let r=0;r<3;r++) for(let k=0;k<4-r;k++) L.push([x+s*(0.8+k*1.4+r*0.7),y-s*(0.7+r*1.1),s*0.8]); vdBlobs(g,'#e7e5e4',L); vdBlobs(g,'#1c1917',L.map(([a,b,r2])=>[a,b-r2*0.6,r2*0.55])); sell(); }
  else if(t==='brochette'){ g.fillStyle='#3f3f46'; g.fillRect(x,y-s*1.8,s*3,s*0.6); g.fillRect(x+s*0.3,y-s*1.2,s*0.25,s*1.2); g.fillRect(x+s*2.5,y-s*1.2,s*0.25,s*1.2); g.fillStyle='#f97316'; g.fillRect(x+s*0.2,y-s*1.95,s*2.6,s*0.2); for(let k=0;k<5;k++){ g.fillStyle='#7c2d12'; g.fillRect(x+s*(0.3+k*0.55),y-s*2.3,s*0.35,s*0.45); }
    for(let k=0;k<4;k++){ const p=((VD.tt*0.7+k/4)%1); g.fillStyle=`rgba(210,210,210,${0.4*(1-p)})`; g.beginPath(); g.arc(x+s*1.5+p*s*2,y-s*2.4-p*s*6,s*(0.4+p*1.2),0,7); g.fill(); } vdLight(x+s*1.5,y-s*2,s*4,VD.dark>0.4?0.6:0.1,'255,150,60'); sell(); }
  else { g.fillStyle='#4b5563'; g.fillRect(x+s*1.5,y-s*5,s*0.2,s*5); for(let k=0;k<6;k++){ g.fillStyle=k%2?'#facc15':'#fde047'; g.beginPath(); g.moveTo(x+s*1.6,y-s*5.6); g.lineTo(x-s*1+k*s*0.87,y-s*4.4); g.lineTo(x-s*1+(k+1)*s*0.87,y-s*4.4); g.fill(); }
    g.fillStyle='#f8fafc'; g.fillRect(x+s*0.4,y-s*1.4,s*2.4,s*1.4); g.fillStyle='#ca8a04'; g.font=`bold ${Math.max(7,s*0.55)}px sans-serif`; g.textAlign='center'; g.fillText('Crédit',x+s*1.6,y-s*0.5,s*2.3); sell(); } }
function vdSkyscraper(g,x,y,w,h,s,lit,seed){ seed=Math.abs(seed|0); const P=[['#9cc7e8','#3b6f9a'],['#9fe0d8','#2f7f86'],['#5b6b80','#1f2937'],['#e8c79c','#8a5a2b'],['#b8d4f0','#4a6fa5']][seed%5];
  const top=y-h, gr=g.createLinearGradient(x,0,x+w,0); gr.addColorStop(0,P[0]); gr.addColorStop(0.6,vdMix(P[0],P[1],0.5)); gr.addColorStop(1,P[1]); g.fillStyle=gr;
  const sb=w*0.14, h1=h*0.82; g.fillRect(x,top+h-h1,w,h1); g.fillRect(x+sb,top+h*0.06,w-2*sb,h-h1+h*0.0+h*0.12); g.fillRect(x+sb*2,top,w-4*sb,h*0.1);
  // reflet du ciel en diagonale
  g.save(); g.beginPath(); g.rect(x,top,w,h); g.clip(); g.fillStyle='rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x+w*0.1,y); g.lineTo(x+w*0.5,y); g.lineTo(x+w*1.2,top); g.lineTo(x+w*0.8,top); g.fill(); g.restore();
  g.fillStyle='rgba(15,23,42,.18)'; for(let k=1;k<6;k++) g.fillRect(x+k*w/6,top+h*0.1,Math.max(1,s*0.15),h*0.9);
  const fh=Math.max(5,2.4*s); for(let yy=top+h*0.12;yy<y-2;yy+=fh) g.fillRect(x,yy,w,Math.max(1,s*0.12));
  if(lit){ g.fillStyle='#ffd27a'; for(let yy=top+h*0.14,f=0;yy<y-fh;yy+=fh,f++) for(let c=0;c<6;c++) if(vdRnd(seed*31+c,f)<0.4){ const X=x+c*w/6+w*0.03, ww=w/6-w*0.06, hh=fh*0.6; g.fillRect(X,yy+fh*0.2,ww,hh); vdWin(X,yy+fh*0.2,ww,hh); } }
  g.fillStyle='#64748b'; g.fillRect(x+w*0.48,top-h*0.12,Math.max(1.5,s*0.25),h*0.12); vdLight(x+w*0.48,top-h*0.12,s*1.6,0.9,'255,40,40');
  g.fillStyle=P[1]; g.font=`bold ${Math.max(7,w*0.08)}px sans-serif`; g.textAlign='center'; if(seed%3===0){ g.fillStyle='#fff'; g.fillText(['BANK','TOWER','HÔTEL','PLAZA','CENTRE'][seed%5],x+w*0.5,top+h*0.09,w-sb*2); } }
function vdShack(g,x,y,w,h,seed){ const r=k=>vdRnd(seed,k), C=['#8b6a52','#9a9a98','#7c5a3a','#6b8fa8','#a0522d','#7f8c6a','#b08d57'], wall=C[Math.floor(r(1)*C.length)], tilt=(r(2)-0.5)*h*0.25;
  g.fillStyle=wall; g.fillRect(x,y-h,w,h); g.strokeStyle='rgba(0,0,0,.18)'; g.lineWidth=1; g.beginPath(); for(let k=1;k<6;k++){ g.moveTo(x+k*w/6,y-h); g.lineTo(x+k*w/6,y); } g.stroke();
  if(r(3)<0.4){ g.fillStyle='#2563eb'; g.fillRect(x+w*0.1,y-h*0.9,w*0.35,h*0.45); }   // bâche bleue
  g.fillStyle=r(4)<0.5?'#7b7f84':'#8a4b2a'; g.beginPath(); g.moveTo(x-w*0.08,y-h-(tilt>0?0:-tilt)); g.lineTo(x+w*1.08,y-h-(tilt>0?tilt:0)-h*0.15); g.lineTo(x+w*1.08,y-h+h*0.05); g.lineTo(x-w*0.08,y-h+h*0.08); g.fill();
  vdBlobs(g,'#57534e',[[x+w*0.3,y-h-h*0.08,w*0.05],[x+w*0.7,y-h-h*0.12,w*0.05]]);   // pierres sur la tôle
  g.fillStyle=['#dc2626','#16a34a','#7c3aed','#f59e0b'][Math.floor(r(5)*4)]; g.fillRect(x+w*0.55,y-h*0.65,w*0.22,h*0.65);   // rideau de porte
  if(r(6)<0.3){ g.fillStyle='#1e40af'; vdRR(g,x+w*1.02,y-h*0.45,w*0.22,h*0.45,w*0.05); g.fill(); }   // fût d'eau
  if(r(7)<0.25){ g.fillStyle='#e5e7eb'; g.beginPath(); g.ellipse(x+w*0.25,y-h-h*0.2,w*0.08,w*0.06,-0.4,0,7); g.fill(); } }
function vdBeachHouse(g,x,y,w,h,s,lit,seed){ seed=Math.abs(seed|0); const C=['#f8fafc','#fde68a','#bae6fd','#fecdd3','#d9f99d'], c=C[seed%5];
  g.fillStyle='rgba(0,0,0,.12)'; g.fillRect(x+w*0.05,y-h*0.08,w,h*0.08); g.fillStyle=c; g.fillRect(x,y-h,w,h); g.fillStyle=vdDk(c,0.12); g.fillRect(x+w*0.9,y-h,w*0.1,h);
  g.fillStyle='#e5e7eb'; g.fillRect(x-w*0.05,y-h-h*0.06,w*1.1,h*0.06); g.strokeStyle='#94a3b8'; g.lineWidth=1; g.beginPath(); for(let k=0;k<=10;k++){ g.moveTo(x-w*0.05+k*w*0.11,y-h-h*0.06); g.lineTo(x-w*0.05+k*w*0.11,y-h-h*0.25); } g.moveTo(x-w*0.05,y-h-h*0.25); g.lineTo(x+w*1.05,y-h-h*0.25); g.stroke();
  for(let k=0;k<3;k++){ const X=x+w*(0.08+k*0.3), Y=y-h*0.78, ww=w*0.22, hh=h*0.42; g.fillStyle=lit?'#ffd27a':'#7dd3fc'; g.fillRect(X,Y,ww,hh); if(lit) vdWin(X,Y,ww,hh); g.fillStyle='#0369a1'; g.fillRect(X-w*0.03,Y,w*0.03,hh); g.fillRect(X+ww,Y,w*0.03,hh); }
  g.fillStyle='#0ea5e9'; g.fillRect(x+w*0.4,y-h*0.32,w*0.18,h*0.32); vdPalm(g,x+w*1.15,y,h*2.1); g.fillStyle=['#ef4444','#f59e0b','#22c55e'][seed%3]; g.beginPath(); g.moveTo(x-w*0.35,y-h*0.55); g.quadraticCurveTo(x-w*0.15,y-h*0.85,x+w*0.05,y-h*0.55); g.fill(); g.fillStyle='#78350f'; g.fillRect(x-w*0.16,y-h*0.6,w*0.025,h*0.6); }
function vdCow(g,x,y,s,c,t,longh){ const b=Math.sin(t)*0.12*s; g.fillStyle=vdDk(c,0.25); g.fillRect(x-s*1.4,y-s*1.3,s*0.3,s*1.3); g.fillRect(x+s*1,y-s*1.3+b,s*0.3,s*1.3-b);
  g.fillStyle=c; g.beginPath(); g.ellipse(x,y-s*1.7,s*1.8,s*0.75,0,0,7); g.fill(); g.fillRect(x-s*1.1,y-s*1.3,s*0.3,s*1.3); g.fillRect(x+s*0.7,y-s*1.3,s*0.3,s*1.3);
  g.beginPath(); g.ellipse(x+s*2.1,y-s*2.0,s*0.55,s*0.38,-0.3,0,7); g.fill(); g.strokeStyle='#e7e5e4'; g.lineWidth=Math.max(1,s*0.18); g.beginPath();
  if(longh){ g.moveTo(x+s*2,y-s*2.3); g.quadraticCurveTo(x+s*1.2,y-s*3.6,x+s*0.9,y-s*3.9); g.moveTo(x+s*2.2,y-s*2.3); g.quadraticCurveTo(x+s*3,y-s*3.6,x+s*3.4,y-s*3.8); } else { g.moveTo(x+s*1.95,y-s*2.3); g.lineTo(x+s*1.8,y-s*2.7); g.moveTo(x+s*2.25,y-s*2.3); g.lineTo(x+s*2.4,y-s*2.7); } g.stroke();
  g.strokeStyle=c; g.lineWidth=Math.max(1,s*0.12); g.beginPath(); g.moveTo(x-s*1.8,y-s*1.8); g.quadraticCurveTo(x-s*2.2,y-s*1.4,x-s*2.1,y-s*0.9); g.stroke(); }
function vdGiraffe(g,x,y,s,t){ const c='#e0a84f', sp='#8a5a2b', b=Math.sin(t*0.5)*0.1; g.fillStyle=c; for(const lx of [-1,-0.5,0.6,1.1]) g.fillRect(x+lx*s,y-s*4,s*0.25,s*4);
  g.beginPath(); g.ellipse(x,y-s*4.3,s*1.6,s*0.8,-0.1,0,7); g.fill(); g.save(); g.translate(x+s*1.2,y-s*4.6); g.rotate(-0.5+b); g.fillRect(0,-s*4.5,s*0.55,s*4.6); g.beginPath(); g.ellipse(s*0.5,-s*4.6,s*0.7,s*0.35,0.4,0,7); g.fill(); g.fillStyle=sp; g.fillRect(s*0.1,-s*4.9,s*0.12,s*0.4); g.fillRect(s*0.35,-s*4.95,s*0.12,s*0.4);
  for(let k=0;k<5;k++) g.fillRect(s*0.1,-s*(0.6+k*0.85),s*0.3,s*0.3); g.restore(); g.fillStyle=sp; for(let k=0;k<6;k++) g.fillRect(x-s*1.2+k*s*0.45,y-s*(4.6+(k%2)*0.3),s*0.3,s*0.28); }
function vdElephant(g,x,y,s,t){ const c='#8a8f98', b=Math.sin(t*0.6)*0.15*s; g.fillStyle=vdDk(c,0.2); g.fillRect(x-s*1.6,y-s*1.8,s*0.7,s*1.8); g.fillRect(x+s*0.9,y-s*1.8+b,s*0.7,s*1.8-b);
  g.fillStyle=c; g.beginPath(); g.ellipse(x,y-s*2.6,s*2.4,s*1.4,0,0,7); g.fill(); g.fillRect(x-s*1.2,y-s*1.8,s*0.7,s*1.8); g.fillRect(x+s*0.5,y-s*1.8,s*0.7,s*1.8);
  g.beginPath(); g.arc(x+s*2.3,y-s*3,s*1.05,0,7); g.fill(); g.fillStyle=vdDk(c,0.12); g.beginPath(); g.ellipse(x+s*1.9,y-s*2.9,s*0.7,s*0.95,0,0,7); g.fill();
  g.strokeStyle=c; g.lineWidth=s*0.45; g.lineCap='round'; g.beginPath(); g.moveTo(x+s*3.1,y-s*2.8); g.quadraticCurveTo(x+s*3.7,y-s*1.6+b,x+s*3.3,y-s*0.6); g.stroke(); g.lineCap='butt';
  g.strokeStyle='#f5f5f4'; g.lineWidth=s*0.18; g.beginPath(); g.moveTo(x+s*2.9,y-s*2.4); g.quadraticCurveTo(x+s*3.4,y-s*2.1,x+s*3.6,y-s*2.5); g.stroke(); }
function vdZebra(g,x,y,s,t){ const b=Math.sin(t)*0.1*s; g.fillStyle='#f8fafc'; g.fillRect(x-s*1.1,y-s*1.6,s*0.25,s*1.6); g.fillRect(x+s*0.8,y-s*1.6+b,s*0.25,s*1.6-b); g.beginPath(); g.ellipse(x,y-s*1.9,s*1.4,s*0.6,0,0,7); g.fill();
  g.save(); g.translate(x+s*1.1,y-s*2.1); g.rotate(-0.7); g.fillRect(0,-s*1.5,s*0.5,s*1.6); g.beginPath(); g.ellipse(s*0.35,-s*1.6,s*0.55,s*0.28,0.5,0,7); g.fill(); g.restore();
  g.fillStyle='#111827'; for(let k=0;k<7;k++) g.fillRect(x-s*1.2+k*s*0.38,y-s*2.45,s*0.14,s*1.1); g.fillRect(x+s*1.2,y-s*3.3,s*0.15,s*0.8); }
function vdMonkey(g,x,y,s,t){ const sw=Math.sin(t)*s*0.3; g.fillStyle='#5b3a1a'; g.beginPath(); g.ellipse(x,y,s*0.5,s*0.65,0,0,7); g.fill(); g.beginPath(); g.arc(x,y-s*0.8,s*0.35,0,7); g.fill(); g.fillStyle='#d6b08a'; g.beginPath(); g.arc(x+s*0.08,y-s*0.75,s*0.2,0,7); g.fill();
  g.strokeStyle='#5b3a1a'; g.lineWidth=Math.max(1,s*0.15); g.beginPath(); g.moveTo(x-s*0.3,y+s*0.4); g.quadraticCurveTo(x-s*0.9+sw,y+s*1.2,x-s*0.5+sw,y+s*1.6); g.moveTo(x+s*0.2,y-s*0.3); g.lineTo(x+s*0.4,y-s*1.5); g.stroke(); }
function vdFoot(g,x,y,w,s){ g.fillStyle='rgba(120,90,50,.35)'; g.fillRect(x,y-s*0.6,w,s*0.8); g.strokeStyle='#f8fafc'; g.lineWidth=Math.max(1,s*0.25);
  for(const gx of [x+s,x+w-s*3]){ g.beginPath(); g.moveTo(gx,y); g.lineTo(gx,y-s*3); g.lineTo(gx+s*2,y-s*3); g.lineTo(gx+s*2,y); g.stroke(); }
  const t=VD.tt*1.3, bx=x+w*0.5+Math.sin(t*0.8)*w*0.35, by=y-s*0.4-Math.abs(Math.sin(t*3))*s*1.5;
  for(let k=0;k<6;k++){ const px=bx+Math.sin(t*0.9+k*1.7)*w*0.18+(k-2.5)*s*1.2; vdPerson(g,px,y,1.6*s,k<3?'#dc2626':'#facc15',t*6+k,'kid',k+3); }
  g.fillStyle='#f8fafc'; g.beginPath(); g.arc(bx,by,s*0.32,0,7); g.fill(); g.fillStyle='#111827'; g.fillRect(bx-s*0.08,by-s*0.08,s*0.16,s*0.16); }
function vdLandmark(g,x,y,s,kind,lit){ if(kind==='tour'){ // grande tour de béton à flèche, symbole de la ville
    g.fillStyle='#d6d3d1'; g.beginPath(); g.moveTo(x-s*3,y); g.lineTo(x-s*1.2,y-s*60); g.lineTo(x+s*1.2,y-s*60); g.lineTo(x+s*3,y); g.fill(); g.fillStyle='rgba(0,0,0,.12)'; g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-s*60); g.lineTo(x+s*1.2,y-s*60); g.lineTo(x+s*3,y); g.fill();
    g.strokeStyle='#a8a29e'; g.lineWidth=1; g.beginPath(); for(let k=1;k<12;k++){ const yy=y-k*s*5, hw=s*(3-1.8*k/12); g.moveTo(x-hw,yy); g.lineTo(x+hw,yy); } g.stroke();
    g.fillStyle='#e7e5e4'; vdRR(g,x-s*3,y-s*66,s*6,s*6,s*1.5); g.fill(); g.fillStyle=lit?'#ffd27a':'#334155'; g.fillRect(x-s*2.4,y-s*64,s*4.8,s*1.6); if(lit) vdWin(x-s*2.4,y-s*64,s*4.8,s*1.6);
    g.fillStyle='#9ca3af'; g.fillRect(x-s*0.3,y-s*84,s*0.6,s*18); vdLight(x,y-s*84,s*2,0.9,'255,40,40'); }
  else { // rond-point avec statue et drapeaux
    g.fillStyle='#9ca3af'; g.beginPath(); g.ellipse(x,y,s*9,s*1.4,0,0,7); g.fill(); g.fillStyle='#4ade80'; g.beginPath(); g.ellipse(x,y-s*0.3,s*8,s*1.1,0,0,7); g.fill();
    g.fillStyle='#e7e5e4'; g.fillRect(x-s*1.4,y-s*5,s*2.8,s*5); g.fillStyle='#78716c'; g.beginPath(); g.arc(x,y-s*7.6,s*0.6,0,7); g.fill(); g.fillRect(x-s*0.6,y-s*7,s*1.2,s*2); g.strokeStyle='#78716c'; g.lineWidth=s*0.35; g.beginPath(); g.moveTo(x+s*0.4,y-s*6.6); g.lineTo(x+s*1.4,y-s*8.4); g.stroke();
    for(const [fx,fc] of [[-6,'#0ea5e9'],[6,'#0ea5e9']]){ g.fillStyle='#d1d5db'; g.fillRect(x+fx*s,y-s*9,s*0.2,s*9); g.fillStyle=fc; const wv=Math.sin(VD.tt*3+fx)*s*0.3; g.beginPath(); g.moveTo(x+fx*s+s*0.2,y-s*9); g.lineTo(x+fx*s+s*2.6,y-s*8.6+wv); g.lineTo(x+fx*s+s*0.2,y-s*7.6); g.fill(); g.fillStyle='#facc15'; g.fillRect(x+fx*s+s*0.5,y-s*8.8,s*0.4,s*0.4); }
    if(lit){ vdLight(x-s*4,y-s*2,s*6,0.4); vdLight(x+s*4,y-s*2,s*6,0.4); } } }
const VD_SHOPS=['Alimentation','Pharmacie','Coiffure','Boutique','Quincaillerie','Restaurant','Phone & Crédit','Boulangerie','Ets Mbote','Pagnes','Bar La Joie','Hôtel','Cabine','Dépôt'];
function vdShop(g,x,y,w,h,s,wall,sc,txt,lit,two){
  const H2=two?h*1.7:h; g.fillStyle=wall; g.fillRect(x,y-H2,w,H2); g.fillStyle=vdDk(wall,0.15); g.fillRect(x-s*0.3,y-H2-s*0.6,w+s*0.6,s*0.6); g.fillStyle='rgba(0,0,0,.1)'; g.fillRect(x+w*0.92,y-H2,w*0.08,H2);
  if(two){ for(let k=0;k<3;k++){ const X=x+w*(0.1+k*0.3), Y=y-H2+s*1.2; g.fillStyle=lit&&vdRnd(Math.round(x),k)<0.6?'#ffd27a':'#334155'; g.fillRect(X,Y,w*0.2,h*0.32); if(lit) vdWin(X,Y,w*0.2,h*0.32); }
    g.strokeStyle='#e5e7eb'; g.lineWidth=1; g.beginPath(); g.moveTo(x,y-h-s*0.3); g.lineTo(x+w,y-h-s*0.3); for(let k=0;k<=8;k++){ g.moveTo(x+k*w/8,y-h-s*0.3); g.lineTo(x+k*w/8,y-h+s*0.6); } g.stroke(); }
  // enseigne peinte
  if(lit&&/Bar|Restaurant|Hôtel/.test(txt)){ const C=['255,60,60','255,200,40','60,200,255','120,255,120','255,90,200']; for(let k=0;k<9;k++){ const bx=x+w*(0.05+k*0.11), by=y-h*1.02+Math.sin(k/8*Math.PI)*h*0.08; const on=(Math.floor(performance.now()/350)+k)%3!==0; g.fillStyle=on?`rgb(${C[k%5]})`:'#444'; g.beginPath(); g.arc(bx,by,Math.max(1.5,s*0.25),0,7); g.fill(); if(on) vdLight(bx,by,s*1.6,0.7,C[k%5]); } }
  const sy=y-h*0.98; g.fillStyle=sc; g.fillRect(x+w*0.04,sy,w*0.92,h*0.24); g.fillStyle='#fff'; g.font=`bold ${Math.max(7,Math.min(h*0.17,w*0.12))}px sans-serif`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,x+w*0.5,sy+h*0.125,w*0.88); g.textBaseline='alphabetic';
  // auvent rayé
  const ay=sy+h*0.26; for(let k=0;k<8;k++){ g.fillStyle=k%2?'#f8fafc':sc; g.beginPath(); g.moveTo(x+k*w/8,ay); g.lineTo(x+(k+1)*w/8,ay); g.lineTo(x+(k+1)*w/8+s*0.3,ay+h*0.14); g.lineTo(x+k*w/8+s*0.3,ay+h*0.14); g.fill(); }
  // vitrine ouverte avec marchandises
  const oy=ay+h*0.16, oh=y-oy; g.fillStyle=lit?'#4a3a22':'#1f2937'; g.fillRect(x+w*0.08,oy,w*0.6,oh); if(lit){ vdLight(x+w*0.38,oy+oh*0.5,w*0.6,0.45); }
  const G=['#f59e0b','#dc2626','#16a34a','#2563eb','#facc15','#f8fafc','#a855f7']; for(let r=0;r<3;r++) for(let k=0;k<6;k++){ g.fillStyle=G[(k*3+r+Math.round(x))%G.length]; g.fillRect(x+w*0.1+k*w*0.095,oy+oh*0.15+r*oh*0.27,w*0.07,oh*0.18); }
  g.fillStyle='#78350f'; g.fillRect(x+w*0.74,oy,w*0.16,oh); }
function vdTower(g,x,y,w,h,col,lit,s){
  const gr=g.createLinearGradient(x,0,x+w,0); gr.addColorStop(0,vdLt(col,0.1)); gr.addColorStop(0.85,col); gr.addColorStop(1,vdDk(col,0.2)); g.fillStyle=gr; g.fillRect(x,y-h,w,h);
  const fh=Math.max(6,2.6*s), cw=Math.max(6,2.3*s), fl=Math.floor((h-fh)/fh), cols=Math.max(2,Math.floor((w-cw*0.6)/cw)), ox=x+(w-cols*cw)/2+cw*0.2;
  const gw=g.createLinearGradient(0,y-h,0,y); gw.addColorStop(0,'#a9cbea'); gw.addColorStop(1,'#46617e');
  for(let f=0;f<fl;f++){ const Y=y-h+fh*0.5+f*fh; g.fillStyle='rgba(0,0,0,.1)'; g.fillRect(x,Y+fh*0.72,w,Math.max(1,fh*0.1));
    for(let c=0;c<cols;c++){ const X=ox+c*cw, on=lit&&vdRnd(Math.round(x)+c,f)<0.45; g.fillStyle=on?'#ffd27a':lit?'#1e293b':gw; g.fillRect(X,Y,cw*0.6,fh*0.55); if(on) vdWin(X,Y,cw*0.6,fh*0.55); } }
  g.fillStyle=vdDk(col,0.3); g.fillRect(x-1,y-h-2,w+2,3); g.fillStyle='#94a3b8'; g.fillRect(x+w*0.15,y-h-s*1.6,w*0.2,s*1.6); g.fillRect(x+w*0.7,y-h-s*3.5,1.5,s*3.5);
  if(lit) vdLight(x+w*0.7,y-h-s*3.5,4,0.8,'255,60,60'); }
function vdChurch(g,x,y,s,lit){ vdHouse(g,x,y,s*1.7,s*0.95,'#f5f5f4','#7b2f22',lit); g.fillStyle='#f5f5f4'; g.fillRect(x+s*0.04,y-s*2.05,s*0.42,s*2.05); g.fillStyle='rgba(0,0,0,.08)'; g.fillRect(x+s*0.36,y-s*2.05,s*0.1,s*2.05);
  g.fillStyle='#7b2f22'; g.beginPath(); g.moveTo(x-s*0.02,y-s*2.05); g.lineTo(x+s*0.25,y-s*2.55); g.lineTo(x+s*0.52,y-s*2.05); g.fill();
  g.fillStyle='#1f2933'; g.fillRect(x+s*0.235,y-s*2.85,s*0.04,s*0.32); g.fillRect(x+s*0.17,y-s*2.76,s*0.17,s*0.04); g.fillStyle='#6b4423'; g.beginPath(); g.moveTo(x+s*0.13,y); g.lineTo(x+s*0.13,y-s*0.35); g.arc(x+s*0.25,y-s*0.35,s*0.12,Math.PI,0); g.lineTo(x+s*0.37,y); g.fill();
  g.fillStyle=lit?'#ffd27a':'#334155'; g.beginPath(); g.arc(x+s*0.25,y-s*1.45,s*0.09,0,7); g.fill(); }
function vdStall(g,x,y,s,c){ g.fillStyle='#6b4a2e'; g.fillRect(x,y-s*0.45,s*1.2,s*0.1); g.fillRect(x+s*0.05,y-s*0.35,s*0.06,s*0.35); g.fillRect(x+s*1.09,y-s*0.35,s*0.06,s*0.35);
  const L=[]; for(let k=0;k<6;k++) L.push([x+s*(0.12+k*0.19),y-s*0.52,s*0.085]); const C=['#f59e0b','#16a34a','#dc2626','#facc15','#ea580c','#65a30d']; L.forEach((b,k)=>vdBlobs(g,C[(k+Math.round(x))%6],[b]));
  g.fillStyle='#4b3a2a'; g.fillRect(x+s*0.58,y-s*1.25,s*0.05,s*0.8); for(let k=0;k<6;k++){ g.fillStyle=k%2?'#f8fafc':c; g.beginPath(); g.moveTo(x+s*0.6,y-s*1.4); g.lineTo(x-s*0.2+k*s*0.28,y-s*1.0); g.lineTo(x-s*0.2+(k+1)*s*0.28,y-s*1.0); g.fill(); } }
function vdKiosk(g,x,y,s,txt,c){ g.fillStyle=c; g.fillRect(x,y-s*1.25,s*1.5,s*1.25); g.fillStyle=vdDk(c,0.25); g.fillRect(x-s*0.1,y-s*1.4,s*1.7,s*0.18); g.fillStyle='#f8fafc'; g.fillRect(x+s*0.08,y-s*1.1,s*1.34,s*0.3);
  g.fillStyle=c; g.font=`bold ${Math.max(7,s*0.2)}px sans-serif`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,x+s*0.75,y-s*0.95,s*1.3); g.textBaseline='alphabetic'; g.fillStyle='#1f2a3a'; g.fillRect(x+s*0.2,y-s*0.72,s*1.1,s*0.4); }
function vdLamp(g,x,y,s){ g.strokeStyle='#4b5563'; g.lineWidth=Math.max(1.2,s*0.25); g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-s*7); g.quadraticCurveTo(x,y-s*7.8,x+s*1.4,y-s*7.6); g.stroke();
  g.fillStyle=VD.dark>0.4?'#fff1c2':'#9ca3af'; g.fillRect(x+s*1,y-s*7.7,s*0.9,s*0.35); if(VD.dark>0.4){ vdLight(x+s*1.45,y-s*7.4,s*7,0.55); VD.beams.push([x+s*1.45,y-s*7.4,s*3.2,y]); } }
function vdBillboard(g,x,y,s){ const col=S.company.color||'#2563eb', w=16*s, h=6*s, top=y-12*s; g.fillStyle='#4b5563'; g.fillRect(x+w*0.2,top+h,s*0.5,12*s-h); g.fillRect(x+w*0.75,top+h,s*0.5,12*s-h);
  const gr=g.createLinearGradient(x,top,x+w,top+h); gr.addColorStop(0,col); gr.addColorStop(1,vdDk(col,0.35)); g.fillStyle=gr; g.fillRect(x,top,w,h); g.strokeStyle='#e5e7eb'; g.lineWidth=Math.max(1,s*0.3); g.strokeRect(x,top,w,h);
  g.fillStyle='#fff'; g.textAlign='left'; g.font=`bold ${Math.max(8,s*1.5)}px sans-serif`; g.fillText(`${S.company.logo||'✈️'} ${S.company.name}`.slice(0,24),x+s*0.8,top+h*0.45,w-s*1.6); g.font=`${Math.max(7,s*1.05)}px sans-serif`; g.fillText('Volez avec nous partout au Congo !',x+s*0.8,top+h*0.8,w-s*1.6);
  if(VD.dark>0.4){ vdLight(x+w*0.5,top+h*0.5,w*0.6,0.35,'255,240,210'); } }
function vdStation(g,x,y,s){ const col='#16a34a', w=18*s; g.fillStyle='#e5e7eb'; g.fillRect(x+w*0.65,y-5*s,w*0.35,5*s); g.fillStyle='#1f2937'; g.fillRect(x+w*0.7,y-3.6*s,w*0.12,3.6*s); g.fillStyle='#93c5fd'; g.fillRect(x+w*0.85,y-3.8*s,w*0.12,1.8*s);
  g.fillStyle='#d1d5db'; g.fillRect(x+w*0.1,y-6.5*s,s*0.5,6.5*s); g.fillRect(x+w*0.55,y-6.5*s,s*0.5,6.5*s); g.fillStyle=col; g.fillRect(x,y-8*s,w*0.68,1.6*s); g.fillStyle='#facc15'; g.fillRect(x,y-6.6*s,w*0.68,0.3*s);
  g.fillStyle='#fff'; g.font=`bold ${Math.max(8,s*1.1)}px sans-serif`; g.textAlign='center'; g.fillText('STATION',x+w*0.34,y-6.9*s);
  for(const px of [0.22,0.42]){ g.fillStyle='#dc2626'; g.fillRect(x+w*px,y-2.6*s,1.6*s,2.6*s); g.fillStyle='#f8fafc'; g.fillRect(x+w*px+0.3*s,y-2.2*s,s,0.8*s); }
  if(VD.dark>0.4){ vdLight(x+w*0.34,y-6.6*s,w*0.5,0.5,'235,255,240'); VD.beams.push([x+w*0.34,y-6.6*s,w*0.32,y]); } }
function vdPark(g,x,y,w,s){ const n=VD.dark>0.5; g.fillStyle='#4ade80'; g.fillRect(x,y-0.5*s,w,0.8*s);
  vdTree(g,x+w*0.18,y,4.2*s,'#2f7d32'); vdPalm(g,x+w*0.55,y,13*s); vdTree(g,x+w*0.86,y,3.6*s,'#3a8a3a');
  g.fillStyle='#78350f'; g.fillRect(x+w*0.3,y-1.6*s,4*s,0.45*s); g.fillRect(x+w*0.3,y-2.6*s,4*s,0.35*s); g.fillRect(x+w*0.3+0.2*s,y-1.6*s,0.35*s,1.6*s); g.fillRect(x+w*0.3+3.4*s,y-1.6*s,0.35*s,1.6*s);
  g.strokeStyle='#e5e7eb'; g.lineWidth=1; g.beginPath(); for(let k=0;k<=w;k+=1.4*s){ g.moveTo(x+k,y); g.lineTo(x+k,y-2*s); } g.moveTo(x,y-1.7*s); g.lineTo(x+w,y-1.7*s); g.stroke();
  vdLamp(g,x+w*0.7,y,s*0.9); g.fillStyle='#14532d'; g.font=`bold ${Math.max(8,1.3*s)}px sans-serif`; g.textAlign='center'; g.fillStyle='#fff'; g.fillRect(x+w*0.02,y-4.4*s,9*s,1.8*s); g.fillStyle='#166534'; g.fillText('Jardin public',x+w*0.02+4.5*s,y-3.2*s,8.6*s); }
function vdFire(g,x,y,s){ vdBlobs(g,'#57534e',[[x-s*0.6,y-s*0.2,s*0.3],[x+s*0.6,y-s*0.2,s*0.3],[x,y-s*0.15,s*0.3]]); const f=Math.sin(VD.tt*14+x)*0.15;
  g.fillStyle='#f97316'; g.beginPath(); g.moveTo(x-s*0.5,y-s*0.3); g.quadraticCurveTo(x-s*0.3,y-s*(1.4+f),x,y-s*(1.8+f)); g.quadraticCurveTo(x+s*0.3,y-s*1.2,x+s*0.5,y-s*0.3); g.fill(); g.fillStyle='#fde047'; g.beginPath(); g.moveTo(x-s*0.25,y-s*0.3); g.quadraticCurveTo(x,y-s*(1.1-f),x+s*0.25,y-s*0.3); g.fill();
  g.fillStyle='#3f3f46'; g.fillRect(x-s*0.5,y-s*1.2,s,s*0.7);   // marmite
  for(let k=0;k<5;k++){ const p=((VD.tt*0.6+k/5)%1); g.fillStyle=`rgba(200,200,200,${0.35*(1-p)})`; g.beginPath(); g.arc(x+Math.sin(p*5+k)*s*0.6+p*s*2,y-s*1.4-p*s*7,s*(0.4+p*1.4),0,7); g.fill(); }
  vdLight(x,y-s,s*5,VD.dark>0.4?0.6:0.15,'255,150,60'); }
function vdLaundry(g,x,y,s){ g.strokeStyle='#5b4636'; g.lineWidth=Math.max(1,s*0.2); g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-4*s); g.moveTo(x+9*s,y); g.lineTo(x+9*s,y-4*s); g.stroke(); g.strokeStyle='#d6d3d1'; g.lineWidth=0.8; g.beginPath(); g.moveTo(x,y-3.8*s); g.quadraticCurveTo(x+4.5*s,y-3.2*s,x+9*s,y-3.8*s); g.stroke();
  const C=['#dc2626','#2563eb','#facc15','#16a34a','#f8fafc','#db2777']; for(let k=0;k<5;k++){ const cx=x+(1+k*1.6)*s, cy=y-3.6*s+Math.sin(k/4*Math.PI)*0.5*s; g.fillStyle=C[(k+Math.round(x))%6]; g.fillRect(cx,cy,s*1.2,s*(1.2+(k%2)*0.6)); } }
function vdGoat(g,x,y,s,c,t){ c=c||'#f5f5f4'; const b=Math.sin(t)*0.15*s; g.fillStyle=vdDk(c,0.25); g.fillRect(x-s*0.9,y-s*0.9,s*0.22,s*0.9); g.fillRect(x+s*0.6,y-s*0.9+b,s*0.22,s*0.9-b);
  g.fillStyle=c; g.beginPath(); g.ellipse(x,y-s*1.1,s*1.15,s*0.5,0,0,7); g.fill(); g.fillRect(x-s*0.7,y-s*0.9,s*0.22,s*0.9); g.fillRect(x+s*0.4,y-s*0.9,s*0.22,s*0.9);
  g.beginPath(); g.ellipse(x+s*1.3,y-s*1.55+b*0.5,s*0.42,s*0.28,-0.5,0,7); g.fill(); g.strokeStyle='#57534e'; g.lineWidth=1; g.beginPath(); g.moveTo(x+s*1.2,y-s*1.8); g.lineTo(x+s*0.95,y-s*2.2); g.stroke(); }
function vdChicken(g,x,y,s,t){ const p=Math.abs(Math.sin(t))*0.3*s; g.fillStyle='#b45309'; g.beginPath(); g.ellipse(x,y-s*0.6,s*0.55,s*0.4,0,0,7); g.fill(); g.beginPath(); g.arc(x+s*0.45,y-s*0.95+p,s*0.22,0,7); g.fill(); g.fillStyle='#dc2626'; g.fillRect(x+s*0.38,y-s*1.25+p,s*0.15,s*0.15); g.fillStyle='#f59e0b'; g.fillRect(x+s*0.65,y-s*0.98+p,s*0.18,s*0.08); }
const VD_SKIN=['#4a2e1f','#5c3a26','#3b2418','#6b4430'], VD_CLO=['#dc2626','#2563eb','#f59e0b','#16a34a','#db2777','#f8fafc','#7c3aed','#ea580c','#0d9488'];
function vdPerson(g,x,y,s,c,t,kind,seed){ const sk=VD_SKIN[seed%4], c2=VD_CLO[(seed+3)%VD_CLO.length], sw=Math.sin(t)*s*0.16, wave=performance.now()-(VD.honkR||-1e9)<2600; if(kind==='kid') s*=0.75; y-=Math.abs(Math.sin(t))*s*0.04;
  if(s>4){ g.fillStyle='#1c1917'; g.fillRect(x+sw-s*0.06,y-s*0.06,s*0.16,s*0.06); g.fillRect(x-sw-s*0.06,y-s*0.06,s*0.16,s*0.06); }
  if(kind==='police') c='#1e3a8a';
  g.strokeStyle=sk; g.lineWidth=Math.max(1,s*0.13); g.lineCap='round'; g.beginPath(); g.moveTo(x,y-s*0.5); g.lineTo(x+sw,y); g.moveTo(x,y-s*0.5); g.lineTo(x-sw,y); g.stroke();
  if(kind==='maman'){ g.fillStyle=c; g.beginPath(); g.moveTo(x-s*0.2,y-s*1.05); g.lineTo(x+s*0.2,y-s*1.05); g.lineTo(x+s*0.3,y-s*0.2); g.lineTo(x-s*0.3,y-s*0.2); g.fill(); g.fillStyle=c2; g.fillRect(x-s*0.28,y-s*0.6,s*0.56,s*0.12); }
  else { g.fillStyle=c; g.fillRect(x-s*0.17,y-s*1.08,s*0.34,s*0.6); g.fillStyle=kind==='kid'?c2:'#1f2937'; g.fillRect(x-s*0.15,y-s*0.55,s*0.3,s*0.12); }
  g.strokeStyle=sk; g.beginPath(); g.moveTo(x,y-s*1.0); g.lineTo(x-sw*0.8,y-s*0.6); g.stroke();
  g.fillStyle=sk; g.beginPath(); g.arc(x,y-s*1.22,s*0.15,0,7); g.fill();
  if(kind!=='maman'&&kind!=='police'&&s>3){ g.fillStyle='#1c1917'; g.beginPath(); g.arc(x,y-s*1.25,s*0.155,Math.PI*1.05,Math.PI*1.95); g.fill(); }
  if(kind==='maman'){ g.fillStyle=c2; g.fillRect(x-s*0.17,y-s*1.4,s*0.34,s*0.12);   // foulard
    if(seed%3!==0){ g.fillStyle=['#2563eb','#dc2626','#f59e0b','#e5e7eb'][seed%4]; g.beginPath(); g.ellipse(x,y-s*1.5,s*0.42,s*0.13,0,0,7); g.fill(); vdBlobs(g,['#f59e0b','#16a34a','#dc2626'][seed%3],[[x-s*0.15,y-s*1.62,s*0.12],[x+s*0.12,y-s*1.64,s*0.12],[x,y-s*1.72,s*0.12]]); } }
  if(kind==='police'){ g.fillStyle='#111827'; g.fillRect(x-s*0.2,y-s*1.42,s*0.4,s*0.12); g.fillRect(x-s*0.12,y-s*1.5,s*0.24,s*0.1); g.fillStyle='#f8fafc'; g.fillRect(x-s*0.17,y-s*0.62,s*0.34,s*0.06); }
  const up=kind==='police'||(wave&&(seed%5)!==0&&!(kind==='maman'&&seed%3!==0)), wv=Math.sin(performance.now()/120+seed)*s*0.25;
  g.strokeStyle=sk; g.beginPath(); g.moveTo(x,y-s*1.0); if(up) g.lineTo(x+s*0.3+wv,y-s*1.6); else g.lineTo(x+(kind==='maman'&&seed%3!==0?s*0.25:sw*0.8),y-(kind==='maman'&&seed%3!==0?s*1.5:s*0.6)); g.stroke(); g.lineCap='butt'; }
function vdPole(g,x,y,s,prev){ const top=y-11*s; g.fillStyle='#5b4636'; g.fillRect(x-s*0.2,top,s*0.4,11*s); g.fillRect(x-s*1.2,top+s*0.6,s*2.4,s*0.3); g.fillStyle='#e5e7eb'; g.fillRect(x-s*1.1,top+s*0.3,s*0.25,s*0.3); g.fillRect(x+s*0.85,top+s*0.3,s*0.25,s*0.3);
  if(prev!==null){ g.strokeStyle='rgba(30,30,30,.6)'; g.lineWidth=1; g.beginPath(); for(const dx of [-1,1]){ g.moveTo(prev+dx*s,top+s*0.4); g.quadraticCurveTo((prev+x)/2,top+s*2.4,x+dx*s,top+s*0.4); } g.stroke();
    const n=Math.floor(vdRnd(Math.round(x/7),5)*4), fly=performance.now()-(VD.honkR||-1e9)<3000; g.fillStyle='#1f2937';
    for(let k=0;k<n;k++){ const t=0.25+k*0.17, bx=prev+(x-prev)*t-s, by=top+s*0.4+4*t*(1-t)*s*2-s*0.45;
      if(fly){ const up=(performance.now()-VD.honkR)/1000; g.strokeStyle='#1f2937'; g.lineWidth=1.3; g.beginPath(); const fx=bx+up*s*6*(k%2?1:-0.6), fy=by-up*s*8, fl=Math.sin(performance.now()/60+k)*s*0.4; g.moveTo(fx-s*0.7,fy-fl); g.lineTo(fx,fy); g.lineTo(fx+s*0.7,fy-fl); g.stroke(); }
      else { g.beginPath(); g.ellipse(bx,by,s*0.38,s*0.26,0,0,7); g.fill(); g.beginPath(); g.arc(bx+s*0.3,by-s*0.22,s*0.16,0,7); g.fill(); g.fillRect(bx-s*0.6,by-s*0.05,s*0.3,s*0.12); } } } }
function vdBorne(g,x,y,s,name,km){ g.fillStyle='rgba(0,0,0,.2)'; g.fillRect(x+s*0.4,y-s*0.2,s*2.4,s*0.3); g.fillStyle='#f8fafc'; vdRR(g,x,y-s*3.6,s*2.4,s*3.6,s*0.7); g.fill(); g.fillStyle='#dc2626'; vdRR(g,x,y-s*3.6,s*2.4,s*1.3,s*0.7); g.fill(); g.fillRect(x,y-s*2.9,s*2.4,s*0.6);
  g.textAlign='center'; g.fillStyle='#fff'; g.font=`bold ${Math.max(6,s*0.62)}px sans-serif`; g.fillText(name.slice(0,7).toUpperCase(),x+s*1.2,y-s*2.65,s*2.3); g.fillStyle='#111827'; g.font=`bold ${Math.max(7,s*0.95)}px sans-serif`; g.fillText(String(km),x+s*1.2,y-s*1.05,s*2.3); }
function vdWelcome(g,x,y,s,name){ g.fillStyle='#4b5563'; g.fillRect(x,y-9*s,s*0.5,9*s); g.fillRect(x+10*s,y-9*s,s*0.5,9*s); const w=11*s, top=y-15*s;
  g.fillStyle='#1d4ed8'; vdRR(g,x-s*0.3,top,w,6*s,s*0.6); g.fill(); g.strokeStyle='#fff'; g.lineWidth=Math.max(1,s*0.25); vdRR(g,x+s*0.1,top+s*0.4,w-s*0.8,5.2*s,s*0.4); g.stroke();
  g.fillStyle='#facc15'; g.font=`bold ${Math.max(8,1.6*s)}px sans-serif`; g.textAlign='center'; g.fillText('★',x+s*1.4,top+s*2.2); g.fillStyle='#fff'; g.font=`${Math.max(8,1.3*s)}px sans-serif`; g.fillText('Bienvenue à',x+w*0.5,top+s*2.3,w-s); g.font=`bold ${Math.max(9,2*s)}px sans-serif`; g.fillText(name,x+w*0.5,top+s*4.7,w-s); }
function vdGare(g,x,y,s,name,lit){ const w=40*s; g.fillStyle='#9ca3af'; g.fillRect(x,y-1.2*s,w,1.4*s); g.fillStyle='#d1d5db'; g.fillRect(x,y-1.2*s,w,0.4*s);
  vdHouse(g,x+w*0.32,y-1.2*s,14*s,6*s,'#f3d77a','#7b2f22',lit); g.fillStyle='#1e3a8a'; g.fillRect(x+w*0.34,y-9.6*s,11*s,1.8*s); g.fillStyle='#fff'; g.font=`bold ${Math.max(8,1.2*s)}px sans-serif`; g.textAlign='center'; g.fillText('GARE DE '+name.toUpperCase(),x+w*0.34+5.5*s,y-8.3*s,10.6*s);
  g.fillStyle='#64748b'; for(const px of [0.04,0.18,0.82,0.96]) g.fillRect(x+w*px,y-7*s,s*0.35,5.8*s); g.fillStyle='#7b2f22'; g.fillRect(x,y-7.4*s,w*0.3,0.6*s); g.fillRect(x+w*0.7,y-7.4*s,w*0.3,0.6*s);
  for(let k=0;k<7;k++){ const px=x+w*(0.06+k*0.13)+(k%2?s:0); if(px>x+w*0.3&&px<x+w*0.68) continue; vdPerson(g,px,y-1.2*s,2*s,VD_CLO[(k*3+name.length)%VD_CLO.length],0,['maman','homme','kid','maman'][k%4],k+name.length); }
  vdPerson(g,x+w*0.7,y-1.2*s,2.1*s,'#1e3a8a',0,'police',2); g.fillStyle='#dc2626'; g.fillRect(x+w*0.7+s*0.5,y-4.6*s,s*1.2,s*0.8);
  if(lit){ vdLight(x+w*0.15,y-6.5*s,10*s,0.5); vdLight(x+w*0.85,y-6.5*s,10*s,0.5); } }

/* ---------- le bateau : port, eau, convoi ---------- */
function vdPort(g,x,y,s,name,lit){ const w=180*s; g.fillStyle='#9ca3af'; g.fillRect(x,y-1.2*s,w,3*s); g.fillStyle='#6b7280'; for(let k=0;k<w;k+=12*s) g.fillRect(x+k,y-1.6*s,s*0.8,s*0.6);
  for(let k=0;k<3;k++){ const hx=x+w*(0.08+k*0.12); g.fillStyle=['#e5e7eb','#d6d3d1','#cbd5e1'][k]; g.fillRect(hx,y-9*s,18*s,8*s); g.fillStyle='#7b8794'; g.beginPath(); g.moveTo(hx-s,y-9*s); g.lineTo(hx+9*s,y-12*s); g.lineTo(hx+19*s,y-9*s); g.fill(); g.fillStyle='#374151'; g.fillRect(hx+6*s,y-6*s,6*s,5*s); if(lit) vdLight(hx+9*s,y-6*s,10*s,0.5); }
  const C=['#b91c1c','#1d4ed8','#15803d','#f59e0b','#7c3aed','#0891b2']; for(let k=0;k<14;k++){ const cx=x+w*0.45+(k%7)*5.4*s, cy=y-1.2*s-(Math.floor(k/7)+1)*2.4*s; g.fillStyle=C[(k*5+name.length)%6]; g.fillRect(cx,cy,5.2*s,2.3*s); g.fillStyle='rgba(0,0,0,.18)'; for(let j=1;j<5;j++) g.fillRect(cx+j*1.04*s,cy,1,2.3*s); }
  for(const px of [0.72,0.86]){ const cx=x+w*px; g.strokeStyle='#f59e0b'; g.lineWidth=Math.max(1.5,s*0.5); g.beginPath(); g.moveTo(cx-3*s,y-1.2*s); g.lineTo(cx-3*s,y-20*s); g.moveTo(cx+3*s,y-1.2*s); g.lineTo(cx+3*s,y-20*s); g.moveTo(cx-6*s,y-20*s); g.lineTo(cx+16*s,y-20*s); g.moveTo(cx-3*s,y-12*s); g.lineTo(cx+3*s,y-16*s); g.stroke(); g.strokeStyle='#374151'; g.lineWidth=1; g.beginPath(); g.moveTo(cx+12*s,y-20*s); g.lineTo(cx+12*s,y-9*s); g.stroke(); if(lit) vdLight(cx,y-20*s,6*s,0.7,'255,60,60'); }
  g.fillStyle='#1e3a8a'; g.fillRect(x+w*0.08,y-16*s,26*s,3*s); g.fillStyle='#fff'; g.font=`bold ${Math.max(8,1.6*s)}px sans-serif`; g.textAlign='center'; g.fillText('PORT DE '+name.toUpperCase(),x+w*0.08+13*s,y-14*s,25*s);
  for(let k=0;k<6;k++) vdPerson(g,x+w*(0.4+k*0.05),y-1.2*s,2*s,VD_CLO[(k*2+name.length)%9],VD.tt*4+k,['maman','homme','kid'][k%3],k); }
function vdWater(g){ const s=VD.sc, W=VD.W, H=VD.H, top=VD.waterTop, d=VD.d, sky=vdPre(VD.skyH), riv=VD.path.kind==='river';
  const gr=g.createLinearGradient(0,top,0,H); gr.addColorStop(0,vdMix(riv?'#8a7450':'#3d7298',sky,0.45)); gr.addColorStop(0.35,riv?'#6f5c3c':'#2c5f84'); gr.addColorStop(1,riv?'#4a3d28':'#173a57'); g.fillStyle=gr; g.fillRect(0,top,W,H-top);
  if(!VD.oceanOnly&&VD.showBank){ g.fillStyle='rgba(20,40,20,.25)'; g.fillRect(0,top,W,s*3); }
  if(VD.sun&&!VD.rain){ const sx=VD.sun.x; g.fillStyle=`rgba(255,240,200,${0.25+0.25*VD.sun.low})`; for(let k=0;k<14;k++){ const y=top+(H-top)*(k/14)+((VD.tt*8+k*13)%9), w=(6+k*2.4)*(0.7+0.3*Math.sin(VD.tt*2+k)); g.fillRect(sx-w,y,w*2,1.5); } }
  g.strokeStyle='rgba(255,255,255,.22)'; g.lineWidth=1.2; g.beginPath(); for(let k=0;k<40;k++){ const ry=vdRnd(k,401), y=top+(H-top)*ry, sp=0.3+ry*1.2, x=((vdRnd(k,402)*W*1.3-d*s*sp*0.4)%(W*1.3)+W*1.3)%(W*1.3)-W*0.15, w=(4+ry*16); g.moveTo(x,y); g.quadraticCurveTo(x+w/2,y-1.5,x+w,y); } g.stroke(); }
function vdSmallBoat(g,X,y,b,typ,k,dir){ g.save(); g.translate(X,0); if(dir<0) g.scale(-1,1);
  if(typ===0){ g.fillStyle='#4a2e14'; g.beginPath(); g.moveTo(-6*b,y-b*0.6); g.quadraticCurveTo(0,y+b*0.7,6*b,y-b*0.6); g.fill(); vdPerson(g,b*1.5,y-b*0.4,b*2,VD_CLO[k%9],0,'homme',k); vdPerson(g,-b*2,y-b*0.4,b*1.9,VD_CLO[(k+3)%9],0,'homme',k+1); g.strokeStyle='#3f2a14'; g.lineWidth=Math.max(1,b*0.2); g.beginPath(); g.moveTo(b*2,y-b*2.4); g.lineTo(b*3.6,y+b*0.4); g.stroke(); }
  else if(typ===1){ g.fillStyle='#5b3a1a'; g.beginPath(); g.moveTo(-14*b,y-1.2*b); g.lineTo(14*b,y-1.4*b); g.lineTo(12*b,y); g.lineTo(-12*b,y); g.fill(); const C=['#dc2626','#2563eb','#facc15','#16a34a']; for(let j=0;j<5;j++){ g.fillStyle=C[(j+k)%4]; g.fillRect(-12*b+j*5*b,y-4.6*b,5*b,b*0.8); } for(let j=0;j<7;j++) vdPerson(g,-11*b+j*3.6*b,y-1.2*b,1.9*b,VD_CLO[(j+k)%9],0,j%2?'maman':'homme',j+k); }
  else { g.fillStyle='#374151'; g.fillRect(-18*b,y-2*b,30*b,2*b); g.fillStyle='#f1f5f9'; g.fillRect(-18*b,y-6*b,7*b,4*b); g.fillStyle='#1e3a8a'; g.fillRect(-18*b,y-7*b,7*b,b); const C=['#b91c1c','#1d4ed8','#15803d','#f59e0b']; for(let j=0;j<4;j++){ g.fillStyle=C[(j*3+k)%4]; g.fillRect(-10*b+j*5.4*b,y-4.4*b,5*b,2.4*b); } if(VD.dark>0.4) vdLight(-14*b,y-6*b,6*b,0.6); }
  g.restore(); }
function vdConvoy(g,x,y,s){ const col=S.company.color||'#2563eb', vk=VD.vk||'push', bob=Math.sin(VD.tt*1.6)*s*0.15; y+=bob;
  const wake=(x0,x1)=>{ g.strokeStyle='rgba(255,255,255,.6)'; g.lineWidth=Math.max(1,s*0.3); g.beginPath(); for(let k=0;k<6;k++){ const p=((VD.tt*0.6+k/6)%1), xx=x0-p*30*s; g.moveTo(xx,y+s*(0.3+p*1.4)); g.lineTo(xx-6*s,y+s*(0.3+p*1.6)); } g.stroke(); g.fillStyle='rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(x1,y+s*0.3,4*s,s*0.6,0,0,7); g.fill(); };
  const tug=(tx,len)=>{ g.fillStyle='#1f2937'; g.beginPath(); g.moveTo(tx,y-3*s); g.lineTo(tx+len,y-3*s); g.lineTo(tx+len-s,y+s*0.4); g.lineTo(tx+s,y+s*0.4); g.fill(); g.fillStyle='#b91c1c'; g.fillRect(tx+s,y-0.4*s,len-2*s,s*0.6);
    g.fillStyle='#f8fafc'; g.fillRect(tx+s,y-7*s,len*0.75,4*s); g.fillRect(tx+len*0.2,y-10.5*s,len*0.5,3.5*s); g.fillStyle=col; g.fillRect(tx+s,y-4*s,len*0.75,s*0.8);
    g.fillStyle=VD.dark>0.4?'#ffd27a':'#334155'; for(let k=0;k<5;k++) g.fillRect(tx+s*2+k*len*0.14,y-6.3*s,len*0.08,s*1.4); g.fillStyle=VD.dark>0.4?'#ffd27a':'#93c5fd'; g.fillRect(tx+len*0.24,y-9.8*s,len*0.42,s*1.8); if(VD.dark>0.4){ vdWin(tx+len*0.24,y-9.8*s,len*0.42,s*1.8); vdLight(tx+len*0.45,y-9*s,len*0.5,0.4); }
    g.fillStyle='#f8fafc'; g.font=`bold ${Math.max(8,1.3*s)}px sans-serif`; g.textAlign='left'; g.fillText(`${S.company.logo||''} ${S.company.name}`.slice(0,18),tx+s*1.5,y-1.1*s,len-3*s);
    g.fillStyle='#111827'; g.fillRect(tx+len*0.12,y-13.5*s,s*1.2,3.5*s); g.fillStyle=col; g.fillRect(tx+len*0.12,y-13.5*s,s*1.2,s*0.8);
    g.strokeStyle='#4b5563'; g.lineWidth=1; g.beginPath(); g.moveTo(tx+len*0.6,y-10.5*s); g.lineTo(tx+len*0.6,y-15*s); g.stroke(); g.fillStyle='#2563eb'; g.fillRect(tx+len*0.6,y-15*s,s*2.2,s*1.4); g.fillStyle='#dc2626'; g.beginPath(); g.moveTo(tx+len*0.6,y-13.6*s); g.lineTo(tx+len*0.6+s*2.2,y-15*s); g.lineTo(tx+len*0.6+s*2.2,y-14.6*s); g.lineTo(tx+len*0.6+s*0.4,y-13.6*s); g.fill(); g.fillStyle='#facc15'; g.fillRect(tx+len*0.6+s*0.3,y-14.9*s,s*0.4,s*0.4);
    if(Math.random()<0.3) VD.smoke.push({x:tx+len*0.12+s*0.6,y:y-13.8*s,r:s*0.5,a:0.5,c:'80,80,80'}); if(VD.dark>0.4) vdLight(tx+len*0.6,y-15.4*s,s*2,0.9,'255,255,240'); };
  const barge=(bx,len,k)=>{ g.fillStyle='#7c4a2a'; g.beginPath(); g.moveTo(bx,y-2.4*s); g.lineTo(bx+len,y-2.4*s); g.lineTo(bx+len-s*0.6,y+s*0.4); g.lineTo(bx+s*0.4,y+s*0.4); g.fill(); g.fillStyle='#57341c'; g.fillRect(bx,y-0.6*s,len,s*0.6);
    if(k%2===0){ const C=['#b91c1c','#1d4ed8','#15803d','#f59e0b','#7c3aed']; for(let j=0;j<6;j++) for(let r=0;r<2;r++){ g.fillStyle=C[(j*2+r+k)%5]; g.fillRect(bx+s*0.6+j*len/6.3,y-2.4*s-(r+1)*2.4*s,len/6.6,2.3*s); } }
    else { const L=[]; for(let j=0;j<9;j++) L.push([bx+s*1.5+j*len/9.5,y-3.4*s-(j%2)*0.6*s,s*1.1]); vdBlobs(g,'#d9c49a',L); for(let j=0;j<5;j++){ const px=bx+s*2+j*len/5.4; g.fillStyle=['#dc2626','#2563eb','#facc15','#16a34a','#db2777'][(j+k)%5]; g.beginPath(); g.moveTo(px-2*s,y-7.2*s); g.lineTo(px,y-8.4*s); g.lineTo(px+2*s,y-7.2*s); g.fill(); g.fillStyle='#4b5563'; g.fillRect(px-s*0.1,y-7.2*s,s*0.2,2.6*s); vdPerson(g,px+s*0.8,y-4.2*s,1.9*s,VD_CLO[(j*3+k)%9],0,j%2?'maman':'homme',j+k); } } };
  if(vk==='coaster'){ s=Math.min(s,VD.W*0.8/70); const L=70*s; g.fillStyle='#1e293b'; g.beginPath(); g.moveTo(x,y-6*s); g.lineTo(x+L,y-6*s); g.lineTo(x+L+3*s,y-7*s); g.lineTo(x+L-2*s,y+s); g.lineTo(x+s,y+s); g.fill(); g.fillStyle='#b91c1c'; g.fillRect(x+s,y-0.8*s,L-2*s,s*1.4); g.fillStyle=col; g.fillRect(x,y-6*s,L,s*0.9);
    const C=['#b91c1c','#1d4ed8','#15803d','#f59e0b','#7c3aed','#0891b2']; for(let j=0;j<10;j++) for(let r=0;r<3;r++){ g.fillStyle=C[(j*7+r*3)%6]; g.fillRect(x+14*s+j*5.3*s,y-6*s-(r+1)*2.3*s,5*s,2.2*s); }
    g.fillStyle='#f8fafc'; g.fillRect(x+2*s,y-16*s,10*s,10*s); g.fillStyle=VD.dark>0.4?'#ffd27a':'#334155'; g.fillRect(x+2.5*s,y-15*s,9*s,1.6*s); g.fillStyle='#111827'; g.fillRect(x+4*s,y-19*s,3*s,3*s); g.fillStyle=col; g.fillRect(x+4*s,y-19*s,3*s,1*s);
    g.fillStyle='#fff'; g.font=`bold ${Math.max(9,1.8*s)}px sans-serif`; g.textAlign='left'; g.fillText(`${S.company.logo||''} ${S.company.name}`.slice(0,24),x+16*s,y-2.5*s); if(Math.random()<0.3) VD.smoke.push({x:x+5.5*s,y:y-19*s,r:s,a:0.5,c:'80,80,80'}); wake(x,x+L+2*s); VD.front=(L+3*s)/s; VD.hl=[x+L,y-6*s]; return; }
  if(vk==='lake'){ const L=30*s; tug(x,L); g.fillStyle='#f8fafc'; g.fillRect(x+L*0.75,y-7*s,L*0.22,4*s); for(let j=0;j<5;j++) vdPerson(g,x+s*3+j*s*3.5,y-7*s,1.9*s,VD_CLO[(j*2)%9],0,j%2?'maman':'homme',j); wake(x,x+L); VD.front=L/s; VD.hl=[x+L,y-4*s]; return; }
  const n=vk==='barge'?1:(vdMob()?2:3), tl=14*s, bl=18*s; tug(x,tl); for(let k=0;k<n;k++) barge(x+tl+k*bl,bl-0.4*s,k); wake(x,x+tl+n*bl); VD.front=(tl+n*bl)/s; VD.hl=[x+tl+n*bl,y-2*s]; }
function vdBoatTraffic(g){ const s=VD.sc, d=VD.d, od=VD.od||0, W=VD.W, top=VD.waterTop, y0=top+(VD.wl-top)*0.25, y1=VD.wl-6*s, wL=d-VD.vx/s-60, wR=d+(W-VD.vx)/s+60, list=[];
  const gap=90, sh=od*0.5; for(let k=Math.floor((wL+sh)/gap);k<=Math.floor((wR+sh)/gap);k++){ if(vdRnd(k,421)<0.4) continue; const X=VD.vx+(k*gap+vdRnd(k,422)*40-sh-d)*s, ry=vdRnd(k,423); list.push([y0+(y1-y0)*ry,X,k,VD.oceanOnly?2:Math.floor(vdRnd(k,424)*3),-1,ry]); }
  const g2=200, sh2=od*1.3; for(let k=Math.floor((wL-sh2)/g2);k<=Math.floor((wR-sh2)/g2);k++){ if(vdRnd(k,431)<0.6) continue; const X=VD.vx+(k*g2+vdRnd(k,432)*60+sh2-d)*s, ry=vdRnd(k,433)*0.6; list.push([y0+(y1-y0)*ry,X,k,VD.oceanOnly?2:(vdRnd(k,434)<0.6?0:1),1,ry]); }
  for(const [y,X,k,typ,dir,ry] of list.sort((a,b)=>a[0]-b[0])) vdSmallBoat(g,X,y,s*(0.5+ry*0.5),typ,k,dir); }
function vdFrontWater(g){ const s=VD.sc*1.5, d=VD.d, W=VD.W, H=VD.H, T=18, off=d*1.5, x0=off-VD.vx/VD.sc-20, x1=x0+W/VD.sc+40;
  if(VD.path.kind!=='river') return;
  for(let t=Math.floor(x0/T);t<=Math.floor(x1/T);t++){ if(vdRnd(t,441)<0.45) continue; const X=VD.vx+(t*T+vdRnd(t,442)*T-off)*VD.sc, Y=VD.wl+(H-VD.wl)*(0.35+vdRnd(t,443)*0.55);
    const L=[]; for(let j=0;j<6;j++) L.push([X+(j-2.5)*s*1.3,Y-s*0.4-(j%2)*s*0.5,s*(0.9+vdRnd(t,450+j)*0.5)]); vdBlobs(g,'#2f6b2a',L); vdBlobs(g,'#4caf50',L.map(([a,b,r])=>[a-r*0.2,b-r*0.3,r*0.55]));
    if(vdRnd(t,444)<0.6) vdBlobs(g,'#c4b5fd',[[X,Y-s*1.6,s*0.45],[X+s*1.4,Y-s*1.3,s*0.4]]); } }

/* ---------- génération des objets d'un plan ---------- */
function vdGen(L){ const s=VD.sc, d=VD.d, off=d*L.f, T=L.T, x0=off-VD.vx/s-40/L.k, x1=off+(VD.W-VD.vx)/s+40/L.k, out=[], near=L.near, lit=VD.dark>0.45;
  const rivers=VD.riv;
  const sd=L.seed+(VD.seedL||0), rg=VD.rg;
  if(near&&VD.mode!=='boat') for(const st of VD.stops){ if(st.pop<500) continue; const X=VD.vx+(st.d+260-d)*s; if(X>-12*s&&X<VD.W+12*s) out.push({X,z:0,f:'mon',k:'rond'}); }
  if(!near&&L.seed===991) for(const st of VD.stops){ if(st.pop<3000) continue; const X=VD.vx+(st.d+1500-d)*0.5*s; if(X>-10*s&&X<VD.W+10*s) out.push({X,z:0,f:'mon',k:'tour'}); }
  if(VD.mode==='boat'&&near){ for(const st of VD.stops){ const X=VD.vx+(st.d-90-d)*s; if(X<VD.W+10&&X+180*s>-10) out.push({X,z:0,f:'port',txt:st.name}); } }
  for(let t=Math.floor(x0/T);t<=Math.floor(x1/T);t++){ const r=j=>vdRnd(t*7+sd,j), lx=t*T+r(1)*T, X=VD.vx+(lx-off)*s, w=d+(X-VD.vx)/s/L.f, Z=vdZone(w), fk=vdForestK(w);
    if(rivers.some(bx=>Math.abs(VD.vx+(bx-d)*s*L.f-X)<(VD_RIVW+12)*s*L.f)) continue;
    if(near&&VD.mode==='train'){ const st=VD.stops.find(q=>Math.abs(q.d-w)<30); if(st) continue; }
    if(near&&VD.mode==='boat'&&VD.stops.some(q=>w>q.d-110&&w<q.d+110)) continue;
    if(near&&Z.t!=='wild'&&r(30)<0.16) out.push({X:X+T*s*0.5,z:1,f:'shopx',t:['fuel','charbon','brochette','parasol'][Math.floor(r(31)*4)],seed:t});
    const k=r(2);
    if(Z.t==='town'&&Z.slum){ for(let j=0;j<(near?2:3);j++) out.push({X:X+j*T*s*0.42,z:0,f:'shack',w:5+r(20+j)*3.5,h:3.6+r(25+j)*1.6,seed:t*5+j});
      if(near&&r(8)<0.65) out.push({X:X+r(9)*T*s,z:2,f:'person',kind:['kid','maman','homme','kid'][Math.floor(r(14)*4)],c:VD_CLO[Math.floor(r(10)*VD_CLO.length)],sp:r(11),seed:t});
      if(near&&r(15)<0.25) out.push({X:X+T*s*0.3,z:1,f:'laundry'}); continue; }
    if(VD.coastK>0.35&&((Z.t!=='wild'&&k<0.45)||(VD.coastK>0.5&&k<0.3))){ out.push({X,z:0,f:'beach',w:12+r(3)*6,h:6+r(4)*3,seed:t}); if(near&&r(8)<0.5) out.push({X:X+r(9)*T*s,z:2,f:'person',kind:['homme','maman','kid'][Math.floor(r(14)*3)],c:VD_CLO[Math.floor(r(10)*VD_CLO.length)],sp:r(11),seed:t}); continue; }
    if(Z.t==='town'){ const big=Z.st.pop>=500, huge=Z.st.pop>=3000;
      if(huge&&k<0.2) out.push({X,z:0,f:'sky',w:16+r(3)*12,h:70+r(4)*70,seed:t});
      else if(k<0.06&&Math.floor(w/700)%3===1) out.push({X,z:0,f:'park',w:30+r(3)*12});
      else if(k<(huge?0.4:big?0.26:0.1)) out.push({X,z:0,f:'tower',w:12+r(3)*12,h:huge?24+r(4)*60:16+r(4)*20,c:['#e2e8f0','#cbd5e1','#fde68a','#bfdbfe','#fecaca','#d9f99d','#f5d0fe'][Math.floor(r(5)*7)]});
      else if(k<0.72) out.push({X,z:0,f:'shop',w:10+r(3)*5,h:6+r(4)*1.5,two:r(6)<0.35,wall:VD_WALL[Math.floor(r(5)*VD_WALL.length)],sc:['#dc2626','#2563eb','#16a34a','#7c3aed','#ea580c','#0891b2','#be123c'][Math.floor(r(7)*7)],txt:VD_SHOPS[Math.floor(r(8)*VD_SHOPS.length)]});
      else if(k<0.82) out.push({X,z:0,f:'house',w:9+r(3)*5,h:6+r(4)*2,wall:VD_WALL[Math.floor(r(5)*VD_WALL.length)],roof:VD_ROOF[Math.floor(r(6)*VD_ROOF.length)]});
      else if(k<0.86&&near) out.push({X,z:1,f:'billboard'});
      else if(k<0.89&&near) out.push({X,z:0,f:'station'});
      else if(k<0.94) out.push({X,z:1,f:'kiosk',txt:['Crédit','Boissons','Pain','Unités','Mobile Money'][Math.floor(r(5)*5)],c:['#dc2626','#2563eb','#16a34a','#7c3aed','#ea580c'][Math.floor(r(6)*5)]});
      else out.push({X,z:1,f:'palm',h:13+r(3)*5});
      if(near){ if(t%3===0) out.push({X:X+T*s*0.5,z:3,f:'lamp'}); const np=Z.st.pop>1000?2:1; for(let j=0;j<np;j++) if(r(8+j)<0.7) out.push({X:X+r(9+j)*T*s,z:2,f:'person',kind:['homme','maman','kid','maman'][Math.floor(r(12+j)*4)],c:VD_CLO[Math.floor(r(10+j)*VD_CLO.length)],sp:r(11+j),seed:t*3+j}); } }
    else if(Z.t==='village'&&near&&r(40)<0.05){ out.push({X,z:0,f:'foot',w:34}); }
    else if(Z.t==='village'){ if(r(12)<0.2) continue; const thatch=r(13)<0.55;
      if(k<0.5&&rg==='nord'&&r(14)<0.7) out.push({X,z:0,f:'rhut',w:6+r(3)*2,h:4.5+r(4)*1.5});
      else if(k<0.5) out.push({X,z:0,f:'house',thatch,w:8+r(3)*4,h:5+r(4)*1.5,wall:thatch?['#a0603a','#b5713f','#8f5532'][Math.floor(r(5)*3)]:VD_WALL[Math.floor(r(5)*VD_WALL.length)],roof:VD_ROOF[Math.floor(r(6)*VD_ROOF.length)]});
      else if(k<0.6) out.push({X,z:1,f:'stall',c:['#dc2626','#2563eb','#16a34a','#f59e0b','#7c3aed'][Math.floor(r(5)*5)]});
      else if(k<0.66&&Math.floor(w/1400)%8===0&&t%6===0) out.push({X,z:0,f:'church'});
      else if(k<0.72&&near) out.push({X,z:1,f:'fire'});
      else if(k<0.78&&near) out.push({X,z:1,f:'laundry'});
      else if(k<0.86) out.push({X,z:0,f:'banana',h:7+r(3)*3});
      else out.push({X,z:0,f:fk>0.5?'tree':'mango',r:3.8+r(3)*1.6});
      if(near){ if(r(8)<0.6) out.push({X:X+r(9)*T*s,z:2,f:'person',kind:['maman','kid','homme','maman'][Math.floor(r(14)*4)],c:VD_CLO[Math.floor(r(10)*VD_CLO.length)],sp:r(11),seed:t});
        if(r(15)<0.35) out.push({X:X+r(16)*T*s,z:2,f:r(17)<0.6?'goat':'chicken',sp:r(18),c:['#f5f5f4','#78350f','#292524'][Math.floor(r(19)*3)]}); } }
    else { const forest=fk>0.5, n=forest?(r(2)<0.75?2:1):(r(2)<0.3?2:r(2)<0.85?1:0);
      for(let j=0;j<n;j++){ const q=r(3+j), xx=X+r(20+j)*T*s;
        if(rg==='kivu'&&q<0.45){ out.push(q<0.25?{X:xx,z:0,f:'euca',h:24+r(30+j)*12}:{X:xx,z:0,f:'banana',h:7+r(31+j)*4}); continue; }
        if(rg==='katanga'&&q<0.5){ out.push(q<0.3?{X:xx,z:0,f:'tree',r:4+r(40+j)*2,c:['#8aa04a','#7a9a3a','#9aaa52'][Math.floor(r(41+j)*3)]}:{X:xx,z:1,f:'mound'}); continue; }
        if(rg==='kasai'&&q<0.35){ out.push({X:xx,z:0,f:'palm',h:12+r(30+j)*6}); continue; }
        if(rg==='desert'){ if(q<0.12) out.push({X:xx,z:0,f:'palm',h:11+r(30+j)*5}); else if(q<0.3) out.push({X:xx,z:1,f:'grass'}); continue; }
        if((rg==='est'||rg==='austral')&&r(60+j)<0.2){ const a=r(61+j); out.push({X:xx,z:1,f:a<0.4?'giraffe':a<0.7?'zebra':'elephant',sp:r(62+j)}); continue; }
        if(fk<0.5&&near&&r(63+j)<0.1){ out.push({X:xx,z:1,f:'cow',sp:r(64+j),c:['#7c2d12','#f5f5f4','#292524','#a16207'][Math.floor(r(65+j)*4)],lh:rg==='kivu'||rg==='est'}); out.push({X:xx+5*s,z:1,f:'cow',sp:r(66+j),c:['#7c2d12','#f5f5f4','#292524'][Math.floor(r(67+j)*3)],lh:rg==='kivu'||rg==='est'}); out.push({X:xx-4*s,z:2,f:'person',kind:'homme',c:'#16a34a',sp:r(68+j),seed:t}); continue; }
        if((rg==='est'||rg==='austral'||rg==='sahel')&&q<0.55){ out.push(q<0.4?{X:xx,z:0,f:'acacia',w:10+r(30+j)*7}:{X:xx,z:0,f:'baobab',h:13+r(40+j)*8}); continue; }
        if(forest) out.push(q<0.22?{X:xx,z:0,f:'bigtree',h:30+r(30+j)*16}:q<0.45?{X:xx,z:0,f:'palm',h:13+r(30+j)*8}:q<0.6?{X:xx,z:0,f:'banana',h:7+r(31+j)*4}:{X:xx,z:0,f:'tree',r:4.5+r(40+j)*2.5,c:['#2d6a2e','#356f2a','#28602f','#3b7a2c'][Math.floor(r(41+j)*4)]});
        else out.push(q<0.32?{X:xx,z:0,f:'acacia',w:10+r(30+j)*6}:q<0.42?{X:xx,z:0,f:'baobab',h:14+r(40+j)*8}:q<0.55?{X:xx,z:0,f:'palm',h:11+r(30+j)*5}:q<0.65&&near?{X:xx,z:1,f:'mound'}:q<0.8?{X:xx,z:1,f:'bush'}:{X:xx,z:1,f:'grass'}); } }
    if(near&&t%8===0) out.push({X:VD.vx+(t*T-off)*s,z:3,f:'pole'});
  }
  if(near){ for(const st of VD.stops){ const sx=st.d-VD_TR(st)-400; const X=VD.vx+(sx-d)*s; if(X>-20*s&&X<VD.W+5*s) out.push({X,z:3,f:'welcome',txt:st.name}); }
    // bornes kilométriques tous les 5 km
    const B=VD.stops[VD.stops.length-1]; for(let b=Math.ceil((d-VD.vx/s)/5000)*5000; b<d+(VD.W-VD.vx)/s; b+=5000){ const X=VD.vx+(b-d)*s; out.push({X,z:3,f:'borne',txt:B.name,km:Math.max(0,Math.round((B.d-b)/1000))}); }
    if(VD.mode==='train') for(const st of VD.stops){ const X=VD.vx+(st.d-20-d)*s; if(X<VD.W+5&&X+40*s*1.1>-5) out.push({X,z:0,f:'gare',txt:st.name}); } }
  out.sort((a,b)=>a.z-b.z||a.X-b.X); return out; }
function vdDrawObjs(g,list,s,y,near){ const lit=VD.dark>0.45, rg=VD.rg; let prevPole=null;
  if(near){ const sx=VD.sun?vdCl((VD.W*0.5-VD.sun.x)/VD.W,-0.6,0.6):0, a=0.22*(1-VD.dark)*(1-VD.rain*0.7); if(a>0.02){ g.fillStyle=`rgba(0,0,0,${a})`; g.beginPath(); for(const o of list){ const w=(o.w||o.r*2||o.h*0.5||6)*s; if(o.f==='person'||o.f==='pole'||o.f==='borne'||o.f==='lamp'||o.f==='welcome') continue; const cx=(o.f==='house'||o.f==='shop'||o.f==='tower'||o.f==='park'||o.f==='station'||o.f==='gare'||o.f==='church')?o.X+w*0.5:o.X; g.moveTo(cx+sx*w*0.8+w*0.6,y+s*0.4); g.ellipse(cx+sx*w*0.8,y+s*0.4,w*0.6,s*0.7,0,0,7); } g.fill(); } }
  for(const o of list){ const X=o.X;
    switch(o.f){
      case 'rhut': vdRoundHut(g,X,y,o.w*s,o.h*s); break;
      case 'euca': vdEuca(g,X,y,o.h*s); break;
      case 'shopx': vdCommerce(g,X,y,s,o.t,o.seed); break;
      case 'port': vdPort(g,X,y,s,o.txt,lit); break;
      case 'house': vdHouse(g,X,y,o.w*s,o.h*s,o.wall,o.roof,lit&&vdRnd(Math.round(o.w*99),3)<0.75,o.thatch); break;
      case 'shop': vdShop(g,X,y,o.w*s,o.h*s,s,o.wall,o.sc,o.txt,lit,o.two&&near); break;
      case 'tower': vdTower(g,X,y,o.w*s,o.h*s,o.c,lit,s); break;
      case 'sky': vdSkyscraper(g,X,y,o.w*s,o.h*s,s,lit,o.seed); break;
      case 'shack': vdShack(g,X,y,o.w*s,o.h*s,o.seed); break;
      case 'beach': vdBeachHouse(g,X,y,o.w*s,o.h*s,s,lit,o.seed); break;
      case 'church': vdChurch(g,X,y,9*s,lit); break;
      case 'park': if(near) vdPark(g,X,y,o.w*s,s); else vdTree(g,X,y,4*s,'#2f7d32',true); break;
      case 'stall': vdStall(g,X,y,4*s,o.c); break;
      case 'kiosk': vdKiosk(g,X,y,4*s,o.txt,o.c); break;
      case 'palm': vdPalm(g,X,y,(o.h||12)*s,null,!near); break;
      case 'tree': vdTree(g,X,y,(o.r||5)*s,o.c||'#2f6b2a',!near); break;
      case 'mango': vdTree(g,X,y,(o.r||5)*s,'#3a6f2c',!near); break;
      case 'bigtree': vdBigTree(g,X,y,o.h*s); if(near&&vdRnd(Math.round(o.h*97),3)<0.4) vdMonkey(g,X-o.h*s*0.15,y-o.h*s*0.84,s*1.1,VD.tt*2+o.h); break;
      case 'cow': vdCow(g,X+Math.sin(VD.tt*0.15+o.sp*9)*s*2,y,s*0.95,o.c,VD.tt*2+o.sp*9,o.lh); break;
      case 'giraffe': vdGiraffe(g,X,y,s,VD.tt+o.sp*9); break;
      case 'zebra': vdZebra(g,X+Math.sin(VD.tt*0.2+o.sp*9)*s*2,y,s,VD.tt*3+o.sp*9); break;
      case 'elephant': vdElephant(g,X,y,s,VD.tt+o.sp*9); break;
      case 'foot': vdFoot(g,X,y,o.w*s,s); break;
      case 'mon': vdLandmark(g,X,y,s,o.k,lit); break;
      case 'banana': vdBanana(g,X,y,o.h*s); break;
      case 'acacia': vdAcacia(g,X,y,o.w*s); break;
      case 'baobab': vdBaobab(g,X,y,o.h*1.4*s); break;
      case 'bush': vdBush(g,X,y,s*1.4,vdBiome('#2f6b2a','#6b7f2a')); break;
      case 'grass': vdGrass(g,X,y,s,vdBiome('#4d7c0f','#b5a33b')); break;
      case 'mound': vdMound(g,X,y,rg==='katanga'?s*1.5:s); break;
      case 'fire': vdFire(g,X,y,s); break;
      case 'laundry': vdLaundry(g,X,y,s); break;
      case 'goat': vdGoat(g,X+Math.sin(VD.tt*0.3+o.sp*9)*s*3,y,s*0.9,o.c,VD.tt*4+o.sp*9); break;
      case 'chicken': vdChicken(g,X+Math.sin(VD.tt*0.7+o.sp*9)*s*2,y,s*0.8,VD.tt*6+o.sp*9); break;
      case 'person': { const wx=Math.sin(VD.tt*0.25+o.sp*9)*s*6; vdPerson(g,X+wx,y+s*0.2,2*s,o.c,VD.tt*5+o.sp*9,o.kind,o.seed); break; }
      case 'lamp': vdLamp(g,X,y,s); break;
      case 'billboard': vdBillboard(g,X,y,s); break;
      case 'station': vdStation(g,X,y,s); break;
      case 'pole': vdPole(g,X,y,s,prevPole); prevPole=X; break;
      case 'welcome': vdWelcome(g,X,y,s,o.txt); break;
      case 'borne': vdBorne(g,X,y+s*0.6,s,o.txt,o.km); break;
      case 'gare': vdGare(g,X,y,s,o.txt,lit); break;
    } } }

/* ---------- rivières en perspective, route, voie ferrée ---------- */
function vdRiverY(f){ const hz=VD.hz+(VD.gy-VD.hz)*0.12, gy=VD.gy, H=VD.H; return f<1?vdLerp(hz,gy,(f-0.12)/0.88):vdLerp(gy,H,(f-1)/0.6); }
function vdRiver(g,bx){ const s=VD.sc, d=VD.d; const pts=[]; for(let f=0.12;f<=1.61;f+=0.07) pts.push([VD.vx+(bx-d)*s*f, vdRiverY(f), VD_RIVW*s*f+2]);
  if(pts.every(p=>p[0]+p[2]+8<0||p[0]-p[2]-8>VD.W)) return;
  const gr=g.createLinearGradient(0,pts[0][1],0,VD.H); gr.addColorStop(0,vdPre(VD.skyH)); gr.addColorStop(0.25,vdMix('#2f6f9a',vdPre(VD.skyH),0.3)); gr.addColorStop(1,'#1f4f73');
  const edge=(sgn)=>pts.map(([x,y,w])=>[x+sgn*w,y]);
  g.fillStyle=vdBiome('#2f6b2a','#7a8a3a'); g.beginPath(); edge(-1).forEach(([x,y],i)=>i?g.lineTo(x-6,y):g.moveTo(x-6,y)); edge(1).reverse().forEach(([x,y])=>g.lineTo(x+6,y)); g.fill();   // berges
  g.fillStyle=gr; g.beginPath(); edge(-1).forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); edge(1).reverse().forEach(([x,y])=>g.lineTo(x,y)); g.fill();
  g.strokeStyle='rgba(255,255,255,.35)'; g.lineWidth=1.2; g.beginPath(); for(let k=0;k<14;k++){ const f=0.15+((k*0.11+VD.tt*0.03)%1.4), y=vdRiverY(f), x=VD.vx+(bx-d)*s*f, w=VD_RIVW*s*f; const o=vdRnd(k,3)*1.4-0.7; g.moveTo(x+o*w-w*0.12,y); g.lineTo(x+o*w+w*0.12,y); } g.stroke();
  // hippopotames
  for(let k=0;k<3;k++){ if(vdRnd(Math.round(bx),k+40)<0.45) continue; const f=0.42+k*0.18, y=vdRiverY(f), x=VD.vx+(bx-d)*s*f+(vdRnd(Math.round(bx),k+50)-0.5)*VD_RIVW*s*f, b=s*f*0.9, bob=Math.sin(VD.tt*0.8+k)*b*0.2;
    g.fillStyle='#57534e'; g.beginPath(); g.ellipse(x,y-b*0.3+bob,b*2.2,b*0.9,0,Math.PI,0); g.fill(); g.beginPath(); g.ellipse(x+b*1.9,y-b*0.4+bob,b*1.1,b*0.6,0,Math.PI,0); g.fill(); g.fillStyle='#44403c'; g.beginPath(); g.arc(x+b*1.4,y-b*0.95+bob,b*0.25,0,7); g.arc(x+b*2.2,y-b*0.9+bob,b*0.22,0,7); g.fill(); }
  // pirogue avec pêcheur
  { const f=0.62, y=vdRiverY(f), x=VD.vx+(bx-d)*s*f+Math.sin(VD.tt*0.1+bx)*VD_RIVW*s*f*0.5, k=s*f*1.3; g.fillStyle='#5b3a1a'; g.beginPath(); g.moveTo(x-k*4,y-k*0.6); g.quadraticCurveTo(x,y+k*0.8,x+k*4,y-k*0.6); g.lineTo(x-k*4,y-k*0.6); g.fill(); vdPerson(g,x,y-k*0.5,k*1.8,'#2563eb',0,'homme',3);
    g.strokeStyle='#3f2a14'; g.lineWidth=Math.max(1,k*0.2); g.beginPath(); g.moveTo(x+k*0.3,y-k*2.3); g.lineTo(x+k*1.8,y+k*0.3); g.stroke(); }
  return pts; }
function vdRoad(g){ const s=VD.sc, d=VD.d, W=VD.W, H=VD.H, rt=VD.rt, rb=VD.rb, gy=VD.gy, wL=d-VD.vx/s, wR=d+(W-VD.vx)/s;
  // accotement côté lointain
  g.fillStyle=vdBiome('#a35a32','#b8693a'); g.fillRect(0,gy,W,rt-gy+2); g.fillStyle='rgba(0,0,0,.08)'; g.fillRect(0,rt-s*0.4,W,s*0.4);
  if(VD.mode==='train'){ const ty=rt+VD.roadH*0.62; const gr=g.createLinearGradient(0,rt,0,rb); gr.addColorStop(0,'#a1978a'); gr.addColorStop(1,'#6f665a'); g.fillStyle=gr; g.beginPath(); g.moveTo(0,rt+VD.roadH*0.2); g.lineTo(W,rt+VD.roadH*0.2); g.lineTo(W,rb+s); g.lineTo(0,rb+s); g.fill();
    g.fillStyle='rgba(60,50,40,.35)'; for(let x=-((d*s)%7);x<W;x+=7){ g.fillRect(x,rt+VD.roadH*0.3+((x*13)%5),2,2); }
    const sp=2.6*s; g.fillStyle='#5b3a1a'; for(let x=-((d*s)%sp);x<W;x+=sp){ g.beginPath(); g.moveTo(x,ty-s*0.4); g.lineTo(x+sp*0.42,ty-s*0.4); g.lineTo(x+sp*0.52,ty+s*0.9); g.lineTo(x+sp*0.1,ty+s*0.9); g.fill(); }
    vdRails(g,0,W); VD.laneY=ty-s*0.3; return; }
  // spans goudron / piste
  const spans=[]; let cur=vdRoadType(wL), x0=wL; for(let w=wL;w<=wR+5;w+=5){ const t=vdRoadType(w); if(t!==cur){ spans.push([x0,w,cur]); cur=t; x0=w; } } spans.push([x0,wR+5,cur]); VD.surf=vdRoadType(d);
  for(const [a,b,t] of spans){ const X0=Math.floor(VD.vx+(a-d)*s), X1=Math.ceil(VD.vx+(b-d)*s), w=X1-X0;
    if(t==='auto'){ const gr=g.createLinearGradient(0,rt,0,rb); gr.addColorStop(0,'#5a5e64'); gr.addColorStop(1,'#35383d'); g.fillStyle=gr; g.fillRect(X0,rt,w,rb-rt); const H2=rb-rt;
      g.fillStyle='rgba(240,240,235,.8)'; for(const f of [0.03,0.44,0.53,0.96]) g.fillRect(X0,rt+H2*f,w,s*0.22);
      const dl=6*s; g.fillStyle='#f8fafc'; for(const f of [0.24,0.745]) for(let x=X0-((d*s)%(dl*2))-dl*2;x<X1;x+=dl*2){ const xa=Math.max(X0,x), xb=Math.min(X1,x+dl); if(xb>xa) g.fillRect(xa,rt+H2*f,xb-xa,s*0.22); }
      g.fillStyle='#8b9096'; g.fillRect(X0,rt+H2*0.465,w,H2*0.06); g.fillStyle='#d1d5db'; g.fillRect(X0,rt+H2*0.465,w,s*0.25);   // terre-plein central en béton
      for(let k=Math.ceil((Math.max(a,wL-12)+2)/32);k*32<=Math.min(b,wR+12)-2;k++){ const X=VD.vx+(k*32-d)*s, my=rt+H2*0.47; g.fillStyle='#6b7280'; g.fillRect(X-s*0.18,my-11*s,s*0.36,11*s); g.fillRect(X-s*1.8,my-11*s,s*3.6,s*0.3); g.fillStyle=VD.dark>0.4?'#fff1c2':'#9ca3af'; g.fillRect(X-s*2,my-11*s,s*0.8,s*0.4); g.fillRect(X+s*1.2,my-11*s,s*0.8,s*0.4);
        if(VD.dark>0.4){ vdLight(X-s*1.6,my-10.8*s,s*6,0.45); vdLight(X+s*1.6,my-10.8*s,s*6,0.45); } } }
    else if(t==='tar'){ const gr=g.createLinearGradient(0,rt,0,rb); gr.addColorStop(0,'#55595f'); gr.addColorStop(1,'#34373c'); g.fillStyle=gr; g.fillRect(X0,rt,w,rb-rt);
      g.fillStyle='rgba(240,240,235,.75)'; g.fillRect(X0,rt+s*0.45,w,s*0.25); g.fillRect(X0,rb-s*0.75,w,s*0.25);
      const dl=6*s; g.fillStyle='#f8fafc'; for(let x=X0-((d*s)%(dl*2))-dl*2;x<X1;x+=dl*2){ const xa=Math.max(X0,x), xb=Math.min(X1,x+dl); if(xb>xa) g.fillRect(xa,(rt+rb)/2-s*0.15,xb-xa,s*0.3); }
      // nids-de-poule et rapiéçages
      for(let k=Math.floor(Math.max(a,wL)/9);k<=Math.floor(Math.min(b,wR)/9);k++){ const q=vdRnd(k,21); if(q>0.25) continue; const X=VD.vx+(k*9+vdRnd(k,22)*9-d)*s, Y=rt+(rb-rt)*(0.25+vdRnd(k,23)*0.55);
        if(q<0.12){ g.fillStyle='#2a2c30'; g.beginPath(); g.ellipse(X,Y,s*(0.8+vdRnd(k,24)),s*0.35,0,0,7); g.fill(); g.fillStyle='rgba(255,255,255,.08)'; g.fillRect(X-s*0.6,Y+s*0.25,s*1.2,s*0.12); }
        else { g.fillStyle='rgba(20,20,25,.35)'; g.fillRect(X,Y-s*0.4,s*(2+vdRnd(k,25)*3),s*0.9); } } }
    else { const gr=g.createLinearGradient(0,rt,0,rb); gr.addColorStop(0,(VD.dirtC||[])[0]||'#c46a3a'); gr.addColorStop(1,(VD.dirtC||[])[1]||'#9a4b26'); g.fillStyle=gr; g.fillRect(X0,rt,w,rb-rt);
      g.fillStyle='rgba(90,40,15,.35)'; for(const f of [0.3,0.68]) g.fillRect(X0,rt+(rb-rt)*f,w,s*0.9);
      g.fillStyle='rgba(255,220,180,.18)'; for(const f of [0.45,0.85]) g.fillRect(X0,rt+(rb-rt)*f,w,s*0.35);
      for(let k=Math.floor(Math.max(a,wL)/4);k<=Math.floor(Math.min(b,wR)/4);k++){ const X=VD.vx+(k*4+vdRnd(k,31)*4-d)*s, Y=rt+(rb-rt)*vdRnd(k,32);
        if(vdRnd(k,33)<(VD.rain?0.3:0.08)){ g.fillStyle=vdMix(vdPre(VD.skyH),'#7a4a2a',0.35); g.beginPath(); g.ellipse(X,Y,s*(1.2+vdRnd(k,34)*1.6),s*0.32,0,0,7); g.fill(); }
        else { g.fillStyle='rgba(120,60,30,.6)'; g.fillRect(X,Y,s*0.3,s*0.2); } } } }
  for(let i=0;i<spans.length;i++){ const [a,b,t]=spans[i]; if(i>0&&(t==='auto')!==(spans[i-1][2]==='auto')){ const X=VD.vx+(a-d)*s-6*s, y=VD.gy+s*0.6, start=t==='auto'; g.fillStyle='#6b7280'; g.fillRect(X,y-9*s,s*0.5,9*s);
      g.fillStyle='#1d4ed8'; vdRR(g,X-4*s,y-14.5*s,9*s,5.6*s,s*0.5); g.fill(); g.strokeStyle='#fff'; g.lineWidth=Math.max(1,s*0.22); vdRR(g,X-3.6*s,y-14.1*s,8.2*s,4.8*s,s*0.4); g.stroke(); g.fillStyle='#fff'; g.font=`bold ${Math.max(8,1.25*s)}px sans-serif`; g.textAlign='center'; g.fillText(start?'AUTOROUTE':"FIN D'AUTOROUTE",X+0.5*s,y-10.6*s,7.8*s); g.font=`${Math.max(10,2.2*s)}px sans-serif`; g.fillText('🛣️',X+0.5*s,y-12.2*s);
      if(!start){ g.strokeStyle='#dc2626'; g.lineWidth=s*0.5; g.beginPath(); g.moveTo(X-3.4*s,y-9.8*s); g.lineTo(X+4.4*s,y-14*s); g.stroke(); } } }
  // balises blanches avec catadioptre, sur le bord proche
  for(const [a,b,t] of spans){ if(t==='dirt') continue; for(let k=Math.ceil(Math.max(a,wL-5)/45);k*45<=Math.min(b,wR+5);k++){ const X=VD.vx+(k*45-d)*s, y=rb+s*0.9; g.fillStyle='#f1f5f9'; g.fillRect(X-s*0.25,y-s*2.4,s*0.5,s*2.4); g.fillStyle='#111827'; g.fillRect(X-s*0.25,y-s*1.9,s*0.5,s*0.35);
    g.fillStyle='#ef4444'; g.fillRect(X-s*0.2,y-s*2.3,s*0.4,s*0.35); if(VD.dark>0.4&&X>VD.vx+8*s&&X<VD.vx+44*s) vdLight(X,y-s*2.1,s*1.6,0.9,'255,60,40'); } }
  // accotement proche
  g.fillStyle=vdBiome('#94512c','#a85f34'); g.fillRect(0,rb,W,s*1.2); VD.laneY=rt+(rb-rt)*0.86; VD.oppY=rt+(rb-rt)*0.42; }
function vdRails(g,x0,x1){ const s=VD.sc, ty=VD.rt+VD.roadH*0.62; g.fillStyle='#6b7280'; g.fillRect(x0,ty-s*0.75,x1-x0,s*0.45); g.fillRect(x0,ty+s*0.55,x1-x0,s*0.45); g.fillStyle='#d1d5db'; g.fillRect(x0,ty-s*0.75,x1-x0,s*0.14); g.fillRect(x0,ty+s*0.55,x1-x0,s*0.14); }
function vdBridges(g,riv){ const s=VD.sc, d=VD.d, rt=VD.rt, rb=VD.rb;
  for(const bx of riv){ const X=VD.vx+(bx-d)*s, hw=(VD_RIVW+8)*s; if(X+hw<-20||X-hw>VD.W+20) continue;
    if(VD.mode==='train'){ // pont en treillis métallique
      const top=VD.laneY-9*s, by=VD.laneY+s*0.8; g.fillStyle='#4b5563'; g.fillRect(X-hw,by,hw*2,s*1.2); g.strokeStyle='#64748b'; g.lineWidth=Math.max(1.5,s*0.4); g.beginPath(); g.moveTo(X-hw,by); g.lineTo(X-hw+s*3,top); g.lineTo(X+hw-s*3,top); g.lineTo(X+hw,by);
      const n=10; for(let k=0;k<n;k++){ const xa=X-hw+s*3+k*(hw*2-s*6)/n, xb=xa+(hw*2-s*6)/n; g.moveTo(xa,top); g.lineTo(xb,by); g.moveTo(xb,top); g.lineTo(xb,by); } g.stroke();
      g.fillStyle='#57534e'; for(const px of [-0.5,0,0.5]) g.fillRect(X+hw*px-s,by+s*1.2,s*2,VD.H-by); }
    else { g.fillStyle='#9ca3af'; g.fillRect(X-hw,rb,hw*2,s*1.3); g.fillStyle='#6b7280'; for(const px of [-0.6,0,0.6]) g.fillRect(X+hw*px-s*0.9,rb+s*1.3,s*1.8,VD.H-rb);
      g.fillStyle='#d1d5db'; g.fillRect(X-hw,rt-s*2.6,hw*2,s*0.4); for(let k=0;k<=16;k++) g.fillRect(X-hw+k*hw/8-s*0.15,rt-s*2.6,s*0.3,s*2.2);
      g.fillRect(X-hw,rb-s*0.3,hw*2,s*0.5); } } }
/* ---------- véhicules ---------- */
function vdWheel(g,x,y,r,a,rim){ g.fillStyle='#111827'; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); g.strokeStyle='#2b313b'; g.lineWidth=Math.max(1,r*0.12); g.beginPath(); g.arc(x,y,r*0.8,0,7); g.stroke(); g.fillStyle=rim||'#9ca3af'; g.beginPath(); g.arc(x,y,r*0.52,0,7); g.fill(); g.fillStyle='#4b5563'; g.beginPath(); g.arc(x,y,r*0.2,0,7); g.fill();
  if(!VD.blur&&r>3){ g.fillStyle='#e5e7eb'; for(let k=0;k<5;k++){ const b=a+k*1.2566; g.fillRect(x+Math.cos(b)*r*0.33-0.6,y+Math.sin(b)*r*0.33-0.6,1.2,1.2); } }
  if(VD.blur){ g.strokeStyle='rgba(156,163,175,.5)'; g.lineWidth=Math.max(1,r*0.12); g.beginPath(); g.arc(x,y,r*0.36,0,7); g.stroke(); return; }
  g.strokeStyle='#4b5563'; g.lineWidth=Math.max(1,r*0.1); g.beginPath(); for(let k=0;k<5;k++){ const b=a+k*1.2566; g.moveTo(x+Math.cos(b)*r*0.2,y+Math.sin(b)*r*0.2); g.lineTo(x+Math.cos(b)*r*0.5,y+Math.sin(b)*r*0.5); } g.stroke(); }
function vdTruck(g,x,y,s){ const col=S.company.color||'#2563eb', L=17*s, a=VD.d/0.9, dirt=VD.surf==='dirt', bob=Math.sin(VD.tt*(dirt?11:6))*s*(dirt?0.18:0.06);
  g.fillStyle='rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x+L*0.5,y+s*0.2,L*0.55,s*0.55,0,0,7); g.fill(); y+=bob;
  g.fillStyle='#1f2937'; g.fillRect(x+s*0.4,y-2.3*s,L-s*0.8,0.8*s);
  // remorque
  const tw=L*0.7, th=5.4*s, ty=y-2.3*s-th, gr=g.createLinearGradient(0,ty,0,ty+th); gr.addColorStop(0,'#ffffff'); gr.addColorStop(1,'#cfd6df'); g.fillStyle=gr; vdRR(g,x,ty,tw,th,s*0.35); g.fill();
  g.fillStyle='rgba(0,0,0,.06)'; for(let k=1;k<12;k++) g.fillRect(x+k*tw/12,ty,1,th);
  g.fillStyle=col; g.beginPath(); g.moveTo(x,ty+th*0.62); g.quadraticCurveTo(x+tw*0.5,ty+th*0.35,x+tw,ty+th*0.5); g.lineTo(x+tw,ty+th*0.78); g.quadraticCurveTo(x+tw*0.5,ty+th*0.6,x,ty+th*0.86); g.fill();
  g.fillStyle=vdDk(col,0.25); g.font=`bold ${Math.max(9,1.7*s)}px sans-serif`; g.textAlign='left'; g.fillText(`${S.company.logo||'✈️'} ${S.company.name}`.slice(0,22),x+s*0.8,ty+th*0.36,tw-s*1.6);
  g.fillStyle='#dc2626'; g.fillRect(x-s*0.15,y-3.6*s,s*0.35,s*0.7); g.fillStyle='#111827'; g.fillRect(x+s*0.6,y-1.6*s,s*1.4,s*1.3); g.fillRect(x+L*0.52,y-1.6*s,s*1.4,s*1.3);
  // cabine
  const cx=x+tw+s*0.25, cw=L-tw-s*0.25, ch=6.6*s, cg=g.createLinearGradient(0,y-ch,0,y); cg.addColorStop(0,vdLt(col,0.25)); cg.addColorStop(1,vdDk(col,0.15)); g.fillStyle=cg;
  g.beginPath(); g.moveTo(cx,y-1.4*s); g.lineTo(cx,y-ch); g.lineTo(cx+cw*0.62,y-ch); g.quadraticCurveTo(cx+cw*0.95,y-ch*0.98,cx+cw,y-ch*0.55); g.lineTo(cx+cw,y-1.4*s); g.closePath(); g.fill();
  g.fillStyle=vdDk(col,0.2); g.beginPath(); g.moveTo(cx,y-ch); g.lineTo(cx-s*0.2,ty); g.lineTo(cx+cw*0.5,ty+s*0.2); g.lineTo(cx+cw*0.55,y-ch); g.fill();   // déflecteur
  const wg=g.createLinearGradient(cx+cw*0.5,y-ch,cx+cw,y-ch*0.5); wg.addColorStop(0,'#dbeafe'); wg.addColorStop(1,'#60a5fa'); g.fillStyle=wg; g.beginPath(); g.moveTo(cx+cw*0.5,y-ch*0.93); g.lineTo(cx+cw*0.66,y-ch*0.93); g.quadraticCurveTo(cx+cw*0.9,y-ch*0.9,cx+cw*0.95,y-ch*0.58); g.lineTo(cx+cw*0.5,y-ch*0.58); g.fill();
  g.fillStyle='rgba(31,41,55,.75)'; g.beginPath(); g.arc(cx+cw*0.66,y-ch*0.78,s*0.55,0,7); g.fill(); g.fillRect(cx+cw*0.56,y-ch*0.7,s*1.4,ch*0.12);   // chauffeur
  g.strokeStyle='rgba(0,0,0,.25)'; g.lineWidth=1; g.strokeRect(cx+cw*0.42,y-ch*0.95,cw*0.5,ch*0.8);
  g.fillStyle='#d1d5db'; g.fillRect(cx+cw*0.98,y-ch*0.8,s*0.25,ch*0.3); g.fillRect(cx+cw*0.86,y-2.2*s,cw*0.18,s*0.9);   // rétro, pare-chocs
  g.fillStyle='#374151'; g.fillRect(cx+cw*0.93,y-ch*0.5,cw*0.08,ch*0.3); g.fillStyle='#fef3c7'; g.fillRect(cx+cw*0.95,y-ch*0.42,cw*0.06,ch*0.08); g.fillStyle='#f59e0b'; g.fillRect(cx+cw*0.95,y-ch*0.32,cw*0.05,ch*0.05);
  g.fillStyle='#9ca3af'; g.fillRect(cx+s*0.1,y-ch-1.6*s,s*0.4,ch*0.75); g.fillStyle='#6b7280'; g.fillRect(cx+cw*0.15,y-2.6*s,cw*0.3,s*1);   // échappement, réservoir
  // détails : portes arrière, barres de fermeture, bande réfléchissante, jupe latérale, calandre, pare-soleil, poignée, marchepied, réservoir chromé
  g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(x+s*0.25,ty+s*0.3,s*0.15,th-s*0.6); g.fillStyle='#9ca3af'; g.fillRect(x+s*0.6,ty+th*0.15,s*0.2,th*0.7); g.fillRect(x+s*1.3,ty+th*0.15,s*0.2,th*0.7);
  g.fillStyle='#f59e0b'; for(let k=0;k<9;k++) g.fillRect(x+s*1.2+k*(tw-s*2)/9,ty+th-s*0.55,s*0.7,s*0.22);
  g.fillStyle='#374151'; g.fillRect(x+L*0.28,y-2.1*s,L*0.27,s*0.9);
  g.fillStyle='#1f2937'; g.fillRect(cx+cw*0.88,y-ch*0.52,cw*0.06,ch*0.38); g.fillStyle='#9ca3af'; for(let k=0;k<4;k++) g.fillRect(cx+cw*0.885,y-ch*0.5+k*ch*0.09,cw*0.05,ch*0.03);
  g.fillStyle=vdDk(col,0.45); g.fillRect(cx+cw*0.47,y-ch*0.985,cw*0.42,s*0.4);
  g.fillStyle='#e5e7eb'; g.fillRect(cx+cw*0.47,y-ch*0.47,s*0.7,s*0.18); g.fillStyle='#4b5563'; g.fillRect(cx+cw*0.44,y-2.05*s,cw*0.36,s*0.32); g.fillRect(cx+cw*0.46,y-1.6*s,cw*0.32,s*0.28);
  { const tg=g.createLinearGradient(0,y-2.7*s,0,y-1.6*s); tg.addColorStop(0,'#f1f5f9'); tg.addColorStop(0.5,'#94a3b8'); tg.addColorStop(1,'#cbd5e1'); g.fillStyle=tg; vdRR(g,cx+cw*0.12,y-2.75*s,cw*0.32,s*1.15,s*0.5); g.fill(); }
  g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=Math.max(1,s*0.15); g.beginPath(); g.moveTo(cx+cw*0.6,y-ch*0.9); g.lineTo(cx+cw*0.52,y-ch*0.62); g.stroke();
  g.fillStyle='#111827'; for(const wx of [0.03,0.58]) g.fillRect(x+L*wx+s*0.9,y-1.9*s,s*0.25,s*1.2);
  for(const wx of [0.1,0.2,0.62,0.86,0.95]) vdWheel(g,x+L*wx,y-0.95*s,0.95*s,a);
  VD.hl=[cx+cw,y-ch*0.38];
  if(VD.brk||VD.hold>0){ g.fillStyle='#ff3b3b'; g.fillRect(x-s*0.2,y-3.7*s,s*0.45,s*0.9); vdLight(x,y-3.3*s,s*3,0.9,'255,40,40'); }
  if(performance.now()-(VD.honkR||-1e9)<1600){ const wv=Math.sin(performance.now()/110)*s*0.6; g.strokeStyle=VD_SKIN[1]; g.lineWidth=Math.max(1.5,s*0.4); g.lineCap='round'; g.beginPath(); g.moveTo(cx+cw*0.62,y-ch*0.62); g.lineTo(cx+cw*0.62+wv,y-ch*1.05); g.stroke(); g.lineCap='butt';
    if(performance.now()-VD.honkR<900){ g.fillStyle='#fff'; vdRR(g,cx+cw*0.3,y-ch-5.2*s,9*s,3*s,s); g.fill(); g.fillStyle='#111827'; g.font=`bold ${Math.max(10,1.6*s)}px sans-serif`; g.textAlign='center'; g.fillText('Tûûût !',cx+cw*0.3+4.5*s,y-ch-3.2*s); } }
  const exX=cx+s*0.3, exY=y-ch-1.6*s; if(Math.random()<0.25) VD.smoke.push({x:exX,y:exY,r:1.5*s/5,a:0.45,c:'110,110,110'});
  if(dirt&&Math.random()<0.6) VD.smoke.push({x:x+s*1,y:y-s*0.5,r:s*1.2,a:0.4,c:'190,120,80',dust:1}); }
function vdBus(g,x,y,s,mini){ const col=S.company.color||'#2563eb', L=(mini?11:17)*s, H2=(mini?5.2:6.4)*s, a=VD.d/0.9, dirt=VD.surf==='dirt', bob=Math.sin(VD.tt*(dirt?11:6))*s*(dirt?0.18:0.06);
  g.fillStyle='rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x+L*0.5,y+s*0.2,L*0.55,s*0.55,0,0,7); g.fill(); y+=bob;
  const top=y-1.2*s-H2, gr=g.createLinearGradient(0,top,0,y); gr.addColorStop(0,vdLt(col,0.3)); gr.addColorStop(0.55,col); gr.addColorStop(1,vdDk(col,0.25)); g.fillStyle=gr;
  g.beginPath(); g.moveTo(x,y-1.2*s); g.lineTo(x,top+s*0.6); g.quadraticCurveTo(x,top,x+s*0.8,top); g.lineTo(x+L-s*2.2,top); g.quadraticCurveTo(x+L,top,x+L,top+H2*0.45); g.lineTo(x+L,y-1.2*s); g.closePath(); g.fill();
  g.fillStyle='#f8fafc'; g.fillRect(x,y-1.2*s-H2*0.33,L,H2*0.1); g.fillStyle=vdDk(col,0.35); g.fillRect(x,y-1.2*s-H2*0.18,L,H2*0.06);
  // fenêtres avec voyageurs
  const wn=mini?4:7, ww=(L-s*4)/wn; for(let k=0;k<wn;k++){ const wx=x+s*0.8+k*ww; g.fillStyle=VD.dark>0.4?'#ffd27a':'#bfdbfe'; vdRR(g,wx,top+H2*0.12,ww*0.86,H2*0.36,s*0.3); g.fill(); if(VD.dark>0.4) vdWin(wx,top+H2*0.12,ww*0.86,H2*0.36);
    if(vdRnd(k,VD.seedL||1)<0.8){ g.fillStyle=VD_SKIN[k%4]; g.beginPath(); g.arc(wx+ww*0.45,top+H2*0.3,s*0.42,0,7); g.fill(); g.fillStyle=VD_CLO[k%9]; g.fillRect(wx+ww*0.2,top+H2*0.38,ww*0.5,H2*0.1); } }
  const fx=x+L-s*2.6; g.fillStyle=VD.dark>0.4?'#ffd27a':'#93c5fd'; g.beginPath(); g.moveTo(fx,top+H2*0.1); g.lineTo(x+L-s*1.3,top+H2*0.1); g.quadraticCurveTo(x+L-s*0.2,top+H2*0.15,x+L-s*0.15,top+H2*0.5); g.lineTo(fx,top+H2*0.5); g.fill();
  g.fillStyle='rgba(31,41,55,.7)'; g.beginPath(); g.arc(fx+s*0.9,top+H2*0.3,s*0.45,0,7); g.fill();
  g.strokeStyle='rgba(0,0,0,.35)'; g.lineWidth=1; g.strokeRect(fx-s*1.6,top+H2*0.55,s*1.4,H2*0.42);   // porte
  g.fillStyle='#fef3c7'; g.fillRect(x+L-s*0.5,y-1.2*s-H2*0.28,s*0.45,s*0.5); g.fillStyle='#dc2626'; g.fillRect(x,y-1.2*s-H2*0.28,s*0.35,s*0.6);
  g.fillStyle='#fff'; g.font=`bold ${Math.max(8,1.2*s)}px sans-serif`; g.textAlign='left'; g.fillText(`${S.company.logo||''} ${S.company.name}`.slice(0,mini?12:22),x+s*0.9,y-1.2*s-H2*0.04,L-s*4);
  // galerie de toit chargée
  g.fillStyle='#374151'; g.fillRect(x+s*1.2,top-s*0.5,L*0.62,s*0.25); const B=[['#dc2626',2.2],['#7c3aed',1.6],['#e7d3a8',2.6],['#16a34a',1.8],['#2563eb',2]]; let bx=x+s*1.4; for(let k=0;k<(mini?3:5);k++){ const [c,w]=B[(k+(VD.seedL||0))%5]; g.fillStyle=c; vdRR(g,bx,top-s*(1.6+(k%2)*0.4),w*s,s*(1.1+(k%2)*0.4),s*0.3); g.fill(); bx+=w*s+s*0.2; }
  for(const wx of mini?[0.18,0.8]:[0.15,0.3,0.82]) vdWheel(g,x+L*wx,y-0.95*s,0.95*s,a);
  if(VD.brk||VD.hold>0) vdLight(x,y-1.2*s-H2*0.25,s*3,0.9,'255,40,40');
  VD.hl=[x+L,y-1.2*s-H2*0.25]; if(Math.random()<0.2) VD.smoke.push({x:x-s*0.2,y:y-1.4*s,r:s*0.4,a:0.4,c:'110,110,110'}); if(dirt&&Math.random()<0.6) VD.smoke.push({x:x+s,y:y-s*0.5,r:s*1.2,a:0.4,c:'190,120,80',dust:1}); }
function vdRigid(g,x,y,s,van){ const col=S.company.color||'#2563eb', L=(van?10:13.5)*s, a=VD.d/0.8, dirt=VD.surf==='dirt', bob=Math.sin(VD.tt*(dirt?11:6))*s*(dirt?0.2:0.07);
  g.fillStyle='rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x+L*0.5,y+s*0.2,L*0.55,s*0.5,0,0,7); g.fill(); y+=bob;
  const bw=L*(van?0.62:0.68), bh=(van?4.2:5.2)*s, by=y-1.6*s-bh, gr=g.createLinearGradient(0,by,0,by+bh); gr.addColorStop(0,'#ffffff'); gr.addColorStop(1,'#d4dbe3'); g.fillStyle=gr; vdRR(g,x,by,bw,bh,s*0.3); g.fill();
  g.fillStyle=col; g.fillRect(x,by+bh*0.62,bw,bh*0.2); g.fillStyle=vdDk(col,0.25); g.font=`bold ${Math.max(8,(van?1.2:1.5)*s)}px sans-serif`; g.textAlign='left'; g.fillText(`${S.company.logo||'✈️'} ${S.company.name}`.slice(0,van?14:18),x+s*0.6,by+bh*0.45,bw-s*1.2);
  g.fillStyle='#f59e0b'; for(let k=0;k<5;k++) g.fillRect(x+s*0.6+k*(bw-s)/5,by+bh-s*0.4,s*0.6,s*0.2); g.fillStyle='#dc2626'; g.fillRect(x-s*0.12,y-2.8*s,s*0.3,s*0.6);
  const cx=x+bw+s*0.2, cw=L-bw-s*0.2, ch=(van?4.8:5.8)*s, cg=g.createLinearGradient(0,y-ch,0,y); cg.addColorStop(0,vdLt(col,0.25)); cg.addColorStop(1,vdDk(col,0.15)); g.fillStyle=cg;
  g.beginPath(); g.moveTo(cx,y-1.2*s); g.lineTo(cx,y-ch); g.lineTo(cx+cw*0.55,y-ch); g.quadraticCurveTo(cx+cw*0.92,y-ch*0.95,cx+cw,y-ch*0.5); g.lineTo(cx+cw,y-1.2*s); g.closePath(); g.fill();
  g.fillStyle='#bfdbfe'; g.beginPath(); g.moveTo(cx+cw*0.4,y-ch*0.92); g.lineTo(cx+cw*0.6,y-ch*0.92); g.quadraticCurveTo(cx+cw*0.88,y-ch*0.88,cx+cw*0.93,y-ch*0.55); g.lineTo(cx+cw*0.4,y-ch*0.55); g.fill();
  g.fillStyle='rgba(31,41,55,.75)'; g.beginPath(); g.arc(cx+cw*0.6,y-ch*0.75,s*0.5,0,7); g.fill(); g.fillStyle='#d1d5db'; g.fillRect(cx+cw*0.8,y-2*s,cw*0.25,s*0.8); g.fillStyle='#fef3c7'; g.fillRect(cx+cw*0.93,y-ch*0.42,cw*0.07,ch*0.09);
  for(const wx of van?[0.18,0.8]:[0.14,0.27,0.82]) vdWheel(g,x+L*wx,y-0.9*s,0.9*s,a); VD.hl=[cx+cw,y-ch*0.38];
  if(VD.brk||VD.hold>0||VD.feuWait) vdLight(x,y-2.5*s,s*3,0.9,'255,40,40'); if(Math.random()<0.2) VD.smoke.push({x:x-s*0.2,y:y-1.3*s,r:s*0.4,a:0.4,c:'110,110,110'}); if(dirt&&Math.random()<0.5) VD.smoke.push({x:x+s,y:y-s*0.5,r:s*1.1,a:0.4,c:'190,120,80',dust:1}); }
function vdOwnTanker(g,x,y,s){ const col=S.company.color||'#2563eb', L=16*s, a=VD.d/0.9, bob=Math.sin(VD.tt*6)*s*0.06; g.fillStyle='rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x+L*0.5,y+s*0.2,L*0.55,s*0.55,0,0,7); g.fill(); y+=bob;
  const tg=g.createLinearGradient(0,y-6*s,0,y-1.8*s); tg.addColorStop(0,'#f8fafc'); tg.addColorStop(0.45,'#cbd5e1'); tg.addColorStop(1,'#94a3b8'); g.fillStyle=tg; vdRR(g,x,y-6.2*s,L*0.7,4.4*s,2.2*s); g.fill();
  g.fillStyle=col; g.fillRect(x+s,y-4.4*s,L*0.7-2*s,s*0.9); g.fillStyle='#fff'; g.font=`bold ${Math.max(8,1.3*s)}px sans-serif`; g.textAlign='left'; g.fillText(`${S.company.logo||''} ${S.company.name} · KÉROSÈNE`.slice(0,30),x+s*1.4,y-3.75*s,L*0.7-3*s);
  g.fillStyle='#dc2626'; g.fillRect(x+L*0.55,y-5.7*s,s*1.6,s*1.3); g.fillStyle='#fff'; g.font=`bold ${Math.max(6,0.8*s)}px sans-serif`; g.fillText('1863',x+L*0.55+s*0.1,y-4.8*s,s*1.4);
  g.fillStyle='#64748b'; for(let k=0;k<3;k++) g.fillRect(x+s*(2+k*3.5),y-6.6*s,s*1.4,s*0.4); g.fillStyle='#1f2937'; g.fillRect(x,y-2*s,L*0.96,s*0.6);
  const cx=x+L*0.72; g.fillStyle=col; g.beginPath(); g.moveTo(cx,y-1.3*s); g.lineTo(cx,y-6.2*s); g.lineTo(cx+L*0.17,y-6.2*s); g.quadraticCurveTo(cx+L*0.27,y-6,cx+L*0.28,y-3.2*s); g.lineTo(cx+L*0.28,y-1.3*s); g.fill();
  g.fillStyle='#bfdbfe'; g.fillRect(cx+L*0.12,y-5.7*s,L*0.13,s*1.9); g.fillStyle='#fef3c7'; g.fillRect(cx+L*0.26,y-2.6*s,L*0.02,s*0.5);
  for(const px of [0.08,0.18,0.55,0.86,0.96]) vdWheel(g,x+L*px,y-0.9*s,0.9*s,a); VD.hl=[cx+L*0.28,y-2.4*s]; if(VD.brk||VD.hold>0||VD.feuWait) vdLight(x,y-2.5*s,s*3,0.9,'255,40,40'); }
function vdVeh(g,t,x,y,s,k){ const a=VD.tt*8, C=['#dc2626','#f8fafc','#1f2937','#2563eb','#16a34a','#9ca3af'][k%6];
  if(t==='taxi'){ const L=11*s; g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x,y-s*0.1,L,s*0.5); g.fillStyle='#facc15'; vdRR(g,x,y-5.4*s,L,4.6*s,s*0.9); g.fill(); g.fillStyle='#1d4ed8'; g.fillRect(x,y-2.6*s,L,s*0.8);
    g.fillStyle='#334155'; for(let j=0;j<4;j++) g.fillRect(x+s*(0.7+j*2.2),y-4.8*s,s*1.8,s*1.5); g.fillStyle='#93c5fd'; g.beginPath(); g.moveTo(x+L*0.86,y-4.8*s); g.lineTo(x+L*0.97,y-3.2*s); g.lineTo(x+L*0.86,y-3.2*s); g.fill();
    g.fillStyle='#57534e'; g.fillRect(x+s,y-6*s,L*0.7,s*0.3); vdBlobs(g,'#dc2626',[[x+s*2.5,y-6.4*s,s*0.7]]); vdBlobs(g,'#7c3aed',[[x+s*4.3,y-6.5*s,s*0.8]]); g.fillStyle='#e7d3a8'; g.fillRect(x+s*5.6,y-7.1*s,s*2.4,s*1.1);
    vdWheel(g,x+L*0.2,y-0.8*s,0.85*s,a); vdWheel(g,x+L*0.8,y-0.8*s,0.85*s,a); return L; }
  if(t==='moto'){ const L=5*s; vdWheel(g,x+s*0.9,y-0.8*s,0.8*s,a); vdWheel(g,x+s*4.1,y-0.8*s,0.8*s,a); g.strokeStyle='#1f2937'; g.lineWidth=Math.max(1,s*0.3); g.beginPath(); g.moveTo(x+s*0.9,y-0.8*s); g.lineTo(x+s*2.3,y-1.8*s); g.lineTo(x+s*3.6,y-2.6*s); g.lineTo(x+s*4.1,y-0.8*s); g.stroke();
    g.fillStyle=C; g.fillRect(x+s*1.6,y-2.3*s,s*2,s*0.7); vdPerson(g,x+s*2.9,y-1.8*s,2*s,VD_CLO[k%9],0,'homme',k); vdPerson(g,x+s*1.9,y-1.8*s,1.9*s,VD_CLO[(k+4)%9],0,k%2?'maman':'homme',k+1); return L; }
  if(t==='loaded'){ const L=14*s, cab=['#15803d','#1d4ed8','#b91c1c','#a16207'][k%4]; g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x,y-s*0.1,L,s*0.5);
    g.fillStyle='#8b5a2b'; g.fillRect(x,y-4.2*s,L*0.68,2.8*s); g.strokeStyle='#5b3a1a'; g.lineWidth=1; g.beginPath(); for(let j=1;j<5;j++){ g.moveTo(x,y-4.2*s+j*0.56*s); g.lineTo(x+L*0.68,y-4.2*s+j*0.56*s); } g.stroke();
    const sacks=[]; for(let r2=0;r2<3;r2++) for(let j=0;j<5-r2;j++) sacks.push([x+s*(1+j*1.85+r2*0.9),y-5*s-r2*1.4*s,s*1.05]); g.fillStyle='#cdb88c'; g.beginPath(); for(const [a1,b1,r1] of sacks){ g.moveTo(a1+r1,b1); g.ellipse(a1,b1,r1,r1*0.62,0,0,7); } g.fill(); g.fillStyle='#e9dcb8'; g.beginPath(); for(const [a1,b1,r1] of sacks){ g.moveTo(a1+r1*0.5,b1-r1*0.2); g.ellipse(a1-r1*0.15,b1-r1*0.2,r1*0.6,r1*0.3,0,0,7); } g.fill();
    for(let j=0;j<3;j++) vdPerson(g,x+s*(2.5+j*2.4),y-8.2*s,1.8*s,VD_CLO[(k+j*2)%9],0,j%2?'maman':'homme',k+j);
    const cx=x+L*0.7; g.fillStyle=cab; g.beginPath(); g.moveTo(cx,y-1.2*s); g.lineTo(cx,y-5.6*s); g.lineTo(cx+L*0.18,y-5.6*s); g.lineTo(cx+L*0.3,y-3*s); g.lineTo(cx+L*0.3,y-1.2*s); g.fill(); g.fillStyle='#bfdbfe'; g.fillRect(cx+L*0.1,y-5.1*s,L*0.1,s*1.6);
    for(const px of [0.15,0.5,0.88]) vdWheel(g,x+L*px,y-0.9*s,0.9*s,a,'#d97706'); return L; }
  if(t==='tanker'){ const L=15*s; g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x,y-s*0.1,L,s*0.5); const gr=g.createLinearGradient(0,y-5.4*s,0,y-1.6*s); gr.addColorStop(0,'#f1f5f9'); gr.addColorStop(0.5,'#cbd5e1'); gr.addColorStop(1,'#94a3b8'); g.fillStyle=gr; vdRR(g,x,y-5.4*s,L*0.7,3.8*s,1.9*s); g.fill();
    g.fillStyle='#dc2626'; g.fillRect(x+L*0.05,y-3.9*s,L*0.6,s*0.5); g.fillStyle='#1f2937'; g.fillRect(x,y-1.7*s,L*0.96,s*0.5); const cx=x+L*0.72; g.fillStyle=['#1d4ed8','#b91c1c','#15803d'][k%3]; g.beginPath(); g.moveTo(cx,y-1.2*s); g.lineTo(cx,y-5.6*s); g.lineTo(cx+L*0.17,y-5.6*s); g.lineTo(cx+L*0.27,y-3*s); g.lineTo(cx+L*0.27,y-1.2*s); g.fill(); g.fillStyle='#bfdbfe'; g.fillRect(cx+L*0.1,y-5.1*s,L*0.1,s*1.6);
    for(const px of [0.1,0.2,0.55,0.9]) vdWheel(g,x+L*px,y-0.85*s,0.85*s,a); return L; }
  if(t==='dumper'){ const L=13*s; g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x,y-s*0.1,L,s*0.6); g.fillStyle='#eab308'; g.beginPath(); g.moveTo(x,y-7*s); g.lineTo(x+L*0.72,y-7.5*s); g.lineTo(x+L*0.72,y-3*s); g.lineTo(x+L*0.1,y-3*s); g.fill(); g.fillStyle='#a16207'; g.fillRect(x,y-3.4*s,L*0.95,s*0.8);
    const L2=[]; for(let j=0;j<5;j++) L2.push([x+s*(1.5+j*1.8),y-7.4*s,s*1.1]); vdBlobs(g,'#7c4a2a',L2); g.fillStyle='#ca8a04'; g.fillRect(x+L*0.74,y-6.5*s,L*0.22,s*3.2); g.fillStyle='#bfdbfe'; g.fillRect(x+L*0.8,y-6*s,L*0.12,s*1.4);
    vdWheel(g,x+L*0.22,y-1.4*s,1.4*s,a,'#ca8a04'); vdWheel(g,x+L*0.8,y-1.4*s,1.4*s,a,'#ca8a04'); return L; }
  if(t==='pickup'){ const L=9*s; g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x,y-s*0.1,L,s*0.45); g.fillStyle=C; g.fillRect(x,y-2.8*s,L,1.8*s); g.beginPath(); g.moveTo(x+L*0.5,y-2.8*s); g.lineTo(x+L*0.55,y-4.6*s); g.lineTo(x+L*0.78,y-4.6*s); g.lineTo(x+L*0.9,y-2.8*s); g.fill();
    g.fillStyle='#93c5fd'; g.fillRect(x+L*0.6,y-4.3*s,L*0.16,s*1.2); vdBlobs(g,'#16a34a',[[x+s*1.3,y-3.4*s,s*0.8],[x+s*2.8,y-3.3*s,s*0.8]]); vdWheel(g,x+L*0.2,y-0.8*s,0.8*s,a); vdWheel(g,x+L*0.8,y-0.8*s,0.8*s,a); return L; }
  // voiture
  const L=8*s; g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x,y-s*0.1,L,s*0.45); g.fillStyle=C; vdRR(g,x,y-2.8*s,L,1.9*s,s*0.6); g.fill(); g.beginPath(); g.moveTo(x+L*0.22,y-2.7*s); g.lineTo(x+L*0.35,y-4.1*s); g.lineTo(x+L*0.68,y-4.1*s); g.lineTo(x+L*0.82,y-2.7*s); g.fill();
  g.fillStyle='#93c5fd'; g.beginPath(); g.moveTo(x+L*0.3,y-2.8*s); g.lineTo(x+L*0.38,y-3.8*s); g.lineTo(x+L*0.66,y-3.8*s); g.lineTo(x+L*0.75,y-2.8*s); g.fill(); vdWheel(g,x+L*0.2,y-0.8*s,0.75*s,a); vdWheel(g,x+L*0.8,y-0.8*s,0.75*s,a); return L; }
function vdTraffic(g){ if(VD.mode==='train') return; const s=VD.sc, d=VD.d, od=VD.od||0, wL=d-VD.vx/s-40, wR=d+(VD.W-VD.vx)/s+40, T=VD.rg==='katanga'?['tanker','dumper','tanker','pickup','car','moto','loaded','tanker','taxi']:['taxi','moto','loaded','pickup','car','moto','taxi','loaded','car'], H2=VD.rb-VD.rt;
  // ceux qui viennent en face
  const gap=55, sh=od*0.9; const opp=[];
  for(let k=Math.floor((wL+sh)/gap);k<=Math.floor((wR+sh)/gap);k++){ if(vdRnd(k,41)<0.3) continue; const wx=k*gap+vdRnd(k,42)*60-sh, X=VD.vx+(wx-d)*s, rt=vdRoadType(wx), y=rt==='auto'?VD.rt+H2*(k%2?0.2:0.4):VD.oppY; opp.push([y,X,k,T[Math.floor(vdRnd(k,43)*T.length)],rt]); }
  // ceux qui vont dans le même sens et nous dépassent (voie de gauche sur l'autoroute, ou en face sur une route à deux voies)
  const ovt=[], g2=170, sh2=od*1.45;
  for(let k=Math.floor((wL-sh2)/g2);k<=Math.floor((wR-sh2)/g2);k++){ const wx=k*g2+vdRnd(k,44)*90+sh2, rt=vdRoadType(wx); if(vdRnd(k,45)<(rt==='auto'?0.25:0.65)) continue; const X=VD.vx+(wx-d)*s;
    ovt.push([rt==='auto'?VD.rt+H2*0.72:VD.rt+H2*0.5,X,k,['car','pickup','taxi','moto','car'][Math.floor(vdRnd(k,46)*5)],rt]); }
  for(const [y,X,k,typ,rt] of opp.sort((a,b)=>a[0]-b[0])){ g.save(); g.translate(X,0); g.scale(-1,1); const L=vdVeh(g,typ,0,y,s*0.9,Math.abs(k)); g.restore();
    if(VD.dark>0.4){ vdLight(X-L,y-1.6*s,s*2.5,0.8,'255,240,200'); VD.beams.push([X-L,y-1.6*s,-18*s,0]); vdLight(X-s*0.3,y-1.6*s,s*1.4,0.7,'255,40,40'); }
    if(rt==='dirt'&&Math.random()<0.15) VD.smoke.push({x:X,y:y-s,r:s,a:0.3,c:'190,120,80',dust:1}); }
  for(const [y,X,k,typ,rt] of ovt){ const L=vdVeh(g,typ,X,y,s*0.9,Math.abs(k)+3);
    g.fillStyle='#ff3b3b'; g.fillRect(X-s*0.25,y-2.2*s,s*0.45,s*0.6); if(VD.dark>0.4){ vdLight(X+L,y-1.6*s,s*2.5,0.8,'255,240,200'); VD.beams.push([X+L,y-1.6*s,18*s,0]); vdLight(X,y-1.9*s,s*1.6,0.8,'255,40,40'); }
    if(rt==='dirt'&&Math.random()<0.15) VD.smoke.push({x:X,y:y-s,r:s,a:0.3,c:'190,120,80',dust:1}); }
  // vélos chargés de charbon, poussés sur le bas-côté (même sens, plus lents)
  const vb=od*0.15; for(let k=Math.floor((wL-vb)/420);k<=Math.floor((wR-vb)/420);k++){ if(vdRnd(k,51)<0.5) continue; const X=VD.vx+(k*420+vdRnd(k,52)*200+vb-d)*s, y=VD.rt-s*0.3;
    vdWheel(g,X,y-0.7*s,0.7*s,VD.tt*3); vdWheel(g,X+3.4*s,y-0.7*s,0.7*s,VD.tt*3); g.strokeStyle='#1f2937'; g.lineWidth=Math.max(1,s*0.2); g.beginPath(); g.moveTo(X,y-0.7*s); g.lineTo(X+1.7*s,y-2*s); g.lineTo(X+3.4*s,y-0.7*s); g.stroke();
    vdBlobs(g,'#1c1917',[[X+0.8*s,y-2.6*s,s*0.9],[X+2.4*s,y-2.6*s,s*0.9],[X+1.6*s,y-3.9*s,s*0.85]]); vdPerson(g,X+4.6*s,y,2*s,VD_CLO[k%9],VD.tt*4,'homme',k); } }
function vdTrain(g,x,y,s){ const col=S.company.color||'#2563eb', a=VD.d/0.7, n=VD.cars||6, wl=15*s, lh=4.8*s;
  g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x-n*wl,y+0.3*s,n*wl+wl*1.25,s*0.5);
  const CT=['#b91c1c','#1d4ed8','#15803d','#f59e0b','#7c3aed'];
  for(let k=1;k<=n;k++){ const wx=x-k*wl; if(wx>VD.W+50||wx+wl<-50) continue; const ty=k%4;
    g.fillStyle='#27272a'; g.fillRect(wx+wl*0.03,y-1.5*s,wl*0.94,0.45*s); g.fillRect(wx-wl*0.02,y-1.35*s,wl*0.06,0.2*s);
    if(VD.paxV){ const top=y-lh-2.2*s, hh=lh+0.8*s, gc=g.createLinearGradient(0,top,0,top+hh); gc.addColorStop(0,vdLt(col,0.25)); gc.addColorStop(1,vdDk(col,0.2)); g.fillStyle=gc; vdRR(g,wx+wl*0.03,top,wl*0.94,hh,s*0.6); g.fill();
      g.fillStyle='#f8fafc'; g.fillRect(wx+wl*0.03,top+hh*0.68,wl*0.94,hh*0.08); for(let j=0;j<6;j++){ const X2=wx+wl*(0.08+j*0.145); g.fillStyle=VD.dark>0.4?'#ffd27a':'#bfdbfe'; g.fillRect(X2,top+hh*0.18,wl*0.11,hh*0.36); if(VD.dark>0.4) vdWin(X2,top+hh*0.18,wl*0.11,hh*0.36);
        if(vdRnd(j,k)<0.75){ g.fillStyle=VD_SKIN[(j+k)%4]; g.beginPath(); g.arc(X2+wl*0.055,top+hh*0.35,s*0.4,0,7); g.fill(); } }
      g.fillStyle=vdDk(col,0.3); g.fillRect(wx+wl*0.47,top+hh*0.12,wl*0.06,hh*0.8); }
    else if(VD.vk==='mine'){ g.fillStyle='#57534e'; g.beginPath(); g.moveTo(wx+wl*0.04,y-lh-1.2*s); g.lineTo(wx+wl*0.96,y-lh-1.2*s); g.lineTo(wx+wl*0.86,y-1.5*s); g.lineTo(wx+wl*0.14,y-1.5*s); g.fill(); g.fillStyle='rgba(0,0,0,.18)'; for(let j=1;j<5;j++) g.fillRect(wx+wl*(0.04+j*0.18),y-lh-1.2*s,1.5,lh*0.8);
      vdBlobs(g,k%2?'#3f8f6a':'#b45309',[[wx+wl*0.3,y-lh-1.2*s,wl*0.1],[wx+wl*0.5,y-lh-1.4*s,wl*0.12],[wx+wl*0.7,y-lh-1.2*s,wl*0.1]]); g.fillStyle='#fff'; g.font=`bold ${Math.max(7,1.1*s)}px sans-serif`; g.textAlign='center'; g.fillText(k%2?'COBALT':'CUIVRE',wx+wl*0.5,y-lh*0.35-1.4*s); }
    else if(VD.vk==='fast'){ const top=y-lh-1.6*s; g.fillStyle='#e5e7eb'; vdRR(g,wx+wl*0.02,top,wl*0.96,lh+0.2*s,s*0.5); g.fill(); g.fillStyle=col; g.fillRect(wx+wl*0.02,top+lh*0.55,wl*0.96,lh*0.18); g.fillStyle='#94a3b8'; for(let j=0;j<5;j++) g.fillRect(wx+wl*(0.08+j*0.18),top+lh*0.15,wl*0.12,lh*0.3); }
    else if(ty===0){ const gr=g.createLinearGradient(0,y-lh-1.3*s,0,y-1.3*s); gr.addColorStop(0,'#52525b'); gr.addColorStop(0.35,'#27272a'); gr.addColorStop(1,'#18181b'); g.fillStyle=gr; vdRR(g,wx+wl*0.05,y-lh-1.2*s,wl*0.9,lh*0.9,lh*0.45); g.fill(); g.fillStyle='#e5e7eb'; g.fillRect(wx+wl*0.48,y-lh-1.6*s,wl*0.05,s*0.5); }
    else if(ty===1||ty===3){ for(let c=0;c<2;c++){ const cc=CT[(k*2+c)%CT.length]; g.fillStyle=cc; g.fillRect(wx+wl*(0.05+c*0.46),y-lh-1.5*s,wl*0.44,lh); g.fillStyle='rgba(0,0,0,.15)'; for(let j=1;j<8;j++) g.fillRect(wx+wl*(0.05+c*0.46)+j*wl*0.055,y-lh-1.5*s,1,lh); g.fillStyle=vdLt(cc,0.4); g.fillRect(wx+wl*(0.05+c*0.46),y-lh-1.5*s,wl*0.44,s*0.25); } }
    else { g.fillStyle=col; g.fillRect(wx+wl*0.04,y-lh-1.5*s,wl*0.92,lh); g.fillStyle='rgba(0,0,0,.15)'; g.fillRect(wx+wl*0.35,y-lh-1.3*s,wl*0.3,lh*0.9); g.fillStyle='#fff'; g.font=`bold ${Math.max(8,1.3*s)}px sans-serif`; g.textAlign='center'; g.fillText(S.company.code||'',wx+wl*0.5,y-lh*0.45-1.5*s); }
    for(const p of [0.2,0.8]){ g.fillStyle='#3f3f46'; g.fillRect(wx+wl*p-s*1.4,y-1.2*s,s*2.8,s*0.5); vdWheel(g,wx+wl*p-s*0.8,y-0.6*s,0.6*s,a); vdWheel(g,wx+wl*p+s*0.8,y-0.6*s,0.6*s,a); } }
  // locomotive diesel
  const LL=wl*1.25, by=y-1.3*s, H2=lh+2.2*s, gr=g.createLinearGradient(0,by-H2,0,by), LC=VD.vk==='mine'?['#4ade80','#15803d']:VD.vk==='fast'?['#f8fafc','#cbd5e1']:VD.vk==='pax'?[vdLt(col,0.3),vdDk(col,0.1)]:['#fde047','#d97706']; gr.addColorStop(0,LC[0]); gr.addColorStop(1,LC[1]); g.fillStyle=gr;
  g.beginPath(); g.moveTo(x,by); g.lineTo(x,by-H2*0.82); g.lineTo(x+LL*0.72,by-H2*0.82); g.lineTo(x+LL*0.74,by-H2); g.lineTo(x+LL*0.93,by-H2); g.quadraticCurveTo(x+LL,by-H2*0.98,x+LL,by-H2*0.55); g.lineTo(x+LL,by); g.fill();
  g.fillStyle=col; g.fillRect(x,by-H2*0.32,LL,H2*0.16); g.fillStyle='#14532d'; g.fillRect(x,by-H2*0.14,LL,H2*0.14);
  g.fillStyle='#78716c'; for(let j=0;j<4;j++){ g.beginPath(); g.arc(x+LL*(0.12+j*0.15),by-H2*0.82,s*0.6,Math.PI,0); g.fill(); }
  g.fillStyle=VD.dark>0.4?'#ffd27a':'#93c5fd'; g.fillRect(x+LL*0.8,by-H2*0.92,LL*0.13,H2*0.3); if(VD.dark>0.4) vdWin(x+LL*0.8,by-H2*0.92,LL*0.13,H2*0.3);
  g.strokeStyle='#e5e7eb'; g.lineWidth=1; g.beginPath(); g.moveTo(x+s,by-H2*0.45); g.lineTo(x+LL*0.7,by-H2*0.45); g.stroke();
  g.fillStyle='#1f2937'; g.font=`bold ${Math.max(9,1.5*s)}px sans-serif`; g.textAlign='center'; g.fillText(`${S.company.logo||''} ${S.company.code||'SE'}`,x+LL*0.38,by-H2*0.52);
  g.fillStyle='#fef3c7'; g.beginPath(); g.arc(x+LL-s*0.3,by-H2*0.42,s*0.45,0,7); g.fill(); VD.hl=[x+LL,by-H2*0.42];
  for(const p of [0.2,0.75]){ g.fillStyle='#3f3f46'; g.fillRect(x+LL*p-s*2.4,y-1.3*s,s*4.8,s*0.6); for(const o of [-1.6,0,1.6]) vdWheel(g,x+LL*p+o*s,y-0.62*s,0.62*s,a); }
  if(Math.random()<0.3) VD.smoke.push({x:x+LL*0.3,y:by-H2*0.85,r:2*s/5,a:0.5,c:'90,90,90'}); }
/* premier plan : buissons, bananiers, termitières, hautes herbes (défilent plus vite) */
function vdFront(g,W,H,fy){ const k=1.5, s=VD.sc*k, d=VD.d, T=15, off=d*1.5, x0=off-VD.vx/VD.sc-20, x1=x0+W/VD.sc+40, fk=VD.fk;
  const lay=(y,col,amp,ph)=>{ g.fillStyle=col; g.beginPath(); g.moveTo(0,H); for(let x=0;x<=W+8;x+=8){ const wx=(x/VD.sc)+off; g.lineTo(x,y+Math.sin(wx*0.07+ph)*amp+Math.sin(wx*0.19+ph)*amp*0.5); } g.lineTo(W,H); g.fill(); };
  const base=vdBiome('#2f6b28','#8a8a3a'); g.fillStyle=base; g.fillRect(0,fy,W,H-fy);
  g.strokeStyle=vdLt(base,0.15); g.lineWidth=1.5; g.beginPath(); for(let x=-((d*VD.sc*1.2)%10);x<W;x+=10){ const h=5+((Math.round(x+d*VD.sc*1.2)*7)%8); g.moveTo(x,fy+3); g.lineTo(x-2,fy+3-h); } g.stroke();
  lay(fy+H*0.05,vdDk(base,0.15),6,0);
  for(let t=Math.floor(x0/T);t<=Math.floor(x1/T);t++){ const r=j=>vdRnd(t,j+500), wx=t*T+r(1)*T, X=VD.vx+(wx-off)*VD.sc, Y=fy+H*(0.1+r(2)*0.1), q=r(3);
    if(X<-80||X>W+80||VD.riv.some(bx=>Math.abs(VD.vx+(bx-d)*VD.sc*1.5-X)<VD_RIVW*VD.sc*1.5)) continue;
    if(q<0.28) vdBush(g,X,Y,s*1.1,vdDk(vdBiome('#2f7a2a','#5f7f1a'),0.1));
    else if(q<0.45&&fk>0.5) vdBanana(g,X,Y,9*s,'#3fa34a');
    else if(q<0.36) vdMound(g,X,Y,s*0.9); else if(q<0.45) vdBush(g,X,Y,s*0.8,'#6b7f2a');
    else if(q<0.82) vdGrass(g,X,Y,s*0.9,vdBiome('#4d7c0f','#c99a2e'));
    else if(r(4)<0.5){ g.fillStyle='#7a5a32'; g.fillRect(X,Y-3*s,0.45*s,3*s); g.fillRect(X+5*s,Y-3*s,0.45*s,3*s); g.fillRect(X-0.5*s,Y-2.7*s,6.5*s,0.35*s); g.fillRect(X-0.5*s,Y-1.6*s,6.5*s,0.35*s); }
    else { vdBlobs(g,'#78716c',[[X,Y-s*0.5,s*0.9],[X+s*1.2,Y-s*0.35,s*0.6]]); vdBlobs(g,'#a8a29e',[[X-s*0.25,Y-s*0.8,s*0.4]]); } }
  lay(fy+H*0.17,vdDk(base,0.3),4,2); }

/* ---------- événements de la route : contrôles, péages, travaux, gares ---------- */
const VD_EVT={police:{stop:3.5,msg:'👮 Contrôle de police : le chauffeur montre les papiers'},peage:{stop:2.5,msg:'🎫 Péage : le chauffeur paie le passage'},works:{slow:0.3,msg:'🚧 Travaux : on roule doucement'},panne:{msg:'⚠️ Un camion en panne sur le bas-côté (branches sur la route pour prévenir)'},cross:{msg:'🚸 Passage à niveau : la locomotive klaxonne'},halt:{stop:5},douane:{stop:4.5,msg:'🛂 Frontière : contrôle des passeports et de la marchandise à la douane'},peche:{msg:'🎣 Des pêcheurs en pirogue viennent vendre du poisson'},feu:{stop:3.2,msg:'🚦 Feu rouge : on attend le vert'}};
function vdEvents(w0,w1){ const out=[], tr=VD.mode==='train', C=tr?20000:30000;
  if(VD.mode==='boat'){ for(let c=Math.max(1,Math.floor(w0/25000)-1);c<=Math.floor(w1/25000);c++){ const w=c*25000+5000+vdRnd(c,212)*15000; if(w<w0-80||w>w1+80||w>VD.len-4000||VD.oceanOnly) continue; if(vdRnd(c,211)<0.5) out.push({id:'p'+c,t:'peche',w}); }
    for(let i=1;i<VD.stops.length-1;i++){ const st=VD.stops[i]; if(st.d>w0-80&&st.d<w1+80) out.push({id:'h'+i,t:'halt',w:st.d,name:st.name}); } return out; }
  for(let c=Math.max(1,Math.floor(w0/C)-1);c<=Math.floor(w1/C);c++){ const w=c*C+6000+vdRnd(c,202)*(C-12000), r=vdRnd(c,201); if(w<w0-80||w>w1+80||w>VD.len-4000) continue;
    if(vdZone(w).t==='town'||vdRivers(w-90,w+90).some(bx=>Math.abs(bx-w)<90)) continue;
    const t=tr?(r<0.6?'cross':null):(r<0.32?'police':r<0.47&&vdRoadType(w)!=='dirt'?'peage':r<0.62?'works':r<0.8?'panne':null); if(t) out.push({id:t+c,t,w}); }
  for(let i=1;i<VD.stops.length-1;i++){ const st=VD.stops[i]; if(st.d>w0-80&&st.d<w1+80) out.push({id:'h'+i,t:'halt',w:st.d,name:st.name}); }
  for(let i=1;i<VD.stops.length;i++){ const A=VD.stops[i-1], B=VD.stops[i]; if(A.cc===B.cc) continue; const w=(A.d+B.d)/2; if(w>w0-80&&w<w1+80) out.push({id:'b'+i,t:'douane',w,from:A.cc,to:B.cc}); }
  if(!tr) for(const st of VD.stops){ const R=VD_TR(st), sd=Math.round(st.d)%99991; if(st.d+R<w0-80||st.d-R>w1+80) continue;
    for(let k=-5;k<=5;k++){ const w=st.d+k*600+vdRnd(k+50,sd)*120; if(Math.abs(w-st.d)<250||Math.abs(w-st.d)>R-150||w<40||w>VD.len-40||w<w0-80||w>w1+80) continue; if(vdRnd(k+77,sd)<0.25) continue;
      out.push({id:'f'+sd+'_'+k,t:'feu',w,ph:vdRnd(k+99,sd)*14}); } }
  return out; }
// cycle d'un feu (pour notre route) : vert 7 s, orange 1,5 s, rouge 5,5 s ; la rue qui croise a l'inverse
function vdFeuState(e){ const t=(VD.tt+e.ph)%14; return t<7?'green':t<8.5?'orange':'red'; }
function vdControl(dt){ const front=VD.mode==='train'?19:VD.mode==='boat'?(VD.front||40):9.5, look=VD.d+front; let tgt=1, msg='', maxStep=1e9;
  if(VD.feuWait){ const e=VD.feuWait; VD.vf=0; VD.brk=true; VD.msg=vdFeuState(e)==='orange'?'🟠 Feu orange : on s’arrête':'🔴 Feu rouge : on attend le vert, les piétons traversent'; if(vdFeuState(e)==='green'){ VD.feuWait=null; VD.done.add(e.id); } return 0; }
  if(VD.hold>0){ VD.hold-=dt*Math.max(1,VD.sp/10); VD.vf=0; VD.msg=VD.holdMsg; if(VD.hold<=0){ VD.hold=0; VD.lastGo=performance.now(); } return 0; }
  for(const e of vdEvents(VD.d-80,look+200)){ const E=VD_EVT[e.t], dist=e.w-2-look;
    if(e.t==='feu'){ if(!VD.done.has(e.id)&&dist>-1){ const st=vdFeuState(e); if(st==='green'){ if(dist<4) VD.done.add(e.id); else if(dist<150) msg='🟢 Feu vert : on passe'; }
        else { if(dist<=0.6){ VD.feuWait=e; VD.vf=0; vaBrake(); return 0; } maxStep=Math.min(maxStep,dist); if(dist<80) tgt=Math.min(tgt,Math.max(0.2,dist/80)); if(dist<150) msg=st==='orange'?'🟠 Feu orange : on ralentit':'🔴 Feu rouge devant'; } } continue; }
    if(E.stop&&!VD.done.has(e.id)&&dist>-1){ if(dist<=0.6){ VD.done.add(e.id); VD.hold=E.stop; VD.holdMsg=e.t==='douane'?`🛂 Frontière ${(COUNTRIES[e.from]||[])[2]||''} → ${(COUNTRIES[e.to]||[])[2]||''} : passage à la douane`:e.t==='halt'&&VD.paxV?(VD.mode==='train'?`🚉 Gare de ${e.name} : des voyageurs descendent, d’autres montent`:`🚏 Arrêt à ${e.name} : des passagers descendent et montent`):e.t==='halt'?(VD.mode==='boat'?`⚓ Escale au port de ${e.name} : on charge et on décharge`:VD.mode==='train'?`🚉 Arrêt en gare de ${e.name} : on charge et on décharge`:`📦 Arrêt à ${e.name} : livraison et pause du chauffeur`):E.msg; VD.vf=0; vaBrake(); VD.msg=VD.holdMsg; return 0; }
      maxStep=Math.min(maxStep,dist); if(dist<80) tgt=Math.min(tgt,Math.max(0.2,dist/80)); if(dist<150) msg=e.t==='halt'?'':E.msg; }
    if(E.slow&&Math.abs(e.w-VD.d)<45){ tgt=Math.min(tgt,E.slow); msg=E.msg; }
    if(!E.stop&&!E.slow&&Math.abs(e.w-VD.d)<70) msg=E.msg;
    if(e.t==='cross'&&!VD.done.has(e.id)&&dist<60&&dist>0){ VD.done.add(e.id); vdHorn(); } }
  const left=VD.len-look; if(left<80) tgt=Math.min(tgt,Math.max(0.12,left/80));
  VD.vf+=(tgt-VD.vf)*Math.min(1,dt*(tgt<VD.vf?3:0.9)*Math.max(1,VD.sp/10)); VD.brk=tgt<VD.vf-0.05; VD.msg=msg; VD.maxStep=maxStep; return VD.vf; }
function vdFeu(g,X,s,e,open){ const rb=VD.rb, rt=VD.rt, H2=rb-rt, d=VD.d, stt=vdFeuState(e), red=stt==='red', amber=stt==='orange', crossGo=red, cx=X+14*s;
  // rue qui croise en perspective, avec ses voitures (elles passent quand nous avons le rouge)
  const pts=[]; for(let f=0.3;f<=1.62;f+=0.08) pts.push([VD.vx+(e.w+14-d)*s*f,vdRiverY(f),6*s*f+1]);
  g.fillStyle='#4b5055'; g.beginPath(); pts.forEach(([x,y,w],i)=>i?g.lineTo(x-w,y):g.moveTo(x-w,y)); pts.slice().reverse().forEach(([x,y,w])=>g.lineTo(x+w,y)); g.fill();
  g.strokeStyle='rgba(255,255,255,.6)'; g.lineWidth=1.3; g.setLineDash([6,8]); g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke(); g.setLineDash([]);
  g.fillStyle='#4b5563'; g.fillRect(X+s*7,rt,s*13,H2);   // carrefour sur notre route
  const cars=[]; for(let k=0;k<4;k++){ const dir=k%2?1:-1, col=['#dc2626','#f8fafc','#2563eb','#facc15'][k];
    let f; if(crossGo){ const p=((VD.tt*0.09+k*0.27)%1); f=dir>0?0.35+p*1.25:1.6-p*1.25; } else f=dir>0?(0.66-k*0.07):(1.42+k*0.06);
    if(f<0.3||f>1.62) continue; cars.push([f,dir,col,k]); }
  cars.sort((a,b)=>a[0]-b[0]); for(const [f,dir,col,k] of cars){ const x=VD.vx+(e.w+14-d)*s*f+(dir>0?-2.2:2.2)*s*f, y=vdRiverY(f); vdCarFront(g,x,y,s*0.95*f,col,dir>0); }
  // passage piéton sur notre route
  g.fillStyle='rgba(248,250,252,.9)'; for(let j=0;j<9;j+=2) g.fillRect(X+s*1.5,rt+H2*(j/9),s*4.5,H2/9*0.9);
  // piétons : ils traversent quand nous avons le rouge, puis continuent leur chemin sur le trottoir
  if(red){ for(let j=0;j<6;j++){ const p=((VD.tt*0.07+j/6)%1.5), up=j%2===0; let px=X+s*(2.2+(j%3)*1.2), py;
      if(p<1){ py=up?rb+s*0.6-p*(H2+s*1.2):VD.gy+p*(H2+s*1.2); } else { py=up?VD.gy:rb+s*0.6; px+=(p-1)*(up?1:-1)*s*24; }
      vdPerson(g,px,py+s*0.3,1.9*s,VD_CLO[(j*2+3)%VD_CLO.length],VD.tt*5+j,['homme','maman','kid','homme','maman','homme'][j],j+5); } }
  else { for(let j=0;j<3;j++) vdPerson(g,X+s*(2+j*1.6),VD.gy+s*0.2,1.9*s,VD_CLO[(j*3+1)%VD_CLO.length],0,j===1?'maman':'homme',j+11); }
  // une voiture d'en face attend aussi au rouge
  if(red||amber){ g.save(); g.translate(X+s*24,0); g.scale(-1,1); vdVeh(g,['car','taxi','pickup'][Math.floor(e.ph)%3],0,VD.oppY,s*0.9,Math.floor(e.ph)); g.restore(); vdLight(X+s*24,VD.oppY-1.9*s,s*1.4,0.6,'255,40,40'); }
  for(const [px,py] of [[X-s*0.6,rb+s*0.6],[X+s*7,VD.gy+s*0.2]]){ g.fillStyle='#374151'; g.fillRect(px-s*0.22,py-10*s,s*0.44,10*s); g.fillStyle='#111827'; vdRR(g,px-s*0.9,py-14*s,s*1.8,s*4.6,s*0.4); g.fill();
    const L=[['#ff3b30',red],['#ff9f0a',amber],['#30d158',stt==='green']]; L.forEach(([c,on],i)=>{ const cy=py-13.2*s+i*1.45*s; g.fillStyle=on?c:'#3f3f46'; g.beginPath(); g.arc(px,cy,s*0.55,0,7); g.fill(); if(on) vdLight(px,cy,s*3.2,0.9,c==='#ff3b30'?'255,59,48':c==='#ff9f0a'?'255,159,10':'48,209,88'); }); } }
function vdFeuOld(g,X,s,e,open){ const rb=VD.rb, rt=VD.rt, H2=rb-rt, red=false, amber=false;
  for(const [px,py] of [[X-s*0.6,rb+s*0.6],[X+s*7,VD.gy+s*0.2]]){ g.fillStyle='#374151'; g.fillRect(px-s*0.22,py-10*s,s*0.44,10*s); g.fillStyle='#111827'; vdRR(g,px-s*0.9,py-14*s,s*1.8,s*4.6,s*0.4); g.fill();
    const L=[['#ff3b30',red&&!amber],['#ff9f0a',false],['#30d158',!red]]; L.forEach(([c,on],i)=>{ const cy=py-13.2*s+i*1.45*s; g.fillStyle=on?c:'#3f3f46'; g.beginPath(); g.arc(px,cy,s*0.55,0,7); g.fill(); if(on) vdLight(px,cy,s*3.2,0.9,c==='#ff3b30'?'255,59,48':'48,209,88'); }); } }
function vdArret(g,x,y,s,name){ g.fillStyle='#64748b'; g.fillRect(x,y-6*s,s*0.4,6*s); g.fillRect(x+8*s,y-6*s,s*0.4,6*s); g.fillStyle='#1d4ed8'; g.fillRect(x-s,y-7*s,10.5*s,1.4*s); g.fillStyle='rgba(191,219,254,.5)'; g.fillRect(x+s*0.4,y-5.6*s,7.6*s,4*s);
  g.fillStyle='#fff'; g.font=`bold ${Math.max(8,1.1*s)}px sans-serif`; g.textAlign='center'; g.fillText('🚏 ARRÊT',x+4.2*s,y-5.95*s,10*s); g.fillStyle='#78350f'; g.fillRect(x+s,y-2*s,6.4*s,s*0.4);
  const n=5, moving=VD.hold>0; for(let k=0;k<n;k++){ const base=x+s*(1.5+k*1.4); let px=base, py=y; if(moving){ const p=((VD.tt*0.08+k/n)%1), tx=VD.vx+s*(k%2?4:1); px=vdLerp(base,tx,p); py=vdLerp(y,VD.laneY-1*s,p); }
    vdPerson(g,px,py,2*s,VD_CLO[(k*3+name.length)%VD_CLO.length],VD.tt*5+k,['maman','homme','kid','homme','maman'][k],k+name.length);
    if(k%2===0){ g.fillStyle=['#7c3aed','#dc2626','#2563eb'][k%3]; g.fillRect(px+s*0.3,py-1.1*s,s*0.9,s*0.7); } } }
function vdBarrier(g,X,s,open){ const rb=VD.rb, rt=VD.rt; g.fillStyle='#6b7280'; g.fillRect(X-s*0.3,rb-s*3,s*0.6,s*4); g.fillStyle='#374151'; g.fillRect(X-s*0.6,rb-s*0.2,s*1.2,s*1.2);
  const ax=X, ay=rb-s*2.6, bx=open?X+s*0.6:X+s*5, by=open?rb-s*13:rt-s*2.6; g.lineCap='round'; g.strokeStyle='#f8fafc'; g.lineWidth=s*0.7; g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.stroke();
  g.strokeStyle='#dc2626'; g.setLineDash([s*0.9,s*0.9]); g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.stroke(); g.setLineDash([]); g.lineCap='butt'; }
function vdBooth(g,X,y,s,txt,col){ g.fillStyle='#e5e7eb'; g.fillRect(X,y-6*s,6*s,6*s); g.fillStyle='#93c5fd'; g.fillRect(X+s,y-4.6*s,4*s,2*s); g.fillStyle=col; g.fillRect(X-s*0.5,y-7.6*s,7*s,1.8*s); g.fillStyle='#fff'; g.font=`bold ${Math.max(8,1.2*s)}px sans-serif`; g.textAlign='center'; g.fillText(txt,X+3*s,y-6.3*s,6.6*s); if(VD.dark>0.4) vdLight(X+3*s,y-3.6*s,6*s,0.6); }
function vdCone(g,x,y,s){ g.fillStyle='#f97316'; g.beginPath(); g.moveTo(x-s*0.8,y); g.lineTo(x,y-s*2.4); g.lineTo(x+s*0.8,y); g.fill(); g.fillStyle='#f8fafc'; g.fillRect(x-s*0.45,y-s*1.4,s*0.9,s*0.35); g.fillStyle='#1f2937'; g.fillRect(x-s,y-s*0.2,s*2,s*0.25); }
function vdCarFront(g,x,y,s,col,rear){ g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x-3*s,y-s*0.2,6*s,s*0.5); g.fillStyle=col; vdRR(g,x-2.8*s,y-3*s,5.6*s,2.4*s,s*0.6); g.fill(); g.beginPath(); g.moveTo(x-2*s,y-2.9*s); g.lineTo(x-1.5*s,y-4.4*s); g.lineTo(x+1.5*s,y-4.4*s); g.lineTo(x+2*s,y-2.9*s); g.fill();
  g.fillStyle=rear?'#334155':'#93c5fd'; g.fillRect(x-1.6*s,y-4.1*s,3.2*s,1.2*s); g.fillStyle=rear?'#ef4444':'#fef3c7'; g.fillRect(x-2.5*s,y-2.2*s,s,s*0.5); g.fillRect(x+1.5*s,y-2.2*s,s,s*0.5); if(VD.dark>0.4){ vdLight(x-2*s,y-2*s,s*2.5,0.8,rear?'255,40,40':'255,240,200'); vdLight(x+2*s,y-2*s,s*2.5,0.8,rear?'255,40,40':'255,240,200'); }
  g.fillStyle='#111827'; g.fillRect(x-2.6*s,y-0.7*s,1.2*s,0.9*s); g.fillRect(x+1.4*s,y-0.7*s,1.2*s,0.9*s); }
function vdDrawEvents(g){ const s=VD.sc, d=VD.d, W=VD.W;
  for(const e of vdEvents(d-VD.vx/s-60,d+(W-VD.vx)/s+60)){ const X=VD.vx+(e.w-d)*s, open=VD.done.has(e.id)&&!(VD.hold>0&&VD.holdMsg===VD_EVT[e.t].msg);
    if(e.t==='peche'){ for(let j=0;j<2;j++) vdSmallBoat(g,VD.vx+(e.w-d)*s+j*14*s,VD.wl-3*s+j*2*s,s*0.9,0,j+3,-1); continue; }
    if(e.t==='douane'){ const fl=c=>(COUNTRIES[c]&&COUNTRIES[c][2])||''; vdBooth(g,X+3*s,VD.gy,s,'DOUANE','#065f46'); g.font=`${Math.max(10,2.2*s)}px sans-serif`; g.textAlign='center'; g.fillText(fl(e.from),X-4*s,VD.gy-9*s); g.fillText(fl(e.to),X+12*s,VD.gy-9*s);
      g.fillStyle='#4b5563'; g.fillRect(X-4.2*s,VD.gy-8*s,s*0.3,8*s); g.fillRect(X+11.8*s,VD.gy-8*s,s*0.3,8*s); if(VD.mode!=='train'){ vdPerson(g,X+1.5*s,VD.oppY,2.1*s,'#065f46',0,'police',5); vdBarrier(g,X,s,open); } continue; }
    if(e.t==='halt'&&VD.paxV&&VD.mode==='truck'){ vdArret(g,X-6*s,VD.gy,s,e.name); }
    if(e.t==='feu') vdFeu(g,X,s,e,open);
    else if(e.t==='police'){ vdBooth(g,X+3*s,VD.gy,s,'POLICE','#1e3a8a'); vdPerson(g,X+1.5*s,VD.oppY,2.1*s,'#1e3a8a',0,'police',3); vdBarrier(g,X,s,open); }
    else if(e.t==='peage'){ g.fillStyle='#9ca3af'; g.fillRect(X-2*s,VD.rt-11*s,s*0.8,11*s+VD.roadH); g.fillRect(X+14*s,VD.gy-11*s,s*0.8,11*s); g.fillStyle='#15803d'; g.fillRect(X-4*s,VD.rt-13.5*s,20*s,2.6*s); g.fillStyle='#fff'; g.font=`bold ${Math.max(9,1.7*s)}px sans-serif`; g.textAlign='center'; g.fillText('PÉAGE',X+6*s,VD.rt-11.6*s);
      if(VD.dark>0.4){ vdLight(X+6*s,VD.rt-10.5*s,14*s,0.5,'235,255,240'); VD.beams.push([X+6*s,VD.rt-10.8*s,9*s,VD.rb]); } vdBooth(g,X+6*s,VD.gy,s,'CAISSE','#15803d'); vdBarrier(g,X,s,open); }
    else if(e.t==='works'){ for(let k=0;k<7;k++) vdCone(g,X-18*s+k*6*s,VD.oppY+s*0.6,s*0.8); vdPerson(g,X+6*s,VD.gy,2.1*s,'#f97316',VD.tt*3,'homme',4); g.fillStyle='#dc2626'; g.fillRect(X+6.4*s,VD.gy-4.4*s,s*1.4,s*0.9);
      g.fillStyle='#b45309'; g.beginPath(); g.ellipse(X+14*s,VD.gy,s*5,s*2.2,0,Math.PI,0); g.fill(); const tx=X-38*s, ty=VD.rb+s*0.8; g.fillStyle='#4b5563'; g.fillRect(tx-s*0.2,ty-6*s,s*0.4,6*s); g.fillStyle='#fff'; g.strokeStyle='#dc2626'; g.lineWidth=s*0.5; g.beginPath(); g.moveTo(tx,ty-10*s); g.lineTo(tx+2.6*s,ty-5.6*s); g.lineTo(tx-2.6*s,ty-5.6*s); g.closePath(); g.fill(); g.stroke(); g.fillStyle='#111827'; g.font=`bold ${Math.max(8,1.6*s)}px sans-serif`; g.textAlign='center'; g.fillText('⚒',tx,ty-6.3*s); }
    else if(e.t==='panne'){ g.save(); g.translate(X,VD.gy+s*0.4); g.rotate(-0.04); vdVeh(g,'loaded',0,0,s*0.9,5); g.restore(); g.fillStyle='#1f2937'; g.fillRect(X+9.5*s,VD.gy-s*0.4,s*2.4,s*0.6); g.fillStyle=VD_SKIN[0]; g.fillRect(X+11.6*s,VD.gy-s*0.4,s*0.5,s*0.5);
      for(const bx of [X-22*s,X+30*s]) vdBlobs(g,'#2f6b2a',[[bx,VD.oppY-s*0.6,s*1.2],[bx+s*1.4,VD.oppY-s*0.3,s],[bx-s*1.2,VD.oppY-s*0.2,s*0.9]]);
      g.fillStyle='#dc2626'; g.beginPath(); g.moveTo(X-12*s,VD.oppY); g.lineTo(X-11*s,VD.oppY-s*1.8); g.lineTo(X-10*s,VD.oppY); g.fill(); }
    else if(e.t==='cross'){ const pts=[]; for(let f=0.12;f<=1.61;f+=0.07) pts.push([VD.vx+(e.w-d)*s*f,vdRiverY(f),7*s*f+1]);
      g.fillStyle='#4b5055'; g.beginPath(); pts.forEach(([x,y,w],i)=>i?g.lineTo(x-w,y):g.moveTo(x-w,y)); pts.slice().reverse().forEach(([x,y,w])=>g.lineTo(x+w,y)); g.fill();
      g.strokeStyle='rgba(255,255,255,.7)'; g.lineWidth=1.5; g.setLineDash([6,8]); g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke(); g.setLineDash([]);
      { const xr=VD.vx+(e.w-d)*s, w1=7*s+2; vdRails(g,xr-w1-s*2,xr+w1+s*2); }
      const near=VD.d+(VD.mode==='train'?19:9.5)>e.w-120&&VD.d-60<e.w, blink=Math.floor(performance.now()/450)%2;
      for(const f of [0.82,1.3]){ const x=VD.vx+(e.w-d)*s*f, y=vdRiverY(f), w=7*s*f; g.fillStyle='#374151'; g.fillRect(x+w+s*0.5,y-7*s*f,s*0.5*f,7*s*f); g.fillStyle='#f8fafc'; g.beginPath(); g.moveTo(x+w,y-6.6*s*f); g.lineTo(x+w+3*s*f,y-6.6*s*f); g.lineTo(x+w+1.5*s*f,y-5.6*s*f); g.fill();
        for(const j of [0,1]){ const on=near&&blink===j; g.fillStyle=on?'#ff3b30':'#4b1111'; g.beginPath(); g.arc(x+w+s*0.75*f+(j?1.2:-1.2)*s*f,y-5*s*f,s*0.55*f,0,7); g.fill(); if(on) vdLight(x+w+s*0.75*f+(j?1.2:-1.2)*s*f,y-5*s*f,s*4*f,0.8,'255,40,40'); }
        if(near){ g.lineWidth=s*0.5*f; g.strokeStyle='#f8fafc'; g.beginPath(); g.moveTo(x-w,y-2.6*s*f); g.lineTo(x+w,y-2.6*s*f); g.stroke(); g.strokeStyle='#dc2626'; g.setLineDash([s*f,s*f]); g.stroke(); g.setLineDash([]); } }
      if(near){ vdCarFront(g,VD.vx+(e.w-d)*s*1.45,vdRiverY(1.45),s*1.1,'#facc15',false); vdCarFront(g,VD.vx+(e.w-d)*s*0.7,vdRiverY(0.7),s*0.6,'#2563eb',true); } } } }
/* ---------- ambiance sonore (synthétisée, aucun fichier) ---------- */
const VA={ctx:null};
function vaPref(){ try{ return localStorage.getItem('se-vd-snd')!=='0'; }catch(e){ return true; } }
function vaStart(){ if(VA.ctx||!vaPref()) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; try{
  const c=new AC(), m=c.createGain(); VA.ctx=c; m.gain.value=0.55; m.connect(c.destination); VA.m=m;
  const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=380; const eg=c.createGain(); eg.gain.value=0; f.connect(eg); eg.connect(m);
  const o1=c.createOscillator(), o2=c.createOscillator(), g2=c.createGain(); o1.type='sawtooth'; o2.type='square'; o1.frequency.value=48; o2.frequency.value=24; g2.gain.value=0.35; o1.connect(f); o2.connect(g2); g2.connect(f); o1.start(); o2.start(); VA.eng={o1,o2,eg,f};
  const n=c.createBuffer(1,c.sampleRate*2,c.sampleRate), dd=n.getChannelData(0); for(let i=0;i<dd.length;i++) dd[i]=Math.random()*2-1; VA.noise=n;
  const mk=(type,fr,q)=>{ const src=c.createBufferSource(); src.buffer=n; src.loop=true; const bq=c.createBiquadFilter(); bq.type=type; bq.frequency.value=fr; if(q) bq.Q.value=q; const gg=c.createGain(); gg.gain.value=0; src.connect(bq); bq.connect(gg); gg.connect(m); src.start(); return gg; };
  VA.rain=mk('bandpass',2600,0.5); VA.road=mk('lowpass',420); VA.next=0; }catch(e){ VA.ctx=null; } }
function vaStop(){ try{ VA.ctx&&VA.ctx.close(); }catch(e){} VA.ctx=null; }
function vaTick(){ const c=VA.ctx; if(!c) return; try{ if(c.state==='suspended') c.resume().catch(()=>{}); const t=c.currentTime, v=VD.vf||0, tr=VD.mode==='train', mute=VD.sp>=50?0.5:1;
  const bt=VD.mode==='boat', rpm=bt?28+v*10:tr?34+v*16:40+v*40*(0.75+0.25*Math.sin(VD.d/35)); VA.eng.o1.frequency.setTargetAtTime(rpm,t,0.15); VA.eng.o2.frequency.setTargetAtTime(rpm/2,t,0.15); VA.eng.eg.gain.setTargetAtTime((0.09+v*0.06)*mute,t,0.2); VA.eng.f.frequency.setTargetAtTime(240+v*340,t,0.2);
  VA.rain.gain.setTargetAtTime(VD.rain*0.25,t,0.5); VA.road.gain.setTargetAtTime((bt?0.18:v*(VD.surf==='dirt'?0.3:0.12))*mute,t,0.3);
  if(tr&&v>0.05&&VD.sp<=10){ const j=Math.floor(VD.d/15); if(j!==VA.lastJ){ VA.lastJ=j; vaClick(t,0.22); vaClick(t+0.11,0.16); } }
  if(t>VA.next){ VA.next=t+2+Math.random()*4; if(VD.dark<0.4&&!VD.rain) vaBird(t); else if(VD.dark>0.6&&!VD.rain) vaCricket(t); } }catch(e){} }
function vaClick(t,a){ const c=VA.ctx, src=c.createBufferSource(); src.buffer=VA.noise; const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1600; const g=c.createGain(); g.gain.setValueAtTime(a,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.06); src.connect(f); f.connect(g); g.connect(VA.m); src.start(t,Math.random(),0.08); }
function vaBird(t){ const c=VA.ctx, n=2+Math.floor(Math.random()*3), f0=2200+Math.random()*1800; for(let k=0;k<n;k++){ const o=c.createOscillator(), g=c.createGain(), t0=t+k*0.15; o.frequency.setValueAtTime(f0,t0); o.frequency.exponentialRampToValueAtTime(f0*1.45,t0+0.08); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(0.045,t0+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+0.11); o.connect(g); g.connect(VA.m); o.start(t0); o.stop(t0+0.13); } }
function vaCricket(t){ const c=VA.ctx; for(let k=0;k<6;k++){ const o=c.createOscillator(), g=c.createGain(), t0=t+k*0.07; o.frequency.value=4300; g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(0.018,t0+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t0+0.05); o.connect(g); g.connect(VA.m); o.start(t0); o.stop(t0+0.06); } }
function vaBrake(){ const c=VA.ctx; if(!c) return; try{ const src=c.createBufferSource(); src.buffer=VA.noise; const f=c.createBiquadFilter(); f.type='highpass'; f.frequency.value=3200; const g=c.createGain(), t0=c.currentTime; g.gain.setValueAtTime(0.13,t0); g.gain.exponentialRampToValueAtTime(0.001,t0+0.55); src.connect(f); f.connect(g); g.connect(VA.m); src.start(t0,0,0.6); }catch(e){} }
function vaThunder(){ const c=VA.ctx; if(!c) return; try{ const t=c.currentTime+0.25+Math.random()*0.6, src=c.createBufferSource(); src.buffer=VA.noise; src.loop=true; const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=140; const g=c.createGain();
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.45,t+0.08); g.gain.exponentialRampToValueAtTime(0.12,t+0.6); g.gain.exponentialRampToValueAtTime(0.0001,t+2.6); src.connect(f); f.connect(g); g.connect(VA.m); src.start(t); src.stop(t+2.7); }catch(e){} }
function vdHorn(){ VD.honkR=performance.now(); const c=VA.ctx; if(!c) return; try{ const t=c.currentTime, tr=VD.mode==='train', F=tr?[277,349,415]:[330,415], dur=tr?1.1:0.45, f=c.createBiquadFilter(), g=c.createGain(); f.type='lowpass'; f.frequency.value=tr?1400:2300;
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.16,t+0.03); g.gain.setValueAtTime(0.16,t+dur-0.08); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); f.connect(g); g.connect(VA.m);
  for(const fr of F){ const o=c.createOscillator(); o.type=tr?'sawtooth':'square'; o.frequency.value=fr; o.connect(f); o.start(t); o.stop(t+dur+0.02); } }catch(e){} }
/* ---------- photo souvenir ---------- */
function vdPhoto(){ const cv=VD.cv; if(!cv) return; const o=document.createElement('canvas'); o.width=cv.width; o.height=cv.height; const g=o.getContext('2d'), k=cv.width/VD.W; g.drawImage(cv,0,0);
  g.fillStyle='rgba(15,23,42,.78)'; g.fillRect(0,o.height-36*k,o.width,36*k); g.fillStyle='#fbbf24'; g.font=`bold ${13*k}px sans-serif`; g.textAlign='left';
  g.fillText(`${S.company.logo||'✈️'} ${S.company.name} · ${VD.stops[0].name} → ${VD.stops[VD.stops.length-1].name} · km ${Math.round(VD.d/1000)} · Sky Empire`,10*k,o.height-13*k,o.width-20*k);
  o.toBlob(b=>{ if(!b) return; let f=null; try{ f=new File([b],'sky-empire-voyage.png',{type:'image/png'}); }catch(e){}
    if(f&&navigator.canShare&&navigator.canShare({files:[f]})) navigator.share({files:[f],title:'Sky Empire'}).catch(()=>{});
    else { const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='sky-empire-voyage.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000); }
    toast('📸 Photo du voyage prête à partager','ok'); },'image/png'); }

/* ---------- image ---------- */
function vdDraw(){
  const g=VD.ctx, W=VD.W, H=VD.H; if(!g) return; const s=VD.sc;
  vdAmbience(); vdRegionTick(VD.dtLast||0.016); VD.fk=vdForestK(VD.d);
  const boat=VD.mode==='boat'; if(boat){ const nearSt=VD.stops.some(st=>Math.abs(st.d-VD.d)<3200); VD.showBank=VD.path.kind==='river'||nearSt; VD.oceanOnly=VD.path.kind==='sea'&&!VD.stops.some(st=>Math.abs(st.d-VD.d)<8000); VD.waterTop=VD.showBank?VD.gy+s*0.4:VD.hz+(VD.gy-VD.hz)*0.08; } else { VD.oceanOnly=false; } VD.blur=VD.sp*(VD.vf==null?1:VD.vf)>=45; VD.glow.length=0; VD.win.length=0; VD.beams.length=0; VD.hl=null;
  VD.riv=boat?[]:vdRivers(VD.d-VD.vx/s/0.1-200,VD.d+(W-VD.vx)/s/0.1+200);
  g.globalCompositeOperation='source-over';
  { const dt=VD.dtLast||0.016, camT=(VD.hold>0||((VD.vf||0)<0.35&&VD.sp<=10))?1.22:1; VD.camZ=(VD.camZ||1)+(camT-(VD.camZ||1))*Math.min(1,dt*1.3); }
  const cz=VD.camZ, ccx=boat?VD.vx+(VD.front||40)*s*0.35:VD.vx, ccy=(boat?VD.wl:VD.laneY)-4*s, shk=VD.mode==='truck'&&VD.surf==='dirt'?Math.sin(VD.tt*23)*s*0.14*(VD.vf||0):0;
  g.save(); if(cz>1.001||shk){ g.translate(ccx,ccy+shk); g.scale(cz,cz); g.translate(-ccx,-ccy); }
  vdSky(g,W,H);
  vdBack(g,W,H);
  for(const bx of VD.riv) vdRiver(g,bx);
  // plan moyen : villages et arbres au loin, puis voile de brume
  const yM=VD.hz+(VD.gy-VD.hz)*0.5, kM=0.5; if(!boat||VD.showBank){ vdGroundTex(g,VD.hz+(VD.gy-VD.hz)*0.42,VD.gy); vdDrawObjs(g,vdGen({f:0.5,k:kM,T:8,seed:991}),s*kM,yM,false); }
  { const hg=g.createLinearGradient(0,yM-30*s*kM,0,yM); hg.addColorStop(0,'rgba(0,0,0,0)'); const hc=vdHex(vdPre(VD.skyH)); hg.addColorStop(1,`rgba(${hc.join(',')},0.14)`); g.fillStyle=hg; g.fillRect(0,yM-30*s*kM,W,30*s*kM); }
  if(!boat||VD.showBank){ const yM2=yM+(VD.gy-yM)*0.55, kM2=0.74; vdDrawObjs(g,vdGen({f:0.74,k:kM2,T:12,seed:577}),s*kM2,yM2,false);
    const hg2=g.createLinearGradient(0,yM2-26*s*kM2,0,yM2); hg2.addColorStop(0,'rgba(0,0,0,0)'); const hc2=vdHex(vdPre(VD.skyH)); hg2.addColorStop(1,`rgba(${hc2.join(',')},0.07)`); g.fillStyle=hg2; g.fillRect(0,yM2-26*s*kM2,W,26*s*kM2); }
  if(VD.h>4.8&&VD.h<8.6&&!VD.rain&&(!boat||VD.showBank)){ const a=Math.max(0,1-Math.abs(VD.h-6.6)/2)*0.55; if(a>0.02){ for(const [fy,sp] of [[0.25,0.4],[0.62,0.7]]){ const y=VD.hz+(VD.gy-VD.hz)*fy+(VD.gy-VD.hz)*0.25;
      const fg=g.createLinearGradient(0,y-14*s,0,y+4*s); fg.addColorStop(0,'rgba(255,252,245,0)'); fg.addColorStop(0.6,`rgba(255,252,245,${a})`); fg.addColorStop(1,'rgba(255,252,245,0)'); g.fillStyle=fg; g.fillRect(0,y-14*s,W,18*s);
      g.fillStyle=`rgba(255,252,245,${a*0.5})`; g.beginPath(); for(let k=0;k<6;k++){ const x=((vdRnd(k,121)*W*1.5-VD.d*s*sp*0.05-VD.tt*3)%(W*1.5)+W*1.5)%(W*1.5)-W*0.25, w=(20+vdRnd(k,122)*30)*s; g.moveTo(x+w,y-4*s); g.ellipse(x,y-4*s,w,3*s,0,0,7); } g.fill(); } } }
  const town=vdZone(VD.d).t==='town'?vdZone(VD.d).st:null;
  if(!boat||VD.showBank) vdDrawObjs(g,vdGen({f:1,k:1,T:16,seed:0,near:true}),s,VD.gy,true);
  if(boat){ vdWater(g); vdBoatTraffic(g); vdDrawEvents(g); g.save(); g.shadowColor='rgba(0,0,0,.3)'; g.shadowBlur=Math.max(4,s); g.shadowOffsetY=s*0.3; vdConvoy(g,VD.vx,VD.wl,s); g.restore(); }
  else { vdRoad(g);
  vdBridges(g,VD.riv);
  vdDrawEvents(g);
  vdTraffic(g);
  g.save(); g.shadowColor='rgba(0,0,0,.35)'; g.shadowBlur=Math.max(4,s); g.shadowOffsetY=s*0.3;
  if(VD.mode==='train') vdTrain(g,VD.vx,VD.laneY+s*0.3,s); else if(VD.paxV) vdBus(g,VD.vx-(VD.vk==='minibus'?11:17)*s*0.5,VD.laneY,s,VD.vk==='minibus'); else if(VD.vk==='van'||VD.vk==='rigid') vdRigid(g,VD.vx-(VD.vk==='van'?10:13.5)*s*0.5,VD.laneY,s,VD.vk==='van'); else if(VD.vk==='tank') vdOwnTanker(g,VD.vx-16*s*0.5,VD.laneY,s); else vdTruck(g,VD.vx-17*s*0.5,VD.laneY,s);
  g.restore(); }
  for(const p of VD.smoke){ g.fillStyle=`rgba(${p.c||'120,120,120'},${p.a})`; g.beginPath(); g.arc(p.x,p.y,p.r,0,7); g.fill(); }
  if(boat) vdFrontWater(g); else vdFront(g,W,H,VD.rb+s*1.2);
  // filtre de lumière (aube, soleil, nuit, pluie)
  if(VD.T!=='#ffffff'){ g.globalCompositeOperation='multiply'; g.fillStyle=VD.T; g.fillRect(0,0,W,H); g.globalCompositeOperation='source-over'; }
  // la nuit : étoiles, lune, fenêtres, lampadaires, phares
  if(VD.dark>0.05){ const a0=VD.dark*(1-VD.rain); g.fillStyle='#ffffff'; const top=VD.mtTop||VD.hz*0.7;
    for(let k=0;k<(vdMob()?80:130);k++){ const x=vdRnd(k,1)*W, y=vdRnd(k,2)*top*0.95; g.globalAlpha=a0*(0.25+0.7*vdRnd(k,3))*(0.6+0.4*Math.sin(VD.tt*1.5+k*1.7)); const r=vdRnd(k,4)<0.08?2.2:1.3; g.fillRect(x,y,r,r); }
    g.globalAlpha=1; const hm=(VD.h+24-19)%24, ma=hm/10.5; if(a0>0.2&&ma<=1){ const mx=W*(0.15+0.7*ma), my=top-Math.sin(ma*Math.PI)*top*0.7, R=Math.min(W,H)*0.035; const mg=g.createRadialGradient(mx,my,R*0.6,mx,my,R*4.5); mg.addColorStop(0,`rgba(220,230,255,${0.35*a0})`); mg.addColorStop(1,'rgba(220,230,255,0)'); g.fillStyle=mg; g.fillRect(mx-R*4.5,my-R*4.5,R*9,R*9);
      g.globalAlpha=a0; g.fillStyle='#eef2ff'; g.beginPath(); g.arc(mx,my,R,0,7); g.fill(); vdBlobs(g,'#c7cede',[[mx-R*0.3,my-R*0.2,R*0.22],[mx+R*0.25,my+R*0.15,R*0.18],[mx+R*0.1,my-R*0.45,R*0.12],[mx-R*0.2,my+R*0.4,R*0.14]]); g.globalAlpha=1; }
    const wa=Math.min(1,(VD.dark-0.3)*2); if(wa>0){ g.globalAlpha=wa; g.fillStyle='#ffd27a'; for(const [x,y,w,h] of VD.win) g.fillRect(x,y,w,h); g.globalAlpha=1; } }
  g.globalCompositeOperation='lighter';
  for(const [x,y,r,a,c] of VD.glow){ const ea=a*(c==='255,150,60'?1:Math.min(1,VD.dark*1.3)); if(ea<0.03) continue; const rg=g.createRadialGradient(x,y,0,x,y,r); rg.addColorStop(0,`rgba(${c},${ea})`); rg.addColorStop(1,`rgba(${c},0)`); g.fillStyle=rg; g.fillRect(x-r,y-r,r*2,r*2); }
  if(VD.dark>0.4){ for(const [x,y,w,y2] of VD.beams){ if(y2){ const lg=g.createLinearGradient(0,y,0,y2); lg.addColorStop(0,'rgba(255,230,170,.28)'); lg.addColorStop(1,'rgba(255,230,170,0.04)'); g.fillStyle=lg; g.beginPath(); g.moveTo(x-w*0.15,y); g.lineTo(x+w*0.15,y); g.lineTo(x+w,y2); g.lineTo(x-w,y2); g.fill(); }
      else { const lg=g.createLinearGradient(x,y,x+w,y); lg.addColorStop(0,'rgba(255,240,200,.35)'); lg.addColorStop(1,'rgba(255,240,200,0)'); g.fillStyle=lg; g.beginPath(); g.moveTo(x,y-s*0.3); g.lineTo(x+w,y-s*2.5); g.lineTo(x+w,y+s*2.5); g.fill(); } }
    if(VD.hl){ const [bx,by]=VD.hl, L2=34*s, lg=g.createLinearGradient(bx,by,bx+L2,by); lg.addColorStop(0,'rgba(255,244,210,.55)'); lg.addColorStop(1,'rgba(255,244,210,0)'); g.fillStyle=lg; g.beginPath(); g.moveTo(bx,by-s*0.4); g.lineTo(bx+L2,by-s*5); g.lineTo(bx+L2,by+s*4); g.fill(); }
    if(VD.fk>0.4) for(let k=0;k<18;k++){ const x=(vdRnd(k,71)*W+Math.sin(VD.tt*0.7+k)*30-VD.d*s*0.3%W+W*2)%W, y=VD.hz+(VD.gy-VD.hz)*(0.3+vdRnd(k,72)*0.7)+Math.cos(VD.tt+k)*10, a=0.5+0.5*Math.sin(VD.tt*3+k*2); g.fillStyle=`rgba(200,255,120,${a*0.8})`; g.fillRect(x,y,2,2); } }
  g.globalCompositeOperation='source-over';
  g.restore();
  // orage : éclairs et tonnerre sous les grosses pluies
  if(VD.rain>0.7){ const now=performance.now(); if(!VD.nextFlash) VD.nextFlash=now+3000; if(now>VD.nextFlash){ VD.nextFlash=now+5000+Math.random()*9000; VD.flash=1; VD.boltX=W*(0.15+Math.random()*0.7); VD.boltSeed=Math.floor(Math.random()*1e4); vaThunder(); } }
  if(VD.flash>0){ const f=VD.flash; g.fillStyle=`rgba(230,235,255,${0.35*f})`; g.fillRect(0,0,W,H); g.strokeStyle=`rgba(255,255,255,${f})`; g.lineWidth=2.5; g.shadowColor='#c7d2fe'; g.shadowBlur=12; g.beginPath(); let x=VD.boltX, y=0; g.moveTo(x,y);
    for(let k=0;k<9;k++){ x+=(vdRnd(VD.boltSeed,k)-0.5)*W*0.08; y+=VD.hz*0.95/9; g.lineTo(x,y); } g.stroke(); g.shadowBlur=0; VD.flash-=(VD.dtLast||0.016)*2.2; }
  // pluie tropicale
  if(VD.rain>0.05){ g.fillStyle=`rgba(40,50,70,${0.18*VD.rain})`; g.fillRect(0,0,W,H); g.strokeStyle=`rgba(220,228,240,${0.7*VD.rain})`; g.lineWidth=1.3; g.beginPath(); const n=Math.round(220*VD.rain);
    for(let k=0;k<n;k++){ const x=((vdRnd(k,81)*W*1.3-VD.tt*60*(0.8+vdRnd(k,84)*0.4))%(W*1.3)+W*1.3)%(W*1.3), y=((vdRnd(k,82)*H+VD.tt*700*(0.8+vdRnd(k,83)*0.4))%H); g.moveTo(x,y); g.lineTo(x-6,y+22); }
    g.stroke(); if(VD.mode!=='boat'){ g.strokeStyle=`rgba(230,235,245,${0.5*VD.rain})`; g.beginPath(); for(let k=0;k<40;k++){ const x=vdRnd(k,85)*W, y=VD.rt+(VD.rb-VD.rt)*vdRnd(k,86), p=(VD.tt*3+vdRnd(k,87))%1; g.moveTo(x-p*6,y); g.ellipse(x,y,p*6,p*1.8,0,0,7); } g.stroke(); } }
  if(VD.sun&&VD.gold>0.15&&!VD.rain){ const {x,y}=VD.sun; g.globalCompositeOperation='lighter'; for(let k=0;k<7;k++){ const a=Math.PI*0.25+k*Math.PI*0.08+Math.sin(VD.tt*0.1+k)*0.02, L=Math.max(W,H)*1.1; const gr=g.createLinearGradient(x,y,x+Math.cos(a)*L,y+Math.sin(a)*L); gr.addColorStop(0,`rgba(255,200,120,${0.07*VD.gold})`); gr.addColorStop(0.45,`rgba(255,200,120,${0.025*VD.gold})`); gr.addColorStop(1,'rgba(255,200,120,0)'); g.fillStyle=gr;
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a-0.03)*L,y+Math.sin(a-0.03)*L); g.lineTo(x+Math.cos(a+0.03)*L,y+Math.sin(a+0.03)*L); g.fill(); } g.globalCompositeOperation='source-over'; }
  if(VD.dark>0.4&&VD.hl&&VD.mode!=='boat'){ g.globalCompositeOperation='lighter'; const [hx]=VD.hl, ly=VD.laneY, rg=g.createRadialGradient(hx+16*s,ly,0,hx+16*s,ly,16*s); rg.addColorStop(0,'rgba(255,236,190,.22)'); rg.addColorStop(1,'rgba(255,236,190,0)'); g.fillStyle=rg; g.save(); g.translate(0,ly); g.scale(1,0.25); g.translate(0,-ly); g.fillRect(hx,ly-16*s,32*s,32*s); g.restore(); g.globalCompositeOperation='source-over'; }
  if(VD.sp*(VD.vf||0)>=40){ g.strokeStyle='rgba(255,255,255,.18)'; g.lineWidth=1.5; g.beginPath(); for(let k=0;k<14;k++){ const y=VD.rb+(H-VD.rb)*vdRnd(k,91), x=((vdRnd(k,92)*W*2-VD.tt*900)%(W*2)+W*2)%(W*2)-W*0.5, L=40+vdRnd(k,93)*80; g.moveTo(x,y); g.lineTo(x+L,y); } g.stroke(); }
  // vignette
  if(VD.vig){ g.fillStyle=VD.vig; g.fillRect(0,0,W,H); }
  return town;
}

/* ---------- bandeau ---------- */
function vdHud(town){ const el=document.getElementById('vdHud'); if(!el) return; const A=VD.stops[0], B=VD.stops[VD.stops.length-1], km=Math.round(VD.d/1000), tot=Math.round(VD.len/1000), h=vdHour();
  const marks=VD.stops.map(st=>`<i style="left:${st.d/VD.len*100}%" title="${esc(st.name)}"></i>`).join('');
  let cc='CD'; for(const st of VD.stops){ if(st.d<=VD.d+1) cc=st.cc; } { const nx=VD.stops.find(st=>st.d>VD.d); const pv=[...VD.stops].reverse().find(st=>st.d<=VD.d); if(nx&&pv&&nx.cc!==pv.cc&&VD.d>(pv.d+nx.d)/2) cc=nx.cc; }
  const flag=(COUNTRIES[cc]&&COUNTRIES[cc][2])||'';
  const amb=[VD.msg||'', VD.stops.some(st=>st.cc!=='CD')?flag+' '+((COUNTRIES[cc]&&COUNTRIES[cc][0])||''):'', VD.rainbow?'🌈 arc-en-ciel':'', VD.rain>0.3?'🌧️ pluie':'', VD.dust>0.3?'🌫️ harmattan (vent de sable)':'', VD.mode==='truck'?(VD_ROADNAME[VD.surf]||''):VD.mode==='boat'?({river:'🌊 sur le fleuve',lake:'🏞️ sur le lac',sea:'🌊 en mer'}[VD.path.kind]||''):'', VD.R&&!VD.oceanOnly?VD.R.n:'', town?'📍 '+esc(town.name):(vdZone(VD.d).t==='village'?'🏘️ village':'')].filter(Boolean).join(' · ');
  el.querySelector('.vdTop').innerHTML=`<b>${VD.mode==='train'?'🚆':VD.mode==='boat'?'🚢':'🚚'} ${esc(A.name)} → ${esc(B.name)}</b><span>${km} / ${tot} km · 🕒 ${String(Math.floor(h)).padStart(2,'0')}:${String(Math.floor(h%1*60)).padStart(2,'0')}</span><span class="vdAmb">${amb}</span>`;
  el.querySelector('.vdBar').innerHTML=`<div style="width:${VD.d/VD.len*100}%"></div>${marks}`;
  el.querySelectorAll('[data-k]').forEach(b=>b.classList.toggle('on',+b.dataset.k===VD.sp)); const sb=el.querySelector('[data-act="vdSnd"]'); if(sb) sb.textContent=vaPref()?'🔊':'🔇'; const zb=el.querySelector('[data-act="vdZoom"]'); if(zb) zb.classList.toggle('on',VD.zoom>1); }
/* ---------- boucle ---------- */
function vdLoop(t){
  if(!VD.on) return; const dt=Math.min(0.1,(t-(VD.last||t))/1000); VD.last=t;
  VD.dtLast=dt; const base=VD.mode==='train'?13:VD.mode==='boat'?12:18, vf=vdControl(dt); VD.d=Math.min(VD.len,VD.d+Math.min(base*VD.sp*dt*vf,Math.max(0,VD.maxStep==null?1e9:VD.maxStep))); VD.od=(VD.od||0)+base*VD.sp*dt; VD.tt+=dt*Math.min(VD.sp,10); VD.maxStep=null; vaTick();
  const s=VD.sc, rel=base*Math.min(VD.sp,10)*s*(VD.vf||0);
  for(const p of VD.smoke){ p.x-=(p.dust?rel*0.25:rel*0.6+12)*dt; p.y-=(p.dust?4:14)*dt; p.r+=(p.dust?s*1.5:9)*dt; p.a-=(p.dust?0.45:0.35)*dt; } VD.smoke=VD.smoke.filter(p=>p.a>0).slice(-60);
  const town=vdDraw(); if(t-(VD.hudT||0)>250){ VD.hudT=t; vdHud(town); }
  if(VD.d>=VD.len){ vdArrive(); return; }
  VD.raf=requestAnimationFrame(vdLoop);
}
function vdResize(){ const cv=VD.cv; if(!cv) return; const dpr=Math.min(2,window.devicePixelRatio||1); VD.W=cv.clientWidth; VD.H=cv.clientHeight; cv.width=VD.W*dpr; cv.height=VD.H*dpr; VD.ctx=cv.getContext('2d'); VD.ctx.setTransform(dpr,0,0,dpr,0,0);
  const W=VD.W, H=VD.H, P=H>W; VD.sc=(P?Math.max(3.4,W/60):Math.max(3.2,Math.min(W/95,H/58)))*(VD.zoom||1); const s=VD.sc;
  VD.roadH=(VD.mode==='train'?7:12)*s; VD.rb=H*(P?0.8:0.87); VD.rt=VD.rb-VD.roadH; VD.gy=VD.rt-1.6*s; VD.hz=VD.gy-(P?H*0.27:H*0.24); VD.vx=W*(VD.mode==='train'?0.62:0.34);
  if(VD.mode==='boat'){ VD.roadH=0; VD.gy=H*(P?0.6:0.55); VD.rt=VD.rb=VD.gy+1.6*s; VD.hz=VD.gy-(P?H*0.2:H*0.2); VD.wl=H*(P?0.8:0.86); VD.vx=W*(P?0.04:0.12); }
  const vg=VD.ctx.createRadialGradient(W/2,H*0.55,Math.min(W,H)*0.45,W/2,H*0.55,Math.max(W,H)*0.85); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.32)'); VD.vig=vg; }
const V0s=()=>{ const v=VD.line&&trVeh(VD.mode,VD.vk); return v&&v.seats?Math.round(v.seats*0.85):0; };
function vdArrive(){ const B=VD.stops[VD.stops.length-1], L=VD.line, info=VD.cargo;
  const el=document.getElementById('vdHud'); if(el) el.querySelector('.vdEnd').innerHTML=`<div class="vdDone">🏁 <b>Arrivée à ${esc(B.name)} !</b><br>${VD.paxV&&V0s()?`🧍 ${num(V0s())} voyageurs à bon port.`:info?`📦 ${num(info.tons)} t de ${esc(info.cargo)} livrées.`:''}${L&&L.last?`<br>Cette ligne a rapporté ${fmtMoney(L.last.rev-L.last.cost)} la semaine dernière.`:''}<div class="btns"><button class="btn gold" data-act="vdAgain">🔁 Refaire le voyage</button><button class="btn" data-act="vdClose">Fermer</button></div></div>`; }
function vdStart(mode,lineId,vk){
  const X=S.tr&&S.tr[mode], line=X&&X.lines.find(l=>String(l.id)===String(lineId)); if(!line) return err('Ligne introuvable'); const path=vdBuild(mode,line); if(!path) return err('Route introuvable');
  closeModal(); if(typeof close3D==='function'&&!$('#globe').hidden) try{ close3D(); }catch(e){}
  const vsl=X.fleet.filter(v=>String(v.line)===String(line.id)), veh=(vk&&vsl.find(v=>v.k===vk))||vsl[0], V0=veh&&trVeh(mode,veh.k), hsh=veh&&typeof tkHash==='function'?tkHash(veh.id):7;
  let zoom=1; try{ zoom=+(localStorage.getItem('se-vd-zoom')||1)||1; }catch(e){}
  Object.assign(VD,{on:true,mode,line,path,len:path.len,stops:path.stops,d:0,tt:0,done:new Set(),hold:0,vf:0,od:0,msg:'',zoom,honkR:0,sp:VD.sp||10,last:0,smoke:[],cars:mode==='train'?(vdMob()?6:9):0,h0:((S.time/3600e3)%24+24)%24,
    dirtP:path.kind==='piste'?0.75:path.kind==='paved'?0.04:(path.len>800e3?0.6:0.2), vk:veh?veh.k:(mode==='boat'?'push':''), paxV:!!(veh&&trVeh(mode,veh.k)&&trVeh(mode,veh.k).seats), rg:null, front:null,
    seedL:(()=>{ let h=7; for(const ch of String(line.id)+line.a+line.b) h=(h*31+ch.charCodeAt(0))|0; return Math.abs(h)%997; })(),
    cargo:V0?{tons:Math.round(V0.cap*(mode==='train'?0.85:0.75)),cargo:typeof TK_GOODS!=='undefined'?TK_GOODS[hsh%TK_GOODS.length]:'marchandises'}:null});
  let ov=document.getElementById('vdOv'); if(ov) ov.remove(); ov=document.createElement('div'); ov.id='vdOv';
  ov.innerHTML=`<canvas id="vdCv"></canvas><div id="vdHud"><div class="vdTop"></div><div class="vdBar"></div><div class="vdBtns">${[1,10,50,200].map(x=>`<button class="chip" data-act="vdSp" data-k="${x}">×${x}</button>`).join('')}<button class="chip" data-act="vdZoom" title="Zoom">🔍</button><button class="chip" data-act="vdPhoto" title="Photo">📸</button><button class="chip" data-act="vdSnd" title="Son">🔊</button><button class="chip" data-act="vdClose">✖</button></div><div class="vdEnd"></div><div class="vdTip">👆 Touchez l’écran pour klaxonner</div></div>`;
  document.body.appendChild(ov); document.body.classList.add('voyage2d'); VD.cv=ov.querySelector('canvas'); vdResize(); window.addEventListener('resize',vdResize);
  VD.cv.addEventListener('pointerdown',()=>{ vaStart(); vdHorn(); const tp=ov.querySelector('.vdTip'); if(tp) tp.remove(); }); vaStart();
  cancelAnimationFrame(VD.raf); VD.raf=requestAnimationFrame(vdLoop);
}
function vdClose(){ vaStop(); VD.on=false; cancelAnimationFrame(VD.raf); window.removeEventListener('resize',vdResize); const ov=document.getElementById('vdOv'); if(ov) ov.remove(); document.body.classList.remove('voyage2d'); }
function registerVoyage2dActions(){
  Object.assign(ACTIONS,{
    vyGo:d=>vdStart(d.m,d.id,d.k),   // le voyage est maintenant illustré (2D)
    vdSp:d=>{ VD.sp=+d.k; },
    vdClose:()=>vdClose(),
    vdZoom:()=>{ VD.zoom=VD.zoom>1?1:1.4; try{ localStorage.setItem('se-vd-zoom',VD.zoom); }catch(e){} vdResize(); },
    vdPhoto:()=>vdPhoto(),
    vdSnd:()=>{ const on=!vaPref(); try{ localStorage.setItem('se-vd-snd',on?'1':'0'); }catch(e){} if(on) vaStart(); else vaStop(); },
    vdAgain:()=>{ const m=VD.mode, id=VD.line&&VD.line.id; vdClose(); if(id) vdStart(m,id); },
  });
}
