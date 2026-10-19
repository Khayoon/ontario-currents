# Kingston–Brockville estimates: local-stage wetting correction

This is the frozen numerical companion to the Lake Ontario close-up film. River trails are **illustrative, simplified, unvalidated depth-averaged hydraulic estimates**. NOAA's separate Lake Ontario surface field keeps priority wherever it has coverage. Local jet speeds, island wakes and detailed bay circulation are not validated.

## What changed

The previous wetting shortcut compared every bed cell with **Brockville's lower water level**, including shallow water near upstream Wolfe and Carleton islands. At Bayfield Bay's southern mouth, retrieved bed is approximately 74.4892 m IGLD85. The global test saw only 0.0325 m of water and deleted the cell, although its locally solved upstream stage produces about **0.3105 m** of water.

The corrected calculation keeps the **same source geometry, bathymetry, missing-bank-depth preparation, endpoint observations, regulated-flow scenario and 1,000 m upstream inlet extension**. It changes hydraulic wet activation:

1. Begin with source-water cells that could be wet at the maximum upstream stage; enforce actual downstream-boundary depth separately.
2. Solve the conservative nonlinear Manning field.
3. Remove cells whose **locally solved** depth is below 0.12 m. Rewet only through an actual orthogonal water face whose connected neighbour supports depth above 0.13 m.
4. Repeat until the mask does not change and no selected cell uses the solver's numerical depth floor. Components must be anchored to an imposed stage; a component attached to just one stage can correctly have zero hydraulic through-flow.

The 0.12 m numerical wet margin and 0.01 m rewet hysteresis are disclosed shoreline assumptions. They are much smaller than uncertainties in some bed and datum values. No arrows or new water polygons were painted into the bay.

## Selected calculation and checks

The forcing interval remains **12 October 2026 00:00–17 October 2026 12:00 UTC**. This is a steady mean-condition scenario, not a temporal average of hourly current vectors.

| Check | Result |
|---|---|
| Grid / selected wet cells | 50 m UTM18N / 171,786 |
| Active-set history | 171,886 initial cells; 97 too-shallow cells and 3 unanchored fragments removed; next 171,786-cell solve unchanged |
| Uniform effective Manning n | 0.02892363 s/m^(1/3), calibrated to the regulation-discharge scenario |
| Inflow / outflow | 7,377.580000 / 7,377.578169 m³/s |
| Relative boundary-flux mismatch | 2.48 × 10⁻⁷ |
| Maximum cell continuity residual | 1.09 × 10⁻⁴ m³/s |
| Minimum actual depth / depth-floor cells | 0.12202 m / zero |
| Maximum potential depth at inactive adjacent candidate | 0.12901 m, below the 0.13 m rewet trigger |
| Held-out Alexandria Bay mean stage residual | +2.38 cm against preliminary observations |
| Selected wet area with estimated bank bed | 17.68% |

Bayfield's southern shallow connection is now present. A representative mouth probe changes from excluded to approximately **0.0167 m/s**; a bay-interior probe changes from numerical near-zero to approximately **0.000346 m/s**. The bay remains slow in this hydraulic scenario.

The corrected southern connection is **depth-sensitive**. The independent audit's highest-clearance southern path has a 0.342 m bottleneck at an **inferred-bed cell**; its 87-cell representative path contains 60 retrieved-bed cells and 27 inferred-bed cells. Raising bed by 0.25 m **only within the physical southern-mouth rectangle** (longitude −76.344 to −76.321°, latitude 44.181 to 44.194°), with solved stage and the remaining bed held fixed, closes that route under the 0.12 m wet threshold. This is a topology diagnostic, not a recomputed flow scenario. A separate northern-mouth diagnostic remains connected. These conditional results do not establish observed bay currents.

## Method, data and limits

The finite-volume solver conserves depth-integrated discharge on genuine wet/wet faces, with zero normal flow through island and land faces. Its simplified friction law is

`div(q)=0; q=−(h^(5/3)/n) grad(eta)/sqrt(|grad(eta)|)`.

Depth is `h=eta−bed`; exported velocities are `q/h`, rotated from UTM to true geographic east and north. A uniform n fit to total regulated discharge is calibration, not independent velocity validation.

The model omits momentum inertia, wind, Coriolis, density stratification and vertical surface shear. Weak-flow bays particularly need wind and unsteady circulation physics that this calculation lacks. Some source-survey vertical references are heterogeneous; the chart-datum separation surface is estimated. Missing bank depths are inferred separately, and source-depth support is much lower in parts of Bayfield Bay than the map-wide percentage. There is no retrieved local 2026 ADCP or current-meter validation.

Earlier grid, bed, head, resistance and experimental momentum checks are retained under `diagnostics/before-local-stage-correction/` and explicitly scoped in `model-report.json`. They are **prior-configuration sensitivity evidence**, not newly run validation of this corrected mask. The earlier DWE's energetic fast-jet defect remains a limitation of the simplified method. A global flow fit and one held-out stage do not validate local velocities.

See [PUBLICATION-SOURCES.md](PUBLICATION-SOURCES.md) for official sources, numerical depth requests, datum qualifications and licences. Raw source arrays are unchanged; [inputs/array-integrity-manifest.json](inputs/array-integrity-manifest.json) and the independent review record source-bed and NaN integrity. Historical preparation manifests retain original cache paths as provenance; current scripts and selected-case metadata use package-local paths.

## Reproduce from this directory

Use Python 3.13. All required helpers, compact numerical inputs and boundary CSV are package-local; no original development folder is required.

```powershell
python -m pip install -r requirements.txt
python check_numerics.py
python solve_local_wetness.py --inlet-pad-m 1000 --source inputs/bathymetry-grid-50m.npz --out-dir regenerated
```

This regenerates the open-boundary bank-bed estimate, runs the wet/dry active-set iterations, calibrates total flow, exports the display field and checks Alexandria Bay. Intermediate candidate stages can contain dry cells; **only the converged no-floor solution is selected**. Results are written under `regenerated/`.

The selected NPZ and display JSON are frozen here. Iterative floating-point last bits and container/source-hash metadata can differ on regeneration; numerical agreement is checked separately. Package integrity is recorded in `SHA256SUMS.json`.
