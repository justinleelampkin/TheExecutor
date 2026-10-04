// Sprite extraction helpers (run in the game page via script injection; see memory notes).
// Labels connected islands over a whole sheet, splits fused poses at the quietest opaque
// column, attaches small detached bits (fists/sparks) to the nearest pose, saves via /save.
window.loadImg2=(src)=>new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=()=>rej(new Error(src));img.src=src+'?t='+Date.now();});
window.getImgData2=async(path)=>{const img=await window.loadImg2(path);const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {imgData:ctx.getImageData(0,0,img.width,img.height),w:img.width,h:img.height};};
window.globalLabel2=(d,thresh=20)=>{const {imgData,w,h}=d;const lbl=new Int32Array(w*h);let cur=0;const st=[];const info=[null];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const idx=y*w+x;if(imgData.data[idx*4+3]>thresh&&!lbl[idx]){cur++;st.length=0;st.push(idx);lbl[idx]=cur;let a=0,minX=x,maxX=x,minY=y,maxY=y;
  while(st.length){const ci=st.pop();const cy=(ci/w)|0,cx=ci%w;a++;if(cx<minX)minX=cx;if(cx>maxX)maxX=cx;if(cy<minY)minY=cy;if(cy>maxY)maxY=cy;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=cx+dx,ny=cy+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h){const ni=ny*w+nx;if(imgData.data[ni*4+3]>thresh&&!lbl[ni]){lbl[ni]=cur;st.push(ni);}}}}
  info.push({a,minX,maxX,minY,maxY});}}
 return {lbl,info};};
window.rectDist2=(a,b)=>{const dx=Math.max(0,a.minX-b.maxX,b.minX-a.maxX),dy=Math.max(0,a.minY-b.maxY,b.minY-a.maxY);return Math.hypot(dx,dy);};
window.planPoses2=(d,n,rows=1,thresh=20)=>{
 const {imgData,w,h}=d;const cols=n/rows,cw=w/cols,rh=h/rows;const {lbl,info}=window.globalLabel2(d,thresh);
 const cells=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)cells.push({r,c,x0:Math.round(c*cw),x1:Math.round((c+1)*cw),y0:Math.round(r*rh),y1:Math.round((r+1)*rh)});
 for(const cell of cells){const cnt={};for(let y=cell.y0;y<cell.y1;y++)for(let x=cell.x0;x<cell.x1;x++){const l=lbl[y*w+x];if(l&&info[l].a>2000)cnt[l]=(cnt[l]||0)+1;}let best=0,bl=0;for(const [l,c] of Object.entries(cnt))if(c>best){best=c;bl=+l;}cell.label=bl;}
 const mainLabels=new Set(cells.map(c=>c.label).filter(Boolean));
 const own=new Int16Array(w*h);
 const poses=cells.map((cell,i)=>({i,cell,label:cell.label,fused:false,bbox:null,extras:[]}));
 const done=new Set();let fusedCount=0;
 for(const p of poses){if(!p.label||done.has(p.i))continue;const mates=poses.filter(o=>o.label===p.label&&o.cell.r===p.cell.r);mates.forEach(m=>done.add(m.i));
  if(mates.length===1){const g=info[p.label];p.bbox={minX:g.minX,maxX:g.maxX,minY:g.minY,maxY:g.maxY};continue;}
  fusedCount++;mates.forEach(m=>m.fused=true);const rowY0=p.cell.y0,rowY1=p.cell.y1;
  const ms=mates.slice().sort((a,b)=>a.cell.c-b.cell.c);const cuts=[];
  for(let k=0;k<ms.length-1;k++){const bx=ms[k].cell.x1;const lo=Math.round(bx-0.3*cw),hi=Math.round(bx+0.3*cw);let bestX=bx,bestC=Infinity;
   for(let x=lo;x<=hi;x++){let cnt=0;for(let y=rowY0;y<rowY1;y++){const s=y*w+x;if(lbl[s]===p.label&&imgData.data[s*4+3]>128)cnt++;}if(cnt<bestC||(cnt===bestC&&Math.abs(x-bx)<Math.abs(bestX-bx))){bestC=cnt;bestX=x;}}
   cuts.push(bestX);}
  p.cuts=cuts;
  for(let y=rowY0;y<rowY1;y++)for(let x=0;x<w;x++){const s=y*w+x;if(lbl[s]!==p.label)continue;let k=0;while(k<cuts.length&&x>=cuts[k])k++;const m=ms[k];own[s]=m.i+1;if(!m.bbox)m.bbox={minX:x,maxX:x,minY:y,maxY:y};else{if(x<m.bbox.minX)m.bbox.minX=x;if(x>m.bbox.maxX)m.bbox.maxX=x;if(y<m.bbox.minY)m.bbox.minY=y;if(y>m.bbox.maxY)m.bbox.maxY=y;}}}
 for(let l=1;l<info.length;l++){const g=info[l];if(mainLabels.has(l)||g.a<150)continue;let best=null,bd=Infinity;for(const p of poses){if(!p.bbox)continue;const dd=window.rectDist2(g,p.bbox);if(dd<bd){bd=dd;best=p;}}
  if(best&&bd<=45&&g.minY>=best.bbox.minY-12&&g.maxY<=best.bbox.maxY+6){best.extras.push(l);best.bbox={minX:Math.min(best.bbox.minX,g.minX),maxX:Math.max(best.bbox.maxX,g.maxX),minY:Math.min(best.bbox.minY,g.minY),maxY:Math.max(best.bbox.maxY,g.maxY)};}}
 return {poses,lbl,own,fusedCount,info};};
