# Bayfield display checks

These are **presentation diagnostics**, not velocity measurements or physical validation.

- `coarse-grid-failed.json`: the actual 0.5-output-pixel raster closes the southern Bayfield mouth despite the native model connection. This failed candidate was not published.
- `fine-grid-passed.json`: the actual 0.25-pixel raster preserves both separate mouths. All connecting edges in the checked paths stay inside the original water polygon, and all providers are the river estimate.
- `targeted-advection.json`: a bounded 120-frame / four-video-second check using 1,419 local cell-centre seeds and the production midpoint/step-limit integration. Instrumentation terminates a causal trace at its first invalid-field reset and distinguishes crop exits. Of the seeds starting on the selected main-channel side, 17 cross the selected southern gate and 12 reach the nonoverlapping bay target continuously. Their complete substep positions are retained.
- `trajectory-water-check.json`: all twelve paths to bay entry stay strictly inside original source water, with no reset through the remainder of this trace. The seeds use age 0 and life 330; four seconds is below the film's minimum particle lifetime. These are targeted diagnostic seeds, not the production random particle population.
- `instrumented-kernel.txt`: the integration loop with tracing/reset-reason instrumentation. Frozen field, config and renderer hashes are recorded in the parent `source-integrity.json`.

Counts are not discharge fractions, confidence scores, or observed parcel travel. Motion uses the disclosed display scaling. Image RGB differences alone cannot prove travel: stationary round-cap dots in the previous renderer could flicker when reseeded. Numerical-model uncertainty, particularly the inferred shallow southern bed and unresolved wind/inertia, remains in the model companion.
