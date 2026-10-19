import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createTemporalField} from './temporal-field.mjs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';

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
const mesh=json(cfg.mesh), geo=json(cfg.geography), sources=(cfg.rivers||[]).map(json), drainage=cfg.drainage?json(cfg.drainage):null;
const datasetPath=resolve(cfg.hourlyManifest), datasetRoot=path.dirname(datasetPath), dataset=json(cfg.hourlyManifest);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(hash(fs.readFileSync(resolve(cfg.mesh)))!==dataset.mesh.sha256)throw new Error('Hourly source mesh hash mismatch');
const sourceArrays={};
for(const name of ['u','v','t']){const record=dataset.arrays[name],bytes=fs.readFileSync(path.resolve(datasetRoot,record.file));
  if(record.dtype!=='float32'||record.endianness!=='little'||bytes.length!==record.bytes||hash(bytes)!==record.sha256)throw new Error('Hourly array failed integrity check: '+name);
  sourceArrays[name]=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
}
if(new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]!==4)throw new Error('Little-endian renderer runtime required');
const epoch=Date.parse(dataset.times[0]),sourceTimes=dataset.times.map(value=>(Date.parse(value)-epoch)/1000);
if(cfg.expectedHours!==undefined&&sourceTimes.length!==cfg.expectedHours+1)throw new Error('Hourly endpoint count differs from requested week');
const modelDuration=sourceTimes.at(-1),field={u:sourceArrays.u.subarray(0,mesh.triangles.length),v:sourceArrays.v.subarray(0,mesh.triangles.length),t:sourceArrays.t.subarray(0,mesh.lon.length),start:dataset.start,end:dataset.last_requested_hour,sampleCount:dataset.requested_hour_count};
if(cfg.insets?.length)throw new Error('This chronological edition intentionally has no insets');
if(field.u.length!==mesh.triangles.length||field.v.length!==mesh.triangles.length)throw new Error('Lake vector field length does not match native mesh triangles');
let meshVectors=null;if(cfg.meshInterpolation==='centroid-fan'){if(!cfg.meshFlowModule)throw new Error('meshFlowModule is required for centroid-fan interpolation');await import(pathToFileURL(resolve(cfg.meshFlowModule)).href);meshVectors=globalThis.MeshFlow.reconstruct(mesh,field);}
const temporal=createTemporalField(mesh,{times:sourceTimes,...sourceArrays},globalThis.MeshFlow.reconstruct);
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
  const FID=new Int32Array(n).fill(-1),WAF=new Float32Array(n),WBF=new Float32Array(n);
  const px=new Float32Array(mesh.lon.length),py=new Float32Array(mesh.lon.length);
  for(let i=0;i<px.length;i++){const p=project(mesh.lon[i],mesh.lat[i]);px[i]=p[0]/cell;py[i]=p[1]/cell;}
  for(let f=0;f<mesh.triangles.length;f++){
    const velocityValid=Number.isFinite(field.u[f])&&Number.isFinite(field.v[f]);
    const [aa,bb,cc]=mesh.triangles[f],ax=px[aa],ay=py[aa],bx=px[bb],by=py[bb],cx=px[cc],cy=py[cc];
    // Temperature coverage is independent of the selected velocity provider.
    const temperatureValid=field.t&&[aa,bb,cc].every(i=>Number.isFinite(field.t[i]));
    // Geometry ownership is independent of the first hour's data validity.
    const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),x1=Math.min(nx-1,Math.floor(Math.max(ax,bx,cx)-.5));
    const y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),y1=Math.min(ny-1,Math.floor(Math.max(ay,by,cy)-.5));
    if(x0>x1||y0>y1)continue;
    const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-12)continue;
    for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){
      const x=i+.5,y=j+.5,wa=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den,wb=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den,wc=1-wa-wb;
      if(wa<-.00001||wb<-.00001||wc<-.00001)continue;
      const z=j*nx+i;FID[z]=f;WAF[z]=wa;WBF[z]=wb;P[z]=1;
      if(velocityValid){if(meshVectors){const q=3*f,ra=Math.max(0,wa),rb=Math.max(0,wb),rc=Math.max(0,wc),sum=ra+rb+rc,m=Math.min(ra,rb,rc);
        U[z]=(3*m*meshVectors.faceU[f]+(ra-m)*meshVectors.cornerU[q]+(rb-m)*meshVectors.cornerU[q+1]+(rc-m)*meshVectors.cornerU[q+2])/sum;
        V[z]=(3*m*meshVectors.faceV[f]+(ra-m)*meshVectors.cornerV[q]+(rb-m)*meshVectors.cornerV[q+1]+(rc-m)*meshVectors.cornerV[q+2])/sum;
      }else{U[z]=field.u[f];V[z]=field.v[f];}P[z]=1;}
      if(temperatureValid)T[z]=field.t[aa]*wa+field.t[bb]*wb+field.t[cc]*wc;
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
      // A regional hydraulic estimate needs one coherent field through its
      // domain. An explicit opt-in can prefer it over overlapping lake-mesh
      // triangles; fallback remains the default for every existing edition.
      const q=j*nx+i;if(P[q]&&((r.fallbackOnly&&cfg.riverSourcePriority!=='model')||cfg.sourcePriority!=='last'))continue;U[q]=r.u[z];V[q]=r.v[z];P[q]=ordinal+2;if(r.t&&Number.isFinite(r.t[z]))T[q]=r.t[z];
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
  if(cfg.auditGrid){const file=resolve(cfg.auditGrid);fs.mkdirSync(path.dirname(file),{recursive:true});for(const [suffix,array] of [['u',U],['v',V],['t',T],['provider',P],['face',FID],['wa',WAF],['wb',WBF]])fs.writeFileSync(file+'.'+suffix+'.bin',Buffer.from(array.buffer));fs.writeFileSync(file+'.json',JSON.stringify({W,H,cell,nx,ny,k,tx,ty,bounds:bbox,providerCounts}));}
  // A narrow river occupies far fewer screen cells than a lake or estuary.
  // Optional source weights allocate more particles to those actual wet cells;
  // they change drawing density only, never vectors, motion, speed or coverage.
  let seedGroups=null,seedTotal=0;const seedProbabilities={},seedRegions=cfg.seedRegions||[];
  if((cfg.providerSeedWeights&&Object.keys(cfg.providerSeedWeights).length)||seedRegions.length){const groups=new Map();for(const z of valid){const provider=P[z];let weight=Math.max(0,Number(cfg.providerSeedWeights?.[provider]??1));if(seedRegions.length){const [lon,lat]=invert((z%nx+.5)*cell,(Math.floor(z/nx)+.5)*cell);for(const region of seedRegions){const [west,south,east,north]=region.bounds;if(lon<west||lon>east||lat<south||lat>north||(region.providers&&!region.providers.includes(provider)))continue;weight=Math.max(weight,Number(region.weight||1));}}if(!Number.isFinite(weight)||weight===0)continue;const key=provider+':'+weight;if(!groups.has(key))groups.set(key,{provider,weight,cells:[]});groups.get(key).cells.push(z);}seedGroups=[];for(const g of groups.values()){const mass=g.cells.length*g.weight;seedTotal+=mass;seedGroups.push({...g,end:seedTotal,mass});}if(!seedTotal)throw new Error('Seed weights exclude every current cell');for(const g of seedGroups)seedProbabilities[g.provider]=(seedProbabilities[g.provider]||0)+g.mass/seedTotal;}
  if(!valid.length)throw new Error('No current samples in map bounds');
  const useTemperature=true;
  const temperatureMin=Number(cfg.temperatureMin),temperatureMax=Number(cfg.temperatureMax);
  if(!(Number.isFinite(temperatureMin)&&Number.isFinite(temperatureMax)&&temperatureMax>temperatureMin))throw new Error('Invalid fixed thermal scale');
  const temperatureRatio=value=>Number.isFinite(value)?(value-temperatureMin)/(temperatureMax-temperatureMin):null;
  const missingTemperatureColor=cfg.missingTemperatureColor||[158,174,179];
  const speedRatio=speed=>speed/(cfg.speedMax||1.5);
  const base=createCanvas(W,H),bg=base.getContext('2d');bg.fillStyle=cfg.background||'#020607';bg.fillRect(0,0,W,H);clipBounds(bg);bg.fillStyle=cfg.waterColor||'#0a2632';for(const p of waterPaths)bg.fill(p,'evenodd');
  for(const f of lines){const p=featurePath(f.geometry);bg.strokeStyle=cfg.waterColor||'#0a2632';bg.lineWidth=(cfg.riverLineWidth||3)*S;bg.lineJoin='round';bg.stroke(p);}
  const thermalCanvas=createCanvas(W,H),thermalContext=thermalCanvas.getContext('2d'),thermalImage=thermalContext.createImageData(W,H),thermalPixels=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const z=Math.min(ny-1,Math.floor((y+.5)/cell))*nx+Math.min(nx-1,Math.floor((x+.5)/cell));if(P[z])thermalPixels.push([4*(y*W+x),z]);}
  const thermalCoverage=[];
  function paintThermal(seconds){let finite=0,missing=0,below=0,above=0,min=Infinity,max=-Infinity;
    for(const [offset,z] of thermalPixels){const face=FID[z],a=WAF[z],b=WBF[z];let value=face>=0?temporal.sampleTemperature(face,a,b,1-a-b,seconds):NaN;
      if(!Number.isFinite(value)&&P[z]>1&&Number.isFinite(T[z])&&face<0)value=T[z];
      if(Number.isFinite(value)){finite++;min=Math.min(min,value);max=Math.max(max,value);below+=value<temperatureMin;above+=value>temperatureMax;
        const q=Math.max(0,Math.min(.999999,(value-temperatureMin)/(temperatureMax-temperatureMin)))*(stops.length-1),i=Math.floor(q),w=q-i;
        for(let c=0;c<3;c++)thermalImage.data[offset+c]=(stops[i][c]*(1-w)+stops[i+1][c]*w)*(cfg.baseBrightness??.3);
      }else{missing++;for(let c=0;c<3;c++)thermalImage.data[offset+c]=missingTemperatureColor[c]*(cfg.baseBrightness??.3);}
      thermalImage.data[offset+3]=255;
    }
    thermalContext.putImageData(thermalImage,0,0);if(cfg.clipCurrentsToWater){thermalContext.globalCompositeOperation='destination-in';thermalContext.drawImage(mask,0,0);thermalContext.globalCompositeOperation='source-over';}
    const coverage={seconds,finite,missing,below,above,min:Number.isFinite(min)?min:null,max:Number.isFinite(max)?max:null};thermalCoverage.push(coverage);return coverage;
  }
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
  if(cfg.legend!==false){const l=cfg.legend||{},x=l.x||76,y=l.y||1250,w=l.width||230;const grad=fx.createLinearGradient(x*S,0,(x+w)*S,0);stops.forEach((c,i)=>grad.addColorStop(i/(stops.length-1),rgb(c)));fx.fillStyle=grad;fx.fillRect(x*S,y*S,w*S,5*S);text(l.title||(useTemperature?'WATER TEMPERATURE':'MEAN CURRENT SPEED'),x,y-15,10,{color:'#78969b',spacing:1.5});if(l.ticks){for(const tick of l.ticks){const value=typeof tick==='number'?tick:tick.value,label=typeof tick==='number'?String(tick):tick.label,xx=x+(useTemperature?temperatureRatio(value):speedRatio(value/100))*w;fx.fillStyle='#8ca6aa';fx.fillRect(xx*S,(y+5)*S,.6*S,5*S);text(label,xx,y+25,l.tickSize||10,{color:'#8ca6aa',align:value<=(useTemperature?temperatureMin:0)?'left':value>=(useTemperature?temperatureMax:Math.round((cfg.speedMax||.65)*100))?'right':'center'});}if(l.units)text(l.units,x+w+14,y+25,l.tickSize||10,{color:'#8ca6aa'});}else{text(l.min??(useTemperature?String(temperatureMin):'0'),x,y+25,10,{color:'#8ca6aa'});text(l.max??(useTemperature?`${temperatureMax}°C`:`${Math.round((cfg.speedMax||.65)*100)}+ cm/s`),x+w,y+25,10,{color:'#8ca6aa',align:'right'});}}
  for(const note of cfg.footnotes||[])text(note.text,note.x||76,note.y,note.size||10,{color:note.color||'#69868b',align:note.align||'left',spacing:note.spacing||.3,family:note.family||cfg.monoFont||'Consolas'});
  const insetMetadata=[],animatedInsets=[];
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
  const activeDuration=Number(cfg.activeDuration||24),secondsPerVideoSecond=modelDuration/activeDuration;
  const displayMinimum=(cfg.riverMinDisplaySpeed??12)*S/secondsPerVideoSecond;
  const displayBoost=(speed,provider)=>provider>1&&speed>1e-12?Math.min(cfg.maxDisplayBoost||1024,Math.max(1,displayMinimum/speed)):1;
  const firstSample=new Float64Array(3),midSample=new Float64Array(3);
  const metrics={segments:0,maximumSegmentPixels:0,hourSplits:0,invalidResets:0,substepLimitResets:0,zeroSegments:0};
  function sampleAt(x,y,seconds,out){const z=index(x,y);if(z<0||!P[z]){out.fill(NaN);return 0;}const f=FID[z],a=WAF[z],b=WBF[z];if(f>=0)temporal.sample(f,a,b,1-a-b,seconds,out);else out.fill(NaN);
    if(P[z]>1){out[0]=U[z];out[1]=V[z];if(!Number.isFinite(out[2])&&f<0&&Number.isFinite(T[z]))out[2]=T[z];}return P[z];
  }
  function step(dt,startSeconds,endSeconds,freezeField=false){
    if(!(endSeconds>=startSeconds&&startSeconds>=0&&endSeconds<=modelDuration))throw new Error('Invalid chronological advection interval');
    temporal.prepare(freezeField?0:startSeconds,freezeField?0:endSeconds);
    ink.setTransform(1,0,0,1,0,0);ink.clearRect(0,0,W,H);ink.putImageData(history,0,0);
    ink.globalCompositeOperation='source-over';ink.fillStyle=`rgba(0,0,0,${1-Math.pow(cfg.trailRetention??.92,dt*30)})`;ink.fillRect(0,0,W,H);
    const buckets=Array.from({length:25},()=>[]),total=endSeconds-startSeconds;
    for(const p of particles){if(p.age++>p.life){reset(p);continue;}let remaining=total,substeps=0;
      while(remaining>1e-7&&substeps++<1000){
        const now=freezeField?0:startSeconds+total-remaining,provider=sampleAt(p.x,p.y,now,firstSample);
        if(!provider||!Number.isFinite(firstSample[0])||!Number.isFinite(firstSample[1])){metrics.invalidResets++;reset(p);break;}
        const ox=p.x,oy=p.y,lat=invert(ox,oy)[1],scale=k/(360*111320*Math.cos(lat*Math.PI/180)),speed=Math.hypot(firstSample[0],firstSample[1])*scale,boost=displayBoost(speed,provider),limit=cfg.maxParticleStep||.2;
        let h=Math.min(remaining,limit/Math.max(1e-12,speed*boost));
        if(!freezeField){const boundary=(Math.floor((now+1e-8)/3600)+1)*3600;if(boundary>now+1e-7&&h>boundary-now){h=boundary-now;metrics.hourSplits++;}}
        let midProvider=0,midScale=scale,midBoost=1,good=false;
        for(let refine=0;refine<8;refine++){
          const mx=ox+firstSample[0]*boost*h*scale*.5,my=oy-firstSample[1]*boost*h*scale*.5,mt=freezeField?0:Math.min(modelDuration,now+h*.5);
          midProvider=sampleAt(mx,my,mt,midSample);if(!midProvider||!Number.isFinite(midSample[0])||!Number.isFinite(midSample[1]))break;
          midScale=k/(360*111320*Math.cos(invert(mx,my)[1]*Math.PI/180));const midSpeed=Math.hypot(midSample[0],midSample[1])*midScale;midBoost=displayBoost(midSpeed,midProvider);
          if(midSpeed*midBoost*h<=limit*(1+1e-10)){good=true;break;}h=Math.min(h*.9,limit/Math.max(1e-12,midSpeed*midBoost));
        }
        if(!good||!(h>0)){metrics.invalidResets++;reset(p);break;}
        const x=ox+midSample[0]*midBoost*h*midScale,y=oy-midSample[1]*midBoost*h*midScale,z=index(x,y);
        if(z<0||!P[z]){metrics.invalidResets++;reset(p);break;}
        p.x=x;p.y=y;remaining=Math.max(0,remaining-h);const length=Math.hypot(x-ox,y-oy);metrics.maximumSegmentPixels=Math.max(metrics.maximumSegmentPixels,length);
        if(length>0){const q=temperatureRatio(midSample[2]),bucket=q===null?24:Math.max(0,Math.min(23,Math.floor(q*24)));buckets[bucket].push(ox,oy,x,y);metrics.segments++;}else metrics.zeroSegments++;
      }
      if(substeps>=1000&&remaining>1e-7){metrics.substepLimitResets++;reset(p);}
    }
    ink.lineWidth=(cfg.particleWidth||.78)*S;ink.lineCap='round';
    for(let b=0;b<25;b++){if(!buckets[b].length)continue;const c=b===24?missingTemperatureColor:color(b/23);ink.strokeStyle=`rgba(${c.join(',')},${cfg.particleOpacity??.94})`;ink.beginPath();const points=buckets[b];for(let i=0;i<points.length;i+=4){ink.moveTo(points[i],points[i+1]);ink.lineTo(points[i+2],points[i+3]);}ink.stroke();}
    if(cfg.clipCurrentsToWater){ink.globalCompositeOperation='destination-in';ink.drawImage(mask,0,0);ink.globalCompositeOperation='destination-over';ink.fillStyle='#000';ink.fillRect(0,0,W,H);ink.globalCompositeOperation='source-over';}history.data.set(flow.data());
  }
  function clock(ctx,seconds,replay=false){const options=cfg.clock||{},x=(options.x??78)*S,y=(options.y??220)*S,w=(options.width??320)*S;
    const date=new Date(epoch+seconds*1000),label=`${String(date.getUTCDate()).padStart(2,'0')} OCT ${String(date.getUTCHours()).padStart(2,'0')}:${String(date.getUTCMinutes()).padStart(2,'0')} UTC`;
    ctx.save();ctx.font=`${(options.size??15)*S}px "${cfg.monoFont||'Consolas'}"`;ctx.textAlign='left';ctx.fillStyle='#b6ced0';ctx.fillText(replay?'REPLAY \u00b7 WEEK RESTARTS':label,x,y);ctx.fillStyle='#18343c';ctx.fillRect(x,y+14*S,w,2*S);ctx.fillStyle='#7abac2';ctx.fillRect(x,y+14*S,w*Math.min(1,seconds/modelDuration),2*S);ctx.restore();return label;
  }
  function frame(seconds){paintThermal(seconds);ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);ctx.drawImage(base,0,0);ctx.drawImage(thermalCanvas,0,0);ctx.strokeStyle=cfg.coastColor||'#2d5b65';ctx.lineWidth=(cfg.coastWidth||.55)*S;ctx.stroke(coasts);ctx.globalCompositeOperation='screen';ctx.drawImage(flow,0,0);ctx.globalCompositeOperation='source-over';ctx.drawImage(fixed,0,0);clock(ctx,seconds);return out;}
  function probes(seconds){return (cfg.auditProbes||[]).map(probe=>{const [x,y]=project(probe.lon,probe.lat),out=new Float64Array(3),provider=sampleAt(x,y,seconds,out);return {name:probe.name,provider,u:out[0],v:out[1],temperature:out[2]};});}
  function replayFrame(tail,head,alpha){ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.drawImage(tail,0,0);ctx.globalAlpha=alpha;ctx.drawImage(head,0,0);ctx.globalAlpha=1;
    if(alpha<1){const q=Math.min(1,Math.sin(Math.PI*alpha)*3),options=cfg.clock||{},x=(options.x??78)*S,y=(options.y??220)*S;ctx.save();ctx.globalAlpha=q;ctx.fillStyle=cfg.background||'#020607';ctx.fillRect(x-5*S,y-20*S,(options.width??320)*S+12*S,46*S);clock(ctx,0,true);ctx.restore();}return out;
  }
  return {step,frame,replayFrame,probes,sampleAt,clock,metadata:{width:W,height:H,gridCell:cell,validGridCells:valid.length,providerCounts,particles:count,bounds:bbox,projection:'Web Mercator',mapRect,temperatureRange:[temperatureMin,temperatureMax],missingTemperatureColor,lakeMotionBoost:1,riverMinDisplaySpeed:cfg.riverMinDisplaySpeed??12,maxDisplayBoost:cfg.maxDisplayBoost||1024,secondsPerVideoSecond,seedDensityCompensation,seedProbabilities,metrics,thermalCoverage}};

}

