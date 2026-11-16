// 3D-сцена: летающий полупрозрачный островок, гриб-табуретка и сам Клод-колобок.
// Всё процедурное, без внешних моделей — только three.js.
import * as THREE from '../../node_modules/three/build/three.module.js';

const C = {
  body: 0xd97757,
  bodyDark: 0xbf5b3a,
  belly: 0xf7dfcc,
  outline: 0x3a1d14,
  eyeWhite: 0xffffff,
  pupil: 0x24130e,
  brow: 0x5c2a1b,
  mouth: 0x5a1c18,
  tongue: 0xef7f86,
  blush: 0xff6f7a,
  heart: 0xff3d6e,
  grass: 0x86cf72,
  grassDark: 0x5fae58,
  rock: 0x9a8576,
  rockDark: 0x6f5d51,
  cap: 0xe9574a,
  capDot: 0xfff4e6,
  stem: 0xf3e3cb,
  trunk: 0x8b5a3b,
  leaves: 0x6cc36f,
  mug: 0xf4f1ea,
  coffee: 0x5b3a26,
};

const R = 0.6; // радиус тела
const BODY_Y = 0.64; // центр тела над точкой опоры
const TAU = Math.PI * 2;

// ---------- утилиты ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const ease = {
  outBack: (k) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2,
  inBack: (k) => 2.70158 * k ** 3 - 1.70158 * k ** 2,
  outCubic: (k) => 1 - (1 - k) ** 3,
  inQuad: (k) => k * k,
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  outElastic: (k) => (k === 0 || k === 1 ? k : 2 ** (-9 * k) * Math.sin((k * 10 - 0.75) * ((2 * Math.PI) / 3.2)) + 1),
};

function makeGradient() {
  const data = new Uint8Array([70, 150, 215, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
const GRADIENT = makeGradient();
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT, ...extra });
const OUTLINE = new THREE.MeshBasicMaterial({ color: C.outline, side: THREE.BackSide });

function outline(mesh, k = 1.05) {
  const o = new THREE.Mesh(mesh.geometry, OUTLINE);
  o.scale.setScalar(k);
  o.userData.isOutline = true;
  mesh.add(o);
  return o;
}

function jitter(geo, amount, seed = 1) {
  const pos = geo.attributes.position;
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647 - 0.5;
  };
  const map = new Map();
  for (let i = 0; i < pos.count; i += 1) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!map.has(key)) map.set(key, [rnd() * amount, rnd() * amount, rnd() * amount]);
    const [dx, dy, dz] = map.get(key);
    pos.setXYZ(i, pos.getX(i) + dx, pos.getY(i) + dy, pos.getZ(i) + dz);
  }
  geo.computeVertexNormals();
  return geo;
}

