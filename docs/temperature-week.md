# Lake Ontario: hourly temperature and currents

19 October 2026. **Numerical checks and independent encoded visual review accepted.**

The silent **25-second, 750-frame, 2560 × 1440 H.264 film at 30 fps** uses actual hourly NOAA LOOFS conditions for **12–18 October 2026 UTC**. Its first **24 seconds cover 168 hours**, with a source-time clock. The last **one second is a labelled replay dissolve** back to the opening. That dissolve is an editorial restart, not another model hour or a weather transition between the week's end and beginning.

## Actual hourly fields

The dataset contains all 168 hourly states from **12 October 00:00 through 18 October 23:00 UTC**, plus **19 October 00:00** as the closing interpolation endpoint: 169 source states in total. The last chronological frame reads **18 October 23:46 UTC**; 19 October 00:00 is an interpolation endpoint, not an extra displayed day. Actual `Times` values were checked for uniqueness and one-hour spacing. The official [19 October catalogue](https://opendap.co-ops.nos.noaa.gov/thredds/catalog/NOAA/LOOFS/MODELS/2026/10/19/catalog.xml) supplies the final evening from its 00:00 cycle's nowcasts; no forecast substitution was required.

The [official attributes](https://opendap.co-ops.nos.noaa.gov/thredds/dodsC/NOAA/LOOFS/MODELS/2026/10/19/loofs.t00z.20261019.fields.n006.nc.das) identify eastward/northward velocities in m/s at **64,453 native faces**, and temperature in `degrees_C` at **34,395 native nodes**. All selected values are finite. The top sigma layer has model-dependent thickness. These are model results, not direct measurements.

The renderer numerically interpolates adjacent hourly U/V components and node temperatures, using the [shared spatial display reconstruction](mesh-display.md). It does not flatten the week into a mean or simulate chronology by dissolving hourly screenshots. Lake particles advance through the changing field on a source clock compressed **25,200×**: one video second represents seven model hours, with **no additional lake minimum-speed boost**. Particle seeding, integration, shoreline termination and visible trails remain display choices; this is not an observed parcel reconstruction or a new hydrodynamic simulation.

## A fixed temperature scale

The same colour sequence and **12–16.5°C** mapping apply throughout, with explicit **≤12 / ≥16.5** caps. Actual hourly node temperatures range from **7.0215 to 18.3903°C**. Saturation affects endpoint colours, not the retained data. Grey means temperature is unavailable; speed does not substitute for temperature.

The [independent hourly statistical review](../film/ontario-closeup/qa/hourly/hourly-temperature-statistics.json) weights each of the 168 calendar states equally and each original wet triangle by spherical area, using piecewise-linear nodal temperature. It finds **95.0631%** of native wet-area/time inside the scale, **1.0183%** below and **3.9187%** above. At **13 October 20:00 UTC**, the warm cap covers **14.8494%** of native wet area; both caps together cover **15.0679%**. These sampled area/time statistics exclude the closing endpoint and are not a continuous time integral or counts of final video pixels. The earlier weekly mean's 99.6582% inside-range figure does not describe this chronological edition.

## The river stays a separate estimate

Kingston–Brockville retains its [fixed, simplified, unvalidated depth-averaged estimate](kingston-brockville-estimates.md), forced with mean conditions for **12 October 00:00 to 17 October 12:00 UTC**. The lake clock does not turn it into hourly river dynamics. Only weak river particle motion may receive the display minimum of 12 design pixels/second, bounded by a 1,024× additional boost. Those vectors are unchanged and the boost has no physical-time interpretation.

Where actual NOAA temperature overlaps the estimated river flow, its changing temperature may colour those trails. Beyond temperature coverage, the labelled neutral treatment remains. No temperature is extrapolated into river-only cells, and the two velocity products are not a physically coupled surface/depth-average model.

Frozen hourly dataset-manifest SHA-256: `66ff440910a4cb9822c12d59271f70f1ad2d4a6bfc393c9f914230afcb9b7e4e`. The [independent final encoded review](../film/ontario-closeup/qa/hourly/final-encoded-review.json) and [encoding/clock checks](../film/ontario-closeup/qa/hourly/encoded-check.json) passed. Accepted movie: **102,976,638 bytes**, SHA-256 `b6da3ba744ee3a5e50f6d8319d9d81cd2d24c8244d2df9370c0c30491c91b303`. These checks do not validate the underlying local currents. Previous film hashes and reviews apply only to those older editions.
