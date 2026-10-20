'use strict';
/* ============================================================
   DOTA Kids 3D — Three.js prikaz
   Logika igre je u game.js (x, y po tlu) — ovdje se svijet crta
   u 3D: logički y postaje os Z, visina (groundHeight) je os Y.
   Teren ima visine: rijeka je nizina, baze su platoi!

   3D modeli (junaci, vojnici, čudovišta, kule, drveće...) su
   napravljeni u Blenderu: tools/blender/build_models.py ih
   modelira i animira i izvozi u assets/models.glb.
   ============================================================ */

let renderer3 = null, scene3 = null, camera3 = null, sunLight = null, hemiLight = null;
let groundMesh = null, treesGroup = null, staticGroup = null, playerRing3 = null;
let castInd = null;   // indikatori ciljanja (domet + područje + linija)
let fogTex = null, fogDrape = null;   // magla rata
let waterMesh = null;

if(THREE.ColorManagement){
  // hex boje → linearni prostor (isto kao boje vrhova iz Blendera)
  if('legacyMode' in THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
  if('enabled' in THREE.ColorManagement) THREE.ColorManagement.enabled = true;
}

function setFogCanvas(cv){
  fogTex = new THREE.CanvasTexture(cv);
}
function markFogDirty(){
  if(fogTex) fogTex.needsUpdate = true;
}

const CAM_PITCH = 0.96;
const CAM_DIST = 1300;

const meshByUnit = new Map();
const zoneMeshes = new Map();
const projMeshes = new Map();
const markerMeshes = new Map();
const lineMeshes = new Map();
const runeMeshes = new Map();
const dying = [];          // modeli koji upravo padaju / tonu (smrt)

const geoCache = {};
const matCache = {};
const emojiTexCache = {};
let glowTex = null;

const DAY_SKY = { day: null, night: null, sunDay: null, sunNight: null };

/* ---------- veličine Blender modela u jedinicama igre ---------- */
const MODEL_SCALE = {
  hero: 46, creep_melee: 34, creep_ranged: 32, creep_siege: 40,
  tower: 32, ancient: 48, fountain: 42,
};

/* ================= Blender modeli (GLB) ================= */
const MODELS = { ready: false, failed: false, tpl: {}, clips: {}, merged: {}, waiting: [] };

function onModelsReady(fn){
  if(MODELS.ready || MODELS.failed) fn();
  else MODELS.waiting.push(fn);
}

function loadModels3D(){
  if(!THREE.GLTFLoader){ MODELS.failed = true; return; }
  const loader = new THREE.GLTFLoader();
  const fail = err => {
    console.warn('Modeli se nisu učitali — koristim jednostavne oblike.', err);
    MODELS.failed = true;
    MODELS.waiting.splice(0).forEach(f => f());
  };
  const done = gltf => {
    try { indexModels(gltf); }
    catch(e){ fail(e); return; }
    MODELS.ready = true;
    MODELS.waiting.splice(0).forEach(f => f());
  };
  if(window.MODELS_GLB_B64){
    // file:// — GLB je ugrađen u assets/models.js kao base64
    const bin = atob(window.MODELS_GLB_B64);
    const buf = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    loader.parse(buf.buffer, '', done, fail);
  } else {
    loader.load('assets/models.glb', done, undefined, fail);
  }
}

function indexModels(gltf){
  const roots = gltf.scene.children.slice();
  for(const r of roots){
    gltf.scene.remove(r);
    r.updateMatrixWorld(true);
    r.traverse(o => {
      if(o.isMesh){
        o.geometry.userData.shared = true;
        o.userData.matName = (o.material && o.material.name) || 'VC';
      }
    });
    MODELS.tpl[r.name] = r;
  }
  for(const clip of gltf.animations){
    const k = clip.name.split('|');
    if(k.length < 2) continue;
    (MODELS.clips[k[0]] = MODELS.clips[k[0]] || {})[k[1]] = clip;
  }
}

/* materijali modela: VC = boje vrhova, TEAM = boje vrhova × boja tima,
   GLOW = svijetli (bez sjene), TEAMGLOW = svijetli u boji tima.
   look: 'n' normalno, 'f' bljesak pogotka, 'g' prozirno (nevidljivost) */
function modelMat(name, team, look){
  const key = 'M' + name + '|' + team + '|' + look;
  if(matCache[key]) return matCache[key];
  let m;
  const tc = TEAM_COLOR[team] || '#ffffff';
  if(name === 'GLOW'){
    m = new THREE.MeshBasicMaterial({ vertexColors: true });
  } else if(name === 'TEAMGLOW'){
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(TEAM_LIGHT[team] || '#ffffff').lerp(new THREE.Color('#ffffff'), 0.25) });
  } else {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0,
      color: name === 'TEAM' ? tc : 0xffffff });
    if(look === 'f'){ m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 0.32; }
  }
  if(look === 'g'){ m.transparent = true; m.opacity = 0.32; m.depthWrite = false; }
  m.userData.shared = true;
  matCache[key] = m;
  return m;
}

/* novi primjerak modela (dijeli geometriju i materijale s predloškom) */
function modelInstance(name, team, scale){
  const tpl = MODELS.tpl[name];
  if(!tpl) return null;
  const obj = tpl.clone(true);
  obj.position.set(0, 0, 0);
  obj.scale.setScalar(scale);
  const meshes = [];
  obj.traverse(o => {
    if(!o.isMesh) return;
    const mn = o.userData.matName;
    o.material = modelMat(mn, team, 'n');
    o.castShadow = mn !== 'GLOW' && mn !== 'TEAMGLOW';
    meshes.push(o);
  });
  obj.userData.meshes = meshes;
  obj.userData.team = team;
  obj.userData.look = 'n';
  obj.userData.parts = {};
  obj.traverse(o => {
    const i = o.name.lastIndexOf('_');
    if(o !== obj && i > 0) obj.userData.parts[o.name.slice(i + 1)] = o;
  });
  return obj;
}
function setModelLook(obj, look){
  const ud = obj.userData;
  if(!ud.meshes || ud.look === look) return;
  ud.look = look;
  for(const m of ud.meshes) m.material = modelMat(m.userData.matName, ud.team, look);
}

/* ---------- animacije (AnimationMixer po jedinici) ---------- */
function makeAnimator(root, name){
  const clips = MODELS.clips[name];
  if(!clips) return null;
  const mixer = new THREE.AnimationMixer(root);
  const acts = {};
  for(const k in clips) acts[k] = mixer.clipAction(clips[k]);
  const a = { mixer, acts, cur: null, oneEnd: 0 };
  animBase(a, 'idle', 1, 0);
  if(acts.idle) acts.idle.time = Math.random() * clips.idle.duration;
  return a;
}
function animBase(a, name, ts, now){
  const act = a.acts[name];
  if(!act) return;
  if(now < a.oneEnd) return;               // jednokratna radnja (napad) još traje
  if(a.cur === name){ act.timeScale = ts; return; }
  act.reset();
  act.setLoop(THREE.LoopRepeat, Infinity);
  act.timeScale = ts;
  act.play();
  const prev = a.cur && a.acts[a.cur];
  if(prev) act.crossFadeFrom(prev, 0.15, false);
  a.cur = name;
}
function animOnce(a, name, ts, now, startAt){
  const act = a.acts[name];
  if(!act) return;
  const prev = a.cur && a.cur !== name ? a.acts[a.cur] : null;
  act.reset();
  act.setLoop(THREE.LoopOnce, 1);
  act.clampWhenFinished = true;
  act.timeScale = ts;
  act.time = startAt || 0;
  act.play();
  if(prev) act.crossFadeFrom(prev, 0.06, false);
  a.cur = name;
  a.oneEnd = now + (act.getClip().duration - (startAt || 0)) / ts - 0.07;
}

