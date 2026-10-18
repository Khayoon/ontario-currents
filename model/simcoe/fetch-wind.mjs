import {mkdir, writeFile} from 'node:fs/promises';
const url='https://api.weather.gc.ca/collections/climate-hourly/items?f=json&limit=1000&CLIMATE_IDENTIFIER=6117700&LOCAL_YEAR=2026&LOCAL_MONTH=10';
const response=await fetch(url);
if(!response.ok)throw new Error(`Climate API ${response.status}`);
const raw=await response.json();
if(raw.numberMatched!==raw.features?.length||raw.links?.some(l=>l.rel==='next'))throw new Error('Incomplete climate response');
const values=raw.features.map(f=>f.properties).sort((a,b)=>Date.parse(a.UTC_DATE+'Z')-Date.parse(b.UTC_DATE+'Z'));
const samples=values.map((p,i)=>{
  if(!Number.isFinite(p.WIND_SPEED)||p.WIND_SPEED<0||p.WIND_SPEED!==0&&(!Number.isFinite(p.WIND_DIRECTION)||p.WIND_DIRECTION<0||p.WIND_DIRECTION>36))throw new Error(`Missing/invalid wind ${p.UTC_DATE}`);
  const time=p.UTC_DATE+'Z',speed=p.WIND_SPEED/3.6,direction=(p.WIND_DIRECTION||0)*10*Math.PI/180;
  if(i&&Date.parse(time)-Date.parse(values[i-1].UTC_DATE+'Z')!==3600000)throw new Error('Hourly gap in wind');
  return {time,u10:-speed*Math.sin(direction),v10:-speed*Math.cos(direction),speedKmh:p.WIND_SPEED,direction10Degrees:p.WIND_DIRECTION,speedFlag:p.WIND_SPEED_FLAG,directionFlag:p.WIND_DIRECTION_FLAG};
});
const wind={source:{name:'ECCC National Climate Archive — Barrie-Oro hourly observations',station:'6117700',stationId:42183,url,location:[-79.55,44.483333333333334],elevationMetres:289,retrievedAt:new Date().toISOString(),licence:'Open Government Licence — Canada',unitReference:'https://climate.weather.gc.ca/glossary_e.html',rawUnits:{WIND_SPEED:'km/h',WIND_DIRECTION:'tens of degrees true, meteorological direction from'},convertedUnits:'u10/v10 m/s, true east/north',assumptions:['Land-station wind applied uniformly to the lake; no over-water speed correction.','Nominal 10m wind height is assumed from the ECCC standard; a station-specific anemometer-height record was not verified.','Hourly observations are short-period observation averages, not hourly-mean winds; the samples are linearly interpolated in time.','UTC_DATE is used directly as UTC. LOCAL_DATE is EST throughout the source record, with no daylight-saving adjustment.','Wind forcing is not a measurement of water current.'],sampleCount:samples.length},samples};
await mkdir(new URL('./',import.meta.url),{recursive:true});
await writeFile(new URL('barrie-oro-2026-10.json',import.meta.url),JSON.stringify(raw));
await writeFile(new URL('wind.json',import.meta.url),JSON.stringify(wind));
console.log(JSON.stringify({samples:samples.length,start:samples[0].time,end:samples.at(-1).time,maxWindMps:Math.max(...samples.map(p=>Math.hypot(p.u10,p.v10)))}));
