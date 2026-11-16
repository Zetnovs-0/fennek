// voxel.js — маленький движок воксельных декораций.
// Все коробки склеиваются в одну геометрию с вершинными цветами:
// так сцена из тысяч кубиков рисуется за один draw call.
import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FACE_SHADE = {
  px: 0.86,
  nx: 0.78,
  py: 1.0,
  ny: 0.52,
  pz: 0.9,
  nz: 0.68,
};

export const PALETTE = {
  woodDark: 0x5b3a29,
  wood: 0x8a5a3b,
  woodLight: 0xb57b4f,
  cream: 0xf3e2c5,
  paper: 0xf7f0df,
  ink: 0x262630,
  wallWarm: 0xd9c9b2,
  wallBlue: 0x6c8195,
  wallMint: 0x8fa896,
  night: 0x11182b,
  asphalt: 0x3c4453,
  asphaltLit: 0x555e70,
  grass: 0x506b4b,
  leaf: 0x3d5f48,
  leafLight: 0x5c7f55,
  metal: 0x7c8790,
  metalDark: 0x4d565e,
  rust: 0x8c5237,
  blanket: 0x527f86,
  accent: 0xf0b45c,
  accentHot: 0xff7c5c,
  pink: 0xd98b9a,
  yellow: 0xe6c75a,
  blue: 0x5f7fa8,
  violet: 0x7a6b9e,
};

class VoxelBuilder {
  constructor(seed = 7) {
    this.pos = [];
    this.norm = [];
    this.col = [];
    this.idx = [];
    this.count = 0;
    this.rand = mulberry32(seed);
    this.color = new THREE.Color();
  }

  box(x, y, z, w, h, d, color, opts = {}) {
    const jitter = opts.jitter ?? 0;
    const shade = opts.shade ?? 1;
    const bright = 1 + (this.rand() - 0.5) * jitter;
    this.color.set(color);
    const r = this.color.r * shade * bright;
    const g = this.color.g * shade * bright;
    const b = this.color.b * shade * bright;
    const x1 = x + w;
    const y1 = y + h;
    const z1 = z + d;
    const faces = [
      // +X
      [FACE_SHADE.px, 1, 0, 0, [x1, y, z1, x1, y, z, x1, y1, z, x1, y1, z1]],
      // -X
      [FACE_SHADE.nx, -1, 0, 0, [x, y, z, x, y, z1, x, y1, z1, x, y1, z]],
      // +Y
      [FACE_SHADE.py, 0, 1, 0, [x, y1, z1, x1, y1, z1, x1, y1, z, x, y1, z]],
      // -Y
      [FACE_SHADE.ny, 0, -1, 0, [x, y, z, x1, y, z, x1, y, z1, x, y, z1]],
      // +Z
      [FACE_SHADE.pz, 0, 0, 1, [x, y, z1, x1, y, z1, x1, y1, z1, x, y1, z1]],
      // -Z
      [FACE_SHADE.nz, 0, 0, -1, [x1, y, z, x, y, z, x, y1, z, x1, y1, z]],
    ];
    for (const [fs, nx, ny, nz, v] of faces) {
      this.pos.push(...v);
      this.norm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
      this.col.push(r * fs, g * fs, b * fs, r * fs, g * fs, b * fs, r * fs, g * fs, b * fs, r * fs, g * fs, b * fs);
      this.idx.push(this.count, this.count + 1, this.count + 2, this.count, this.count + 2, this.count + 3);
      this.count += 4;
    }
  }

  build() {
    if (!this.count) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setIndex(this.idx);
    geo.computeBoundingSphere();
    return geo;
  }
}

