import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.152.2/examples/jsm/controls/OrbitControls.js';

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
const video = document.getElementById('video');
const statusText = document.getElementById('status');
const messageText = document.getElementById('message');
const jokeBubble = document.getElementById('jokeBubble');
const startBtn = document.getElementById('startBtn');

window.addEventListener('error', (event) => {
  statusText.textContent = `Error: ${event.message}. Check console for details.`;
  console.error('Runtime error:', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  statusText.textContent = `Promise error: ${event.reason?.message || event.reason}`;
  console.error('Unhandled rejection:', event.reason);
});

const jokes = [
  'Why did the robot go on a diet? Because it had too many bytes!',
  'Why did the scarecrow win an award? Because he was outstanding in his field!',
  'What do you call a dancing computer? The Disk-o!',
  'Why was the math book sad? Too many problems!',
  'Why don’t scientists trust atoms? Because they make up everything!'
];
let scene, camera, renderer, controls;
let bobo, head, leftArm, rightArm, leftLeg, rightLeg, tears = [];
let currentMood = 'waiting';
let lastJokeIndex = -1;
let danceTimer = 0;

startBtn.disabled = false;
startBtn.textContent = 'Start Bobo';

if (window.location.protocol === 'file:') {
  statusText.textContent = 'The page is running from file://. Use a local server and open http://localhost:8000 instead.';
}

startBtn.addEventListener('click', () => {
  if (window.location.protocol === 'file:') {
    statusText.textContent = 'Please run the app from a local server and open http://localhost:8000.';
    return;
  }
  startBtn.disabled = true;
  startBtn.textContent = 'Starting Bobo...';
  initializeApp();
});

async function initializeApp() {
  if (window.location.protocol === 'file:') {
    statusText.textContent = 'Please open this page from a local server, not file://. See README for instructions.';
    startBtn.disabled = false;
    startBtn.textContent = 'Retry Start';
    return;
  }

  try {
    await loadFaceModels();
    setupScene();
    buildBobo();
    await startWebcam();
    animate();
    detectMoodLoop();
  } catch (error) {
    statusText.textContent = 'Oops! Something went wrong while starting Bobo. Check the console for details.';
    console.error('Initialization error:', error);
    startBtn.disabled = false;
    startBtn.textContent = 'Retry Start';
  }
}

async function loadFaceModels() {
  statusText.textContent = 'Loading emotion models...';
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    statusText.textContent = 'Models ready. Requesting webcam permission...';
  } catch (error) {
    statusText.textContent = 'Unable to load face models. Run via localhost and allow network access.';
    console.error('Model load error:', error);
    throw error;
  }
}

async function startWebcam() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Webcam API not supported in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    video.playsInline = true;
    await video.play();
    statusText.textContent = 'Webcam on. Bobo is watching!';
  } catch (error) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      statusText.textContent = 'Camera permission denied. Please allow camera access and retry.';
    } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
      statusText.textContent = 'No webcam found. Please connect a camera and retry.';
    } else {
      statusText.textContent = 'Unable to access webcam. Use a secure local server or supported browser.';
    }
    console.error('Webcam start error:', error);
    startBtn.disabled = false;
    startBtn.textContent = 'Retry Start';
    throw error;
  }
}

function setupScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0f172a, 0.04);
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 2.8, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth * 0.6, window.innerHeight);
  document.getElementById('scene-container').appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.minDistance = 3;
  controls.maxDistance = 7;

  const light = new THREE.HemisphereLight(0xffffff, 0x4b5563, 1.2);
  const dirLight = new THREE.DirectionalLight(0x93c5fd, 0.7);
  dirLight.position.set(5, 10, 5);
  scene.add(light, dirLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9, metalness: 0.1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.45;
  scene.add(ground);

  window.addEventListener('resize', onWindowResize);
}

function buildBobo() {
  const material = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4, metalness: 0.2 });
  const faceMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.1 });

  bobo = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.8), material);
  body.position.y = 0.1;
  bobo.add(body);

  head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), faceMaterial);
  head.position.set(0, 1.3, 0);
  bobo.add(head);

  const eyeGeometry = new THREE.SphereGeometry(0.08, 16, 16);
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a });
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  const rightEye = leftEye.clone();
  leftEye.position.set(-0.18, 1.35, 0.45);
  rightEye.position.set(0.18, 1.35, 0.45);
  bobo.add(leftEye, rightEye);

  leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.0, 0.25), material);
  leftArm.position.set(-0.85, 0.1, 0);
  leftArm.rotation.z = 0.1;
  bobo.add(leftArm);

  rightArm = leftArm.clone();
  rightArm.position.set(0.85, 0.1, 0);
  rightArm.rotation.z = -0.1;
  bobo.add(rightArm);

  leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.1, 0.28), material);
  leftLeg.position.set(-0.32, -1.1, 0);
  bobo.add(leftLeg);

  rightLeg = leftLeg.clone();
  rightLeg.position.set(0.32, -1.1, 0);
  bobo.add(rightLeg);

  scene.add(bobo);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth * 0.6, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  updateBoboAnimation();
  controls.update();
  renderer.render(scene, camera);
}

