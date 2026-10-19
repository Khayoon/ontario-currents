# Kingston–Brockville: illustrative through-flow estimates

This is the frozen numerical companion to the Lake Ontario close-up movie. Its river trails use a **simplified, unvalidated depth-averaged hydraulic scenario**. The existing NOAA Lake Ontario field keeps priority in the overlap. This is not measured current data, an operational forecast, or a validated reconstruction of local jets and island wakes.

The scenario uses the **12 October 2026 00:00–17 October 2026 12:00 UTC mean endpoint water levels**, retrieved NONNA bathymetry, mapped islands, and a published regulation-discharge target. It is a single mean-condition hydraulic solution, **not an average of hourly simulated current vectors** and not a climatology.

## Numerical method and interpretation

The solver satisfies depth-integrated continuity on a 50 m UTM18N finite-volume grid. Each wet/wet face carries a Manning friction-law discharge; land/island faces carry zero normal discharge. It solves the nonlinear elliptic hydraulic-potential equation

`div(q) = 0; q = -(h^(5/3)/n) * grad(eta) / sqrt(|grad(eta)|)`.

`eta` is water-surface elevation, `h = eta - bed`, and `n` is spatially uniform effective Manning resistance. A small gradient regularization prevents singular conductivity in still water. Both endpoint stages are imposed; one global resistance is calibrated to the regulation-discharge scenario. This calibration is not an independent flow validation. Exported grid velocities are `q/h`, rotated from UTM axes to true geographic east/north in metres per second.

