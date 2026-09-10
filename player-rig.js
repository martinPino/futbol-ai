/* PLAYER RIG — maniquí articulado (SkinnedMesh) + motor de animación por articulaciones
   Convenciones anatómicas (radianes):  hip + adelante · knee + flexión · ankle + punta abajo
   shX + brazo adelante · shZ + brazo afuera · el + flexión codo · lean + tronco adelante · head + mirar abajo
   Lado L = +x local (izquierda del jugador, que mira a +z) · R = -x local */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildFigure, numberTexture } from './football-kit-models.js';

export const REST_POSE = { lean: 0, hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, shXL: 0, shXR: 0, shZ: 0.2, elL: 0, elR: 0, head: 0 };
const SHZ0 = 0.2;
const BI = { root: 0, pelvis: 1, spine: 2, head: 3, shoulderL: 4, foreL: 5, handL: 6, shoulderR: 7, foreR: 8, handR: 9, thighL: 10, shinL: 11, footL: 12, thighR: 13, shinR: 14, footR: 15 };
const sm = t => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* la figura procedural etiqueta "_R" el lado +x, que anatómicamente es la izquierda → se intercambia */
function assignWeights(geo, name) {
  const pos = geo.attributes.position, n = pos.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const side = /_R$/.test(name) ? 'L' : /_L$/.test(name) ? 'R' : '';
  const base = name.replace(/_(L|R)$/, '');
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i);
    let a = 'spine', b = 'spine', t = 0;
    switch (base) {
      case 'Pierna': a = 'thigh' + side; b = 'shin' + side; t = 1 - sm((y - 0.46) / 0.08); break;
      case 'Short': a = 'pelvis'; b = 'thigh' + side; t = 1 - sm((y - 0.86) / 0.1); break;
      case 'Media': a = b = 'shin' + side; break;
      case 'Bota': a = b = 'foot' + side; break;
      case 'Pelvis': a = b = 'pelvis'; break;
      case 'Camiseta': a = 'pelvis'; b = 'spine'; t = sm((y - 0.98) / 0.1); break;
      case 'Bajo_Camiseta': a = 'pelvis'; b = 'spine'; t = 0.5; break;
      case 'Dorsal': a = b = 'spine'; break;
      case 'Cuello_Camiseta': a = 'spine'; b = 'head'; t = 0.35; break;
      case 'Cuello': a = 'spine'; b = 'head'; t = sm((y - 1.46) / 0.12); break;
      case 'Craneo': case 'Mandibula': case 'Pelo': a = b = 'head'; break;
      case 'Brazo': a = 'shoulder' + side; b = 'fore' + side; t = 1 - sm((y - 1.096) / 0.08); break;
      case 'Deltoide': case 'Manga': a = b = 'shoulder' + side; break;
      case 'Mano': a = b = 'hand' + side; break;
    }
    si[i * 4] = BI[a]; si[i * 4 + 1] = BI[b]; sw[i * 4] = 1 - t; sw[i * 4 + 1] = t;
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
}

/* plantilla: geometría skinneada por material (compartida por todos los jugadores del mismo kit) */
export function buildRigTemplate(kit) {
  const fig = buildFigure({ ...kit, pose: REST_POSE, number: null, name: 'RIG' });
  fig.updateWorldMatrix(true, true);
  const byMat = new Map();
  fig.traverse(o => {
    if (!o.isMesh) return;
    let geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    for (const a of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(a)) geo.deleteAttribute(a);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    assignWeights(geo, o.name);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(geo);
  });
  const parts = [];
  for (const [mat, geos] of byMat) {
    const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
    if (merged) parts.push({ geo: merged, mat });
  }
  // dorsal: plano skinneado al tronco (textura pequeña por jugador)
  const dg = new THREE.PlaneGeometry(0.19, 0.24).toNonIndexed();
  dg.rotateY(Math.PI); dg.translate(0, 1.27, -0.13);
  const dn = dg.attributes.position.count;
  const dsi = new Uint16Array(dn * 4).fill(0), dsw = new Float32Array(dn * 4);
  for (let i = 0; i < dn; i++) { dsi[i * 4] = BI.spine; dsw[i * 4] = 1; }
  dg.setAttribute('skinIndex', new THREE.BufferAttribute(dsi, 4));
  dg.setAttribute('skinWeight', new THREE.BufferAttribute(dsw, 4));
  return { parts, dorsalGeo: dg };
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion();
const AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);

