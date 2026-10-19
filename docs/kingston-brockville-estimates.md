# Kingston–Brockville current estimates

The Lake Ontario close-up film includes an **illustrative, simplified, unvalidated depth-averaged through-flow estimate** from Kingston/Cape Vincent to Brockville. The bottom of the film labels it **ESTIMATES**. It is a new calculation from source bathymetry, water levels and a regulation-discharge scenario, not a retrieved government velocity product.

The [frozen numerical inputs, solver, output and reproducible checks](../model/upper-river/) accompany the visualization. See that package's [README](../model/upper-river/README.md) for commands and full results, and the [input research](kingston-brockville.md) for existing calibrated model leads.

## What the field represents

The river is a steady mean-condition scenario for **12 October 2026 00:00 UTC–17 October 2026 12:00 UTC**. Its endpoint stages are the arithmetic means of 133 hourly CHS observations at each station, converted from each station's chart datum to IGLD85: Kingston **74.801744 m**, Brockville **74.521707 m**. A uniform Manning roughness is calibrated to an approximately **7,377.58 m³/s IJC regulation-discharge target**. The target is a published operating scenario, not an independently measured Kingston discharge.

The river field is **not a temporal vector average of hourly velocities**. The lake remains the separate NOAA LOOFS surface-vector mean of 23 six-hourly samples. A depth average and a surface velocity are different physical quantities. In this film, valid regional river-estimate cells take priority over overlapping NOAA cells; NOAA remains where the regional estimate is absent. This avoids interleaving the two products inside the estimated river domain. It does not match their physical layers, solve a coupled lake–river boundary, or establish continuity of real surface currents between the products.

## Geometry, depths and calculation

The numerical domain uses a 50 m UTM18N grid, finite-volume continuity and a nonlinear Manning diffusion-wave approximation. The imposed water-level difference drives flow around sourced islands and through connected channels; land faces have no normal flow. It does not use centreline arrows or hand-painted directions.

CHS NONNA10 is sampled at native-scale numerical WCS resolution and aggregated into simulation cells, with NONNA100 fallback. Actual OpenFreeMap water polygons repair the omitted Alexandria Bay branch while retaining island holes. In the expanded input corridor, **82.91%** of cells have historical numeric source-depth support and **17.09%** need explicitly estimated bank bed. The final solved wet domain has **17.12%** estimated bed. Missing depths are harmonically interpolated with a shallow bank constraint; source-supported depths remain fixed. Survey dates and vertical references vary. The conversion uses an approximate chart-datum separation surface, not a verified survey-grade vertical transformation.

The selected 50 m scenario has **177,775 wet cells** and calibrated Manning n **0.02889393 s/m^(1/3)**. Its inlet/outlet fluxes are **7,377.580000 / 7,377.578346 m³/s**, with relative mismatch **2.24 × 10⁻⁷**. The minimum actual wet depth is **0.121356 m**; no cells require the numerical depth floor. These establish numerical continuity and calibration, not field accuracy.

The current revision places the artificial inlet **3,000 m upstream of the original cut**, **2,000 m farther upstream than the preceding 1,000 m-padded cut**. It reapplies the observed Kingston mean stage at that new cut under an approximate nearby lake-level assumption; wind setup and a coupled lake boundary are not represented. This separately solved larger domain gains **5,989 wet cells** relative to the preceding local-stage version and loses none. Of the added wet cells, 5,924 have retrieved numeric bed. Velocities are recalculated, rather than extended from the old boundary.

Original source geography, raw bathymetry, and retrieved-depth values are unchanged. The missing-bed harmonic preparation is regenerated for the larger domain; **inferred bed in common cells can change by up to 0.40385 m**. The interpolation distinguishes actual shoreline from artificial open cuts: a cut is not assigned an invented shallow bank.

A diagnosed western Wolfe-side inlet gap contained **274 mapped-water cells**, 273 with numeric source bed, outside the prior artificial cut. The larger solve makes **193 of those cells wet**. The other 81 comprise 57 retrieved-bed cells too shallow at the upper Kingston stage, 23 potentially wet but stage-unanchored shallow fragments, and one cell without source bed. They are not all classified as observed dry land. The restored patch has weak estimated through-flow: median **0.000108 m/s**, maximum **0.000548 m/s**. Expanded model coverage does not establish strong bay circulation or recreate wind-driven motion.

## Previous version: Wolfe–Carleton shallow-water diagnosis

Before the current 3,000 m inlet revision, an earlier mask tested every cell against the lower Brockville endpoint level. That falsely dried some upstream water near Bayfield Island even though it was submerged at its local stage. The corrected active-set calculation starts with the upper-stage candidate, solves, removes locally shallow cells, and checks rewetting through actual orthogonal wet faces. It converges to a stable connected mask using a 0.12 m wet-depth threshold and 0.01 m rewetting hysteresis, retained in the current revision. That previous 1,000 m-inlet calculation had a minimum actual depth of **0.1220 m**, no numerical depth-floor cells, and gained **1,836 wet cells** without changing its source shoreline or prepared/retrieved bed elevations. Its numerical results below describe that previous version.

At the diagnostic south-mouth point −76.331,44.187, the recalculated depth is about **0.3105 m** and speed about **0.0167 m/s**. Bayfield Bay gains weak through-flow; its interior median is approximately **0.000259 m/s**, compared with about 0.12 m/s in the main north-Carleton channel. These are unvalidated model values, not observations. The bay interior has sparse retrieved bed coverage and relies heavily on estimated bed.