/* spojena geometrija modela (za instancirano drveće i ukrase) */
function mergedModelGeo(name){
  if(MODELS.merged[name] !== undefined) return MODELS.merged[name];
  const tpl = MODELS.tpl[name];
  let geo = null;
  if(tpl && THREE.mergeBufferGeometries){
    const parts = [];
    tpl.updateMatrixWorld(true);
    tpl.traverse(o => {
      if(!o.isMesh) return;
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      for(const k of Object.keys(g.attributes)) if(!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
      parts.push(g);
    });
    geo = parts.length ? THREE.mergeBufferGeometries(parts, false) : null;
    if(geo) geo.userData.shared = true;
  }
  MODELS.merged[name] = geo;
  return geo;
}

/* ---------- zajednički resursi ---------- */
function cachedGeo(key, makeFn){
  if(!geoCache[key]){ geoCache[key] = makeFn(); geoCache[key].userData.shared = true; }
  return geoCache[key];
}
function lambMat(color){
  const key = 'L' + color;
  if(!matCache[key]){
    matCache[key] = new THREE.MeshLambertMaterial({ color });
    matCache[key].userData.shared = true;
  }
  return matCache[key];
}
function basicMat(color){
  const key = 'B' + color;
  if(!matCache[key]){
    matCache[key] = new THREE.MeshBasicMaterial({ color });
    matCache[key].userData.shared = true;
  }
  return matCache[key];
}
function invisMat(team){
  const key = 'I' + team;
  if(!matCache[key]){
    matCache[key] = new THREE.MeshLambertMaterial({ color: TEAM_LIGHT[team], transparent: true, opacity: 0.35 });
    matCache[key].userData.shared = true;
  }
  return matCache[key];
}
function glowMat(color){
  const key = 'G' + color;
  if(!matCache[key]){
    matCache[key] = new THREE.SpriteMaterial({ map: makeGlowTexture(), color,
      transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
    matCache[key].userData.shared = true;
  }
  return matCache[key];
}
function makeGlowTexture(){
  if(glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
function makeEmojiTexture(ch){
  if(emojiTexCache[ch]) return emojiTexCache[ch];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '96px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  if(THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
  emojiTexCache[ch] = tex;
  return tex;
}
function emojiSprite(ch, size){
  const m = new THREE.SpriteMaterial({ map: makeEmojiTexture(ch), transparent: true, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  return s;
}
/* AI portret kao okrugla 3D glava — samo ako Blender modeli nisu dostupni */
const portraitTexCache = {};
function portraitTexture(im, fallbackEmoji, ringColor, key){
  if(portraitTexCache[key]) return portraitTexCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  if(THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
  const draw = () => {
    g.clearRect(0, 0, 256, 256);
    if(im && im.complete && im.naturalWidth > 0){
      g.save();
      g.beginPath(); g.arc(128, 128, 117, 0, Math.PI * 2); g.clip();
      g.drawImage(im, 6, 6, 244, 244);
      g.restore();
      g.strokeStyle = ringColor;
      g.lineWidth = 14;
      g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
    } else {
      g.font = '190px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(fallbackEmoji, 128, 140);
    }
    tex.needsUpdate = true;
  };
  draw();
  if(im && !(im.complete && im.naturalWidth > 0)) im.addEventListener('load', draw);
  portraitTexCache[key] = tex;
  return tex;
}
function portraitSprite(im, fallbackEmoji, ringColor, key, size){
  const m = new THREE.SpriteMaterial({ map: portraitTexture(im, fallbackEmoji, ringColor, key),
    transparent: true, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  return s;
}
function disposeGroup(g){
  if(g.userData && g.userData.anim){
    g.userData.anim.mixer.stopAllAction();
    g.userData.anim.mixer.uncacheRoot(g.userData.anim.mixer.getRoot());
    g.userData.anim = null;
  }
  g.traverse(o => {
    if(o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if(o.material && !o.material.userData.shared) o.material.dispose();
  });
}

/* ---------- inicijalizacija ---------- */
function initScene3D(glCanvas){
  renderer3 = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
  renderer3.shadowMap.enabled = true;
  renderer3.shadowMap.type = THREE.PCFSoftShadowMap;
  if('outputEncoding' in renderer3 && THREE.sRGBEncoding !== undefined)
    renderer3.outputEncoding = THREE.sRGBEncoding;
  renderer3.toneMapping = THREE.ACESFilmicToneMapping;
  renderer3.toneMappingExposure = 1.05;

  scene3 = new THREE.Scene();
  scene3.background = new THREE.Color(0x9fdcff);
  scene3.fog = new THREE.Fog(0x9fdcff, 3200, 6500);

  DAY_SKY.day = new THREE.Color(0x9fdcff);
  DAY_SKY.night = new THREE.Color(0x1c2750);
  DAY_SKY.sunDay = new THREE.Color(0xfff2d0);
  DAY_SKY.sunNight = new THREE.Color(0x9db8ff);

  camera3 = new THREE.PerspectiveCamera(50, 1, 10, 14000);

  hemiLight = new THREE.HemisphereLight(0xdff2ff, 0x5a7d3c, 0.75);
  scene3.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xfff2d0, 1.1);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = -1400; sc.right = 1400; sc.top = 1400; sc.bottom = -1400;
  sc.near = 100; sc.far = 5000;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 1.5;
  scene3.add(sunLight);
  scene3.add(sunLight.target);

  const skirt = new THREE.Mesh(
    cachedGeo('skirt', () => new THREE.PlaneGeometry(18000, 18000)),
    lambMat('#2f5d23'));
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.set(WORLD / 2, -4, WORLD / 2);
  scene3.add(skirt);

  initFx();
  loadModels3D();
}

function resize3D(){
  if(!renderer3) return;
  renderer3.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer3.setSize(VW, VH, false);
  camera3.aspect = VW / VH;
  camera3.updateProjectionMatrix();
  if(fx.mat){
    fx.mat.uniforms.scale.value = VH * renderer3.getPixelRatio() * 0.5 /
      Math.tan(THREE.MathUtils.degToRad(camera3.fov * 0.5));
  }
}

function render3D(){
  renderer3.render(scene3, camera3);
}

/* ---------- dan i noć ---------- */
function applyDayNight(gt){
  if(!scene3) return;
  const k = 0.5 + 0.5 * Math.cos((gt % CFG.dayCycle) / CFG.dayCycle * TAU);
  sunLight.intensity = 0.16 + 0.94 * k;
  hemiLight.intensity = 0.3 + 0.45 * k;
  scene3.background.copy(DAY_SKY.night).lerp(DAY_SKY.day, k);
  scene3.fog.color.copy(scene3.background);
  sunLight.color.copy(DAY_SKY.sunNight).lerp(DAY_SKY.sunDay, k);
  if(waterMesh) waterMesh.material.uniforms.night.value = 1 - k;
}

/* ---------- teren s VISINAMA ---------- */
function setGround(terrainCv){
  if(groundMesh){
    scene3.remove(groundMesh);
    groundMesh.material.map.dispose();
    groundMesh.material.dispose();
    groundMesh.geometry.dispose();
  }
  const tex = new THREE.CanvasTexture(terrainCv);
  tex.anisotropy = renderer3.capabilities.getMaxAnisotropy();
  if(THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;

  const segs = 120;
  const geo = new THREE.PlaneGeometry(WORLD, WORLD, segs, segs);
  // pomakni vrhove po visini terena (lokalni +Y postaje svjetski -Z)
  const pos = geo.attributes.position;
  for(let i = 0; i < pos.count; i++){
    const wx = WORLD / 2 + pos.getX(i);
    const wy = WORLD / 2 - pos.getY(i);
    pos.setZ(i, groundHeight(wx, wy));
  }
  geo.computeVertexNormals();

  groundMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(WORLD / 2, 0, WORLD / 2);
  groundMesh.receiveShadow = true;
  scene3.add(groundMesh);

  // magla rata: prozirni tamni pokrov preko terena (ista geometrija)
  if(fogDrape){ scene3.remove(fogDrape); fogDrape.material.dispose(); }
  if(fogTex){
    fogDrape = new THREE.Mesh(geo,
      new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false }));
    fogDrape.rotation.x = -Math.PI / 2;
    fogDrape.position.set(WORLD / 2, 3, WORLD / 2);
    fogDrape.renderOrder = 4;
    scene3.add(fogDrape);
  }
  buildWater();
}

/* ---------- rijeka: animirana voda u udolini ---------- */
function buildWater(){
  if(waterMesh) return;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { t: { value: 0 }, night: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float t; uniform float night;
      void main(){
        float edge = smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
        float x = vUv.x * 160.0;
        float w1 = sin(x * 0.9 + t * 1.6 + sin(vUv.y * 18.0 + t) * 1.5);
        float w2 = sin(x * 0.37 - t * 1.1 + vUv.y * 23.0);
        float ripple = smoothstep(0.82, 1.0, w1 * 0.6 + w2 * 0.5);
        vec3 deep = mix(vec3(0.16, 0.55, 0.85), vec3(0.08, 0.16, 0.38), night);
        vec3 col = mix(deep, vec3(0.92, 0.98, 1.0), ripple * 0.75);
        float a = edge * (0.42 + ripple * 0.4);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const holder = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 1.6, 250, 1, 1), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.renderOrder = 2;
  holder.add(plane);
  holder.rotation.y = -Math.PI / 4;
  holder.position.set(WORLD / 2, 6, WORLD / 2);
  scene3.add(holder);
  waterMesh = plane;
}

/* ---------- šuma i ukrasi (instancirani Blender modeli) ---------- */
function hash01(x, y, k){
  const s = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
}
function instancedFrom(name, items, color){
  const geo = mergedModelGeo(name);
  if(!geo || !items.length) return null;
  const mat = modelMat('VC', 0, 'n');
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  const dummy = new THREE.Object3D();
  items.forEach((it, i) => {
    dummy.position.set(it.x, it.h, it.y);
    dummy.rotation.set(0, it.rot, 0);
    dummy.scale.set(it.s, it.s * (it.sy || 1), it.s);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  });
  im.castShadow = true;
  im.receiveShadow = false;
  return im;
}
function buildTrees3D(){
  if(treesGroup){ scene3.remove(treesGroup); disposeGroup(treesGroup); treesGroup = null; }
  if(!MODELS.ready){
    if(!MODELS.failed){ onModelsReady(buildTrees3D); }
    buildTreesBasic();
    return;
  }
  treesGroup = new THREE.Group();
  const buckets = {};
  const add = (name, it) => (buckets[name] = buckets[name] || []).push(it);
  for(const t of trees){
    const r = hash01(t.x, t.y, 1);
    const v = Math.floor(r * 3);
    const gh = groundHeight(t.x, t.y);
    if(t.kind === '🌲') add('tree_pine' + v, { x: t.x, y: t.y, h: gh - 2, rot: r * 6.28, s: t.size * 0.68, sy: 0.9 + r * 0.25 });
    else add('tree_oak' + v, { x: t.x, y: t.y, h: gh - 2, rot: r * 6.28, s: t.size * 0.78 });
  }
  // ukrasi: kamenje, grmlje, gljive, panjevi — samo za ljepotu
  const free = (x, y, pad) => {
    if(x < 60 || y < 60 || x > WORLD - 60 || y > WORLD - 60) return false;
    if(Math.abs(x - y) / Math.SQRT2 < 150) return false;
    for(const l of LANE_LIST) if(distToPath(LANE_PTS[l], x, y) < 105 + pad) return false;
    for(let tm = 0; tm < 2; tm++){
      if(distXY(x, y, FOUNTAIN[tm].x, FOUNTAIN[tm].y) < 360) return false;
      if(distXY(x, y, ANCIENT_POS[tm].x, ANCIENT_POS[tm].y) < 330) return false;
    }
    for(const t of trees) if(distXY(x, y, t.x, t.y) < 55) return false;
    return true;
  };
  const decoKinds = ['rock0', 'rock1', 'rock2', 'bush0', 'bush0', 'mushroom0', 'bush0', 'rock1'];
  let n = 0;
  for(let i = 0; i < 900 && n < 110; i++){
    const x = hash01(i, 3, 7) * WORLD, y = hash01(i, 11, 5) * WORLD;
    if(!free(x, y, 0)) continue;
    const kind = decoKinds[Math.floor(hash01(i, 1, 2) * decoKinds.length)];
    const s = kind.startsWith('rock') ? 26 + hash01(i, 2, 2) * 30 : (kind === 'mushroom0' ? 30 : 34 + hash01(i, 4, 4) * 18);
    add(kind, { x, y, h: groundHeight(x, y) - 1, rot: hash01(i, 5, 5) * 6.28, s });
    n++;
  }
  // kampovi u džungli: kamenje i balvan oko logora
  CAMP_SPOTS.forEach((c, ci) => {
    const R = c.type === 'boss' ? 190 : 135;
    for(let k = 0; k < 4; k++){
      const a = ci * 1.7 + k * 1.7 + 0.4;
      const x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R;
      const kind = k === 1 ? 'log0' : (k === 3 ? 'mushroom0' : 'rock' + (k % 3));
      add(kind, { x, y, h: groundHeight(x, y) - 1, rot: a, s: kind === 'log0' ? 40 : 34 });
    }
  });
  for(const name in buckets){
    const im = instancedFrom(name, buckets[name]);
    if(im) treesGroup.add(im);
  }
  scene3.add(treesGroup);
}
/* jednostavna šuma (ako modeli nisu dostupni) */
function buildTreesBasic(){
  treesGroup = new THREE.Group();
  const dummy = new THREE.Object3D();
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(6, 9, 46, 6),
    new THREE.MeshLambertMaterial({ color: 0x8b5a2b }), Math.max(1, trees.length));
  const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 9, 7),
    new THREE.MeshLambertMaterial({ color: 0x3f9b3a }), Math.max(1, trees.length));
  trees.forEach((t, i) => {
    const gh = groundHeight(t.x, t.y);
    dummy.position.set(t.x, gh + 21, t.y); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(t.x, gh + 14 + t.size * 0.78, t.y); dummy.scale.setScalar(t.size * 0.62); dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
  });
  trunks.castShadow = crowns.castShadow = true;
  treesGroup.add(trunks, crowns);
  scene3.add(treesGroup);
}

/* ---------- statika: fontane ---------- */
function buildStatic3D(){
  if(staticGroup){ scene3.remove(staticGroup); disposeGroup(staticGroup); }
  staticGroup = new THREE.Group();
  if(!MODELS.ready && !MODELS.failed) onModelsReady(buildStatic3D);
  for(let team = 0; team < 2; team++){
    const f = FOUNTAIN[team];
    const gh = groundHeight(f.x, f.y);
    const m = MODELS.ready ? modelInstance('fountain', team, MODEL_SCALE.fountain) : null;
    if(m){
      m.position.set(f.x, gh - 2, f.y);
      m.scale.y *= 0.55;   // niža fontana — junaci stoje u njoj
      m.traverse(o => { if(o.isMesh) o.receiveShadow = true; });
      staticGroup.add(m);
      continue;
    }
    const pool = new THREE.Mesh(
      cachedGeo('pool', () => new THREE.CylinderGeometry(118, 128, 18, 24)),
      lambMat('#cfeefe'));
    pool.position.set(f.x, gh + 9, f.y);
    staticGroup.add(pool);
    const spr = emojiSprite('⛲', 120);
    spr.position.set(f.x, gh + 85, f.y);
    staticGroup.add(spr);
  }
  scene3.add(staticGroup);
}

/* ---------- prsten dometa igrača ---------- */
function buildPlayerRing(){
  if(playerRing3){ scene3.remove(playerRing3); disposeGroup(playerRing3); playerRing3 = null; }
  if(!player || player.atkRange <= 100) return;
  const g = new THREE.RingGeometry(player.atkRange - 4, player.atkRange, 64);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12,
    side: THREE.DoubleSide, depthWrite: false });
  playerRing3 = new THREE.Mesh(g, m);
  playerRing3.rotation.x = -Math.PI / 2;
  scene3.add(playerRing3);
}

/* ---------- indikatori ciljanja moći ---------- */
function ensureCastInd(){
  if(castInd) return castInd;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.965, 1, 64),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene3.add(ring);
  const aoe = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.3,
      side: THREE.DoubleSide, depthWrite: false }));
  aoe.rotation.x = -Math.PI / 2;
  aoe.visible = false;
  scene3.add(aoe);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(lineGeo,
    new THREE.LineBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.8 }));
  line.visible = false;
  scene3.add(line);
  castInd = { ring, aoe, line };
  return castInd;
}
function syncCastIndicator(){
  const ci = ensureCastInd();
  // indikator radi i pri CILJANJU i pri LEBDENJU nad gumbom moći
  let def = null, mode = null;
  if(pendingCast && player && !player.dead){
    def = player.abilities[pendingCast.i].def;
    mode = 'pending';
  }
  else if(hoverUi && hoverUi.type === 'abil' && player && !player.dead && running && !gameOver){
    const ab = player.abilities[hoverUi.i];
    if(ab && ab.rank > 0 && !ab.def.passive){ def = ab.def; mode = 'hover'; }
  }
  if(!def){
    ci.ring.visible = ci.aoe.visible = ci.line.visible = false;
    return;
  }
  const pgh = groundHeight(player.x, player.y);
  if(def.target === 'point'){
    const cr = def.castRange || 600;
    ci.ring.visible = true;
    ci.ring.position.set(player.x, pgh + 2.2, player.y);
    ci.ring.scale.set(cr, cr, 1);
    ci.ring.material.color.set('#ffffff');
    if(mode === 'pending'){
      const aim = clampRange(player, { x: mouse.wx, y: mouse.wy }, cr);
      const agh = groundHeight(aim.x, aim.y);
      if(def.aoe){
        ci.aoe.visible = true;
        ci.aoe.position.set(aim.x, agh + 2, aim.y);
        ci.aoe.scale.set(def.aoe, def.aoe, 1);
        ci.aoe.material.color.set(def.color || '#fde047');
      } else ci.aoe.visible = false;
      if(def.line){
        ci.line.visible = true;
        const p = ci.line.geometry.attributes.position;
        p.setXYZ(0, player.x, pgh + 26, player.y);
        p.setXYZ(1, aim.x, agh + 26, aim.y);
        p.needsUpdate = true;
        ci.line.material.color.set(def.color || '#fde047');
      } else ci.line.visible = false;
    } else {
      ci.aoe.visible = false;
      ci.line.visible = false;
    }
  }
  else if(def.selfAoe){
    // krug djelovanja oko junaka, u boji moći
    ci.aoe.visible = true;
    ci.aoe.position.set(player.x, pgh + 2, player.y);
    ci.aoe.scale.set(def.selfAoe, def.selfAoe, 1);
    ci.aoe.material.color.set(def.color || '#fde047');
    ci.ring.visible = true;
    ci.ring.position.set(player.x, pgh + 2.2, player.y);
    ci.ring.scale.set(def.selfAoe, def.selfAoe, 1);
    ci.ring.material.color.set(def.color || '#fde047');
    ci.line.visible = false;
  }
  else {
    ci.ring.visible = ci.aoe.visible = ci.line.visible = false;
  }
}

