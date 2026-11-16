// worlds.js — воксельные декорации: комната, кухня, двор, класс, гостиная.
import * as THREE from 'three';
import { World, PALETTE, addStandardLights, voxelPlant, makeGlowSprite } from './voxel.js';
import { createHumanoid, createFennec, NPC_PRESETS } from './characters.js';
import { dreamOf } from './story.js';

const W = PALETTE;

function addNpcStanding(world, preset, x, z, rot, override = {}) {
  const h = createHumanoid({ ...preset, ...override });
  return world.addNpc({
    group: h.group,
    x, z, rot,
    update: (dt, t) => h.update(dt, t, false, 0),
  });
}

function addNpcSeated(world, preset, x, z, rot, y = null) {
  const h = createHumanoid({ ...preset, sitting: true });
  const scale = (preset.height ?? 1.76) / 1.78;
  const seatY = y ?? (0.44 - 0.84 * scale);
  return world.addNpc({
    group: h.group,
    x, z, y: seatY, rot,
    update: (dt, t) => h.update(dt, t, false, 0),
  });
}

function rug(world, x, z, w, d, colors, seed = 8) {
  const rand = (() => { let a = seed; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; })();
  world.box(x, 0.006, z, w, 0.02, d, colors[0]);
  world.box(x + 0.08, 0.018, z + 0.08, w - 0.16, 0.018, d - 0.16, colors[1]);
  const rows = Math.max(2, Math.floor(d / 0.32));
  for (let i = 0; i < rows; i++) {
    const zz = z + 0.15 + i * ((d - 0.3) / rows);
    const c = colors[2 + (i % Math.max(1, colors.length - 2))] || colors[1];
    world.box(x + 0.18, 0.032, zz, w - 0.36, 0.014, 0.07, c, { jitter: 0.1 });
  }
  for (let i = 0; i < 6; i++) {
    world.box(x + 0.2 + rand() * (w - 0.45), 0.036, z + 0.18 + rand() * (d - 0.36), 0.05, 0.01, 0.05, colors[3] || colors[2]);
  }
}

function bed(world, x, z, w, d, blanket = W.blanket, seed = 2) {
  world.box(x, 0.12, z, w, 0.22, d, 0x6b4732);
  world.box(x + 0.06, 0.34, z + 0.06, w - 0.12, 0.18, d - 0.12, 0xf0e5d0);
  world.box(x + 0.06, 0.51, z + d * 0.38, w - 0.12, 0.10, d * 0.60, blanket, { jitter: 0.05 });
  world.box(x + 0.04, 0.57, z + d * 0.34, w - 0.08, 0.04, 0.12, 0xe6d7bd);
  world.box(x + 0.18, 0.55, z + 0.18, w * 0.42, 0.14, d * 0.24, 0xf5ecd9);
  // подушки/складки
  world.box(x + w * 0.58, 0.50, z + 0.22, w * 0.26, 0.12, d * 0.20, 0xe8dcc4);
  world.box(x + w * 0.62, 0.63, z + 0.35, w * 0.16, 0.08, d * 0.12, 0x7f9fa2);
  // изголовье
  world.box(x - 0.05, 0.12, z - 0.08, w + 0.10, 1.05, 0.14, 0x5a3a2a);
  world.box(x - 0.02, 0.9, z - 0.05, w + 0.04, 0.14, 0.10, 0x7a5137);
  // плюшевый зверь
  const px = x + w * 0.78;
  const pz = z + d * 0.68;
  world.box(px, 0.66, pz, 0.17, 0.16, 0.15, 0xb98a62);
  world.box(px + 0.035, 0.80, pz, 0.10, 0.10, 0.10, 0xc99a70);
  world.box(px - 0.04, 0.78, pz, 0.05, 0.05, 0.05, 0xb98a62);
  world.box(px + 0.11, 0.78, pz, 0.05, 0.05, 0.05, 0xb98a62);
  world.addObstacle(x - 0.05, x + w + 0.05, z - 0.1, z + d + 0.05);
}

function desk(world, x, z, w, d, color = 0x9a6b46) {
  world.box(x, 0.72, z, w, 0.10, d, color);
  world.box(x + 0.06, 0.0, z + 0.06, 0.09, 0.72, 0.09, 0x6b4732);
  world.box(x + w - 0.15, 0.0, z + 0.06, 0.09, 0.72, 0.09, 0x6b4732);
  world.box(x + 0.06, 0.0, z + d - 0.15, 0.09, 0.72, 0.09, 0x6b4732);
  world.box(x + w - 0.15, 0.0, z + d - 0.15, 0.09, 0.72, 0.09, 0x6b4732);
  // ящик
  world.box(x + 0.08, 0.38, z + d - 0.28, w - 0.16, 0.26, 0.28, 0x83593c);
  world.box(x + w / 2 - 0.05, 0.49, z + d - 0.32, 0.10, 0.035, 0.03, 0xc7a56e);
  world.addObstacle(x - 0.02, x + w + 0.02, z - 0.02, z + d + 0.02);
}

function chair(world, x, z, rot = 0, color = 0x6d4a34) {
  // стул без вращения: просто компактный воксельный объект
  world.box(x, 0.42, z, 0.42, 0.06, 0.42, color);
  world.box(x + 0.02, 0.48, z - 0.17, 0.38, 0.42, 0.05, color);
  world.box(x + 0.02, 0.0, z + 0.03, 0.05, 0.42, 0.05, 0x54382a);
  world.box(x + 0.35, 0.0, z + 0.03, 0.05, 0.42, 0.05, 0x54382a);
  world.box(x + 0.02, 0.0, z + 0.34, 0.05, 0.42, 0.05, 0x54382a);
  world.box(x + 0.35, 0.0, z + 0.34, 0.05, 0.42, 0.05, 0x54382a);
  world.addObstacle(x - 0.02, x + 0.44, z - 0.20, z + 0.44);
}

function books(world, x, y, z, count = 4, seed = 4) {
  const colors = [0x7a4f63, 0x4f6d7a, 0xd9b060, 0x5b7a52, 0x8d3f3b, 0x5b628c];
  for (let i = 0; i < count; i++) {
    world.box(x, y + i * 0.055, z, 0.24 - i * 0.012, 0.05, 0.18, colors[(i + seed) % colors.length], { jitter: 0.04 });
  }
}

function wallPhoto(world, x, y, z, rotY = 0, w = 0.8, h = 0.6) {
  // рамка
  world.box(x - w / 2, y - h / 2, z, w, h, 0.05, 0x4e392d);
  world.box(x - w / 2 + 0.06, y - h / 2 + 0.06, z + (rotY === 0 ? 0.045 : 0), w - 0.12, h - 0.12, 0.02, 0xe9e0cf);
  // фигурки на фото
  const baseZ = z + (rotY === 0 ? 0.058 : 0);
  world.box(x - 0.18, y - 0.1, baseZ, 0.13, 0.19, 0.01, 0x8fa2a0);
  world.box(x - 0.18, y + 0.12, baseZ, 0.09, 0.09, 0.01, 0xd8b08c);
  world.box(x + 0.02, y - 0.13, baseZ, 0.14, 0.22, 0.01, 0x9d6c7a);
  world.box(x + 0.02, y + 0.09, baseZ, 0.09, 0.09, 0.01, 0xd8b08c);
  world.box(x + 0.22, y - 0.16, baseZ, 0.11, 0.16, 0.01, 0x7b8c6a);
  world.box(x + 0.22, y + 0.01, baseZ, 0.08, 0.08, 0.01, 0xe0b995);
}

