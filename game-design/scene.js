import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ASSETS = new URL('./models/', import.meta.url);
const COLORS = ['#b9a7f9', '#b9ebea', '#f6c8ad'];
const TONES = { lilac: '#b9a7f9', mint: '#b9ebea', peach: '#f6c8ad' };
function paint(root, color) { root.traverse(o => { if (o.isMesh && o.material && o.material.name === 'CarPaint') o.material.color.set(color); }); }
function release(...roots) {
  const geometries = new Set(), materials = new Set();
  roots.filter(Boolean).forEach(root => root.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean).forEach(m => materials.add(m));
  }));
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}
function prepare(root, color) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (color && o.material.name === 'CarPaint') { o.material = o.material.clone(); o.material.color.set(color); }
  });
  return root;
}

/** Presentation only. No word validation, timers, scores, collisions, or networking. */
export class GameScene {
  constructor(container, game, { onAnchors = () => {}, onReady = () => {}, onError = () => {} } = {}) {
    this.container = container; this.game = game; this.onAnchors = onAnchors;
    this.state = {}; this.time = 0; this.last = 0; this.cars = []; this.discs = []; this.effects = [];
    this.disposed = false; this.visible = true; this.ready = false;
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(game === 'race' ? '#e9e7fa' : '#eaf3ef');
    this.scene.fog = new THREE.Fog(game === 'race' ? '#e9e7fa' : '#eaf3ef', game === 'race' ? 45 : 48, game === 'race' ? 155 : 100);
    this.camera = new THREE.PerspectiveCamera(game === 'race' ? 47 : 40, 1, .1, 180);
    this.camera.position.set(...(game === 'race' ? [0, 6.1, 13] : [13, 17, 22]));
    this.camera.lookAt(...(game === 'race' ? [0, 1, -17] : [0, .4, 0]));
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (e) { onError(e); return; }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = .88;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#c7b8dd', 1.5));
    const sun = new THREE.DirectionalLight('#fff9ed', 2.4);
    sun.position.set(-10, 24, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22; sun.shadow.camera.far = 90;
    sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; sun.shadow.radius = 3;
    this.scene.add(sun);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container);
    this.visibilityObserver = new IntersectionObserver(entries => { this.visible = entries[0].isIntersecting; if (this.visible) this.invalidate(); });
    this.visibilityObserver.observe(container);
    this.motionChange = () => this.invalidate(); this.motionQuery.addEventListener('change', this.motionChange);
    this.documentVisibility = () => { this.last = 0; if (!document.hidden) this.invalidate(); };
    document.addEventListener('visibilitychange', this.documentVisibility);
    this.resize();
    this.load().then(() => {
      if (this.disposed) return;
      this.ready = true; onReady(); this.update(this.state); this.invalidate();
    }).catch(e => { if (!this.disposed) onError(e); });
  }
  async load() {
    const loader = new GLTFLoader();
    const names = this.game === 'race' ? ['race-world.glb', 'car.glb'] : ['tennis-world.glb', 'tennis-player.glb', 'tennis-ball.glb'];
    const assets = await Promise.all(names.map(n => loader.loadAsync(new URL(n, ASSETS).href)));
    if (this.disposed) { release(...assets.map(a => a.scene)); return; }
    this.scene.add(prepare(assets[0].scene));
    this.prototype = assets[1].scene;
    if (this.game === 'race') {
      // Moving road markings are a visual loop, independent from race state.
      this.dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(.11, .02, 2.3), new THREE.MeshStandardMaterial({ color: '#fffdf8', roughness: .8 }), 44);
      this.dashes.receiveShadow = true; this.scene.add(this.dashes);
      this.dashTransform = new THREE.Object3D();
    } else {
      this.players = [prepare(this.prototype.clone(true), COLORS[0]), prepare(this.prototype.clone(true), COLORS[2])];
      // 모델의 정면은 +Z(카메라 쪽). 앞쪽 곰은 네트(-Z)를 보도록 돌리고, 건너편 곰은 그대로 이쪽(+Z)을 본다
      this.players[0].position.set(-1.8, .15, 5.9); this.players[0].rotation.y = Math.PI - .22;
      this.players[1].position.set(1.4, .15, -6); this.players[1].rotation.y = .2;
      this.players.forEach(p => { p.scale.setScalar(1.6); this.scene.add(p); });
      this.ball = prepare(assets[2].scene); this.ball.scale.setScalar(1.4); this.ball.position.set(0, 2.3, 2); this.scene.add(this.ball);
      const ring = new THREE.Mesh(new THREE.RingGeometry(.26, .38, 40), new THREE.MeshBasicMaterial({ color: '#9380b7', transparent: true, opacity: .28, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .18; this.ballShadow = ring; this.scene.add(ring);
    }
  }
  resize() {
    if (!this.renderer || this.disposed) return;
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.width = width; this.height = height; this.camera.aspect = width / height;
    this.camera.fov = this.game === 'race' ? (width / height < 1 ? 64 : 47) : (width / height < 1 ? 56 : 40);
    this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); this.invalidate();
  }
  update(state) {
    this.state = state;
    if (!this.ready) return;
    if (this.game === 'race') {
      // 참가자의 자동차는 도로 앞쪽에 세워 두고, 다가오는 낱말은 둥근 공으로 표시한다
      const players = state.players || [], targets = state.targets || [];
      while (this.cars.length < players.length) { const car = prepare(this.prototype.clone(true), COLORS[this.cars.length % 3]); car.scale.setScalar(1.22); car.rotation.y = Math.PI; car.userData.color = COLORS[this.cars.length % 3]; this.scene.add(car); this.cars.push(car); }
      this.cars.forEach((car, i) => {
        const p = players[i]; car.visible = Boolean(p);
        if (!p) return;
        const color = TONES[p.color] || COLORS[i % 3];
        if (car.userData.color !== color) { paint(car, color); car.userData.color = color; }
        const lane = players.length === 1 ? 1 : i % 3;
        car.position.set(lane * 3.5 - 3.5, .16, 1.8);
      });
      if (!this.discGeometry) this.discGeometry = new THREE.SphereGeometry(.95, 28, 18);
      while (this.discs.length < targets.length) {
        const mesh = new THREE.Mesh(this.discGeometry, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .55, metalness: 0 }));
        mesh.castShadow = true; this.scene.add(mesh); this.discs.push(mesh);
      }
      this.discs.forEach((d, i) => { const t = targets[i]; d.visible = Boolean(t && !t.claimedBy); if (t) d.material.color.set(COLORS[(t.lane ?? i) % 3]); });
    }
    this.invalidate();
  }
  project(position) {
    const p = position.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * this.width, y: (1 - p.y) / 2 * this.height, visible: p.z < 1 && p.z > -1 };
  }
  playEffect(kind, targetId) {
    if (!this.ready) return;
    const target = this.game === 'race' ? this.discs[(this.state.targets || []).findIndex(t => t.id === targetId)] : this.ball;
    const origin = target ? target.position.clone().add(new THREE.Vector3(0, 1.6, 0)) : new THREE.Vector3(0, 2, 0);
    if (this.motionQuery.matches) return;
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(.1, 6, 5), new THREE.MeshBasicMaterial({ color: ['#f0edc2', '#e1b7fa', '#b9ebea'][i % 3], transparent: true }));
      mesh.position.copy(origin); this.scene.add(mesh);
      this.effects.push({ mesh, origin, angle: i / 10 * Math.PI * 2, start: performance.now() });
    }
    this.invalidate();
  }
  invalidate() { if (!this.raf && !this.disposed && this.renderer) this.raf = requestAnimationFrame(t => this.frame(t)); }
  frame(now) {
    this.raf = 0; if (this.disposed || !this.renderer) return;
    const dt = this.last ? Math.min((now - this.last) / 1000, .08) : 0; this.last = now;
    const animate = !this.motionQuery.matches && this.state.motion !== false && ['playing', 'success', 'claimed', 'waiting', 'urgent', 'invalid', 'wrong-start', 'duplicate'].includes(this.state.phase);
    if (animate && this.visible && !document.hidden) this.time += dt;
    if (this.ready && this.game === 'race') {
      for (let i = 0; i < 44; i++) {
        this.dashTransform.position.set(i % 2 ? -1.76 : 1.76, .16, 12 - Math.floor(i / 2) * 4.5 + (this.time * 3 % 4.5));
        this.dashTransform.updateMatrix(); this.dashes.setMatrixAt(i, this.dashTransform.matrix);
      }
      this.dashes.instanceMatrix.needsUpdate = true;
      const anchors = [], drivers = [];
      (this.state.targets || []).forEach((target, i) => {
        const disc = this.discs[i]; if (!disc) return;
        const z = Number.isFinite(target.z) ? target.z : [-1, -11, -5][i % 3];
        const displayZ = this.state.previewMotion ? ((z + 24 + this.time * 1.4) % 30) - 24 : z;
        disc.position.set((target.lane ?? i % 3) * 3.5 - 3.5, 1.05 + Math.sin(this.time * 3 + i) * .08, displayZ);
        disc.rotation.y = this.time * .8 + i;
        anchors.push({ id: target.id, ...this.project(disc.position.clone().add(new THREE.Vector3(0, 1.75, 0))) });
      });
      (this.state.players || []).forEach((p, i) => {
        const car = this.cars[i]; if (!car || !car.visible) return;
        car.position.y = .16 + Math.sin(this.time * 2 + i) * .012;
        drivers.push({ id: p.id, ...this.project(car.position.clone().add(new THREE.Vector3(0, 2.7, 0))) });
      });
      this.onAnchors(anchors, drivers);
    } else if (this.ready && this.game === 'tennis') {
      if (this.state.ballPosition) this.ball.position.fromArray(this.state.ballPosition);
      else {
        const t = this.state.previewMotion ? (.5 - .5 * Math.cos(this.time * 1.4)) : .38;
        this.ball.position.set(-1.8 + t * 3.2, 1.3 + Math.sin(t * Math.PI) * 3, 5.6 - t * 11.2);
      }
      this.ball.rotation.x = this.time; this.ballShadow.position.set(this.ball.position.x, .18, this.ball.position.z);
      this.players.forEach((p, i) => { p.position.y = .15 + Math.sin(this.time * 2 + i) * .025; });
      // 곰 머리 위 이름표 위치 (0: 가까운 곰 = 나, 1: 건너편 곰 = 상대)
      this.onAnchors(this.players.map((p, i) => ({ id: i === 0 ? 'me' : 'opponent', ...this.project(p.position.clone().add(new THREE.Vector3(0, 4.4, 0))) })));
    }
    this.effects = this.effects.filter(effect => {
      const t = (now - effect.start) / 750;
      if (t >= 1) { this.scene.remove(effect.mesh); release(effect.mesh); return false; }
      effect.mesh.position.copy(effect.origin).add(new THREE.Vector3(Math.cos(effect.angle) * t * 2, Math.sin(t * Math.PI) * 1.7, Math.sin(effect.angle) * t * 2));
      effect.mesh.material.opacity = 1 - t; return true;
    });
    this.renderer.render(this.scene, this.camera);
    if (this.visible && !document.hidden && (animate || this.effects.length)) this.invalidate();
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect(); this.visibilityObserver?.disconnect();
    if (this.motionChange) this.motionQuery.removeEventListener('change', this.motionChange);
    if (this.documentVisibility) document.removeEventListener('visibilitychange', this.documentVisibility);
    this.discGeometry?.dispose();
    release(this.scene, this.prototype); this.renderer?.dispose(); this.renderer?.domElement.remove();
  }
}
