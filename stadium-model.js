/* ESTADIOS REALES — GLBs del usuario guardados en trozos gzip */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const STADIUMS = {
  wakrah: {
    parts: ['./assets/stadium/wc1.glb.gz.part1of2', './assets/stadium/wc1.glb.gz.part2of2'],
    align: { scale: 7.15, rotY: Math.PI / 2, x: 0, y: 0, z: 0 },
    hide: [/^Object_(2[789]|3[0-5])$/, /^Circle001/],     // porterías sobredimensionadas + césped de baja resolución
    name: 'Al_Wakrah',
  },
  euro: {
    parts: ['./assets/stadium/euro.glb.gz.part1of2', './assets/stadium/euro.glb.gz.part2of2'],
    align: { scale: 105 / 25635.2, rotY: 0, x: 0, y: 0, z: 0 },   // Plane_Material001_0 = césped 16406×25635 u → 68×105 m
    hide: [/^Plane_Material001_0$/, /^Cube10[01]__0$/, /^Plane008_Material052_0$/, /^Cylinder0(0[1-9]|1[0-9])__0$/, /_Material05[18]_0$/],   // césped (→ PBR 4K), porterías del modelo (postes/redes/vallas), plano-cielo gigante
    name: 'Euro_Arena',
  },
};
/* compatibilidad */
export const ALIGN = STADIUMS.wakrah.align;

const cache = {};
export async function loadStadium(id, onProgress) {
  const cfg = STADIUMS[id];
  if (cache[id]) return cache[id];
  const bufs = [];
  for (let i = 0; i < cfg.parts.length; i++) {
    const r = await fetch(cfg.parts[i]);
    if (!r.ok) throw new Error('parte no encontrada: ' + cfg.parts[i]);
    bufs.push(await r.arrayBuffer());
    onProgress && onProgress((i + 1) / (cfg.parts.length + 1));
  }
  const gz = new Blob(bufs);
  const ds = new DecompressionStream('gzip');
  const glb = await new Response(gz.stream().pipeThrough(ds)).arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(glb, './assets/stadium/');
  onProgress && onProgress(1);
  const scene = gltf.scene || gltf.scenes[0];
  scene.name = 'ESTADIO_' + cfg.name + '_GLB';
  // KHR_materials_pbrSpecularGlossiness (obsoleta, sin soporte en GLTFLoader): recuperar difuso/textura a mano
  const json = gltf.parser.json;
  const specGloss = new Map();
  if (json.materials) json.materials.forEach((m, i) => { const sg = m.extensions && m.extensions.KHR_materials_pbrSpecularGlossiness; if (sg) specGloss.set(i, sg); });
  const fixMat = async (mesh) => {
    const assoc = gltf.parser.associations.get(mesh.material);
    const idx = assoc && assoc.materials;
    const sg = idx !== undefined ? specGloss.get(idx) : null;
    if (!sg) return;
    const old = mesh.material;
    const mat = new THREE.MeshStandardMaterial({ name: old.name, roughness: 1 - (sg.glossinessFactor ?? 0.5) * 0.6, metalness: 0, side: THREE.FrontSide });
    if (sg.diffuseFactor) { mat.color.setRGB(sg.diffuseFactor[0], sg.diffuseFactor[1], sg.diffuseFactor[2]); if (sg.diffuseFactor[3] < 1) { mat.transparent = true; mat.opacity = sg.diffuseFactor[3]; } }
    if (sg.diffuseTexture) { const t = await gltf.parser.getDependency('texture', sg.diffuseTexture.index); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; mat.map = t; }
    if (old.normalMap) mat.normalMap = old.normalMap;
    if (old.emissiveMap) { mat.emissiveMap = old.emissiveMap; mat.emissive.set(0xffffff); }
    mesh.material = mat;
  };
  const fixes = [];
  scene.traverse(o => { if (o.isMesh) fixes.push(fixMat(o)); });
  await Promise.all(fixes);
  scene.traverse(o => {
    if (cfg.hide.some(rx => rx.test(o.name))) o.visible = false;
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      const m = o.material;
      if (m) {
        m.side = THREE.FrontSide;
        // texturas: mipmaps trilineales + anisotropía máxima (nitidez en ángulo rasante, sin shimmering)
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
          const t = m[k]; if (!t) continue;
          t.anisotropy = 16; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
        }
        // materiales de un GLB arquitectónico suelen venir demasiado brillantes/planos
        if (m.isMeshStandardMaterial) {
          if (!m.roughnessMap) m.roughness = Math.max(m.roughness, 0.55);
          if (!m.metalnessMap) m.metalness = Math.min(m.metalness, 0.15);
          m.envMapIntensity = 0.6;
          if (m.map && !m.aoMap && o.geometry.attributes.uv && !o.geometry.attributes.uv1) o.geometry.setAttribute('uv1', o.geometry.attributes.uv);
        }
      }
    }
  });
  cache[id] = scene;
  return scene;
}
export function alignStadium(id, scene) {
  const A = STADIUMS[id].align;
  const g = new THREE.Group();
  g.name = 'ESTADIO_' + STADIUMS[id].name + '_Real';
  scene.rotation.y = A.rotY;
  scene.scale.setScalar(A.scale);
  scene.position.set(A.x, A.y, A.z);
  g.add(scene);
  return g;
}
export const loadWakrahReal = (p) => loadStadium('wakrah', p);
export const alignWakrah = (s) => alignStadium('wakrah', s);
