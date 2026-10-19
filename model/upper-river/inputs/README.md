# Current compact numerical inputs

`bathymetry-grid-50m.npz` is the selected expanded input. Its nine arrays are x, y, wet_geometry, proposed_active_corridor, bed_igld85_estimated, mean_stage_igld85_estimated, measured_bathy, bathy_source_product and source_subsample_count. Only the proposed computational-cut mask changes from the earlier frozen input; retrieved bathymetry, original water geometry and source flags are unchanged. Exact per-array checks are in array-integrity-manifest.json.

Rows increase south to north; x/y are 50 m UTM18N cell centres. Bed NaNs remain missing source data. The runner recomputes the 1,000 m inlet padding and then separately estimates missing bank depths. Its open-boundary interpolation uses adjoining retrieved bed where available or a zero-gradient condition; only actual land gets the shallow-bank constraint.

The 100 m input and its audit remain the original-domain sensitivity input, not a newly padded-grid result. Earlier source-preparation audit files are historical evidence; current chosen counts and boundary checks are in ../model-report.json. Water-level CSV and datum metadata are unchanged. NONNA source requests, source hashes, mixed-datum qualifications and OSM water-source records are retained here.
