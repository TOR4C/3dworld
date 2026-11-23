import * as THREE from 'three';
import { hash2D, mulberry32 } from '../core/MathNoise';
import { SETTLEMENT_ZONES, TerrainService, WATER_LEVEL } from './TerrainService';
import { TextureService } from './TextureService';

export class VegetationService {
  private terrain: TerrainService;

  private pineTrunkGeo: THREE.BufferGeometry;
  private pineCrownGeo: THREE.BufferGeometry;
  private pineTrunkMat: THREE.MeshStandardMaterial;
  private pineCrownMat: THREE.MeshStandardMaterial;

  private broadTrunkGeo: THREE.BufferGeometry;
  private broadCrownGeo: THREE.BufferGeometry;
  private broadCrownMat: THREE.MeshStandardMaterial;

  private bushGeo: THREE.BufferGeometry;
  private bushMat: THREE.MeshStandardMaterial;

  private rockGeo: THREE.BufferGeometry;
  private rockMat: THREE.MeshStandardMaterial;

  constructor(terrain: TerrainService, textures: TextureService) {
    this.terrain = terrain;

    // 1. Toba Pine Trunk & Multi-tier Crown (merged manually into 2 draw calls per chunk)
    this.pineTrunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 4.2, 6);
    this.pineTrunkGeo.translate(0, 2.1, 0);
    this.pineTrunkMat = new THREE.MeshStandardMaterial({
      map: textures.barkTexture,
      roughness: 0.92,
      metalness: 0.02,
    });

    this.pineCrownGeo = this.buildMergedPineCrown();
    this.pineCrownMat = new THREE.MeshStandardMaterial({
      color: 0x2d5a34,
      roughness: 0.85,
      metalness: 0.02,
    });

