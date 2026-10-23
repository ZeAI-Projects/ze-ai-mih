import * as THREE from 'three';
import brandUrl from '@/assets/images/header-brand.webp';
import labxUrl from '@/assets/images/labx-original.webp';

export type FlightPhase = 'entry' | 'turn' | 'flyover' | 'exit';
export const FLIGHT_DURATION = 9000;
// The incoming climb stays outside the right edge until it clears the visible city.
// Depth through the left turn produces a yawing passenger-jet turn, not a vertical roll.
const route = new THREE.CatmullRomCurve3([
  new THREE.Vector3(1.40, 1.22, -2), new THREE.Vector3(1.32, .48, -1),
  new THREE.Vector3(.70, .37, 1), new THREE.Vector3(.30, .34, 3),
  new THREE.Vector3(.18, .29, 0), new THREE.Vector3(.34, .22, -3),
  new THREE.Vector3(.68, .16, -4), new THREE.Vector3(.98, -.08, -5),
  new THREE.Vector3(1.40, -.40, -7),
], false, 'centripetal');
const milestones = [0, .10, .22, .34, .43, .54, .70, .86, 1];
function routeParameter(t: number) {
  const last = milestones.length - 1;
  const i = Math.min(last-1, Math.max(0, milestones.findIndex((p, i) => i > 0 && t <= p) - 1));
  const span = milestones[i+1] - milestones[i], u = (t-milestones[i])/span;
  const slope = (j: number) => j === 0 || j === last ? 0 : 2 / (last * (milestones[j+1]-milestones[j-1]));
  return (2*u**3-3*u*u+1)*i/last + (u**3-2*u*u+u)*span*slope(i)
    + (-2*u**3+3*u*u)*(i+1)/last + (u**3-u*u)*span*slope(i+1);
}

export type FlightController = { dispose: () => void; setTheme: (dark: boolean) => void };

