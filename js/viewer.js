// ============================================================
// EntropyBottle — Three.js STL viewer
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const container = document.getElementById('viewer');
const loadingEl = document.getElementById('viewer-loading');
const triCountEl = document.getElementById('tri-count');
const dimValueEl = document.getElementById('dim-value');
const fileNameEl = document.getElementById('file-name');

const btnReset = document.getElementById('btn-reset');
const btnSpin  = document.getElementById('btn-spin');
const btnWire  = document.getElementById('btn-wire');
const btnGlass = document.getElementById('btn-glass');
const fileInput = document.getElementById('file-stl');

// ---- Scene ----------------------------------------------------
const scene = new THREE.Scene();
scene.background = null; // use CSS gradient behind canvas

// ---- Camera ---------------------------------------------------
const camera = new THREE.PerspectiveCamera(
  45, container.clientWidth / container.clientHeight, 0.1, 5000
);
camera.position.set(120, 90, 160);

// ---- Renderer -------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

// Environment map — needed for MeshPhysicalMaterial transmission/refraction to look realistic
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---- Lights ---------------------------------------------------
const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x1a1e2c, 0.9);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0x6ee7ff, 1.2);
keyLight.position.set(80, 120, 80);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xa78bfa, 0.6);
fillLight.position.set(-100, 40, -80);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xfb923c, 0.4);
rimLight.position.set(0, -80, -60);
scene.add(rimLight);

// ---- Grid floor (subtle) --------------------------------------
const grid = new THREE.GridHelper(400, 40, 0x2a2f42, 0x1a1d2a);
grid.position.y = -50;
grid.material.transparent = true;
grid.material.opacity = 0.4;
scene.add(grid);

// ---- Controls -------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.9;
controls.panSpeed = 0.7;
controls.minDistance = 20;
controls.maxDistance = 800;
controls.autoRotate = false;
controls.autoRotateSpeed = 1.2;

// ---- Material -------------------------------------------------
const solidMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xbfd0e8,
  metalness: 0.15,
  roughness: 0.35,
  clearcoat: 0.3,
  clearcoatRoughness: 0.4,
  envMapIntensity: 0.6,
  flatShading: false,
});

const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xd6ecff,
  metalness: 0.0,
  roughness: 0.08,
  transmission: 1.0,
  thickness: 2.2,
  ior: 1.5,
  attenuationColor: 0x9ec9ff,
  attenuationDistance: 80,
  transparent: true,
  opacity: 0.6,
  clearcoat: 1.0,
  clearcoatRoughness: 0.08,
  envMapIntensity: 1.2,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const wireMaterial = new THREE.MeshBasicMaterial({
  color: 0x6ee7ff,
  wireframe: true,
  transparent: true,
  opacity: 0.6,
});

let currentMesh = null;        // solid / main mesh
let glassMesh = null;          // optional transparent overlay mesh
let initialCameraState = null;
let wireframe = false;
let glassMode = true;          // default ON: most Entroscope prototypes have a transparent bottle shell

// ---- Placeholder object (shown until STL loads) ---------------
function createPlaceholder() {
  const group = new THREE.Group();

  // Bottle body (rough cylinder)
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(28, 28, 90, 48, 1, false),
    solidMaterial.clone()
  );
  body.material.transparent = true;
  body.material.opacity = 0.25;
  body.material.roughness = 0.1;
  body.material.transmission = 0.9;
  body.material.thickness = 2;
  group.add(body);

  // Neck
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 14, 18, 32),
    body.material
  );
  neck.position.y = 54;
  group.add(neck);

  // Cap
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11, 6, 32),
    new THREE.MeshPhysicalMaterial({ color: 0x6ee7ff, metalness: 0.6, roughness: 0.2 })
  );
  cap.position.y = 66;
  group.add(cap);

  // Fan disc inside
  const fan = new THREE.Mesh(
    new THREE.CylinderGeometry(18, 18, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0xa78bfa, metalness: 0.4, roughness: 0.5 })
  );
  fan.position.y = -30;
  fan.rotation.x = Math.PI / 2;
  group.add(fan);

  // "Beads"
  for (let i = 0; i < 40; i++) {
    const b = new THREE.Mesh(
      new THREE.SphereGeometry(1.2 + Math.random() * 0.8, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 })
    );
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 22;
    b.position.set(Math.cos(a) * r, -25 + Math.random() * 55, Math.sin(a) * r);
    group.add(b);
  }

  return group;
}

let placeholder = createPlaceholder();
scene.add(placeholder);

