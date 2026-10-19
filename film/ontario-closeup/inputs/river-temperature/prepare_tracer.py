"""Separate passive-temperature estimate. Never modifies the frozen inputs."""
import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np
from scipy import ndimage, sparse
from scipy.sparse.linalg import spsolve_triangular

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[1]
from pyproj import Transformer

MODEL = ROOT.parents[3] / 'model/upper-river'
HOURLY = ROOT.parent / 'hourly'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False) + '\n', encoding='utf-8')


def load_inputs():
    data = np.load(MODEL / 'dwe-calibrated-50m.npz')
    wet = data['wet']
    n = int(wet.sum())
    ids = np.full(wet.shape, -1, dtype=np.int32)
    ids[wet] = np.arange(n)
    eh = wet[:, :-1] & wet[:, 1:]
    ev = wet[:-1, :] & wet[1:, :]
    a = np.r_[ids[:, :-1][eh], ids[:-1, :][ev]]
    z = np.r_[ids[:, 1:][eh], ids[1:, :][ev]]
    q = data['face_flux']
    assert len(q) == len(a)
    src = np.where(q >= 0, a, z)
    dst = np.where(q >= 0, z, a)
    flow = np.abs(q)
    incoming = np.bincount(dst, weights=flow, minlength=n)
    outgoing = np.bincount(src, weights=flow, minlength=n)
    div = outgoing - incoming
    inlet, outlet = data['inlet'][wet], data['outlet'][wet]
    boundary = inlet | outlet
    external_in = np.where(boundary, np.maximum(div, 0), 0)
    external_out = np.where(boundary, np.maximum(-div, 0), 0)
    residual = outgoing + external_out - incoming - external_in
    volume = data['depth'][wet] * float(data['x'][1] - data['x'][0]) ** 2
    order = np.argsort(-data['eta'][wet], kind='stable')
    rank = np.empty(n, dtype=np.int32)
    rank[order] = np.arange(n)
    nonzero = flow > 0
    assert np.all(rank[src[nonzero]] < rank[dst[nonzero]])
    inflow_ids=np.flatnonzero(external_in>0)
    graph=sparse.coo_matrix((np.ones(int(nonzero.sum())+len(inflow_ids),dtype=np.int8),
        (np.r_[src[nonzero],np.full(len(inflow_ids),n)],np.r_[dst[nonzero],inflow_ids])),
        shape=(n+1,n+1)).tocsr()
    reached=sparse.csgraph.breadth_first_order(graph,n,directed=True,return_predecessors=False)
    reachable=np.zeros(n+1,dtype=bool);reachable[reached]=True;reachable=reachable[:n]
    xx, yy = np.meshgrid(data['x'], data['y'])
    to_ll = Transformer.from_crs(32618, 4326, always_xy=True)
    lon, lat = to_ll.transform(xx[wet], yy[wet])
    return dict(data=data, wet=wet, n=n, ids=ids, src=src, dst=dst, flow=flow,
                incoming=incoming, outgoing=outgoing, div=div, inlet=inlet,
                outlet=outlet, external_in=external_in, external_out=external_out,
                residual=residual, volume=volume, order=order, rank=rank,
                lon=lon, lat=lat, reachable=reachable)


