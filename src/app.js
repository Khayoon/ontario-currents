'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const base=$('#water'),flow=$('#flow'),label=$('#labels'),bg=base.getContext('2d'),ink=flow.getContext('2d'),type=label.getContext('2d');
const state={w:0,h:0,dpr:1,k:1,tx:0,ty:0,view:'all',geo:null,drainage:null,mesh:null,field:null,river:null,estuary:null,outerEstuary:null,simcoe:null,mode:'live',savedLive:null,frames:[],index:0,run:null,layer:'speed',particles:[],playing:false,pending:false,live:false,manifest:null,publishedAvailable:true,cache:new Map(),request:0};
const views={all:[-80.05,43.03,-75.5,44.93],toronto:[-79.95,43.25,-78.65,44.0],outlet:[-77.1,43.8,-75.5,44.75],simcoe:[-79.78,44.08,-79.1,44.68],river:[-77.0,43.9,-68.5,49.0],montreal:[-74.25,45.27,-73.4,45.82]};
const places=[['Toronto',-79.3832,43.6532,1],['Hamilton',-79.8711,43.2557,1],['Niagara-on-the-Lake',-79.0713,43.2544,2],['Oshawa',-78.8658,43.8971,2],['Cobourg',-78.1677,43.9598,2],['Belleville',-77.3832,44.1628,2],['Kingston',-76.486,44.2312,1],['Gananoque',-76.1606,44.3306,2],['Brockville',-75.6843,44.5895,2],['Barrie',-79.6903,44.3894,1],['Orillia',-79.418,44.6082,2],['Keswick',-79.466,44.219,3],['Tadoussac',-69.715,48.144,2],['Les Escoumins',-69.405,48.346,1],['Saguenay',-71.06,48.42,2],['Montréal',-73.5673,45.5019,1],['Trois-Rivières',-72.543,46.343,1],['Québec',-71.208,46.8139,1],['Rochester',-77.6109,43.1566,3],['Oswego',-76.5105,43.4553,3]];
const labels=[['LAKE ONTARIO',-77.95,43.63,13],['LAKE SIMCOE',-79.32,44.48,9],['ST. LAWRENCE',-75.84,44.48,9],['BAY OF QUINTE',-77.25,44.07,8]];
const stops=[[30,85,120],[58,148,190],[85,205,216],[160,235,219],[238,241,190]];
const nominalMotionMultiplier=90000,maxScreenMotion=270;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function projectRaw(lon,lat){const p=lat*Math.PI/180;return [(lon+180)/360,(1-Math.log(Math.tan(Math.PI/4+p/2))/Math.PI)/2];}
function project(lon,lat){const [x,y]=projectRaw(lon,lat);return [x*state.k+state.tx,y*state.k+state.ty];}
function invert(x,y){const a=(x-state.tx)/state.k,b=(y-state.ty)/state.k;return [a*360-180,Math.atan(Math.sinh(Math.PI*(1-2*b)))*180/Math.PI];}
function mapBottomReserve(){return state.w<600?160:105;}
function fit(name='all'){
  state.view=name;
  const box=views[name],a=projectRaw(box[0],box[3]),b=projectRaw(box[2],box[1]);
  const mobile=state.w<600,top=mobile?210:145,bottom=mapBottomReserve(),pad=mobile?24:70;
  const h=Math.max(160,state.h-top-bottom),w=state.w-pad*2;
  state.k=Math.min(w/(b[0]-a[0]),h/(b[1]-a[1]));state.tx=state.w/2-(a[0]+b[0])/2*state.k;state.ty=top+h/2-(a[1]+b[1])/2*state.k;
  $$('.regions button').forEach(b=>b.classList.toggle('selected',b.dataset.view===name));redraw(true);
}
function resize(){const old=state.w?[...invert(state.w/2,state.h/2),state.k/state.w]:null;state.w=innerWidth;state.h=innerHeight;state.dpr=Math.min(devicePixelRatio||1,2);for(const c of [base,flow,label]){c.width=Math.round(state.w*state.dpr);c.height=Math.round(state.h*state.dpr);c.getContext('2d').setTransform(state.dpr,0,0,state.dpr,0,0);}if(state.view)fit(state.view);else if(old){state.k=old[2]*state.w;const p=projectRaw(old[0],old[1]);state.tx=state.w/2-p[0]*state.k;state.ty=state.h/2-p[1]*state.k;redraw(true);}else fit();}
function color(value){const q=Math.max(0,Math.min(.9999,value))*4,i=Math.floor(q),t=q-i;return stops[i].map((c,j)=>Math.round(c*(1-t)+stops[i+1][j]*t));}
function shade(t,s){return color(state.layer==='speed'?s/(screenGrid?.speedMaximum||.6):t/25);}
function polygon(rings,ctx){for(const ring of rings){for(let i=0;i<ring.length;i++){const p=project(...ring[i]);if(i===0)ctx.moveTo(...p);else ctx.lineTo(...p);}ctx.closePath();}}
function pathFeature(f,ctx){const g=f.geometry;ctx.beginPath();if(g.type==='Polygon')polygon(g.coordinates,ctx);else if(g.type==='MultiPolygon')g.coordinates.forEach(r=>polygon(r,ctx));else{const lines=g.type==='MultiLineString'?g.coordinates:[g.coordinates];for(const line of lines){let started=false;for(const p of line){const s=project(...p);if(!started){ctx.moveTo(...s);started=true;}else ctx.lineTo(...s);}}}}
let geographyCache=null;
function projectedGeography(){
  const key=[state.geo,state.drainage,state.w,state.h,state.dpr,state.k,state.tx,state.ty];
  if(geographyCache&&key.every((value,i)=>value===geographyCache.key[i]))return geographyCache;
  const paths=(state.geo?.features||[]).map(feature=>{const path=new Path2D(),g=feature.geometry;if(g.type==='Polygon')polygon(g.coordinates,path);else if(g.type==='MultiPolygon')g.coordinates.forEach(r=>polygon(r,path));else{const lines=g.type==='MultiLineString'?g.coordinates:[g.coordinates];for(const line of lines){line.forEach((p,i)=>i?path.lineTo(...project(...p)):path.moveTo(...project(...p)));}}return {feature,path};});
  const background=document.createElement('canvas'),shorelines=document.createElement('canvas');for(const c of [background,shorelines]){c.width=Math.round(state.w*state.dpr);c.height=Math.round(state.h*state.dpr);c.getContext('2d').setTransform(state.dpr,0,0,state.dpr,0,0);}
  const land=background.getContext('2d'),coast=shorelines.getContext('2d');land.fillStyle='#030708';land.fillRect(0,0,state.w,state.h);
  for(const {feature:f,path} of paths){if(f.properties.river){land.lineWidth=f.properties.name==='St. Lawrence'?Math.max(2,Math.min(9,state.k/38000)):2;land.strokeStyle='#0b252f';land.lineJoin='round';land.stroke(path);}else{land.fillStyle=f.properties.name==='Lake Simcoe'?'#07181d':'#092d40';land.fill(path,'evenodd');land.strokeStyle='#224552';land.lineWidth=.8;land.stroke(path);coast.strokeStyle='#326071';coast.lineWidth=.65;coast.stroke(path);}}
  // Catchment context is drawn on land and never becomes a water/current mask.
  for(const f of state.drainage?.features||[]){const role=f.properties?.role;if(!['tributary','divide','watershed'].includes(role))continue;pathFeature(f,land);land.strokeStyle=role==='divide'?'#a58c58':role==='tributary'?'#36626c':'#304b4e';land.lineWidth=role==='divide'?1.25:role==='tributary'?.8:.65;land.setLineDash(role==='divide'?[5,4]:[]);land.lineJoin='round';land.stroke();}land.setLineDash([]);
  // One current view is retained: panning or resizing replaces this bounded cache.
  geographyCache={key,paths,background,shorelines,mask:null};return geographyCache;
}
function waterMask(g,geography){
  if(geography.mask?.nx===g.nx&&geography.mask?.ny===g.ny&&geography.mask?.cell===g.cell)return geography.mask.pixels;
  const mask=document.createElement('canvas');mask.width=g.nx;mask.height=g.ny;const c=mask.getContext('2d',{willReadFrequently:true});c.setTransform(1/g.cell,0,0,1/g.cell,0,0);c.fillStyle='#fff';for(const {feature,path} of geography.paths){if(['Polygon','MultiPolygon'].includes(feature.geometry.type))c.fill(path,'evenodd');}
  const pixels=c.getImageData(0,0,g.nx,g.ny).data;geography.mask={nx:g.nx,ny:g.ny,cell:g.cell,pixels};return pixels;
}
function drawWater(){
  bg.clearRect(0,0,state.w,state.h);if(!state.geo){bg.fillStyle='#030708';bg.fillRect(0,0,state.w,state.h);return;}const geography=projectedGeography();bg.drawImage(geography.background,0,0,state.w,state.h);
  if(screenGrid){const raster=displayRaster(screenGrid,state.layer,color,screenGrid.speedMaximum);bg.imageSmoothingEnabled=true;bg.drawImage(raster,0,0,screenGrid.nx*screenGrid.cell,screenGrid.ny*screenGrid.cell);}
  bg.drawImage(geography.shorelines,0,0,state.w,state.h);
}
function drawLabels(){type.clearRect(0,0,state.w,state.h);if(!state.geo)return;const mobile=state.w<600,occupied=[];type.textBaseline='middle';
  for(const [text,lon,lat,size] of labels){const [x,y]=project(lon,lat);if(x<20||x>state.w-20||y<120||y>state.h-mapBottomReserve())continue;type.font=`${Math.max(mobile?7:8,size*(mobile?.72:1))}px 'DM Mono',monospace`;type.textAlign='center';type.fillStyle=text==='LAKE ONTARIO'?'#78b7c9':'#527a86';type.letterSpacing=text==='LAKE ONTARIO'?'4px':'1px';type.shadowColor='#02080a';type.shadowBlur=8;type.fillText(text,x,y);}
  type.shadowBlur=0;type.letterSpacing='1px';
  for(const [text,lon,lat,priority] of places){const [x,y]=project(lon,lat);if(x<12||x>state.w-12||y<100||y>state.h-mapBottomReserve()||mobile&&priority>2)continue;if(x<250&&y<250)continue;
    type.font=`${mobile?8:priority===1?10:8}px 'DM Mono',monospace`;const width=type.measureText(text.toUpperCase()).width+12;let left=x+9;const align=x+width>state.w-40?'right':'left';if(align==='right')left=x-width-9;const rect=[left,y-20,width+5,20];if(occupied.some(r=>rect[0]<r[0]+r[2]&&rect[0]+rect[2]>r[0]&&rect[1]<r[1]+r[3]&&rect[1]+rect[3]>r[1]))continue;occupied.push(rect);
    type.fillStyle='#d4e1dd';type.beginPath();type.arc(x,y,priority===1?2.5:1.7,0,Math.PI*2);type.fill();type.textAlign=align;type.fillStyle=priority===1?'#c4d5d3':'#819c9f';type.shadowColor='#02080a';type.shadowBlur=5;type.fillText(text.toUpperCase(),align==='right'?x-9:x+9,y-7);type.shadowBlur=0;
  }
  for(const [text,lon,lat] of [['NO CURRENT FEED',-79.32,44.36],['NO VERIFIED CURRENT FIELD',-75.2,44.7]]){if(text==='NO CURRENT FEED'&&state.simcoe)continue;const [x,y]=project(lon,lat);if(x>20&&x<state.w-20&&y>140&&y<state.h-mapBottomReserve()){type.textAlign='center';type.font=`${mobile?6:7}px 'DM Mono',monospace`;type.letterSpacing='1px';type.fillStyle='#617e85';type.fillText(text,x,y);}}
  type.letterSpacing='0px';
  if(state.k>40000)for(const f of state.drainage?.features||[]){const p=f.properties||{};if(!p.labelPoint||p.role!=='divide'&&state.k<160000)continue;const [x,y]=project(...p.labelPoint);if(x<35||x>state.w-35||y<170||y>state.h-mapBottomReserve())continue;const text=p.role==='divide'?'HURON / ONTARIO DIVIDE':p.name;if(!text)continue;type.textAlign='center';type.font=`${mobile?6:8}px 'DM Mono',monospace`;const width=type.measureText(text).width,rect=[x-width/2,y-5,width,12];if(occupied.some(r=>rect[0]<r[0]+r[2]&&rect[0]+rect[2]>r[0]&&rect[1]<r[1]+r[3]&&rect[1]+rect[3]>r[1]))continue;occupied.push(rect);type.fillStyle=p.role==='divide'?'#bca46d':'#6d99a1';type.shadowColor='#030708';type.shadowBlur=4;type.fillText(text,x,y);type.shadowBlur=0;}
}
function sample(lon,lat){const p=project(lon,lat);return displaySample(screenGrid,...p);}
let screenGrid=null,gridKey=null;
function buildGrid(){if(!state.mesh)return;const key=[state.mesh,state.field,state.river,state.estuary,state.simcoe,state.outerEstuary,state.geo,state.w,state.h,state.k,state.tx,state.ty];if(screenGrid&&gridKey&&key.every((value,i)=>value===gridKey[i]))return;screenGrid=makeDisplay(state.mesh,state.field,state.river,project,invert,state.w,state.h,state.estuary,state.simcoe,state.outerEstuary);
  // Preserve exact native Ontario wet triangles; clip disseminated river grids
  // to real water polygons so coarse cells cannot paint over island land.
  const g=screenGrid,pixels=waterMask(g,projectedGeography());g.valid=g.valid.filter(k=>{if(g.provider[k]!==1&&pixels[k*4+3]<16){g.provider[k]=0;g.u[k]=NaN;return false;}return true;});g.simcoeVisibleCells=0;g.outerEstuaryVisibleCells=0;for(const k of g.valid){if(g.provider[k]===4)g.simcoeVisibleCells++;if(g.provider[k]===5)g.outerEstuaryVisibleCells++;}const outerStatus=$('#outer-estuary-status');outerStatus.hidden=!g.outerEstuaryVisibleCells;outerStatus.textContent=g.outerEstuaryVisibleCells?'Outer estuary · archived 12–17 Oct 2026 vector mean':'';
  // One shared visual clock preserves relative velocities. At close zooms it
  // slows the entire field so its fastest trace travels about 270 CSS px/s.
  // Source vectors, scalar colours and cursor values remain untouched.
  let fastest=0;for(const k of g.valid)fastest=Math.max(fastest,Math.hypot(g.u[k],g.v[k]));
  const centreLatitude=invert(state.w/2,state.h/2)[1],pixelsPerMetre=state.k/(360*111320*Math.cos(centreLatitude*Math.PI/180));
  g.motionMultiplier=Math.min(nominalMotionMultiplier,maxScreenMotion/Math.max(1e-12,fastest*pixelsPerMetre));gridKey=key;
}