/* instancia: huesos + SkinnedMesh por material (bindMode attached → el grupo se mueve libremente) */
export function instantiateRig(tpl, { number = null } = {}) {
  const bones = {}, list = [];
  const mk = (name, parent, x, y, z) => {
    const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z);
    if (parent) bones[parent].add(b);
    bones[name] = b; list[BI[name]] = b;
  };
  mk('root', null, 0, 0, 0);
  mk('pelvis', 'root', 0, 0.94, 0);
  mk('spine', 'pelvis', 0, 0.14, 0);
  mk('head', 'spine', 0, 0.42, 0);
  const sb = Math.sin(SHZ0), cb = Math.cos(SHZ0);
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    mk('shoulder' + side, 'spine', s * 0.195, 0.35, 0);
    mk('fore' + side, 'shoulder' + side, s * sb * 0.3, -cb * 0.3, 0);
    mk('hand' + side, 'fore' + side, s * sb * 0.27, -cb * 0.27, 0);
    mk('thigh' + side, 'pelvis', s * 0.095, 0, 0);
    mk('shin' + side, 'thigh' + side, 0, -0.44, 0);
    mk('foot' + side, 'shin' + side, 0, -0.42, 0);
  }
  const group = new THREE.Group();
  group.add(bones.root);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  const meshes = [];
  const addSkinned = (geo, mat) => {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.castShadow = true; m.frustumCulled = false;
    group.add(m);
    m.bind(skeleton);
    meshes.push(m);
  };
  for (const { geo, mat } of tpl.parts) addSkinned(geo, mat);
  if (number !== null) addSkinned(tpl.dorsalGeo, new THREE.MeshStandardMaterial({
    map: numberTexture(number), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1,
  }));

  function applyJoints(J) {
    const b = bones;
    b.spine.rotation.set(J.lean, J.twist, J.side);
    b.head.rotation.set(J.head, J.headYaw, 0);
    b.pelvis.position.y = 0.94 + J.pelvisY;
    for (const [side, s] of [['L', 1], ['R', -1]]) {
      b['thigh' + side].rotation.set(-J['hip' + side], 0, s * J['hipAb' + side]);
      b['shin' + side].rotation.set(J['knee' + side], 0, 0);
      b['foot' + side].rotation.set(J['ankle' + side], 0, 0);
      _qa.setFromAxisAngle(AZ, s * J['shZ' + side]);
      _qb.setFromAxisAngle(AX, -J['shX' + side]);
      _qc.setFromAxisAngle(AZ, -s * SHZ0);
      b['shoulder' + side].quaternion.copy(_qa).multiply(_qb).multiply(_qc);
      b['fore' + side].rotation.set(-J['el' + side], 0, 0);
    }
  }
  /* IK analítica del brazo: orienta el hombro hacia un punto del mundo; devuelve la distancia hombro→objetivo */
  function solveArm(side, target, el = 0.1) {
    const s = side === 'L' ? 1 : -1;
    const sh = bones['shoulder' + side];
    sh.getWorldPosition(_v1);
    sh.parent.getWorldQuaternion(_q1).invert();
    _v2.copy(target).sub(_v1);
    const dist = _v2.length();
    _v2.normalize().applyQuaternion(_q1);
    const shX = Math.asin(clamp(_v2.z, -1, 1));
    const shZ = s * Math.atan2(_v2.x, -_v2.y);
    _qa.setFromAxisAngle(AZ, s * shZ); _qb.setFromAxisAngle(AX, -shX); _qc.setFromAxisAngle(AZ, -s * SHZ0);
    sh.quaternion.copy(_qa).multiply(_qb).multiply(_qc);
    bones['fore' + side].rotation.set(-el, 0, 0);
    return dist;
  }
  function handWorld(side, out) {
    return bones['hand' + side].getWorldPosition(out);
  }
  function setVisible(v) { for (const m of meshes) m.visible = v; }
  return { group, bones, skeleton, meshes, applyJoints, solveArm, handWorld, setVisible };
}

/* ---------- articulaciones ---------- */
export const J0 = () => ({
  lean: 0, twist: 0, side: 0, head: 0, headYaw: 0, pelvisY: 0,
  hipL: 0, hipR: 0, hipAbL: 0.05, hipAbR: 0.05, kneeL: 0.05, kneeR: 0.05, ankleL: 0, ankleR: 0,
  shXL: 0, shXR: 0, shZL: 0.16, shZR: 0.16, elL: 0.15, elR: 0.15,
});
export const JKEYS = Object.keys(J0());
export const R0 = () => ({ pitch: 0, roll: 0, drop: 0, lift: 0, shift: 0 });
const RKEYS = Object.keys(R0());
const MIRROR_NEG = new Set(['twist', 'side', 'headYaw', 'roll']);