/* ================= 3D ČESTICE (iskre, vatra, prašina) ================= */
const FX_MAX = 1400;
const fx = { list: [], geo: null, mat: null, points: null, pos: null, col: null, size: null, alpha: null };
const _fxCol = {};
function fxColor(c){
  return _fxCol[c] || (_fxCol[c] = new THREE.Color(c));
}
function initFx(){
  fx.geo = new THREE.BufferGeometry();
  fx.pos = new Float32Array(FX_MAX * 3);
  fx.col = new Float32Array(FX_MAX * 3);
  fx.size = new Float32Array(FX_MAX);
  fx.alpha = new Float32Array(FX_MAX);
  fx.geo.setAttribute('position', new THREE.BufferAttribute(fx.pos, 3).setUsage(THREE.DynamicDrawUsage));
  fx.geo.setAttribute('color', new THREE.BufferAttribute(fx.col, 3).setUsage(THREE.DynamicDrawUsage));
  fx.geo.setAttribute('size', new THREE.BufferAttribute(fx.size, 1).setUsage(THREE.DynamicDrawUsage));
  fx.geo.setAttribute('alpha', new THREE.BufferAttribute(fx.alpha, 1).setUsage(THREE.DynamicDrawUsage));
  fx.mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { map: { value: makeGlowTexture() }, scale: { value: 800 } },
    vertexShader: `
      attribute float size; attribute float alpha;
      varying vec3 vC; varying float vA;
      uniform float scale;
      void main(){
        vC = color; vA = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      varying vec3 vC; varying float vA;
      void main(){
        vec4 t = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(vC * (0.8 + t.a), vA * t.a);
      }`,
  });
  fx.points = new THREE.Points(fx.geo, fx.mat);
  fx.points.frustumCulled = false;
  fx.points.renderOrder = 6;
  scene3.add(fx.points);
}
/* lokalna (samo vizualna) čestica: x,y po tlu, h visina */
function fxSpawn(x, y, h, color, o){
  if(fx.list.length >= 900) return;
  o = o || {};
  const a = Math.random() * TAU, s = (o.spd || 40) * (0.3 + Math.random() * 0.7);
  fx.list.push({ x, y, h, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vh: o.up != null ? o.up : 30 + Math.random() * 40,
    g: o.grav != null ? o.grav : -20, t: 0, life: o.life || (0.4 + Math.random() * 0.4),
    c: fxColor(color), size: (o.size || 14) * (0.7 + Math.random() * 0.6) });
}
function updateFx(dt){
  let n = 0;
  const P = fx.pos, C = fx.col, S = fx.size, A = fx.alpha;
  // čestice iz igre (burst)
  if(typeof particles !== 'undefined'){
    for(const p of particles){
      if(p.emoji || n >= FX_MAX) continue;
      const f = p.t / p.life;
      const gh = groundHeight(p.x, p.y);
      P[n * 3] = p.x; P[n * 3 + 1] = gh + 22 + Math.sin(f * Math.PI) * 26 + f * 18; P[n * 3 + 2] = p.y;
      const c = fxColor(p.color);
      C[n * 3] = c.r; C[n * 3 + 1] = c.g; C[n * 3 + 2] = c.b;
      S[n] = p.size * 5.5 * (1 - f * 0.5);
      A[n] = Math.min(1, (1 - f) * 1.4);
      n++;
    }
  }
  // lokalni efekti (tragovi projektila, plamen zona, prašina)
  for(let i = fx.list.length - 1; i >= 0; i--){
    const p = fx.list[i];
    p.t += dt;
    if(p.t > p.life){ fx.list[i] = fx.list[fx.list.length - 1]; fx.list.pop(); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.h += p.vh * dt; p.vh += p.g * dt;
    p.vx *= 0.96; p.vy *= 0.96;
    if(n >= FX_MAX) continue;
    const f = p.t / p.life;
    P[n * 3] = p.x; P[n * 3 + 1] = p.h; P[n * 3 + 2] = p.y;
    C[n * 3] = p.c.r; C[n * 3 + 1] = p.c.g; C[n * 3 + 2] = p.c.b;
    S[n] = p.size * (1 - f * 0.6);
    A[n] = (1 - f);
    n++;
  }
  fx.geo.setDrawRange(0, n);
  for(const k of ['position', 'color', 'size', 'alpha']) fx.geo.attributes[k].needsUpdate = true;
}

/* ================= MODELI JEDINICA ================= */
function heroRingMesh(color){
  const ring = new THREE.Mesh(
    cachedGeo('heroRing2', () => new THREE.RingGeometry(24, 31, 40)),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 2.5;
  return ring;
}
function addModel(g, name, team, scale){
  const m = modelInstance(name, team, scale);
  if(!m) return null;
  g.add(m);
  g.userData.model = m;
  g.userData.anim = makeAnimator(m, name);
  return m;
}

function buildHeroMesh(u){
  const g = new THREE.Group();
  const ud = g.userData;
  const ringCol = u.isPlayer ? '#fde047' : TEAM_COLOR[u.team];
  ud.ring = heroRingMesh(ringCol);
  g.add(ud.ring);
  const m = MODELS.ready ? addModel(g, 'hero_' + u.hero.id, u.team, MODEL_SCALE.hero) : null;
  if(!m){
    const body = new THREE.Mesh(
      cachedGeo('heroBody', () => new THREE.CapsuleGeometry(16, 24, 4, 12)),
      lambMat(TEAM_LIGHT[u.team]));
    body.position.y = 33;
    body.castShadow = true;
    g.add(body);
    const head = portraitSprite(GFX.heroes[u.hero.id], u.emoji, ringCol,
      'h:' + u.hero.id + ':' + u.team + ':' + (u.isPlayer ? 1 : 0), 60);
    head.position.y = 80;
    g.add(head);
    ud.body = body; ud.head = head;
  }
  const shield = new THREE.Mesh(
    cachedGeo('heroShield', () => new THREE.SphereGeometry(42, 16, 12)),
    new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.22, depthWrite: false,
      blending: THREE.AdditiveBlending }));
  shield.position.y = 40;
  shield.visible = false;
  g.add(shield);
  const statusSpr = emojiSprite('⭐', 30);
  statusSpr.position.y = 108;
  statusSpr.visible = false;
  g.add(statusSpr);
  ud.shield = shield; ud.statusSpr = statusSpr;
  ud.statusCh = '';
  return g;
}
function buildCreepMesh(u){
  const g = new THREE.Group();
  const name = u.siege ? 'creep_siege' : (u.rangedCreep ? 'creep_ranged' : 'creep_melee');
  if(MODELS.ready && addModel(g, name, u.team, MODEL_SCALE[name])) return g;
  const body = new THREE.Mesh(
    cachedGeo('creepBody' + u.r, () => new THREE.SphereGeometry(u.r, 10, 8)),
    lambMat(TEAM_LIGHT[u.team]));
  body.position.y = u.r + 2;
  body.castShadow = true;
  g.add(body);
  g.userData.body = body;
  return g;
}
function buildNeutralMesh(u){
  const g = new THREE.Group();
  const key = u.campType || (u.camp && u.camp.type) || 'boars';
  if(MODELS.ready && addModel(g, 'mob_' + key, TEAM_NEUTRAL, u.r * 2.2)){
    if(u.boss){
      const ring = new THREE.Mesh(new THREE.RingGeometry(u.r + 30, u.r + 38, 40),
        new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 3;
      g.add(ring);
    }
    return g;
  }
  const body = new THREE.Mesh(
    cachedGeo('creepBody' + u.r, () => new THREE.SphereGeometry(u.r, 10, 8)),
    lambMat(TEAM_LIGHT[TEAM_NEUTRAL]));
  body.position.y = u.r + 2;
  body.castShadow = true;
  g.add(body);
  g.userData.body = body;
  const head = portraitSprite(GFX.mobs[key], u.emoji, '#f59e0b', 'm:' + key, Math.max(40, u.r * 2.4));
  head.position.y = u.r * 2 + 22;
  g.add(head);
  return g;
}
function buildTowerMesh(u){
  const g = new THREE.Group();
  if(MODELS.ready){
    const m = modelInstance('tower', u.team, MODEL_SCALE.tower * (u.isGuard ? 0.92 : 1));
    if(m){
      g.add(m);
      g.userData.model = m;
      const glow = new THREE.Sprite(glowMat(TEAM_LIGHT[u.team]));
      glow.scale.set(90, 90, 1);
      glow.position.y = 3.3 * MODEL_SCALE.tower;
      g.add(glow);
      g.userData.glow = glow;
      return g;
    }
  }
  const base = new THREE.Mesh(
    cachedGeo('towerBase', () => new THREE.CylinderGeometry(30, 40, 100, 10)),
    lambMat('#e8e0cf'));
  base.position.y = 50;
  base.castShadow = true;
  g.add(base);
  const roof = new THREE.Mesh(
    cachedGeo('towerRoof', () => new THREE.ConeGeometry(38, 44, 10)),
    lambMat(TEAM_COLOR[u.team]));
  roof.position.y = 122;
  g.add(roof);
  g.userData.body = base;
  return g;
}
function buildAncientMesh(u){
  const g = new THREE.Group();
  const ud = g.userData;
  const m = MODELS.ready ? modelInstance('ancient', u.team, MODEL_SCALE.ancient) : null;
  if(m){
    g.add(m);
    ud.model = m;
    ud.crystal = m.userData.parts.crystal;
    ud.crystalY = ud.crystal ? ud.crystal.position.y : 0;
    const glow = new THREE.Sprite(glowMat(TEAM_COLOR[u.team]));
    glow.scale.set(150, 150, 1);
    glow.position.y = 2.15 * MODEL_SCALE.ancient;
    g.add(glow);
  } else {
    const crystal = new THREE.Mesh(
      cachedGeo('ancCrystal', () => new THREE.IcosahedronGeometry(46, 0)),
      new THREE.MeshPhongMaterial({ color: TEAM_LIGHT[u.team], emissive: TEAM_COLOR[u.team],
        emissiveIntensity: 0.45, shininess: 90, flatShading: true }));
    crystal.position.y = 86;
    g.add(crystal);
    ud.crystal = crystal;
    ud.crystalY = 86;
  }
  const shield = new THREE.Mesh(
    cachedGeo('ancShield', () => new THREE.SphereGeometry(115, 20, 14)),
    new THREE.MeshBasicMaterial({ color: TEAM_LIGHT[u.team], transparent: true, opacity: 0.09, depthWrite: false,
      blending: THREE.AdditiveBlending }));
  shield.position.y = 60;
  g.add(shield);
  ud.shield = shield;
  return g;
}
function ensureUnitMesh(u){
  let g = meshByUnit.get(u);
  if(g && g.userData.fallback && MODELS.ready){
    // modeli su stigli nakon početka igre — zamijeni jednostavne oblike
    scene3.remove(g); disposeGroup(g); meshByUnit.delete(u); g = null;
  }
  if(g) return g;
  if(u.kind === 'hero') g = buildHeroMesh(u);
  else if(u.kind === 'creep') g = buildCreepMesh(u);
  else if(u.kind === 'neutral') g = buildNeutralMesh(u);
  else if(u.kind === 'tower') g = buildTowerMesh(u);
  else g = buildAncientMesh(u);
  g.userData.fallback = !MODELS.ready;
  g.userData.atkN = u.atkN || 0;
  g.userData.castN = u.castN || 0;
  g.userData.yaw = -(u.dir || 0);
  meshByUnit.set(u, g);
  scene3.add(g);
  return g;
}

/* ---------- zone, projektili, oznake, munje, rune ---------- */
function buildZoneMesh(z){
  const g = new THREE.Group();
  const ud = g.userData;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(4, z.r - 7), z.r, 48),
    new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 2.4;
  g.add(ring);
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(z.r, 40),
    new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false }));
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 2.0;
  g.add(fill);
  const spr = emojiSprite(z.emoji, 70);
  spr.position.y = 52;
  spr.visible = false;
  g.add(spr);
  ud.ring = ring; ud.fill = fill; ud.spr = spr;
  g.position.set(z.x, groundHeight(z.x, z.y), z.y);
  return g;
}
function buildProjMesh(p){
  const g = new THREE.Group();
  if(p.emoji){
    const spr = emojiSprite(p.emoji, Math.max(30, p.r * 1.6));
    g.add(spr);
  } else {
    const ball = new THREE.Mesh(
      cachedGeo('proj' + Math.round(p.r), () => new THREE.SphereGeometry(Math.max(4, p.r), 8, 6)),
      basicMat(p.color));
    g.add(ball);
  }
  const glow = new THREE.Sprite(glowMat(p.color));
  glow.scale.set(p.r * 7 + 24, p.r * 7 + 24, 1);
  g.add(glow);
  g.position.set(p.x, groundHeight(p.x, p.y) + 34, p.y);
  return g;
}
function buildMarkerMesh(m){
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(3, m.r * 0.72), m.r, 32),
    new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 1,
      side: THREE.DoubleSide, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(m.x, groundHeight(m.x, m.y) + 2.6, m.y);
  return mesh;
}
function buildLineMesh(l){
  const pts = [];
  const n = 8;
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
  const L = Math.hypot(dx, dy) || 1;
  const px = -dy / L, py = dx / L;
  for(let i = 0; i <= n; i++){
    const t = i / n;
    const off = (i === 0 || i === n) ? 0 : (Math.random() - 0.5) * 36;
    const wx = l.x1 + dx * t + px * off;
    const wy = l.y1 + dy * t + py * off;
    pts.push(new THREE.Vector3(wx, groundHeight(wx, wy) + 38 + Math.random() * 14, wy));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: l.color, transparent: true, opacity: 1 });
  // iskre duž munje / jezika
  for(let i = 0; i < 6; i++){
    const p = pts[Math.floor(Math.random() * pts.length)];
    fxSpawn(p.x, p.z, p.y, l.color, { spd: 60, up: 20, life: 0.35, size: 16 });
  }
  return new THREE.Line(geo, mat);
}
function buildRuneMesh(rn){
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(28, 38, 24),
    new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.9,
      side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 2;
  g.add(ring);
  const glow = new THREE.Sprite(glowMat('#fde047'));
  glow.scale.set(110, 110, 1);
  glow.position.y = 40;
  g.add(glow);
  const spr = emojiSprite(rn.def.emoji, 46);
  spr.position.y = 44;
  g.add(spr);
  g.userData.ring = ring;
  g.userData.spr = spr;
  g.position.set(rn.x, groundHeight(rn.x, rn.y), rn.y);
  return g;
}

