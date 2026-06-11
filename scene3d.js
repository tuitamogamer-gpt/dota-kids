'use strict';
/* ============================================================
   DOTA Kids 3D — Three.js prikaz
   Logika igre je u game.js (x, y po tlu) — ovdje se svijet crta
   u 3D: logički y postaje os Z, visina (groundHeight) je os Y.
   Teren ima visine: rijeka je nizina, baze su platoi!
   ============================================================ */

let renderer3 = null, scene3 = null, camera3 = null, sunLight = null, hemiLight = null;
let groundMesh = null, treesGroup = null, staticGroup = null, playerRing3 = null;
let castInd = null;   // indikatori ciljanja (domet + područje + linija)
let fogTex = null, fogDrape = null;   // magla rata

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

const geoCache = {};
const matCache = {};
const emojiTexCache = {};
let glowTex = null;

const DAY_SKY = { day: null, night: null, sunDay: null, sunNight: null };

/* ---------- zajednički resursi ---------- */
function cachedGeo(key, makeFn){
  if(!geoCache[key]) geoCache[key] = makeFn();
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
      transparent: true, opacity: 0.55, depthWrite: false });
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
function disposeGroup(g){
  g.traverse(o => {
    if(o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if(o.material && !o.material.userData.shared) o.material.dispose();
  });
}

/* ---------- inicijalizacija ---------- */
function initScene3D(glCanvas){
  renderer3 = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
  renderer3.shadowMap.enabled = true;
  renderer3.shadowMap.type = THREE.PCFSoftShadowMap;
  if('outputEncoding' in renderer3 && THREE.sRGBEncoding !== undefined)
    renderer3.outputEncoding = THREE.sRGBEncoding;

  scene3 = new THREE.Scene();
  scene3.background = new THREE.Color(0x9fdcff);
  scene3.fog = new THREE.Fog(0x9fdcff, 3200, 6500);

  DAY_SKY.day = new THREE.Color(0x9fdcff);
  DAY_SKY.night = new THREE.Color(0x1c2750);
  DAY_SKY.sunDay = new THREE.Color(0xfff2d0);
  DAY_SKY.sunNight = new THREE.Color(0x9db8ff);

  camera3 = new THREE.PerspectiveCamera(50, 1, 10, 14000);

  hemiLight = new THREE.HemisphereLight(0xd5efff, 0x55803c, 0.6);
  scene3.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xfff2d0, 0.85);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = -1400; sc.right = 1400; sc.top = 1400; sc.bottom = -1400;
  sc.near = 100; sc.far = 5000;
  sunLight.shadow.bias = -0.0004;
  scene3.add(sunLight);
  scene3.add(sunLight.target);

  const skirt = new THREE.Mesh(
    cachedGeo('skirt', () => { const g = new THREE.PlaneGeometry(18000, 18000); g.userData.shared = true; return g; }),
    lambMat('#2f5d23'));
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.set(WORLD / 2, -4, WORLD / 2);
  scene3.add(skirt);
}

function resize3D(){
  if(!renderer3) return;
  renderer3.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer3.setSize(VW, VH, false);
  camera3.aspect = VW / VH;
  camera3.updateProjectionMatrix();
}

/* ---------- dan i noć ---------- */
function applyDayNight(gt){
  if(!scene3) return;
  const k = 0.5 + 0.5 * Math.cos((gt % CFG.dayCycle) / CFG.dayCycle * TAU);
  sunLight.intensity = 0.1 + 0.78 * k;
  hemiLight.intensity = 0.13 + 0.49 * k;
  scene3.background.copy(DAY_SKY.night).lerp(DAY_SKY.day, k);
  scene3.fog.color.copy(scene3.background);
  sunLight.color.copy(DAY_SKY.sunNight).lerp(DAY_SKY.sunDay, k);
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

  const segs = 80;
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
}

