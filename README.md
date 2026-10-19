# Ontario Currents

An interactive atlas of modelled water currents from Lake Ontario into the St. Lawrence, with Lake Simcoe and the Montréal archipelago included in the shoreline geography. A companion MP4 presents a fixed October lake average and a labelled river estimate for sharing.

**[Explore the live atlas](https://khayoon.github.io/ontario-currents/)** · **[Watch the Lake Ontario close-up](https://khayoon.github.io/ontario-currents/media/lake-ontario-closeup.mp4?v=temperature-week-20261019)** · **[Data and methods](docs/data-and-methods.txt)**

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

The featured **MP4** is a silent 2560 × 1440 H.264 loop at 30 fps, lasting 20 seconds. It frames Lake Ontario through Brockville without insets, a timeline or controls. Lake trails follow the NOAA LOOFS surface vector mean for the full UTC calendar week **12–18 October 2026**, using 28 six-hourly snapshots. Colour shows the separately averaged modeled surface temperature on a **12–16.5°C** scale, with labelled ≤12 and ≥16.5 caps. This range contains more than 99.6% of native wet area and makes the actual temperature differences visible. Grey trails identify unavailable temperature; speed never substitutes for temperature. The actual mean node range is 10.68–16.89°C. See the [weekly temperature sources and scale](docs/temperature-week.md).

This is a fixed sampled weekly mean, not an October climatology or chronological replay. Particle motion is enhanced for legibility. The Kingston–Brockville reach retains the separately computed **ESTIMATES** layer, identified in the film footer. It is an illustrative, steady depth-averaged hydraulic approximation using CHS bathymetry, mean water levels and an IJC regulation-discharge scenario for **12 October 00:00 to 17 October 12:00 UTC**. It remains unvalidated against local currents and does not resolve wind, vertical shear or inertial eddies. Its narrow-channel speeds are uncertain. See the [model, checks and limitations](docs/kingston-brockville-estimates.md).

The close-up uses finer current sampling to preserve narrow island passages, smaller bounded integration steps and denser trails in weak-flow areas. Slow nonzero vectors receive a bounded display-motion boost; temperature colours are computed separately from that motion. The [portable film renderer and frozen inputs](film/ontario-closeup/) describe the display choices.

The Carleton–Wolfe revision uses the regional **depth-averaged estimate throughout its solved river domain**, with the NOAA surface mean elsewhere. Overlapping source vectors previously sometimes opposed one another and starved the drawn trails near Cape Vincent. This explicit source selection removes the internal source mosaic; it does not establish a physically matched surface/depth-average boundary. The artificial model inlet is now 3 km upstream of the original cut, restoring water omitted from the western approach without changing retrieved depths or shoreline geometry. The local-stage wet/dry correction remains in place.

Weak nonzero trails receive stronger display acceleration while colours retain their separate temperature interpretation. The sourced water background is also lighter, so sparse trails do not resemble a land gap. The film footer states that motion is enhanced. Actual trajectory checks and encoded trail coverage are reviewed separately from background brightness. Exact-zero vectors remain stationary and do not paint flickering dots. These display choices do not validate the model's local current speeds.

The lake display now removes triangular velocity jumps that created an artificial sawtooth trail gap near 43.53°N, 78.51°W. The live atlas and fixed film share the same bounded, centre-preserving interpolation; raw NOAA samples and river estimates are preserved. The thermal film uses the updated full-week lake mean described above. The broad modeled shear remains. This is a display reconstruction, not a higher-resolution or flux-conserving simulation.

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
- `media/` — the fixed October MP4.
- `model/simcoe/` and `model/upper-river/` — separate reproducible numerical experiments and frozen inputs; neither is required to run the static website.
- `docs/` — detailed source notes, attribution, limitations and further data-research requirements.

## Coverage and interpretation

Lake Ontario uses the LOOFS top sigma layer. The OHPS river field is depth-averaged; STLE200 is a surface estuary product. These layers are not physically interchangeable and remain identified in the interface and documentation.

Complete shoreline geography does **not** imply complete current coverage. The live atlas still has gaps in parts of Kingston–Brockville–Cornwall–Montréal, Montréal's northern channels and portions of the river outside the supplied model domains. The visible outer estuary now has a separately dated STLE500 supplement. Those waters remain visible. Simcoe now has an explicitly experimental wind response; its complete actual circulation remains unresolved. The featured film alone includes the separately labelled Kingston–Brockville estimate; it is not a live river forecast. Additional model archives and reconstructions are being investigated; the [research specification](docs/current-data-research.txt) records the exact missing regions and evidence required.

Opposing currents can cancel in a vector average. A weak mean vector does not establish that water was stationary throughout the period. Particle motion illustrates the supplied field and is not a reconstruction of observed water-parcel trajectories.

## Attribution

- [NOAA LOOFS](https://opendap.co-ops.nos.noaa.gov/thredds/catalog/NOAA/LOOFS/MODELS/catalog.html).
- [ECCC OHPS](https://eccc-msc.github.io/open-data/msc-data/nwp_ohps/readme_ohps_en/), with website access through [OGSL/SLGO ERDDAP](https://erddap.ogsl.ca/erddap/).
- [DFO POPS STLE200](https://dfo-ocean-navigator.github.io/Dataset-Descriptions/).
- Geography **© OpenStreetMap contributors · OpenFreeMap · © OpenMapTiles**. See [OpenStreetMap copyright](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/1-0/) and the [geography notes](docs/geography.md).

Source datasets retain their respective licences and attribution requirements. The visualization is intended for exploration and education, not navigation.
