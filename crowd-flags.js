import * as THREE from 'three';

/* ============ PÚBLICO + BANDERAS para las sedes del juego ============ */

const dummy = new THREE.Object3D();
function visibleChain(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f)), g = Math.min(255, Math.max(0, ((n >> 8) & 255) * f)), b = Math.min(255, Math.max(0, (n & 255) * f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
function limb(c, x, y, w, len, ang, color, r = 7) {
  c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = color;
  rr(c, -w / 2, 0, w, len, r); c.restore();
}

/* ---- cabeza con sombreado, pelo/gorra ---- */
function head(c, cx, cy, R, skin, hair, cap, accent) {
  const g = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.2, cx, cy, R * 1.15);
  g.addColorStop(0, shade(skin, 1.13)); g.addColorStop(0.75, skin); g.addColorStop(1, shade(skin, 0.72));
  c.fillStyle = g;
  c.beginPath(); c.arc(cx, cy, R, 0, 6.3); c.fill();
  // orejas
  c.fillStyle = shade(skin, 0.9);
  c.beginPath(); c.arc(cx - R * 0.95, cy + R * 0.05, R * 0.22, 0, 6.3); c.fill();
  c.beginPath(); c.arc(cx + R * 0.95, cy + R * 0.05, R * 0.22, 0, 6.3); c.fill();
  if (cap) {
    c.fillStyle = accent;
    c.beginPath(); c.arc(cx, cy - R * 0.18, R * 1.02, Math.PI, Math.PI * 2); c.fill();
    rr(c, cx - R * 1.02, cy - R * 0.28, R * 2.04, R * 0.34, R * 0.17);
    c.fillStyle = shade(accent === '#ffffff' ? '#dddddd' : accent, 0.8);
    rr(c, cx - R * 0.75, cy - R * 0.05, R * 1.5, R * 0.2, R * 0.1);   // visera
  } else {
    c.fillStyle = hair;
    c.beginPath(); c.arc(cx, cy - R * 0.12, R * 1.02, Math.PI * 0.98, Math.PI * 2.02); c.fill();
    c.fillStyle = shade(hair === '#0d0d0f' ? '#333333' : hair, 1.35);
    c.beginPath(); c.arc(cx - R * 0.3, cy - R * 0.55, R * 0.42, Math.PI * 1.1, Math.PI * 1.8); c.stroke();
  }
  // ojos sutiles
  c.fillStyle = 'rgba(20,14,10,0.75)';
  c.beginPath(); c.arc(cx - R * 0.34, cy + R * 0.08, R * 0.09, 0, 6.3); c.fill();
  c.beginPath(); c.arc(cx + R * 0.34, cy + R * 0.08, R * 0.09, 0, 6.3); c.fill();
}
function torso(c, cx, top, bot, wTop, wBot, shirt) {
  const g = c.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, shade(shirt, 1.16)); g.addColorStop(0.55, shirt); g.addColorStop(1, shade(shirt, 0.7));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(cx - wTop / 2, top + 10);
  c.quadraticCurveTo(cx - wTop / 2 - 4, top, cx - wTop / 2 + 14, top - 4);   // hombro
  c.lineTo(cx + wTop / 2 - 14, top - 4);
  c.quadraticCurveTo(cx + wTop / 2 + 4, top, cx + wTop / 2, top + 10);
  c.lineTo(cx + wBot / 2, bot); c.lineTo(cx - wBot / 2, bot);
  c.closePath(); c.fill();
  // cuello de la camiseta
  c.fillStyle = shade(shirt, 0.62);
  c.beginPath(); c.arc(cx, top - 2, 11, 0, Math.PI); c.fill();
}

