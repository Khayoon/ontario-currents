# Hourly Lake Ontario data sources

Prepared 19 October 2026. **Coloured river edition accepted: source, transport, encoding and visual checks pass.** The hourly lake data and completed source checks are unchanged. Earlier movie acceptance belongs to the preceding edition with neutral river-only temperatures.

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

The static Kingston–Brockville current estimate keeps its separate **12 October 00:00 to 17 October 12:00 UTC** mean forcing and remains simplified, depth-averaged and unvalidated. Only weak river particle motion receives the bounded display boost (12 design pixels/second target, at most an additional 1,024×); it does not alter river vectors or enter the temperature transport calculation. The lake clock does not imply hourly river hydraulics.

## Passive river-temperature supplement

The renderer keeps every finite NOAA model temperature, including zero. Only missing temperature under the selected river provider is supplemented by estimated temperature, using the same fixed palette. Original U/V, provider priority, wet cells, bathymetry and hourly lake arrays remain unchanged. The new output covers every one of the **121,644 original valid river display cells**; it does not create velocity or water coverage.

`inputs/river-temperature/manifest.json` binds the scalar to the original river field SHA-256, exact regular-grid geometry and the same 169 UTC endpoints as the lake. Frozen binary layout:

| Array | Shape | Meaning | Units |
|---|---|---|---|
| `temperature.f32` | 169 × 121,644 | estimated temperature at compact original river cells | degrees C |
| `index-map.i32` | 865 × 1,144 | original regular cell → compact wet index; −1 outside | integer index |

Both use little-endian C order. The exact source river display hash is `653d31ac284a724bd83d000064f19d375d5e6a8dd14a320fb48a4f0eef3904bb`. Binary hashes and completed numerical diagnostics are bound by the manifest and `qa/river-temperature/` reports. All 169 × 121,644 scalar values are finite; the selected display range is 12.0601–16.7746°C.

The estimate transports NOAA inlet temperature using the frozen native hydraulic solution's **344,179 face discharges** and **177,775 depth-derived cell volumes**. Physical volume is depth × 2,500 m²; visually enhanced particle motion is not a transport input. Initially every cell is assumed to be **15.04994844°C**, the first-hour discharge-weighted inlet temperature. An independent tracer tracks remaining initial-water fraction. The calculation omits atmospheric, solar, bed and tributary heat exchange, stratification and time-varying hydraulics. Slow cells may retain assumed initial temperature throughout the week. Its surface-temperature boundary and depth-averaged carrier are not a coupled three-dimensional thermal model.

Of 110 positive-inflow boundary cells, 109 have direct NOAA wet-triangle temperature support, representing **99.9555527%** of the inflow. One nearshore cell carries **0.0444473%** and receives the contemporaneous discharge-weighted temperature of covered inflows. This is a declared boundary estimate. The [dedicated method notes](../../docs/river-temperature-estimates.md) explain initialization, numerical mixing, continuity compensation and completed full-week numerical checks.

## Edition-specific acceptance

Final coloured-film review passed; its movie SHA-256 is recorded below. The **previous hourly edition with neutral river-only temperatures** passed its [encoded visual review](qa/hourly/final-encoded-review.json) and [encoding/clock checks](qa/hourly/encoded-check.json): **102,976,638 bytes**, SHA-256 `b6da3ba744ee3a5e50f6d8319d9d81cd2d24c8244d2df9370c0c30491c91b303`. These certify only that previous encoded visualization and clock presentation, not physical current or temperature accuracy. Earlier 20-second film hashes are historical too.

Accepted coloured movie: **103,544,787 bytes**, **25 seconds / 750 frames / 2560 × 1440 / 30 fps**, silent H.264. SHA-256 `5c57c348290d527c350ecba138517da96803dce5254ba2926282e4bc5a932458`. [Actual encoded visual review](qa/river-temperature/final-encoded-review.json) and [encoding, clock and unchanged-lake checks](qa/river-temperature/encoded-check.json) pass. These checks verify the displayed artifact, not real-world river temperature accuracy.
