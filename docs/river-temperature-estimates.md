# Kingston–Brockville passive-temperature estimates

19 October 2026. **Transport diagnostics, source/integration checks and final encoded visual review pass.** Numerical consistency does not validate real river temperatures.

The film uses the same temperature palette across Lake Ontario and the original Kingston–Brockville model domain. Every finite NOAA model temperature remains preferred. Where NOAA supplies no temperature under the selected river vectors, a separately labelled passive-temperature estimate supplements the colour. Speed never becomes temperature. Neither this scalar nor its colours change the underlying currents, wet mask, islands or lake fields.

This is an estimate of advected temperature in an existing simplified flow field. It is **not measured river temperature, a validated thermal forecast or a coupled lake–river surface-temperature model**.

## Carrier flow and physical volumes

The calculation uses the [frozen hydraulic estimate](kingston-brockville-estimates.md): **177,775 wet 50 m cells**, **344,179 internal face discharges** and each cell's actual model depth × **2,500 m²** as water volume. The total selected volume is approximately **4.3960 km³**. Its steady discharge scenario is approximately **7,377.58 m³/s**, with hydraulic forcing from **12 October 00:00 to 17 October 12:00 UTC**.

Temperature transport uses those physical signed discharges and volumes. It never uses the film's enhanced river-particle motion. The river flow stays steady while its boundary temperature changes hourly; there is no new hourly hydrodynamic solve.

## Boundary temperatures and initialization

The boundary comes from the unchanged **169 hourly NOAA LOOFS surface-temperature fields**, from **12 October 00:00 through 19 October 00:00 UTC**. The final state closes interpolation through the requested 12–18 October week. Temperatures use the original native triangle's three node values and barycentric weights, independently of its face velocity.

Of **110 positive-inflow cells**, **109** have direct native NOAA wet-triangle support, covering **99.9555527%** of inlet discharge. The remaining nearshore cell, at approximately **−76.47666488, 44.18359685**, carries **3.27913418 m³/s**, or **0.0444473%** of inflow. It receives the contemporaneous discharge-weighted mean of directly supported inlet temperatures. This explicit boundary approximation does not sample a nearest temperature across land. Independent brute-force triangle containment and scalar interpolation reproduced the prepared boundary series exactly.

Every cell initially receives **15.04994844°C**, the first-hour discharge-weighted inlet temperature. This **uniform initial condition is assumed**, not observed or recovered from a prehistory spin-up. Hourly discharge-weighted inlet means range from approximately **13.3560 to 15.8102°C**; individual supported inlet temperatures range from **12.0529 to 16.9030°C**.

A second tracer starts at one throughout the river and enters at zero, recording the fraction of assumed initial water remaining. For this linear transport, changing uniform initial temperature by ΔT changes a later cell temperature by ΔT times that remaining fraction. This quantifies initialization sensitivity; it does not bound omitted atmospheric or other real thermal effects.

Slow bays and **1,403 cells with exactly zero stored internal throughflow** can retain the initial temperature. The selected volume divided by discharge is about **6.90 days**, a bulk flushing scale rather than a measured local channel travel time. Colour in a slow cell therefore does not prove that current-week inlet water reached it.

## Numerical transport and checks

The method is implicit first-order donor-cell finite-volume transport, with hourly boundary temperatures interpolated numerically at each step. It introduces numerical mixing; that mixing is not a calibrated physical diffusivity. The selected **150 s** run was compared with **300 s**. Their maximum difference across all exported hours and river cells is **0.04533°C**, with a mean absolute difference of **0.00118°C**. No temperature clipping is used.

The fixed hydraulic solution has a small local continuity residual. With `r = internal_out + external_out − internal_in − external_in`, the tracer budget includes a separately accounted `r × T_new` compensation, evaluated implicitly, while leaving the hydraulic discharges unchanged. This numerical treatment preserves a spatially uniform tracer and temperature-offset invariance; it is not an assumed physical heating term. The inventory ledger reports external temperature-volume flux, compensation and residual error separately.

