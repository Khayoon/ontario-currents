const ORIGIN='https://opendap.co-ops.nos.noaa.gov/thredds';
const memory=new Map();
async function cached(key,seconds,fn){
  const old=memory.get(key);if(old&&old.until>Date.now())return old.data;
  const cache=globalThis.caches?.default;const cacheKey=new Request('https://atlas-cache.local/'+encodeURIComponent(key));
  if(cache){const hit=await cache.match(cacheKey);if(hit)return hit.json();}
  const data=await fn();memory.set(key,{data,until:Date.now()+seconds*1000});
  if(memory.size>12)memory.delete(memory.keys().next().value);
  if(cache)await cache.put(cacheKey,Response.json(data,{headers:{'Cache-Control':'public, max-age='+seconds}}));
  return data;
}
async function getText(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error('NOAA returned '+r.status);return r.text();}
export async function catalog(){return cached('catalog-v1',600,async()=>{
  const days=await Promise.all(Array.from({length:3},async(_,i)=>{
    const date=new Date(Date.now()-i*86400000).toISOString().slice(0,10).replaceAll('-','/');
    try{const text=await getText(ORIGIN+'/catalog/NOAA/LOOFS/MODELS/'+date+'/catalog.xml');return [...text.matchAll(/urlPath="([^"]+regulargrid\.[nf]\d{3}\.nc)"/g)].map(m=>m[1]);}catch{return [];}
  }));
  const files=[...new Set(days.flat())];if(!files.length)throw new Error('No recent NOAA regular-grid datasets found');
  const parsed=files.map(path=>{const m=path.match(/loofs\.t(\d{2})z\.(\d{4})(\d{2})(\d{2})\.regulargrid\.([nf])(\d{3})/);if(!m)return null;const run=`${m[2]}-${m[3]}-${m[4]}T${m[1]}:00:00Z`;const offset=Number(m[6])-(m[5]==='n'?6:0);return {id:path,time:new Date(Date.parse(run)+offset*3600000).toISOString(),run,kind:m[5]==='n'?'nowcast':'forecast',offset};}).filter(Boolean);
  const runs=[...new Set(parsed.filter(f=>f.kind==='nowcast').map(f=>f.run))].sort();const run=runs.at(-1);if(!run)throw new Error('No completed NOAA nowcast found');
  const map=new Map();
  for(const f of parsed.filter(f=>f.kind==='nowcast'&&f.run<=run&&Date.parse(f.time)>=Date.parse(run)-24*3600000).sort((a,b)=>a.run.localeCompare(b.run)))map.set(f.time,f);
  for(const f of parsed.filter(f=>f.run===run&&f.kind==='forecast'&&f.offset>0&&f.offset<=48&&f.offset%3===0))map.set(f.time,f);
  const frames=[...map.values()].sort((a,b)=>a.time.localeCompare(b.time));const currentIndex=frames.findLastIndex(f=>f.kind==='nowcast');
  return {run,frames,currentIndex,fetchedAt:new Date().toISOString(),source:ORIGIN+'/catalog/NOAA/LOOFS/MODELS/catalog.html'};
});}
export function parseAscii(raw,id){
  const body=raw.split('---------------------------------------------')[1];if(!body)throw new Error('Invalid NOAA response');
  const out={kind:'mesh',depth:'top model layer',source:ORIGIN+'/dodsC/'+id};let key=null;let expectTime=false;
  for(const rawLine of body.split(/\r?\n/)){const line=rawLine.trim();if(!line)continue;
    const m=line.match(/^(u|v|temp)\[/);
    if(m){key={u:'u',v:'v',temp:'t'}[m[1]];out[key]=[];expectTime=false;continue;}
    if(line.startsWith('Times[')){expectTime=true;key=null;continue;}
    if(expectTime&&line.startsWith('"')){out.time=JSON.parse(line).replace(/\.\d+$/,'')+'Z';expectTime=false;continue;}
    if(key&&/^\[\d+\]/.test(line))for(const str of line.replace(/^(?:\[\d+\])+,\s*/,'').split(',')){const n=Number(str);out[key].push(Number.isFinite(n)&&Math.abs(n)<900?Math.round(n*10000)/10000:null);}
  }
  for(const key of ['u','v','t'])if(out[key]?.length!==(key==='t'?34395:64453))throw new Error('NOAA mesh dimensions changed; field rejected');
  if(!Number.isFinite(Date.parse(out.time)))throw new Error('Missing field valid time');return out;
}
export async function field(id){
  if(!/^NOAA\/LOOFS\/MODELS\/\d{4}\/\d{2}\/\d{2}\/loofs\.t\d{2}z\.\d{8}\.regulargrid\.[nf]\d{3}\.nc$/.test(id))throw new Error('Invalid dataset path');
  const nativeId=id.replace('.regulargrid.','.fields.');
  return cached('native-field:'+nativeId,3600,async()=>{const query='Times,u[0][0],v[0][0],temp[0][0]';return parseAscii(await getText(ORIGIN+'/dodsC/'+nativeId+'.ascii?'+encodeURIComponent(query)),nativeId);});
}
export async function average(){
  const c=await catalog();
  return cached('native-average:'+c.run,21600,async()=>{
    const frames=c.frames.filter(f=>f.kind==='nowcast'&&((Date.parse(c.run)-Date.parse(f.time))/3600000)%3===0);
    if(frames.length<8)throw new Error('Insufficient samples for a 24-hour mean');
    const sums={u:new Float64Array(64453),v:new Float64Array(64453),t:new Float64Array(34395)},counts={u:new Uint8Array(64453),v:new Uint8Array(64453),t:new Uint8Array(34395)},samples=[];
    for(let i=0;i<frames.length;i+=2){const pair=await Promise.all(frames.slice(i,i+2).map(f=>field(f.id)));for(const f of pair){samples.push({time:f.time,source:f.source});for(const key of ['u','v','t'])for(let j=0;j<f[key].length;j++)if(f[key][j]!==null){sums[key][j]+=f[key][j];counts[key][j]++;}}}
    const out={kind:'mesh',mode:'average',start:frames[0].time,end:frames.at(-1).time,time:frames.at(-1).time,sampleCount:samples.length,samples,source:ORIGIN+'/catalog/NOAA/LOOFS/MODELS/catalog.html',depth:'top model layer',method:'Arithmetic mean of eastward and northward components, sampled every 3 hours across the preceding 24 hours. Temperature is averaged separately. Not a climatology.'};
    for(const key of ['u','v','t'])out[key]=Array.from(sums[key],(s,i)=>counts[key][i]===samples.length?Math.round(s/counts[key][i]*10000)/10000:null);
    return out;
  });
}
const RIVER_BASE='https://erddap.ogsl.ca/erddap/griddap/ecccShopNautilo';
async function riverTimes(base=RIVER_BASE){const r=await fetch(base+'.json?time',{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('River catalogue returned '+r.status);const j=await r.json();return j.table.rows.map(r=>r[0]);}
async function riverField(index,estuary=false){
  const base=estuary?'https://erddap.ogsl.ca/erddap/griddap/mpoStle200Nautilo':RIVER_BASE;
  // The ERDDAP forecast window rolls forward; coordinate selectors keep each
  // field anchored to its declared valid time throughout a multi-file average.
  const axis=typeof index==='string'?`(${index})`:index;
  const query=estuary?`x_velocity[${axis}][0:3:1299][0:3:1399],y_velocity[${axis}][0:3:1299][0:3:1399]`:`magnitude[${axis}][0:6:2699][0:6:3599],direction[${axis}][0:6:2699][0:6:3599]`;
  const url=base+'.csv?'+encodeURIComponent(query);let response;
  for(let attempt=0;attempt<2;attempt++){try{response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(response.ok)break;if(attempt===1)throw new Error('River model returned '+response.status);await response.body?.cancel();}catch(e){if(attempt===1)throw e;}await new Promise(resolve=>setTimeout(resolve,1500));}
  const width=estuary?467:600,height=estuary?434:450,count=width*height;
  const out={kind:estuary?'estuary':'river',width,height,u:Array(count).fill(null),v:Array(count).fill(null),t:null,velocityType:estuary?'surface':'depth-averaged',provider:estuary?'DFO STLE200 / SLGO':'ECCC OHPS / SLGO',source:base+'.html',mode:'live'};
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',lineNumber=0,rows=0,north=0,previousLon=0;
  function line(s){const cols=s.trim().split(',');if(lineNumber++<2)return;if(cols.length<5||!cols[0])return;const [time,latString,lonString,mString,dString]=cols;const lat=Number(latString),lon=Number(lonString),m=Number(mString),d=Number(dString);
    if(rows===0){out.time=time;out.west=lon;north=lat;previousLon=lon;}if(rows===1)out.dx=lon-previousLon;if(rows===width)out.dy=north-lat;out.south=lat;
    const k=(height-1-Math.floor(rows/width))*width+rows%width;if(Number.isFinite(m)&&Number.isFinite(d)){out.u[k]=estuary?m:Math.round(m*Math.sin(d*Math.PI/180)*10000)/10000;out.v[k]=estuary?d:Math.round(m*Math.cos(d*Math.PI/180)*10000)/10000;}rows++;
  }
  for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let pos;while((pos=buffer.indexOf('\n'))>=0){line(buffer.slice(0,pos));buffer=buffer.slice(pos+1);}}
  if(buffer.trim())line(buffer);if(rows!==count)throw new Error('River grid dimensions changed; field rejected');if(typeof index==='string'&&Date.parse(out.time)!==Date.parse(index))throw new Error('River valid-time selector mismatch');return out;
}
export async function estuary(mode='live'){
  const base='https://erddap.ogsl.ca/erddap/griddap/mpoStle200Nautilo';const times=await cached('estuary-times',900,()=>riverTimes(base));let nearest=0;
  for(let i=1;i<times.length;i++)if(Math.abs(Date.parse(times[i])-Date.now())<Math.abs(Date.parse(times[nearest])-Date.now()))nearest=i;
  if(mode!=='average')return cached('estuary-field:'+times[nearest],3600,()=>riverField(times[nearest],true));
  const ohpsTimes=await cached('river-times',900,riverTimes);let start=times.findIndex(t=>Date.parse(t)>=Date.parse(ohpsTimes[0]));if(start<0||start+24>=times.length)start=0;
  return cached('estuary-average:'+times[start],21600,async()=>{
    const count=467*434,su=new Float64Array(count),sv=new Float64Array(count),n=new Uint8Array(count),sampleTimes=[];let model;
    for(let i=start;i<=start+24;i+=3){const f=await riverField(times[i],true);model=f;sampleTimes.push(f.time);for(let j=0;j<count;j++)if(f.u[j]!==null&&f.v[j]!==null){su[j]+=f.u[j];sv[j]+=f.v[j];n[j]++;}}
    return {...model,mode:'average',start:times[start],end:times[start+24],time:times[start+24],sampleCount:9,sampleTimes,method:'24-hour forecast vector mean from nine three-hourly surface fields',u:Array.from(su,(s,i)=>n[i]===9?Math.round(s/9*10000)/10000:null),v:Array.from(sv,(s,i)=>n[i]===9?Math.round(s/9*10000)/10000:null)};
  });
}
export async function river(mode='live'){
  const times=await cached('river-times',900,riverTimes);let nearest=0;for(let i=1;i<times.length;i++)if(Math.abs(Date.parse(times[i])-Date.now())<Math.abs(Date.parse(times[nearest])-Date.now()))nearest=i;
  if(mode!=='average')return cached('river-field:'+times[nearest],3600,()=>riverField(times[nearest]));
  return cached('river-average:'+times[0],21600,async()=>{
    if(times.length<25)throw new Error('Insufficient river forecast times');const out={kind:'river',mode:'average',velocityType:'depth-averaged',provider:'ECCC OHPS / SLGO',start:times[0],end:times[24],time:times[24],sampleCount:9,sampleTimes:times.filter((_,i)=>i<=24&&i%3===0),source:RIVER_BASE+'.html',t:null,method:'24-hour forecast vector mean, nine 3-hourly fields. This is a different period from the Lake Ontario historical mean.'};
    let sumsU,sumsV,counts;
    for(let i=0;i<=24;i+=3){const f=await riverField(times[i]);if(!sumsU){Object.assign(out,{west:f.west,south:f.south,dx:f.dx,dy:f.dy,width:f.width,height:f.height});sumsU=new Float64Array(f.u.length);sumsV=new Float64Array(f.u.length);counts=new Uint8Array(f.u.length);}for(let j=0;j<f.u.length;j++)if(f.u[j]!==null&&f.v[j]!==null){sumsU[j]+=f.u[j];sumsV[j]+=f.v[j];counts[j]++;}}
    out.u=Array.from(sumsU,(s,i)=>counts[i]===9?Math.round(s/9*10000)/10000:null);out.v=Array.from(sumsV,(s,i)=>counts[i]===9?Math.round(s/9*10000)/10000:null);return out;
  });
}
