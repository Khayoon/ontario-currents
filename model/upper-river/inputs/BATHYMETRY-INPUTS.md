> Historical source-preparation record: its active-corridor counts and original work-folder commands describe the earlier inlet. Current padded-domain reproduction and counts are in the package README and model-report.json. Retrieved source data and their qualifications remain applicable.

# Kingston–Brockville bathymetry and water geometry inputs

Prepared 19 October 2026 for an explicitly estimated, depth-averaged hydraulic visualization. These inputs are **not observed current vectors**, a calibrated hydrodynamic forecast, or navigational data.

## Numeric bed inputs

`fetch_bathymetry.py` retrieves a continuous domain from the official [CHS NONNA WCS](https://nonna-geoserver.data.chs-shc.ca/geoserver/wcs?service=WCS&version=1.0.0&request=GetCapabilities). Both `NONNA 10 Coverage` and `NONNA 100 Coverage` were actually downloaded as 9 float32 GeoTIFF tiles each, not rendered map colours. Geographic retrieval bounds: −76.60 to −75.58°, 44.07 to 44.66°. Raw sample spacing is 50 projected metres in EPSG:3857; this sampling does not establish source resolution or survey quality. Near 44°N the physical sampling is approximately 36 m. NONNA100 is a coarser source even when resampled to this grid.

A later resolution audit exposed material overview/alias sensitivity in the 50 projected metre NONNA10 requests: a constricted-channel sample near (−75.987,44.362) returned about −0.91 m, whereas a 10 projected metre request at the same position returned about −17 m. TIFF transforms and indexing were independently checked; this was not a mosaic-index bug. Therefore the final input uses a **fresh native-scale 20 projected metre NONNA10 download**, 48 TIFF tiles, 5,678 × 4,594 values, retained in `nonna10-mercator-20m.npz` and `nonna10-20m-tiles/`. The finer sampling is about 14 ground metres near this reach; source survey accuracy/resolution still varies.

Final simulation-cell beds aggregate actual finite NONNA10 source values within each cell: 3×3 subcell samples at 50 m, 7×7 at 100 m. Arithmetic means are used for the primary bed; source count, within-cell standard deviation and centre-only bed are retained. A Manning-conveyance-equivalent depth is retained as a separately labelled sensitivity helper, not substituted as measured bed. NONNA100 is fallback where no native NONNA10 subsample is finite. This avoids representing a deep narrow channel by one shoal-valued coarse overview pixel. A cell with source values does not imply every part of its area was surveyed; these are source-supported grid cells.

- `nonna10-mercator-50m.npz`, `nonna100-mercator-50m.npz`: original numeric mosaic arrays with NaN nodata, and their source x/y coordinates. The mosaics have 2,272 columns × 1,839 rows.
- `nonna10-download-manifest.json`, `nonna100-download-manifest.json`: exact WCS requests, source TIFF files, SHA-256 hashes, data counts and retrieved values. The initial NONNA10 raw files are in `nonna-tiles/`; the reproduction script's current cache convention is `nonna10-tiles/`.
- `bathymetry-grid-50m.npz` and `bathymetry-grid-100m.npz`: resampled simulation-grid inputs in EPSG:32618 (UTM18N), with geographic coordinates and original water geometry. Array rows increase from south to north. `x` and `y` are cell-centre vectors, not corner coordinates. `bed_chart_m` remains NaN where no actual source value was retrieved. NONNA10 is preferred; NONNA100 is fallback only.
- `bathy_source_product`: 10 or 100 for the actual numeric source, zero for unknown. `measured_bathy` means an actual source bathymetry raster value was available; it does not mean a contemporaneous 2026 measurement.
- `nearest_bed_chart_m` and `nearest_bathy_distance_m`: explicitly separate helper arrays. They are **not a silently filled bed**. A solver using them or harmonic interpolation must retain a distinct imputation mask and report the fraction/sensitivity. Straight nearest-neighbour copying can cross islands; harmonic estimates constrained by water and shore are preferable for bank strips.

## Water geometry and corrected connectivity

The original selected river geometry omitted actual water sectors near Alexandria Bay and the Thousand Islands. The original main-water selection and tag-filtered supplemental query did not retain every channel polygon. The omission cut the main channel into two disconnected pieces; it was a geography-selection defect, not a bathymetry gap or a real dam. No single relation is claimed as the cause: a checked untagged relation, 14052783, is only a small pond and does not explain the main-channel gap.

`repair_water_geometry.py` restored actual water polygons from OpenFreeMap/OpenMapTiles z13 tiles in the source dataset `20261011_080001_pt`, over −76.30..−75.75°, 44.18..44.53°. The expanded patch includes the US navigation branch south/east of Wellesley Island as well as the narrower northern branch. It unions genuine water polygons with the existing geometry. It never bridges a centreline, buffers a channel, or deliberately fills island holes. Source tiles, IDs, hashes and request URLs are retained in `water-repair-manifest.json`; the patch is `repair-water-sources.geojson`. The completed union is `repaired-water-full.geojson`. `water-geometry.geojson` is the clipped computational water geometry. Source generalization and grid resolution still constrain the smallest resolved islands/passages.

The 50 m proposed active domain uses a Kingston–Cape Vincent inlet from (−76.484,44.224) to (−76.333,44.128), and a Brockville outlet from (−75.686,44.592) to (−75.659,44.565). `proposed_active_corridor` is its largest four-neighbour connected water component. It has **169,860 wet cells and is connected from inlet to outlet**; numeric depth support is **82.042%**, leaving **30,504 cells (17.958%)** without source bathymetry. Source-depth distance for those unknown cells has median 70.7 m, 90th percentile 206.2 m, 95th percentile 282.8 m, 99th percentile 500 m and maximum 1,005 m. These are mainly bank/US-side strips and island/bay margins. The much larger ~24 km distances in an unrestricted bounding-box audit are disconnected inland water bodies outside the active river domain and must not be used as river interpolation distances.

The 100 m active domain is 41,959 cells, with 82.848% numeric depth support. This second grid supports a discretization comparison; neither grid proves individual sub-grid channels are resolved.

## Vertical datum interpretation

NONNA negative elevation values are interpreted here as bed elevations relative to local chart datum. Source-survey datum ambiguity remains: [CHS explains that mixed source datums can prevent assigning one definitive vertical datum to an entire NONNA cell](https://www.chs.gc.ca/help-aide/faq-eng.html). The grids retain the original chart-relative bed separately.

`chart_datum_igld85_estimated` is an **estimated datum-separation surface**, linearly interpolating the verified CHS gauge offsets from Kingston (+74.20 m) to Brockville (+73.95 m). `bed_igld85_estimated` applies that surface. It is not an authoritative vertical transformation. The measured water-level boundaries are separately converted using their station-specific official offsets; their weekly means are 74.801744 m and 74.521707 m IGLD85. A ±0.25 m bed sensitivity does not resolve datum ambiguity but makes its impact on this simplified visualization visible.

## Additional NOAA search

The current BlueTopo tile-scheme GeoPackage was downloaded and spatially queried; **none of the intersecting tile cells had a delivered GeoTIFF URL**. This is a checked access/coverage result, not an assertion that no other NOAA archive exists.

The official [NOAA NOS survey service](https://gis.ngdc.noaa.gov/arcgis/rest/services/web_mercator/nos_hydro_dynamic/MapServer) returned eight digital-sounding survey footprints intersecting the broad bounding box. `check_noaa_supplement.py` downloaded their public metadata and available HYD93 numeric point files, retaining parsing documentation and arrays. Most points are south of the inlet. H10185 (1985) and D00089 (1985) cover the Cape Vincent/Tibbetts outlet vicinity; L02308 (1948) covers Kingston/Wolfe waters already largely covered by NONNA. The metadata reference IGLD1955/Lake Ontario low water datum or an unspecified historical Great Lakes datum. **These historical points were not merged into the bed**, because they do not supply a verified consistent datum transformation and do not close the principal downstream bank gaps. See `noaa-numeric-supplement-audit.json`. This prevents disguising old, mixed-datum points as new survey coverage.

## Reproduction

```powershell
python work/upper-river-model/fetch_bathymetry.py
python work/upper-river-model/fetch_bathymetry.py --100
python work/upper-river-model/fetch_bathymetry.py --fine
python work/upper-river-model/repair_water_geometry.py
python work/upper-river-model/prepare_grid.py
python work/upper-river-model/check_noaa_supplement.py
```

Grid preparation uses NumPy, SciPy, Pillow, pyproj, Shapely and rasterio; local geospatial packages are under `python-packages/`. The source-water repair uses the existing vector-tile dependencies under `work/forum-geography/python-packages/`. Water geometry is © OpenStreetMap contributors via OpenFreeMap/OpenMapTiles, ODbL 1.0. CHS numerical bathymetry is from NONNA under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada), verified from the official dataset's catalogue API and retained in `nonna-catalog-metadata.json`. Source hashes and raw inputs remain retained locally for reproducibility.
