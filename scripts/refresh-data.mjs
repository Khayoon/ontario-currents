import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {catalog,field,average,river,estuary} from '../lib/source-adapter.mjs';
import {validateMeshField,validateGrid,validateMean,validateCatalog} from '../lib/schema.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),args=process.argv.slice(2),offline=args.includes('--offline');
const option=(name,fallback)=>args.find(s=>s.startsWith('--'+name+'='))?.slice(name.length+3)||fallback;
const output=path.resolve(root,option('output','src/data')),seed=path.join(root,'src/data'),now=new Date().toISOString();
const published=offline?null:option('published-base',process.env.PUBLISHED_BASE_URL||'');
const base=published?new URL(published.endsWith('/')?published:published+'/'):null;
if(base&&base.protocol!=='https:')throw new Error('Published fallback must use HTTPS');
const readJSON=async file=>JSON.parse(await readFile(file,'utf8'));
const save=async(name,value)=>{const file=path.join(output,name);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(value));};
async function remote(name){if(!base)throw new Error('No previous deployment configured');const response=await fetch(new URL('data/'+name,base),{signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error('Published fallback HTTP '+response.status);return response.json();}
async function old(name,validate){const candidates=[];try{candidates.push(validate(await readJSON(path.join(seed,name))));}catch{}try{candidates.push(validate(await remote(name)));}catch{}if(!candidates.length)throw new Error('No valid fallback for '+name);return candidates.sort((a,b)=>Date.parse(b.time||b.run||b.generatedAt||0)-Date.parse(a.time||a.run||a.generatedAt||0))[0];}
async function pool(items,fn,limit=3){const results=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const index=next++;results[index]=await fn(items[index],index);}}));return results;}
const fileName=id=>createHash('sha256').update(id).digest('hex').slice(0,20)+'.json';
const manifest={schemaVersion:1,generatedAt:now,refreshAttemptAt:now,refreshPolicy:'Source discovery hourly; browser checks published data every 15 minutes. Source valid times are independent.',providers:{},allSourcesCurrent:false};
let oldCatalog;try{oldCatalog=await old('catalog.json',validateCatalog);}catch{}
const oldEntries=new Map((oldCatalog?.frames||[]).map(f=>[f.id,f]));
async function priorFrame(entry){const filename=entry.url?.replace(/^data\//,'')||'fields/'+fileName(entry.id);const f=await old(filename,validateMeshField);if(Date.parse(f.time)!==Date.parse(entry.time))throw new Error('Fallback field valid time mismatch');return f;}
const assertOnline=()=>{if(offline)throw new Error('Offline packaging: upstream refresh was not attempted');};
async function refreshNoaa(){
  let c,frames,mean,status='current',error=null;
  try{assertOnline();c=validateCatalog(await catalog());frames=await pool(c.frames,async entry=>{let data;const prior=oldEntries.get(entry.id);if(prior)try{data=await priorFrame(prior);}catch{}if(!data)data=validateMeshField(await field(entry.id));if(Date.parse(data.time)!==Date.parse(entry.time))throw new Error('NOAA valid time differs from catalogue');return data;});mean=validateMean(await average(),validateMeshField);}
  catch(e){error=e.message;status='retained';if(!oldCatalog)throw new Error('NOAA refresh failed without a fallback: '+error);c=oldCatalog;frames=await pool(c.frames,priorFrame);mean=await old('average.json',f=>validateMean(f,validateMeshField));}
  const entries=c.frames.map((entry,i)=>({...entry,url:'data/fields/'+fileName(entry.id)}));
  for(let i=0;i<entries.length;i++)await save(entries[i].url.slice(5),frames[i]);
  await save('catalog.json',{...c,frames:entries,generatedAt:now});await save('snapshot.json',frames[c.currentIndex]);await save('average.json',mean);
  manifest.providers.noaa={status,checkedAt:offline?null:now,sourceTime:frames[c.currentIndex].time,run:c.run,frameCount:entries.length,averageStart:mean.start,averageEnd:mean.end,error};
}
async function refreshGrid(name,fetcher){
  let live,mean,status='current',error=null;
  try{assertOnline();[live,mean]=await Promise.all([fetcher('live'),fetcher('average')]);validateGrid(live);validateMean(mean,validateGrid);}
  catch(e){error=e.message;status='retained';[live,mean]=await Promise.all([old(name+'.json',validateGrid),old(name+'-average.json',f=>validateMean(f,validateGrid))]);}
  await save(name+'.json',live);await save(name+'-average.json',mean);
  manifest.providers[name]={status,checkedAt:offline?null:now,sourceTime:live.time,averageStart:mean.start,averageEnd:mean.end,error};
}
await mkdir(output,{recursive:true});
const results=await Promise.allSettled([refreshNoaa(),refreshGrid('river',river),refreshGrid('estuary',estuary)]);
if(results.some(r=>r.status==='rejected')){for(let i=0;i<results.length;i++)if(results[i].status==='rejected')console.error(['noaa','river','estuary'][i]+': '+results[i].reason.message);throw new Error('Incomplete validated package. Existing deployment must be retained.');}
manifest.allSourcesCurrent=Object.values(manifest.providers).every(p=>p.status==='current');await save('manifest.json',manifest);
for(const [provider,state] of Object.entries(manifest.providers))console.log(`${provider}: ${state.status}; valid ${state.sourceTime}${state.error?'; '+state.error:''}`);
console.log(manifest.allSourcesCurrent?'All upstream sources checked successfully.':'Some sources could not refresh. Their dated fallback data are explicitly retained.');
