"""Experimental rotating, linearized 2-D shallow-water wind response.

Arakawa C grid; finite-volume transport divergence; pressure gradient is its
negative adjoint. Corner f/H and paired transport averages make the discrete
Coriolis operator skew with respect to depth-weighted kinetic energy. SSP-RK3
advances the coupled equations. This is not a calibrated Lake Simcoe forecast.
"""
from pathlib import Path
import argparse, datetime as dt, hashlib, json, math, time
import numpy as np

ROOT=Path(__file__).resolve().parent
G=9.80665; RHO_WATER=1000.; RHO_AIR=1.225

def timestamp(s):return dt.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def iso(t):return dt.datetime.fromtimestamp(t,dt.timezone.utc).isoformat().replace('+00:00','Z')

class ShallowWater:
    def __init__(self,H,dx,dy=None,latitude=44.45,drag=.0025,wind_drag=.0013):
        self.H=np.asarray(H,float);self.wet=self.H>0;self.ny,self.nx=self.H.shape
        self.dx=float(dx);self.dy=float(dy or dx);self.f=2*7.292115e-5*math.sin(math.radians(latitude))
        self.drag=drag;self.wind_drag=wind_drag
        self.Hu=np.zeros((self.ny,self.nx+1));self.Hv=np.zeros((self.ny+1,self.nx))
        um=self.wet[:,:-1]&self.wet[:,1:];vm=self.wet[:-1,:]&self.wet[1:,:]
        self.Hu[:,1:-1]=np.where(um,.5*(self.H[:,:-1]+self.H[:,1:]),0)
        self.Hv[1:-1,:]=np.where(vm,.5*(self.H[:-1,:]+self.H[1:,:]),0)
        self.invHu=np.divide(1,self.Hu,out=np.zeros_like(self.Hu),where=self.Hu>0)
        self.invHv=np.divide(1,self.Hv,out=np.zeros_like(self.Hv),where=self.Hv>0)
        cornerH=np.zeros((self.ny+1,self.nx+1));cornerN=np.zeros_like(cornerH)
        for sy,sx in [(slice(None,-1),slice(None,-1)),(slice(1,None),slice(None,-1)),(slice(None,-1),slice(1,None)),(slice(1,None),slice(1,None))]:
            cornerH[sy,sx]+=self.H;cornerN[sy,sx]+=self.wet
        cornerH=np.divide(cornerH,cornerN,out=np.zeros_like(cornerH),where=cornerN>0)
        self.invHcorner=np.divide(1,cornerH,out=np.zeros_like(cornerH),where=cornerH>0)
        # Max semidiscrete gravity-wave frequency <=2*sqrt(gH)*sqrt(dx^-2+dy^-2).
        self.frequency_bound=2*math.sqrt(G*self.H.max())*math.sqrt(self.dx**-2+self.dy**-2)+abs(self.f)

    def rest(self):return (np.zeros_like(self.H),np.zeros_like(self.Hu),np.zeros_like(self.Hv))

    def rhs(self,state,wind=(0.,0.)):
        eta,u,v=state;U=self.Hu*u;V=self.Hv*v
        dEta=-((U[:,1:]-U[:,:-1])/self.dx+(V[1:,:]-V[:-1,:])/self.dy)
        dU=np.zeros_like(u);dV=np.zeros_like(v)
        dU[:,1:-1]=-G*(eta[:,1:]-eta[:,:-1])/self.dx
        dV[1:-1,:]=-G*(eta[1:,:]-eta[:-1,:])/self.dy
        Ucorner=np.zeros_like(self.invHcorner);Vcorner=np.zeros_like(Ucorner)
        Ucorner[:-1,:]+=.5*U;Ucorner[1:,:]+=.5*U
        Vcorner[:,:-1]+=.5*V;Vcorner[:,1:]+=.5*V
        crossV=.5*(Vcorner[:-1,:]*self.invHcorner[:-1,:]+Vcorner[1:,:]*self.invHcorner[1:,:])
        crossU=.5*(Ucorner[:,:-1]*self.invHcorner[:,:-1]+Ucorner[:,1:]*self.invHcorner[:,1:])
        dU+=self.f*crossV;dV-=self.f*crossU
        speed=math.hypot(*wind)
        tx=RHO_AIR*self.wind_drag*speed*wind[0]/RHO_WATER
        ty=RHO_AIR*self.wind_drag*speed*wind[1]/RHO_WATER
        dU+=(tx-self.drag*np.hypot(u,crossV)*u)*self.invHu
        dV+=(ty-self.drag*np.hypot(v,crossU)*v)*self.invHv
        dU*=self.Hu>0;dV*=self.Hv>0;dEta*=self.wet
        return dEta,dU,dV

    def step(self,state,t,step,forcing):
        # Third-order strong-stability-preserving Runge-Kutta (nonautonomous stages).
        k=self.rhs(state,forcing(t));a=tuple(x+step*y for x,y in zip(state,k))
        k=self.rhs(a,forcing(t+step));b=tuple(.75*x+.25*(y+step*z) for x,y,z in zip(state,a,k))
        k=self.rhs(b,forcing(t+.5*step));return tuple(x/3+2*(y+step*z)/3 for x,y,z in zip(state,b,k))

    def cell_velocity(self,state):
        _,u,v=state
        return .5*(u[:,:-1]+u[:,1:]),.5*(v[:-1,:]+v[1:,:])

    def diagnostic(self,state):
        eta,u,v=state;area=self.dx*self.dy
        kinetic=.5*RHO_WATER*area*(np.sum(self.Hu*u*u)+np.sum(self.Hv*v*v))
        potential=.5*RHO_WATER*G*area*np.sum(eta[self.wet]**2)
        return {'massAnomalyM3':float(eta[self.wet].sum()*area),'kineticJ':float(kinetic),'potentialJ':float(potential),'totalEnergyJ':float(kinetic+potential),'maxFaceSpeedMps':float(max(abs(u).max(),abs(v).max())),'maxAbsEtaM':float(abs(eta[self.wet]).max()),'rmsEtaM':float(np.sqrt(np.mean(eta[self.wet]**2))),'maxAbsoluteEtaOverH':float(np.max(abs(eta[self.wet])/self.H[self.wet])),'minimumTotalDepthM':float(np.min((eta+self.H)[self.wet]))}

