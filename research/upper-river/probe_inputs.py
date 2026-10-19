import json
import urllib.request
import urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parent

def fetch(url, filename):
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            raw = response.read()
            ROOT.joinpath(filename).write_bytes(raw)
            return {'file': filename, 'url': url, 'status': response.status, 'bytes': len(raw)}
    except Exception as exc:
        return {'file': filename, 'url': url, 'error': str(exc)}

def station(code):
    base = 'https://api-iwls.dfo-mpo.gc.ca/api/v1/'
    records = json.load(urllib.request.urlopen(base + 'stations?code=' + code))
    record = records[0]
    ROOT.joinpath('station-' + code + '.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
    station_id = record['id']
    q = urllib.parse.urlencode({'time-series-code': 'wlo', 'from': '2026-10-12T00:00:00Z', 'to': '2026-10-17T12:00:00Z', 'resolution': 'SIXTY_MINUTES'})
    results = [fetch(base + 'stations/' + station_id + '/data?' + q, code + '-water-levels.json'), fetch(base + 'stations/' + station_id + '/metadata', code + '-metadata.json')]
    return results

tasks = []
with ThreadPoolExecutor(max_workers=4) as pool:
    for code in ['13988', '14400']:
        tasks.append(pool.submit(station, code))
    tasks.append(pool.submit(fetch, 'https://nonna-geoserver.data.chs-shc.ca/geoserver/wcs?' + urllib.parse.urlencode({'service':'WCS', 'version':'1.0.0', 'request':'DescribeCoverage', 'coverage':'nonna:NONNA 10 Coverage'}), 'nonna10-description.xml'))
    tasks.append(pool.submit(fetch, 'https://data.chs-shc.ca/main.db5ab7ca03025952.js', 'nonna-main.js'))
    results = [x.result() for x in tasks]
ROOT.joinpath('input-probes.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results, indent=2))
