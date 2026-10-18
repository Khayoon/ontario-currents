# Ontario Currents

An interactive atlas of modelled water currents from Lake Ontario into the St. Lawrence, with Lake Simcoe and the Montréal archipelago included in the shoreline geography. A companion MP4 presents a fixed October average for sharing.

**[Explore the live atlas](https://khayoon.github.io/ontario-currents/)** · **[Watch the 20-second loop](https://khayoon.github.io/ontario-currents/media/october-current-map.mp4)** · **[Data and methods](docs/data-and-methods.txt)**

## What this project demonstrates

- **Scientific data visualization:** rasterizes NOAA's native unstructured mesh of 34,395 nodes and 64,453 triangles, retaining face-centred current vectors and interpolating node temperatures within triangles.
- **Interactive graphics:** Canvas particle animation, geographic pan and zoom, source-aware cursor readouts, temperature/speed layers and Lake Ontario forecast playback.
- **Data engineering:** adapts multiple public model products with different layers, grids and valid times; preserves missing-data masks and reports the dates behind the display.
- **Static deployment with updating data:** a Node ingestion job publishes JSON for a static GitHub Pages frontend. The browser does not require a private proxy or a sign-in.
- **Resilience and provenance:** stored source fields remain available during upstream outages, with explicit refresh status and source times. Geography, model attribution and coverage limits accompany the visualization.

The hydrodynamic models are produced by NOAA, ECCC and DFO. This project implements their ingestion, visualization and publication; it does not claim authorship of those models.

## Two views of the data

The **website** supports live-source exploration and sampled 24-hour vector means. Its Lake Ontario timeline and Canadian river/estuary products have independently reported valid times. Automated refreshes are scheduled hourly; execution depends on GitHub Actions and source availability. Read the dates shown in the interface.

The **MP4** is a silent 2560 × 1920 H.264 loop at 30 fps. It traces a fixed vector mean for **12 October 2026 00:00 UTC–17 October 2026 12:00 UTC**, using 23 six-hourly samples per source. Both the overview and the Montréal detail animate. Motion is accelerated for visibility. The colour scale shows the magnitude of the mean current vector, with a logarithmic scale capped at 150+ cm/s. It is a sampled week-to-date mean, not an October climatology or a replay of the week's changing conditions.

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
- `docs/` — detailed source notes, attribution, limitations and further data-research requirements.

## Coverage and interpretation

Lake Ontario uses the LOOFS top sigma layer. The OHPS river field is depth-averaged; STLE200 is a surface estuary product. These layers are not physically interchangeable and remain identified in the interface and documentation.

Complete shoreline geography does **not** imply complete current coverage. The current public edition still has gaps in Lake Simcoe, parts of Kingston–Brockville–Cornwall–Montréal, Montréal's northern channels and the outer estuary/Gulf beyond the supplied current model. Those waters remain visible. Additional model archives and defensible reconstructions are being investigated; the [research specification](docs/current-data-research.txt) records the exact missing regions and evidence required.

Opposing currents can cancel in a vector average. A weak mean vector does not establish that water was stationary throughout the period. Particle motion illustrates the supplied field and is not a reconstruction of observed water-parcel trajectories.

## Attribution

- [NOAA LOOFS](https://opendap.co-ops.nos.noaa.gov/thredds/catalog/NOAA/LOOFS/MODELS/catalog.html).
- [ECCC OHPS](https://eccc-msc.github.io/open-data/msc-data/nwp_ohps/readme_ohps_en/), with website access through [OGSL/SLGO ERDDAP](https://erddap.ogsl.ca/erddap/).
- [DFO POPS STLE200](https://dfo-ocean-navigator.github.io/Dataset-Descriptions/).
- Geography **© OpenStreetMap contributors · OpenFreeMap · © OpenMapTiles**. See [OpenStreetMap copyright](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/1-0/) and the [geography notes](docs/geography.md).

Source datasets retain their respective licences and attribution requirements. The visualization is intended for exploration and education, not navigation.