/* ---- atlas 4 poses SENTADO (celda 128×192) ---- */
function seatedAtlas(shirt, skin, hair, accent) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192;
  const c = cv.getContext('2d');
  for (let p = 0; p < 4; p++) {
    const x0 = p * 128, cx = x0 + 64;
    c.save();
    // muslos / regazo
    c.fillStyle = p % 2 ? '#23252e' : '#2c2417';
    rr(c, cx - 42, 148, 84, 34, 12);
    c.fillStyle = 'rgba(255,255,255,0.06)';
    rr(c, cx - 42, 148, 84, 8, 6);
    // torso sentado
    torso(c, cx, 66, 156, 66, 58, shirt);
    // brazos según pose
    const sleeve = shade(shirt, 0.92);
    if (p === 0) {           // manos en el regazo
      limb(c, cx - 32, 74, 15, 60, 0.32, sleeve);
      limb(c, cx + 32, 74, 15, 60, -0.32, sleeve);
      c.fillStyle = skin;
      c.beginPath(); c.arc(cx - 14, 138, 8, 0, 6.3); c.fill();
      c.beginPath(); c.arc(cx + 14, 138, 8, 0, 6.3); c.fill();
    } else if (p === 1) {    // brazos cruzados
      limb(c, cx - 33, 76, 15, 40, 0.9, sleeve);
      limb(c, cx + 33, 76, 15, 40, -0.9, sleeve);
      c.fillStyle = shade(shirt, 1.05);
      rr(c, cx - 30, 96, 60, 18, 9);
    } else if (p === 2) {    // un brazo arriba + bufanda
      limb(c, cx - 30, 72, 14, 52, 2.72, sleeve);       // arriba
      limb(c, cx + 32, 74, 15, 58, -0.3, sleeve);
      c.fillStyle = skin;
      c.beginPath(); c.arc(cx - 44, 26, 8, 0, 6.3); c.fill();
      c.fillStyle = accent; rr(c, cx - 26, 58, 52, 12, 6);   // bufanda
    } else {                 // aplaudiendo, ambas arriba
      limb(c, cx - 30, 72, 14, 50, 2.55, sleeve);
      limb(c, cx + 30, 72, 14, 50, -2.55, sleeve);
      c.fillStyle = skin;
      c.beginPath(); c.arc(cx - 46, 30, 8, 0, 6.3); c.fill();
      c.beginPath(); c.arc(cx + 46, 30, 8, 0, 6.3); c.fill();
    }
    // sombra bajo la barbilla
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.beginPath(); c.ellipse(cx, 64, 20, 7, 0, 0, 6.3); c.fill();
    head(c, cx, 40, 22, skin, hair, p === 1 || p === 3, accent);
    c.restore();
  }
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  return tx;
}
/* ---- atlas 4 poses DE PIE (celda 128×256) ---- */
function standingAtlas(shirt, skin, hair, accent) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d');
  for (let p = 0; p < 4; p++) {
    const x0 = p * 128, cx = x0 + 64;
    // piernas
    c.fillStyle = p % 2 ? '#23252e' : '#2c2417';
    rr(c, cx - 26, 158, 22, 92, 8); rr(c, cx + 4, 158, 22, 92, 8);
    torso(c, cx, 66, 166, 64, 52, shirt);
    const sleeve = shade(shirt, 0.92);
    if (p < 2) {             // brazos arriba con bufanda
      limb(c, cx - 28, 72, 14, 54, 2.6, sleeve);
      limb(c, cx + 28, 72, 14, 54, -2.6, sleeve);
      c.fillStyle = accent; rr(c, cx - 48, 18, 96, 13, 6);   // bufanda estirada
      c.fillStyle = skin;
      c.beginPath(); c.arc(cx - 46, 28, 8, 0, 6.3); c.fill();
      c.beginPath(); c.arc(cx + 46, 28, 8, 0, 6.3); c.fill();
    } else {                 // animando, un puño arriba
      limb(c, cx - 29, 74, 14, 50, 2.75, sleeve);
      limb(c, cx + 30, 76, 15, 62, -0.25, sleeve);
      c.fillStyle = skin;
      c.beginPath(); c.arc(cx - 41, 28, 9, 0, 6.3); c.fill();
    }
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.beginPath(); c.ellipse(cx, 64, 19, 7, 0, 0, 6.3); c.fill();
    head(c, cx, 40, 22, skin, hair, p === 2, accent);
  }
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  return tx;
}

