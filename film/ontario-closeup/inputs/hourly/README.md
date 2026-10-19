# Actual hourly Lake Ontario source fields

Prepared 19 October 2026. This directory contains native NOAA LOOFS top-sigma-layer-0 model fields, with **no temporal averaging**. All previous data, public files and the static river estimate remain unchanged.

## Binary contract

`manifest.json` is the authoritative frozen index, SHA-256 `66ff440910a4cb9822c12d59271f70f1ad2d4a6bfc393c9f914230afcb9b7e4e`.

| File | Shape | Native location | Units | Bytes |
|---|---|---|---|---:|
| `u.f32` | 169 x 64,453 | triangle faces, eastward | m/s | 43,570,228 |
| `v.f32` | 169 x 64,453 | triangle faces, northward | m/s | 43,570,228 |
| `t.f32` | 169 x 34,395 | mesh nodes | degrees C | 23,251,020 |

Every array is little-endian Float32, C order, time-major, without a header. The byte offset of a value is `4 * (time_index * native_count + native_index)`. The `arrays` entries in the manifest record exact SHA-256 hashes. `mesh.json` preserves the retained native node/face order and has SHA-256 `d5720f28802855db79f088946e359e75554ad64f432a048e7df06f45832471cf`.

```python
import numpy as np
t = np.memmap('t.f32', dtype='<f4', mode='r', shape=(169, 34395))
# t[0] is 12 October 00:00 UTC; t[167] is 18 October 23:00 UTC.
# t[168] is the 19 October 00:00 UTC interpolation endpoint.
```

## Time and source selection

The first 168 rows contain every hour from **12 October 2026 00:00 UTC through 18 October 23:00 UTC**. Row 168 is the optional **19 October 00:00 UTC** closing endpoint, allowing interpolation through the final requested hour. It is not an additional day in the film's period. All 169 actual `Times` strings were read from the source responses and checked for the expected time, uniqueness and exact one-hour spacing.

Only nowcast files `n001` through `n006` are used. The candidate file selection is `valid_time = cycle_time - 6 hours + nowcast_hour_index hours`; the actual `Times` field must confirm it. In particular, 18 October 19:00-23:00 comes from the 19 October 00:00 cycle's `n001`-`n005`, and that cycle's `n006` supplies the closing endpoint. No forecast substitution was needed. Thirty-two constrained responses were reused; 137 were retrieved into `raw/`, with three parallel workers.

`manifest.json` records each exact dataset/request URL, raw response SHA-256, actual timestamp, cycle/index, dimensions and validity. The original source Float32 values are retained as Float32, without the six-decimal display rounding used in earlier mean JSONs. All selected U/V/T values are finite. There is no fill, extrapolation, component rotation or spatial reconstruction in this preparation.

The saved [official NOAA model information](https://tidesandcurrents.noaa.gov/ofs/loofs/loofs_info.html) describes four daily cycles with six-hour nowcasts. Saved official catalogues verify all selected files; fresh final-cycle NetCDF attributes identify face-located east/north velocity in `meters s-1` and node-located temperature in `degrees_C`. A fresh final-cycle `lon,lat,nv` response matches the retained native triangle order exactly and coordinates to floating-point roundoff. Every hourly surface response has the expected native dimensions. The sigma layer has model-dependent thickness, rather than a fixed observational depth.

## Temperature checks and unchanged river

`temperature-node-statistics.json` summarizes the first 168 hours, excluding the closing endpoint. Native-node temperatures range from **7.021476 to 18.390301 degrees C**. Its quantiles and 12/16.5-degree tail fractions are **node/time statistics, not wet-area-weighted statistics**; an independent area/time review should determine how the fixed palette behaves. The palette itself has not changed.

The river remains the separately documented static Kingston-Brockville estimate forced with mean conditions for 12 October 00:00 to 17 October 12:00 UTC. These hourly lake fields do not create hourly river dynamics or extrapolate temperatures beyond NOAA coverage. Chronological interpolation, particle integration and final loop presentation are renderer responsibilities.
