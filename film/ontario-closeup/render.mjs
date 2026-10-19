import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

// This is a standalone, deterministic map renderer. It does not load the website.
// Native Canvas pixel buffers need regular collection during long, large exports.
// Relaunch the same command with GC exposed so callers do not need runtime flags.
if(!global.gc){const child=spawn(process.execPath,[...process.execArgv.filter(a=>!/^--(?:no-)?expose-gc(?:=|$)/.test(a)),'--expose-gc',...process.argv.slice(1)],{stdio:'inherit'});child.once('error',e=>{console.error(e);process.exit(1);});child.once('exit',code=>process.exit(code??1));await once(child,'exit');process.exit();}
const cli=process.argv.slice(2), configArg=cli.find(x=>!x.startsWith('--'));
if(!configArg){console.error('Usage: node render.mjs config.json [--frames=15] [--width=1920] [--height=1440] [--no-video] [--no-poster]');process.exit(1);}
const configPath=path.resolve(configArg), root=path.dirname(configPath), cfg=JSON.parse(fs.readFileSync(configPath,'utf8'));
const arg=(key,fallback)=>{const a=cli.find(x=>x.startsWith('--'+key+'='));return a?a.slice(key.length+3):fallback;};
const resolve=p=>path.isAbsolute(p)?p:path.resolve(root,p);
const runtime=cfg.canvasModule?resolve(cfg.canvasModule):new URL('./package.json',import.meta.url);
let canvasLib;try{canvasLib=createRequire(runtime)('@napi-rs/canvas');}catch(e){throw new Error('Native @napi-rs/canvas is required. Set canvasModule to a package.json beside its node_modules. '+e.message);}
const {createCanvas,Path2D,GlobalFonts}=canvasLib;
for(const f of cfg.fontFiles||[])GlobalFonts.registerFromPath(resolve(f.path),f.family);
const json=p=>JSON.parse(fs.readFileSync(resolve(p),'utf8'));
const mesh=json(cfg.mesh), field=json(cfg.field), geo=json(cfg.geography), sources=(cfg.rivers||[]).map(json), drainage=cfg.drainage?json(cfg.drainage):null;
if(field.u.length!==mesh.triangles.length||field.v.length!==mesh.triangles.length)throw new Error('Lake vector field length does not match native mesh triangles');
const lake=geo.features.find(f=>f.properties?.name==='Lake Ontario');
if(lake&&cfg.useNativeOntarioCoast!==false)lake.geometry={type:'Polygon',coordinates:mesh.rings.map(r=>r.map(i=>[mesh.lon[i],mesh.lat[i]]))};
const seeded=(seed=cfg.seed||74129)=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const raw=(lon,lat)=>[(lon+180)/360,(1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2];
const stops=cfg.colorStops||[[13,48,86],[11,99,145],[25,145,176],[95,196,190],[221,225,167]];
function color(x){const q=Math.max(0,Math.min(.999999,x))*(stops.length-1),i=Math.floor(q),a=q-i;return stops[i].map((c,j)=>Math.round(c*(1-a)+stops[i+1][j]*a));}
const lerp=(a,b,t)=>a+(b-a)*t;
const rgb=a=>'rgb('+a.join(',')+')';
const polygons=g=>g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];