window.cropPose2=(d,p,lbl,own)=>{const {imgData,w}=d;const m=p.bbox;const ex=new Set(p.extras);
 const inPose=s=>{const l=lbl[s];if(!l)return false;if(ex.has(l))return true;if(l!==p.label)return false;return p.fused?own[s]===p.i+1:true;};
 const cW=m.maxX-m.minX,cH=m.maxY-m.minY;const cr=document.createElement('canvas');cr.width=cW+1;cr.height=cH+1;const cctx=cr.getContext('2d');const cd=cctx.createImageData(cW+1,cH+1);
 for(let y=m.minY;y<=m.maxY;y++)for(let x=m.minX;x<=m.maxX;x++){const s=y*w+x;if(inPose(s)){const di=((y-m.minY)*(cW+1)+(x-m.minX))*4,si=s*4;cd.data[di]=imgData.data[si];cd.data[di+1]=imgData.data[si+1];cd.data[di+2]=imgData.data[si+2];cd.data[di+3]=imgData.data[si+3];}}
 cctx.putImageData(cd,0,0);return {cr,cW,cH};};
// task: {dest, sheets:[[file,n,rows]], fH, thresh?, scales?[per-frame], start?}
window.runTask2=async(base,task,dstRoot)=>{
 const prepared=[];for(const [file,n,rows] of task.sheets){const d=await window.getImgData2(base+file);const plan=window.planPoses2(d,n,rows||1,task.thresh||20);for(const p of plan.poses)prepared.push({d,p,lbl:plan.lbl,own:plan.own});}
 const crops=prepared.map(({d,p,lbl,own})=>window.cropPose2(d,p,lbl,own));const maxH=Math.max(...crops.map(c=>c.cH));
 const fixedH=Math.max(task.fH,maxH+1+2);const fr=[];
 for(let i=0;i<crops.length;i++){const {cr,cW,cH}=crops[i];const nc=document.createElement('canvas');const sc=task.scales?task.scales[i]:1;nc.width=Math.round(cW*sc)+12;nc.height=fixedH;nc.getContext('2d').drawImage(cr,6,fixedH-1-cH*sc,cW*sc+1,cH*sc+1);
  const blob=await new Promise(r=>nc.toBlob(r,'image/webp'));await (await fetch('/save?path='+dstRoot+'/'+task.dest+'/'+((task.start||0)+i)+'.webp',{method:'POST',body:await blob.arrayBuffer()})).text();fr.push((prepared[i].p.fused?'f':'u')+(cH/fixedH).toFixed(2)+(prepared[i].p.extras.length?'+'+prepared[i].p.extras.length:'')+'/'+cW);}
 return task.dest+': fixedH '+fixedH+' frames='+crops.length+' ['+fr.join(' ')+']';};

