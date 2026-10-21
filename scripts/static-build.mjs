import {readFile,writeFile,cp,mkdir,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url)),dist=path.join(root,'dist');
// Only this generated directory is removed; the original Sites checkout is separate.
if(path.dirname(dist)!==path.resolve(root))throw new Error('Unexpected build destination');
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
await cp(path.join(root,'src'),dist,{recursive:true});
try{if((await stat(path.join(root,'media'))).isDirectory())await cp(path.join(root,'media'),path.join(dist,'media'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
// Retain the old direct video URL. GitHub Pages serves .mp4 as video/mp4,
// so an HTML redirect at that path would break browser video playback.
// The separate temperature project owns the film and its frozen source inputs.
const legacyFilm={
  url:'https://github.com/Khayoon/lake-ontario-temperature/releases/download/october-12-18-2026/lake-ontario-temperature.mp4',
  bytes:103544787,
  sha256:'5c57c348290d527c350ecba138517da96803dce5254ba2926282e4bc5a932458'
};
const filmPath=path.join(root,'media/lake-ontario-closeup.mp4');
const verified=bytes=>bytes?.length===legacyFilm.bytes&&createHash('sha256').update(bytes).digest('hex')===legacyFilm.sha256;
let film;
try{film=await readFile(filmPath);}catch(e){if(e.code!=='ENOENT')throw e;}
if(!verified(film)){
  const response=await fetch(legacyFilm.url,{signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw new Error(`Legacy film download failed: HTTP ${response.status}`);
  film=Buffer.from(await response.arrayBuffer());
  if(!verified(film))throw new Error('Legacy film failed release integrity check');
  await mkdir(path.dirname(filmPath),{recursive:true});
  await writeFile(filmPath,film);
}
await mkdir(path.join(dist,'media'),{recursive:true});
await writeFile(path.join(dist,'media/lake-ontario-closeup.mp4'),film);
try{await cp(path.join(root,'CNAME'),path.join(dist,'CNAME'));}catch(e){if(e.code!=='ENOENT')throw e;}
const version=createHash('sha256').update(await readFile(path.join(dist,'app.js'))).update(await readFile(path.join(dist,'field.js'))).update(await readFile(path.join(dist,'mesh-flow.js'))).update(await readFile(path.join(dist,'speed-style.js'))).update(await readFile(path.join(dist,'style.css'))).digest('hex').slice(0,12);
const html=(await readFile(path.join(dist,'index.html'),'utf8')).replace(/(src|href)="\.\/(app\.js|field\.js|mesh-flow\.js|speed-style\.js|style\.css)"/g,(_,attr,file)=>`${attr}="./${file}?v=${version}"`);
await writeFile(path.join(dist,'index.html'),html);await writeFile(path.join(dist,'.nojekyll'),'');
console.log('Built static GitHub Pages artifact in dist/; no server or private deployment metadata.');
