import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual redraw entry point without a browser. Canvas is a small
// instrumented surface; the real field engine still computes all velocity cells.
const count={paths:0,vertices:0,masks:0,grids:0};
class TestPath{constructor(){count.paths++;}moveTo(){count.vertices++;}lineTo(){count.vertices++;}closePath(){}}
class Surface{
  constructor(){this.width=64;this.height=64;this.style={};this.dataset={};this.attributes={};this.classList={toggle(){}};this.context={traceStyles:[],setLineDash(){},setTransform(){},clearRect(){},fillRect(){},beginPath(){this.segments=0;},moveTo(){},lineTo(){this.segments++;},closePath(){},fill(){},stroke(){if(this.segments)this.traceStyles.push(this.strokeStyle);},drawImage(){},arc(){},fillText(){},measureText(){return {width:1};},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){},getImageData(x,y,w,h){if(!(w>0&&h>0))throw new Error('IndexSizeError: source width or height is zero');count.masks++;const data=new Uint8ClampedArray(w*h*4);for(let i=3;i<data.length;i+=4)data[i]=255;return {data};}};}
  getContext(){return this.context;}addEventListener(){}setAttribute(name,value){this.attributes[name]=value;}focus(){this.focused=true;}
}
const documentListeners=new Map();
const elements=new Map(),context=vm.createContext({console,Math,Date,Intl,Uint8Array,Uint8ClampedArray,Float32Array,Float64Array,Path2D:TestPath,document:{querySelector(s){if(!elements.has(s))elements.set(s,new Surface());return elements.get(s);},querySelectorAll(){return [];},createElement(){return new Surface();},addEventListener(name,listener){documentListeners.set(name,listener);}},window:{addEventListener(){}},matchMedia(){return {matches:false};},requestAnimationFrame(){},setTimeout(){},clearTimeout(){}});
vm.runInContext(await readFile(new URL('../src/mesh-flow.js',import.meta.url),'utf8'),context);
vm.runInContext(await readFile(new URL('../src/speed-style.js',import.meta.url),'utf8'),context);
vm.runInContext(await readFile(new URL('../src/field.js',import.meta.url),'utf8'),context);
context.recordGrid=()=>count.grids++;
vm.runInContext('const actualMakeDisplay=makeDisplay;makeDisplay=(...args)=>{recordGrid();return actualMakeDisplay(...args);};const actualRaster=displayRaster;displayRaster=(...args)=>{globalThis.lastRasterMaximum=args[3];return actualRaster(...args);};',context);
const app=(await readFile(new URL('../src/app.js',import.meta.url),'utf8')).replace(/\binit\(\);\s*$/,'');
vm.runInContext(app+';globalThis.testAtlas={state,redraw,resize,grid:()=>screenGrid,animateStep,validateSimcoe,loadSimcoe,simcoePeriod,inspect,color,validateOuterEstuary,loadOuterEstuary,loadDrainage};',context);
const {state,redraw,grid,animateStep,validateSimcoe,loadSimcoe,simcoePeriod,inspect}=context.testAtlas;
Object.assign(state,{w:64,h:64,dpr:1,k:64,tx:0,ty:0,mesh:{lon:[-180,180,-180],lat:[85,85,-85],triangles:[[0,1,2]]},field:{kind:'mesh',u:[.2],v:[-.1],t:[10,20,30]},geo:{type:'FeatureCollection',features:[{properties:{name:'Water'},geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]]}}]}});
// Data may arrive before the tab has ever acquired a usable viewport.
state.w=0;state.h=0;context.innerWidth=0;context.innerHeight=0;
context.testAtlas.resize();redraw(true);assert.equal(grid(),null);assert.equal(count.grids,0);assert.equal(count.masks,0);assert(state.field);
state.w=64;state.h=64;
redraw();const first={...count};assert.equal(first.grids,1);assert.equal(first.masks,1);assert(first.vertices>0);
state.layer='speed';redraw();assert.equal(count.grids,first.grids,'Colour changes must reuse velocity data');assert.equal(count.vertices,first.vertices,'Colour changes must not reproject shores');assert.equal(count.masks,first.masks,'Colour changes must reuse the island mask');
state.field={...state.field,u:[.7]};redraw();assert.equal(count.grids,first.grids+1,'New source fields must rebuild velocities');assert.equal(count.vertices,first.vertices,'Source updates must reuse unchanged shores');assert.equal(count.masks,first.masks,'Source updates must reuse the same geographic mask');assert(Math.abs(grid().u[grid().valid[0]]-.7)<1e-6,'New field values must reach the display');
state.tx+=2;redraw();assert.equal(count.grids,first.grids+2,'Pan must rebuild screen velocities');assert(count.vertices>first.vertices,'Pan must reproject shore paths');assert.equal(count.masks,first.masks+1,'Pan must rebuild geographic mask');
const shifted={...count};state.w+=4;redraw();assert.equal(count.grids,shifted.grids+1,'Resize must rebuild screen velocities');assert(count.vertices>shifted.vertices,'Resize must invalidate projected shores');assert.equal(count.masks,shifted.masks+1);
const resized={...count};state.river={west:-180,south:-85,dx:360,dy:170,width:2,height:2,u:[.1,.1,.1,.1],v:[.2,.2,.2,.2]};redraw();assert.equal(count.grids,resized.grids+1,'River source updates must invalidate velocity cache');assert.equal(count.vertices,resized.vertices);assert.equal(count.masks,resized.masks);
assert.equal(grid().motionMultiplier,90000,'Wide views with slow screen velocities keep nominal acceleration');
// Separate uniform patches isolate the shared motion clock here.
// Interpolation across connected wet edges is tested in test-mesh-flow.mjs.
Object.assign(state,{w:64,h:64,k:1e6,tx:32-.5e6,ty:32-.5e6,river:null,mesh:{lon:[-180,180,180,-180,180,-180],lat:[85,85,-85,85,-85,-85],triangles:[[0,1,2],[3,4,5]]},field:{kind:'mesh',u:[.7,.35],v:[0,0],t:[10,10,10,10]}});
const sourceBefore=JSON.stringify(state.field);redraw();const firstZoomScale=grid().motionMultiplier;assert(firstZoomScale>0&&firstZoomScale<90000,'Close zoom must adapt the shared visual clock');
const centrePixelsPerMetre=state.k/(360*111320);assert(Math.abs(firstZoomScale*.7*centrePixelsPerMetre-270)<1e-4,'Fastest centre-projected trace must be capped at 270 CSS px/s');
const beforeColourMultiplier=grid().motionMultiplier;state.layer='temperature';redraw();assert.equal(grid().motionMultiplier,beforeColourMultiplier,'Changing scalar colour cannot change motion scale');
state.k*=2;state.tx=32-.5*state.k;state.ty=32-.5*state.k;redraw();assert(Math.abs(grid().motionMultiplier-firstZoomScale/2)<1e-8,'A doubled zoom must halve a capped shared multiplier');
const velocitiesBefore=JSON.stringify({u:Array.from(grid().u),v:Array.from(grid().v)});
state.particles=[{x:12,y:20,age:0,life:1000},{x:48,y:20,age:0,life:1000}];animateStep(1/60);
const slow=state.particles[0].x-12,fast=state.particles[1].x-48;assert(slow>0&&fast>0);assert(Math.abs(fast/slow-2)<1e-5,'A shared visual clock must preserve the 2:1 velocity ratio');
assert.equal(JSON.stringify(state.field),sourceBefore,'Adaptive motion must not mutate source vectors or temperatures');assert.equal(JSON.stringify({u:Array.from(grid().u),v:Array.from(grid().v)}),velocitiesBefore,'Animation must not mutate display velocities');
const markup=await readFile(new URL('../src/index.html',import.meta.url),'utf8');assert(/<section[^>]*id="time-controls-panel"[^>]*\bhidden\b/.test(markup),'Timeline must be hidden in the initial main view');assert(markup.indexOf('id="valid-time"')<markup.indexOf('id="time-controls-panel"'),'Current time must remain visible outside the closed panel');
const panel=context.document.querySelector('#time-controls-panel'),toggle=elements.get('#time-controls-toggle');panel.hidden=true;const beforeDisclosure={...count};toggle.onclick();assert.equal(panel.hidden,false);assert.equal(toggle.attributes['aria-expanded'],'true');elements.get('#close-time-controls').onclick();assert.equal(panel.hidden,true);assert.equal(toggle.attributes['aria-expanded'],'false');assert(toggle.focused,'Closing time controls must restore focus to the disclosure');assert.deepEqual(count,beforeDisclosure,'Opening controls must not rebuild map or source data');
state.view='simcoe';redraw();assert.equal(elements.get('#coverage-note').hidden,false,'Selected Simcoe must explain its missing current grid');assert.equal(elements.get('.legend').hidden,true,'A velocity colour legend must not imply Simcoe has currents');state.view='all';redraw();assert.equal(elements.get('#coverage-note').hidden,true);assert.equal(elements.get('.legend').hidden,false);
const experiment={west:-180,south:-85,dx:360,dy:170,width:2,height:2,u:[.04,.04,.04,.04],v:[.02,.02,.02,.02],t:null,units:'m/s',kind:'experimental-grid',sourceType:'experimental-wind-response',experimental:true,validated:false,layer:'depth-averaged wind response',start:'2026-10-12T00:00:00Z',end:'2026-10-17T12:00:00Z',time:'2026-10-17T12:00:00Z',method:'Synthetic fixed-period fixture, not real lake data.',provenance:{fixture:true}};
assert.equal(validateSimcoe(experiment),experiment);for(const invalid of [{...experiment,validated:true},{...experiment,t:[10,10,10,10]},{...experiment,units:'cm/s'},{...experiment,end:'2026-10-18T12:00:00Z'},{...experiment,sourceType:'government-observation'}])assert.throws(()=>validateSimcoe(invalid),'Misclassified experimental metadata must be rejected');
try{
  const actual=JSON.parse(await readFile(new URL('../src/data/simcoe-experimental.json',import.meta.url),'utf8'));
  validateSimcoe(actual);
  console.log('Included optional Simcoe dataset passes the actual browser-loader contract.');
}catch(error){if(error.code!=='ENOENT')throw error;}
Object.assign(state,{w:64,h:64,k:64,tx:0,ty:0,view:'all',mode:'live',mesh:{lon:[],lat:[],triangles:[]},field:{kind:'mesh',u:[],v:[],t:[],time:'2026-10-18T12:00:00Z'},river:null,estuary:null,simcoe:experiment});redraw();assert(grid().simcoeVisibleCells>0);assert.equal(elements.get('#experimental-note').hidden,false,'Visible model pixels must carry an in-frame qualification even outside the selected Simcoe view');assert.equal(elements.get('#coverage-note').hidden,true);assert.equal(context.testAtlas.grid().provider[grid().valid[0]],4);assert.equal(context.displaySample(grid(),1,1)[2],null);
const beforeModelUpdate={...count};state.simcoe={...experiment,u:[.03,.03,.03,.03]};redraw();assert.equal(count.grids,beforeModelUpdate.grids+1,'Changing experimental data must invalidate the velocity cache');assert.equal(count.vertices,beforeModelUpdate.vertices,'Changing experimental data must reuse geographic paths');assert.equal(count.masks,beforeModelUpdate.masks,'Changing experimental data must reuse the real-water mask');
state.view='simcoe';state.layer='temperature';redraw();assert.equal(state.layer,'speed','Selected Simcoe experiment must use a cm/s legend, not temperature');assert.equal(elements.get('#legend-max').textContent,'5 cm/s');assert.equal(elements.get('#time-kind').textContent,'SIMCOE · UNVALIDATED WIND RESPONSE');const ownPeriod=elements.get('#valid-time').textContent;assert.equal(ownPeriod,simcoePeriod());assert(!ownPeriod.includes('Oct 18'),'Selected Simcoe summary must not substitute an Ontario nowcast date');
state.mode='average';redraw();assert.equal(elements.get('#valid-time').textContent,ownPeriod,'Government 24-hour mode must not relabel the fixed Simcoe period');assert.equal(elements.get('#simcoe-period').textContent,ownPeriod);state.mode='live';redraw();assert.equal(elements.get('#valid-time').textContent,ownPeriod);
state.h=1000;inspect(1,1);assert(elements.get('#readout').innerHTML.includes('UNVALIDATED DEPTH-AVERAGED WIND RESPONSE'));assert(elements.get('#readout').innerHTML.includes(ownPeriod));assert(!elements.get('#readout').innerHTML.includes('WATER TEMP.'));assert(!elements.get('#readout').innerHTML.includes('NOAA'));state.h=64;
const modelVectorsBefore=JSON.stringify(state.simcoe),displayVectorsBefore=JSON.stringify({u:Array.from(grid().u),v:Array.from(grid().v)}),motionBefore=grid().motionMultiplier;
assert.equal(grid().speedMaximum,.05,'Simcoe uses a fixed 5 cm/s ceiling in SI units');assert.equal(context.lastRasterMaximum,.05,'Map raster must receive the exact same ceiling as the legend');
let firstPaletteValue;context.displayRaster(grid(),'speed',q=>{firstPaletteValue??=q;return [0,0,0];},grid().speedMaximum);const modelSpeed=Math.hypot(.03,.02);assert(Math.abs(firstPaletteValue-modelSpeed/.05)<1e-6,'Raster palette must use actual speed divided by the fixed ceiling');
context.Math=Object.create(Math);context.Math.random=()=>0;const flowContext=elements.get('#flow').context;flowContext.traceStyles=[];state.particles=[{x:10,y:10,age:0,life:1000}];animateStep(1/60);const expectedBucket=Math.min(23,Math.floor(modelSpeed/.05*24)),expectedTrace=`rgba(${context.SpeedStyle.color(expectedBucket/23).join(',')},0.94)`;assert(flowContext.traceStyles.includes(expectedTrace),'Particle trails must use the same speed ceiling and palette as the raster');assert.equal(grid().motionMultiplier,motionBefore,'Changing the colour scale must not boost visual motion');assert.equal(JSON.stringify(state.simcoe),modelVectorsBefore);assert.equal(JSON.stringify({u:Array.from(grid().u),v:Array.from(grid().v)}),displayVectorsBefore,'Palette selection must preserve raw display velocities');
state.view=null;state.tx+=1;state.k*=1.1;redraw();assert.equal(grid().speedMaximum,.05,'Pan/zoom in a viewport dominated by Simcoe keeps the fixed regional scale');assert.equal(elements.get('#legend-max').textContent,'5 cm/s');
Object.assign(state,{view:'all',mesh:{lon:[-180,180,-180],lat:[85,85,-85],triangles:[[0,1,2]]},field:{kind:'mesh',u:[.2],v:[0],t:[10,10,10],time:'2026-10-18T12:00:00Z'}});redraw();assert(grid().simcoeVisibleCells/grid().valid.length<.8);assert.equal(grid().speedMaximum,1.5,'A mixed regional view must restore the 150 cm/s log scale');assert.equal(context.lastRasterMaximum,1.5);assert.equal(elements.get('#legend-max').textContent,'150+ cm/s');state.view='simcoe';
context.AbortSignal={timeout(){return undefined;}};context.fetch=async()=>({ok:false,status:404});const governmentBefore=state.field;await loadSimcoe();assert.equal(state.simcoe,null,'An unavailable optional dataset must clear the experimental field gracefully');assert.equal(state.field,governmentBefore,'Optional failure must preserve government fields');assert.equal(elements.get('#experimental-note').hidden,true);assert.equal(elements.get('#coverage-note').hidden,false);assert.equal(elements.get('#valid-time').textContent,'Current field unavailable');
// Archived outer estuary preserves source priority and its independent dates.
const actualOuter=JSON.parse(await readFile(new URL('../src/data/outer-estuary-mean.json',import.meta.url),'utf8'));
context.testAtlas.validateOuterEstuary(actualOuter);
assert.throws(()=>context.testAtlas.validateOuterEstuary({...actualOuter,sampleCount:1}));
const outer={...actualOuter,west:-180,south:-85,dx:360,dy:170,width:2,height:2,u:[.11,.11,.11,.11],v:[.04,.04,.04,.04]};
state.simcoe=null;state.river=null;state.estuary=null;state.outerEstuary=outer;state.view='river';state.mode='live';redraw();
assert(grid().valid.some(k=>grid().provider[k]===1),'Native lake vectors remain present');
assert(grid().valid.some(k=>grid().provider[k]===5),'Archived estuary fills previously empty water cells');
for(const k of grid().valid)if(grid().provider[k]===1)assert(Math.abs(grid().u[k]-.2)<1e-6,'Archived estuary cannot replace a native lake vector');
assert.equal(elements.get('#outer-estuary-status').hidden,false);assert(elements.get('#outer-estuary-status').textContent.includes('archived'));
const outerCell=grid().valid.find(k=>grid().provider[k]===5);state.h=1000;inspect((outerCell%grid().nx+.5)*grid().cell,(Math.floor(outerCell/grid().nx)+.5)*grid().cell);state.h=64;
assert(elements.get('#readout').innerHTML.includes('STLE500'));assert(elements.get('#readout').innerHTML.includes('12 Oct 00:00'));assert(elements.get('#readout').innerHTML.includes('ARCHIVED VECTOR MEAN'));
const govGrid={west:-180,south:-85,dx:360,dy:170,width:2,height:2,u:[.07,.07,.07,.07],v:[.08,.08,.08,.08]};state.estuary=govGrid;redraw();assert(!grid().valid.some(k=>grid().provider[k]===5),'Higher-resolution estuary always takes priority');
state.estuary=null;state.simcoe=experiment;redraw();assert(!grid().valid.some(k=>grid().provider[k]===5),'Archived estuary cannot replace a separately identified experiment');
state.simcoe=null;redraw();const drainageGridBefore=JSON.stringify({u:Array.from(grid().u),v:Array.from(grid().v),provider:Array.from(grid().provider)}),drainageBuilds=count.grids;
state.drainage={type:'FeatureCollection',bbox:[-1,-1,1,1],features:[{properties:{role:'divide'},geometry:{type:'LineString',coordinates:[[-1,0],[1,0]]}},{properties:{role:'tributary'},geometry:{type:'LineString',coordinates:[[0,-1],[0,1]]}}]};redraw();assert.equal(count.grids,drainageBuilds,'Drainage context must not rebuild current data');assert.equal(JSON.stringify({u:Array.from(grid().u),v:Array.from(grid().v),provider:Array.from(grid().provider)}),drainageGridBefore,'Drainage context supplies no current or wet mask');
context.fetch=async()=>({ok:false,status:404});await context.testAtlas.loadOuterEstuary();assert.equal(state.outerEstuary,null,'Optional estuary failure retains the government map');assert(state.field);
// Reproduce a background-tab startup with a temporarily zero-size viewport.
const retainedField=state.field,retainedGrid=grid(),retainedSize=[state.w,state.h],beforeHiddenBuilds=count.grids;
context.devicePixelRatio=1;
for(const [width,height] of [[0,0],[0,720],[1280,0]]){
  context.innerWidth=width;context.innerHeight=height;context.testAtlas.resize();
  assert.deepEqual([state.w,state.h],retainedSize,'A transient zero viewport must preserve the last usable size');
}
assert.equal(grid(),retainedGrid);assert.equal(count.grids,beforeHiddenBuilds);
state.w=0;state.h=0;redraw(true);
assert.equal(count.grids,beforeHiddenBuilds,'Data can load before a usable viewport without allocating a zero-size grid');
assert.equal(state.field,retainedField,'Deferring drawing must retain the loaded source field');
context.innerWidth=1280;context.innerHeight=720;context.document.hidden=false;
assert(documentListeners.has('visibilitychange'),'The map must recover when its background tab becomes visible');
documentListeners.get('visibilitychange')();
assert.equal(state.w,1280);assert.equal(state.h,720);
assert(grid().nx>0&&grid().ny>0&&grid().valid.length>0,'A visible viewport must recover and render the retained field');
assert.equal(state.field,retainedField);
console.log('Redraw/UI checks passed: cache/adaptive motion, secondary controls and separately typed, fixed-period optional Simcoe response without temperature or government-data replacement.');
