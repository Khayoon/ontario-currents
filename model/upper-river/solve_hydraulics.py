"""Reproducible exploratory Kingston--Brockville depth-averaged hydraulics.

Stage-driven nonlinear finite-volume Manning diffusion-wave approximation.
This is an unvalidated estimate, not observed or operational surface currents.
The real bed/shoreline input is prepared separately by prepare_bathymetry.py.
"""
import argparse, csv, json, time, hashlib
from pathlib import Path
import numpy as np
from scipy import ndimage, sparse
from scipy.sparse.linalg import cg, spsolve
import pyamg
from pyproj import Transformer

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[1]
TF = Transformer.from_crs(4326, 32618, always_xy=True)


def stages():
    package_input=ROOT/'inputs/hourly-stage-boundaries-igld85.csv'
    original_input=ROOT.parent/'upper-river-research/hourly-stage-boundaries-igld85.csv'
    path=package_input if package_input.exists() else original_input
    rows = list(csv.DictReader(path.open(encoding='utf-8')))
    k=np.array([float(r['kingston_stage_igld85_m']) for r in rows])
    b=np.array([float(r['brockville_stage_igld85_m']) for r in rows])
    # Published regulation schedule, NOT independently gauged discharge. The
    # schedule timezone is unspecified, so use the weekly target as a scenario.
    return float(k.mean()), float(b.mean()), 7377.58


def domain(data, stride=1, bed_shift=0.0):
    x=data['x'][::stride]; y=data['y'][::stride]
    xx,yy=np.meshgrid(x,y)
    wet=data['wet_geometry'][::stride,::stride].astype(bool)
    key='bed_igld85_estimated' if 'bed_igld85_estimated' in data else 'bed_igld85_estimated_m'
    bed=data[key][::stride,::stride].copy()+bed_shift
    if 'bed_valid' in data: wet &= data['bed_valid'][::stride,::stride]
    wet &= np.isfinite(bed)
    # Cross-section endpoints are chosen shore-to-shore, rather than following
    # an invented river centreline. Both cuts are close to the stage stations.
    ka=np.array(TF.transform(-76.484,44.224)); kb=np.array(TF.transform(-76.333,44.128))
    # Outlet extends just beyond Brockville; no Gulf or downstream model used.
    oa=np.array(TF.transform(-75.686,44.592)); ob=np.array(TF.transform(-75.659,44.565))
    def side(a,b): return (xx-a[0])*(b[1]-a[1])-(yy-a[1])*(b[0]-a[0])
    si=side(ka,kb); so=side(oa,ob)
    # Determine interior side from a point in the middle of the reach.
    mid=np.array(TF.transform(-76.02,44.33))
    def msign(a,b): return np.sign((mid[0]-a[0])*(b[1]-a[1])-(mid[1]-a[1])*(b[0]-a[0]))
    inside_i=si*msign(ka,kb)>=0; inside_o=so*msign(oa,ob)>=0
    wet &= inside_i & inside_o
    k,b,_=stages(); wet &= (min(k,b)-bed)>0.12
    structure=ndimage.generate_binary_structure(2,1)
    # Boundary cells are wet cells next to the artificial cut, never shore cells.
    inlet=wet & ndimage.binary_dilation(~inside_i,structure=structure)
    outlet=wet & ndimage.binary_dilation(~inside_o,structure=structure)
    labels,_=ndimage.label(wet,structure=structure)
    live=np.intersect1d(np.unique(labels[inlet]),np.unique(labels[outlet]))
    live=live[live>0]
    if not len(live): raise RuntimeError('No connected surveyed channel joins both boundaries')
    wet &= np.isin(labels,live); inlet &= wet; outlet &= wet
    ids=np.full(wet.shape,-1,dtype=np.int32); ids[wet]=np.arange(wet.sum())
    j,i=np.where(wet)
    # Every wet/land face is impermeable. Only wet/wet pairs enter the system.
    eh=wet[:,:-1]&wet[:,1:]; ev=wet[:-1,:]&wet[1:,:]
    a=np.r_[ids[:,:-1][eh],ids[:-1,:][ev]]
    z=np.r_[ids[:,1:][eh],ids[1:,:][ev]]
    axis=np.array(TF.transform(-75.674,44.579))-(ka+kb)/2
    axis=axis/np.linalg.norm(axis)
    along=(xx-(ka[0]+kb[0])/2)*axis[0]+(yy-(ka[1]+kb[1])/2)*axis[1]
    return dict(x=x,y=y,xx=xx,yy=yy,wet=wet,bed=bed,inlet=inlet,outlet=outlet,
                ids=ids,a=a,z=z,eh=eh,ev=ev,j=j,i=i,along=along,
                dx=float(x[1]-x[0]))


