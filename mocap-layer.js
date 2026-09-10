/* MOCAP LAYER — enlaza los clips de la Universal Animation Library con un jugador real */
import * as THREE from 'three';
import { loadMocap, bindMocap, applyPose, sampleMocap, blendPose, KEYS, STRIDE } from './mocap.js';

const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const P = () => ({});
/* qué huesos "posee" cada acción procedural (el resto sigue con mocap) */
const ACTION_BONES = {
  kick: ['hips', 'hipL', 'kneeL', 'footL', 'hipR', 'kneeR', 'footR', 'spine0', 'spine1', 'spine2'],
  slide: null, fallFront: null, fallBack: null, fallSide: null, getUp: null, stumble: null,   // null = todo el cuerpo procedural
  collect: null, reach: null, block: null, hold: ['clavL', 'armL', 'foreL', 'handL', 'clavR', 'armR', 'foreR', 'handR', 'spine2'],
  celebrate: ['clavL', 'armL', 'foreL', 'handL', 'clavR', 'armR', 'foreR', 'handR', 'spine1', 'spine2', 'neck', 'head'],
  refWhistle: ['clavR', 'armR', 'foreR', 'handR', 'head'], refCard: ['clavR', 'armR', 'foreR', 'handR', 'spine2', 'head'],
  protestArms: ['clavL', 'armL', 'foreL', 'handL', 'clavR', 'armR', 'foreR', 'handR', 'spine1', 'spine2', 'neck', 'head'],
  protestHips: ['clavL', 'armL', 'foreL', 'handL', 'clavR', 'armR', 'foreR', 'handR', 'neck', 'head'],
  protestPoint: ['clavL', 'armL', 'foreL', 'handL', 'clavR', 'armR', 'foreR', 'handR', 'spine1', 'spine2', 'neck', 'head'],
  walkOff: ['neck', 'head'],
};
const ALL = new Set(KEYS);
const _tmpV = new THREE.Vector3();

