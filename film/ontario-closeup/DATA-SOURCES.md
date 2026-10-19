# Lake Ontario: full-week surface vectors and temperature

Prepared 19 October 2026 from official NOAA LOOFS model nowcasts. This is data preparation only; existing imagery, rendering code, public files and the river calculation were not changed.

- Field: `ontario-october-week-mean-28.json` (2,028,168 bytes), SHA-256 `307c30517b8d8d54c6987157a128625039318e160c3a384ebe4ddd0dfa909c15`.
- Calendar week: 12 October 2026 00:00 UTC inclusive to 19 October 00:00 UTC exclusive. All 28 six-hourly model times are present, from 12 October 00:00 through 18 October 18:00 UTC. Actual `Times` values were parsed and checked, rather than inferred from filenames. This is an equally weighted sampled calendar-week mean, not a continuous 168-hour integral or chronological replay.
- Eastward `u` and northward `v` are averaged separately in m/s at 64,453 native faces. Temperature is averaged separately in degrees C at 34,395 native nodes. All output values have 28 of 28 finite input samples. No values were spatially remapped, clipped, extrapolated or filled. Surface means refer to sigma layer index 0, whose thickness is model dependent.
- The node-temperature means range from 10.682209 to 16.893734 C. Those extrema and node-count percentiles are not wet-area-weighted display-scale statistics; independent area-weighted statistics should determine palette limits.
- `native-mean-full-precision.npz` retains the unrounded float64 arithmetic means and sample counts. JSON values are rounded to six decimal places for compatibility with the existing renderer.
- The native mesh is byte-identical to the retained mesh, SHA-256 `d5720f28802855db79f088946e359e75554ad64f432a048e7df06f45832471cf`. A fresh official final-cycle `lon,lat,nv` response verifies exact triangle index order and node coordinates to floating-point roundoff. Every surface response has the expected array dimensions.
- The previous 23-sample mean and river field remain unchanged. The river still represents its separately documented 12 October 00:00 to 17 October 12:00 UTC mean-forcing scenario; it is not relabelled as the full-week lake mean.

`source-manifest.json` is the portable provenance summary: full official dataset/request URLs and SHA-256 hashes for all 28 constrained raw responses, the seven official catalogues, fresh units/location metadata and native-topology verification. The raw ASCII responses stay in the local preparation workspace and need not be published. `provenance.json` additionally records local retained-file paths and numerical summaries.

Official final-day [catalogue](https://opendap.co-ops.nos.noaa.gov/thredds/catalog/NOAA/LOOFS/MODELS/2026/10/18/catalog.xml) and [NetCDF attributes](https://opendap.co-ops.nos.noaa.gov/thredds/dodsC/NOAA/LOOFS/MODELS/2026/10/18/loofs.t18z.20261018.fields.n006.nc.das) confirm the available model cycles and variable units/locations. These are modeled currents and temperatures, not direct measurements or a climatology.

## Selected temperature display scale

The selected film palette is 12 to 16.5 degrees C, with explicit <=12 and >=16.5 endpoint caps. The full-week mean native-node extrema remain 10.682209 and 16.893734 degrees C; endpoint saturation changes display colour only. The independent analytic linear-triangle CDF uses spherical native wet-triangle area, not unweighted node counts: 99.6582093795% of native model wet area is inside the selected range, 0.1491997188% below and 0.1925909016% above. These are native-model area statistics before final shoreline antialiasing.

The reviewer initially recommended the wider 12 to 17 degree C candidate; the selected 12 to 16.5 degree C display is an explicit project choice. Its corresponding candidate statistics, rather than a claim of reviewer recommendation for that scale, are recorded above. The full independent report is temperature-statistics-review.json; the planned published copy is film/ontario-closeup/qa/temperature-statistics-review.json.

NOAA temperature may colour an independently estimated river current only where the actual NOAA temperature mesh covers that position. Missing temperatures retain a neutral, labelled display treatment. No temperature is deduced from current speed or extrapolated into river-only cells.