/* [camiseta, piel, pelo, acento] */
const VARIANTS = [
  ['#e8c522', '#c98d68', '#241a12', '#17181c'],  // local amarillo
  ['#1d1e24', '#a86f4d', '#0d0d0f', '#e8c522'],
  ['#8a1538', '#c98d68', '#241a12', '#ffffff'],  // granate Qatar
  ['#8a1538', '#8a5a3a', '#101010', '#f4f2ec'],
  ['#e8e6e0', '#c98d68', '#3a2a18', '#8a1538'],
  ['#2f5da8', '#b07a52', '#1a120c', '#ffffff'],
  ['#d94a2b', '#c98d68', '#241a12', '#1d1e24'],
  ['#5b6470', '#a86f4d', '#0d0d0f', '#e8c522'],
];

/* ---- geometría en cruz (2 planos a 90°) anclada al suelo ---- */
function crossGeo(w, h) {
  const p1 = new THREE.PlaneGeometry(w, h); p1.translate(0, h / 2, 0);
  const p2 = p1.clone(); p2.rotateY(Math.PI / 2);
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = p1.attributes[name], b = p2.attributes[name];
    const arr = new Float32Array(a.array.length + b.array.length);
    arr.set(a.array); arr.set(b.array, a.array.length);
    geo.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  const n = p1.attributes.position.count;
  const idx = [...p1.index.array, ...Array.from(p2.index.array, i => i + n)];
  geo.setIndex(idx);
  return geo;
}