function windowBack(world, x0, x1, y0, y1, z, { night = false, curtains = null, glowColor = null } = {}) {
  const pane = glowColor ?? (night ? 0x31517c : 0xa9d6e2);
  // подоконник и рама
  world.box(x0 - 0.09, y0 - 0.10, z + 0.01, (x1 - x0) + 0.18, 0.12, 0.20, 0xd8c9b2);
  world.box(x0 - 0.06, y1 - 0.03, z + 0.01, (x1 - x0) + 0.12, 0.10, 0.12, 0xe2d4bc);
  world.box(x0 - 0.06, y0 - 0.03, z + 0.01, 0.09, (y1 - y0) + 0.06, 0.12, 0xe2d4bc);
  world.box(x1 - 0.03, y0 - 0.03, z + 0.01, 0.09, (y1 - y0) + 0.06, 0.12, 0xe2d4bc);
  world.glowBox(x0, y0, z + 0.075, (x1 - x0), (y1 - y0), 0.035, pane);
  world.box((x0 + x1) / 2 - 0.025, y0, z + 0.12, 0.05, y1 - y0, 0.05, 0xe2d4bc);
  world.box(x0, (y0 + y1) / 2 - 0.018, z + 0.12, x1 - x0, 0.05, 0.05, 0xe2d4bc);
  // дальний город / звёзды за стеклом — плоские силуэты
  if (night) {
    world.addGlow((x0 + x1) / 2, (y0 + y1) / 2, z + 0.16, 0x6f9bd1, 1.7, 0.22);
    world.box(x0 + 0.2, y0 + 0.13, z + 0.14, 0.22, 0.45, 0.01, 0x1b2942);
    world.box(x0 + 0.58, y0 + 0.20, z + 0.14, 0.30, 0.62, 0.01, 0x1b2942);
    world.box(x0 + 1.0, y0 + 0.08, z + 0.14, 0.18, 0.36, 0.01, 0x1b2942);
    world.box(x0 + 0.66, y0 + 0.55, z + 0.15, 0.04, 0.04, 0.01, 0xf0c77a);
    world.box(x0 + 0.76, y0 + 0.55, z + 0.15, 0.04, 0.04, 0.01, 0xf0c77a);
    world.box(x0 + 0.28, y0 + 0.35, z + 0.15, 0.04, 0.04, 0.01, 0xf0c77a);
  } else {
    world.addGlow((x0 + x1) / 2, (y0 + y1) / 2, z + 0.16, 0xdff3f4, 2.2, 0.28);
    world.box(x0 + 0.2, y0 + 0.12, z + 0.14, 0.24, 0.18, 0.01, 0xa8cdb7);
    world.box(x0 + 0.8, y0 + 0.10, z + 0.14, 0.5, 0.12, 0.01, 0x9bc0ad);
    world.box(x0 + 1.25, y0 + 0.12, z + 0.14, 0.18, 0.34, 0.01, 0xa8cdb7);
  }
  if (curtains) {
    world.box(x0 - 0.30, y0 - 0.10, z + 0.04, 0.28, y1 - y0 + 0.30, 0.13, curtains, { jitter: 0.05 });
    world.box(x1 + 0.02, y0 - 0.10, z + 0.04, 0.28, y1 - y0 + 0.30, 0.13, curtains, { jitter: 0.05 });
    world.box(x0 - 0.30, y1 + 0.10, z + 0.02, x1 - x0 + 0.60, 0.08, 0.16, 0x5d4a3d);
  }
}

function plant(world, x, z, scale = 1) {
  voxelPlant(world, x, 0, z, scale);
  world.addObstacle(x - 0.18 * scale, x + 0.30 * scale, z - 0.18 * scale, z + 0.30 * scale);
}

// ── Спальня ──────────────────────────────────────────────────────────────
function buildBedroom(layout, state) {
  const night = layout.includes('night');
  const day = layout.includes('day');
  const hasFen = layout.includes('fen');
  const dream = dreamOf(state);
  const bg = night ? 0x0b1020 : day ? 0x1c2334 : 0x151a2c;
  const world = new World('bedroom', { background: bg, seed: night ? 71 : 41 });
  world.scene.fog = new THREE.Fog(0x101426, 9, 18);
  addStandardLights(world, {
    hemi: night ? 0x5d78ad : 0xa7b9d9,
    ground: 0x332622,
    hemiIntensity: night ? 0.7 : day ? 1.45 : 1.0,
    sun: night ? 0x8ba6db : 0xffd2a0,
    sunIntensity: night ? 0.55 : day ? 2.2 : 1.6,
    sunPos: night ? [-4, 8, 5] : [6, 9, 7],
  });

  world.addTiles(-3.5, 3.5, -3.2, 2.9, [0x6b4935, 0x76523b, 0x5f402d, 0x805a40], { tile: 0.82, y: -0.05, h: 0.05, seed: 5 });
  // «сцена» перед открытой стеной: чтобы камера не показывала пустоту под полом
  world.addTiles(-3.5, 3.5, 2.9, 12, [0x5b3e2c, 0x64452f, 0x543927, 0x6a4933], { tile: 0.82, y: -0.05, h: 0.05, seed: 15 });
  // стены
  world.box(-3.6, 0, -3.4, 7.2, 3.15, 0.2, 0x6e8092);
  world.box(-3.6, 0, -3.4, 0.2, 3.15, 6.4, 0x7b8c9d);
  world.box(3.4, 0, -3.4, 0.2, 3.15, 6.4, 0x64768a);
  world.box(-3.5, 0, -3.25, 7.0, 0.16, 0.12, 0x4d5d6d);
  world.box(-3.5, 0, -3.25, 0.12, 0.16, 6.0, 0x4d5d6d);
  world.box(3.38, 0, -3.25, 0.12, 0.16, 6.0, 0x4d5d6d);
  // обои-полосы
  for (let i = 0; i < 8; i++) {
    world.box(-3.3 + i * 0.9, 0.2, -3.28, 0.25, 2.5, 0.02, i % 2 ? 0x798b9c : 0x66798c, { jitter: 0.03 });
  }

  windowBack(world, 1.15, 2.55, 1.55, 2.55, -3.28, { night: !day, curtains: night ? 0x5d4a63 : 0x8a7382 });

  // плакат мечты
  world.addTextPlane({
    text: dream.label.toUpperCase(),
    sub: 'МЕЧТА ИЛИ ПЛАН?',
    x: -2.25, y: 2.05, z: -3.17, w: 1.35, h: 0.9,
    bg: '#1d2637', fg: '#f6e7c8', accent: '#f0b45c',
    font: '700 78px "Pixelify Sans", monospace',
  });
  // полка с книгами над столом
  world.box(1.5, 2.05, -3.22, 1.7, 0.08, 0.28, 0x6f4a34);
  books(world, 1.62, 2.13, -3.15, 5, 2);
  books(world, 2.15, 2.13, -3.15, 3, 4);
  world.box(2.75, 2.13, -3.15, 0.16, 0.20, 0.12, 0xb0604a);
  // фото на стене
  wallPhoto(world, -0.55, 1.86, -3.16, 0, 0.82, 0.62);
  world.addHotspot('photo_bedroom', -0.55, -2.75, 1.2);

  // кровать
  bed(world, -2.95, -2.55, 1.55, 2.35, night ? 0x496d78 : 0x527f86, 3);

  // стол справа
  desk(world, 1.55, -2.65, 1.55, 0.92, 0x936541);
  // монитор
  world.box(1.88, 0.82, -2.52, 0.66, 0.42, 0.07, 0x2b2f3a);
  world.glowBox(1.93, 0.87, -2.47, 0.56, 0.32, 0.025, night ? 0x6fa6b8 : 0x6c8fae);
  world.box(2.13, 0.82, -2.50, 0.10, 0.16, 0.10, 0x1d2028);
  world.box(1.98, 0.78, -2.48, 0.38, 0.03, 0.16, 0x1d2028);
  // клавиатура и бумаги
  world.box(1.88, 0.865, -2.18, 0.50, 0.03, 0.16, 0x343946);
  world.box(2.55, 0.865, -2.23, 0.30, 0.015, 0.22, 0xf0e7d4);
  world.addHotspot('desk', 2.25, -2.15, 1.35);
  // лампа
  if (night) {
    world.box(1.68, 0.87, -2.54, 0.08, 0.42, 0.08, 0x3a3e46);
    world.box(1.58, 1.29, -2.54, 0.26, 0.15, 0.26, 0xe8c277);
    world.glowBox(1.60, 1.27, -2.52, 0.22, 0.05, 0.22, 0xffd88a);
    world.addGlow(1.7, 1.14, -2.48, 0xffca74, 2.3, 0.5);
    world.addPointLight(0xffc879, 11, 5.5, 1.7, 1.4, -2.4);
  } else {
    world.box(1.65, 0.82, -2.64, 0.12, 0.30, 0.12, 0xd9c9a8);
    world.box(1.60, 1.11, -2.63, 0.22, 0.14, 0.22, 0xe6d2ad);
    world.addGlow(1.7, 1.12, -2.55, 0xffe5b0, 1.4, 0.3);
  }

  // стул
  chair(world, 2.15, -1.55, 0, 0x6c4b35);
  // шкаф
  world.box(-3.15, 0, 0.65, 0.62, 2.15, 1.45, 0x795339);
  world.box(-3.08, 0.06, 0.72, 0.48, 2.0, 0.65, 0x896044);
  world.box(-3.08, 0.06, 1.4, 0.48, 2.0, 0.55, 0x896044);
  world.box(-2.66, 1.05, 1.02, 0.04, 0.18, 0.04, 0xd6b270);
  world.box(-2.66, 1.05, 1.28, 0.04, 0.18, 0.04, 0xd6b270);
  world.addObstacle(-3.2, -2.5, 0.6, 2.12);

  // ковёр
  rug(world, -0.9, 0.25, 2.4, 1.75, [0x5d4c4a, 0x78625a, 0x9f8264, 0x4b5c5e], 7);

  // растения, мелочи
  plant(world, 3.0, 0.65, 0.95);
  world.box(-1.2, 0.02, 2.0, 0.55, 0.10, 0.38, 0x7b6b55); // коробка с вещами
  books(world, -1.12, 0.10, 2.06, 2, 1);
  // настольная полка/скейт
  world.box(-2.85, 1.65, 0.58, 1.1, 0.06, 0.22, 0x5a3d2b);

  if (hasFen) {
    // коробка-тайник у кровати
    world.box(-2.25, 0.02, 0.55, 1.0, 0.30, 0.75, 0x9d744d);
    world.box(-2.18, 0.12, 0.62, 0.88, 0.22, 0.62, 0x5b6e7c);
    world.box(-2.10, 0.26, 0.72, 0.68, 0.16, 0.42, 0xd8c7a8);
    world.box(-2.00, 0.36, 0.80, 0.38, 0.10, 0.26, 0xe8d6b3);
    // миска и игрушка
    world.box(-1.05, 0.01, 0.85, 0.28, 0.07, 0.28, 0xcc6f56);
    world.box(-1.06, 0.05, 0.86, 0.22, 0.04, 0.22, 0xa94f3e);
    world.box(-1.0, 0.12, 0.9, 0.08, 0.08, 0.12, 0xd5a05f);
    world.box(0.15, 0.01, 1.45, 0.16, 0.08, 0.24, 0x8a6d5b);
    world.box(0.15, 0.01, 1.45, 0.26, 0.05, 0.10, 0xd2b18a);
    // следы маленьких лап (декор)
    for (let i = 0; i < 5; i++) {
      world.box(-1.55 + i * 0.28, 0.03, 0.95 + Math.sin(i) * 0.12, 0.06, 0.012, 0.04, 0x5d4434);
    }
    world.addHotspot('nest', -1.9, 0.72, 1.25);
  }

  world.addHotspot('poster', -2.25, -2.55, 1.2);

  // ночной свет
  if (night) {
    world.addPointLight(0xffc274, 18, 8, 0.4, 2.85, 0.2);
    world.addGlow(-2.25, 2.2, -3.05, 0xffd28a, 1.5, 0.18);
    world.addGlow(0.4, 2.8, 0.3, 0xffbf6f, 3.2, 0.10);
  } else {
    world.addPointLight(0xffe0b4, 12, 8, 0.2, 2.85, 0.7);
  }

  world.spawn = { x: 0.25, z: 1.9, rot: Math.PI };
  world.bounds = { minX: -3.15, maxX: 3.15, minZ: -2.95, maxZ: 2.55 };
  world.camera = { yaw: 0, pitch: 0.44, dist: 6.05, targetHeight: 1.15 };
  if (hasFen) world.addFennec(-1.7, 1.2, 'follow', Math.PI * 0.8, 0.9);
  world.finish();
  return world;
}

