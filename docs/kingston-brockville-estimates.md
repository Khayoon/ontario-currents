# Kingston–Brockville current estimates

The Lake Ontario close-up film includes an **illustrative, simplified, unvalidated depth-averaged through-flow estimate** from Kingston/Cape Vincent to Brockville. The bottom of the film labels it **ESTIMATES**. It is a new calculation from source bathymetry, water levels and a regulation-discharge scenario, not a retrieved government velocity product.

The [frozen numerical inputs, solver, output and reproducible checks](../model/upper-river/) accompany the visualization. See that package's [README](../model/upper-river/README.md) for commands and full results, and the [input research](kingston-brockville.md) for existing calibrated model leads.

## What the field represents

The river is a steady mean-condition scenario for **12 October 2026 00:00 UTC–17 October 2026 12:00 UTC**. Its endpoint stages are the arithmetic means of 133 hourly CHS observations at each station, converted from each station's chart datum to IGLD85: Kingston **74.801744 m**, Brockville **74.521707 m**. A uniform Manning roughness is calibrated to an approximately **7,377.58 m³/s IJC regulation-discharge target**. The target is a published operating scenario, not an independently measured Kingston discharge.

The river field is **not a temporal vector average of hourly velocities**. The lake remains the separate NOAA LOOFS surface-vector mean of 23 six-hourly samples. A depth average and a surface velocity are different physical quantities. The film identifies both, and the river only fills places where the lake source has no valid field.

## Geometry, depths and calculation

The numerical domain uses a 50 m UTM18N grid, finite-volume continuity and a nonlinear Manning diffusion-wave approximation. The imposed water-level difference drives flow around sourced islands and through connected channels; land faces have no normal flow. It does not use centreline arrows or hand-painted directions.

CHS NONNA10 is sampled at native-scale numerical WCS resolution and aggregated into simulation cells, with NONNA100 fallback. Actual OpenFreeMap water polygons repair the omitted Alexandria Bay branch while retaining island holes. In the connected input corridor, **82.04%** of cells have historical numeric source-depth support and **17.96%** need explicitly estimated bank bed. The final solved wet domain has **17.44%** estimated bed. Missing depths are harmonically interpolated with a shallow bank constraint; source-supported depths remain fixed. Survey dates and vertical references vary. The conversion uses an approximate chart-datum separation surface, not a verified survey-grade vertical transformation.

The selected 50 m scenario has 166,832 wet cells and calibrated Manning n **0.02893563 s/m^(1/3)**. Its inlet/outlet fluxes are **7,377.580 / 7,377.578 m³/s**, with relative mismatch **2.44 × 10⁻⁷**. No cells require the numerical depth floor. These establish numerical continuity and calibration, not field accuracy.

## Checks and limitations

- A held-out Alexandria Bay preliminary water-level mean is about **2.40 cm below** the predicted local stage. It was not used as a boundary or calibration target. A stage check does not validate current speed or flow splitting.
- Independently calibrated 50/100 m runs have a median moving-flow direction difference of **3.09°**, with a 90th percentile of **14.49°**. This is grid sensitivity, not formal convergence or velocity validation.
- At 100 m, changing bank interpolation to nearest source bed changes total flow by about **0.24%** at fixed roughness. Moving the whole estimated bed by ±0.25 m changes total flow by approximately **−4.4% / +4.5%**. Small global changes do not establish local accuracy; at some transects, about **42.5%** of crossing flux touches estimated-bed cells.
- The approximation omits momentum inertia, inertial eddies, wind, density stratification, vertical shear and detailed structures. The [USACE equation guidance](https://www.hec.usace.army.mil/confluence/rasdocs/r2dum/latest/running-a-model-with-2d-flow-areas/shallow-water-or-diffusion-wave-equations) explains why inertia can matter in flat or rapidly varying flow. This custom implementation is not HEC-RAS.
- An experimental full-momentum comparison remained unsettled and substantially reduced discharge when donor-cell advection was enabled. Its pressure/friction-only comparison was close to the simplified solution. That unresolved discrepancy is retained in the package; it is not evidence of improved accuracy, and roughness was not forced lower to hide it.
- A small set of extreme fast cells fails an available-head diagnostic: about **0.091%** have static-plus-kinetic head more than 1 cm above inlet static stage. This reinforces that **individual jet speeds and island wakes are not quantitatively reconstructed**. No values were clipped by hand to conceal this limitation.

Use the film to see a qualitative estimated through-flow pattern. Do not treat it as observed surface currents, a validated hindcast, a navigation product or an account of all local eddies. No local velocity-meter comparison was available.

## Display and availability

The field is rotated from UTM grid axes into true east/north metres per second and exported with nulls outside solved wet cells. The shoreline is cropped at the Brockville outlet; velocities are not extended beyond it. Extra river particle seeding makes narrow channels readable at full-frame size. Particle density does not encode discharge or confidence. Motion is accelerated and the two-second transition joins a 20-second silent MP4.

The broader live atlas remains available. This fixed estimated river layer belongs to the featured film; it has not been added to the live forecast catalogue.

## Sources and attribution

- [CHS NONNA catalogue](https://open.canada.ca/data/en/dataset/d3881c4c-650d-4070-bf9b-1e00aabf0a1d): exact numerical WCS requests and file hashes are retained with the inputs. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
- [CHS IWLS API](https://api-iwls.dfo-mpo.gc.ca/swagger-ui/index.html): Kingston 13988 and Brockville 14400 observations and datum metadata.
- [NOAA CO-OPS Alexandria Bay station](https://tidesandcurrents.noaa.gov/stationhome.html?id=8311062): independent preliminary stage check.
- [International Lake Ontario–St. Lawrence River Board outflow notices](https://ijc.org/en/loslrb/watershed/outflow-changes): regulation-discharge schedule, frozen CSV in the inputs.
- Geography: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/1-0/), through [OpenFreeMap](https://openfreemap.org/) and © [OpenMapTiles](https://openmaptiles.org/).

Source observations retain their original providers and licences. The experimental hydraulic calculation and its limitations are this project's responsibility.