def load_wind(path):
    j=json.loads(Path(path).read_text(encoding='utf8'));samples=j['samples']
    t=np.array([timestamp(s['time']) for s in samples]);u=np.array([s['u10'] for s in samples]);v=np.array([s['v10'] for s in samples])
    assert np.isfinite(t).all() and np.isfinite(u).all() and np.isfinite(v).all()
    assert (np.diff(t)>0).all() and np.diff(t).max()<=3600,'Missing/nonmonotone hourly wind.'
    def forcing(sec):
        if sec<t[0] or sec>t[-1]:raise ValueError('No extrapolation beyond wind record.')
        return float(np.interp(sec,t,u)),float(np.interp(sec,t,v))
    forcing.arrays=(t,u,v)
    return forcing,j,(float(t[0]),float(t[-1]))

def run(args):
    grid=np.load(args.grid);H=grid['H'];model=ShallowWater(H,float(grid['dx']),float(grid['dy']),drag=args.drag)
    start=timestamp(args.start);mean_start=timestamp(args.mean_start);end=timestamp(args.end)
    forcing,wind,bounds=load_wind(args.wind)
    if args.backend=='numba':
        from solver_numba import step as compiled_step
        def advance(state,t,step):
            return compiled_step(*state,model.H,model.Hu,model.Hv,model.invHu,model.invHv,model.invHcorner,model.dx,model.dy,model.f,model.drag,model.wind_drag,t,step,*forcing.arrays)
    else:
        def advance(state,t,step):return model.step(state,t,step,forcing)
    assert bounds[0]<=start<mean_start<end<=bounds[1]
    assert args.dt*model.frequency_bound<1.6,'RK3 gravity-wave CFL must stay below conservative1.6.'
    state=model.rest();t=start;sample_times=np.arange(mean_start,end+.1,21600.)
    saved=[];mean_u=np.zeros_like(H);mean_v=np.zeros_like(H);mean_speed=np.zeros_like(H)
    prior=None;integrated=0.;next_sample=0;diagnostics=[];last_day=-1
    wall=time.monotonic();steps=0;peak_eta_ratio=0.;minimum_total_depth=float(H[H>0].min())
    while t<end-.01:
        next_event=mean_start if t<mean_start-.01 else (sample_times[next_sample] if next_sample<len(sample_times) and sample_times[next_sample]>t+.01 else end)
        step=min(args.dt,end-t,max(.001,next_event-t))
        state=advance(state,t,step);t+=step;steps+=1
        if not np.isfinite(state[0]).all() or max(abs(state[1]).max(),abs(state[2]).max())>5:raise RuntimeError('Unstable solution; not exported.')
        peak_eta_ratio=max(peak_eta_ratio,float(np.max(abs(state[0][model.wet])/H[model.wet])))
        minimum_total_depth=min(minimum_total_depth,float(np.min((state[0]+H)[model.wet])))
        if minimum_total_depth<=0:raise RuntimeError('Linearization produced nonpositive total wet depth; not exported.')
        if t>=mean_start-.01:
            uc,vc=model.cell_velocity(state);speed=np.hypot(uc,vc)
            if prior is not None:
                delta=t-prior[0];mean_u+=.5*(prior[1]+uc)*delta;mean_v+=.5*(prior[2]+vc)*delta;mean_speed+=.5*(prior[3]+speed)*delta;integrated+=delta
            prior=(t,uc,vc,speed)
            if next_sample<len(sample_times) and abs(t-sample_times[next_sample])<.01:
                saved.append({'time':iso(t),'u':uc.copy(),'v':vc.copy()});next_sample+=1
        day=int((t-start)//86400)
        if day!=last_day or t>=end-.01:
            d={'time':iso(t),**model.diagnostic(state)};diagnostics.append(d);last_day=day
            print(json.dumps({'day':day,'time':iso(t),'steps':steps,'elapsedSeconds':round(time.monotonic()-wall,1),'maxSpeed':d['maxFaceSpeedMps'],'massAnomaly':d['massAnomalyM3']}),flush=True)
    assert abs(integrated-(end-mean_start))<.01 and len(saved)==len(sample_times),(integrated,len(saved))
    current_wind=json.loads(Path(args.wind).read_text(encoding='utf8'))
    assert current_wind['samples']==wind['samples'],'Wind numerical inputs changed during run.'
    wind=current_wind
    mean_u/=integrated;mean_v/=integrated;mean_speed/=integrated
    np.savez_compressed(ROOT/(args.output+'-fields.npz'),mean_u=mean_u,mean_v=mean_v,mean_speed=mean_speed,final_eta=state[0],final_u=state[1],final_v=state[2],sample_times=sample_times,sample_u=np.stack([s['u'] for s in saved]),sample_v=np.stack([s['v'] for s in saved]))
    lon=grid['lon'];lat=grid['lat'];wet=H>0
    # Independent field schema; parent integrates through an explicit experimental source adapter.
    field={
      'kind':'experimental-depth-averaged-wind-response','validated':False,'label':'Experimental Lake Simcoe — unvalidated depth-averaged wind response',
      'start':iso(mean_start),'end':iso(end),'spinupStart':iso(start),'grid':{'nx':H.shape[1],'ny':H.shape[0],'lon0':float(lon[0,0]),'lat0':float(lat[0,0]),'dlon':float(lon[0,1]-lon[0,0]),'dlat':float(lat[1,0]-lat[0,0]),'dxMetres':model.dx,'dyMetres':model.dy,'rowOrder':'south-to-north'},
      'units':'m/s','componentOrientation':'true east / true north in local equirectangular approximation',
      'wet':wet.astype(int).ravel().tolist(),
      'u':[round(float(x),7) if w else None for x,w in zip(mean_u.ravel(),wet.ravel())],
      'v':[round(float(x),7) if w else None for x,w in zip(mean_v.ravel(),wet.ravel())],
      'meanSpeed':[round(float(x),7) if w else None for x,w in zip(mean_speed.ravel(),wet.ravel())],
      'source':{'wind':wind['source'],'bathymetryManifest':Path(args.grid).stem+'-manifest.json','solver':'solve.py','windSHA256':hashlib.sha256(Path(args.wind).read_bytes()).hexdigest(),'gridSHA256':hashlib.sha256(Path(args.grid).read_bytes()).hexdigest()},
      'model':{'equations':'Linearized rotating shallow-water equations with variable undisturbed depth, nonlinear quadratic bottom drag, surface wind stress; no advective or thermal/density terms.','scheme':'Arakawa C-grid finite volume, depth-weighted skew-symmetric corner Coriolis, SSP-RK3','dtSeconds':args.dt,'steps':steps,'frequencyBoundTimesDt':args.dt*model.frequency_bound,'waterDensityKgM3':RHO_WATER,'airDensityKgM3':RHO_AIR,'windDragCoefficient':model.wind_drag,'bottomDragCoefficient':model.drag,'coriolisPerSecond':model.f,'initialCondition':f'Rest with eta0=0 at{iso(start)};{(mean_start-start)/3600:.1f}-hour wind-forced spinup before mean window.','boundary':'No-normal-flow on all land/island faces and closed Atherley Narrows; no tributary/outlet forcing.','averaging':f'Trapezoidal time integral of east/north components, every solver step, over{iso(mean_start)}–{iso(end)}; meanSpeed separately retained.'},
      'limitations':['Experimental physics response, not observed/retrieved/validated currents.','Depth average cannot represent actual surface shear, thermal stratification, internal waves or baroclinic circulation.','Single land weather station applied uniformly, no over-water correction; nominal10m wind height assumed, not station-verified.','Closed narrows, no tributaries or outlet throughflow; avoid interpreting channel currents.',f'Historic interpolated bathymetry and {model.dx:g}m grid; unresolved small-scale coast and channels.','Constant uncertain bottom and air-water drag; numerical tests do not establish field accuracy.','The averaging window is the2026week, not a multiyear October climatology.']}
    (ROOT/(args.output+'.json')).write_text(json.dumps(field,separators=(',',':')),encoding='utf8')
    report={'samples':len(saved),'backend':args.backend,'steps':steps,'elapsedSeconds':time.monotonic()-wall,'meanWindowSeconds':integrated,'meanVectorMaxMps':float(np.hypot(mean_u,mean_v)[wet].max()),'meanSpeedMaxMps':float(mean_speed[wet].max()),'meanVectorMedianMps':float(np.median(np.hypot(mean_u,mean_v)[wet])),'peakAbsoluteEtaOverH':peak_eta_ratio,'minimumTotalDepthM':minimum_total_depth,'linearizationWarning':peak_eta_ratio>.1,'diagnostics':diagnostics}
    (ROOT/(args.output+'-diagnostics.json')).write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report,indent=2))

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--grid',default=str(ROOT/'grid.npz'));ap.add_argument('--wind',default=str(ROOT/'wind.json'));ap.add_argument('--start',default='2026-10-10T00:00:00Z');ap.add_argument('--mean-start',default='2026-10-12T00:00:00Z');ap.add_argument('--end',default='2026-10-17T12:00:00Z');ap.add_argument('--dt',type=float,default=10);ap.add_argument('--drag',type=float,default=.0025);ap.add_argument('--backend',choices=['numpy','numba'],default='numpy');ap.add_argument('--output',default='prototype');run(ap.parse_args())
