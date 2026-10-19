"""Separate bed estimate with true-shore constraints and open-cut continuation.

Retrieved bathymetry is never changed. Only missing wet-cell bed is inferred.
Shallow-bank conditions apply at actual mapped land, not the model inlet/outlet.
Across an artificial cut, neighbouring retrieved bed is used if available;
otherwise the bed-interpolation boundary is zero-gradient.
"""
import argparse,json
from pathlib import Path
import numpy as np
from scipy import sparse,ndimage
from scipy.sparse.linalg import spsolve
p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('--method',choices=['harmonic','nearest'],default='harmonic');p.add_argument('--out',required=True);args=p.parse_args()
a=np.load(args.input);out={k:a[k]for k in a.files}
wet=a['proposed_active_corridor'].astype(bool);truewater=a['wet_geometry'].astype(bool)
bed=a['bed_igld85_estimated'].copy();measured=wet&np.isfinite(bed);missing=wet&~measured
ids=np.full(wet.shape,-1,dtype=int);ids[missing]=np.arange(missing.sum());open_data=0;open_neumann=0
if args.method=='harmonic':
    H,W=wet.shape;jj,ii=np.where(missing);rows=[];cols=[];vals=[];rhs=np.zeros(missing.sum());diag=np.zeros(missing.sum())
    shore=a['mean_stage_igld85_estimated']-.2
    for dj,di in [(0,1),(0,-1),(1,0),(-1,0)]:
        nj=np.clip(jj+dj,0,H-1);ni=np.clip(ii+di,0,W-1)
        unknown=missing[nj,ni];fixed=truewater[nj,ni]&np.isfinite(bed[nj,ni]);land=~truewater[nj,ni]
        openwater=~wet[nj,ni]&truewater[nj,ni]
        open_data+=int(np.sum(openwater&fixed));open_neumann+=int(np.sum(openwater&~fixed))
        idx=ids[jj,ii];diag+=unknown|fixed|land
        rows.extend(idx[unknown]);cols.extend(ids[nj[unknown],ni[unknown]]);vals.extend(-np.ones(unknown.sum()))
        rhs[fixed]+=bed[nj[fixed],ni[fixed]];rhs[land]+=shore[jj[land],ii[land]]
    rows.extend(np.arange(len(rhs)));cols.extend(np.arange(len(rhs)));vals.extend(diag)
    A=sparse.coo_matrix((vals,(rows,cols)),shape=(len(rhs),len(rhs))).tocsr();bed[missing]=spsolve(A,rhs)
else:
    allmeasured=truewater&np.isfinite(bed);_,inds=ndimage.distance_transform_edt(~allmeasured,return_indices=True);bed[missing]=bed[inds[0][missing],inds[1][missing]]
out['bed_igld85_estimated_raw']=a['bed_igld85_estimated'];out['bed_igld85_estimated']=np.where(wet,bed,np.nan)
out['wet_geometry']=wet;out['estimated_bank_bed']=missing;out['bed_valid']=wet&np.isfinite(bed)
np.savez_compressed(args.out,**out)
report=dict(method=args.method,wet_cells=int(wet.sum()),measured_bed_cells=int(measured.sum()),estimated_bed_cells=int(missing.sum()),
    estimated_bed_area_fraction=float(missing.sum()/wet.sum()),shoreline_depth_constraint_m=.2,
    open_cut_missing_bed_neighbour_faces_with_retrieved_depth=open_data,open_cut_missing_bed_neighbour_faces_zero_gradient=open_neumann,
    open_boundary_handling='Actual land alone receives shallow-bank constraint. Artificial cuts use neighbouring retrieved bed if finite, otherwise zero normal interpolation gradient.',
    caveat='Inferred bed and interpolated vertical-datum separation remain estimates; measured source bed is unchanged.')
Path(args.out).with_suffix('.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2),flush=True)