function flat(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

function canvasTexture(draw, size = 128) {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  draw(cv.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const GLOW_TEX = canvasTexture((g, s) => {
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,190,140,0.9)');
  grd.addColorStop(0.35, 'rgba(240,130,90,0.35)');
  grd.addColorStop(1, 'rgba(240,120,80,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
});
const SPARK_TEX = canvasTexture((g, s) => {
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,220,170,0.8)');
  grd.addColorStop(1, 'rgba(255,200,150,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
}, 64);
const DUST_TEX = canvasTexture((g, s) => {
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,250,240,0.95)');
  grd.addColorStop(1, 'rgba(255,250,240,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
}, 64);

// направление на поверхности сферы: yaw влево-вправо, pitch вверх-вниз
function surfDir(yaw, pitch) {
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
}
function placeOnSurface(obj, yaw, pitch, radius) {
  const d = surfDir(yaw, pitch);
  obj.position.copy(d.clone().multiplyScalar(radius));
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
}

// ---------- эмоции: целевые параметры лица/тела ----------
const FACES = {
  neutral: { eye: 1, shape: 'open', pupil: 1, browY: 0, browA: 0, smile: 0.2, open: 0, width: 1, blush: 0.15 },
  happy: { eye: 0.95, shape: 'open', pupil: 1.05, browY: 0.025, browA: 0.05, smile: 0.85, open: 0.12, width: 1.1, blush: 0.4 },
  laugh: { eye: 1, shape: 'arc', pupil: 1, browY: 0.04, browA: 0.1, smile: 1, open: 0.62, width: 1.15, blush: 0.6, bounce: 1 },
  surprised: { eye: 1.25, shape: 'open', pupil: 0.72, browY: 0.07, browA: 0.12, smile: 0, open: 0.55, width: 0.62, blush: 0.1, round: 1 },
  sad: { eye: 0.8, shape: 'open', pupil: 1.1, browY: 0.0, browA: 0.42, smile: -0.7, open: 0.05, width: 0.85, blush: 0.05, droop: 1 },
  angry: { eye: 0.72, shape: 'open', pupil: 0.9, browY: -0.03, browA: -0.5, smile: -0.45, open: 0.18, width: 0.95, blush: 0.55, shake: 0.4 },
  thinking: { eye: 0.85, shape: 'open', pupil: 1, browY: 0.02, browA: 0.15, browAsym: 0.06, smile: -0.05, open: 0.02, width: 0.7, blush: 0.1, mouthX: 0.06 },
  love: { eye: 1, shape: 'heart', pupil: 1, browY: 0.03, browA: 0.1, smile: 0.8, open: 0.1, width: 1, blush: 0.9 },
  smug: { eye: 0.52, shape: 'open', pupil: 1, browY: 0.01, browA: -0.05, browAsym: 0.07, smile: 0.6, open: 0, width: 1.05, blush: 0.25, mouthX: 0.05 },
  sleepy: { eye: 0.22, shape: 'open', pupil: 1, browY: -0.01, browA: 0.15, smile: 0, open: 0.1, width: 0.6, blush: 0.2, droop: 0.6 },
  sleep: { eye: 0, shape: 'closed', pupil: 1, browY: -0.01, browA: 0.05, smile: 0.1, open: 0.08, width: 0.5, blush: 0.3, droop: 0.4 },
  scared: { eye: 1.22, shape: 'open', pupil: 0.6, browY: 0.06, browA: 0.45, smile: -0.55, open: 0.35, width: 0.9, blush: 0, shake: 1 },
  embarrassed: { eye: 0.85, shape: 'open', pupil: 1, browY: 0.02, browA: 0.3, smile: 0.35, open: 0.05, width: 0.8, blush: 1.1, lookAway: 1 },
  wink: { eye: 1, shape: 'wink', pupil: 1, browY: 0.03, browA: 0.05, smile: 0.8, open: 0.1, width: 1.05, blush: 0.4 },
};

// ---------- сама сцена ----------
export class BuddyScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(20, 1, 0.1, 200);
    this.ppu = 110; // css-пикселей на единицу мира
    this.clock = new THREE.Clock();
    this.time = 0;
    this.anims = [];
    this.raycaster = new THREE.Raycaster();

    // состояние
    this.mode = 'hidden'; // hidden | descending | hanging | dropping | sitting | ascending | peeking
    this.emotion = 'neutral';
    this.emotionUntil = 0;
    this.baseEmotion = 'neutral';
    this.activity = { listening: false, thinking: false, speaking: false, looking: false, sleeping: false };
    this.lip = { open: 0, round: 0 };
    this.micLevel = 0;
    this.gaze = { x: 0, y: 0 }; // -1..1
    this.gazeTarget = { x: 0, y: 0 };
    this.cursor = null;
    this.cursorMovedAt = -10;
    this.screenDir = -1;
    this.nextBlink = 2;
    this.blinkT = -1;
    this.nextGlance = 4;
    this.glance = null;
    this.wave = 0;
    this.pokeT = -10;
    this.face = { ...FACES.neutral, browAsym: 0, mouthX: 0, bounce: 0, shake: 0, droop: 0, round: 0, lookAway: 0 };
    this.mouthKey = '';
    this.threadAttach = null; // мир. точка, куда цепляется нитка (null = нитки нет)
    this.threadTopY = 0;

    this.buildLights();
    this.buildStage();
    this.buildBuddy();
    this.buildThread();
    this.buildFx();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.islandGroup.scale.setScalar(0.0001);
    this.buddy.visible = false;
  }

  // ---------- построение ----------
  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff3e6, 0x6b5a7a, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 6, 8);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffd2b0, 1.2);
    rim.position.set(5, 3, -4);
    this.scene.add(rim);
  }

  buildStage() {
    this.stageRoot = new THREE.Group(); // позиция островка в мире
    this.scene.add(this.stageRoot);
    this.stage = new THREE.Group(); // наклон/покачивание (персонаж живёт здесь)
    this.stage.rotation.x = 0.24; // чуть сверху — видно травку
    this.stageRoot.add(this.stage);
    this.islandGroup = new THREE.Group(); // островок отдельно: его масштабируем при появлении/исчезновении
    this.stage.add(this.islandGroup);

    const island = new THREE.Group();
    this.island = island;
    this.islandGroup.add(island);
    const IR = 1.5;

    const grassGeo = jitter(new THREE.CylinderGeometry(IR, IR * 0.97, 0.22, 30, 1), 0.05, 7);
    const grass = new THREE.Mesh(flat(grassGeo), toon(C.grass, { transparent: true, opacity: 0.93 }));
    grass.position.y = -0.11;
    island.add(grass);

    const dirtGeo = jitter(new THREE.CylinderGeometry(IR * 0.98, IR * 0.9, 0.22, 30, 1), 0.06, 11);
    const dirt = new THREE.Mesh(flat(dirtGeo), toon(0x8a6448, { transparent: true, opacity: 0.88 }));
    dirt.position.y = -0.32;
    island.add(dirt);

    const rockGeo = jitter(new THREE.ConeGeometry(IR * 0.9, 1.9, 10, 4), 0.16, 3);
    rockGeo.rotateX(Math.PI);
    const rock = new THREE.Mesh(flat(rockGeo), toon(C.rock, { transparent: true, opacity: 0.8 }));
    rock.position.y = -0.43 - 0.95;
    island.add(rock);
    const rock2Geo = jitter(new THREE.ConeGeometry(0.42, 0.8, 7, 2), 0.06, 5);
    rock2Geo.rotateX(Math.PI);
    const rock2 = new THREE.Mesh(flat(rock2Geo), toon(C.rockDark, { transparent: true, opacity: 0.8 }));
    rock2.position.set(-0.75, -0.75, 0.3);
    island.add(rock2);

    // гриб-табуретка
    const mush = new THREE.Group();
    mush.position.set(0.25, 0, 0.12);
    island.add(mush);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.46, 18), toon(C.stem));
    stem.position.y = 0.23;
    mush.add(stem);
    const capGeo = new THREE.SphereGeometry(0.56, 28, 14, 0, TAU, 0, Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, toon(C.cap));
    cap.scale.set(1, 0.5, 1);
    cap.position.y = 0.42;
    mush.add(cap);
    const capUnder = new THREE.Mesh(new THREE.CircleGeometry(0.56, 28), toon(0xf1d6b8, { side: THREE.DoubleSide }));
    capUnder.rotation.x = Math.PI / 2;
    capUnder.position.y = 0.42;
    mush.add(capUnder);
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * TAU + 0.4;
      const el = i % 2 ? 0.55 : 0.95;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), toon(C.capDot));
      const d = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      dot.position.set(d.x * 0.56, 0.42 + d.y * 0.28, d.z * 0.56);
      dot.scale.set(1, 0.45, 1);
      dot.lookAt(dot.position.clone().multiplyScalar(2));
      mush.add(dot);
    }
    this.seat = new THREE.Vector3(0.25, 0.66, 0.12);

    // деревце
    const tree = new THREE.Group();
    tree.position.set(-0.95, 0, -0.45);
    island.add(tree);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.8, 8), toon(C.trunk));
    trunk.position.y = 0.4;
    tree.add(trunk);
    [[0, 0.95, 0, 0.38], [0.2, 0.78, 0.1, 0.27], [-0.2, 0.8, -0.05, 0.28], [0.02, 1.22, 0.02, 0.25]].forEach(([x, y, z, r], i) => {
      const leaf = new THREE.Mesh(flat(jitter(new THREE.IcosahedronGeometry(r, 1), 0.04, 20 + i)), toon(i % 2 ? C.leaves : 0x5db463));
      leaf.position.set(x, y, z);
      tree.add(leaf);
    });
    this.tree = tree;

    // цветочки
    const flowerColors = [0xffd34d, 0xff8fb1, 0xffffff, 0xa98bff, 0xff9d4d];
    [[-0.4, 0.75], [0.95, 0.55], [1.1, -0.3], [-1.15, 0.35], [0.7, 0.95], [-0.55, -0.9]].forEach(([x, z], i) => {
      const f = new THREE.Group();
      f.position.set(x, 0, z);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5), toon(C.grassDark));
      st.position.y = 0.08;
      f.add(st);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), toon(flowerColors[i % flowerColors.length]));
      head.position.y = 0.17;
      f.add(head);
      f.userData.phase = i * 1.7;
      island.add(f);
      (this.flowers ||= []).push(f);
    });

    // камушки
    [[1.05, 0.2, 0.12], [-0.25, -1.05, 0.09], [-1.2, -0.25, 0.1]].forEach(([x, z, r], i) => {
      const s = new THREE.Mesh(flat(jitter(new THREE.IcosahedronGeometry(r, 0), 0.02, 40 + i)), toon(0xb8a79a));
      s.position.set(x, r * 0.5, z);
      island.add(s);
    });

    // кружка кофе — он же программист
    const mug = new THREE.Group();
    mug.position.set(0.95, 0, 0.55);
    const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.18, 16), toon(C.mug));
    mugBody.position.y = 0.09;
    mug.add(mugBody);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), toon(C.coffee));
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 0.175;
    mug.add(coffee);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12), toon(C.mug));
    handle.position.set(0.1, 0.09, 0);
    mug.add(handle);
    island.add(mug);
    this.mug = mug;

    // свечение под островком
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
    glow.scale.set(4.2, 3.2, 1);
    glow.position.y = -1.3;
    this.glow = glow;
    this.islandGroup.add(glow);

    // кристаллик-спутник
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), toon(0xffb48a, { emissive: 0x7a2e12, emissiveIntensity: 0.6 }));
    this.crystal = crystal;
    this.islandGroup.add(crystal);

    // хитбокс островка (для клика/перетаскивания)
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(IR, 0.3, 2.3, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = -1.0;
    this.islandHit = hit;
    this.islandGroup.add(hit);
  }

  buildBuddy() {
    const buddy = new THREE.Group(); // точка опоры (низ тела)
    this.buddy = buddy;
    this.stage.add(buddy);
    this.squash = new THREE.Group();
    buddy.add(this.squash);
    this.tilt = new THREE.Group();
    this.squash.add(this.tilt);
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.position.y = BODY_Y;
    this.tilt.add(this.bodyGroup);
    this.shape = new THREE.Group();
    this.shape.scale.set(1, 1.06, 0.94);
    this.bodyGroup.add(this.shape);

    const bodyMat = toon(C.body);
    this.bodyMat = bodyMat;
    const body = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 36), bodyMat);
    outline(body, 1.045);
    this.shape.add(body);
    this.bodyMesh = body;

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 24), toon(C.belly));
    belly.position.set(0, -0.4, 0.3);
    belly.scale.set(0.95, 0.6, 0.66);
    this.shape.add(belly);

    // лицо — отдельная группа: вращаем её, и глаза/рот "скользят" по шару, как поворот головы
    this.faceGroup = new THREE.Group();
    this.shape.add(this.faceGroup);
    this.eyes = [-1, 1].map((side) => this.makeEye(side));
    this.brows = [-1, 1].map((side) => this.makeBrow(side));
    this.makeMouth();
    this.blushes = [-1, 1].map((side) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), new THREE.MeshBasicMaterial({ color: C.blush, transparent: true, opacity: 0, depthWrite: false }));
      placeOnSurface(m, side * 0.55, -0.08, R + 0.006);
      m.scale.set(1.15, 0.65, 1);
      this.faceGroup.add(m);
      return m;
    });

    // корона-искорка
    this.crown = new THREE.Group();
    this.crown.position.y = R * 1.06 - 0.06;
    this.bodyGroup.add(this.crown);
    this.rays = [];
    const rayGeo = new THREE.SphereGeometry(0.06, 14, 10);
    const rayMat = toon(0xe0784f);
    const N = 7;
    for (let i = 0; i < N; i += 1) {
      const a = lerp(-1.15, 1.15, i / (N - 1));
      const pivot = new THREE.Group();
      pivot.rotation.z = a;
      pivot.rotation.x = -0.15;
      const ray = new THREE.Mesh(rayGeo, rayMat);
      const len = i === (N - 1) / 2 ? 2.9 : i % 2 ? 2.2 : 2.6;
      ray.scale.set(0.62, len, 0.62);
      ray.position.y = 0.06 * len * 0.85;
      outline(ray, 1.12);
      pivot.add(ray);
      pivot.userData = { base: a, phase: i * 0.9, len };
      this.crown.add(pivot);
      this.rays.push(pivot);
    }

    // ручки
    this.arms = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.56, -0.02, 0.05);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.2, 4, 10), toon(C.body));
      arm.position.y = -0.15;
      outline(arm, 1.12);
      pivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), toon(C.bodyDark));
      hand.position.y = -0.3;
      outline(hand, 1.12);
      pivot.add(hand);
      pivot.userData = { side, hand };
      this.bodyGroup.add(pivot);
      return pivot;
    });

    // ножки
    this.legs = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.22, 0.16, 0.12);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.12, 4, 10), toon(C.body));
      leg.position.y = -0.12;
      outline(leg, 1.12);
      pivot.add(leg);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), toon(C.bodyDark));
      foot.scale.set(1, 0.7, 1.35);
      foot.position.set(0, -0.23, 0.04);
      outline(foot, 1.1);
      pivot.add(foot);
      pivot.userData = { side };
      this.tilt.add(pivot);
      return pivot;
    });

    // хитбокс персонажа
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.1;
    this.buddyHit = hit;
    this.bodyGroup.add(hit);
  }

  makeEye(side) {
    const g = new THREE.Group();
    placeOnSurface(g, side * 0.34, 0.2, R - 0.035);
    this.faceGroup.add(g);
    const inner = new THREE.Group(); // масштабируем для "широко открытых"
    g.add(inner);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 18), toon(C.eyeWhite));
    white.scale.set(1, 1.22, 0.55);
    outline(white, 1.09);
    inner.add(white);
    const pupilG = new THREE.Group();
    inner.add(pupilG);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.074, 18, 14), new THREE.MeshBasicMaterial({ color: C.pupil }));
    pupil.scale.set(1, 1.15, 0.42);
    pupil.position.z = 0.058;
    pupilG.add(pupil);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.set(0.026, 0.034, 0.09);
    pupilG.add(hl);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl2.position.set(-0.022, -0.028, 0.09);
    pupilG.add(hl2);

    // сердечко вместо зрачка
    const hs = new THREE.Shape();
    hs.moveTo(0, -0.06);
    hs.bezierCurveTo(-0.11, 0.0, -0.06, 0.08, 0, 0.035);
    hs.bezierCurveTo(0.06, 0.08, 0.11, 0.0, 0, -0.06);
    const heart = new THREE.Mesh(new THREE.ShapeGeometry(hs, 12), new THREE.MeshBasicMaterial({ color: C.heart }));
    heart.position.z = 0.074;
    heart.visible = false;
    inner.add(heart);

    // веко: полусфера цвета тела. rotation.x: -PI/2 открыто, 0 полуприкрыто, +PI/2 закрыто
    const lidGeo = new THREE.SphereGeometry(0.13 * 1.07, 24, 12, 0, TAU, 0, Math.PI / 2);
    const lid = new THREE.Mesh(lidGeo, toon(C.body, { side: THREE.DoubleSide }));
    const lidWrap = new THREE.Group();
    lidWrap.scale.set(1.05, 1.22 * 1.05, 0.55 * 1.45);
    lidWrap.add(lid);
    lid.rotation.x = -Math.PI / 2;
    inner.add(lidWrap);

    // дуги ^ ^ (смех) и ‿ ‿ (сон)
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 8, 24, Math.PI), new THREE.MeshBasicMaterial({ color: C.pupil }));
    arc.position.z = 0.06;
    arc.visible = false;
    g.add(arc);

    return { group: g, inner, white, pupilG, heart, lid, arc, side, lidAngle: -Math.PI / 2 };
  }

  makeBrow(side) {
    const pivot = new THREE.Group();
    placeOnSurface(pivot, side * 0.33, 0.47, R + 0.012);
    this.faceGroup.add(pivot);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.12, 4, 8), new THREE.MeshBasicMaterial({ color: C.brow }));
    brow.rotation.z = Math.PI / 2;
    const holder = new THREE.Group();
    holder.add(brow);
    pivot.add(holder);
    return { pivot, holder, side };
  }

  makeMouth() {
    this.mouthMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: C.mouth, side: THREE.DoubleSide }));
    this.tongueMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: C.tongue, side: THREE.DoubleSide }));
    this.mouthLine = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: C.outline, side: THREE.DoubleSide }));
    this.faceGroup.add(this.mouthLine, this.mouthMesh, this.tongueMesh);
    this.mouthPitch = -0.13;
  }

  // 2D-форма -> точки на поверхности шара (рот "обтягивает" тело, а не висит плоской наклейкой)
  wrapShape(shape, lift, segments = 16) {
    const geo = new THREE.ShapeGeometry(shape, segments);
    const pos = geo.attributes.position;
    const d0 = surfDir(0, this.mouthPitch);
    const up = new THREE.Vector3(0, Math.cos(this.mouthPitch), -Math.sin(this.mouthPitch));
    const right = new THREE.Vector3(1, 0, 0);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      v.copy(d0).multiplyScalar(R).addScaledVector(right, pos.getX(i)).addScaledVector(up, pos.getY(i));
      v.normalize().multiplyScalar(R + lift);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    return geo;
  }

  updateMouth(open, smile, width, offsetX) {
    const key = `${open.toFixed(3)}|${smile.toFixed(3)}|${width.toFixed(3)}|${offsetX.toFixed(3)}`;
    if (key === this.mouthKey) return;
    this.mouthKey = key;
    const w = 0.18 * width;
    const cy = smile * 0.055;
    const upper = -smile * 0.012 + open * 0.025;
    let lower = -open * 0.2 - Math.max(0, smile) * 0.07 + Math.min(0, smile) * 0.02;
    lower = Math.min(lower, upper - 0.036);
    const ox = offsetX;
    const mk = (k) => {
      const s = new THREE.Shape();
      s.moveTo(ox - w * k, cy * k);
      s.quadraticCurveTo(ox, upper * k + (1 - k) * 0.0, ox + w * k, cy * k);
      s.quadraticCurveTo(ox, lower * k, ox - w * k, cy * k);
      return s;
    };
    const old = [this.mouthMesh.geometry, this.tongueMesh.geometry, this.mouthLine.geometry];
    this.mouthLine.geometry = this.wrapShape(mk(1.12), 0.003);
    this.mouthMesh.geometry = this.wrapShape(mk(1), 0.006);
    if (open > 0.18) {
      const lowMid = (cy + lower) / 2;
      const ry = Math.min(0.05, open * 0.07);
      const t = new THREE.Shape();
      t.absellipse(ox, lowMid + ry * 0.75, w * 0.5, ry, 0, TAU, false, 0);
      this.tongueMesh.geometry = this.wrapShape(t, 0.008, 12);
      this.tongueMesh.visible = true;
    } else {
      this.tongueMesh.visible = false;
    }
    old.forEach((g) => g.dispose());
  }

  buildThread() {
    const geo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
    geo.translate(0, 0.5, 0);
    this.thread = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    this.thread.visible = false;
    this.scene.add(this.thread);
  }

  buildFx() {
    // искорки вокруг островка
    const n = 26;
    this.sparkles = [];
    for (let i = 0; i < n; i += 1) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPARK_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      s.userData = { a: Math.random() * TAU, r: 1.2 + Math.random() * 1.0, y: -1.6 + Math.random() * 2.6, speed: 0.15 + Math.random() * 0.3, phase: Math.random() * TAU };
      s.scale.setScalar(0.09 + Math.random() * 0.08);
      this.islandGroup.add(s);
      this.sparkles.push(s);
    }
    this.dust = [];
  }

  // ---------- размеры ----------
  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.ppu = 110 * (w / 440);
    const visH = h / this.ppu;
    const dist = visH / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camera.position.set(0, visH / 2, dist);
    this.camera.lookAt(0, visH / 2, 0);
    this.camera.near = dist * 0.3;
    this.camera.far = dist * 3;
    this.camera.updateProjectionMatrix();
    this.visH = visH;
    this.stageRoot.position.set(0.05, 2.75, 0);
    this.threadTopY = visH + 0.5;
  }

  // ---------- маленький движок анимаций ----------
  animate(duration, fn, easing = (k) => k) {
    return new Promise((resolve) => {
      this.anims.push({ t: 0, duration, fn, easing, resolve });
    });
  }
  wait(sec) {
    return this.animate(sec, () => {});
  }

  stageLocal(worldY) {
    // какая высота в системе координат островка соответствует мировой высоте worldY
    this.stage.updateWorldMatrix(true, false);
    const v = new THREE.Vector3(this.seat.x, worldY, this.seat.z);
    // наклон маленький — достаточно сдвига
    return this.stage.worldToLocal(v).y;
  }

  // ---------- сценарии появления ----------
  async showIsland() {
    const from = this.islandGroup.scale.x;
    await this.animate(0.7, (k) => this.islandGroup.scale.setScalar(Math.max(0.0001, lerp(from, 1, k))), ease.outBack);
  }

  async hideIsland() {
    const from = this.islandGroup.scale.x;
    await this.animate(0.45, (k) => this.islandGroup.scale.setScalar(Math.max(0.0001, lerp(from, 0, k))), ease.inBack);
  }

  // спуск на ниточке сверху (островка может ещё не быть)
  async descend(targetY = null, duration = 1.6) {
    this.mode = 'descending';
    this.buddy.visible = true;
    this.buddy.rotation.set(0, 0, 0);
    const topY = this.stageLocal(this.threadTopY + 1.6);
    const hangY = targetY ?? this.seat.y + 1.55;
    this.buddy.position.set(this.seat.x, topY, this.seat.z);
    this.threadOn = true;
    await this.animate(duration, (k) => {
      this.buddy.position.y = lerp(topY, hangY, k);
    }, ease.outElastic);
    this.mode = 'hanging';
  }

  async drop() {
    this.mode = 'dropping';
    const y0 = this.buddy.position.y;
    // ниточка рвётся и улетает вверх
    this.threadOn = false;
    this.threadSnap = 0;
    await this.animate(0.36, (k) => {
      this.buddy.position.y = lerp(y0, this.seat.y, k);
    }, ease.inQuad);
    this.buddy.position.y = this.seat.y;
    this.mode = 'sitting';
    this.impact();
    await this.wait(0.5);
  }

  impact() {
    this.squashT = 0;
    this.stageBumpT = 0;
    this.spawnDust();
  }

  async ascend() {
    this.mode = 'ascending';
    this.threadOn = true;
    // встаём, хватаемся за нитку
    await this.animate(0.35, (k) => {
      this.buddy.position.y = this.seat.y + ease.outBack(k) * 0.25;
    });
    const y0 = this.buddy.position.y;
    const topY = this.stageLocal(this.threadTopY + 2);
    await this.animate(0.7, (k) => {
      this.buddy.position.y = lerp(y0, topY, k);
    }, ease.inBack);
    this.threadOn = false;
    this.buddy.visible = false;
    this.mode = 'hidden';
  }

  // подглядывание, когда спрятан: спуститься до середины, повисеть
  async peekDown() {
    this.mode = 'peeking';
    const midY = this.stageLocal(this.visH * 0.55);
    await this.descend(midY, 1.8);
    this.mode = 'peeking';
  }

  async peekUp() {
    this.mode = 'ascending';
    const y0 = this.buddy.position.y;
    const topY = this.stageLocal(this.threadTopY + 2);
    await this.animate(0.9, (k) => {
      this.buddy.position.y = lerp(y0, topY, k);
    }, ease.inBack);
    this.threadOn = false;
    this.buddy.visible = false;
    this.mode = 'hidden';
  }

  // с середины экрана: нитка рвётся, островок появляется, падаем на гриб
  async dropFromPeek() {
    const showing = this.showIsland();
    await this.wait(0.25);
    await this.drop();
    await showing;
  }

  spawnDust() {
    for (let i = 0; i < 10; i += 1) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: DUST_TEX, transparent: true, depthWrite: false, opacity: 0.9 }));
      const a = (i / 10) * TAU;
      s.position.set(this.seat.x + Math.cos(a) * 0.3, this.seat.y - 0.05, this.seat.z + Math.sin(a) * 0.3);
      s.userData = { vx: Math.cos(a) * 1.4, vz: Math.sin(a) * 0.8, vy: 0.5 + Math.random() * 0.4, life: 0 };
      s.scale.setScalar(0.18);
      this.stage.add(s);
      this.dust.push(s);
    }
  }

  // ---------- реакции ----------
  setEmotion(name, holdSec = 0) {
    if (!FACES[name]) name = 'neutral';
    this.emotion = name;
    this.emotionUntil = holdSec ? this.time + holdSec : 0;
  }

  setBaseEmotion(name) {
    this.baseEmotion = FACES[name] ? name : 'neutral';
  }

  setActivity(patch) {
    Object.assign(this.activity, patch);
  }

  setLip(open, round = 0) {
    this.lip.open = open;
    this.lip.round = round;
  }

  setCursor(x, y, screenDir) {
    const prev = this.cursor;
    this.cursor = { x, y };
    if (!prev || Math.abs(prev.x - x) + Math.abs(prev.y - y) > 3) this.cursorMovedAt = this.time;
    if (screenDir) this.screenDir = screenDir;
  }

  poke() {
    this.pokeT = this.time;
    this.squashT = 0.15;
  }

  waveHello(sec = 1.6) {
    this.wave = sec;
  }

  // ---------- попадание мышью ----------
  hitTest(clientX, clientY) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ndc = new THREE.Vector2((clientX / w) * 2 - 1, -(clientY / h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    if (this.buddy.visible && this.raycaster.intersectObject(this.buddyHit, false).length) return 'buddy';
    if (this.islandGroup.scale.x > 0.5 && this.raycaster.intersectObject(this.islandHit, false).length) return 'island';
    return null;
  }

  // где голова на экране (css px) — для облачка
  headScreen() {
    const v = new THREE.Vector3(0, R * 1.2 + 0.3, 0);
    this.bodyGroup.localToWorld(v);
    v.project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      visible: this.buddy.visible && v.y > -1.2 && v.y < 1.2,
    };
  }

  faceScreen() {
    const v = new THREE.Vector3(0, 0.1, R);
    this.bodyGroup.localToWorld(v);
    v.project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  // ---------- кадр ----------
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    const t = this.time;

    // анимации-обещания
    for (let i = this.anims.length - 1; i >= 0; i -= 1) {
      const a = this.anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.duration);
      a.fn(a.easing(k), k);
      if (k >= 1) {
        this.anims.splice(i, 1);
        a.resolve();
      }
    }

    this.updateStage(dt, t);
    if (this.buddy.visible) this.updateBuddy(dt, t);
    this.updateThread(dt);
    this.updateFx(dt, t);

    this.renderer.render(this.scene, this.camera);
  }

  updateStage(dt, t) {
    // покачивание островка
    let bump = 0;
    if (this.stageBumpT !== undefined && this.stageBumpT < 1.2) {
      this.stageBumpT += dt;
      bump = -Math.exp(-this.stageBumpT * 5) * Math.sin(this.stageBumpT * 16) * 0.12;
    }
    this.stage.position.y = Math.sin(t * 0.9) * 0.06 + bump;
    this.stage.rotation.z = Math.sin(t * 0.6) * 0.015;
    this.glow.material.opacity = 0.4 + Math.sin(t * 1.7) * 0.12;
    this.crystal.position.set(Math.cos(t * 0.7) * 1.9, 0.9 + Math.sin(t * 1.3) * 0.15, Math.sin(t * 0.7) * 0.9);
    this.crystal.rotation.y = t * 1.5;
    this.tree.rotation.z = Math.sin(t * 1.1) * 0.025;
    for (const f of this.flowers) f.rotation.z = Math.sin(t * 1.8 + f.userData.phase) * 0.12;
  }

  computeFace(dt) {
    const a = this.activity;
    let name = this.emotion;
    if (this.emotionUntil && this.time > this.emotionUntil) {
      this.emotion = this.baseEmotion;
      this.emotionUntil = 0;
      name = this.emotion;
    }
    if (a.sleeping) name = 'sleep';
    else if (a.thinking && name === 'neutral') name = 'thinking';
    else if (this.mode === 'hanging' || this.mode === 'peeking') name = this.emotion === 'neutral' ? 'happy' : this.emotion;
    const target = { ...FACES.neutral, browAsym: 0, mouthX: 0, bounce: 0, shake: 0, droop: 0, round: 0, lookAway: 0, ...FACES[name] };
    if (a.listening) {
      target.eye = Math.max(target.eye, 1.12);
      target.browY += 0.03;
    }
    if (a.looking) {
      target.eye = Math.min(target.eye, 0.78);
      target.browA = -0.12;
      target.smile = 0.1;
    }
    const f = this.face;
    const k = 12;
    for (const key of ['eye', 'pupil', 'browY', 'browA', 'browAsym', 'smile', 'open', 'width', 'blush', 'mouthX', 'bounce', 'shake', 'droop', 'round', 'lookAway']) {
      f[key] = damp(f[key], target[key], k, dt);
    }
    f.shape = target.shape;
    return f;
  }

  updateGaze(dt, t) {
    const a = this.activity;
    let gx = 0;
    let gy = 0;
    if (a.looking) {
      gx = this.screenDir * 0.9 + Math.sin(t * 2.4) * 0.35;
      gy = Math.sin(t * 1.3) * 0.25;
    } else if (a.thinking) {
      gx = -0.45;
      gy = 0.6;
    } else if (this.face.lookAway > 0.5) {
      gx = 0.7;
      gy = -0.4;
    } else if (this.cursor && t - this.cursorMovedAt < 2.5 && !a.speaking) {
      const fs = this.faceScreen();
      const dx = this.cursor.x - fs.x;
      const dy = this.cursor.y - fs.y;
      gx = clamp(Math.atan2(dx, 600) / 0.9, -1, 1);
      gy = clamp(-Math.atan2(dy, 600) / 0.9, -1, 1);
    } else if (this.glance && t < this.glance.until) {
      gx = this.glance.x;
      gy = this.glance.y;
    } else if (t > this.nextGlance && !a.speaking) {
      this.glance = { x: (Math.random() - 0.5) * 1.6, y: (Math.random() - 0.3) * 0.8, until: t + 0.8 + Math.random() * 1.2 };
      this.nextGlance = t + 3 + Math.random() * 6;
    }
    if (a.sleeping) {
      gx = 0;
      gy = -0.3;
    }
    this.gaze.x = damp(this.gaze.x, gx, 9, dt);
    this.gaze.y = damp(this.gaze.y, gy, 9, dt);
  }

  updateBuddy(dt, t) {
    const a = this.activity;
    const f = this.computeFace(dt);
    this.updateGaze(dt, t);

    // моргание
    if (t > this.nextBlink && this.blinkT < 0) {
      this.blinkT = 0;
      this.nextBlink = t + 1.8 + Math.random() * 4 + (Math.random() < 0.2 ? -1.4 : 0);
    }
    let blink = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      blink = Math.sin(clamp(this.blinkT / 0.16, 0, 1) * Math.PI);
      if (this.blinkT > 0.16) this.blinkT = -1;
    }

    // лицо поворачивается за взглядом
    const lookYaw = this.gaze.x * 0.42;
    const lookPitch = this.gaze.y * 0.22;
    this.faceGroup.rotation.y = damp(this.faceGroup.rotation.y, lookYaw, 10, dt);
    this.faceGroup.rotation.x = damp(this.faceGroup.rotation.x, -lookPitch, 10, dt);

    // глаза
    const shake = f.shake * Math.sin(t * 40) * 0.006;
    this.eyes.forEach((e) => {
      const wide = f.eye > 1 ? f.eye : 1;
      e.inner.scale.setScalar(damp(e.inner.scale.x, wide, 14, dt));
      let open = clamp(f.eye, 0, 1);
      if (f.shape === 'wink' && e.side === 1) open = 0;
      open = open * (1 - blink);
      const lidTarget = lerp(Math.PI / 2, -Math.PI / 2, open);
      e.lidAngle = lidTarget; // моргание уже сглажено синусом
      e.lid.rotation.x = e.lidAngle;
      const useArc = f.shape === 'arc' || f.shape === 'closed' || (f.shape === 'wink' && e.side === 1);
      e.arc.visible = useArc;
      e.white.visible = !useArc;
      e.pupilG.visible = !useArc && f.shape !== 'heart';
      e.lid.visible = !useArc;
      e.heart.visible = !useArc && f.shape === 'heart';
      e.arc.rotation.z = f.shape === 'arc' || f.shape === 'wink' ? 0 : Math.PI;
      if (e.heart.visible) e.heart.scale.setScalar(1 + Math.sin(t * 8) * 0.12);
      e.pupilG.position.set(this.gaze.x * 0.038 + shake, this.gaze.y * 0.045, 0);
      const ps = f.pupil * (a.listening ? 1.1 : 1);
      e.pupilG.scale.set(ps, ps, 1); // по z не масштабируем, иначе зрачок тонет в белке
    });

    // брови
    this.brows.forEach((b) => {
      const inner = -b.side; // направление к переносице
      b.holder.position.y = f.browY + (b.side === 1 ? f.browAsym : 0) + (a.listening ? 0.02 : 0);
      b.holder.rotation.z = f.browA * inner * 0.9 + Math.sin(t * 3 + b.side) * 0.01;
    });

    // рот: эмоция + липсинк
    const lipOpen = this.lip.open;
    const speakingOpen = a.speaking ? lipOpen : 0;
    const open = clamp(Math.max(f.open, speakingOpen * 0.75 + f.open * 0.4), 0, 1);
    const width = f.width * (1 - this.lip.round * 0.35 * speakingOpen) * (1 - f.round * 0.15);
    const smile = f.smile * (1 - speakingOpen * 0.35);
    this.updateMouth(open, smile, width, f.mouthX);

    this.blushes.forEach((bl) => {
      bl.material.opacity = clamp(f.blush, 0, 1) * 0.55;
    });

    // корона-искорка: пружинит, реагирует на голос и микрофон
    const energy = a.speaking ? lipOpen : 0;
    this.rays.forEach((p, i) => {
      const u = p.userData;
      const wob = Math.sin(t * 2.2 + u.phase) * 0.05 + (f.bounce ? Math.sin(t * 18 + i) * 0.08 : 0);
      p.rotation.z = u.base * (1 + this.micLevel * 0.25 + energy * 0.06) + wob;
      const s = 1 + this.micLevel * 0.35 + energy * 0.08 + (f.droop ? -0.18 * f.droop : 0);
      p.scale.setScalar(damp(p.scale.x, s, 12, dt));
    });

    // тело: дыхание, позы
    const breathe = Math.sin(t * 2.1) * 0.018 * (a.sleeping ? 2 : 1);
    let sy = 1 + breathe;
    let sx = 1 - breathe * 0.6;
    if (this.squashT !== undefined && this.squashT < 0.9) {
      this.squashT += dt;
      const q = Math.exp(-this.squashT * 6) * Math.cos(this.squashT * 18);
      sy -= q * 0.38;
      sx += q * 0.26;
    }
    if (f.bounce > 0.1) {
      const b = Math.abs(Math.sin(t * 14)) * 0.06 * f.bounce;
      sy += b;
      sx -= b * 0.5;
    }
    if (a.speaking) sy += energy * 0.03;
    this.squash.scale.set(sx, sy, sx);

    let leanX = 0;
    let turnY = 0;
    let rollZ = Math.sin(t * 0.8) * 0.02;
    if (a.listening) leanX = 0.16;
    if (a.looking) turnY = this.screenDir * 0.55;
    if (a.sleeping) {
      leanX = 0.12;
      rollZ = 0.18 + Math.sin(t * 0.7) * 0.03;
    }
    if (f.droop) leanX += 0.08 * f.droop;
    if (a.thinking) rollZ += 0.08;
    rollZ += f.shake * Math.sin(t * 34) * 0.025;
    if (t - this.pokeT < 0.6) rollZ += Math.sin((t - this.pokeT) * 30) * 0.12 * (1 - (t - this.pokeT) / 0.6);
    const hanging = this.mode === 'hanging' || this.mode === 'descending' || this.mode === 'peeking' || this.mode === 'ascending';
    if (hanging) rollZ += Math.sin(t * 2.4) * 0.12;
    this.tilt.rotation.x = damp(this.tilt.rotation.x, leanX, 6, dt);
    this.tilt.rotation.y = damp(this.tilt.rotation.y, turnY, 5, dt);
    this.tilt.rotation.z = damp(this.tilt.rotation.z, rollZ, 8, dt);

    // руки
    const seated = this.mode === 'sitting' || this.mode === 'dropping';
    this.arms.forEach((arm) => {
      const s = arm.userData.side;
      let z = s * 0.38 + Math.sin(t * 2.1 + s) * 0.04;
      let x = 0;
      if (hanging && s === 1) {
        z = Math.PI * 0.92; // держится за нитку
      } else if (hanging) {
        z = -0.9 + Math.sin(t * 7) * 0.5; // машет
      } else if (this.wave > 0 && s === 1) {
        z = 2.4 + Math.sin(t * 14) * 0.4;
      } else if (a.thinking && s === -1) {
        z = -2.3 + Math.sin(t * 9) * 0.12; // чешет репу
      } else if (f.bounce > 0.3) {
        z = s * (0.9 + Math.sin(t * 14) * 0.25);
      } else if (a.speaking) {
        z = s * (0.45 + energy * 0.35) + Math.sin(t * 3.1 + s * 2) * 0.12;
        x = -0.25 * energy;
      } else if (a.listening) {
        z = s * 0.25;
        x = -0.35;
      } else if (f.droop > 0.5) {
        z = s * 0.15;
      }
      if (this.mode === 'dropping') z = s * 2.6;
      arm.rotation.z = damp(arm.rotation.z, z, 10, dt);
      arm.rotation.x = damp(arm.rotation.x, x, 10, dt);
    });
    if (this.wave > 0) this.wave -= dt;

    // ножки
    this.legs.forEach((leg) => {
      const s = leg.userData.side;
      let x = 0;
      if (seated) x = -1.35 + Math.sin(t * 2.6 + (s > 0 ? 0 : Math.PI)) * (a.sleeping ? 0.03 : 0.22);
      else if (hanging) x = Math.sin(t * 3.4 + s) * 0.35;
      leg.rotation.x = damp(leg.rotation.x, x, 10, dt);
      leg.rotation.z = damp(leg.rotation.z, hanging ? -s * 0.15 : 0, 8, dt);
    });

    // на грибе чуть подпрыгиваем, когда смеёмся
    if (seated && this.mode === 'sitting') {
      this.buddy.position.y = this.seat.y + (f.bounce > 0.1 ? Math.abs(Math.sin(t * 14)) * 0.05 * f.bounce : 0);
    }
  }

  updateThread(dt) {
    const th = this.thread;
    let attach = null;
    if (this.buddy.visible && this.threadOn) {
      const hand = this.arms[1].userData.hand;
      attach = new THREE.Vector3();
      hand.getWorldPosition(attach);
      this.threadSnap = undefined;
    }
    if (attach) {
      th.visible = true;
      th.position.copy(attach);
      th.scale.set(1, Math.max(0.01, this.threadTopY + 2 - attach.y), 1);
      th.rotation.set(0, 0, 0);
      this.lastAttach = attach;
    } else if (this.threadSnap !== undefined && this.lastAttach) {
      // оборванная нитка улетает вверх
      this.threadSnap += dt;
      const y = this.lastAttach.y + this.threadSnap * this.threadSnap * 60;
      th.position.set(this.lastAttach.x, y, this.lastAttach.z);
      th.scale.set(1, Math.max(0.01, this.threadTopY + 2 - y), 1);
      th.rotation.z = Math.sin(this.threadSnap * 30) * 0.05;
      th.visible = y < this.threadTopY + 2;
      if (!th.visible) this.threadSnap = undefined;
    } else {
      th.visible = false;
    }
  }

  updateFx(dt, t) {
    const vis = this.islandGroup.scale.x > 0.3;
    for (const s of this.sparkles) {
      const u = s.userData;
      u.a += u.speed * dt * 0.5;
      u.y += u.speed * dt * 0.4;
      if (u.y > 1.4) u.y = -1.8;
      s.position.set(Math.cos(u.a) * u.r, u.y, Math.sin(u.a) * u.r * 0.6);
      const fade = clamp(1 - Math.abs(u.y + 0.2) / 1.6, 0, 1);
      s.material.opacity = vis ? fade * (0.5 + Math.sin(t * 3 + u.phase) * 0.35) : 0;
    }
    for (let i = this.dust.length - 1; i >= 0; i -= 1) {
      const s = this.dust[i];
      const u = s.userData;
      u.life += dt;
      s.position.x += u.vx * dt;
      s.position.z += u.vz * dt;
      s.position.y += u.vy * dt;
      u.vx *= 0.92;
      u.vz *= 0.92;
      u.vy *= 0.9;
      s.scale.setScalar(0.18 + u.life * 0.6);
      s.material.opacity = Math.max(0, 0.9 - u.life * 1.6);
      if (u.life > 0.6) {
        this.stage.remove(s);
        s.material.dispose();
        this.dust.splice(i, 1);
      }
    }
  }
}