function updateBoboAnimation() {
  danceTimer += 0.03;

  if (currentMood === 'happy') {
    bobo.rotation.y = Math.sin(danceTimer * 1.4) * 0.14;
    head.rotation.z = Math.sin(danceTimer * 1.8) * 0.06;
    leftArm.rotation.z = Math.sin(danceTimer * 1.8) * 0.8 - 0.5;
    rightArm.rotation.z = Math.cos(danceTimer * 1.8) * -0.8 + 0.5;
    leftLeg.rotation.x = Math.sin(danceTimer * 1.4) * 0.4;
    rightLeg.rotation.x = Math.cos(danceTimer * 1.4) * 0.4;
    clearTears();
  } else if (currentMood === 'sad') {
    bobo.rotation.y = 0;
    head.rotation.z = 0.15;
    head.position.y = 1.2;
    leftArm.rotation.z = -1.2;
    rightArm.rotation.z = 1.2;
    leftLeg.rotation.x = -0.15;
    rightLeg.rotation.x = -0.15;
    createTears();
  } else {
    bobo.rotation.y = Math.sin(danceTimer * 0.5) * 0.05;
    head.rotation.z = Math.sin(danceTimer * 0.6) * 0.03;
    leftArm.rotation.z = -0.3;
    rightArm.rotation.z = 0.3;
    leftLeg.rotation.x = 0;
    rightLeg.rotation.x = 0;
    clearTears();
  }
}

function createTears() {
  if (tears.length > 3) return;
  const tearMaterial = new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.85 });
  const tear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), tearMaterial);
  tear.position.set(0.28, 1.2 - tears.length * 0.16, 0.48);
  scene.add(tear);
  tears.push(tear);
}

function clearTears() {
  tears.forEach((tear) => scene.remove(tear));
  tears = [];
  head.position.y = 1.3;
}

async function detectMoodLoop() {
  if (!video || video.readyState < 2) {
    setTimeout(detectMoodLoop, 500);
    return;
  }

  try {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    if (detection && detection.expressions) {
      const expressions = detection.expressions;
      const mood = determineMood(expressions);
      setMood(mood);
    }
  } catch (err) {
    console.error('Face detection error:', err);
  }

  setTimeout(detectMoodLoop, 700);
}

function determineMood(expressions) {
  const happy = expressions.happy ?? 0;
  const sad = expressions.sad ?? 0;
  const neutral = expressions.neutral ?? 0;
  const angry = expressions.angry ?? 0;
  const surprised = expressions.surprised ?? 0;

  if (happy > 0.5 || surprised > 0.65) {
    return 'happy';
  }
  if (sad > 0.45 || angry > 0.4) {
    return 'sad';
  }
  if (neutral > 0.45) {
    return 'neutral';
  }
  return currentMood === 'happy' ? 'happy' : currentMood === 'sad' ? 'sad' : 'neutral';
}

function setMood(newMood) {
  if (newMood === currentMood) return;
  currentMood = newMood;
  if (newMood === 'happy') {
    statusText.textContent = 'You look happy! Bobo is dancing for you.';
    messageText.textContent = 'Bobo loves your smile. Keep enjoying the music!';
    jokeBubble.classList.add('hidden');
  } else if (newMood === 'sad') {
    statusText.textContent = 'You look sad. Bobo will sit and cry with you.';
    messageText.textContent = 'I am here for you. Bobo wants to cheer you up!';
    showJokeAfterDelay(3000);
  } else {
    statusText.textContent = 'You look neutral. Bobo is thinking of a joke.';
    messageText.textContent = 'Let me make you laugh!';
    showJoke();
  }
}

function showJoke() {
  jokeBubble.textContent = getNextJoke();
  jokeBubble.classList.remove('hidden');
}

function showJokeAfterDelay(ms) {
  jokeBubble.classList.add('hidden');
  setTimeout(() => {
    if (currentMood === 'sad') {
      showJoke();
    }
  }, ms);
}

function getNextJoke() {
  lastJokeIndex = (lastJokeIndex + 1) % jokes.length;
  return jokes[lastJokeIndex];
}
