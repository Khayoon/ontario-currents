"""Prepare actual hourly native NOAA LOOFS surface U/V/T, without averaging."""
from pathlib import Path
from datetime import datetime,timedelta,timezone
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,re,time
import requests
import numpy as np

ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parents[1]
RAW=ROOT/'raw';RAW.mkdir(exist_ok=True)
BASE='https://opendap.co-ops.nos.noaa.gov/thredds/'
QUERY='Times,u[0][0],v[0][0],temp[0][0]'
START=datetime(2026,10,12,tzinfo=timezone.utc)
TIMES=[START+timedelta(hours=i)for i in range(169)]
FACES=64453;NODES=34395;DTYPE=np.dtype('<f4')
MESH=PROJECT/'outputs/ontario-currents/src/mesh.json'
RIVER=PROJECT/'work/carleton-continuity-review/expanded-model/display-field.json'
PROTECT=[MESH,RIVER,PROJECT/'work/temperature-week/ontario-october-week-mean-28.json']
sha=lambda b:hashlib.sha256(b).hexdigest()
hashfile=lambda p:sha(p.read_bytes())
protected={p.relative_to(PROJECT).as_posix():hashfile(p)for p in PROTECT}
iso=lambda t:t.isoformat(timespec='seconds').replace('+00:00','Z')
def save(path,obj):path.write_text(json.dumps(obj,indent=2,ensure_ascii=True,allow_nan=False)+'\n',encoding='utf-8')
def fetch(url,path,params=None):
 requested=requests.Request('GET',url,params=params).prepare().url
 if path.exists():return path.read_bytes(),requested
 for attempt in range(4):
  try:
   r=requests.get(url,params=params,timeout=(20,100));r.raise_for_status()
   assert r.content and not r.text.lstrip().lower().startswith('<!doctype html'),url
   part=path.with_suffix(path.suffix+'.part');part.write_bytes(r.content);part.replace(path)
   return r.content,r.url
  except Exception:
   if attempt==3:raise
   time.sleep(1+2*attempt)
def array(text,name):
 m=re.search(r'^'+re.escape(name)+r'((?:\[\d+\])+)[\r\n]+(.*?)(?=\n\s*\n|\Z)',text,re.M|re.S)
 if not m:raise ValueError('Missing source array '+name)
 rows=[re.sub(r'^(?:\[\d+\])+,\s*','',line).strip()for line in m.group(2).splitlines()]
 values=np.concatenate([np.fromstring(line,sep=',',dtype=np.float64)for line in rows if line])
 shape=tuple(map(int,re.findall(r'\[(\d+)\]',m.group(1))))
 assert values.size==int(np.prod(shape)),(name,shape,values.size)
 return values.reshape(shape)

spec=[]
for i,valid in enumerate(TIMES):
 rem=valid.hour%6
 cycle=valid if rem==0 else valid+timedelta(hours=6-rem)
 nh=6 if rem==0 else rem
 name=f'loofs.t{cycle.hour:02}z.{cycle:%Y%m%d}.fields.n{nh:03}.nc'
 path=f'NOAA/LOOFS/MODELS/{cycle:%Y/%m/%d}/'+name
 spec.append({'index':i,'expected_time':valid,'cycle':cycle,'nowcast_hour':nh,'filename':name,'catalogue_path':path,'source':BASE+'dodsC/'+path})

catalogues=[]
for date in sorted({s['cycle'].date()for s in spec}):
 p=ROOT/f'catalog-{date:%Y%m%d}.xml';old=PROJECT/f'work/temperature-week/catalog-{date:%Y%m%d}.xml'
 if not p.exists()and old.exists():p.write_bytes(old.read_bytes())
 url=BASE+f'catalog/NOAA/LOOFS/MODELS/{date:%Y/%m/%d}/catalog.xml'
 content,request=fetch(url,p);paths=set(re.findall(r'urlPath="([^"]+\.fields\.n00[1-6]\.nc)"',content.decode('utf-8')))
 selected=[s['catalogue_path']for s in spec if s['cycle'].date()==date]
 assert all(s in paths for s in selected),(str(date),'requested nowcast absent from official catalogue')
 catalogues.append({'date':str(date),'url':url,'file':p.name,'sha256':sha(content),'selected_nowcast_paths':selected})

last=spec[-1];metadata_path=ROOT/'noaa-20261019-00z.das'
metadata,metadata_request=fetch(last['source']+'.das',metadata_path);attributes={}
for name,unit,location in [('u','meters s-1','face'),('v','meters s-1','face'),('temp','degrees_C','node')]:
 m=re.search(r'^    '+name+r' \{(.*?)^    \}',metadata.decode('utf-8'),re.M|re.S);assert m,name
 d=dict(re.findall(r'String (\w+) "([^"]*)";',m.group(1)))
 assert d.get('units')==unit and d.get('location')==location,d
 attributes[name]=d

