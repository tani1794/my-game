import * as THREE from 'three';

export function heightAt() {
  return 0;
}

// ── フィールド：地面と岩。岩の見た目と当たり判定を同じデータで管理 ──
export function createTerrain(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({
      color: '#354c46',
      roughness: 1,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(60, 30, 0x608b88, 0x405e59);
  grid.position.y = 0.01;
  scene.add(grid);

  const colliders = [];
  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: '#677b85',
    roughness: 0.95,
  });

  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const distance = 10 + (i % 3) * 3;
    const radius = 0.7 + (i % 4) * 0.2;

    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.scale.set(radius, radius * 1.4, radius);
    rock.position.set(
      Math.cos(angle) * distance,
      radius * 0.8,
      Math.sin(angle) * distance,
    );
    scene.add(rock);

    colliders.push({
      x: rock.position.x,
      z: rock.position.z,
      radius,
    });
  }

  return { colliders, heightAt };
}