function syncMapped(arr, map, buildFn, updateFn){
  for(const o of arr){
    let m = map.get(o);
    if(!m){ m = buildFn(o); map.set(o, m); scene3.add(m); }
    if(updateFn) updateFn(o, m);
  }
  if(map.size > arr.length){
    for(const key of map.keys()){
      if(arr.indexOf(key) === -1){
        const m = map.get(key);
        scene3.remove(m);
        if(m.traverse) disposeGroup(m);
        map.delete(key);
      }
    }
  }
}

/* ---------- smrt: model se prevrne i utone u tlo ---------- */
function startDying(g, kind, now){
  if(!g.visible){ scene3.remove(g); disposeGroup(g); return; }
  const ud = g.userData;
  if(ud.anim){ ud.anim.mixer.stopAllAction(); }
  for(const k of ['ring', 'shield', 'statusSpr', 'glow']) if(ud[k]) ud[k].visible = false;
  dying.push({ g, kind, t0: now, y0: g.position.y });
  const c = kind === 'tower' ? '#d6cbb5' : '#e5e7eb';
  const n = kind === 'tower' ? 26 : 8;
  for(let i = 0; i < n; i++)
    fxSpawn(g.position.x, g.position.z, g.position.y + 10 + Math.random() * 30, c,
      { spd: kind === 'tower' ? 120 : 60, up: 20, grav: -30, life: 0.9, size: kind === 'tower' ? 40 : 22 });
}
function updateDying(now){
  for(let i = dying.length - 1; i >= 0; i--){
    const d = dying[i];
    const t = now - d.t0;
    const tower = d.kind === 'tower';
    const dur = tower ? 1.8 : 1.3;
    const m = d.g.userData.model || d.g;
    if(tower){
      m.rotation.z = Math.min(1, t / dur) * 0.25;
      d.g.position.y = d.y0 - Math.pow(Math.min(1, t / dur), 2) * 170;
    } else {
      m.rotation.x = Math.min(1, t / 0.35) * 1.45;
      if(t > 0.6) d.g.position.y = d.y0 - (t - 0.6) / (dur - 0.6) * 45;
    }
    if(t > dur){
      scene3.remove(d.g);
      disposeGroup(d.g);
      dying.splice(i, 1);
    }
  }
}

