// characters.js — воксельные люди и фенёк.
import * as THREE from 'three';

const matCache = new Map();
const geo = new THREE.BoxGeometry(1, 1, 1);

function mat(color) {
  if (!matCache.has(color)) {
    matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  }
  return matCache.get(color);
}

function box(parent, color, w, h, d, x, y, z, opts = {}) {
  const m = new THREE.Mesh(geo, mat(color));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  parent.add(m);
  return m;
}

function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export const SKIN_TONES = [0xf0c6a1, 0xdca77a, 0xc28a62, 0x9a6340, 0x704632, 0x4b2e22];
export const HAIR_COLORS = [0x241d1a, 0x3d2a22, 0x67452c, 0x9b6238, 0xd19b5a, 0xe3c384, 0x8d3f3b, 0x3c4054, 0xb4afa7];
export const SHIRT_COLORS = [0x506f7b, 0x7a4d63, 0x5a7a52, 0x9b6a3f, 0x5b628c, 0xb45151, 0x2e394c, 0xd6c6a4];
export const PANTS_COLORS = [0x344052, 0x4a4038, 0x2c2f36, 0x5b4a63, 0x6b7059];
export const BAG_COLORS = [0x7d4b3e, 0x435b52, 0x5c5578, 0x8a6b38];

export function createHumanoid(cfg = {}) {
  const skin = cfg.skin ?? SKIN_TONES[1];
  const hairColor = cfg.hairColor ?? HAIR_COLORS[1];
  const shirt = cfg.shirt ?? SHIRT_COLORS[0];
  const pants = cfg.pants ?? PANTS_COLORS[0];
  const hairStyle = cfg.hairStyle ?? 'short';
  const height = cfg.height ?? 1.76;
  const root = new THREE.Group();
  root.name = cfg.name || 'humanoid';
  root.userData.persistent = true;
  const bodyScale = height / 1.78;
  root.scale.setScalar(bodyScale);

  const legs = group(root);
  const legL = group(legs, -0.105, 0.84, 0);
  const legR = group(legs, 0.105, 0.84, 0);
  for (const leg of [legL, legR]) {
    box(leg, pants, 0.17, 0.64, 0.19, 0, -0.32, 0);
    box(leg, 0x24242a, 0.195, 0.12, 0.29, 0, -0.72, 0.055);
    box(leg, 0x3a3f49, 0.175, 0.035, 0.20, 0, -0.655, 0.01);
  }

  const upper = group(root);
  // туловище
  box(upper, shirt, 0.45, 0.60, 0.27, 0, 1.13, 0);
  box(upper, shirt, 0.37, 0.08, 0.28, 0, 1.44, 0);
  // воротник / молния
  box(upper, shade(shirt, 0.8), 0.07, 0.35, 0.015, 0, 1.24, 0.14);
  box(upper, shade(shirt, 0.85), 0.46, 0.06, 0.28, 0, 0.86, 0);

  if (cfg.dress) {
    box(upper, cfg.dress, 0.50, 0.25, 0.33, 0, 0.86, 0);
    box(upper, cfg.dress, 0.56, 0.10, 0.36, 0, 0.73, 0);
  }

  // шея
  box(upper, skin, 0.13, 0.10, 0.13, 0, 1.47, 0);

  const armL = group(upper, -0.275, 1.36, 0);
  const armR = group(upper, 0.275, 1.36, 0);
  for (const arm of [armL, armR]) {
    box(arm, shirt, 0.125, 0.47, 0.155, 0, -0.235, 0);
    box(arm, skin, 0.12, 0.12, 0.14, 0, -0.51, 0);
  }

  // рюкзак — сзади
  if (cfg.backpack) {
    const bag = cfg.bagColor ?? BAG_COLORS[0];
    box(upper, bag, 0.34, 0.42, 0.16, 0, 1.16, -0.20);
    box(upper, shade(bag, 0.75), 0.30, 0.12, 0.06, 0, 1.06, -0.295);
    box(upper, shade(bag, 0.9), 0.08, 0.34, 0.03, -0.11, 1.24, -0.29);
    box(upper, shade(bag, 0.9), 0.08, 0.34, 0.03, 0.11, 1.24, -0.29);
  }

  const head = group(upper, 0, 1.66, 0);
  box(head, skin, 0.40, 0.38, 0.36, 0, 0, 0);
  box(head, shade(skin, 0.94), 0.12, 0.12, 0.02, 0, -0.05, 0.185, { cast: false });
  // глаза
  const eyeL = box(head, 0x24201f, 0.055, 0.062, 0.014, -0.095, 0.035, 0.187);
  const eyeR = box(head, 0x24201f, 0.055, 0.062, 0.014, 0.095, 0.035, 0.187);
  const eyeBaseY = eyeL.scale.y;
  box(head, 0xf4f1e8, 0.013, 0.016, 0.005, -0.108, 0.05, 0.197, { cast: false });
  box(head, 0xf4f1e8, 0.013, 0.016, 0.005, 0.082, 0.05, 0.197, { cast: false });
  box(head, shade(hairColor, 0.95), 0.085, 0.018, 0.012, -0.095, 0.105, 0.19);
  box(head, shade(hairColor, 0.95), 0.085, 0.018, 0.012, 0.095, 0.105, 0.19);
  box(head, shade(skin, 0.8), 0.06, 0.018, 0.012, 0, -0.075, 0.19);

  const ears = group(head);
  box(ears, skin, 0.025, 0.10, 0.06, -0.21, 0, 0);
  box(ears, skin, 0.025, 0.10, 0.06, 0.21, 0, 0);

  // причёски
  const hair = new THREE.Group();
  head.add(hair);
  const hs = shade(hairColor, 1);
  if (hairStyle === 'short') {
    box(hair, hs, 0.43, 0.13, 0.38, 0, 0.22, -0.005);
    box(hair, hs, 0.42, 0.18, 0.10, 0, 0.10, -0.16);
    box(hair, hs, 0.06, 0.18, 0.37, -0.175, 0.10, 0);
    box(hair, hs, 0.06, 0.18, 0.37, 0.175, 0.10, 0);
    box(hair, hs, 0.42, 0.07, 0.08, 0, 0.15, 0.15);
  } else if (hairStyle === 'bob') {
    box(hair, hs, 0.44, 0.12, 0.39, 0, 0.23, 0);
    box(hair, hs, 0.44, 0.38, 0.09, 0, 0.03, -0.18);
    box(hair, hs, 0.07, 0.40, 0.38, -0.19, 0.01, 0);
    box(hair, hs, 0.07, 0.40, 0.38, 0.19, 0.01, 0);
    box(hair, hs, 0.42, 0.08, 0.07, 0, 0.18, 0.16);
  } else if (hairStyle === 'curls') {
    const curls = [
      [-0.16, 0.24, 0.02], [0.16, 0.24, 0.02], [0, 0.28, 0.03],
      [0, 0.24, -0.14], [-0.18, 0.12, -0.1], [0.18, 0.12, -0.1],
      [-0.2, 0.08, 0.09], [0.2, 0.08, 0.09], [0, 0.20, 0.16],
    ];
    box(hair, hs, 0.43, 0.14, 0.37, 0, 0.19, 0);
    for (const [x, y, z] of curls) box(hair, hs, 0.15, 0.13, 0.15, x, y, z);
  } else if (hairStyle === 'pony') {
    box(hair, hs, 0.43, 0.12, 0.38, 0, 0.22, 0);
    box(hair, hs, 0.42, 0.09, 0.07, 0, 0.17, 0.165);
    box(hair, hs, 0.11, 0.11, 0.12, 0, 0.20, -0.22);
    const tail = group(hair, 0, 0.17, -0.26);
    box(tail, hs, 0.13, 0.35, 0.14, 0, -0.18, -0.03);
    box(tail, shade(hs, 1.1), 0.10, 0.10, 0.08, 0, -0.37, -0.05);
  }

  if (cfg.bows) {
    box(hair, 0xd98b9a, 0.10, 0.09, 0.05, -0.23, 0.20, 0.0);
    box(hair, 0xd98b9a, 0.10, 0.09, 0.05, 0.23, 0.20, 0.0);
  }

  if (cfg.glasses) {
    box(head, 0x2b2c33, 0.13, 0.095, 0.015, -0.095, 0.035, 0.201);
    box(head, 0x2b2c33, 0.13, 0.095, 0.015, 0.095, 0.035, 0.201);
    box(head, 0x2b2c33, 0.08, 0.02, 0.012, 0, 0.04, 0.201);
  }

  let phase = Math.random() * 10;
  let sitting = !!cfg.sitting;
  let blinkT = 1 + Math.random() * 3;

  const humanoid = {
    group: root,
    parts: { legL, legR, armL, armR, head, upper },
    height,
    setSitting(v) {
      sitting = v;
      legL.rotation.x = v ? -1.45 : 0;
      legR.rotation.x = v ? -1.45 : 0;
      armL.rotation.x = v ? -0.35 : 0;
      armR.rotation.x = v ? -0.35 : 0;
    },
    update(dt, t, moving = false, speed = 0) {
      phase += dt * (moving ? 5.2 + speed * 1.4 : 1.4);
      blinkT -= dt;
      const amp = sitting ? 0.05 : moving ? Math.min(0.62, 0.35 + speed * 0.2) : 0.04;
      if (!sitting) {
        const sw = Math.sin(phase) * amp;
        legL.rotation.x = sw;
        legR.rotation.x = -sw;
        armL.rotation.x = -sw * 0.8;
        armR.rotation.x = sw * 0.8;
      } else {
        armL.rotation.x = -0.35 + Math.sin(t * 1.1) * 0.02;
        armR.rotation.x = -0.35 + Math.cos(t * 1.2) * 0.02;
      }
      upper.position.y = moving && !sitting ? Math.abs(Math.sin(phase * 2)) * 0.015 : Math.sin(t * 1.6 + phase) * 0.006;
      upper.rotation.z = sitting ? 0 : Math.sin(phase) * (moving ? 0.018 : 0.005);
      head.rotation.z = Math.sin(t * 0.7 + phase * 0.1) * 0.018;
      head.rotation.y = Math.sin(t * 0.35 + phase * 0.07) * 0.04;
      if (blinkT < 0) {
        eyeL.scale.y = eyeBaseY * 0.22;
        eyeR.scale.y = eyeBaseY * 0.22;
        if (blinkT < -0.12) {
          blinkT = 2.2 + Math.random() * 4.5;
          eyeL.scale.y = eyeBaseY;
          eyeR.scale.y = eyeBaseY;
        }
      }
    },
  };
  if (sitting) humanoid.setSitting(true);
  return humanoid;
}

