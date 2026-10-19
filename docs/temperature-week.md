# Lake Ontario: a week of temperature and currents

19 October 2026.

This edition colours the animated flow map by **mean modeled surface temperature**. Its NOAA LOOFS fields cover the full UTC calendar week **12–18 October 2026**, using 28 samples at 00:00, 06:00, 12:00 and 18:00 each day. Every actual model timestamp was read and verified: the first is 12 October 00:00 UTC and the last is 18 October 18:00 UTC; the calendar-week boundary is 19 October 00:00 UTC, exclusive.

Eastward and northward current components are averaged separately, and temperature is averaged separately. Animated trails follow these fixed weekly fields. They do not replay changing conditions, reconstruct parcel paths through the week, or represent a continuous 168-hour integral.

## Source and coverage

The official [NOAA catalogue](https://opendap.co-ops.nos.noaa.gov/thredds/catalog/NOAA/LOOFS/MODELS/2026/10/18/catalog.xml) lists the final day's four cycles. The [NetCDF attributes](https://opendap.co-ops.nos.noaa.gov/thredds/dodsC/NOAA/LOOFS/MODELS/2026/10/18/loofs.t18z.20261018.fields.n006.nc.das) identify east/north velocities in m/s at **64,453 native triangle faces** and temperature in `degrees_C` at **34,395 native nodes**. All retained values have **28 of 28 valid samples**. The selected top sigma layer has model-dependent thickness; these are model results, rather than direct surface measurements. The native mesh and source ordering are preserved.

The separate Kingston–Brockville layer remains the [simplified river estimate](kingston-brockville-estimates.md), forced with mean conditions for **12 October 00:00 to 17 October 12:00 UTC**. Its period has not been changed to match the new lake mean. Where NOAA temperature overlaps the estimated river currents, the colour still comes from the actual NOAA temperature field. **No temperature is extrapolated beyond that coverage**; waters without temperature use the labelled neutral treatment.

## Reading the colours

The chosen scale runs from **12 to 16.5°C**, with explicit **≤12** and **≥16.5** endpoint caps. Actual mean node temperatures span **10.6822–16.8937°C**. Endpoint colours saturate; the numerical temperatures remain unchanged.

The [independent temperature audit](../film/ontario-closeup/qa/temperature-statistics-review.json) calculates area from piecewise-linear nodal temperature over the original wet triangles, weighted by spherical triangle area. **99.6582%** of native model wet area lies inside the chosen scale, **0.1492%** below it and **0.19259%** above it. These are area percentages, not counts of densely clustered coastal nodes or final antialiased video pixels. Colour encodes temperature; accelerated trail travel does not encode temperature or physical travel time.

Frozen full-week field SHA-256: `307c30517b8d8d54c6987157a128625039318e160c3a384ebe4ddd0dfa909c15`.
