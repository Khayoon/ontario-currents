"""Compare assumptions and discretization. This cannot assess field accuracy."""
from pathlib import Path
import json
import numpy as np
from scipy.interpolate import RegularGridInterpolator
from scipy.ndimage import binary_erosion

ROOT=Path(__file__).resolve().parent

def statistics(a,b,mask):
    au,av=a;bu,bv=b
    sq=np.square(au[mask]-bu[mask])+np.square(av[mask]-bv[mask]);base=np.square(au[mask])+np.square(av[mask])
    aa=np.r_[au[mask],av[mask]];bb=np.r_[bu[mask],bv[mask]]
    return {'cells':int(mask.sum()),'vectorDifferenceRmsMps':float(np.sqrt(sq.mean())),'relativeVectorL2Difference':float(np.sqrt(sq.sum()/base.sum())),'componentCorrelation':float(np.corrcoef(aa,bb)[0,1]),'maxVectorDifferenceMps':float(np.sqrt(sq.max()))}

def main():
    grid=np.load(ROOT/'grid.npz');wet=grid['wet'];base=np.load(ROOT/'longer-spinup-fields.npz');ref=(base['mean_u'],base['mean_v'])
    report={'interpretation':'Numerical and assumption sensitivity only; these are not confidence intervals or validation against measured currents.','baseline':'longer-spinup,500m,dt10s,Cbottom0.0025,history1Oct05Z,mean12Oct00Z–17Oct12Z','comparisons':{}}
    for label,name in [('initialHistory48h','prototype'),('timeStep5s','timestep5'),('bottomDrag0.0015','drag-low'),('bottomDrag0.004','drag-high')]:
        q=np.load(ROOT/(name+'-fields.npz'));report['comparisons'][label]=statistics(ref,(q['mean_u'],q['mean_v']),wet)
    coarse_grid=np.load(ROOT/'grid600.npz');coarse=np.load(ROOT/'resolution600-fields.npz');sites=np.column_stack((grid['lat'].ravel(),grid['lon'].ravel()))
    axes=(coarse_grid['lat'][:,0],coarse_grid['lon'][0,:])
    coverage=RegularGridInterpolator(axes,coarse_grid['wet'].astype(float),bounds_error=False,fill_value=0)(sites).reshape(wet.shape)
    mask=binary_erosion(wet,iterations=2)&(coverage>1-1e-10)
    cu=RegularGridInterpolator(axes,coarse['mean_u'],bounds_error=False,fill_value=np.nan)(sites).reshape(wet.shape)
    cv=RegularGridInterpolator(axes,coarse['mean_v'],bounds_error=False,fill_value=np.nan)(sites).reshape(wet.shape)
    report['comparisons']['grid600mInterior']=statistics(ref,(cu,cv),mask)
    report['comparisons']['grid600mInterior']['selection']='500m wet mask eroded2cells, with all4 coarse interpolation corners wet; excludes shoreline geometry changes.'
    (ROOT/'sensitivity.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report,indent=2))

if __name__=='__main__':main()
