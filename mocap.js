/* MOCAP — Universal Animation Library (Quaternius, CC0) retargeteada al esqueleto de los jugadores.
   Método: se guarda, por fotograma, la DIRECCIÓN mundo de cada hueso (padre→hijo) del mannequin en el
   marco del personaje (up / right / fwd). En runtime cada hueso del jugador se ORIENTA para que su
   dirección coincida con la del mannequin (aim padre→hijo), de raíz a hojas. Es independiente de las
   orientaciones locales de reposo de cada rig, así que no puede espejarse ni retorcerse. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SRC = './assets/anim/UAL1_Standard.glb';
export const MAP = {
  pelvis: 'hips', spine_01: 'spine0', spine_02: 'spine1', spine_03: 'spine2', neck_01: 'neck', Head: 'head',
  clavicle_l: 'clavL', upperarm_l: 'armL', lowerarm_l: 'foreL', hand_l: 'handL',
  clavicle_r: 'clavR', upperarm_r: 'armR', lowerarm_r: 'foreR', hand_r: 'handR',
  thigh_l: 'hipL', calf_l: 'kneeL', foot_l: 'footL', ball_l: 'toeL',
  thigh_r: 'hipR', calf_r: 'kneeR', foot_r: 'footR', ball_r: 'toeR',
};
export const RX = {
  hips: /(^rig_Hips|Bip01_Pelvis$)/, spine0: /(^rig_Spine_01|Bip01_Spine$)/, spine1: /(^rig_Spine1_|Bip01_Spine1$)/, spine2: /(^rig_Spine2_|Bip01_Spine2$)/, neck: /(^rig_Neck|Bip01_Neck1$)/, head: /(^rig_Head|Bip01_Head1$)/,
  clavL: /(^rig_LeftShoulder|Bip01_L_Clavicle$)/, armL: /(^rig_LeftArm_|Bip01_L_UpperArm$)/, foreL: /(^rig_LeftForeArm|Bip01_L_Forearm$)/, handL: /(^rig_LeftHand_|Bip01_L_Hand$)/,
  clavR: /(^rig_RightShoulder|Bip01_R_Clavicle$)/, armR: /(^rig_RightArm_|Bip01_R_UpperArm$)/, foreR: /(^rig_RightForeArm|Bip01_R_Forearm$)/, handR: /(^rig_RightHand_|Bip01_R_Hand$)/,
  hipL: /(^rig_LeftUpLeg|Bip01_L_Thigh$)/, kneeL: /(^rig_LeftLeg_|Bip01_L_Calf$)/, footL: /(^rig_LeftFoot|Bip01_L_Foot$)/, toeL: /(^rig_LeftToeBase|Bip01_L_Toe0$)/,
  hipR: /(^rig_RightUpLeg|Bip01_R_Thigh$)/, kneeR: /(^rig_RightLeg_|Bip01_R_Calf$)/, footR: /(^rig_RightFoot|Bip01_R_Foot$)/, toeR: /(^rig_RightToeBase|Bip01_R_Toe0$)/,
};
/* segmentos que se orientan: clave → hijo cuya posición define la dirección */
export const SEG = {
  spine0: 'spine1', spine1: 'spine2', spine2: 'neck', neck: 'head',
  armL: 'foreL', foreL: 'handL', armR: 'foreR', foreR: 'handR',
  hipL: 'kneeL', kneeL: 'footL', footL: 'toeL', hipR: 'kneeR', kneeR: 'footR', footR: 'toeR',
};
export const KEYS = Object.values(MAP);
const SEGKEYS = Object.keys(SEG);
const FPS = 30;

/* marco del personaje: up = pelvis→cabeza, fwd = talón→punta (proyectado; si no hay punta: rodilla→pie no sirve, se usa right×up), right = up × fwd */
function charFrame(P) {
  const up = P.head.clone().sub(P.hips).normalize();
  let fwd;
  if (P.toeL && P.footL && P.toeR && P.footR) fwd = P.toeL.clone().sub(P.footL).add(P.toeR.clone().sub(P.footR));
  else { const right = P.hipR.clone().sub(P.hipL); fwd = new THREE.Vector3().crossVectors(right, up); }
  fwd.addScaledVector(up, -fwd.dot(up)).normalize();
  const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
  return { up, right, fwd };
}
/* dirección mundo d expresada en el marco (r,u,f) → [x,y,z] */
function toFrame(d, F, out) { return out.set(d.dot(F.right), d.dot(F.up), d.dot(F.fwd)); }