/* ================= glavna sinkronizacija ================= */
function pickStatusEmoji(u){
  if(u.status.stun > 0) return '⭐';
  if(u.status.trackT > 0) return '💰';
  if(u.status.invisT > 0) return '👻';
  if(u.status.rootT > 0) return '🌱';
  if(u.status.slowT > 0) return '❄️';
  if(u.status.dmgMulT > 0) return '⚔️';
  return '';
}
function angleLerp(a, b, k){
  let d = b - a;
  while(d > Math.PI) d -= TAU;
  while(d < -Math.PI) d += TAU;
  return a + d * k;
}

let lastAnimT = 0;
function animateUnit(u, g, now, dt){
  const ud = g.userData;
  const a = ud.anim;
  if(!a) return;
  if((u.atkN || 0) !== ud.atkN){
    ud.atkN = u.atkN || 0;
    const cd = u.atkCd || 1;
    animOnce(a, 'attack', Math.max(1, 0.62 / cd), now, u.projSpeed ? 0.1 : 0.04);
  }
  if((u.castN || 0) !== ud.castN){
    ud.castN = u.castN || 0;
    animOnce(a, 'cast', 1.25, now, 0);
  }
  const moving = gameTime - (u.lastMoveT == null ? -9 : u.lastMoveT) < 0.15;
  const stunned = u.status && u.status.stun > 0;
  if(moving && !stunned) animBase(a, 'walk', 0.7 + (u.speed || 150) / 240, now);
  else animBase(a, 'idle', stunned ? 0.4 : 1, now);
  a.mixer.update(dt);
}