function resetParticle(p,randomAge=true){if(!screenGrid?.valid.length){p.age=999;return;}const k=screenGrid.valid[Math.floor(Math.random()*screenGrid.valid.length)];p.x=(k%screenGrid.nx)*screenGrid.cell+Math.random()*screenGrid.cell;p.y=Math.floor(k/screenGrid.nx)*screenGrid.cell+Math.random()*screenGrid.cell;p.age=randomAge?Math.floor(Math.random()*150):0;p.life=80+Math.random()*100;}
function seed(){const count=Math.min(14000,Math.max(3000,(screenGrid?.valid.length||0)*.6));state.particles=Array.from({length:count},()=>{const p={};resetParticle(p);return p;});}
function speedScaleMaximum(){const g=screenGrid;return state.simcoe&&(state.view==='simcoe'||g?.simcoeVisibleCells>0&&g.simcoeVisibleCells/g.valid.length>=.8)?.05:.6;}
function updateLayerUI(){const simcoeOnly=state.view==='simcoe'&&Boolean(state.simcoe);if(simcoeOnly)state.layer='speed';const speedMaximum=speedScaleMaximum();if(screenGrid)screenGrid.speedMaximum=speedMaximum;$$('[data-layer]').forEach(b=>{b.classList.toggle('selected',b.dataset.layer===state.layer);b.disabled=simcoeOnly&&b.dataset.layer==='temperature';b.title=b.disabled?'No temperature field is supplied for this experiment':'';});$('#legend-title').textContent=state.layer==='speed'?'CURRENT SPEED':'WATER TEMPERATURE';$('#legend-min').textContent=state.layer==='speed'?'0 cm/s':'0°C';$('#legend-max').textContent=state.layer==='speed'?(speedMaximum===.05?'5 cm/s':'60+ cm/s'):'25°C';}
function simcoePeriod(){return state.simcoe?'12 Oct 00:00 – 17 Oct 12:00 UTC · 2026':'';}
function simcoeMethod(){const method=state.simcoe?.method;return typeof method==='string'?method:[method?.equations,method?.scheme,method?.boundary].filter(value=>typeof value==='string'&&value.trim()).join(' ');}
function updateCoverage(){const selected=state.view==='simcoe',experimental=Boolean(state.simcoe&&(selected||screenGrid?.simcoeVisibleCells));$('#coverage-note').hidden=!(selected&&!state.simcoe);$('.legend').hidden=selected&&!state.simcoe;$('#experimental-note').hidden=!experimental;$('#atlas').dataset.simcoeExperiment=experimental?'visible':'hidden';$('#simcoe-period').textContent=simcoePeriod();$('#simcoe-model-period').textContent=state.simcoe?simcoePeriod():'No experimental dataset is included.';$('#simcoe-model-method').textContent=state.simcoe?simcoeMethod():'The map remains shoreline only until a separately labelled experimental dataset is supplied.';updateLayerUI();updateFieldSummary();}
function redraw(reseed=false){if(state.field){buildGrid();if(reseed)seed();}updateCoverage();const bounds=state.drainage?.bbox;if(bounds){const a=project(bounds[0],bounds[3]),b=project(bounds[2],bounds[1]);$('#drainage-key').hidden=b[0]<0||a[0]>state.w||b[1]<0||a[1]>state.h;}else $('#drainage-key').hidden=true;drawWater();drawLabels();ink.clearRect(0,0,state.w,state.h);if(reduced)for(let i=0;i<35;i++)animateStep(.016);}
function animateStep(dt){if(!screenGrid?.valid.length)return;ink.globalCompositeOperation='destination-in';ink.fillStyle='rgba(0,0,0,.982)';ink.fillRect(0,0,state.w,state.h);ink.globalCompositeOperation='source-over';ink.lineWidth=state.w<600?.9:1.1;
  const g=screenGrid,seconds=dt*(g.motionMultiplier||nominalMotionMultiplier),metresPerDegree=111320;const buckets=Array.from({length:12},()=>[]);
  const index=(x,y)=>x<0||y<0||x>=state.w||y>=state.h?-1:Math.floor(y/g.cell)*g.nx+Math.floor(x/g.cell);
  for(const p of state.particles){if(p.age++>p.life){resetParticle(p,false);continue;}let remaining=seconds,steps=0;
    while(remaining>1e-6&&steps++<160){const k=index(p.x,p.y);if(k<0||!Number.isFinite(g.u[k])){resetParticle(p,false);break;}const u=g.u[k],v=g.v[k],lat=invert(p.x,p.y)[1],scale=state.k/(360*metresPerDegree*Math.cos(lat*Math.PI/180));
      const step=Math.min(remaining,1/Math.max(1e-12,Math.hypot(u,v)*scale)),mid=index(p.x+u*step*scale*.5,p.y-v*step*scale*.5);if(mid<0||!Number.isFinite(g.u[mid])){resetParticle(p,false);break;}
      const nx=p.x+g.u[mid]*step*scale,ny=p.y-g.v[mid]*step*scale,nk=index(nx,ny);if(nk<0||!Number.isFinite(g.u[nk])){resetParticle(p,false);break;}const speed=Math.hypot(u,v),q=state.layer==='speed'?speed/(g.speedMaximum||.6):Number.isFinite(g.t[k])?g.t[k]/25:.5,bucket=Math.max(0,Math.min(11,Math.floor(q*12)));buckets[bucket].push([p.x,p.y,nx,ny,speed]);p.x=nx;p.y=ny;remaining-=step;
    }
  }
  for(let i=0;i<12;i++){const rgb=color(i/12);ink.strokeStyle=`rgba(${rgb.join(',')},.88)`;ink.beginPath();for(const p of buckets[i]){ink.moveTo(p[0],p[1]);ink.lineTo(p[2],p[3]);}ink.stroke();}
}
let last=0;function animate(now){const dt=Math.min(.035,last?(now-last)/1000:.016);last=now;if(!document.hidden&&!reduced)animateStep(dt);requestAnimationFrame(animate);}
function notice(text,ms=6000){const el=$('#notice');el.textContent=text;el.style.display='block';clearTimeout(notice.timer);notice.timer=setTimeout(()=>el.style.display='none',ms);}
function dateLabel(str,short=false){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'2-digit',...(short?{}:{hour:'2-digit',minute:'2-digit',hour12:false,timeZoneName:'short'})}).format(new Date(str));}
function updateFieldSummary(){
  if(state.view==='simcoe'){if(state.simcoe){$('#time-kind').textContent='SIMCOE · UNVALIDATED WIND RESPONSE';$('#valid-time').dateTime=state.simcoe.end;$('#valid-time').textContent=simcoePeriod();}else{$('#time-kind').textContent='LAKE SIMCOE';$('#valid-time').dateTime='';$('#valid-time').textContent='Current field unavailable';}return;}
  const f=state.field;if(!f?.time)return;$('#valid-time').dateTime=f.time;
  if(state.mode==='average'){$('#valid-time').textContent=dateLabel(f.start,true)+' – '+dateLabel(f.end,true)+' · '+f.sampleCount+' samples';$('#time-kind').textContent='ONTARIO · 24-HOUR VECTOR MEAN';}
  else{const entry=state.frames[state.index];$('#valid-time').textContent=dateLabel(f.time);$('#time-kind').textContent=state.live?(entry?.kind==='forecast'?'ONTARIO FORECAST · TOP MODEL LAYER':'ONTARIO NOWCAST · TOP MODEL LAYER'):'ONTARIO · STORED MODEL FIELD';}
}
function updateTime(){
  const f=state.field;if(!f)return;
  updateFieldSummary();
  if(state.mode==='average'){
    $('#frame-status').textContent=state.river?.start?'River forecast mean: '+dateLabel(state.river.start,true)+' – '+dateLabel(state.river.end,true):'Vector averages · not a climatology';
    $('#range-start').textContent='LAKE: PAST 24 H';$('#range-end').textContent='RIVER: 24 H FORECAST';
  }else{
    if(state.frames.length){$('#range-start').textContent=dateLabel(state.frames[0].time,true);$('#range-end').textContent=dateLabel(state.frames.at(-1).time,true);}
  }
  $('#timeline').value=state.index;$('#timeline').disabled=state.mode==='average'||!state.frames.length;$('#play').disabled=state.mode==='average';
  const source=f.source||'https://opendap.co-ops.nos.noaa.gov/thredds/catalog/NOAA/LOOFS/MODELS/catalog.html';$('#file-link').href=source.includes('/dodsC/')?source+'.html':source;
  $('#run-info').textContent=state.mode==='average'?f.sampleCount+' fields · '+dateLabel(f.start)+' to '+dateLabel(f.end):state.run?dateLabel(state.run):'Bundled: '+dateLabel(f.time);
  $('#estuary-info').textContent=state.estuary?(state.mode==='average'?dateLabel(state.estuary.start)+' to '+dateLabel(state.estuary.end):dateLabel(state.estuary.time))+' · surface':'Loading estuary source';
  $('#river-info').textContent=state.river?(state.mode==='average'?dateLabel(state.river.start)+' to '+dateLabel(state.river.end):dateLabel(state.river.time))+' · depth averaged':'Loading river source';
}