// ---- Core-seeded splitting (added for Coyote, whose poses are unevenly spaced and whose
// wind/dust effects overlap neighbours) ----
// Poses are found from their opaque cores (alpha > coreThresh -- the figure itself; semi-
// transparent wind/dust is excluded), the n biggest cores per row sorted left-to-right.
// Every other opaque pixel (alpha > thresh) is then handed to the nearest core by
// geodesic distance (multi-source BFS), so overlapping effects follow the body they
// belong to instead of being cut along a vertical line. Isolated bits >= 150px within
// 45px of a pose bbox attach to it. `task.core` = coreThresh (default 200).
window.planPosesCore=(d,n,rows=1,thresh=60,coreThresh=200,fx=null)=>{
 const {imgData,w,h}=d; const A=imgData.data; const cols=n/rows;
 // core components
 const cl=new Int32Array(w*h); const cores=[]; const st=[];
 // a core pixel is opaque and not cream-coloured (the wind/dust effects), so bodies separate even where effects overlap
 const isCore=i=>{ const q=i*4; if(A[q+3]<=coreThresh) return false; if(!window._coreKeepCream){ const R=A[q],G=A[q+1],B=A[q+2]; if(R>185&&G>150&&B>95&&R-B<130&&R-B>25) return false; } return true; };
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x; if(isCore(i)&&!cl[i]){ const id=cores.length+1; cl[i]=id; st.length=0; st.push(i); let a=0,sx=0,sy=0;
   while(st.length){const c=st.pop(); const cy=(c/w)|0,cx=c%w; a++; sx+=cx; sy+=cy; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy)continue; const nx=cx+dx,ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h)continue; const ni=ny*w+nx; if(isCore(ni)&&!cl[ni]){cl[ni]=id; st.push(ni);} }}
   cores.push({id,a,cx:sx/a,cy:sy/a}); }}
 const rh=h/rows; const poses=[]; const chosen=new Map();
 for(let r=0;r<rows;r++){ const inRow=cores.filter(c=>c.cy>=r*rh&&c.cy<(r+1)*rh).sort((a,b)=>b.a-a.a).slice(0,cols).sort((a,b)=>a.cx-b.cx);
   if(inRow.length<cols) throw new Error(`row ${r}: found ${inRow.length} cores, need ${cols}`);
   inRow.forEach((c,ci)=>{ const idx=r*cols+ci; poses.push({i:idx,core:c.id,bbox:null,extras:[],fused:true,label:0}); chosen.set(c.id,idx+1); }); }
 const own=new Int16Array(w*h); const q=[];
 for(let i=0;i<w*h;i++){ const c=cl[i]; if(c&&chosen.has(c)){ own[i]=chosen.get(c); q.push(i); } }
 const isCream=i=>{ const q2=i*4; const R=A[q2],G=A[q2+1],B=A[q2+2]; return R>185&&G>150&&B>95&&R-B<130&&R-B>25; };
 for(let qi=0;qi<q.length;qi++){ const c=q[qi]; const cy=(c/w)|0,cx=c%w; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy)continue; const nx=cx+dx,ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h)continue; const ni=ny*w+nx; if(!own[ni]&&A[ni*4+3]>thresh&&(fx==='alpha'?A[ni*4+3]>235:!(fx==='left'&&isCream(ni)))){ own[ni]=own[c]; q.push(ni);} } }
 // fx=left: wind/dust trails FORWARD of its owner, so unclaimed (cream) pixels go to the pose whose core is the nearest to their left in the same row
 if(fx==='alpha'){ let fr=q.slice(); for(let it=0;it<3;it++){ const nx2=[]; for(const c of fr){ const cy=(c/w)|0,cx=c%w; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy)continue; const nx=cx+dx,ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h)continue; const ni=ny*w+nx; if(!own[ni]&&A[ni*4+3]>thresh){ own[ni]=own[c]; nx2.push(ni); q.push(ni);} } } fr=nx2; } }
 if(fx==='alpha'){ const seen=new Uint8Array(w*h); const rowOf2=y=>Math.min(rows-1,Math.floor(y/rh)); for(let s0=0;s0<w*h;s0++){ if(own[s0]||seen[s0]||A[s0*4+3]<=thresh) continue; const comp=[s0]; seen[s0]=1; let sx=0,sy=0; for(let ci=0;ci<comp.length;ci++){ const c=comp[ci]; const cy=(c/w)|0,cx=c%w; sx+=cx; sy+=cy; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy)continue; const nx=cx+dx,ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h)continue; const ni=ny*w+nx; if(!own[ni]&&!seen[ni]&&A[ni*4+3]>thresh){ seen[ni]=1; comp.push(ni);} } } const mx=sx/comp.length,my=sy/comp.length; const r=rowOf2(my); const rp=poses.filter(p=>Math.floor(p.i/cols)===r); let best=rp[0]; for(const p of rp){ if(cores[p.core-1].cx<=mx) best=p; } for(const c of comp){ own[c]=best.i+1; q.push(c); } } }
 if(fx==='left'){ const rowOf=y=>Math.min(rows-1,Math.floor(y/rh)); for(let y=0;y<h;y++){ const r=rowOf(y); const rp=poses.filter(p=>Math.floor(p.i/cols)===r); for(let x=0;x<w;x++){ const i=y*w+x; if(own[i]||A[i*4+3]<=thresh) continue; let best=rp[0]; for(const p of rp){ if(cores[p.core-1].cx<=x) best=p; } own[i]=best.i+1; q.push(i); } } }
 for(const s of q){ const o=own[s]-1; const x=s%w,y=(s/w)|0; const m=poses[o]; if(!m.bbox)m.bbox={minX:x,maxX:x,minY:y,maxY:y}; else{ if(x<m.bbox.minX)m.bbox.minX=x; if(x>m.bbox.maxX)m.bbox.maxX=x; if(y<m.bbox.minY)m.bbox.minY=y; if(y>m.bbox.maxY)m.bbox.maxY=y; } }
 // leftover islands (not reached from any core)
 const {lbl,info}=window.globalLabel2(d,thresh); const reached=new Set(); for(const s of q) reached.add(lbl[s]);
 for(let l=1;l<info.length;l++){ const g=info[l]; if(reached.has(l)||g.a<150) continue; let best=null,bd=Infinity; for(const p of poses){ const dd=window.rectDist2(g,p.bbox); if(dd<bd){bd=dd;best=p;} } if(best&&bd<=45){ best.extras.push(l); best.bbox={minX:Math.min(best.bbox.minX,g.minX),maxX:Math.max(best.bbox.maxX,g.maxX),minY:Math.min(best.bbox.minY,g.minY),maxY:Math.max(best.bbox.maxY,g.maxY)}; } }
 return {poses,lbl,own,info};};
