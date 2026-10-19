# Derived river temperature

This is a separate passive-temperature estimate for colouring the fixed Kingston–Brockville river model. It is not a river temperature observation or a validated thermal forecast. The original hourly NOAA lake fields, hydraulic depths, shoreline, and hydraulic face discharges remain unchanged.

The calculation uses the selected 50 m hydraulic solution's 177,775 wet cells, 344,179 internal face discharges, and actual depth times 2,500 m² cell area as water volume. Finite-volume donor-cell transport moves the temperature using these physical discharges, without the film's visual motion boost. Atmospheric, solar, bottom, and tributary heat exchange are omitted. The hydraulic flow is depth averaged and steady; NOAA supplies a surface-layer temperature boundary. This mismatch and the simplified hydraulics limit interpretation as real surface temperature.

## Source and initial conditions

The 169 NOAA LOOFS surface-temperature fields run hourly from 12 October 2026 00:00 UTC through 19 October 00:00 UTC. The last state is an interpolation endpoint for the 12–18 October film. Original NOAA model temperature remains the preferred colour source wherever its native wet mesh covers the displayed water.

There are 111 hydraulic inlet-mask cells, of which 110 have positive inferred external inflow. Of those 110, 109 cell centres lie inside native NOAA wet triangles. Temperatures at these centres use barycentric interpolation of each triangle's three original temperature nodes, independently of the velocity mesh. They cover 99.9555527% of inflow discharge. The remaining nearshore cell at longitude −76.47666488, latitude 44.18359685 carries 3.27913418 m³/s (0.0444473% of inflow). Its centre lies 8.86 m beyond the nearest actual NOAA wet triangle. It receives the contemporaneous discharge-weighted temperature of the directly covered inlet cells. This is an explicit spatial boundary approximation; no nearest-across-land temperature sampling is used. The actual NOAA interpolation stencils have a maximum vertex distance of 537.4 m, recorded in `boundary-source-spatial-audit.json`.

Every river cell initially receives the first-hour discharge-weighted inlet temperature, 15.04994844 °C. This uniform source-derived initial condition is an assumption, not an observation or a prehistory spin-up. A second tracer starts at one everywhere and enters at zero, tracking the fraction of this assumed initial water. Slow bays and the 1,403 cells with exactly zero internal face throughflow can retain initial temperature. The hourly audit reports remaining initial-water fractions on both the native and display grids. The bulk volume/discharge ratio is approximately 6.90 days; it is not a local channel travel time.

## Numerical method

The transport is implicit first-order upwind. Hourly boundary temperatures are linearly interpolated at each numerical step. The 150 s result is selected after comparison with 300 s. This method adds numerical mixing and does not resolve thermal stratification or eddies.

Stored hydraulic fluxes have a small numerical continuity residual. With fixed cell volume, ignoring it would make a uniform tracer drift and would make the answer depend on whether temperature used Celsius or Kelvin. Define `r = internal_out + external_out - internal_in - external_in`. The unchanged discharges are used with an explicitly accounted `r*T_new` tracer-budget term, evaluated at the new implicit time level. The resulting operator preserves uniform temperature and temperature-offset invariance. This is a numerical continuity compensation, not an assumed heat source. Every step records the external temperature-volume flux, this compensation, and inventory error. No temperature clipping is performed. The uniform 16 °C and Celsius/Kelvin tests and the time-step comparison are retained alongside the output.

## Output contract

- `manifest.json`: exact UTC times, source hashes, grid, assumptions, and binary hashes.
- `index-map.i32`: little-endian Int32, shape `[865,1144]`; −1 outside the original display wet mask, otherwise a unique compact index.
- `temperature.f32`: little-endian Float32, C-order shape `[169,121644]`, degrees Celsius. Every original valid river display cell has a finite temperature at every time.
- The output grid and nearest-native-cell mapping exactly match the frozen river `display-field.json`. No water cell, island, depth, or current vector is added or changed.

`prepare_tracer.py --run` reproduces the native calculation and audits from the retained project inputs. `input-audit.json`, `inlet-temperature.npz`, `uniform-300s-audit.json`, `tracer-150s-audit.json`, and `timestep-sensitivity.json` document the source coverage, tests, and initial-state dependence.

Primary NOAA sources are the [LOOFS system information](https://tidesandcurrents.noaa.gov/ofs/loofs/loofs_info.html), the [official October 2026 model archive](https://opendap.co-ops.nos.noaa.gov/thredds/catalog/NOAA/LOOFS/MODELS/2026/10/19/catalog.html), and [the archived field metadata](https://opendap.co-ops.nos.noaa.gov/thredds/dodsC/NOAA/LOOFS/MODELS/2026/10/19/loofs.t00z.20261019.fields.n006.nc.das). Exact per-hour source URLs, parsed model times, and raw-response hashes remain in the unchanged hourly lake manifest. The hydraulic source package documents the underlying bathymetry, stage, and discharge-scenario provenance; its forcing period remains 12 October 00:00 through 17 October 12:00 UTC.