/* ---------- šuma (instancirana, prati visinu) ---------- */
function buildTrees3D(){
  if(treesGroup){ scene3.remove(treesGroup); disposeGroup(treesGroup); }
  treesGroup = new THREE.Group();
  const deciduous = trees.filter(t => t.kind === '🌳');
  const pines = trees.filter(t => t.kind === '🌲');
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  const trunkGeo = new THREE.CylinderGeometry(6, 9, 46, 6);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x8b5a2b }), trees.length);
  trunks.castShadow = true;
  trees.forEach((t, i) => {
    const gh = groundHeight(t.x, t.y);
    dummy.position.set(t.x, gh + 21, t.y);
    dummy.rotation.set(0, (t.x * 13 + t.y * 7) % 6.28, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
  });

  const ballGeo = new THREE.SphereGeometry(1, 9, 7);
  const balls = new THREE.InstancedMesh(ballGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, deciduous.length));
  balls.castShadow = true;
  deciduous.forEach((t, i) => {
    const gh = groundHeight(t.x, t.y);
    const s = t.size * 0.62;
    dummy.position.set(t.x, gh + 14 + t.size * 0.78, t.y);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(s, s * 0.9, s);
    dummy.updateMatrix();
    balls.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.31 + ((t.x * 31 + t.y * 17) % 100) / 100 * 0.05, 0.55, 0.36 + ((t.x * 7 + t.y * 3) % 100) / 100 * 0.1);
    balls.setColorAt(i, col);
  });
  if(balls.instanceColor) balls.instanceColor.needsUpdate = true;

  const coneGeo = new THREE.ConeGeometry(1, 1, 8);
  const cones = new THREE.InstancedMesh(coneGeo, new THREE.MeshLambertMaterial({ color: 0x2c8a44 }), Math.max(1, pines.length));
  cones.castShadow = true;
  pines.forEach((t, i) => {
    const gh = groundHeight(t.x, t.y);
    dummy.position.set(t.x, gh + 14 + t.size * 0.72, t.y);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(t.size * 0.55, t.size * 1.45, t.size * 0.55);
    dummy.updateMatrix();
    cones.setMatrixAt(i, dummy.matrix);
  });

  treesGroup.add(trunks, balls, cones);
  scene3.add(treesGroup);
}

/* ---------- statika: fontane ---------- */
function buildStatic3D(){
  if(staticGroup){ scene3.remove(staticGroup); disposeGroup(staticGroup); }
  staticGroup = new THREE.Group();
  for(let team = 0; team < 2; team++){
    const f = FOUNTAIN[team];
    const gh = groundHeight(f.x, f.y);
    const pool = new THREE.Mesh(
      cachedGeo('pool', () => { const g = new THREE.CylinderGeometry(118, 128, 18, 24); g.userData.shared = true; return g; }),
      lambMat('#cfeefe'));
    pool.position.set(f.x, gh + 9, f.y);
    pool.receiveShadow = true;
    staticGroup.add(pool);
    const rim = new THREE.Mesh(
      cachedGeo('rim', () => { const g = new THREE.TorusGeometry(122, 7, 8, 28); g.userData.shared = true; return g; }),
      lambMat(TEAM_COLOR[team]));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(f.x, gh + 18, f.y);
    staticGroup.add(rim);
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
  const g = new THREE.RingGeometry(player.atkRange - 4, player.atkRange, 48);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1,
    side: THREE.DoubleSide, depthWrite: false });
  playerRing3 = new THREE.Mesh(g, m);
  playerRing3.rotation.x = -Math.PI / 2;
  scene3.add(playerRing3);
}

/* ---------- indikatori ciljanja moći ---------- */
function ensureCastInd(){
  if(castInd) return castInd;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.965, 1, 56),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene3.add(ring);
  const aoe = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
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
  if(!pendingCast || !player || player.dead){
    ci.ring.visible = ci.aoe.visible = ci.line.visible = false;
    return;
  }
  const def = player.abilities[pendingCast.i].def;
  const cr = def.castRange || 600;
  const pgh = groundHeight(player.x, player.y);
  ci.ring.visible = true;
  ci.ring.position.set(player.x, pgh + 2.2, player.y);
  ci.ring.scale.set(cr, cr, 1);
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
}

