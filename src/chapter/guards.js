// 霧に侵された衛兵の見た目（KayKit Skeleton_Warrior、CC0）。頭脳は src/story/guard.js。
// 予備動作の間は、足もとに斬撃の届く扇を橙色で出す（避ける合図）。倒れたら霧に溶けるように沈む。
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadGLTF, measureModel, withFallback } from '../assets.js';
import { asset } from '../paths.js';
import { GUARD } from '../story/guard.js';

const HEIGHT = 1.9;
const FADE = 0.15;

function sectorGeometry(radius, spread) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = -spread / 2 + (spread * i) / steps;
    shape.lineTo(Math.sin(a) * radius, Math.cos(a) * radius);
  }
  shape.lineTo(0, 0);
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

// 仮の体（モデルが読めないとき）：灰色の人型
function placeholder() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 8), new THREE.MeshStandardMaterial({ color: '#8a8f86' }));
  body.position.y = 0.95;
  group.add(body);
  return group;
}

export async function createGuardViews(scene, posts, heightAt, { load = loadGLTF } = {}) {
  const [warrior, blade] = await Promise.all([
    withFallback(load(asset('models/skeleton_warrior.glb')).then((gltf) => { measureModel(gltf.scene); return gltf; }), () => null),
    withFallback(load(asset('models/skeleton_blade.glb')).then((gltf) => gltf.scene), () => null),
  ]);

  const telegraphMaterial = new THREE.MeshBasicMaterial({ color: '#ff8a2b', transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const telegraphGeometry = sectorGeometry(GUARD.reach, GUARD.spread);

  const views = new Map();
  for (const post of posts) {
    const object = new THREE.Group();
    object.name = post.id;
    let mixer = null;
    let actions = {};
    let eyes = [];
    if (warrior) {
      const body = cloneSkinned(warrior.scene);
      const { box, size } = measureModel(body);
      body.scale.setScalar(HEIGHT / size.y);
      body.position.y = -box.min.y * body.scale.y;
      body.traverse((part) => {
        if (!part.isMesh) return;
        part.castShadow = true;
        part.material = part.material.clone();
        // 霧に侵された色：骨は灰緑に、目は淡く光る
        if (part.name.includes('Eyes')) {
          part.material.emissive = new THREE.Color('#9fe7c8');
          part.material.emissiveIntensity = 1.4;
          eyes.push(part);
        } else {
          part.material.color.multiply(new THREE.Color('#b8c2b4'));
        }
      });
      const hand = body.getObjectByName('handslot.r');
      if (blade && hand) hand.add(blade.clone());
      object.add(body);
      mixer = new THREE.AnimationMixer(body);
      actions = Object.fromEntries(warrior.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
    } else {
      object.add(placeholder());
    }
    // 体のまわりの薄い霧
    const mist = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#a9b8ae', transparent: true, opacity: 0.12, depthWrite: false }),
    );
    mist.position.y = 1;
    mist.scale.set(1, 1.4, 1);
    object.add(mist);
    const telegraph = new THREE.Mesh(telegraphGeometry, telegraphMaterial.clone());
    telegraph.visible = false;
    scene.add(telegraph);
    scene.add(object);
    views.set(post.id, { object, mixer, actions, current: null, telegraph, mist, eyes, deadTime: 0, flash: 0 });
  }

  function play(view, { name, loop, timeScale }) {
    const action = view.actions[name];
    if (!action) return;
    action.timeScale = timeScale;
    if (view.current === name) return;
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    view.actions[view.current]?.fadeOut(FADE);
    action.reset().fadeIn(FADE).play();
    view.current = name;
  }

  // frames：頭脳の frame の配列。windup の経過を 0〜1 で渡すと、扇が濃くなる
  function update(dt, frames, time) {
    for (const frame of frames) {
      const view = views.get(frame.id);
      if (!view) continue;
      view.object.position.set(frame.x, heightAt(frame.x, frame.z, frame.id), frame.z);
      view.object.rotation.y = frame.facing;
      play(view, frame.animation);
      view.mixer?.update(dt);

      // 倒れたら 2 秒後から沈んで消える
      if (frame.phase === 'dead') {
        if (view.deadTime >= 10) { view.object.visible = false; view.telegraph.visible = false; continue; }
        view.deadTime += dt;
        if (view.deadTime > 2) view.object.position.y -= (view.deadTime - 2) * 0.8;
        view.object.visible = view.deadTime < 4;
        view.mist.material.opacity = Math.max(0, 0.12 - view.deadTime * 0.04);
      } else {
        view.deadTime = 0;
        view.object.visible = true;
        view.mist.material.opacity = 0.1 + 0.03 * Math.sin(time * 2 + frame.x);
      }

      // 予備動作の扇
      const showing = frame.telegraph;
      view.telegraph.visible = showing;
      if (showing) {
        view.telegraph.position.set(frame.x, heightAt(frame.x, frame.z, frame.id) + 0.05, frame.z);
        view.telegraph.rotation.y = frame.facing;
        view.telegraph.material.opacity = Math.min(0.55, view.telegraph.material.opacity + dt * 1.2);
      } else {
        view.telegraph.material.opacity = 0;
      }

      // 斬られた瞬間の白い光
      if (view.flash > 0) {
        view.flash = Math.max(0, view.flash - dt);
        view.object.traverse((part) => {
          if (part.isMesh && part.material.emissive && !view.eyes.includes(part)) {
            part.material.emissive.setScalar(view.flash * 2.5);
          }
        });
      }
    }
  }

  // 保存で倒してある衛兵：最初から消しておく
  function hide(id) {
    const view = views.get(id);
    if (!view) return;
    view.deadTime = 10;
    view.object.visible = false;
  }

  function hitFlash(id) {
    const view = views.get(id);
    if (view) view.flash = 0.18;
  }

  function dispose() {
    for (const view of views.values()) {
      scene.remove(view.object, view.telegraph);
      view.mixer?.stopAllAction();
      view.object.traverse((part) => { part.geometry?.dispose(); });
    }
    views.clear();
  }

  return { update, hitFlash, hide, dispose, object: (id) => views.get(id)?.object };
}