function shade(hex, factor) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return c.getHex();
}

export function createFennec(cfg = {}) {
  const sand = 0xe7b273;
  const sandLight = 0xf0c88e;
  const cream = 0xf6e7ca;
  const dark = 0x4d3b35;
  const inner = 0xd9a09a;
  const nose = 0x2c2323;
  const root = new THREE.Group();
  root.name = 'fennec';
  root.userData.persistent = true;

  const body = group(root);
  box(body, sand, 0.34, 0.24, 0.54, 0, 0.36, 0.0);
  box(body, sandLight, 0.28, 0.16, 0.40, 0, 0.47, -0.02);
  box(body, cream, 0.20, 0.15, 0.03, 0, 0.30, 0.275);
  box(body, sand, 0.17, 0.21, 0.24, -0.17, 0.30, -0.13);
  box(body, sand, 0.17, 0.21, 0.24, 0.17, 0.30, -0.13);
  box(body, cream, 0.17, 0.06, 0.02, -0.17, 0.25, 0.0);
  box(body, cream, 0.17, 0.06, 0.02, 0.17, 0.25, 0.0);

  const head = group(body, 0, 0.51, 0.31);
  box(head, sand, 0.30, 0.24, 0.28, 0, 0, 0);
  box(head, sandLight, 0.28, 0.06, 0.27, 0, 0.13, -0.005);
  box(head, cream, 0.16, 0.10, 0.12, 0, -0.065, 0.18);
  box(head, cream, 0.12, 0.08, 0.05, 0, -0.065, 0.245);
  const eyeL = box(head, 0x1d1918, 0.05, 0.06, 0.016, -0.085, 0.045, 0.145);
  const eyeR = box(head, 0x1d1918, 0.05, 0.06, 0.016, 0.085, 0.045, 0.145);
  const eyeBaseY = eyeL.scale.y;
  box(head, 0xf8f1dc, 0.012, 0.014, 0.005, -0.097, 0.06, 0.156, { cast: false });
  box(head, 0xf8f1dc, 0.012, 0.014, 0.005, 0.073, 0.06, 0.156, { cast: false });
  box(head, nose, 0.055, 0.04, 0.035, 0, -0.035, 0.268);
  box(head, dark, 0.02, 0.09, 0.02, 0, -0.10, 0.24);

  const earL = group(head, -0.115, 0.115, -0.01);
  const earR = group(head, 0.115, 0.115, -0.01);
  earL.rotation.z = 0.19;
  earR.rotation.z = -0.19;
  for (const [ear, dir] of [[earL, -1], [earR, 1]]) {
    box(ear, sand, 0.165, 0.13, 0.07, 0, 0.065, 0);
    box(ear, sandLight, 0.12, 0.11, 0.065, dir * 0.008, 0.17, 0);
    box(ear, dark, 0.075, 0.085, 0.055, dir * 0.012, 0.265, 0);
    box(ear, inner, 0.10, 0.10, 0.012, 0, 0.085, 0.040);
    box(ear, inner, 0.062, 0.085, 0.012, dir * 0.004, 0.205, 0.037);
  }

  const tail = group(body, 0, 0.36, -0.25);
  tail.rotation.x = -0.35;
  box(tail, sand, 0.16, 0.15, 0.22, 0, 0, -0.11);
  box(tail, sandLight, 0.14, 0.14, 0.20, 0.01, 0.08, -0.27);
  box(tail, cream, 0.11, 0.11, 0.16, 0.02, 0.15, -0.41);
  box(tail, cream, 0.07, 0.07, 0.10, 0.01, 0.19, -0.50);

  const legs = [];
  const legPos = [
    [-0.12, 0.22, 0.15], [0.12, 0.22, 0.15],
    [-0.12, 0.22, -0.14], [0.12, 0.22, -0.14],
  ];
  for (const [x, y, z] of legPos) {
    const l = group(body, x, y, z);
    box(l, sand, 0.075, 0.17, 0.08, 0, -0.085, 0);
    box(l, cream, 0.08, 0.05, 0.10, 0, -0.17, 0.012);
    legs.push(l);
  }

  let phase = Math.random() * 6;
  let blinkT = 2 + Math.random() * 3;
  const earBaseL = 0.19;
  const earBaseR = -0.19;

  const fennec = {
    group: root,
    head,
    update(dt, t, moving = false, speed = 0) {
      phase += dt * (moving ? 6 + speed : 2.1);
      blinkT -= dt;
      const step = moving ? Math.sin(phase) * 0.65 : Math.sin(t * 1.8) * 0.04;
      legs[0].rotation.x = step;
      legs[3].rotation.x = step;
      legs[1].rotation.x = -step;
      legs[2].rotation.x = -step;
      body.position.y = moving ? Math.abs(Math.sin(phase * 2)) * 0.018 : Math.sin(t * 1.4) * 0.006;
      head.position.y = 0.51 + Math.sin(t * 2.2) * 0.008;
      head.rotation.y = Math.sin(t * 0.6) * 0.12;
      head.rotation.z = Math.sin(t * 0.9) * 0.02;
      tail.rotation.y = Math.sin(t * 2.6) * 0.22;
      tail.rotation.x = -0.35 + Math.sin(t * 1.3) * 0.06;
      earL.rotation.z = earBaseL + Math.sin(t * 2.1) * 0.035;
      earR.rotation.z = earBaseR - Math.sin(t * 1.7 + 0.8) * 0.035;
      if (moving) {
        earL.rotation.x = Math.sin(phase * 2) * 0.05;
        earR.rotation.x = Math.sin(phase * 2 + 0.5) * 0.05;
      }
      if (blinkT < 0) {
        eyeL.scale.y = eyeBaseY * 0.18;
        eyeR.scale.y = eyeBaseY * 0.18;
        if (blinkT < -0.1) {
          blinkT = 2.5 + Math.random() * 4;
          eyeL.scale.y = eyeBaseY;
          eyeR.scale.y = eyeBaseY;
        }
      }
    },
  };
  return fennec;
}

export const NPC_PRESETS = {
  mom: {
    skin: SKIN_TONES[1], hairColor: 0x3b2a26, hairStyle: 'bob', shirt: 0x7c5060,
    pants: 0x30343c, height: 1.68, name: 'mom', glasses: false,
  },
  dad: {
    skin: SKIN_TONES[2], hairColor: 0x4a403c, hairStyle: 'short', shirt: 0x436a67,
    pants: 0x3d3a34, height: 1.82, name: 'dad',
  },
  brother: {
    skin: SKIN_TONES[1], hairColor: 0x9b6238, hairStyle: 'short', shirt: 0xd4b04f,
    pants: 0x48617a, height: 1.14, name: 'brother',
  },
  sister: {
    skin: SKIN_TONES[0], hairColor: 0x2c211d, hairStyle: 'pony', shirt: 0xd98b9a,
    pants: 0xd98b9a, dress: 0xd98b9a, height: 0.98, name: 'sister', bows: true,
  },
  teacher: {
    skin: SKIN_TONES[2], hairColor: 0x5f5a55, hairStyle: 'bob', shirt: 0x5e5a78,
    pants: 0x353541, height: 1.7, name: 'teacher', glasses: true,
  },
};