/* ---------- modeli jedinica ---------- */
function buildHeroMesh(u){
  const g = new THREE.Group();
  const ud = g.userData;
  const ring = new THREE.Mesh(
    cachedGeo('heroRing', () => { const r = new THREE.TorusGeometry(27, 4, 8, 26); r.userData.shared = true; return r; }),
    basicMat(u.isPlayer ? '#fde047' : TEAM_COLOR[u.team]));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 3;
  g.add(ring);
  const body = new THREE.Mesh(
    cachedGeo('heroBody', () => { const b = new THREE.CapsuleGeometry(16, 24, 4, 12); b.userData.shared = true; return b; }),
    lambMat(TEAM_LIGHT[u.team]));
  body.position.y = 33;
  body.castShadow = true;
  g.add(body);
  const head = emojiSprite(u.emoji, 52);
  head.position.y = 78;
  g.add(head);
  const shield = new THREE.Mesh(
    cachedGeo('heroShield', () => { const s = new THREE.SphereGeometry(36, 14, 10); s.userData.shared = true; return s; }),
    new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.3, depthWrite: false }));
  shield.position.y = 36;
  shield.visible = false;
  g.add(shield);
  const statusSpr = emojiSprite('⭐', 30);
  statusSpr.position.y = 110;
  statusSpr.visible = false;
  g.add(statusSpr);
  ud.ring = ring; ud.body = body; ud.head = head; ud.shield = shield; ud.statusSpr = statusSpr;
  ud.statusCh = '';
  return g;
}
function buildCreepMesh(u){
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    cachedGeo('creepBody' + u.r, () => { const b = new THREE.SphereGeometry(u.r, 10, 8); b.userData.shared = true; return b; }),
    lambMat(TEAM_LIGHT[u.team]));
  body.position.y = u.r + 2;
  body.scale.y = 0.92;
  body.castShadow = true;
  g.add(body);
  const eyeGeo = cachedGeo('eye', () => { const e = new THREE.SphereGeometry(3, 6, 5); e.userData.shared = true; return e; });
  const eyeMat = basicMat('#1f2937');
  const e1 = new THREE.Mesh(eyeGeo, eyeMat);
  e1.position.set(u.r * 0.66, u.r + 6, -u.r * 0.36);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat);
  e2.position.set(u.r * 0.66, u.r + 6, u.r * 0.36);
  g.add(e1, e2);
  if(u.rangedCreep){
    const hat = new THREE.Mesh(
      cachedGeo('hat', () => { const h = new THREE.ConeGeometry(10, 20, 8); h.userData.shared = true; return h; }),
      lambMat(TEAM_COLOR[u.team]));
    hat.position.y = u.r * 2 + 10;
    hat.castShadow = true;
    g.add(hat);
  }
  if(u.siege){
    const helm = new THREE.Mesh(
      cachedGeo('helm', () => { const h = new THREE.CylinderGeometry(9, 11, 10, 8); h.userData.shared = true; return h; }),
      lambMat(TEAM_DARK[u.team]));
    helm.position.y = u.r * 2 + 6;
    g.add(helm);
  }
  return g;
}
function buildNeutralMesh(u){
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    cachedGeo('creepBody' + u.r, () => { const b = new THREE.SphereGeometry(u.r, 10, 8); b.userData.shared = true; return b; }),
    lambMat(TEAM_LIGHT[TEAM_NEUTRAL]));
  body.position.y = u.r + 2;
  body.scale.y = 0.92;
  body.castShadow = true;
  g.add(body);
  const head = emojiSprite(u.emoji, Math.max(34, u.r * 2.2));
  head.position.y = u.r * 2 + 20;
  g.add(head);
  if(u.boss){
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(u.r + 14, 5, 8, 26),
      basicMat('#f59e0b'));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 3;
    g.add(ring);
  }
  return g;
}
function buildTowerMesh(u){
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    cachedGeo('towerBase', () => { const b = new THREE.CylinderGeometry(30, 40, 100, 10); b.userData.shared = true; return b; }),
    lambMat('#e8e0cf'));
  base.position.y = 50;
  base.castShadow = true;
  g.add(base);
  const band = new THREE.Mesh(
    cachedGeo('towerBand', () => { const b = new THREE.CylinderGeometry(33, 33, 14, 10); b.userData.shared = true; return b; }),
    lambMat(TEAM_LIGHT[u.team]));
  band.position.y = 64;
  g.add(band);
  const roof = new THREE.Mesh(
    cachedGeo('towerRoof', () => { const r = new THREE.ConeGeometry(38, 44, 10); r.userData.shared = true; return r; }),
    lambMat(TEAM_COLOR[u.team]));
  roof.position.y = 122;
  roof.castShadow = true;
  g.add(roof);
  return g;
}
function buildAncientMesh(u){
  const g = new THREE.Group();
  const ud = g.userData;
  const ped = new THREE.Mesh(
    cachedGeo('ancPed', () => { const p = new THREE.CylinderGeometry(64, 76, 24, 12); p.userData.shared = true; return p; }),
    lambMat('#9aa3ad'));
  ped.position.y = 12;
  ped.castShadow = true;
  g.add(ped);
  const crystal = new THREE.Mesh(
    cachedGeo('ancCrystal', () => { const c = new THREE.IcosahedronGeometry(46, 0); c.userData.shared = true; return c; }),
    new THREE.MeshPhongMaterial({ color: TEAM_LIGHT[u.team], emissive: TEAM_COLOR[u.team],
      emissiveIntensity: 0.45, shininess: 90, flatShading: true }));
  crystal.position.y = 86;
  crystal.castShadow = true;
  g.add(crystal);
  const crown = emojiSprite('👑', 64);
  crown.position.y = 160;
  g.add(crown);
  const shield = new THREE.Mesh(
    cachedGeo('ancShield', () => { const s = new THREE.SphereGeometry(95, 18, 12); s.userData.shared = true; return s; }),
    new THREE.MeshBasicMaterial({ color: 0xcfeefe, transparent: true, opacity: 0.22, depthWrite: false }));
  shield.position.y = 70;
  g.add(shield);
  ud.crystal = crystal; ud.shield = shield;
  return g;
}
function ensureUnitMesh(u){
  let g = meshByUnit.get(u);
  if(g) return g;
  if(u.kind === 'hero') g = buildHeroMesh(u);
  else if(u.kind === 'creep') g = buildCreepMesh(u);
  else if(u.kind === 'neutral') g = buildNeutralMesh(u);
  else if(u.kind === 'tower') g = buildTowerMesh(u);
  else g = buildAncientMesh(u);
  meshByUnit.set(u, g);
  scene3.add(g);
  return g;
}

