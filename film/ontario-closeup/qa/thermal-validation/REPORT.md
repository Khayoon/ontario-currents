# Independent thermal-render integration check

**PASS** for renderer SHA-256 `f02b795c7f83ca0f4c01395fa2de0a8715b77eb223dad5109cb5a557115d1fe6`.

The fixtures invoke the exact `work/forum-render/render.mjs` through Node and real native Canvas. They do not copy its palette or legend functions. Negative and zero fixture temperatures are synthetic test inputs, not Lake Ontario observations.

```powershell
python work/temperature-week/thermal-validation/run_validation.py
```

All renderer subprocesses use `--preserve-symlinks --preserve-symlinks-main --expose-gc`.

Actual PNG pixels and raster buffers establish:

- The −2 / 0 / +2 °C endpoints and midpoint map correctly with an offset range; below/above-range values clamp to the palette endpoints.
- Zero is treated as finite temperature. Missing temperature uses neutral colour in both base and actual moving trails.
- Missing-temperature trails remain neutral at two different velocities, so speed cannot substitute for temperature.
- Finite NOAA temperature is retained even when the lake velocity is missing and regional river velocity supplies the flow.
- `river.t:null` and null array entries preserve available NOAA temperature; finite river temperature overrides it.
- Actual Celsius tick strokes occur at the left/middle/right legend positions. A speed-style tick position is absent.
- U, V and provider raster bytes are identical across temperature/speed modes and before/after the thermal patch on these fixtures.
- Equal and nonfinite temperature ranges reject explicitly.

Machine-readable evidence is in `report.json`; `thermal-base.png` and `thermal-trails.png` are the actual rendered fixture outputs. This bounded check does not replace review of the real full-map encoded film, its source captions, or its final palette choice.

The actual new weekly field separately has 34,395 finite nodal temperatures, no missing nodal temperatures, and a range of **10.682209–16.893734 °C**. Its SHA-256 is `307c30517b8d8d54c6987157a128625039318e160c3a384ebe4ddd0dfa909c15`. It contains 28 six-hourly snapshots dated 12 October 00:00 through 18 October 18:00 UTC. These snapshot means should not be described as a continuous temporal integral. Exact values and provenance keys are recorded in `actual-field-temperature-stats.json`.

The renderer's current fallback title correctly selects “WATER TEMPERATURE” in thermal mode; the final film also explicitly supplies a thermal legend title. An earlier review warning based on the pre-update title path was stale and is withdrawn. The renderer SHA above matches the final checked source.
