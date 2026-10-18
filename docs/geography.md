# Water geography and provenance

The included [water geography](../src/geography.json) is one unioned MultiPolygon covering Lake Ontario, Lake Simcoe, the Thousand Islands and St. Lawrence, Montréal’s surrounding channels, the estuary and Saguenay. Montréal Island, Laval and source river islands remain land holes. Geography defines the water outline only; it supplies no velocities or inferred currents.

## Sources and license

**© OpenStreetMap contributors · OpenFreeMap · © OpenMapTiles**

The water database is derived from [OpenStreetMap](https://www.openstreetmap.org/copyright) under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

- Selected original OSM relation geometry was retrieved on **17 October 2026** through the [Overpass API](https://overpass-api.de/api/interpreter).
- Other outlines come from [OpenFreeMap](https://openfreemap.org/) tiles using the [OpenMapTiles](https://openmaptiles.org/) schema: dataset **`20261011_080001_pt`**, dated **11 October 2026**. [TileJSON](https://tiles.openfreemap.org/planet/20261011_080001_pt) identifies this fixed source version.

## Principal original OSM relations

- Lake Simcoe: [9984807](https://www.openstreetmap.org/relation/9984807).
- Lac des Deux-Montagnes: 331499; Lac Saint-Louis: 1808142.
- Rivière des Prairies: 1747225, 1764952, 1769788.
- Rivière des Mille Îles: 1744838, 1746332.
- Saint-Laurent/Lachine water: 1769291, 1775822, 16740072, 16740073, 6448219.
- Upper St. Lawrence water polygons: 14029453, 14031801, 14035280, 14036016, 14037369, 14039201, 14040790, 14040791, 14040792, 14042253, 14045832, 14048280, 14062946.

## Processing and extent

Relation member ways were joined at matching source endpoints; inner island rings were retained. Tile polygons were clipped to their own tile rectangles, transformed to longitude/latitude and unioned. Original relation geometry replaces the corresponding tile feature where available. The final union removes overlaps; no channel was drawn or buffered into existence.

The background coast extends northeast using **156 zoom-10 source tiles**, fetched over **69.6°W–65.5°W, 48.15°N–50.9°N**, so the estuary continues beyond the artwork edge. The full geometry’s bounding box is approximately **79.92528°W–65.390625°W, 43.174763°N–50.914128°N**.

Precision varies between original OSM vertices and generalized vector tiles. The union retained the previous water mask within a numerical tolerance of **10⁻¹⁰ square degrees**; measured lost area was only **3.02 × 10⁻¹⁴ square degrees**, from floating-point geometry operations. Montréal/Laval land checks and polygon validity checks pass. This extension changes background geography only, without altering model coverage or current values.
