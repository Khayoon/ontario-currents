"""Steady-scenario shallow-water momentum with implicit gravity-wave pressure.

Uniform finite-volume C grid, backward-Euler free surface/pressure, explicit
donor-cell velocity advection and viscosity, semi-implicit Manning resistance.
Pressure correction uses identical wet-face fluxes in the SPD stage solve and
mass update, preserving no-flow island faces and exact lake-at-rest balance.
"""
import os
os.environ['OPENBLAS_NUM_THREADS']='1'
os.environ['OMP_NUM_THREADS']='1'
import argparse,json,time,hashlib
from pathlib import Path
import numpy as np
from numba import njit
from scipy import sparse
from scipy.sparse.linalg import cg,LinearOperator
import pyamg
from compare_full_momentum import setup,diagnostic


@njit(cache=True)
def predictor(eta,vel,a,z,axis,neigh,bed,dx,n,dt,viscosity,advection_factor):
    N=len(eta);M=len(vel);h=np.maximum(eta-bed,.12);hf=np.empty(M);denom=np.empty(M)
    uu=np.zeros(N);vv=np.zeros(N);qstar=np.empty(M)
    for f in range(M):
        hf[f]=2*h[a[f]]*h[z[f]]/(h[a[f]]+h[z[f]])
        if axis[f]==0:
            uu[a[f]]+=vel[f]*hf[f]/(2*h[a[f]]);uu[z[f]]+=vel[f]*hf[f]/(2*h[z[f]])
        else:
            vv[a[f]]+=vel[f]*hf[f]/(2*h[a[f]]);vv[z[f]]+=vel[f]*hf[f]/(2*h[z[f]])
    for f in range(M):
        c=vel[f];U=.5*(uu[a[f]]+uu[z[f]]);V=.5*(vv[a[f]]+vv[z[f]])
        if axis[f]==0: U=c
        else: V=c
        il,ir,ib,it=neigh[f]
        vl=vel[il] if il>=0 else (0. if axis[f]==0 else c)
        vr=vel[ir] if ir>=0 else (0. if axis[f]==0 else c)
        vb=vel[ib] if ib>=0 else (0. if axis[f]==1 else c)
        vt=vel[it] if it>=0 else (0. if axis[f]==1 else c)
        dudx=(c-vl)/dx if U>=0 else (vr-c)/dx
        dudy=(c-vb)/dx if V>=0 else (vt-c)/dx
        lap=(vl+vr+vb+vt-4*c)/(dx*dx)
        adv=c+dt*(-advection_factor*(U*dudx+V*dudy)+viscosity*lap)
        speed=max(np.sqrt(U*U+V*V),1e-8)
        denom[f]=1+dt*9.80665*n*n*speed/(hf[f]**(4/3))
        qstar[f]=hf[f]*adv/denom[f]
    return hf,denom,qstar