// Fit camera to object(s) — obj can be a single Object3D or an array
function frameObject(obj) {
  const targets = Array.isArray(obj) ? obj : [obj];
  const box = new THREE.Box3();
  targets.forEach(t => box.expandByObject(t));
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Recenter each target by the combined center
  targets.forEach(t => t.position.sub(center));

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let dist = Math.abs(maxDim / Math.sin(fov / 2));
  dist *= 0.8;

  camera.position.set(dist * 0.8, dist * 0.6, dist);
  camera.near = dist / 100;
  camera.far = dist * 20;
  camera.updateProjectionMatrix();

  controls.target.set(0, 0, 0);
  controls.update();

  // Move grid below object
  grid.position.y = -size.y / 2 - 8;

  initialCameraState = {
    pos: camera.position.clone(),
    target: controls.target.clone(),
  };

  // Update meta
  dimValueEl.textContent =
    `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)}`;
}

// ---- Load STL -------------------------------------------------
const loader = new STLLoader();

function disposeMesh(m) {
  if (!m) return;
  scene.remove(m);
  m.geometry?.dispose();
}

function pickMaterial() {
  if (wireframe) return wireMaterial;
  if (glassMode) return glassMaterial;
  return solidMaterial;
}

function addGeometry(geometry, name) {
  if (placeholder) { scene.remove(placeholder); placeholder = null; }
  disposeMesh(currentMesh);

  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, pickMaterial());
  scene.add(mesh);
  currentMesh = mesh;

  // Frame both solid + glass together if glass is present
  const targets = glassMesh ? [mesh, glassMesh] : [mesh];
  frameObject(targets);

  const tris = geometry.attributes.position.count / 3;
  triCountEl.textContent = tris.toLocaleString();
  fileNameEl.textContent = name || 'model.stl';

  loadingEl.classList.add('hidden');
}

function addGlassGeometry(geometry) {
  geometry.computeVertexNormals();
  if (glassMesh) { scene.remove(glassMesh); glassMesh.geometry?.dispose(); }
  const mesh = new THREE.Mesh(geometry, glassMaterial);
  mesh.renderOrder = 1; // render after solid for proper blending
  scene.add(mesh);
  glassMesh = mesh;
}

// Attempt to auto-load assets/model.stl and (optionally) assets/model_glass.stl
function tryAutoLoad() {
  // First, try glass companion file — load quietly in parallel
  loader.load(
    'assets/model_glass.stl',
    (geom) => { addGlassGeometry(geom); },
    undefined,
    () => { /* no glass file — fine */ }
  );

  loader.load(
    'assets/model.stl',
    (geom) => addGeometry(geom, 'model.stl'),
    undefined,
    () => {
      // File not present — keep placeholder, hide loading
      loadingEl.querySelector('.loading-text').textContent = 'Place your STL at assets/model.stl — or use “Load STL”';
      setTimeout(() => loadingEl.classList.add('hidden'), 900);
      // Frame the placeholder nicely
      frameObject(placeholder);
      fileNameEl.textContent = 'placeholder';
      triCountEl.textContent = '—';
    }
  );
}
tryAutoLoad();

// File input handler
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  loadingEl.classList.remove('hidden');
  loadingEl.querySelector('.loading-text').textContent = 'Loading ' + file.name + '…';

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const geom = loader.parse(ev.target.result);
      addGeometry(geom, file.name);
    } catch (err) {
      loadingEl.querySelector('.loading-text').textContent = 'Failed to load STL.';
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
});

// ---- Controls -------------------------------------------------
btnReset.addEventListener('click', () => {
  if (!initialCameraState) return;
  camera.position.copy(initialCameraState.pos);
  controls.target.copy(initialCameraState.target);
  controls.update();
});

btnSpin.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  btnSpin.classList.toggle('active', controls.autoRotate);
  document.getElementById('spin-label').textContent =
    controls.autoRotate ? 'Rotating…' : 'Auto-rotate';
});

btnWire.addEventListener('click', () => {
  wireframe = !wireframe;
  btnWire.classList.toggle('active', wireframe);
  if (currentMesh) {
    currentMesh.material = pickMaterial();
  } else if (placeholder) {
    placeholder.traverse(o => {
      if (o.isMesh) o.material.wireframe = wireframe;
    });
  }
});

// Reflect default glass-mode state on the button
btnGlass.classList.toggle('active', glassMode);

btnGlass.addEventListener('click', () => {
  glassMode = !glassMode;
  btnGlass.classList.toggle('active', glassMode);
  if (currentMesh) {
    currentMesh.material = pickMaterial();
  }
});

// ---- Resize ---------------------------------------------------
function onResize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ---- Animate --------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Gently rotate placeholder fan for life
  if (placeholder) {
    placeholder.rotation.y += 0.003;
  }

  renderer.render(scene, camera);
}
animate();
