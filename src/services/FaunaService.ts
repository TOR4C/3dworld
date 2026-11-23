import * as THREE from 'three';
import { UpdatableService } from '../core/Engine';
import { mulberry32 } from '../core/MathNoise';
import { AtmosphereService } from './AtmosphereService';
import { WATER_LEVEL } from './TerrainService';

interface BirdAgent {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  centerX: number;
  centerZ: number;
  radius: number;
  baseY: number;
  speed: number;
  phase: number;
  flapSpeed: number;
}

interface DuckAgent {
  group: THREE.Group;
  centerX: number;
  centerZ: number;
  radius: number;
  speed: number;
  phase: number;
}

export class FaunaService implements UpdatableService {
  private birds: BirdAgent[] = [];
  private ducks: DuckAgent[] = [];
  private fireflies: THREE.Points;
  private firefliesMat: THREE.PointsMaterial;
  private fireflyBase: Float32Array;
  private atmosphere: AtmosphereService;

  constructor(scene: THREE.Scene, atmosphere: AtmosphereService) {
    this.atmosphere = atmosphere;
    const rng = mulberry32(2026);

    // 1. Soaring Birds (Eagles & Herons)
    const bodyGeo = new THREE.ConeGeometry(0.18, 0.9, 5);
    bodyGeo.rotateX(Math.PI / 2);
    const wingGeo = new THREE.BoxGeometry(1.1, 0.04, 0.36);
    wingGeo.translate(0.55, 0, 0);
    const birdMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.75 });
    const whiteBirdMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 });

    for (let i = 0; i < 22; i++) {
      const group = new THREE.Group();
      const mat = i % 3 === 0 ? whiteBirdMat : birdMat;
      const body = new THREE.Mesh(bodyGeo, mat);
      const leftWing = new THREE.Mesh(wingGeo, mat);
      const rightWing = new THREE.Mesh(wingGeo, mat);
      rightWing.scale.x = -1;
      group.add(body, leftWing, rightWing);
      group.scale.setScalar(0.8 + rng() * 0.6);
      scene.add(group);

      this.birds.push({
        group,
        leftWing,
        rightWing,
        centerX: (rng() - 0.5) * 340 + 80,
        centerZ: (rng() - 0.5) * 340,
        radius: 35 + rng() * 85,
        baseY: 28 + rng() * 44,
        speed: 0.16 + rng() * 0.14,
        phase: rng() * Math.PI * 2,
        flapSpeed: 5.5 + rng() * 3.0,
      });
    }

    // 2. Swimming Waterfowl near the pier & Samosir shore
    const duckBodyGeo = new THREE.SphereGeometry(0.28, 8, 6);
    duckBodyGeo.scale(1.0, 0.7, 1.5);
    const duckHeadGeo = new THREE.SphereGeometry(0.14, 7, 6);
    const duckMat = new THREE.MeshStandardMaterial({ color: 0x78553a, roughness: 0.8 });

    for (let i = 0; i < 12; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(duckBodyGeo, duckMat);
      body.position.y = 0.12;
      const head = new THREE.Mesh(duckHeadGeo, duckMat);
      head.position.set(0, 0.34, 0.32);
      group.add(body, head);
      scene.add(group);

      const nearPier = i < 7;
      this.ducks.push({
        group,
        centerX: nearPier ? 255 + (rng() - 0.5) * 24 : 138 + (rng() - 0.5) * 20,
        centerZ: nearPier ? 24 + (rng() - 0.5) * 26 : 12 + (rng() - 0.5) * 22,
        radius: 4 + rng() * 9,
        speed: 0.28 + rng() * 0.25,
        phase: rng() * Math.PI * 2,
      });
    }

    // 3. Fireflies / Butterflies near lakeside village & Samosir
    const count = 140;
    const pos = new Float32Array(count * 3);
    this.fireflyBase = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const fx = 280 + rng() * 95;
      const fy = 2.5 + rng() * 7.5;
      const fz = -55 + rng() * 110;
      pos[i * 3] = fx;
      pos[i * 3 + 1] = fy;
      pos[i * 3 + 2] = fz;
      this.fireflyBase[i * 3] = fx;
      this.fireflyBase[i * 3 + 1] = fy;
      this.fireflyBase[i * 3 + 2] = fz;
    }
    const fGeo = new THREE.BufferGeometry();
    fGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.firefliesMat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 0.38,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    this.fireflies = new THREE.Points(fGeo, this.firefliesMat);
    scene.add(this.fireflies);
  }

  update(_dt: number, elapsed: number): void {
    // Update birds
    for (const b of this.birds) {
      const angle = elapsed * b.speed + b.phase;
      const x = b.centerX + Math.cos(angle) * b.radius;
      const z = b.centerZ + Math.sin(angle) * b.radius;
      const y = b.baseY + Math.sin(elapsed * 0.7 + b.phase) * 3.5;

      b.group.position.set(x, y, z);
      // Face tangent direction
      b.group.rotation.y = -angle;
      b.group.rotation.z = 0.22; // gentle banking

      const flap = Math.sin(elapsed * b.flapSpeed + b.phase) * 0.45;
      b.leftWing.rotation.z = flap;
      b.rightWing.rotation.z = -flap;
    }

    // Update ducks
    for (const d of this.ducks) {
      const angle = elapsed * d.speed + d.phase;
      const x = d.centerX + Math.cos(angle) * d.radius;
      const z = d.centerZ + Math.sin(angle) * d.radius;
      d.group.position.set(x, WATER_LEVEL + Math.sin(elapsed * 2.2 + d.phase) * 0.03, z);
      d.group.rotation.y = -angle;
    }

    // Update fireflies / butterflies
    const pos = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length / 3; i++) {
      const idx = i * 3;
      arr[idx] = this.fireflyBase[idx] + Math.sin(elapsed * 0.9 + i) * 1.4;
      arr[idx + 1] = this.fireflyBase[idx + 1] + Math.sin(elapsed * 1.4 + i * 1.7) * 0.7;
      arr[idx + 2] = this.fireflyBase[idx + 2] + Math.cos(elapsed * 0.8 + i * 1.3) * 1.4;
    }
    pos.needsUpdate = true;

    // Brighter at night/dusk, subtle by day
    const sunAngle = (this.atmosphere.timeOfDay - 0.25) * Math.PI * 2;
    const isNight = Math.sin(sunAngle) < 0.05;
    this.firefliesMat.color.setHex(isNight ? 0xfde047 : 0xfbbf24);
    this.firefliesMat.size = isNight ? 0.48 : 0.26;
  }
}
