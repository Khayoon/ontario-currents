# Carleton–Wolfe presentation checks

These checks separate source geometry, numerical coverage, actual particle travel and the final encoded picture. They are not current observations or validation of the hydraulic approximation.

- `geometry-native-report.json` and `interface-trace-result.json` diagnose the **preceding** 1 km / NOAA-priority film, not the current result. The interface kernel records the same bounded midpoint integration with diagnostic termination at its first invalid edge. Its targeted counts are not discharge fractions.
- `geometry-expanded-source-audit.json` and `geometry-expanded-final-audit.json` independently compare the expanded domain to raw source geometry and numerical bathymetry. Retrieved bed is unchanged; inferred bank bed is regenerated. Of the previously omitted 274-cell western patch, 193 become solved wet cells. Other shallow or unanchored cells are not assigned invented velocities.
- `candidate-raster-mouth-review.json` checks the **current** field's separate northern and southern Bayfield paths in the actual 0.25-pixel renderer raster, with all checked edges inside source water.
- `candidate-trace-result.json` follows the actual production midpoint/step-cap kernel in eight targeted regions, retaining nonzero displacement, provider changes, edge terminations and continuous entries through the southern bay mouth. These are diagnostic seeds, not the film's random population or observed parcels.
- `candidate-package-review.json` audits the independently reproducible numerical package and its exact manifest.
- `candidate-encoded-report.json` reviews decoded frames over the wider upstream approach and both Carleton passages. A background-only image from the exact scene separates trail ink from the brighter static water. Read its remaining edge cells and thresholds rather than interpreting RGB brightness alone as current motion.
- `candidate-seam-review.json` independently compares the encoded loop wrap to adjacent ordinary frame changes. The criterion is unchanged from the preceding edition.

Source hashes in each report and the parent `source-integrity.json` identify the actual inputs. Motion is enhanced for legibility and has no uniform physical time scale; colours retain source vector magnitudes. The outer NOAA surface / regional depth-average handoff is not a physically matched boundary.