function syncScene(tAnim){
  const dt = Math.min(0.1, Math.max(0, tAnim - (lastAnimT || tAnim)));
  lastAnimT = tAnim;
  const present = new Set(units);
  for(const key of meshByUnit.keys()){
    if(!present.has(key)){
      const g = meshByUnit.get(key);
      meshByUnit.delete(key);
      if(MODELS.ready && key.kind !== 'ancient') startDying(g, key.kind, tAnim);
      else { scene3.remove(g); disposeGroup(g); }
    }
  }
  updateDying(tAnim);
  for(const u of units){
    if(u.removeMe) continue;
    const g = ensureUnitMesh(u);
    const ud = g.userData;
    const gh = groundHeight(u.x, u.y);
    const seen = seenByPlayer(u);   // magla rata: skriveni neprijatelji se ne crtaju
    if(u.kind === 'hero'){
      // smrt junaka: prevrne se, utone, pa nestane dok ne oživi
      if(u.dead){
        if(ud.deadT0 == null){
          ud.deadT0 = tAnim;
          ud.deadY = gh;
          if(ud.anim) ud.anim.mixer.stopAllAction();
          ud.ring.visible = ud.shield.visible = ud.statusSpr.visible = false;
        }
        const t = tAnim - ud.deadT0;
        const m = ud.model;
        g.visible = seen && t < 1.6 && !!m;
        if(m){
          m.rotation.x = Math.min(1, t / 0.35) * 1.45;
          g.position.y = ud.deadY - Math.max(0, t - 0.7) * 50;
        }
        continue;
      }
      if(ud.deadT0 != null){
        ud.deadT0 = null;
        if(ud.model){ ud.model.rotation.x = 0; }
        ud.ring.visible = true;
        if(ud.anim){ ud.anim.cur = null; ud.anim.oneEnd = 0; }
        for(let i = 0; i < 18; i++) fxSpawn(u.x, u.y, gh + 10, '#fde68a', { spd: 90, up: 90, life: 0.8, size: 20 });
      }
      g.visible = seen;
      g.position.set(u.x, gh, u.y);
      if(!seen) continue;
      ud.yaw = angleLerp(ud.yaw, -(u.dir || 0), Math.min(1, dt * 14));
      if(ud.model) ud.model.rotation.y = ud.yaw;
      else g.rotation.y = ud.yaw;
      ud.shield.visible = u.status.shieldT > 0;
      const ch = pickStatusEmoji(u);
      if(ch !== ud.statusCh){
        ud.statusCh = ch;
        if(ch){ ud.statusSpr.material.map = makeEmojiTexture(ch); ud.statusSpr.material.needsUpdate = true; }
        ud.statusSpr.visible = !!ch;
      }
      if(ud.statusSpr.visible) ud.statusSpr.position.y = 108 + Math.sin(tAnim * 6) * 5;
      const invis = u.status.invisT > 0;
      if(ud.model){
        setModelLook(ud.model, u.flash > 0 ? 'f' : (invis ? 'g' : 'n'));
        animateUnit(u, g, tAnim, dt);
        // teleport: plave iskre oko junaka
        if(u.tpChannel > 0 && Math.random() < dt * 30)
          fxSpawn(u.x + (Math.random() - 0.5) * 50, u.y + (Math.random() - 0.5) * 50, gh + 5, '#93c5fd', { spd: 10, up: 120, grav: 0, life: 0.7, size: 18 });
      } else {
        ud.head.position.y = 78 + Math.sin(tAnim * 2.4 + u.id) * 2.5;
        ud.body.material = u.flash > 0 ? lambMat('#ffffff') : (invis ? invisMat(u.team) : lambMat(TEAM_LIGHT[u.team]));
        ud.head.material.opacity = invis ? 0.55 : 1;
      }
    }
    else if(u.kind === 'creep' || u.kind === 'neutral'){
      g.visible = seen;
      g.position.set(u.x, gh, u.y);
      if(!seen) continue;
      ud.yaw = angleLerp(ud.yaw, -(u.dir || 0), Math.min(1, dt * 12));
      g.rotation.y = ud.yaw;
      if(ud.model){
        setModelLook(ud.model, u.flash > 0 ? 'f' : 'n');
        animateUnit(u, g, tAnim, dt);
      } else if(ud.body){
        ud.body.material = u.flash > 0 ? lambMat('#ffffff') : lambMat(TEAM_LIGHT[u.kind === 'creep' ? u.team : TEAM_NEUTRAL]);
      }
    }
    else if(u.kind === 'ancient'){
      g.position.set(u.x, gh, u.y);
      if(ud.crystal){
        ud.crystal.rotation.y = tAnim * 0.8;
        ud.crystal.position.y = ud.crystalY + Math.sin(tAnim * 2) * (ud.model ? 0.12 : 6);
      }
      ud.shield.visible = u.invuln;
      if(ud.shield.visible){
        const s = 1 + Math.sin(tAnim * 3) * 0.03;
        ud.shield.scale.set(s, s, s);
      }
    }
    else if(u.kind === 'tower'){
      g.position.set(u.x, gh, u.y);
      if(ud.model){
        const cr = ud.model.userData.parts.crystal;
        if(cr){ cr.rotation.y = tAnim * 1.5; }
        if(ud.glow){ const s = 80 + Math.sin(tAnim * 3 + u.id) * 10; ud.glow.scale.set(s, s, 1); }
      } else if(ud.body){
        ud.body.material = u.flash > 0 ? lambMat('#ffffff') : lambMat('#e8e0cf');
      }
    }
  }

  syncMapped(zones, zoneMeshes, buildZoneMesh, (z, g) => {
    const ud = g.userData;
    if(!z.started){
      const f = Math.min(1, z.t / z.delay);
      ud.fill.scale.set(Math.max(0.01, f), Math.max(0.01, f), 1);
      ud.fill.material.opacity = 0.22;
      ud.spr.visible = false;
    } else {
      ud.fill.scale.set(1, 1, 1);
      ud.fill.material.opacity = 0.2 + 0.12 * Math.abs(Math.sin(tAnim * 9));
      ud.spr.visible = true;
      ud.spr.position.y = 52 + Math.sin(tAnim * 8) * 9;
      // plamen / mećava se diže iz zone
      const n = Math.min(4, Math.ceil(z.r / 70));
      for(let i = 0; i < n; i++){
        if(Math.random() > dt * 40) continue;
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * z.r;
        const x = z.x + Math.cos(a) * r, y = z.y + Math.sin(a) * r;
        fxSpawn(x, y, groundHeight(x, y) + 4, z.color, { spd: 8, up: 70 + Math.random() * 60, grav: 0, life: 0.6, size: 26 });
      }
    }
  });

  syncMapped(projectiles, projMeshes, buildProjMesh, (p, g) => {
    const h = groundHeight(p.x, p.y) + 34;
    g.position.set(p.x, h, p.y);
    // trag iskri iza projektila
    if(seenProj(p) && Math.random() < 0.85)
      fxSpawn(p.x, p.y, h, p.color, { spd: 18, up: 8, grav: 0, life: 0.35, size: Math.max(14, (p.r || 8) * 1.4) });
  });

  syncMapped(markers, markerMeshes, buildMarkerMesh, (m, mesh) => {
    const f = Math.min(1, m.t / 0.5);
    const s = m.isRing ? (0.4 + 0.6 * f) : (1 - 0.4 * f);
    mesh.scale.set(s, s, 1);
    mesh.material.opacity = 1 - f;
  });

  syncMapped(lines, lineMeshes, buildLineMesh, (l, mesh) => {
    mesh.material.opacity = Math.max(0, 1 - l.t / l.life);
  });

  syncMapped(runes, runeMeshes, buildRuneMesh, (rn, g) => {
    g.userData.ring.rotation.set(-Math.PI / 2, 0, tAnim * 2);
    g.userData.spr.position.y = 44 + Math.sin(tAnim * 4) * 8;
    if(Math.random() < dt * 6) fxSpawn(rn.x + (Math.random() - 0.5) * 40, rn.y + (Math.random() - 0.5) * 40,
      groundHeight(rn.x, rn.y) + 10, '#fde047', { spd: 6, up: 50, grav: 0, life: 0.8, size: 14 });
  });

  if(playerRing3 && player){
    playerRing3.visible = !player.dead;
    playerRing3.position.set(player.x, groundHeight(player.x, player.y) + 1.4, player.y);
  }

  if(waterMesh) waterMesh.material.uniforms.t.value = tAnim;
  updateFx(dt);
  syncCastIndicator();
}
function seenProj(p){
  if(typeof isVisibleTo !== 'function') return true;
  return isVisibleTo(myTeam, { x: p.x, y: p.y, team: -1, status: null });
}

