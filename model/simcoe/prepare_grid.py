"""Build a documented Lake Simcoe research grid from official depth contours.

This prepares bathymetry only, not measured or modelled current observations.
"""
from pathlib import Path
import argparse, datetime, hashlib, json, math
import numpy as np
import requests
from matplotlib.path import Path as PolygonPath
from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator

ROOT = Path(__file__).resolve().parent
SERVICE = 'https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open01/MapServer'
R = 6371008.8
LON0, LAT0 = -79.4, 44.45

def xy(points):
    p=np.asarray(points,float)
    return np.column_stack(((p[:,0]-LON0)*math.pi/180*R*math.cos(math.radians(LAT0)),(p[:,1]-LAT0)*math.pi/180*R))

def lonlat(points):
    p=np.asarray(points,float)
    return np.column_stack((p[:,0]/(math.pi/180*R*math.cos(math.radians(LAT0)))+LON0,p[:,1]/(math.pi/180*R)+LAT0))

def inside(points, rings):
    result=PolygonPath(rings[0]).contains_points(points)
    for hole in rings[1:]: result &= ~PolygonPath(hole).contains_points(points)
    return result

def sparse_vertices(points, step=150):
    out=[]; last=None
    for point in points:
        if last is None or np.linalg.norm(point-last)>=step:
            out.append(point);last=point
    if len(points)>1:out.append(points[-1])
    return np.asarray(out)