// ── Кухня ────────────────────────────────────────────────────────────────
function buildKitchen(layout, state) {
  const family = layout.includes('family');
  const confession = layout.includes('confession');
  const night = confession || layout.includes('night');
  const world = new World('kitchen', { background: night ? 0x0d1220 : 0x1b202a, seed: 22 });
  world.scene.fog = new THREE.Fog(0x151720, 11, 20);
  addStandardLights(world, {
    hemi: night ? 0x7288b0 : 0xaab6b6,
    ground: 0x3b332b,
    hemiIntensity: night ? 0.75 : 1.02,
    sun: night ? 0x8ea9d7 : 0xffe0b0,
    sunIntensity: night ? 0.5 : 1.4,
    sunPos: [-6, 8, 6],
  });

  world.addTiles(-4.1, 4.1, -3.2, 3.0, [0xd8d0be, 0xc5bda9, 0xbbb29c], { tile: 0.72, seed: 2 });
  world.addTiles(-4.1, 4.1, 3.0, 12, [0xb8ae97, 0xa99f88, 0xc1b7a0], { tile: 0.72, y: -0.04, h: 0.08, seed: 17 });
  // стены
  world.box(-4.2, 0, -3.4, 8.4, 3.1, 0.2, 0xb9c4b4);
  world.box(-4.2, 0, -3.4, 0.2, 3.1, 6.5, 0xc4cdbe);
  world.box(4.0, 0, -3.4, 0.2, 3.1, 6.5, 0xaebaa9);
  world.box(-4.1, 0, -3.24, 8.2, 0.14, 0.10, 0x8a9587);
  // фартук-плитка
  for (let ix = 0; ix < 14; ix++) {
    for (let iy = 0; iy < 4; iy++) {
      world.box(-4.0 + ix * 0.42, 0.92 + iy * 0.28, -3.27, 0.38, 0.24, 0.025, (ix + iy) % 2 ? 0xdfe4d5 : 0xc7d1c4, { jitter: 0.03 });
    }
  }
  windowBack(world, -3.15, -1.7, 1.45, 2.55, -3.28, { night, curtains: 0xd9c9b8 });
  wallPhoto(world, 1.45, 1.86, -3.17, 0, 0.78, 0.58);
  // шкафчики
  world.box(-3.9, 0, -3.05, 4.9, 0.9, 0.65, 0x8a9a83, { jitter: 0.03 });
  world.addObstacle(-3.95, 1.0, -3.08, -2.35);
  world.box(-3.9, 0.9, -3.08, 4.9, 0.06, 0.70, 0x5d6b5b);
  for (let i = 0; i < 6; i++) {
    world.box(-3.82 + i * 0.80, 0.08, -3.02, 0.70, 0.74, 0.04, i % 2 ? 0x96a68e : 0x90a088);
    world.box(-3.55 + i * 0.80, 0.68, -2.97, 0.18, 0.035, 0.035, 0xd2c29e);
  }
  // верхние шкафы
  world.box(-3.9, 1.75, -3.12, 2.3, 0.85, 0.55, 0xa9b7a0);
  world.box(-3.9, 1.75, -3.12, 0.04, 0.85, 0.58, 0x6b7a67);
  for (let i = 0; i < 3; i++) {
    world.box(-3.82 + i * 0.76, 1.82, -3.03, 0.68, 0.70, 0.03, 0xb5c1ac);
    world.box(-3.58 + i * 0.76, 2.47, -2.99, 0.16, 0.03, 0.03, 0xe0d0aa);
  }
  // плита, чайник, кастрюля
  world.box(-1.4, 0.92, -3.0, 0.9, 0.06, 0.55, 0x34343b);
  for (let i = 0; i < 4; i++) world.box(-1.28 + (i % 2) * 0.36, 0.99, -2.9 + Math.floor(i / 2) * 0.26, 0.16, 0.02, 0.16, 0x75777d);
  world.box(-1.35, 1.0, -2.7, 0.34, 0.28, 0.34, 0xc1c6c8);
  world.box(-1.3, 1.24, -2.66, 0.24, 0.06, 0.24, 0x8f979a);
  world.box(-0.8, 1.0, -2.76, 0.34, 0.22, 0.28, 0xd7dbdb);
  world.box(-0.76, 1.18, -2.70, 0.12, 0.18, 0.06, 0xd7dbdb);
  world.box(-2.65, 0.96, -2.74, 0.36, 0.10, 0.30, 0x8d9699);
  // раковина
  world.box(-2.25, 0.94, -2.92, 0.55, 0.05, 0.45, 0x7f898d);
  world.box(-2.15, 0.97, -2.86, 0.34, 0.08, 0.30, 0x5c686e);
  // холодильник
  world.box(3.15, 0, -2.98, 1.05, 2.15, 0.82, 0xdfe3df);
  world.addObstacle(3.1, 4.28, -3.02, -2.1);
  world.box(3.18, 1.18, -2.95, 0.98, 0.025, 0.86, 0xb8c0bd);
  world.box(4.1, 1.35, -2.56, 0.06, 0.34, 0.05, 0x8a9491);
  world.box(4.1, 0.62, -2.56, 0.06, 0.26, 0.05, 0x8a9491);
  // магниты и записка
  const magnetColors = [0xe6b450, 0xc15d4e, 0x6c8fae, 0x8aa26e];
  for (let i = 0; i < 5; i++) world.box(2.9 + i * 0.18, 1.55 + (i % 2) * 0.28, -2.53, 0.09, 0.09, 0.03, magnetColors[i % 4]);
  world.box(3.55, 1.42, -2.54, 0.26, 0.32, 0.02, 0xf1e8d3);
  for (let i = 0; i < 4; i++) world.box(3.59, 1.62 - i * 0.06, -2.56, 0.18, 0.014, 0.01, 0x8a8578);
  world.addHotspot('fridge_note', 3.35, -2.45, 1.2);
  world.addHotspot('photo_kitchen', 1.45, -2.68, 1.15);

  // обеденный стол
  world.box(-0.55, 0.72, -0.15, 1.9, 0.10, 1.15, 0x9c6e49);
  world.box(-0.47, 0.0, -0.06, 0.10, 0.72, 0.10, 0x6b4732);
  world.box(1.22, 0.0, -0.06, 0.10, 0.72, 0.10, 0x6b4732);
  world.box(-0.47, 0.0, 0.82, 0.10, 0.72, 0.10, 0x6b4732);
  world.box(1.22, 0.0, 0.82, 0.10, 0.72, 0.10, 0x6b4732);
  // скатерть и посуда
  world.box(-0.45, 0.82, -0.04, 1.7, 0.02, 0.95, 0xdfd2ba);
  for (let i = 0; i < 4; i++) {
    const px = -0.85 + (i % 2) * 1.15;
    const pz = -0.28 + Math.floor(i / 2) * 0.55;
    world.box(px, 0.845, pz, 0.28, 0.02, 0.28, 0xf1e9da);
    world.box(px + 0.07, 0.86, pz + 0.07, 0.13, 0.015, 0.13, 0xc6c0ae);
  }
  // чайник
  world.box(0.62, 0.85, 0.18, 0.20, 0.21, 0.18, 0xd9d5c9);
  world.box(0.68, 1.06, 0.22, 0.08, 0.04, 0.08, 0x8f8a7e);
  world.box(0.82, 0.91, 0.25, 0.06, 0.05, 0.04, 0xbdb7a9);
  world.addObstacle(-0.7, 1.42, -0.32, 1.0);
  chair(world, -1.45, -0.16, 0, 0x6f4c35);
  chair(world, 1.43, -0.16, 0, 0x6f4c35);
  chair(world, 0.14, -1.25, 0, 0x6f4c35);
  chair(world, 0.14, 1.10, 0, 0x6f4c35);

  world.box(-4.0, 0, 1.65, 0.95, 1.05, 1.25, 0x7b563c); // тумба у стены
  world.box(-4.05, 1.05, 1.55, 0.35, 0.55, 0.28, 0x6b4732); // полка
  books(world, -4.0, 1.12, 1.6, 3, 5);
  world.addObstacle(-4.0, -3.0, 1.5, 2.95);
  plant(world, 3.55, 2.35, 1.1);

  // свет
  if (night) {
    world.addPointLight(0xffca7a, 22, 9, 0.2, 2.85, -0.8);
    world.addGlow(0.2, 2.8, -0.6, 0xffc97a, 2.8, 0.18);
    world.addPointLight(0x93b4e6, 7, 6, -2.4, 2.2, -2.9);
    if (confession) {
      world.addGlow(0.9, 1.45, 0.75, 0xffbf6d, 1.4, 0.22);
    }
  } else {
    // лампа над столом
    world.box(0.35, 2.72, -0.15, 0.05, 0.34, 0.05, 0x3e3b36);
    world.box(0.08, 2.58, -0.42, 0.60, 0.13, 0.60, 0xe0c48a);
    world.box(0.12, 2.53, -0.38, 0.52, 0.05, 0.52, 0xffe0a7);
    world.glowBox(0.14, 2.51, -0.36, 0.48, 0.03, 0.48, 0xffd98b);
    world.addGlow(0.35, 2.45, -0.15, 0xffd487, 2.3, 0.42);
    world.addPointLight(0xf5d9aa, 10, 7, 0.35, 2.45, -0.15);
    world.addGlow(0.1, 2.75, 0.1, 0xffe0a7, 3.4, 0.12);
    world.addPointLight(0xb7d4e7, 8, 7, -2.4, 2.1, -2.9);
  }
  // часы на стене
  world.box(2.55, 2.28, -3.18, 0.46, 0.46, 0.06, 0x4d4438);
  world.box(2.61, 2.34, -3.14, 0.34, 0.34, 0.02, 0xf1ead8);
  world.box(2.77, 2.47, -3.12, 0.025, 0.12, 0.01, 0x35322e);
  world.box(2.77, 2.50, -3.12, 0.09, 0.02, 0.01, 0x35322e);

  if (family) {
    addNpcSeated(world, NPC_PRESETS.dad, 0.35, -1.04, 0);
    addNpcSeated(world, NPC_PRESETS.mom, -1.24, 0.05, Math.PI / 2);
    addNpcSeated(world, NPC_PRESETS.brother, 1.64, 0.05, -Math.PI / 2);
    addNpcSeated(world, NPC_PRESETS.sister, 0.35, 1.31, Math.PI);
    world.spawn = { x: 2.05, z: 2.05, rot: Math.PI };
    world.camera = { yaw: -0.1, pitch: 0.45, dist: 6.1, targetHeight: 1.05 };
  } else if (confession) {
    addNpcStanding(world, NPC_PRESETS.mom, -1.0, -1.7, 0.15);
    world.spawn = { x: 0.75, z: 1.75, rot: Math.PI };
    world.addFennec(-0.2, 1.3, 'idle', Math.PI * 0.72, 0.88);
    world.camera = { yaw: 0.02, pitch: 0.44, dist: 5.9, targetHeight: 1.1 };
  } else {
    addNpcStanding(world, NPC_PRESETS.mom, -1.95, -1.95, 0.25);
    world.spawn = { x: 0.7, z: 1.85, rot: Math.PI };
    world.camera = { yaw: -0.03, pitch: 0.43, dist: 5.95, targetHeight: 1.12 };
  }

  world.bounds = { minX: -3.8, maxX: 3.8, minZ: -3.0, maxZ: 2.65 };
  world.finish();
  return world;
}

