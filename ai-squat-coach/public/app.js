import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

const LM = {
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
};

const PHASE_KEYS = {
  standing: 'phaseStanding',
  descending: 'phaseDescending',
  bottom: 'phaseBottom',
  ascending: 'phaseAscending',
};

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlayMsg = document.getElementById('overlay-msg');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const muteToggle = document.getElementById('mute-toggle');
const cameraSelect = document.getElementById('camera-select');
const cueBanner = document.getElementById('cue-banner');
const debugLine = document.getElementById('debug-line');
const valReps = document.getElementById('val-reps');
const valPhase = document.getElementById('val-phase');

let poseLandmarker = null;
let drawingUtils = null;
let running = false;
let rafId = null;
let stream = null;

/* ── Geometry helpers ── */

function angleBetween(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return 180;
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function torsoAngleFromVertical(shoulder, hip) {
  const v = { x: shoulder.x - hip.x, y: shoulder.y - hip.y };
  const mag = Math.hypot(v.x, v.y) || 1;
  const cos = Math.min(1, Math.max(-1, -v.y / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

function pickSide(lm) {
  const leftVis = (lm[LM.L_HIP].visibility + lm[LM.L_KNEE].visibility + lm[LM.L_ANKLE].visibility + lm[LM.L_SHOULDER].visibility) / 4;
  const rightVis = (lm[LM.R_HIP].visibility + lm[LM.R_KNEE].visibility + lm[LM.R_ANKLE].visibility + lm[LM.R_SHOULDER].visibility) / 4;
  return leftVis >= rightVis ? 'L' : 'R';
}

/* ── Squat state machine ── */

const coach = {
  phase: 'standing',
  repCount: 0,
  minKneeAngle: 180,
  maxTorsoAngle: 0,
  descentStart: 0,
  bottomTime: 0,
  ascentStart: 0,
  lastUrgentCueAt: 0,

  reset() {
    this.phase = 'standing';
    this.repCount = 0;
    this.minKneeAngle = 180;
    this.maxTorsoAngle = 0;
    this.lastUrgentCueAt = 0;
  },

  update(landmarks, now) {
    const side = pickSide(landmarks);
    const hip = landmarks[LM[`${side}_HIP`]];
    const knee = landmarks[LM[`${side}_KNEE`]];
    const ankle = landmarks[LM[`${side}_ANKLE`]];
    const shoulder = landmarks[LM[`${side}_SHOULDER`]];
    if ([hip, knee, ankle, shoulder].some((p) => !p || (p.visibility ?? 1) < 0.4)) {
      return { visible: false };
    }

    const kneeAngle = angleBetween(hip, knee, ankle);
    const torsoAngle = torsoAngleFromVertical(shoulder, hip);
    const events = [];

    if (this.phase === 'standing' && kneeAngle < 150) {
      this.phase = 'descending';
      this.descentStart = now;
      this.minKneeAngle = kneeAngle;
      this.maxTorsoAngle = torsoAngle;
    } else if (this.phase === 'descending' || this.phase === 'bottom') {
      this.minKneeAngle = Math.min(this.minKneeAngle, kneeAngle);
      this.maxTorsoAngle = Math.max(this.maxTorsoAngle, torsoAngle);

      if (torsoAngle > 55 && now - this.lastUrgentCueAt > 2500) {
        events.push({ type: 'urgent', key: 'cueStraightenBackUrgent' });
        this.lastUrgentCueAt = now;
      }

      if (this.phase === 'descending' && kneeAngle < 110) {
        this.phase = 'bottom';
        this.bottomTime = now;
      } else if (this.phase === 'bottom' && kneeAngle > this.minKneeAngle + 8) {
        this.phase = 'ascending';
        this.ascentStart = now;
      }
    } else if (this.phase === 'ascending') {
      this.maxTorsoAngle = Math.max(this.maxTorsoAngle, torsoAngle);

      if (kneeAngle > 160) {
        const descentDur = (this.bottomTime - this.descentStart) / 1000;
        const ascentDur = (now - this.ascentStart) / 1000;
        this.repCount += 1;
        this.phase = 'standing';

        let repKey = 'cueGoodRep';
        if (this.minKneeAngle > 110) {
          repKey = 'cueGoDeeper';
        } else if (this.maxTorsoAngle > 45) {
          repKey = 'cueStraightenBack';
        } else if (descentDur > 0 && descentDur < 0.35) {
          repKey = 'cueSlowerDown';
        } else if (ascentDur > 0 && ascentDur < 0.3) {
          repKey = 'cueControlledUp';
        } else if (this.minKneeAngle < 95) {
          repKey = 'cueGreatDepth';
        }
        events.push({ type: 'rep', key: repKey });

        this.minKneeAngle = 180;
        this.maxTorsoAngle = 0;
      }
    }

    return { visible: true, phase: this.phase, kneeAngle, torsoAngle, repCount: this.repCount, events };
  },
};

/* ── Speech ── */

function speak(text, { urgent = false } = {}) {
  if (muteToggle.checked || !('speechSynthesis' in window)) return;
  if (urgent) window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = SPEECH_LANG[currentLang] || 'en-US';
  utter.rate = 1.05;
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find((v) => v.lang && v.lang.startsWith(utter.lang.split('-')[0]));
  if (match) utter.voice = match;
  window.speechSynthesis.speak(utter);
}

function handleEvents(events) {
  for (const ev of events) {
    const text = t(ev.key);
    cueBanner.textContent = text;
    cueBanner.classList.remove('flash');
    requestAnimationFrame(() => cueBanner.classList.add('flash'));
    speak(text, { urgent: ev.type === 'urgent' });
  }
}

/* ── Rendering ── */

function drawSkeleton(landmarks) {
  drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: '#3ecfb2', lineWidth: 3 });
  drawingUtils.drawLandmarks(landmarks, { color: '#f5a623', radius: 3 });
}

function updateHud(state) {
  valReps.textContent = String(state.repCount);
  valPhase.textContent = t(PHASE_KEYS[state.phase] || 'phaseStanding');
  if (state.kneeAngle !== undefined) {
    debugLine.textContent = `knee ${Math.round(state.kneeAngle)}°  torso ${Math.round(state.torsoAngle)}°`;
  }
}

function renderLoop() {
  if (!running) return;
  const now = performance.now();

  if (video.readyState >= 2) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const result = poseLandmarker.detectForVideo(video, now);
    const landmarks = result.landmarks && result.landmarks[0];

    if (landmarks) {
      drawSkeleton(landmarks);
      const state = coach.update(landmarks, now);
      ctx.restore();
      if (state.visible) {
        updateHud(state);
        handleEvents(state.events || []);
        overlayMsg.style.display = 'none';
      } else {
        overlayMsg.textContent = t('overlayNoPerson');
        overlayMsg.style.display = 'flex';
      }
    } else {
      ctx.restore();
      overlayMsg.textContent = t('overlayNoPerson');
      overlayMsg.style.display = 'flex';
    }
  }

  rafId = requestAnimationFrame(renderLoop);
}

/* ── Camera + model lifecycle ── */

async function initPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
  drawingUtils = new DrawingUtils(ctx);
  return landmarker;
}