const IDLE = {
  stand: { ...J0(), hipAbL: 0.06, hipAbR: 0.06, kneeL: 0.06, kneeR: 0.06, shXL: 0.08, shXR: 0.08, shZL: 0.2, shZR: 0.2, elL: 0.3, elR: 0.3, lean: 0.02 },
  keeper: { ...J0(), lean: 0.3, hipL: 0.5, hipR: 0.5, hipAbL: 0.22, hipAbR: 0.22, kneeL: 0.62, kneeR: 0.62, ankleL: -0.1, ankleR: -0.1, shXL: 0.45, shXR: 0.45, shZL: 0.62, shZR: 0.62, elL: 1.2, elR: 1.2, head: -0.2, pelvisY: -0.12 },
};

/* ---------- clips (lado base = derecha; se espejan con side:'L') ---------- */
const K = (t, J = {}, R = {}) => ({ t, J, R });
const clip = (dur, keys, o = {}) => ({ dur, keys, ...o });
export const CLIPS = {
  kick: clip(0.44, [
    K(0, { hipR: -0.65, kneeR: 1.15, ankleR: 0.25, hipL: 0.25, kneeL: 0.32, shXL: 0.55, shXR: -0.5, shZL: 0.45, shZR: 0.4, elL: 0.6, elR: 0.55, lean: 0.16, twist: 0.28, head: 0.25 }),
    K(0.17, { hipR: 0.5, kneeR: 0.5, ankleR: 0.55, hipL: 0.12, kneeL: 0.25, shXL: 0.8, shXR: -0.55, shZL: 0.75, shZR: 0.45, elL: 0.35, elR: 0.6, lean: -0.02, twist: 0, head: 0.3 }),
    K(0.3, { hipR: 1.35, kneeR: 0.15, ankleR: 0.7, hipL: -0.1, kneeL: 0.2, shXL: 0.4, shXR: -0.25, shZL: 0.7, shZR: 0.55, elL: 0.3, elR: 0.5, lean: -0.24, twist: -0.3, head: 0.1 }),
    K(0.44, { hipR: 0.6, kneeR: 0.55, ankleR: 0.2, hipL: 0, kneeL: 0.22, shXL: 0.1, shXR: 0, shZL: 0.3, shZR: 0.3, elL: 0.35, elR: 0.35, lean: 0.03, twist: -0.05, head: 0 }),
  ]),
  slide: clip(0.8, [
    K(0, { hipR: 0.6, kneeR: 0.7, hipL: 0.35, kneeL: 0.9, lean: 0.25, shXL: 0.5, shXR: -0.2, shZL: 0.5, shZR: 0.5, elL: 0.5, elR: 0.5, head: 0.1 }, { pitch: -0.15, drop: 0.1, shift: 0.1 }),
    K(0.16, { hipR: 0.7, kneeR: 0.08, ankleR: 0.5, hipL: 0.55, kneeL: 2.6, hipAbL: 0.45, lean: -0.15, head: 0.55, shXL: -0.7, shXR: 0.9, shZL: 0.55, shZR: 0.7, elL: 0.45, elR: 0.3, twist: 0.2 }, { pitch: -0.9, drop: 0.4, shift: 0.75 }),
    K(0.8, { hipR: 0.68, kneeR: 0.1, ankleR: 0.5, hipL: 0.55, kneeL: 2.6, hipAbL: 0.45, lean: -0.1, head: 0.5, shXL: -0.65, shXR: 0.85, shZL: 0.55, shZR: 0.7, elL: 0.45, elR: 0.3, twist: 0.2 }, { pitch: -0.9, drop: 0.4, shift: 0.75 }),
  ], { hold: true }),
  fallFront: clip(0.5, [
    K(0, { lean: 0.35, hipL: 0.5, hipR: 0.3, kneeL: 0.6, kneeR: 0.3, shXL: 1.2, shXR: 1.3, shZL: 0.5, shZR: 0.5, elL: 0.7, elR: 0.6, head: -0.3 }, { pitch: 0.45, drop: 0.02 }),
    K(0.3, { lean: 0.25, hipL: 0.35, hipR: 0.2, kneeL: 0.5, kneeR: 0.3, shXL: 1.6, shXR: 1.7, shZL: 0.7, shZR: 0.6, elL: 0.9, elR: 0.7, head: -0.5 }, { pitch: 1.35, drop: -0.04 }),
    K(0.5, { lean: 0.12, hipL: 0.15, hipR: 0.1, kneeL: 0.35, kneeR: 0.25, shXL: 1.5, shXR: 1.75, shZL: 0.8, shZR: 0.5, elL: 1.4, elR: 0.9, head: -0.6 }, { pitch: 1.44, drop: -0.06 }),
  ], { hold: true }),
  fallBack: clip(0.5, [
    K(0, { lean: -0.3, hipL: 0.5, hipR: 0.4, kneeL: 0.5, kneeR: 0.4, shXL: -0.6, shXR: -0.7, shZL: 0.6, shZR: 0.6, elL: 0.4, elR: 0.4, head: 0.4 }, { pitch: -0.5, drop: 0.05 }),
    K(0.3, { lean: -0.1, hipL: 0.6, hipR: 0.35, kneeL: 0.7, kneeR: 0.5, shXL: -0.9, shXR: -1.0, shZL: 0.9, shZR: 0.8, elL: 0.6, elR: 0.5, head: 0.5 }, { pitch: -1.3, drop: -0.02 }),
    K(0.5, { lean: 0.05, hipL: 0.45, hipR: 0.25, kneeL: 0.75, kneeR: 0.4, shXL: -0.4, shXR: -0.2, shZL: 1.3, shZR: 1.0, elL: 0.9, elR: 0.5, head: 0.55 }, { pitch: -1.42, drop: -0.06 }),
  ], { hold: true }),
  fallSide: clip(0.5, [                       // cae sobre el lado derecho (-x local)
    K(0, { lean: 0.2, side: -0.2, hipL: 0.5, hipR: 0.3, kneeL: 0.7, kneeR: 0.4, shXR: 0.4, shZR: 1.4, shXL: 0.8, shZL: 0.3, elL: 0.9, elR: 0.3, head: 0.1 }, { roll: 0.5, drop: 0.05 }),
    K(0.3, { lean: 0.3, side: -0.25, hipL: 0.7, hipR: 0.3, kneeL: 0.9, kneeR: 0.5, shXR: 0.3, shZR: 1.65, shXL: 1.0, shZL: 0.2, elL: 1.2, elR: 0.2, head: 0.15 }, { roll: 1.3, drop: -0.02 }),
    K(0.5, { lean: 0.3, side: -0.2, hipL: 0.75, hipR: 0.3, kneeL: 0.95, kneeR: 0.5, shXR: 0.2, shZR: 1.7, shXL: 1.1, shZL: 0.2, elL: 1.3, elR: 0.15, head: 0.2 }, { roll: 1.42, drop: -0.05 }),
  ], { hold: true }),
  getUp: clip(0.9, [
    K(0, { hipL: 1.7, kneeL: 2.6, hipR: 1.6, kneeR: 2.4, lean: 0.6, shXL: 1.0, shXR: 1.0, elL: 0.4, elR: 0.4, head: -0.3 }, { pitch: 0.55, roll: 0, drop: 0.5, shift: 0 }),
    K(0.5, { hipL: 1.3, kneeL: 1.4, hipR: 0.9, kneeR: 1.3, lean: 0.5, shXL: 0.6, shXR: 0.5, elL: 0.5, elR: 0.5, head: -0.1 }, { pitch: 0.25, roll: 0, drop: 0.3, shift: 0 }),
    K(0.9, { hipL: 0.1, kneeL: 0.15, hipR: 0.1, kneeR: 0.15, lean: 0.05, shXL: 0.1, shXR: 0.1, elL: 0.3, elR: 0.3, head: 0 }, { pitch: 0, roll: 0, drop: 0, shift: 0 }),
  ], { fadeIn: 0.22 }),
  stumble: clip(0.55, [
    K(0, { lean: 0.55, hipL: 0.6, kneeL: 0.5, hipR: 0.2, kneeR: 0.4, shXL: 0.5, shXR: 0.7, shZL: 0.9, shZR: 0.8, elL: 0.3, elR: 0.3, head: 0.3 }, { pitch: 0.2, drop: 0.08 }),
    K(0.25, { lean: 0.4, hipL: 0.3, kneeL: 0.5, hipR: 0.7, kneeR: 0.7, shXL: 0.9, shXR: 0.2, shZL: 1.1, shZR: 1.0, elL: 0.3, elR: 0.3, head: 0.2 }, { pitch: 0.15, drop: 0.1 }),
    K(0.55, { lean: 0.1, hipL: 0.2, kneeL: 0.3, hipR: 0.2, kneeR: 0.3, shXL: 0.2, shXR: 0.2, shZL: 0.3, shZR: 0.3, elL: 0.3, elR: 0.3, head: 0 }, { pitch: 0, drop: 0 }),
  ]),
  celebrate: clip(1.2, [
    K(0, { shZL: 2.6, shZR: 2.6, shXL: 0.3, shXR: 0.3, elL: 0.25, elR: 0.25, lean: -0.18, head: -0.5, kneeL: 0.1, kneeR: 0.1 }),
    K(0.6, { shZL: 2.8, shZR: 2.4, shXL: 0.1, shXR: 0.5, elL: 0.6, elR: 0.2, lean: -0.22, head: -0.55, kneeL: 0.2, kneeR: 0.1 }),
    K(1.2, { shZL: 2.6, shZR: 2.6, shXL: 0.3, shXR: 0.3, elL: 0.25, elR: 0.25, lean: -0.18, head: -0.5, kneeL: 0.1, kneeR: 0.1 }),
  ], { hold: true }),
  /* ---- portero ---- */
  collect: clip(0.35, [                         // rodilla al suelo, manos abajo
    K(0, { hipL: 0.9, kneeL: 1.1, hipR: 1.5, kneeR: 1.9, lean: 0.55, shXL: 0.9, shXR: 0.9, shZL: 0.3, shZR: 0.3, elL: 0.35, elR: 0.35, head: 0.4 }, { drop: 0.2 }),
    K(0.35, { hipL: 1.0, kneeL: 1.2, hipR: 1.7, kneeR: 2.1, lean: 0.7, shXL: 1.0, shXR: 1.0, shZL: 0.3, shZR: 0.3, elL: 0.3, elR: 0.3, head: 0.5 }, { drop: 0.42 }),
  ], { hold: true }),
  reach: clip(0.25, [                           // parada de pie: brazos al balón (IK completa la dirección)
    K(0, { lean: 0.15, hipL: 0.3, hipR: 0.3, kneeL: 0.4, kneeR: 0.4, shXL: 1.2, shXR: 1.2, shZL: 0.5, shZR: 0.5, elL: 0.3, elR: 0.3 }),
    K(0.25, { lean: 0.1, hipL: 0.2, hipR: 0.2, kneeL: 0.3, kneeR: 0.3, shXL: 1.4, shXR: 1.4, shZL: 0.4, shZR: 0.4, elL: 0.2, elR: 0.2 }),
  ], { hold: true }),
  block: clip(0.3, [                            // bloqueo con cuerpo y piernas (estrella)
    K(0, { hipAbL: 0.5, hipAbR: 0.5, hipL: 0.2, hipR: 0.2, kneeL: 0.3, kneeR: 0.3, shZL: 1.5, shZR: 1.5, shXL: 0.4, shXR: 0.4, elL: 0.2, elR: 0.2, lean: 0.2 }, { lift: 0.1 }),
    K(0.3, { hipAbL: 0.75, hipAbR: 0.75, hipL: 0.35, hipR: 0.35, kneeL: 0.2, kneeR: 0.2, shZL: 1.9, shZR: 1.9, shXL: 0.3, shXR: 0.3, elL: 0.15, elR: 0.15, lean: 0.15 }, { lift: 0.28 }),
  ], { hold: true }),
  hold: clip(0.3, [                             // balón abrazado al pecho
    K(0, { shXL: 1.1, shXR: 1.1, shZL: 0.35, shZR: 0.35, elL: 1.9, elR: 1.9, lean: 0.12, head: 0.2 }),
    K(0.3, { shXL: 1.15, shXR: 1.15, shZL: 0.3, shZR: 0.3, elL: 2.0, elR: 2.0, lean: 0.1, head: 0.15 }),
  ], { hold: true }),
  /* ---- árbitro y protestas ---- */
  refWhistle: clip(0.5, [
    K(0, { shXR: 1.2, shZR: 0.4, elR: 2.0, shXL: 0.1, elL: 0.3, head: 0.05 }),
    K(0.5, { shXR: 1.55, shZR: 0.45, elR: 2.35, shXL: 0.1, elL: 0.3, head: 0.05 }),
  ], { hold: true }),
  refCard: clip(1.4, [
    K(0, { shXR: -0.35, shZR: 0.25, elR: 1.6, shXL: 0.1, shZL: 0.2, elL: 0.3, lean: 0.05, head: 0.1 }),
    K(0.35, { shXR: 0.3, shZR: 0.3, elR: 1.4, shXL: 0.1, shZL: 0.2, elL: 0.3, lean: 0.02, head: 0.1 }),
    K(0.7, { shXR: 2.55, shZR: 0.3, elR: 0.15, shXL: 0.1, shZL: 0.2, elL: 0.3, lean: -0.08, head: -0.1 }),
    K(1.4, { shXR: 2.6, shZR: 0.32, elR: 0.12, shXL: 0.1, shZL: 0.2, elL: 0.3, lean: -0.08, head: -0.1 }),
  ], { hold: true }),
  protestArms: clip(1.6, [
    K(0, { shXL: 0.4, shXR: 0.4, shZL: 0.9, shZR: 0.9, elL: 0.5, elR: 0.5, lean: -0.08, head: -0.15 }),
    K(0.4, { shXL: 0.7, shXR: 0.7, shZL: 1.35, shZR: 1.35, elL: 0.3, elR: 0.3, lean: -0.15, head: -0.3 }),
    K(0.8, { shXL: 0.5, shXR: 0.5, shZL: 1.0, shZR: 1.0, elL: 0.6, elR: 0.6, lean: -0.05, head: -0.1 }),
    K(1.2, { shXL: 0.75, shXR: 0.75, shZL: 1.4, shZR: 1.4, elL: 0.25, elR: 0.25, lean: -0.15, head: -0.3 }),
    K(1.6, { shXL: 0.4, shXR: 0.4, shZL: 0.9, shZR: 0.9, elL: 0.5, elR: 0.5, lean: -0.08, head: -0.15 }),
  ], { hold: true }),
  protestHips: clip(1.6, [
    K(0, { shXL: 0.15, shXR: 0.15, shZL: 0.6, shZR: 0.6, elL: 2.1, elR: 2.1, headYaw: 0.35, head: 0.05, lean: 0.05 }),
    K(0.35, { headYaw: -0.35 }), K(0.7, { headYaw: 0.35 }), K(1.05, { headYaw: -0.35 }), K(1.6, { headYaw: 0.2, head: 0.25 }),
  ], { hold: true }),
  protestPoint: clip(1.6, [
    K(0, { shXR: 1.0, shZR: 0.25, elR: 0.1, shXL: 0.15, shZL: 0.6, elL: 2.1, lean: 0.15, head: 0.3 }),
    K(0.5, { shXR: 0.85, shZR: 0.3, elR: 0.1, shXL: 0.15, shZL: 0.6, elL: 2.1, lean: 0.2, head: 0.35 }),
    K(0.9, { shXR: 1.05, shZR: 0.25, elR: 0.1, shXL: 0.15, shZL: 0.6, elL: 2.1, lean: 0.15, head: 0.3 }),
    K(1.6, { shXR: 0.9, shZR: 0.3, elR: 0.1, shXL: 0.15, shZL: 0.6, elL: 2.1, lean: 0.18, head: 0.33 }),
  ], { hold: true }),
  walkOff: clip(1.0, [
    K(0, { head: 0.35, lean: 0.08, shXL: 0.05, shXR: 0.05, elL: 0.2, elR: 0.2 }),
    K(1.0, { head: 0.35, lean: 0.08, shXL: 0.05, shXR: 0.05, elL: 0.2, elR: 0.2 }),
  ], { hold: true }),
};
/* estiradas: se generan por clase de altura; lado base = derecha (-x local → roll positivo) */
function diveClip(rollAmt, lift, legs) {
  return clip(0.55, [
    K(0, { hipR: 0.5, kneeR: 0.9, hipL: 0.4, kneeL: 0.7, lean: 0.25, head: -0.2 }, { roll: 0, drop: 0.12, lift: 0 }),
    K(0.12, { hipR: 0.2, kneeR: 0.3, hipAbR: 0.5, hipL: 0.9, kneeL: 1.3, lean: 0.1, head: -0.1, side: -0.2 }, { roll: rollAmt * 0.55, drop: 0.05, lift: lift * 0.7 }),
    K(0.3, { hipR: legs[0], kneeR: legs[1], hipAbR: 0.35, hipL: legs[2], kneeL: legs[3], lean: 0.05, head: 0, side: -0.25 }, { roll: rollAmt, drop: 0, lift }),
    K(0.55, { hipR: 0.5, kneeR: 0.6, hipAbR: 0.2, hipL: 0.8, kneeL: 1.1, lean: 0.3, head: 0.1, side: -0.2 }, { roll: 1.45, drop: -0.05, lift: 0 }),
  ], { hold: true });
}
CLIPS.diveLow = diveClip(1.3, 0, [0.15, 0.2, 0.6, 1.0]);
CLIPS.diveMid = diveClip(0.95, 0.12, [0.1, 0.25, 0.7, 1.2]);
CLIPS.diveHigh = diveClip(0.6, 0.45, [0.2, 0.3, 0.8, 1.3]);