// ── Двор ─────────────────────────────────────────────────────────────────
function buildYard(layout, state) {
  const world = new World('yard', { background: 0x0b1020, fog: [10, 26], seed: 91 });
  addStandardLights(world, {
    hemi: 0x6a84b8, ground: 0x242736, hemiIntensity: 1.55,
    sun: 0xa9c0e4, sunIntensity: 1.45, sunPos: [-8, 12, -4],
  });
  world.addPointLight(0xffbe72, 30, 14, 0.5, 2.3, 2.8);
  world.addPointLight(0x9db9e6, 42, 20, 0.2, 3.4, 6.0);

  world.addTiles(-8, 8, -7, 10, [0x2f3644, 0x353d4b, 0x2a3140, 0x3b4351], { tile: 1.15, y: -0.06, h: 0.12, seed: 8 });
  // дорожка/трава по краям
  world.addTiles(-8.5, -6.5, -7, 10, [0x324534, 0x2c3d30, 0x3a4d38], { tile: 0.9, y: 0.0, h: 0.06, seed: 9 });
  world.addTiles(6.5, 8.5, -7, 10, [0x2e4031, 0x374a36, 0x28392b], { tile: 0.9, y: 0.0, h: 0.06, seed: 10 });
  // бордюр
  world.box(-6.6, 0, -6.4, 0.35, 0.24, 13.4, 0x646b72);
  world.box(6.4, 0, -6.4, 0.35, 0.24, 13.4, 0x646b72);
  // пентаграмма из луж
  for (const [x, z, w, d] of [[-3.4, 1.0, 2.2, 0.8], [1.2, 2.8, 1.5, 0.55], [-1.2, -3.9, 1.8, 0.6]]) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x243b55, transparent: true, opacity: 0.75 });
    const puddle = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(x, 0.02, z);
    world.scene.add(puddle);
  }

  // фасад дома
  world.box(-9, 0, -7.2, 18, 9.2, 0.8, 0x343c50);
  world.box(-9, 0, -6.9, 18, 1.2, 0.6, 0x2a303f);
  for (let floor = 0; floor < 4; floor++) {
    for (let col = 0; col < 9; col++) {
      const wx = -8.1 + col * 1.95;
      const wy = 1.8 + floor * 1.8;
      const lit = (col * 3 + floor * 5) % 7 < 2;
      world.box(wx - 0.1, wy - 0.1, -6.86, 0.72, 0.85, 0.05, 0x202635);
      if (lit) {
        world.glowBox(wx, wy, -6.82, 0.52, 0.65, 0.03, (col + floor) % 2 ? 0xf0bd6f : 0xd9a25d);
      } else {
        world.box(wx, wy, -6.82, 0.52, 0.65, 0.03, 0x25324a);
      }
      if (col % 3 === 1) {
        world.box(wx - 0.18, wy - 0.5, -6.6, 0.92, 0.18, 0.42, 0x4e586a);
        world.box(wx - 0.18, wy - 0.5, -6.38, 0.92, 0.5, 0.06, 0x5b6678);
      }
    }
  }
  // подъезды
  for (const dx of [-5.2, 0, 5.2]) {
    world.box(dx, 0, -6.84, 1.15, 2.1, 0.08, 0x1d242f);
    world.glowBox(dx + 0.16, 2.05, -6.78, 0.38, 0.12, 0.03, 0xf0c879);
  }

  // невысокий бордюр в глубине двора
  for (let i = 0; i < 9; i++) {
    world.box(-6.2 + i * 1.55, 0.0, 5.45, 1.35, 0.28, 0.18, 0x39414d);
    world.box(-6.1 + i * 1.55, 0.28, 5.42, 1.15, 0.12, 0.24, 0x2e4434);
  }

  // деревья по краям
  for (const [tx, tz, s] of [[-6.4, 4.2, 1.2], [6.2, 3.2, 1.1], [-5.7, -5.1, 0.9], [7.0, -4.8, 1.3]]) {
    world.box(tx, 0, tz, 0.38 * s, 2.0 * s, 0.38 * s, 0x3a2d24);
    const rand = (n) => Math.sin(n * 12.9898 + tx * 78.233) * 0.5 + 0.5;
    for (let i = 0; i < 8; i++) {
      world.box(tx - 0.9 + rand(i) * 1.8, 1.8 + rand(i + 4) * 1.4, tz - 0.8 + rand(i + 8) * 1.6, 0.6, 0.5, 0.6, i % 2 ? 0x2d4533 : 0x36513b);
    }
  }

  // фонарь
  world.box(-2.55, 0, -1.55, 0.14, 4.2, 0.14, 0x3d444c);
  world.box(-2.6, 4.12, -1.6, 0.24, 0.10, 0.24, 0x545c63);
  world.box(-2.7, 4.18, -1.7, 0.48, 0.10, 0.48, 0x3f474f);
  world.glowBox(-2.57, 4.0, -1.57, 0.26, 0.14, 0.26, 0xffd07a);
  world.addGlow(-2.55, 3.95, -1.5, 0xffc96e, 4.0, 0.6);
  world.addPointLight(0xffbd63, 80, 16, -2.55, 3.9, -1.5);
  world.addObstacle(-2.8, -2.3, -1.8, -1.3);

  // лампа над контейнерами
  world.box(4.75, 3.25, -5.6, 0.34, 0.18, 0.34, 0x3b434c);
  world.glowBox(4.82, 3.15, -5.53, 0.2, 0.12, 0.2, 0xffd382);
  world.addGlow(4.8, 3.05, -5.4, 0xffc66e, 3.0, 0.42);
  world.addPointLight(0xffc16a, 55, 9, 4.7, 3.0, -5.1);

  // мусорные контейнеры
  const bins = [[2.2, -3.7, 0x5c765d], [3.55, -3.7, 0x4e6755], [4.9, -3.7, 0x5c765d]];
  for (const [bx, bz, col] of bins) {
    world.box(bx, 0, bz, 1.18, 1.18, 1.12, col, { jitter: 0.04 });
    world.box(bx - 0.03, 1.18, bz - 0.03, 1.24, 0.10, 1.18, 0x3e5241);
    world.box(bx + 0.20, 1.10, bz + 1.10, 0.16, 0.16, 0.06, 0x2f3b34);
    world.box(bx, 0.08, bz, 1.18, 0.10, 1.12, 0x334034);
    world.addObstacle(bx - 0.1, bx + 1.28, bz - 0.1, bz + 1.2);
  }
  // крышка приоткрыта, мешки
  world.box(3.25, 1.28, -3.9, 1.30, 0.08, 1.10, 0x2c3d31);
  world.box(3.25, 1.35, -4.16, 0.16, 0.22, 0.16, 0x3b4d3e);
  const bags = [[1.7, -2.4, 0.45], [2.7, -2.35, 0.55], [5.7, -2.7, 0.5], [5.85, -3.55, 0.42], [1.15, -3.35, 0.38]];
  for (const [bx, bz, s] of bags) {
    world.box(bx, 0, bz, s, s * 0.8, s * 0.9, 0x404754, { jitter: 0.15 });
    world.box(bx + 0.06, s * 0.8, bz + 0.05, s * 0.3, s * 0.2, s * 0.25, 0x4c5360);
  }
  // картонная коробка за баками
  world.box(3.1, 0, -2.6, 0.75, 0.12, 0.6, 0x8c6848);
  world.box(3.1, 0.12, -2.6, 0.06, 0.35, 0.6, 0x9a7551);
  world.addHotspot('fennec_box', 3.25, -2.05, 1.35);

  // скамейка
  world.box(-4.4, 0.45, 2.1, 1.9, 0.12, 0.5, 0x73543b);
  world.box(-4.4, 0.52, 2.0, 1.9, 0.42, 0.08, 0x7d5d42);
  world.box(-4.25, 0, 2.15, 0.10, 0.45, 0.42, 0x4a4f55);
  world.box(-2.7, 0, 2.15, 0.10, 0.45, 0.42, 0x4a4f55);
  world.addObstacle(-4.5, -2.4, 1.85, 2.65);

  // луна и звёзды
  world.addStars(130, 38, 12, 12);
  world.addGlow(-13, 15, -20, 0xdfe7ff, 10, 0.55);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 12), new THREE.MeshBasicMaterial({ color: 0xe9edda }));
  moon.position.set(-13, 15, -20);
  world.scene.add(moon);

  // редкие светлячки/пар
  for (let i = 0; i < 6; i++) {
    const sprite = world.addGlow(-4 + i * 1.7, 0.35 + (i % 3) * 0.28, -2.5 + (i % 4), 0xf2d08a, 0.35, 0.28);
    const baseY = sprite.position.y;
    const baseX = sprite.position.x;
    world.onUpdate((dt, t) => {
      sprite.position.y = baseY + Math.sin(t * 0.9 + i * 2.1) * 0.18;
      sprite.position.x = baseX + Math.cos(t * 0.35 + i) * 0.35;
    });
  }

  world.addFennec(2.2, -1.55, 'idle', -0.62, 0.95);
  world.spawn = { x: -0.3, z: 2.45, rot: Math.PI };
  world.bounds = { minX: -6.2, maxX: 6.2, minZ: -5.2, maxZ: 5.2 };
  world.camera = { yaw: 0.02, pitch: 0.37, dist: 6.45, targetHeight: 1.1 };
  world.finish();
  return world;
}