/* ---- muestreo de superficies + SNAP a filas y butacas ---- */
function sampleSeats(root, {
  yMin = 1.6, yMax = 40, fieldX = 40, fieldZ = 58.5, maxR = 230,
  density = 5.5, rowH = 0.42, seatW = 0.44, aisleN = 36, aisleHalf = 0.4, fill = 0.99,
  minRow = 120, gap = 2.6, minNb = 5, minVert = 1, baseY = 12, flatFilter = true,
} = {}) {
  root.updateWorldMatrix(true, true);
  const seats = new Map();   // key -> acumulador del asiento
  const a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  const skip = /roof|techo|cubierta|glass|vidrio|celosia|lattice|canopy|shell|sky|vela|sail/i;
  // ¿el modelo trae butacas modeladas como material propio? (Al Wakrah: Material.008,
  // ~795k triángulos de asientos individuales) — entonces muestreamos SOLO eso.
  // Euro Arena: gradas como bloques "Cube0xx" con texturas de butacas → heurística geométrica.
  const matCount = new Map();
  root.traverse(m => {
    if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
    const mn = (m.material && m.material.name) || '';
    const tris = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const wb = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
    if (tris > 80000 && wb.min.y > -2 && wb.max.y < 45) matCount.set(mn, (matCount.get(mn) || 0) + tris);
  });
  let seatMat = null, bestTris = 0;
  for (const [mn, c] of matCount) if (c > bestTris && c > 300000) { seatMat = mn; bestTris = c; }
  const seatOnly = !!seatMat;
  console.log(seatOnly ? `butacas por material: "${seatMat}" (${bestTris | 0} tris)` : 'sin material de butacas: heurística geométrica');
  const dens = seatOnly ? 24 : density;   // butacas modeladas: poca área útil por asiento
  root.traverse(m => {
    if (!m.isMesh || !m.geometry) return;
    if (seatOnly) {
      if (((m.material && m.material.name) || '') !== seatMat) return;
    } else if (skip.test(m.name) || (m.material && skip.test(m.material.name || ''))) return;
    const g = m.geometry, pos = g.attributes.position;
    if (!pos) return;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(m.matrixWorld);
    if (bb.max.y < yMin || bb.min.y > yMax + 6) return;
    if (seatOnly) {
      // butacas modeladas (a menudo plegadas): clusterizamos vértices, no caras
      for (let i = 0; i < pos.count; i++) {
        a.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const py = a.y;
        if (py < yMin - 0.6 || py > yMax) continue;
        if (Math.abs(a.x) < fieldX && Math.abs(a.z) < fieldZ) continue;
        const r = Math.hypot(a.x, a.z);
        if (r > maxR || r < 5) continue;
        const phi = Math.atan2(a.z, a.x);
        const row = Math.round(py / rowH);
        const col = Math.round(phi * r / seatW);
        const key = row * 100000 + col + 50000;
        let s = seats.get(key);
        if (!s) { s = { cx: 0, sx: 0, sr: 0, sy: 0, ny: 0, minR: 1e9, maxR: 0, ymin: 1e9, n: 0 }; seats.set(key, s); }
        s.cx += Math.cos(phi); s.sx += Math.sin(phi); s.sr += r; s.sy += py; s.ny += 1;
        if (py < s.ymin) s.ymin = py;
        if (r < s.minR) s.minR = r; if (r > s.maxR) s.maxR = r;
        s.n++;
      }
      return;
    }
    const idx = g.index;
    const triN = idx ? idx.count / 3 : pos.count / 3;
    for (let i = 0; i < triN; i++) {
      const i0 = idx ? idx.getX(i * 3) : i * 3;
      const i1 = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
      const i2 = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld);
      cc.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
      const cy = (a.y + b.y + cc.y) / 3;
      if (cy < yMin || cy > yMax) continue;
      ab.subVectors(b, a); ac.subVectors(cc, a); n.crossVectors(ab, ac);
      const area2 = n.length();
      if (area2 < 1e-7 || n.y / area2 < 0.55) continue;
      const upDot = n.y / area2;   // 1 = horizontal (paseo), ~0.8 = grada inclinada
      let count = (area2 / 2) * dens;
      count = Math.floor(count) + (Math.random() < count % 1 ? 1 : 0);
      for (let k = 0; k < count; k++) {
        let u = Math.random(), v = Math.random();
        if (u + v > 1) { u = 1 - u; v = 1 - v; }
        const px = a.x + ab.x * u + ac.x * v;
        const py = a.y + ab.y * u + ac.y * v;
        const pz = a.z + ab.z * u + ac.z * v;
        if (Math.abs(px) < fieldX && Math.abs(pz) < fieldZ) continue;
        const r = Math.hypot(px, pz);
        if (r > maxR || r < 5) continue;
        const phi = Math.atan2(pz, px);
        const row = Math.round(py / rowH);
        const col = Math.round(phi * r / seatW);
        const key = row * 100000 + col + 50000;
        let s = seats.get(key);
        if (!s) { s = { cx: 0, sx: 0, sr: 0, sy: 0, ny: 0, minR: 1e9, maxR: 0, n: 0 }; seats.set(key, s); }
        s.cx += Math.cos(phi); s.sx += Math.sin(phi); s.sr += r; s.sy += py; s.ny += upDot;
        if (r < s.minR) s.minR = r; if (r > s.maxR) s.maxR = r;
        s.n++;
      }
    }
  });
  // estadísticas por fila (anillo): llanura media y nº de asientos
  const rowStat = new Map();
  for (const [key, s] of seats) {
    const row = Math.floor(key / 100000);
    let rs = rowStat.get(row);
    if (!rs) { rs = { f: 0, n: 0 }; rowStat.set(row, rs); }
    rs.f += s.ny / s.n; rs.n++;
  }
  const recs = [];
  for (const [key, s] of seats) {
    if (!seatOnly) {
      const rs = rowStat.get(Math.floor(key / 100000));
      if (rs.n < minRow) continue;                                 // filas cortas: vigas de la celosía, plataformas sueltas (filas reales: >300)
      if (flatFilter && s.ny / s.n > 0.985 && (s.maxR - s.minR) > 1.05) continue;   // plano y ancho: paseo / explanada
      if (flatFilter && rs.f / rs.n > 0.982 && (s.maxR - s.minR) > 1.05) continue;  // anillo plano ancho (parapeto/pasarela)
    }
    const phi = Math.atan2(s.sx / s.n, s.cx / s.n);
    recs.push({ phi, r: s.sr / s.n, y: seatOnly ? s.ymin + 0.12 : s.sy / s.n });
  }
  if (seatOnly) {
    // la mitad oeste del GLB está decimada: se descarta y se reconstruye como
    // espejo exacto del este (el estadio es simétrico en x)
    const east = recs.filter(rec => Math.cos(rec.phi) * rec.r > -0.2);
    recs.length = 0;
    recs.push(...east);
    for (const rec of east) {
      const x = Math.cos(rec.phi) * rec.r;
      if (x > 0.2) {
        const z = Math.sin(rec.phi) * rec.r;
        recs.push({ phi: Math.atan2(z, -x), r: rec.r, y: rec.y });
      }
    }
  }
  // radio ELÍPTICO normalizado + radio circular: el bowl real no es ni círculo ni elipse
  // perfecta; la envolvente de continuidad se pasa con ambas métricas y se une el resultado
  const absx = [], absz = [];
  for (const rec of recs) {
    rec._x = Math.cos(rec.phi) * rec.r; rec._z = Math.sin(rec.phi) * rec.r;
    absx.push(Math.abs(rec._x)); absz.push(Math.abs(rec._z));
  }
  absx.sort((a, b) => a - b); absz.sort((a, b) => a - b);
  const ax = absx[Math.floor(absx.length * 0.95)] || 1, az = absz[Math.floor(absz.length * 0.95)] || 1;
  const RB = 42;
  const envelopePass = (rbOf) => {
    const bins = new Map();
    for (const rec of recs) {
      const sec = Math.floor((rec.phi + Math.PI) / (Math.PI * 2) * 24);
      const b = sec * 1000 + rbOf(rec);
      if (!bins.has(b)) bins.set(b, []);
      bins.get(b).push(rec);
    }
    const kept = new Set();
    for (let sec = 0; sec < 24; sec++) {
      const rbs = [];
      for (const b of bins.keys()) if (Math.floor(b / 1000) === sec) rbs.push(b % 1000);
      rbs.sort((a, b) => a - b);
      let env = -Infinity, missed = 0;
      if (rbs.length) for (let rb = rbs[0]; rb <= rbs[rbs.length - 1]; rb++) {
        const arr = bins.get(sec * 1000 + rb);
        if (!arr) { missed++; continue; }
        arr.sort((a, b) => a.y - b.y);
        const clusters = [[arr[0]]];
        for (let i = 1; i < arr.length; i++) {
          if (arr[i].y - arr[i - 1].y > gap) clusters.push([]);
          clusters[clusters.length - 1].push(arr[i]);
        }
        let any = false;
        for (const cl of clusters) {
          const bottom = cl[0].y, top = cl[cl.length - 1].y;
          const ok = env === -Infinity ? bottom < baseY : bottom <= env + gap + missed * 2.0;
          if (!ok) continue;
          env = Math.max(env, top);
          any = true;
          for (const rec of cl) kept.add(rec);
        }
        missed = any ? 0 : missed + 1;
      }
    }
    return kept;
  };
  const keepA = seatOnly ? new Set(recs) : envelopePass(rec => Math.round(rec.r / 2));
  const keepB = seatOnly ? keepA : envelopePass(rec => Math.round(Math.hypot(rec._x / ax, rec._z / az) * RB));
  const keep = keepA;
  for (const rec of keepB) keep.add(rec);
  // vecindad: butacas reales tienen filas contiguas encima/debajo;
  // líneas 1D (parapetos, cornisas) no tienen vecinos verticales
  const cellR = 2.3, hash = new Map();
  const kArr = [...keep];
  kArr.forEach(rec => {
    const k = `${Math.floor(rec._x / cellR)},${Math.floor(rec.y / cellR)},${Math.floor(rec._z / cellR)}`;
    if (!hash.has(k)) hash.set(k, []);
    hash.get(k).push(rec);
  });
  const dense = [];
  if (seatOnly) {
    dense.push(...kArr);      // butacas reales: sin poda de vecindad
  } else for (const rec of kArr) {
    let nb = 0, vert = 0;
    const cx = Math.floor(rec._x / cellR), cy = Math.floor(rec.y / cellR), cz = Math.floor(rec._z / cellR);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const lst = hash.get(`${cx + dx},${cy + dy},${cz + dz}`);
      if (!lst) continue;
      for (const o of lst) {
        if (o === rec) continue;
        const ddx = o._x - rec._x, ddy = o.y - rec.y, ddz = o._z - rec._z;
        if (ddx * ddx + ddy * ddy + ddz * ddz < cellR * cellR) {
          nb++;
          if (Math.abs(ddy) > 0.3) vert++;
        }
      }
    }
    if (nb >= minNb && vert >= minVert) dense.push(rec);
  }
  // emisión con pasillos radiales + dedupe espacial (sin dobles)
  const aStep = Math.PI * 2 / aisleN;
  const grid = new Set();
  const out = [];
  for (const rec of dense) {
    if (Math.random() > fill) continue;
    if (!seatOnly) {
      const dA = Math.abs(((rec.phi % aStep) + aStep) % aStep - aStep / 2);
      if ((aStep / 2 - dA) * rec.r < aisleHalf) continue;   // el modelo real ya trae pasillos
    }
    const x = Math.cos(rec.phi) * rec.r, z = Math.sin(rec.phi) * rec.r;
    const gk = Math.round(x / (seatOnly ? 0.34 : 0.42)) * 131071 ^ Math.round(z / (seatOnly ? 0.34 : 0.42)) * 524287 ^ Math.round(rec.y / 0.8) * 8191;
    if (grid.has(gk)) continue;
    grid.add(gk);
    out.push(x, rec.y, z);
  }
  const envKeep = keep.size;
  console.log(`butacas: ${seats.size} bins -> ${recs.length} filtros -> ${envKeep} envolvente -> ${dense.length} vecindad -> ${out.length / 3} finales`);
  return Float32Array.from(out);
}