/* rellena claves ausentes desde la clave anterior para muestrear sin huecos */
for (const c of Object.values(CLIPS)) {
  const allJ = new Set(), allR = new Set();
  for (const k of c.keys) { Object.keys(k.J).forEach(x => allJ.add(x)); Object.keys(k.R).forEach(x => allR.add(x)); }
  c.jkeys = [...allJ]; c.rkeys = [...allR];
  for (let i = 0; i < c.keys.length; i++) {
    const k = c.keys[i], prev = c.keys[i - 1];
    for (const j of c.jkeys) if (!(j in k.J)) k.J[j] = prev ? prev.J[j] : (j in IDLE.stand ? IDLE.stand[j] : 0);
    for (const r of c.rkeys) if (!(r in k.R)) k.R[r] = prev ? prev.R[r] : 0;
  }
}
const mirrorKey = k => k.endsWith('L') && k !== 'headYaw' ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k;
function sampleClip(c, t, mirror, outJ, outR) {
  const ks = c.keys;
  let i = 0;
  while (i < ks.length - 2 && t > ks[i + 1].t) i++;
  const a = ks[i], b = ks[Math.min(i + 1, ks.length - 1)];
  const u = b.t > a.t ? sm((t - a.t) / (b.t - a.t)) : 1;
  for (const k of c.jkeys) {
    const v = lerp(a.J[k], b.J[k], u);
    const kk = mirror ? mirrorKey(k) : k;
    outJ[kk] = mirror && MIRROR_NEG.has(k) ? -v : v;
  }
  for (const k of c.rkeys) {
    const v = lerp(a.R[k], b.R[k], u);
    outR[k] = mirror && MIRROR_NEG.has(k) ? -v : v;
  }
}

