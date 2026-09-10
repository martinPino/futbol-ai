// FOOTBALL KIT — procedural stadium, teams, officials & ball (1 unit = 1 m)
import * as THREE from 'three';
import { loadWakrahReal, alignWakrah } from './stadium-model.js';

const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0, ...o });
function mesh(geo, mat, name) { const m = new THREE.Mesh(geo, mat); m.name = name; return m; }
function box(w, h, d, mat, name) { return mesh(new THREE.BoxGeometry(w, h, d), mat, name); }
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ---------- pitch dimensions (FIFA) ---------- */
const L = 105, W = 68;                 // length (z), width (x)

/* ---------- textures ---------- */
/* líneas reglamentarias pintadas en la textura (nitidez por mipmaps/anisotropía, sin z-fighting) */
function paintLines(ctx, S, pad) {
  const Wt = W + pad * 2, Lt = L + pad * 2;          // metros cubiertos por la textura
  const px = S / Wt, pz = S / Lt;                    // píxeles por metro
  const X = x => (x + Wt / 2) * px, Y = z => (z + Lt / 2) * pz;   // z → fila (textura: y=0 → z=-L/2)
  const lw = 0.12 * px;
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  const pass = (col, w) => {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w;
    const R = (x0, z0, x1, z1) => ctx.strokeRect(X(x0), Y(z0), (x1 - x0) * px, (z1 - z0) * pz);
    const Ln = (x0, z0, x1, z1) => { ctx.beginPath(); ctx.moveTo(X(x0), Y(z0)); ctx.lineTo(X(x1), Y(z1)); ctx.stroke(); };
    const Arc = (x, z, r, a0, a1) => { ctx.beginPath(); ctx.ellipse(X(x), Y(z), r * px, r * pz, 0, a0, a1); ctx.stroke(); };
    R(-W / 2, -L / 2, W / 2, L / 2);
    Ln(-W / 2, 0, W / 2, 0);
    Arc(0, 0, 9.15, 0, Math.PI * 2);
    ctx.beginPath(); ctx.ellipse(X(0), Y(0), 0.16 * px, 0.16 * pz, 0, 0, 6.3); ctx.fill();
    for (const s of [1, -1]) {
      const gz = s * L / 2;
      R(-20.16, Math.min(gz, gz - s * 16.5), 20.16, Math.max(gz, gz - s * 16.5));
      R(-9.16, Math.min(gz, gz - s * 5.5), 9.16, Math.max(gz, gz - s * 5.5));
      ctx.beginPath(); ctx.ellipse(X(0), Y(gz - s * 11), 0.16 * px, 0.16 * pz, 0, 0, 6.3); ctx.fill();
      const a = Math.acos(5.5 / 9.15);
      // arco fuera del área: hacia el centro del campo
      const mid = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      Arc(0, gz - s * 11, 9.15, mid - a, mid + a);
    }
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const a0 = Math.atan2(-sz, -sx);
      Arc(sx * W / 2, sz * L / 2, 1, a0 - Math.PI / 4, a0 + Math.PI / 4);
    }
  };
  pass('rgba(245,247,244,0.28)', lw * 1.9);   // halo de cal difuminada
  pass('rgba(248,250,248,0.96)', lw);
  // desgaste irregular de la cal: huecos pequeños a lo largo de las líneas
  const rr = rng(11);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9000; i++) {
    const x = rr() * S, y = rr() * S;
    ctx.fillStyle = `rgba(0,0,0,${0.15 + rr() * 0.35})`;
    ctx.beginPath(); ctx.ellipse(x, y, 0.8 + rr() * 1.6, 0.8 + rr() * 1.6, 0, 0, 6.3); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
function grassTexture(withLines = false, pad = 6) {
  const S = 4096, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#2c6e30'; ctx.fillRect(0, 0, S, S);
  const stripes = 14, sh = S / stripes;
  for (let i = 0; i < stripes; i++) {
    const g = ctx.createLinearGradient(0, i * sh, 0, (i + 1) * sh);   // sombreado de siega
    if (i % 2) { g.addColorStop(0, '#2a6a2e'); g.addColorStop(0.5, '#2f7434'); g.addColorStop(1, '#28632c'); }
    else { g.addColorStop(0, '#348439'); g.addColorStop(0.5, '#3a9242'); g.addColorStop(1, '#317e38'); }
    ctx.fillStyle = g;
    ctx.fillRect(0, i * sh, S, sh);
  }
  const r = rng(7);
  ctx.globalAlpha = 0.09;
  for (let i = 0; i < stripes; i += 2) {
    ctx.fillStyle = '#3f9a48';
    ctx.fillRect(sh * i, 0, sh, S);
  }
  ctx.globalAlpha = 1;
  // manchas de tono a baja frecuencia (variación natural del césped)
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${30 + r() * 30},${100 + r() * 50},${30 + r() * 26},${0.04 + r() * 0.05})`;
    const rad = S * (0.02 + r() * 0.06);
    ctx.beginPath(); ctx.ellipse(r() * S, r() * S, rad, rad * (0.4 + r() * 0.6), r() * 3, 0, 6.3); ctx.fill();
  }
  // wear: goalmouths + center circle + penalty spots (brown, patchy)
  const wear = (cx, cy, rad, str) => {
    for (let i = 0; i < 420 * str; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * rad;
      ctx.fillStyle = `rgba(${106 + r() * 40},${82 + r() * 30},${44 + r() * 20},${0.05 + r() * 0.09})`;
      const s2 = 5 + r() * 24;
      ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, s2, s2 * 0.6, r() * 3, 0, 6.3); ctx.fill();
    }
  };
  const gm = withLines ? (L / 2 - 2) / (L + pad * 2) : 0.455;   // posición relativa de las bocas de gol
  wear(S / 2, S * (0.5 - gm), S * 0.06, 1.4);
  wear(S / 2, S * (0.5 + gm), S * 0.06, 1.4);
  wear(S / 2, S / 2, S * 0.075, 1.0);
  wear(S / 2, S * (0.5 - gm * 0.76), S * 0.028, 0.5);
  wear(S / 2, S * (0.5 + gm * 0.76), S * 0.028, 0.5);
  // briznas en tres frecuencias
  for (let i = 0; i < 260000; i++) {
    ctx.fillStyle = `rgba(${16 + r() * 44},${84 + r() * 84},${22 + r() * 44},0.13)`;
    ctx.fillRect(r() * S, r() * S, 1.6, 3 + r() * 2.4);
  }
  for (let i = 0; i < 60000; i++) {
    ctx.fillStyle = `rgba(${10 + r() * 20},${60 + r() * 40},${16 + r() * 20},0.16)`;
    ctx.fillRect(r() * S, r() * S, 1, 2 + r() * 2);
  }
  for (let i = 0; i < 40000; i++) {
    ctx.fillStyle = `rgba(255,255,235,${0.02 + r() * 0.06})`;
    ctx.fillRect(r() * S, r() * S, 1, 1.8);
  }
  if (withLines) paintLines(ctx, S, pad);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
/* normal map de micro-relieve para el césped */
function grassNormal() {
  const S = 1024, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#8080ff'; ctx.fillRect(0, 0, S, S);
  const r = rng(13);
  for (let i = 0; i < 90000; i++) {
    ctx.fillStyle = `rgba(${108 + (r() * 40) | 0},${108 + (r() * 40) | 0},255,0.55)`;
    ctx.fillRect(r() * S, r() * S, 1.5, 2.5);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  return t;
}
function grassRoughness() {
  const S = 1024, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 0, S, S);
  const stripes = 14;
  for (let i = 0; i < stripes; i += 2) {   // mowed-away stripes catch more sheen
    ctx.fillStyle = '#d2d2d2';
    ctx.fillRect(0, (S / stripes) * i, S, S / stripes);
  }
  const r = rng(5);
  for (let i = 0; i < 24000; i++) {
    const v = 180 + (r() * 70) | 0;
    ctx.fillStyle = `rgba(${v},${v},${v},0.25)`;
    ctx.fillRect(r() * S, r() * S, 1.5, 2.5);
  }
  return new THREE.CanvasTexture(cv);
}
function crowdTexture(seed) {
  const Wc = 1024, Hc = 256, cv = document.createElement('canvas');
  cv.width = Wc; cv.height = Hc;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#20242c'; ctx.fillRect(0, 0, Wc, Hc);
  const r = rng(seed);
  const cols = ['#c8ccd4', '#8f2f2f', '#2f4f8f', '#caa84a', '#3a3f48', '#7a8494', '#5f2f6f', '#2f6f4f'];
  for (let y = 8; y < Hc - 4; y += 11) {
    for (let x = 5 + (y % 22) / 2; x < Wc - 4; x += 9) {
      if (r() > 0.94) continue;                       // empty seats
      ctx.fillStyle = cols[(r() * cols.length) | 0];
      ctx.beginPath(); ctx.arc(x + r() * 2, y + r() * 2, 2.6 + r() * 1.2, 0, 6.3); ctx.fill();
      ctx.fillStyle = `rgba(232,190,160,0.9)`;
      ctx.beginPath(); ctx.arc(x + r() * 2, y - 3 + r(), 1.5, 0, 6.3); ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function ballTexture() {
  const S = 1024, cv = document.createElement('canvas');
  cv.width = S; cv.height = S / 2;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f6f6f4'; ctx.fillRect(0, 0, S, S / 2);
  const rr = rng(21);
  for (let i = 0; i < 9000; i++) {                     // grano de cuero
    ctx.fillStyle = rr() > 0.5 ? `rgba(0,0,0,${rr() * 0.05})` : `rgba(255,255,255,${rr() * 0.06})`;
    ctx.fillRect(rr() * S, rr() * S / 2, 1.6, 1.6);
  }
  // pentagon spots at icosahedral-ish anchors (equirect projection)
  const spots = [];
  for (let i = 0; i < 6; i++) spots.push([i / 6 + 0.08, 0.5]);
  for (let i = 0; i < 5; i++) spots.push([i / 5 + 0.02, 0.2], [i / 5 + 0.12, 0.8]);
  const pent = (cx, cy, r, rot) => {
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = rot + k * Math.PI * 2 / 5;
      ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  };
  spots.forEach(([u, v], i) => {
    const stretch = 1 / Math.max(0.4, Math.sin(v * Math.PI));
    ctx.save();
    ctx.translate(u * S, v * S / 2);
    ctx.scale(stretch, 1);
    ctx.fillStyle = '#17181c';
    pent(0, 0, 34, i);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';              // costuras
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let k = 0; k <= 5; k++) {
      const a = i + k * Math.PI * 2 / 5;
      ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * 52, Math.sin(a) * 52);
    }
    ctx.stroke();
    ctx.restore();
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}
function scoreboardTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 160;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0a0d12'; ctx.fillRect(0, 0, 512, 160);
  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff4a2a'; ctx.fillText('LOC 0', 140, 62);
  ctx.fillStyle = '#e8ecf2'; ctx.fillText(':', 256, 58);
  ctx.fillStyle = '#39a6ff'; ctx.fillText('0 VIS', 372, 62);
  ctx.font = 'bold 40px monospace';
  ctx.fillStyle = '#caa84a'; ctx.fillText("45' + 2", 256, 122);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ============================================================
   PITCH — grass, all regulation markings, goals, flags
   ============================================================ */
/* capa de estadio (franjas de siega, desgaste y líneas) con alfa: se multiplica sobre el césped PBR real */
function pitchOverlayTexture(pad) {
  const S = 4096, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  const stripes = 14, sh = S / stripes;
  for (let i = 0; i < stripes; i++) {          // franjas: solo oscurecen (multiplicativo), alternando intensidad
    ctx.fillStyle = i % 2 ? 'rgba(0,18,0,0.22)' : 'rgba(0,0,0,0)';
    ctx.fillRect(0, i * sh, S, sh);
    const g = ctx.createLinearGradient(0, i * sh, 0, (i + 1) * sh);   // filo de siega
    g.addColorStop(0, 'rgba(0,0,0,0.14)'); g.addColorStop(0.08, 'rgba(0,0,0,0)'); g.addColorStop(0.92, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, i * sh, S, sh);
  }
  const r = rng(7);
  for (let i = 0; i < 90; i++) {               // variación de tono a baja frecuencia: gradientes radiales suaves, solo oscurecen
    const cx = r() * S, cy = r() * S, rad = S * (0.05 + r() * 0.1);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(40,90,40,${0.02 + r() * 0.025})`); g.addColorStop(1, 'rgba(40,90,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, rad, rad * (0.5 + r() * 0.5), r() * 3, 0, 6.3); ctx.fill();
  }
  const wear = (cx, cy, rad, str) => {
    for (let i = 0; i < 380 * str; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.5) * rad;
      const edge = 1 - d / rad;                 // se desvanece hacia el borde
      ctx.fillStyle = `rgba(${120 + r() * 40},${96 + r() * 30},${52 + r() * 20},${(0.03 + r() * 0.07) * edge})`;
      const s2 = 5 + r() * 24;
      ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, s2, s2 * 0.6, r() * 3, 0, 6.3); ctx.fill();
    }
  };
  const gm = (L / 2 - 2) / (L + pad * 2);
  wear(S / 2, S * (0.5 - gm), S * 0.055, 1.3); wear(S / 2, S * (0.5 + gm), S * 0.055, 1.3);
  wear(S / 2, S / 2, S * 0.05, 0.6);
  wear(S / 2, S * (0.5 - gm * 0.76), S * 0.024, 0.4); wear(S / 2, S * (0.5 + gm * 0.76), S * 0.024, 0.4);
  paintLines(ctx, S, pad);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
}
const TL = new THREE.TextureLoader();
function pbrTex(url, srgb, rep) {
  const t = TL.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep.x, rep.y); t.anisotropy = 16;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/* césped PBR real (ambientCG Grass004, CC0) + capa de estadio en el shader */
