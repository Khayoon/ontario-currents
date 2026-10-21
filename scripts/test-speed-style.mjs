import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

let pixels;
const context=vm.createContext({Math,Number,Object,Float32Array,Float64Array,Uint8Array,document:{createElement(){return {getContext(){return {createImageData(width,height){return {data:new Uint8ClampedArray(width*height*4)};},putImageData(image){pixels=image.data;}};}};}}});
vm.runInContext(await readFile(new URL('../src/speed-style.js',import.meta.url),'utf8'),context);
vm.runInContext(await readFile(new URL('../src/field.js',import.meta.url),'utf8'),context);
const style=context.SpeedStyle;
assert.equal(style.position(0),0);
assert.equal(style.position(1.5),1);
assert.equal(style.position(3.86),1,'The labelled 150+ endpoint must saturate explicitly');
assert.equal(style.position(.025,.05),.5,'Simcoe retains its fixed linear 0–5 cm/s scale');
assert.equal(style.position(.05,.05),1);
assert.notEqual(style.position(.025),.5,'Main-map scale must not silently become the Simcoe scale');
const speeds=[0,.001,.02,.1,.3,.6,.9,1.5];
for(let i=1;i<speeds.length;i++)assert(style.position(speeds[i])>style.position(speeds[i-1]),'The log colour mapping must increase with physical speed');
const ticks=Array.from(style.ticks());
assert.deepEqual(ticks.map(t=>t.value),[0,2,10,50,150]);
for(const tick of ticks)assert.equal(tick.position,Math.log1p(tick.value/2)/Math.log1p(75),'Legend ticks must use the same logarithmic mapping as the water');
assert.equal(ticks.at(-1).label,'150+');
assert.deepEqual(Array.from(style.color(0)),[59,131,174]);
assert.deepEqual(Array.from(style.color(1)),[240,242,185]);
const brightness=rgb=>.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
for(let i=1;i<style.stops.length;i++)assert(brightness(style.stops[i])>brightness(style.stops[i-1]),'Palette control colours must grow brighter with speed');
assert.notDeepEqual(Array.from(style.color(style.position(.6))),Array.from(style.color(style.position(.9))),'60 and 90 cm/s must no longer share a saturated colour');
assert.notDeepEqual(Array.from(style.color(style.position(.9))),Array.from(style.color(style.position(1.5))),'Fast Montréal flow must retain contrast below the labelled cap');

const grid={nx:4,ny:1,valid:[0,1,2,3],u:new Float32Array([.6,.9,1.5,3.86]),v:new Float32Array(4),t:new Float32Array([10,15.5,NaN,20])};
const before={u:Array.from(grid.u),v:Array.from(grid.v),t:Array.from(grid.t)};
context.displayRaster(grid,'speed',style.color,style.maximum);
assert.notDeepEqual(Array.from(pixels.slice(0,3)),Array.from(pixels.slice(4,7)),'Actual dark raster pixels must distinguish 60 and 90 cm/s');
for(let i=0;i<4;i++){
  const expected=new Uint8ClampedArray([...style.color(style.position(grid.u[i]))].map(c=>c*.10));
  assert.deepEqual(Array.from(pixels.slice(i*4,i*4+3)),Array.from(expected));
  assert.equal(pixels[i*4+3],255);
}

// Temperature rendering retains its pre-restoration normalization, palette,
// neutral missing-data colour and 0.46 brightness rather than using speed style.
const temperatureStops=[[30,85,120],[58,148,190],[85,205,216],[160,235,219],[238,241,190]];
function temperatureColor(value){const q=Math.max(0,Math.min(.9999,value))*4,i=Math.floor(q),t=q-i;return temperatureStops[i].map((c,j)=>Math.round(c*(1-t)+temperatureStops[i+1][j]*t));}
context.displayRaster(grid,'temperature',temperatureColor,style.maximum);
for(let i=0;i<4;i++){
  const rgb=Number.isFinite(grid.t[i])?temperatureColor(grid.t[i]/25):[36,133,183];
  assert.deepEqual(Array.from(pixels.slice(i*4,i*4+3)),Array.from(new Uint8ClampedArray(rgb.map(c=>c*.46))));
}
assert.deepEqual({u:Array.from(grid.u),v:Array.from(grid.v),t:Array.from(grid.t)},before,'Colour rendering cannot mutate current or temperature values');
console.log('Speed-style checks passed: physical log ticks, distinct fast-flow colours, dark raster, linear Simcoe and unchanged temperature rendering.');
