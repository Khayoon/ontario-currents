"""Explicitly estimated bank bathymetry, kept separate from survey inputs.

Harmonic interpolation uses neighbouring NONNA bed as Dirichlet constraints;
unknown wet cells adjacent to the mapped shore receive a shallow-water boundary
constraint at mean stage minus 0.2 m. These cells are NOT measured soundings.
"""
import argparse,json
from pathlib import Path
import numpy as np
from scipy import sparse,ndimage
from scipy.sparse.linalg import spsolve

p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('--method',choices=['harmonic','nearest'],default='harmonic')
p.add_argument('--out',required=True);args=p.parse_args()
a=np.load(args.input); out={key:a[key] for key in a.files}
wet=a['proposed_active_corridor'].astype(bool)
bed=a['bed_igld85_estimated'].copy(); measured=wet&np.isfinite(bed)
missing=wet&~measured; ids=np.full(wet.shape,-1,dtype=int); ids[missing]=np.arange(missing.sum())
if args.method=='harmonic':
    # Each missing cell has four face-neighbours. Shore constraints are inferred
    # solely in missing-data cells; actual measured depths are never tapered.
    H,W=wet.shape; jj,ii=np.where(missing); rows=[];cols=[];vals=[]
    rhs=np.zeros(missing.sum()); diag=np.zeros(missing.sum())
    shore=a['mean_stage_igld85_estimated']-.2
    for dj,di in [(0,1),(0,-1),(1,0),(-1,0)]:
        nj=np.clip(jj+dj,0,H-1);ni=np.clip(ii+di,0,W-1)
        unknown=missing[nj,ni]; fixedwet=measured[nj,ni]; land=~wet[nj,ni]
        idx=ids[jj,ii];diag+=1
        rows.extend(idx[unknown]);cols.extend(ids[nj[unknown],ni[unknown]]);vals.extend(-np.ones(unknown.sum()))
        rhs[fixedwet]+=bed[nj[fixedwet],ni[fixedwet]]
        rhs[land]+=shore[jj[land],ii[land]]
    rows.extend(np.arange(len(rhs)));cols.extend(np.arange(len(rhs)));vals.extend(diag)
    A=sparse.coo_matrix((vals,(rows,cols)),shape=(len(rhs),len(rhs))).tocsr()
    bed[missing]=spsolve(A,rhs)
else:
    _,inds=ndimage.distance_transform_edt(~measured,return_indices=True)
    bed[missing]=bed[inds[0][missing],inds[1][missing]]
out['bed_igld85_estimated_raw']=a['bed_igld85_estimated']
out['bed_igld85_estimated']=np.where(wet,bed,np.nan)
out['wet_geometry']=wet
out['estimated_bank_bed']=missing
out['bed_valid']=wet&np.isfinite(bed)
np.savez_compressed(args.out,**out)
report=dict(method=args.method,wet_cells=int(wet.sum()),measured_bed_cells=int(measured.sum()),estimated_bed_cells=int(missing.sum()),
            estimated_bed_area_fraction=float(missing.sum()/wet.sum()),shoreline_depth_constraint_m=.2 if args.method=='harmonic' else None,
            estimated_depth_percentiles_m=np.percentile((a['mean_stage_igld85_estimated']-bed)[missing],[0,25,50,75,95,100]).tolist(),
            caveat='Estimated bank bed is separate from measured NONNA values. 50m resampling does not create 50m survey resolution. Mixed vertical datums transformed using an estimated separation surface.')
Path(args.out).with_suffix('.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
