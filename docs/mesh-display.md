# Lake mesh display interpolation

Updated 19 October 2026.

The broad weak or reversing mean-flow band near **43.53° N, 78.51° W** exists in the retained NOAA model vectors. Its repeated sharp triangular steps came from displaying one constant vector throughout each mesh triangle. Abrupt changes at triangle edges could separate particle trails and make an artificial sawtooth gap. The display revision removes that mesh-edge discontinuity while retaining the broad modeled shear.

The source audit checked the original NOAA triangle index order and all **23 selected snapshots**. The stored component means reproduce the raw fields within **0.0000005 m/s**, consistent with their retained decimal precision. NOAA's [frozen NetCDF attributes](https://opendap.co-ops.nos.noaa.gov/thredds/dodsC/NOAA/LOOFS/MODELS/2026/10/17/loofs.t12z.20261017.fields.n006.nc.das) identify `u` and `v` on `time, siglay, nele`: face-located eastward and northward velocities in metres per second. The original source currents, mesh and river estimates are unchanged.

## Shared browser and film method

Both the website and film use [src/mesh-flow.js](../src/mesh-flow.js). At a mesh node, it reconstructs a vector from incident valid triangles using positive spherical-area weights. Triangles belong to the same wet-node fan only when connected through valid shared edges touching that node; sharing a vertex alone cannot bridge land or a missing-data wedge.

Within each originally valid triangle, a convex centre fan blends its unchanged face vector with the reconstructed corner vectors. The weights are nonnegative and sum to one. The result equals the source face vector **exactly at the triangle's barycentric centroid**, agrees across valid shared edges, and stays within its contributing component bounds. This exact-centroid property refers to the display triangle centre; the source coordinate check found NOAA's rounded `lonc/latc` within about 3 m of the arithmetic triangle centroids.

The original containing triangle must remain valid. Invalid triangles remain missing, island holes and shoreline clipping remain in force, and source coverage is not enlarged. Reconstruction is performed within the NOAA provider; it does not blend NOAA surface velocities into the separate depth-averaged river calculation. The cursor's displayed current speed, colours and particle sampling now use the interpolated east/north components. Speed is still their magnitude in m/s, rather than the separately accelerated particle travel speed.

## Scope and checks

This is continuous **display interpolation**. It changes values between source centres and does **not preserve native element spatial means, normal face transport, or physical flux conservation**. It is not a new simulation or current measurement. Smooth display values do not establish the accuracy of the broad shear band or local circulation.

The independent check covered all **64,453 native elements**, finding unchanged source values and validity, with zero centroid-vector error. It also found zero disagreement in **661,528 shared-edge sample comparisons** and no convex component overshoot in the sampled band. Synthetic checks cover missing triangles, disconnected wet fans, per-field validity changes, outside queries and source immutability. These verify reconstruction properties, rather than observed-current accuracy or final-video appearance.

Shared helper SHA-256: `1a9ff1f31c1338bab4423a7152e664c96b10fc0fb51b5e7a36c386741f26f4f4`.
