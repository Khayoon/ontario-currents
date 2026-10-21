# Ontario Current Atlas

An interactive map of modelled water-current speed and direction, from Lake Ontario into the St. Lawrence. Explore the source fields, inspect local values, and compare the latest published conditions with sampled 24-hour vector means.

**[Explore the atlas](https://khayoon.github.io/ontario-currents/)** · **[Data and methods](docs/data-and-methods.txt)** · **[Related temperature-film project](https://khayoon.github.io/lake-ontario-temperature/)**

[![The atlas showing Lake Ontario currents, Lake Simcoe and the St. Lawrence shorelines](docs/atlas-preview.jpg)](https://khayoon.github.io/ontario-currents/)

## What I built

- **Interactive graphics:** Canvas particle animation, geographic pan and zoom, cursor readouts, speed/temperature layers and Lake Ontario forecast playback. Speed is the initial colour layer; velocity determines trail direction.
- **Scientific data visualization:** retains NOAA's native 34,395-node / 64,453-triangle mesh and reconstructs continuous display velocities with the source vectors preserved at triangle centres. Missing wet triangles remain missing; temperature is interpolated separately. See the [mesh display method](docs/mesh-display.md).
- **Data engineering:** source adapters handle different public grids, model layers and valid times, preserve missing-data masks, and publish dated JSON fields for a static frontend.
- **Updating static deployment:** a scheduled GitHub Actions workflow checks source availability and deploys a validated GitHub Pages artifact. Stored fields remain usable during upstream outages, with explicit source dates and refresh status.
- **Numerical experimentation:** a separately labelled, unvalidated Lake Simcoe wind-response model uses public bathymetry and observed winds. Its assumptions and checks are documented in the [Simcoe model notes](docs/simcoe-model.md).

NOAA, ECCC and DFO produce the retrieved government model products. This project implements their ingestion, display and publication. The custom Simcoe experiment remains separate from those products.

## Explore the map

The atlas opens with **current speed** and supports a temperature layer where a source supplies temperature. Particle direction follows the displayed velocity field; motion is accelerated for visibility.

**Live** selects the latest successfully published source fields, retaining their independently reported valid times. **24-hour mean** uses sampled eastward/northward component averages. Opposing currents can cancel, so a weak mean does not establish stationary water. The Lake Ontario timeline and refresh tools open through a compact **Time controls** disclosure; river and estuary fields keep their own source times.

The outer estuary includes an independently dated DFO STLE500 archive supplement for 12–17 October 2026. Lake Simcoe's experimental depth-averaged response also retains that fixed period in both website modes. These fixed products are explicitly labelled. See [outer-estuary sources](docs/outer-estuary.md), [Simcoe model notes](docs/simcoe-model.md), and [drainage sources](docs/simcoe-drainage.md).

## Run locally

Requires Node.js 22 or newer. The atlas uses no third-party npm packages.

```sh
npm run build
npm run check
npm run preview
```

Use the local URL printed by the preview server. Checked-in source fields allow a dated offline demonstration. To fetch new source fields, run `npm run refresh-data` before building. The hourly GitHub Actions schedule depends on source availability and Actions execution; the interface reports the dates actually available.

The build retains the old `/media/lake-ontario-closeup.mp4` URL for compatibility. When the verified local copy is absent, it fetches the pinned, hash-checked film release from the separate temperature project. The atlas itself does not require this video for map rendering or data refresh.

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

- `src/` — browser application, mesh, shoreline geometry and dated source fields.
- `lib/` — ingestion used by the refresh workflow.
- `scripts/` — refresh, static build, validation and local preview.
- `.github/workflows/` — hourly source checks and Pages deployment.
- `model/simcoe/` — reproducible, separately labelled wind-response experiment.
- `media/` — the earlier, dated regional current film and local compatibility media.
- `docs/` — source notes, display methods, geography and limitations.

## Related project: Lake Ontario temperature film

[**Lake Ontario: A Week in Motion**](https://khayoon.github.io/lake-ontario-temperature/) has its own [repository](https://github.com/Khayoon/lake-ontario-temperature), Pages site, film renderer, frozen hourly inputs and river-model documentation. Its 25-second film follows **12–18 October 2026 UTC**, with **colour representing temperature** and velocity driving the trails. Kingston–Brockville currents and transported river temperatures are separately labelled estimates.

The projects share their development history and mesh-display foundation. This repository owns the interactive atlas and updating source adapters; the temperature repository owns the chronological film and its numerical experiments. Historical commits and releases remain available here. The earlier [regional Ontario–St. Lawrence film](https://khayoon.github.io/ontario-currents/media/october-current-map.mp4) is also retained.

## Coverage and interpretation

Lake Ontario uses the NOAA LOOFS top sigma layer. The OHPS river field is depth-averaged; STLE200 is a surface estuary product. These layers are identified separately and are not physically interchangeable.

Complete shoreline geography does **not** imply complete current coverage. Gaps remain in parts of Kingston–Brockville–Cornwall–Montréal, Montréal's northern channels and waters outside supplied model domains. The custom Kingston–Brockville estimate belongs to the separate film project; it is not a live river forecast added to the atlas. The [research specification](docs/current-data-research.txt) records unresolved coverage and evidence requirements.

Particles illustrate model fields and rendering choices; they are not observations or validated water-parcel trajectories. The visualization is for exploration and education, not navigation.

## Attribution

- [NOAA LOOFS](https://opendap.co-ops.nos.noaa.gov/thredds/catalog/NOAA/LOOFS/MODELS/catalog.html).
- [ECCC OHPS](https://eccc-msc.github.io/open-data/msc-data/nwp_ohps/readme_ohps_en/), accessed through [OGSL/SLGO ERDDAP](https://erddap.ogsl.ca/erddap/).
- [DFO POPS STLE200](https://dfo-ocean-navigator.github.io/Dataset-Descriptions/).
- Geography **© OpenStreetMap contributors · OpenFreeMap · © OpenMapTiles**. See [copyright](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/1-0/) and the [geography notes](docs/geography.md).

Source datasets retain their respective licences and attribution requirements. Official LSRCA and Ontario drainage geography and the experimental Simcoe model have further attribution in their linked source notes.