let loaded = null;
export function loadMocap() {
  if (loaded) return loaded;
  loaded = new GLTFLoader().loadAsync(SRC).then(gltf => {
    const rig = gltf.scene;
    const bones = {};
    rig.traverse(o => { if (o.isBone && MAP[o.name]) bones[MAP[o.name]] = o; });
    const mixer = new THREE.AnimationMixer(rig);
    const P = {}; for (const k of KEYS) P[k] = new THREE.Vector3();
    const readPos = () => { rig.updateMatrixWorld(true); for (const k of KEYS) if (bones[k]) bones[k].getWorldPosition(P[k]); };
    // marco de referencia (fijo): T-pose. Los clips se expresan en el marco de la CADERA de cada
    // fotograma (yaw incluido) para que el giro corporal se conserve, con el up del mundo.
    const tpose = gltf.animations.find(a => a.name === 'A_TPose');
    const a0 = mixer.clipAction(tpose); a0.play(); mixer.setTime(0); readPos();
    const F0 = charFrame(P);
    const hipsY0 = P.hips.y;
    a0.stop();
    const clips = {};
    const tmp = new THREE.Vector3();
    for (const clip of gltf.animations) {
      if (clip.name === 'A_TPose') continue;
      const act = mixer.clipAction(clip); act.play();
      const n = Math.max(2, Math.round(clip.duration * FPS));
      const frames = new Array(n), hipY = new Float32Array(n), hipYaw = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        mixer.setTime(i / FPS * (clip.duration / (n / FPS)));
        readPos();
        // marco por fotograma: up mundo, fwd = frente de la pelvis (hipL→hipR × up) → yaw de la cadera
        const rightHip = P.hipR.clone().sub(P.hipL).setY(0).normalize();
        const F = { up: new THREE.Vector3(0, 1, 0), right: rightHip, fwd: new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), rightHip).normalize() };
        // en T-pose el frente es fwd0: orientar F para que sea comparable → usamos F0 para los ejes right/fwd
        // pero guardamos el yaw de la pelvis respecto a F0
        hipYaw[i] = Math.atan2(F.fwd.dot(F0.right), F.fwd.dot(F0.fwd));
        const f = {};
        for (const k of SEGKEYS) {
          const c = SEG[k]; if (!bones[k] || !bones[c]) continue;
          tmp.copy(P[c]).sub(P[k]).normalize();
          f[k] = toFrame(tmp, F0, new THREE.Vector3());
        }
        frames[i] = f;
        hipY[i] = P.hips.y - hipsY0;
      }
      act.stop();
      clips[clip.name] = { name: clip.name, dur: clip.duration, n, frames, hipY, hipYaw };
    }
    mixer.stopAllAction();
    return { clips, hipsY0 };
  });
  return loaded;
}

/* ---- binding a un esqueleto destino ---- */
export function bindMocap(root) {
  root.updateMatrixWorld(true);
  const B = {}, seen = new Set();
  root.traverse(o => { if (!o.isBone) return; for (const k in RX) if (!seen.has(k) && RX[k].test(o.name)) { seen.add(k); B[k] = o; } });
  const rootQi = root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const P = {}; for (const k of KEYS) if (B[k]) P[k] = B[k].getWorldPosition(new THREE.Vector3()).applyQuaternion(rootQi);
  const F1 = charFrame(P);                          // marco del jugador en reposo, en espacio root
  const rest = {}; for (const k in B) rest[k] = B[k].quaternion.clone();
  const rootPos = root.getWorldPosition(new THREE.Vector3());
  const hipsH = B.hips ? B.hips.getWorldPosition(new THREE.Vector3()).y - rootPos.y : 1;
  const hipsRestQ = B.hips ? B.hips.quaternion.clone() : null;
  return { B, rest, F1, root, hipsH, hipsRestQ };
}