def main():
    p=argparse.ArgumentParser();p.add_argument('initial');p.add_argument('--n',type=float,required=True)
    p.add_argument('--hours',type=float,default=24);p.add_argument('--dt',type=float,default=20)
    p.add_argument('--viscosity',type=float,default=1);p.add_argument('--out',required=True)
    p.add_argument('--advection-factor',type=float,default=1)
    p.add_argument('--check-minutes',type=float,default=30);args=p.parse_args()
    source=Path(args.initial);data=np.load(source);s=setup(data)
    eta=s['eta'];vel=s['vel'];a=s['a'];z=s['z'];N=len(eta);wet=s['wet'];dx=s['dx']
    inner=np.flatnonzero(~s['bc']);fixed=np.flatnonzero(s['bc']);reference=float(np.min(s['bcval'][fixed]));bc_head=s['bcval']-reference
    diagidx=np.arange(N);rows=np.r_[diagidx,a,z];cols=np.r_[diagidx,z,a]
    history=[];preveta=eta.copy();prevvel=vel.copy();t0=time.time();elapsed=0
    checkpoint=max(1,round(args.check_minutes*60/args.dt));steps=round(args.hours*3600/args.dt)
    cached_preconditioner=None
    for step in range(steps):
        hf,denom,qstar=predictor(eta,vel,a,z,s['axis'],s['neigh'],s['bed'],dx,args.n,args.dt,args.viscosity,args.advection_factor)
        K=args.dt**2*9.80665*hf/(dx*dx*denom)
        diagonal=1+np.bincount(a,weights=K,minlength=N)+np.bincount(z,weights=K,minlength=N)
        A=sparse.coo_matrix((np.r_[diagonal,-K,-K],(rows,cols)),shape=(N,N)).tocsr()
        divstar=(np.bincount(a,weights=qstar,minlength=N)-np.bincount(z,weights=qstar,minlength=N))/dx
        rhs=eta-reference-args.dt*divstar
        Ai=A[inner][:,inner];ri=rhs[inner]-(A[inner][:,fixed]@bc_head[fixed])
        if args.dt>40:
            if cached_preconditioner is None:cached_preconditioner=pyamg.smoothed_aggregation_solver(Ai,symmetry='symmetric').aspreconditioner()
            pre=cached_preconditioner
        else:
            idiag=1/Ai.diagonal();pre=LinearOperator(Ai.shape,matvec=lambda x:idiag*x)
        head,info=cg(Ai,ri,x0=eta[inner]-reference,M=pre,rtol=1e-10,atol=1e-11,maxiter=400)
        if info: raise RuntimeError(f'Stage CG did not converge: {info}')
        old_surface_sum=float(np.sum(eta[inner]))
        eta[inner]=head+reference;eta[fixed]=s['bcval'][fixed]
        qnew=qstar-args.dt*9.80665*hf/denom*(eta[z]-eta[a])/dx
        # Use the same face depth to update velocity; on the next step hf is
        # updated from the newly solved surface. Depth variations are retained.
        vel=qnew/hf
        actual_depth=eta-s['bed']
        if np.min(actual_depth)<=0 or not(np.all(np.isfinite(eta)) and np.all(np.isfinite(vel))):
            raise RuntimeError('Non-positive or nonfinite solution')
        current_advective_cfl=float(args.dt*np.max(np.abs(vel))/dx)
        if current_advective_cfl*args.advection_factor>.45:raise RuntimeError('Advection CFL exceeded .45')
        div_actual=np.bincount(a,weights=qnew*dx,minlength=N)-np.bincount(z,weights=qnew*dx,minlength=N)
        boundary_net=float(np.sum(div_actual[s['bc']]))
        storage_rate=float((np.sum(eta[inner])-old_surface_sum)*dx*dx/args.dt)
        mass_balance_error=storage_rate-boundary_net
        elapsed+=(args.dt)
        if step%checkpoint==checkpoint-1 or step==steps-1:
            # qnew is the actual flux used by the stage solve; it must be the
            # saved/audited flux, rather than vel multiplied by hf_new.
            hnew=eta-s['bed'];hfnew=2*hnew[a]*hnew[z]/(hnew[a]+hnew[z])
            diagvel=qnew/hfnew
            r,u,v,flux=diagnostic(s,eta,diagvel);r['simulated_seconds']=elapsed
            r['global_step_mass_balance_error_m3s']=mass_balance_error
            r['flux_depth_linearization_relative_difference']=float(np.sum(np.abs(vel*hfnew-qnew))/max(np.sum(np.abs(qnew)),1))
            r['maximum_stage_change_last_checkpoint_m']=float(np.max(np.abs(eta-preveta)))
            r['rms_face_speed_change_last_checkpoint_mps']=float(np.sqrt(np.mean((vel-prevvel)**2)))
            r['advection_cfl']=float(args.dt*np.max(np.abs(vel))/dx)
            r['wall_seconds']=time.time()-t0
            r['relative_boundary_flux_error']=abs(r['q_in']-r['q_out'])/max(abs(r['q_in']),1)
            history.append(r);print(json.dumps(r),flush=True)
            if r['minimum_actual_depth_m']<=0: raise RuntimeError('Non-positive depth')
            if r['advection_cfl']*args.advection_factor>.45: raise RuntimeError('Advection CFL exceeded .45')
            if not np.all(np.isfinite(vel)):raise RuntimeError('Nonfinite velocity')
            preveta[:]=eta;prevvel[:]=vel
            out={k:data[k] for k in ['x','y','wet','inlet','outlet','bed']}
            for key,vals in [('eta',eta),('depth',eta-s['bed']),('u',u),('v',v)]:
                arr=np.full(wet.shape,np.nan);arr[wet]=vals;out[key]=arr
            out['face_flux']=flux;np.savez_compressed(args.out,**out)
            report=dict(method='experimental semi-implicit full-momentum depth-averaged shallow-water estimate',
                        n=args.n,dt_seconds=args.dt,viscosity_m2s=args.viscosity,
                        advection_factor=args.advection_factor,
                        initial_solution=str(source),initial_solution_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                        limitations='Unvalidated velocity-form C-grid solver; donor-cell advection introduces numerical mixing. Uniform calibrated resistance, estimated bank depths/datum separation; no wind, density stratification, surface shear or Coriolis.',history=history)
            Path(args.out).with_suffix('.json').write_text(json.dumps(report,indent=2))
            # Stop only after repeated convergence, including local stage and
            # speed change, flux equality and flux stationarity; never just KE.
            if len(history)>=4 and elapsed>=10800:
                last=history[-3:]
                steady=all(zr['relative_boundary_flux_error']<.002 and zr['maximum_stage_change_last_checkpoint_m']<.0005 and zr['rms_face_speed_change_last_checkpoint_mps']<.0001 for zr in last)
                qrange=(max(zr['q_in'] for zr in last)-min(zr['q_in'] for zr in last))/max(abs(last[-1]['q_in']),1)
                steady=steady and qrange<.001
                if steady:
                    print('STEADY_CRITERIA_MET',flush=True);break


if __name__=='__main__':main()
