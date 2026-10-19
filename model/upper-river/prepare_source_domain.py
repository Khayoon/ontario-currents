"""Reproduce a computational cut from unchanged source water and depth arrays."""
from pathlib import Path
import argparse,json,hashlib
import numpy as np
from solve_inlet_extension import extended_domain

p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--inlet-pad-m',type=float,default=3000)
p.add_argument('--out');p.add_argument('--check',action='store_true');args=p.parse_args()
source=Path(args.input);a=np.load(source);values={k:a[k]for k in a.files}
temporary=dict(values);temporary['bed_igld85_estimated']=np.zeros_like(values['bed_igld85_estimated'])
domain,_=extended_domain(temporary,args.inlet_pad_m);mask=domain['wet']
if args.check:assert np.array_equal(mask,a['proposed_active_corridor']),'Retained mask differs from reproduced geometric cut'
values['proposed_active_corridor']=mask
if args.out:np.savez_compressed(args.out,**values)
print(json.dumps({'input':source.name,'input_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'inlet_padding_m':args.inlet_pad_m,'geometric_cells':int(mask.sum()),'retained_mask_matches':bool(np.array_equal(mask,a['proposed_active_corridor'])),
    'all_other_arrays_unchanged':True},indent=2))
