import * as THREE from 'three';
import brandUrl from '@/assets/images/header-brand.webp';
import labxUrl from '@/assets/images/labx-original.webp';

export type FlightPhase = 'entry' | 'flyover' | 'exit';
export const FLIGHT_DURATION = 7000;
// Endpoints are calculated from the complete projected aircraft bounds on resize.
const FLIGHT_HEIGHT = 0.47;

export type FlightController = { dispose: () => void };

/** Integrated velocity: short ramps, with constant speed through most of the flight. */
export function flightTravel(t: number) {
  const entry = 700 / FLIGHT_DURATION, exit = 800 / FLIGHT_DURATION;
  const distance = 1 - (entry + exit) / 2;
  const p = THREE.MathUtils.clamp(t, 0, 1);
  if (p < entry) return p * p / (2 * entry * distance);
  if (p > 1 - exit) return 1 - (1 - p) ** 2 / (2 * exit * distance);
  return (p - entry / 2) / distance;
}

/** A single bounded renderer/timeline. No renderer is created before an explicit launch. */
export function startFlight(canvas: HTMLCanvasElement, onPhase: (phase: FlightPhase) => void, onComplete: () => void): FlightController | null {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: window.innerWidth > 600, powerPreference: 'low-power' }); }
  catch { return null; }
  const scene = new THREE.Scene();
  const stage = canvas.parentElement!;
  let width = Math.max(1, canvas.clientWidth), viewportHeight = Math.max(1, canvas.clientHeight);
  const worldHeight = 10;
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 100);
  camera.position.set(0, 0, 18);
  camera.updateMatrixWorld();
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.75));
  renderer.setSize(width, viewportHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8a4d5, 2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 7, 9); scene.add(key);
  const fill = new THREE.DirectionalLight(0xe6dcff, .7); fill.position.set(-5, 2, 4); scene.add(fill);

  const jet = new THREE.Group(); scene.add(jet);
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f3ff, roughness: .85, metalness: .02 });
  const purple = new THREE.MeshStandardMaterial({ color: 0x6936c4, roughness: .8, metalness: .03 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xbec9df, roughness: .8, metalness: .05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x665a85, roughness: .8, metalness: .02 });
  const profile = [[.04,-3.5],[.13,-3.05],[.29,-2.4],[.43,-1.7],[.46,1.65],[.39,2.2],[.28,2.65],[.10,3.03],[0,3.12]];
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r,y)), 28), white);
  body.rotation.z = -Math.PI/2; jet.add(body);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(.455,.455,3.7,24,1,true,0,Math.PI), purple);
  belly.rotation.z = -Math.PI/2; belly.position.x = -.05; jet.add(belly);

  function wing(points: number[][], depth: number, material: THREE.Material) {
    const shape = new THREE.Shape(points.map(([x,z]) => new THREE.Vector2(x,z)));
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{ depth, bevelEnabled:true, bevelSize:.025, bevelThickness:.02, bevelSegments:1, steps:1 }), material);
    mesh.rotation.x = Math.PI/2; jet.add(mesh); return mesh;
  }
  for (const side of [-1,1]) {
    wing([[.8,side*.26],[-.9,side*3.45],[-1.45,side*3.6],[-1.25,side*2.4],[-1.1,side*.25]],.09,white);
    wing([[-2.55,side*.1],[-3.25,side*1.35],[-3.6,side*1.4],[-3.3,side*.15]],.07,purple);
    // Simple winglets and two lightweight engines; no animated mechanical details.
    const tip = new THREE.Mesh(new THREE.BoxGeometry(.47,.6,.07),purple); tip.position.set(-1.18,.25,side*3.48); tip.rotation.z=-.25; jet.add(tip);
    const engine = new THREE.Group(); engine.position.set(.0,-.48,side*1.27); jet.add(engine);
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(.29,.25,1.12,22,1,true),white); nacelle.rotation.z=-Math.PI/2; engine.add(nacelle);
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.035,22),dark); intake.rotation.z=-Math.PI/2; intake.position.x=.55; engine.add(intake);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(.267,.028,8,24),silver); lip.rotation.y=Math.PI/2; lip.position.x=.565; engine.add(lip);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(.46,.38,.1),silver); pylon.position.set(-.15,.35,0); engine.add(pylon);
    for(let i=0;i<17;i++){const window = new THREE.Mesh(new THREE.SphereGeometry(.048,6,5),dark); window.scale.set(.85,1.1,.35); window.position.set(-1.8+i*.22,.16,side*.435); jet.add(window);}
  }
  const tailShape = new THREE.Shape([new THREE.Vector2(-3.35,.08),new THREE.Vector2(-3.15,1.48),new THREE.Vector2(-2.73,1.52),new THREE.Vector2(-2.12,.14)]);
  const tail = new THREE.Mesh(new THREE.ExtrudeGeometry(tailShape,{depth:.08,bevelEnabled:false}),purple); tail.position.z=-.04; jet.add(tail);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(.34,16,8),dark); cockpit.scale.set(1.05,.45,.85); cockpit.position.set(2.37,.25,0); jet.add(cockpit);

  const brandCanvas = document.createElement('canvas'); brandCanvas.width=1024; brandCanvas.height=200;
  const ctx = brandCanvas.getContext('2d');
  if (ctx) { ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,1024,200); }
  const texture = new THREE.CanvasTexture(brandCanvas); texture.colorSpace=THREE.SRGBColorSpace;
  const brandMaterial = new THREE.MeshStandardMaterial({ map:texture, roughness:.7 });
  const brand = new Image(); const labx = new Image();
  let disposed = false;
  const paint = () => {
    if(disposed || !ctx) return;
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1024,200);
    // Crop the two official wordmarks independently, preserving their proportions.
    if(brand.complete && brand.naturalWidth) {
      ctx.drawImage(brand,35,110,345,145,18,52,220,92);
      ctx.drawImage(brand,395,110,665,145,550,52,450,98);
    }
    ctx.fillStyle='#281342';ctx.fillRect(295,36,210,128);
    if(labx.complete && labx.naturalWidth) ctx.drawImage(labx,305,55,190,87);
    ctx.fillStyle='#8053c4';ctx.font='28px sans-serif';ctx.fillText('×',260,110);ctx.fillText('×',520,110);
    texture.needsUpdate=true;
  };
  brand.onload=paint;labx.onload=paint;brand.src=brandUrl;labx.src=labxUrl;
  const sidePanel = new THREE.Mesh(new THREE.PlaneGeometry(2,.26),brandMaterial); sidePanel.position.set(.05,-.04,.466); jet.add(sidePanel);
  const farPanel = sidePanel.clone(); farPanel.position.z=-.466; farPanel.rotation.y=Math.PI; jet.add(farPanel);
  let raf = 0, started: number | null = null, previousPhase: FlightPhase | null = null;
  let startX = 0, endX = 1, imageLeft = 0, imageWidth = width, lastReveal = 0;
  let progress = 0;
  const box = new THREE.Box3(), corner = new THREE.Vector3();
  function projectedBounds() {
    jet.updateMatrixWorld(true); box.setFromObject(jet, true);
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      corner.set(x, y, z).project(camera);
      left = Math.min(left, (corner.x + 1) / 2); right = Math.max(right, (corner.x + 1) / 2);
      top = Math.min(top, (1 - corner.y) / 2); bottom = Math.max(bottom, (1 - corner.y) / 2);
    }
    return { left, right, top, bottom };
  }
  function place(t: number) {
    const x = THREE.MathUtils.lerp(startX, endX, flightTravel(t));
    jet.position.set((x - .5) * worldHeight * width / viewportHeight, (.5 - FLIGHT_HEIGHT) * worldHeight, 0);
    jet.updateMatrixWorld(true);
    return x;
  }
  function resize() {
    width = Math.max(1, canvas.clientWidth); viewportHeight = Math.max(1, canvas.clientHeight);
    camera.left = -worldHeight * width / viewportHeight / 2; camera.right = -camera.left;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.25 : 1.75));
    renderer.setSize(width, viewportHeight, false);
    // Fixed perspective on the model, with level wings and no rocking or banking.
    jet.rotation.set(.42, -.06, 0); jet.position.set(0, 0, 0); jet.scale.setScalar(1);
    const unitBounds = projectedBounds();
    const targetWidth = Math.min(width * .38, viewportHeight * .35, 320);
    jet.scale.setScalar(targetWidth / ((unitBounds.right - unitBounds.left) * width));
    const bounds = projectedBounds(), margin = Math.max(10 / width, .012);
    startX = -(bounds.right - .5) - margin;
    // The last projected vertex crosses the edge at the final timestamp, rather
    // than disappearing early into an oversized offscreen exit margin.
    endX = 1 + (.5 - bounds.left) + 1e-9;
    const image = stage.querySelector('.flight-city')?.getBoundingClientRect();
    const rect = canvas.getBoundingClientRect();
    imageLeft = image ? image.left - rect.left : 0;
    imageWidth = Math.max(1, image?.width ?? width);
    place(progress);
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  const contextLost = (event: Event) => { event.preventDefault(); complete(); };
  canvas.addEventListener('webglcontextlost', contextLost);
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(raf); observer.disconnect();
    canvas.removeEventListener('webglcontextlost', contextLost);
    brand.onload = null; labx.onload = null;
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        geometries.add(object.geometry);
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    texture.dispose(); renderer.dispose(); renderer.forceContextLoss();
    canvas.dataset.running = 'false';
  }
  function complete() {
    if (disposed) return;
    stage.style.setProperty('--destination-edge', '100%');
    dispose(); onComplete();
  }
  function tick(now: number) {
    if (disposed) return;
    if (started === null) started = now;
    const elapsed = Math.min(now - started, FLIGHT_DURATION);
    progress = elapsed / FLIGHT_DURATION;
    const x = place(progress), bounds = projectedBounds();
    // The rearmost tail point is projected through the same camera as the plane.
    corner.set(-3.6, 0, 0).applyMatrix4(jet.matrixWorld).project(camera);
    const tailX = (corner.x + 1) * width / 2;
    const gap = THREE.MathUtils.clamp(width * .008, 6, 12);
    const reveal = THREE.MathUtils.clamp((tailX - gap - imageLeft) / imageWidth, 0, 1);
    // A resize must never hide an already revealed portion of the destination.
    lastReveal = progress === 1 ? 1 : Math.max(lastReveal, reveal);
    stage.style.setProperty('--destination-edge', `${lastReveal * 100}%`);
    const phase: FlightPhase = elapsed < 700 ? 'entry' : elapsed < 6200 ? 'flyover' : 'exit';
    if (phase !== previousPhase) { previousPhase = phase; onPhase(phase); }
    canvas.dataset.phase = phase;
    canvas.dataset.screenX = String(x); canvas.dataset.screenY = String(FLIGHT_HEIGHT);
    canvas.dataset.bounds = JSON.stringify(bounds); canvas.dataset.progress = String(progress);
    canvas.dataset.elapsedMs = String(elapsed); canvas.dataset.tailX = String(tailX);
    canvas.dataset.reveal = String(lastReveal); canvas.dataset.running = 'true';
    canvas.dataset.clearance = String(.62 - bounds.bottom);
    renderer.render(scene, camera);
    if (progress < 1) raf = requestAnimationFrame(tick);
    else complete();
  }
  // Brand decoding and GPU preparation finish before the first timeline timestamp.
  Promise.all([brand.decode().catch(() => {}), labx.decode().catch(() => {})]).then(() => {
    if (disposed) return;
    try {
      paint(); renderer.compile(scene, camera); renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    } catch { complete(); }
  });
  return { dispose };
}
