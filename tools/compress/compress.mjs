// Sažimanje assets/models.glb nakon Blender izvoza (Draco geometrija + čišćenje animacija).
// Pokretanje:  cd tools/compress && npm install && node compress.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, resample, dedup, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { readFileSync, writeFileSync, statSync } from 'fs';

const file = process.argv[2] || '../../assets/models.glb';
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule() });
const before = statSync(file).size;
const doc = await io.read(file);
await doc.transform(
  dedup(),
  resample({ tolerance: 1e-4 }),      // makni suvišne ključne sličice animacija
  prune({ keepLeaves: true, keepAttributes: true }),
  draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8, encodeSpeed: 3, decodeSpeed: 5 }),
);
const out = await io.writeBinary(doc);
writeFileSync(file, out);
console.log('GLB: %d KB → %d KB', Math.round(before / 1024), Math.round(out.byteLength / 1024));
// file:// kopija: GLB + JS Draco dekoder kao base64 (preglednik tada ne smije dohvaćati datoteke)
if(!process.argv[2]){
  const dec = readFileSync('../../lib/draco/draco_decoder.js');
  writeFileSync('../../assets/models.js', '/* generirano: tools/blender/build_models.py + tools/compress/compress.mjs — ne uređuj ručno */\n' +
    'window.MODELS_GLB_B64 = "' + Buffer.from(out).toString('base64') + '";\n' +
    'window.DRACO_JS_B64 = "' + dec.toString('base64') + '";\n');
  console.log('models.js zapisan');
}