// ── Класс ────────────────────────────────────────────────────────────────
function buildClassroom(layout, state) {
  const world = new World('classroom', { background: 0x1c2330, seed: 55 });
  world.scene.fog = new THREE.Fog(0x1b2230, 12, 22);
  addStandardLights(world, {
    hemi: 0xb7c6d9, ground: 0x3a332b, hemiIntensity: 1.0,
    sun: 0xffe2b5, sunIntensity: 1.55, sunPos: [9, 10, 6],
  });
  world.addTiles(-5.1, 5.1, -4.1, 3.8, [0x9aa48e, 0x8d9883, 0xa5ae97], { tile: 0.75, seed: 6 });
  world.addTiles(-5.1, 5.1, 3.8, 12, [0x88927c, 0x7d8772, 0x919b85], { tile: 0.75, seed: 18 });
  world.box(-5.2, 0, -4.3, 10.4, 3.0, 0.2, 0xb8c0a9);
  world.box(-5.2, 0, -4.3, 0.2, 3.0, 8.2, 0xc2c9b6);
  world.box(5.0, 0, -4.3, 0.2, 3.0, 8.2, 0xaab39e);
  world.box(-5.1, 0, -4.14, 10.2, 0.16, 0.10, 0x7d8972);
  // доска
  world.box(-2.15, 1.0, -4.18, 4.35, 1.9, 0.08, 0x3b513f);
  world.box(-2.05, 1.08, -4.11, 4.15, 1.74, 0.03, 0x2d4433);
  world.addTextPlane({
    text: 'УДАЧИ', sub: 'ЭКЗАМЕН · 9:00', x: 0, y: 1.95, z: -4.07, w: 1.9, h: 0.85,
    bg: '#2b4133', fg: '#e8efdc', accent: '#c9d5b9', font: '700 76px "Pixelify Sans", monospace',
  });
  world.box(-2.3, 2.95, -4.1, 4.7, 0.06, 0.35, 0x7b633e);
  world.box(-1.85, 3.02, -4.0, 0.13, 0.06, 0.13, 0xe9e0c8);
  world.box(-1.5, 3.02, -4.0, 0.13, 0.06, 0.13, 0xd8b56e);
  world.addHotspot('chalkboard', 0, -3.35, 1.4);
  // часы
  world.box(2.1, 2.35, -4.16, 0.65, 0.65, 0.08, 0x3a3a3d);
  world.box(2.16, 2.41, -4.10, 0.53, 0.53, 0.03, 0xf2ecdc);
  world.box(2.4, 2.53, -4.08, 0.05, 0.18, 0.02, 0x2c2c2f);
  world.box(2.4, 2.65, -4.08, 0.13, 0.04, 0.02, 0x2c2c2f);
  // окна справа
  for (let i = 0; i < 3; i++) {
    const z = -2.6 + i * 2.25;
    world.box(4.96, 1.15, z, 0.06, 1.55, 1.75, 0xd9dfd1);
    world.glowBox(4.92, 1.25, z + 0.12, 0.02, 1.35, 1.5, 0xc9e6e8);
    world.box(4.88, 2.0, z, 0.06, 0.06, 1.75, 0xdfe4d5);
    world.box(4.88, 1.25, z + 0.84, 0.06, 1.45, 0.06, 0xdfe4d5);
    world.box(4.88, 1.25, z - 0.84, 0.06, 1.45, 0.06, 0xdfe4d5);
    world.addGlow(4.5, 1.8, z + 0.4, 0xdff2eb, 2.2, 0.2);
  }
  // парты
  const deskPositions = [
    [-3.4, -2.2], [2.15, -2.2],
    [-3.4, -0.4], [2.15, -0.4],
    [-3.4, 1.4], [2.15, 1.4],
  ];
  for (const [dx, dz] of deskPositions) {
    world.box(dx, 0.66, dz, 1.15, 0.08, 0.65, 0xc49a69);
    world.box(dx + 0.04, 0.0, dz + 0.04, 0.08, 0.66, 0.08, 0x6d6d66);
    world.box(dx + 1.03, 0.0, dz + 0.04, 0.08, 0.66, 0.08, 0x6d6d66);
    world.box(dx + 0.04, 0.0, dz + 0.53, 0.08, 0.66, 0.08, 0x6d6d66);
    world.box(dx + 1.03, 0.0, dz + 0.53, 0.08, 0.66, 0.08, 0x6d6d66);
    world.box(dx + 0.12, 0.74, dz + 0.10, 0.52, 0.02, 0.40, 0xf1e8d5);
    world.box(dx + 0.18, 0.765, dz + 0.16, 0.35, 0.01, 0.24, 0xd6cbb3);
    world.addObstacle(dx - 0.05, dx + 1.22, dz - 0.05, dz + 0.7);
    // стул
    world.box(dx + 0.33, 0.42, dz + 0.95, 0.45, 0.06, 0.42, 0x8a6a4c);
    world.box(dx + 0.33, 0.48, dz + 1.25, 0.45, 0.52, 0.06, 0x8a6a4c);
    world.box(dx + 0.36, 0.0, dz + 1.00, 0.06, 0.42, 0.06, 0x5c4938);
    world.box(dx + 0.70, 0.0, dz + 1.00, 0.06, 0.42, 0.06, 0x5c4938);
    world.box(dx + 0.36, 0.0, dz + 1.28, 0.06, 0.42, 0.06, 0x5c4938);
    world.box(dx + 0.70, 0.0, dz + 1.28, 0.06, 0.42, 0.06, 0x5c4938);
    world.addObstacle(dx + 0.28, dx + 0.83, dz + 0.85, dz + 1.35);
  }
  // учительский стол
  world.box(-0.7, 0.74, -3.55, 1.7, 0.10, 0.75, 0x986a47);
  world.box(-0.6, 0.0, -3.45, 0.10, 0.74, 0.55, 0x624631);
  world.box(0.8, 0.0, -3.45, 0.10, 0.74, 0.55, 0x624631);
  world.box(-0.1, 0.84, -3.5, 0.5, 0.02, 0.3, 0xf0e7d4);
  world.box(-0.3, 0.85, -3.6, 0.15, 0.15, 0.15, 0x8c3f3a);
  world.addObstacle(-0.8, 1.1, -3.7, -2.75);
  addNpcStanding(world, NPC_PRESETS.teacher, 1.65, -3.2, -0.15);

  // шкаф/цветы
  world.box(-4.9, 0, 3.0, 0.5, 2.0, 1.4, 0x7b5c40);
  world.addObstacle(-5.0, -4.35, 2.9, 4.4);
  plant(world, 4.5, 3.1, 1.0);
  // мотивационные плакаты
  world.addTextPlane({
    text: 'ДЫШИ', sub: 'И ПИШИ', x: -3.45, y: 2.25, z: -4.17, w: 0.7, h: 0.9,
    bg: '#d8d1bb', fg: '#475250', accent: '#b56d52', font: '700 84px "Pixelify Sans", monospace',
  });
  world.addPointLight(0xfff0d2, 15, 10, 0.6, 2.85, 0.4);
  world.addPointLight(0xd8e8f0, 10, 8, 4.2, 2.4, -0.5);
  world.spawn = { x: 0.0, z: 2.62, rot: Math.PI };
  world.bounds = { minX: -4.7, maxX: 4.6, minZ: -3.15, maxZ: 3.2 };
  world.camera = { yaw: 0, pitch: 0.43, dist: 6.15, targetHeight: 1.15 };
  world.finish();
  return world;
}

