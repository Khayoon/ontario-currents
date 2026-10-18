# Experimental Lake Simcoe wind response

Lake Simcoe is shown with a separately computed **experimental, unvalidated depth-averaged wind response**. This is a numerical experiment using public depth and weather data. It is not an observed current field, a government current product, or a reconstruction of the lake's complete surface circulation.

The displayed field averages the eastward and northward model velocities over **12 October 2026 00:00 UTC to 17 October 2026 12:00 UTC**. The experiment retains its own fixed dates when the website switches between Live and 24-hour mean. It is not updated by the hourly government-data refresh and is not an October climatology.

## Inputs

- **Bathymetry:** [Ontario's Bathymetry Line service](https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open01/MapServer/30), identified through the Lake Simcoe survey index, lake ID `17-6327-49193`, survey year 1957. The [official data description](https://www.publicdocs.mnr.gov.on.ca/mirb/Bathymetry,%20Line%20-%20Data%20Description.pdf) defines depth in metres below the water surface. Negative contour values are converted to positive model depths. These are historical contours with an incompletely specified survey water reference, not a modern bathymetric survey.
- **Shoreline and islands:** the atlas's OpenStreetMap-derived water polygon, retaining island holes. The 500 m grid represents 718.25 km² of water, with maximum depth 41 m. Depths are interpolated from contour and zero-depth shoreline points; a 1 m minimum wet-cell depth regularizes shallow coastal cells. There is no extrapolation of current vectors from Lake Ontario.
- **Wind:** [ECCC National Climate Archive hourly observations for Barrie-Oro, station 6117700](https://api.weather.gc.ca/collections/climate-hourly/items?f=json&limit=1000&CLIMATE_IDENTIFIER=6117700&LOCAL_YEAR=2026&LOCAL_MONTH=10). The retrieved record contains 408 consecutive hourly samples from 1 October 05:00 UTC through 18 October 04:00 UTC, with no missing wind values. [ECCC's glossary](https://climate.weather.gc.ca/glossary_e.html) specifies km/h and meteorological direction from, in tens of degrees true. These are observation samples with short averaging periods, rather than hourly-mean winds. They are linearly interpolated in time and applied uniformly over the lake without an over-water adjustment. A nominal 10 m wind height is assumed; a station-specific anemometer-height record was not verified.

## Calculation

The reproducible solver uses a staggered Arakawa C grid for the linearized rotating shallow-water equations with variable resting depth:

```text
eta_t = -div(H * velocity)
u_t   =  f*v - g*eta_x + tau_x/(rho*H) - Cd*|velocity|*u/H
v_t   = -f*u - g*eta_y + tau_y/(rho*H) - Cd*|velocity|*v/H
tau   = rho_air * C_air * |wind| * wind
```

Pressure and transport divergence are a discrete adjoint pair. The depth-weighted Coriolis coupling is skew symmetric. The time integrator is third-order SSP Runge–Kutta. Air density is 1.225 kg/m³, water density 1000 kg/m³, the air-water drag coefficient is 0.0013, and the baseline bottom-drag coefficient is 0.0025. Constants, timestep, forcing history and sensitivity runs are retained with the experiment.

The model has closed, no-normal-flow boundaries at land, islands and Atherley Narrows. It excludes tributary inflow and outlet exchange, advective acceleration, stratification, internal waves, vertical shear and heat exchange. Consequently, its depth average cannot be interpreted as the missing surface-current field, especially in deep Kempenfelt Bay or unresolved channels.

Eastward and northward components are averaged by a trapezoidal time integral at the solver timestep, rather than by averaging speed or direction. Cell-centred vectors are then exported for the same shoreline-clipped particle renderer used by the atlas. Colours show the magnitude of this mean vector. The Canadian and NOAA film fields use their separately documented 23-sample means.

The Simcoe-focused website view and film close-up use an explicitly labelled linear **0–5 cm/s** colour scale to make this weaker response legible. Mixed website views retain the normal 0–60+ cm/s range; the film overview retains its logarithmic 0–150+ cm/s range. Changing a colour scale does not change velocities, cursor values or the model calculation.

## Checks and interpretation

The numerical checks cover exact rest, closed boundaries, water-volume conservation, the pressure/Coriolis energy budget, drag dissipation, wind-driven water-level setup, Northern Hemisphere deflection and timestep sensitivity. Parameter and forcing-history comparisons accompany the output. These checks assess the calculation; they do **not** establish agreement with measured Lake Simcoe currents. No current measurements were used to calibrate this experiment.

The preferred run uses **259 hours** of wind-forced history before the mean window. Its mean-vector maximum is **3.80 cm/s** and median **0.735 cm/s**. A 48-hour history changes the vector field by 47.5% in relative L2 norm; changing bottom drag gives 22.9–31.9%, and the 600 m comparison gives 29.3% over the common interior. These are material assumption and resolution sensitivities, not error bars or evidence of spatial convergence. Halving the timestep changes the mean by about 1.6×10⁻¹⁰ m/s RMS. The strongest water-level displacement is 6.1% of local resting depth, and total depth remains positive. The result is numerically resolved in time while its physical accuracy remains unestablished.

The model code, frozen depth grid, wind inputs and diagnostics are retained in [`model/simcoe/`](../model/simcoe/). The public field identifies its source type and unvalidated status. The website and film display that distinction in frame.

## Attribution and existing models

Bathymetric information is used under the [Open Government Licence–Ontario](https://www.ontario.ca/page/open-government-licence-ontario). Weather information is used under the [Open Government Licence–Canada](https://open.canada.ca/en/open-government-licence-canada). Shoreline geography is **© OpenStreetMap contributors · OpenFreeMap · © OpenMapTiles**, under [ODbL](https://www.openstreetmap.org/copyright).

Independent existing Lake Simcoe hydrodynamic models are described in the [WSP Georgina Island coastal report](https://cdn.prod.website-files.com/64e5071b798e46ba8cbf81d3/674f66d12ef54c35a2d70f06_Coastal_Eng_Report_Final_20241125.pdf) and earlier research. Their native current outputs were not retrieved through the public downloads inspected. This experiment does not reuse or inherit those models' calibration. The [research specification](current-data-research.txt) records the direct-data recovery routes.
