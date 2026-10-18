import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual redraw entry point without a browser. Canvas is a small
// instrumented surface; the real field engine still computes all velocity cells.
const count={paths:0,vertices:0,masks:0,grids:0};
class TestPath{constructor(){count.paths++;}moveTo(){count.vertices++;}lineTo(){count.vertices++;}closePath(){}}
class Surface{
  constructor(){this.width=64;this.height=64;this.style={};this.dataset={};this.classList={toggle(){}};this.context={setTransform(){},clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},drawImage(){},arc(){},fillText(){},measureText(){return {width:1};},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){},getImageData(x,y,w,h){count.masks++;const data=new Uint8ClampedArray(w*h*4);for(let i=3;i<data.length;i+=4)data[i]=255;return {data};}};}
  getContext(){return this.context;}addEventListener(){}setAttribute(){}
}
const elements=new Map(),context=vm.createContext({console,Math,Date,Intl,Uint8Array,Uint8ClampedArray,Float32Array,Float64Array,Path2D:TestPath,document:{querySelector(s){if(!elements.has(s))elements.set(s,new Surface());return elements.get(s);},querySelectorAll(){return [];},createElement(){return new Surface();},addEventListener(){}},window:{addEventListener(){}},matchMedia(){return {matches:false};},requestAnimationFrame(){},setTimeout(){},clearTimeout(){}});
vm.runInContext(await readFile(new URL('../src/field.js',import.meta.url),'utf8'),context);
context.recordGrid=()=>count.grids++;
vm.runInContext('const actualMakeDisplay=makeDisplay;makeDisplay=(...args)=>{recordGrid();return actualMakeDisplay(...args);};',context);
const app=(await readFile(new URL('../src/app.js',import.meta.url),'utf8')).replace(/\binit\(\);\s*$/,'');
vm.runInContext(app+';globalThis.testAtlas={state,redraw,grid:()=>screenGrid,animateStep};',context);
const {state,redraw,grid,animateStep}=context.testAtlas;
Object.assign(state,{w:64,h:64,dpr:1,k:64,tx:0,ty:0,mesh:{lon:[-180,180,-180],lat:[85,85,-85],triangles:[[0,1,2]]},field:{kind:'mesh',u:[.2],v:[-.1],t:[10,20,30]},geo:{type:'FeatureCollection',features:[{properties:{name:'Water'},geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]]}}]}});
redraw();const first={...count};assert.equal(first.grids,1);assert.equal(first.masks,1);assert(first.vertices>0);
state.layer='speed';redraw();assert.equal(count.grids,first.grids,'Colour changes must reuse velocity data');assert.equal(count.vertices,first.vertices,'Colour changes must not reproject shores');assert.equal(count.masks,first.masks,'Colour changes must reuse the island mask');
state.field={...state.field,u:[.7]};redraw();assert.equal(count.grids,first.grids+1,'New source fields must rebuild velocities');assert.equal(count.vertices,first.vertices,'Source updates must reuse unchanged shores');assert.equal(count.masks,first.masks,'Source updates must reuse the same geographic mask');assert(Math.abs(grid().u[grid().valid[0]]-.7)<1e-6,'New field values must reach the display');
state.tx+=2;redraw();assert.equal(count.grids,first.grids+2,'Pan must rebuild screen velocities');assert(count.vertices>first.vertices,'Pan must reproject shore paths');assert.equal(count.masks,first.masks+1,'Pan must rebuild geographic mask');
const shifted={...count};state.w+=4;redraw();assert.equal(count.grids,shifted.grids+1,'Resize must rebuild screen velocities');assert(count.vertices>shifted.vertices,'Resize must invalidate projected shores');assert.equal(count.masks,shifted.masks+1);
const resized={...count};state.river={west:-180,south:-85,dx:360,dy:170,width:2,height:2,u:[.1,.1,.1,.1],v:[.2,.2,.2,.2]};redraw();assert.equal(count.grids,resized.grids+1,'River source updates must invalidate velocity cache');assert.equal(count.vertices,resized.vertices);assert.equal(count.masks,resized.masks);
assert.equal(grid().motionMultiplier,90000,'Wide views with slow screen velocities keep nominal acceleration');
Object.assign(state,{w:64,h:64,k:1e6,tx:32-.5e6,ty:32-.5e6,river:null,mesh:{lon:[-180,180,180,-180],lat:[85,85,-85,-85],triangles:[[0,1,2],[0,2,3]]},field:{kind:'mesh',u:[.7,.35],v:[0,0],t:[10,10,10,10]}});
const sourceBefore=JSON.stringify(state.field);redraw();const firstZoomScale=grid().motionMultiplier;assert(firstZoomScale>0&&firstZoomScale<90000,'Close zoom must adapt the shared visual clock');
const centrePixelsPerMetre=state.k/(360*111320);assert(Math.abs(firstZoomScale*.7*centrePixelsPerMetre-270)<1e-4,'Fastest centre-projected trace must be capped at 270 CSS px/s');
const beforeColourMultiplier=grid().motionMultiplier;state.layer='temperature';redraw();assert.equal(grid().motionMultiplier,beforeColourMultiplier,'Changing scalar colour cannot change motion scale');
state.k*=2;state.tx=32-.5*state.k;state.ty=32-.5*state.k;redraw();assert(Math.abs(grid().motionMultiplier-firstZoomScale/2)<1e-8,'A doubled zoom must halve a capped shared multiplier');
const velocitiesBefore=JSON.stringify({u:Array.from(grid().u),v:Array.from(grid().v)});
state.particles=[{x:12,y:20,age:0,life:1000},{x:48,y:20,age:0,life:1000}];animateStep(1/60);
const slow=state.particles[0].x-12,fast=state.particles[1].x-48;assert(slow>0&&fast>0);assert(Math.abs(fast/slow-2)<1e-5,'A shared visual clock must preserve the 2:1 velocity ratio');
assert.equal(JSON.stringify(state.field),sourceBefore,'Adaptive motion must not mutate source vectors or temperatures');assert.equal(JSON.stringify({u:Array.from(grid().u),v:Array.from(grid().v)}),velocitiesBefore,'Animation must not mutate display velocities');
console.log('Redraw cache checks passed: colour-only reuse, source/pan/resize invalidation, mask reuse and uniform adaptive motion without vector mutation.');
