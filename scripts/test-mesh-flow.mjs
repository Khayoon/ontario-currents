import assert from 'node:assert/strict';
import '../src/mesh-flow.js';

const {reconstruct} = globalThis.MeshFlow;
const close = (a,b,t=1e-12) => assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const mesh = {lon:[0,.01,.01,0],lat:[44,44,44.01,44.01],triangles:[[0,1,2],[0,2,3]]};
const field = {u:[.2,-.1],v:[-.05,.15]};
const saved = JSON.stringify(field);
const r = reconstruct(mesh,field);

// A constant field stays constant across the whole reconstructed triangle.
const constant = reconstruct(mesh,{u:[.17,.17],v:[-.08,-.08]});
for (const f of [0,1]) for (const w of [[.2,.3,.5],[0,.7,.3],[1,0,0],[1/3,1/3,1/3]]) {
  const v = constant.interpolate(f,...w);close(v[0],.17);close(v[1],-.08);
}
// Exact source-centroid fidelity, not just a nearby interpolated estimate.
for (const f of [0,1]) {
  const v = r.interpolate(f,1/3,1/3,1/3);assert.equal(v[0],field.u[f]);assert.equal(v[1],field.v[f]);
}
// The two triangles share edge [0,2]; test the entire edge in either ordering.
for (let i=0;i<=100;i++) {
  const a=i/100,b=1-a;const va=r.interpolate(0,a,0,b),vb=r.interpolate(1,a,b,0);
  close(va[0],vb[0]);close(va[1],vb[1]);
}
// Every interior result remains inside the convex source/corner component bounds.
for (let f=0;f<2;f++) for (let a=0;a<=40;a++) for (let b=0;b<=40-a;b++) {
  const v=r.interpolate(f,a/40,b/40,1-(a+b)/40),q=3*f;
  const us=[r.faceU[f],...r.cornerU.slice(q,q+3)],vs=[r.faceV[f],...r.cornerV.slice(q,q+3)];
  assert.ok(v[0]>=Math.min(...us)-1e-14&&v[0]<=Math.max(...us)+1e-14);
  assert.ok(v[1]>=Math.min(...vs)-1e-14&&v[1]<=Math.max(...vs)+1e-14);
}
// Opposite valid triangle fans share the centre vertex but have dry wedges
// between them. Their centre-corner values must remain independent.
const star={lon:[0,.01,0,-.01,0],lat:[44,44,44.01,44,43.99],triangles:[[0,1,2],[0,2,3],[0,3,4],[0,4,1]]};
const split=reconstruct(star,{u:[1,null,-1,null],v:[.2,null,-.3,null]});
close(split.cornerU[0],1);close(split.cornerU[6],-1);
close(split.cornerV[0],.2);close(split.cornerV[6],-.3);
assert.equal(split.valid[1],0);assert.equal(split.valid[3],0);
assert.equal(split.interpolate(1,1/3,1/3,1/3),null);
assert.equal(split.interpolate(3,.2,.3,.5),null);
// Geometry may be cached, but per-field missingness must rebuild the node fan.
const hole=reconstruct(mesh,{u:[.2,null],v:[-.05,null]});
for(let i=0;i<3;i++){close(hole.cornerU[i],.2);close(hole.cornerV[i],-.05);}
assert.equal(hole.interpolate(1,.2,.3,.5),null);
assert.equal(hole.interpolate(0,-.1,.5,.6),null); // no outside-triangle extrapolation
assert.equal(JSON.stringify(field),saved);assert.ok(Object.isFrozen(globalThis.MeshFlow));
console.log(JSON.stringify({passed:true,checks:['constant field','exact source centroids','shared-edge continuity','convex component bounds','disconnected valid fans','missing triangle remains missing','field validity recomputed','no source mutation','outside query rejected']}));
