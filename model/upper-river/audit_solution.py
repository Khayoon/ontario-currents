"""Independent flux, bed-source and held-out-stage diagnostics."""
import argparse,json
from pathlib import Path
import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree

p=argparse.ArgumentParser();p.add_argument('solution');p.add_argument('bedgrid');p.add_argument('--out',required=True);args=p.parse_args()
a=np.load(args.solution); bg=np.load(args.bedgrid); wet=a['wet']; ids=np.full(wet.shape,-1,dtype=int);ids[wet]=np.arange(wet.sum())
eh=wet[:,:-1]&wet[:,1:]; ev=wet[:-1]&wet[1:]
i=np.r_[ids[:,:-1][eh],ids[:-1][ev]];j=np.r_[ids[:,1:][eh],ids[1:][ev]]
flux=a['face_flux']; tf=Transformer.from_crs(4326,32618,always_xy=True)
inlet=np.array(tf.transform(-76.4085,44.176));outlet=np.array(tf.transform(-75.6725,44.5785));axis=(outlet-inlet);axis/=np.linalg.norm(axis)
xx,yy=np.meshgrid(a['x'],a['y']);xy=np.c_[xx[wet],yy[wet]];along=(xy-inlet)@axis
estimated=bg['estimated_bank_bed'][wet] if 'estimated_bank_bed' in bg else ~bg['measured_bathy'][wet]
sections=[]
for distance in np.linspace(np.percentile(along,5),np.percentile(along,95),12):
    cross=(along[i]<distance)&(along[j]>=distance);back=(along[j]<distance)&(along[i]>=distance)
    selected=cross|back;signed=np.where(cross,1,-1)
    q=float(np.sum(flux[selected]*signed[selected]));qabs=float(np.sum(np.abs(flux[selected])))
    inferred=selected&(estimated[i]|estimated[j]); share=float(np.sum(np.abs(flux[inferred]))/max(qabs,1e-30))
    sections.append(dict(distance_from_inlet_km=float(distance/1000),net_discharge_m3s=q,absolute_crossing_flux_m3s=qabs,estimated_bed_face_flux_share=share))
# Alexandria Bay is deliberately not a boundary condition or roughness target.
loc=np.array(tf.transform(-75.9345,44.3311));distance,idx=cKDTree(xy).query(loc)
stage=float(a['eta'][wet][idx]);stage_reference=74.66782083333334
out=dict(wet_cells=int(wet.sum()),estimated_bed_area_fraction=float(estimated.mean()),cross_sections=sections,
         alexandria_bay=dict(station='NOAA8311062',station_position=[-75.9345,44.3311],nearest_wet_cell_distance_m=float(distance),
                             predicted_igld85_stage_m=stage,observed_time_weighted_mean_m=stage_reference,
                             stage_residual_m=stage-stage_reference,observation_quality='preliminary, one missing six-minute value interpolated only for time-weighted stage mean'),
         minimum_actual_depth_m=float(np.nanmin(a['eta']-a['bed'])),
         cells_requiring_depth_floor=int(np.sum((a['eta']-a['bed'])[wet]<.12)))
Path(args.out).write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
