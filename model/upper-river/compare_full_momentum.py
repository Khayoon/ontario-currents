"""Exploratory, well-balanced staggered shallow-water momentum comparison.

Pressure uses free-surface differences (lake-at-rest is exact), reflecting land
faces, donor-cell momentum advection, semi-implicit Manning friction. This is
an independent exploratory solver, not a certified operational implementation.
"""
import argparse,json,time
from pathlib import Path
import numpy as np
from numba import njit
from scipy import ndimage
from pyproj import Transformer


@njit(cache=True)
def advance(eta,vel,a,z,axis,neigh,cell_faces,bed,bc,bcval,dx,n,dt,viscosity,steps):
    N=len(eta); M=len(vel)
    h=np.empty(N); uu=np.zeros(N); vv=np.zeros(N); hf=np.empty(M)
    nextvel=np.empty(M); div=np.empty(N); outgoing=np.empty(N); limiter=np.empty(N)
    for step in range(steps):
        for i in range(N):
            h[i]=max(eta[i]-bed[i],.12); uu[i]=0; vv[i]=0; div[i]=0;outgoing[i]=0
        for f in range(M):
            hf[f]=2*h[a[f]]*h[z[f]]/(h[a[f]]+h[z[f]])
            # Boundary stage cells are reservoirs and are excluded from checks.
            if axis[f]==0:
                uu[a[f]]+=vel[f]*hf[f]/(2*h[a[f]])
                uu[z[f]]+=vel[f]*hf[f]/(2*h[z[f]])
            else:
                vv[a[f]]+=vel[f]*hf[f]/(2*h[a[f]])
                vv[z[f]]+=vel[f]*hf[f]/(2*h[z[f]])
        for f in range(M):
            c=vel[f]; U=.5*(uu[a[f]]+uu[z[f]]); V=.5*(vv[a[f]]+vv[z[f]])
            # The prognostic normal speed itself is the more accurate normal
            # advector; cross-speed is interpolated from adjacent cell values.
            if axis[f]==0: U=c
            else: V=c
            il=neigh[f,0];ir=neigh[f,1];ib=neigh[f,2];it=neigh[f,3]
            vl=vel[il] if il>=0 else (0.0 if axis[f]==0 else c)
            vr=vel[ir] if ir>=0 else (0.0 if axis[f]==0 else c)
            vb=vel[ib] if ib>=0 else (0.0 if axis[f]==1 else c)
            vt=vel[it] if it>=0 else (0.0 if axis[f]==1 else c)
            dudx=(c-vl)/dx if U>=0 else (vr-c)/dx
            dudy=(c-vb)/dx if V>=0 else (vt-c)/dx
            pressure=-9.80665*(eta[z[f]]-eta[a[f]])/dx
            lap=(vl+vr+vb+vt-4*c)/(dx*dx)
            candidate=c+dt*(-U*dudx-V*dudy+pressure+viscosity*lap)
            speed=max((U*U+V*V)**.5,1e-8)
            friction=9.80665*n*n*speed/(hf[f]**(4/3))
            nextvel[f]=candidate/(1+dt*friction)
        # Conservative positivity limiter: scale each face discharge by the
        # water budget of its donor cell. The same face flux enters its other
        # cell, so no mass is created when a shallow shoal approaches drying.
        for f in range(M):
            q=nextvel[f]*hf[f]
            if q>=0: outgoing[a[f]]+=q
            else: outgoing[z[f]]-=q
        for i in range(N):
            limiter[i]=1.0 if bc[i] else min(1.0,max(0.0,h[i]-.12)*dx/(dt*max(outgoing[i],1e-30)))
        for f in range(M):
            donor=a[f] if nextvel[f]>=0 else z[f]
            nextvel[f]*=limiter[donor]
        for f in range(M):
            q=nextvel[f]*hf[f]
            div[a[f]]+=q/dx; div[z[f]]-=q/dx
        for i in range(N):
            if bc[i]: eta[i]=bcval[i]
            else: eta[i]-=dt*div[i]
        for f in range(M): vel[f]=nextvel[f]
    return eta,vel


def setup(data):
    x,y=data['x'],data['y']; wet=data['wet']; ids=np.full(wet.shape,-1,dtype=np.int32); ids[wet]=np.arange(wet.sum())
    eh=wet[:,:-1]&wet[:,1:]; ev=wet[:-1,:]&wet[1:,:]; nh=eh.sum()
    a=np.r_[ids[:,:-1][eh],ids[:-1,:][ev]].astype(np.int32)
    z=np.r_[ids[:,1:][eh],ids[1:,:][ev]].astype(np.int32)
    H,W=wet.shape; imh=np.full((H,W-1),-1,dtype=np.int32); imv=np.full((H-1,W),-1,dtype=np.int32)
    imh[eh]=np.arange(nh); imv[ev]=np.arange(nh,nh+ev.sum())
    axis=np.r_[np.zeros(nh),np.ones(ev.sum())].astype(np.int32)
    neigh=np.full((len(a),4),-1,dtype=np.int32)
    for facegrid,mask in [(imh,eh),(imv,ev)]:
        jj,ii=np.where(mask)
        for k,(di,dj) in enumerate([(-1,0),(1,0),(0,-1),(0,1)]):
            valid=(jj+dj>=0)&(jj+dj<facegrid.shape[0])&(ii+di>=0)&(ii+di<facegrid.shape[1])
            neigh[facegrid[jj[valid],ii[valid]],k]=facegrid[jj[valid]+dj,ii[valid]+di]
    bed=data['bed'][wet].copy(); eta=data['eta'][wet].copy(); dx=float(x[1]-x[0])
    h=np.maximum(eta-bed,.12); hf=2*h[a]*h[z]/(h[a]+h[z])
    vel=data['face_flux'].copy()/dx/hf
    bc=(data['inlet']|data['outlet'])[wet]; bcval=eta.copy()
    return dict(a=a,z=z,axis=axis,neigh=neigh,cell_faces=np.zeros((1,1),dtype=np.int32),bed=bed,eta=eta,vel=vel,
                bc=bc,bcval=bcval,dx=dx,wet=wet,ids=ids)


