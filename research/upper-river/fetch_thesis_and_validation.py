import json, urllib.request, urllib.parse
from pathlib import Path
import pymupdf
ROOT=Path(__file__).resolve().parent

def get_json(url):
    return json.load(urllib.request.urlopen(url,timeout=60))

bundle='https://queensu.scholaris.ca/server/api/core/bundles/14274c77-eddb-4c22-b36d-9566c0096b2f/bitstreams?size=100'
bits=get_json(bundle)
ROOT.joinpath('paturi-original-files.json').write_text(json.dumps(bits,indent=2),encoding='utf-8')
for bit in bits.get('_embedded',{}).get('bitstreams',[]):
    print({'name':bit['name'],'uuid':bit['uuid'],'bytes':bit.get('sizeBytes'),'content':bit['_links']['content']['href']})
    if bit['name'].lower().endswith('.pdf'):
        raw=urllib.request.urlopen(bit['_links']['content']['href'],timeout=60).read()
        file=ROOT/'paturi-2013-thesis.pdf'
        file.write_bytes(raw)
        doc=pymupdf.open(file)
        ROOT.joinpath('paturi-2013-thesis.txt').write_text('\n'.join(f'\nPAGE {i+1}\n'+page.get_text() for i,page in enumerate(doc)),encoding='utf-8')
        print('Downloaded',len(raw),'bytes;',len(doc),'pages')

query=urllib.parse.urlencode({'product':'water_level','application':'OntarioCurrentsResearch','begin_date':'20261012 00:00','end_date':'20261017 12:00','datum':'IGLD','station':'8311062','time_zone':'gmt','units':'metric','interval':'h','format':'json'})
url='https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+query
alex=get_json(url)
ROOT.joinpath('alexandria-bay-water-levels.json').write_text(json.dumps(alex,indent=2),encoding='utf-8')
print('Alexandria Bay',len(alex.get('data',[])),'records',alex.get('data',[{}])[:2],alex.get('error'))

for endpoint in ['https://ijc.org/en/loslrb/watershed/regulation-summary','https://ijc.org/en/loslrb/watershed/outflow-changes']:
    raw=urllib.request.urlopen(endpoint,timeout=60).read()
    ROOT.joinpath(endpoint.rsplit('/',1)[1]+'.html').write_bytes(raw)
