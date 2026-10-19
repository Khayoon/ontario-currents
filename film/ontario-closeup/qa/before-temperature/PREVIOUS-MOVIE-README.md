# Continuous mesh display checks

The current reports identify the original source fields and final helper by hash. Source JSON and valid wet triangles are retained. These checks verify interpolation and its presentation, not observed current accuracy or physical transport conservation.

- `source-neighbour-audit.json`: original NOAA index/coordinate and 23-snapshot mean checks; actual opposing edge-normal velocities explain the constant-triangle depletion seam.
- `independent-reconstruction-review.json`: exact original triangle-centre values and masks, shared-edge continuity, convex component bounds and independent spherical-area comparison on the final stable helper.
- `display-integration-regression.json`: actual production raster comparison; valid/provider cells are unchanged and all regional hydraulic-estimate display vectors remain byte-identical.
- `controlled-preview-review.json`: matched before/after encoded region with identical screen scale, stroke, motion, warmup, seed and density. The repeated sharp teeth disappear while the broader shear remains.
- `targeted-band-trajectory-review.json`: bounded integration of identical seeds in both fields, measuring sharp turns and actual travel rather than inferring motion from changing pixels.
- `final-band-review.json`: checks the actual full-resolution finalized MP4, rather than accepting the diagnostic clip alone.
- `final-carleton-review.json`: repeats the wider upstream/Carleton trail-ink review on this final movie, with a matching background-only reference. Brighter water alone is not evidence of a trail.
- `final-seam-review.json`: unchanged encoded loop-wrap criterion.

The earlier Carleton-Wolfe source diagnosis, trajectories and numerical checks are archived in `before-mesh-interpolation/` and concern that preceding movie. All development paths in reports are provenance references; current reproduction uses the package's relative `config.json` and frozen inputs.