def gradients(eta,d):
    a,z=d['a'],d['z']; dx=d['dx']; nh=d['eh'].sum()
    vx=np.zeros(eta.size); vy=np.zeros(eta.size)
    nx=np.zeros(eta.size); ny=np.zeros(eta.size)
    dd=(eta[z]-eta[a])/dx
    np.add.at(vx,a[:nh],dd[:nh]); np.add.at(vx,z[:nh],dd[:nh])
    np.add.at(nx,a[:nh],1); np.add.at(nx,z[:nh],1)
    np.add.at(vy,a[nh:],dd[nh:]); np.add.at(vy,z[nh:],dd[nh:])
    np.add.at(ny,a[nh:],1); np.add.at(ny,z[nh:],1)
    return vx/np.maximum(nx,1),vy/np.maximum(ny,1)


def solve(d,k,b,n=.030,tolerance=1e-8,maxiter=100):
    t0=time.time(); wet=d['wet']; N=wet.sum(); a,z=d['a'],d['z']; dx=d['dx']
    bc=(d['inlet']|d['outlet'])[wet]; bcval=np.where(d['inlet'][wet],k,b)
    along=d['along'][wet]; lo=np.mean(along[d['inlet'][wet]]); hi=np.mean(along[d['outlet'][wet]])
    eta=k-(k-b)*np.clip((along-lo)/(hi-lo),0,1); eta[bc]=bcval[bc]
    bed=d['bed'][wet]; inner=np.flatnonzero(~bc); fixed=np.flatnonzero(bc)
    precon=None; history=[]
    for it in range(maxiter):
        h=np.maximum(eta-bed,.12)
        gx,gy=gradients(eta,d)
        slope=np.sqrt(gx*gx+gy*gy+1e-16)
        # Hydraulic conductivity evaluated on faces, harmonic depth captures
        # shallow sills rather than averaging them away with a deep neighbour.
        hf=2*h[a]*h[z]/(h[a]+h[z])
        sf=np.sqrt((slope[a]**2+slope[z]**2)/2)
        conductance=hf**(5/3)/(n*np.sqrt(sf))
        diag=np.bincount(a,weights=conductance,minlength=N)+np.bincount(z,weights=conductance,minlength=N)
        A=sparse.coo_matrix((np.r_[diag,-conductance,-conductance],
                            (np.r_[np.arange(N),a,z],np.r_[np.arange(N),z,a])),shape=(N,N)).tocsr()
        # Solve relative head to avoid a 74 m vertical-datum offset dominating
        # a 0.28 m driving head in the iterative solver's relative tolerance.
        Ai=A[inner][:,inner]; rhs=-(A[inner][:,fixed]@(bcval[fixed]-b))
        if precon is None or it in (8,24,48):
            precon=pyamg.smoothed_aggregation_solver(Ai,symmetry='symmetric').aspreconditioner()
        solution,info=cg(Ai,rhs,x0=eta[inner]-b,M=precon,rtol=1e-11,atol=1e-9,maxiter=600)
        if info: print('cg-info',info,flush=True)
        new=eta.copy(); new[inner]=solution+b
        change=float(np.max(np.abs(new-eta)))
        eta=.8*new+.2*eta; eta[bc]=bcval[bc]
        # Residual is evaluated using the *updated* nonlinear conductivity.
        flux=conductance*(eta[a]-eta[z])
        div=np.bincount(a,weights=flux,minlength=N)-np.bincount(z,weights=flux,minlength=N)
        rel=float(np.sum(np.abs(div[inner]))/max(np.sum(np.abs(div[bc])),1))
        history.append(dict(iteration=it,stage_change_m=change,lagged_continuity_l1_relative=rel))
        if it%5==0: print(f'iteration {it}: deta {change:.3g} m residual {rel:.3g}, {time.time()-t0:.1f}s',flush=True)
        if change<tolerance and it>5: break
    # Re-evaluate face flux at the final stage, not the lagged iterate.
    h=np.maximum(eta-bed,.12); gx,gy=gradients(eta,d)
    slope=np.sqrt(gx*gx+gy*gy+1e-16)
    hf=2*h[a]*h[z]/(h[a]+h[z]); sf=np.sqrt((slope[a]**2+slope[z]**2)/2)
    K=hf**(5/3)/(n*np.sqrt(sf)); flux=K*(eta[a]-eta[z])
    div=np.bincount(a,weights=flux,minlength=N)-np.bincount(z,weights=flux,minlength=N)
    qi=float(div[d['inlet'][wet]].sum()); qo=float(-div[d['outlet'][wet]].sum())
    nh=d['eh'].sum(); qx=np.zeros(wet.shape); qy=np.zeros(wet.shape); countx=np.zeros(wet.shape); county=np.zeros(wet.shape)
    # Cell-centred discharge averages only existing wet faces. At a wall the
    # absent normal flux is zero, so divide by both faces, not by wetface count.
    qface=flux/dx
    np.add.at(qx,(d['j'][a[:nh]],d['i'][a[:nh]]),qface[:nh]/2)
    np.add.at(qx,(d['j'][z[:nh]],d['i'][z[:nh]]),qface[:nh]/2)
    np.add.at(qy,(d['j'][a[nh:]],d['i'][a[nh:]]),qface[nh:]/2)
    np.add.at(qy,(d['j'][z[nh:]],d['i'][z[nh:]]),qface[nh:]/2)
    eta2=np.full(wet.shape,np.nan); eta2[wet]=eta
    depth=np.full(wet.shape,np.nan); depth[wet]=h
    u=np.where(wet,qx/depth,np.nan); v=np.where(wet,qy/depth,np.nan)
    residual=float(np.max(np.abs(div[inner])))
    report=dict(method='steady nonlinear Manning finite-volume diffusion-wave approximation',
                n=n,cell_size_m=dx,wet_cells=int(N),inlet_cells=int(d['inlet'].sum()),outlet_cells=int(d['outlet'].sum()),
                kingston_stage_m=k,brockville_stage_m=b,discharge_in_m3s=qi,discharge_out_m3s=qo,
                relative_boundary_flux_error=abs(qi-qo)/max(abs(qi),1),
                maximum_cell_continuity_residual_m3s=residual,
                minimum_actual_water_depth_m=float(np.min(eta-bed)),
                cells_requiring_depth_floor=int(np.sum(eta-bed<.12)),
                speed_percentiles_mps=np.percentile(np.hypot(u[wet],v[wet]),[0,25,50,75,95,99,100]).tolist(),
                iterations=history,wall_seconds=time.time()-t0)
    return dict(eta=eta2,depth=depth,u=u,v=v,face_flux=flux,report=report)


