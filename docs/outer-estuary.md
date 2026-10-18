# Outer St. Lawrence estuary model extension

The missing outer-estuary area has numerical surface-current forecasts in **DFO POPS STLE500**. This is an actual distributed operational model product, not inferred arrows or direct measurements. It extends the existing STLE200 field through the visible northeast edge of the MP4 and public estuary view.

## Integration

The published website uses the **full-domain 1000 × 1100 geographic grid** (89,900 valid cells), retained as `src/data/outer-estuary-mean.json`. Keeping the full retrieved domain avoids an artificial crop edge when a viewport extends beyond its fitted bounds. A compact 601 × 601 alternative, `estuary-stle500-display-mean.json`, is retained for bounded offline views. Both full and compact grids retain only cells containing **23 out of 23** source samples from **12 October 2026 00:00 UTC to 17 October 2026 12:00 UTC**. It is a stationary arithmetic mean of east and north components. This is a fixed week-to-date sampled forecast mean, not a climatology and not live conditions.

The schema matches existing estuary fields: `kind: "estuary"`, `mode: "average"`, `width`, `height`, `west`, `south`, `dx`, `dy`, `u`, `v`, `t: null`, `start`, `end`, `sampleCount`, `sampleTimes`, `coverageCounts`, `provider`, `sources`, and `method`. Velocity units are m/s. Rows proceed south to north and columns west to east. Null means no retrieved valid velocity.

**Every STLE500 display output has `fallbackOnly: true`.** Append it after STLE200 and the other existing products. It must never overwrite higher-resolution vectors in overlap. The live website should give this optional layer its own fixed-period disclosure whenever it is visible. Do not call its period current or merge its timestamps into the live update status.

The compact bounds **[-71.4, 46.7, -68.4, 49.1]** include all STLE500 additions identified in the current MP4 bounds [-80.15, 43.03, -69.06, 48.44]. It also extends beyond the public estuary view's east/north edges [-68.5, 49]. The west/south margin preserves additions reaching -71.257 / 46.754. The compact file is 4,760,441 bytes, about 286 KB gzip. The compact alternative and its preparation reports are retained in the local research workspace.

The larger full-domain `estuary-stle500-october-week-mean.json` is retained for research. Native data covers longitude -71.8814 through -66.9297 and latitude 46.2024 through 49.8569 on a rotated 290 x 813 grid, with 48,573 wet cells. The full display grid contributes 2,736 valid cells not covered by STLE200 inside the present MP4 bounds; this count includes some coastal model-mask differences. Current vectors near the exact northeast artwork edge (-69.07, 48.43) have all 23 samples. The native mask can differ slightly from the independent OSM coastline; this work does not invent shoreline currents to hide those differences.

The optional `estuary-stle500-20261017T12Z.json` is one dated archived forecast snapshot, **17 October 2026 12:00 UTC**, not a live field. It is not required for the selected fixed-mean presentation.

## Primary sources

- Official DFO model descriptions, including STLE200/STLE500 and warning that ocean model products are guidance rather than observations: <https://dfo-ocean-navigator.github.io/Dataset-Descriptions/>
- Archived DFO POPS STLE500 directory for 12 October: <https://hpfx.collab.science.gc.ca/dfo/pops_model/20261012/stle500/>
- First archive used for the 12 October 00:00 sample: <https://hpfx.collab.science.gc.ca/dfo/pops_model/20261011/stle500/20261011T01Z-20261013T00Z_stle500_SeaWaterVelocity_sfc_forecast.nc>
- Last archive used for 17 October 12:00: <https://hpfx.collab.science.gc.ca/dfo/pops_model/20261017/stle500/20261017T01Z-20261019T00Z_stle500_SeaWaterVelocity_sfc_forecast.nc>

Each source URL, byte range, lead selection, exact decoded UTC time and downloaded record SHA256 is retained in the field's `sources` list. The 23 raw records and seven NetCDF headers are retained in the local research archive. The dates were decoded from CF `seconds since 1950-01-01 00:00:00`, not inferred from filenames.

## Orientation and coverage verification

Raw `uos`/`vos` metadata says generic "sea water x velocity"/"sea water y velocity" and does not conclusively state whether the distributor already rotated them. Two independent checks favor retaining the supplied components as geographic east/north, just as for the previously audited STLE200 product:

- Across **831 fast narrow-channel native cells**, median absolute alignment with the local wet-channel principal axis is **0.9934** for supplied components, versus **0.7648** after another native-grid rotation. Mean alignment is 0.9840 versus 0.7572.
- Across **12,274 nearby STLE200 overlap cells**, the supplied STLE500 components have mean direction dot product **0.9245** and vector RMS difference **0.1151 m/s**. Applying another rotation degrades these to **0.7271** and **0.2242 m/s**. Differences between two resolutions remain expected; this is an orientation audit, not model validation against observations.

Detailed orientation and coverage reports are retained locally; their main checks are summarized here. All native wet cells had exactly 23 valid fields. Mean speed ranges from 0.000216 to 0.807694 m/s, with median 0.165119 m/s. Both components are averaged separately before speed is derived.

Display resampling uses the nearest **native node including land nodes**, rejecting points more than 425 m from the rotated native grid. This preserves the source mask and prevents grabbing a wet velocity across land or beyond a model boundary. There is no coastal erosion, interpolation across missing source cells, extrapolation, speed multiplication or decorative velocity synthesis. Particle brightness is a separate renderer style choice.

`estuary-coverage-preview.png` shows the current MP4's northeast estuary crop: blue is existing STLE200 coverage and gold is actual STLE500 fallback coverage. The broad blank northeast triangle is covered through the top and right artwork edges. The independent OSM outline still contains some coastal bay/shore cells that are missing in both source model masks. This work preserves those absences. A QA-only classification finds 97.557% coverage of the connected estuary interior at that preview's scale; its seven-pixel shoreline exclusion affects the statistic only and is never applied to vectors or renderer masks. See `coverage-preview-report.json` for the exact definition. Do not report that every geographic water pixel now has measured or modelled currents.

## Retrieval record

The published field includes each archive URL, record byte range, decoded UTC valid time, forecast lead and record SHA256 in its `sources` list. Those entries allow an independent retrieval of the exact inputs. Local Python preparation used a classic-NetCDF header parser, NumPy, SciPy and Requests; the raw downloads and preparation scripts are retained in the local research workspace. The public static repository provides the derived field and the source/method record described here.