// ── Гостиная ─────────────────────────────────────────────────────────────
function buildLivingRoom(layout, state) {
  const world = new World('livingroom', { background: 0x141521, seed: 33 });
  world.scene.fog = new THREE.Fog(0x151420, 11, 20);
  addStandardLights(world, {
    hemi: 0x8d89a8, ground: 0x372a24, hemiIntensity: 0.95,
    sun: 0xffd6a3, sunIntensity: 1.1, sunPos: [-5, 8, 7],
  });
  world.addTiles(-4.6, 4.6, -3.6, 3.6, [0x6c4c37, 0x76543e, 0x634532, 0x7d5a42], { tile: 0.82, seed: 13 });
  world.addTiles(-4.6, 4.6, 3.6, 12, [0x5b3f2e, 0x634634, 0x533a2a], { tile: 0.82, seed: 19 });
  world.box(-4.7, 0, -3.8, 9.4, 2.9, 0.2, 0x918075);
  world.box(-4.7, 0, -3.8, 0.2, 2.9, 7.4, 0x9c8b7e);
  world.box(4.5, 0, -3.8, 0.2, 2.9, 7.4, 0x857468);
  world.box(-4.6, 0, -3.64, 9.2, 0.14, 0.10, 0x685347);
  // тёплые обои
  for (let i = 0; i < 9; i++) {
    world.box(-4.3 + i * 1.0, 0.2, -3.68, 0.18, 2.3, 0.02, i % 2 ? 0x8c7a6c : 0x817064, { jitter: 0.02 });
  }
  windowBack(world, 1.4, 3.0, 1.45, 2.45, -3.67, { night: true, curtains: 0x7d5e5d });
  // диван
  world.box(-1.8, 0.18, -3.05, 3.1, 0.32, 0.95, 0x6d4f5b);
  world.box(-1.85, 0.5, -3.22, 3.2, 0.75, 0.24, 0x7c5a67);
  world.box(-1.7, 0.48, -2.98, 1.35, 0.14, 0.72, 0xb9858f);
  world.box(0.25, 0.48, -2.98, 1.25, 0.14, 0.72, 0xb9858f);
  world.box(-1.85, 0.25, -2.95, 0.15, 0.75, 0.82, 0x5d4550);
  world.box(1.15, 0.25, -2.95, 0.15, 0.75, 0.82, 0x5d4550);
  world.box(-0.3, 0.72, -3.12, 0.55, 0.38, 0.12, 0xd1a067);
  world.box(0.45, 0.72, -3.12, 0.45, 0.35, 0.12, 0x8fae9b);
  world.addObstacle(-1.9, 1.35, -3.25, -1.95);

  // журнальный стол
  world.box(-0.4, 0.42, -1.25, 1.65, 0.09, 0.85, 0x8f6543);
  world.box(-0.3, 0.0, -1.15, 0.09, 0.42, 0.09, 0x66452f);
  world.box(1.1, 0.0, -1.15, 0.09, 0.42, 0.09, 0x66452f);
  world.box(-0.3, 0.0, -0.55, 0.09, 0.42, 0.09, 0x66452f);
  world.box(1.1, 0.0, -0.55, 0.09, 0.42, 0.09, 0x66452f);
  world.box(-0.3, 0.51, -1.25, 0.55, 0.025, 0.38, 0xe9dfc9);
  world.box(-0.19, 0.54, -1.22, 0.32, 0.02, 0.28, 0xd7c8aa);
  world.box(0.6, 0.51, -1.3, 0.30, 0.09, 0.22, 0x9d6a4c);
  world.box(0.64, 0.60, -1.34, 0.10, 0.08, 0.10, 0xb98a62);
  world.addObstacle(-0.5, 1.3, -1.35, -0.45);
  rug(world, -0.4, -0.1, 3.6, 2.4, [0x5b4945, 0x7b5f50, 0x9f8264, 0x4f5f52], 4);

  // телевизор на тумбе у правой стены
  world.box(3.2, 0, 0.55, 1.05, 0.55, 1.65, 0x6b4b36);
  world.box(3.35, 0.55, 0.9, 0.20, 0.85, 1.15, 0x1d2027);
  world.glowBox(3.33, 0.62, 0.98, 0.02, 0.70, 0.98, 0x6fa3b7);
  world.glowBox(3.322, 0.78, 1.14, 0.005, 0.10, 0.36, 0x9bd4de);
  world.glowBox(3.322, 0.94, 1.22, 0.005, 0.12, 0.22, 0xdfb078);
  world.glowBox(3.322, 1.10, 1.32, 0.005, 0.08, 0.20, 0xd77e72);
  world.box(3.98, 0.55, 1.35, 0.10, 0.12, 0.12, 0x1d2027);
  world.addGlow(3.8, 1.2, 1.45, 0x72b3c6, 2.2, 0.22);
  world.addPointLight(0x75aec4, 10, 6, 3.6, 1.3, 1.5);
  world.addObstacle(3.1, 4.1, 0.4, 2.2);

  // кресло
  world.box(2.55, 0.2, -2.25, 0.95, 0.32, 0.95, 0x5e6e63);
  world.box(2.55, 0.5, -2.55, 0.95, 0.75, 0.22, 0x6d7f72);
  world.box(2.45, 0.5, -2.35, 0.20, 0.55, 0.75, 0x53645a);
  world.box(3.35, 0.5, -2.35, 0.20, 0.55, 0.75, 0x53645a);
  world.addObstacle(2.45, 3.55, -2.85, -1.75);

  // книжный шкаф
  world.box(-4.1, 0, -2.85, 0.55, 2.25, 2.0, 0x634531);
  world.box(-4.02, 0.1, -2.7, 0.38, 0.9, 0.75, 0x4f3829);
  world.box(-4.02, 1.15, -2.7, 0.38, 0.9, 0.75, 0x4f3829);
  for (let i = 0; i < 5; i++) {
    world.box(-3.98, 0.22 + i * 0.13, -2.6, 0.28, 0.10, 0.12, [0x7a4f63, 0x4f6d7a, 0xd9b060, 0x5b7a52, 0x8d3f3b][i]);
    world.box(-3.98, 1.28 + (i % 3) * 0.13, -2.6, 0.28, 0.10, 0.12, [0x5b628c, 0x8aa26e, 0xaa7655][i % 3]);
  }
  world.addObstacle(-4.2, -3.35, -3.1, -1.7);
  plant(world, -4.0, 1.2, 0.85);
  wallPhoto(world, -2.8, 1.9, -3.56, 0, 0.85, 0.65);
  wallPhoto(world, -0.9, 2.1, -3.56, 0, 0.7, 0.55);
  world.addHotspot('family_album', -2.9, -2.7, 1.25);

  // детские игрушки
  world.box(1.35, 0.02, 1.4, 0.25, 0.25, 0.25, 0xd0904f);
  world.box(1.65, 0.02, 1.6, 0.18, 0.18, 0.18, 0x7d90b0);
  world.box(1.22, 0.27, 1.4, 0.12, 0.12, 0.12, 0xe6c75a);
  world.box(1.3, 0.02, 1.8, 0.4, 0.08, 0.22, 0xb56d52);

  // семья
  const seated = (preset, x, z, rot) => addNpcSeated(world, preset, x, z, rot);
  seated(NPC_PRESETS.sister, -0.55, -2.55, 0.12);
  addNpcStanding(world, NPC_PRESETS.mom, -2.35, -0.55, 0.7);
  addNpcSeated(world, NPC_PRESETS.dad, 2.95, -2.28, -Math.PI / 2.4);
  const dima = createHumanoid({ ...NPC_PRESETS.brother, sitting: true });
  world.addNpc({
    group: dima.group, x: 1.75, z: 1.35, y: -0.1, rot: -0.6,
    update: (dt, t) => dima.update(dt, t, false, 0),
  });
  // маленький робот рядом с Димой
  world.box(2.1, 0.02, 1.9, 0.2, 0.2, 0.16, 0x7f95a1);
  world.box(2.14, 0.22, 1.92, 0.12, 0.12, 0.1, 0x9fb2bb);
  world.box(2.15, 0.34, 1.94, 0.08, 0.05, 0.05, 0xe4c25e);

  world.addFennec(0.45, -2.42, 'static', 0.45, 0.6);
  world.fennecSpawn.y = 0.46;
  world.spawn = { x: 0.4, z: 2.25, rot: Math.PI };
  world.bounds = { minX: -4.35, maxX: 4.2, minZ: -3.4, maxZ: 3.3 };
  world.camera = { yaw: -0.03, pitch: 0.43, dist: 6.1, targetHeight: 1.12 };

  world.addPointLight(0xffd39a, 16, 9, -0.5, 2.7, 0.2);
  world.addGlow(-0.4, 2.72, 0.1, 0xffce91, 3.0, 0.12);
  world.finish();
  return world;
}