The southern connection is **depth-sensitive**. Its highest-clearance modeled path has a minimum depth of about **0.342 m**, at a cell with estimated bed. A topology-only test that raises bed within the physical mouth by 0.25 m while holding solved levels fixed disconnects that shallow path at the 0.12 m threshold; the deeper northern mouth stays connected. This is an uncertainty diagnostic, not another velocity simulation. The correction removes a specific mask error without establishing precise bay circulation. The [package diagnostics](../model/upper-river/diagnostics/) retain independent source, conservation, active-set and mouth-path checks.

## Checks and limitations

- In the current 3,000 m-inlet revision, the held-out Alexandria Bay preliminary water-level mean is **74.667821 m IGLD85**, versus predicted **74.691289 m**: an approximately **+2.35 cm** model residual. It was not used as a boundary or calibration target. A stage check does not validate current speed or flow splitting.
- Prior, unpadded independently calibrated 50/100 m runs have a median moving-flow direction difference of **3.09°**, with a 90th percentile of **14.49°**. This is grid sensitivity, not formal convergence or velocity validation.
- In prior unpadded 100 m sensitivity runs, changing bank interpolation to nearest source bed changes total flow by about **0.24%** at fixed roughness. Moving the whole estimated bed by ±0.25 m changes total flow by approximately **−4.4% / +4.5%**. Small global changes do not establish local accuracy; at some transects, about **42.5%** of crossing flux touches estimated-bed cells.
- The approximation omits momentum inertia, inertial eddies, wind, density stratification, vertical shear and detailed structures. The [USACE equation guidance](https://www.hec.usace.army.mil/confluence/rasdocs/r2dum/latest/running-a-model-with-2d-flow-areas/shallow-water-or-diffusion-wave-equations) explains why inertia can matter in flat or rapidly varying flow. This custom implementation is not HEC-RAS.
- A prior-domain experimental full-momentum comparison remained unsettled and substantially reduced discharge when donor-cell advection was enabled. Its pressure/friction-only comparison was close to the simplified solution. That unresolved discrepancy is retained in the package; it is not evidence of improved accuracy, and roughness was not forced lower to hide it.
- Prior-domain diagnostics found a small set of extreme fast cells failing an available-head check: about **0.091%** have static-plus-kinetic head more than 1 cm above inlet static stage. This reinforces that **individual jet speeds and island wakes are not quantitatively reconstructed**. No values were clipped by hand to conceal this limitation.

Use the film to see a qualitative estimated through-flow pattern. Do not treat it as observed surface currents, a validated hindcast, a navigation product or an account of all local eddies. No local velocity-meter comparison was available.

## Display and availability

The field is rotated from UTM grid axes into true east/north metres per second and exported with nulls outside solved wet cells. The shoreline is cropped at the Brockville outlet; velocities are not extended beyond it. The renderer samples current vectors on a **0.25-pixel grid** (roughly 36 m at this framing). The previous 0.5-pixel grid preserved the main river but closed the newly restored shallow southern Bayfield mouth again. The finer actual display raster preserves separate northern and southern mouth paths, with checked edges wholly inside source water. It samples the same numerical vectors and does not improve the hydraulic model's resolution or accuracy. Midpoint integration enforces a maximum 0.2-pixel segment even when the next cell has higher speed. Extra particle seeding makes narrow channels and weak-flow areas readable at full-frame size. Particle density does not encode discharge or confidence. Slow nonzero vectors target **12 design pixels per video second**, bounded to a **1,024× boost** over the nominal 70,000-fold accelerated motion; extremely weak vectors can remain below that target when the cap applies. Exact-zero vectors remain zero, and zero-length segments are not drawn as stationary round-cap dots. Direction and speed colours use the physical numerical vectors without this display boost. Particle travel therefore has no single physical-time multiplier and must not be read as physical speed. The two-second transition joins a 20-second silent MP4.

Some side waters, including Bayfield Bay and parts of Lake of the Isles, have almost zero through-flow in this simplified model. This does not establish that real water is stagnant: wind, inertial circulation and unresolved connections can matter. Outlined Charleston Lake is outside the current products.

The broader live atlas remains available. This fixed estimated river layer belongs to the featured film; it has not been added to the live forecast catalogue.

## Sources and attribution

- [CHS NONNA catalogue](https://open.canada.ca/data/en/dataset/d3881c4c-650d-4070-bf9b-1e00aabf0a1d): exact numerical WCS requests and file hashes are retained with the inputs. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
- [CHS IWLS API](https://api-iwls.dfo-mpo.gc.ca/swagger-ui/index.html): Kingston 13988 and Brockville 14400 observations and datum metadata.
- [NOAA CO-OPS Alexandria Bay station](https://tidesandcurrents.noaa.gov/stationhome.html?id=8311062): independent preliminary stage check.
- [International Lake Ontario–St. Lawrence River Board outflow notices](https://ijc.org/en/loslrb/watershed/outflow-changes): regulation-discharge schedule, frozen CSV in the inputs.
- Geography: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/1-0/), through [OpenFreeMap](https://openfreemap.org/) and © [OpenMapTiles](https://openmaptiles.org/).

Source observations retain their original providers and licences. The experimental hydraulic calculation and its limitations are this project's responsibility.
