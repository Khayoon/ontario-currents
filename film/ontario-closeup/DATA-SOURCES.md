# Hourly Lake Ontario data sources

Prepared 19 October 2026. **Chronological movie numerical checks and independent encoded visual review accepted.** These are hourly numerical fields, not the preceding 28-sample weekly mean.

## Actual times and native arrays

There are **168 calendar-hour states**, from **12 October 2026 00:00 UTC through 18 October 23:00 UTC**, and a **19 October 00:00 UTC closing endpoint**: 169 rows total. Every actual NOAA `Times` string was parsed and checked for exact expected time, uniqueness and one-hour spacing. The closing endpoint supports interpolation through the final interval and is excluded from the 168-state calendar statistics.

`inputs/hourly/manifest.json` indexes three headerless, little-endian Float32 arrays beside it, in C order, time-major:

| Array | Shape | Native location | Units | Bytes |
|---|---|---|---|---:|
| `u.f32` | 169 × 64,453 | triangle faces, eastward | m/s | 43,570,228 |
| `v.f32` | 169 × 64,453 | triangle faces, northward | m/s | 43,570,228 |
| `t.f32` | 169 × 34,395 | mesh nodes | degrees C | 23,251,020 |

All values are finite. Source Float32 precision is retained without six-decimal JSON rounding, component rotation, spatial filling, extrapolation or temporal averaging. The unchanged native mesh has SHA-256 `d5720f28802855db79f088946e359e75554ad64f432a048e7df06f45832471cf`. A fresh closing-cycle `lon,lat,nv` response matches its triangle order exactly and node coordinates to floating-point roundoff; every selected hourly surface response has the expected native dimensions.

Frozen dataset-manifest SHA-256: `66ff440910a4cb9822c12d59271f70f1ad2d4a6bfc393c9f914230afcb9b7e4e`. Binary SHA-256 values:

- U: `82876e4a133ee745e975ad59eb78aa69504866e34aa39afa3dc8cf86ec632269`.
- V: `15b73cac293658f8af27aa704c6a533707292480327198b00fb5b4ed85733732`.
- T: `5d083d7be1c42d7c7be8de4fef5db2876b4e112bee8957d8237ef2d665aa9567`.

## Official source interpretation

NOAA's [model information](https://tidesandcurrents.noaa.gov/ofs/loofs/loofs_info.html) describes four daily cycles, each with six-hour nowcasts. Candidate files `n001`–`n006` were selected using cycle time minus six hours plus their nowcast-hour index; actual `Times` values, rather than filenames alone, confirmed every selection. No forecasts were substituted. The [19 October official catalogue](https://opendap.co-ops.nos.noaa.gov/thredds/catalog/NOAA/LOOFS/MODELS/2026/10/19/catalog.xml) supplies 18 October 19:00–23:00 from the 00:00 cycle's `n001`–`n005`; `n006` supplies the closing endpoint.

The [official attributes](https://opendap.co-ops.nos.noaa.gov/thredds/dodsC/NOAA/LOOFS/MODELS/2026/10/19/loofs.t00z.20261019.fields.n006.nc.das) identify face-located east/north U/V in `meters s-1` and node-located temperature in `degrees_C`. The selected top sigma layer has model-dependent thickness, not a fixed observational depth. The manifest records every exact constrained request URL and raw-response hash; 32 retained responses were reused and 137 downloaded, without changing earlier files.

## Hourly temperature statistics and fixed palette

The 168 calendar states have actual node extrema **7.021476–18.390301°C**. The [independent analytic review](qa/hourly/hourly-temperature-statistics.json) uses piecewise-linear nodal temperatures within original wet triangles, weighted by spherical triangle area and equally by the 168 hourly states. These are sampled native wet-area/time statistics, not a continuous integral, unweighted coastal node counts or final video pixels.

For the fixed **12–16.5°C** scale, **95.0631%** of native wet-area/time is inside, **1.0183%** below and **3.9187%** above. The 1st/50th/99th area-time percentiles are approximately **11.9896 / 15.1578 / 16.7622°C**. At **13 October 20:00 UTC**, **14.8494%** of native area is above 16.5°C and **15.0679%** is outside either endpoint. Both caps are explicit in the legend (**≤12 / ≥16.5**); palette mapping stays fixed for the entire movie without modifying data. The preceding weekly mean's 99.6582% inside-scale result does not apply to these changing hourly fields.

## Playback and separate river

The renderer numerically interpolates adjacent hourly U/V and node temperatures. The first **24 seconds compress 168 model hours by 25,200×**. Lake advection uses that source clock without an extra minimum-speed boost. The final **one-second labelled replay dissolve** is an editorial restart, not an interpolation of modeled weather across the week boundary. The silent H.264 movie is **25 seconds / 750 frames at 30 fps, 2560 × 1440**, rendered directly without the older `finish.py` procedure. Its last chronological frame reads **18 October 23:46 UTC**; 19 October 00:00 is used only as an interpolation endpoint.

The static Kingston–Brockville estimate keeps its separate **12 October 00:00 to 17 October 12:00 UTC** mean forcing and remains simplified, depth-averaged and unvalidated. Only weak river particle motion receives the bounded display boost (12 design pixels/second target, at most an additional 1,024×); it does not alter river vectors or temperatures or imply hourly river dynamics. Actual NOAA temperature can colour river trails only inside its source coverage. Elsewhere the missing-temperature treatment is neutral grey; no temperature is inferred from speed or extrapolated into river-only cells.

The [independent final encoded review](qa/hourly/final-encoded-review.json) and [encoding/clock checks](qa/hourly/encoded-check.json) passed for the **102,976,638-byte** movie, SHA-256 `b6da3ba744ee3a5e50f6d8319d9d81cd2d24c8244d2df9370c0c30491c91b303`. These confirm the encoded visualization and source-clock presentation, not the physical accuracy of local currents. Encoded passes and hashes from earlier 20-second films remain historical.
