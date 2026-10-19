/* Display interpolation of source element vectors; no source values are edited. */
(function () {
  'use strict';

  const topologyCache = new WeakMap();
  const DEG = Math.PI / 180;

  function topology(mesh) {
    let cached = topologyCache.get(mesh);
    if (cached) return cached;
    const {lon, lat, triangles} = mesh;
    if (!lon || !lat || lon.length !== lat.length || !triangles) {
      throw new TypeError('MeshFlow needs matching lon/lat nodes and triangle indices');
    }
    const n = triangles.length;
    const area = new Float64Array(n);
    const linksA = [], linksB = [], edges = new Map();
    const xyz = new Float64Array(lon.length * 3);
    for (let i = 0; i < lon.length; i++) {
      if (!Number.isFinite(lon[i]) || !Number.isFinite(lat[i])) {
        throw new TypeError('MeshFlow mesh coordinates must be finite');
      }
      const phi = lat[i] * DEG, lambda = lon[i] * DEG, c = Math.cos(phi);
      xyz[3*i] = c * Math.cos(lambda);
      xyz[3*i+1] = c * Math.sin(lambda);
      xyz[3*i+2] = Math.sin(phi);
    }
    for (let f = 0; f < n; f++) {
      const t = triangles[f];
      if (!t || t.length !== 3 || t.some(i => !Number.isInteger(i) || i < 0 || i >= lon.length)) {
        throw new TypeError('MeshFlow triangle has an invalid node index');
      }
      const a = 3*t[0], b = 3*t[1], c = 3*t[2];
      const ab = xyz[a]*xyz[b] + xyz[a+1]*xyz[b+1] + xyz[a+2]*xyz[b+2];
      const bc = xyz[b]*xyz[c] + xyz[b+1]*xyz[c+1] + xyz[b+2]*xyz[c+2];
      const ca = xyz[c]*xyz[a] + xyz[c+1]*xyz[a+1] + xyz[c+2]*xyz[a+2];
      // det(a,b,c)=dot(a,cross(b-a,c-a)); local chord differences avoid
      // cancellation between large global-coordinate products in tiny cells.
      const bax=xyz[b]-xyz[a], bay=xyz[b+1]-xyz[a+1], baz=xyz[b+2]-xyz[a+2];
      const cax=xyz[c]-xyz[a], cay=xyz[c+1]-xyz[a+1], caz=xyz[c+2]-xyz[a+2];
      const determinant = xyz[a]*(bay*caz-baz*cay)
        + xyz[a+1]*(baz*cax-bax*caz)
        + xyz[a+2]*(bax*cay-bay*cax);
      // Spherical triangle solid angle: geographic metric area up to a common
      // radius squared. This is independent of screen size, zoom or projection.
      area[f] = 2 * Math.atan2(Math.abs(determinant), 1 + ab + bc + ca);
      for (const [i, j] of [[0,1], [1,2], [2,0]]) {
        const ni = t[i], nj = t[j], low = Math.min(ni,nj), high = Math.max(ni,nj);
        const key = low + ',' + high;
        const first = edges.get(key);
        if (!first) {
          edges.set(key, {face:f, lowCorner:3*f+(ni===low?i:j), highCorner:3*f+(ni===high?i:j), count:1});
        } else {
          if (++first.count > 2) throw new Error('MeshFlow requires a manifold triangle mesh');
          linksA.push(first.lowCorner, first.highCorner);
          linksB.push(3*f+(ni===low?i:j), 3*f+(ni===high?i:j));
        }
      }
    }
    cached = {n, area, linksA:Int32Array.from(linksA), linksB:Int32Array.from(linksB)};
    topologyCache.set(mesh, cached);
    return cached;
  }

  function reconstruct(mesh, field) {
    const g = topology(mesh), n = g.n;
    if (!field || !field.u || !field.v || field.u.length !== n || field.v.length !== n) {
      throw new TypeError('MeshFlow element vector dimensions do not match the mesh');
    }
    const valid = new Uint8Array(n);
    const faceU = new Float64Array(n), faceV = new Float64Array(n);
    const parent = new Int32Array(3*n); parent.fill(-1);
    const rank = new Uint8Array(3*n);
    const find = a => {
      let root = a;
      while (parent[root] !== root) root = parent[root];
      while (parent[a] !== a) { const next = parent[a]; parent[a] = root; a = next; }
      return root;
    };
    const union = (a,b) => {
      a = find(a); b = find(b);
      if (a === b) return;
      if (rank[a] < rank[b]) { const tmp = a; a = b; b = tmp; }
      parent[b] = a;
      if (rank[a] === rank[b]) rank[a]++;
    };
    for (let f = 0; f < n; f++) {
      faceU[f] = field.u[f] === null ? NaN : field.u[f];
      faceV[f] = field.v[f] === null ? NaN : field.v[f];
      if (!Number.isFinite(field.u[f]) || !Number.isFinite(field.v[f]) || !(g.area[f] > 0)) continue;
      valid[f] = 1;
      parent[3*f] = 3*f; parent[3*f+1] = 3*f+1; parent[3*f+2] = 3*f+2;
    }
    for (let k = 0; k < g.linksA.length; k++) {
      const a = g.linksA[k], b = g.linksB[k];
      if (valid[Math.floor(a/3)] && valid[Math.floor(b/3)]) union(a,b);
    }
    const sumU = new Float64Array(3*n), sumV = new Float64Array(3*n), weight = new Float64Array(3*n);
    for (let f = 0; f < n; f++) if (valid[f]) {
      for (let i = 0; i < 3; i++) {
        const root = find(3*f+i), a = g.area[f];
        sumU[root] += a*faceU[f]; sumV[root] += a*faceV[f]; weight[root] += a;
      }
    }
    const cornerU = new Float64Array(3*n), cornerV = new Float64Array(3*n);
    cornerU.fill(NaN); cornerV.fill(NaN);
    for (let f = 0; f < n; f++) if (valid[f]) {
      for (let i = 0; i < 3; i++) {
        const q = 3*f+i, root = find(q);
        cornerU[q] = sumU[root]/weight[root]; cornerV[q] = sumV[root]/weight[root];
      }
    }

    // A triangle's centroid fan has weights 3m for the original element vector
    // and (lambda_i-m) for each corner, where m=min(lambda). These are convex,
    // give the exact original vector at lambda=(1/3,1/3,1/3), and agree across
    // valid shared edges. This is display interpolation, NOT conservation of
    // native element means or transport, and it never fills a missing triangle.
    function interpolate(face, wa, wb, wc, out) {
      if (!Number.isInteger(face) || face < 0 || face >= n || !valid[face]) return null;
      if (![wa,wb,wc].every(Number.isFinite) || Math.min(wa,wb,wc) < -1e-9 || Math.max(wa,wb,wc) > 1+1e-9) return null;
      wa = Math.max(0,wa); wb = Math.max(0,wb); wc = Math.max(0,wc);
      const sum = wa+wb+wc;
      if (!(sum > 0)) return null;
      wa /= sum; wb /= sum; wc /= sum;
      const m = Math.min(wa,wb,wc), center = 3*m, a = wa-m, b = wb-m, c = wc-m, q = 3*face;
      out = out || [0,0];
      out[0] = center*faceU[face] + a*cornerU[q] + b*cornerU[q+1] + c*cornerU[q+2];
      out[1] = center*faceV[face] + a*cornerV[q] + b*cornerV[q+1] + c*cornerV[q+2];
      return out;
    }
    // Mesh geometry must remain immutable after first use. Only geometry is
    // cached; validity, node fans and weights are recomputed for every field.
    // Treat returned typed arrays as read-only; raster loops can inline the
    // formula above to avoid a function call and allocation per display pixel.
    return Object.freeze({valid, faceU, faceV, cornerU, cornerV, interpolate});
  }

  globalThis.MeshFlow = Object.freeze({reconstruct});
})();
