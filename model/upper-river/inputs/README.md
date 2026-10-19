# Unchanged source inputs, corrected hydraulic wet activation

These input arrays are byte-identical to the previous 1 km inlet-extension model package. Numerical bathymetry, source-water geometry, proposed computational cut, source flags and endpoint observations have not changed. The correction occurs in `solve_local_wetness.py`: it no longer assumes Brockville's lowest stage everywhere upstream.

The `proposed_active_corridor` mask describes the geometric domain, not a physical wet/dry decision. The active-set solver determines hydraulic wet cells using locally solved water levels. Its 0.12 m wet margin and 0.13 m connected rewet trigger are disclosed numerical shoreline criteria, not bathymetric accuracy claims. Raw NaNs remain missing bed; bank estimation is separate.

The 100 m input and historical source-preparation notes refer to earlier sensitivity configurations. Current selected checks and scope are in `../model-report.json`. Per-array hashes and identity checks are in `array-integrity-manifest.json`. Historical source manifests retain original cache paths for provenance; no current reproduction command depends on them.
