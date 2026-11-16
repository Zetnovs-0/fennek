// main.js — движок игры, управление, интерфейс и связка истории с воксельным миром.
import * as THREE from 'three';
import { buildWorld } from './worlds.js';
import {
  createHumanoid, createFennec,
  SKIN_TONES, HAIR_COLORS, SHIRT_COLORS, PANTS_COLORS, BAG_COLORS,
} from './characters.js';
import {
  STORY_START, NODES, ENDINGS, ENDING_ORDER, DREAMS, DREAM_ORDER, STAT_INFO,
  HOTSPOTS, lineView, choiceView, endingView, hotspotView, formatText,
  resolveEnding, checkState, dreamOf,
} from './story.js';
import { AudioEngine } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const SAVE_KEY = 'fennek_save_v1';
const SEEN_KEY = 'fennek_endings_v1';
const STAT_KEYS = ['study', 'courage', 'family', 'bond'];
const HAIR_STYLES = ['short', 'bob', 'curls', 'pony'];
const MOOD_LABEL = { warm: 'тёплая', cool: 'светлая', cold: 'тихая', amber: 'янтарная' };

const ICONS = {
  study: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c3-1 5.5-.8 8 1v13c-2.5-1.8-5-2-8-1z"/><path d="M20 5.5c-3-1-5.5-.8-8 1v13c2.5-1.8 5-2 8-1z"/></svg>',
  courage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2.5 5 13h5l-1 8.5L19 10h-5.5z"/></svg>',
  family: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.3-7.5-10A4.5 4.5 0 0 1 12 6.2 4.5 4.5 0 0 1 19.5 10c0 5.7-7.5 10-7.5 10z"/></svg>',
  bond: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V9.5L9.5 4l1 5L12 7l1.5 2 1-5L19 9.5V21"/><path d="M8.5 16.5h7"/><path d="M9.5 19h5"/></svg>',
  arch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-7h6v7M9 10h.01M15 10h.01"/></svg>',
  code: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 6-5 6 5 6M16 6l5 6-5 6M13.5 4l-3 16"/></svg>',
  bio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-6 4 12 2-6h6"/><path d="M12 4.5c2.5 0 4.5 2 4.5 4.5"/></svg>',
};

function readSeen() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((id) => ENDINGS[id]) : [];
  } catch {
    return [];
  }
}

function writeSeen(seen) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* noop */ }
}

function defaultState() {
  return {
    version: 1,
    name: 'Алекс',
    gender: 'm',
    looks: { skin: 1, hair: 1, hairStyle: 'short', shirt: 0, pants: 0, bag: 0 },
    dreamKey: 'arch',
    stats: { study: 0, courage: 0, family: 0, bond: 0 },
    flags: {},
    fennecName: null,
    nodeId: STORY_START,
    chapter: { n: 1, title: 'Свой угол', sub: 'Дом. Вечер. Всё как всегда.' },
    usedHotspots: [],
    startedAt: null,
  };
}

function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const base = defaultState();
  const s = { ...base, ...raw };
  s.looks = { ...base.looks, ...(raw.looks || {}) };
  s.stats = { ...base.stats, ...(raw.stats || {}) };
  s.flags = raw.flags && typeof raw.flags === 'object' ? { ...raw.flags } : {};
  s.usedHotspots = Array.isArray(raw.usedHotspots) ? raw.usedHotspots.filter((x) => typeof x === 'string') : [];
  s.name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 16) : 'Алекс';
  s.gender = raw.gender === 'f' ? 'f' : 'm';
  s.dreamKey = DREAMS[raw.dreamKey] ? raw.dreamKey : 'arch';
  s.looks.hairStyle = HAIR_STYLES.includes(s.looks.hairStyle) ? s.looks.hairStyle : 'short';
  s.looks.skin = clamp(Number(s.looks.skin) || 0, 0, SKIN_TONES.length - 1);
  s.looks.hair = clamp(Number(s.looks.hair) || 0, 0, HAIR_COLORS.length - 1);
  s.looks.shirt = clamp(Number(s.looks.shirt) || 0, 0, SHIRT_COLORS.length - 1);
  s.looks.pants = clamp(Number(s.looks.pants) || 0, 0, PANTS_COLORS.length - 1);
  s.looks.bag = clamp(Number(s.looks.bag) || 0, 0, BAG_COLORS.length - 1);
  for (const k of STAT_KEYS) s.stats[k] = clamp(Number(s.stats[k]) || 0, 0, 99);
  if (!NODES[s.nodeId]) s.nodeId = STORY_START;
  if (!s.chapter || typeof s.chapter.n !== 'number') s.chapter = { ...base.chapter };
  return s;
}

