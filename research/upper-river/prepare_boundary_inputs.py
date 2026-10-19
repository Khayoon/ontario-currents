import csv, io, json, statistics, urllib.request, urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parent

stations={code:json.loads(ROOT.joinpath(code+'-metadata.json').read_text(encoding='utf-8')) for code in ['13988','14400']}
levels={code:json.loads(ROOT.joinpath(code+'-water-levels.json').read_text(encoding='utf-8')) for code in stations}
offsets={code:next(x['offset'] for x in value['datums'] if x['code']=='IGLD85') for code,value in stations.items()}
indexed={code:{value['eventDate']:value for value in series} for code,series in levels.items()}
rows=[]
for stamp,k in indexed['13988'].items():
    b=indexed['14400'].get(stamp)
    if b is None or k['qcFlagCode']!='1' or b['qcFlagCode']!='1':
        continue
    ki=k['value']+offsets['13988']
    br=b['value']+offsets['14400']
    rows.append({'time_utc':stamp,'kingston_stage_igld85_m':round(ki,3),'brockville_stage_igld85_m':round(br,3),'endpoint_head_drop_m':round(ki-br,3)})
with ROOT.joinpath('hourly-stage-boundaries-igld85.csv').open('w',newline='',encoding='utf-8') as file:
    writer=csv.DictWriter(file,fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)

url='https://ijc.org/sites/default/files/ChangementDebit_FlowChanges.csv'
raw=urllib.request.urlopen(url,timeout=60).read()
ROOT.joinpath('ijc-flow-changes.csv').write_bytes(raw)
text=raw.decode('utf-8-sig')
print('IJC CSV bytes:',len(raw),'url:',url)
print('\n'.join(line for line in text.splitlines() if '2026-10-' in line))
print('Stage rows:',len(rows),'mean endpoints (m IGLD85):',statistics.mean(x['kingston_stage_igld85_m'] for x in rows),statistics.mean(x['brockville_stage_igld85_m'] for x in rows))

noaa_url='https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+urllib.parse.urlencode({'product':'water_level','application':'OntarioCurrentsResearch','begin_date':'20261012 00:00','end_date':'20261017 12:06','datum':'IGLD','station':'8311062','time_zone':'gmt','units':'metric','format':'json'})
noaa=json.load(urllib.request.urlopen(noaa_url,timeout=60))
ROOT.joinpath('alexandria-bay-water-levels.json').write_text(json.dumps(noaa,indent=2),encoding='utf-8')
print('Alexandria6min rows:',len(noaa.get('data',[])),'first:',noaa.get('data',[{}])[0],'last:',noaa.get('data',[{}])[-1])
