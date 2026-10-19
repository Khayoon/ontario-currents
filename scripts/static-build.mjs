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
// Retain the reviewed MP4 bytes while keeping each source upload manageable.
// The public artifact contains one ordinary MP4, verified before publication.
const filmManifestPath=path.join(root,'media-source/ontario-closeup.json');
{
  const manifest=JSON.parse(await readFile(filmManifestPath,'utf8'));
  const parts=[];
  for(const part of manifest.parts){
    if(!/^ontario-closeup\.part\d+$/.test(part.file))throw new Error('Unexpected film part path');
    const bytes=await readFile(path.join(root,'media-source',part.file));
    if(bytes.length!==part.bytes||createHash('sha256').update(bytes).digest('hex')!==part.sha256)throw new Error('Film source part failed verification: '+part.file);
    parts.push(bytes);
  }
  const film=Buffer.concat(parts);
  if(film.length!==manifest.bytes||createHash('sha256').update(film).digest('hex')!==manifest.sha256)throw new Error('Assembled film failed verification');
  await mkdir(path.join(dist,'media'),{recursive:true});
  await writeFile(path.join(dist,'media/lake-ontario-closeup.mp4'),film);
}
try{await cp(path.join(root,'CNAME'),path.join(dist,'CNAME'));}catch(e){if(e.code!=='ENOENT')throw e;}
const version=createHash('sha256').update(await readFile(path.join(dist,'app.js'))).update(await readFile(path.join(dist,'field.js'))).update(await readFile(path.join(dist,'style.css'))).digest('hex').slice(0,12);
const html=(await readFile(path.join(dist,'index.html'),'utf8')).replace(/(src|href)="\.\/(app\.js|field\.js|style\.css)"/g,(_,attr,file)=>`${attr}="./${file}?v=${version}"`);
await writeFile(path.join(dist,'index.html'),html);await writeFile(path.join(dist,'.nojekyll'),'');
console.log('Built static GitHub Pages artifact in dist/; no server or private deployment metadata.');