const globalConfig=cfg;
function renderer(W,H,cfg=globalConfig){
  const S=W/(cfg.designWidth||1920), rand=seeded(), bbox=cfg.bounds||[-80.2,42.95,-68.6,48.8];
  const mapRect=(cfg.mapRect||[65,185,1790,1120]).map(x=>x*S),[mx,my,mw,mh]=mapRect;
  const a=raw(bbox[0],bbox[3]),b=raw(bbox[2],bbox[1]);
  const k=Math.min(mw/(b[0]-a[0]),mh/(b[1]-a[1])),tx=mx+mw/2-(a[0]+b[0])/2*k,ty=my+mh/2-(a[1]+b[1])/2*k;
  const project=(lon,lat)=>{const p=raw(lon,lat);return [p[0]*k+tx,p[1]*k+ty];};
  const boundsTopLeft=project(bbox[0],bbox[3]),boundsBottomRight=project(bbox[2],bbox[1]);
  const clipBounds=ctx=>{if(cfg.clipToBounds){ctx.beginPath();ctx.rect(boundsTopLeft[0],boundsTopLeft[1],boundsBottomRight[0]-boundsTopLeft[0],boundsBottomRight[1]-boundsTopLeft[1]);ctx.clip();}};
  const invert=(x,y)=>[((x-tx)/k)*360-180,Math.atan(Math.sinh(Math.PI*(1-2*(y-ty)/k)))*180/Math.PI];
  const featurePath=geom=>{const p=new Path2D(),rings=geom.type==='LineString'?[geom.coordinates]:geom.type==='MultiLineString'?geom.coordinates:polygons(geom).flat();for(const ring of rings){ring.forEach((point,i)=>i?p.lineTo(...project(...point)):p.moveTo(...project(...point)));if(geom.type==='Polygon'||geom.type==='MultiPolygon')p.closePath();}return p;};
  const water=new Path2D(),waterPaths=[],coasts=new Path2D(),lines=[];
  for(const f of geo.features){
    const geom=f.geometry;
    if(geom.type==='LineString'||geom.type==='MultiLineString'){lines.push(f);continue;}
    for(const poly of polygons(geom)){const polygonPath=new Path2D();for(const ring of poly){for(let i=0;i<ring.length;i++){const p=project(...ring[i]);if(i===0){water.moveTo(...p);polygonPath.moveTo(...p);coasts.moveTo(...p);}else{water.lineTo(...p);polygonPath.lineTo(...p);coasts.lineTo(...p);}}water.closePath();polygonPath.closePath();coasts.closePath();}waterPaths.push(polygonPath);}
  }
  const cell=Number(cfg.gridCell||2),nx=Math.ceil(W/cell),ny=Math.ceil(H/cell),n=nx*ny;
  const U=new Float32Array(n).fill(NaN),V=new Float32Array(n),T=new Float32Array(n).fill(NaN),P=new Uint8Array(n);
  const px=new Float32Array(mesh.lon.length),py=new Float32Array(mesh.lon.length);
  for(let i=0;i<px.length;i++){const p=project(mesh.lon[i],mesh.lat[i]);px[i]=p[0]/cell;py[i]=p[1]/cell;}
  for(let f=0;f<mesh.triangles.length;f++){
    if(field.u[f]===null||field.v[f]===null||!Number.isFinite(field.u[f])||!Number.isFinite(field.v[f]))continue;
    const [aa,bb,cc]=mesh.triangles[f],ax=px[aa],ay=py[aa],bx=px[bb],by=py[bb],cx=px[cc],cy=py[cc];
    const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),x1=Math.min(nx-1,Math.floor(Math.max(ax,bx,cx)-.5));
    const y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),y1=Math.min(ny-1,Math.floor(Math.max(ay,by,cy)-.5));
    if(x0>x1||y0>y1)continue;
    const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-12)continue;
    for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){
      const x=i+.5,y=j+.5,wa=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den,wb=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den,wc=1-wa-wb;
      if(wa<-.00001||wb<-.00001||wc<-.00001)continue;
      const z=j*nx+i;U[z]=field.u[f];V[z]=field.v[f];P[z]=1;
      if(field.t&&field.t[aa]!==null&&field.t[bb]!==null&&field.t[cc]!==null)T[z]=field.t[aa]*wa+field.t[bb]*wb+field.t[cc]*wc;
    }
  }
  sources.forEach((r,ordinal)=>{
    const ll=project(r.west,r.south),ur=project(r.west+(r.width-1)*r.dx,r.south+(r.height-1)*r.dy);
    const x0=Math.max(0,Math.floor(Math.min(ll[0],ur[0])/cell)),x1=Math.min(nx-1,Math.ceil(Math.max(ll[0],ur[0])/cell));
    const y0=Math.max(0,Math.floor(Math.min(ll[1],ur[1])/cell)),y1=Math.min(ny-1,Math.ceil(Math.max(ll[1],ur[1])/cell));
    for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){
      const [lon,lat]=invert((i+.5)*cell,(j+.5)*cell),ix=Math.round((lon-r.west)/r.dx),iy=Math.round((lat-r.south)/r.dy);
      if(ix<0||iy<0||ix>=r.width||iy>=r.height)continue;
      const z=iy*r.width+ix;if(r.u[z]===null||r.v[z]===null||!Number.isFinite(r.u[z])||!Number.isFinite(r.v[z]))continue;
      const q=j*nx+i;if(P[q]&&(r.fallbackOnly||cfg.sourcePriority!=='last'))continue;U[q]=r.u[z];V[q]=r.v[z];P[q]=ordinal+2;if(r.t&&r.t[z]!==null)T[q]=r.t[z];
    }
  });
  // The field itself provides wet cells when no polygon exists (for example the estuary).
  // When supplied, exact shoreline polygons clip the final image, including islands.
  const mask=createCanvas(W,H),maskctx=mask.getContext('2d');clipBounds(maskctx);maskctx.fillStyle='#fff';for(const p of waterPaths)maskctx.fill(p,'evenodd');
  for(const f of lines){const p=new Path2D();const ls=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates;for(const line of ls){line.forEach((pnt,i)=>i?p.lineTo(...project(...pnt)):p.moveTo(...project(...pnt)));}maskctx.strokeStyle='#fff';maskctx.lineWidth=(cfg.riverLineWidth||3)*S;maskctx.lineJoin='round';maskctx.stroke(p);}
  let maskData;if(cfg.clipCurrentsToWater)maskData=maskctx.getImageData(0,0,W,H).data;
  const valid=[],providerCounts={};for(let z=0;z<n;z++)if(P[z]){
    if(maskData){const x=Math.min(W-1,Math.floor((z%nx+.5)*cell)),y=Math.min(H-1,Math.floor((Math.floor(z/nx)+.5)*cell));if(maskData[(y*W+x)*4+3]<80){P[z]=0;U[z]=NaN;continue;}}
    valid.push(z);providerCounts[P[z]]=(providerCounts[P[z]]||0)+1;
  }
  if(cfg.auditGrid){const file=resolve(cfg.auditGrid);fs.mkdirSync(path.dirname(file),{recursive:true});for(const [suffix,array] of [['u',U],['v',V],['provider',P]])fs.writeFileSync(file+'.'+suffix+'.bin',Buffer.from(array.buffer));fs.writeFileSync(file+'.json',JSON.stringify({W,H,cell,nx,ny,k,tx,ty,bounds:bbox,providerCounts}));}
  // A narrow river occupies far fewer screen cells than a lake or estuary.
  // Optional source weights allocate more particles to those actual wet cells;
  // they change drawing density only, never vectors, motion, speed or coverage.
  let seedGroups=null,seedTotal=0;const seedProbabilities={},seedRegions=cfg.seedRegions||[];
  if((cfg.providerSeedWeights&&Object.keys(cfg.providerSeedWeights).length)||seedRegions.length){const groups=new Map();for(const z of valid){const provider=P[z];let weight=Math.max(0,Number(cfg.providerSeedWeights?.[provider]??1));if(seedRegions.length){const [lon,lat]=invert((z%nx+.5)*cell,(Math.floor(z/nx)+.5)*cell);for(const region of seedRegions){const [west,south,east,north]=region.bounds;if(lon<west||lon>east||lat<south||lat>north||(region.providers&&!region.providers.includes(provider)))continue;weight=Math.max(weight,Number(region.weight||1));}}if(!Number.isFinite(weight)||weight===0)continue;const key=provider+':'+weight;if(!groups.has(key))groups.set(key,{provider,weight,cells:[]});groups.get(key).cells.push(z);}seedGroups=[];for(const g of groups.values()){const mass=g.cells.length*g.weight;seedTotal+=mass;seedGroups.push({...g,end:seedTotal,mass});}if(!seedTotal)throw new Error('Seed weights exclude every current cell');for(const g of seedGroups)seedProbabilities[g.provider]=(seedProbabilities[g.provider]||0)+g.mass/seedTotal;}
  if(!valid.length)throw new Error('No current samples in map bounds');
  const raster=createCanvas(nx,ny),rctx=raster.getContext('2d'),im=rctx.createImageData(nx,ny);
  const useTemperature=cfg.colorBy==='temperature';
  const speedRatio=speed=>cfg.speedScale==='log'?Math.log1p(speed/(cfg.speedLogOffset||.02))/Math.log1p((cfg.speedMax||1.5)/(cfg.speedLogOffset||.02)):speed/(cfg.speedMax||.65);
  for(const z of valid){const speed=Math.hypot(U[z],V[z]);const c=color(useTemperature&&Number.isFinite(T[z])?T[z]/(cfg.temperatureMax||25):speedRatio(speed));const i=z*4;im.data[i]=c[0]*(cfg.baseBrightness||.46);im.data[i+1]=c[1]*(cfg.baseBrightness||.46);im.data[i+2]=c[2]*(cfg.baseBrightness||.46);im.data[i+3]=255;}
  rctx.putImageData(im,0,0);
  const base=createCanvas(W,H),bg=base.getContext('2d');bg.fillStyle=cfg.background||'#020607';bg.fillRect(0,0,W,H);clipBounds(bg);bg.fillStyle=cfg.waterColor||'#071c26';for(const p of waterPaths)bg.fill(p,'evenodd');
  for(const f of lines){const p=new Path2D();const ls=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates;for(const line of ls)line.forEach((pnt,i)=>i?p.lineTo(...project(...pnt)):p.moveTo(...project(...pnt)));bg.strokeStyle=cfg.waterColor||'#071c26';bg.lineWidth=(cfg.riverLineWidth||3)*S;bg.lineJoin='round';bg.stroke(p);}
  bg.imageSmoothingEnabled=true;
  if(cfg.clipCurrentsToWater){const maskedRaster=createCanvas(W,H),mctx=maskedRaster.getContext('2d');mctx.drawImage(raster,0,0,nx*cell,ny*cell);mctx.globalCompositeOperation='destination-in';mctx.drawImage(mask,0,0);bg.drawImage(maskedRaster,0,0);}else bg.drawImage(raster,0,0,nx*cell,ny*cell);
  bg.strokeStyle=cfg.coastColor||'#17353e';bg.lineWidth=(cfg.coastWidth||.55)*S;bg.stroke(coasts);
  // Drainage context is geography, not a current product. It never contributes
  // cells to the water mask, field sampling, particle paths, or speed palette.
  if(drainage&&cfg.showDrainage!==false){bg.save();bg.lineCap='round';bg.lineJoin='round';for(const f of drainage.features||[]){const role=f.properties?.role,p=featurePath(f.geometry);bg.setLineDash([]);if(role==='divide'){bg.strokeStyle=cfg.divideColor||'#a58c58';bg.lineWidth=(cfg.divideWidth||1.4)*S;bg.setLineDash((cfg.divideDash||[5,4]).map(v=>v*S));}else if(role==='watershed'){bg.strokeStyle=cfg.watershedColor||'#304b4e';bg.lineWidth=(cfg.watershedWidth||.55)*S;}else{bg.strokeStyle=cfg.tributaryColor||'#36626c';bg.lineWidth=(cfg.tributaryWidth||.85)*S;}bg.stroke(p);}bg.restore();}
  const fixed=createCanvas(W,H),fx=fixed.getContext('2d');
  function text(str,x,y,size,{family=cfg.monoFont||'Consolas',color='#bdcccb',align='left',spacing=0,weight='',shadow=false}={}){fx.font=`${weight} ${size*S}px "${family}"`;fx.textAlign=align;fx.textBaseline='alphabetic';fx.fillStyle=color;fx.letterSpacing=spacing*S+'px';if(shadow){fx.shadowColor=cfg.background||'#020607';fx.shadowBlur=5*S;}fx.fillText(str,x*S,y*S);fx.shadowBlur=0;fx.letterSpacing='0px';}
  const header=cfg.header===false?false:{x:76,y:90,size:60,...cfg.header};
  if(header){const titleLines=(cfg.title||'Ontario, in motion').split('\n');titleLines.forEach((line,i)=>text(line,header.x,header.y+i*(header.lineHeight||header.size*1.06),header.size,{family:cfg.serifFont||'Georgia',color:header.color||'#e2e8e3',weight:header.weight||''}));
  if(cfg.subtitle)text(cfg.subtitle,header.x,header.y+(titleLines.length-1)*(header.lineHeight||header.size*1.06)+(header.subtitleGap||40),header.subtitleSize||16,{color:'#8cabae',spacing:1.6});}
  const edition=cfg.edition||{};if(edition.text)text(edition.text,edition.x||1840,edition.y||84,edition.size||13,{align:edition.align||'right',color:edition.color||'#96afb0',spacing:edition.spacing||1.1});
  for(const item of cfg.labels||[]){const p=project(item.lon,item.lat);const x=p[0]/S+(item.dx||0),y=p[1]/S+(item.dy||0);if(x<2||y<2||x>W/S-2||y>H/S-2)continue;
    if(item.dot!==false){fx.beginPath();fx.arc(p[0],p[1],(item.dotRadius||2)*S,0,Math.PI*2);fx.fillStyle=item.dotColor||'#bacfcb';fx.fill();}
    text(item.text,x,y,item.size||12,{family:item.family||cfg.monoFont||'Consolas',color:item.color||'#9db7b9',align:item.align||'left',spacing:item.spacing===undefined?.8:item.spacing,shadow:item.shadow!==false});
  }
  if(cfg.legend!==false){const l=cfg.legend||{},x=l.x||76,y=l.y||1250,w=l.width||230;const grad=fx.createLinearGradient(x*S,0,(x+w)*S,0);stops.forEach((c,i)=>grad.addColorStop(i/(stops.length-1),rgb(c)));fx.fillStyle=grad;fx.fillRect(x*S,y*S,w*S,5*S);text(l.title||'MEAN CURRENT SPEED',x,y-15,10,{color:'#78969b',spacing:1.5});if(l.ticks){for(const tick of l.ticks){const value=typeof tick==='number'?tick:tick.value,label=typeof tick==='number'?String(tick):tick.label,xx=x+speedRatio(value/100)*w;fx.fillStyle='#8ca6aa';fx.fillRect(xx*S,(y+5)*S,.6*S,5*S);text(label,xx,y+25,l.tickSize||10,{color:'#8ca6aa',align:value===0?'left':value>=Math.round((cfg.speedMax||.65)*100)?'right':'center'});}if(l.units)text(l.units,x+w+14,y+25,l.tickSize||10,{color:'#8ca6aa'});}else{text(l.min||'0',x,y+25,10,{color:'#8ca6aa'});text(l.max||`${Math.round((cfg.speedMax||.65)*100)}+ cm/s`,x+w,y+25,10,{color:'#8ca6aa',align:'right'});}}
  for(const note of cfg.footnotes||[])text(note.text,note.x||76,note.y,note.size||10,{color:note.color||'#69868b',align:note.align||'left',spacing:note.spacing||.3,family:note.family||cfg.monoFont||'Consolas'});
  const insetMetadata=[],animatedInsets=[];
  for(const inset of cfg.insets||[]){
    const iw=Math.round(inset.width*S),ih=Math.round(inset.height*S),ix=(inset.x||0)*S,iy=(inset.y||0)*S;
    const insetCfg={...cfg,designWidth:inset.width,bounds:inset.bounds,mapRect:[inset.padding||8,inset.padding||8,inset.width-2*(inset.padding||8),inset.height-2*(inset.padding||8)],title:'',subtitle:null,header:false,edition:{},legend:false,footnotes:[],insets:[],labels:inset.labels||[],particleCount:inset.particleCount||3000,particleWidth:inset.particleWidth||.65,coastWidth:inset.coastWidth||.6,...inset.options};
    const mini=renderer(iw,ih,insetCfg);for(let i=0;i<(inset.warmupFrames||100);i++){mini.step(1/(cfg.fps||30));if(i%5===0)global.gc();}animatedInsets.push({mini,ix,iy});fx.strokeStyle=inset.borderColor||'#173139';fx.lineWidth=.65*S;fx.strokeRect(ix,iy,iw,ih);if(inset.title)text(inset.title,inset.x,inset.y-16,inset.titleSize||12,{color:inset.titleColor||'#9ab5b8',spacing:1.2});insetMetadata.push({title:inset.title,animated:true,...mini.metadata});
  }
  const flow=createCanvas(W,H),ink=flow.getContext('2d'),out=createCanvas(W,H),ctx=out.getContext('2d');
  const history=ink.createImageData(W,H);for(let i=3;i<history.data.length;i+=4)history.data[i]=255;
  const seedDensityCompensation=cfg.preserveUnweightedSeedDensity&&seedGroups?seedTotal/valid.length:1;
  const count=Math.round((cfg.particleCount||16000)*(W/(cfg.designWidth||1920))**1.3*seedDensityCompensation),particles=Array.from({length:count},()=>({}));
  const index=(x,y)=>x<0||y<0||x>=W||y>=H?-1:Math.floor(y/cell)*nx+Math.floor(x/cell);
  const reset=(p,randomAge=false)=>{let cells=valid;if(seedGroups){const sample=rand()*seedTotal;cells=seedGroups.find(g=>sample<g.end).cells;}const z=cells[Math.floor(rand()*cells.length)];p.x=(z%nx+rand())*cell;p.y=(Math.floor(z/nx)+rand())*cell;p.life=(cfg.particleMinLife||70)+rand()*(cfg.particleLifeRange||110);p.age=randomAge?rand()*p.life:0;};
  particles.forEach(p=>reset(p,true));
  // A bounded display-only boost makes weak, nonzero vectors leave readable
  // trails. The stored vectors and speed colours remain unchanged; zero stays
  // zero. This is opt-in because screen motion then has no uniform time scale.
  const displayMinimum=(cfg.minDisplaySpeed||0)*S/(cfg.motionAcceleration||90000);
  const displayBoost=speed=>speed>1e-12?Math.min(cfg.maxDisplayBoost||8,Math.max(1,displayMinimum/speed)):1;
  function step(dt){
    ink.setTransform(1,0,0,1,0,0);ink.clearRect(0,0,W,H);ink.putImageData(history,0,0);
    ink.globalCompositeOperation='source-over';ink.fillStyle=`rgba(0,0,0,${1-(cfg.trailRetention||.965)})`;ink.fillRect(0,0,W,H);
    const buckets=Array.from({length:24},()=>[]),seconds=dt*(cfg.motionAcceleration||90000);
    for(const p of particles){if(p.age++>p.life){reset(p);continue;}let remaining=seconds,substeps=0;
      while(remaining>1e-6&&substeps++<250){
        const z=index(p.x,p.y);if(z<0||!P[z]){reset(p);break;}
        const lat=invert(p.x,p.y)[1],scale=k/(360*111320*Math.cos(lat*Math.PI/180)),screenSpeed=Math.hypot(U[z],V[z])*scale,boost=displayBoost(screenSpeed);
        const limit=cfg.maxParticleStep||.75,ox=p.x,oy=p.y;
        let stepTime=Math.min(remaining,limit/Math.max(1e-12,screenSpeed*boost));
        let mid=index(ox+U[z]*boost*stepTime*scale*.5,oy-V[z]*boost*stepTime*scale*.5);if(mid<0||!P[mid]){reset(p);break;}
        // Midpoint integration resamples direction at every small screen step.
        let midSpeed=Math.hypot(U[mid],V[mid])*scale,midBoost=displayBoost(midSpeed);
        if(midSpeed*midBoost*stepTime>limit){stepTime=limit/(midSpeed*midBoost);mid=index(ox+U[z]*boost*stepTime*scale*.5,oy-V[z]*boost*stepTime*scale*.5);if(mid<0||!P[mid]){reset(p);break;}midSpeed=Math.hypot(U[mid],V[mid])*scale;midBoost=displayBoost(midSpeed);}
        // A sharp cell transition must not defeat the spatial step bound.
        stepTime=Math.min(stepTime,limit/Math.max(1e-12,midSpeed*midBoost));
        const nx=ox+U[mid]*midBoost*stepTime*scale,ny=oy-V[mid]*midBoost*stepTime*scale,nz=index(nx,ny);
        if(nz<0||!P[nz]){reset(p);break;}p.x=nx;p.y=ny;remaining-=stepTime;
        // Round caps paint a dot even for a zero-length stroke. Do not make
        // a zero vector flicker as stationary particles are reseeded.
        if(p.x!==ox||p.y!==oy){const q=useTemperature&&Number.isFinite(T[z])?T[z]/(cfg.temperatureMax||25):speedRatio(Math.hypot(U[z],V[z])),b=Math.max(0,Math.min(23,Math.floor(q*24)));buckets[b].push(ox,oy,p.x,p.y);}
      }
    }
    ink.lineWidth=(cfg.particleWidth||.72)*S;ink.lineCap='round';
    for(let b=0;b<buckets.length;b++){if(!buckets[b].length)continue;const c=color(b/23);ink.strokeStyle=`rgba(${c.join(',')},${cfg.particleOpacity||.64})`;ink.beginPath();const points=buckets[b];for(let n=0;n<points.length;n+=4){ink.moveTo(points[n],points[n+1]);ink.lineTo(points[n+2],points[n+3]);}ink.stroke();}
    if(cfg.clipCurrentsToWater){ink.globalCompositeOperation='destination-in';ink.drawImage(mask,0,0);ink.globalCompositeOperation='destination-over';ink.fillStyle='#000';ink.fillRect(0,0,W,H);ink.globalCompositeOperation='source-over';}
    // Canvas.data() is a bounded raw native view; getImageData allocates a native
    // snapshot on every invocation in this runtime. Keep one opaque ImageData
    // history buffer, then copy the raw RGBA pixels (alpha is always 255).
    history.data.set(flow.data());
    for(const inset of animatedInsets)inset.mini.step(dt);
  }
  function frame(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);ctx.drawImage(base,0,0);ctx.globalCompositeOperation='screen';ctx.drawImage(flow,0,0);ctx.globalCompositeOperation='source-over';for(const inset of animatedInsets)ctx.drawImage(inset.mini.frame(),inset.ix,inset.iy);ctx.drawImage(fixed,0,0);return out;}
  return {step,frame,project,metadata:{width:W,height:H,gridCell:cell,validGridCells:valid.length,providerCounts,particles:count,minDisplaySpeed:cfg.minDisplaySpeed||0,maxDisplayBoost:cfg.maxDisplayBoost||8,providerSeedWeights:cfg.providerSeedWeights||null,seedRegions,seedDensityCompensation,seedProbabilities:seedGroups?seedProbabilities:null,seedGroups:seedGroups?.map(g=>({provider:g.provider,weight:g.weight,wetCells:g.cells.length,probability:g.mass/seedTotal}))||null,bounds:bbox,projection:'Web Mercator',mapRect,insets:insetMetadata}};
}

