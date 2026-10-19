# Temperature edition: QA scope

- `temperature-statistics-review.json` independently checks the 28-sample native temperature coverage and spherical wet-area distribution. Its recommendation records a wider candidate; the actual selected 12 to 16.5 C caps are explicit in `palette-selection.json` and config.
- `temperature-preview-review.json`, when present, reviews the chosen preview, not the complete encoded movie.
- `thermal-validation/` contains actual native-Canvas fixture checks for temperature mapping, neutral missing-temperature treatment, node temperature independent of current-vector validity/provider, unchanged U/V/provider raster data, and invalid range rejection. Synthetic fixture values are not lake observations.
- `before-temperature/` contains only previous-movie QA, clearly archived. Its 23-sample inputs and encoded-film results do not describe the new movie.
- `final-temperature-film-review.json` records the actual final-film visual review, scale/caption review and source identity; passed, with no pending visual assessment.
- `FINAL-QA.json` links exact hashes of the accepted `final-seam-review.json`, `final-carleton-review.json` and `thermal-river-review.json`. These independently review the loop wrap, upstream/island-channel appearance and neutral river-only temperature treatment on the final encoded movie; all passed, with no pending visual assessment.
- `ontario-temperature-motion-check.json` retains the general frame-change diagnostic; frame differences alone do not prove physically correct particle trajectories.
- `media-verification.json` confirms the final movie is 61,016,615 bytes, 600 frames, 20 seconds, 30 fps, 2560 x 1440 H.264/yuv420p, with one video stream and no audio. The original local filename is normalized; its exact video hash is retained.

Source data completeness, interpolation properties, actual trail travel and final encoded appearance are separate checks. This package makes no measured-current validation claim.

Accepted final-video SHA-256: `1d85eb18651c7756755c9d26e9fdc93d625460869198d521adcb778890ae73aa`. Prior-movie reviews remain archived and do not certify this movie.