def inlet_temperatures(d):
    import matplotlib.tri as mtri
    mesh = json.loads((HOURLY / 'mesh.json').read_text(encoding='utf-8'))
    meta = json.loads((HOURLY / 'manifest.json').read_text(encoding='utf-8'))
    lon, lat = np.asarray(mesh['lon']), np.asarray(mesh['lat'])
    tri = np.asarray(mesh['triangles'], dtype=np.int32)
    inflow_ids = np.flatnonzero(d['external_in'] > 0)
    triangulation = mtri.Triangulation(lon, lat, tri)
    face = triangulation.get_trifinder()(d['lon'][inflow_ids], d['lat'][inflow_ids])
    covered = face >= 0
    bad = inflow_ids[~covered]
    save_json(ROOT / 'uncovered-boundary.json', dict(count=len(bad),
              lon=d['lon'][bad].tolist(), lat=d['lat'][bad].tolist(),
              inflow_m3_s=d['external_in'][bad].tolist(),
              inflow_fraction=float(d['external_in'][bad].sum()/d['external_in'].sum()),
              treatment='Contemporaneous discharge-weighted mean of the directly NOAA-covered inlet cells; boundary approximation, not an observation.'))
    nodes = tri[face[covered]]
    px, py = d['lon'][inflow_ids[covered]], d['lat'][inflow_ids[covered]]
    x0, x1, x2 = lon[nodes].T
    y0, y1, y2 = lat[nodes].T
    det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
    w0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / det
    w1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / det
    weights = np.column_stack([w0, w1, 1 - w0 - w1])
    assert weights.min() > -1e-9 and weights.max() < 1 + 1e-9
    temperatures = np.memmap(HOURLY / 't.f32', dtype='<f4', mode='r', shape=(169, len(lon)))
    covered_t = (temperatures[:, nodes].astype(np.float64) * weights).sum(axis=2)
    covered_q = d['external_in'][inflow_ids[covered]]
    weighted = covered_t @ (covered_q / covered_q.sum())
    boundary_t = np.broadcast_to(weighted[:, None], (169, len(inflow_ids))).copy()
    boundary_t[:, covered] = covered_t
    assert np.isfinite(boundary_t).all()
    np.savez_compressed(ROOT / 'inlet-temperature.npz', native_ids=inflow_ids,
                        native_lon=d['lon'][inflow_ids], native_lat=d['lat'][inflow_ids],
                        noaa_covered=covered, noaa_faces=face, noaa_nodes=nodes,
                        barycentric_weights=weights, temperature=boundary_t,
                        discharge_weighted_mean=weighted)
    return inflow_ids, boundary_t, weighted, meta


def display_mapping(d):
    path = MODEL / 'display-field.json'
    field = json.loads(path.read_text(encoding='utf-8'))
    width, height = field['width'], field['height']
    lon, lat = np.meshgrid(field['west'] + np.arange(width) * field['dx'],
                          field['south'] + np.arange(height) * field['dy'])
    to_xy = Transformer.from_crs(4326, 32618, always_xy=True)
    tx, ty = to_xy.transform(lon, lat)
    spacing = float(d['data']['x'][1] - d['data']['x'][0])
    coords = [(ty - d['data']['y'][0]) / spacing, (tx - d['data']['x'][0]) / spacing]
    mapped = ndimage.map_coordinates(d['ids'], coords, order=0, mode='constant', cval=-1)
    original_valid = np.array([v is not None for v in field['u']], dtype=bool).reshape(height, width)
    assert np.array_equal(mapped >= 0, original_valid)
    native_ids = mapped[original_valid]
    index = np.full((height, width), -1, dtype='<i4')
    index[original_valid] = np.arange(original_valid.sum(), dtype=np.int32)
    assert original_valid.sum() == field['validCells'] == 121644
    index.tofile(ROOT / 'index-map.i32')
    return field, native_ids, index


def audit_inputs(d, inflow_ids, boundary_t, weighted, field):
    inner = ~(d['inlet'] | d['outlet'])
    rate = d['residual'] / d['volume']
    report = dict(
        native_shape=list(d['wet'].shape), native_wet_cells=d['n'],
        native_face_count=len(d['flow']), native_cell_size_m=50,
        grid_crs='EPSG:32618', volume_total_m3=float(d['volume'].sum()),
        volume_min_m3=float(d['volume'].min()),
        boundary=dict(inflow_cells=len(inflow_ids), outflow_cells=int(np.count_nonzero(d['external_out'])),
                      external_inflow_m3_s=float(d['external_in'].sum()),
                      external_outflow_m3_s=float(d['external_out'].sum()),
                      reverse_inlet_cells=int(np.count_nonzero(d['inlet'] & (d['external_out'] > 0))),
                      reverse_outlet_cells=int(np.count_nonzero(d['outlet'] & (d['external_in'] > 0))),
                      noaa_temperature_covered_cells=int(np.count_nonzero(np.load(ROOT/'inlet-temperature.npz')['noaa_covered'])),
                      noaa_temperature_covered_inflow_fraction=1.0-json.loads((ROOT/'uncovered-boundary.json').read_text())['inflow_fraction'],
                      uncovered_cell_treatment='Covered-inflow hourly discharge-weighted mean applied only to uncovered nearshore boundary cell.',
                      boundary_temperature_min_c=float(boundary_t.min()),
                      boundary_temperature_max_c=float(boundary_t.max()),
                      first_discharge_weighted_mean_c=float(weighted[0]),
                      hourly_discharge_weighted_mean_range_c=[float(weighted.min()), float(weighted.max())]),
        continuity=dict(max_interior_absolute_residual_m3_s=float(np.abs(d['residual'][inner]).max()),
                        l1_interior_residual_m3_s=float(np.abs(d['residual'][inner]).sum()),
                        signed_interior_residual_m3_s=float(d['residual'][inner].sum()),
                        max_absolute_residual_over_volume_per_second=float(np.abs(rate).max()),
                        worst_uniform_16c_initial_derivative_c_per_week=float(np.abs(16*rate).max()*604800)),
        zero_internal_throughflow_cells=int(np.count_nonzero((d['incoming']+d['outgoing'])==0)),
        positive_flow_inlet_unreachable_cells=int(np.count_nonzero(~d['reachable'])),
        positive_flow_inlet_unreachable_volume_fraction=float(d['volume'][~d['reachable']].sum()/d['volume'].sum()),
        display=dict(width=field['width'], height=field['height'], compact_wet_cells=field['validCells'],
                     exact_original_mask=True, native_sampling='nearest, identical frozen export_display.py mapping'),
        source_hashes=dict(hydraulic_npz=sha(MODEL / 'dwe-calibrated-50m.npz'),
                           river_display_field=sha(MODEL / 'display-field.json'),
                           hourly_manifest=sha(HOURLY / 'manifest.json'), hourly_t=sha(HOURLY / 't.f32'),
                           hourly_u=sha(HOURLY / 'u.f32'),hourly_v=sha(HOURLY / 'v.f32'),
                           hourly_mesh=sha(HOURLY / 'mesh.json')))
    save_json(ROOT / 'input-audit.json', report)
    return report