async function startCamera(facingMode) {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((tr) => tr.stop());
    stream = null;
  }
}

startBtn.onclick = async () => {
  startBtn.disabled = true;
  try {
    overlayMsg.textContent = t('overlayRequestingCamera');
    overlayMsg.style.display = 'flex';
    await startCamera(cameraSelect.value);

    if (!poseLandmarker) {
      overlayMsg.textContent = t('overlayLoadingModel');
      poseLandmarker = await initPoseLandmarker();
    }

    coach.reset();
    running = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    overlayMsg.style.display = 'none';
    renderLoop();
  } catch (err) {
    overlayMsg.textContent = `${t('errCameraDenied')}: ${err.message}`;
    overlayMsg.style.display = 'flex';
  } finally {
    startBtn.disabled = false;
  }
};

stopBtn.onclick = () => {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  stopCamera();
  startBtn.style.display = 'block';
  stopBtn.style.display = 'none';
};

/* ── i18n wiring ── */

function renderTexts() {
  document.getElementById('subtitle').textContent = t('subtitle');
  document.getElementById('label-reps').textContent = t('repsLabel');
  document.getElementById('label-phase').textContent = t('phaseLabel');
  document.getElementById('label-mute').textContent = t('muteLabel');
  document.getElementById('hint-text').textContent = t('hintText');
  document.getElementById('privacy-note').textContent = t('privacyNote');
  startBtn.textContent = t('startBtn');
  stopBtn.textContent = t('stopBtn');

  const camSel = cameraSelect.value;
  cameraSelect.innerHTML = `
    <option value="environment">${t('cameraBack')}</option>
    <option value="user">${t('cameraFront')}</option>
  `;
  cameraSelect.value = camSel || 'environment';
}

function renderLangSelect() {
  const sel = document.getElementById('lang-select');
  sel.innerHTML = Object.keys(I18N).map((l) => `<option value="${l}" ${l === currentLang ? 'selected' : ''}>${I18N[l].langName}</option>`).join('');
  sel.onchange = (e) => setLang(e.target.value);
}

function onLangChange() {
  document.documentElement.lang = currentLang;
  renderTexts();
}
window.onLangChange = onLangChange;

renderLangSelect();
renderTexts();
