# Kingston–Brockville estimates: expanded upstream domain

The selected river field is an **illustrative, simplified, unvalidated depth-averaged hydraulic estimate**. Its reusable raw JSON retains `fallbackOnly: true` as the default. The featured film explicitly overrides this with `riverSourcePriority: "model"`, using the regional depth-averaged field throughout its solved domain and NOAA surface vectors elsewhere. This source handoff is not physically matched or a comparison at the same water depth. This package reproduces the mean-condition river scenario and the actual 3 km upstream cut used for this release.

## Concrete coverage repair

A real-water patch west of Cape Vincent was outside the previous 1 km computational inlet. Its 274 native cells covered about 0.685 km²; 273 had retrieved numerical source bed. The new cut is **3,000 m upstream of the original Kingston–Cape Vincent line**, or 2,000 m beyond the immediately previous cut. The source-water geometry and retrieved bathymetry are unchanged. The expanded geometric corridor adds 6,076 cells, including 6,010 with actual source-depth support.

The calculation regenerates bank-bed estimates for this expanded corridor and repeats the local-stage wet/dry fixed point. It restores 193 of the 274 missing patch cells. Of the remainder, 57 have retrieved bed too shallow even at the upstream mean stage, 23 form potentially wet but stage-unanchored shallow fragments, and one has no retrieved bed. No arbitrary water level or current is assigned to isolated puddles. A water polygon alone is not evidence for a solved wet cell. No missing vectors were extrapolated across the old boundary.

The old dark source-transition point near −76.35567°, 44.13068° is now inside the solved domain rather than on its imposed inlet. Moving the numerical cut does not by itself validate the lake/river source transition or the film's particle sampling.

Retrieved depths remain unchanged exactly. Regenerating the expanded missing-bank interpolation changes some **inferred** bed in the common domain, by up to 0.404 m. This release therefore does not claim that the previous prepared-bed array is unchanged. The raw and inferred parts remain explicitly identified.

## Selected mean-condition calculation

The forcing interval is **12 October 2026 00:00–17 October 2026 12:00 UTC**. The scenario uses mean observed Kingston/Brockville stages and a representative IJC regulation target. It is not the temporal mean of hourly current vectors.

| Check | Result |
|---|---|
| Grid / selected wet cells | 50 m UTM18N / 177,775 |
| Upstream inlet padding | 3,000 m beyond the original cut |
| Effective uniform Manning n | 0.02889393 s/m^(1/3) |
| Inflow / outflow | 7377.580000 / 7377.578346 m³/s |
| Relative boundary-flux mismatch | 2.242e-07 |
| Maximum interior-cell continuity residual | 1.077e-04 m³/s |
| Minimum actual depth / depth-floor cells | 0.12136 m / 0 |
| Held-out Alexandria Bay mean-stage residual | +2.35 cm |
| Solved area with inferred bank bed | 17.12% |

The native conservative fluxes supply both main Carleton channels. Their branch comparison, newly solved patch depths/speeds, old/new overlap statistics and active-mask history are in `model-report.json`. Numerical conservation does not validate local velocities.

## Equations and uncertainty

The finite-volume nonlinear Manning diffusion-wave approximation solves `div(q)=0`, with `q=−(h^(5/3)/n) grad(eta)/sqrt(|grad(eta)|)` and `h=eta−bed`. Land/island faces have zero normal flow. Exported `q/h` vectors are rotated from UTM to true east/north.

Wet activation starts from the maximum upstream-stage candidate, solves local levels, removes actual depths below 0.12 m and rewets only across real orthogonal water faces above 0.13 m. Selection requires a fixed mask and zero numerical depth-floor cells. These shoreline thresholds and the 0.20 m missing-bank constraint are assumptions, not accuracy claims.

This method omits momentum inertia and inertial eddies, wind, Coriolis, density stratification and vertical surface shear. It cannot reconstruct reliable local jets, island wakes or wind-driven bay exchange. Estimated bed and vertical-datum separation add uncertainty; parts of eastern Carleton have sparse retrieved depth support. Earlier shallow Bayfield-mouth sensitivity remains historical evidence under `diagnostics/before-3km-extension/`, rather than a newly performed sensitivity experiment on this domain. No local current-meter validation was retrieved.

The inlet uses the mean Kingston lake stage at a more distant cross-section. That is an explicit boundary-placement assumption. A fit to the regulation target and an independent Alexandria stage check do not validate this assumption or the branch velocities.

## Reproduce without the development workspace

Use Python 3.13 and the included dependencies. All current scripts, source arrays and boundary observations are package-local.

```powershell
python -m pip install -r requirements.txt
python check_numerics.py
python prepare_source_domain.py --input inputs/bathymetry-grid-50m.npz --inlet-pad-m 3000 --check
python solve_local_wetness.py --inlet-pad-m 3000 --source inputs/bathymetry-grid-50m.npz --out-dir regenerated
```

The domain check recomputes the exact geometric cut from real water polygons and verifies the retained mask. To save that recomputed input, add `--out source-regenerated.npz`. The solver then regenerates missing bank bed, solves local-stage wetting to a fixed point, calibrates the explicit discharge scenario, exports the field and checks Alexandria Bay.

`inputs/array-integrity-manifest.json` identifies the changed corridor mask and proves all other raw arrays remain unchanged, including NaNs. [PUBLICATION-SOURCES.md](PUBLICATION-SOURCES.md) records source requests, datum assumptions and licences. Historical source manifests retain cache paths as provenance; no current command depends on them. Original large TIFFs and a separately stored prepared-bed NPZ are omitted because the compact numerical inputs regenerate the latter.

The selected NPZ and display JSON are frozen. Numerical last bits/container hashes may differ on regeneration; the isolated reproduction report records tolerances. `SHA256SUMS.json` records package integrity after final checks.
