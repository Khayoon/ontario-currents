> Updated selected domain: the current 50 m solve relocates the inlet 1,000 m upstream, adds 3,118 genuinely solved wet cells and retains all prior wet cells. Raw bathymetry/water geometry/source values are unchanged. The current selected grid has 169,950 wet cells, effective n=0.02891666, zero depth-floor cells and held-out Alexandria stage residual +2.37 cm. Earlier source-preparation counts below describe the original cut and are retained as source history. Current checks are in model-report.json; grid/roughness/bed sensitivities inherited from the earlier domain are explicitly labelled prior-domain.

# Kingston–Brockville current estimates: sources and reproduction

Prepared 19 October 2026. Target forcing interval: **12 October 2026 00:00 UTC–17 October 2026 12:00 UTC**.

The added river trails are an **illustrative, simplified, unvalidated steady depth-averaged through-flow estimate**. They use actual numerical bathymetry, observed endpoint water levels and a published regulation-flow scenario. The calculation solves continuity around mapped islands. It does **not** recover reliable local jet speeds, surface-layer currents or inertial eddies, and it is not an observed-current product or an operational forecast.

Suggested compact film label: **“ESTIMATES · Kingston–Brockville: simplified depth-averaged flow, unvalidated.”** The existing Lake Ontario layer retains its separate [NOAA LOOFS provenance](https://tidesandcurrents.noaa.gov/ofs/loofs/loofs_info.html); this estimate fills only its upper-river coverage gap.

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

Alexandria Bay was not an imposed stage boundary or a velocity-calibration target. Its observations are preliminary. One missing six-minute value was interpolated only to calculate the time-weighted stage mean over the exact target interval. The 50 m estimate is approximately **2.37 cm above** that independent mean stage. This checks one water level; it does **not validate island-channel velocities or flow splits**.

## Coverage and model interpretation

The proposed 50 m active corridor has **173,036 connected cells** between an inlet cut relocated 1,000 m upstream of the original Kingston–Cape Vincent cross-section and the unchanged Brockville outlet cut. **82.3488% have numerical source-depth support; 30,543 cells, or 17.6512%, lack source bed.** Missing bank/bay-margin bed is explicitly estimated by harmonic interpolation, with a 0.20 m depth constraint only at actual mapped shoreline. Artificial open cuts use adjoining retrieved bed when available or a zero-gradient continuation. Raw source-bed NaNs and the estimated-bed mask remain distinct. Of the 3,118 newly solved wet cells, 3,082 (98.8454%) have retrieved bed support. The broader source box also contains unrelated inland water excluded from the hydraulic solve.

After the solver excludes dry/unsupported disconnected cells, **169,950 cells** remain in the final hydraulic domain; **17.15%** of that solved area uses estimated bank bed. Global area coverage does not measure its hydraulic importance: some transects carry a substantial fraction of their modelled flux through estimated-bed cells.

The selected calculation is a steady nonlinear Manning **diffusion-wave approximation** on wet faces, with impermeable island/land faces. Effective uniform Manning roughness is calibrated to the explicit regulation-flow scenario; the final 50 m value is approximately **0.02891666 s/m^(1/3)**. Uniform roughness rescales the conservative field's flux magnitude, rather than adding currents by hand.

The field conserves its numerical discharge: final inlet/outlet differ by about **0.001974 m³/s**, roughly **0.00002676%** of inflow. No final cell requires the numerical minimum-depth floor. These are numerical checks, not accuracy bounds. A retained prior-domain 100 m comparison supports broad directional consistency but is a grid-sensitivity exercise, not formal convergence or field-current validation.

This approximation omits local and advective momentum acceleration, inertial eddies, wind forcing, density stratification and vertical surface shear. It is unsuitable for quantitatively interpreting local jets. The failed or unsettled more complex experimental runs are not substituted into the film. [USACE's equation-choice guidance](https://www.hec.usace.army.mil/confluence/rasdocs/r2dum/latest/running-a-model-with-2d-flow-areas/shallow-water-or-diffusion-wave-equations) explains why momentum terms matter in constrictions, bends and detailed local flow.

The forcing uses interval-mean endpoint levels and a representative flow target. **A steady calculation at mean forcing is not the time-average of hourly current fields.** Near Kingston it particularly misses wind-driven lake–river exchange. These vectors are **depth-averaged estimates**, while the separate NOAA Lake Ontario vectors represent their documented surface model layer. The display preserves the NOAA field wherever that source has coverage and applies this river estimate as fallback only.

## Reproduce the compact-input calculation

From the published model-package directory, which contains the scripts at its root and compact inputs under `inputs/`:

```powershell
python -m pip install -r requirements.txt
python solve_inlet_extension.py --inlet-pad-m 1000 --input inputs/bathymetry-grid-50m.npz --out-dir regenerated
```

The portable solver reads `inputs/hourly-stage-boundaries-igld85.csv`. The 100 m dataset is retained for the explicitly labelled prior-domain sensitivity. Running a new padded 100 m experiment would require its own checks and is not claimed as completed here. The selected 50 m NPZ uses lossless ZIP-DEFLATE, while the retained 100 m input uses ZIP-LZMA; both are readable with standard Python/NumPy. Re-running can change iteration timing, numerical last bits and output-container hashes across dependency/platform versions. The packaged input arrays themselves are exact, with no rounding or downcasting. The package's requirements and final run report record the actual solver environment.

| Compact input | Bytes | SHA-256 |
|---|---:|---|
| `inputs/bathymetry-grid-50m.npz` | 14,171,483 | `d0c2b6ae3ec44203cda5ff2318b8399566abce300795c1b7348a8501c88731b9` |
| `inputs/bathymetry-grid-100m.npz` | 2,747,179 | `b0c6b56f9ba28f9aea40e585e9fa53c0c1c55b3759d945b6731c342e6bbf0843` |

`inputs/array-integrity-manifest.json` records current per-array hashes. Every retained raw source array is byte-identical to the prior compact input; `proposed_active_corridor` intentionally changes to the expanded cut and is identified as changed. An actual compact-input 100 m bank-bed run also reproduced the corresponding full-input bed and masks byte-for-byte on the development platform. Its README explains omitted raw source files and cache-path references in the preparation note.

## Attribution and data licences

Bathymetry: **Canadian Hydrographic Service NONNA. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).** The official catalogue metadata records that licence. Water geometry and derived shoreline/wet-mask database: **© OpenStreetMap contributors, [Open Database Licence (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/), via OpenFreeMap/OpenMapTiles**. Retain those notices and the corresponding data licences when redistributing the source-derived inputs. Agency names identify provenance and do not imply agency endorsement of this estimate.