def transport(d, inlet_ids, boundary_t, initial_t, dt, label, export_ids=None, uniform=False):
    """Implicit donor-cell advection, plus explicit continuity-residual ledger.

    V*dT/dt = sum(q_in*T_up) + Qext_in*Tin - sum(q_out*T)
               - Qext_out*T + residual*T.
    residual = q_out + Qext_out - q_in - Qext_in is the unchanged
    hydraulic solution's numerical continuity residual, not physical heat.
    Including it avoids dependence on whether temperature uses C or K.
    It is retained explicitly in the inventory accounting below.
    """
    start = time.perf_counter()
    n, order, rank = d['n'], d['order'], d['rank']
    denominator = d['volume'] / dt + d['incoming'] + d['external_in']
    nz = d['flow'] > 0
    matrix = sparse.coo_matrix(
        (-d['flow'][nz] / denominator[d['dst'][nz]],
         (rank[d['dst'][nz]], rank[d['src'][nz]])), shape=(n, n)).tocsr()
    matrix = matrix + sparse.eye(n, format='csr')
    time_weight = (d['volume'] / dt / denominator)[order]
    boundary_weight = (d['external_in'] / denominator)[order]
    # Columns T and I (fraction of initially assumed water) share the operator.
    state = np.column_stack([np.full(n, initial_t), np.ones(n)])
    if uniform:
        state = np.column_stack([np.full(n, 16.0), np.full(n, 289.15)])
    states = []
    fraction_summaries = []
    ledger = []
    total_steps = int(604800 / dt)
    assert total_steps * dt == 604800 and 3600 % dt == 0
    previous_inventory = state.T @ d['volume']
    source_range = [16.0,16.0] if uniform else [min(float(boundary_t.min()), initial_t), max(float(boundary_t.max()), initial_t)]
    minimum, maximum = float(state[:, 0].min()), float(state[:, 0].max())
    maximum_step_ledger_error = np.zeros(2)
    cumulative_ledger_error = np.zeros(2)
    accumulated_flux = np.zeros(2)
    accumulated_residual = np.zeros(2)
    uniform_error, offset_error = 0.0, 0.0
    for step in range(total_steps + 1):
        if step % (3600 // dt) == 0:
            hour = step // (3600 // dt)
            if export_ids is not None:
                states.append(state[export_ids, 0].astype('<f4'))
            initial = state[:, 1] if not uniform else np.ones(n)
            display_initial = initial[export_ids] if export_ids is not None else initial
            fraction_summaries.append(dict(hour=hour,
                native_volume_weighted_initial_water_fraction=float(initial @ d['volume'] / d['volume'].sum()),
                native_cell_fraction_above_0_5=float(np.mean(initial > .5)),
                display_cell_mean_initial_water_fraction=float(display_initial.mean()),
                display_cell_fraction_above_0_5=float(np.mean(display_initial > .5)),
                native_minimum_initial_water_fraction=float(initial.min()),
                native_maximum_initial_water_fraction=float(initial.max())))
            if hour % 24 == 0:
                print(f'{label}: hour {hour}/168, elapsed {time.perf_counter()-start:.1f}s', flush=True)
        if step == total_steps:
            break
        end_seconds = (step + 1) * dt
        low_hour = min(int(end_seconds // 3600), 167)
        blend = (end_seconds - low_hour * 3600) / 3600
        inlet_t = boundary_t[low_hour] * (1 - blend) + boundary_t[low_hour + 1] * blend
        external_value = np.zeros((n, 2))
        external_value[inlet_ids, 0] = inlet_t
        if uniform:
            external_value[inlet_ids, :] = [16.0, 289.15]
        rhs = state[order] * time_weight[:, None] + external_value[order] * boundary_weight[:, None]
        sorted_new = spsolve_triangular(matrix, rhs, lower=True, unit_diagonal=True)
        state = sorted_new[rank]
        inventory = state.T @ d['volume']
        boundary_flux = external_value.T @ d['external_in'] - state.T @ d['external_out']
        residual_flux = state.T @ d['residual']
        predicted_change = dt * (boundary_flux + residual_flux)
        error = inventory - previous_inventory - predicted_change
        maximum_step_ledger_error = np.maximum(maximum_step_ledger_error, np.abs(error))
        cumulative_ledger_error += error
        accumulated_flux += dt * boundary_flux
        accumulated_residual += dt * residual_flux
        previous_inventory = inventory
        minimum = min(minimum, float(state[:, 0].min()))
        maximum = max(maximum, float(state[:, 0].max()))
        if uniform:
            uniform_error = max(uniform_error, float(np.abs(state[:, 0]-16).max()))
            offset_error = max(offset_error, float(np.abs((state[:, 1]-state[:, 0])-273.15).max()))
        if end_seconds % 3600 == 0:
            ledger.append(dict(hour=int(end_seconds//3600), temperature_inventory_c_m3=float(inventory[0]),
                initial_water_inventory_m3=float(inventory[1]),
                cumulative_boundary_temperature_proxy_c_m3=float(accumulated_flux[0]),
                cumulative_continuity_compensation_c_m3=float(accumulated_residual[0]),
                cumulative_temperature_ledger_error_c_m3=float(cumulative_ledger_error[0]),
                cumulative_initial_water_ledger_error_m3=float(cumulative_ledger_error[1])))
    report = dict(label=label, timestep_seconds=dt, steps=total_steps,
        method='Implicit first-order upwind finite-volume passive transport with explicitly accounted hydraulic continuity-residual compensation at the new time level.',
        residual_sign_definition='outgoing + external_outgoing - incoming - external_incoming',
        residual_term='residual*T_new, included explicitly in the inventory ledger; raw hydraulic face discharges unchanged',
        no_clipping=True, source_boundary_and_initial_range_c=source_range,
        native_all_step_temperature_range_c=[minimum, maximum],
        maximum_principle_excess_c=max(source_range[0]-minimum, maximum-source_range[1], 0) if not uniform else None,
        maximum_absolute_step_ledger_error=maximum_step_ledger_error.tolist(),
        cumulative_signed_ledger_error=cumulative_ledger_error.tolist(),
        cumulative_boundary_flux_integral=accumulated_flux.tolist(),
        cumulative_continuity_compensation_integral=accumulated_residual.tolist(),
        final_inventory=previous_inventory.tolist(), wall_seconds=time.perf_counter()-start,
        uniform_16c_maximum_error_c=uniform_error if uniform else None,
        celsius_kelvin_offset_maximum_error_c=offset_error if uniform else None,
        state_columns=['temperature_degrees_Celsius','temperature_kelvin'] if uniform else ['temperature_degrees_Celsius','initial_water_fraction'],
        initial_water=None if uniform else fraction_summaries, hourly_inventory_ledger=ledger)
    if uniform:
        for row in report['hourly_inventory_ledger']:
            row['kelvin_temperature_inventory_k_m3']=row.pop('initial_water_inventory_m3')
            row['cumulative_kelvin_temperature_ledger_error_k_m3']=row.pop('cumulative_initial_water_ledger_error_m3')
    save_json(ROOT/f'{label}-audit.json', report)
    np.savez_compressed(ROOT/f'{label}-native-final.npz', temperature=state[:,0],
                        initial_water_fraction=state[:,1])
    if export_ids is not None:
        result = np.stack(states)
        result.tofile(ROOT/f'{label}-temperature.f32')
        return result, report
    return None, report


def finalize(field, native_ids, meta):
    import shutil
    shutil.copyfile(ROOT/'tracer-150s-temperature.f32', ROOT/'temperature.f32')
    np.asarray(native_ids,dtype='<i4').tofile(ROOT/'display-native-index.i32')
    shape = [169, len(native_ids)]
    values = np.memmap(ROOT/'temperature.f32',dtype='<f4',mode='r',shape=tuple(shape))
    assert np.isfinite(values).all()
    report = json.loads((ROOT/'tracer-150s-audit.json').read_text(encoding='utf-8'))
    input_report = json.loads((ROOT/'input-audit.json').read_text(encoding='utf-8'))
    uniform = json.loads((ROOT/'uniform-300s-audit.json').read_text(encoding='utf-8'))
    # Only metadata normalization for the already-running uniform test's two
    # temperature columns. No numerical result or ledger value is changed.
    uniform['source_boundary_and_initial_range_c']=[16.0,16.0]
    uniform['state_columns']=['temperature_degrees_Celsius','temperature_kelvin']
    uniform['initial_water']=None
    for row in uniform['hourly_inventory_ledger']:
        if 'initial_water_inventory_m3' in row:
            row['kelvin_temperature_inventory_k_m3']=row.pop('initial_water_inventory_m3')
            row['cumulative_kelvin_temperature_ledger_error_k_m3']=row.pop('cumulative_initial_water_ledger_error_m3')
    save_json(ROOT/'uniform-300s-audit.json',uniform)
    sensitivity = json.loads((ROOT/'timestep-sensitivity.json').read_text(encoding='utf-8'))
    source_hashes = input_report['source_hashes']
    assert sha(MODEL/'dwe-calibrated-50m.npz') == source_hashes['hydraulic_npz']
    assert sha(MODEL/'display-field.json') == source_hashes['river_display_field']
    assert sha(HOURLY/'manifest.json') == source_hashes['hourly_manifest']
    assert sha(HOURLY/'t.f32') == source_hashes['hourly_t']
    assert sha(HOURLY/'u.f32') == source_hashes['hourly_u'] == meta['arrays']['u']['sha256']
    assert sha(HOURLY/'v.f32') == source_hashes['hourly_v'] == meta['arrays']['v']['sha256']
    assert source_hashes['hourly_t'] == meta['arrays']['t']['sha256']
    assert sha(HOURLY/'mesh.json') == source_hashes['hourly_mesh']
    def array(file,dtype,shape,units=None):
        value=dict(file=file,dtype=dtype,endianness='little',order='C',shape=shape,
                   bytes=(ROOT/file).stat().st_size,sha256=sha(ROOT/file))
        if units: value['units']=units
        return value
    manifest=dict(kind='derived-passive-river-temperature-series',version=1,
        sourceRiverFieldSHA256=source_hashes['river_display_field'],
        sourceHydraulicSolutionSHA256=source_hashes['hydraulic_npz'],
        sourceHourlyManifestSHA256=source_hashes['hourly_manifest'],
        sourceHourlyTemperatureSHA256=source_hashes['hourly_t'],
        sourceHourlyU_SHA256=source_hashes['hourly_u'],sourceHourlyV_SHA256=source_hashes['hourly_v'],
        sourceMeshSHA256=source_hashes['hourly_mesh'],
        source_inputs_unchanged_verified=True,
        grid={k:field[k] for k in ['west','south','dx','dy','width','height']},
        compactWetCount=len(native_ids),time_count=169,times=meta['times'],
        times_match_original_hourly_manifest_exactly=True,
        requested_hour_count=168,closing_endpoint_index=168,
        arrays=dict(temperature=array('temperature.f32','float32',shape,'degrees_Celsius'),
                    indexMap=array('index-map.i32','int32',[field['height'],field['width']]),
                    displayNativeIndex=array('display-native-index.i32','int32',[len(native_ids)])),
        method=dict(name='Passive-temperature advection estimate',
            observation_status='Unvalidated estimate; no river temperature observations used.',
            native_grid='177775 wet cells on frozen 50 m EPSG:32618 hydraulic grid',
            velocity='Frozen steady depth-averaged hydraulic face discharges; no film motion boost applied.',
            volume='Frozen actual water depth times 2500 square metres.',
            numerical_scheme='Implicit first-order upwind, 150 s step, hourly linear boundary interpolation.',
            continuity_residual='Explicitly accounted r*T_new compensation at the new implicit time level, with raw face discharges unchanged; ledger includes this numerical term.',
            initial_temperature_c=input_report['boundary']['first_discharge_weighted_mean_c'],
            initial_state='Uniform first-hour discharge-weighted inlet temperature; assumed initial water, not observations or prehistory spin-up.',
            initial_water_fraction_report='tracer-150s-audit.json',
            initial_water_fraction_at_closing_endpoint=report['initial_water'][-1],
            initial_condition_sensitivity='For a uniform initial-state temperature error delta_T with boundary fixed, the propagated local error is delta_T times the reported initial-water fraction. This is not an estimate of observed error.',
            positive_flow_inlet_unreachable_cells=input_report['positive_flow_inlet_unreachable_cells'],
            positive_flow_inlet_unreachable_volume_fraction=input_report['positive_flow_inlet_unreachable_volume_fraction'],
            boundary_coverage=input_report['boundary'],
            no_surface_or_bottom_or_tributary_heat_exchange=True,
            no_river_temperature_observations_assimilated=True,
            one_nearshore_inflow_cell_uses_covered_inlet_mean=True,
            actual_noaa_temperature_has_display_priority=True,
            no_clipping=True,
            caveats=['Surface-layer NOAA temperature advected by simplified depth-averaged steady flow.',
                     'Initial-state dependence remains in slow bays and stagnant cells.',
                     'Numerical upwind mixing; no resolved thermal stratification or eddies.',
                     'River hydraulic forcing remains 2026-10-12T00:00Z to 2026-10-17T12:00Z.']),
        validity=dict(finite_temperature_values=int(np.isfinite(values).sum()),
            expected_temperature_values=int(np.prod(shape)),
            all_original_display_wet_cells_covered=True,
            display_temperature_range_c=[float(values.min()),float(values.max())],
            native_all_step_temperature_range_c=report['native_all_step_temperature_range_c'],
            maximum_principle_excess_c=report['maximum_principle_excess_c'],
            uniform_16c_maximum_error_c=uniform['uniform_16c_maximum_error_c'],
            celsius_kelvin_offset_maximum_error_c=uniform['celsius_kelvin_offset_maximum_error_c'],
            timestep_sensitivity=sensitivity['display_temperature_absolute_difference_c']),
        source_urls=dict(system='https://tidesandcurrents.noaa.gov/ofs/loofs/loofs_info.html',
            catalog='https://opendap.co-ops.nos.noaa.gov/thredds/catalog/NOAA/LOOFS/MODELS/2026/10/19/catalog.html',
            metadata='https://opendap.co-ops.nos.noaa.gov/thredds/dodsC/NOAA/LOOFS/MODELS/2026/10/19/loofs.t00z.20261019.fields.n006.nc.das'),
        audits={name:dict(file=name,sha256=sha(ROOT/name)) for name in
            ['input-audit.json','uniform-300s-audit.json','tracer-150s-audit.json','timestep-sensitivity.json','uncovered-boundary.json','boundary-source-spatial-audit.json']})
    save_json(ROOT/'manifest.json',manifest)
    print(json.dumps(dict(output=str(ROOT/'manifest.json'),arrays=manifest['arrays'],validity=manifest['validity']),indent=2),flush=True)


def main():
    d = load_inputs()
    inlet_ids, boundary_t, weighted, meta = inlet_temperatures(d)
    field, native_ids, index = display_mapping(d)
    report = audit_inputs(d, inlet_ids, boundary_t, weighted, field)
    if '--run' in sys.argv:
        transport(d, inlet_ids, boundary_t, 16.0, 300, 'uniform-300s', uniform=True)
        coarse, coarse_report = transport(d, inlet_ids, boundary_t, float(weighted[0]), 300,
                                          'tracer-300s', export_ids=native_ids)
        fine, fine_report = transport(d, inlet_ids, boundary_t, float(weighted[0]), 150,
                                      'tracer-150s', export_ids=native_ids)
        delta = fine.astype(np.float64) - coarse
        save_json(ROOT/'timestep-sensitivity.json', dict(
            compared_timestep_seconds=[300,150], selected_timestep_seconds=150,
            identical_source_boundary_and_initial_state=True,
            display_temperature_absolute_difference_c=dict(
                maximum=float(np.abs(delta).max()), mean=float(np.abs(delta).mean()),
                percentiles_50_90_95_99_99_9=np.percentile(np.abs(delta),[50,90,95,99,99.9]).tolist()),
            final_hour_maximum_absolute_difference_c=float(np.abs(delta[-1]).max())))
        finalize(field,native_ids,meta)
    elif '--finalize' in sys.argv:
        finalize(field,native_ids,meta)
    else:
        print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    main()
