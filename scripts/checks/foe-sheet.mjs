// node foe-sheet.mjs before|after PORT OUTDIR [looks]
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const [mode, port, out, list = 'hound,bat,beetle,spider'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGE', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(`http://localhost:${port}/?debug`, { waitUntil: 'load' });
const result = await page.evaluate(async (mode, looks) => {
  const { THREE } = await import('/scripts/models/exportGlb.js');
  const make = mode === 'after'
    ? (await import('/src/areas/creatures.js')).createCreature
    : ((B) => (look) => B[look]())((await import('/src/areas/foeViews.js')).__BUILDERS);
  const size = [640, 420];
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size[0], size[1]);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  const out = {};
  for (const look of looks) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#2b2b2e');
    scene.add(new THREE.HemisphereLight('#dfe6ee', '#3a3632', 1.6));
    const key = new THREE.DirectionalLight('#fff2e0', 2.4); key.position.set(2.5, 4, 3); key.castShadow = true; scene.add(key);
    const rim = new THREE.DirectionalLight('#9fc8ff', 1.4); rim.position.set(-3, 2.5, -3); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 32), new THREE.MeshStandardMaterial({ color: '#3a3a3c', roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const rig = make(look);
    const holder = new THREE.Group();
    holder.add(rig.body);
    scene.add(holder);
    rig.body.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    const flying = look === 'bat';
    const pose = (frame, steps, speed) => {
      for (let i = 0; i < steps; i++) {
        if (rig.animate) rig.animate(frame, 0.033, i * 0.033, speed);
        else {
          // 前の形：今までの animateRig と同じ動かし方
          const moving = frame.phase === 'chase';
          rig.legs?.forEach((leg, k) => { leg.rotation.x = moving ? Math.sin(i * 0.033 * 9 + k * Math.PI * 0.5 + (k % 2) * Math.PI) * 0.6 : 0; });
          rig.wings?.forEach(({ pivot, side }) => { pivot.rotation.z = side * (frame.height > 0.5 ? Math.sin(i * 0.033 * 16) * 0.8 : 0.9); });
        }
      }
      rig.body.position.y = frame.height;
    };
    const camera = new THREE.PerspectiveCamera(30, size[0] / size[1], 0.05, 100);
    const shots = [];
    const views = flying
      ? [['飛行・正面', { phase: 'chase', height: 1.2 }, 9, 3, 0.35], ['飛行・横', { phase: 'chase', height: 1.2 }, 14, 3, Math.PI / 2], ['飛行・後ろ', { phase: 'chase', height: 1.2 }, 5, 3, Math.PI + 0.4], ['地上', { phase: 'idle', height: 0 }, 6, 0, 0.6]]
      : [['正面', { phase: 'idle', height: 0 }, 2, 0, 0.6], ['横・歩き', { phase: 'chase', height: 0 }, 22, 3, Math.PI / 2], ['後ろ', { phase: 'idle', height: 0 }, 2, 0, Math.PI + 0.6], ['予兆', { phase: 'windup', height: 0 }, 20, 0, 1.1]];
    for (const [label, frame, steps, speed, angle] of views) {
      pose(frame, steps, speed);
      holder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(holder);
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      const d = Math.max(s.x, s.y, s.z) * 1.75 + 0.3;
      camera.position.set(c.x + Math.sin(angle) * d, c.y + d * 0.32, c.z + Math.cos(angle) * d);
      camera.lookAt(c);
      renderer.render(scene, camera);
      shots.push([label, renderer.domElement.toDataURL('image/png')]);
    }
    out[look] = shots;
  }
  return out;
}, mode, list.split(','));
fs.mkdirSync(out, { recursive: true });
for (const [look, shots] of Object.entries(result)) shots.forEach(([label, data], i) => fs.writeFileSync(`${out}/${mode}-${look}-${i}.png`, Buffer.from(data.split(',')[1], 'base64')));
console.log('ok', Object.keys(result));
await browser.close();