export async function attachMocap(anim, real, { keeper = false } = {}) {
  const { clips } = await loadMocap();
  const bind = bindMocap(real.root);
  anim.mocapBind = bind;
  const idle = clips['Idle_Loop'], idle2 = clips['Idle_Talking_Loop'];
  const walk = clips.Walk_Loop, jog = clips.Jog_Fwd_Loop, sprint = clips.Sprint_Loop;
  const pA = P(), pB = P(), pC = P(), pOut = P();
  let phase = Math.random(), idleT = Math.random() * 10, prevSpeed = 0;
  const hipsBone = bind.B.hips;
  const scaleH = bind.hipsH / 1.0;    // mannequin hips ~1.0 m
  // anclaje al suelo en METROS sobre real.root (eje Y del grupo del jugador = arriba en el mundo)
  const FEET = ['footL', 'footR', 'toeL', 'toeR'].map(k => bind.B[k]).filter(Boolean);
  const _v = new THREE.Vector3(), _rp = new THREE.Vector3();
  const rootBaseY = real.root.position.y;
  const lowestFoot = () => {
    real.root.updateMatrixWorld(true);
    real.root.getWorldPosition(_rp);
    let m = Infinity;
    for (const b of FEET) m = Math.min(m, b.getWorldPosition(_v).y);
    return m - (_rp.y - real.root.position.y);      // relativo al padre del root (= grupo del jugador)
  };
  const groundRef = lowestFoot() - rootBaseY;      // altura de la suela en reposo, medida desde root en y=base
  let rootOff = 0;

  anim.mocap = (J, R, c, dt, actW, actName) => {
    const sp = c.speed;
    idleT += dt;
    // fase de locomoción ligada a la distancia recorrida → sin deslizamiento
    const wWalk = sm((sp - 0.25) / 0.9), wJog = sm((sp - 1.9) / 1.6), wSprint = sm((sp - 4.6) / 1.8);
    const stride = lerp(lerp(STRIDE.Walk_Loop, STRIDE.Jog_Fwd_Loop, wJog), STRIDE.Sprint_Loop, wSprint) * scaleH;
    if (sp > 0.25) phase += dt * sp / stride; else phase += dt * 0.0;
    const u = phase - Math.floor(phase);
    // reposo: alterna dos idles lentamente para que nunca esté "congelado"
    const idleMix = 0.5 + 0.5 * Math.sin(idleT * 0.21);
    sampleMocap(idle, idleT * 0.9, pA); sampleMocap(idle2, idleT * 0.8 + 1.3, pB); blendPose(pA, pB, keeper ? 0 : idleMix * 0.6, pC);
    // locomoción: walk→jog→sprint por velocidad, misma fase normalizada
    sampleMocap(walk, u * walk.dur, pA); sampleMocap(jog, u * jog.dur, pB); blendPose(pA, pB, wJog, pOut);
    sampleMocap(sprint, u * sprint.dur, pA); blendPose(pOut, pA, wSprint, pB);
    blendPose(pC, pB, wWalk, pOut);
    // huesos que se reservan para la acción procedural en curso
    let skip = null;
    if (actW > 0.02 && actName) {
      const own = ACTION_BONES[actName];
      if (own === null) skip = actW > 0.6 ? ALL : null;
      else if (own) skip = actW > 0.5 ? new Set(own) : null;
    }
    if (skip === ALL) { rootOff = 0; real.root.position.y = rootBaseY; return; }   // acción de cuerpo entero: pose procedural intacta
    // arquero en guardia: mocap para todo, y encima una guardia (tronco adelante, brazos separados y
    // codos flexionados hacia DELANTE) expresada como direcciones en el marco del jugador
    if (keeper && sp < 0.6 && !skip) {
      const g = Math.min(1, (0.6 - sp) / 0.4);
      const set = (k, x, y, z) => { if (!pOut[k]) pOut[k] = new THREE.Vector3(); pOut[k].lerp(_tmpV.set(x, y, z).normalize(), g); pOut[k].normalize(); };
      set('spine1', 0, 0.94, 0.34); set('spine2', 0, 0.9, 0.42); set('neck', 0, 0.85, 0.5);
      set('armL', 0.6, -0.7, 0.35); set('foreL', 0.15, 0.25, 0.95);        // brazo abajo-afuera, antebrazo hacia DELANTE y algo arriba (codo flexionado al frente)
      set('armR', -0.6, -0.7, 0.35); set('foreR', -0.15, 0.25, 0.95);
      set('hipL', 0.3, -0.85, 0.42); set('kneeL', 0.05, -0.92, -0.38);    // piernas flexionadas, pies separados
      set('hipR', -0.3, -0.85, 0.42); set('kneeR', -0.05, -0.92, -0.38);
    }
    applyPose(bind, pOut, 1, skip);
    // anclaje al suelo: el pie más bajo del fotograma se lleva a la altura de la suela en reposo
    if (FEET.length) {
      real.root.position.y = rootBaseY;
      const low = lowestFoot();                     // con root en la base
      const target = -(low - rootBaseY - groundRef);
      rootOff = target;                              // sin retardo: el clip ya es continuo, el retardo hacía flotar/hundir en cambios de ritmo
      real.root.position.y = rootBaseY + rootOff;
    }
    // inclinación por aceleración/giro sobre la columna (conserva la sensación de peso)
    const lean = Math.max(-0.2, Math.min(0.25, c.accel * 0.02)), side = Math.max(-0.15, Math.min(0.15, -c.turn * 0.04));
    if (!skip || !skip.has('spine1')) {
      const s1 = bind.B.spine1; if (s1) { s1.rotateX(lean); s1.rotateZ(side); }
    }
    // mirada: cabeza con el yaw/cabeceo procedural (el mocap no orienta la cabeza, solo el cuello)
    if (!skip || !skip.has('head')) { const h = bind.B.head; if (h) { h.quaternion.copy(bind.rest.head); h.rotateY(J.headYaw * 0.8); h.rotateX(J.head * 0.5); } }
    prevSpeed = sp;
  };
  return bind;
}