// ── Титульный двор ───────────────────────────────────────────────────────
function buildTitle() {
  const world = new World('title', { background: 0x090d1a, fog: [12, 30], seed: 101 });
  addStandardLights(world, {
    hemi: 0x5f7bb6, ground: 0x211f2b, hemiIntensity: 1.35,
    sun: 0x9fb7e2, sunIntensity: 1.55, sunPos: [-6, 10, -2],
  });
  world.addPointLight(0xffad68, 45, 16, 2.6, 2.4, 2.2);
  world.addPointLight(0x668cc4, 34, 18, -3.2, 3.2, 4.0);
  world.addPointLight(0xffd09a, 55, 12, 0.0, 1.7, 4.6);
  world.addTiles(-7, 7, -6, 6, [0x2e3542, 0x333b49, 0x29303d], { tile: 1.2, seed: 3 });
  // задняя стена-силуэт
  world.box(-9, 0, -6.3, 18, 8, 0.6, 0x1e2534);
  for (let floor = 0; floor < 3; floor++) {
    for (let col = 0; col < 8; col++) {
      if ((col + floor) % 3 === 0) {
        world.glowBox(-7.8 + col * 2.1, 2.0 + floor * 1.8, -5.95, 0.55, 0.7, 0.04, 0xe6b269);
      } else {
        world.box(-7.8 + col * 2.1, 2.0 + floor * 1.8, -5.95, 0.55, 0.7, 0.04, 0x293346);
      }
    }
  }
  // контейнер
  world.box(1.5, 0, -2.2, 1.9, 1.25, 1.5, 0x4d6654);
  world.box(1.45, 1.25, -2.25, 2.0, 0.10, 1.6, 0x394b3d);
  world.box(1.7, 1.4, -2.4, 1.0, 0.18, 0.7, 0x334437);
  world.box(2.2, 1.05, -0.85, 0.18, 0.18, 0.08, 0x2e3b33);
  // коробки
  world.box(-0.3, 0, -0.4, 0.8, 0.55, 0.7, 0x8c6848);
  world.box(-0.2, 0.55, -0.35, 0.55, 0.4, 0.5, 0x9a7551);
  // фонарь
  world.box(-2.7, 0, -1.9, 0.14, 4.0, 0.14, 0x3c434c);
  world.glowBox(-2.73, 3.85, -1.93, 0.22, 0.18, 0.22, 0xffcf7a);
  world.addGlow(-2.7, 3.8, -1.9, 0xffc56e, 4.4, 0.55);
  world.addPointLight(0xffbd63, 85, 16, -2.7, 3.75, -1.8);
  // мешки
  for (const [x, z, s] of [[0.2, -1.2, 0.5], [-0.7, -1.8, 0.42], [4.1, -1.4, 0.55], [3.6, -2.7, 0.38]]) {
    world.box(x, 0, z, s, s * 0.8, s * 0.9, 0x414855, { jitter: 0.12 });
  }
  // скамейка
  world.box(-4.7, 0.44, 1.4, 1.8, 0.12, 0.5, 0x6d4f39);
  world.box(-4.7, 0.5, 1.32, 1.8, 0.42, 0.08, 0x7a5a41);
  world.box(-4.55, 0, 1.48, 0.10, 0.44, 0.4, 0x4b5057);
  world.box(-3.05, 0, 1.48, 0.10, 0.44, 0.4, 0x4b5057);
  // звёзды и луна
  world.addStars(160, 36, 10, 22);
  world.addGlow(-12, 13, -18, 0xdde7ff, 9, 0.5);
  // редкие искры
  for (let i = 0; i < 7; i++) {
    const sp = world.addGlow(-3 + i * 1.3, 0.4 + (i % 3) * 0.3, -1.5 + (i % 4), 0xf0cc86, 0.3, 0.25);
    const base = sp.position.clone();
    world.onUpdate((dt, t) => {
      sp.position.y = base.y + Math.sin(t * 0.8 + i) * 0.2;
      sp.position.x = base.x + Math.cos(t * 0.3 + i * 2) * 0.25;
    });
  }
  world.addFennec(0.25, 1.05, 'static', 0.35, 1.0);
  world.camera = { yaw: 0.15, pitch: 0.28, dist: 8.3, targetHeight: 1.0 };
  world.title = true;
  world.finish();
  return world;
}