/* ---------- zone, projektili, oznake, munje, rune ---------- */
function buildZoneMesh(z){
  const g = new THREE.Group();
  const ud = g.userData;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(4, z.r - 7), z.r, 40),
    new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 2.4;
  g.add(ring);
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(z.r, 36),
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
      cachedGeo('proj' + Math.round(p.r), () => { const b = new THREE.SphereGeometry(Math.max(4, p.r), 8, 6); b.userData.shared = true; return b; }),
      basicMat(p.color));
    g.add(ball);
  }
  const glow = new THREE.Sprite(glowMat(p.color));
  glow.scale.set(p.r * 7 + 20, p.r * 7 + 20, 1);
  g.add(glow);
  g.position.set(p.x, groundHeight(p.x, p.y) + 34, p.y);
  return g;
}
function buildMarkerMesh(m){
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(3, m.r * 0.72), m.r, 28),
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

/* ---------- glavna sinkronizacija ---------- */
function pickStatusEmoji(u){
  if(u.status.stun > 0) return '⭐';
  if(u.status.invisT > 0) return '👻';
  if(u.status.rootT > 0) return '🌱';
  if(u.status.slowT > 0) return '❄️';
  if(u.status.dmgMulT > 0) return '⚔️';
  return '';
}

function syncScene(tAnim){
  const present = new Set(units);
  for(const key of meshByUnit.keys()){
    if(!present.has(key)){
      const g = meshByUnit.get(key);
      scene3.remove(g);
      disposeGroup(g);
      meshByUnit.delete(key);
    }
  }
  const walkBob = (u) => (gameTime - (u.lastMoveT || -9) < 0.12) ? Math.abs(Math.sin(tAnim * 9 + u.id)) * 5 : 0;
  for(const u of units){
    if(u.removeMe) continue;
    const g = ensureUnitMesh(u);
    g.position.set(u.x, groundHeight(u.x, u.y) + walkBob(u), u.y);
    const seen = seenByPlayer(u);   // magla rata: skriveni neprijatelji se ne crtaju
    if(u.kind === 'hero'){
      g.visible = !u.dead && seen;
      if(u.dead || !seen) continue;
      g.rotation.y = -(u.dir || 0);
      const ud = g.userData;
      ud.shield.visible = u.status.shieldT > 0;
      const ch = pickStatusEmoji(u);
      if(ch !== ud.statusCh){
        ud.statusCh = ch;
        if(ch){ ud.statusSpr.material.map = makeEmojiTexture(ch); ud.statusSpr.material.needsUpdate = true; }
        ud.statusSpr.visible = !!ch;
      }
      if(ud.statusSpr.visible) ud.statusSpr.position.y = 110 + Math.sin(tAnim * 6) * 5;
      ud.head.position.y = 78 + Math.sin(tAnim * 2.4 + u.id) * 2.5;
      const invis = u.status.invisT > 0;
      ud.body.material = u.flash > 0 ? lambMat('#ffffff') : (invis ? invisMat(u.team) : lambMat(TEAM_LIGHT[u.team]));
      ud.head.material.opacity = invis ? 0.55 : 1;
    }
    else if(u.kind === 'creep'){
      g.visible = seen;
      g.rotation.y = -(u.dir || 0);
      g.children[0].material = u.flash > 0 ? lambMat('#ffffff') : lambMat(TEAM_LIGHT[u.team]);
    }
    else if(u.kind === 'neutral'){
      g.visible = seen;
      g.rotation.y = -(u.dir || 0);
      g.children[0].material = u.flash > 0 ? lambMat('#ffffff') : lambMat(TEAM_LIGHT[TEAM_NEUTRAL]);
    }
    else if(u.kind === 'ancient'){
      const ud = g.userData;
      ud.crystal.rotation.y = tAnim * 0.8;
      ud.crystal.position.y = 86 + Math.sin(tAnim * 2) * 6;
      ud.shield.visible = u.invuln;
      if(ud.shield.visible){
        const s = 1 + Math.sin(tAnim * 3) * 0.03;
        ud.shield.scale.set(s, s, s);
      }
    }
    else if(u.kind === 'tower'){
      if(u.flash > 0) g.children[0].material = lambMat('#ffffff');
      else g.children[0].material = lambMat('#e8e0cf');
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
    }
  });

  syncMapped(projectiles, projMeshes, buildProjMesh, (p, g) => {
    g.position.set(p.x, groundHeight(p.x, p.y) + 34, p.y);
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
  });

  if(playerRing3 && player){
    playerRing3.visible = !player.dead;
    playerRing3.position.set(player.x, groundHeight(player.x, player.y) + 1.4, player.y);
  }

  syncCastIndicator();
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
  for(const map of [zoneMeshes, projMeshes, markerMeshes, lineMeshes, runeMeshes]){
    for(const [k, m] of map){ scene3.remove(m); if(m.traverse) disposeGroup(m); }
    map.clear();
  }
  if(playerRing3){ scene3.remove(playerRing3); playerRing3 = null; }
  if(castInd){
    castInd.ring.visible = castInd.aoe.visible = castInd.line.visible = false;
  }
}
