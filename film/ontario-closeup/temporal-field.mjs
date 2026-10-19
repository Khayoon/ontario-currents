/* Native-mesh display reconstruction sampled on one bounded model-time axis.
 * This module never changes source arrays, fills source holes or wraps time.
 * Centroid-fan reconstruction is visual interpolation, not transport/mean
 * conservation. Source timestamps are seconds relative to the first endpoint.
 */
export function createTemporalField(mesh, source, reconstructFunction) {
  if (!mesh?.triangles || !mesh.lon || !mesh.lat || mesh.lon.length !== mesh.lat.length) {
    throw new TypeError('Temporal field needs matching mesh nodes and triangles');
  }
  if (typeof reconstructFunction !== 'function') throw new TypeError('A mesh reconstruction function is required');
  const {u, v, t} = source || {};
  const times = Float64Array.from(source?.times || []);
  const hourCount = times.length, faceCount = mesh.triangles.length, nodeCount = mesh.lon.length;
  if (hourCount < 2 || times[0] !== 0) throw new RangeError('Temporal timestamps must begin at zero and include at least two endpoints');
  let hourly = true;
  for (let i = 0; i < hourCount; i++) {
    if (!Number.isFinite(times[i]) || (i && times[i] <= times[i-1])) throw new RangeError('Temporal timestamps must be finite and strictly increasing');
    if (i && times[i] - times[i-1] !== 3600) hourly = false;
  }
  if (!hourly) throw new RangeError('Hourly source endpoints must be exactly 3600 seconds apart; missing hours cannot be bridged');
  if (!(u instanceof Float32Array) || !(v instanceof Float32Array) || !(t instanceof Float32Array)
      || u.length !== hourCount*faceCount || v.length !== hourCount*faceCount || t.length !== hourCount*nodeCount) {
    throw new TypeError('Temporal Float32 U/V/T arrays must be time-major and match timestamps and mesh dimensions');
  }
  const lastSeconds = times[hourCount-1];
  const cache = [null, null, null];
  let cacheSize = 0, maximumCacheSize = 0, reconstructions = 0, cacheHits = 0, stamp = 0;
  let lastIndex = 0, prepareCount = 0, sampleCount = 0, temperatureSampleCount = 0;
  const scratch = new Float64Array(3);
  let w0 = 0, w1 = 0, w2 = 0;

  function indexAt(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > lastSeconds) {
      throw new RangeError('Sample time is outside the finite source interval; temporal wrap/extrapolation is forbidden');
    }
    if (seconds === lastSeconds) return hourCount-1;
    if (lastIndex < hourCount-1 && seconds >= times[lastIndex] && seconds < times[lastIndex+1]) return lastIndex;
    let low = 0, high = hourCount-1;
    while (low+1 < high) {
      const middle = (low+high) >>> 1;
      if (times[middle] <= seconds) low = middle; else high = middle;
    }
    lastIndex = low;
    return low;
  }

  function weights(face, a, b, c) {
    if (!Number.isInteger(face) || face < 0 || face >= faceCount
        || !Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)
        || Math.min(a,b,c) < -1e-5 || Math.max(a,b,c) > 1+1e-5) return false;
    a = Math.max(0,a); b = Math.max(0,b); c = Math.max(0,c);
    const sum = a+b+c;
    if (!(sum > 0)) return false;
    w0 = a/sum; w1 = b/sum; w2 = c/sum;
    return true;
  }

  function frame(index) {
    for (let i = 0; i < 3; i++) {
      const hit = cache[i];
      if (hit && hit.index === index) { hit.stamp = ++stamp; cacheHits++; return hit.value; }
    }
    let slot = 0;
    for (let i = 0; i < 3; i++) {
      if (cache[i] === null) { slot = i; break; }
      if (cache[i].stamp < cache[slot].stamp) slot = i;
    }
    const begin = index*faceCount;
    const value = reconstructFunction(mesh, {u:u.subarray(begin, begin+faceCount), v:v.subarray(begin, begin+faceCount)});
    if (!value || value.valid?.length !== faceCount || value.faceU?.length !== faceCount
        || value.faceV?.length !== faceCount || value.cornerU?.length !== 3*faceCount || value.cornerV?.length !== 3*faceCount) {
      throw new TypeError('Mesh reconstruction returned incompatible arrays');
    }
    if (cache[slot] === null) cacheSize++;
    cache[slot] = {index, value, stamp:++stamp};
    maximumCacheSize = Math.max(maximumCacheSize, cacheSize);
    reconstructions++;
    return value;
  }

  function temperatureAt(face, index) {
    const tri = mesh.triangles[face], offset = index*nodeCount;
    const a = t[offset+tri[0]], b = t[offset+tri[1]], c = t[offset+tri[2]];
    return Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) ? a*w0+b*w1+c*w2 : NaN;
  }

  function sampleTemperature(face, wa, wb, wc, seconds) {
    temperatureSampleCount++;
    const i = indexAt(seconds);
    if (!weights(face,wa,wb,wc)) return NaN;
    const a = temperatureAt(face,i);
    if (seconds === times[i]) return a;
    const b = temperatureAt(face,i+1);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
    const fraction = (seconds-times[i])/(times[i+1]-times[i]);
    return a+(b-a)*fraction;
  }

  function sample(face, wa, wb, wc, seconds, out = scratch) {
    if (!out || out.length < 3) throw new TypeError('Sample output needs at least three writable entries');
    sampleCount++;
    const i = indexAt(seconds);
    out[0] = NaN; out[1] = NaN; out[2] = NaN;
    if (!weights(face,wa,wb,wc)) return out;
    const exact = seconds === times[i];
    const fraction = exact ? 0 : (seconds-times[i])/(times[i+1]-times[i]);
    const ta = temperatureAt(face,i);
    if (exact) out[2] = ta;
    else {
      const tb = temperatureAt(face,i+1);
      if (Number.isFinite(ta) && Number.isFinite(tb)) out[2] = ta+(tb-ta)*fraction;
    }
    const a = frame(i), b = exact ? a : frame(i+1);
    if (!a.valid[face] || !b.valid[face]) return out;
    const m = Math.min(w0,w1,w2), center = 3*m, aa = w0-m, bb = w1-m, cc = w2-m, q = 3*face;
    const ua = center*a.faceU[face]+aa*a.cornerU[q]+bb*a.cornerU[q+1]+cc*a.cornerU[q+2];
    const va = center*a.faceV[face]+aa*a.cornerV[q]+bb*a.cornerV[q+1]+cc*a.cornerV[q+2];
    if (exact) { out[0] = ua; out[1] = va; return out; }
    const ub = center*b.faceU[face]+aa*b.cornerU[q]+bb*b.cornerU[q+1]+cc*b.cornerU[q+2];
    const vb = center*b.faceV[face]+aa*b.cornerV[q]+bb*b.cornerV[q+1]+cc*b.cornerV[q+2];
    out[0] = ua+(ub-ua)*fraction;
    out[1] = va+(vb-va)*fraction;
    return out;
  }

  function prepare(startSeconds, endSeconds) {
    const low = indexAt(startSeconds), final = indexAt(endSeconds);
    if (endSeconds < startSeconds) throw new RangeError('Prepared model-time interval must not run backwards');
    const high = final+(endSeconds === times[final] ? 0 : 1);
    // Normal frame/RK2 ranges span one or two hours. Wider requests remain
    // bounded: prewarm the first pair and final endpoint, then use LRU on demand.
    const wanted = high-low < 3 ? Array.from({length:high-low+1}, (_,i)=>low+i)
      : [low, low+1, high];
    for (let i = 0; i < 3; i++) if (cache[i] && !wanted.includes(cache[i].index)) { cache[i] = null; cacheSize--; }
    for (const index of wanted) frame(index);
    prepareCount++;
  }

  const metadata = Object.freeze({
    interpolation:'hourly linear numerical UV/T; centroid-fan native face UV; P1 node T',
    timeUnits:'seconds since first supplied UTC endpoint', timeWrap:false,
    firstSeconds:0, lastSeconds, endpointCount:hourCount, intervalCount:hourCount-1,
    hourlySpacing:hourly, faceCount, nodeCount, cacheLimit:3,
    missingPolicy:'exact endpoint uses itself; intermediate UV and T independently require finite endpoints',
    barycentricTolerance:1e-5,
    get cachedHours() { return cache.filter(Boolean).map(x=>x.index).sort((a,b)=>a-b); },
    get reconstructions() { return reconstructions; },
    get cacheHits() { return cacheHits; },
    get maximumCacheSize() { return maximumCacheSize; },
    get sampleCount() { return sampleCount; },
    get temperatureSampleCount() { return temperatureSampleCount; },
    get prepareCount() { return prepareCount; }
  });
  return Object.freeze({sample, sampleTemperature, prepare, metadata});
}