/** A single bounded renderer/timeline. No renderer is created before an explicit launch. */
export function startFlight(canvas: HTMLCanvasElement, onPhase: (phase: FlightPhase) => void, onComplete: () => void, night = false): FlightController | null {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: window.innerWidth > 600, powerPreference: 'low-power' }); }
  catch { return null; }
  const scene = new THREE.Scene();
  let width = Math.max(1, canvas.clientWidth), viewportHeight = Math.max(1, canvas.clientHeight);
  const worldHeight = 10;
  const camera = new THREE.PerspectiveCamera(2 * Math.atan(worldHeight / 36) * 180 / Math.PI, width / viewportHeight, .1, 100);
  camera.position.set(0, 0, 18);
  camera.updateMatrixWorld();
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.75));
  renderer.setSize(width, viewportHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  const ambient = new THREE.HemisphereLight(0xffffff, 0xb8a4d5, 2); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 7, 9); scene.add(key);
  const fill = new THREE.DirectionalLight(0xe6dcff, .7); fill.position.set(-5, 2, 4); scene.add(fill);

  const setTheme = (darkMode: boolean) => {
    ambient.color.set(darkMode ? 0xb8c9ff : 0xffffff);
    ambient.intensity = darkMode ? 1.5 : 2;
    key.color.set(darkMode ? 0xe4eaff : 0xffffff);
    fill.color.set(darkMode ? 0x9d7eff : 0xe6dcff);
  };
  setTheme(night);
  const jet = new THREE.Group(); scene.add(jet);
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f3ff, roughness: .36, metalness: .24 });
  const purple = new THREE.MeshStandardMaterial({ color: 0x6936c4, roughness: .8, metalness: .03 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xbec9df, roughness: .25, metalness: .65 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x665a85, roughness: .8, metalness: .02 });
  const profile = [[.04,-3.5],[.13,-3.05],[.29,-2.4],[.43,-1.7],[.46,1.65],[.39,2.2],[.28,2.65],[.10,3.03],[0,3.12]];
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r,y)), 28), white);
  body.rotation.z = -Math.PI/2; jet.add(body);


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
    ctx.fillStyle='#8053c4';ctx.font='28px sans-serif';ctx.fillText('Ã—',260,110);ctx.fillText('Ã—',520,110);
    texture.needsUpdate=true;
  };
  brand.onload=paint;labx.onload=paint;brand.src=brandUrl;labx.src=labxUrl;
  const sidePanel = new THREE.Mesh(new THREE.PlaneGeometry(2,.26),brandMaterial); sidePanel.position.set(.05,-.04,.466); jet.add(sidePanel);
  const farPanel = sidePanel.clone(); farPanel.position.z=-.466; farPanel.rotation.y=Math.PI; jet.add(farPanel);
  // Attached cloth mesh; its leading edge stays fixed to the short tail tether.
  const bannerGeometry = new THREE.PlaneGeometry(2.6, .64, 16, 3);
  const banner = new THREE.Mesh(bannerGeometry, new THREE.MeshStandardMaterial({map: texture, roughness: .8, side: THREE.FrontSide}));
  banner.position.set(-5.7, .1, .12); jet.add(banner);
  const backGeometry = bannerGeometry.clone();
  const back = new THREE.Mesh(backGeometry, new THREE.MeshStandardMaterial({map: texture, roughness: .8, side: THREE.BackSide}));
  banner.add(back);
  const tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3.5,.1,.12),new THREE.Vector3(-4.4,.1,.12)]), new THREE.LineBasicMaterial({color:0xa291bb}));
  jet.add(tether);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.2,.035,.025),new THREE.MeshStandardMaterial({color:0x73d5dc,roughness:.4}));
  stripe.position.set(-.1,-.19,.46);jet.add(stripe);
  const clothRest = Float32Array.from(bannerGeometry.attributes.position.array);
  const clothUV = Float32Array.from(bannerGeometry.attributes.uv.array);
  function flutter(t: number) {
    const positions = bannerGeometry.attributes.position;
    for(let i=0;i<positions.count;i++) {
      const x=clothRest[i*3], trailing=(1.3-x)/2.6;
      const z=.10 * trailing * Math.sin(t*18 + trailing*7);
      positions.setZ(i,z);backGeometry.attributes.position.setZ(i,z);
      const u=clothUV[i*2],v=clothUV[i*2+1];
      bannerGeometry.attributes.uv.setXY(i,u,v);
      backGeometry.attributes.uv.setXY(i,1-u,v);
    }
    for(const geometry of [bannerGeometry,backGeometry]) {
      geometry.attributes.position.needsUpdate=true;geometry.attributes.uv.needsUpdate=true;
      geometry.computeVertexNormals();
    }
  }
  let modelScale=1;
  let raf = 0, started: number | null = null, previousPhase: FlightPhase | null = null;

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
  const forward = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  function worldPoint(parameter: number) {
    const p = route.getPoint(THREE.MathUtils.clamp(parameter, 0, 1));
    const depth = (18-p.z)/18;
    return new THREE.Vector3((p.x-.5)*worldHeight*width/viewportHeight*depth, (.5-p.y)*worldHeight*depth, p.z);
  }
  function place(t: number) {
    const parameter = routeParameter(t), point = route.getPoint(parameter);
    jet.position.copy(worldPoint(parameter));
    jet.scale.setScalar(modelScale);
    forward.copy(worldPoint(parameter+.001)).sub(worldPoint(parameter-.001)).normalize();
    side.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
    up.crossVectors(side, forward).normalize();
    basis.makeBasis(forward, up, side);
    jet.quaternion.setFromRotationMatrix(basis);
    // Restrained roll around the nose axis: the cabin remains upright.
    jet.rotateX(.22 * Math.sin(t*Math.PI) - .28 * Math.exp(-(((t-.40)/.14)**2)));
    flutter(t);
    jet.updateMatrixWorld(true);
    return point;
  }

  function resize() {
    width = Math.max(1, canvas.clientWidth); viewportHeight = Math.max(1, canvas.clientHeight);
    camera.aspect = width / viewportHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.25 : 1.75));
    renderer.setSize(width, viewportHeight, false);
    // Size the whole aircraft AND banner; perspective supplies the close-up scaling.
    jet.rotation.set(.42, -.06, 0); jet.position.set(0, 0, 0); jet.scale.setScalar(1);
    const unitBounds = projectedBounds();
    const targetWidth = Math.min(width * .64, viewportHeight * .50, 580);
    modelScale = targetWidth / ((unitBounds.right - unitBounds.left) * width);
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
    dispose(); onComplete();
  }
  function tick(now: number) {
    if (disposed) return;
    if (started === null) started = now;
    const elapsed = Math.min(now - started, FLIGHT_DURATION);
    progress = elapsed / FLIGHT_DURATION;
    const point = place(progress), bounds = projectedBounds();
    const phase: FlightPhase = progress < .28 ? 'entry' : progress < .52 ? 'turn' : progress < .78 ? 'flyover' : 'exit';
    if (phase !== previousPhase) { previousPhase = phase; onPhase(phase); }
    canvas.dataset.phase = phase; canvas.dataset.banner = 'attached';
    canvas.dataset.screenX = String(point.x); canvas.dataset.screenY = String(point.y);
    canvas.dataset.bounds = JSON.stringify(bounds); canvas.dataset.progress = String(progress);
    canvas.dataset.elapsedMs = String(elapsed);
    canvas.dataset.reveal = '1'; canvas.dataset.running = 'true';
    canvas.dataset.clearance = String(.45 - bounds.bottom);
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
  return { dispose, setTheme };
}
