# Source inputs for the 3 km upstream cut

The selected 50 m NPZ retains the previous raw depth values, NaNs, original water geometry, datum-stage arrays, product flags and coordinates. Only `proposed_active_corridor` changes: it is reproducibly cut 3,000 m upstream of the original line. The mask describes the geometric computational domain; the hydraulic solver subsequently determines wet cells from local levels.

Run `prepare_source_domain.py` from the package root to verify or regenerate the cut. `array-integrity-manifest.json` records all array hashes and the intentionally changed mask. Missing source bed remains NaN in this input; `estimate_bank_bed_open.py` separately infers bank bed for the chosen corridor.

The retained 100 m dataset belongs to historical sensitivity work, not a current 3 km convergence comparison. Historical download/preparation manifests retain source URLs and original cache paths for provenance only.