async function loadJSON(url){const r=await fetch(url,{cache:'no-cache',signal:AbortSignal.timeout(url.includes('average')?180000:90000)});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||'Data request failed');}return r.json();}
function validateSimcoe(f){
  const fail=()=>{throw new Error('Experimental Simcoe dataset does not match the declared fixed-period contract');};
  if(f?.kind!=='experimental-grid'||f.sourceType!=='experimental-wind-response'||f.experimental!==true||f.validated!==false||f.layer!=='depth-averaged wind response'||f.t!==null)fail();
  if((f.units&&f.units!=='m/s')||(f.velocityUnits&&f.velocityUnits!=='m/s'))fail();
  if(Date.parse(f.start)!==Date.parse('2026-10-12T00:00:00Z')||Date.parse(f.end)!==Date.parse('2026-10-17T12:00:00Z')||Date.parse(f.time)!==Date.parse(f.end))fail();
  if(!Number.isInteger(f.width)||!Number.isInteger(f.height)||f.width<2||f.height<2||!Number.isFinite(f.west)||!Number.isFinite(f.south)||!Number.isFinite(f.dx)||!Number.isFinite(f.dy)||f.dx<=0||f.dy<=0||!Array.isArray(f.u)||!Array.isArray(f.v)||f.u.length!==f.width*f.height||f.v.length!==f.u.length)fail();
  let wet=0;for(let i=0;i<f.u.length;i++){if((f.u[i]===null)!==(f.v[i]===null))fail();if(f.u[i]!==null){if(!Number.isFinite(f.u[i])||!Number.isFinite(f.v[i]))fail();wet++;}}
  const methodValid=typeof f.method==='string'?Boolean(f.method.trim()):Boolean(f.method&&typeof f.method==='object'&&!Array.isArray(f.method)&&typeof f.method.equations==='string'&&f.method.equations.trim());
  if(!wet||!methodValid||!f.provenance||(typeof f.provenance==='object'?Object.keys(f.provenance).length===0:typeof f.provenance!=='string'||!f.provenance.trim()))fail();return f;
}
let simcoeRequest=null;
function loadSimcoe(){if(simcoeRequest)return simcoeRequest;simcoeRequest=(async()=>{try{const response=await fetch('./data/simcoe-experimental.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Optional experimental field unavailable');state.simcoe=validateSimcoe(await response.json());}catch{state.simcoe=null;}if(state.field&&state.geo&&state.mesh)redraw(true);else updateCoverage();})().finally(()=>{simcoeRequest=null;});return simcoeRequest;}
async function loadDrainage(){try{const f=await loadJSON('./drainage.json');if(f.type!=='FeatureCollection'||!Array.isArray(f.features)||!f.features.every(x=>['divide','tributary','watershed'].includes(x.properties?.role)&&['LineString','MultiLineString','Polygon','MultiPolygon'].includes(x.geometry?.type)))throw new Error('Invalid drainage geography');state.drainage=f;}catch{state.drainage=null;}$('#drainage-key').hidden=!state.drainage;if(state.geo&&state.field)redraw();}
function validateOuterEstuary(f){if(f?.kind!=='estuary'||f.mode!=='average'||f.provider!=='DFO POPS STLE500'||f.velocityUnits!=='m/s'||!Number.isInteger(f.width)||!Number.isInteger(f.height)||f.width<2||f.height<2||f.u?.length!==f.width*f.height||f.v?.length!==f.u.length||!Number.isFinite(f.west)||!Number.isFinite(f.south)||!(f.dx>0)||!(f.dy>0)||!Number.isFinite(Date.parse(f.start))||!Number.isFinite(Date.parse(f.end))||Date.parse(f.start)>=Date.parse(f.end)||f.sampleCount!==23)throw new Error('Invalid archived outer estuary field');let wet=0;for(let i=0;i<f.u.length;i++){if((f.u[i]===null)!==(f.v[i]===null)||f.u[i]!==null&&(!Number.isFinite(f.u[i])||!Number.isFinite(f.v[i])))throw new Error('Invalid archived vector');if(f.u[i]!==null)wet++;}if(!wet)throw new Error('Empty archived outer estuary field');return f;}
async function loadOuterEstuary(){try{state.outerEstuary=validateOuterEstuary(await loadJSON('./data/outer-estuary-mean.json'));}catch{state.outerEstuary=null;}if(state.field&&state.geo)redraw(true);}
function providerCurrent(name){const p=state.manifest?.providers?.[name];return state.publishedAvailable&&p?.status==='current'&&Date.now()-Date.parse(p.checkedAt)<3*3600000&&Date.now()-Date.parse(p.sourceTime)<18*3600000;}
function applyFreshness(){
  const p=state.manifest?.providers,feed=$('#feed-status');if(!p){feed.dataset.state='retained';$('#feed-status span').textContent='Dated published data · checking status';return;}
  state.live=providerCurrent('noaa');feed.dataset.state=state.live?'current':'retained';
  $('#feed-status span').textContent=!state.publishedAvailable?'Published data unavailable · retained field':state.live?'NOAA · latest published model run':p.noaa.status==='current'?'NOAA · update overdue · dates shown':'NOAA · dated fallback · '+dateLabel(p.noaa.sourceTime,true);
  const parts=[['river','River'],['estuary','Estuary']].map(([key,title])=>`${title}: ${dateLabel(p[key].sourceTime)}${providerCurrent(key)?'':' · retained / overdue'}`);$('#river-status').textContent=parts.join(' · ');
  $('#published-info').textContent=state.manifest.refreshAttemptAt?`Published ${dateLabel(state.manifest.generatedAt)}. Upstream check ${dateLabel(state.manifest.refreshAttemptAt)}. ${state.manifest.allSourcesCurrent?'Sources were available at that check.':'Some upstream sources could not refresh; dated fallback fields are retained.'}`:'Dated bundled data. No upstream refresh has been verified for this deployment.';
  $('#source-status').textContent=Object.entries(p).map(([key,s])=>`${key==='noaa'?'NOAA':key==='river'?'ECCC OHPS':'DFO STLE200'}: ${s.status}${s.error?' — '+s.error:''}`).join(' | ');
}
async function loadManifest(){try{state.manifest=await loadJSON('./data/manifest.json');state.publishedAvailable=true;loadSimcoe();}catch(e){state.publishedAvailable=false;throw e;}finally{applyFreshness();}}
async function fetchFrame(index){const e=state.frames[index];if(!e)return null;if(state.cache.has(e.id))return state.cache.get(e.id);const promise=loadJSON('./'+e.url).then(f=>{if(f.kind!=='mesh'||f.u.length!==state.mesh.triangles.length||f.t.length!==state.mesh.lon.length)throw new Error('Incomplete native field');return f;}).catch(e=>{state.cache.delete(state.frames[index]?.id);throw e;});state.cache.set(e.id,promise);if(state.cache.size>32)state.cache.delete(state.cache.keys().next().value);return promise;}
async function setFrame(index){const ticket=++state.request;state.pending=true;$('#frame-status').textContent='Loading selected NOAA field…';try{const field=await fetchFrame(index);if(ticket!==state.request||!field)return;state.index=index;state.field=field;state.savedLive=field;state.live=providerCurrent('noaa');updateTime();redraw(true);$('#frame-status').textContent='Particles follow the selected field · motion accelerated';if(index+1<state.frames.length)fetchFrame(index+1).catch(()=>{});return true;}catch(e){if(ticket===state.request){notice('That model field is unavailable. The previous field is still displayed.');$('#timeline').value=state.index;state.playing=false;updatePlay();$('#frame-status').textContent='Field unavailable · showing previous valid time';}}finally{if(ticket===state.request)state.pending=false;}}
async function refresh(showMessage=false){$('#refresh').disabled=true;try{await loadManifest();const c=await loadJSON('./data/catalog.json');const wasPlaying=state.playing;state.playing=false;updatePlay();state.frames=c.frames;state.run=c.run;$('#timeline').max=c.frames.length-1;$('#timeline').disabled=false;$('#range-start').textContent=dateLabel(c.frames[0].time,true);$('#range-end').textContent=dateLabel(c.frames.at(-1).time,true);if(state.mode==='average'){updateTime();return;}if(!await setFrame(c.currentIndex))throw new Error('Latest published field unavailable');if(showMessage)notice(state.live?'Latest published model field loaded.':'Dated published field loaded. An upstream refresh is unavailable or overdue.',7000);if(wasPlaying){state.playing=true;updatePlay();}}catch(e){state.publishedAvailable=false;if(showMessage)notice('Published update unavailable. The displayed field keeps its original date.',7000);}finally{applyFreshness();$('#refresh').disabled=false;}}
function updatePlay(){$('#play').textContent=state.playing?'Ⅱ':'▶';$('#play').setAttribute('aria-pressed',String(state.playing));$('#play').setAttribute('aria-label',state.playing?'Pause timeline':'Play through model times');}
let playTimer;async function tick(){if(state.mode==='live'&&state.playing&&!state.pending&&state.frames.length)await setFrame((state.index+1)%state.frames.length);playTimer=setTimeout(tick,3500);}
function zoom(factor,cx=state.w/2,cy=state.h/2){state.view=null;const k=Math.max(5000,Math.min(4000000,state.k*factor)),f=k/state.k;state.tx=cx-(cx-state.tx)*f;state.ty=cy-(cy-state.ty)*f;state.k=k;$$('.regions button').forEach(b=>b.classList.remove('selected'));redraw(true);}
const pointers=new Map();let drag=null,moved=false;
base.addEventListener('pointerdown',e=>{base.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);drag=[e.clientX,e.clientY];moved=false;$('#readout').hidden=true;});
base.addEventListener('pointermove',e=>{if(pointers.has(e.pointerId)){const old=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1];const before=Math.hypot(old[0]-other[0],old[1]-other[1]),after=Math.hypot(e.clientX-other[0],e.clientY-other[1]);if(before>5)zoom(after/before,(e.clientX+other[0])/2,(e.clientY+other[1])/2);}else{state.view=null;state.tx+=e.clientX-old[0];state.ty+=e.clientY-old[1];redraw(true);}moved=true;return;}inspect(e.clientX,e.clientY);});
function release(e){pointers.delete(e.pointerId);if(!moved&&e.pointerType==='touch')inspect(e.clientX,e.clientY);drag=null;}
base.addEventListener('pointerup',release);base.addEventListener('pointercancel',release);base.addEventListener('pointerleave',()=>{$('#readout').hidden=true;});
base.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.001),e.clientX,e.clientY);},{passive:false});
function inspect(x,y){
  const [lon,lat]=invert(x,y),s=displaySample(screenGrid,x,y),el=$('#readout');if(y>state.h-mapBottomReserve())return;let html='';
  if(s){const speed=Math.hypot(s[0],s[1])*100,bearing=(Math.atan2(s[0],s[1])*180/Math.PI+360)%360;
    html=`<small>${lat.toFixed(3)}°N · ${Math.abs(lon).toFixed(3)}°W</small><div class="values">${s[2]!==null?`<div><strong>${s[2].toFixed(1)}°C</strong><small>WATER TEMP.</small></div>`:''}<div><strong>${speed.toFixed(1)}</strong><small>CM/S · ${Math.round(bearing)}° TRUE</small></div></div><small>${s[3]===5?'DFO STLE500 · SURFACE · ARCHIVED VECTOR MEAN':s[3]===4?'SIMCOE · UNVALIDATED DEPTH-AVERAGED WIND RESPONSE':s[3]===3?'DFO STLE200 · SURFACE':s[3]===2?'ECCC · DEPTH-AVERAGED':'NOAA · TOP MODEL LAYER'}${s[3]===4?' · FIXED-PERIOD MEAN':s[3]!==5&&state.mode==='average'?' · VECTOR MEAN':''}</small>`;
    const source=s[3]===5?state.outerEstuary:s[3]===3?state.estuary:s[3]===2?state.river:null;if(s[3]===4)html+='<small>'+simcoePeriod()+'</small>';else if(s[3]===5)html+='<small>12 Oct 00:00 – 17 Oct 12:00 UTC · 2026</small>';else if(source)html+='<small>'+(state.mode==='average'?dateLabel(source.start,true)+' – '+dateLabel(source.end,true):dateLabel(source.time))+'</small>';
  }else if(lon>-79.8&&lon<-79.05&&lat>44.1&&lat<44.85)html='<div class="nodata">Lake Simcoe<br>'+(state.simcoe?'No experimental vector in this cell.':'No current field is available in this deployment.')+'</div>';
  else{el.hidden=true;return;}
  el.innerHTML=html;el.hidden=false;el.style.left=Math.max(12,Math.min(state.w-el.offsetWidth-12,x+18))+'px';el.style.top=Math.max(12,Math.min(state.h-el.offsetHeight-mapBottomReserve(),y-30))+'px';
}

