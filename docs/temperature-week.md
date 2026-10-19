# Lake Ontario: hourly temperature and currents

19 October 2026. **Coloured river edition accepted: source, transport, encoding and visual checks pass.** The hourly lake dataset and its numerical checks are unchanged.

The silent **25-second, 750-frame, 2560 × 1440 H.264 film at 30 fps** uses actual hourly NOAA LOOFS conditions for **12–18 October 2026 UTC**. Its first **24 seconds cover 168 hours**, with a source-time clock. The last **one second is a labelled replay dissolve** back to the opening. That dissolve is an editorial restart, not another model hour or a weather transition between the week's end and beginning.

## Actual hourly fields

The dataset contains all 168 hourly states from **12 October 00:00 through 18 October 23:00 UTC**, plus **19 October 00:00** as the closing interpolation endpoint: 169 source states in total. The last chronological frame reads **18 October 23:46 UTC**; 19 October 00:00 is an interpolation endpoint, not an extra displayed day. Actual `Times` values were checked for uniqueness and one-hour spacing. The official [19 October catalogue](https://opendap.co-ops.nos.noaa.gov/thredds/catalog/NOAA/LOOFS/MODELS/2026/10/19/catalog.xml) supplies the final evening from its 00:00 cycle's nowcasts; no forecast substitution was required.

The [official attributes](https://opendap.co-ops.nos.noaa.gov/thredds/dodsC/NOAA/LOOFS/MODELS/2026/10/19/loofs.t00z.20261019.fields.n006.nc.das) identify eastward/northward velocities in m/s at **64,453 native faces**, and temperature in `degrees_C` at **34,395 native nodes**. All selected values are finite. The top sigma layer has model-dependent thickness. These are model results, not direct measurements.

The renderer numerically interpolates adjacent hourly U/V components and node temperatures, using the [shared spatial display reconstruction](mesh-display.md). It does not flatten the week into a mean or simulate chronology by dissolving hourly screenshots. Lake particles advance through the changing field on a source clock compressed **25,200×**: one video second represents seven model hours, with **no additional lake minimum-speed boost**. Particle seeding, integration, shoreline termination and visible trails remain display choices; this is not an observed parcel reconstruction or a new hydrodynamic simulation.

## A fixed temperature scale

The same colour sequence and **12–16.5°C** mapping apply throughout, with explicit **≤12 / ≥16.5** caps. Actual hourly node temperatures range from **7.0215 to 18.3903°C**. Saturation affects endpoint colours, not the retained data. Grey means temperature is unavailable; speed does not substitute for temperature.

The [independent hourly statistical review](../film/ontario-closeup/qa/hourly/hourly-temperature-statistics.json) weights each of the 168 calendar states equally and each original wet triangle by spherical area, using piecewise-linear nodal temperature. It finds **95.0631%** of native wet-area/time inside the scale, **1.0183%** below and **3.9187%** above. At **13 October 20:00 UTC**, the warm cap covers **14.8494%** of native wet area; both caps together cover **15.0679%**. These sampled area/time statistics exclude the closing endpoint and are not a continuous time integral or counts of final video pixels. The earlier weekly mean's 99.6582% inside-range figure does not describe this chronological edition.

## Fixed river currents and a separate temperature estimate

Kingston–Brockville retains its [fixed, simplified, unvalidated depth-averaged estimate](kingston-brockville-estimates.md), forced with mean conditions for **12 October 00:00 to 17 October 12:00 UTC**. The lake clock does not turn it into hourly river dynamics. Only weak river particle motion may receive the display minimum of 12 design pixels/second, bounded by a 1,024× additional boost. Those vectors are unchanged and the boost has no physical-time interpretation.

Every finite NOAA model temperature retains priority, including where estimated river vectors override lake velocities. Where NOAA temperature is unavailable under those river vectors, a separately labelled **passive-temperature estimate** now supplies the river colour. It uses the same palette and the same clock, with no speed-to-temperature substitution. The new scalar calculation covers all **121,644 original river display cells**; it does not change a vector, island, wet mask or lake source value.

Temperature is carried by the fixed hydraulic model's physical face discharges through depth-derived cell volumes, independently of enhanced display motion. The initial state is assumed uniformly **15.04994844°C**, the first-hour discharge-weighted inlet temperature. A second tracer records the fraction of that assumed initial water remaining at each time. Atmospheric, solar, bed and tributary heat exchange, stratification and changing river hydraulics are omitted. Thus coloured slow bays can still reflect initialization rather than water newly transported from the lake. This is not a measured temperature map, validated surface forecast or physically coupled lake–river thermal model. See [river-temperature sources, assumptions and audits](river-temperature-estimates.md).

Frozen hourly lake dataset-manifest SHA-256 remains `66ff440910a4cb9822c12d59271f70f1ad2d4a6bfc393c9f914230afcb9b7e4e`. New temperature inputs and checks are packaged under `film/ontario-closeup/inputs/river-temperature/` and `qa/river-temperature/`. Their completed diagnostics and the accepted coloured-movie hash are recorded below.

The **previous hourly edition with neutral river-only temperatures** passed its [encoded visual review](../film/ontario-closeup/qa/hourly/final-encoded-review.json) and [encoding/clock checks](../film/ontario-closeup/qa/hourly/encoded-check.json). Its movie was **102,976,638 bytes**, SHA-256 `b6da3ba744ee3a5e50f6d8319d9d81cd2d24c8244d2df9370c0c30491c91b303`. Those passes and that hash do not certify the new coloured river film or the physical accuracy of either model. Earlier weekly-mean hashes are historical too.

Accepted coloured movie: **103,544,787 bytes**, **25 seconds / 750 frames / 2560 × 1440 / 30 fps**, silent H.264. SHA-256 `5c57c348290d527c350ecba138517da96803dce5254ba2926282e4bc5a932458`. [Actual encoded visual review](../film/ontario-closeup/qa/river-temperature/final-encoded-review.json) and [encoding, clock and unchanged-lake checks](../film/ontario-closeup/qa/river-temperature/encoded-check.json) pass. These checks verify the displayed artifact, not real-world river temperature accuracy.