export class World {
  constructor(name, { background = 0x11182b, fog = null, seed = 13 } = {}) {
    this.name = name;
    this.scene = new THREE.Scene();
    this.scene.name = name;
    this.scene.background = new THREE.Color(background);
    if (fog) this.scene.fog = new THREE.Fog(background, fog[0], fog[1]);
    this.solid = new VoxelBuilder(seed);
    this.glowB = new VoxelBuilder(seed + 2);
    this.obstacles = [];
    this.hotspots = [];
    this.npcs = [];
    this.fennecSpawn = null;
    this.avatarSpawn = null;
    this.camera = { yaw: 0, pitch: 0.42, dist: 5.6, targetHeight: 1.15 };
    this.bounds = { minX: -4, maxX: 4, minZ: -3, maxZ: 3 };
    this.spawn = { x: 0, z: 1.5, rot: Math.PI };
    this.updateFns = [];
    this.time = 0;
    this.finished = false;
  }

  box(x, y, z, w, h, d, color, opts) {
    this.solid.box(x, y, z, w, h, d, color, opts);
    return this;
  }

  glowBox(x, y, z, w, h, d, color, opts = {}) {
    this.glowB.box(x, y, z, w, h, d, color, opts);
    return this;
  }

  addObstacle(minX, maxX, minZ, maxZ) {
    this.obstacles.push({ minX, maxX, minZ, maxZ });
  }

  addHotspot(id, x, z, radius = 1.35) {
    this.hotspots.push({ id, x, z, radius });
  }

  addSpawn(x, z, rot = Math.PI) {
    this.spawn = { x, z, rot };
    this.avatarSpawn = { x, z };
  }

  addFennec(x, z, mode = 'follow', rot = 0, scale = 1) {
    this.fennecSpawn = { x, z, mode, rot, scale };
  }

  addNpc(obj) {
    if (obj.group) {
      obj.group.position.set(obj.x ?? 0, obj.y ?? 0, obj.z ?? 0);
      if (obj.rot !== undefined) obj.group.rotation.y = obj.rot;
      this.scene.add(obj.group);
    }
    this.npcs.push(obj);
    return obj;
  }

  addLight(light) {
    this.scene.add(light);
    return light;
  }

  addPointLight(color, intensity, distance, x, y, z, opts = {}) {
    const l = new THREE.PointLight(color, intensity, distance, opts.decay ?? 2);
    l.position.set(x, y, z);
    if (opts.shadow) {
      l.castShadow = true;
      l.shadow.mapSize.set(512, 512);
      l.shadow.bias = -0.002;
    }
    this.scene.add(l);
    return l;
  }

  addGlow(x, y, z, color, size = 1.4, opacity = 0.5) {
    const sprite = makeGlowSprite(color, size, opacity);
    sprite.position.set(x, y, z);
    this.scene.add(sprite);
    return sprite;
  }

  addStars(count = 90, radius = 35, yMin = 8, seed = 4) {
    const rand = mulberry32(seed);
    const positions = [];
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = radius * (0.65 + rand() * 0.35);
      positions.push(Math.cos(a) * r, yMin + rand() * 16, Math.sin(a) * r);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xf4eed6,
      size: 0.14,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    return pts;
  }

  addTextPlane({
    text,
    x,
    y,
    z,
    w = 1.4,
    h = 0.7,
    rotY = 0,
    bg = '#f7f0df',
    fg = '#2c2b36',
    sub = '',
    accent = '#c26a4a',
    font = '700 90px "Pixelify Sans", monospace',
  }) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.round((512 * h) / w);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // лёгкая «бумажная» фактура
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = i % 2 ? '#000' : '#fff';
      ctx.fillRect((i * 73) % canvas.width, (i * 151) % canvas.height, 3, 3);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = bg;
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    ctx.fillStyle = accent;
    ctx.fillRect(26, 22, 8, canvas.height - 44);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font;
    let size = parseInt(font.match(/(\d+)px/)?.[1] || '90', 10);
    while (ctx.measureText(text).width > canvas.width - 90 && size > 20) {
      size -= 4;
      ctx.font = font.replace(/\d+px/, `${size}px`);
    }
    ctx.fillText(text, canvas.width / 2 + 6, sub ? canvas.height * 0.43 : canvas.height / 2);
    if (sub) {
      ctx.font = `500 ${Math.round(size * 0.36)}px "Manrope", sans-serif`;
      ctx.fillStyle = '#6c665e';
      ctx.fillText(sub, canvas.width / 2 + 6, canvas.height * 0.72);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    this.scene.add(mesh);
    return mesh;
  }

