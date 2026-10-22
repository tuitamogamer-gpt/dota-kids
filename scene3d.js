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
const wardMeshes = new Map();
const shrineObjs = [];     // 🕊️ svetišta (model + sjaj)
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
    loader.load('assets/models.glb', done, xhr => {
      const el = document.getElementById('loadBar');
      if(!el) return;
      const total = xhr.total || 3600000;
      const pct = Math.min(99, Math.round(xhr.loaded / total * 100));
      el.textContent = '⏳ Učitavam 3D modele… ' + pct + '%';
      el.style.display = 'block';
    }, fail);
  }
  onModelsReady(() => { const el = document.getElementById('loadBar'); if(el) el.style.display = 'none'; });
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
   look: 'n' normalno, 'f' bljesak pogotka, 'g' prozirno (nevidljivost), 'c' smrznuto (usporen) */
/* rubno (fresnel) svjetlo dodano u MeshStandardMaterial — obrisi modela lagano svijetle, bez dodatnih draw callova */
const RIM = { color: { value: new THREE.Color('#e0ecff') }, strength: { value: 0.3 } };
function addRim(m){
  m.onBeforeCompile = sh => {
    sh.uniforms.rimColor = RIM.color;
    sh.uniforms.rimStrength = RIM.strength;
    sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimStrength;\n' + sh.fragmentShader.replace('#include <output_fragment>',
      'float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);\n' +
      'outgoingLight += rimColor * rimF * rimStrength;\n#include <output_fragment>');
  };
  m.customProgramCacheKey = () => 'rim1';
}
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
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0,
      color: name === 'TEAM' ? tc : 0xffffff, envMapIntensity: 0.45 });
    if(look === 'f'){ m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 0.32; }
    if(look === 'c') m.color.lerp(new THREE.Color('#5fb8ff'), 0.7);
    if(look === 'p') m.color.lerp(new THREE.Color('#86efac'), 0.6);
    addRim(m);   // rubno svjetlo: obrisi modela se ističu (noću jače)
    if(look === 'k') m.color.lerp(new THREE.Color('#a78bfa'), 0.55);                                   // 🌀 kletva
    if(look === 'w'){ m.emissive = new THREE.Color('#ff6a3d'); m.emissiveIntensity = 0.22; }          // 🐺 vučji oblik
    if(look === 'r'){ m.emissive = new THREE.Color('#ef4444'); m.emissiveIntensity = 0.3; }           // 😡 bijes
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
    if(o.isInstancedMesh) o.dispose();
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
  initSpellLights();
  initEnvironment(renderer3, scene3);
  loadModels3D();
}
/* mekano okolišno svjetlo (studio) — modeli dobiju odsjaj i dubinu */
function initEnvironment(renderer, scene){
  if(!THREE.RoomEnvironment || !THREE.PMREMGenerator) return;
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    pm.dispose();
  } catch(e){ console.warn('Okolišno svjetlo nije dostupno', e); }
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
let dayK = 1;
function applyDayNight(gt){
  if(!scene3) return;
  let target = 0.5 + 0.5 * Math.cos((gt % CFG.dayCycle) / CFG.dayCycle * TAU);
  if(typeof nightForceT !== 'undefined' && nightForceT > 0) target = Math.min(target, 0.04);   // 🌑 Vječna noć
  dayK = lerp(dayK, target, 0.04);
  const k = dayK;
  sunLight.intensity = 0.16 + 0.94 * k;
  hemiLight.intensity = 0.3 + 0.45 * k;
  scene3.background.copy(DAY_SKY.night).lerp(DAY_SKY.day, k);
  scene3.fog.color.copy(scene3.background);
  sunLight.color.copy(DAY_SKY.sunNight).lerp(DAY_SKY.sunDay, k);
  if(waterMesh) waterMesh.material.uniforms.night.value = 1 - k;
  RIM.strength.value = 0.26 + 0.24 * (1 - k);   // noću obrisi jače svijetle (mjesečina)
  RIM.color.value.setRGB(0.88 - 0.25 * (1 - k), 0.92 - 0.1 * (1 - k), 1.0);
}

/* ================= SVJETLA MAGIJA =================
   mali bazen točkastih svjetala: bljesnu pri bacanju, udaru projektila i zonama
   (stalno su u sceni s intenzitetom 0, da se shaderi ne prevode ponovno) */
const spellLights = [];
function initSpellLights(){
  for(let i = 0; i < 4; i++){
    const L = new THREE.PointLight(0xffffff, 0, 460, 2);
    L.castShadow = false;
    scene3.add(L);
    spellLights.push({ L, t: 0, life: 1, peak: 0 });
  }
}
function spellLight(x, y, h, color, peak, life, dist){
  if(!spellLights.length) return;
  let best = spellLights[0], bestRem = 1e9;
  for(const s of spellLights){
    const rem = s.peak * Math.max(0, 1 - s.t / s.life);
    if(rem < bestRem){ bestRem = rem; best = s; }
  }
  best.L.color.set(color);
  best.L.position.set(x, h, y);
  best.L.distance = dist || 460;
  best.t = 0; best.life = life || 0.6; best.peak = peak || 2.2;
}
function updateSpellLights(dt){
  for(const s of spellLights){
    if(s.peak <= 0) continue;
    s.t += dt;
    const f = s.t / s.life;
    if(f >= 1){ s.L.intensity = 0; s.peak = 0; continue; }
    s.L.intensity = s.peak * (f < 0.12 ? f / 0.12 : 1 - (f - 0.12) / 0.88);
  }
}

