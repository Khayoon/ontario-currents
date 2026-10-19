"""Independent analytic-channel and exact lake-at-rest checks."""
from pathlib import Path
import json
import numpy as np
from solve_hydraulics import solve
from compare_full_momentum import setup,advance,diagnostic

ROOT=Path(__file__).resolve().parent
H,W=12,100; dx=100.
wet=np.ones((H,W),dtype=bool); ids=np.arange(H*W).reshape(H,W)
eh=wet[:,:-1]&wet[:,1:]; ev=wet[:-1]&wet[1:]
inlet=np.zeros_like(wet); outlet=inlet.copy(); inlet[:,0]=1; outlet[:,-1]=1
j,i=np.where(wet); xx,yy=np.meshgrid(np.arange(W)*dx,np.arange(H)*dx)
d=dict(x=xx[0],y=yy[:,0],wet=wet,bed=np.zeros_like(xx),inlet=inlet,outlet=outlet,
       a=np.r_[ids[:,:-1][eh],ids[:-1][ev]],z=np.r_[ids[:,1:][eh],ids[1:][ev]],
       eh=eh,ev=ev,j=j,i=i,along=xx,dx=dx)
k,b=10.,9.99; n=.03
r=solve(d,k,b,n); expected=((k+b)/2)**(5/3)/n*np.sqrt((k-b)/((W-1)*dx))*H*dx
err=abs(r['report']['discharge_in_m3s']/expected-1)
assert err<.005,(err,r['report'])
data={key:d[key] for key in ['x','y','wet','inlet','outlet','bed']};data.update(r)
s=setup(data); eta=s['eta']; vel=s['vel']
advance(eta,vel,s['a'],s['z'],s['axis'],s['neigh'],s['cell_faces'],s['bed'],s['bc'],s['bcval'],dx,n,.5,1.,1200)
diag,_,_,_=diagnostic(s,eta,vel)
# Reservoir cells have only one internal normal face; their velocities are not
# used for the analytic comparison. Interior discharge should remain close.
assert abs(diag['q_in']/expected-1)<.03,diag

# Variable-bed still water must remain exactly still: pressure uses eta, not h.
s['eta'][:]=10; s['bcval'][:]=10; s['vel'][:]=0
s['bed'][:]=3*np.sin(np.arange(len(eta))*.07)
advance(s['eta'],s['vel'],s['a'],s['z'],s['axis'],s['neigh'],s['cell_faces'],s['bed'],s['bc'],s['bcval'],dx,n,.5,1.,200)
assert np.max(np.abs(s['vel']))==0
assert np.max(np.abs(s['eta']-10))==0
out=dict(analytic_channel_expected_discharge_m3s=expected,dwe_discharge_m3s=r['report']['discharge_in_m3s'],
         dwe_relative_error=err,swe_600s_discharge_m3s=diag['q_in'],
         lake_at_rest_maximum_speed_mps=float(np.max(np.abs(s['vel']))),passed=True)
(ROOT/'numerics-check.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