/* ---------- Animator: locomoción paramétrica + acción con fundido + resortes críticos ---------- */
export class Animator {
  constructor(apply, { idle = 'stand' } = {}) {
    this.apply = apply; this.idle = idle;
    this.J = J0(); this.Jt = J0(); this.Jv = {}; for (const k of JKEYS) this.Jv[k] = 0;
    this.R = R0(); this.Rt = R0(); this.Rv = R0();
    this.phase = Math.random() * 6.28; this.act = null; this.idleSeed = Math.random() * 6.28;
    this._sj = {}; this._sr = {};
  }
  reset() {
    Object.assign(this.J, IDLE[this.idle]); Object.assign(this.Jt, this.J);
    for (const k of JKEYS) this.Jv[k] = 0;
    Object.assign(this.R, R0()); Object.assign(this.Rt, R0()); Object.assign(this.Rv, R0());
    this.act = null;
  }
  play(name, o = {}) {
    const c = CLIPS[name]; if (!c) return null;
    this.act = { name, c, t: 0, mirror: o.side === 'L', dur: o.dur || c.dur, hold: o.hold ?? c.hold ?? false,
      speed: o.speed || 1, onEnd: o.onEnd || null, fadeIn: o.fadeIn ?? c.fadeIn ?? 0.08, ended: false };
    return this.act;
  }
  is(name) { return !!this.act && this.act.name === name; }
  stop() { this.act = null; }
  impulse(map) { for (const k in map) if (k in this.Jv) this.Jv[k] += map[k]; }
  /* c: { speed, accel, turn, t, dt } */
  update(dt, c) {
    const Jt = this.Jt, Rt = this.Rt;
    // locomoción: fase ligada a la distancia recorrida → sin deslizamiento de pies
    const sp = c.speed, run = sm((sp - 2.6) / 2.6), move = sm((sp - 0.2) / 0.7);
    const cyc = 1.0 + 0.4 * sp;
    this.phase += dt * Math.PI * 2 * sp / cyc;
    const ph = this.phase, s = Math.sin(ph);
    const hipA = lerp(0.42, 0.92, run), kB = lerp(0.08, 0.22, run), kA = lerp(0.42, 1.05, run);
    const armA = lerp(0.28, 0.78, run), elA = lerp(0.3, 1.1, run), leanA = lerp(0.03, 0.18, run);
    const swL = Math.max(0, -Math.sin(ph - 0.55)), swR = Math.max(0, Math.sin(ph - 0.55));
    const base = IDLE[this.idle];
    const L = {
      hipL: hipA * s, hipR: -hipA * s, kneeL: kB + kA * swL, kneeR: kB + kA * swR,
      ankleL: 0.4 * Math.max(0, -s) - 0.12 * Math.max(0, s), ankleR: 0.4 * Math.max(0, s) - 0.12 * Math.max(0, -s),
      shXL: -armA * s, shXR: armA * s, elL: elA, elR: elA, shZL: 0.18, shZR: 0.18,
      lean: leanA, hipAbL: 0.05, hipAbR: 0.05, head: -0.05 * run, headYaw: 0, twist: -0.12 * s * run, side: 0, pelvisY: -0.02 * run,
    };
    for (const k of JKEYS) Jt[k] = lerp(base[k], L[k], move);
    Jt.lean += clamp(c.accel * 0.028, -0.22, 0.26);
    Jt.side += clamp(-c.turn * 0.05, -0.2, 0.2);
    if (move < 1) {                                   // vida en reposo: respiración, peso de un pie a otro, mirada, brazos
      const w = 1 - move, t = c.t, ph2 = this.phase * 0.37 + this.idleSeed;
      const br = Math.sin(t * 1.5 + ph2);
      const sway = Math.sin(t * 0.55 + ph2 * 2.1);
      const look = Math.sin(t * 0.31 + ph2 * 1.3) * Math.sin(t * 0.13 + ph2);
      Jt.lean += (br * 0.015 + 0.01) * w;
      Jt.side += sway * 0.04 * w;
      Jt.pelvisY += (-0.008 + sway * 0.006) * w;
      Jt.hipAbL += (sway > 0 ? sway * 0.06 : 0) * w; Jt.hipAbR += (sway < 0 ? -sway * 0.06 : 0) * w;
      Jt.kneeL += Math.max(0, -sway) * 0.09 * w; Jt.kneeR += Math.max(0, sway) * 0.09 * w;
      Jt.headYaw += look * 0.45 * w; Jt.head += Math.sin(t * 0.42 + ph2) * 0.06 * w;
      Jt.twist += sway * 0.05 * w;
      Jt.shXL += (Math.sin(t * 0.9 + ph2) * 0.05 + 0.04) * w; Jt.shXR += (Math.sin(t * 0.9 + ph2 + 1.7) * 0.05 + 0.04) * w;
      Jt.shZL += (0.06 + br * 0.02) * w; Jt.shZR += (0.06 - br * 0.02) * w;
      Jt.elL += (br * 0.05 + Math.sin(t * 0.7 + ph2) * 0.08) * w; Jt.elR += (br * 0.05 + Math.sin(t * 0.7 + ph2 + 2.4) * 0.08) * w;
    }
    Rt.pitch = 0; Rt.roll = clamp(-c.turn * 0.045, -0.22, 0.22) * Math.min(1, sp / 3); Rt.drop = 0; Rt.shift = 0;
    Rt.lift = Math.abs(Math.sin(ph * 2)) * lerp(0.015, 0.06, run) * move;
    // acción
    const a = this.act;
    if (a) {
      a.t += dt * a.speed;
      const tt = Math.min(a.t, a.dur);
      const tail = a.hold ? 1 : sm((a.dur - a.t) / 0.15);
      const w = Math.min(sm(a.t / a.fadeIn), tail);
      sampleClip(a.c, tt / a.dur * a.c.dur, a.mirror, this._sj, this._sr);
      for (const k in this._sj) Jt[k] = lerp(Jt[k], this._sj[k], w);
      for (const k in this._sr) Rt[k] = lerp(Rt[k], this._sr[k], w);
      for (const k in this._sj) delete this._sj[k];
      for (const k in this._sr) delete this._sr[k];
      if (a.t >= a.dur && !a.ended) { a.ended = true; if (!a.hold) this.act = null; if (a.onEnd) a.onEnd(); }
    }
    // resortes críticamente amortiguados (transiciones suaves + reacción a impulsos)
    const kJ = 380, cJ = 2 * Math.sqrt(kJ), kR = 240, cR = 2 * Math.sqrt(kR);
    const J = this.J, Jv = this.Jv;
    for (const k of JKEYS) { Jv[k] += ((Jt[k] - J[k]) * kJ - Jv[k] * cJ) * dt; J[k] += Jv[k] * dt; }
    const R = this.R, Rv = this.Rv;
    for (const k of RKEYS) { Rv[k] += ((Rt[k] - R[k]) * kR - Rv[k] * cR) * dt; R[k] += Rv[k] * dt; }
    this.apply(J, R);
    /* capa mocap: locomoción de captura de movimiento sobre el esqueleto real (si está disponible);
       la acción procedural en curso conserva prioridad según su peso */
    if (this.mocap) this.mocap(J, R, c, dt, a ? Math.min(sm(a.t / a.fadeIn), a.hold ? 1 : sm((a.dur - a.t) / 0.15)) : 0, a ? a.name : null);
  }
}