/* ---- InstancedMeshes con atlas de poses + bob en shader ---- */
function buildCrowd(points) {
  const group = new THREE.Group(); group.name = 'PUBLICO';
  const uTime = { value: 0 }, uAmp = { value: 0.025 }, uMode = { value: 0 }, uMix = { value: 0 };
  const geoSeat = crossGeo(0.78, 1.17);    // sentado (regazo→manos arriba)
  const geoStand = crossGeo(0.72, 1.44);   // de pie
  const n = points.length / 3;
  const seatB = VARIANTS.map(() => []), standB = VARIANTS.map(() => []);
  for (let i = 0; i < n; i++) {
    const v = Math.floor(Math.random() * VARIANTS.length);
    (Math.random() < 0.05 ? standB : seatB)[v].push(i);
  }
  const patch = mat => {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime; sh.uniforms.uAmp = uAmp; sh.uniforms.uMode = uMode; sh.uniforms.uMix = uMix;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uAmp;\nuniform float uMode;\nuniform float uMix;\nattribute float aCol;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          #ifdef USE_MAP
            float ph0 = instanceMatrix[3][0] * 3.1 + instanceMatrix[3][2] * 2.3;
            float col = aCol;
            if (uMix > 0.5 && uMode > 0.5) col = (uMode < 1.5) ? 3.0 : (uMode < 2.5 ? (fract(ph0 * 3.7) < 0.6 ? 2.0 : 1.0) : 3.0);
            vMapUv = vMapUv * vec2(0.25, 1.0) + vec2(col * 0.25, 0.0);
          #endif`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = instanceMatrix[3][0] * 3.1 + instanceMatrix[3][2] * 2.3;
          transformed.y += (0.5 + 0.5 * sin(uTime * (2.0 + fract(ph) * 1.6) + ph)) * uAmp * (0.4 + fract(ph * 1.7));
          if (uMode > 1.5 && uMode < 2.5) transformed.x += sin(uTime * 3.2 + ph) * 0.09 * uMix;   // abucheo: balanceo
          if (uMode > 2.5) transformed.y += (0.5 + 0.5 * sin(uTime * 5.0 + ph * 2.0)) * 0.12 * uMix;  // ovación: brinco corto`);
    };
  };
  const emit = (idxs, tex, baseGeo, lift, jitter) => {
    if (!idxs.length) return;
    const geo = baseGeo.clone();
    const cols = new Float32Array(idxs.length);
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 1, metalness: 0 });
    patch(mat);
    const im = new THREE.InstancedMesh(geo, mat, idxs.length);
    idxs.forEach((pi, k) => {
      cols[k] = Math.floor(Math.random() * 4);
      dummy.position.set(points[pi * 3], points[pi * 3 + 1] + lift, points[pi * 3 + 2]);
      dummy.rotation.set(0, Math.atan2(-dummy.position.x, -dummy.position.z) + (Math.random() - 0.5) * jitter, 0);
      const s = 0.95 + Math.random() * 0.1;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      im.setMatrixAt(k, dummy.matrix);
    });
    geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(cols, 1));
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    im.receiveShadow = true;
    group.add(im);
  };
  VARIANTS.forEach((V, vi) => {
    emit(seatB[vi], seatedAtlas(...V), geoSeat, 0.3, 0.1);
    emit(standB[vi], standingAtlas(...V), geoStand, 0.02, 0.3);
  });
  return { group, uTime, uAmp, uMode, uMix, count: n };
}