/* ---------- kamera ---------- */
function updateCamera3(){
  const d = CAM_DIST / cam.zoom;
  camera3.position.set(cam.x, 40 + Math.sin(CAM_PITCH) * d, cam.y + Math.cos(CAM_PITCH) * d);
  camera3.lookAt(cam.x, 40, cam.y);
  sunLight.position.set(cam.x - 700, 1700, cam.y + 500);
  sunLight.target.position.set(cam.x, 0, cam.y);
  const ext = Math.min(2600, Math.max(1000, 1300 / cam.zoom));
  const sc = sunLight.shadow.camera;
  if(Math.abs(sc.right - ext) > 1){
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
    sc.updateProjectionMatrix();
  }
}

/* ---------- projekcije ekran <-> svijet ---------- */
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -40);
const _hit = new THREE.Vector3();
const _v3 = new THREE.Vector3();

function screenToWorld(sx, sy, fast){
  if(!camera3) return { x: cam.x, y: cam.y };
  _ndc.set(sx / VW * 2 - 1, -(sy / VH) * 2 + 1);
  _ray.setFromCamera(_ndc, camera3);
  if(!fast && groundMesh){
    const hits = _ray.intersectObject(groundMesh, false);
    if(hits.length) return { x: hits[0].point.x, y: hits[0].point.z };
  }
  if(_ray.ray.intersectPlane(_plane, _hit)) return { x: _hit.x, y: _hit.z };
  return { x: cam.x, y: cam.y };
}
function worldToScreen(x, h, y){
  _v3.set(x, h, y).project(camera3);
  if(_v3.z > 1) return null;
  return { x: (_v3.x * 0.5 + 0.5) * VW, y: (-_v3.y * 0.5 + 0.5) * VH };
}

