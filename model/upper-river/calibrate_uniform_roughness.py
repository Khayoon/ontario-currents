"""Exact uniform-n scaling of the converged DWE solution; Q is calibration."""
import argparse,json,hashlib
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('--out',required=True);p.add_argument('--target',type=float,default=7377.58);args=p.parse_args()
source=Path(args.input);a=np.load(source);data={k:a[k] for k in a.files};r=json.loads(source.with_suffix('.json').read_text())
ratio=args.target/r['discharge_in_m3s'];newn=r['n']/ratio
if not .015<=newn<=.060: raise RuntimeError(f'Implausible effective Manning n: {newn}')
for key in ['u','v','face_flux']:data[key]*=ratio
np.savez_compressed(args.out,**data)
report=dict(r);report.update(n=newn,calibrated_to='IJC regulation-discharge schedule scenario, NOT observed current validation',
    original_solution=str(source),original_solution_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    calibration='Uniform Manning n algebraically rescales all DWE fluxes; stage and depth solution unchanged because n factors out of continuity.',
    discharge_in_m3s=r['discharge_in_m3s']*ratio,discharge_out_m3s=r['discharge_out_m3s']*ratio,
    maximum_cell_continuity_residual_m3s=r['maximum_cell_continuity_residual_m3s']*ratio,
    speed_percentiles_mps=[v*ratio for v in r['speed_percentiles_mps']])
Path(args.out).with_suffix('.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:report[k] for k in ['n','discharge_in_m3s','discharge_out_m3s','relative_boundary_flux_error']},indent=2))
