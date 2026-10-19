# Compact model inputs: Kingston–Brockville estimates

These files reproduce the **exploratory depth-averaged hydraulic estimate** used for the upper river, using the same grid and numerical values as the full local inputs. They do not contain observed currents or a validated operational forecast.

`bathymetry-grid-50m.npz` and `bathymetry-grid-100m.npz` are ordinary NumPy NPZ containers with lossless compression. Load them normally:

```python
import numpy as np
grid = np.load("bathymetry-grid-50m.npz", allow_pickle=False)
x, y = grid["x"], grid["y"]
bed = grid["bed_igld85_estimated"]
wet = grid["proposed_active_corridor"]
```

The containers may use ZIP-LZMA, supported by Python's standard `zipfile`/`lzma` modules and NumPy. No additional compression package is needed with a normal Python installation. The integrity manifest identifies the actual compression used. Every retained array's shape, data type and C-order bytes were compared with the full original NPZ and verified identical. No values were rounded or converted to smaller numeric types.

## Retained arrays

| Key | Meaning |
|---|---|
| `x`, `y` | Cell-centre coordinates in metres, EPSG:32618 (UTM zone 18N). Rows increase northward. |
| `wet_geometry` | Actual source-water polygon mask, including mapped island holes at grid resolution. |
| `proposed_active_corridor` | Connected water between the Kingston/Cape Vincent inlet and Brockville outlet cross-sections. |
| `bed_igld85_estimated` | Bed elevation in metres, using the explicitly estimated chart-datum separation surface. Missing source bed remains NaN. |
| `mean_stage_igld85_estimated` | Target-week mean stage surface used by the bank-bed estimation script's shallow shoreline constraint. |
| `measured_bathy` | Finite source bathymetry available at the grid cell; this is historical source support, not a 2026 measurement. |
| `bathy_source_product` | 10 = NONNA10, 100 = NONNA100 fallback, 0 = no source depth. |
| `source_subsample_count` | Number of finite NONNA10 samples aggregated in the simulation cell. NONNA100 fallback cells can have zero here while still having source support. |

These keys suffice for `estimate_bank_bed.py` followed by `solve_hydraulics.py`. The scripts supplied with the final model may set their own file locations, calibration scenario and output paths; this input package does not alter those scripts. The 2D longitude/latitude arrays, source alternate-bed arrays and nearest-neighbour helper arrays were omitted because they are not required by those two computations. Longitude/latitude can be reconstructed from `x`/`y` with pyproj using EPSG:32618 → EPSG:4326. The nearest-bank sensitivity method recomputes its own indices.

## Forcing, provenance and raw source access

`hourly-stage-boundaries-igld85.csv` preserves the retrieved hourly endpoint series. The Kingston and Brockville station metadata files preserve their distinct chart-datum offsets (+74.20 m and +73.95 m). Do not treat a chart-relative gauge observation as a common-datum head without that conversion. The regulation-discharge scenario and any held-out Alexandria Bay check are documented with the final solver rather than fitted silently inside these inputs.

The original bathymetry TIFF tiles and full source mosaics are **not included**. The three NONNA manifests retain every exact WCS download URL, bounding box, raster size and raw-file SHA-256. The final primary bed uses `nonna10-20m-download-manifest.json`; NONNA100 is fallback. `nonna10-download-manifest.json` records the earlier coarse request used to identify overview sensitivity. The original TIFF download is approximately 104 MB uncompressed for the native-scale NONNA10 domain. Download individual `tiles[].url` values when the raw evidence is needed; verify their recorded SHA-256. The local `tiles[].file` strings describe the original working-tree cache paths, not paths inside this compact package.

`water-repair-manifest.json` retains the actual OpenFreeMap z13 tile URLs and hashes used to restore omitted Thousand Islands channel polygons. Those vector tiles are likewise downloadable directly from their recorded URLs and are not bundled here. The corrected masks in the NPZ already contain the resulting grid geometry; no channel centreline or shoreline buffer was invented.

`BATHYMETRY-INPUTS.md` is an exact copy of the local preparation note. Its `work/upper-river-model/` paths refer to the original project layout. Its raw mosaics, TIFFs, geospatial dependency cache and complete source-water geometry are not part of this compact package. The two grid audits and `array-integrity-manifest.json` describe the packaged numerical inputs. The integrity manifest includes whole-file SHA-256 plus per-array byte hashes and the full original files' hashes.

## Interpretation and attribution

The 50 m active corridor has 169,860 connected cells. About 82.04% have numeric source-depth support, while about 17.96% require explicitly marked bank-bed estimation. Native sampling, grid size and model accuracy are distinct: a 50 m hydraulic grid does not establish 50 m survey resolution or resolve every small channel. Source-survey vertical datum ambiguity and the estimated datum-separation surface remain material limitations.

Bathymetry: Canadian Hydrographic Service NONNA, [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada), confirmed in the retained official catalogue metadata. Water geometry: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0, via [OpenFreeMap](https://openfreemap.org/) and [OpenMapTiles](https://openmaptiles.org/). Retain these attributions when redistributing the source-derived data or results.
