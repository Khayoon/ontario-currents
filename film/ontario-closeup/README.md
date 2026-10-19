# Lake Ontario: chronological temperature and current film

**Coloured river edition accepted: source, transport, encoding and visual checks pass.** This is a silent **25-second, 750-frame, 2560 × 1440, 30 fps H.264 film**. Its first 24 seconds show the 168-hour UTC week of 12–18 October 2026. The final one-second, explicitly labelled replay dissolve returns to the opening. It is an editorial restart, not modeled weather or a physical transition between the final and first fields.

## Hourly inputs and source clock

`inputs/hourly/manifest.json` identifies **169 endpoints**: every hour from 12 October 00:00 through 18 October 23:00, plus 19 October 00:00 for interpolation through the final interval. It records actual checked timestamps, native dimensions, binary hashes and official request/raw-response hashes. All 64,453 face vectors and 34,395 node temperatures are finite at every source time. U/V are in m/s; temperature is in degrees C at the top, model-dependent sigma layer. No weekly averaging or forecast substitution is used.

Adjacent hourly east/north components and node temperatures are interpolated numerically. The shared centre-fan helper handles spatial display velocities within the original valid triangles; temperature remains independently interpolated from nodes. Invalid coverage and island holes are not filled, and the spatial reconstruction does not conserve native element means or face transports. No sequence of screenshot dissolves substitutes for these changing numerical fields.

Lake particles integrate the changing field using **25,200 model seconds per video second** (seven hours per second). **Lake motion has no additional minimum-speed boost.** Sampling, seeding, warm-up, shoreline termination and visible trails remain rendering choices, so these are illustrative model trajectories rather than observed parcels.

## Fixed palette, static river currents and estimated temperature

The original colour sequence stays fixed at **12–16.5°C**, with explicit **≤12 / ≥16.5** caps. Actual hourly source nodes span 7.0215–18.3903°C. The [168-state native wet-area/time review](qa/hourly/hourly-temperature-statistics.json) places 95.0631% inside the scale, 1.0183% below and 3.9187% above. The warm cap reaches 14.8494% of native wet area at 13 October 20:00 UTC; total endpoint saturation then reaches 15.0679%. Saturation changes colour only. Grey identifies unavailable temperature; current speed never substitutes for temperature. See [temperature sources and interpretation](../../docs/temperature-week.md).

The regional Kingston–Brockville estimate stays **fixed**, with its separate **12 October 00:00 to 17 October 12:00 UTC** mean-forcing period. It is simplified, depth-averaged and unvalidated against local currents; the advancing lake clock does not make it hourly river dynamics. Weak river particles alone can receive a display boost targeting 12 design pixels/second, capped at an additional 1,024×. Exact-zero motion remains zero. That boost changes neither vectors nor temperatures and has no physical-time meaning.

Regional river vectors take priority where solved. Every finite NOAA model temperature remains preferred independently wherever its mesh supplies a valid scalar. Only missing temperature under the first river provider is supplemented by a separately labelled passive-temperature estimate, through the same fixed palette. No speed value is used as temperature, and any genuinely missing scalar remains neutral.

The new calculation transports hourly inlet temperatures with the unchanged native hydraulic face discharges and depth-derived cell volumes. It assumes a uniform initial **15.04994844°C**, tracks the fraction of initial water, and includes no atmospheric, solar, bed or tributary heat exchange, stratification or changing hydraulic flow. It supplies all **121,644 original valid river display cells**, including slow cells that can retain the assumed initial state. Display boosts do not enter the transport solver. This is not observed river temperature, a validated thermal forecast or a physically coupled surface/depth-average handoff. Read the [hydraulic assumptions](../../docs/kingston-brockville-estimates.md) and [passive-temperature notes](../../docs/river-temperature-estimates.md).

## Direct render

This package lives at `film/ontario-closeup/` in the repository layout. Lake binaries sit beside `inputs/hourly/manifest.json`; estimated scalar binaries sit beside `inputs/river-temperature/manifest.json`. Mesh and river-vector references retain their repository-relative paths. Requires Node.js 22+, FFmpeg on PATH and the pinned Canvas dependency. Python is only needed for optional source preparation/checks.

```sh
npm install
npm run render
```

The renderer writes the **final 25-second movie directly** to the configured video path. The previous 22-second-master/`finish.py` procedure belongs to the earlier 20-second edition and is not used here. The replay dissolve is part of the chronological renderer. Native system fonts can vary across platforms.

## Provenance and review status

`DATA-SOURCES.md` describes the unchanged lake arrays, fixed river period and new passive-temperature inputs. Lake dataset-manifest SHA-256 remains `66ff440910a4cb9822c12d59271f70f1ad2d4a6bfc393c9f914230afcb9b7e4e`. New temperature modelling/integration checks belong under `qa/river-temperature/`; full-week transport diagnostics and final coloured-film review pass, with the accepted movie hash below. The final chronological clock is **18 October 23:46 UTC**; 19 October 00:00 remains an interpolation endpoint.

The **previous hourly edition with neutral river-only temperatures** passed its [encoded visual review](qa/hourly/final-encoded-review.json) and [encoding/clock checks](qa/hourly/encoded-check.json). Its movie is **102,976,638 bytes**, SHA-256 `b6da3ba744ee3a5e50f6d8319d9d81cd2d24c8244d2df9370c0c30491c91b303`. These previous passes do not certify the new coloured movie or validate measured current or temperature accuracy.

The [preceding edition](history/pre-hourly/README.md) retains its historical record. Earlier 20-second movie hashes, 600-frame checks and weekly-mean statistics apply only to those preceding editions.

Attribution: NOAA LOOFS retains its provider identity. Geography is © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), through OpenFreeMap and OpenMapTiles. CHS river-source information retains the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). The visualization and custom hydraulic limitations are this project's responsibility.

Accepted coloured movie: **103,544,787 bytes**, **25 seconds / 750 frames / 2560 × 1440 / 30 fps**, silent H.264. SHA-256 `5c57c348290d527c350ecba138517da96803dce5254ba2926282e4bc5a932458`. [Actual encoded visual review](qa/river-temperature/final-encoded-review.json) and [encoding, clock and unchanged-lake checks](qa/river-temperature/encoded-check.json) pass. These checks verify the displayed artifact, not real-world river temperature accuracy.