native_path=ROOT/'mesh-20261019-00z.ascii'
native,mesh_request=fetch(last['source']+'.ascii',native_path,params='lon,lat,nv');text=native.decode('utf-8')
mesh=json.loads(MESH.read_text(encoding='utf-8'));lon=array(text,'lon').reshape(-1);lat=array(text,'lat').reshape(-1);nv=array(text,'nv').astype(np.int64).T-1
lon=np.where(lon>180,lon-360,lon)
assert np.array_equal(nv,np.asarray(mesh['triangles']))
lon_error=float(np.max(np.abs(lon-np.asarray(mesh['lon']))));lat_error=float(np.max(np.abs(lat-np.asarray(mesh['lat']))))
assert lon_error<5.1e-7 and lat_error<5.1e-7
(ROOT/'mesh.json').write_bytes(MESH.read_bytes())
del text,native,nv,lon,lat

reused_dirs=[PROJECT/'work/forum-data',PROJECT/'work/temperature-week/raw',PROJECT/'work/native']
def get_hour(s):
 raw_path=RAW/(s['filename']+'.ascii');origin='new official constrained response';location=raw_path
 retained=next((d/raw_path.name for d in reused_dirs if(d/raw_path.name).exists()),None)
 if retained is not None:
  raw=retained.read_bytes();location=retained;origin='retained constrained response'
  request=requests.Request('GET',s['source']+'.ascii',params=QUERY).prepare().url
 else:raw,request=fetch(s['source']+'.ascii',raw_path,params=QUERY)
 text=raw.decode('utf-8');mt=re.search(r'^Times\[1\]\s*"([^"]+)"',text,re.M);assert mt,s['filename']
 actual=datetime.fromisoformat(mt.group(1).replace('Z','+00:00'))
 actual=actual.replace(tzinfo=timezone.utc)if actual.tzinfo is None else actual.astimezone(timezone.utc)
 assert actual==s['expected_time'],(s['filename'],iso(actual),iso(s['expected_time']))
 arrays={k:array(text,name).reshape(-1).astype(DTYPE)for k,name in [('u','u'),('v','v'),('t','temp')]}
 assert arrays['u'].shape==arrays['v'].shape==(FACES,)and arrays['t'].shape==(NODES,)
 validity={}
 for key,a in arrays.items():
  good=np.isfinite(a);assert good.any(),(s['filename'],key,'entire array missing')
  if key=='t':assert float(a[good].min())>-5 and float(a[good].max())<45
  else:assert float(np.max(np.abs(a[good])))<20
  validity[key]={'finite':int(good.sum()),'missing':int((~good).sum()),'min':float(a[good].min()),'max':float(a[good].max())}
 entry={'index':s['index'],'time':iso(actual),'cycle_time':iso(s['cycle']),'nowcast_hour_index':s['nowcast_hour'],'product':'nowcast','source_url':s['source'],'request_url':request,'raw_file':location.relative_to(PROJECT).as_posix(),'raw_sha256':sha(raw),'raw_bytes':len(raw),'origin':origin,'validity':validity}
 return arrays,entry

files={key:np.memmap(ROOT/(key+'.f32'),dtype=DTYPE,mode='w+',shape=(169,size),order='C')for key,size in [('u',FACES),('v',FACES),('t',NODES)]}
entries=[];started=time.time()
save(ROOT/'progress.json',{'status':'preparing','completed':0,'total':169,'not_ready_for_rendering':True})
with ThreadPoolExecutor(max_workers=3)as pool:
 for i,(arrays,entry)in enumerate(pool.map(get_hour,spec)):
  assert entry['index']==i
  for key,a in arrays.items():files[key][i,:]=a
  entries.append(entry)
  save(ROOT/'progress.json',{'status':'preparing','completed':i+1,'total':169,'last_actual_time':entry['time'],'elapsed_seconds':round(time.time()-started,1),'not_ready_for_rendering':True})
  if i%6==0 or i==168:print(f'{i+1}/169 {entry["time"]} {entry["origin"]} elapsed={time.time()-started:.1f}s',flush=True)
for a in files.values():a.flush()
assert [e['time']for e in entries]==[iso(t)for t in TIMES]

arrays={}
for key,size in [('u',FACES),('v',FACES),('t',NODES)]:
 p=ROOT/(key+'.f32');assert p.stat().st_size==169*size*4
 arrays[key]={'file':p.name,'dtype':'float32','endianness':'little','order':'C','shape':[169,size],'bytes':p.stat().st_size,'sha256':hashfile(p),'units':'degrees_C'if key=='t'else'm/s','location':'node'if key=='t'else'face','missing_value':'NaN, preserved if present in source; no fill or extrapolation'}