    // 2. Tropical Broadleaf Tree
    this.broadTrunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 3.2, 6);
    this.broadTrunkGeo.translate(0, 1.6, 0);

    this.broadCrownGeo = this.buildMergedBroadCrown();
    this.broadCrownMat = new THREE.MeshStandardMaterial({
      color: 0x3b7233,
      roughness: 0.84,
      metalness: 0.02,
    });

    // 3. Bush / Shrub
    this.bushGeo = new THREE.DodecahedronGeometry(0.75, 1);
    this.bushGeo.scale(1.2, 0.72, 1.2);
    this.bushGeo.translate(0, 0.42, 0);
    this.bushMat = new THREE.MeshStandardMaterial({
      color: 0x457d38,
      roughness: 0.88,
    });

    // 4. Boulder / Rock
    this.rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    this.rockGeo.scale(1.2, 0.75, 1.0);
    this.rockMat = new THREE.MeshStandardMaterial({
      map: textures.stoneTexture,
      roughness: 0.92,
      metalness: 0.05,
    });
  }

  private mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
    let totalVerts = 0;
    let totalIndices = 0;
    for (const g of geos) {
      totalVerts += g.attributes.position.count;
      totalIndices += g.index ? g.index.count : g.attributes.position.count;
    }
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const indices = new Uint32Array(totalIndices);

    let vOffset = 0;
    let iOffset = 0;
    for (const g of geos) {
      const pos = g.attributes.position;
      const norm = g.attributes.normal;
      positions.set(pos.array as Float32Array, vOffset * 3);
      normals.set(norm.array as Float32Array, vOffset * 3);
      if (g.index) {
        const idxArr = g.index.array;
        for (let i = 0; i < idxArr.length; i++) {
          indices[iOffset + i] = idxArr[i] + vOffset;
        }
        iOffset += idxArr.length;
      } else {
        for (let i = 0; i < pos.count; i++) {
          indices[iOffset + i] = vOffset + i;
        }
        iOffset += pos.count;
      }
      vOffset += pos.count;
      g.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    return merged;
  }

  private buildMergedPineCrown(): THREE.BufferGeometry {
    const c1 = new THREE.ConeGeometry(2.05, 3.2, 7);
    c1.translate(0, 4.1, 0);
    const c2 = new THREE.ConeGeometry(1.62, 2.8, 7);
    c2.translate(0, 5.7, 0);
    const c3 = new THREE.ConeGeometry(1.12, 2.4, 7);
    c3.translate(0, 7.1, 0);
    return this.mergeGeometries([c1, c2, c3]);
  }

  private buildMergedBroadCrown(): THREE.BufferGeometry {
    const s1 = new THREE.IcosahedronGeometry(1.85, 1);
    s1.scale(1.15, 0.85, 1.15);
    s1.translate(0, 4.2, 0);
    const s2 = new THREE.IcosahedronGeometry(1.3, 1);
    s2.translate(0.9, 3.8, 0.45);
    const s3 = new THREE.IcosahedronGeometry(1.25, 1);
    s3.translate(-0.85, 3.9, -0.4);
    return this.mergeGeometries([s1, s2, s3]);
  }

  private isInsideSettlement(x: number, z: number): boolean {
    for (let i = 0; i < SETTLEMENT_ZONES.length; i++) {
      const zPad = SETTLEMENT_ZONES[i];
      if (Math.hypot(x - zPad.x, z - zPad.z) < zPad.radius + 4) {
        return true;
      }
    }
    return false;
  }

  populateChunk(cx: number, cz: number, chunkSize: number, targetGroup: THREE.Group): void {
    const seed = Math.floor(hash2D(cx, cz, 888) * 100000);
    const rng = mulberry32(seed);
    const baseX = cx * chunkSize;
    const baseZ = cz * chunkSize;

    const pineTransforms: { x: number; y: number; z: number; s: number; rot: number; tint: number }[] = [];
    const broadTransforms: { x: number; y: number; z: number; s: number; rot: number; tint: number }[] = [];
    const bushTransforms: { x: number; y: number; z: number; s: number; rot: number }[] = [];
    const rockTransforms: { x: number; y: number; z: number; s: number; rot: number }[] = [];

    // Sample candidate points
    const treeAttempts = 54;
    for (let i = 0; i < treeAttempts; i++) {
      const wx = baseX + rng() * chunkSize;
      const wz = baseZ + rng() * chunkSize;
      if (this.isInsideSettlement(wx, wz)) continue;

      const wy = this.terrain.getHeight(wx, wz);
      if (wy < WATER_LEVEL + 1.1) continue;

      const slope = this.terrain.getSlope(wx, wz);
      if (slope > 0.95) continue;

      const s = 0.72 + rng() * 0.75;
      const rot = rng() * Math.PI * 2;
      const tint = 0.85 + rng() * 0.3;

      if (wy > 16 || rng() < 0.62) {
        pineTransforms.push({ x: wx, y: wy - 0.15, z: wz, s, rot, tint });
      } else {
        broadTransforms.push({ x: wx, y: wy - 0.15, z: wz, s, rot, tint });
      }
    }

    const bushAttempts = 36;
    for (let i = 0; i < bushAttempts; i++) {
      const wx = baseX + rng() * chunkSize;
      const wz = baseZ + rng() * chunkSize;
      if (this.isInsideSettlement(wx, wz)) continue;
      const wy = this.terrain.getHeight(wx, wz);
      if (wy < WATER_LEVEL + 0.5 || wy > 45) continue;
      if (this.terrain.getSlope(wx, wz) > 1.05) continue;
      bushTransforms.push({ x: wx, y: wy - 0.1, z: wz, s: 0.65 + rng() * 0.85, rot: rng() * Math.PI * 2 });
    }

    const rockAttempts = 18;
    for (let i = 0; i < rockAttempts; i++) {
      const wx = baseX + rng() * chunkSize;
      const wz = baseZ + rng() * chunkSize;
      if (this.isInsideSettlement(wx, wz)) continue;
      const wy = this.terrain.getHeight(wx, wz);
      if (wy < WATER_LEVEL - 0.4) continue;
      const slope = this.terrain.getSlope(wx, wz);
      if (slope < 0.25 && wy > WATER_LEVEL + 2.5 && rng() > 0.3) continue;
      rockTransforms.push({ x: wx, y: wy - 0.2, z: wz, s: 0.6 + rng() * 1.4, rot: rng() * Math.PI * 2 });
    }

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    if (pineTransforms.length > 0) {
      const trunks = new THREE.InstancedMesh(this.pineTrunkGeo, this.pineTrunkMat, pineTransforms.length);
      const crowns = new THREE.InstancedMesh(this.pineCrownGeo, this.pineCrownMat, pineTransforms.length);
      trunks.castShadow = true;
      trunks.receiveShadow = true;
      crowns.castShadow = true;
      crowns.receiveShadow = true;

      for (let i = 0; i < pineTransforms.length; i++) {
        const t = pineTransforms[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        crowns.setMatrixAt(i, dummy.matrix);
        color.setRGB(0.18 * t.tint, 0.38 * t.tint, 0.21 * t.tint);
        crowns.setColorAt(i, color);
      }
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
      targetGroup.add(trunks, crowns);
    }

    if (broadTransforms.length > 0) {
      const trunks = new THREE.InstancedMesh(this.broadTrunkGeo, this.pineTrunkMat, broadTransforms.length);
      const crowns = new THREE.InstancedMesh(this.broadCrownGeo, this.broadCrownMat, broadTransforms.length);
      trunks.castShadow = true;
      crowns.castShadow = true;
      crowns.receiveShadow = true;

      for (let i = 0; i < broadTransforms.length; i++) {
        const t = broadTransforms[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        crowns.setMatrixAt(i, dummy.matrix);
        color.setRGB(0.24 * t.tint, 0.48 * t.tint, 0.2 * t.tint);
        crowns.setColorAt(i, color);
      }
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
      targetGroup.add(trunks, crowns);
    }

    if (bushTransforms.length > 0) {
      const bushes = new THREE.InstancedMesh(this.bushGeo, this.bushMat, bushTransforms.length);
      bushes.castShadow = true;
      bushes.receiveShadow = true;
      for (let i = 0; i < bushTransforms.length; i++) {
        const t = bushTransforms[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        bushes.setMatrixAt(i, dummy.matrix);
      }
      bushes.instanceMatrix.needsUpdate = true;
      targetGroup.add(bushes);
    }

    if (rockTransforms.length > 0) {
      const rocks = new THREE.InstancedMesh(this.rockGeo, this.rockMat, rockTransforms.length);
      rocks.castShadow = true;
      rocks.receiveShadow = true;
      for (let i = 0; i < rockTransforms.length; i++) {
        const t = rockTransforms[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(t.rot * 0.3, t.rot, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
      }
      rocks.instanceMatrix.needsUpdate = true;
      targetGroup.add(rocks);
    }
  }
}