// ── Студия персонажа ────────────────────────────────────────────────────
function buildCreator() {
  const world = new World('creator', { background: 0x0b0e17, seed: 66 });
  world.scene.fog = new THREE.Fog(0x0b0e17, 10, 22);
  addStandardLights(world, {
    hemi: 0x7887ad, ground: 0x1d1a20, hemiIntensity: 0.9,
    sun: 0xffd6a3, sunIntensity: 2.2, sunPos: [4, 8, 6],
  });
  // пол-подиум
  world.addTiles(-4.5, 4.5, -4.5, 4.5, [0x191e2a, 0x1c2230, 0x171c27], { tile: 1.0, y: -0.1, h: 0.1, seed: 4 });
  world.box(-1.45, 0, -1.45, 2.9, 0.22, 2.9, 0x2c3444);
  world.box(-1.35, 0.22, -1.35, 2.7, 0.10, 2.7, 0x3b465a);
  world.box(-1.1, 0.32, -1.1, 2.2, 0.05, 2.2, 0x56657e);
  // подсветка подиума
  world.glowBox(-1.15, 0.26, -1.15, 2.3, 0.04, 2.3, 0x86c9c4);
  world.addGlow(0, 0.3, 0, 0x79b9c0, 2.6, 0.16);
  // задняя стена-панели
  world.box(-4.5, 0, -4.6, 9, 5.2, 0.25, 0x171b27);
  for (let i = 0; i < 7; i++) {
    world.box(-4.2 + i * 1.25, 0, -4.4, 0.12, 4.8, 0.12, 0x2d3547);
  }
  world.box(-4.5, 4.6, -4.6, 9, 0.2, 0.4, 0x3b4558);
  world.addTextPlane({
    text: 'КТО ТЫ?', sub: 'СОБЕРИ СЕБЯ ЗАНОВО', x: 0, y: 3.4, z: -4.35, w: 4.0, h: 1.25,
    bg: '#10141f', fg: '#f2dfba', accent: '#7ac4b8', font: '700 96px "Pixelify Sans", monospace',
  });
  // парящие кубы
  const colors = [0xe7b273, 0x7ac4b8, 0xb9858f, 0xf0b45c, 0x6f87b8, 0xd6c6a4];
  const floaters = [];
  const rand = (() => { let a = 42; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; })();
  for (let i = 0; i < 16; i++) {
    const s = 0.12 + rand() * 0.30;
    world.box(-4 + rand() * 8, 0.8 + rand() * 2.8, -3.5 + rand() * 6.5, s, s, s, colors[i % colors.length], { jitter: 0.08 });
    floaters.push({ phase: rand() * 6, speed: 0.4 + rand() * 0.7 });
  }
  world.onUpdate((dt, t) => {
    // лёгкая пульсация света-подсветки
    for (let i = 0; i < floaters.length; i++) {
      // кубы — часть merged mesh, поэтому не двигаются; вместо этого крутим только свет
    }
  });
  // световые конусы
  world.addGlow(-3.4, 2.3, -1.0, 0x6aa9c7, 2.0, 0.2);
  world.addGlow(3.4, 2.4, -0.8, 0xd69982, 2.2, 0.18);
  world.addPointLight(0x7fb6cf, 25, 9, -3.4, 2.7, -0.6);
  world.addPointLight(0xe6a27f, 22, 9, 3.4, 2.8, -0.4);
  world.addPointLight(0xffe3b8, 20, 8, 0.5, 3.1, 2.8);
  world.spawn = { x: 0, z: 0.6, rot: Math.PI };
  world.avatarSpawn = { x: 0, z: 0.1 };
  world.bounds = { minX: -1.2, maxX: 1.2, minZ: -1.2, maxZ: 1.2 };
  world.camera = { yaw: 0, pitch: 0.23, dist: 5.0, targetHeight: 1.05 };
  world.creator = true;
  world.finish();
  return world;
}

export function buildWorld(layout, state) {
  if (layout === 'title') return buildTitle();
  if (layout === 'creator') return buildCreator();
  if (layout.startsWith('bedroom')) return buildBedroom(layout, state);
  if (layout.startsWith('kitchen')) return buildKitchen(layout, state);
  if (layout === 'yard') return buildYard(layout, state);
  if (layout === 'classroom') return buildClassroom(layout, state);
  if (layout === 'livingroom') return buildLivingRoom(layout, state);
  throw new Error(`Неизвестная локация: ${layout}`);
}