const _rq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _rot = new THREE.Quaternion();
const _cur = new THREE.Vector3(), _des = new THREE.Vector3(), _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _ax = new THREE.Vector3();
const ORDER = ['spine0', 'spine1', 'spine2', 'neck', 'armL', 'foreL', 'armR', 'foreR', 'hipL', 'kneeL', 'footL', 'hipR', 'kneeR', 'footR'];
/* pose = mapa clave → dirección en marco F0 (+ _hipY, _hipYaw). Cada hueso se orienta hacia la dirección deseada */
export function applyPose(bind, pose, w = 1, skip = null) {
  const { B, F1, root, rest } = bind;
  root.getWorldQuaternion(_rq);
  // yaw de cadera del clip → rotación del hueso de cadera alrededor del up del jugador
  if (B.hips && bind.hipsRestQ && (!skip || !skip.has('hips'))) {
    B.hips.quaternion.copy(bind.hipsRestQ);
    if (pose._hipYaw) {
      B.hips.parent.updateWorldMatrix(true, false); B.hips.parent.getWorldQuaternion(_pq);
      _ax.copy(F1.up).applyQuaternion(_rq);
      _rot.setFromAxisAngle(_ax, pose._hipYaw * (w));
      B.hips.quaternion.premultiply(_pq.clone().invert().multiply(_rot).multiply(_pq));
    }
  }
  for (const k of ORDER) {
    const b = B[k], c = B[SEG[k]], d = pose[k];
    if (!b || !c || !d || (skip && skip.has(k))) continue;
    b.quaternion.copy(rest[k]);
    b.updateWorldMatrix(true, false); c.updateWorldMatrix(false, false);
    b.getWorldPosition(_p0); c.getWorldPosition(_p1);
    _cur.copy(_p1).sub(_p0).normalize();
    // deseado: componentes en el marco del jugador → mundo
    _des.set(0, 0, 0).addScaledVector(F1.right, d.x).addScaledVector(F1.up, d.y).addScaledVector(F1.fwd, d.z).applyQuaternion(_rq).normalize();
    _rot.setFromUnitVectors(_cur, _des);
    if (w < 1) _rot.slerp(new THREE.Quaternion(), 1 - w);
    b.parent.getWorldQuaternion(_pq);
    b.quaternion.premultiply(_pq.clone().invert().multiply(_rot).multiply(_pq));
  }
}
export function sampleMocap(clip, t, out, loop = true) {
  let u = t / clip.dur;
  u = loop ? u - Math.floor(u) : Math.min(0.99999, Math.max(0, u));
  const f = u * (loop ? clip.n : clip.n - 1);
  const i0 = Math.floor(f) % clip.n, i1 = (i0 + 1) % clip.n, a = f - Math.floor(f);
  const A = clip.frames[i0], Bf = clip.frames[i1];
  for (const k of SEGKEYS) { if (!A[k]) continue; if (!out[k]) out[k] = new THREE.Vector3(); out[k].copy(A[k]).lerp(Bf[k], a).normalize(); }
  out._hipY = clip.hipY[i0] * (1 - a) + clip.hipY[i1] * a;
  let y0 = clip.hipYaw[i0], y1 = clip.hipYaw[i1]; if (y1 - y0 > Math.PI) y1 -= 2 * Math.PI; if (y0 - y1 > Math.PI) y1 += 2 * Math.PI;
  out._hipYaw = y0 * (1 - a) + y1 * a;
  return out;
}
export function blendPose(a, b, w, out) {
  for (const k of SEGKEYS) {
    const A = a[k], Bv = b[k]; if (!A && !Bv) continue;
    if (!out[k]) out[k] = new THREE.Vector3();
    if (A && Bv) out[k].copy(A).lerp(Bv, w).normalize(); else out[k].copy(A || Bv);
  }
  out._hipY = (a._hipY || 0) * (1 - w) + (b._hipY || 0) * w;
  out._hipYaw = (a._hipYaw || 0) * (1 - w) + (b._hipYaw || 0) * w;
  return out;
}
export const STRIDE = { Walk_Loop: 1.55, Jog_Fwd_Loop: 2.35, Sprint_Loop: 3.9 };
