/* HERO MODELS — carga los FBX riggeados y los anima proceduralmente
   (no traen clips de carrera, así que movemos los huesos por código) */
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const TL = new THREE.TextureLoader();
const texCache = new Map();
function tex(url, srgb = true) {
  if (!texCache.has(url)) {
    const t = TL.load(url);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    texCache.set(url, t);
  }
  return texCache.get(url);
}

const HEROES = {
  ronaldo: {
    url: './assets/players/ronaldo/model.fbx',
    label: 'RONALDO', number: '7',
    height: 1.87,
    tex: null,                       // el FBX ya referencia sus texturas
  },
  messi: {
    url: './assets/players/messi/model.fbx',
    label: 'MESSI', number: '10',
    height: 1.70,
    dir: './assets/players/messi/',
    tex: {
      'Arms & Hands': { map: 'arm.png' },
      'Legs': { map: 'legs.png' },
      'face': { map: 'face.png' },
      'eyes': { map: 'eye_color.png' },
      'hair.001': { map: 'hair.png', alpha: true },
      'Kit_': { map: 'uniform.png', normal: 'Kit__Normal.png' },
      'Kit_.1': { map: 'uniform.png', normal: 'Kit__Normal.png' },
      'Kit_.2': { map: 'uniform.png', normal: 'Kit__Normal.png' },
      'Boots': { map: 'boot.png', normal: 'Boots_Normal.png' },
      '04 - Default': { color: 0x1a1410, alpha: true },
    },
  },
};

const RX = {
  hipL: /(L_Thigh|LeftUpLeg)/i, kneeL: /(L_Calf|LeftLeg_)/i,
  hipR: /(R_Thigh|RightUpLeg)/i, kneeR: /(R_Calf|RightLeg_)/i,
  armL: /(L_UpperArm|LeftArm_)/i, foreL: /(L_Forearm|LeftForeArm)/i,
  armR: /(R_UpperArm|RightArm_)/i, foreR: /(R_Forearm|RightForeArm)/i,
  spine: /(Bip01_Spine1$|Spine1_02)/i,
  head: /(Head1$|Head_05)/i,
};

function convertMaterials(root, cfg) {
  root.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.castShadow = true;
    o.receiveShadow = false;
    o.frustumCulled = false;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const out = list.map(m => {
      const rule = cfg.tex && cfg.tex[m.name];
      const std = new THREE.MeshStandardMaterial({
        name: m.name,
        color: rule && rule.color !== undefined ? rule.color : 0xffffff,
        map: rule && rule.map ? tex(cfg.dir + rule.map) : (m.map || null),
        normalMap: rule && rule.normal ? tex(cfg.dir + rule.normal, false) : (m.normalMap || null),
        roughness: 0.74, metalness: 0.02,
        transparent: !!(rule && rule.alpha),
        alphaTest: rule && rule.alpha ? 0.4 : 0,
        side: rule && rule.alpha ? THREE.DoubleSide : THREE.FrontSide,
        envMapIntensity: 0.7,
      });
      if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
      return std;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
    if (/RootNode/i.test(o.name) || /Object0/i.test(o.name)) o.visible = false;
  });
}

function nameplate(text, sub) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(8,11,18,0.78)';
  c.beginPath(); c.roundRect(8, 30, 496, 68, 12); c.fill();
  c.strokeStyle = 'rgba(127,255,171,0.55)'; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#7fffab';
  c.font = 'bold 46px "JetBrains Mono", monospace';
  c.textBaseline = 'middle';
  c.fillText(sub, 30, 65);
  c.fillStyle = '#eef4fb';
  c.font = 'bold 44px "Space Grotesk", system-ui, sans-serif';
  c.fillText(text, 110, 65);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  sp.scale.set(2.2, 0.55, 1);
  sp.position.y = 2.5;
  sp.renderOrder = 10;
  return sp;
}

/* Devuelve { root, apply(state), label } listo para colgar del grupo del jugador */
export async function loadHero(kind, { yaw = 0 } = {}) {
  const cfg = HEROES[kind];
  const raw = await new FBXLoader().loadAsync(cfg.url);
  raw.animations.length = 0;
  convertMaterials(raw, cfg);

  const box = new THREE.Box3().setFromObject(raw);
  const size = box.getSize(new THREE.Vector3());
  const s = cfg.height / size.y;
  raw.scale.setScalar(s);
  raw.position.y = -box.min.y * s;
  raw.position.x = -((box.min.x + box.max.x) / 2) * s;
  raw.position.z = -((box.min.z + box.max.z) / 2) * s;

  const root = new THREE.Group();
  root.name = 'HERO_' + kind;
  root.rotation.y = yaw;
  root.add(raw);
  const plate = nameplate(cfg.label, cfg.number);
  root.add(plate);
  root.updateMatrixWorld(true);

  // huesos + eje de flexión (X del mundo expresado en el espacio local del hueso)
  const B = {}, rest = {}, ax = {}, az = {};
  const found = new Set();
  raw.traverse(o => {
    if (!o.isBone) return;
    for (const k in RX) {
      if (found.has(k) || !RX[k].test(o.name)) continue;
      found.add(k);
      B[k] = o;
      rest[k] = o.quaternion.clone();
      const wq = new THREE.Quaternion();
      o.getWorldQuaternion(wq).invert();
      ax[k] = new THREE.Vector3(1, 0, 0).applyQuaternion(wq).normalize();
      az[k] = new THREE.Vector3(0, 0, 1).applyQuaternion(wq).normalize();
    }
  });

  const q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  const set = (k, angX, angZ = 0) => {
    const b = B[k];
    if (!b) return;
    b.quaternion.copy(rest[k]);
    if (angX) { q.setFromAxisAngle(ax[k], angX); b.quaternion.multiply(q); }
    if (angZ) { q2.setFromAxisAngle(az[k], angZ); b.quaternion.multiply(q2); }
  };

  /* mapea las articulaciones del motor (player-rig.js) a los huesos del FBX */
  const Z0 = 0.62;                         // compensación de la pose de reposo del FBX (brazos)
  function applyJoints(J) {
    set('hipL', -J.hipL, -J.hipAbL); set('hipR', -J.hipR, J.hipAbR);
    set('kneeL', J.kneeL); set('kneeR', J.kneeR);
    set('armL', -J.shXL, -(Z0 + J.shZL * 0.85)); set('armR', -J.shXR, Z0 + J.shZR * 0.85);
    set('foreL', -J.elL); set('foreR', -J.elR);
    set('spine', J.lean * HERO_SPINE, J.side);
    set('head', J.head * HERO_SPINE, 0);
  }
  return { root, applyJoints, plate, label: cfg.label, bounce: kind === 'ronaldo' ? 0.05 : 0.04 };
}
let HERO_SPINE = 1;
export function setHeroSpineSign(s) { HERO_SPINE = s; }