/* ---- texturas de bandera ---- */
function flagTexture(kind) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
  const c = cv.getContext('2d');
  if (kind === 'qatar') {
    c.fillStyle = '#8a1538'; c.fillRect(0, 0, 256, 160);
    c.fillStyle = '#f4f2ec'; c.fillRect(0, 0, 72, 160);
    c.beginPath(); c.moveTo(72, 0);
    for (let i = 0; i < 9; i++) { c.lineTo(100, 160 / 18 + i * 160 / 9); c.lineTo(72, (i + 1) * 160 / 9); }
    c.closePath(); c.fill();
  } else if (kind === 'club') {
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#17181c' : '#e8c522'; c.fillRect(i * 32, 0, 32, 160); }
    c.fillStyle = '#f4f2ec'; c.beginPath(); c.arc(128, 80, 34, 0, 6.3); c.fill();
    c.fillStyle = '#17181c'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('FC', 128, 82);
  } else {
    c.fillStyle = '#1a2030'; c.fillRect(0, 0, 256, 160);
    c.fillStyle = '#c9a24b';
    c.beginPath(); c.moveTo(0, 160); c.lineTo(256, 40); c.lineTo(256, 90); c.lineTo(0, 160); c.closePath(); c.fill();
    c.beginPath(); c.arc(70, 58, 24, 0, 6.3); c.fill();
  }
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
const FLAG_KINDS = ['qatar', 'club', 'gold'];