function realGrassMaterial(pad) {
  const Wt = W + pad * 2, Lt = L + pad * 2;
  const rep = new THREE.Vector2(Wt / 1.4, Lt / 1.4);          // tile físico de 1.4 m
  const mat = new THREE.MeshStandardMaterial({
    map: pbrTex('./assets/grass/Grass004_Color.jpg', true, rep),
    normalMap: pbrTex('./assets/grass/Grass004_NormalGL.jpg', false, rep),
    roughnessMap: null,                                       // el mapa de rugosidad de Grass004 deja zonas especulares: césped mate uniforme
    aoMap: pbrTex('./assets/grass/Grass004_AO.jpg', false, rep),
    displacementMap: pbrTex('./assets/grass/Grass004_Displacement.jpg', false, rep),
    displacementScale: 0.06, displacementBias: -0.03,        // relieve real de las briznas (±3 cm)
    normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.92, metalness: 0, envMapIntensity: 0.15, color: 0x6dae55,
  });
  const overlay = pitchOverlayTexture(pad);
  mat.onBeforeCompile = sh => {
    sh.uniforms.tOverlay = { value: overlay };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tOverlay;\nvarying vec2 vOvUv;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec4 ov = texture2D(tOverlay, vOvUv);
        // saturar el albedo hacia verde de estadio y recortar las briznas más claras (evita puntos blancos/grises)
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 1.4) * vec3(0.82, 1.06, 0.7);
        diffuseColor.rgb = min(diffuseColor.rgb, vec3(0.66, 0.82, 0.54));
        // líneas de cal: césped pintado (misma textura de briznas, blanqueada) en lugar de blanco plano
        float isLine = smoothstep(0.55, 0.85, min(min(ov.r, ov.g), ov.b)) * ov.a;
        vec3 tinted = diffuseColor.rgb * mix(vec3(1.0), min(ov.rgb * 2.0, vec3(1.05)), ov.a * (1.0 - isLine));
        float lumL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 chalkGrass = mix(vec3(lumL), diffuseColor.rgb, 0.18) * 1.55 + vec3(0.14);   // briznas cubiertas de cal, textura conservada
        chalkGrass = min(chalkGrass, vec3(0.93));
        diffuseColor.rgb = mix(tinted, chalkGrass, isLine * ov.a * 0.92);`);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vOvUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvOvUv = uv;');
  };
  mat.customProgramCacheKey = () => 'grass-overlay';
  return mat;
}

export function buildPitch({ goals = true, pad = 6 } = {}) {
  const G = new THREE.Group(); G.name = 'PITCH_Reglamentario';
  const geo = new THREE.PlaneGeometry(W + pad * 2, L + pad * 2, 320, 480);   // subdividido para el displacement
  geo.setAttribute('uv1', geo.attributes.uv);                     // aoMap
  const grass = mesh(geo, realGrassMaterial(pad), 'Grass');
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  G.add(grass);
  // marcas de área muy tenues en relieve no hacen falta: las líneas van en la textura
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const pole = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), M({ color: 0xf2c718 }), 'Corner_Pole');
    pole.position.set(sx * W / 2, 0.75, sz * L / 2);
    const flag = box(0.42, 0.3, 0.015, M({ color: 0xe23a2e, roughness: 0.6 }), 'Corner_Flag');
    flag.position.set(sx * W / 2 - sx * 0.21, 1.32, sz * L / 2);
    G.add(pole, flag);
  }
  if (goals) for (const s of [1, -1]) {
    const goal = buildGoal();
    goal.position.set(0, 0, s * L / 2);
    if (s > 0) goal.rotation.y = Math.PI;
    goal.name = `Porteria_${s > 0 ? 'N' : 'S'}`;
    G.add(goal);
  }
  return G;
}

export function buildGoal() {
  // contenedor: la portería procedural se muestra hasta que carga el GLB real (football_net.glb) y se sustituye
  const G = new THREE.Group(); G.name = 'Porteria';
  const proc = buildGoalProcedural(); proc.name = 'Porteria_procedural';
  proc.visible = false;                  // solo como respaldo si el GLB falla (evita el parpadeo de dos porterías)
  G.add(proc);
  loadGoalGLB().then(tpl => {
    const m = tpl.clone(true);
    m.name = 'Porteria_GLB';
    G.remove(proc);
    G.add(m);
  }).catch(e => { console.warn('portería GLB no disponible, se mantiene la procedural', e); proc.visible = true; });
  return G;
}
let goalPromise = null;
function loadGoalGLB() {
  if (goalPromise) return goalPromise;
  goalPromise = import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync('./assets/goal/football_net.glb')).then(g => {
    const s = g.scene;
    s.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(s);
    const size = bb.getSize(new THREE.Vector3());
    // el modelo abre su boca hacia +X y la línea de gol corre a lo largo de Z; nuestro convenio: boca hacia -Z (campo), línea a lo largo de X
    const wrap = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(s);
    // centrar: línea de gol (frente de postes, x máx) en el origen; base (y mín) en 0; centro en z
    s.position.set(-bb.max.x + 0.06, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    const sy = 2.44 / size.y, sz = 7.32 / size.z, sx = 2.2 / size.x;   // profundidad ~2.2 m
    inner.scale.set(sx, sy, sz);
    inner.rotation.y = -Math.PI / 2;     // +X (boca) → +Z: buildPitch coloca la porteríaS sin girar mirando al campo (+Z) y gira la N 180°
    wrap.add(inner);
    s.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const m = o.material;
      if (/Cylinder/i.test(o.name)) { m.color.set(0xf4f4f4); m.roughness = 0.35; m.metalness = 0.15; }   // postes
      else if (/Plane/i.test(o.name)) { o.visible = false; }                                                 // suelo del modelo
      else { m.color.set(0xf2f2f2); m.roughness = 0.9; m.metalness = 0; m.side = THREE.DoubleSide; }        // red
    });
    return wrap;
  });
  return goalPromise;
}
function buildGoalProcedural() {
  const G = new THREE.Group(); G.name = 'PROP_Porteria';
  const white = M({ color: 0xf4f6f8, roughness: 0.25, metalness: 0.65, envMapIntensity: 1.1 });
  const r = 0.06, w = 7.32, h = 2.44, depth = 1.9;
  const postL = mesh(new THREE.CylinderGeometry(r, r, h, 10), white, 'Post_L');
  postL.position.set(-w / 2, h / 2, 0);
  const postR = postL.clone(); postR.name = 'Post_R'; postR.position.x = w / 2;
  const bar = mesh(new THREE.CylinderGeometry(r, r, w + r * 2, 10), white, 'Crossbar');
  bar.rotation.z = Math.PI / 2; bar.position.set(0, h, 0);
  G.add(postL, postR, bar);
  for (const s of [-1, 1]) {
    const stay = mesh(new THREE.CylinderGeometry(0.035, 0.035, Math.hypot(h, depth), 8), white, 'Stay');
    stay.position.set(s * w / 2, h / 2, -depth / 2);
    stay.rotation.x = Math.atan2(depth, h);
    G.add(stay);
  }
  const netMat = new THREE.MeshBasicMaterial({
    color: 0xdfe4ea, wireframe: true, transparent: true, opacity: 0.35,
    side: THREE.DoubleSide,
  });
  // open mouth: back + two sides + roof, never a closed box
  const netPart = (w2, h2, sw, sh, name) => {
    const m = mesh(new THREE.PlaneGeometry(w2, h2, sw, sh), netMat, name);
    G.add(m); return m;
  };
  const back = netPart(w, h, 24, 8, 'Net_Back');
  back.position.set(0, h / 2, -depth);
  const roof = netPart(w, depth, 24, 6, 'Net_Roof');
  roof.rotation.x = -Math.PI / 2; roof.position.set(0, h, -depth / 2);
  for (const s of [-1, 1]) {
    const side = netPart(depth, h, 6, 8, `Net_Side_${s > 0 ? 'R' : 'L'}`);
    side.rotation.y = Math.PI / 2;
    side.position.set(s * w / 2, h / 2, -depth / 2);
  }
  return G;
}

/* ============================================================
   FIGURES — articulated mannequin players (smooth, posed, striped kits)
   ============================================================ */
function stripeTexture(a, b, stripes = 10) {
  const S = 1024, cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const ca = '#' + a.toString(16).padStart(6, '0'), cb = '#' + b.toString(16).padStart(6, '0');
  ctx.fillStyle = ca; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = cb;
  const w = S / stripes;
  for (let i = 0; i < stripes; i += 2) ctx.fillRect(i * w, 0, w, S);
  // solid yoke across the top: hides the pole pinch at the shoulders
  ctx.fillRect(0, 0, S, S * 0.13);
  // trama de tejido: hilos horizontales + grano fino
  const r = rng(a ^ b);
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < S; y += 3) ctx.fillRect(0, y, S, 1);
  ctx.globalAlpha = 1;
  for (let i = 0; i < 26000; i++) {
    const l = r();
    ctx.fillStyle = l > 0.5 ? `rgba(255,255,255,${0.02 + r() * 0.05})` : `rgba(0,0,0,${0.02 + r() * 0.06})`;
    ctx.fillRect(r() * S, r() * S, 1.6, 1.6);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}
const NUM_CACHE = new Map();
export function numberTexture(n, fg = '#f4f6f8') {
  const key = n + fg;
  if (NUM_CACHE.has(key)) return NUM_CACHE.get(key);
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 160;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 128, 160);
  ctx.font = '900 118px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(10,10,12,0.85)';
  ctx.strokeText(n, 64, 86);
  ctx.fillStyle = fg;
  ctx.fillText(n, 64, 86);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  NUM_CACHE.set(key, t);
  return t;
}
const POSES = {
  stand: { lean: 0.02, hipL: 0.05, hipR: -0.05, kneeL: 0.06, kneeR: 0.06, shXL: 0, shXR: 0, shZ: 0.16, elL: 0.12, elR: 0.12, head: 0 },
  walk: { lean: 0.06, hipL: 0.38, hipR: -0.26, kneeL: 0.28, kneeR: 0.5, shXL: -0.34, shXR: 0.3, shZ: 0.14, elL: 0.35, elR: 0.5, head: 0 },
  run: { lean: 0.24, hipL: 1.0, hipR: -0.62, kneeL: 0.55, kneeR: 1.3, shXL: -0.9, shXR: 0.82, shZ: 0.18, elL: 1.15, elR: 1.25, head: -0.08 },
  kick: { lean: -0.1, hipL: -0.16, hipR: 1.25, kneeL: 0.12, kneeR: 0.18, shXL: -0.45, shXR: 0.2, shZ: 0.85, elL: 0.25, elR: 0.3, head: 0.1 },
  keeper: { lean: 0.04, hipL: 0.08, hipR: -0.08, kneeL: 0.12, kneeR: 0.12, shXL: 0.35, shXR: 0.35, shZ: 2.2, elL: 0.5, elR: 0.5, head: -0.15 },
  celebrate: { lean: -0.14, hipL: 0.04, hipR: -0.04, kneeL: 0.05, kneeR: 0.05, shXL: 0, shXR: 0, shZ: 2.9, elL: 0.1, elR: 0.1, head: -0.55 },
};
/* lofted body part: elliptical cross-sections swept along a curve */
function loft(points, radii, mat, name, { samples = 22, ring = 16, capTop = true, capBot = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  const P = [], UV = [], IDX = [];
  const nSeg = points.length - 1;
  const rad = (t) => {
    const f = Math.min(nSeg - 1e-6, t * nSeg), i = Math.floor(f), fr = f - i;
    return [radii[i][0] + (radii[i + 1][0] - radii[i][0]) * fr,
            radii[i][1] + (radii[i + 1][1] - radii[i][1]) * fr];
  };
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const c = curve.getPoint(t);
    const dir = curve.getTangent(t).normalize();
    const ref = Math.abs(dir.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const side = dir.clone().cross(ref).normalize();
    const up2 = side.clone().cross(dir).normalize();
    const [rx, rz] = rad(t);
    for (let j = 0; j <= ring; j++) {
      const a = (j / ring) * Math.PI * 2;
      P.push(c.x + Math.cos(a) * side.x * rx + Math.sin(a) * up2.x * rz,
             c.y + Math.cos(a) * side.y * rx + Math.sin(a) * up2.y * rz,
             c.z + Math.cos(a) * side.z * rx + Math.sin(a) * up2.z * rz);
      UV.push(j / ring, t);
    }
  }
  const row = ring + 1;
  for (let i = 0; i < samples; i++)
    for (let j = 0; j < ring; j++) {
      const a = i * row + j, b = a + row;
      IDX.push(a, b, a + 1, b, b + 1, a + 1);
    }
  for (const [on, rowI, flip] of [[capBot, 0, false], [capTop, samples, true]]) {
    if (!on) continue;
    const c = curve.getPoint(rowI / samples);
    const ci = P.length / 3;
    P.push(c.x, c.y, c.z); UV.push(0.5, rowI / samples);
    for (let j = 0; j < ring; j++) {
      const a = rowI * row + j;
      if (flip) IDX.push(ci, a, a + 1); else IDX.push(ci, a + 1, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(IDX);
  g.computeVertexNormals();
  return mesh(g, mat, name);
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* poses paramétricas de ciclo de marcha/carrera + poses extra (flipbook del juego) */
export function gaitPose(type, ph) {
  const s = Math.sin(ph);
  if (type === 'run') return {
    lean: 0.24, hipL: 0.95 * s, hipR: -0.95 * s,
    kneeL: 0.28 + 1.05 * Math.max(0, -Math.sin(ph - 0.55)), kneeR: 0.28 + 1.05 * Math.max(0, Math.sin(ph - 0.55)),
    shXL: -0.8 * s, shXR: 0.8 * s, shZ: 0.18, elL: 1.15, elR: 1.15, head: -0.08,
  };
  return {
    lean: 0.06, hipL: 0.36 * s, hipR: -0.36 * s,
    kneeL: 0.12 + 0.45 * Math.max(0, -Math.sin(ph - 0.5)), kneeR: 0.12 + 0.45 * Math.max(0, Math.sin(ph - 0.5)),
    shXL: -0.3 * s, shXR: 0.3 * s, shZ: 0.14, elL: 0.4, elR: 0.45, head: 0,
  };
}
export const EXTRA_POSES = {
  kick0: { lean: 0.1, hipL: 0.25, hipR: -0.75, kneeL: 0.15, kneeR: 1.2, shXL: 0.35, shXR: -0.45, shZ: 0.5, elL: 0.4, elR: 0.5, head: 0.05 },
  kick2: { lean: -0.18, hipL: -0.2, hipR: 1.7, kneeL: 0.25, kneeR: 0.12, shXL: -0.6, shXR: 0.35, shZ: 0.7, elL: 0.3, elR: 0.35, head: 0.05 },
  slide: { lean: -0.7, hipL: 0.55, hipR: 1.45, kneeL: 1.5, kneeR: 0.06, shXL: -0.9, shXR: 0.6, shZ: 0.6, elL: 0.8, elR: 0.4, head: 0.15 },
  fall: { lean: -0.25, hipL: 0.5, hipR: 0.35, kneeL: 0.8, kneeR: 0.6, shXL: 0.8, shXR: 0.8, shZ: 1.4, elL: 0.6, elR: 0.6, head: 0.2 },
};

export function buildFigure({
  stripeA = 0xf2d418, stripeB = 0x17181c, shorts = 0x17181c, socks = 0x17181c,
  solid = null, name = 'FIG_Jugador', flag = null, pose = 'stand',
  skin = 0xc98d68, hair = 0x241a12, number = null,
} = {}) {
  const G = new THREE.Group(); G.name = name;
  const P = typeof pose === 'object' ? pose : (POSES[pose] || POSES.stand);
  const mSkin = M({ color: skin, roughness: 0.6 });
  const mHair = M({ color: hair, roughness: 0.85 });
  const mShirt = solid !== null
    ? M({ color: solid, roughness: 0.78 })
    : M({ map: stripeTexture(stripeA, stripeB), color: 0xffffff, roughness: 0.78 });
  const mTrim = M({ color: solid !== null ? 0x17181c : stripeB, roughness: 0.8 });
  const mShorts = M({ color: shorts, roughness: 0.8 });
  const mSocks = M({ color: socks, roughness: 0.8 });
  const mBoot = M({ color: 0x101114, roughness: 0.42, metalness: 0.1 });
  const lean = P.lean, zAt = (y) => Math.sin(lean) * Math.max(0, y - 0.96);

  /* legs: one continuous skin loft hip->knee->calf->ankle, layered kit */
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L';
    const hipA = s > 0 ? P.hipR : P.hipL;
    const kneeB = s > 0 ? P.kneeR : P.kneeL;
    const hip = V3(s * 0.095, 0.94, 0);
    const thighDir = V3(0, -Math.cos(hipA), Math.sin(hipA));
    const knee = hip.clone().addScaledVector(thighDir, 0.44);
    const shinA = hipA - kneeB;
    const shinDir = V3(0, -Math.cos(shinA), Math.sin(shinA));
    const ankle = knee.clone().addScaledVector(shinDir, 0.42);
    const midT = hip.clone().lerp(knee, 0.5).add(V3(0, 0, 0.008));
    const midC = knee.clone().lerp(ankle, 0.45).add(V3(0, 0, -0.014));
    G.add(loft([hip, midT, knee, midC, ankle],
      [[0.088, 0.082], [0.073, 0.068], [0.055, 0.058], [0.058, 0.062], [0.033, 0.035]],
      mSkin, `Pierna_${side}`));
    const shortEnd = hip.clone().lerp(knee, 0.42);
    G.add(loft([hip.clone().add(V3(0, 0.03, 0)), shortEnd],
      [[0.1, 0.094], [0.082, 0.077]], mShorts, `Short_${side}`, { samples: 8 }));
    const sockTop = knee.clone().lerp(ankle, 0.12);
    G.add(loft([sockTop, midC.clone(), ankle.clone().add(V3(0, -0.015, 0))],
      [[0.058, 0.061], [0.061, 0.065], [0.037, 0.039]], mSocks, `Media_${side}`, { samples: 10 }));
    const fwd = shinDir.clone().cross(V3(1, 0, 0)).normalize();  // +z toe, both sides
    if (fwd.z < 0) fwd.negate();
    const heel = ankle.clone().add(V3(0, -0.055, 0)).addScaledVector(fwd, -0.055);
    const arch = ankle.clone().add(V3(0, -0.068, 0)).addScaledVector(fwd, 0.05);
    const toe = ankle.clone().add(V3(0, -0.062, 0)).addScaledVector(fwd, 0.155);
    G.add(loft([heel, arch, toe], [[0.042, 0.05], [0.05, 0.055], [0.028, 0.032]],
      mBoot, `Bota_${side}`, { samples: 10 }));
  }

  /* torso: pelvis->waist->chest->shoulders->neck, one smooth loft */
  const tPath = [], tRad = [];
  [[0.86, 0.155, 0.115], [0.98, 0.165, 0.118], [1.08, 0.142, 0.104],
   [1.24, 0.172, 0.12], [1.4, 0.19, 0.115], [1.5, 0.078, 0.078]]
    .forEach(([y, rx, rz]) => { tPath.push(V3(0, y, zAt(y))); tRad.push([rx, rz]); });
  G.add(loft(tPath.slice(0, 3), tRad.slice(0, 3), mShorts, 'Pelvis', { samples: 8, capTop: false }));
  G.add(loft(tPath.slice(1), tRad.slice(1), mShirt, 'Camiseta', { samples: 18 }));
  const hem = mesh(new THREE.TorusGeometry(0.163, 0.012, 8, 24), mTrim, 'Bajo_Camiseta');
  hem.rotation.x = Math.PI / 2;
  hem.scale.set(1, 0.72, 1);
  hem.position.set(0, 1.0, zAt(1.0));
  G.add(hem);
  const collar = mesh(new THREE.TorusGeometry(0.068, 0.013, 8, 20), mTrim, 'Cuello_Camiseta');
  collar.rotation.x = Math.PI / 2 - 0.12;
  collar.position.set(0, 1.5, zAt(1.5));
  G.add(collar);
  if (number !== null) {
    const num = mesh(new THREE.PlaneGeometry(0.19, 0.24),
      new THREE.MeshStandardMaterial({
        map: numberTexture(number), transparent: true, roughness: 0.8,
        polygonOffset: true, polygonOffsetFactor: -1,
      }), 'Dorsal');
    num.position.set(0, 1.27, zAt(1.27) - 0.128);
    num.rotation.y = Math.PI;
    num.rotation.x = -lean;
    G.add(num);
  }

  /* neck + head: skull + jaw blend, hair cap */
  G.add(loft([V3(0, 1.48, zAt(1.48)), V3(0, 1.62, zAt(1.62))],
    [[0.052, 0.055], [0.047, 0.05]], mSkin, 'Cuello', { samples: 6 }));
  const headC = V3(0, 1.71, zAt(1.71) + 0.01);
  const skull = mesh(new THREE.SphereGeometry(0.1, 24, 18), mSkin, 'Craneo');
  skull.scale.set(0.94, 1.22, 1.04);
  skull.position.copy(headC);
  const jaw = mesh(new THREE.SphereGeometry(0.086, 18, 14), mSkin, 'Mandibula');
  jaw.scale.set(0.88, 0.95, 0.95);
  jaw.position.copy(headC).add(V3(0, -0.055, 0.012));
  const hairCap = mesh(new THREE.SphereGeometry(0.103, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), mHair, 'Pelo');
  hairCap.scale.set(0.96, 1.2, 1.06);
  hairCap.position.copy(headC).add(V3(0, 0.012, -0.012));
  G.add(skull, jaw, hairCap);

  /* arms: shoulder->elbow->wrist lofts with biceps/forearm profile */
  const X = V3(1, 0, 0), Z = V3(0, 0, 1);
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L';
    const shX = s > 0 ? P.shXR : P.shXL;
    let shZ = P.shZ;
    if (flag && s > 0) shZ += 0.6;
    const elB = s > 0 ? P.elR : P.elL;
    const sh = V3(s * 0.195, 1.43, zAt(1.43));
    const upDir = V3(0, -1, 0).applyAxisAngle(X, shX).applyAxisAngle(Z, s * shZ);
    const elbow = sh.clone().addScaledVector(upDir, 0.3);
    const elbowAxis = X.clone().applyAxisAngle(Z, s * shZ);
    const foreDir = upDir.clone().applyAxisAngle(elbowAxis, -elB);
    const wrist = elbow.clone().addScaledVector(foreDir, 0.27);
    const foreMid = elbow.clone().lerp(wrist, 0.4);
    G.add(loft([sh, elbow, foreMid, wrist],
      [[0.055, 0.052], [0.041, 0.039], [0.044, 0.041], [0.028, 0.027]],
      mSkin, `Brazo_${side}`, { samples: 16 }));
    const delt = mesh(new THREE.SphereGeometry(0.067, 14, 12), mShirt, `Deltoide_${side}`);
    delt.position.copy(sh).add(V3(s * 0.012, 0.015, 0));
    G.add(delt);
    G.add(loft([sh.clone().addScaledVector(upDir, 0.02), sh.clone().addScaledVector(upDir, 0.15)],
      [[0.062, 0.058], [0.052, 0.049]], mShirt, `Manga_${side}`, { samples: 6 }));
    const hand = mesh(new THREE.SphereGeometry(0.043, 12, 10), mSkin, `Mano_${side}`);
    hand.scale.set(0.8, 1.25, 0.95);
    hand.position.copy(wrist).addScaledVector(foreDir, 0.045);
    hand.quaternion.setFromUnitVectors(V3(0, -1, 0), foreDir.clone().normalize());
    G.add(hand);
    if (flag && s > 0) {
      const pole = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.52, 6), M({ color: 0xd8d8d8 }), 'Bandera_Palo');
      pole.position.copy(wrist).add(V3(0.02, -0.1, 0.04));
      const cloth = box(0.24, 0.19, 0.01, M({ color: flag, roughness: 0.6 }), 'Bandera_Tela');
      cloth.position.copy(wrist).add(V3(0.15, -0.25, 0.04));
      G.add(pole, cloth);
    }
  }
  G.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return G;
}

export const KITS = {
  local: { stripeA: 0xf2d418, stripeB: 0x17181c, shorts: 0x17181c, socks: 0x17181c },     // amarillo/negro
  visitante: { stripeA: 0xe8ecf2, stripeB: 0x1e56c8, shorts: 0x11244e, socks: 0x1e56c8 }, // blanco/azul
  portero_local: { solid: 0x2fae5f, shorts: 0x17181c, socks: 0x2fae5f },
  portero_visitante: { solid: 0xd87a18, shorts: 0x17181c, socks: 0xd87a18 },
  arbitro: { solid: 0x17181c, shorts: 0x17181c, socks: 0x17181c },
};

export function buildBall() {
  const G = buildBallProcedural();
  // sustituir por el GLB del usuario (Football.glb) cuando cargue; el mesh 'Balon' sigue siendo el que rota
  import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync('./assets/ball/Football.glb')).then(g => {
    const s = g.scene; s.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(s), size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const k = 0.22 / Math.max(size.x, size.y, size.z);          // diámetro reglamentario 22 cm
    const holder = new THREE.Group(); holder.name = 'Balon';
    s.position.copy(c).multiplyScalar(-1);                       // centrar en el origen
    holder.add(s); holder.scale.setScalar(k);
    s.traverse(o => { if (o.isMesh) { o.castShadow = true; const m = o.material; if (m) { m.roughness = Math.min(m.roughness ?? 0.5, 0.45); m.metalness = 0; m.envMapIntensity = 0.9; for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) { t.anisotropy = 16; } } } });
    const old = G.getObjectByName('Balon');
    holder.quaternion.copy(old.quaternion);
    G.remove(old); G.add(holder);
    holder.position.y = 0.11;
    if (G.userData.onSwap) G.userData.onSwap(holder);
  }).catch(e => console.warn('balón GLB no disponible', e));
  return G;
}
function buildBallProcedural() {
  const G = new THREE.Group(); G.name = 'PROP_Balon';
  const b = mesh(new THREE.SphereGeometry(0.11, 32, 24),
    M({ map: ballTexture(), color: 0xffffff, roughness: 0.32, envMapIntensity: 0.8 }), 'Balon');
  b.position.y = 0.11;
  b.castShadow = true;
  G.add(b);
  return G;
}

/* ============================================================
   STADIUM — stands with crowds, roof, floodlights, extras
   ============================================================ */
export function buildStadium() {
  const G = new THREE.Group(); G.name = 'ESTADIO_Completo';
  G.add(buildPitch());
  const mConc = M({ color: 0x4a4f58, roughness: 0.9 });
  const mRoof = M({ color: 0x2a2e36, roughness: 0.35, metalness: 0.7, envMapIntensity: 1.0 });
  // 4 grandstands (tiered) with baked crowds
  const sides = [
    { x: 0, z: L / 2 + 22, ry: Math.PI, len: W + 30 },
    { x: 0, z: -L / 2 - 22, ry: 0, len: W + 30 },
    { x: W / 2 + 22, z: 0, ry: -Math.PI / 2, len: L + 14 },
    { x: -W / 2 - 22, z: 0, ry: Math.PI / 2, len: L + 14 },
  ];
  sides.forEach((sd, i) => {
    const stand = new THREE.Group();
    stand.name = `Tribuna_${['N', 'S', 'E', 'W'][i]}`;
    for (let t = 0; t < 3; t++) {
      const step = box(sd.len - t * 8, 3.2, 6, mConc, `Grada_${t + 1}`);
      step.position.set(0, 1.6 + t * 3.2, 6 + t * 5.6);
      stand.add(step);
      const crowd = mesh(new THREE.PlaneGeometry(sd.len - t * 8, 6.4),
        M({ map: crowdTexture(i * 3 + t), roughness: 1 }), `Publico_${t + 1}`);
      crowd.position.set(0, 3.4 + t * 3.2, 3.2 + t * 5.6);
      crowd.rotation.x = -0.62;
      stand.add(crowd);
    }
    const roof = box(sd.len + 2, 0.5, 12, mRoof, 'Techo');
    roof.position.set(0, 12.4, 12); roof.rotation.x = 0.1;
    stand.add(roof);
    // safety railing along the front of the stand
    const rail = box(sd.len, 0.06, 0.06, M({ color: 0xb8bec6, roughness: 0.3, metalness: 0.8 }), 'Barandilla');
    rail.position.set(0, 1.15, 2.6);
    stand.add(rail);
    for (let c = 0; c < 5; c++) {
      const col = mesh(new THREE.CylinderGeometry(0.25, 0.3, 12, 8), mConc, `Columna_${c + 1}`);
      col.position.set(-sd.len / 2 + 4 + c * (sd.len - 8) / 4, 6, 17);
      stand.add(col);
    }
    stand.position.set(sd.x, 0, sd.z);
    stand.rotation.y = sd.ry;
    G.add(stand);
  });
  // floodlight towers in the 4 corners
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const tw = new THREE.Group();
    tw.name = `Torre_Luz_${sx > 0 ? 'E' : 'W'}${sz > 0 ? 'N' : 'S'}`;
    const mast = mesh(new THREE.CylinderGeometry(0.4, 0.55, 34, 8), mConc, 'Mastil');
    mast.position.y = 17;
    const head = box(6.5, 4.5, 0.5, mRoof, 'Panel');
    head.position.set(0, 36, 0);
    tw.add(mast, head);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfffbe8, emissive: 0xfff6d0, emissiveIntensity: 2.6, roughness: 0.3 });
    for (let r2 = 0; r2 < 3; r2++) for (let c = 0; c < 5; c++) {
      const lamp = mesh(new THREE.CircleGeometry(0.42, 12), lampMat, `Lampara_${r2 * 5 + c + 1}`);
      lamp.position.set(-2.4 + c * 1.2, 34.7 + r2 * 1.3, 0.28);
      tw.add(lamp);
    }
    tw.position.set(sx * (W / 2 + 34), 0, sz * (L / 2 + 34));
    tw.lookAt(0, 0, 0);
    tw.rotateY(Math.PI);
    G.add(tw);
  }
  // dugouts + ad boards + scoreboard
  for (const s of [1, -1]) {
    const dg = new THREE.Group(); dg.name = `Banquillo_${s > 0 ? 'Local' : 'Visitante'}`;
    const shell = box(7, 1.9, 1.6, M({ color: 0x22262e, roughness: 0.4, metalness: 0.3 }), 'Caseta');
    shell.position.set(s * 8, 0.95, 0);
    const bench = box(6.4, 0.35, 0.5, M({ color: s > 0 ? 0xf2d418 : 0x1e56c8 }), 'Banco');
    bench.position.set(s * 8, 0.45, 0.3);
    dg.add(shell, bench);
    dg.position.set(0, 0, -(W / 2) * 0 - 0); // placed along west touchline below
    dg.position.set(-(W / 2 + 3.4), 0, 0);
    dg.rotation.y = Math.PI / 2;
    dg.position.z = s * 10;
    G.add(dg);
  }
  const boards = new THREE.Group(); boards.name = 'Vallas_Publicitarias';
  const boardMat = [M({ color: 0x0f4fa8 }), M({ color: 0xc8102e }), M({ color: 0xf2f4f6 }), M({ color: 0x0a8a4a })];
  const addBoard = (x, z, ry, len) => {
    const b = box(len, 0.95, 0.1, boardMat[(Math.abs(x * 7 + z) | 0) % 4], 'Valla');
    b.position.set(x, 0.5, z); b.rotation.y = ry;
    boards.add(b);
  };
  for (let i = 0; i < 8; i++) {
    addBoard(-W / 2 + 4.5 + i * (W - 9) / 7, L / 2 + 3.4, 0, 7.5);
    addBoard(-W / 2 + 4.5 + i * (W - 9) / 7, -L / 2 - 3.4, 0, 7.5);
  }
  for (let i = 0; i < 12; i++) {
    addBoard(W / 2 + 3.4, -L / 2 + 6 + i * (L - 12) / 11, Math.PI / 2, 7.2);
    addBoard(-W / 2 - 3.4, -L / 2 + 6 + i * (L - 12) / 11, Math.PI / 2, 7.2);
  }
  G.add(boards);
  // shadow flags: stands & pitch furniture receive, tall pieces cast
  G.traverse(o => {
    if (o.isMesh) {
      o.castShadow = /Techo|Columna|Mastil|Panel|Caseta|Valla|Marcador|Post|Crossbar|Grada/.test(o.name);
      o.receiveShadow = /Grass|Grada/.test(o.name);
    }
  });
  const sb = box(16, 5, 0.6, M({ color: 0x14171c, roughness: 0.5 }), 'Marcador_Chasis');
  sb.position.set(0, 15, L / 2 + 26);
  const sbScreen = mesh(new THREE.PlaneGeometry(15, 4.4),
    new THREE.MeshBasicMaterial({ map: scoreboardTexture() }), 'Marcador_Pantalla');
  sbScreen.position.set(0, 15, L / 2 + 25.6);
  sbScreen.rotation.y = Math.PI;
  G.add(sb, sbScreen);
  return G;
}

/* ============================================================
   AL WAKRAH — bowl ovalado con cubierta tipo vela de dhow
   (recreación libre; usa la textura de césped aportada)
   ============================================================ */
const WAKRAH_PITCH_URL = './assets/wakrah-pitch.png';

/* superficie de revolución elíptica: perfil [{rx,rz,y}] barrido 360° */
function ellipseSurface(profile, mat, name, o = {}) {
  const { seg = 108, amp = 0, ampPow = 1, flute = 0, fluteN = 28, uRep = 1, vRep = 1, side = THREE.DoubleSide } = o;
  const pos = [], uv = [], idx = [];
  const n = profile.length;
  for (let i = 0; i <= seg; i++) {
    const th = i / seg * Math.PI * 2;
    const c = Math.cos(th), s = Math.sin(th);
    const lift = amp ? amp * Math.pow(Math.abs(Math.sin(th)), ampPow) : 0;
    const fl = flute ? 1 + flute * Math.sin(th * fluteN) : 1;
    for (let j = 0; j < n; j++) {
      const p = profile[j];
      pos.push(p.rx * fl * c, p.y + lift * (p.lift ?? 1), p.rz * fl * s);
      uv.push(i / seg * uRep, j / (n - 1) * vRep);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < n - 1; j++) {
    const a = i * n + j, b = (i + 1) * n + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.name = name;
  m.material.side = side;
  return m;
}

export function buildPitchWakrah() {
  const G = new THREE.Group(); G.name = 'PITCH_Al_Wakrah';
  const apron = mesh(new THREE.PlaneGeometry(W + 30, L + 30),
    M({ color: 0x27512c, roughness: 1 }), 'Apron');
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; apron.receiveShadow = true;
  G.add(apron);
  const tex = new THREE.TextureLoader().load(WAKRAH_PITCH_URL);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(0.8701, 0.8611);          // recorte al área de juego marcada
  tex.offset.set(0.0576, 0.092);
  const geo = new THREE.PlaneGeometry(L, W);
  geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI / 2);
  const grass = mesh(geo, M({ map: tex, roughness: 0.96, envMapIntensity: 0.3 }), 'Grass');
  grass.receiveShadow = true;
  G.add(grass);
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const pole = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), M({ color: 0xf2c718 }), 'Corner_Pole');
    pole.position.set(sx * W / 2, 0.75, sz * L / 2);
    const flag = box(0.42, 0.3, 0.015, M({ color: 0x8a1538, roughness: 0.6 }), 'Corner_Flag');
    flag.position.set(sx * W / 2 - sx * 0.21, 1.32, sz * L / 2);
    G.add(pole, flag);
  }
  for (const s of [1, -1]) {
    const goal = buildGoal();
    goal.position.set(0, 0, s * L / 2);
    if (s > 0) goal.rotation.y = Math.PI;
    goal.name = `Porteria_${s > 0 ? 'N' : 'S'}`;
    G.add(goal);
  }
  return G;
}

/* asientos azules vacíos con pasillos — como el render de referencia */
function seatsTexture(seed = 31) {
  const Wt = 2048, Ht = 1024, cv = document.createElement('canvas');
  cv.width = Wt; cv.height = Ht;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#565b63'; ctx.fillRect(0, 0, Wt, Ht);
  const r = rng(seed);
  const rows = 16, rowH = Ht / rows, seatW = 16, gap = 4;
  for (let row = 0; row < rows; row++) {
    const y0 = row * rowH;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + rowH);   // sombreado de contrahuella
    g.addColorStop(0, 'rgba(15,17,22,0.5)'); g.addColorStop(0.25, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = g; ctx.fillRect(0, y0, Wt, rowH);
    for (let x = 8; x < Wt - seatW; x += seatW + gap) {
      if ((x % 340) < 24) continue;                     // pasillo radial
      const li = 30 + r() * 16, hue = 215 + r() * 10;
      ctx.fillStyle = `hsl(${hue},62%,${li}%)`;
      ctx.beginPath(); ctx.roundRect(x, y0 + 8, seatW, rowH - 18, 3); ctx.fill();
      ctx.fillStyle = `hsl(${hue},66%,${li + 9}%)`;     // canto superior iluminado
      ctx.fillRect(x + 1, y0 + 8, seatW - 2, 3);
      ctx.fillStyle = `hsl(${hue},58%,${li - 9}%)`;     // asiento (más oscuro)
      ctx.fillRect(x + 2, y0 + rowH * 0.55, seatW - 4, rowH * 0.28);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';               // sombra al suelo
      ctx.fillRect(x, y0 + rowH - 10, seatW, 3);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  return t;
}
/* celosía diagonal de la cubierta (color + emisivo de tiras de luz) */
function latticeTextures() {
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#191b1f'; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#b3a179'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  const step = S / 4;
  for (let k = -4; k <= 8; k++) {
    ctx.beginPath(); ctx.moveTo(k * step, 0); ctx.lineTo(k * step - S, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(k * step - S, 0); ctx.lineTo(k * step, S); ctx.stroke();
  }
  ctx.fillStyle = '#6e6650';
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
    ctx.beginPath(); ctx.arc(((i + j) % 2 ? i : i) * step, j * step, 6, 0, 6.3); ctx.fill();
  }
  const color = new THREE.CanvasTexture(cv);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.anisotropy = 8;
  const cv2 = document.createElement('canvas');
  cv2.width = cv2.height = S;
  const c2 = cv2.getContext('2d');
  c2.fillStyle = '#000'; c2.fillRect(0, 0, S, S);
  c2.fillStyle = '#fff7dc';
  for (let i = 0; i < 4; i++) c2.fillRect(i * step + step / 2 - 22, step / 2 - 4, 44, 8);
  const emissive = new THREE.CanvasTexture(cv2);
  emissive.wrapS = emissive.wrapT = THREE.RepeatWrapping;
  return { color, emissive };
}

export function buildStadiumWakrah() {
  const G = new THREE.Group(); G.name = 'ESTADIO_Al_Wakrah';
  G.add(buildPitchWakrah());

  const mSeats = M({ map: seatsTexture(31), roughness: 0.92 });
  const mSand = M({ color: 0xe9e2d2, roughness: 0.42, metalness: 0.06, envMapIntensity: 1.15 });
  const mGold = M({ color: 0xc9a45a, roughness: 0.32, metalness: 0.85, envMapIntensity: 1.2 });
  const mConc = M({ color: 0x8e939b, roughness: 0.88 });
  const mConcDark = M({ color: 0x6d727a, roughness: 0.9 });
  const mMembrane = M({ color: 0xf4efe4, roughness: 0.45, metalness: 0.08, envMapIntensity: 1.0 });
  const mBlue = M({ color: 0x2f5da8, roughness: 0.55, envMapIntensity: 0.8 });

  // muro azul perimetral con remate blanco (como la referencia)
  G.add(ellipseSurface([{ rx: 40, rz: 58, y: 0 }, { rx: 40, rz: 58, y: 1.15 }], mBlue, 'Vallas_LED', { seg: 96 }));
  G.add(ellipseSurface([{ rx: 40, rz: 58, y: 1.15 }, { rx: 41.2, rz: 59.2, y: 1.2 }],
    M({ color: 0xe8ecf0, roughness: 0.4 }), 'Vallas_Remate', { seg: 96 }));

  // tres anfiteatros continuos de butaca azul con pasillos y parapetos grises
  const tier = (p0, p1, name, uRep, vRep) => {
    G.add(ellipseSurface([p0, p1], mSeats, name, { uRep, vRep, seg: 132 }));
    G.add(ellipseSurface([{ ...p1 }, { rx: p1.rx + 0.6, rz: p1.rz + 0.6, y: p1.y + 1.1 }], mConc, name + '_Parapeto', { seg: 132 }));
  };
  tier({ rx: 41.2, rz: 59.2, y: 1.2 }, { rx: 50, rz: 68, y: 9.5 }, 'Grada_Baja', 30, 1);
  G.add(ellipseSurface([{ rx: 50.6, rz: 68.6, y: 10.6 }, { rx: 53.2, rz: 71.2, y: 10.6 }], mConcDark, 'Paseo_1', { seg: 132 }));
  tier({ rx: 53.2, rz: 71.2, y: 10.6 }, { rx: 62, rz: 80, y: 19.5 }, 'Grada_Media', 34, 1);
  G.add(ellipseSurface([{ rx: 62.6, rz: 80.6, y: 20.6 }, { rx: 65, rz: 83, y: 20.6 }], mConcDark, 'Paseo_2', { seg: 132 }));
  tier({ rx: 65, rz: 83, y: 20.6 }, { rx: 77.5, rz: 95.5, y: 35 }, 'Grada_Alta', 38, 2);
  G.add(ellipseSurface([{ rx: 78.1, rz: 96.1, y: 36.1 }, { rx: 79, rz: 97, y: 38.6 }], mConc, 'Anillo_Superior', { seg: 132 }));

  // bocas de vomitorio en el anfiteatro medio
  for (let i = 0; i < 14; i++) {
    const th = i / 14 * Math.PI * 2 + 0.11;
    const c = Math.cos(th), s = Math.sin(th);
    const v = box(4.2, 3.1, 0.7, mConcDark, `Vomitorio_${i + 1}`);
    v.position.set(56.5 * c, 12.3, 74.5 * s);
    v.rotation.y = Math.atan2(c, s);
    G.add(v);
  }

  // fachada exterior: casco blanco perla sobre zócalo de vidrio
  G.add(ellipseSurface(
    [{ rx: 78.5, rz: 96.5, y: 0 }, { rx: 79, rz: 97, y: 4.6 }],
    M({ color: 0x10161f, roughness: 0.12, metalness: 0.7, envMapIntensity: 1.5 }), 'Zocalo_Vidrio', { seg: 144 }));
  G.add(ellipseSurface(
    [{ rx: 79, rz: 97, y: 4.6 }, { rx: 85, rz: 103, y: 16 }, { rx: 83.5, rz: 101.5, y: 28 }, { rx: 79, rz: 97, y: 38.6 }],
    mSand, 'Fachada', { flute: 0.011, fluteN: 26, seg: 144 }));
  G.add(ellipseSurface([{ rx: 79, rz: 97, y: 38.6 }, { rx: 80, rz: 98, y: 39.6 }], mGold, 'Cornisa'));

  // CUBIERTA: celosía diagonal que cubre el bowl con óculo sobre el campo
  const lat = latticeTextures();
  const mLattice = new THREE.MeshStandardMaterial({
    name: 'Celosia', map: lat.color, emissiveMap: lat.emissive,
    emissive: new THREE.Color(0xfff2c8), emissiveIntensity: 1.8,
    roughness: 0.75, metalness: 0.15, side: THREE.DoubleSide,
  });
  mLattice.map.repeat.set(1, 1);
  G.add(ellipseSurface(
    [{ rx: 80, rz: 98, y: 39.6 }, { rx: 62, rz: 78, y: 43.2 }, { rx: 45, rz: 60, y: 45.6 }, { rx: 31, rz: 46, y: 46.6 }],
    mLattice, 'Cubierta_Celosia', { seg: 144, uRep: 30, vRep: 5 }));
  // borde del óculo
  G.add(ellipseSurface([{ rx: 31, rz: 46, y: 46.6 }, { rx: 30.4, rz: 45.4, y: 45.2 }], mGold, 'Oculo_Borde', { seg: 96 }));
  // aro de focos alrededor del óculo
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfffbe8, emissive: 0xfff4cf, emissiveIntensity: 2.6, roughness: 0.3 });
  for (let i = 0; i < 44; i++) {
    const th = i / 44 * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    const lamp = mesh(new THREE.PlaneGeometry(1.7, 0.55), lampMat, `Foco_${i + 1}`);
    lamp.position.set(33.5 * c, 45.6, 48.5 * s);
    lamp.rotation.x = Math.PI / 2;
    lamp.rotation.z = -th;
    G.add(lamp);
  }

  // vela exterior blanca que corona el anillo (silueta Al Janoub)
  G.add(ellipseSurface(
    [{ rx: 78, rz: 96, y: 39.6, lift: 1 }, { rx: 86, rz: 104, y: 43.6, lift: 1.35 }, { rx: 92, rz: 110, y: 41.6, lift: 1.5 }],
    mMembrane, 'Cubierta_Vela', { amp: 12, ampPow: 1.7, seg: 144, flute: 0.008, fluteN: 36 }));

  // pancarta granate colgada de la celosía (como el render, sin marcas)
  for (const s of [1, -1]) {
    const sb = box(13, 4.2, 0.5, M({ color: 0x7a1533, roughness: 0.6 }), 'Marcador_Chasis');
    sb.position.set(0, 34, s * 62);
    const scr = mesh(new THREE.PlaneGeometry(11.5, 3.2),
      new THREE.MeshBasicMaterial({ map: scoreboardTexture() }), 'Marcador_Pantalla');
    scr.position.set(0, 34, s * (62 - 0.31));
    if (s > 0) scr.rotation.y = Math.PI;
    G.add(sb, scr);
  }
  // banquillos curvos azules a pie de campo
  for (const s of [1, -1]) {
    const dg = new THREE.Group(); dg.name = `Banquillo_${s > 0 ? 'Local' : 'Visitante'}`;
    const shell = mesh(new THREE.CylinderGeometry(1.5, 1.5, 6.4, 18, 1, true, -Math.PI * 0.12, Math.PI * 0.62),
      new THREE.MeshStandardMaterial({ color: 0x2f5da8, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.55, side: THREE.DoubleSide, envMapIntensity: 1.6 }), 'Caseta');
    shell.rotation.z = Math.PI / 2;
    shell.rotation.y = Math.PI / 2;
    shell.position.set(0, 1.05, 0);
    const bench = box(6.2, 0.4, 0.5, mBlue, 'Banco');
    bench.position.set(0, 0.42, -0.25);
    dg.add(shell, bench);
    dg.position.set(-(W / 2 + 2.6), 0, s * 9);
    dg.rotation.y = Math.PI / 2;
    G.add(dg);
  }

  G.traverse(o => {
    if (o.isMesh) {
      o.castShadow = /Cubierta|Fachada|Marcador|Caseta|Post|Crossbar|Vallas/.test(o.name);
      o.receiveShadow = /Grass|Grada|Apron|Paseo/.test(o.name);
    }
  });
  return G;
}

/* ============================================================
   FULL MATCH — everything placed: 22 players, officials, ball
   ============================================================ */
export function buildMatch(stadiumFn = buildStadium) {
  const G = new THREE.Group(); G.name = 'PARTIDO_Completo';
  G.add(stadiumFn());
  const r = rng(42);
  const SKINS = [0xc98d68, 0x8a5a3b, 0x6b4226, 0xe0ac86, 0xa06a44, 0xd49a72];
  const HAIRS = [0x17120d, 0x2b2019, 0x4a3520, 0x0d0d0f, 0x5f4a2f];
  let dorsal = { LOCAL: 0, VISITANTE: 0 };
  const fig = (kit, x, z, faceZ, name, pose = 'stand', flag = null) => {
    const team = name.startsWith('LOCAL') ? 'LOCAL' : name.startsWith('VISITANTE') ? 'VISITANTE' : null;
    const f = buildFigure({
      ...kit, name, pose, flag,
      skin: SKINS[(r() * SKINS.length) | 0], hair: HAIRS[(r() * HAIRS.length) | 0],
      number: team ? ++dorsal[team] : null,
    });
    f.position.set(x, 0, z);
    f.lookAt(x, 0, faceZ);
    G.add(f);
    return f;
  };
  // LOCAL (amarillo/negro) defiende sur, 4-3-3 — VISITANTE (blanco/azul) 4-4-2
  const local = [
    ['POR', 0, -50, 'keeper'], ['DEF', -24, -35], ['DEF', -8, -36], ['DEF', 8, -36], ['DEF', 24, -35],
    ['MED', -15, -16, 'walk'], ['MED', 0, -18, 'walk'], ['MED', 15, -16, 'walk'],
    ['DEL', -20, -4, 'run'], ['DEL', 0, -1.2, 'kick'], ['DEL', 20, -4, 'run'],
  ];
  local.forEach(([role, x, z, pose], i) => fig(
    role === 'POR' ? KITS.portero_local : KITS.local, x, z, 60,
    `LOCAL_${String(i + 1).padStart(2, '0')}_${role}`, pose || 'stand'));
  const visit = [
    ['POR', 0, 50, 'keeper'], ['DEF', -22, 35], ['DEF', -7, 37], ['DEF', 7, 37], ['DEF', 22, 35],
    ['MED', -22, 16, 'walk'], ['MED', -7, 19, 'walk'], ['MED', 7, 19, 'walk'], ['MED', 22, 16, 'walk'],
    ['DEL', -8, 5, 'run'], ['DEL', 8, 5, 'run'],
  ];
  visit.forEach(([role, x, z, pose], i) => fig(
    role === 'POR' ? KITS.portero_visitante : KITS.visitante, x, z, -60,
    `VISITANTE_${String(i + 1).padStart(2, '0')}_${role}`, pose || 'stand'));
  // officials
  fig(KITS.arbitro, 6, -8, 20, 'ARBITRO', 'run');
  fig(KITS.arbitro, W / 2 + 1.2, -26, -26.01, 'ASISTENTE_1', 'stand', 0xf2c718);
  G.children.at(-1).lookAt(0, 0, -26);
  fig(KITS.arbitro, -W / 2 - 1.2, 26, 26.01, 'ASISTENTE_2', 'stand', 0xf2c718);
  G.children.at(-1).lookAt(0, 0, 26);
  const cuarto = fig(KITS.arbitro, -(W / 2 + 3.2), 0, 0, 'CUARTO_ARBITRO');
  cuarto.lookAt(0, 0, 0);
  // ball on the center spot
  G.add(buildBall());
  // technical markers for the future game
  const marker = (name, x, y, z) => {
    const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); G.add(o);
  };
  marker('CameraTarget_TV', 0, 24, -W - 20);
  marker('KickoffPoint', 0, 0.11, 0);
  marker('GoalCenter_N', 0, 1.22, L / 2);
  marker('GoalCenter_S', 0, 1.22, -L / 2);
  return G;
}

export const CATALOG = [
  {
    id: 'wakrah_real', label: 'ESTADIO_Al_Wakrah_REAL', meta: 'modelo GLB del usuario · 1.2M triángulos · carga ~29MB',
    build: () => {
      const g = new THREE.Group(); g.name = 'ESTADIO_Al_Wakrah_Real';
      for (const s of [1, -1]) {
        const goal = buildGoal();
        goal.position.set(0, 0, s * L / 2);
        if (s > 0) goal.rotation.y = Math.PI;
        g.add(goal);
      }
      loadWakrahReal().then(sc => g.add(alignWakrah(sc))).catch(e => console.warn(e));
      return g;
    },
  },
  { id: 'match', label: 'PARTIDO_Completo', meta: '22 jugadores · árbitro + 2 asistentes · balón · estadio', build: buildMatch },
  { id: 'match_wakrah', label: 'PARTIDO_Al_Wakrah', meta: '22 jugadores · bowl ovalado · cubierta vela', build: () => buildMatch(buildStadiumWakrah) },
  { id: 'wakrah', label: 'ESTADIO_Al_Wakrah', meta: 'inspirado en Al Wakrah · césped fotográfico · cubierta de vela', build: buildStadiumWakrah },
  { id: 'stadium', label: 'ESTADIO_Completo', meta: 'gradas con público · 4 torres · marcador · vallas', build: buildStadium },
  { id: 'pitch', label: 'PITCH_Reglamentario', meta: '105×68 m · líneas FIFA · porterías · corners', build: buildPitch },
  { id: 'player_l', label: 'FIG_Jugador_Local', meta: 'maniquí articulado · rayas amarillo/negro', build: () => buildFigure({ ...KITS.local, name: 'FIG_Jugador_Local', pose: 'walk' }) },
  { id: 'player_v', label: 'FIG_Jugador_Visitante', meta: 'maniquí articulado · rayas blanco/azul', build: () => buildFigure({ ...KITS.visitante, name: 'FIG_Jugador_Visitante', pose: 'run' }) },
  { id: 'kicker', label: 'FIG_Jugador_Chutando', meta: 'pose de disparo', build: () => buildFigure({ ...KITS.local, name: 'FIG_Jugador_Chutando', pose: 'kick' }) },
  { id: 'celebrate', label: 'FIG_Jugador_Celebrando', meta: 'brazos al cielo', build: () => buildFigure({ ...KITS.local, name: 'FIG_Jugador_Celebrando', pose: 'celebrate' }) },
  { id: 'keeper', label: 'FIG_Portero', meta: 'brazos arriba · kit verde', build: () => buildFigure({ ...KITS.portero_local, name: 'FIG_Portero', pose: 'keeper' }) },
  { id: 'ref', label: 'FIG_Arbitro', meta: 'kit negro', build: () => buildFigure({ ...KITS.arbitro, name: 'FIG_Arbitro' }) },
  { id: 'assist', label: 'FIG_Asistente', meta: 'bandera amarilla', build: () => buildFigure({ ...KITS.arbitro, name: 'FIG_Asistente', flag: 0xf2c718 }) },
  { id: 'ball', label: 'PROP_Balon', meta: 'r 0.11 m · pentágonos', build: buildBall },
  { id: 'goal', label: 'PROP_Porteria', meta: '7.32 × 2.44 m · red', build: buildGoal },
];