class Game {
  constructor() {
    this.ui = {
      stage: $('#stage'),
      hud: $('#hud'),
      menuBtn: $('#menu-btn'),
      muteBtn: $('#mute-btn'),
      soundFloat: $('#sound-float'),
      chapterLabel: $('#chapter-label'),
      chapterTitle: $('#chapter-title'),
      locationLabel: $('#location-label'),
      objective: $('#objective-text'),
      stats: $('#stats'),
      title: $('#title-screen'),
      btnNew: $('#btn-new'),
      btnContinue: $('#btn-continue'),
      btnGallery: $('#btn-gallery'),
      galleryCount: $('#gallery-count'),
      creator: $('#creator'),
      creatorBack: $('#creator-back'),
      nameInput: $('#name-input'),
      genderGroup: $('#gender-group'),
      skinSwatches: $('#skin-swatches'),
      hairSwatches: $('#hair-swatches'),
      shirtSwatches: $('#shirt-swatches'),
      pantsSwatches: $('#pants-swatches'),
      hairstyleGroup: $('#hairstyle-group'),
      dreamCards: $('#dream-cards'),
      startBtn: $('#start-btn'),
      chapterCard: $('#chapter-card'),
      ccNumber: $('#cc-number'),
      ccTitle: $('#cc-title'),
      ccSub: $('#cc-sub'),
      ccLocation: $('#cc-location'),
      storyUI: $('#story-ui'),
      dialogue: $('#dialogue'),
      speaker: $('#speaker'),
      dialogueText: $('#dialogue-text'),
      dialogueHint: $('#dialogue-hint'),
      choices: $('#choices'),
      montageBar: $('#montage-bar'),
      montageCounter: $('#montage-counter'),
      montageFill: $('#montage-progress-fill'),
      montageConfirm: $('#montage-confirm'),
      interact: $('#interact'),
      interactLabel: $('#interact-label'),
      memory: $('#memory'),
      memoryClose: $('#memory-close'),
      memoryTitle: $('#memory-title'),
      memoryBody: $('#memory-body'),
      memoryEffects: $('#memory-effects'),
      toasts: $('#toasts'),
      ending: $('#ending-screen'),
      endingNumber: $('#ending-number'),
    endingTotal: $('#ending-total'),
      endingMood: $('#ending-mood'),
      endingTitle: $('#ending-title'),
      endingTag: $('#ending-tag'),
      endingBody: $('#ending-body'),
      endingStats: $('#ending-stats'),
      endingAgain: $('#ending-again'),
      endingGallery: $('#ending-gallery'),
      endingTitleBtn: $('#ending-title-btn'),
      gallery: $('#gallery'),
      galleryClose: $('#gallery-close'),
      galleryGrid: $('#gallery-grid'),
      galleryProgress: $('#gallery-progress'),
      pause: $('#pause'),
      pauseResume: $('#pause-resume'),
      pauseSound: $('#pause-sound'),
      pauseMenu: $('#pause-menu'),
      pauseRestart: $('#pause-restart'),
      confirm: $('#confirm'),
      confirmYes: $('#confirm-yes'),
      confirmNo: $('#confirm-no'),
      fade: $('#fade'),
      hint: $('#hint'),
      boot: $('#boot'),
      error: $('#error-box'),
    };

    this.audio = new AudioEngine();
    this.state = defaultState();
    this.seen = readSeen();
    this.hasSave = false;
    this.mode = 'boot';
    this.paused = false;
    this.memoryOpen = false;
    this.chapterCardOpen = false;
    this.galleryOpen = false;
    this.galleryReturn = 'title';
    this.endingShown = false;
    this.locked = false;
    this.transitioning = false;
    this.nearHotspot = null;
    this.keys = {};
    this.dragging = false;
    this.dragMoved = 0;
    this.pointerId = null;
    this.lastPointer = { x: 0, y: 0 };
    this.moveTarget = null;
    this.player = null;
    this.preview = null;
    this.fennec = null;
    this.world = null;
    this.worldLayout = null;
    this.markers = [];
    this.seq = null;
    this.seqIndex = 0;
    this.seqDone = null;
    this.typing = null;
    this.displayedChoices = null;
    this.montage = null;
    this.currentNode = null;
    this.chapterTimer = null;
    this.chapterSkip = null;
    this.creatorYaw = 0.42;
    this.cam = { yaw: 0, pitch: 0.42, dist: 5.6, targetHeight: 1.1 };
    this.camBaseYaw = 0;
    this.camYawLimit = 1.1;
    this.lookSmooth = new THREE.Vector3(0, 1, 0);
    this.playerFacing = Math.PI;
    this.time = 0;
    this.lastLabel = '';
    this.walkPhase = 0;
    this.autoPhase = 0;
    this.hintTimer = null;
    this.toastTimer = 0;
    this.tutorialShown = false;

    this.checkStory();
    this.initRenderer();
    this.buildCreatorControls();
    this.renderStatsStructure();
    this.updateSoundUI();
    this.bindEvents();
    this.updateTitleUI();

    this.clock = new THREE.Clock(false);
    this.tmpVec = new THREE.Vector3();
    this.tmpVec2 = new THREE.Vector3();
    this.tmpVec3 = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  checkStory() {
    const errors = checkState();
    if (errors.length) console.warn('[story]', errors.join('\n'));
  }

  // ── браузерный движок ─────────────────────────────────────────────────
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.ui.stage,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(aspect < 0.75 ? 50 : 44, aspect, 0.08, 140);
    this.camera.position.set(0, 2.8, 7);
    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    if (!this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.fov = this.camera.aspect < 0.75 ? 50 : 44;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  isIndoor(layout) {
    return /^(bedroom|kitchen|livingroom)/.test(layout);
  }

  async boot() {
    if (matchMedia('(pointer: coarse)').matches) {
      document.body.classList.add('touch');
      const hint = $('#creator-hint-text');
      if (hint) hint.textContent = '↻ потяни, чтобы повернуть';
    }
    await Promise.race([document.fonts?.ready || Promise.resolve(), sleep(2600)]);
    this.hasSave = this.readSaveRaw() !== null;
    this.updateTitleUI();
    this.updateSoundUI();
    await this.loadWorld('title', { fade: false });
    this.showTitle();
    this.ui.boot.classList.add('done');
    setTimeout(() => { this.ui.boot.style.display = 'none'; }, 750);
    this.clock.start();
    this.animate();
    window.fennekGame = this;
  }

  // ── мир ────────────────────────────────────────────────────────────────
  async loadWorld(layout, { fade = true } = {}) {
    if (this.world && this.worldLayout === layout) {
      if (this.mode === 'play' && this.player && !this.player.group.parent) {
        this.world.scene.add(this.player.group);
      }
      return;
    }
    this.transitioning = true;
    this.hideInteract();
    this.setStoryVisible(false);
    if (fade) {
      this.ui.fade.classList.add('on');
      await sleep(380);
    }
    // убираем актёров из старой сцены: у них общие материалы
    for (const actor of [this.player, this.preview, this.fennec]) {
      if (actor?.group?.parent) actor.group.parent.remove(actor.group);
    }
    this.preview = null;
    this.fennec = null;
    this.markers = [];
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
    this.worldLayout = null;
    this.world = buildWorld(layout, this.state);
    this.worldLayout = layout;
    const c = this.world.camera;
    this.cam = { ...c };
    this.camBaseYaw = c.yaw;
    this.camYawLimit = this.isIndoor(layout) ? 1.08 : Math.PI * 0.94;
    this.lookSmooth.set(0, c.targetHeight, 0);

    if (this.mode === 'play' && this.player) {
      this.world.scene.add(this.player.group);
      const sp = this.world.spawn;
      this.player.group.position.set(sp.x, 0, sp.z);
      this.player.group.rotation.y = sp.rot;
      this.playerFacing = sp.rot;
      this.lookSmooth.set(sp.x, this.cam.targetHeight, sp.z);
      this.moveTarget = null;
    }
    this.setupFennec();
    this.setupMarkers();
    this.setAudioMood(layout);
    this.updateCamera(0, true);
    if (fade) {
      await sleep(80);
      this.ui.fade.classList.remove('on');
      await sleep(300);
    }
    this.transitioning = false;
  }

  setAudioMood(layout) {
    const mood = layout.includes('night') || layout === 'title' || layout === 'yard'
      ? 'night'
      : layout === 'classroom' ? 'bright'
        : layout === 'livingroom' || layout === 'kitchen_confession' ? 'warm'
          : 'calm';
    this.audio.setMood(mood);
  }

  setupFennec() {
    if (this.fennec?.group?.parent) this.fennec.group.parent.remove(this.fennec.group);
    this.fennec = null;
    const spawn = this.world?.fennecSpawn;
    if (!spawn) return;
    const model = createFennec();
    model.group.userData.persistent = true;
    const group = model.group;
    group.position.set(spawn.x, spawn.y ?? 0, spawn.z);
    group.rotation.y = spawn.rot ?? 0;
    group.scale.setScalar(spawn.scale ?? 1);
    this.world.scene.add(group);
    this.fennec = {
      model,
      group,
      mode: spawn.mode || 'idle',
      baseY: spawn.y ?? 0,
      target: new THREE.Vector3(spawn.x, spawn.y ?? 0, spawn.z),
      moving: false,
    };
  }

  setupMarkers() {
    this.markers = [];
    if (!this.world) return;
    for (const h of this.world.hotspots) {
      if (this.state.usedHotspots.includes(h.id) || !HOTSPOTS[h.id]) continue;
      const group = new THREE.Group();
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeSharedGlow(),
        color: 0xf6c46a,
        transparent: true,
        opacity: 0.20,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }));
      glow.scale.setScalar(0.85);
      glow.position.y = 0.09;
      group.add(glow);
      const diamond = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.055, 0),
        new THREE.MeshBasicMaterial({ color: 0xffd18b, transparent: true, opacity: 0.62, depthWrite: false }),
      );
      diamond.position.y = 0.62;
      group.add(diamond);
      group.position.set(h.x, 0, h.z);
      this.world.scene.add(group);
      this.markers.push({ id: h.id, group, glow, diamond, phase: Math.random() * 6 });
    }
  }

  hideMarkers(id) {
    for (const m of this.markers) {
      if (m.id === id) {
        m.group.visible = false;
      }
    }
  }

  // ── персонажи ─────────────────────────────────────────────────────────
  playerLooks() {
    const l = this.state.looks;
    return {
      skin: SKIN_TONES[l.skin] ?? SKIN_TONES[1],
      hairColor: HAIR_COLORS[l.hair] ?? HAIR_COLORS[1],
      hairStyle: HAIR_STYLES.includes(l.hairStyle) ? l.hairStyle : 'short',
      shirt: SHIRT_COLORS[l.shirt] ?? SHIRT_COLORS[0],
      pants: PANTS_COLORS[l.pants] ?? PANTS_COLORS[0],
      height: 1.72,
      backpack: true,
      bagColor: BAG_COLORS[l.bag] ?? BAG_COLORS[0],
      name: 'player',
    };
  }

  createPlayer() {
    if (this.player?.group?.parent) this.player.group.parent.remove(this.player.group);
    this.player = createHumanoid(this.playerLooks());
    this.player.group.userData.persistent = true;
    if (this.world && this.mode === 'play') {
      this.world.scene.add(this.player.group);
      const sp = this.world.spawn;
      this.player.group.position.set(sp.x, 0, sp.z);
      this.player.group.rotation.y = sp.rot;
      this.playerFacing = sp.rot;
    }
  }

  rebuildPreview() {
    if (this.preview?.group?.parent) this.preview.group.parent.remove(this.preview.group);
    this.preview = null;
    if (!this.world || this.worldLayout !== 'creator') return;
    this.preview = createHumanoid(this.playerLooks());
    this.preview.group.userData.persistent = true;
    this.preview.group.position.set(this.world.avatarSpawn.x, 0, this.world.avatarSpawn.z);
    this.preview.group.rotation.y = 0;
    this.world.scene.add(this.preview.group);
  }

  // ── UI: титул и создание ───────────────────────────────────────────────
  showTitle() {
    this.mode = 'title';
    this.paused = false;
    this.clearSequence();
    this.memoryOpen = false;
    document.body.classList.remove('memory-open');
    this.ui.title.classList.remove('hidden');
    this.ui.creator.classList.add('hidden');
    this.ui.ending.classList.add('hidden');
    this.ui.gallery.classList.add('hidden');
    this.ui.hud.classList.add('hidden');
    this.ui.storyUI.classList.add('hidden');
    this.ui.interact.classList.add('hidden');
    this.ui.memory.classList.add('hidden');
    this.ui.pause.classList.add('hidden');
    this.ui.confirm.classList.add('hidden');
    this.ui.chapterCard.classList.add('hidden');
    this.ui.hint.classList.add('hidden');
    this.ui.soundFloat.classList.remove('hidden');
    this.ui.montageBar.classList.add('hidden');
    this.ui.choices.innerHTML = '';
    this.updateTitleUI();
  }

  updateTitleUI() {
    const save = this.readSaveRaw();
    this.hasSave = !!save;
    this.ui.btnContinue.classList.toggle('hidden', !this.hasSave);
    this.ui.galleryCount.textContent = `${this.seen.length}/${ENDING_ORDER.length}`;
    const saveTest = this.tryReadSave();
    if (saveTest) {
      this.ui.btnContinue.innerHTML = '<span class="btn-dot"></span> Продолжить';
    }
  }

  readSaveRaw() {
    try { return localStorage.getItem(SAVE_KEY); } catch { return null; }
  }

  tryReadSave() {
    const raw = this.readSaveRaw();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !NODES[parsed.nodeId]) return null;
      return sanitizeState(parsed);
    } catch { return null; }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      this.hasSave = true;
    } catch { /* noop */ }
  }

  clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
    this.hasSave = false;
  }

  async startNewGame() {
    if (this.transitioning) return;
    this.state = defaultState();
    this.tutorialShown = false;
    this.showCreator();
  }

  async showCreator() {
    this.mode = 'creator';
    this.endingShown = false;
    this.paused = false;
    this.memoryOpen = false;
    document.body.classList.remove('memory-open');
    this.ui.title.classList.add('hidden');
    this.ui.creator.classList.remove('hidden');
    this.ui.ending.classList.add('hidden');
    this.ui.gallery.classList.add('hidden');
    this.ui.hud.classList.add('hidden');
    this.ui.storyUI.classList.add('hidden');
    this.ui.interact.classList.add('hidden');
    this.ui.memory.classList.add('hidden');
    this.ui.pause.classList.add('hidden');
    this.ui.confirm.classList.add('hidden');
    this.ui.chapterCard.classList.add('hidden');
    this.ui.hint.classList.add('hidden');
    this.ui.soundFloat.classList.remove('hidden');
    this.syncCreatorControls();
    this.ui.startBtn.disabled = true;
    await this.loadWorld('creator', { fade: true });
    this.rebuildPreview();
    this.creatorYaw = 0.42;
    this.ui.startBtn.disabled = false;
  }

  backToTitle() {
    if (this.transitioning) return;
    this.showTitle();
    this.loadWorld('title', { fade: true });
  }

  async startStory() {
    if (this.transitioning) return;
    this.clearSave();
    const name = (this.ui.nameInput.value || '').trim().slice(0, 16) || 'Алекс';
    this.state.name = name;
    this.state.nodeId = STORY_START;
    this.state.chapter = { ...NODES[STORY_START].chapter };
    this.state.startedAt = Date.now();
    this.ui.creator.classList.add('hidden');
    this.ui.title.classList.add('hidden');
    this.ui.ending.classList.add('hidden');
    this.ui.gallery.classList.add('hidden');
    this.mode = 'play';
    this.endingShown = false;
    this.ui.soundFloat.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.updateStatsUI();
    this.createPlayer();
    this.audio.select();
    await this.enterNode(STORY_START, { fresh: true });
    this.showHint();
  }

  async continueStory() {
    if (this.transitioning) return;
    const saved = this.tryReadSave();
    if (!saved) {
      this.updateTitleUI();
      return;
    }
    this.state = saved;
    this.mode = 'play';
    this.endingShown = false;
    this.ui.title.classList.add('hidden');
    this.ui.creator.classList.add('hidden');
    this.ui.ending.classList.add('hidden');
    this.ui.gallery.classList.add('hidden');
    this.ui.soundFloat.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.updateStatsUI();
    this.createPlayer();
    this.audio.select();
    await this.enterNode(this.state.nodeId, { fresh: true });
    this.showHint();
  }

  showHint() {
    this.ui.hint.classList.add('hidden');
    if (this.tutorialShown) return;
    this.tutorialShown = true;
    setTimeout(() => {
      if (this.mode === 'play' && !this.endingShown) {
        const touch = matchMedia('(pointer: coarse)').matches;
        this.toast(touch ? 'тап — идти · потяни — камера' : 'WASD — идти · E — осмотреть', { icon: '⌖', timeout: 5200 });
      }
    }, 900);
  }

  buildCreatorControls() {
    this.buildSwatches(this.ui.skinSwatches, SKIN_TONES, 'skin');
    this.buildSwatches(this.ui.hairSwatches, HAIR_COLORS, 'hair');
    this.buildSwatches(this.ui.shirtSwatches, SHIRT_COLORS, 'shirt');
    this.buildSwatches(this.ui.pantsSwatches, PANTS_COLORS, 'pants');
    this.buildDreamCards();
  }

  buildSwatches(container, colors, key) {
    container.innerHTML = '';
    colors.forEach((color, index) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.type = 'button';
      b.style.background = `#${color.toString(16).padStart(6, '0')}`;
      b.dataset.index = String(index);
      b.dataset.kind = key;
      b.title = `Цвет ${index + 1}`;
      b.setAttribute('aria-label', `Цвет ${index + 1}`);
      b.addEventListener('click', () => {
        this.state.looks[key] = index;
        this.audio.click();
        this.syncSwatchActive(container, index);
        this.rebuildPreview();
      });
      container.appendChild(b);
    });
  }

  syncSwatchActive(container, index) {
    [...container.children].forEach((el, i) => el.classList.toggle('active', i === index));
  }

  buildDreamCards() {
    this.ui.dreamCards.innerHTML = '';
    for (const key of DREAM_ORDER) {
      const d = DREAMS[key];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dream-card';
      b.dataset.dream = key;
      const icon = document.createElement('span');
      icon.className = 'dream-icon';
      icon.innerHTML = ICONS[d.icon] || ICONS.arch;
      const text = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'dream-name';
      name.textContent = d.label;
      const desc = document.createElement('span');
      desc.className = 'dream-desc';
      desc.textContent = `${d.desc} · ${d.uni}`;
      text.append(name, desc);
      const check = document.createElement('span');
      check.className = 'dream-check';
      check.textContent = '✓';
      b.append(icon, text, check);
      b.addEventListener('click', () => {
        this.state.dreamKey = key;
        this.audio.click();
        this.syncCreatorControls();
      });
      this.ui.dreamCards.appendChild(b);
    }
  }

  syncCreatorControls() {
    this.ui.nameInput.value = this.state.name === 'Алекс' ? '' : this.state.name;
    if (!this.ui.nameInput.value) this.ui.nameInput.placeholder = 'Как тебя зовут?';
    [...this.ui.genderGroup.children].forEach((el) => el.classList.toggle('active', el.dataset.gender === this.state.gender));
    [...this.ui.hairstyleGroup.children].forEach((el) => el.classList.toggle('active', el.dataset.hair === this.state.looks.hairStyle));
    this.syncSwatchActive(this.ui.skinSwatches, this.state.looks.skin);
    this.syncSwatchActive(this.ui.hairSwatches, this.state.looks.hair);
    this.syncSwatchActive(this.ui.shirtSwatches, this.state.looks.shirt);
    this.syncSwatchActive(this.ui.pantsSwatches, this.state.looks.pants);
    [...this.ui.dreamCards.children].forEach((el) => el.classList.toggle('active', el.dataset.dream === this.state.dreamKey));
  }

  // ── история ────────────────────────────────────────────────────────────
  async enterNode(id, { fresh = false } = {}) {
    const node = NODES[id];
    if (!node) throw new Error(`Неизвестный узел истории: ${id}`);
    this.locked = false;
    this.currentNode = node;
    this.clearSequence();
    this.hideChoices();
    this.closeMemory(true);
    this.hideInteract();
    this.ui.montageBar.classList.add('hidden');
    this.ui.storyUI.classList.remove('montage-mode');
    if (node.chapter) this.state.chapter = { ...node.chapter };
    this.state.nodeId = id;
    this.save();
    this.updateHUD(node);
    this.setStoryVisible(false);
    if (this.worldLayout !== node.layout) {
      await this.loadWorld(node.layout);
    } else {
      // даже в той же локации сбрасываем позицию только при входе в главу
      if (fresh) {
        const sp = this.world.spawn;
        this.player?.group.position.set(sp.x, 0, sp.z);
        this.player?.group.rotation.set(0, sp.rot, 0);
        this.playerFacing = sp.rot;
        this.lookSmooth.set(sp.x, this.cam.targetHeight, sp.z);
      }
    }
    if (this.mode !== 'play') return;
    if (node.chapter) {
      await this.showChapterCard(node.chapter, node.location);
    }
    this.setStoryVisible(true);
    this.ui.dialogueText.textContent = '';
    this.ui.speaker.textContent = '';
    this.ui.dialogueHint.classList.remove('done');
    if (node.lines && node.lines.length) {
      this.startSequence(node.lines, () => this.afterLines(node));
    } else {
      this.afterLines(node);
    }
  }

  updateHUD(node) {
    const ch = this.state.chapter || { n: 1, title: '' };
    this.ui.chapterLabel.textContent = `Глава ${ch.n}`;
    this.ui.chapterTitle.textContent = ch.title || '';
    this.ui.locationLabel.textContent = node.location || '';
    this.ui.objective.textContent = node.objective || '';
    this.ui.hud.classList.remove('hidden');
  }

  afterLines(node) {
    if (this.mode !== 'play') return;
    if (node.type === 'ending') {
      this.finishStory(node);
      return;
    }
    if (node.type === 'montage') {
      this.openMontage(node);
      return;
    }
    if (node.choices && node.choices.length) {
      this.showChoices(node);
      return;
    }
    if (node.next) {
      this.enterNode(node.next);
    }
  }

  setStoryVisible(on) {
    this.ui.storyUI.classList.toggle('hidden', !on);
    if (!on) this.hideInteract();
  }

  // ── последовательности реплик ─────────────────────────────────────────
  startSequence(lines, done) {
    this.clearSequence();
    this.seq = lines.map((l) => lineView(l, this.state));
    this.seqIndex = 0;
    this.seqDone = done;
    this.phase = 'lines';
    this.hideChoices();
    this.ui.choices.innerHTML = '';
    this.ui.montageBar.classList.add('hidden');
    this.ui.storyUI.classList.remove('montage-mode');
    this.ui.storyUI.classList.remove('hidden');
    this.showSeqLine();
  }

  showSeqLine() {
    const line = this.seq?.[this.seqIndex];
    if (!line) return;
    const speaker = this.ui.speaker;
    speaker.textContent = line.who || 'история';
    speaker.dataset.tone = line.who ? line.tone : 'narrator';
    this.typeText(line.text);
    this.ui.dialogueText.scrollTop = 0;
  }

  typeText(text) {
    this.clearTyping();
    const el = this.ui.dialogueText;
    el.textContent = '';
    el.scrollTop = 0;
    const textNode = document.createTextNode('');
    const caret = document.createElement('span');
    caret.className = 'caret';
    el.append(textNode, caret);
    this.ui.dialogueHint.textContent = 'дальше ▸';
    this.ui.dialogueHint.classList.remove('done');
    const typing = { text, index: 0, textNode, caret, timer: null };
    typing.timer = setInterval(() => {
      if (this.paused || this.memoryOpen) return;
      typing.index += 2;
      if (typing.index >= text.length) {
        textNode.nodeValue = text;
        caret.remove();
        clearInterval(typing.timer);
        this.typing = null;
        this.ui.dialogueHint.textContent = 'дальше ▸';
      } else {
        textNode.nodeValue = text.slice(0, typing.index);
      }
    }, 18);
    this.typing = typing;
    if (!text.length) {
      caret.remove();
      clearInterval(typing.timer);
      this.typing = null;
      this.ui.dialogueHint.textContent = 'дальше ▸';
    }
  }

  finishTyping() {
    if (!this.typing) return;
    const t = this.typing;
    clearInterval(t.timer);
    t.textNode.nodeValue = t.text;
    t.caret.remove();
    this.typing = null;
    this.ui.dialogueHint.textContent = 'дальше ▸';
  }

  clearTyping() {
    if (this.typing) {
      clearInterval(this.typing.timer);
      this.typing = null;
    }
  }

  clearSequence() {
    this.clearTyping();
    this.seq = null;
    this.seqIndex = 0;
    this.seqDone = null;
  }

  advance() {
    if (this.mode !== 'play' || this.paused || this.memoryOpen || this.chapterCardOpen) return;
    if (this.typing) {
      this.finishTyping();
      return;
    }
    if (!this.seq) return;
    if (this.seqIndex < this.seq.length - 1) {
      this.seqIndex += 1;
      this.showSeqLine();
      this.audio.advance();
      return;
    }
    const done = this.seqDone;
    this.seq = null;
    this.seqDone = null;
    this.seqIndex = 0;
    if (done) done();
  }

  // ── выборы ────────────────────────────────────────────────────────────
  showChoices(node) {
    this.phase = 'choices';
    this.displayedChoices = node.choices;
    this.ui.choices.innerHTML = '';
    this.ui.montageBar.classList.add('hidden');
    this.ui.dialogueHint.textContent = 'выбери вариант';
    this.ui.dialogueHint.classList.add('done');
    node.choices.forEach((choice, index) => {
      const view = choiceView(choice, this.state);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      const idx = document.createElement('span');
      idx.className = 'choice-index';
      idx.textContent = String(index + 1);
      const main = document.createElement('span');
      main.className = 'choice-text';
      main.append(document.createTextNode(view.text));
      if (view.sub) {
        const sub = document.createElement('span');
        sub.className = 'choice-sub';
        sub.textContent = view.sub;
        main.appendChild(sub);
      }
      const effects = document.createElement('span');
      effects.className = 'choice-effects';
      for (const [key, value] of Object.entries(view.effects)) {
        if (!value) continue;
        effects.appendChild(this.makeEffectChip(key, value));
      }
      button.append(idx, main, effects);
      button.addEventListener('click', () => {
        this.audio.select();
        this.chooseOption(node, choice, index);
      });
      this.ui.choices.appendChild(button);
    });
  }

  makeEffectChip(key, value) {
    const chip = document.createElement('span');
    chip.className = `effect ${value > 0 ? 'pos' : 'neg'}`;
    chip.dataset.stat = key;
    const sign = value > 0 ? '+' : '−';
    chip.textContent = `${sign}${Math.abs(value)} ${STAT_INFO[key]?.short || key}`;
    return chip;
  }

  chooseOption(node, choice, index) {
    if (this.locked || this.phase !== 'choices') return;
    this.locked = true;
    this.displayedChoices = null;
    this.ui.choices.innerHTML = '';
    this.applyEffects(choice.effects || {});
    if (choice.flags) Object.assign(this.state.flags, choice.flags);
    if (choice.set) {
      if (choice.set.fennecName) this.state.fennecName = choice.set.fennecName;
    }
    this.state.nodeId = choice.next;
    this.save();
    this.audio.select();
    this.ui.dialogueHint.textContent = '';
    const reply = choice.reply || [];
    if (reply.length) {
      this.startSequence(reply, () => {
        this.locked = false;
        this.enterNode(choice.next);
      });
    } else {
      setTimeout(() => {
        this.locked = false;
        this.enterNode(choice.next);
      }, 120);
    }
  }

  hideChoices() {
    this.ui.choices.innerHTML = '';
    this.displayedChoices = null;
  }

  // ── монтаж недели ─────────────────────────────────────────────────────
  openMontage(node) {
    this.phase = 'montage';
    this.displayedChoices = null;
    this.montage = { node, selected: new Set(), options: node.montage.options };
    this.ui.choices.innerHTML = '';
    this.ui.dialogueHint.textContent = 'выбери три вечера';
    this.ui.dialogueHint.classList.add('done');
    node.montage.options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice montage-choice';
      btn.dataset.index = String(index);
      const idx = document.createElement('span');
      idx.className = 'choice-index';
      idx.textContent = String(index + 1);
      const main = document.createElement('span');
      main.className = 'choice-text';
      main.append(document.createTextNode(formatText(option.title, this.state)));
      const sub = document.createElement('span');
      sub.className = 'choice-sub';
      sub.textContent = formatText(option.desc, this.state);
      main.appendChild(sub);
      const effects = document.createElement('span');
      effects.className = 'choice-effects';
      for (const [key, value] of Object.entries(option.effects || {})) {
        if (!value) continue;
        effects.appendChild(this.makeEffectChip(key, value));
      }
      btn.append(idx, main, effects);
      btn.addEventListener('click', () => this.toggleMontage(index));
      this.ui.choices.appendChild(btn);
    });
    this.ui.montageBar.classList.remove('hidden');
    this.updateMontageUI();
    this.ui.storyUI.classList.add('montage-mode');
  }

  toggleMontage(index) {
    if (!this.montage || this.montage.locked) return;
    const selected = this.montage.selected;
    if (selected.has(index)) {
      selected.delete(index);
    } else if (selected.size < this.montage.node.picks) {
      selected.add(index);
      this.audio.click();
    }
    this.updateMontageUI();
  }

  updateMontageUI() {
    if (!this.montage) return;
    const { selected, node, options } = this.montage;
    const count = selected.size;
    const picks = node.picks;
    [...this.ui.choices.children].forEach((el, i) => {
      el.classList.toggle('selected', selected.has(i));
    });
    this.ui.montageCounter.textContent = `${count} / ${picks}`;
    this.ui.montageFill.style.width = `${(count / picks) * 100}%`;
    this.ui.montageConfirm.disabled = count !== picks;
  }

  confirmMontage() {
    if (!this.montage) return;
    const { node, selected, options } = this.montage;
    if (selected.size !== node.picks) return;
    this.montage.locked = true;
    this.ui.montageBar.classList.add('hidden');
    this.ui.choices.innerHTML = '';
    this.ui.storyUI.classList.remove('montage-mode');
    const chosen = [...selected].sort((a, b) => a - b).map((i) => options[i]);
    for (const option of chosen) this.applyEffects(option.effects || {});
    this.state.nodeId = node.next;
    this.save();
    this.audio.select();
    const post = [
      { text: 'Неделя заканчивается быстрее, чем ты думаешь.' },
      ...chosen.map((o) => ({ text: o.result })),
    ];
    this.montage = null;
    this.startSequence(post, () => this.enterNode(node.next));
  }

  // ── эффекты и HUD ─────────────────────────────────────────────────────
  applyEffects(effects, { toast = true } = {}) {
    let any = false;
    for (const [key, raw] of Object.entries(effects || {})) {
      if (!STAT_KEYS.includes(key)) continue;
      const delta = Number(raw) || 0;
      if (!delta) continue;
      const before = this.state.stats[key] || 0;
      const after = clamp(before + delta, 0, 99);
      if (after === before) continue;
      this.state.stats[key] = after;
      any = true;
      this.updateStatUI(key, true);
      if (toast) this.toastEffect(key, after - before);
    }
    if (any) this.audio.stat();
    return any;
  }

  renderStatsStructure() {
    this.statEls = {};
    this.ui.stats.innerHTML = '';
    for (const key of STAT_KEYS) {
      const info = STAT_INFO[key];
      const el = document.createElement('div');
      el.className = 'stat';
      el.dataset.stat = key;
      const icon = document.createElement('span');
      icon.className = 'stat-icon';
      icon.innerHTML = ICONS[key];
      const label = document.createElement('span');
      label.className = 'stat-label';
      label.textContent = info.label;
      const value = document.createElement('span');
      value.className = 'stat-val';
      value.textContent = '0';
      el.append(icon, label, value);
      this.ui.stats.appendChild(el);
      this.statEls[key] = { el, value };
    }
  }

  updateStatsUI() {
    for (const key of STAT_KEYS) {
      if (this.statEls?.[key]) this.statEls[key].value.textContent = String(this.state.stats[key] || 0);
    }
  }

  updateStatUI(key, bump = false) {
    const ref = this.statEls?.[key];
    if (!ref) return;
    ref.value.textContent = String(this.state.stats[key] || 0);
    if (bump) {
      ref.el.classList.remove('bump');
      void ref.el.offsetWidth;
      ref.el.classList.add('bump');
      setTimeout(() => ref.el.classList.remove('bump'), 500);
    }
  }

  toast(message, { color = null, icon = '+', timeout = 3300 } = {}) {
    const el = document.createElement('div');
    el.className = 'toast';
    if (color) el.style.borderLeftColor = color;
    const ic = document.createElement('span');
    ic.className = 'toast-icon';
    ic.textContent = icon;
    const txt = document.createElement('span');
    txt.textContent = message;
    el.append(ic, txt);
    this.ui.toasts.appendChild(el);
    while (this.ui.toasts.children.length > 4) this.ui.toasts.firstChild.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 420);
    }, timeout);
  }

  toastEffect(key, delta) {
    const colors = { study: '#8aa8cf', courage: '#f0b45c', family: '#dc8f9d', bond: '#83cbbd' };
    const info = STAT_INFO[key];
    const sign = delta > 0 ? '+' : '−';
    this.toast(`${sign}${Math.abs(delta)} · ${info.short}`, { color: colors[key], icon: delta > 0 ? '+' : '−' });
  }

  // ── главы ─────────────────────────────────────────────────────────────
  async showChapterCard(chapter, location) {
    this.chapterCardOpen = true;
    this.setStoryVisible(false);
    const card = this.ui.chapterCard;
    this.ui.ccNumber.textContent = String(chapter.n);
    this.ui.ccTitle.textContent = chapter.title;
    this.ui.ccSub.textContent = chapter.sub || '';
    this.ui.ccLocation.textContent = location || '';
    card.classList.remove('hidden', 'show', 'leaving');
    void card.offsetWidth;
    card.classList.add('show');
    this.audio.chapter();
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        card.removeEventListener('click', finish);
        this.chapterSkip = null;
        card.classList.add('leaving');
        setTimeout(() => {
          card.classList.add('hidden');
          card.classList.remove('show', 'leaving');
          this.chapterCardOpen = false;
          resolve();
        }, 420);
      };
      const timer = setTimeout(finish, 2800);
      card.addEventListener('click', finish);
      this.chapterSkip = finish;
    });
  }

  // ── взаимодействие ────────────────────────────────────────────────────
  updateInteract() {
    if (this.mode !== 'play' || this.paused || this.memoryOpen || this.chapterCardOpen || this.transitioning || this.endingShown) {
      this.hideInteract();
      return;
    }
    if (!this.player || !this.world) {
      this.hideInteract();
      return;
    }
    const px = this.player.group.position.x;
    const pz = this.player.group.position.z;
    let nearest = null;
    let best = Infinity;
    for (const h of this.world.hotspots) {
      if (this.state.usedHotspots.includes(h.id) || !HOTSPOTS[h.id]) continue;
      const d = Math.hypot(px - h.x, pz - h.z);
      if (d <= h.radius && d < best) {
        best = d;
        nearest = h;
      }
    }
    this.nearHotspot = nearest;
    if (nearest) {
      const def = hotspotView(nearest.id, this.state);
      if (def && this.lastLabel !== def.label) {
        this.ui.interactLabel.textContent = def.label;
        this.lastLabel = def.label;
      }
      this.ui.interact.classList.remove('hidden');
    } else {
      this.hideInteract();
    }
  }

  hideInteract() {
    this.nearHotspot = null;
    this.ui.interact.classList.add('hidden');
  }

  openMemory(id) {
    const def = hotspotView(id, this.state);
    if (!def || this.state.usedHotspots.includes(id)) return;
    this.state.usedHotspots.push(id);
    this.applyEffects(def.effects || {}, { toast: false });
    this.save();
    this.hideMarkers(id);
    this.hideInteract();
    this.memoryOpen = true;
    document.body.classList.add('memory-open');
    this.ui.memoryTitle.textContent = def.title;
    this.ui.memoryBody.innerHTML = '';
    for (const line of def.lines) {
      const p = document.createElement('p');
      p.textContent = line;
      this.ui.memoryBody.appendChild(p);
    }
    this.ui.memoryEffects.innerHTML = '';
    let hasEffects = false;
    for (const [key, value] of Object.entries(def.effects || {})) {
      if (!value) continue;
      this.ui.memoryEffects.appendChild(this.makeEffectChip(key, value));
      hasEffects = true;
    }
    this.ui.memoryEffects.classList.toggle('hidden', !hasEffects);
    this.ui.memory.classList.remove('hidden');
    this.audio.memory();
  }

  closeMemory(silent = false) {
    if (!this.memoryOpen) return;
    this.memoryOpen = false;
    document.body.classList.remove('memory-open');
    this.ui.memory.classList.add('hidden');
    if (!silent) {
      this.audio.click();
      this.updateInteract();
    }
  }

  // ── концовки ──────────────────────────────────────────────────────────
  finishStory(node) {
    const id = resolveEnding(this.state, node.resolve);
    this.endingShown = true;
    this.mode = 'ending';
    this.clearSequence();
    this.hideChoices();
    this.ui.montageBar.classList.add('hidden');
    this.setStoryVisible(false);
    this.hideInteract();
    this.closeMemory(true);
    this.ui.hud.classList.add('hidden');
    this.ui.soundFloat.classList.add('hidden');
    this.audio.ending(ENDINGS[id]?.mood || 'warm');
    this.markSeen(id);
    this.clearSave();
    this.renderEnding(id);
    this.updateTitleUI();
  }

  markSeen(id) {
    if (!this.seen.includes(id)) {
      this.seen.push(id);
      writeSeen(this.seen);
    }
  }

  renderEnding(id) {
    const view = endingView(id, this.state);
    if (!view) return;
    this.ui.endingNumber.textContent = String(ENDING_ORDER.indexOf(id) + 1);
    if (this.ui.endingTotal) this.ui.endingTotal.textContent = String(ENDING_ORDER.length);
    this.ui.endingMood.textContent = MOOD_LABEL[view.mood] || 'своя';
    this.ui.endingTitle.textContent = view.title;
    this.ui.endingTag.textContent = view.tag;
    this.ui.endingBody.innerHTML = '';
    view.body.forEach((paragraph) => {
      const p = document.createElement('p');
      p.textContent = paragraph;
      this.ui.endingBody.appendChild(p);
    });
    this.ui.endingStats.innerHTML = '';
    for (const key of STAT_KEYS) {
      const el = document.createElement('div');
      el.className = 'stat';
      el.dataset.stat = key;
      el.innerHTML = `<span class="stat-icon">${ICONS[key]}</span><span class="stat-label">${STAT_INFO[key].label}</span><span class="stat-val">${this.state.stats[key] || 0}</span>`;
      this.ui.endingStats.appendChild(el);
    }
    this.ui.ending.dataset.mood = view.mood;
    this.ui.ending.classList.remove('hidden');
    this.ui.ending.scrollTop = 0;
    this.updateStatsUI();
  }

  // ── галерея ───────────────────────────────────────────────────────────
  openGallery(from) {
    if (this.transitioning) return;
    this.galleryReturn = from;
    this.galleryOpen = true;
    this.ui.galleryGrid.innerHTML = '';
    for (let i = 0; i < ENDING_ORDER.length; i++) {
      const id = ENDING_ORDER[i];
      const e = ENDINGS[id];
      const unlocked = this.seen.includes(id);
      const card = document.createElement('div');
      card.className = `gallery-card ${unlocked ? 'unlocked' : 'locked'}`;
      card.dataset.mood = e.mood;
      const num = document.createElement('div');
      num.className = 'gallery-num';
      num.textContent = `${String(i + 1).padStart(2, '0')} / ${String(ENDING_ORDER.length).padStart(2, '0')}`;
      const title = document.createElement('h3');
      title.textContent = unlocked ? e.title : '? ? ?';
      const p = document.createElement('p');
      p.textContent = unlocked ? formatText(e.tag, this.state) : 'ещё не открыта — попробуй другой выбор';
      card.append(num, title, p);
      if (!unlocked) {
        const lock = document.createElement('span');
        lock.className = 'gallery-lock';
        lock.textContent = '✦';
        card.appendChild(lock);
      }
      this.ui.galleryGrid.appendChild(card);
    }
    this.ui.galleryProgress.textContent = `${this.seen.length} / ${ENDING_ORDER.length}`;
    this.ui.gallery.classList.remove('hidden');
    this.ui.title.classList.add('hidden');
    this.ui.ending.classList.add('hidden');
    this.ui.soundFloat.classList.add('hidden');
    if (this.hasSave) this.ui.galleryClose.classList.remove('hidden');
  }

  closeGallery() {
    this.galleryOpen = false;
    this.ui.gallery.classList.add('hidden');
    if (this.galleryReturn === 'ending' && this.endingShown) {
      this.ui.ending.classList.remove('hidden');
    } else {
      this.ui.title.classList.remove('hidden');
      this.ui.soundFloat.classList.remove('hidden');
      this.updateTitleUI();
    }
  }

  // ── пауза ─────────────────────────────────────────────────────────────
  openPause() {
    if (this.mode !== 'play' || this.transitioning || this.chapterCardOpen) return;
    if (this.memoryOpen) this.closeMemory(true);
    this.paused = true;
    this.keys = {};
    this.hideInteract();
    this.ui.pause.classList.remove('hidden');
    this.updateSoundUI();
    this.audio.click();
  }

  closePause() {
    this.paused = false;
    this.ui.pause.classList.add('hidden');
  }

  askRestart() {
    this.ui.pause.classList.add('hidden');
    this.ui.confirm.classList.remove('hidden');
  }

  cancelRestart() {
    this.ui.confirm.classList.add('hidden');
    if (this.mode === 'play') this.ui.pause.classList.remove('hidden');
  }

  confirmRestart() {
    this.ui.confirm.classList.add('hidden');
    this.paused = false;
    this.clearSave();
    this.state = defaultState();
    this.startNewGame();
  }

  goToTitleFromPause() {
    this.closePause();
    this.ui.hud.classList.add('hidden');
    this.showTitle();
    this.loadWorld('title', { fade: true });
  }

  // ── звук ──────────────────────────────────────────────────────────────
  toggleSound() {
    this.audio.init();
    const muted = this.audio.toggleMute();
    this.updateSoundUI();
    if (muted) this.toast('Звук выключен', { icon: '×' });
    else this.toast('Звук включён', { icon: '♪' });
  }

  updateSoundUI() {
    const muted = this.audio.muted;
    this.ui.muteBtn.classList.toggle('muted', muted);
    this.ui.muteBtn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
    this.ui.soundFloat.classList.toggle('muted', muted);
    this.ui.soundFloat.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
    this.ui.pauseSound.textContent = muted ? 'Звук: выключен' : 'Звук: включён';
  }

  // ── управление ────────────────────────────────────────────────────────
  bindEvents() {
    document.addEventListener('pointerdown', () => {
      this.audio.init();
    }, { capture: true });

    this.ui.btnNew.addEventListener('click', () => this.startNewGame());
    this.ui.btnContinue.addEventListener('click', () => this.continueStory());
    this.ui.btnGallery.addEventListener('click', () => this.openGallery('title'));
    this.ui.creatorBack.addEventListener('click', () => this.backToTitle());
    this.ui.startBtn.addEventListener('click', () => {
      this.audio.select();
      this.startStory();
    });
    this.ui.nameInput.addEventListener('input', () => {
      this.state.name = this.ui.nameInput.value.slice(0, 16);
    });
    this.ui.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.ui.nameInput.blur();
        this.startStory();
      }
      e.stopPropagation();
    });
    [...this.ui.genderGroup.children].forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.gender = btn.dataset.gender;
        this.audio.click();
        this.syncCreatorControls();
      });
    });
    [...this.ui.hairstyleGroup.children].forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.looks.hairStyle = btn.dataset.hair;
        this.audio.click();
        this.syncCreatorControls();
        this.rebuildPreview();
      });
    });

    this.ui.menuBtn.addEventListener('click', () => this.openPause());
    this.ui.muteBtn.addEventListener('click', () => this.toggleSound());
    this.ui.soundFloat.addEventListener('click', () => this.toggleSound());

    this.ui.dialogue.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (this.mode === 'play' && !this.memoryOpen && !this.paused) this.advance();
    });
    this.ui.interact.addEventListener('click', () => {
      if (this.nearHotspot) this.openMemory(this.nearHotspot.id);
    });
    this.ui.memoryClose.addEventListener('click', () => this.closeMemory());
    this.ui.montageConfirm.addEventListener('click', () => this.confirmMontage());

    this.ui.endingAgain.addEventListener('click', () => {
      this.ui.ending.classList.add('hidden');
      this.endingShown = false;
      this.startNewGame();
    });
    this.ui.endingGallery.addEventListener('click', () => this.openGallery('ending'));
    this.ui.endingTitleBtn.addEventListener('click', () => {
      this.ui.ending.classList.add('hidden');
      this.endingShown = false;
      this.ui.hud.classList.add('hidden');
      this.showTitle();
      this.loadWorld('title', { fade: true });
    });
    this.ui.galleryClose.addEventListener('click', () => this.closeGallery());

    this.ui.pauseResume.addEventListener('click', () => this.closePause());
    this.ui.pauseSound.addEventListener('click', () => this.toggleSound());
    this.ui.pauseMenu.addEventListener('click', () => this.goToTitleFromPause());
    this.ui.pauseRestart.addEventListener('click', () => this.askRestart());
    this.ui.confirmNo.addEventListener('click', () => this.cancelRestart());
    this.ui.confirmYes.addEventListener('click', () => this.confirmRestart());

    this.ui.stage.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.ui.stage.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.ui.stage.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.ui.stage.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    this.ui.stage.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.ui.stage.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => { this.keys = {}; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.keys = {};
    });
  }

  onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.dragging = true;
    this.dragMoved = 0;
    this.pointerId = e.pointerId;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.ui.stage.classList.add('dragging');
    try { this.ui.stage.setPointerCapture(e.pointerId); } catch { /* noop */ }
  }

  onPointerMove(e) {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.dragMoved += Math.abs(dx) + Math.abs(dy);
    this.lastPointer = { x: e.clientX, y: e.clientY };
    if (this.paused || this.memoryOpen || this.chapterCardOpen || this.transitioning) return;
    if (this.mode === 'play' || this.mode === 'ending') {
      const yaw = this.cam.yaw - dx * 0.0052;
      this.cam.yaw = clamp(yaw, this.camBaseYaw - this.camYawLimit, this.camBaseYaw + this.camYawLimit);
      this.cam.pitch = clamp(this.cam.pitch + dy * 0.0035, 0.14, 0.78);
    } else if (this.mode === 'creator') {
      this.creatorYaw += dx * 0.006;
    }
  }

  onPointerUp(e) {
    if (e.pointerId !== this.pointerId) return;
    const wasClick = this.dragMoved < 6;
    this.dragging = false;
    this.pointerId = null;
    this.ui.stage.classList.remove('dragging');
    try { this.ui.stage.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (!wasClick) return;
    if (this.mode !== 'play' || this.paused || this.memoryOpen || this.chapterCardOpen || this.transitioning || this.endingShown) return;
    const rect = this.ui.stage.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const target = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.floorPlane, target)) {
      const b = this.world.bounds;
      this.moveTarget = {
        x: clamp(target.x, b.minX + 0.35, b.maxX - 0.35),
        z: clamp(target.z, b.minZ + 0.35, b.maxZ - 0.35),
      };
      this.keys = {};
    }
  }

  onWheel(e) {
    if (this.mode !== 'play' && this.mode !== 'ending') return;
    e.preventDefault();
    this.cam.dist = clamp(this.cam.dist + Math.sign(e.deltaY) * 0.45, 3.2, 9.4);
  }

  onKeyDown(e) {
    const tag = (e.target?.tagName || '').toLowerCase();
    const isField = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (isField) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      this.handleEscape();
      return;
    }
    if (this.mode === 'play') {
      if (this.chapterCardOpen && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        this.chapterSkip?.();
        return;
      }
      if (this.paused || this.memoryOpen) {
        if (this.memoryOpen && e.code === 'KeyE') {
          e.preventDefault();
          this.closeMemory();
        }
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        if (e.target?.closest && e.target.closest('button')) return;
        e.preventDefault();
        if (!e.repeat) this.advance();
        return;
      }
      if (e.code === 'KeyE' && !e.repeat) {
        if (this.nearHotspot) {
          e.preventDefault();
          this.openMemory(this.nearHotspot.id);
        }
        return;
      }
      if (/^Digit[1-9]$/.test(e.code) && !e.repeat) {
        const index = Number(e.code.slice(5)) - 1;
        if (this.phase === 'montage') {
          if (index < (this.montage?.options.length || 0)) this.toggleMontage(index);
        } else if (this.phase === 'choices' && this.displayedChoices?.[index]) {
          this.audio.select();
          this.chooseOption(this.currentNode, this.displayedChoices[index], index);
        }
        return;
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        this.keys[e.code] = true;
        if (e.code.startsWith('Arrow')) e.preventDefault();
        this.moveTarget = null;
      }
    } else if (this.mode === 'creator') {
      if (e.code === 'Enter' && !e.repeat) {
        e.preventDefault();
        this.startStory();
      }
    }
  }

  onKeyUp(e) {
    this.keys[e.code] = false;
  }

  handleEscape() {
    if (!this.ui.confirm.classList.contains('hidden')) {
      this.cancelRestart();
      return;
    }
    if (this.galleryOpen) {
      this.closeGallery();
      return;
    }
    if (this.paused) {
      this.closePause();
      return;
    }
    if (this.chapterCardOpen) {
      this.chapterSkip?.();
      return;
    }
    if (this.memoryOpen) {
      this.closeMemory();
      return;
    }
    if (this.mode === 'play') {
      this.openPause();
      return;
    }
    if (this.mode === 'creator') {
      this.backToTitle();
    }
  }

  // ── игровой цикл ──────────────────────────────────────────────────────
  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    this.time = t;
    if (!this.paused) this.update(dt, t);
    if (this.world) this.renderer.render(this.world.scene, this.camera);
  }

  update(dt, t) {
    if (!this.world) return;
    const playerPos = this.player?.group.position;
    this.world.update(dt, t, playerPos);
    if (this.mode === 'play' || this.mode === 'ending') {
      this.updatePlayer(dt);
    }
    if (this.mode === 'creator' && this.preview) {
      this.preview.update(dt, t, false, 0);
    }
    this.updateFennec(dt, t);
    this.updateMarkers(dt, t);
    this.updateCamera(dt);
    if (this.mode === 'play') this.updateInteract();
  }

  updatePlayer(dt) {
    if (!this.player || !this.world) return;
    const group = this.player.group;
    const canMove = this.mode === 'play' && !this.paused && !this.memoryOpen
      && !this.chapterCardOpen && !this.transitioning && !this.endingShown;
    let vx = 0;
    let vz = 0;
    let targetSpeed = 0;
    if (canMove) {
      const k = this.keys;
      const forward = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      const strafe = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      if (forward || strafe) {
        const sin = Math.sin(this.cam.yaw);
        const cos = Math.cos(this.cam.yaw);
        vx = -sin * forward + cos * strafe;
        vz = -cos * forward - sin * strafe;
        this.moveTarget = null;
      } else if (this.moveTarget) {
        const dx = this.moveTarget.x - group.position.x;
        const dz = this.moveTarget.z - group.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.12) {
          vx = dx / d;
          vz = dz / d;
        } else {
          this.moveTarget = null;
        }
      }
      const len = Math.hypot(vx, vz);
      if (len > 0.001) {
        vx /= len;
        vz /= len;
        targetSpeed = (k.ShiftLeft || k.ShiftRight) ? 4.1 : 2.75;
      }
    }
    if (targetSpeed > 0) {
      const nx = group.position.x + vx * targetSpeed * dt;
      const nz = group.position.z + vz * targetSpeed * dt;
      if (this.canStand(nx, group.position.z)) group.position.x = nx;
      if (this.canStand(group.position.x, nz)) group.position.z = nz;
      const targetRot = Math.atan2(vx, vz);
      this.playerFacing = dampAngle(this.playerFacing, targetRot, 14, dt);
      group.rotation.y = this.playerFacing;
    }
    this.player.update(dt, this.time, targetSpeed > 0, targetSpeed);
    this.walkPhase = targetSpeed > 0 ? this.walkPhase + dt * 8 : 0;
  }

  canStand(x, z) {
    if (!this.world) return false;
    const r = 0.28;
    const b = this.world.bounds;
    if (x < b.minX + r || x > b.maxX - r || z < b.minZ + r || z > b.maxZ - r) return false;
    for (const o of this.world.obstacles) {
      if (x > o.minX - r && x < o.maxX + r && z > o.minZ - r && z < o.maxZ + r) return false;
    }
    return true;
  }

  updateFennec(dt, t) {
    const f = this.fennec;
    if (!f) return;
    let moving = false;
    let speed = 0;
    if (f.mode === 'follow' && this.player) {
      const px = this.player.group.position.x;
      const pz = this.player.group.position.z;
      const dx = px - f.group.position.x;
      const dz = pz - f.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.55) {
        const sp = Math.min(2.9, 1.4 + (dist - 1.5) * 1.6);
        const step = Math.min(dist - 1.25, sp * dt);
        if (step > 0 && dist > 0.001) {
          f.group.position.x += (dx / dist) * step;
          f.group.position.z += (dz / dist) * step;
          moving = true;
          speed = sp;
          f.group.rotation.y = dampAngle(f.group.rotation.y, Math.atan2(dx, dz), 10, dt);
        }
      } else {
        const look = Math.atan2(dx, dz);
        f.group.rotation.y = dampAngle(f.group.rotation.y, look, 2.5, dt);
      }
      f.group.position.y = 0;
    } else if (f.mode === 'idle' && this.player) {
      const dx = this.player.group.position.x - f.group.position.x;
      const dz = this.player.group.position.z - f.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 8.5) f.group.rotation.y = dampAngle(f.group.rotation.y, Math.atan2(dx, dz), 1.4, dt);
      f.group.position.y = f.baseY;
    } else {
      f.group.position.y = f.baseY;
      if (this.mode === 'title') {
        const dx = this.camera.position.x - f.group.position.x;
        const dz = this.camera.position.z - f.group.position.z;
        f.group.rotation.y = dampAngle(f.group.rotation.y, Math.atan2(dx, dz), 1.8, dt);
      }
    }
    f.model.update(dt, t, moving, speed);
  }

  updateMarkers(dt, t) {
    for (const m of this.markers) {
      if (!m.group.visible) continue;
      m.diamond.position.y = 0.58 + Math.sin(t * 2 + m.phase) * 0.06;
      m.diamond.rotation.y += dt * 1.2;
      const pulse = 0.17 + (Math.sin(t * 2.4 + m.phase) * 0.5 + 0.5) * 0.12;
      m.glow.material.opacity = pulse;
    }
  }

  updateCamera(dt, snap = false) {
    if (!this.world) return;
    if (this.mode === 'title') {
      const angle = 0.35 + Math.sin(this.time * 0.035) * 0.22 + this.time * 0.008;
      const dist = 7.6;
      const center = this.tmpVec.set(-0.85, 1.25, -1.2);
      const px = center.x + Math.sin(angle) * dist;
      const pz = center.z + Math.cos(angle) * dist;
      const py = 2.65 + Math.sin(this.time * 0.15) * 0.08;
      const desired = this.tmpVec2.set(px, py, pz);
      if (snap) this.camera.position.copy(desired);
      else this.camera.position.lerp(desired, 1 - Math.exp(-dt * 2.5));
      this.camera.lookAt(center.x, 1.25, center.z);
      return;
    }
    if (this.mode === 'creator') {
      const narrow = window.innerWidth <= 820;
      const angle = this.creatorYaw + Math.sin(this.time * 0.13) * 0.08;
      const center = this.tmpVec.set(narrow ? 0 : -1.15, narrow ? 0.55 : 1.02, 0.05);
      const dist = narrow ? 5.4 : 4.9;
      const pitch = narrow ? 0.12 : 0.20;
      const desired = this.tmpVec2.set(
        center.x + Math.sin(angle) * dist * Math.cos(pitch),
        center.y + Math.sin(pitch) * dist,
        center.z + Math.cos(angle) * dist * Math.cos(pitch),
      );
      if (snap) this.camera.position.copy(desired);
      else this.camera.position.lerp(desired, 1 - Math.exp(-dt * 5));
      this.camera.lookAt(center.x, center.y, center.z);
      return;
    }
    if (!this.player) return;
    const p = this.player.group.position;
    const target = this.tmpVec.set(p.x, this.cam.targetHeight, p.z);
    const portrait = window.innerWidth / window.innerHeight < 0.75;
    const dist = this.cam.dist * (portrait ? 1.15 : 1);
    const offset = this.tmpVec2.set(
      Math.sin(this.cam.yaw) * Math.cos(this.cam.pitch),
      Math.sin(this.cam.pitch),
      Math.cos(this.cam.yaw) * Math.cos(this.cam.pitch),
    ).multiplyScalar(dist);
    const desired = this.tmpVec3.copy(target).add(offset);
    desired.y = Math.max(0.65, desired.y);
    if (snap) {
      this.camera.position.copy(desired);
      this.lookSmooth.copy(target);
    } else {
      const k = 1 - Math.exp(-dt * 7);
      this.camera.position.lerp(desired, k);
      this.lookSmooth.lerp(target, k);
    }
    this.camera.lookAt(this.lookSmooth);
  }
}

function dampAngle(current, target, smoothing, dt) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-smoothing * dt));
}

let sharedGlow = null;
function makeSharedGlow() {
  if (sharedGlow) return sharedGlow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  sharedGlow = new THREE.CanvasTexture(c);
  sharedGlow.colorSpace = THREE.SRGBColorSpace;
  sharedGlow.userData.shared = true;
  return sharedGlow;
}

function showError(message) {
  const box = $('#error-box');
  if (!box) return;
  box.textContent = `Ошибка: ${message}\nОбнови страницу или напиши мне — починим.`;
  box.classList.remove('hidden');
}

window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
  showError(e.message || 'неизвестная ошибка');
});
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  showError(e.reason?.message || String(e.reason));
});

const game = new Game();
game.boot().catch((err) => {
  console.error(err);
  showError(err?.message || String(err));
  const boot = $('#boot');
  if (boot) boot.style.display = 'none';
});
