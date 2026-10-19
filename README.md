# Ontario Currents

An interactive atlas of modelled water currents from Lake Ontario into the St. Lawrence, with Lake Simcoe and the Montréal archipelago included in the shoreline geography. A companion film follows hourly October lake conditions alongside separately labelled river current and passive-temperature estimates.

**[Explore the live atlas](https://khayoon.github.io/ontario-currents/)** · **[Watch the Lake Ontario close-up](https://khayoon.github.io/ontario-currents/media/lake-ontario-closeup.mp4?v=river-temperature-20261019)** · **[Data and methods](docs/data-and-methods.txt)**

[![The live atlas showing Lake Ontario currents, Lake Simcoe and the St. Lawrence shorelines](docs/atlas-preview.jpg)](https://khayoon.github.io/ontario-currents/)

## What this project demonstrates

- **Scientific data visualization:** retains NOAA's native 34,395-node / 64,453-triangle source mesh and reconstructs continuous display velocities with exact source vectors at triangle centres. Missing wet triangles stay missing; node temperatures remain separately interpolated. See the [mesh display method](docs/mesh-display.md).
- **Interactive graphics:** Canvas particle animation, geographic pan and zoom, source-aware cursor readouts, temperature/speed layers and Lake Ontario forecast playback.
- **Numerical modelling:** separate experimental Simcoe wind-response and upper-river hydraulic solvers use public bathymetry and boundary records, with conservation and sensitivity checks. Their unvalidated depth averages are identified separately from retrieved current products.
- **Data engineering:** adapts multiple public model products with different layers, grids and valid times; preserves missing-data masks and reports the dates behind the display.
- **Static deployment with updating data:** a Node ingestion job publishes JSON for a static GitHub Pages frontend. The browser does not require a private proxy or a sign-in.
- **Resilience and provenance:** stored source fields remain available during upstream outages, with explicit refresh status and source times. Geography, model attribution and coverage limits accompany the visualization.

The retrieved current products are produced by NOAA, ECCC and DFO. This project implements their ingestion, visualization and publication; it does not claim authorship of those models. The separately identified Simcoe and upper-river experiments are implemented in this repository.

## Two views of the data

The **website** supports live-source exploration and sampled 24-hour vector means. Its Lake Ontario timeline and Canadian river/estuary products have independently reported valid times. Automated refreshes are scheduled hourly; execution depends on GitHub Actions and source availability. Read the dates shown in the interface.

The map fills the main view. The Ontario timeline, playback and refresh tools open through a compact **Time controls** disclosure.

**Coloured river edition accepted: source, transport, encoding and visual checks pass.** The silent film is **25 seconds, 750 frames, 2560 × 1440 H.264 at 30 fps**. The first **24 seconds show 168 hours**, from 12 October 2026 00:00 UTC through the end of 18 October. A UTC clock follows the changing conditions. The final **one-second labelled replay dissolve** returns to the opening; it is an editorial transition, not modeled weather or an interpolation across the week boundary.

The source dataset contains **169 endpoints**: 168 actual hourly NOAA LOOFS states plus **19 October 00:00 UTC**, with all 64,453 face vectors and 34,395 node temperatures valid. That closing endpoint supports the last interpolation interval. Adjacent hourly eastward/northward components and temperatures are interpolated numerically as the source clock advances. This edition does not average the week into one field or crossfade between hourly screenshots. See the [hourly temperature sources and interpretation](docs/temperature-week.md).

Lake particle motion follows the physical velocity components on the compressed source clock: **25,200 source seconds per video second** (seven hours per second). There is no additional minimum-speed boost for lake particles. The shared centre-preserving mesh reconstruction removes artificial triangular jumps while retaining broader source shear; it is display interpolation, not a higher-resolution or flux-conserving simulation. Seeding, shoreline termination and visible trails remain rendering choices, rather than validated water-parcel trajectories.

The fixed **12–16.5°C** palette retains explicit **≤12 / ≥16.5** endpoint caps. Hourly NOAA model node temperatures range from **7.02 to 18.39°C**. Independent native wet-area/time statistics place **95.0631%** inside the scale, **1.0183%** below and **3.9187%** above; endpoint saturation is visible and does not alter temperatures. Grey identifies unavailable temperature, and current speed never substitutes for temperature. The map keeps the same colour mapping throughout the week.

The Kingston–Brockville **current estimates** stay fixed, using mean forcing for **12 October 00:00 to 17 October 12:00 UTC**. This is a simplified, steady, unvalidated depth-averaged hydraulic calculation from CHS bathymetry/water levels and an IJC discharge scenario; it is **not hourly river circulation**. Weak river particles alone may receive a bounded display boost targeting 12 design pixels/second, capped at 1,024×. That extra drawing motion does not change current vectors or the physical discharges used for temperature transport. See the [river model and limitations](docs/kingston-brockville-estimates.md).

The new **river temperature estimate** transports hourly NOAA lake-inlet temperatures through that unchanged hydraulic field, using physical face discharges and cell water volumes. Where directly supplied NOAA model temperature is available it keeps priority; missing river temperature alone is supplemented with the estimate, through the same **12–16.5°C palette**. The frozen output covers all **121,644 original valid river display cells**, without adding water or current coverage. It assumes a uniform initial **15.04994844°C**, tracks the remaining initial-water fraction, and omits atmospheric, solar, bed and tributary heat exchange and thermal stratification. Slow waters can therefore retain the assumed initial temperature. This is **not observed river temperature or a validated thermal forecast**. Read the [passive-temperature assumptions and checks](docs/river-temperature-estimates.md).

Valid regional river vectors retain priority within the solved river domain; NOAA supplies changing lake vectors elsewhere. The 3 km upstream inlet and local-stage wet/dry correction retain sourced shoreline and retrieved depths, with explicit estimated-bed uncertainty. Supplemented river colours do not establish a physically coupled surface/depth-average lake–river model.

The [portable renderer and input documentation](film/ontario-closeup/) describe the direct 25-second render, with new scalar inputs under `inputs/river-temperature/` and their checks under `qa/river-temperature/`. Final coloured-film acceptance and its movie hash are recorded below. The **previous hourly edition**, which left river-only temperature neutral, passed its [encoded visual review](film/ontario-closeup/qa/hourly/final-encoded-review.json) and [encoding/clock checks](film/ontario-closeup/qa/hourly/encoded-check.json): **102,976,638 bytes**, SHA-256 `b6da3ba744ee3a5e50f6d8319d9d81cd2d24c8244d2df9370c0c30491c91b303`. That hash and those passes apply to the previous movie. Earlier 20-second weekly-mean film checks are also historical.

The earlier [broader Ontario–St. Lawrence film](https://khayoon.github.io/ontario-currents/media/october-current-map.mp4) remains available. It includes Montréal and the estuary, plus a separately labelled experimental Simcoe inset. The live atlas retains that broader geographic scope.

**Lake Simcoe's experimental layer** is a fixed-date, unvalidated depth-averaged wind response, present in both website modes and labelled in the earlier broader film. It is not measured circulation or a surface-current forecast. Its physical assumptions, source data, solver and sensitivity checks are described in the [Simcoe model notes](docs/simcoe-model.md).

The main map uses brighter, longer flowing trails as well as the close-ups. The outer estuary is filled from a broader **DFO STLE500** archive mean for the same 12–17 October period; its fixed dates remain explicit on the website, and existing higher-resolution products retain priority. The tributary network and dashed watershed divide use official **LSRCA and Ontario** geography. These drainage lines carry no invented velocity field. See [Simcoe drainage sources](docs/simcoe-drainage.md) and [outer estuary sources](docs/outer-estuary.md).

## Run locally

Requires Node.js 22 or newer. No third-party npm packages are needed for the site.

```sh
npm run build
npm run check
npm run preview
```

Use the local URL printed by the preview server. To fetch new source fields before building, run the refresh script listed in `package.json`. The checked-in source fields allow a dated offline demonstration when network services are unavailable.

## Architecture

```text
NOAA LOOFS / ECCC OHPS / DFO STLE200
                 |
       Node source adapters and validation
                 |
      dated JSON fields, catalogue and means
                 |
     static build -> GitHub Pages -> Canvas atlas
```

- `src/` — browser application, native mesh, shoreline geometry and dated demonstration fields.
- `lib/` — source ingestion used by the refresh job.
- `scripts/` — refresh, static build, data checks and local preview.
- `.github/workflows/` — scheduled ingestion and GitHub Pages deployment.
- `media/` — dated featured MP4s and the earlier broader regional film.
- `model/simcoe/` and `model/upper-river/` — separate reproducible numerical experiments and frozen inputs; neither is required to run the static website.
- `docs/` — detailed source notes, attribution, limitations and further data-research requirements.

## Coverage and interpretation

Lake Ontario uses the LOOFS top sigma layer. The OHPS river field is depth-averaged; STLE200 is a surface estuary product. These layers are not physically interchangeable and remain identified in the interface and documentation.

Complete shoreline geography does **not** imply complete current coverage. The live atlas still has gaps in parts of Kingston–Brockville–Cornwall–Montréal, Montréal's northern channels and portions of the river outside the supplied model domains. The visible outer estuary now has a separately dated STLE500 supplement. Those waters remain visible. Simcoe now has an explicitly experimental wind response; its complete actual circulation remains unresolved. The featured film alone includes the separately labelled Kingston–Brockville estimate; it is not a live river forecast. Additional model archives and reconstructions are being investigated; the [research specification](docs/current-data-research.txt) records the exact missing regions and evidence required.

In the atlas mean modes and earlier mean films, opposing currents can cancel; a weak average does not establish stationary water. The chronological film retains changing hourly conditions. Particle motion remains a visualization of model fields, not a reconstruction of observed water-parcel trajectories.

## Attribution

- [NOAA LOOFS](https://opendap.co-ops.nos.noaa.gov/thredds/catalog/NOAA/LOOFS/MODELS/catalog.html).
- [ECCC OHPS](https://eccc-msc.github.io/open-data/msc-data/nwp_ohps/readme_ohps_en/), with website access through [OGSL/SLGO ERDDAP](https://erddap.ogsl.ca/erddap/).
- [DFO POPS STLE200](https://dfo-ocean-navigator.github.io/Dataset-Descriptions/).
- Geography **© OpenStreetMap contributors · OpenFreeMap · © OpenMapTiles**. See [OpenStreetMap copyright](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/1-0/) and the [geography notes](docs/geography.md).

Source datasets retain their respective licences and attribution requirements. The visualization is intended for exploration and education, not navigation.

Accepted coloured movie: **103,544,787 bytes**, **25 seconds / 750 frames / 2560 × 1440 / 30 fps**, silent H.264. SHA-256 `5c57c348290d527c350ecba138517da96803dce5254ba2926282e4bc5a932458`. [Actual encoded visual review](film/ontario-closeup/qa/river-temperature/final-encoded-review.json) and [encoding, clock and unchanged-lake checks](film/ontario-closeup/qa/river-temperature/encoded-check.json) pass. These checks verify the displayed artifact, not real-world river temperature accuracy.
