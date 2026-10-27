// エリアで使い回す見た目の部品：残響の碑、遠くの城、崖、白薔薇の茂み、水面、遠くでも霞みすぎない石。
import * as THREE from 'three';
import { loadGLTF, measureModel, withFallback } from '../assets.js';
import { asset } from '../paths.js';
import { worldUV } from '../chapter/materials.js';

// 遠景の目印（城・塔）：霧のかかり方を弱くして、遠くからでも形が見えるようにする
export function landmarkMaterial(base, amount = 0.4) {
  const material = base.clone();
  material.customProgramCacheKey = () => `landmark-${amount}`;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
      #ifdef USE_FOG
        float landmarkDepth = vFogDepth * ${amount.toFixed(2)};
        float fogFactor = 1.0 - exp( - fogDensity * fogDensity * landmarkDepth * landmarkDepth );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif`);
  };
  return material;
}

function box(material, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(worldUV(new THREE.BoxGeometry(w, h, d), 3), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 残響の碑：黒い石の柱に、淡い青の紋様。有効になると光る
export function createEchoStone(materials) {
  const group = new THREE.Group();
  group.name = 'echo-stone';
  const pillar = new THREE.Mesh(worldUV(new THREE.CylinderGeometry(0.28, 0.42, 2.1, 6), 1), materials.stone);
  pillar.position.y = 1.05;
  pillar.castShadow = true;
  group.add(pillar);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.25, 6), materials.stone);
  base.position.y = 0.12;
  group.add(base);
  const glow = new THREE.MeshBasicMaterial({ color: '#7fd6ff', transparent: true, opacity: 0.25, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 6, 24), glow);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.5;
  group.add(ring);
  const light = new THREE.PointLight('#7fd6ff', 0, 7, 2);
  light.position.y = 1.6;
  group.add(light);
  let active = false;
  return {
    group,
    setActive(on) { active = on; },
    update(time) {
      const target = active ? 0.75 + 0.15 * Math.sin(time * 2) : 0.2;
      glow.opacity += (target - glow.opacity) * 0.1;
      light.intensity = active ? 3 + Math.sin(time * 2) : 0;
      ring.rotation.z = time * 0.4;
    },
  };
}

// 遠くの城：外壁・塔・尖った屋根。閉ざされた門。入れない
export function createCastle(material, { x = 0, z = -60, width = 70 } = {}) {
  const group = new THREE.Group();
  group.name = 'castle';
  group.add(box(material, width, 18, 6, x, 9, z));
  const gate = new THREE.Mesh(new THREE.BoxGeometry(7, 10, 0.6), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.8, metalness: 0.4 }));
  gate.position.set(x, 5, z + 3.2);
  group.add(gate);
  const towers = [[-width / 2, 30, 7], [width / 2, 30, 7], [-12, 36, 6], [12, 36, 6], [0, 58, 9], [-24, 44, 5], [24, 44, 5]];
  for (const [dx, h, r] of towers) {
    const zOffset = Math.abs(dx) < 15 ? -14 : 0;
    const tower = new THREE.Mesh(worldUV(new THREE.CylinderGeometry(r * 0.8, r, h, 12), 3), material);
    tower.position.set(x + dx, h / 2, z + zOffset);
    group.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 0.95, h * 0.45, 12), material);
    roof.position.set(x + dx, h + h * 0.225, z + zOffset);
    group.add(roof);
  }
  group.position.y = -2;
  return group;
}

// 遠景の崖の岩：暗い灰色（近くの石より沈ませて、遊ぶ場所を目立たせる）
export const cliffMaterial = new THREE.MeshStandardMaterial({ color: '#4a4c4b', roughness: 1, flatShading: true });

// 崖：大きな岩の塊を重ねる（遠景の峡谷の壁）
export function createCliffs(material, spots, random) {
  const group = new THREE.Group();
  material = cliffMaterial;
  for (const [x, z] of spots) {
    for (let i = 0; i < 4; i++) {
      const s = 8 + random() * 10;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), material);
      rock.position.set(x + (random() - 0.5) * 14, -20 + i * 9 + random() * 4, z + (random() - 0.5) * 14);
      rock.scale.y = 1.6 + random();
      rock.rotation.set(random(), random(), random());
      group.add(rock);
    }
  }
  return group;
}

export function waterPlane(material, width, depth) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  // 回転は rotation.y で付けたいので、平面そのものを寝かせておく
  mesh.geometry.rotateX(-Math.PI / 2);
  mesh.rotation.x = 0;
  return mesh;
}

// 白薔薇の茂み：Kenney の花（白く塗った花びら）を、葉の茂みと一緒に置く
export async function createRoseBushes(load = loadGLTF, lite = false) {
  const tryLoad = (path) => withFallback(load(asset(path)).then((gltf) => { measureModel(gltf.scene); return gltf.scene; }), () => null);
  const [flower, bush] = await Promise.all([tryLoad('models/forest/flower_yellow.glb'), tryLoad('models/forest/bush_detailed.glb')]);
  const prepare = (model, petal, leaf) => {
    model?.traverse((part) => {
      if (!part.isMesh) return;
      part.material = part.material.clone();
      const name = part.material.name.toLowerCase();
      part.material.color.set(name.includes('yellow') ? petal : leaf);
      part.material.roughness = 1;
    });
    return model;
  };
  prepare(flower, '#f4f2ea', '#3b5a32');
  prepare(bush, '#f4f2ea', '#2f4a2a');
  // 小さな草花は逆光や自分の影で真っ黒になるので、法線を上向きにし、影を受けず、裏返しても暗くしない
  for (const model of [flower, bush]) {
    model?.traverse((part) => {
      if (!part.isMesh) return;
      part.geometry = part.geometry.clone();
      const normal = part.geometry.getAttribute('normal');
      for (let i = 0; i < normal.count; i++) normal.setXYZ(i, 0, 1, 0);
      part.material.side = THREE.DoubleSide;
      part.material.customProgramCacheKey = () => 'rose-up-normal';
      part.material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_begin>',
          THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''),
        );
      };
    });
  }
  return (spots) => {
    const group = new THREE.Group();
    group.name = 'white-roses';
    const dummy = new THREE.Object3D();
    const place = (model, list, size, scaleOf) => {
      if (!model || list.length === 0) return;
      model.updateMatrixWorld(true);
      const height = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
      model.traverse((part) => {
        if (!part.isMesh) return;
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        list.forEach((spot, i) => {
          dummy.position.set(spot.x, spot.y, spot.z);
          dummy.rotation.set(0, spot.x * 3.1 + spot.z, 0);
          dummy.scale.setScalar((size * scaleOf(spot)) / height);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix.clone().multiply(part.matrixWorld));
        });
        mesh.computeBoundingSphere();
        mesh.receiveShadow = false;
        group.add(mesh);
      });
    };
    place(bush, spots.filter((_, i) => i % (lite ? 3 : 2) === 0), 0.9, (s) => s.scale);
    place(flower, spots, 0.55, (s) => s.scale);
    return group;
  };
}