The approximation omits momentum inertia, inertial eddies, wind, Coriolis, thermal density stratification and vertical surface shear. **Local fast-jet speeds are not quantitatively trustworthy.** An energy diagnostic finds a small set of cells where static plus kinetic head exceeds the inlet static stage; this is a known limitation of the approximation, not corrected by clipping. [USACE guidance on diffusion-wave versus shallow-water equations](https://www.hec.usace.army.mil/confluence/rasdocs/r2dum/latest/running-a-model-with-2d-flow-areas/shallow-water-or-diffusion-wave-equations) specifically warns about flat slopes and abrupt contractions, both relevant here. This custom solver is not HEC-RAS. The movie uses the field to illustrate probable downstream routing through connected channels. A small estimates disclaimer stays on the movie.

## Data and assumptions

- Kingston and Brockville: 133 hourly CHS observations, separately converted from chart datum to IGLD85 using station offsets +74.20 and +73.95 m. Mean stages are **74.801744 and 74.521707 m**, a **0.280038 m** difference.
- NONNA10: numeric bathymetry requested at 20 Web Mercator metres, then multiple source samples averaged inside each model cell. NONNA100 supplies actual numerical fallback where the fine product has no finite samples. Neither request spacing nor model spacing establishes independent survey resolution.
- Source survey vertical datums are heterogeneous. The bed conversion uses an explicitly estimated linear Kingston–Brockville chart-datum separation surface. It is not an authoritative vertical transformation.
- Roughly **17.44% of the selected wet-cell bed** is estimated near banks. The frozen source grid retains missing values. A separate harmonic interpolation uses neighbouring retrieved bed and a 0.2 m shallow shoreline constraint. Retrieved depths are unchanged. Some sections have substantial flow adjacent to inferred bed; inferred area is not equivalent to uncertainty in flux.
- The regulation-discharge scenario is **7,377.58 m³/s**, based on the IJC change schedule. The CSV's change-time timezone is unspecified; the small timezone bracket is retained in the boundary-statistics record. It is not independently measured current-meter forcing.
- The real water geometry was recovered from OpenFreeMap/OpenMapTiles water polygons, retaining island holes. The computational cuts are Kingston–Cape Vincent and just downstream of Brockville. No painted centreline or buffered synthetic river is used.

See [PUBLICATION-SOURCES.md](PUBLICATION-SOURCES.md) for official endpoints, source qualifications, attribution, retrieval records and compact-input provenance.

## Checks and remaining uncertainty

| Check | Result |
|---|---|
| Selected grid | 50 m; 166,832 connected wet cells |
| Effective calibrated Manning `n` | 0.02893563 s/m^(1/3) |
| Inflow / outflow | 7,377.5800 / 7,377.5782 m³/s |
| Relative boundary-flux mismatch | 2.44 × 10⁻⁷ |
| Maximum interior-cell continuity residual | 9.86 × 10⁻⁵ m³/s |
| Minimum actual water depth / cells using depth floor | 0.2106 m / zero |
| Held-out Alexandria Bay stage | +2.40 cm relative to target-period preliminary observations |
| 50 m vs 100 m, common moving cells | Median direction difference 3.09°; 95th percentile 21.0°; RMS vector difference 0.0498 m/s |
| Bed ±0.25 m, fixed 100 m resistance | Total discharge −4.37% / +4.51% |
| Nearest-bank rather than harmonic bed | Total discharge +0.237%, fixed 100 m resistance |
| Observed endpoint-head 5th / 95th percentiles | Total discharge −9.85% / +11.69%, fixed 100 m resistance |
| Uniform resistance −20% / +20% | Exact discharge scaling +25% / −16.67%, fixed stages |

The two grids were independently calibrated to the same total discharge, so their comparison is a sensitivity check, not formal convergence. Matching total discharge and one independently held stage does **not** validate local velocity vectors or every channel flow split. There is no retrieved local ADCP/current-meter validation for this 2026 scenario.

An experimental full-momentum shallow-water comparison was also run for 24 hours with the 100 m grid and its DWE-calibrated resistance. It ended its 24-hour run near **2,886 m³/s outflow**, strongly below the regulation target, with residual boundary seiche. Advection/grid losses remain unresolved. The no-advection pressure/friction comparison settled near **7,576 m³/s**, close to the DWE result. These experiments are retained in diagnostics; they are **not the movie's selected field** and do not make the simplified result a validated momentum model.

The analytic Manning-channel test has 0.0023% discharge error, and the variable-bed lake-at-rest check preserves exactly zero current. These check numerical mechanisms, not real river-current accuracy. Raw diagnostics and frozen input/output SHA-256 records are in [model-report.json](model-report.json).

## Reproduce the selected estimate

Use Python 3.13 and run from this directory. The compact inputs preserve the exact numerical arrays needed by the calculation; the original much larger downloaded rasters can be retrieved from the source manifests rather than bundled again.

```powershell
python -m pip install -r requirements.txt
python check_numerics.py
python estimate_bank_bed.py inputs/bathymetry-grid-50m.npz --out bank-bed-native-harmonic-50m.npz
python solve_hydraulics.py bank-bed-native-harmonic-50m.npz --out dwe-native-harmonic-50m.npz
python calibrate_uniform_roughness.py dwe-native-harmonic-50m.npz --out dwe-calibrated-50m.npz
python export_display.py dwe-calibrated-50m.npz --out display-field.json
python audit_solution.py dwe-calibrated-50m.npz bank-bed-native-harmonic-50m.npz --out regenerated-audit.json
```

The same sequence with `100m` inputs regenerates the coarse-grid sensitivity. To reproduce the experimental pressure/momentum comparison after making the 100 m calibrated solution:

```powershell
python solve_semiimplicit_momentum.py dwe-calibrated-100m.npz --n 0.03065938233 --hours 24 --dt 20 --out experimental-swe-100m.npz
python solve_semiimplicit_momentum.py dwe-calibrated-100m.npz --n 0.03065938233 --hours 24 --dt 120 --viscosity 0 --advection-factor 0 --out experimental-no-advection-100m.npz
```

The selected NPZ and display JSON are included as frozen artifacts. Regenerated solutions should agree within the reported iterative tolerances; small floating-point/iterative differences need not be byte-identical. `SHA256SUMS.json` describes this published package.