validity={key:{'size_per_hour':size,'per_hour_finite':[e['validity'][key]['finite']for e in entries],'per_hour_missing':[e['validity'][key]['missing']for e in entries],'all_values_finite':all(e['validity'][key]['missing']==0 for e in entries),'source_min':min(e['validity'][key]['min']for e in entries),'source_max':max(e['validity'][key]['max']for e in entries)}for key,size in [('u',FACES),('v',FACES),('t',NODES)]}
t_requested=np.asarray(files['t'][:168]);finite=t_requested[np.isfinite(t_requested)]
thermal={'scope':'Descriptive raw native-node/time statistics, NOT wet-area weighted. First 168 requested hours only; closing endpoint excluded. Palette unchanged.','period_start':iso(TIMES[0]),'period_last_requested_hour':iso(TIMES[167]),'requested_hours':168,'node_time_pairs':int(t_requested.size),'finite_node_time_pairs':int(finite.size),'palette_C':[12,16.5],'source_minmax_C':[float(finite.min()),float(finite.max())],'node_time_quantiles_C':dict(zip(['0','0.1','1','5','25','50','75','95','99','99.9','100'],map(float,np.percentile(finite,[0,.1,1,5,25,50,75,95,99,99.9,100])))),'node_time_below12_percent':float(100*np.mean(finite<12)),'node_time_above16p5_percent':float(100*np.mean(finite>16.5)),'per_hour':[{'time':e['time'],'min_C':e['validity']['t']['min'],'max_C':e['validity']['t']['max'],'below12_nodes':int(np.sum(files['t'][i]<12)),'above16p5_nodes':int(np.sum(files['t'][i]>16.5))}for i,e in enumerate(entries[:168])]}
save(ROOT/'temperature-node-statistics.json',thermal)

for name,digest in protected.items():assert hashfile(PROJECT/name)==digest,('Prior source file changed',name)
info_path=ROOT/'official-loofs-information.html'
manifest={'kind':'native-hourly-mesh-series','provider':'NOAA LOOFS','mode':'chronological','no_averaging':True,'time_count':169,'requested_hour_count':168,'closing_endpoint_index':168,'times':[e['time']for e in entries],'start':iso(TIMES[0]),'last_requested_hour':iso(TIMES[167]),'closing_endpoint':iso(TIMES[168]),'calendar_end_exclusive':'2026-10-19T00:00:00Z','spacing_seconds':3600,'dimensions':{'time':169,'face':FACES,'node':NODES,'sigma_layer_index':0},'arrays':arrays,'mesh':{'file':'mesh.json','sha256':hashfile(MESH),'triangles_index_base':0,'native_verification_request':mesh_request,'native_verification_raw_file':native_path.name,'native_verification_raw_sha256':hashfile(native_path),'triangle_order_exact':True,'maximum_node_coordinate_difference_degrees':[lon_error,lat_error],'verification_scope':'Closing-endpoint native lon/lat/nv checked exactly against retained immutable mesh; native surface dimensions checked in every hourly response.'},'metadata':{'url':metadata_request,'file':metadata_path.name,'sha256':sha(metadata),'variables':attributes,'layer_note':'Top sigma index0; thickness is model dependent, not a fixed-depth observation.'},'official_model_documentation':{'url':'https://tidesandcurrents.noaa.gov/ofs/loofs/loofs_info.html','file':info_path.name,'sha256':hashfile(info_path),'relevant_facts':'Official documentation states four daily cycles, each with a six-hour nowcast; actual Times in each selected response is authoritative.'},'selection':{'product':'nowcast only, n001 through n006; no forecast substitution','candidate_mapping':'For a cycle c and nowcast index h=1..6, candidate valid time is c-6h+h hours. Every selected actual Times is read and must match; filenames alone do not establish time.','actual_times_verified_unique_complete':True,'raw_reuse_count':sum(e['origin'].startswith('retained')for e in entries),'new_cache_response_count':sum(e['origin'].startswith('new')for e in entries),'parallel_workers':3},'validity':validity,'precision':'Each official Float32 ASCII surface array is parsed and stored as native Float32; no decimal display rounding, vector rotation, spatial reconstruction or temporal averaging.','catalogues':catalogues,'sources':entries,'protected_prior_file_sha256_unchanged':protected,'river_note':'No river-model data changed; static river estimate retains its separate 12 October00:00 to17 October12:00 UTC forcing period.','temperature_statistics_file':'temperature-node-statistics.json','interpretation':'Actual hourly model chronology. Closing19Oct00Z endpoint supports interpolation through the final requested hour. Color scale remains12 to16.5C; physical vector components and independent node temperatures are retained, not invented or averaged.'}
save(ROOT/'manifest.json',manifest)
save(ROOT/'progress.json',{'status':'complete','completed':169,'total':169,'manifest':'manifest.json','not_ready_for_rendering':False,'elapsed_seconds':round(time.time()-started,1)})
print(json.dumps({'status':'complete','manifest_sha256':hashfile(ROOT/'manifest.json'),'time_count':169,'arrays':arrays,'all_finite':{k:v['all_values_finite']for k,v in validity.items()},'raw_reused':manifest['selection']['raw_reuse_count'],'new_downloads':manifest['selection']['new_cache_response_count'],'temperature_node_statistics':{k:v for k,v in thermal.items()if k!='per_hour'}},indent=2),flush=True)
