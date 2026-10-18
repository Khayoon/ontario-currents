"""Numerical/physical checks only: these are not validation against lake data."""
from pathlib import Path
import json,math,sys
import numpy as np
from solve import ShallowWater,G,RHO_WATER

ROOT=Path(__file__).resolve().parent
results={}
if '--numba' in sys.argv:
    from solver_numba import rhs as nrhs,step as nstep
    # First compare both independent implementations, including an island and varying depth.
    rr=np.random.default_rng(137);hh=rr.uniform(2,30,(12,15));hh[3:6,4:7]=0
    mm=ShallowWater(hh,500);ss=list(mm.rest());ss[0][mm.wet]=rr.normal(0,.01,mm.wet.sum());ss[1][mm.Hu>0]=rr.normal(0,.04,(mm.Hu>0).sum());ss[2][mm.Hv>0]=rr.normal(0,.04,(mm.Hv>0).sum())
    def nb_rhs(self,state,wind=(0.,0.)):
        return nrhs(*state,self.H,self.Hu,self.Hv,self.invHu,self.invHv,self.invHcorner,self.dx,self.dy,self.f,self.drag,self.wind_drag,*wind)
    def nb_step(self,state,t,delta,forcing):
        wt=np.array([t,t+delta*.5,t+delta]);vals=np.array([forcing(x) for x in wt]);return nstep(*state,self.H,self.Hu,self.Hv,self.invHu,self.invHv,self.invHcorner,self.dx,self.dy,self.f,self.drag,self.wind_drag,t,delta,wt,vals[:,0],vals[:,1])
    ref=mm.rhs(ss,(4.,-3.));fast=nb_rhs(mm,ss,(4.,-3.));err=max(float(abs(a-b).max()) for a,b in zip(ref,fast));assert err<1e-15
    ref=mm.step(ss,100.,5.,lambda t:(4.+t*.001,-3.));fast=nb_step(mm,ss,100.,5.,lambda t:(4.+t*.001,-3.));step_err=max(float(abs(a-b).max()) for a,b in zip(ref,fast));assert step_err<1e-15
    results['compiledKernelParity']={'maxRhsDifference':err,'maxStepDifference':step_err}
    ShallowWater.rhs=nb_rhs;ShallowWater.step=nb_step
H=np.full((14,18),12.);H[4:7,7:10]=0
H[8:,:]+=np.linspace(0,8,18)
m=ShallowWater(H,500,drag=0)
s=m.rest()
for i in range(180):s=m.step(s,i*5,5,lambda t:(0.,0.))
assert all(np.array_equal(x,np.zeros_like(x)) for x in s)
results['restPreservation']='Exact rest, zero wind remains exactly at rest on variable bathymetry with island.'

rng=np.random.default_rng(1739);s=list(m.rest());s[0][m.wet]=rng.normal(0,.01,m.wet.sum());s[1][m.Hu>0]=rng.normal(0,.005,(m.Hu>0).sum());s[2][m.Hv>0]=rng.normal(0,.005,(m.Hv>0).sum())
d=m.rhs(s);energy_rate=RHO_WATER*m.dx*m.dy*(G*np.sum(s[0]*d[0])+np.sum(m.Hu*s[1]*d[1])+np.sum(m.Hv*s[2]*d[2]));mass_rate=float(d[0].sum()*m.dx*m.dy)
assert abs(energy_rate)<1e-6,(energy_rate,mass_rate)
assert abs(mass_rate)<1e-8
results['semiDiscreteConservation']={'energyDerivativeJPerSec':energy_rate,'volumeDerivativeM3PerSec':mass_rate,'meaning':'Pressure/Coriolis conserve depth-weighted discrete energy; closed faces conserve volume.'}

start=m.diagnostic(s);before=start['totalEnergyJ'];mass=start['massAnomalyM3']
for i in range(720):s=m.step(s,i*5,5,lambda t:(0.,0.))
after=m.diagnostic(s)
assert after['totalEnergyJ']<=before*(1+1e-12)
assert abs(after['massAnomalyM3']-mass)<1e-6
assert np.all(s[1][m.Hu==0]==0) and np.all(s[2][m.Hv==0]==0)
results['unforcedIntegration']={'relativeEnergyChange':after['totalEnergyJ']/before-1,'volumeDriftM3':after['massAnomalyM3']-mass,'closedFacesExactlyZero':True,'seconds':3600}

md=ShallowWater(H,500,drag=.0025);d=md.rhs(s);drag_rate=RHO_WATER*md.dx*md.dy*(G*np.sum(s[0]*d[0])+np.sum(md.Hu*s[1]*d[1])+np.sum(md.Hv*s[2]*d[2]));assert drag_rate<0
results['quadraticDragDissipatesEnergy']={'energyDerivativeJPerSec':drag_rate}

flat=ShallowWater(np.full((18,24),10.),500,latitude=0,drag=.0025)
s=flat.rest();d=flat.rhs(s,(6.,0.))
assert np.all(d[1][:,1:-1]>0) and np.all(d[2]==0)
for i in range(2160):s=flat.step(s,i*5,5,lambda t:(6.,0.))
eta=s[0];assert eta[:,-1].mean()>eta[:,0].mean()
assert abs(flat.diagnostic(s)['massAnomalyM3'])<1e-5
results['windStressAndFreeSurface']={'downwindMinusUpwindEtaM':float(eta[:,-1].mean()-eta[:,0].mean()),'volumeAnomalyM3':flat.diagnostic(s)['massAnomalyM3'],'meaning':'Eastward wind first accelerates east; closed-lake pressure builds a higher downwind water surface.'}

# North-hemisphere Coriolis bends eastward flow toward the south: dv/dt=-fu.
c=ShallowWater(np.full((10,12),10.),500,drag=0);s=list(c.rest());s[1][:,1:-1]=.02;d=c.rhs(s)
assert d[2][3:7,3:9].mean()<0
results['coriolisSign']={'northAccelerationFromEastFlowMps2':float(d[2][3:7,3:9].mean())}

for step in [5.,10.]:
    s=flat.rest()
    for i in range(int(3600/step)):s=flat.step(s,i*step,step,lambda t:(6.,0.))
    if step==5:ref=s
    else:
        err=max(float(np.max(np.abs(a-b))) for a,b in zip(s,ref));assert err<1e-4
        results['timeStepComparison']={'dt5versus10MaxAbsoluteStateDifference':err,'seconds':3600}

(ROOT/('numerical-checks-numba.json' if '--numba' in sys.argv else 'numerical-checks.json')).write_text(json.dumps(results,indent=2),encoding='utf8');print(json.dumps(results,indent=2))