/* ---- mástiles con banderas de tela animada ---- */
export function makeFlags(basePoints, { poleH = 7, w = 2.7, h = 1.7 } = {}) {
  const group = new THREE.Group(); group.name = 'BANDERAS';
  const mPole = new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.35, metalness: 0.8 });
  const flags = [];
  basePoints.forEach((p, i) => {
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, poleH, 8), mPole);
    pole.position.y = poleH / 2;
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xc9a24b, roughness: 0.3, metalness: 0.9 }));
    fin.position.y = poleH + 0.08;
    const geo = new THREE.PlaneGeometry(w, h, 14, 6);
    geo.translate(w / 2, 0, 0);
    const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: flagTexture(FLAG_KINDS[i % 3]), side: THREE.DoubleSide, roughness: 0.9,
    }));
    cloth.position.set(0.06, poleH - h / 2 - 0.12, 0);
    g.add(pole, fin, cloth);
    g.rotation.y = Math.random() * Math.PI * 2;
    group.add(g);
    flags.push({ cloth, base: geo.attributes.position.array.slice(), phase: Math.random() * 9 });
  });
  function update(t, ex) {
    if (!visibleChain(group)) return;
    const sp = 3.2 + ex * 3.5, amp = 1 + ex * 0.7;
    for (const f of flags) {
      const pos = f.cloth.geometry.attributes.position, arr = pos.array, base = f.base;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], k = x / w;
        arr[i + 2] = (Math.sin(x * 2.3 - t * sp + f.phase) * 0.16 + Math.sin(x * 5.2 - t * sp * 1.7 + f.phase) * 0.05) * k * amp;
        arr[i + 1] = base[i + 1] + Math.sin(x * 3.1 - t * sp + f.phase * 1.3) * 0.07 * k * amp;
      }
      pos.needsUpdate = true;
      f.cloth.geometry.computeVertexNormals();
    }
  }
  return { group, update };
}

