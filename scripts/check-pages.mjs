#!/usr/bin/env node
// Offline validation of the actual publication tree, including project-Pages paths.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NODE_COUNT = 34395, CELL_COUNT = 64453;
const errors = [], reports = [];
const check = (condition, message) => { if (!condition) errors.push(message); return !!condition; };
const finiteOrNull = value => value === null || (typeof value === 'number' && Number.isFinite(value));
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const exists = async file => stat(file).then(() => true, () => false);
async function files(directory, prefix = '') {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const name = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) { errors.push(`Symlink is not a publication asset: ${name}`); continue; }
    if (entry.isDirectory()) found.push(...await files(path.join(directory, entry.name), name));
    else found.push(name);
  }
  return found;
}
async function json(directory, name) {
  try { return JSON.parse(await readFile(path.join(directory, name), 'utf8')); }
  catch (error) { errors.push(`${path.basename(directory)}/${name}: ${error.message}`); return null; }
}
function vectorArrays(field, size, label) {
  if (!check(Array.isArray(field.u) && Array.isArray(field.v) && field.u.length === size && field.v.length === size,
    `${label}: u/v must both contain ${size} entries`)) return;
  let wet = 0, invalid = 0;
  for (let i = 0; i < size; i++) {
    const u = field.u[i], v = field.v[i];
    if (!finiteOrNull(u) || !finiteOrNull(v) || (u === null) !== (v === null)) invalid++;
    else if (u !== null) wet++;
  }
  check(!invalid, `${label}: ${invalid} invalid or unpaired velocity entries`);
  check(wet > 0, `${label}: no wet cells`);
}
function meanMetadata(field, label) {
  check(field.mode === 'average' || field.kind?.endsWith('-average'), `${label}: mean must declare its averaging mode`);
  check(Number.isInteger(field.sampleCount) && field.sampleCount >= 8, `${label}: mean requires at least 8 successful samples`);
  const start = Date.parse(field.start), end = Date.parse(field.end);
  check(validDate(field.start) && validDate(field.end) && start < end, `${label}: invalid mean start/end`);
  check(end - start === 24 * 3600000, `${label}: labelled 24-hour mean must span exactly 24 hours`);
  check(validDate(field.time) && Date.parse(field.time) >= start && Date.parse(field.time) <= end, `${label}: mean representative time is outside its period`);
  const samples = field.samples || field.sampleTimes;
  if (samples !== undefined) {
    check(Array.isArray(samples) && samples.length === field.sampleCount, `${label}: actual sample list does not match sampleCount`);
    if (Array.isArray(samples)) {
      const times = samples.map(sample => typeof sample === 'string' ? sample : sample?.time);
      check(times.every(validDate), `${label}: invalid source sample time`);
      check(new Set(times.map(time => Date.parse(time))).size === times.length, `${label}: duplicate source sample times`);
      check(times.every(time => Date.parse(time) >= start && Date.parse(time) <= end), `${label}: sample outside mean period`);
    }
  }
}
function fieldData(field, label, expectedKind, mean = false) {
  if (!field) return;
  check(field.kind === expectedKind || (mean && field.kind === `${expectedKind}-average`), `${label}: expected kind ${expectedKind}${mean ? ' or its average variant' : ''}`);
  check(validDate(field.time), `${label}: invalid valid time`);
  if (expectedKind === 'mesh') {
    vectorArrays(field, CELL_COUNT, label);
    check(Array.isArray(field.t) && field.t.length === NODE_COUNT && field.t.every(finiteOrNull), `${label}: t must contain ${NODE_COUNT} finite/null node values`);
  } else {
    const dimensions = Number.isInteger(field.width) && field.width > 1 && Number.isInteger(field.height) && field.height > 1;
    check(dimensions, `${label}: invalid regular-grid dimensions`);
    check(Number.isFinite(field.dx) && field.dx > 0 && Number.isFinite(field.dy) && field.dy > 0, `${label}: grid dx/dy must be positive`);
    check(Number.isFinite(field.west) && Number.isFinite(field.south), `${label}: invalid grid origin`);
    if (dimensions) vectorArrays(field, field.width * field.height, label);
    if (field.t !== null && field.t !== undefined)
      check(Array.isArray(field.t) && field.t.length === field.width * field.height && field.t.every(finiteOrNull), `${label}: invalid grid temperatures`);
  }
  if (mean) meanMetadata(field, label);
}
function experimentalSimcoe(field,label){
  if(!field)return;fieldData(field,label,'experimental-grid');
  check(field.sourceType==='experimental-wind-response'&&field.experimental===true&&field.validated===false,`${label}: must explicitly declare an unvalidated experimental wind response`);
  check(field.layer==='depth-averaged wind response'&&field.t===null,`${label}: depth-averaged response must have no temperature field`);
  check((!field.units||field.units==='m/s')&&(!field.velocityUnits||field.velocityUnits==='m/s'),`${label}: experimental velocity units must be metres per second`);
  check(Date.parse(field.start)===Date.parse('2026-10-12T00:00:00Z')&&Date.parse(field.end)===Date.parse('2026-10-17T12:00:00Z')&&Date.parse(field.time)===Date.parse(field.end),`${label}: fixed experimental period must remain 12 Oct 00Z to 17 Oct 12Z 2026`);
  check(typeof field.method==='string'?field.method.trim().length>0:Boolean(field.method&&typeof field.method==='object'&&!Array.isArray(field.method)&&typeof field.method.equations==='string'&&field.method.equations.trim()),`${label}: experimental method is required`);
  check(Boolean(field.provenance)&&(typeof field.provenance==='object'?Object.keys(field.provenance).length>0:typeof field.provenance==='string'&&field.provenance.trim().length>0),`${label}: experimental provenance is required`);
}
function polygonGeometry(geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return Array.isArray(polygons) && polygons.length > 0 && polygons.every(polygon =>
    Array.isArray(polygon) && polygon.length > 0 && polygon.every(ring => Array.isArray(ring) && ring.length >= 4 &&
      ring.every(point => Array.isArray(point) && point.length >= 2 && point.slice(0, 2).every(Number.isFinite)) &&
      ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]));
}
async function inspectTree(directory, label) {
  const names = await files(directory), nameSet = new Set(names);
  for (const name of names) {
    check(!/(^|\/)\.openai(\/|$)|(^|\/)\.env(?:\.|$)|(^|\/)(?:_worker|server)\.(?:[cm]?js|ts)$|(^|\/)wrangler\./i.test(name), `${label}: nonstatic/private file ${name}`);
    if (/\.(?:html|css|[cm]?js|ya?ml|json|txt)$/i.test(name)) {
      const text = await readFile(path.join(directory, name), 'utf8');
      check(!/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/.test(text), `${label}: possible credential in ${name}`);
      if (/\.(?:html|css|js)$/i.test(name)) {
        check(!/['"`]\/api(?:[\/'"`?])/.test(text), `${label}/${name}: runtime /api dependency`);
        check(!/\.find\s*\([^\n;]{0,200}(?:===|==)\s*['"]Lake Ontario['"]/.test(text), `${label}/${name}: obsolete single-feature Lake Ontario lookup`);
      }
    }
  }
  const required = ['index.html', 'app.js', 'field.js', 'mesh-flow.js', 'speed-style.js', 'style.css', 'geography.json', 'mesh.json',
    ...['manifest', 'catalog', 'snapshot', 'average', 'river', 'river-average', 'estuary', 'estuary-average'].map(n => `data/${n}.json`)];
  for (const name of required) check(nameSet.has(name), `${label}: missing ${name}`);
  const page = await readFile(path.join(directory, 'index.html'), 'utf8');
  check(page.includes('href="https://khayoon.github.io/lake-ontario-temperature/"'), `${label}: missing related temperature-project link`);
  check(page.includes('href="./media/october-current-map.mp4"'), `${label}: missing the speed project's own film link`);
  check(/class="selected" data-layer="speed"/.test(page), `${label}: current speed must remain the initial layer`);
  check(!page.includes('href="./media/lake-ontario-closeup.mp4'), `${label}: the historical temperature video must not be featured as the speed film`);
  const base = new URL('https://example.invalid/owner/project/');
  async function localAsset(reference, from, partial = false) {
    if (!reference || reference.startsWith('#') || /^(?:https?:|data:|mailto:|tel:|\/\/)/i.test(reference)) return;
    check(!reference.startsWith('/'), `${label}/${from}: root-absolute local reference ${reference}`);
    const url = new URL(reference, new URL(from, base));
    if (!check(url.href.startsWith(base.href), `${label}/${from}: reference escapes project base ${reference}`)) return;
    const resolved = decodeURIComponent(url.pathname.slice(base.pathname.length));
    if (!partial) {
      // The build copies curated root/media assets alongside the src tree.
      const sharedMedia = label === 'src' && resolved.startsWith('media/') && await exists(path.join(root, resolved));
      // This independently dated experiment is optional; the browser retains
      // government sources when it is unavailable. Validate its schema below
      // whenever the actual file is included.
      const optionalExperiment = resolved === 'data/simcoe-experimental.json';
      check(nameSet.has(resolved) || sharedMedia || optionalExperiment, `${label}/${from}: missing local reference ${reference}`);
    }
  }
  for (const name of names.filter(n => /\.(html|css|js)$/.test(n))) {
    const text = await readFile(path.join(directory, name), 'utf8');
    const pattern = name.endsWith('.html') ? /\b(?:src|href)\s*=\s*['"]([^'"]+)['"]/g
      : name.endsWith('.css') ? /url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g
      : /(?:fetch|loadJSON)\(\s*['"]([^'"]+)['"]/g;
    for (const match of text.matchAll(pattern)) {
      const dynamicPrefix = name.endsWith('.js') && /^\s*\+/.test(text.slice(match.index + match[0].length));
      await localAsset(match[1], name, dynamicPrefix);
    }
  }
  const mesh = await json(directory, 'mesh.json');
  if (mesh) {
    check(Array.isArray(mesh.lon) && Array.isArray(mesh.lat) && mesh.lon.length === NODE_COUNT && mesh.lat.length === NODE_COUNT,
      `${label}: mesh must contain exactly ${NODE_COUNT} nodes`);
    check(mesh.lon?.every(Number.isFinite) && mesh.lat?.every(Number.isFinite), `${label}: invalid mesh coordinates`);
    check(Array.isArray(mesh.triangles) && mesh.triangles.length === CELL_COUNT && mesh.triangles.every(triangle =>
      Array.isArray(triangle) && triangle.length === 3 && new Set(triangle).size === 3 && triangle.every(i => Number.isInteger(i) && i >= 0 && i < NODE_COUNT)),
      `${label}: mesh must contain ${CELL_COUNT} valid triangles`);
  }
  const geography = await json(directory, 'geography.json');
  check(geography?.type === 'FeatureCollection' && Array.isArray(geography.features) && geography.features.some(f => polygonGeometry(f.geometry)), `${label}: missing union water polygons`);
  if (geography?.features) check(geography.features.filter(f => ['Polygon', 'MultiPolygon'].includes(f.geometry?.type)).every(f => polygonGeometry(f.geometry)), `${label}: invalid/unclosed water polygon`);
  const catalog = await json(directory, 'data/catalog.json');
  const frames = catalog?.frames;
  if (check(Array.isArray(frames) && frames.length > 0, `${label}: empty catalogue`)) {
    check(validDate(catalog.run), `${label}: invalid catalogue run`);
    check(Number.isInteger(catalog.currentIndex) && catalog.currentIndex >= 0 && catalog.currentIndex < frames.length, `${label}: invalid currentIndex`);
    let latestNowcast = -1, latestTime = -Infinity;
    const urls = new Set(), times = [];
    for (const [index, frame] of frames.entries()) {
      check(typeof frame.id === 'string' && frame.id.length > 0 && validDate(frame.time) && validDate(frame.run), `${label}: invalid catalogue frame ${index}`);
      check(['nowcast', 'forecast'].includes(frame.kind), `${label}: invalid frame kind ${index}`);
      check(/^data\/fields\/[a-f0-9]+\.json$/.test(frame.url || ''), `${label}: invalid hashed field URL ${index}`);
      if (!frame.url || !/^data\/fields\/[a-f0-9]+\.json$/.test(frame.url)) continue;
      await localAsset(frame.url, 'index.html');
      check(!urls.has(frame.url), `${label}: duplicate field URL ${frame.url}`); urls.add(frame.url);
      const field = await json(directory, frame.url);
      fieldData(field, `${label}/${frame.url}`, 'mesh');
      if (field) check(Date.parse(field.time) === Date.parse(frame.time), `${label}: field/catalogue valid time differs at ${index}`);
      const time = Date.parse(frame.time); times.push(time);
      if (frame.kind === 'nowcast' && time > latestTime) { latestTime = time; latestNowcast = index; }
    }
    check(times.every((time, i) => !i || time > times[i - 1]), `${label}: catalogue times must be distinct and sorted`);
    check(latestNowcast >= 0 && catalog.currentIndex === latestNowcast, `${label}: currentIndex must select latest nowcast, not forecast`);
    reports.push(`${label}: ${frames.length} catalogue fields`);
  }
  for (const [name, kind, mean] of [['snapshot','mesh',false], ['average','mesh',true], ['river','river',false],
    ['river-average','river',true], ['estuary','estuary',false], ['estuary-average','estuary',true]])
    fieldData(await json(directory, `data/${name}.json`), `${label}/data/${name}.json`, kind, mean);
  if(nameSet.has('data/simcoe-experimental.json'))experimentalSimcoe(await json(directory,'data/simcoe-experimental.json'),`${label}/data/simcoe-experimental.json`);
  const manifest = await json(directory, 'data/manifest.json');
  if (manifest) for (const key of ['noaa', 'river', 'estuary']) {
    const provider = manifest.providers?.[key] ?? manifest[key];
    check(provider && ['current', 'retained', 'stored', 'error'].includes(provider.status), `${label}: missing/invalid ${key} source status`);
    if (provider) {
      const date = provider.sourceTime ?? provider.time ?? provider.date ?? provider.sourceDate ?? provider.validTime;
      check(validDate(date), `${label}: ${key} must retain an explicit valid source date`);
      if (provider.status === 'error' || provider.status === 'retained') check(typeof provider.error === 'string' && provider.error.length > 0, `${label}: ${key} failure/retention requires an error reason`);
    }
  }
  await fieldFixtures(directory, label);
}
async function fieldFixtures(directory, label) {
  try {
    const context = vm.createContext({});
    vm.runInContext(await readFile(path.join(directory, 'mesh-flow.js'), 'utf8'), context, { timeout: 5000 });
    vm.runInContext(await readFile(path.join(directory, 'speed-style.js'), 'utf8'), context, { timeout: 5000 });
    vm.runInContext(await readFile(path.join(directory, 'field.js'), 'utf8'), context, { timeout: 5000 });
    const mesh = { lon: [0, 8, 0], lat: [0, 0, 8], triangles: [[0, 1, 2]] };
    const field = { kind: 'mesh', u: [1], v: [-1], t: [10, 20, 30] };
    const identity = (x, y) => [x, y];
    const native = context.makeDisplay(mesh, field, null, identity, identity, 8, 8, null);
    const sample = (grid, x, y) => context.displaySample(grid, x, y);
    assert.equal(sample(native, 3, 5)?.[3], 1, 'native triangle edge should be painted');
    assert.equal(sample(native, 5, 5), null, 'no lake extrapolation beyond native triangles');
    assert.equal(sample(native, 8, 1), null, 'screen boundary must stay outside');
    assert.equal(sample(native, 1, 1)?.[2], 13.75, 'temperature must interpolate barycentrically');
    const river = { width: 5, height: 5, west: 0, south: 0, dx: 2, dy: 2, u: Array(25).fill(2), v: Array(25).fill(0) };
    const estuary = { ...river, u: Array(25).fill(3), v: Array(25).fill(0) };
    estuary.u[24] = estuary.v[24] = null;
    const overlay = context.makeDisplay(mesh, field, river, identity, identity, 8, 8, estuary);
    assert.equal(sample(overlay, 1, 1)?.[0], 1, 'native lake must take precedence over river grids');
    assert.equal(sample(overlay, 5, 5)?.[0], 3, 'surface estuary must take precedence over depth-averaged river');
    assert.equal(sample(overlay, 7, 7)?.[0], 2, 'missing estuary cell must retain the available river field');
    const dry = { ...river, u: Array(25).fill(null), v: Array(25).fill(null) };
    const dryGrid = context.makeDisplay({ lon: [], lat: [], triangles: [] }, null, dry, identity, identity, 8, 8, null);
    assert.equal(dryGrid.valid.length, 0, 'dry grid must not invent water currents');
    const simcoe={...river,u:Array(25).fill(.04),v:Array(25).fill(.02),t:null};
    const experimental=context.makeDisplay({lon:[],lat:[],triangles:[]},null,null,identity,identity,8,8,null,simcoe);
    assert.equal(sample(experimental,1,1)?.[3],4,'Optional Simcoe response must retain provider 4');
    assert.equal(sample(experimental,1,1)?.[2],null,'Experimental response must not create a temperature');
    const mixed=context.makeDisplay(mesh,field,river,identity,identity,8,8,estuary,simcoe);
    assert.equal(sample(mixed,1,1)?.[3],1,'Experiment must not overwrite native lake currents');
    assert.equal(sample(mixed,5,5)?.[3],3,'Experiment must not overwrite surface estuary currents');
    assert.equal(sample(mixed,7,7)?.[3],2,'Experiment must not overwrite available depth-averaged river currents');
    const riverGap={...river,u:[...river.u],v:[...river.v]};riverGap.u[24]=riverGap.v[24]=null;
    const filled=context.makeDisplay(mesh,field,riverGap,identity,identity,8,8,estuary,simcoe);
    assert.equal(sample(filled,7,7)?.[3],4,'Experiment may fill a cell with no government vector');
    assert(Math.abs(sample(filled,7,7)[0]-.04)<1e-6,'Experiment must preserve supplied velocity magnitude');
    assert.equal(sample(filled,7,7)[2],null,'Filled experimental cell has no supplied temperature');
    reports.push(`${label}: native-edge, clipping, temperature and provider-priority fixtures passed`);
  } catch (error) { errors.push(`${label}: field fixture failed: ${error.message}`); }
}

try {
  for (const name of await files(root)) {
    check(!/(^|\/)\.openai(\/|$)|(^|\/)\.env(?:\.|$)|(^|\/)(?:_worker|server)\.(?:[cm]?js|ts)$|(^|\/)wrangler\./i.test(name), `Private/server file in package: ${name}`);
    if (/\.(?:[cm]?js|ya?ml)$/i.test(name)) {
      const text = await readFile(path.join(root, name), 'utf8');
      check(!/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/.test(text), `Possible credential in package: ${name}`);
    }
  }
  await inspectTree(path.join(root, 'src'), 'src');
  if (await exists(path.join(root, 'dist'))) {
    await inspectTree(path.join(root, 'dist'), 'dist');
    const distFiles = await files(path.join(root, 'dist'));
    const legacyPath = path.join(root, 'dist/media/lake-ontario-closeup.mp4');
    if (check(await exists(legacyPath), 'dist: missing compatibility video for previously shared links')) {
      const legacy = await readFile(legacyPath);
      check(legacy.length === 103544787 && createHash('sha256').update(legacy).digest('hex') === '5c57c348290d527c350ecba138517da96803dce5254ba2926282e4bc5a932458', 'dist: compatibility video must retain the accepted film bytes');
      reports.push('dist: legacy MP4 URL retains the accepted film bytes');
    }
    check(!distFiles.some(name => /(^|\/)(?:lib|scripts|\.github)(\/|$)|\.(?:zip|tar|gz|mov)$/i.test(name) ||
      (/\.mp4$/i.test(name) && !name.startsWith('media/'))), 'dist includes build/private/archive files or unexpected movies');
    for (const name of distFiles) {
      const src = path.join(root, 'src', name);
      if (await exists(src)) {
        const current = await readFile(src), built = await readFile(path.join(root, 'dist', name));
        const normalize = html => html.replace(/((?:src|href)="\.\/(?:app\.js|field\.js|mesh-flow\.js|speed-style\.js|style\.css))\?v=[a-f0-9]+"/g, '$1"');
        const same = name === 'index.html' ? normalize(current.toString()) === normalize(built.toString()) : current.equals(built);
        check(same, `dist/${name} differs from current src; rebuild before publication`);
      } else if (name.startsWith('media/')) {
        const media = path.join(root, name);
        check(await exists(media) && (await readFile(media)).equals(await readFile(path.join(root, 'dist', name))), `dist/${name} differs from curated media; rebuild before publication`);
      }
    }
    const srcFiles = await files(path.join(root, 'src'));
    check(srcFiles.every(name => distFiles.includes(name)), 'dist is missing source assets; rebuild before publication');
  } else reports.push('dist: not built yet (run the build, then this check again)');
} catch (error) { errors.push(error.stack || error.message); }
if (errors.length) {
  console.error(`Pages validation failed (${errors.length}):\n${errors.slice(0, 30).map(e => `- ${e}`).join('\n')}${errors.length > 30 ? '\n- Further errors omitted' : ''}`);
  process.exitCode = 1;
} else console.log(`Pages validation passed.\n${reports.join('\n')}`);
