# Kingston–Brockville current estimates: sources and reproduction

Prepared 19 October 2026. Target forcing interval: **12 October 2026 00:00 UTC–17 October 2026 12:00 UTC**.

The added river trails are an **illustrative, simplified, unvalidated steady depth-averaged through-flow estimate**. They use actual numerical bathymetry, observed endpoint water levels and a published regulation-flow scenario. The calculation solves continuity around mapped islands. It does **not** recover reliable local jet speeds, surface-layer currents or inertial eddies, and it is not an observed-current product or an operational forecast.

Suggested compact film label: **“ESTIMATES · Kingston–Brockville: simplified depth-averaged flow, unvalidated.”** The separate lake field retains its [NOAA LOOFS provenance](https://tidesandcurrents.noaa.gov/ofs/loofs/loofs_info.html). The raw river JSON retains its reusable fallback default, while the featured film explicitly selects the regional model throughout its solved domain and NOAA elsewhere.

## Primary sources actually used

### Canadian Hydrographic Service numerical bathymetry

- [Official NONNA dataset catalogue](https://open.canada.ca/data/en/dataset/d3881c4c-650d-4070-bf9b-1e00aabf0a1d).
- [Official catalogue API metadata](https://open.canada.ca/data/api/3/action/package_show?id=d3881c4c-650d-4070-bf9b-1e00aabf0a1d), retained in `inputs/nonna-catalog-metadata.json`.
- [WCS capabilities](https://nonna-geoserver.data.chs-shc.ca/geoserver/wcs?service=WCS&version=1.0.0&request=GetCapabilities).
- [NONNA10 coverage description](https://nonna-geoserver.data.chs-shc.ca/geoserver/wcs?service=WCS&version=1.0.0&request=DescribeCoverage&coverage=nonna%3ANONNA%2010%20Coverage), [NONNA100 coverage description](https://nonna-geoserver.data.chs-shc.ca/geoserver/wcs?service=WCS&version=1.0.0&request=DescribeCoverage&coverage=nonna%3ANONNA%20100%20Coverage).
- [CHS NONNA FAQ, official PDF](https://api-proxy.edh-cde.dfo-mpo.gc.ca/catalogue/records/d3881c4c-650d-4070-bf9b-1e00aabf0a1d/attachments/CHS_NONNA_Data_Portal_FAQ_en.pdf).

The source is numeric float32 GeoTIFF elevation, not bathymetry-map colours. The final preparation retrieves NONNA10 at **20 projected metres in EPSG:3857**, approximately 14 ground metres near the river. It aggregates actual finite source values within each UTM simulation cell: 3×3 samples at 50 m and 7×7 at 100 m. NONNA100 supplies a coarser fallback where no fine sample is available. Sampling and grid spacing do not establish independent source-survey resolution or accuracy.

Coarse WCS requests showed strong resolution sensitivity at narrow channels. The correction was to retrieve finer numerical bathymetry and aggregate those values; **no channel was deepened by hand**. The original requests, exact bounds and source hashes remain in `inputs/nonna10-20m-download-manifest.json`, `inputs/nonna100-download-manifest.json` and the earlier coarse-request manifest. Source TIFFs and the full ~104 MB uncompressed native-scale NONNA10 mosaic are not bundled. Every raw request URL is retained in the manifests.

### CHS endpoint water levels and datum metadata

- [Kingston station 13988: exact target-period hourly observations](https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/5cebf1e43d0f4a073c4bc3f1/data?time-series-code=wlo&from=2026-10-12T00:00:00Z&to=2026-10-17T12:00:00Z&resolution=SIXTY_MINUTES), [Kingston metadata](https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/5cebf1e43d0f4a073c4bc3f1/metadata).
- [Brockville station 14400: exact target-period hourly observations](https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/5cebf1e43d0f4a073c4bc3f7/data?time-series-code=wlo&from=2026-10-12T00:00:00Z&to=2026-10-17T12:00:00Z&resolution=SIXTY_MINUTES), [Brockville metadata](https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/5cebf1e43d0f4a073c4bc3f7/metadata).
- [Official IWLS API documentation](https://api-iwls.dfo-mpo.gc.ca/swagger-ui/index.html).

There are 133 hourly endpoint samples. Chart-relative observations are converted independently to IGLD85 using the metadata offsets: **+74.20 m at Kingston** and **+73.95 m at Brockville**. Their arithmetic mean stages are **74.8017443609 m** and **74.5217067669 m IGLD85**, a **0.2800375940 m** mean head difference. The common-datum series is retained as `inputs/hourly-stage-boundaries-igld85.csv`, with both station metadata files.

**Bed datum assumption:** NONNA elevations are provisionally interpreted relative to local chart datum. An estimated separation surface interpolates the two chart-datum offsets along the reach and adds it to the chart-relative bed. This is **not an authoritative vertical transformation**; contributing survey datums can differ. The fixed source bed remains distinct from estimated bank bed. The stage surface used for bank constraints is also retained separately from the hydraulic stage solved by the model.

### IJC regulation-flow scenario

- [International Lake Ontario–St. Lawrence River Board outflow notices](https://ijc.org/en/loslrb/watershed/outflow-changes).
- [Official change-record CSV](https://ijc.org/sites/default/files/ChangementDebit_FlowChanges.csv).

The published targets are 7,380 m³/s from 10 October and 7,340 m³/s from 17 October. The CSV timestamps do not identify their timezone. A representative target of **7,377.58 m³/s**, using an Eastern daylight time interpretation over the selected interval, is the explicit calibration scenario. Alternative UTC/Eastern-standard interpretations give approximately 7,376.37–7,377.88 m³/s. This is a **regulated target at Moses–Saunders**, not an independently gauged Kingston discharge or observed current validation. Storage and flow transfer along the river are simplified.

### Source water geometry

- [OpenStreetMap contributors and licence](https://www.openstreetmap.org/copyright).
- [OpenFreeMap](https://openfreemap.org/) / [OpenMapTiles](https://openmaptiles.org/).
- Source tile template: `https://tiles.openfreemap.org/planet/20261011_080001_pt/{z}/{x}/{y}.pbf`.

The existing map's omitted Thousand Islands sectors were restored from **actual z13 source-water polygons**, including the main US branch and mapped island holes. No centreline buffer or synthetic bridge joins the banks. The patch covers −76.30..−75.75°, 44.18..44.53°. Exact tile URLs, hashes and feature IDs are retained in `inputs/water-repair-manifest.json`. A binary 50 m wet mask still cannot resolve every small island, pier or narrow passage.

### Independent stage check

- [NOAA Alexandria Bay 8311062, exact water-level request in metres IGLD and UTC](https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&application=OntarioCurrentsResearch&begin_date=20261012%2000:00&end_date=20261017%2012:06&datum=IGLD&station=8311062&time_zone=gmt&units=metric&format=json).
- [NOAA Great Lakes low-water datums](https://www.tidesandcurrents.noaa.gov/gldatums.html).

Alexandria Bay was not an imposed stage boundary or a velocity-calibration target. Its observations are preliminary. One missing six-minute value was interpolated only to calculate the time-weighted stage mean over the exact target interval. The 50 m estimate is approximately **2.35 cm above** that independent mean stage. This checks one water level; it does **not validate island-channel velocities or flow splits**.

## Current 3 km domain and model interpretation

The geometric corridor has **179,112 cells**, with the inlet 3,000 m upstream of the original Kingston–Cape Vincent cross-section and the unchanged Brockville outlet. It adds 6,076 geometric cells relative to the immediately previous 1 km case; 6,010 added cells have numerical source bed. All other input arrays are unchanged, including raw bed NaNs and source water geometry.

The local-stage wet/dry calculation selects **177,775 cells**; **17.12%** use inferred bank bed. Missing bank bed is harmonically inferred, with a 0.20 m shallow-bank constraint at actual mapped shore, not at artificial open cuts. Source-depth support is much lower in parts of eastern Carleton than the domain-wide percentage. The 274-cell western patch now has 193 solved wet cells; remaining cells comprise 57 with insufficient retrieved depth at the upstream mean stage, 23 stage-unanchored shallow fragments and one unknown source bed.

Retrieved bed values remain exact. The recomputed expanded bank interpolation changes common-domain inferred bed by up to 0.404 m relative to the prior prepared input. That derived-bed change is explicit in the comparison audit; the previous prepared-bed array is not claimed unchanged.

The selected effective uniform Manning n is **0.02889393 s/m^(1/3)**. It is calibrated to the explicitly assumed regulation-flow scenario. Inlet/outlet mismatch is **0.001654 m³/s**, with zero depth-floor cells. These are numerical checks, not accuracy bounds or local velocity validation.

The simplified nonlinear diffusion-wave method omits local/advective momentum acceleration, wind, Coriolis, density stratification and vertical shear. It is unsuitable for quantitative interpretation of local jets or island wakes. [USACE equation-choice guidance](https://www.hec.usace.army.mil/confluence/rasdocs/r2dum/latest/running-a-model-with-2d-flow-areas/shallow-water-or-diffusion-wave-equations) explains why full momentum matters in flat rivers and contractions. Earlier sensitivity and experimental momentum calculations are retained as prior-configuration evidence, not claimed as new validation of this domain.

This is a steady scenario forced by mean endpoint levels, not a temporal vector average. Raw display metadata retains `fallbackOnly: true` as a reusable default. The featured film explicitly sets `riverSourcePriority: "model"`: regional depth-averaged vectors cover their whole solved domain and NOAA's distinct surface vectors apply elsewhere. This does not establish a physically matched or same-depth source handoff.

## Portable reproduction and exact inputs

```powershell
python -m pip install -r requirements.txt
python prepare_source_domain.py --input inputs/bathymetry-grid-50m.npz --inlet-pad-m 3000 --check
python solve_local_wetness.py --inlet-pad-m 3000 --source inputs/bathymetry-grid-50m.npz --out-dir regenerated
```

The prescribed endpoint CSV, compact source arrays and all required helpers are package-local. The selected 50 m NPZ uses ZIP-DEFLATE and is 14,171,747 bytes, SHA-256 `ba5120a30dbbb397327de31ec18176dc1798a746e48e962d0374b8a4fcf31b47`. The retained 100 m historical input uses ZIP-LZMA. Both are readable by Python/NumPy. Per-array integrity and the changed corridor mask are explicit in `inputs/array-integrity-manifest.json`; no rounded source values replace the original arrays.

Large original source TIFFs are not bundled. Exact request URLs/hashes remain in download manifests. The prepared-bank-bed NPZ regenerates from the included inputs. Historical cache paths are provenance records, not current dependencies. Numerical last bits and output-container hashes can differ across runs/platforms; isolated reproduction checks numerical agreement.

## Attribution and licences

Canadian Hydrographic Service NONNA: contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). Water geometry and source-derived wet-mask database: © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), via OpenFreeMap/OpenMapTiles. Retain those notices and applicable licences when redistributing source-derived inputs. Agency names identify provenance and do not imply endorsement.