window.cropPoseCore=(d,p,lbl,own)=>{const {imgData,w}=d;const m=p.bbox;const ex=new Set(p.extras);
 const cW=m.maxX-m.minX,cH=m.maxY-m.minY;const cr=document.createElement('canvas');cr.width=cW+1;cr.height=cH+1;const cctx=cr.getContext('2d');const cd=cctx.createImageData(cW+1,cH+1);
 for(let y=m.minY;y<=m.maxY;y++)for(let x=m.minX;x<=m.maxX;x++){const s=y*w+x; if(own[s]===p.i+1||(lbl[s]&&ex.has(lbl[s]))){const di=((y-m.minY)*(cW+1)+(x-m.minX))*4,si=s*4;cd.data[di]=imgData.data[si];cd.data[di+1]=imgData.data[si+1];cd.data[di+2]=imgData.data[si+2];cd.data[di+3]=imgData.data[si+3];}}
 cctx.putImageData(cd,0,0);return {cr,cW,cH};};
// like runTask2 but with the core-seeded planner
window.runTask3=async(base,task,dstRoot)=>{
 const prepared=[];for(const [file,n,rows] of task.sheets){const d=await window.getImgData2(base+file);const plan=window.planPosesCore(d,n,rows||1,task.thresh||60,task.core||200,task.fx||null);for(const p of plan.poses)prepared.push({d,p,lbl:plan.lbl,own:plan.own});}
 const crops=prepared.map(({d,p,lbl,own})=>window.cropPoseCore(d,p,lbl,own));const maxH=Math.max(...crops.map(c=>c.cH));
 const fixedH=Math.max(task.fH,maxH+1+2);const fr=[];
 for(let i=0;i<crops.length;i++){const {cr,cW,cH}=crops[i];const nc=document.createElement('canvas');const sc=task.scales?task.scales[i]:1;nc.width=Math.round(cW*sc)+12;nc.height=fixedH;nc.getContext('2d').drawImage(cr,6,fixedH-1-cH*sc,cW*sc+1,cH*sc+1);
  const blob=await new Promise(r=>nc.toBlob(r,'image/webp'));await (await fetch('/save?path='+dstRoot+'/'+task.dest+'/'+((task.start||0)+i)+'.webp',{method:'POST',body:await blob.arrayBuffer()})).text();fr.push((cH/fixedH).toFixed(2)+(prepared[i].p.extras.length?'+'+prepared[i].p.extras.length:'')+'/'+cW);}
 return task.dest+': fixedH '+fixedH+(fixedH!==task.fH?' (raised from '+task.fH+')':'')+' frames='+crops.length+' ['+fr.join(' ')+']';};

