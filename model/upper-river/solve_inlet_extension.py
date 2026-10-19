"""Separately solved western inlet extension; frozen original is untouched."""
from pathlib import Path
import argparse,sys,subprocess,json,hashlib
import numpy as np
from scipy import ndimage
ROOT=Path(__file__).resolve().parent;MODEL=ROOT
sys.path.insert(0,str(MODEL))
from solve_hydraulics import TF,stages,solve,save


def extended_domain(data,padding):
    x=data['x'];y=data['y'];xx,yy=np.meshgrid(x,y)
    wet=data['wet_geometry'].astype(bool);bed=data['bed_igld85_estimated'].copy()
    wet &= np.isfinite(bed)
    ka=np.array(TF.transform(-76.484,44.224));kb=np.array(TF.transform(-76.333,44.128))
    oa=np.array(TF.transform(-75.686,44.592));ob=np.array(TF.transform(-75.659,44.565))
    mid=np.array(TF.transform(-76.02,44.33))
    def msign(a,b):return np.sign((mid[0]-a[0])*(b[1]-a[1])-(mid[1]-a[1])*(b[0]-a[0]))
    normal=np.array([kb[1]-ka[1],-(kb[0]-ka[0])])*msign(ka,kb);normal/=np.linalg.norm(normal)
    ka-=padding*normal;kb-=padding*normal
    def side(a,b):return(xx-a[0])*(b[1]-a[1])-(yy-a[1])*(b[0]-a[0])
    inside_i=side(ka,kb)*msign(ka,kb)>=0;inside_o=side(oa,ob)*msign(oa,ob)>=0
    wet &= inside_i&inside_o
    k,b,_=stages();wet &= (min(k,b)-bed)>.12
    structure=ndimage.generate_binary_structure(2,1)
    inlet=wet&ndimage.binary_dilation(~inside_i,structure=structure);outlet=wet&ndimage.binary_dilation(~inside_o,structure=structure)
    labels,_=ndimage.label(wet,structure=structure);live=np.intersect1d(np.unique(labels[inlet]),np.unique(labels[outlet]));live=live[live>0]
    if not len(live):raise RuntimeError('No wet path links inlet and outlet')
    wet &= np.isin(labels,live);inlet &= wet;outlet &= wet
    ids=np.full(wet.shape,-1,dtype=np.int32);ids[wet]=np.arange(wet.sum());j,i=np.where(wet)
    eh=wet[:,:-1]&wet[:,1:];ev=wet[:-1,:]&wet[1:,:]
    a=np.r_[ids[:,:-1][eh],ids[:-1,:][ev]];z=np.r_[ids[:,1:][eh],ids[1:,:][ev]]
    axis=np.array(TF.transform(-75.674,44.579))-(ka+kb)/2;axis/=np.linalg.norm(axis)
    along=(xx-(ka[0]+kb[0])/2)*axis[0]+(yy-(ka[1]+kb[1])/2)*axis[1]
    return dict(x=x,y=y,xx=xx,yy=yy,wet=wet,bed=bed,inlet=inlet,outlet=outlet,ids=ids,a=a,z=z,eh=eh,ev=ev,j=j,i=i,along=along,dx=float(x[1]-x[0])),inside_i&inside_o


def main():
    p=argparse.ArgumentParser();p.add_argument('--inlet-pad-m','--padding-m',dest='padding_m',type=float,default=1000)
    p.add_argument('--input',default=None);p.add_argument('--out-dir',default=None);args=p.parse_args()
    CASE=Path(args.out_dir) if args.out_dir else ROOT/f'inlet-pad-{int(args.padding_m)}m';CASE.mkdir(exist_ok=True)
    compact=MODEL/'inputs/bathymetry-grid-50m.npz'
    original=Path(args.input)if args.input else(compact if compact.exists()else MODEL/'bathymetry-grid-50m.npz');raw=np.load(original)
    # Derive the new cut mask from genuine geometry before estimating missing
    # bank bed. A placeholder finite bed here only obtains the geometric cut;
    # actual retrieved bed and its NaNs are retained in the prepared input.
    temp={k:raw[k]for k in raw.files};temp['bed_igld85_estimated']=np.zeros_like(raw['bed_igld85_estimated'])
    geometric,_=extended_domain(temp,args.padding_m)
    keys=['x','y','bed_igld85_estimated','wet_geometry','measured_bathy','mean_stage_igld85_estimated','bathy_source_product','source_subsample_count']
    source={k:raw[k]for k in keys if k in raw.files};source['proposed_active_corridor']=geometric['wet']
    sourcepath=CASE/'source-50m.npz';np.savez_compressed(sourcepath,**source)
    bedpath=CASE/'bank-bed-harmonic-50m.npz'
    bedscript=ROOT/'estimate_bank_bed_open.py'
    if not bedscript.exists():raise RuntimeError('estimate_bank_bed_open.py must accompany this inlet-extension runner')
    subprocess.run([sys.executable,str(bedscript),str(sourcepath),'--out',str(bedpath)],check=True)
    data=np.load(bedpath);d,_=extended_domain(data,args.padding_m);k,b,Q=stages()
    r=solve(d,k,b,.03);r['report'].update(inlet_padding_m=args.padding_m,
         boundary_assumption=f'Same observed mean Kingston lake stage imposed at a genuinely solved cross-section {args.padding_m:g}m west of the original cut; NOT vector extrapolation.',
         input_grid_path=str(sourcepath),input_grid_sha256=hashlib.sha256(sourcepath.read_bytes()).hexdigest(),
         prepared_bed_sha256=hashlib.sha256(bedpath.read_bytes()).hexdigest(),
         regulation_discharge_scenario_m3s=Q,n_required_for_regulation_Q=.03*r['report']['discharge_in_m3s']/Q)
    save(d,r,CASE/'dwe-native-50m.npz')
    subprocess.run([sys.executable,str(MODEL/'calibrate_uniform_roughness.py'),str(CASE/'dwe-native-50m.npz'),'--out',str(CASE/'dwe-calibrated-50m.npz')],check=True)
    subprocess.run([sys.executable,str(MODEL/'export_display.py'),str(CASE/'dwe-calibrated-50m.npz'),'--out',str(CASE/'display-field.json')],check=True)
    subprocess.run([sys.executable,str(MODEL/'audit_solution.py'),str(CASE/'dwe-calibrated-50m.npz'),str(bedpath),'--out',str(CASE/'audit.json')],check=True)


if __name__=='__main__':main()