export function ellipseFlagPoints(n, rx, rz, y) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = i / n * Math.PI * 2 + 0.13;
    pts.push({ x: Math.cos(th) * rx, y, z: Math.sin(th) * rz });
  }
  return pts;
}

/* ---- todo junto para el GLB de Al Wakrah ---- */
export function makeCrowdAndFlags(alignedRoot, opts = {}) {
  const points = sampleSeats(alignedRoot, opts);
  console.log('PÚBLICO en butacas:', points.length / 3, 'espectadores');
  const group = new THREE.Group(); group.name = 'AMBIENTE_Wakrah';
  let crowd = null, flagsCtl = null;
  if (points.length >= 3 * 200) {
    crowd = buildCrowd(points);
    group.add(crowd.group);
    const SEC = 18, rim = new Array(SEC).fill(null);
    for (let i = 0; i < points.length; i += 3) {
      const x = points[i], y = points[i + 1], z = points[i + 2];
      const s = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * SEC) % SEC;
      if (!rim[s] || y > rim[s].y) rim[s] = { x, y, z };
    }
    flagsCtl = makeFlags(rim.filter(Boolean), { poleH: 6.5, w: 2.7, h: 1.7 });
    group.add(flagsCtl.group);
  } else {
    console.warn('Muestreo de gradas insuficiente; usando anillos fijos');
    crowd = buildCrowd(ringFallbackPoints());
    group.add(crowd.group);
    flagsCtl = makeFlags(ellipseFlagPoints(16, 74, 92, 34), { poleH: 6.5 });
    group.add(flagsCtl.group);
  }
  function update(t, ex, mode = 0, mix = 0) {
    if (visibleChain(crowd.group)) { crowd.uTime.value = t; crowd.uAmp.value = 0.025 + ex * 0.55; crowd.uMode.value = mode; crowd.uMix.value = mix; }
    flagsCtl.update(t, ex);
  }
  return { group, update };
}
function ringFallbackPoints() {
  const pts = [];
  for (let ring = 0; ring < 14; ring++) {
    const f = ring / 13, rx = 44 + f * 32, rz = 62 + f * 32, y = 2 + f * 31;
    const n = Math.floor(rx * 2.4);
    for (let i = 0; i < n; i++) {
      const th = i / n * Math.PI * 2 + ring * 0.11;
      pts.push(Math.cos(th) * rx + (Math.random() - 0.5), y, Math.sin(th) * rz + (Math.random() - 0.5));
    }
  }
  return Float32Array.from(pts);
}