  addTiles(x0, x1, z0, z1, palette, { tile = 0.9, y = -0.04, h = 0.08, jitter = 0.08, seed = 5 } = {}) {
    const rand = mulberry32(seed);
    const nx = Math.ceil((x1 - x0) / tile);
    const nz = Math.ceil((z1 - z0) / tile);
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const cx = x0 + ix * tile;
        const cz = z0 + iz * tile;
        const w = Math.min(tile - 0.025, x1 - cx);
        const d = Math.min(tile - 0.025, z1 - cz);
        if (w <= 0.02 || d <= 0.02) continue;
        const c = palette[Math.floor(rand() * palette.length)];
        this.box(cx, y, cz, w, h, d, c, { jitter });
      }
    }
  }

  onUpdate(fn) {
    this.updateFns.push(fn);
  }

  finish() {
    const solidGeo = this.solid.build();
    if (solidGeo) {
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const mesh = new THREE.Mesh(solidGeo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    const glowGeo = this.glowB.build();
    if (glowGeo) {
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
      const mesh = new THREE.Mesh(glowGeo, mat);
      this.scene.add(mesh);
    }
    this.finished = true;
    return this;
  }

  update(dt, t, playerPos) {
    for (const fn of this.updateFns) fn(dt, t, playerPos);
    for (const npc of this.npcs) {
      if (npc.update) npc.update(dt, t, false, 0);
    }
  }

  dispose() {
    const release = (obj) => {
      // персонажи используют общий кэш материалов и геометрии — их не трогаем
      if (obj.userData && obj.userData.persistent) return;
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m.map && !m.map.userData.shared) m.map.dispose();
          m.dispose();
        }
      }
      for (const child of obj.children) release(child);
    };
    for (const child of this.scene.children) release(child);
    this.scene.clear();
  }
}

let glowTexture = null;
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  glowTexture.userData.shared = true;
  return glowTexture;
}

export function makeGlowSprite(color, size, opacity = 0.5) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(size);
  return sprite;
}

export function addStandardLights(world, { hemi = 0x9bb2df, ground = 0x392f2b, hemiIntensity = 1.1, sun = 0xffd7a8, sunIntensity = 1.7, sunPos = [6, 9, 5] } = {}) {
  const h = new THREE.HemisphereLight(hemi, ground, hemiIntensity);
  world.scene.add(h);
  const d = new THREE.DirectionalLight(sun, sunIntensity);
  d.position.set(...sunPos);
  d.castShadow = true;
  d.shadow.mapSize.set(2048, 2048);
  d.shadow.camera.left = -12;
  d.shadow.camera.right = 12;
  d.shadow.camera.top = 12;
  d.shadow.camera.bottom = -12;
  d.shadow.camera.near = 0.5;
  d.shadow.camera.far = 40;
  d.shadow.bias = -0.0015;
  d.shadow.normalBias = 0.02;
  world.scene.add(d);
  return { hemi: h, sun: d };
}

// Маленький воксельный предмет для стола/полки.
export function voxelPlant(world, x, y, z, scale = 1, seed = 3) {
  const rand = mulberry32(seed);
  world.box(x, y, z, 0.22 * scale, 0.18 * scale, 0.22 * scale, 0x9b6a4a);
  world.box(x - 0.01, y + 0.17 * scale, z - 0.01, 0.24 * scale, 0.03 * scale, 0.24 * scale, 0x6d4630);
  const stemH = 0.24 * scale;
  world.box(x + 0.09 * scale, y + 0.18 * scale, z + 0.09 * scale, 0.05 * scale, stemH, 0.05 * scale, 0x4c6b3f);
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.09 * scale;
    world.box(
      x + 0.1 * scale + Math.cos(a) * r,
      y + (0.34 + rand() * 0.12) * scale,
      z + 0.1 * scale + Math.sin(a) * r,
      (0.08 + rand() * 0.06) * scale,
      0.05 * scale,
      (0.08 + rand() * 0.06) * scale,
      i % 2 ? 0x54794c : 0x6d9160,
    );
  }
}