// ---- Window-cut splitting (single-row sheets with unevenly spaced poses) ----
// task.windows[i] = [lo, hi] x-range (source px) inside which the cut between pose i and
// pose i+1 is placed, at the column with the fewest opaque (alpha > 128) pixels. Each pose
// is every pixel (alpha > thresh) between its cuts, minus specks under 150px of area.
window.runTask4=async(base,task,dstRoot)=>{
 const [file]=task.sheets[0]; const d=await window.getImgData2(base+file); const {w,h,imgData}=d; const A=imgData.data; const thresh=task.thresh||60;
 const cuts=[0]; for(const [lo,hi] of task.windows){ let best=lo,bc=1e9; for(let x=lo;x<=hi;x++){ let cnt=0; for(let y=0;y<h;y++) if(A[(y*w+x)*4+3]>128) cnt++; if(cnt<bc||(cnt===bc&&Math.abs(x-(lo+hi)/2)<Math.abs(best-(lo+hi)/2))){bc=cnt;best=x;} } cuts.push(best); } cuts.push(w);
 const crops=[]; const info=[];
 for(let i=0;i<cuts.length-1;i++){ const x0=cuts[i],x1=cuts[i+1]; const sw=x1-x0; const mask=new Uint8Array(sw*h); for(let y=0;y<h;y++)for(let x=0;x<sw;x++) if(A[(y*w+x0+x)*4+3]>thresh) mask[y*sw+x]=1;
  const lab=new Int32Array(sw*h); const comps=[]; const st=[];
  for(let p=0;p<sw*h;p++){ if(!mask[p]||lab[p]) continue; const id=comps.length+1; lab[p]=id; st.length=0; st.push(p); let a=0; while(st.length){ const c=st.pop(); a++; const cy=(c/sw)|0,cx=c%sw; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy)continue; const nx=cx+dx,ny=cy+dy; if(nx<0||ny<0||nx>=sw||ny>=h)continue; const ni=ny*sw+nx; if(mask[ni]&&!lab[ni]){lab[ni]=id; st.push(ni);} } } comps.push(a); }
  let minX=1e9,maxX=-1,minY=1e9,maxY=-1; for(let p=0;p<sw*h;p++){ const l=lab[p]; if(l&&comps[l-1]>=150){ const x=p%sw,y=(p/sw)|0; if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; } }
  const cW=maxX-minX,cH=maxY-minY; const cr=document.createElement('canvas'); cr.width=cW+1; cr.height=cH+1; const cctx=cr.getContext('2d'); const cd=cctx.createImageData(cW+1,cH+1);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){ const l=lab[y*sw+x]; if(l&&comps[l-1]>=150){ const di=((y-minY)*(cW+1)+(x-minX))*4,si=(y*w+x0+x)*4; cd.data[di]=A[si];cd.data[di+1]=A[si+1];cd.data[di+2]=A[si+2];cd.data[di+3]=A[si+3]; } }
  cctx.putImageData(cd,0,0); crops.push({cr,cW,cH}); }
 const maxH=Math.max(...crops.map(c=>c.cH)); const fixedH=Math.max(task.fH,maxH+3); const fr=[];
 for(let i=0;i<crops.length;i++){ const {cr,cW,cH}=crops[i]; const nc=document.createElement('canvas'); nc.width=cW+12; nc.height=fixedH; nc.getContext('2d').drawImage(cr,6,fixedH-1-cH);
  const blob=await new Promise(r=>nc.toBlob(r,'image/webp')); await (await fetch('/save?path='+dstRoot+'/'+task.dest+'/'+i+'.webp',{method:'POST',body:await blob.arrayBuffer()})).text(); fr.push((cH/fixedH).toFixed(2)+'/'+cW); }
 return task.dest+': cuts '+cuts.slice(1,-1).join(',')+' fixedH '+fixedH+(fixedH!==task.fH?' (raised from '+task.fH+')':'')+' ['+fr.join(' ')+']'; };
