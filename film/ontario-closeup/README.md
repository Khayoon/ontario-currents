# Lake Ontario film

A deterministic, silent **20-second, 2560 × 1440, 30 fps H.264 loop**, showing Lake Ontario through Brockville without insets or interactive controls.

## Field selection

The film uses the **regional depth-averaged hydraulic estimate throughout its solved upper-river domain**, including overlap with the NOAA mesh. Elsewhere it uses the NOAA LOOFS surface vector mean of 23 six-hourly fields from 12 October 2026 00:00 to 17 October 2026 12:00 UTC. `riverSourcePriority: "model"` explicitly overrides the river JSON's fallback default. The underlying JSON vectors are copied unchanged.

The preceding film gave NOAA priority wherever its mesh overlapped the river. At Cape Vincent, some overlapping surface and hydraulic vectors opposed each other by more than 150 degrees. Particle paths frequently terminated at invalid field edges, leaving a dark strip despite available vectors. Selecting one regional field removes that internal source mosaic; it does **not** establish a physically continuous, same-depth handoff to NOAA at the outer edge.

The river domain's artificial inlet cut is now 3 km upstream of the original cut, 2 km farther than the preceding version. This includes genuine western approach water previously omitted by the computational boundary. Original source geometry and retrieved depths are unchanged. Missing depths use the same explicit harmonic bed estimate, regenerated for the expanded domain; inferred bed in common cells can also change (maximum 0.404 m in this revision). Applying the Kingston mean stage at this shifted cut remains a boundary-placement approximation. See the [numerical model](../../model/upper-river/) and [limitations](../../docs/kingston-brockville-estimates.md).

## Drawing choices

The exact sourced water background is lighter so water does not resemble disconnected land when trails are sparse. This background is geography, not current evidence. Fine field sampling remains 0.25 output pixels, with midpoint advection steps bounded to 0.2 pixels. No water-mask dilation or invented vectors are used.

Weak nonzero vectors receive a bounded drawing-speed boost: target minimum 12 design pixels/second, maximum multiplier 1024. Direction and stored speed values remain unchanged, and exact-zero segments are not drawn. The logarithmic colour scale still uses the source vector magnitude, capped at 150+ cm/s. Trail motion has **no uniform physical time scale**; it is enhanced for legibility, as the in-frame footer states. Particles are illustrative, not observed parcel trajectories. Weak mean vectors do not establish that water was stationary over the week.

The small **ESTIMATES** disclaimer remains in the film. The simplified steady diffusion-wave model is unvalidated against local currents, omits inertia, wind, stratification and vertical shear, and relies on estimated bed in parts of the island channels. Readability and source coverage do not establish model accuracy.

## Reproduce

Requires Node.js 22+, Python 3, FFmpeg/FFprobe on PATH and the Canvas package listed here.

```sh
npm install
node --expose-gc render.mjs config.json --no-poster
python finish.py --output rendered/lake-ontario.mp4
```

The renderer produces a 22-second master. The finalizer crossfades two seconds into a silent 20-second loop, with CRF 16 for both join and body. `canvasModule` may specify a package.json beside another Canvas installation; `FFMPEG_BINARY` and `FFPROBE_BINARY` may select executables.

## Provenance and visual review

`source-integrity.json` records exact hashes. The local and portable renderers differ only in dependency/executable resolution and LF normalization. Inputs retain their original licences and attribution. `qa/` separates numerical coverage, actual advection and encoded trail visibility. Background brightness alone is not accepted as proof of a moving trail.
