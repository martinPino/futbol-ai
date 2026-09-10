/* TEAM MODELS — todos los jugadores y el árbitro usan el modelo real (base: FBX de Messi)
   con camiseta procedural pintada sobre su mapa UV, piel/pelo variados y esqueleto clonado. */
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const DIR = './assets/players/messi/';
const TL = new THREE.TextureLoader();
const texCache = new Map();
function tex(name, srgb = true) {
  if (!texCache.has(name)) {
    const t = TL.load(DIR + name);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    texCache.set(name, t);
  }
  return texCache.get(name);
}
let basePromise = null;
export function loadBase() {
  if (!basePromise) basePromise = new FBXLoader().loadAsync(DIR + 'model.fbx').then(raw => {
    raw.animations.length = 0;
    const box = new THREE.Box3().setFromObject(raw);
    raw.userData.box = box;
    return raw;
  });
  return basePromise;
}

/* ---- camiseta sobre el UV del modelo (coordenadas del atlas 2048 → canvas 1024) ---- */
const hex = c => '#' + c.toString(16).padStart(6, '0');
const kitCache = new Map();
export function kitTexture(kit, number) {
  const key = JSON.stringify(kit) + '#' + number;
  if (kitCache.has(key)) return kitCache.get(key);
  const S = 1024, k = S / 2048, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const A = kit.solid !== null && kit.solid !== undefined ? hex(kit.solid) : hex(kit.stripeA);
  const B = kit.solid !== null && kit.solid !== undefined ? hex(kit.solid) : hex(kit.stripeB);
  const trim = hex(kit.solid !== null && kit.solid !== undefined ? 0x17181c : kit.stripeB);
  const shorts = hex(kit.shorts), socks = hex(kit.socks);
  c.fillStyle = A; c.fillRect(0, 0, S, S);
  const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x * k, y * k, w * k, h * k); };
  const stripes = (x, y, w, h) => {
    rect(x, y, w, h, A);
    if (A === B) return;
    const n = 4, sw = w / n;
    for (let i = 0; i < n; i += 2) rect(x + i * sw, y, sw, h, B);
  };
  stripes(660, 0, 610, 1830);            // tronco (espalda arriba, frente abajo)
  rect(0, 100, 660, 500, A); rect(1270, 100, 650, 500, A);      // mangas lisas (color principal)
  rect(455, 660, 220, 460, B === A ? A : B); rect(1230, 660, 240, 460, B === A ? A : B);   // paneles laterales del tronco
  rect(660, 0, 610, 60, trim);           // cuello
  rect(0, 100, 660, 40, trim); rect(1270, 100, 650, 40, trim);   // puños
  rect(640, 1830, 660, 90, trim);        // bajo
  rect(0, 1100, 630, 820, shorts); rect(1290, 1100, 640, 820, shorts);   // pantalón
  rect(0, 600, 360, 500, socks); rect(1570, 600, 360, 500, socks);      // medias
  // dorsal en la espalda (el UV de la espalda está invertido)
  if (number !== null && number !== undefined) {
    rect(760, 380, 410, 440, A);          // recuadro liso para el dorsal
    c.save(); c.translate(965 * k, 590 * k); c.rotate(Math.PI);
    c.font = `900 ${Math.round(300 * k)}px "Arial Narrow", Arial, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 8 * k; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.strokeText(String(number), 0, 0);
    c.fillStyle = A === '#17181c' || A === '#1d1e24' ? '#f4f6f8' : trim === A ? '#f4f6f8' : trim; c.fillText(String(number), 0, 0);
    c.restore();
    c.save(); c.translate(160 * k, 1600 * k); c.rotate(-Math.PI / 2);
    c.font = `900 ${Math.round(110 * k)}px Arial, sans-serif`; c.fillStyle = '#f4f6f8'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(number), 0, 0); c.restore();
  }
  // trama de tejido
  c.globalAlpha = 0.06; c.fillStyle = '#000';
  for (let y = 0; y < S; y += 3) c.fillRect(0, y, S, 1);
  c.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;   // flipY por defecto, igual que uniform.png
  kitCache.set(key, t);
  return t;
}

const RX = {
  hipL: /(L_Thigh|LeftUpLeg)/i, kneeL: /(L_Calf|LeftLeg_)/i,
  hipR: /(R_Thigh|RightUpLeg)/i, kneeR: /(R_Calf|RightLeg_)/i,
  armL: /(L_UpperArm|LeftArm_)/i, foreL: /(L_Forearm|LeftForeArm)/i,
  armR: /(R_UpperArm|RightArm_)/i, foreR: /(R_Forearm|RightForeArm)/i,
  handL: /(L_Hand$|LeftHand$|L_Hand\b)/i, handR: /(R_Hand$|RightHand$|R_Hand\b)/i,
  spine: /(Bip01_Spine1$|Spine1_02)/i,
  head: /(Head1$|Head_05)/i,
};
const SKINS = [0xffffff, 0xf2dccb, 0xe0c2a8, 0xcfa88a, 0xb98c6e, 0x9c7358];
const HAIRS = [0xffffff, 0xb8a890, 0x7a5a3c, 0x3a2a1c, 0x9a7a55];

/* crea un jugador realista: { root, applyJoints, aimArm, handWorld, setKit } */
export async function makeRealPlayer({ kit, number = null, skin = 0, hair = 0, height = 1.78, variant = 0 }) {
  const base = await loadBase();
  const raw = SkeletonUtils.clone(base);
  const box = base.userData.box;
  const size = box.getSize(new THREE.Vector3());
  const s = height / size.y;
  raw.scale.setScalar(s);
  raw.position.y = -box.min.y * s;
  raw.position.x = -((box.min.x + box.max.x) / 2) * s;
  raw.position.z = -((box.min.z + box.max.z) / 2) * s;
  const kitTex = kitTexture(kit, number);
  const skinCol = new THREE.Color(SKINS[skin % SKINS.length]);
  const hairCol = new THREE.Color(HAIRS[hair % HAIRS.length]);
  raw.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const out = list.map(m => {
      const n = m.name;
      let map = null, normal = null, color = 0xffffff, alpha = false;
      if (/^Kit_/.test(n)) { map = kitTex; }
      else if (n === 'Arms & Hands') { map = tex('arm.png'); color = skinCol; }
      else if (n === 'Legs') { map = tex('legs.png'); color = skinCol; }
      else if (n === 'face') { map = tex('face.png'); color = skinCol; }
      else if (n === 'eyes') map = tex('eye_color.png');
      else if (/hair/i.test(n)) { map = tex('hair.png'); alpha = true; color = hairCol; }
      else if (n === 'Boots') { map = tex('boot.png'); normal = tex('Boots_Normal.png', false); color = variant % 3 === 0 ? 0xffffff : variant % 3 === 1 ? 0x2a2a30 : 0xd0d4dc; }
      else if (/Default/.test(n)) { color = 0x1a1410; alpha = true; }
      return new THREE.MeshStandardMaterial({
        name: n, color, map, normalMap: normal, roughness: 0.74, metalness: 0.02,
        transparent: alpha, alphaTest: alpha ? 0.4 : 0, side: alpha ? THREE.DoubleSide : THREE.FrontSide, envMapIntensity: 0.7,
      });
    });
    o.material = Array.isArray(o.material) ? out : out[0];
    if (/RootNode/i.test(o.name) || /Object0/i.test(o.name)) o.visible = false;
  });
  const root = new THREE.Group();
  root.name = 'REAL_PLAYER';
  root.add(raw);
  root.updateMatrixWorld(true);

  const B = {}, rest = {}, ax = {}, az = {};
  const found = new Set();
  raw.traverse(o => {
    if (!o.isBone) return;
    for (const k in RX) {
      if (found.has(k) || !RX[k].test(o.name)) continue;
      found.add(k); B[k] = o; rest[k] = o.quaternion.clone();
    }
  });
  // ejes de flexión en espacio local del hueso: X mundo (adelante/atrás) y el eje perpendicular al hueso y a X
  // (abducción), orientado para que un ángulo positivo abra el brazo hacia fuera (lado del hombro)
  const _wq = new THREE.Quaternion(), _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3();
  const outwardOf = k => k.endsWith('L') ? 1 : k.endsWith('R') ? -1 : 0;   // L = +x del modelo, R = -x
  for (const k in B) {
    const o = B[k];
    o.getWorldQuaternion(_wq); const inv = _wq.clone().invert();
    ax[k] = new THREE.Vector3(1, 0, 0).applyQuaternion(inv).normalize();
    let zw = new THREE.Vector3(0, 0, 1);
    const child = o.children.find(c => c.isBone);
    if (child && outwardOf(k)) {
      o.getWorldPosition(_p0); child.getWorldPosition(_p1);
      const dir = _p1.clone().sub(_p0).normalize();
      zw = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), dir).normalize();
      if (zw.lengthSq() < 0.5) zw.set(0, 0, 1);
    }
    az[k] = zw.applyQuaternion(inv).normalize();
  }
  // sentido empírico de la flexión de codo/rodilla (X): +0.3 debe llevar el extremo hacia atrás (-z)
  const CH = { foreL: 'handL', foreR: 'handR', kneeL: null, kneeR: null };
  for (const k of ['foreL', 'foreR', 'kneeL', 'kneeR']) {
    const o = B[k]; if (!o) continue;
    const child = (CH[k] && B[CH[k]]) || o.children.find(c => c.isBone && c !== o && c.name !== o.name);
    if (!child) continue;
    const saved = o.quaternion.clone();
    root.updateMatrixWorld(true); child.getWorldPosition(_p0);
    o.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(ax[k], 0.3));
    root.updateMatrixWorld(true); child.getWorldPosition(_p1);
    o.quaternion.copy(saved);
    const wantBack = k.startsWith('fore') ? -1 : -1;          // codo flexiona hacia delante (mano sube al frente) → -J.el; rodilla hacia atrás
    if (k.startsWith('fore') ? (_p1.z - _p0.z < 0) : (_p1.z - _p0.z > 0)) ax[k].negate();
  }
  root.updateMatrixWorld(true);
  /* orientación absoluta de brazos y piernas: se lleva el hueso a la dirección deseada en mundo,
     independiente de la pose de reposo del FBX (que difiere entre lados) */
  const _pw = new THREE.Quaternion(), _cur = new THREE.Vector3(), _des = new THREE.Vector3(), _rot = new THREE.Quaternion(), _pi = new THREE.Quaternion();
  const NEXT = { armL: 'foreL', armR: 'foreR', hipL: 'kneeL', hipR: 'kneeR' };
  const aimBone = (k, desiredLocal) => {
    const o = B[k], child = B[NEXT[k]]; if (!o || !child) return;
    o.quaternion.copy(rest[k]);
    o.updateWorldMatrix(true, true);
    o.getWorldPosition(_p0); child.getWorldPosition(_p1);
    _cur.copy(_p1).sub(_p0).normalize();
    _des.copy(desiredLocal).applyQuaternion(root.getWorldQuaternion(_pw)).normalize();
    _rot.setFromUnitVectors(_cur, _des);
    o.parent.getWorldQuaternion(_pi).invert();
    o.quaternion.premultiply(_pi.clone().multiply(_rot).multiply(_pi.clone().invert()));
  };
  const _X = new THREE.Vector3(1, 0, 0), _Zc = new THREE.Vector3(0, 0, 1);
  const dirFrom = (flex, ab, s) => new THREE.Vector3(0, -1, 0).applyAxisAngle(_X, -flex).applyAxisAngle(_Zc, -s * ab);
  // en reposo el FBX lleva los brazos ligeramente hacia dentro: se compensa midiendo la inclinación real
  const restIn = {};
  for (const s of ['L', 'R']) {
    const a = B['arm' + s], f = B['fore' + s];
    restIn[s] = 0;
    if (a && f) { a.getWorldPosition(_p0); f.getWorldPosition(_p1); const d = _p1.sub(_p0); restIn[s] = Math.atan2(-(d.x * outwardOf('arm' + s)), -d.y); }
  }
  const q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  const set = (k, angX, angZ = 0) => {
    const b = B[k]; if (!b) return;
    b.quaternion.copy(rest[k]);
    if (angX) { q.setFromAxisAngle(ax[k], angX); b.quaternion.multiply(q); }
    if (angZ) { q2.setFromAxisAngle(az[k], angZ); b.quaternion.multiply(q2); }
  };
  function applyJoints(J) {
    aimBone('hipL', dirFrom(J.hipL, J.hipAbL, -1)); aimBone('hipR', dirFrom(J.hipR, J.hipAbR, 1));
    set('kneeL', J.kneeL); set('kneeR', J.kneeR);
    aimBone('armL', dirFrom(J.shXL, 0.12 + J.shZL, -1)); aimBone('armR', dirFrom(J.shXR, 0.12 + J.shZR, 1));
    set('foreL', -J.elL); set('foreR', -J.elR);
    set('foreL', -J.elL); set('foreR', -J.elR);
    set('spine', J.lean, J.side);
    set('head', J.head, 0);
  }
  /* orienta el brazo hacia un punto del mundo (corrección en espacio mundo, 2 iteraciones) */
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3(), _pq = new THREE.Quaternion(), _r = new THREE.Quaternion();
  function aimArm(side, target, el = 0.1) {
    const arm = B['arm' + side], fore = B['fore' + side];
    if (!arm || !fore) return 9;
    set('fore' + side, -el);
    for (let i = 0; i < 2; i++) {
      root.updateMatrixWorld(true);
      arm.getWorldPosition(_a); fore.getWorldPosition(_b);
      _b.sub(_a).normalize(); _t.copy(target).sub(_a);
      const dist = _t.length(); _t.normalize();
      _r.setFromUnitVectors(_b, _t);
      arm.parent.getWorldQuaternion(_pq);
      // q_local' = pq⁻¹ · r · pq · q_local
      arm.quaternion.premultiply(_pq.clone().invert().multiply(_r).multiply(_pq));
      if (i === 1) return dist;
    }
    return 9;
  }
  function handWorld(side, out) {
    const h = B['hand' + side] || B['fore' + side];
    return h ? h.getWorldPosition(out) : out.set(0, 0, 0);
  }
  return { root, applyJoints, aimArm, handWorld, bones: B };
}