def main():
    public_geo=ROOT.parents[1]/'src/geography.json'
    default_geo=public_geo if public_geo.exists() else ROOT.parents[1]/'outputs/ontario-currents-pages/src/geography.json'
    ap=argparse.ArgumentParser();ap.add_argument('--spacing',type=float,default=500);ap.add_argument('--geography',default=str(default_geo));ap.add_argument('--output-prefix',default='grid');args=ap.parse_args()
    inputs=ROOT/'inputs';inputs.mkdir(parents=True,exist_ok=True)
    geography=Path(args.geography).resolve()
    geo=json.loads(geography.read_text(encoding='utf8'))
    polys=geo['features'][0]['geometry']['coordinates']
    candidates=[p for p in polys if PolygonPath(p[0]).contains_point((-79.37,44.43))]
    assert len(candidates)==1,'Must identify exactly one complete Simcoe water polygon.'
    rings_ll=candidates[0];rings=[xy(r) for r in rings_ll]
    (inputs/'shoreline.json').write_text(json.dumps({'type':'Polygon','coordinates':rings_ll}),encoding='utf8')
    s=requests.Session(); records=[];requests_used=[]
    ids_path=inputs/'contour-ids.json'
    if ids_path.exists(): ids_response=json.loads(ids_path.read_text())
    else:
        q={'f':'json','geometry':'-79.8,44.1,-79.0,44.85','geometryType':'esriGeometryEnvelope','inSR':'4326','spatialRel':'esriSpatialRelIntersects','returnIdsOnly':'true'}
        rr=s.get(SERVICE+'/30/query',params=q,timeout=60);rr.raise_for_status();ids_response=rr.json();ids_path.write_bytes(rr.content)
    ids_url=s.prepare_request(requests.Request('GET',SERVICE+'/30/query',params={'f':'json','geometry':'-79.8,44.1,-79.0,44.85','geometryType':'esriGeometryEnvelope','inSR':'4326','spatialRel':'esriSpatialRelIntersects','returnIdsOnly':'true'})).url
    requests_used.append(ids_url)
    ids=ids_response['objectIds']
    for start in range(0,len(ids),200):
        p=inputs/f'contours-{start:05d}.geojson'
        q={'f':'geojson','objectIds':','.join(map(str,ids[start:start+200])),'outFields':'*','outSR':'4326'}
        requests_used.append(s.prepare_request(requests.Request('GET',SERVICE+'/30/query',params=q)).url)
        if p.exists(): j=json.loads(p.read_text())
        else:
            rr=s.get(SERVICE+'/30/query',params=q,timeout=90);rr.raise_for_status();j=rr.json();p.write_bytes(rr.content)
        assert 'features' in j and not j.get('exceededTransferLimit'),p
        records.extend(j['features'])
    samples=[];depths=[];selected=[]
    for f in records:
        depth=f['properties'].get('DEPTH')
        if depth is None or depth>0:continue
        lines=f['geometry']['coordinates'];lines=[lines] if f['geometry']['type']=='LineString' else lines
        added=0
        for line in lines:
            pts=sparse_vertices(xy(line),150)
            valid=inside(pts,rings)
            # Zero-depth shoreline rings can lie a few metres outside the OSM outline.
            if depth==0:
                valid |= PolygonPath(rings[0]).contains_points(pts,radius=50)
            if valid.any():
                samples.extend(pts[valid]);depths.extend([-float(depth)]*int(valid.sum()));added+=int(valid.sum())
        if added:selected.append(f['properties'])
    # The shoreline and islands impose zero depth; interpolate only in actual water.
    for ring in rings:
        pts=sparse_vertices(ring,150);samples.extend(pts);depths.extend([0.0]*len(pts))
    pts=np.asarray(samples);depths=np.asarray(depths)
    # Merge coincident input points deterministically; avoid duplicate triangulation sites.
    rounded=np.round(pts,1);_,inverse=np.unique(rounded,axis=0,return_inverse=True)
    sums=np.bincount(inverse,weights=depths);counts=np.bincount(inverse)
    unique=np.unique(rounded,axis=0);values=sums/counts
    d=args.spacing;x0=math.floor(np.min(rings[0][:,0])/d)*d;y0=math.floor(np.min(rings[0][:,1])/d)*d
    nx=math.ceil((np.max(rings[0][:,0])-x0)/d);ny=math.ceil((np.max(rings[0][:,1])-y0)/d)
    x=x0+(np.arange(nx)+.5)*d;y=y0+(np.arange(ny)+.5)*d
    X,Y=np.meshgrid(x,y);sites=np.column_stack((X.ravel(),Y.ravel()));wet=inside(sites,rings).reshape(ny,nx)
    H=LinearNDInterpolator(unique,values)(sites).reshape(ny,nx)
    fallback=wet & ~np.isfinite(H)
    if fallback.any():H[fallback]=NearestNDInterpolator(unique,values)(sites.reshape(ny,nx,2)[fallback])
    H=np.where(wet,np.clip(H,1.0,45.0),0.0)
    ll=lonlat(sites).reshape(ny,nx,2)
    np.savez_compressed(ROOT/(args.output_prefix+'.npz'),H=H,wet=wet,x=x,y=y,lon=ll[:,:,0],lat=ll[:,:,1],dx=d,dy=d)
    manifest={
      'created':datetime.datetime.now(datetime.timezone.utc).isoformat(),
      'purpose':'Bathymetric grid for an experimental unvalidated depth-averaged wind-response calculation; not current measurements.',
      'spacingMetres':d,'shape':[ny,nx],'wetCells':int(wet.sum()),'areaKm2':float(wet.sum()*d*d/1e6),'volumeKm3':float(H.sum()*d*d/1e9),'meanDepthMetres':float(H[wet].mean()),'maxDepthMetres':float(H.max()),
      'projection':{'name':'local spherical equirectangular','lon0':LON0,'lat0':LAT0,'radiusMetres':R,'maxLocalScaleErrorNote':'Longitude metric uses cos44.45N throughout this approximately 50km domain.'},
      'contours':{'service':SERVICE+'/30','indexService':SERVICE+'/31','indexWhere':"PROJECT_NAME='Lake Simcoe'",'lakeId':'17-6327-49193','indexSurveyYear':1957,'downloadedFeatures':len(records),'selectedFeatures':len(selected),'interpolationPoints':len(unique),'licence':'Open Government Licence - Ontario','sourceHorizontalCRS':'NAD83 EPSG4269; requested WGS84 EPSG4326','depth':'DEPTH negative metres below source survey water reference, negated to positive H; exact survey vertical reference is not specified in individual contour fields. This model uses depth, not an absolute lake elevation.','accuracy':'Source LOCATION_ACCURACY varies; inspect cached records. Historic hand-digitized contours include Within 10 metres.','requests':requests_used},
      'shoreline':{'source':'OpenStreetMap contributors / OpenFreeMap / OpenMapTiles, inherited from existing map geography','licence':'ODbL1.0','polygonRings':len(rings),'inputSHA256':hashlib.sha256(geography.read_bytes()).hexdigest(),'processing':'Cell centres in the true Simcoe polygon only; island holes retained. Faces between wet and dry cells are closed. Atherley Narrows connection is closed at the polygon/grid boundary.'},
      'interpolation':{'method':'Linear Delaunay interpolation of contour vertices thinned to150m plus zero-depth shoreline and island vertices; nearest fallback only for wet sites outside triangulation.','minimumWetDepthMetres':1.0,'maximumDepthCapMetres':45.0,'nearestFallbackCells':int(fallback.sum()),'noFlowBoundary':'All wet/dry faces; tributaries and Atherley exchange excluded.'},
      'limitations':['Historic contours, with some later nearshore features, are not a modern full-bottom survey.',f'{d:g}m cells cannot resolve narrow channels or all small islands.','Coastal minimum depth1m regularizes interpolated very shallow cells.','Unconstrained Delaunay bathymetry interpolation can bridge bays/peninsulas; impermeable velocity mask is imposed separately.','No velocity calibration or validation is supplied by bathymetry.']}
    (ROOT/(args.output_prefix+'-manifest.json')).write_text(json.dumps(manifest,indent=2),encoding='utf8')
    print(json.dumps({k:manifest[k] for k in ['shape','wetCells','areaKm2','volumeKm3','meanDepthMetres','maxDepthMetres']},indent=2))

if __name__=='__main__':main()