/* ---------- čišćenje ---------- */
function clearScene3D(){
  for(const [k, g] of meshByUnit){ scene3.remove(g); disposeGroup(g); }
  meshByUnit.clear();
  for(const d of dying){ scene3.remove(d.g); disposeGroup(d.g); }
  dying.length = 0;
  for(const map of [zoneMeshes, projMeshes, markerMeshes, lineMeshes, runeMeshes]){
    for(const [k, m] of map){ scene3.remove(m); if(m.traverse) disposeGroup(m); }
    map.clear();
  }
  fx.list.length = 0;
  if(playerRing3){ scene3.remove(playerRing3); playerRing3 = null; }
  if(castInd){
    castInd.ring.visible = castInd.aoe.visible = castInd.line.visible = false;
  }
}

/* ================= 3D PREGLED JUNAKA (ekran odabira) ================= */
const heroPv = { renderer: null, scene: null, camera: null, model: null, anim: null, id: null, last: 0, nextAct: 0, running: false };

function showHeroPreview(container, heroId){
  onModelsReady(() => {
    if(!MODELS.ready || !container.isConnected) return;
    try { heroPreviewSetup(); } catch(e){ return; }
    const cv = heroPv.renderer.domElement;
    const img = container.querySelector('.d-img');
    if(img) img.remove();
    container.insertBefore(cv, container.firstChild);
    if(heroPv.id !== heroId){
      if(heroPv.model){ heroPv.scene.remove(heroPv.model); if(heroPv.anim) heroPv.anim.mixer.stopAllAction(); }
      heroPv.model = modelInstance('hero_' + heroId, TEAM_BLUE, 1);
      heroPv.anim = makeAnimator(heroPv.model, 'hero_' + heroId);
      heroPv.model.rotation.y = -0.6;
      heroPv.scene.add(heroPv.model);
      heroPv.id = heroId;
      heroPv.nextAct = 0.5;
      heroPv.t = 0;
      if(heroPv.anim) animOnce(heroPv.anim, 'cast', 1, 0, 0);
    }
    if(!heroPv.running){
      heroPv.running = true;
      heroPv.last = performance.now();
      requestAnimationFrame(heroPreviewFrame);
    }
  });
}
function heroPreviewSetup(){
  if(heroPv.renderer) return;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.setSize(150, 170, false);
  r.outputEncoding = THREE.sRGBEncoding;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.25;
  r.domElement.className = 'd-3d';
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xffffff, 0x8a6a3a, 0.9));
  const d = new THREE.DirectionalLight(0xfff2d0, 1.2);
  d.position.set(2, 4, 3);
  s.add(d);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.25 }));
  disc.rotation.x = -Math.PI / 2;
  s.add(disc);
  const c = new THREE.PerspectiveCamera(32, 150 / 170, 0.1, 50);
  c.position.set(2.6, 1.9, 3.6);
  c.lookAt(0, 0.85, 0);
  heroPv.renderer = r; heroPv.scene = s; heroPv.camera = c;
}
function heroPreviewFrame(now){
  const sel = document.getElementById('select');
  const cv = heroPv.renderer && heroPv.renderer.domElement;
  if(!cv || !cv.isConnected || !sel || sel.classList.contains('hidden')){ heroPv.running = false; return; }
  requestAnimationFrame(heroPreviewFrame);
  const dt = Math.min(0.1, (now - heroPv.last) / 1000);
  heroPv.last = now;
  heroPv.t = (heroPv.t || 0) + dt;
  if(heroPv.model){
    heroPv.model.rotation.y += dt * 0.5;
    if(heroPv.anim){
      if(heroPv.t > heroPv.nextAct){
        animOnce(heroPv.anim, Math.random() < 0.6 ? 'attack' : 'cast', 0.9, heroPv.t, 0);
        heroPv.nextAct = heroPv.t + 2.6 + Math.random() * 1.5;
      }
      animBase(heroPv.anim, 'idle', 1, heroPv.t);
      heroPv.anim.mixer.update(dt);
    }
  }
  heroPv.renderer.render(heroPv.scene, heroPv.camera);
}