def save(d,r,path):
    np.savez_compressed(path,x=d['x'],y=d['y'],wet=d['wet'],inlet=d['inlet'],outlet=d['outlet'],
                        bed=d['bed'],eta=r['eta'],depth=r['depth'],u=r['u'],v=r['v'],
                        face_flux=r['face_flux'])
    path.with_suffix('.json').write_text(json.dumps(r['report'],indent=2))


if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('grid'); p.add_argument('--stride',type=int,default=1)
    p.add_argument('--n',type=float,default=.030); p.add_argument('--bed-shift',type=float,default=0)
    p.add_argument('--head-drop',type=float,default=None)
    p.add_argument('--out',default=str(ROOT/'dwe-solution.npz')); args=p.parse_args()
    data=np.load(args.grid); d=domain(data,args.stride,args.bed_shift); k,b,Q=stages()
    if args.head_drop is not None:k=b+args.head_drop
    r=solve(d,k,b,args.n); r['report']['regulation_discharge_scenario_m3s']=Q
    r['report']['input_grid_path']=str(args.grid)
    r['report']['input_grid_sha256']=hashlib.sha256(Path(args.grid).read_bytes()).hexdigest()
    r['report']['n_required_for_regulation_Q']=args.n*r['report']['discharge_in_m3s']/Q
    save(d,r,Path(args.out)); print(json.dumps({k:v for k,v in r['report'].items() if k!='iterations'},indent=2),flush=True)