/* ---------- čarobni krug (runski krug pod junakom dok baca magiju) ---------- */
let runeTex = null;
function runeCircleTexture(){
  if(runeTex) return runeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.translate(256, 256);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); };
  g.shadowColor = '#fff'; g.shadowBlur = 12;
  ring(236, 9); ring(212, 3); ring(150, 6); ring(124, 2.5); ring(56, 4);
  // runski znakovi između vanjskih prstenova
  for(let i = 0; i < 18; i++){
    g.save(); g.rotate(i / 18 * TAU); g.translate(0, -182);
    g.lineWidth = 4; g.beginPath();
    switch(i % 4){
      case 0: g.moveTo(0, -16); g.lineTo(11, 0); g.lineTo(0, 16); g.lineTo(-11, 0); g.closePath(); break;   // romb
      case 1: g.arc(0, 0, 10, 0, TAU); g.moveTo(0, -18); g.lineTo(0, 18); break;                            // krug s crtom
      case 2: g.moveTo(-12, 12); g.lineTo(0, -14); g.lineTo(12, 12); g.closePath(); break;                   // trokut
      default: g.moveTo(-12, -12); g.lineTo(12, 12); g.moveTo(12, -12); g.lineTo(-12, 12); break;            // križ
    }
    g.stroke(); g.restore();
  }
  // heksagram i žbice
  g.lineWidth = 5;
  for(const off of [0, Math.PI]){
    g.beginPath();
    for(let k = 0; k < 3; k++){
      const a = off + k / 3 * TAU - Math.PI / 2;
      const x = Math.cos(a) * 150, y = Math.sin(a) * 150;
      if(k) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath(); g.stroke();
  }
  g.lineWidth = 2.5;
  for(let i = 0; i < 12; i++){
    const a = i / 12 * TAU;
    g.beginPath(); g.moveTo(Math.cos(a) * 56, Math.sin(a) * 56); g.lineTo(Math.cos(a) * 124, Math.sin(a) * 124); g.stroke();
  }
  // točkice na unutarnjem prstenu
  for(let i = 0; i < 24; i++){ const a = i / 24 * TAU; g.beginPath(); g.arc(Math.cos(a) * 224, Math.sin(a) * 224, 3.5, 0, TAU); g.fill(); }
  runeTex = new THREE.CanvasTexture(c);
  return runeTex;
}
function magicCircle(x, y, r, color, life, big){
  const geo = cachedGeo('runePlane', () => { const p = new THREE.PlaneGeometry(2, 2); p.rotateX(-Math.PI / 2); return p; });
  const gh = groundHeight(x, y);
  const mk = (rr, spin, h, op) => {
    const mat = new THREE.MeshBasicMaterial({ map: runeCircleTexture(), color, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 3;
    addFx(m, life, (o, f) => {
      const grow = Math.min(1, f * 4);
      const s = rr * (0.4 + 0.6 * (1 - Math.pow(1 - grow, 3)));
      o.scale.set(s, 1, s);
      o.position.set(x, gh + h, y);
      o.rotation.y = spin * f * 3;
      o.material.opacity = op * (f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3);
    });
  };
  mk(r, 1, 2.8, 0.95);
  if(big){
    mk(r * 0.62, -1.6, 3.2, 0.8);    // drugi krug se vrti suprotno
    mk(r * 1.25, 0.5, 2.4, 0.45);
  }
  // iskre koje se dižu s ruba kruga
  for(let i = 0; i < (big ? 26 : 14); i++){
    const a = Math.random() * TAU;
    fxSpawn(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, gh + 6, color, { spd: 6, up: 70 + Math.random() * 60, grav: 0, life: 0.7 + Math.random() * 0.4, size: 14 });
  }
}
/* ---------- udarni val (AoE): prsten koji se širi + prozirni zid koji se diže ---------- */
function shockwave(x, y, r, color){
  const gh = groundHeight(x, y);
  const ringGeo = cachedGeo('shockRing', () => { const g = new THREE.RingGeometry(0.82, 1, 48); g.rotateX(-Math.PI / 2); return g; });
  const rm = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  addFx(rm, 0.45, (o, f) => {
    const s = r * (0.15 + 0.85 * Math.sqrt(f));
    o.scale.set(s, 1, s);
    o.position.set(x, gh + 3, y);
    o.material.opacity = 0.75 * (1 - f) * (1 - f * 0.3);
  });
  const wallGeo = cachedGeo('shockWall', () => new THREE.CylinderGeometry(1, 1, 1, 40, 1, true));
  const wm = new THREE.Mesh(wallGeo, new THREE.MeshBasicMaterial({ map: beamTexture(), color, transparent: true, opacity: 0.7,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  addFx(wm, 0.5, (o, f) => {
    const s = r * (0.2 + 0.8 * Math.sqrt(f)), hh = 70 * (1 - f) + 6;
    o.scale.set(s, hh, s);
    o.position.set(x, gh + hh / 2, y);
    o.rotation.x = Math.PI;   // svjetliji dio pri tlu
    o.material.opacity = 0.42 * (1 - f);
  });
  for(let i = 0; i < 20; i++){
    const a = i / 20 * TAU;
    fxSpawn(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, gh + 8, i % 3 ? color : '#c9b48c', { spd: r * 1.6, up: 30, grav: -40, life: 0.5, size: 20 });
  }
}
const HERO_BY_ID3 = {};

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
    else if(hash01(t.x, t.y, 9) < 0.3 && MODELS.tpl.tree_birch0) add('tree_birch' + (v % 2), { x: t.x, y: t.y, h: gh - 2, rot: r * 6.28, s: t.size * 0.7 });
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
  if(MODELS.tpl.flowers0){   // ---- v0.11: bogatija okolina ----
    // panjevi, cvijeće, busenje trave
    let np = 0;
    for(let i = 0; i < 600 && np < 24; i++){
      const x = hash01(i, 31, 7) * WORLD, y = hash01(i, 33, 5) * WORLD;
      if(!free(x, y, 20)) continue;
      add('stump0', { x, y, h: groundHeight(x, y) - 1, rot: hash01(i, 35, 5) * 6.28, s: 30 + hash01(i, 36, 2) * 10 });
      np++;
    }
    let nf = 0;
    for(let i = 0; i < 2600 && nf < 320; i++){
      const x = hash01(i, 41, 7) * WORLD, y = hash01(i, 43, 5) * WORLD;
      if(x < 60 || y < 60 || x > WORLD - 60 || y > WORLD - 60) continue;
      if(Math.abs(x - y) / Math.SQRT2 < 150) continue;
      if(LANE_LIST.some(l => distToPath(LANE_PTS[l], x, y) < 60)) continue;
      if(CAMP_SPOTS.some(c => distXY(x, y, c.x, c.y) < 120)) continue;
      const r = hash01(i, 45, 3);
      const kind = r < 0.45 ? 'grass0' : (r < 0.75 ? 'flowers0' : 'flowers1');
      add(kind, { x, y, h: groundHeight(x, y) - 1, rot: hash01(i, 47, 5) * 6.28, s: 28 + hash01(i, 48, 2) * 16 });
      nf++;
    }
    // uz rijeku: trska na obali, lopoči na vodi
    let nr = 0;
    for(let i = 0; i < 1500 && nr < 170; i++){
      const t = 150 + hash01(i, 51, 7) * (WORLD - 300);
      const bank = hash01(i, 53, 3) < 0.6;
      const d = bank ? 128 + hash01(i, 55, 5) * 34 : hash01(i, 55, 5) * 85;
      const sgn = hash01(i, 57, 2) < 0.5 ? 1 : -1;
      const x = t + sgn * d * Math.SQRT1_2, y = t - sgn * d * Math.SQRT1_2;
      if(x < 60 || y < 60 || x > WORLD - 60 || y > WORLD - 60) continue;
      if(LANE_LIST.some(l => distToPath(LANE_PTS[l], x, y) < (bank ? 120 : 170))) continue;
      if(RUNE_SPOTS.some(rs => distXY(x, y, rs.x, rs.y) < 130)) continue;
      if(bank) add('reeds0', { x, y, h: groundHeight(x, y) - 1, rot: hash01(i, 59, 5) * 6.28, s: 34 + hash01(i, 60, 2) * 14 });
      else add('lilypad0', { x, y, h: groundHeight(x, y) + 1.5, rot: hash01(i, 59, 5) * 6.28, s: 22 + hash01(i, 60, 2) * 12 });
      nr++;
    }
    // gazovi (plosnato kamenje) gdje staze prelaze rijeku
    const crossings = [[1500, 1500], [335, 335], [2665, 2665]];
    for(const [cx, cy] of crossings){
      for(let k = -1; k <= 1; k++){
        const x = cx + k * 90 * Math.SQRT1_2, y = cy - k * 90 * Math.SQRT1_2;
        add('ford0', { x, y, h: groundHeight(x, y) + 1, rot: Math.PI / 4 + (k ? 0.15 * k : 0), s: 46 });
      }
    }
    // baklje uz staze blizu baza
    for(let team = 0; team < 2; team++){
      const a0 = ANCIENT_POS[team];
      for(const l of LANE_LIST){
        const pts = LANE_PTS[l];
        let acc = 0;
        for(let i = 0; i < pts.length - 1; i++){
          const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
          const L = distXY(x1, y1, x2, y2), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
          for(let s = acc; s < L; s += 170){
            const px = x1 + ux * s, py = y1 + uy * s;
            const dA = distXY(px, py, a0.x, a0.y);
            if(dA > 820 || dA < 300) continue;
            if(distXY(px, py, FOUNTAIN[team].x, FOUNTAIN[team].y) < 260) continue;
            for(const side of [1, -1]){
              const x = px - uy * side * 100, y = py + ux * side * 100;
              if(x < 40 || y < 40 || x > WORLD - 40 || y > WORLD - 40) continue;
              add('torch0', { x, y, h: groundHeight(x, y) - 1, rot: 0, s: 30 });
            }
          }
          acc = (acc - L) % 170; if(acc < 0) acc += 170;
        }
      }
    }
    // logorske vatre i kristali uz kampove, veliko kamenje oko Zmajeve jazbine
    CAMP_SPOTS.forEach((c, ci) => {
      if(c.type === 'boss'){
        for(let k = 0; k < 7; k++){
          const a = k / 7 * TAU + 0.3;
          if(a > 0.6 && a < 1.3) continue;   // ulaz u jazbinu
          const x = c.x + Math.cos(a) * 230, y = c.y + Math.sin(a) * 230;
          add('rock_big' + (k % 2), { x, y, h: groundHeight(x, y) - 2, rot: a + 1, s: 60 + hash01(k, 61, 1) * 20 });
        }
        return;
      }
      const a = ci * 1.3 + 2.2;
      const x = c.x + Math.cos(a) * 110, y = c.y + Math.sin(a) * 110;
      add('campfire0', { x, y, h: groundHeight(x, y) - 1, rot: 0, s: 36 });
      if(c.type === 'wolves' || c.type === 'golem'){
        const x2 = c.x + Math.cos(a + 2.1) * 150, y2 = c.y + Math.sin(a + 2.1) * 150;
        add('crystal0', { x: x2, y: y2, h: groundHeight(x2, y2) - 1, rot: a, s: 40 });
      }
    });
    // putokazi na izlazu iz baza
    add('signpost0', { x: 470, y: 2460, h: groundHeight(470, 2460) - 1, rot: -0.6, s: 40 });
    add('signpost0', { x: 2530, y: 540, h: groundHeight(2530, 540) - 1, rot: 2.5, s: 40 });
  }
  // rub šume: gusti borovi i hrastovi oko mape, da se ne vidi "kraj svijeta"
  for(let i = 0; i < 520; i++){
    const side = i % 4, t = hash01(i, 21, 3) * (WORLD + 1200) - 600, depth = 50 + hash01(i, 22, 4) * 560;
    let x, y;
    if(side === 0){ x = t; y = -depth; } else if(side === 1){ x = t; y = WORLD + depth; }
    else if(side === 2){ x = -depth; y = t; } else { x = WORLD + depth; y = t; }
    const r = hash01(i, 23, 5);
    const kind = r < 0.7 ? 'tree_pine' + (i % 3) : 'tree_oak' + (i % 3);
    add(kind, { x, y, h: -6, rot: r * 6.28, s: (r < 0.7 ? 48 : 52) + hash01(i, 24, 6) * 34 });
  }
  for(const name in buckets){
    const im = instancedFrom(name, buckets[name]);
    if(im) treesGroup.add(im);
  }
  // sjaj plamena baklji, logorskih vatri i kristala (sprite — instancirana geometrija ne svijetli)
  const glows = [];
  for(const it of buckets.torch0 || []) glows.push({ x: it.x, y: it.y, h: it.h + 42, c: '#ffb020', s: 56 });
  for(const it of buckets.campfire0 || []) glows.push({ x: it.x, y: it.y, h: it.h + 16, c: '#ff8a3d', s: 90 });
  for(const it of buckets.crystal0 || []) glows.push({ x: it.x, y: it.y, h: it.h + 28, c: '#a5f3fc', s: 70 });
  for(const g of glows){
    const spr = new THREE.Sprite(glowMat(g.c));
    spr.scale.set(g.s, g.s, 1);
    spr.position.set(g.x, g.h, g.y);
    treesGroup.add(spr);
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

/* ---------- statika: fontane + zidine oko baza ---------- */
function buildStatic3D(){
  if(staticGroup){ scene3.remove(staticGroup); disposeGroup(staticGroup); }
  staticGroup = new THREE.Group();
  if(!MODELS.ready && !MODELS.failed) onModelsReady(buildStatic3D);
  if(MODELS.ready){
    // zidine: prsten oko prijestola s prolazima za staze
    for(let team = 0; team < 2; team++){
      const a0 = ANCIENT_POS[team];
      const segs = [];
      const R = 470, step = 34 / R;
      for(let a = 0; a < TAU; a += step){
        const x = a0.x + Math.cos(a) * R, y = a0.y + Math.sin(a) * R;
        if(x < 40 || y < 40 || x > WORLD - 40 || y > WORLD - 40) continue;
        if(LANE_LIST.some(l => distToPath(LANE_PTS[l], x, y) < 130)) continue;
        if(distXY(x, y, FOUNTAIN[team].x, FOUNTAIN[team].y) < 200) continue;
        segs.push({ x, y, h: groundHeight(x, y) - 1, rot: -a - Math.PI / 2, s: 34 });
      }
      const geo = mergedModelGeo('wall');
      if(geo && segs.length){
        const im = new THREE.InstancedMesh(geo, modelMat('TEAM', team, 'n'), segs.length);
        segs.forEach((it, i) => {
          _dummy.position.set(it.x, it.h, it.y);
          _dummy.rotation.set(0, it.rot, 0);
          _dummy.scale.set(it.s, it.s, it.s);
          _dummy.updateMatrix();
          im.setMatrixAt(i, _dummy.matrix);
        });
        im.castShadow = true;
        staticGroup.add(im);
      }
    }
  }
  shrineObjs.length = 0;
  if(MODELS.ready && MODELS.tpl.tent0){
    // baza: šatori (boja tima), bačve, sanduci, ograde uz fontanu i prijestol
    for(let team = 0; team < 2; team++){
      const f = FOUNTAIN[team], a0 = ANCIENT_POS[team];
      const toCenter = Math.atan2(WORLD / 2 - f.y, WORLD / 2 - f.x);
      const tents = [];
      for(let k = -1; k <= 1; k++){
        const a = toCenter + k * 0.55;
        const x = f.x + Math.cos(a) * 250, y = f.y + Math.sin(a) * 250;
        tents.push({ x, y, h: groundHeight(x, y) - 1, rot: -a, s: 44 });
      }
      const geo = mergedModelGeo('tent0');
      if(geo){
        const im = new THREE.InstancedMesh(geo, modelMat('TEAM', team, 'n'), tents.length);
        tents.forEach((it, i) => {
          _dummy.position.set(it.x, it.h, it.y); _dummy.rotation.set(0, it.rot, 0); _dummy.scale.setScalar(it.s); _dummy.updateMatrix();
          im.setMatrixAt(i, _dummy.matrix);
        });
        im.castShadow = true;
        staticGroup.add(im);
      }
      const props = [];
      for(let k = 0; k < 7; k++){
        const a = toCenter + Math.PI + (k - 3) * 0.32;
        const x = a0.x + Math.cos(a) * 170, y = a0.y + Math.sin(a) * 170;
        if(x < 40 || y < 40 || x > WORLD - 40 || y > WORLD - 40) continue;
        props.push({ kind: k % 2 ? 'crate0' : 'barrel0', x, y, h: groundHeight(x, y) - 1, rot: a, s: 30 + (k % 3) * 4 });
      }
      for(let k = 0; k < 5; k++){
        const a = toCenter + 1.6 + k * 0.1 * 0 + (k - 2) * 0.09;
        const x = f.x + Math.cos(a) * 330, y = f.y + Math.sin(a) * 330;
        props.push({ kind: 'fence0', x, y, h: groundHeight(x, y) - 1, rot: -a - Math.PI / 2, s: 38 });
      }
      const byKind = {};
      for(const p of props) (byKind[p.kind] = byKind[p.kind] || []).push(p);
      for(const kind in byKind){ const im = instancedFrom(kind, byKind[kind]); if(im) staticGroup.add(im); }
    }
    // 🕊️ svetišta
    for(const s of SHRINE_SPOTS){
      const m = modelInstance('shrine0', s.team, 70);
      if(!m) continue;
      const gh = groundHeight(s.x, s.y);
      m.position.set(s.x, gh - 1, s.y);
      staticGroup.add(m);
      const glow = new THREE.Sprite(glowMat(TEAM_LIGHT[s.team]));
      glow.scale.set(110, 110, 1);
      glow.position.set(s.x, gh + 52, s.y);
      staticGroup.add(glow);
      shrineObjs.push({ m, glow, team: s.team, x: s.x, y: s.y, gh });
    }
  }
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
    if(pendingCast.item != null){
      const it = player.items[pendingCast.item];
      def = it && it.active ? { target: 'point', castRange: it.active.castRange || 600, color: '#bae6fd' } : null;
    } else def = player.abilities[pendingCast.i].def;
    mode = def ? 'pending' : null;
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

/* ================= PRIVREMENI 3D EFEKTI =================
   Objekti koji žive kratko (kiša strijela, korijenje, srca, duh, stup svjetla...).
   Svaki ima update(obj, f, t, dt): f = 0..1 udio života, t = sekunde. */
const fxObjs = [];
const _dummy = new THREE.Object3D();
function addFx(obj, life, update, onEnd){
  scene3.add(obj);
  const f = { obj, t: 0, life, update, onEnd };
  fxObjs.push(f);
  return f;
}
function updateFxObjs(dt){
  for(let i = fxObjs.length - 1; i >= 0; i--){
    const f = fxObjs[i];
    f.t += dt;
    if(f.t >= f.life){
      scene3.remove(f.obj);
      disposeGroup(f.obj);
      if(f.onEnd) f.onEnd();
      fxObjs[i] = fxObjs[fxObjs.length - 1];
      fxObjs.pop();
      continue;
    }
    f.update(f.obj, f.t / f.life, f.t, dt);
  }
}
/* instancirani Blender model (1 draw call za N primjeraka) */
function instancedFx(name, n, glow){
  const geo = mergedModelGeo(name);
  if(!geo || n <= 0) return null;
  const im = new THREE.InstancedMesh(geo, modelMat(glow ? 'GLOW' : 'VC', 0, 'n'), n);
  im.castShadow = !glow;
  im.frustumCulled = false;
  return im;
}
/* modeli izbijaju iz tla oko (x,y) u krugu r, stoje, pa utonu */
function fxRise(name, x, y, r, n, o){
  const im = instancedFx(name, n, o.glow);
  if(!im) return;
  const items = [];
  for(let i = 0; i < n; i++){
    const a = (i / n) * TAU + Math.random() * 0.8, d = n === 1 ? 0 : r * (0.3 + Math.random() * 0.65);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    items.push({ x: px, y: py, h: groundHeight(px, py), rot: Math.random() * TAU, s: o.scale * (0.75 + Math.random() * 0.5) });
  }
  const life = o.life || 1.6;
  addFx(im, life, (obj, f, t) => {
    const up = Math.min(1, t / 0.22), down = Math.max(0, (t - (life - 0.35)) / 0.35);
    const k = up * (1 - down);
    items.forEach((it, i) => {
      _dummy.position.set(it.x, it.h - (1 - k) * it.s * 0.7, it.y);
      _dummy.rotation.set(0, it.rot, 0);
      _dummy.scale.set(it.s, it.s * Math.max(0.02, k), it.s);
      _dummy.updateMatrix();
      obj.setMatrixAt(i, _dummy.matrix);
    });
    obj.instanceMatrix.needsUpdate = true;
  });
}
/* modeli padaju s neba (strijele, zvijezde) i kratko ostanu na tlu */
function fxRain(name, x, y, r, n, o){
  const im = instancedFx(name, n, o.glow);
  if(!im) return;
  const items = [];
  for(let i = 0; i < n; i++){
    const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    items.push({ x: px, y: py, h: groundHeight(px, py) + (o.rest || 0), delay: Math.random() * 0.25,
      rot: Math.random() * TAU, s: o.scale * (0.85 + Math.random() * 0.3), spin: o.spin ? 6 + Math.random() * 8 : 0 });
  }
  const fall = o.fall || 0.4, hold = o.hold || 0.7, H = o.height || 420;
  addFx(im, 0.25 + fall + hold, (obj, f, t) => {
    items.forEach((it, i) => {
      const k = Math.min(1, Math.max(0, (t - it.delay) / fall));
      const fade = Math.max(0, (t - it.delay - fall - hold * 0.55) / (hold * 0.45));
      const s = k > 0 ? it.s * (1 - fade) : 0.001;
      _dummy.position.set(it.x, it.h + (1 - k) * (1 - k) * H, it.y);
      if(o.pointDown) _dummy.rotation.set(0, it.rot, -Math.PI / 2 + 0.25);
      else _dummy.rotation.set(0, it.rot + it.spin * t, 0);
      _dummy.scale.set(s, s, s);
      _dummy.updateMatrix();
      obj.setMatrixAt(i, _dummy.matrix);
      if(o.trail && k > 0 && k < 1 && Math.random() < 0.3)
        fxSpawn(it.x, it.y, it.h + (1 - k) * (1 - k) * H, o.trail, { spd: 4, up: 0, grav: 0, life: 0.3, size: 12 });
    });
    obj.instanceMatrix.needsUpdate = true;
  });
}
/* modeli lete radijalno od točke (bodlje) */
function fxRadial(name, x, y, h, n, o){
  const im = instancedFx(name, n, o.glow);
  if(!im) return;
  const items = [];
  for(let i = 0; i < n; i++){
    const a = i / n * TAU + Math.random() * 0.3;
    items.push({ a, vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed, s: o.scale * (0.8 + Math.random() * 0.4), up: 40 + Math.random() * 60 });
  }
  addFx(im, o.life || 0.5, (obj, f, t) => {
    items.forEach((it, i) => {
      _dummy.position.set(x + it.vx * t, h + it.up * t - 200 * t * t, y + it.vy * t);
      _dummy.rotation.set(0, -it.a, -0.3 + t * 1.5);
      _dummy.scale.setScalar(it.s * (1 - f * 0.4));
      _dummy.updateMatrix();
      obj.setMatrixAt(i, _dummy.matrix);
    });
    obj.instanceMatrix.needsUpdate = true;
  });
}
/* modeli lebde uvis i nestaju (srca, mjehurići) */
function fxFloat(name, x, y, r, n, o){
  const im = instancedFx(name, n, o.glow);
  if(!im) return;
  const items = [];
  for(let i = 0; i < n; i++){
    const a = Math.random() * TAU, d = Math.random() * r;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    items.push({ x: px, y: py, h0: groundHeight(px, py) + (o.h0 || 20), ph: Math.random() * TAU,
      delay: Math.random() * 0.35, s: o.scale * (0.8 + Math.random() * 0.4), spd: o.up || 60 });
  }
  const dur = o.life || 1.4;
  addFx(im, dur + 0.4, (obj, f, t) => {
    items.forEach((it, i) => {
      const tt = Math.max(0, t - it.delay), k = Math.min(1, tt / dur);
      const s = it.s * Math.min(1, tt / 0.15) * (1 - k * k);
      _dummy.position.set(it.x + Math.sin(tt * 5 + it.ph) * 8, it.h0 + it.spd * tt, it.y);
      _dummy.rotation.set(0, Math.sin(tt * 3 + it.ph) * 0.6, 0);
      _dummy.scale.set(s, s, s);
      _dummy.updateMatrix();
      obj.setMatrixAt(i, _dummy.matrix);
    });
    obj.instanceMatrix.needsUpdate = true;
  });
}
/* stup svjetla (level up, oživljavanje, runa) */
let beamTex = null;
function beamTexture(){
  if(beamTex) return beamTex;
  const c = document.createElement('canvas');
  c.width = 8; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 64);
  beamTex = new THREE.CanvasTexture(c);
  return beamTex;
}
function beamFx(x, y, color, size){
  const geo = cachedGeo('beam', () => new THREE.CylinderGeometry(1, 1, 1, 18, 1, true));
  const mat = new THREE.MeshBasicMaterial({ map: beamTexture(), color, transparent: true, opacity: 0.9,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  const gh = groundHeight(x, y);
  addFx(m, 1.1, (o, f) => {
    const r = 26 * size * (1 + f * 0.7), h = 230 * size * Math.min(1, f * 3);
    o.scale.set(r, h, r);
    o.position.set(x, gh + h / 2, y);
    o.material.opacity = 0.9 * (1 - f * f);
  });
  for(let i = 0; i < 16; i++) fxSpawn(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 50, gh + 10, color, { spd: 8, up: 90 + Math.random() * 60, grav: -10, life: 1, size: 18 });
}
/* tamni trag na tlu (meteor) */
function scorchFx(x, y, r, color, life){
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, groundHeight(x, y) + 2.1, y);
  addFx(m, life, (o, f) => { o.material.opacity = 0.55 * (1 - f); });
}
/* raspad prijestola: kristal se rasprsne u krhotine */
function shatterFx(x, y, h, team, n){
  const g = new THREE.Group();
  const shards = [];
  const geo = cachedGeo('shard', () => new THREE.IcosahedronGeometry(1, 0));
  for(let i = 0; i < n; i++){
    const mat = new THREE.MeshBasicMaterial({ color: TEAM_LIGHT[team], transparent: true, opacity: 1 });
    const s = new THREE.Mesh(geo, mat);
    const a = Math.random() * TAU, sp = 120 + Math.random() * 240;
    s.position.set(x, h + Math.random() * 40, y);
    s.scale.setScalar(8 + Math.random() * 16);
    shards.push({ m: s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: 160 + Math.random() * 260, rx: Math.random() * 6, rz: Math.random() * 6 });
    g.add(s);
  }
  const gh = groundHeight(x, y);
  addFx(g, 3.2, (o, f, t, dt) => {
    for(const s of shards){
      s.m.position.x += s.vx * dt; s.m.position.z += s.vy * dt;
      s.vh -= 420 * dt;
      s.m.position.y = Math.max(gh + 6, s.m.position.y + s.vh * dt);
      if(s.m.position.y <= gh + 6.01){ s.vx *= 0.9; s.vy *= 0.9; s.vh = Math.abs(s.vh) * 0.35; }
      s.m.rotation.x += s.rx * dt; s.m.rotation.z += s.rz * dt;
      s.m.material.opacity = Math.max(0, 1 - Math.max(0, f - 0.6) / 0.4);
    }
  });
}

/* ---------- tresenje kamere i filmska kamera ---------- */
const shake = { amp: 0, t: 0 };
function shakeAt(x, y, amp, dur){
  const k = Math.max(0, 1 - distXY(x, y, cam.x, cam.y) / 1500);
  if(k <= 0) return;
  shake.amp = Math.max(shake.amp, amp * k * 9);
  shake.t = Math.max(shake.t, dur || 0.45);
}
const cine = { on: false, x: 0, y: 0, zoom: 1.2 };
function startCinematic(p){
  cine.on = true; cine.x = p.x; cine.y = p.y;
  cam.follow = false;
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
  const statusSpr = emojiSprite('⭐', 28);
  statusSpr.position.set(36, 88, 0);   // uz glavu, da ne pokriva ime
  statusSpr.visible = false;
  g.add(statusSpr);
  ud.shield = shield; ud.statusSpr = statusSpr;
  ud.statusCh = '';
  return g;
}
function buildCreepMesh(u){
  const g = new THREE.Group();
  if(u.summonModel && MODELS.ready && addModel(g, u.summonModel, u.team, 28)){
    g.userData.summon = true;
    return g;
  }
  const name = u.siege ? 'creep_siege' : (u.rangedCreep ? 'creep_ranged' : 'creep_melee');
  if(MODELS.ready && addModel(g, name, u.team, MODEL_SCALE[name] * (u.superCreep ? 1.18 : 1))){
    if(u.superCreep){
      const aura = new THREE.Sprite(glowMat(TEAM_COLOR[u.team]));
      aura.scale.set(70, 70, 1); aura.position.y = 30;
      g.add(aura);
    }
    return g;
  }
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
function buildBarracksMesh(u){
  const g = new THREE.Group();
  const m = MODELS.ready ? modelInstance('barracks', u.team, 44) : null;
  if(m){ g.add(m); g.userData.model = m; g.rotation.y = -Math.atan2(WORLD / 2 - u.y, WORLD / 2 - u.x); return g; }
  const box = new THREE.Mesh(cachedGeo('barrBox', () => new THREE.BoxGeometry(80, 50, 60)), lambMat(TEAM_LIGHT[u.team]));
  box.position.y = 25;
  g.add(box);
  g.userData.body = box;
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
  else if(u.kind === 'barracks') g = buildBarracksMesh(u);
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
/* zone moći: po emojiju moći biramo 3D efekt */
const ZONE_FX = { '☄️': 'meteor', '❄️': 'snow', '🏹': 'arrows', '🌱': 'roots', '🥶': 'ice', '🌊': 'wave', '🍯': 'swarm', '🏺': 'swarm', '🐦‍⬛': 'crows' };
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
  ud.kind = MODELS.ready ? (ZONE_FX[z.emoji] || null) : null;
  ud.tk = z.ticksLeft;
  if(ud.kind === 'meteor'){
    const m = modelInstance('fx_meteor', 0, Math.max(40, z.r * 0.4));
    m.position.y = 620;
    g.add(m);
    ud.meteor = m;
  }
  if(ud.kind === 'swarm' || ud.kind === 'crows'){   // roj pčela / jato gavranova kruži nad zonom
    const n = Math.min(14, Math.max(6, Math.round(z.r / 25)));
    const im = instancedFx(ud.kind === 'crows' ? 'proj_crow' : 'proj_bee', n, false);
    if(im){
      ud.bees = im; ud.beeN = n;
      ud.beeSeed = Math.random() * 10;
      g.add(im);
    }
  }
  if(!ud.kind){
    const spr = emojiSprite(z.emoji, 70);
    spr.position.y = 52;
    spr.visible = false;
    g.add(spr);
    ud.spr = spr;
  }
  ud.ring = ring; ud.fill = fill;
  g.position.set(z.x, groundHeight(z.x, z.y), z.y);
  return g;
}
/* jedan "otkucaj" zone (šteta) — kiša strijela pada, snijeg prasne... */
function zoneTickFx(z, g){
  const k = g.userData.kind;
  const gh = groundHeight(z.x, z.y);
  if(g.visible) spellLight(z.x, z.y, gh + 60, z.color || '#ffffff', 1.7, 0.45, z.r * 1.8 + 120);
  if(k === 'arrows') fxRain('proj_arrow', z.x, z.y, z.r, 12, { scale: 40, pointDown: true, fall: 0.3, hold: 0.9, rest: 12, height: 380 });
  else if(k === 'snow'){
    for(let i = 0; i < 14; i++){
      const a = Math.random() * TAU, d = Math.random() * z.r;
      fxSpawn(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, gh + 8, '#dff3ff', { spd: 30, up: 40, grav: -30, life: 0.6, size: 20 });
    }
  }
}
/* zona nestaje = zadnji udar: meteor pogađa tlo, korijenje izbija, val se širi */
function zoneEndFx(z, g){
  const k = g.userData.kind;
  const gh = groundHeight(z.x, z.y);
  if(k === 'meteor'){
    for(let i = 0; i < 46; i++){
      const a = Math.random() * TAU, d = Math.random() * z.r * 0.6;
      fxSpawn(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, gh + 6, i % 3 ? '#ff7a1a' : '#ffe26b',
        { spd: 160, up: 90 + Math.random() * 120, grav: -60, life: 0.9, size: 34 });
    }
    for(let i = 0; i < 16; i++) fxSpawn(z.x, z.y, gh + 20, '#6b7280', { spd: 90, up: 50, grav: -5, life: 1.6, size: 48 });
    spellLight(z.x, z.y, gh + 50, '#ff7a1a', 4, 1.0, z.r * 3 + 200);
    shockwave(z.x, z.y, z.r * 1.3, '#ffb020');
    scorchFx(z.x, z.y, z.r * 0.8, '#1f1a17', 7);
    shakeAt(z.x, z.y, 1.1, 0.6);
  }
  else if(k === 'roots') fxRise('fx_root', z.x, z.y, z.r, 7, { scale: 34, life: 1.7 });
  else if(k === 'ice'){
    fxRise('fx_ice', z.x, z.y, z.r, 9, { scale: 40, life: 2.0, glow: true });
    scorchFx(z.x, z.y, z.r, '#bfe8ff', 2.2);
    for(let i = 0; i < 30; i++) fxSpawn(z.x + (Math.random() - 0.5) * z.r * 1.4, z.y + (Math.random() - 0.5) * z.r * 1.4, gh + 10, '#eaf6ff', { spd: 40, up: 60, grav: -20, life: 1, size: 20 });
    shakeAt(z.x, z.y, 0.5, 0.4);
  }
  else if(k === 'wave'){
    const w = modelInstance('fx_wave', 0, 1);
    if(w){
      w.position.set(z.x, gh, z.y);
      addFx(w, 0.9, (o, f) => {
        const r = z.r * (0.15 + 0.85 * Math.min(1, f * 1.6));
        o.scale.set(r, 42 * (1 - f * 0.6), r);
        o.position.y = gh + Math.sin(f * Math.PI) * 10;
        if(Math.random() < 0.8){
          const a = Math.random() * TAU;
          fxSpawn(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, gh + 30, '#dff3ff', { spd: 40, up: 70, grav: -90, life: 0.6, size: 22 });
        }
      });
    }
    shakeAt(z.x, z.y, 0.5, 0.4);
  }
  else if(k === 'arrows') zoneTickFx(z, g);
  else if(k === 'snow') fxRise('fx_ice', z.x, z.y, z.r * 0.8, 4, { scale: 26, life: 1.2, glow: true });
}
function syncZone(z, g, tAnim, dt){
  const ud = g.userData;
  if(ud.tk !== z.ticksLeft){
    ud.tk = z.ticksLeft;
    if(z.started) zoneTickFx(z, g);
  }
  if(!z.started){
    const f = Math.min(1, z.t / z.delay);
    ud.fill.scale.set(Math.max(0.01, f), Math.max(0.01, f), 1);
    ud.fill.material.opacity = 0.22;
    if(ud.spr) ud.spr.visible = false;
    if(ud.bees) ud.bees.visible = false;
    if(ud.meteor){
      // meteor juri s neba i pogađa točno kad zona proradi
      const h = 620 * (1 - f) * (1 - f) + 18;
      ud.meteor.position.y = h;
      ud.meteor.rotation.y += dt * 3;
      ud.meteor.rotation.x += dt * 1.2;
      for(let i = 0; i < 2; i++) fxSpawn(z.x + (Math.random() - 0.5) * 30, z.y + (Math.random() - 0.5) * 30, g.position.y + h + 10 + Math.random() * 30,
        i ? '#ff7a1a' : '#ffe26b', { spd: 10, up: 60, grav: 0, life: 0.35, size: 36 });
    }
    if(ud.kind === 'wave' && Math.random() < dt * 40){
      const a = Math.random() * TAU, d = Math.random() * z.r;
      fxSpawn(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, g.position.y + 4, '#7dd3fc', { spd: 20, up: 50, grav: 0, life: 0.6, size: 18 });
    }
  } else {
    ud.fill.scale.set(1, 1, 1);
    ud.fill.material.opacity = 0.2 + 0.12 * Math.abs(Math.sin(tAnim * 9));
    if(ud.meteor) ud.meteor.visible = false;
    if(ud.bees) ud.bees.visible = true;
    if(ud.spr){
      ud.spr.visible = true;
      ud.spr.position.y = 52 + Math.sin(tAnim * 8) * 9;
    }
    if(ud.bees){
      for(let i = 0; i < ud.beeN; i++){
        const a = tAnim * (1.6 + (i % 3) * 0.3) + i * TAU / ud.beeN + ud.beeSeed;
        const r = z.r * (0.35 + 0.55 * ((i * 7) % 10) / 10);
        _dummy.position.set(Math.cos(a) * r, 40 + Math.sin(tAnim * 5 + i) * 14 + (i % 4) * 8, Math.sin(a) * r);
        _dummy.rotation.set(0, -a - Math.PI / 2, 0);
        _dummy.scale.setScalar(ud.kind === 'crows' ? 34 : 22);
        _dummy.updateMatrix();
        ud.bees.setMatrixAt(i, _dummy.matrix);
      }
      ud.bees.instanceMatrix.needsUpdate = true;
      if(Math.random() < dt * 20){
        const a = Math.random() * TAU, d = Math.random() * z.r;
        fxSpawn(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, g.position.y + 20, ud.kind === 'crows' ? '#312e81' : '#fbbf24', { spd: 20, up: 30, grav: 0, life: 0.6, size: 14 });
      }
    }
    if(ud.kind === 'snow'){
      // snijeg pada po cijeloj zoni
      const n = Math.min(5, Math.ceil(z.r / 60));
      for(let i = 0; i < n; i++){
        if(Math.random() > dt * 45) continue;
        const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * z.r;
        const x = z.x + Math.cos(a) * d, y = z.y + Math.sin(a) * d;
        fxSpawn(x, y, groundHeight(x, y) + 150, i % 2 ? '#ffffff' : '#bfe6ff', { spd: 14, up: -120, grav: -30, life: 1.1, size: 14 });
      }
    } else if(!ud.kind){
      // plamen / iskre dižu se iz zone (zone bez posebnog efekta)
      const n = Math.min(4, Math.ceil(z.r / 70));
      for(let i = 0; i < n; i++){
        if(Math.random() > dt * 40) continue;
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * z.r;
        const x = z.x + Math.cos(a) * r, y = z.y + Math.sin(a) * r;
        fxSpawn(x, y, groundHeight(x, y) + 4, z.color, { spd: 8, up: 70 + Math.random() * 60, grav: 0, life: 0.6, size: 26 });
      }
    }
  }
}

/* projektili: Blender model po emojiju moći ili vrsti napada (hero.shot) */
const PROJ_BY_EMOJI = { '🔥': 'proj_fireball', '🧊': 'proj_ice', '🎯': 'proj_arrow', '🪶': 'proj_feather', '💫': 'proj_star',
  '🌰': 'proj_acorn', '🌠': 'proj_moon', '👅': 'proj_tongue', '🦅': 'proj_hawk', '🐝': 'proj_bee', '🟢': 'proj_slime', '🌵': 'proj_quill', '🖤': 'proj_ink' };
const PROJ_BY_SHOT = { arrow: 'proj_arrow', feather: 'proj_feather', fire: 'proj_fireball', ice: 'proj_ice', leaf: 'proj_acorn',
  bolt: 'proj_bolt', tower: 'proj_bolt' };
const PROJ_TRAIL = { proj_fireball: ['#ff7a1a', '#ffe26b'], proj_ice: ['#bfe6ff', '#ffffff'], proj_moon: ['#c4b5fd', '#fff7d6'],
  proj_star: ['#fde68a'], proj_bolt: ['#ffffff'], proj_hawk: ['#fde68a'], proj_acorn: ['#bef264'], proj_feather: ['#f8fafc'], proj_arrow: [],
  proj_bee: ['#fde68a'], proj_slime: ['#bef264'], proj_quill: [], proj_ink: ['#312e81', '#1e1b4b'] };
function projModelName(p){
  return (p.emoji && PROJ_BY_EMOJI[p.emoji]) || (p.shot && PROJ_BY_SHOT[p.shot]) || null;
}
function projScale(name, p){
  switch(name){
    case 'proj_fireball': return 26 + (p.r || 6) * 0.95;
    case 'proj_ice': return p.emoji ? 38 : 28;
    case 'proj_arrow': return p.emoji ? 46 : 40;
    case 'proj_feather': return p.emoji ? 42 : 36;
    case 'proj_star': return 34;
    case 'proj_acorn': return p.emoji ? 32 : 24;
    case 'proj_moon': return 40;
    case 'proj_tongue': return 30;
    case 'proj_hawk': return 44;
    case 'proj_bolt': return p.shot === 'tower' ? 42 : 30;
    case 'proj_bee': return 34;
    case 'proj_slime': return 36;
    case 'proj_quill': return 28;
    case 'proj_ink': return 36;
  }
  return 30;
}
function buildProjMesh(p){
  const g = new THREE.Group();
  const ud = g.userData;
  const name = MODELS.ready ? projModelName(p) : null;
  const team = p.team != null ? p.team : (p.src ? p.src.team : 0);
  const m = name ? modelInstance(name, team, projScale(name, p)) : null;
  if(m){
    g.add(m);
    ud.model = m; ud.name = name;
    if(name === 'proj_tongue'){
      // tijelo jezika: ružičasti valjak od žapca do vrha jezika
      const geo = cachedGeo('tongueGeo', () => { const c = new THREE.CylinderGeometry(1, 1, 1, 8); c.rotateZ(-Math.PI / 2); return c; });
      ud.tongue = new THREE.Mesh(geo, lambMat('#f472b6'));
      scene3.add(ud.tongue);
    }
  }
  else if(p.emoji) g.add(emojiSprite(p.emoji, Math.max(30, p.r * 1.6)));
  else {
    const ball = new THREE.Mesh(
      cachedGeo('proj' + Math.round(p.r), () => new THREE.SphereGeometry(Math.max(4, p.r), 8, 6)),
      basicMat(p.color));
    g.add(ball);
  }
  const noGlow = name === 'proj_arrow' || name === 'proj_feather' || name === 'proj_acorn' || name === 'proj_hawk' || name === 'proj_tongue' || name === 'proj_bee' || name === 'proj_quill';
  if(!noGlow){
    const glow = new THREE.Sprite(glowMat(p.color));
    const gs = m ? p.r * 5 + 30 : p.r * 7 + 24;
    glow.scale.set(gs, gs, 1);
    g.add(glow);
  }
  ud.px = p.x; ud.py = p.y;
  ud.yaw = p.vx != null ? -Math.atan2(p.vy, p.vx) : 0;
  ud.sx = p.sx != null ? p.sx : (p.src ? p.src.x : p.x);
  ud.sy = p.sy != null ? p.sy : (p.src ? p.src.y : p.y);
  const sk = p.src ? p.src.kind : (p.shot === 'tower' ? 'tower' : 'hero');
  ud.h0 = sk === 'tower' ? 3.3 * MODEL_SCALE.tower : (sk === 'hero' ? 52 : 40);
  ud.arc = (name === 'proj_arrow' || name === 'proj_feather' || name === 'proj_acorn') && !p.emoji ? 70 : 0;
  ud.lastH = null;
  g.position.set(p.x, groundHeight(p.x, p.y) + 34, p.y);
  return g;
}
function syncProj(p, g, tAnim, dt){
  const ud = g.userData;
  const dx = p.x - ud.px, dy = p.y - ud.py;
  if(dx * dx + dy * dy > 0.5){ ud.yaw = -Math.atan2(dy, dx); ud.px = p.x; ud.py = p.y; }
  else if(p.vx != null) ud.yaw = -Math.atan2(p.vy, p.vx);
  const base = groundHeight(p.x, p.y);
  let h = base + 34;
  const tx = p.target ? p.target.x : p.tx, ty = p.target ? p.target.y : p.ty;
  if(tx != null && ty != null){
    // samonavođeni projektil: od ramena / vrha kule do mete, strijele lete u luku
    const total = distXY(ud.sx, ud.sy, tx, ty) || 1;
    const frac = Math.min(1, Math.max(0, 1 - distXY(p.x, p.y, tx, ty) / total));
    h = base + lerp(ud.h0, 38, frac) + Math.sin(frac * Math.PI) * ud.arc;
  }
  g.position.set(p.x, h, p.y);
  g.rotation.y = ud.yaw;
  const m = ud.model;
  if(m){
    // nagib po putanji (luk strijele)
    if(ud.lastH != null && (ud.name === 'proj_arrow' || ud.name === 'proj_feather' || ud.name === 'proj_bolt')){
      const step = Math.hypot(dx, dy) || 1;
      m.rotation.z = Math.atan2(h - ud.lastH, step) * 0.8;
    }
    ud.lastH = h;
    switch(ud.name){
      case 'proj_star': m.rotation.y += dt * 24; break;
      case 'proj_acorn': m.rotation.z += dt * 14; break;
      case 'proj_moon': m.rotation.x += dt * 9; break;
      case 'proj_ice': m.rotation.x += dt * 5; break;
      case 'proj_fireball': { const s = projScale(ud.name, p) * (1 + Math.sin(tAnim * 30) * 0.08); m.scale.setScalar(s); break; }
      case 'proj_hawk': m.rotation.z = Math.sin(tAnim * 16) * 0.3; m.position.y = Math.sin(tAnim * 16) * 4; break;
      case 'proj_bee': m.position.y = Math.sin(tAnim * 22) * 5; m.rotation.z = Math.sin(tAnim * 22) * 0.15; break;
      case 'proj_slime': m.rotation.z += dt * 8; break;
      case 'proj_bolt': m.rotation.x += dt * 12; break;
    }
    const tr = PROJ_TRAIL[ud.name];
    if(tr && tr.length && seenProj(p) && Math.random() < 0.9){
      const c = tr[Math.floor(Math.random() * tr.length)];
      fxSpawn(p.x, p.y, h, c, { spd: 14, up: 6, grav: 0, life: 0.35, size: Math.max(14, (p.r || 8) * 1.3) });
    }
    if(ud.tongue){
      // rastegni jezik od usta žapca do vrha
      const sx = p.src ? p.src.x : ud.sx, sy = p.src ? p.src.y : ud.sy;
      const sh = groundHeight(sx, sy) + 58;
      const L = distXY(sx, sy, p.x, p.y);
      ud.tongue.position.set((sx + p.x) / 2, (sh + h) / 2, (sy + p.y) / 2);
      ud.tongue.rotation.y = -Math.atan2(p.y - sy, p.x - sx);
      ud.tongue.rotation.z = Math.atan2(h - sh, L || 1);
      ud.tongue.scale.set(Math.max(1, L), 7, 7);
    }
  }
  else if(seenProj(p) && Math.random() < 0.85)
    fxSpawn(p.x, p.y, h, p.color, { spd: 18, up: 8, grav: 0, life: 0.35, size: Math.max(14, (p.r || 8) * 1.4) });
}
function projEndFx(p, g){
  const ud = g.userData;
  if(ud.tongue){ scene3.remove(ud.tongue); ud.tongue = null; }
  const h = g.position.y;
  const n = ud.name;
  if(p.emoji && g.visible){   // udar magije: bljesak svjetla i mali udarni val
    const col = (PROJ_TRAIL[n] && PROJ_TRAIL[n][0]) || p.color || '#ffffff';
    spellLight(p.x, p.y, h + 10, col, 2.0, 0.45, 380);
    shockwave(p.x, p.y, 55 + (p.r || 10) * 1.5, col);
  }
  if(n === 'proj_fireball') for(let i = 0; i < 12; i++) fxSpawn(p.x, p.y, h, i % 2 ? '#ff7a1a' : '#ffe26b', { spd: 90, up: 40, grav: -40, life: 0.5, size: 26 });
  else if(n === 'proj_ice') for(let i = 0; i < 10; i++) fxSpawn(p.x, p.y, h, '#dff6ff', { spd: 80, up: 50, grav: -60, life: 0.5, size: 18 });
  else if(n === 'proj_moon') for(let i = 0; i < 12; i++) fxSpawn(p.x, p.y, h, '#e9d5ff', { spd: 70, up: 60, grav: -20, life: 0.6, size: 20 });
  else if(n === 'proj_star' || n === 'proj_bolt') for(let i = 0; i < 6; i++) fxSpawn(p.x, p.y, h, '#fff7c2', { spd: 70, up: 30, grav: -40, life: 0.4, size: 16 });
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
/* munje i zrake: debela svijetleća cijev (vanjski sjaj + bijela jezgra) umjesto tanke linije;
   munje (kind 'bolt' ili žute/bijele) su izlomljene */
function buildLineMesh(l){
  const bolt = l.kind === 'bolt' || /^#(fde047|ffffff|fef08a)$/i.test(l.color || '');
  const n = bolt ? 10 : 6;
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
  const L = Math.hypot(dx, dy) || 1;
  const px = -dy / L, py = dx / L;
  const pts = [];
  for(let i = 0; i <= n; i++){
    const t = i / n;
    const edge = i === 0 || i === n;
    const off = edge ? 0 : (Math.random() - 0.5) * (bolt ? Math.min(60, L * 0.12) : 10);
    const wx = l.x1 + dx * t + px * off;
    const wy = l.y1 + dy * t + py * off;
    pts.push(new THREE.Vector3(wx, groundHeight(wx, wy) + 40 + (edge ? 0 : (Math.random() - 0.5) * (bolt ? 22 : 6)), wy));
  }
  let path;
  if(bolt){ path = new THREE.CurvePath(); for(let i = 0; i < n; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1])); }
  else path = new THREE.CatmullRomCurve3(pts);
  const w = Math.max(2.5, (l.w || 4) * 1.05);
  const g = new THREE.Group();
  const m1 = new THREE.MeshBasicMaterial({ color: l.color, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
  const m2 = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  g.add(new THREE.Mesh(new THREE.TubeGeometry(path, n * 3, w, 6, false), m1));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(path, n * 3, w * 0.32, 4, false), m2));
  for(const p of [pts[0], pts[n]]){
    const s = new THREE.Sprite(glowMat(l.color));
    s.scale.set(w * 9, w * 9, 1);
    s.position.copy(p);
    g.add(s);
  }
  g.userData.mats = [m1, m2];
  if(bolt) spellLight((l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2, pts[n >> 1].y + 10, l.color, 1.6, Math.min(0.5, l.life || 0.3), 380);
  // iskre duž munje / zrake
  for(let i = 0; i < 8; i++){
    const p = pts[Math.floor(Math.random() * pts.length)];
    fxSpawn(p.x, p.z, p.y, l.color, { spd: 60, up: 20, life: 0.35, size: 16 });
  }
  return g;
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
  const m = MODELS.ready ? modelInstance('rune_' + rn.def.id, 0, 44) : null;
  if(m){ g.add(m); g.userData.model = m; }
  else {
    const spr = emojiSprite(rn.def.emoji, 46);
    spr.position.y = 44;
    g.add(spr);
    g.userData.spr = spr;
  }
  g.userData.ring = ring;
  g.position.set(rn.x, groundHeight(rn.x, rn.y), rn.y);
  return g;
}

/* 👁️ Sovino oko (ward): kolac s okom + blijedi prsten dometa vida */
function buildWardMesh(w){
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(w.r - 6, w.r, 56),
    new THREE.MeshBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.3,
      side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 2;
  g.add(ring);
  const glow = new THREE.Sprite(glowMat('#c4b5fd'));
  glow.scale.set(90, 90, 1);
  glow.position.y = 46;
  g.add(glow);
  const m = MODELS.ready ? modelInstance('ward', w.team, 40) : null;
  if(m){ g.add(m); g.userData.model = m; }
  else {
    const spr = emojiSprite('👁️', 40);
    spr.position.y = 44;
    g.add(spr);
    g.userData.spr = spr;
  }
  g.userData.ring = ring;
  g.position.set(w.x, groundHeight(w.x, w.y), w.y);
  return g;
}

function syncMapped(arr, map, buildFn, updateFn, removeFn){
  for(const o of arr){
    let m = map.get(o);
    if(!m){ m = buildFn(o); map.set(o, m); scene3.add(m); }
    if(updateFn) updateFn(o, m);
  }
  if(map.size > arr.length){
    for(const key of map.keys()){
      if(arr.indexOf(key) === -1){
        const m = map.get(key);
        if(removeFn) removeFn(key, m);
        scene3.remove(m);
        if(m.traverse) disposeGroup(m);
        map.delete(key);
      }
    }
  }
}

/* ---------- smrt: model se prevrne i utone u tlo ---------- */
function startDying(u, g, now){
  const kind = u.kind;
  if(!g.visible){ scene3.remove(g); disposeGroup(g); return; }
  const ud = g.userData;
  for(const k of ['ring', 'shield', 'statusSpr', 'glow', 'stars', 'roots', 'aura']) if(ud[k]) ud[k].visible = false;
  const x = g.position.x, y = g.position.z, h = g.position.y;
  if(kind === 'ancient'){
    // prijestol: kristal se rasprsne u krhotine, baza polako tone
    if(ud.crystal) ud.crystal.visible = false;
    shatterFx(x, y, h + 2.15 * MODEL_SCALE.ancient, u.team, 18);
    for(let i = 0; i < 60; i++) fxSpawn(x, y, h + 60 + Math.random() * 80, i % 2 ? TEAM_LIGHT[u.team] : '#ffffff', { spd: 220, up: 120, grav: -60, life: 1.4, size: 40 });
    for(let i = 0; i < 24; i++) fxSpawn(x, y, h + 20, '#9aa3ad', { spd: 120, up: 40, grav: -10, life: 2.2, size: 60 });
    shakeAt(x, y, 2.2, 1.6);
    dying.push({ g, kind, t0: now, y0: h, dur: 4 });
    return;
  }
  const dieAnim = !!(ud.anim && ud.anim.acts.die);
  if(dieAnim) animOnce(ud.anim, 'die', 1.1, now, 0);
  const bldg = kind === 'tower' || kind === 'barracks';
  dying.push({ g, kind: bldg ? 'tower' : kind, t0: now, y0: h, dur: bldg ? 1.8 : (dieAnim ? 2.2 : 1.3), anim: dieAnim ? ud.anim : null });
  const c = bldg ? '#d6cbb5' : '#e5e7eb';
  const n = bldg ? 26 : 8;
  for(let i = 0; i < n; i++)
    fxSpawn(x, y, h + 10 + Math.random() * 30, c, { spd: bldg ? 120 : 60, up: 20, grav: -30, life: 0.9, size: bldg ? 40 : 22 });
  if(bldg) shakeAt(x, y, 1.3, 0.8);
  if(kind === 'neutral' && u.boss){
    for(let i = 0; i < 40; i++) fxSpawn(x, y, h + 30, i % 2 ? '#fde047' : '#ff7a1a', { spd: 180, up: 100, grav: -50, life: 1.2, size: 34 });
    shakeAt(x, y, 1.2, 0.8);
  }
}
function updateDying(now, dt){
  for(let i = dying.length - 1; i >= 0; i--){
    const d = dying[i];
    const t = now - d.t0;
    const m = d.g.userData.model || d.g;
    if(d.anim){
      d.anim.mixer.update(dt);
      if(t > 1.3) d.g.position.y = d.y0 - (t - 1.3) / (d.dur - 1.3) * 60;
    }
    else if(d.kind === 'tower'){
      m.rotation.z = Math.min(1, t / d.dur) * 0.25;
      d.g.position.y = d.y0 - Math.pow(Math.min(1, t / d.dur), 2) * 170;
    } else if(d.kind === 'ancient'){
      d.g.position.y = d.y0 - Math.pow(Math.min(1, t / d.dur), 1.5) * 120;
      m.rotation.z = Math.sin(t * 9) * 0.02 * Math.max(0, 1 - t);
    } else {
      m.rotation.x = Math.min(1, t / 0.35) * 1.45;
      if(t > 0.6) d.g.position.y = d.y0 - (t - 0.6) / (d.dur - 0.6) * 45;
    }
    if(t > d.dur){
      scene3.remove(d.g);
      disposeGroup(d.g);
      dying.splice(i, 1);
    }
  }
}
/* duh koji se diže s mjesta pogibije i nadgrobni kamen dok junak čeka oživljavanje */
function ghostFx(x, y, gh){
  const m = modelInstance('fx_ghost', 0, 36);
  if(!m) return;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, roughness: 0.9 });
  m.traverse(o => { if(o.isMesh){ o.material = mat; o.castShadow = false; } });
  m.position.set(x, gh + 10, y);
  addFx(m, 2.6, (o, f, t) => {
    o.position.y = gh + 10 + t * 65;
    o.position.x = x + Math.sin(t * 4) * 10;
    o.rotation.y = Math.sin(t * 3) * 0.3;
    mat.opacity = 0.9 * (1 - Math.max(0, f - 0.5) / 0.5);
  }, () => mat.dispose());
}
function tombFx(x, y, gh){
  const m = modelInstance('fx_tomb', 0, 38);
  if(!m) return null;
  m.position.set(x, gh - 2, y);
  m.rotation.y = Math.random() * 0.6 - 0.3;
  return addFx(m, 9999, (o, f, t) => {
    const k = Math.min(1, t / 0.3), b = 1 + Math.sin(Math.min(1, t / 0.5) * Math.PI) * 0.15;
    o.scale.set(38 * k * b, 38 * k, 38 * k * b);
  });
}

/* ---------- statusi u 3D: zvjezdice, korijenje, pahulje, aura ---------- */
function ensureStars(g, h){
  const ud = g.userData;
  if(ud.stars !== undefined) return ud.stars;
  const im = instancedFx('fx_star', 3, true);
  if(im){ g.add(im); ud.starsH = h; }
  ud.stars = im || null;
  return ud.stars;
}
function updateStars(g, tAnim){
  const im = g.userData.stars;
  for(let i = 0; i < 3; i++){
    const a = tAnim * 5 + i * TAU / 3;
    _dummy.position.set(Math.cos(a) * 30, g.userData.starsH + Math.sin(a * 2) * 4, Math.sin(a) * 30);
    _dummy.rotation.set(0, -g.rotation.y, 0);   // zvijezde uvijek gledaju prema kameri
    _dummy.scale.setScalar(28);
    _dummy.updateMatrix();
    im.setMatrixAt(i, _dummy.matrix);
  }
  im.instanceMatrix.needsUpdate = true;
}
function syncStatusFx(u, g, tAnim, dt, headH){
  const ud = g.userData, st = u.status;
  // omama: zvjezdice kruže oko glave
  if(st.stun > 0){ if(ensureStars(g, headH)){ ud.stars.visible = true; updateStars(g, tAnim); } }
  else if(ud.stars) ud.stars.visible = false;
  // korijen: korijenje izbije i drži noge
  if(st.rootT > 0){
    if(ud.roots === undefined){ ud.roots = modelInstance('fx_root', 0, 42); if(ud.roots) g.add(ud.roots); }
    if(ud.roots){
      ud.rootT = (ud.rootT || 0) + dt;
      const k = Math.min(1, ud.rootT / 0.2);
      ud.roots.visible = true;
      ud.roots.scale.set(44, 42 * k, 44);
      ud.roots.rotation.y = -g.rotation.y + (u.id || 0);
    }
  } else { if(ud.roots) ud.roots.visible = false; ud.rootT = 0; }
  // otrov: zeleni mjehurići
  if(st.poisonT > 0 && Math.random() < dt * 8)
    fxSpawn(u.x + (Math.random() - 0.5) * 30, u.y + (Math.random() - 0.5) * 30, g.position.y + 10, '#86efac', { spd: 6, up: 40, grav: 0, life: 0.9, size: 14 });
  // imun (Kraljevski oklop): zlatne iskre
  if(st.immuneT > 0 && Math.random() < dt * 10)
    fxSpawn(u.x + (Math.random() - 0.5) * 40, u.y + (Math.random() - 0.5) * 40, g.position.y + 20 + Math.random() * 50, '#fde047', { spd: 8, up: 30, grav: 0, life: 0.6, size: 14 });
  // usporenje: pahulje padaju oko jedinice
  if(st.slowT > 0 && Math.random() < dt * 7)
    fxSpawn(u.x + (Math.random() - 0.5) * 36, u.y + (Math.random() - 0.5) * 36, g.position.y + 20 + Math.random() * 50, '#dff6ff', { spd: 4, up: -25, grav: 0, life: 0.8, size: 12 });
  // ubrzanje: bijeli tragovi dok trči
  if(st.hasteT > 0 && gameTime - (u.lastMoveT == null ? -9 : u.lastMoveT) < 0.15 && Math.random() < dt * 25)
    fxSpawn(u.x, u.y, g.position.y + 15 + Math.random() * 25, '#ffffff', { spd: 6, up: 0, grav: 0, life: 0.3, size: 20 });
  // dvostruka šteta / Zmajev blagoslov: vatrena aura
  if(st.dmgMulT > 0){
    if(!ud.aura){
      ud.aura = new THREE.Sprite(glowMat('#f97316'));
      ud.aura.position.y = headH * 0.45;
      g.add(ud.aura);
    }
    ud.aura.visible = true;
    const s = 95 + Math.sin(tAnim * 8) * 12;
    ud.aura.scale.set(s, s, 1);
  } else if(ud.aura) ud.aura.visible = false;
}
/* iskre kad jedinica primi udarac (radi i kod gosta — gleda pad života) */
function syncHitFx(u, g, bodyH, tAnim){
  const ud = g.userData;
  if(ud.hp != null && u.hp < ud.hp - 0.5 && g.visible){
    const n = u.kind === 'tower' || u.kind === 'ancient' ? 6 : 4;
    for(let i = 0; i < n; i++) fxSpawn(u.x, u.y, g.position.y + bodyH, i % 2 ? '#fff7c2' : '#ffb347', { spd: 110, up: 60, grav: -80, life: 0.35, size: 16 });
    // trzaj (ako baš ne napada / ne čara)
    const a = ud.anim;
    if(a && a.acts.hit && tAnim >= a.oneEnd && !u.dead) animOnce(a, 'hit', 1.3, tAnim, 0);
  }
  ud.hp = u.hp;
}
/* prašina pod nogama dok hoda */
function syncSteps(u, g, dt){
  const ud = g.userData;
  const moving = gameTime - (u.lastMoveT == null ? -9 : u.lastMoveT) < 0.15;
  if(!moving){ ud.stepT = 0.15; return; }
  ud.stepT = (ud.stepT || 0) + dt;
  if(ud.stepT >= 0.22){
    ud.stepT = 0;
    const r = u.r || 16;
    fxSpawn(u.x + (Math.random() - 0.5) * r, u.y + (Math.random() - 0.5) * r, g.position.y + 3, '#c9b48c', { spd: 12, up: 16, grav: -12, life: 0.45, size: 10 + r * 0.35 });
  }
}
/* efekt pri bacanju moći — ključ je "junak:tipka" (game.js: u.castFx) */
function castFx(u, g, key){
  const gh = groundHeight(u.x, u.y);
  {   // zajedničko za sve magije: runski krug, bljesak svjetla, udarni val za AoE oko junaka, stup svjetla za ulti
    const [hid, k] = key.split(':');
    let col = '#bae6fd', ult = false, self = 0;
    if(hid !== 'item'){
      if(!HERO_BY_ID3[hid]) HERO_BY_ID3[hid] = HEROES.find(h => h.id === hid);
      const ab = HERO_BY_ID3[hid] && HERO_BY_ID3[hid].abilities.find(a => a.key === k);
      if(ab){ col = ab.color || col; ult = !!ab.ult; self = (ab.bot && ab.bot.type === 'chain') ? 0 : Math.min(360, ab.selfAoe || 0); }
    }
    if(g.visible){
      magicCircle(u.x, u.y, ult ? 125 : (hid === 'item' ? 55 : 80), col, ult ? 1.35 : 0.85, ult);
      spellLight(u.x, u.y, gh + 70, col, ult ? 3.4 : 2.1, ult ? 1.0 : 0.6, ult ? 700 : 430);
      if(self) shockwave(u.x, u.y, self, col);
      if(ult){ beamFx(u.x, u.y, col, 1.25); shakeAt(u.x, u.y, 0.35, 0.3); }
    }
  }
  const dust = (n, c) => { for(let i = 0; i < n; i++) fxSpawn(u.x, u.y, gh + 4, c || '#c9b48c', { spd: 120, up: 30, grav: -30, life: 0.6, size: 22 }); };
  if(LEAP_KEYS[key]) startLeap(u, g, lastAnimT);
  switch(key){
    case 'jez:Q':   // Kiša bodlji: bodlje lete na sve strane
      fxRadial('proj_quill', u.x, u.y, gh + 45, 14, { scale: 30, speed: 420, life: 0.5 }); break;
    case 'jez:R': for(let i = 0; i < 20; i++) fxSpawn(u.x, u.y, gh + 30, '#bef264', { spd: 160, up: 60, grav: -20, life: 0.6, size: 22 }); break;
    case 'slon:Q': shakeAt(u.x, u.y, 1.0, 0.5); dust(24); break;
    case 'slon:W': dust(6); break;
    case 'slon:R': shakeAt(u.x, u.y, 1.4, 0.9); dust(30); break;
    case 'pcela:Q': break;
    case 'sova:Q':   // Huk: zvučni valovi
      for(let i = 0; i < 26; i++){ const a = i / 26 * TAU; fxSpawn(u.x + Math.cos(a) * 40, u.y + Math.sin(a) * 40, gh + 60, '#e9d5ff', { spd: 0, up: 0, grav: 0, life: 0.5, size: 20 }); }
      break;
    case 'sova:R': for(let i = 0; i < 30; i++) fxSpawn(u.x, u.y, gh + 40, '#6d28d9', { spd: 260, up: 80, grav: 0, life: 1.0, size: 30 }); shakeAt(u.x, u.y, 0.4, 0.4); break;
    case 'majmun:Q': {   // Štap-udarac: štap se produži
      const geo = cachedGeo('staffGeo', () => { const c = new THREE.CylinderGeometry(1, 1, 1, 8); c.rotateZ(-Math.PI / 2); return c; });
      const m = new THREE.Mesh(geo, lambMat('#f6c945'));
      const yaw = -(u.dir || 0);
      addFx(m, 0.32, (o, f) => {
        const L = 420 * Math.sin(Math.min(1, f * 1.3) * Math.PI);
        o.position.set(u.x + Math.cos(u.dir || 0) * L / 2, gh + 50, u.y + Math.sin(u.dir || 0) * L / 2);
        o.rotation.y = yaw;
        o.scale.set(Math.max(1, L), 7, 7);
      });
      break;
    }
    case 'majmun:R': for(let i = 0; i < 24; i++) fxSpawn(u.x + (Math.random() - 0.5) * 120, u.y + (Math.random() - 0.5) * 120, gh + 20, '#f59e0b', { spd: 40, up: 50, grav: 0, life: 0.8, size: 26 }); break;
    case 'item:bkb': for(let i = 0; i < 24; i++) fxSpawn(u.x, u.y, gh + 30, '#fde047', { spd: 120, up: 70, grav: -20, life: 0.7, size: 20 }); break;
    case 'item:dust': for(let i = 0; i < 30; i++) fxSpawn(u.x, u.y, gh + 30, '#e5e7eb', { spd: 320, up: 20, grav: 0, life: 0.9, size: 30 }); break;
    case 'item:tango': for(let i = 0; i < 12; i++) fxSpawn(u.x + (Math.random() - 0.5) * 40, u.y + (Math.random() - 0.5) * 40, gh + 30, i % 2 ? '#86efac' : '#4ade80', { spd: 30, up: 50, grav: -20, life: 0.8, size: 16 }); break;
    case 'item:clarity': for(let i = 0; i < 12; i++) fxSpawn(u.x + (Math.random() - 0.5) * 40, u.y + (Math.random() - 0.5) * 40, gh + 20, '#7dd3fc', { spd: 10, up: 90, grav: 0, life: 0.9, size: 16 }); break;
    case 'item:cheese': beamFx(u.x, u.y, '#fde047', 1); for(let i = 0; i < 24; i++) fxSpawn(u.x, u.y, gh + 40, '#fde047', { spd: 160, up: 90, grav: -40, life: 0.8, size: 20 }); break;
    case 'item:bottle': for(let i = 0; i < 12; i++) fxSpawn(u.x + (Math.random() - 0.5) * 40, u.y + (Math.random() - 0.5) * 40, gh + 20, '#7dd3fc', { spd: 10, up: 80, grav: 0, life: 0.8, size: 16 }); break;
    case 'vuk:Q':   // Zavijanje: zvučni krugovi
      for(let k = 0; k < 3; k++) for(let i = 0; i < 20; i++){ const a = i / 20 * TAU; fxSpawn(u.x + Math.cos(a) * (60 + k * 110), u.y + Math.sin(a) * (60 + k * 110), gh + 50, '#e2e8f0', { spd: 60, up: 10, grav: 0, life: 0.5 + k * 0.15, size: 18 }); }
      break;
    case 'vuk:R': shakeAt(u.x, u.y, 0.6, 0.4); for(let i = 0; i < 30; i++) fxSpawn(u.x, u.y, gh + 40, i % 2 ? '#94a3b8' : '#ff6a3d', { spd: 200, up: 90, grav: -20, life: 0.8, size: 24 }); break;
    case 'gavran:Q': break;
    case 'gavran:W': for(let i = 0; i < 20; i++) fxSpawn(u.x, u.y, gh + 40, '#c4b5fd', { spd: 140, up: 80, grav: 0, life: 0.6, size: 20 }); break;
    case 'gavran:R': for(let i = 0; i < 16; i++) fxSpawn(u.x, u.y, gh + 60, '#1f2430', { spd: 200, up: 120, grav: 0, life: 0.8, size: 22 }); break;
    case 'hobotnica:W': {   // Pipci: pipak se ispruži
      const geo = cachedGeo('staffGeo', () => { const c = new THREE.CylinderGeometry(1, 1, 1, 8); c.rotateZ(-Math.PI / 2); return c; });
      const m = new THREE.Mesh(geo, lambMat('#7c6fd6'));
      const yaw = -(u.dir || 0);
      addFx(m, 0.4, (o, f) => {
        const L = 380 * Math.sin(Math.min(1, f * 1.2) * Math.PI);
        o.position.set(u.x + Math.cos(u.dir || 0) * L / 2, gh + 30, u.y + Math.sin(u.dir || 0) * L / 2);
        o.rotation.y = yaw;
        o.scale.set(Math.max(1, L), 12, 12);
      });
      break;
    }
    case 'hobotnica:R':   // Vrtlog dubina: spirala vode
      shakeAt(u.x, u.y, 0.9, 0.6);
      for(let i = 0; i < 40; i++){ const a = i / 40 * TAU, r = 380 * (0.3 + 0.7 * (i % 5) / 5); fxSpawn(u.x + Math.cos(a) * r, u.y + Math.sin(a) * r, gh + 10, i % 2 ? '#4f46e5' : '#a5b4fc', { spd: 120, up: 90, grav: -40, life: 0.9, size: 26 }); }
      break;
    case 'nosorog:Q': dust(12); break;
    case 'nosorog:W': shakeAt(u.x, u.y, 0.6, 0.35); dust(16); break;
    case 'nosorog:R': shakeAt(u.x, u.y, 0.5, 0.4); for(let i = 0; i < 26; i++) fxSpawn(u.x, u.y, gh + 50, '#ef4444', { spd: 200, up: 100, grav: -20, life: 0.7, size: 24 }); break;
    case 'panda:Q': shakeAt(u.x, u.y, 0.8, 0.45); dust(18); for(let i = 0; i < 16; i++){ const a = i / 16 * TAU; fxSpawn(u.x + Math.cos(a) * 120, u.y + Math.sin(a) * 120, gh + 30, '#fde68a', { spd: 100, up: 40, grav: 0, life: 0.5, size: 22 }); } break;
    case 'panda:W': break;
    case 'panda:R': for(let i = 0; i < 24; i++) fxSpawn(u.x + (Math.random() - 0.5) * 120, u.y + (Math.random() - 0.5) * 120, gh + 20, i % 3 === 0 ? '#86efac' : (i % 3 === 1 ? '#7dd3fc' : '#fb923c'), { spd: 40, up: 60, grav: 0, life: 0.8, size: 26 }); break;
    case 'vitez:Q':   // Vrtlog: junak se zavrti
      g.userData.spin = TAU * 2;
      for(let i = 0; i < 18; i++) fxSpawn(u.x, u.y, gh + 30 + Math.random() * 30, '#fde68a', { spd: 220, up: 20, grav: 0, life: 0.45, size: 20 });
      break;
    case 'vitez:E': dust(14); shakeAt(u.x, u.y, 0.5, 0.3); break;
    case 'vitez:R':   // Kraljev urlik
      shakeAt(u.x, u.y, 1.2, 0.6);
      for(let i = 0; i < 30; i++) fxSpawn(u.x, u.y, gh + 40, '#fde047', { spd: 300, up: 30, grav: 0, life: 0.6, size: 26 });
      break;
    case 'zarko:W':   // Plameni krug
      for(let i = 0; i < 28; i++){ const a = i / 28 * TAU; fxSpawn(u.x + Math.cos(a) * 200, u.y + Math.sin(a) * 200, gh + 8, i % 2 ? '#ff7a1a' : '#ffe26b', { spd: 20, up: 70, grav: 0, life: 0.7, size: 30 }); }
      break;
    case 'zarko:R': shakeAt(u.x, u.y, 0.6, 0.4); break;
    case 'ledena:R': case 'skokica:R': case 'strijela:R': case 'munja:R': case 'orlina:R': case 'luna:R':
      shakeAt(u.x, u.y, 0.5, 0.35); break;
    case 'listko:W':   // Iscjeljenje: srca
      fxFloat('fx_heart', u.x, u.y, 60, 7, { scale: 22, up: 70, life: 1.4, h0: 30 }); break;
    case 'listko:R':   // Šumsko srce: korijenje + srca + lišće
      fxRise('fx_root', u.x, u.y, 300, 9, { scale: 34, life: 1.8 });
      fxFloat('fx_heart', u.x, u.y, 120, 8, { scale: 22, up: 70, life: 1.5, h0: 30 });
      for(let i = 0; i < 30; i++) fxSpawn(u.x + (Math.random() - 0.5) * 500, u.y + (Math.random() - 0.5) * 500, gh + 10, '#86efac', { spd: 20, up: 80, grav: 0, life: 1.2, size: 20 });
      shakeAt(u.x, u.y, 0.5, 0.4);
      break;
    case 'luna:W':   // Zvjezdana kiša
      fxRain('fx_star', u.x, u.y, 240, 12, { scale: 22, spin: true, height: 360, fall: 0.5, hold: 0.45, glow: true, trail: '#e9d5ff' }); break;
    case 'skokica:E':   // Mjehur
      for(let i = 0; i < 18; i++) fxSpawn(u.x + (Math.random() - 0.5) * 300, u.y + (Math.random() - 0.5) * 300, gh + 20, '#a5f3fc', { spd: 10, up: 45, grav: 0, life: 1.4, size: 24 });
      break;
    case 'skokica:W': case 'orlina:E': case 'luna:E': case 'munja:W': dust(10); break;
    case 'orlina:W':   // Uzlet: vjetar
      for(let i = 0; i < 14; i++) fxSpawn(u.x, u.y, gh + 20 + Math.random() * 50, '#ffffff', { spd: 160, up: 10, grav: 0, life: 0.5, size: 18 }); break;
    case 'tragac:E':   // Sjena: dim
      for(let i = 0; i < 16; i++) fxSpawn(u.x, u.y, gh + 20 + Math.random() * 40, '#6b7280', { spd: 50, up: 30, grav: 0, life: 0.9, size: 34 }); break;
    case 'munja:Q':
      for(let i = 0; i < 12; i++) fxSpawn(u.x, u.y, gh + 50, '#fde047', { spd: 120, up: 40, grav: -40, life: 0.4, size: 18 }); break;
  }
}

/* ================= glavna sinkronizacija ================= */
function pickStatusEmoji(u){
  if(u.status.stun > 0) return '⭐';
  if(u.status.immuneT > 0) return '👑';
  if(u.status.rageT > 0) return '😡';
  if(u.status.blindT > 0) return '😵';
  if(u.status.curseT > 0) return '🌀';
  if(u.status.trackT > 0) return '💰';
  if(u.status.silenceT > 0) return '🤐';
  if(u.status.poisonT > 0) return '🤢';
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
    const nm = a.acts.attack2 && (ud.atkN % 3 === 2) ? 'attack2' : 'attack';   // svaki treći udarac drukčiji zamah
    animOnce(a, nm, Math.max(1, 0.62 / cd), now, u.projSpeed ? 0.1 : 0.04);
    if(u.kind === 'hero' && !u.projSpeed && g.visible) swingFx(u, nm === 'attack2');   // trag zamaha oružja
  }
  if((u.castN || 0) !== ud.castN){
    ud.castN = u.castN || 0;
    // magije s ciljem: "bacanje" prema cilju (cast2); oko sebe i ulti: obje ruke uvis (cast)
    let nm = 'cast';
    if(u.castFx && a.acts.cast2 && u.hero){
      const k = u.castFx.split(':')[1];
      const ab = u.hero.abilities.find(x => x.key === k);
      if(ab && ab.target === 'point' && !ab.ult) nm = 'cast2';
    }
    animOnce(a, nm, nm === 'cast2' ? 1.15 : 1.25, now, 0);
    if(u.castFx) castFx(u, g, u.castFx);
  }
  const moving = gameTime - (u.lastMoveT == null ? -9 : u.lastMoveT) < 0.15;
  const stunned = u.status && u.status.stun > 0;
  if(typeof winnerTeam !== 'undefined' && winnerTeam != null && u.kind === 'hero' && u.team === winnerTeam && a.acts.victory)
    animBase(a, 'victory', 1, now);
  else if(u.tpChannel > 0 && a.acts.channel) animBase(a, 'channel', 1, now);
  else if(moving && !stunned) animBase(a, 'walk', 0.7 + (u.speed || 150) / 240, now);
  else {
    // s vremena na vrijeme: ogleda se / protegne
    if(!stunned && a.acts.idle2 && now >= a.oneEnd && now > (ud.nextIdle2 || 0)){
      if(ud.nextIdle2) animOnce(a, 'idle2', 1, now, 0);
      ud.nextIdle2 = now + 7 + Math.random() * 9;
    }
    animBase(a, 'idle', stunned ? 0.4 : 1, now);
  }
  a.mixer.update(dt);
}
/* ⚔️ trag zamaha: svijetli luk ispred junaka koji se proteže preko zamaha (blizinski napad) */
function swingFx(u, flip){
  const geo = cachedGeo('swingArc', () => new THREE.RingGeometry(24, 62, 22, 1, -0.95, 1.9));
  const col = new THREE.Color((u.hero && u.hero.abilities[0].color) || '#ffffff').lerp(new THREE.Color('#ffffff'), 0.55);
  const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending });
  const inner = new THREE.Mesh(geo, mat);
  inner.rotation.x = -Math.PI / 2;
  const holder = new THREE.Group();
  holder.add(inner);
  const dir = u.dir || 0;
  addFx(holder, 0.3, (o, f) => {
    const gh = groundHeight(u.x, u.y);
    o.position.set(u.x, gh + 34 + (flip ? 10 : 0), u.y);
    o.rotation.set(flip ? 0.35 : -0.25, -dir, 0);
    inner.rotation.z = (flip ? 1 : -1) * (0.9 - 1.8 * f);   // luk "prebriše" od jedne strane do druge
    mat.opacity = Math.sin(Math.min(1, f * 1.4) * Math.PI) * 0.7;
    const s = 0.85 + f * 0.3;
    o.scale.set(s, s, s);
  });
}
/* 💰 zlatnici iskoče iz ubijenog vojnika i odlete prema junaku */
function coinFx(x, y, n){
  const gh = groundHeight(x, y);
  for(let i = 0; i < n; i++){
    const m = modelInstance('fx_coin', 0, 40);
    if(!m) return;
    const a = Math.random() * TAU, sp = 40 + Math.random() * 50, delay = i * 0.06;
    addFx(m, 0.95 + delay, (o, f) => {
      const t = Math.max(0, f * (0.95 + delay) - delay);
      o.visible = t > 0;
      const k = Math.min(1, t / 0.95);
      o.position.set(x + Math.cos(a) * sp * k, gh + 20 + 140 * k - 170 * k * k + Math.sin(k * Math.PI) * 30, y + Math.sin(a) * sp * k);
      o.rotation.y = t * 14;
      const s = 40 * (k < 0.8 ? 1 : 1 - (k - 0.8) * 4);
      o.scale.setScalar(Math.max(0.1, s));
    });
  }
  for(let i = 0; i < 6; i++) fxSpawn(x, y, gh + 30, '#fde047', { spd: 70, up: 60, grav: -40, life: 0.5, size: 14 });
}
/* skokovi (Junački skok, Žablji skok, Obrušavanje, Mjesečev skok, Majmunski skok, Skokne čizme):
   logika premjesti junaka odmah, a model preleti lukom */
const LEAP_KEYS = { 'vitez:E': 1, 'skokica:W': 1, 'orlina:E': 1, 'luna:E': 1, 'majmun:W': 1, 'munja:W': 1, 'item:blink': 1, 'vuk:W': 1 };
function startLeap(u, g, now, maxH){
  const ud = g.userData;
  if(ud.lastX == null) return;
  const d = distXY(ud.lastX, ud.lastY, u.x, u.y);
  if(d < 40) return;
  ud.leap = { x0: ud.lastX, y0: ud.lastY, t0: now, dur: Math.min(0.5, 0.22 + d / 1400), h: Math.min(maxH || 170, 60 + d * 0.25) };
  if(!maxH && ud.anim && ud.anim.acts.jump) animOnce(ud.anim, 'jump', 14 / 24 / ud.leap.dur, now, 0);
  else if(maxH && ud.anim && ud.anim.acts.hit) animOnce(ud.anim, 'hit', 0.8, now, 0);
}

function syncScene(tAnim){
  const dt = Math.min(0.1, Math.max(0, tAnim - (lastAnimT || tAnim)));
  lastAnimT = tAnim;
  // jedinice označene za uklanjanje (removeMe) tretiraj kao nestale — i kad je igra
  // gotova (update() više ne radi), prijestol se mora raspasti
  const present = new Set();
  for(const u of units) if(!u.removeMe) present.add(u);
  for(const key of meshByUnit.keys()){
    if(!present.has(key)){
      const g = meshByUnit.get(key);
      meshByUnit.delete(key);
      if(MODELS.ready) startDying(key, g, tAnim);
      else { scene3.remove(g); disposeGroup(g); }
    }
  }
  updateDying(tAnim, dt);
  for(const u of units){
    if(u.removeMe) continue;
    const g = ensureUnitMesh(u);
    const ud = g.userData;
    const gh = groundHeight(u.x, u.y);
    const seen = seenByPlayer(u);   // magla rata: skriveni neprijatelji se ne crtaju
    if(u.kind === 'hero'){
      // smrt junaka: prevrne se, duh odleti, ostane nadgrobni kamen do oživljavanja
      if(u.dead){
        if(ud.deadT0 == null){
          ud.deadT0 = tAnim;
          ud.deadY = gh;
          ud.dieAnim = !!(ud.anim && ud.anim.acts.die);
          if(ud.anim){
            if(ud.dieAnim) animOnce(ud.anim, 'die', 1.1, tAnim, 0);
            else ud.anim.mixer.stopAllAction();
          }
          for(const k of ['ring', 'shield', 'statusSpr', 'stars', 'roots', 'aura']) if(ud[k]) ud[k].visible = false;
          if(seen && MODELS.ready){ ghostFx(u.x, u.y, gh); ud.tomb = tombFx(u.x, u.y, gh); }
        }
        const t = tAnim - ud.deadT0;
        const m = ud.model;
        g.visible = seen && t < 2.4 && !!m;
        if(m){
          if(ud.dieAnim) ud.anim.mixer.update(dt);
          else m.rotation.x = Math.min(1, t / 0.35) * 1.45;
          g.position.y = ud.deadY - Math.max(0, t - (ud.dieAnim ? 1.4 : 0.9)) * 60;
        }
        ud.hp = u.hp;
        continue;
      }
      if(ud.deadT0 != null){
        ud.deadT0 = null;
        if(ud.model) ud.model.rotation.x = 0;
        ud.ring.visible = true;
        if(ud.anim){ ud.anim.mixer.stopAllAction(); ud.anim.cur = null; ud.anim.oneEnd = 0; }
        if(ud.tomb){ ud.tomb.life = 0; ud.tomb = null; }
        if(seen) beamFx(u.x, u.y, '#93c5fd', 0.9);
      }
      if(ud.level !== u.level){
        if(ud.level != null && u.level > ud.level && seen) beamFx(u.x, u.y, '#fde047', 1);
        ud.level = u.level;
      }
      g.visible = seen;
      g.position.set(u.x, gh, u.y);
      if((u.knockN || 0) !== (ud.knockN || 0)){   // odbačaj: kratki luk
        ud.knockN = u.knockN || 0;
        startLeap(u, g, tAnim, 50);
      }
      if(ud.leap){   // luk skoka: model preleti sa stare na novu poziciju
        const f = Math.min(1, (tAnim - ud.leap.t0) / ud.leap.dur);
        const lx = lerp(ud.leap.x0, u.x, f), ly = lerp(ud.leap.y0, u.y, f);
        g.position.set(lx, groundHeight(lx, ly) + Math.sin(f * Math.PI) * ud.leap.h, ly);
        if(f >= 1){ ud.leap = null; for(let i = 0; i < 10; i++) fxSpawn(u.x, u.y, gh + 4, '#c9b48c', { spd: 110, up: 25, grav: -30, life: 0.5, size: 20 }); }
      }
      ud.lastX = u.x; ud.lastY = u.y;
      if(!seen) continue;
      ud.yaw = angleLerp(ud.yaw, -(u.dir || 0), Math.min(1, dt * 14));
      // Vrtlog: dodatna vrtnja modela
      if(ud.spin > 0){ const d = Math.min(ud.spin, dt * 22); ud.spinA = (ud.spinA || 0) + d; ud.spin -= d; if(ud.spin <= 0) ud.spinA = 0; }
      if(ud.model) ud.model.rotation.y = ud.yaw + (ud.spinA || 0);
      else g.rotation.y = ud.yaw;
      ud.shield.visible = u.status.shieldT > 0;
      const ch = pickStatusEmoji(u);
      if(ch !== ud.statusCh){
        ud.statusCh = ch;
        if(ch){ ud.statusSpr.material.map = makeEmojiTexture(ch); ud.statusSpr.material.needsUpdate = true; }
        ud.statusSpr.visible = !!ch;
      }
      if(ud.statusSpr.visible) ud.statusSpr.position.y = 88 + Math.sin(tAnim * 6) * 4;
      const invis = u.status.invisT > 0;
      if(ud.model){
        const st = u.status;
        setModelLook(ud.model, u.flash > 0 ? 'f' : (invis ? 'g' : (st.rageT > 0 ? 'r' : (st.formT > 0 ? 'w' : (st.curseT > 0 ? 'k' : (st.slowT > 0 ? 'c' : (st.poisonT > 0 ? 'p' : 'n')))))));
        // 🐺 vučji oblik: model naraste
        if(ud.baseScale == null) ud.baseScale = ud.model.scale.x;
        const want = ud.baseScale * (st.formT > 0 ? 1.32 : 1);
        if(Math.abs(ud.model.scale.x - want) > 0.01) ud.model.scale.setScalar(lerp(ud.model.scale.x, want, Math.min(1, dt * 6)));
        if(st.formT > 0 && Math.random() < dt * 10) fxSpawn(u.x + (Math.random() - 0.5) * 50, u.y + (Math.random() - 0.5) * 50, gh + 20, '#cbd5e1', { spd: 10, up: 60, grav: 0, life: 0.6, size: 16 });
        if(st.rageT > 0 && Math.random() < dt * 14) fxSpawn(u.x + (Math.random() - 0.5) * 40, u.y + (Math.random() - 0.5) * 40, gh + 70, '#ef4444', { spd: 20, up: 70, grav: 0, life: 0.5, size: 16 });
        // 🏃 juriš: prašina za petama
        if(u.charge && Math.random() < dt * 40) fxSpawn(u.x, u.y, gh + 4, '#c9b48c', { spd: 90, up: 40, grav: -30, life: 0.6, size: 24 });
        // ☀️ Sunčev kamen: plamenčići kruže
        if(u.items && u.items.some(i => i.burn || i.emoji === '☀️') && Math.random() < dt * 24){
          const a = Math.random() * TAU;
          fxSpawn(u.x + Math.cos(a) * 70, u.y + Math.sin(a) * 70, gh + 10 + Math.random() * 40, Math.random() < 0.5 ? '#ff7a1a' : '#ffe26b', { spd: 10, up: 50, grav: 0, life: 0.5, size: 18 });
        }
        animateUnit(u, g, tAnim, dt);
        syncStatusFx(u, g, tAnim, dt, 100);
        syncSteps(u, g, dt);
        // teleport: plave iskre oko junaka
        if(u.tpChannel > 0 && Math.random() < dt * 30)
          fxSpawn(u.x + (Math.random() - 0.5) * 50, u.y + (Math.random() - 0.5) * 50, gh + 5, '#93c5fd', { spd: 10, up: 120, grav: 0, life: 0.7, size: 18 });
      } else {
        ud.head.position.y = 78 + Math.sin(tAnim * 2.4 + u.id) * 2.5;
        ud.body.material = u.flash > 0 ? lambMat('#ffffff') : (invis ? invisMat(u.team) : lambMat(TEAM_LIGHT[u.team]));
        ud.head.material.opacity = invis ? 0.55 : 1;
      }
      syncHitFx(u, g, 50, tAnim);
    }
    else if(u.kind === 'creep' || u.kind === 'neutral'){
      g.visible = seen;
      g.position.set(u.x, gh, u.y);
      if((u.knockN || 0) !== (ud.knockN || 0)){ ud.knockN = u.knockN || 0; startLeap(u, g, tAnim, 40); }
      if(ud.leap){
        const f = Math.min(1, (tAnim - ud.leap.t0) / ud.leap.dur);
        const lx = lerp(ud.leap.x0, u.x, f), ly = lerp(ud.leap.y0, u.y, f);
        g.position.set(lx, groundHeight(lx, ly) + Math.sin(f * Math.PI) * ud.leap.h, ly);
        if(f >= 1) ud.leap = null;
      }
      ud.lastX = u.x; ud.lastY = u.y;
      if(!seen){ ud.hp = u.hp; continue; }
      ud.yaw = angleLerp(ud.yaw, -(u.dir || 0), Math.min(1, dt * 12));
      g.rotation.y = ud.yaw;
      if(ud.model){
        setModelLook(ud.model, u.flash > 0 ? 'f' : (u.status.slowT > 0 ? 'c' : (u.status.poisonT > 0 ? 'p' : 'n')));
        animateUnit(u, g, tAnim, dt);
        syncStatusFx(u, g, tAnim, dt, u.r * 2.4 + 18);
        if(u.kind === 'neutral') syncSteps(u, g, dt);
      } else if(ud.body){
        ud.body.material = u.flash > 0 ? lambMat('#ffffff') : lambMat(TEAM_LIGHT[u.kind === 'creep' ? u.team : TEAM_NEUTRAL]);
      }
      syncHitFx(u, g, u.r + 12, tAnim);
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
      syncHitFx(u, g, 90, tAnim);
    }
    else if(u.kind === 'barracks'){
      g.position.set(u.x, gh, u.y);
      if(ud.model) setModelLook(ud.model, u.flash > 0 ? 'f' : 'n');
      if(glyph[u.team].t > 0 && Math.random() < dt * 14) fxSpawn(u.x + (Math.random() - 0.5) * 110, u.y + (Math.random() - 0.5) * 90, gh + 10, '#fde047', { spd: 6, up: 90, grav: 0, life: 0.8, size: 22 });
      syncHitFx(u, g, 70, tAnim);
    }
    else if(u.kind === 'tower'){
      g.position.set(u.x, gh, u.y);
      if(u.bdT != null && gameTime - u.bdT < 0.4 && Math.random() < dt * 30){   // 🛡️ backdoor zaštita: plavi štit iskri
        const a = Math.random() * TAU;
        fxSpawn(u.x + Math.cos(a) * 46, u.y + Math.sin(a) * 46, gh + 20 + Math.random() * 90, '#93c5fd', { spd: 10, up: 30, grav: 0, life: 0.5, size: 18 });
      }
      if(glyph[u.team].t > 0 && Math.random() < dt * 14) fxSpawn(u.x + (Math.random() - 0.5) * 80, u.y + (Math.random() - 0.5) * 80, gh + 10, '#fde047', { spd: 6, up: 110, grav: 0, life: 0.9, size: 22 });
      if(ud.model){
        const cr = ud.model.userData.parts.crystal;
        if(cr) cr.rotation.y = tAnim * 1.5;
        // pucanj: kristal bljesne i prsne iskrama
        if((u.atkN || 0) !== ud.atkN){
          ud.atkN = u.atkN || 0;
          ud.flashT = tAnim;
          for(let i = 0; i < 6; i++) fxSpawn(u.x, u.y, gh + 3.3 * MODEL_SCALE.tower, TEAM_LIGHT[u.team], { spd: 60, up: 40, grav: -30, life: 0.4, size: 20 });
        }
        if(ud.glow){
          const fl = Math.max(0, 1 - (tAnim - (ud.flashT == null ? -9 : ud.flashT)) / 0.3);
          const s = 80 + Math.sin(tAnim * 3 + u.id) * 10 + fl * 70;
          ud.glow.scale.set(s, s, 1);
        }
      } else if(ud.body){
        ud.body.material = u.flash > 0 ? lambMat('#ffffff') : lambMat('#e8e0cf');
      }
      syncHitFx(u, g, 90, tAnim);
    }
  }

  syncMapped(zones, zoneMeshes, buildZoneMesh, (z, g) => syncZone(z, g, tAnim, dt), zoneEndFx);
  syncMapped(projectiles, projMeshes, buildProjMesh, (p, g) => syncProj(p, g, tAnim, dt), projEndFx);

  syncMapped(markers, markerMeshes, buildMarkerMesh, (m, mesh) => {
    const f = Math.min(1, m.t / 0.5);
    const s = m.isRing ? (0.4 + 0.6 * f) : (1 - 0.4 * f);
    mesh.scale.set(s, s, 1);
    mesh.material.opacity = 1 - f;
  });

  syncMapped(lines, lineMeshes, buildLineMesh, (l, mesh) => {
    const k = Math.max(0, 1 - l.t / l.life);
    if(mesh.userData.mats){ mesh.userData.mats[0].opacity = 0.75 * k; mesh.userData.mats[1].opacity = k; }
    else if(mesh.material) mesh.material.opacity = k;
  });

  syncMapped(runes, runeMeshes, buildRuneMesh, (rn, g) => {
    const ud = g.userData;
    ud.ring.rotation.set(-Math.PI / 2, 0, tAnim * 2);
    if(ud.model){ ud.model.rotation.y = tAnim * 1.6; ud.model.position.y = 16 + Math.sin(tAnim * 3) * 8; }
    if(ud.spr) ud.spr.position.y = 44 + Math.sin(tAnim * 4) * 8;
    if(Math.random() < dt * 6) fxSpawn(rn.x + (Math.random() - 0.5) * 40, rn.y + (Math.random() - 0.5) * 40,
      groundHeight(rn.x, rn.y) + 10, '#fde047', { spd: 6, up: 50, grav: 0, life: 0.8, size: 14 });
  }, (rn, g) => {
    // runa pokupljena (netko stoji na njoj) → stup svjetla
    if(units.some(h => h.kind === 'hero' && !h.dead && distXY(h.x, h.y, rn.x, rn.y) < 110)) beamFx(rn.x, rn.y, '#fde047', 0.8);
  });

  syncMapped(wards, wardMeshes, buildWardMesh, (w, g) => {
    const ud = g.userData;
    g.visible = w.team === myTeam;   // protivnička oka se ne vide (kao u DotA)
    if(ud.model) ud.model.rotation.y = tAnim * 0.9;
    if(ud.spr) ud.spr.position.y = 44 + Math.sin(tAnim * 3) * 5;
    ud.ring.material.opacity = 0.18 + 0.12 * Math.sin(tAnim * 3) + (w.t < 2 ? 0 : 0.08);
    if(w.t < 2) ud.ring.scale.setScalar(Math.max(0.05, w.t / 2));   // pred istek se skuplja
  }, (w, g) => {
    if(w.team === myTeam) burst(g.position.x, g.position.z, '#c4b5fd', 10, 120, 4);
  });

  // 💰 zlatnici pri last-hitu
  if(typeof coinDrops !== 'undefined' && coinDrops.length){
    if(MODELS.ready) for(const c of coinDrops) coinFx(c.x, c.y, c.n);
    coinDrops.length = 0;
  }
  // 🕊️ svetišta: sjaj pulsira dok liječe, prigušen dok se pune
  shrineObjs.forEach((so, i) => {
    const s = (typeof shrines !== 'undefined' && shrines[i]) || null;
    const active = s && s.t > 0, ready = !s || s.cd <= 0;
    const base = active ? 150 + Math.sin(tAnim * 9) * 40 : (ready ? 90 + Math.sin(tAnim * 2) * 10 : 40);
    so.glow.scale.set(base, base, 1);
    so.glow.position.y = so.gh + 52 + (active ? Math.sin(tAnim * 6) * 8 : 0);
    if(active && Math.random() < dt * 40){
      const a = Math.random() * TAU, d = Math.random() * CFG.shrineR;
      fxSpawn(so.x + Math.cos(a) * d, so.y + Math.sin(a) * d, groundHeight(so.x, so.y) + 6, i % 2 ? '#bbf7d0' : TEAM_LIGHT[so.team], { spd: 10, up: 110, grav: 0, life: 0.9, size: 20 });
    }
  });

  if(playerRing3 && player){
    playerRing3.visible = !player.dead;
    playerRing3.position.set(player.x, groundHeight(player.x, player.y) + 1.4, player.y);
  }

  if(waterMesh) waterMesh.material.uniforms.t.value = tAnim;
  // ambijent: krijesnice noću, latice danju
  if(dayK < 0.4 && Math.random() < dt * 10){
    const x = cam.x + (Math.random() - 0.5) * 1400, y = cam.y + (Math.random() - 0.5) * 900;
    fxSpawn(x, y, groundHeight(x, y) + 25 + Math.random() * 60, Math.random() < 0.5 ? '#d9f99d' : '#fef08a', { spd: 14, up: 6, grav: 0, life: 2.5, size: 9 });
  } else if(dayK > 0.6 && Math.random() < dt * 3){
    const x = cam.x + (Math.random() - 0.5) * 1400, y = cam.y + (Math.random() - 0.5) * 900;
    fxSpawn(x, y, groundHeight(x, y) + 140, '#fbcfe8', { spd: 25, up: -30, grav: 0, life: 3, size: 8 });
  }
  updateFxObjs(dt);
  updateSpellLights(dt);
  updateFx(dt);
  syncCastIndicator();
}
function seenProj(p){
  if(typeof isVisibleTo !== 'function') return true;
  return isVisibleTo(myTeam, { x: p.x, y: p.y, team: -1, status: null });
}

/* ---------- kamera (+ tresenje i filmski let do prijestola) ---------- */
let camLastT = 0;
function updateCamera3(){
  const now = performance.now() / 1000;
  const dt = Math.min(0.1, now - (camLastT || now));
  camLastT = now;
  if(cine.on){
    cam.x = lerp(cam.x, cine.x, Math.min(1, dt * 2.5));
    cam.y = lerp(cam.y, cine.y, Math.min(1, dt * 2.5));
    cam.zoom = lerp(cam.zoom, cine.zoom, Math.min(1, dt * 2));
  }
  let ox = 0, oy = 0;
  if(shake.t > 0){
    shake.t -= dt;
    const a = shake.amp * Math.min(1, shake.t / 0.4);
    ox = (Math.random() - 0.5) * a * 2;
    oy = (Math.random() - 0.5) * a;
    if(shake.t <= 0) shake.amp = 0;
  }
  const d = CAM_DIST / cam.zoom;
  camera3.position.set(cam.x + ox, 40 + Math.sin(CAM_PITCH) * d + oy, cam.y + Math.cos(CAM_PITCH) * d);
  camera3.lookAt(cam.x + ox, 40 + oy, cam.y);
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
  for(const map of [zoneMeshes, projMeshes, markerMeshes, lineMeshes, runeMeshes, wardMeshes]){
    for(const [k, m] of map){ scene3.remove(m); if(m.traverse) disposeGroup(m); }
    map.clear();
  }
  fx.list.length = 0;
  for(const f of fxObjs){ scene3.remove(f.obj); disposeGroup(f.obj); }
  fxObjs.length = 0;
  shake.amp = 0; shake.t = 0; cine.on = false;
  for(const s of spellLights){ s.L.intensity = 0; s.peak = 0; }
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
  initEnvironment(r, s);
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