const fps=Number(arg('fps',cfg.fps||30)),frames=Number(arg('frames',Math.round((cfg.duration||20)*fps)));
const width=Number(arg('width',cfg.width||1920)),height=Number(arg('height',cfg.height||1440));
const video=cfg.video&& !cli.includes('--no-video')?resolve(cfg.video):null,poster=cfg.poster&&!cli.includes('--no-poster')?resolve(cfg.poster):null;
if(video||poster){for(const p of [video,poster].filter(Boolean))fs.mkdirSync(path.dirname(p),{recursive:true});}
const report={started:new Date().toISOString(),config:configPath,inputs:{mesh:resolve(cfg.mesh),field:resolve(cfg.field),geography:resolve(cfg.geography),rivers:(cfg.rivers||[]).map(resolve),drainage:cfg.drainage?resolve(cfg.drainage):null},fieldPeriod:{start:field.start,end:field.end,sampleCount:field.sampleCount},fps,frames,video,poster,seed:cfg.seed||74129,motionAcceleration:cfg.motionAcceleration||90000,peakRss:0};
function memory(){report.peakRss=Math.max(report.peakRss,process.memoryUsage().rss);}
if(video){
  const r=renderer(width,height);report.videoMap=r.metadata;console.log(JSON.stringify({stage:'video-ready',...r.metadata}));
  for(let i=0;i<(cfg.warmupFrames||90);i++){r.step(1/fps);if(i%5===0){memory();global.gc();}}
  const ffmpeg=cfg.ffmpeg||process.env.FFMPEG_BINARY||'ffmpeg';
  const ff=spawn(ffmpeg,['-y','-hide_banner','-loglevel','warning','-f','rawvideo','-pixel_format','rgba','-video_size',`${width}x${height}`,'-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset',cfg.preset||'medium','-crf',String(cfg.crf||18),'-pix_fmt','yuv420p','-threads','2','-filter_threads','1','-movflags','+faststart',video],{stdio:['pipe','ignore','pipe']});
  let ffErrors='';ff.stderr.on('data',chunk=>{ffErrors+=String(chunk);});ff.stdin.on('error',()=>{});const closed=once(ff,'close');
  for(let i=0;i<frames;i++){
    r.step(1/fps);const canvas=r.frame(),buffer=canvas.data();
    if(!ff.stdin.write(buffer))await Promise.race([once(ff.stdin,'drain'),closed.then(()=>{throw new Error('FFmpeg closed unexpectedly: '+ffErrors);})]);
    if(i%5===0){memory();global.gc();}
    if(i%30===0||i===frames-1){memory();console.log(JSON.stringify({stage:'frame',frame:i+1,total:frames,rssMiB:Math.round(process.memoryUsage().rss/1048576)}));}
  }
  ff.stdin.end();const [code]=await closed;if(code!==0)throw new Error('FFmpeg failed '+code+': '+ffErrors);report.ffmpegMessages=ffErrors.trim();
}
if(poster){
  const posterW=Number(arg('poster-width',cfg.posterWidth||3600)),posterH=Number(arg('poster-height',cfg.posterHeight||2700)),r=renderer(posterW,posterH);report.posterMap=r.metadata;
  for(let i=0;i<(cfg.posterFrames||150);i++){r.step(1/fps);if(i%5===0){memory();global.gc();}}await fs.promises.writeFile(poster,await r.frame().encode('png'));memory();console.log(JSON.stringify({stage:'poster-complete',path:poster,...r.metadata}));
}
report.completed=new Date().toISOString();if(cfg.manifest)fs.writeFileSync(resolve(cfg.manifest),JSON.stringify(report,null,2));console.log(JSON.stringify({stage:'complete',video,poster,peakRssMiB:Math.round(report.peakRss/1048576)}));
