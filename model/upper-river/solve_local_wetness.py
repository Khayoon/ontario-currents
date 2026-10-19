"""Isolated active-set DWE solve using local hydraulic water levels.

The prior global Brockville-stage wet mask can exclude genuinely wet upstream
shoals. Geometry, prepared bed, measured depths and prescribed stages stay fixed.
Start with the maximum possible hydraulic stage; repeatedly solve and activate/
deactivate connected wet cells until actual local depths satisfy the wet margin.
"""
from pathlib import Path
import argparse,sys,json,hashlib,subprocess,time
import numpy as np
from scipy import ndimage
ROOT=Path(__file__).resolve().parent;MODEL=ROOT;PAD=ROOT
sys.path.insert(0,str(MODEL));sys.path.insert(0,str(PAD))
from solve_hydraulics import solve,save,stages
from solve_inlet_extension import extended_domain


def build_domain(base,bed,mask):
    wet=mask.copy();struct=ndimage.generate_binary_structure(2,1)
    inlet=wet&base['inlet'];outlet=wet&base['outlet'];labels,_=ndimage.label(wet,struct)
    # A component must be stage-anchored. Components attached to just one stage
    # remain valid and have zero net hydraulic flow; unanchored puddles cannot
    # acquire an arbitrary current or level.
    live=np.unique(labels[inlet|outlet]);live=live[live>0];wet &= np.isin(labels,live)
    inlet &=wet;outlet &=wet
    ids=np.full(wet.shape,-1,dtype=np.int32);ids[wet]=np.arange(wet.sum());j,i=np.where(wet)
    eh=wet[:,:-1]&wet[:,1:];ev=wet[:-1,:]&wet[1:,:]
    a=np.r_[ids[:,:-1][eh],ids[:-1,:][ev]];z=np.r_[ids[:,1:][eh],ids[1:,:][ev]]
    return {**base,'wet':wet,'bed':bed,'inlet':inlet,'outlet':outlet,'ids':ids,'j':j,'i':i,'eh':eh,'ev':ev,'a':a,'z':z}


def main():
    p=argparse.ArgumentParser();p.add_argument('--wet-depth-m',type=float,default=.12);p.add_argument('--rewet-hysteresis-m',type=float,default=.01)
    p.add_argument('--max-active-iterations',type=int,default=12);p.add_argument('--inlet-pad-m',type=float,default=3000)
    p.add_argument('--source',default=None);p.add_argument('--prepared-bed',default=None);p.add_argument('--out-dir',default=None);args=p.parse_args()
    if args.wet_depth_m<.12:raise ValueError('Wet threshold cannot be lower than the core solver .12m depth regularization')
    CASE=Path(args.out_dir)if args.out_dir else ROOT/'local-stage-active-set';CASE.mkdir(exist_ok=True)
    compact=MODEL/'inputs/bathymetry-grid-50m.npz'
    sourcepath=Path(args.source)if args.source else compact
    if args.prepared_bed:bedpath=Path(args.prepared_bed)
    else:
        bedpath=CASE/'prepared-bed.npz'
        subprocess.run([sys.executable,str(PAD/'estimate_bank_bed_open.py'),str(sourcepath),'--out',str(bedpath)],check=True)
    src=np.load(sourcepath);prepared=np.load(bedpath);bed=prepared['bed_igld85_estimated'].copy();k,b,Q=stages()
    temp={key:src[key]for key in src.files};temp['bed_igld85_estimated']=np.zeros_like(bed)
    base,_=extended_domain(temp,args.inlet_pad_m);geometry=base['wet']&np.isfinite(bed)
    upper=geometry&((k-bed)>args.wet_depth_m)
    # The downstream prescribed stage is known exactly, so do not initially
    # flood an outlet cell using the upstream upper-bound level.
    upper &= ~base['outlet']|((b-bed)>args.wet_depth_m)
    mask=upper.copy();history=[];t0=time.time();structure=ndimage.generate_binary_structure(2,1)
    for iteration in range(args.max_active_iterations):
        d=build_domain(base,bed,mask);r=solve(d,k,b,.03)
        eta=r['eta'];depth=eta-bed
        remove=d['wet']&(depth<args.wet_depth_m-1e-8)
        # Rewet only through an actual orthogonal water face, using the solved
        # connected neighbour's stage. No across-land nearest-stage filling.
        local=ndimage.maximum_filter(np.where(d['wet'],eta,-np.inf),footprint=structure,mode='constant',cval=-np.inf)
        adjacent=ndimage.binary_dilation(d['wet'],structure)&~d['wet']
        activate=upper&adjacent&((local-bed)>(args.wet_depth_m+args.rewet_hysteresis_m))
        activate &= ~base['outlet']|((b-bed)>args.wet_depth_m+args.rewet_hysteresis_m)
        newmask=(d['wet']&~remove)|activate
        newmask=build_domain(base,bed,newmask)['wet']
        change=int(np.sum(newmask!=d['wet']))
        row=dict(iteration=iteration,wet_cells=int(d['wet'].sum()),removed_shallow_cells=int(remove.sum()),activated_connected_cells=int(activate.sum()),
            mask_changed_cells=change,minimum_actual_depth_m=float(np.nanmin(depth)),cells_using_floor=int(np.sum(d['wet']&(depth<.12))),
            max_depth_of_inactive_adjacent_candidate_m=float(np.max((local-bed)[upper&adjacent]))if np.any(upper&adjacent)else None,
            discharge_m3s=r['report']['discharge_in_m3s'],boundary_flux_error=r['report']['relative_boundary_flux_error'])
        history.append(row);print('ACTIVE_SET',json.dumps(row),flush=True)
        r['report'].update(active_set_iteration=iteration,wetting_method='Maximum-stage initial candidate; local solved-depth pruning and connected-neighbour rewetting with hysteresis.',
            wet_depth_threshold_m=args.wet_depth_m,rewet_hysteresis_m=args.rewet_hysteresis_m,inlet_padding_m=args.inlet_pad_m,
            regulation_discharge_scenario_m3s=Q,n_required_for_regulation_Q=.03*r['report']['discharge_in_m3s']/Q)
        save(d,r,CASE/f'iteration-{iteration:02d}.npz')
        (CASE/'active-set-history.json').write_text(json.dumps(dict(history=history,source_sha256=hashlib.sha256(sourcepath.read_bytes()).hexdigest(),
            prepared_bed_sha256=hashlib.sha256(bedpath.read_bytes()).hexdigest(),wall_seconds=time.time()-t0),indent=2))
        if not change:
            if r['report']['cells_requiring_depth_floor']:
                raise RuntimeError('Stable mask still needs depth floor')
            save(d,r,CASE/'dwe-native-50m.npz');break
        mask=newmask
    else:raise RuntimeError('Active wet/dry mask did not converge')
    subprocess.run([sys.executable,str(MODEL/'calibrate_uniform_roughness.py'),str(CASE/'dwe-native-50m.npz'),'--out',str(CASE/'dwe-calibrated-50m.npz')],check=True)
    subprocess.run([sys.executable,str(MODEL/'export_display.py'),str(CASE/'dwe-calibrated-50m.npz'),'--out',str(CASE/'display-field.json')],check=True)
    subprocess.run([sys.executable,str(MODEL/'audit_solution.py'),str(CASE/'dwe-calibrated-50m.npz'),str(bedpath),'--out',str(CASE/'audit.json')],check=True)


if __name__=='__main__':main()
