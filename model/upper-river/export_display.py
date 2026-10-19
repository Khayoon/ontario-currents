"""Reproject solved UTM velocity vectors to a true east/north display grid."""
import argparse,json,hashlib
from pathlib import Path
import numpy as np
from scipy.ndimage import map_coordinates
from pyproj import Transformer

p=argparse.ArgumentParser();p.add_argument('solution');p.add_argument('--out',default='work/upper-river-model/estimated-river-field.json')
p.add_argument('--method',default='Simplified unvalidated nonlinear Manning diffusion-wave estimate, omitting momentum inertia and inertial eddies');args=p.parse_args()
a=np.load(args.solution); wet=a['wet']; x=a['x'];y=a['y']; xx,yy=np.meshgrid(x,y)
to_ll=Transformer.from_crs(32618,4326,always_xy=True); to_xy=Transformer.from_crs(4326,32618,always_xy=True)
llon,llat=to_ll.transform(xx[wet],yy[wet]);west=float(llon.min());east=float(llon.max());south=float(llat.min());north=float(llat.max())
dx=.00075;dy=.00055;width=int(np.ceil((east-west)/dx))+1;height=int(np.ceil((north-south)/dy))+1
lon,lat=np.meshgrid(west+np.arange(width)*dx,south+np.arange(height)*dy)
tx,ty=to_xy.transform(lon,lat); coords=np.array([(ty-y[0])/(y[1]-y[0]),(tx-x[0])/(x[1]-x[0])])
valid=map_coordinates(wet.astype(float),coords,order=0,mode='constant',cval=0)>.5
# Nearest native cell never interpolates across a land mask or bathymetry gap.
u=map_coordinates(np.nan_to_num(a['u']),coords,order=0,mode='constant',cval=0)
v=map_coordinates(np.nan_to_num(a['v']),coords,order=0,mode='constant',cval=0)
# Differentiate inverse projection by 1m to obtain geographic unit bases.
lon0,lat0=to_ll.transform(tx,ty); lone,late=to_ll.transform(tx+1,ty); lonn,latn=to_ll.transform(tx,ty+1)
e_e=(lone-lon0)*np.cos(np.deg2rad(lat0));e_n=late-lat0
n_e=(lonn-lon0)*np.cos(np.deg2rad(lat0));n_n=latn-lat0
e_scale=np.hypot(e_e,e_n);n_scale=np.hypot(n_e,n_n)
ue=u*e_e/e_scale+v*n_e/n_scale;vn=u*e_n/e_scale+v*n_n/n_scale
def nullable(vals): return [round(float(z),5) if good else None for z,good in zip(vals.ravel(),valid.ravel())]
field=dict(width=width,height=height,west=west,south=south,dx=dx,dy=dy,u=nullable(ue),v=nullable(vn),t=None,
           kind='river',mode='estimate',fallbackOnly=True,experimental=True,velocityLayer='depth-averaged',
           label='Kingston–Brockville current estimates',periodStart='2026-10-12T00:00:00Z',periodEnd='2026-10-17T12:00:00Z',
           method=args.method+'. A steady scenario forced with target-period mean endpoint stages and regulation-discharge target; not a temporal mean of hourly current fields. Not validated against local current meters; no wind, density stratification or vertical surface shear.',
           sourceSolution=Path(args.solution).name,sourceSolutionSHA256=hashlib.sha256(Path(args.solution).read_bytes()).hexdigest(),
           projection='True geographic east/north m/s, rotated from EPSG:32618 grid axes',
           coverage='Null outside solved wet cells; retrieved NONNA depths plus separately estimated bankbed. Existing NOAA field has priority.',
           validCells=int(valid.sum()))
Path(args.out).write_text(json.dumps(field,separators=(',',':')),encoding='utf-8')
print(json.dumps({k:field[k] for k in ['width','height','validCells','west','south','dx','dy','method']},indent=2))