const fps=Number(arg('fps',cfg.fps||30)),activeFrames=Math.round((cfg.activeDuration||24)*fps),restartFrames=Math.round((cfg.restartDuration??1)*fps),totalFrames=activeFrames+restartFrames;
const requested=Number(arg('frames',totalFrames)),width=Number(arg('width',cfg.width||2560)),height=Number(arg('height',cfg.height||1440));
const video=cfg.video&&!cli.includes('--no-video')?resolve(cfg.video):null;
const report={started:new Date().toISOString(),config:configPath,configSHA256:hash(fs.readFileSync(configPath)),datasetSHA256:hash(fs.readFileSync(datasetPath)),dataset:datasetPath,period:{start:dataset.start,endExclusive:dataset.calendar_end_exclusive,hourlyFields:dataset.requested_hour_count,closingEndpoint:dataset.closing_endpoint},fps,activeFrames,restartFrames,totalFrames,requested,video,sourceClock:[],peakRss:0};
const r=renderer(width,height);report.map=r.metadata;
const memory=()=>{report.peakRss=Math.max(report.peakRss,process.memoryUsage().rss);};
console.log(JSON.stringify({stage:'renderer-ready',width,height,activeFrames,restartFrames,valid:r.metadata.validGridCells,particles:r.metadata.particles}));
if(cfg.auditTimes){report.audit=[];for(const seconds of cfg.auditTimes){temporal.prepare(seconds,seconds);const canvas=r.frame(seconds);report.audit.push({seconds,utc:new Date(epoch+seconds*1000).toISOString(),probes:r.probes(seconds)});if(cfg.auditImagePrefix)fs.writeFileSync(resolve(cfg.auditImagePrefix)+`-${seconds}.png`,await canvas.encode('png'));}}
if(video){fs.mkdirSync(path.dirname(video),{recursive:true});
  const warmup=cfg.warmupFrames??45,delta=modelDuration/activeFrames;for(let i=0;i<warmup;i++){r.step(1/fps,0,delta,true);if(i%5===0){memory();global.gc();}}report.visualInitialization={heldFirstField:true,frames:warmup,notAdditionalModelHistory:true};
  const ff=spawn(cfg.ffmpeg||process.env.FFMPEG_BINARY||'ffmpeg',['-y','-hide_banner','-loglevel','warning','-f','rawvideo','-pixel_format','rgba','-video_size',`${width}x${height}`,'-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset',cfg.preset||'medium','-crf',String(cfg.crf??16),'-pix_fmt','yuv420p','-threads','2','-filter_threads','1','-movflags','+faststart',video],{stdio:['pipe','ignore','pipe']});
  let errors='';ff.stderr.on('data',chunk=>errors+=String(chunk));ff.stdin.on('error',()=>{});const closed=once(ff,'close');let head=null,tail=null;
  for(let i=0;i<Math.min(requested,totalFrames);i++){let canvas;
    if(i<activeFrames){const seconds=i*modelDuration/activeFrames;if(i)r.step(1/fps,(i-1)*modelDuration/activeFrames,seconds);canvas=r.frame(seconds);report.sourceClock.push({frame:i,phase:'chronological',seconds,utc:new Date(epoch+seconds*1000).toISOString(),probes:r.probes(seconds)});
      if(i===0){head=createCanvas(width,height);head.getContext('2d').drawImage(canvas,0,0);}if(i===activeFrames-1){tail=createCanvas(width,height);tail.getContext('2d').drawImage(canvas,0,0);}
    }else{const alpha=(i-activeFrames+1)/restartFrames;canvas=alpha===1?head:r.replayFrame(tail,head,alpha);report.sourceClock.push({frame:i,phase:'labelled-replay-dissolve',alpha,notModelWeather:true});}
    if(cfg.snapshotFrames?.includes(i)){const dest=resolve(cfg.snapshotPrefix||'snapshot');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest+`-${i}.png`,await canvas.encode('png'));}
    if(!ff.stdin.write(canvas.data()))await Promise.race([once(ff.stdin,'drain'),closed.then(()=>{throw new Error('FFmpeg closed: '+errors);})]);if(i%5===0){memory();global.gc();}if(i%30===0||i===requested-1||i===totalFrames-1)console.log(JSON.stringify({stage:'frame',frame:i+1,total:Math.min(requested,totalFrames),phase:i<activeFrames?'chronological':'replay',rssMiB:Math.round(process.memoryUsage().rss/1048576)}));
  }
  ff.stdin.end();const [code]=await closed;if(code)throw new Error('FFmpeg failed: '+errors);report.ffmpegMessages=errors.trim();
}
report.sampler={...temporal.metadata};report.completed=new Date().toISOString();memory();if(cfg.manifest){const dest=resolve(cfg.manifest);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(report,null,2));}console.log(JSON.stringify({stage:'complete',video,peakRssMiB:Math.round(report.peakRss/1048576)}));
