import json, math, urllib.parse, urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent
POINTS = {'kingston': (-76.49, 44.207), 'gananoque': (-76.15, 44.31), 'alexandria-bay': (-75.925, 44.34), 'brockville': (-75.681, 44.582)}

def probe(item):
    name, (lon, lat) = item
    x=6378137 * math.radians(lon)
    y=6378137 * math.log(math.tan(math.pi/4+math.radians(lat)/2))
    bbox=','.join(str(z) for z in [x-1500,y-1500,x+1500,y+1500])
    query={'service':'WCS', 'version':'1.0.0', 'request':'GetCoverage', 'coverage':'nonna:NONNA 10 Coverage', 'crs':'EPSG:3857', 'response_crs':'EPSG:3857', 'bbox':bbox, 'width':300,'height':300,'format':'GeoTIFF', 'interpolation':'nearest neighbor'}
    url='https://nonna-geoserver.data.chs-shc.ca/geoserver/wcs?'+urllib.parse.urlencode(query)
    with urllib.request.urlopen(url, timeout=60) as response:
        raw=response.read()
    path=ROOT / (name+'-nonna10.tif')
    path.write_bytes(raw)
    image=Image.open(path)
    array=np.array(image)
    finite=array[np.isfinite(array) & (array > -1000) & (array < 1000)]
    result={'name':name,'url':url,'bytes':len(raw),'size':image.size,'mode':image.mode,'dtype':str(array.dtype),'nodata_tag':image.tag_v2.get(42113),'min':float(array.min()),'max':float(array.max()),'reasonable_count':int(finite.size),'reasonable_min':float(finite.min()) if finite.size else None,'reasonable_max':float(finite.max()) if finite.size else None,'sample_values':finite[::max(1,len(finite)//5)].tolist()}
    return result

with ThreadPoolExecutor(max_workers=4) as pool:
    results=list(pool.map(probe,POINTS.items()))
ROOT.joinpath('bathymetry-probes.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
