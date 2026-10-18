# Lake Simcoe drainage overlay

`drainage.geojson` is a separate, static geography overlay for the website and film. It contains no velocities and must never be used as a water mask or as input to current advection.

## Sources

- [LSRCA LSPP Scientific Watershed](https://gis.lsrca.on.ca/gis/rest/services/OpenData/MapServer/20): official Lake Simcoe watershed polygon, described by the authority as derived from its 2002 DTM. It is a scientific catchment, not a hand-drawn moraine outline.
- [LSRCA Watercourse LSPP](https://gis.lsrca.on.ca/gis/rest/services/OpenData/MapServer/8): natural and artificial watercourses within the Lake Simcoe Protection Plan watershed. The source attributes include watercourse names and stream order. This overlay queries all 4,050 source segments with `STREAMORDER >= 3`, then groups them by source name. The resulting network includes East Holland, Holland River, North/South Schomberg, Black, Beaver, Pefferlaw, Uxbridge Brook, Talbot, Maskinonge, Lovers, Hawkestone and other tributary systems. Lower order headwaters are omitted for readability.
- [Ontario Great Lakes Watershed Boundary v2.0](https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/MOE/GreatLakes_WS_Bnd/MapServer/1): official Lake Huron and Lake Ontario basin polygons. The divide is **their exact shared boundary before cartographic simplification**, clipped to the Toronto–Lake Simcoe context `[-80.25,43.72,-78.55,44.45]`. The full resolution polygons share one continuous line in this window and have zero overlap. We did not substitute the moraine conservation-plan/legal boundary for a drainage divide.
- [LSRCA Our Watershed](https://lsrca.on.ca/index.php/home/our-watershed/): documents the Oak Ridges Moraine as the southern surface-water divide and the outlet route from Lake Simcoe to Lake Couchiching and Georgian Bay (Lake Huron).
- [Ontario Oak Ridges Moraine Conservation Plan](https://www.ontario.ca/page/oak-ridges-moraine-conservation-plan): explains that north-side drainage across the broader moraine can go to Georgian Bay, Lake Simcoe **or the Trent system**. Do not label all land north of the entire moraine as Lake Huron drainage: the eastern Trent/Rice Lake catchments ultimately drain to Lake Ontario.

## Renderer schema

One EPSG:4326 GeoJSON FeatureCollection, with `properties.role`:

- `watershed`: the scientific Lake Simcoe catchment polygon, for a muted outline/fill.
- `divide`: the actual Lake Huron / Lake Ontario basin boundary, for a dashed line. Local shorthand label: "Oak Ridges watershed divide". `northSide`/`southSide` descriptions apply only to its local east-west reach, not every part of the moraine or every bend in the line.
- `tributary`: merged official source linework; `streamOrder` is the maximum in that named group, `major` is true for groups reaching order four. `labelPoint` is provided for selected river names, on the longest connected component. Other network lines can be drawn without labels.

`labelPoint` coordinates are metadata, not synthetic river geometry. The `watershed` label point is placed on catchment land. There is no invented route line connecting Simcoe to Georgian Bay; the outlet route is textual source information only.

## Accuracy and flow

The scientific catchment and provincial Great Lakes basin boundary come from different delineations and dates, so their outlines are not guaranteed to coincide at parcel scale. Both are cartographically generalized here: 50 metres for the watershed and divide, 30 metres for watercourses, in EPSG:26917 before conversion to longitude/latitude. Final coordinate rounding is six decimals. This is appropriate context at atlas scale and not cadastral, engineering or navigation mapping.

Watercourse vertex order is **not** asserted to run downstream. The dataset provides geographic lines and stream order, not current speed, discharge, or per-vertex flow direction. The overlay should remain static and visually distinct from the animated dated currents. Overall Lake Simcoe outlet routing is documented by LSRCA. We have not extrapolated quantitative currents into these channels.

## Preparation and checks

Locally retained preparation scripts fetched the exact source queries and paged the watercourse source by ObjectIDs, avoiding ArcGIS transfer-limit truncation. The unsimplified provincial basin polygons supplied the shared divide. Linework was merged by name and generalized in a projected coordinate system. All 84 output geometries were checked as valid; the source basin polygons had zero overlap. Raw source responses, scripts, dependency packages and detailed hash/count reports remain in the local research workspace. The public repository provides the derived GeoJSON with per-feature source URLs and the methods summarized here.

## Required attribution

Contains Information made available under Lake Simcoe Region Conservation Authority Open Data Licence v1.0.

[LSRCA licence](https://lsrca.on.ca/index.php/home/open-data/)

Contains information licensed under the Open Government Licence – Ontario.

[Open Government Licence – Ontario](https://www.ontario.ca/page/open-government-licence-ontario)

Sources retrieved 18 October 2026. Inclusion does not imply endorsement by either data provider.
