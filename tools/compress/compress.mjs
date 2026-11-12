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
/* 🎬 v0.56: Blender za svaki animirani dio izveze sva tri kanala (položaj, okret, veličina), i kad se u isječku
   ne mijenjaju. Kanal koji cijelo vrijeme stoji na vrijednosti mirovanja tog dijela ne radi ništa — three.js
   dijelu bez kanala sam drži vrijednost mirovanja — pa ga brišemo: manji GLB i manje posla za mikser animacija. */
function dropRestChannels(){
  return doc => {
    const EPS = 1e-5;
    let dropped = 0, kept = 0;
    for(const anim of doc.getRoot().listAnimations()){
      for(const ch of anim.listChannels()){
        const node = ch.getTargetNode(), path = ch.getTargetPath(), smp = ch.getSampler();
        const out = smp && smp.getOutput();
        if(!node || !out || smp.getInterpolation() === 'CUBICSPLINE'){ kept++; continue; }
        const rest = path === 'translation' ? node.getTranslation() : path === 'rotation' ? node.getRotation() : path === 'scale' ? node.getScale() : null;
        if(!rest){ kept++; continue; }
        const arr = out.getArray(), n = rest.length;
        let same = true;
        for(let i = 0; i < arr.length && same; i++){
          const d = Math.abs(arr[i] - rest[i % n]);
          // kvaternion q i -q su isti okret
          if(d > EPS && !(path === 'rotation' && Math.abs(arr[i] + rest[i % n]) <= EPS && rest.every((v, k) => Math.abs(arr[i - (i % n) + k] + v) <= EPS))) same = false;
        }
        if(same){ anim.removeChannel(ch); ch.dispose(); dropped++; } else kept++;
      }
      for(const smp of anim.listSamplers()) if(!anim.listChannels().some(c => c.getSampler() === smp)){ anim.removeSampler(smp); smp.dispose(); }
    }
    console.log('kanali animacija: %d obrisano (stoje na mirovanju), %d ostaje', dropped, kept);
  };
}
await doc.transform(
  dedup(),
  resample({ tolerance: 1e-4 }),      // makni suvišne ključne sličice animacija
  dropRestChannels(),
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
