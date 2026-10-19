# Lake Ontario film source

This bundle renders the Lake Ontario → Brockville current-map film directly with native Canvas. The scientific river estimate remains in the separate `model/upper-river/` companion. Rendering does not fetch live data or capture the website.

## Run

Keep this directory at its committed repository location, two directory levels below the repository root. `config.json` resolves the existing native lake mesh at `../../src/mesh.json` and the selected river-estimate display field at `../../model/upper-river/display-field.json`. Frozen lake vectors and the exact scoped water geometry are supplied in `inputs/`.

Install Node.js, Python 3, and FFmpeg/FFprobe with the `libx264` encoder. From this directory:

```powershell
npm install
node render.mjs config.json --no-video
node render.mjs config.json --no-poster
python finish.py
```

The first render command writes a still review frame. The second writes a **22-second master**. The finalizer crossfades the final two master seconds into the first two, then appends seconds 2–20. It writes a **20-second silent loop**, 600 frames at 30 fps, H.264/yuv420p, with MP4 fast-start metadata. The final join/body encodes use CRF 16 to retain fine trails and reduce differential compression error at the wrap point:

- `rendered/review.png`
- `rendered/master.mp4`
- `rendered/lake-ontario.mp4`
- `rendered/render-manifest.json` and `rendered/media-verification.json`

`npm run preview`, `npm run render` and `npm run finish` are equivalent shortcuts. A small preview can be made with `node render.mjs config.json --no-video --poster-width=960 --poster-height=540`. The renderer finds its own `package.json` by default and pins `@napi-rs/canvas` to **0.1.100**. An optional `canvasModule` config entry points to another package.json relative to the config directory or by absolute path.

FFmpeg uses `FFMPEG_BINARY` or `ffmpeg` on PATH. The Python finalizer accepts `FFMPEG_BINARY`/`FFPROBE_BINARY`, also `FFMPEG`/`FFPROBE`, and otherwise searches PATH. It uses its own script directory, so running `python path/to/finish.py` from elsewhere works. The finalizer has `--config` and `--output` overrides; relative overrides resolve against the script directory. It expects the frozen 22-second/30-fps master. Intermediate short join/body files remain in `rendered/` for inspection.

## Presentation settings and interpretation

The final config uses 2560×1440 output, Web Mercator bounds −80.03..−75.60°, 43.10..44.66°, deterministic seed 74129, 220 warm-up frames, 0.25-pixel field raster cells and a maximum particle integration step of **0.2 output pixels**. Midpoint re-sampling is followed by a final step-bound check, including across sharp source-cell transitions. Island/land masks clip the drawing. Particle density is raised in selected narrow/slow-water regions, without changing the numerical vector fields.

**Motion is not a uniform clock.** The renderer first accelerates flow for readability, then applies an optional bounded, display-only boost to weak nonzero velocities. `minDisplaySpeed: 8` targets **8 design pixels per second**, subject to `maxDisplayBoost: 8`—at most an additional **8×** boost. The target is not a guaranteed lower speed where the cap prevents reaching it. True zero vectors stay zero. Numerical vector direction, stored physical velocities and speed-colour lookup values remain unchanged. The visible speed legend represents physical source speed, not the boosted screen-motion speed. The film footer says motion is scaled for legibility; this note records the nonuniform scaling explicitly.

The separate lake source is an average of 23 six-hourly NOAA surface-vector fields for 12–17 October 2026. The river source is a **simplified, unvalidated depth-averaged steady mean-condition estimate**, with an estimates disclaimer retained in the film. It is not a mean of hourly river-current simulations. Local jets and inertial eddies are not quantitatively recovered. The NOAA field keeps priority where it has coverage; this bundle does not replace scientific vectors with hand-drawn paths. See the model companion's methods and source documentation for numerical assumptions and the upstream boundary extension.

The random seed and input fields are frozen, but identical PNG/MP4 hashes are not promised across platforms. Georgia/Consolas are requested as native fonts; available fonts and fallback glyph metrics can change layout. Fonts are not bundled. Native Canvas, FFmpeg versions and system libraries can also affect rasterisation/encoding. If needed, supply properly licensed local `fontFiles` entries in the config to register the intended fonts.

The current river field uses a stable **local-stage wet/dry mask**. The previous global lower-endpoint cutoff falsely dried upstream shoals beside Bayfield Island. Retrieved bed elevations and source water polygons remain unchanged; the channel is recalculated, not painted in. The model companion records the corrected connection and its depth uncertainty. Bayfield Bay still has weak modeled through-flow; wind and inertial circulation remain unresolved.

The renderer skips **exactly zero-length segments**. Round line caps otherwise paint stationary dots, whose particle reseeding could flicker without any travel. Image-to-image pixel differences alone are not evidence of physical flow.

The display field raster is **0.25 output pixels** (about 36 m at this framing). The preceding 0.5-pixel raster could close the newly reopened southern mouth again. Both northern and southern paths now remain connected in the actual renderer raster, with every checked edge inside sourced water. A targeted integration trace also crosses the southern opening continuously into the bay. The [display and trajectory evidence](qa/) retains both the failed coarser grid and accepted finer grid. This finer drawing grid samples the same numerical vectors; it does not increase hydraulic-model resolution or accuracy.

## Frozen inputs and provenance

`source-integrity.json` records original renderer/config hashes, the two portable runtime substitutions, all bundled source-input hashes and the expected external mesh/river-field hashes. The bundled lake field and water GeoJSON are **byte-identical** copies of the selected production inputs. Only package/runtime paths are normalised in the copied renderer/config. No scientific data is rounded or regenerated by this packaging.

- Lake vectors and mesh: [NOAA Lake Ontario Operational Forecast System](https://tidesandcurrents.noaa.gov/ofs/loofs/loofs_info.html). Their native numerical source and mean period are recorded in the source field and repository methods.
- River inputs: [CHS NONNA bathymetry](https://open.canada.ca/data/en/dataset/d3881c4c-650d-4070-bf9b-1e00aabf0a1d), CHS water levels and [IJC outflow notices](https://ijc.org/en/loslrb/watershed/outflow-changes). The model companion retains exact requests, datums and estimated-bed masks.
- Shoreline/water geometry: **© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)** via [OpenFreeMap](https://openfreemap.org/) and [OpenMapTiles](https://openmaptiles.org/), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The source-derived water GeoJSON is supplied for reproducibility; retain its attribution and database licence when redistributing it.
- CHS NONNA: contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). Rendering-code terms and upstream dependency terms remain separate from the source-data licences.

Source attribution and the river **ESTIMATES** line stay in the video. Agency attribution identifies provenance and does not imply endorsement of the custom model or film.