def diagnostic(s,eta,vel):
    a,z=s['a'],s['z']; h=np.maximum(eta-s['bed'],.12); hf=2*h[a]*h[z]/(h[a]+h[z]); flux=vel*hf*s['dx']
    div=np.bincount(a,weights=flux,minlength=len(eta))-np.bincount(z,weights=flux,minlength=len(eta))
    bc=s['bc']; inlet=bc&(s['bcval']>np.mean(s['bcval'][bc]))
    qi=float(div[inlet].sum()); qo=float(-div[bc&~inlet].sum())
    u=np.zeros(len(eta)); v=np.zeros(len(eta)); nh=np.sum(s['axis']==0)
    np.add.at(u,a[:nh],flux[:nh]/(2*s['dx']*h[a[:nh]])); np.add.at(u,z[:nh],flux[:nh]/(2*s['dx']*h[z[:nh]]))
    np.add.at(v,a[nh:],flux[nh:]/(2*s['dx']*h[a[nh:]])); np.add.at(v,z[nh:],flux[nh:]/(2*s['dx']*h[z[nh:]]))
    return dict(q_in=qi,q_out=qo,net_volume_rate=qi-qo,interior_continuity_l1=float(np.sum(np.abs(div[~bc]))),
                max_stage=float(eta.max()),min_stage=float(eta.min()),
                minimum_actual_depth_m=float(np.min(eta-s['bed'])),
                cells_requiring_depth_floor=int(np.sum(eta-s['bed']<.12)),
                kinetic_energy_m5s2=float(np.sum(.5*h*(u*u+v*v))*s['dx']**2),
                max_face_speed=float(np.max(np.abs(vel))),
                speed_percentiles=np.percentile(np.hypot(u,v),[50,95,99,100]).tolist()),u,v,flux


def main():
    p=argparse.ArgumentParser(); p.add_argument('initial'); p.add_argument('--n',type=float,required=True)
    p.add_argument('--hours',type=float,default=3); p.add_argument('--dt',type=float,default=.5)
    p.add_argument('--viscosity',type=float,default=1.0); p.add_argument('--out',default='swe-solution.npz')
    args=p.parse_args(); data=np.load(args.initial); s=setup(data)
    eta=s['eta']; vel=s['vel']; wet=s['wet']; report=[]; t0=time.time()
    maxdepth=float(np.max(eta-s['bed'])); cfl=args.dt*(np.sqrt(9.80665*maxdepth)+np.max(np.abs(vel)))/s['dx']
    if cfl>.4: raise RuntimeError(f'CFL {cfl:.3f} exceeds .4')
    print(f'{len(eta)}cells {len(vel)}faces CFL{cfl:.3f}',flush=True)
    initial_eta=eta.copy(); initial_vel=vel.copy(); prev_eta=eta.copy(); prev_vel=vel.copy()
    chunk=max(1,round(300/args.dt)); elapsed=0.
    while elapsed<args.hours*3600-.01:
        steps=min(chunk,round((args.hours*3600-elapsed)/args.dt))
        advance(eta,vel,s['a'],s['z'],s['axis'],s['neigh'],s['cell_faces'],s['bed'],s['bc'],s['bcval'],s['dx'],args.n,args.dt,args.viscosity,steps)
        elapsed+=steps*args.dt
        if not(np.all(np.isfinite(eta)) and np.all(np.isfinite(vel))): raise RuntimeError('nonfinite solution')
        r,u,v,flux=diagnostic(s,eta,vel); r['simulated_seconds']=elapsed
        r['current_cfl']=float(args.dt*(np.sqrt(9.80665*np.max(eta-s['bed']))+np.max(np.abs(vel)))/s['dx'])
        if r['current_cfl']>.4: raise RuntimeError('CFL exceeded .4')
        if r['minimum_actual_depth_m']<=0: raise RuntimeError('Non-positive water depth')
        r['maximum_stage_change_last_300s']=float(np.max(np.abs(eta-prev_eta)))
        r['rms_face_speed_change_last_300s']=float(np.sqrt(np.mean((vel-prev_vel)**2)))
        r['wall_seconds']=time.time()-t0; report.append(r)
        prev_eta[:]=eta; prev_vel[:]=vel
        print(json.dumps(r),flush=True)
        # Save an actual calculation checkpoint every five simulated minutes.
        out={k:data[k] for k in ['x','y','wet','inlet','outlet','bed']}
        for key,vals in [('eta',eta),('depth',eta-s['bed']),('u',u),('v',v)]:
            arr=np.full(wet.shape,np.nan); arr[wet]=vals; out[key]=arr
        out['face_flux']=flux
        np.savez_compressed(args.out,**out)
        Path(args.out).with_suffix('.json').write_text(json.dumps(dict(method='experimental full-momentum C-grid shallow-water comparison',
            n=args.n,dt=args.dt,cfl=cfl,viscosity_m2s=args.viscosity,history=report,
            initial_to_final_max_stage_change=float(np.max(np.abs(eta-initial_eta))),
            initial_to_final_rms_face_speed_change=float(np.sqrt(np.mean((vel-initial_vel)**2)))),indent=2))


if __name__=='__main__': main()
