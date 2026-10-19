/* Separately estimated passive river temperature; never supplies velocity.
 * Native NOAA temperature always wins. This module supplements only missing
 * temperature of provider 2, on the frozen solved river grid and bounded clock.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export function createRiverTemperature(source) {
  const {temperature, indexMap} = source || {};
  const times = Float64Array.from(source?.times || []);
  const inputGrid = source?.grid;
  if (!inputGrid || !Number.isInteger(inputGrid.width) || !Number.isInteger(inputGrid.height)
      || inputGrid.width < 1 || inputGrid.height < 1
      || !Number.isFinite(inputGrid.west) || !Number.isFinite(inputGrid.south)
      || !Number.isFinite(inputGrid.dx) || !Number.isFinite(inputGrid.dy)
      || inputGrid.dx <= 0 || inputGrid.dy <= 0) throw new TypeError('Invalid river temperature regular grid');
  const grid = Object.freeze({west:inputGrid.west,south:inputGrid.south,dx:inputGrid.dx,dy:inputGrid.dy,width:inputGrid.width,height:inputGrid.height});
  if (times.length < 2 || times[0] !== 0) throw new RangeError('River temperature clock must start at zero with at least two endpoints');
  for (let i=0; i<times.length; i++) {
    if (!Number.isFinite(times[i]) || (i && times[i]-times[i-1] !== 3600)) throw new RangeError('River temperature timestamps must be finite hourly endpoints, without missing hours');
  }
  if (!(temperature instanceof Float32Array) || temperature.length % times.length !== 0
      || !(indexMap instanceof Int32Array) || indexMap.length !== grid.width*grid.height) {
    throw new TypeError('River temperature needs time-major Float32 temperature and Int32 regular-cell index map');
  }
  const wetCount = temperature.length/times.length;
  if (!wetCount) throw new RangeError('River temperature has no solved wet cells');
  const seen = new Uint8Array(wetCount);
  for (let i=0; i<indexMap.length; i++) {
    const value=indexMap[i];
    if (value === -1) continue;
    if (value < 0 || value >= wetCount || seen[value]) throw new RangeError('River temperature index map must identify each compact wet cell exactly once');
    seen[value]=1;
  }
  for (let i=0; i<wetCount; i++) if (!seen[i]) throw new RangeError('River temperature compact wet index is absent from its regular grid');
  const lastSeconds=times[times.length-1];
  let lastIndex=0,sampleCount=0,actualPriorityCount=0,supplementCount=0;
  function indexAt(seconds) {
    if (!Number.isFinite(seconds) || seconds<0 || seconds>lastSeconds) throw new RangeError('River temperature time is outside source bounds; wrap/extrapolation is forbidden');
    if (seconds===lastSeconds) return times.length-1;
    if (seconds>=times[lastIndex] && seconds<times[lastIndex+1]) return lastIndex;
    let low=0,high=times.length-1;
    while(low+1<high){const middle=(low+high)>>>1;if(times[middle]<=seconds)low=middle;else high=middle;}
    lastIndex=low;return low;
  }
  function sampleIndex(wetIndex,seconds) {
    sampleCount++;
    const i=indexAt(seconds);
    if(!Number.isInteger(wetIndex)||wetIndex<0||wetIndex>=wetCount)return NaN;
    const a=temperature[i*wetCount+wetIndex];
    if(seconds===times[i])return Number.isFinite(a)?a:NaN;
    const b=temperature[(i+1)*wetCount+wetIndex];
    if(!Number.isFinite(a)||!Number.isFinite(b))return NaN;
    return a+(b-a)*(seconds-times[i])/3600;
  }
  function supplement(provider,actualTemperature,wetIndex,seconds) {
    if(Number.isFinite(actualTemperature)){actualPriorityCount++;return actualTemperature;}
    if(provider!==2)return NaN;
    const value=sampleIndex(wetIndex,seconds);
    if(Number.isFinite(value))supplementCount++;
    return value;
  }
  const metadata=Object.freeze({
    kind:'estimated passive river temperature',units:'degrees_C',
    sourceRiverFieldSHA256:source.sourceRiverFieldSHA256??null,
    method:source.method??null,endpointCount:times.length,intervalCount:times.length-1,
    firstSeconds:0,lastSeconds,wetCount,indexMapCells:indexMap.length,
    interpolation:'linear scalar time; nearest original solved regular-grid cell',
    timeWrap:false,actualTemperaturePriority:true,supplementProvider:2,affectsVelocity:false,
    missingPolicy:'Exact endpoint uses itself; intermediate estimate requires both finite endpoints; no spatial filling.',
    get sampleCount(){return sampleCount;},get actualPriorityCount(){return actualPriorityCount;},get supplementCount(){return supplementCount;}
  });
  // Caller may use this read-only indexMap once to precompute its display raster
  // ownership. Querying estimates never changes this map or the source arrays.
  return Object.freeze({indexMap,grid,sampleIndex,supplement,metadata});
}

export function loadRiverTemperature(manifestPath,{expectedRiverFieldSHA256}={}) {
  if(new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]!==4)throw new Error('River temperature binary loader requires little-endian runtime');
  const file=manifestPath instanceof URL?fileURLToPath(manifestPath):path.resolve(manifestPath);
  const directory=path.dirname(file),bytes=fs.readFileSync(file),manifest=JSON.parse(bytes.toString('utf8'));
  const sha=data=>createHash('sha256').update(data).digest('hex');
  if(typeof manifest.sourceRiverFieldSHA256!=='string'||!/^[a-f0-9]{64}$/.test(manifest.sourceRiverFieldSHA256))throw new TypeError('River temperature manifest must identify the frozen source river field SHA256');
  if(expectedRiverFieldSHA256!==undefined&&manifest.sourceRiverFieldSHA256!==expectedRiverFieldSHA256)throw new Error('River temperature source river field hash mismatch');
  const grid=manifest.grid;
  function load(record,dtype,ArrayType) {
    if(!record||record.dtype!==dtype||record.endianness!=='little'||record.order!=='C')throw new TypeError('Invalid river temperature binary type/endianness/order');
    const data=fs.readFileSync(path.resolve(directory,record.file));
    if(data.length!==record.bytes||data.length%4||sha(data)!==record.sha256)throw new Error('River temperature binary failed byte/hash integrity check: '+record.file);
    if(!Array.isArray(record.shape)||record.shape.reduce((a,b)=>a*b,1)*4!==data.length||record.shape.some(n=>!Number.isInteger(n)||n<1))throw new TypeError('Invalid river temperature binary shape');
    return new ArrayType(data.buffer,data.byteOffset,data.byteLength/4);
  }
  const temperature=load(manifest.arrays?.temperature,'float32',Float32Array);
  const indexMap=load(manifest.arrays?.indexMap,'int32',Int32Array);
  const axis=manifest.times;
  if(!Array.isArray(axis))throw new TypeError('River temperature manifest is missing its time axis');
  let times;
  if(axis.every(value=>typeof value==='number'))times=axis;
  else if(axis.every(value=>typeof value==='string')){
    const epoch=Date.parse(axis[0]);times=axis.map(value=>(Date.parse(value)-epoch)/1000);
  }else throw new TypeError('River temperature manifest time axis must be numeric relative seconds or ISO UTC strings');
  if(manifest.arrays.temperature.shape.length!==2||manifest.arrays.temperature.shape[0]!==times.length
      || manifest.arrays.indexMap.shape.length!==2||manifest.arrays.indexMap.shape[0]!==grid?.height
      || manifest.arrays.indexMap.shape[1]!==grid?.width)throw new TypeError('River temperature manifest shapes do not match time axis/regular grid');
  const result=createRiverTemperature({times,temperature,indexMap,grid,sourceRiverFieldSHA256:manifest.sourceRiverFieldSHA256,method:manifest.method});
  const metadata=Object.freeze({...result.metadata,manifestSHA256:sha(bytes),temperatureSHA256:manifest.arrays.temperature.sha256,indexMapSHA256:manifest.arrays.indexMap.sha256,
    get sampleCount(){return result.metadata.sampleCount;},get actualPriorityCount(){return result.metadata.actualPriorityCount;},get supplementCount(){return result.metadata.supplementCount;}});
  return Object.freeze({...result,metadata});
}
