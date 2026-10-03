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
