# Lake Ontario: weekly temperature and current film

A deterministic, silent **20-second, 2560 x 1440, 30 fps H.264 loop**, framing Lake Ontario through Brockville without insets, timeline or interactive controls. Colours show modeled surface temperature; particle trails show a fixed estimated flow field.

## Full-week lake inputs and colours

The frozen NOAA LOOFS input has **28 six-hourly surface samples covering all seven UTC calendar days, 12-18 October 2026**. Actual model times run from 12 October 00:00 to 18 October 18:00 UTC. Calendar boundaries are 12 October 00:00 inclusive to 19 October 00:00 exclusive. Eastward/northward face vectors and node temperatures are averaged separately. This is a fixed sampled weekly mean, not chronological replay, a continuous 168-hour integral, climatology, or measured-current/temperature map.

All 64,453 face vectors and 34,395 node temperatures have 28 of 28 valid inputs. Native temperature units are degrees C; the top sigma layer has model-dependent thickness. The source mesh/order is unchanged. See `inputs/source-manifest.json` for every official dataset/request URL and raw-response hash; raw ASCII downloads are not bundled.

The chosen linear scale is **12 to 16.5 degrees C**, labelled **<=12 / >=16.5** (rendered with inequality symbols). Actual mean node extrema are 10.682209 to 16.893734 C. Spherical native wet-area statistics place 99.6582% inside this range, 0.1492% below and 0.19259% above. Endpoint saturation affects colour only, not source values. Grey base/trails explicitly identify unavailable temperature. No temperature is inferred from speed or extrapolated beyond the actual temperature mesh.

## River and mesh display

The **unchanged Kingston-Brockville depth-averaged estimate** retains its separately labelled **12 October 00:00 to 17 October 12:00 UTC** mean-forcing period. Valid regional river vectors take priority over overlapping NOAA vectors; NOAA temperature remains available independently where its source mesh covers the position. This is not a coupled or physically matched surface/depth-average boundary. The river remains simplified and unvalidated; inertia, wind, stratification and vertical shear are omitted. See [river limitations](../../docs/kingston-brockville-estimates.md).

The same `inputs/mesh-flow.js` helper is shared with the browser. Spherical-area-weighted edge-connected wet-node fans and convex centre fans preserve source face vectors at triangle centroids and valid-edge continuity without filling invalid triangles or island holes. It changes interior display values and does not conserve native element spatial means or face transports. The source currents remain in m/s. Temperature is interpolated from its independent native node values. See [mesh display](../../docs/mesh-display.md) and [temperature provenance](../../docs/temperature-week.md).

Fine field sampling is 0.25 output pixels; midpoint particle segments are bounded to 0.2 pixels. Nominal motion acceleration is 70,000. Slow nonzero vectors target 12 design pixels/second with additional boost capped at 1,024; extremely weak flow may remain slower. Exact-zero segments are not drawn. Motion and particle density have no uniform physical-time or discharge interpretation. Temperature colour does not encode current speed.

## Reproduce from the repository layout

Place this bundle at `film/ontario-closeup/` in the source checkout: its immutable external inputs are `../../src/mesh.json` and `../../model/upper-river/display-field.json`. Their exact hashes are recorded in `source-integrity.json`. Requires Node.js 22+, Python 3 and FFmpeg/FFprobe on PATH.

```sh
npm install
node --expose-gc render.mjs config.json --no-poster
python finish.py --output rendered/lake-ontario.mp4
```

The renderer creates a 22-second master; the unchanged finalizer crossfades two seconds into a silent 20-second loop, using CRF 16 for join and body. `canvasModule` may select a package.json beside another Canvas installation; `FFMPEG_BINARY` and `FFPROBE_BINARY` may select executables. Native system fonts can change text appearance across platforms.

## Provenance and review

`source-integrity.json` identifies every frozen input and packaged file. The local and portable renderers differ only in Canvas/FFmpeg resolution and LF normalization. `DATA-SOURCES.md`, `inputs/source-manifest.json` and the saved official DAS describe the data. `qa/` separates current source/thermal tests from prior-movie evidence. Final encoded visual, loop-seam, island-channel and neutral-river reviews **passed**, with no pending visual assessment. The accepted movie is **61,016,615 bytes, 600 frames, 20 seconds**, with SHA-256 `1d85eb18651c7756755c9d26e9fdc93d625460869198d521adcb778890ae73aa`. Historical checks remain labelled as preceding-movie evidence.

Source attribution: NOAA LOOFS retains its provider identity; geography is copyright [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), through [OpenFreeMap](https://openfreemap.org/) and OpenMapTiles. River-source CHS information retains the [Open Government Licence - Canada](https://open.canada.ca/en/open-government-licence-canada). This visualization and its custom hydraulic limitations are the project's responsibility.