$$('[data-view]').forEach(b=>b.addEventListener('click',()=>fit(b.dataset.view)));
$$('[data-layer]').forEach(b=>b.addEventListener('click',()=>{state.layer=b.dataset.layer;updateLayerUI();redraw();}));
$('#zoom-in').onclick=()=>zoom(1.5);$('#zoom-out').onclick=()=>zoom(1/1.5);$('#reset').onclick=()=>fit();$('#refresh').onclick=()=>state.mode==='average'?refreshMeans(true):refresh(true);$('#latest').onclick=()=>state.mode==='live'?setFrame(state.frames.findLastIndex(f=>f.kind==='nowcast')):selectMode('live');
$('#timeline').addEventListener('input',e=>{state.playing=false;updatePlay();clearTimeout(state.scrubTimer);state.scrubTimer=setTimeout(()=>setFrame(Number(e.target.value)),150);});
$('#play').onclick=()=>{if(!state.frames.length){notice('The live timeline will be available when NOAA reconnects.');return;}state.playing=!state.playing;updatePlay();};
function setTimeControls(open,restoreFocus=false){$('#time-controls-panel').hidden=!open;$('#time-controls-toggle').setAttribute('aria-expanded',String(open));if(!open&&restoreFocus)$('#time-controls-toggle').focus();}
$('#time-controls-toggle').onclick=()=>setTimeControls($('#time-controls-panel').hidden);
$('#close-time-controls').onclick=()=>setTimeControls(false,true);
$('#source-button').onclick=()=>{$('#sources').hidden=false;$('#source-button').setAttribute('aria-expanded','true');$('#close-sources').focus();};
function closeSources(){$('#sources').hidden=true;$('#source-button').setAttribute('aria-expanded','false');$('#source-button').focus();}$('#close-sources').onclick=closeSources;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#sources').hidden)closeSources();else if(!$('#time-controls-panel').hidden)setTimeControls(false,true);}if(e.code==='Space'&&e.target===document.body){e.preventDefault();$('#play').click();}});
window.addEventListener('resize',()=>{clearTimeout(state.resizeTimer);state.resizeTimer=setTimeout(resize,100);});
async function loadRiver(mode,quiet=true){
  const results=await Promise.allSettled([loadJSON('./data/river'+(mode==='average'?'-average':'')+'.json'),loadJSON('./data/estuary'+(mode==='average'?'-average':'')+'.json')]);
  if(state.mode!==mode)return;
  if(results[0].status==='fulfilled')state.river=results[0].value;
  if(results[1].status==='fulfilled')state.estuary=results[1].value;
  updateTime();redraw(true);
  applyFreshness();if(results.some(r=>r.status==='rejected')){$('#river-status').textContent+=' · published file unavailable';if(!quiet)notice('A published river field is unavailable. Its retained field keeps its original date.');}
}
async function refreshMeans(showMessage=false){
  $('#refresh').disabled=true;
  try{await loadManifest();const results=await Promise.allSettled([loadJSON('./data/average.json'),loadJSON('./data/river-average.json'),loadJSON('./data/estuary-average.json')]);if(state.mode!=='average')return;
    for(let i=0;i<3;i++)if(results[i].status==='fulfilled')state[['field','river','estuary'][i]]=results[i].value;
    updateTime();redraw(true);applyFreshness();
    if(results.some(r=>r.status==='rejected')){if(showMessage)notice('Some published averages are unavailable. Their retained periods remain displayed.');}else if(showMessage)notice(state.manifest.allSourcesCurrent?'Published averages loaded; source periods are shown.':'Published averages loaded. Some sources retain dated fallback data.');
  }catch(e){state.publishedAvailable=false;if(showMessage)notice('Published averages could not refresh. Retained dates remain displayed.');}finally{applyFreshness();$('#refresh').disabled=false;}
}
async function selectMode(mode){
  if(mode===state.mode&&state.field)return;state.mode=mode;state.playing=false;state.request++;state.pending=false;updatePlay();
  $$('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));
  if(mode==='average'){
    const [lake,river,estuary]=await Promise.all([loadJSON('./data/average.json'),loadJSON('./data/river-average.json'),loadJSON('./data/estuary-average.json')]);if(state.mode!==mode)return;state.field=lake;state.river=river;state.estuary=estuary;updateTime();redraw(true);applyFreshness();
    refreshMeans(false);
  }else{
    state.field=state.savedLive||await loadJSON('./data/snapshot.json');[state.river,state.estuary]=await Promise.all([loadJSON('./data/river.json'),loadJSON('./data/estuary.json')]);updateTime();redraw(true);refresh();loadRiver(mode);}
}
$$('[data-mode]').forEach(b=>b.onclick=()=>selectMode(b.dataset.mode).catch(e=>notice('That view could not load. Refresh to try again.')));
async function init(){
  resize();requestAnimationFrame(animate);
  try{[state.geo,state.mesh,state.field,state.river,state.estuary]=await Promise.all([loadJSON('./geography.json'),loadJSON('./mesh.json'),loadJSON('./data/snapshot.json'),loadJSON('./data/river.json'),loadJSON('./data/estuary.json')]);
    // Keep the complete union shoreline: it includes both sides of Montréal and the upper river.
    // The Ontario vectors still use the exact native wet triangles.
    state.manifest=await loadJSON('./data/manifest.json');redraw(true);updateTime();applyFreshness();loadSimcoe();loadDrainage();loadOuterEstuary();refresh();loadRiver('live');
  }catch(e){notice('The map could not load. Refresh to try again.',30000);$('#feed-status span').textContent='Map unavailable';console.error(e);}
  tick();setInterval(()=>{if(state.mode==='live'){refresh();loadRiver('live');}},900000);
}

init();