The completed 300 s uniform test retained **16°C** to approximately **7.2 × 10⁻¹²°C**; its Celsius/Kelvin offset discrepancy was approximately **2.3 × 10⁻¹⁰°C**. The selected display temperatures span **12.0601–16.7746°C**, with no source-range maximum-principle excess. The cumulative temperature-volume budget residual is about **6.95 × 10⁻⁶°C·m³**, against an inventory of order 10¹⁰°C·m³. At the closing endpoint, **15.8203%** of native water volume retains the assumed initial state; the display-cell mean initial fraction is **27.4805%**, and **22.5305%** of display cells retain more than half. These quantify the model’s initialization dependence, not observed temperature error. Passing numerical checks cannot establish physical temperature accuracy.

## What the estimate omits

Atmospheric and solar heat exchange, evaporation, bed heat exchange, tributary heat inputs, thermal stratification, changing hydraulic flow and resolved inertial eddies are omitted. The input is a NOAA surface-layer temperature, but the carrier is a simplified depth-averaged hydraulic field. No physical surface/depth-average handoff is claimed.

Control-volume advective transport is documented in the [USACE HEC-RAS Water Quality Technical Reference](https://www.hec.usace.army.mil/software/hec-ras/documentation/HEC-RAS%20Water%20Quality%20Technical%20Reference-v6.4.1.pdf). A full thermal calculation also needs separate heat-source/sink physics and meteorological forcing, as described in the [USACE water-quality technical background](https://www.hec.usace.army.mil/confluence/ResSimDocs/rswqum/appendix-a-technical-background-for-water-quality-modules). These are references for interpretation; this project does not implement or claim validation from HEC-RAS.

## Frozen source binding and display priority

The frozen output has **169 × 121,644** Float32 temperature values at every original valid river display cell. An **865 × 1,144** Int32 map connects original regular-grid cells to compact wet indices, with −1 outside. The unchanged river display field SHA-256 is `653d31ac284a724bd83d000064f19d375d5e6a8dd14a320fb48a4f0eef3904bb`; the unchanged hourly lake manifest is `66ff440910a4cb9822c12d59271f70f1ad2d4a6bfc393c9f914230afcb9b7e4e`.

The loader binds binary hashes, dimensions, regular-grid geometry and the exact UTC axis to those sources. In the renderer, estimated temperature supplements only missing temperature under the first river provider. Finite NOAA model temperature, including zero, always wins. Adjacent scalar hours are interpolated before applying the fixed **12–16.5°C** palette; there is no last-to-first temporal extrapolation. Genuine missing data remain neutral. All existing current vectors and provider choices are retained.

Portable inputs belong under [`film/ontario-closeup/inputs/river-temperature/`](../film/ontario-closeup/inputs/river-temperature/), with audits under [`qa/river-temperature/`](../film/ontario-closeup/qa/river-temperature/). All **20,557,836** temperature entries are finite. River-temperature manifest SHA-256: `260c470549ae83670b686c82b787de048040a18b968d390ad66ee5bc9a04cf73`; temperature binary SHA-256: `b3af9090431602573b2eaf6496e5754915aefd58fb0eefeced3e50bd23a2d98e`. Full-week numerical checks and final coloured-movie acceptance pass. The previous neutral-river hourly movie's hash and encoded passes do not certify this edition.

Accepted coloured movie: **103,544,787 bytes**, **25 seconds / 750 frames / 2560 × 1440 / 30 fps**, silent H.264. SHA-256 `5c57c348290d527c350ecba138517da96803dce5254ba2926282e4bc5a932458`. [Actual encoded visual review](../film/ontario-closeup/qa/river-temperature/final-encoded-review.json) and [encoding, clock and unchanged-lake checks](../film/ontario-closeup/qa/river-temperature/encoded-check.json) pass. These checks verify the displayed artifact, not real-world river temperature accuracy.
