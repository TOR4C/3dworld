import * as THREE from 'three';
import { UpdatableService } from '../core/Engine';
import { hash2D, mulberry32 } from '../core/MathNoise';
import { EAST_COAST_CORRIDOR, LOWLAND_URBAN_BOUNDS, SETTLEMENT_ZONES, TerrainService, WATER_LEVEL } from './TerrainService';
import { TextureService } from './TextureService';

export class VegetationService implements UpdatableService {
  private terrain: TerrainService;

  private windUniforms = {
    uTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(0.85, 0.52).normalize() },
    uWindStrength: { value: 1.0 },
  };

  private pineTrunkGeo: THREE.BufferGeometry;
  private pineCrownGeo: THREE.BufferGeometry;
  private pineTrunkMat: THREE.MeshStandardMaterial;
  private pineCrownMat: THREE.MeshStandardMaterial;

  private broadTrunkGeo: THREE.BufferGeometry;
  private broadCrownGeo: THREE.BufferGeometry;
  private broadCrownMat: THREE.MeshStandardMaterial;

  public readonly palmTrunkGeo: THREE.BufferGeometry;
  public readonly palmCrownGeo: THREE.BufferGeometry;
  public readonly palmCrownMat: THREE.MeshStandardMaterial;

  public readonly shadeTrunkGeo: THREE.BufferGeometry;
  public readonly shadeCrownGeo: THREE.BufferGeometry;
  public readonly shadeCrownMat: THREE.MeshStandardMaterial;

  private bushGeo: THREE.BufferGeometry;
  private bushMat: THREE.MeshStandardMaterial;

  private grassGeo: THREE.BufferGeometry;
  private grassMat: THREE.MeshStandardMaterial;

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
    this.applyWindShader(this.pineCrownMat, 0.042);

    // 2. Tropical Broadleaf Tree
    this.broadTrunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 3.2, 6);
    this.broadTrunkGeo.translate(0, 1.6, 0);

    this.broadCrownGeo = this.buildMergedBroadCrown();
    this.broadCrownMat = new THREE.MeshStandardMaterial({
      color: 0x3b7233,
      roughness: 0.84,
      metalness: 0.02,
    });
    this.applyWindShader(this.broadCrownMat, 0.055);

    // 2b. Coastal Palm Tree (Palem / Kelapa)
    this.palmTrunkGeo = new THREE.CylinderGeometry(0.14, 0.28, 6.2, 6);
    this.palmTrunkGeo.translate(0, 3.1, 0);
    this.palmCrownGeo = this.buildMergedPalmCrown();
    this.palmCrownMat = new THREE.MeshStandardMaterial({
      color: 0x3d8b37,
      roughness: 0.8,
      metalness: 0.02,
    });
    this.applyWindShader(this.palmCrownMat, 0.085);

    // 2c. Umbrella Shade Tree (Trembesi / Flamboyan)
    this.shadeTrunkGeo = new THREE.CylinderGeometry(0.24, 0.45, 3.4, 7);
    this.shadeTrunkGeo.translate(0, 1.7, 0);
    this.shadeCrownGeo = this.buildMergedShadeCrown();
    this.shadeCrownMat = new THREE.MeshStandardMaterial({
      color: 0x2f6b32,
      roughness: 0.84,
      metalness: 0.02,
    });
    this.applyWindShader(this.shadeCrownMat, 0.05);

    // 3. Bush / Shrub
    this.bushGeo = new THREE.DodecahedronGeometry(0.75, 1);
    this.bushGeo.scale(1.2, 0.72, 1.2);
    this.bushGeo.translate(0, 0.42, 0);
    this.bushMat = new THREE.MeshStandardMaterial({
      color: 0x457d38,
      roughness: 0.88,
    });
    this.applyWindShader(this.bushMat, 0.14);

    // 3b. 3D Grass Tufts (Tanah Berumput)
    this.grassGeo = this.buildGrassTuftGeometry();
    this.grassMat = new THREE.MeshStandardMaterial({
      color: 0x56943d,
      roughness: 0.88,
      side: THREE.DoubleSide,
    });
    this.applyWindShader(this.grassMat, 0.34);

    // 4. Boulder / Rock
    this.rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    this.rockGeo.scale(1.2, 0.75, 1.0);
    this.rockMat = new THREE.MeshStandardMaterial({
      map: textures.stoneTexture,
      roughness: 0.92,
      metalness: 0.05,
    });
  }

  setWindStrength(strength: number): void {
    this.windUniforms.uWindStrength.value = strength;
  }

  update(_dt: number, elapsed: number): void {
    this.windUniforms.uTime.value = elapsed;
  }

  private applyWindShader(mat: THREE.MeshStandardMaterial, swayScale: number): void {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.windUniforms.uTime;
      shader.uniforms.uWindDir = this.windUniforms.uWindDir;
      shader.uniforms.uWindStrength = this.windUniforms.uWindStrength;
      shader.uniforms.uSwayScale = { value: swayScale };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform vec2 uWindDir;
          uniform float uWindStrength;
          uniform float uSwayScale;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 windAnchor = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #else
            vec3 windAnchor = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #endif
          float hFactor = max(0.0, transformed.y);
          float windPhase = dot(windAnchor.xz, uWindDir) * 0.16 + uTime * 2.15;
          float windGust = sin(windPhase) * 0.65 + sin(windPhase * 2.3 + windAnchor.x * 0.12) * 0.35;
          vec2 windOffset = uWindDir * windGust * uWindStrength * uSwayScale * hFactor;
          transformed.x += windOffset.x;
          transformed.z += windOffset.y;`
        );
    };
  }

  private buildGrassTuftGeometry(): THREE.BufferGeometry {
    const blades: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI + (i % 2) * 0.25;
      const blade = new THREE.ConeGeometry(0.11, 0.72, 3);
      blade.translate(0, 0.36, 0);
      blade.rotateZ((i % 2 === 0 ? 1 : -1) * 0.18);
      blade.rotateY(a);
      blades.push(blade);
    }
    return this.mergeGeometries(blades);
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

  private buildMergedPalmCrown(): THREE.BufferGeometry {
    const fronds: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leaf = new THREE.BoxGeometry(0.45, 0.08, 2.5);
      leaf.rotateX(0.32);
      leaf.translate(0, 6.0, 1.15);
      leaf.rotateY(a);
      fronds.push(leaf);
    }
    return this.mergeGeometries(fronds);
  }

  private buildMergedShadeCrown(): THREE.BufferGeometry {
    const c1 = new THREE.IcosahedronGeometry(2.6, 1);
    c1.scale(1.35, 0.52, 1.35);
    c1.translate(0, 4.1, 0);
    const c2 = new THREE.IcosahedronGeometry(1.7, 1);
    c2.scale(1.2, 0.55, 1.2);
    c2.translate(1.2, 3.7, 0.7);
    const c3 = new THREE.IcosahedronGeometry(1.6, 1);
    c3.scale(1.2, 0.55, 1.2);
    c3.translate(-1.1, 3.8, -0.6);
    return this.mergeGeometries([c1, c2, c3]);
  }

  private isInsideSettlement(x: number, z: number): boolean {
    if (
      x >= LOWLAND_URBAN_BOUNDS.minX - 6 &&
      x <= LOWLAND_URBAN_BOUNDS.maxX + 6 &&
      z >= LOWLAND_URBAN_BOUNDS.minZ - 6 &&
      z <= LOWLAND_URBAN_BOUNDS.maxZ + 6
    ) {
      return true;
    }
    if (
      x >= EAST_COAST_CORRIDOR.minX - 6 &&
      x <= EAST_COAST_CORRIDOR.maxX + 6 &&
      z >= EAST_COAST_CORRIDOR.minZ - 4 &&
      z <= EAST_COAST_CORRIDOR.maxZ + 4
    ) {
      return true;
    }
    for (let i = 0; i < SETTLEMENT_ZONES.length; i++) {
      const zPad = SETTLEMENT_ZONES[i];
      if (Math.hypot(x - zPad.x, z - zPad.z) < zPad.radius + 4) {
        return true;
      }
    }
    return false;
  }

  createOrnamentalTree(type: 'palm' | 'shade' | 'pine' | 'broad'): THREE.Group {
    const g = new THREE.Group();
    let trunkGeo = this.pineTrunkGeo;
    let crownGeo = this.pineCrownGeo;
    let crownMat = this.pineCrownMat;
    if (type === 'palm') {
      trunkGeo = this.palmTrunkGeo;
      crownGeo = this.palmCrownGeo;
      crownMat = this.palmCrownMat;
    } else if (type === 'shade') {
      trunkGeo = this.shadeTrunkGeo;
      crownGeo = this.shadeCrownGeo;
      crownMat = this.shadeCrownMat;
    } else if (type === 'broad') {
      trunkGeo = this.broadTrunkGeo;
      crownGeo = this.broadCrownGeo;
      crownMat = this.broadCrownMat;
    }
    const trunk = new THREE.Mesh(trunkGeo, this.pineTrunkMat);
    const crown = new THREE.Mesh(crownGeo, crownMat);
    trunk.castShadow = true;
    crown.castShadow = true;
    crown.receiveShadow = true;
    g.add(trunk, crown);
    return g;
  }

  populateChunk(cx: number, cz: number, chunkSize: number, targetGroup: THREE.Group): void {
    const seed = Math.floor(hash2D(cx, cz, 888) * 100000);
    const rng = mulberry32(seed);
    const baseX = cx * chunkSize;
    const baseZ = cz * chunkSize;

    const pineTransforms: { x: number; y: number; z: number; s: number; rot: number; tint: number }[] = [];
    const broadTransforms: { x: number; y: number; z: number; s: number; rot: number; tint: number }[] = [];
    const palmTransforms: { x: number; y: number; z: number; s: number; rot: number }[] = [];
    const shadeTransforms: { x: number; y: number; z: number; s: number; rot: number }[] = [];
    const bushTransforms: { x: number; y: number; z: number; s: number; rot: number }[] = [];
    const grassTransforms: { x: number; y: number; z: number; s: number; rot: number; tint: number }[] = [];
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

      if (wy < 6.5 && rng() < 0.35) {
        palmTransforms.push({ x: wx, y: wy - 0.15, z: wz, s, rot });
      } else if (wy < 18 && rng() < 0.25) {
        shadeTransforms.push({ x: wx, y: wy - 0.15, z: wz, s: s * 0.9, rot });
      } else if (wy > 16 || rng() < 0.62) {
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

    const grassAttempts = 210;
    for (let i = 0; i < grassAttempts; i++) {
      const wx = baseX + rng() * chunkSize;
      const wz = baseZ + rng() * chunkSize;
      if (this.isInsideSettlement(wx, wz)) continue;
      const wy = this.terrain.getHeight(wx, wz);
      if (wy < WATER_LEVEL + 0.9 || wy > 42) continue;
      if (this.terrain.getSlope(wx, wz) > 0.78) continue;
      grassTransforms.push({
        x: wx,
        y: wy - 0.05,
        z: wz,
        s: 0.75 + rng() * 0.9,
        rot: rng() * Math.PI * 2,
        tint: 0.8 + rng() * 0.4,
      });
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

    if (palmTransforms.length > 0) {
      const trunks = new THREE.InstancedMesh(this.palmTrunkGeo, this.pineTrunkMat, palmTransforms.length);
      const crowns = new THREE.InstancedMesh(this.palmCrownGeo, this.palmCrownMat, palmTransforms.length);
      trunks.castShadow = true;
      crowns.castShadow = true;
      for (let i = 0; i < palmTransforms.length; i++) {
        const t = palmTransforms[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        crowns.setMatrixAt(i, dummy.matrix);
      }
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      targetGroup.add(trunks, crowns);
    }

    if (shadeTransforms.length > 0) {
      const trunks = new THREE.InstancedMesh(this.shadeTrunkGeo, this.pineTrunkMat, shadeTransforms.length);
      const crowns = new THREE.InstancedMesh(this.shadeCrownGeo, this.shadeCrownMat, shadeTransforms.length);
      trunks.castShadow = true;
      crowns.castShadow = true;
      crowns.receiveShadow = true;
      for (let i = 0; i < shadeTransforms.length; i++) {
        const t = shadeTransforms[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        crowns.setMatrixAt(i, dummy.matrix);
      }
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
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

    if (palmTransforms.length > 0) {
      const trunks = new THREE.InstancedMesh(this.palmTrunkGeo, this.pineTrunkMat, palmTransforms.length);
      const crowns = new THREE.InstancedMesh(this.palmCrownGeo, this.palmCrownMat, palmTransforms.length);
      trunks.castShadow = true;
      crowns.castShadow = true;
      for (let i = 0; i < palmTransforms.length; i++) {
        const t = palmTransforms[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        crowns.setMatrixAt(i, dummy.matrix);
      }
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      targetGroup.add(trunks, crowns);
    }

    if (shadeTransforms.length > 0) {
      const trunks = new THREE.InstancedMesh(this.shadeTrunkGeo, this.pineTrunkMat, shadeTransforms.length);
      const crowns = new THREE.InstancedMesh(this.shadeCrownGeo, this.shadeCrownMat, shadeTransforms.length);
      trunks.castShadow = true;
      crowns.castShadow = true;
      crowns.receiveShadow = true;
      for (let i = 0; i < shadeTransforms.length; i++) {
        const t = shadeTransforms[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        crowns.setMatrixAt(i, dummy.matrix);
      }
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
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

    if (grassTransforms.length > 0) {
      const grasses = new THREE.InstancedMesh(this.grassGeo, this.grassMat, grassTransforms.length);
      grasses.receiveShadow = true;
      for (let i = 0; i < grassTransforms.length; i++) {
        const t = grassTransforms[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        grasses.setMatrixAt(i, dummy.matrix);
        color.setRGB(0.28 * t.tint, 0.56 * t.tint, 0.22 * t.tint);
        grasses.setColorAt(i, color);
      }
      grasses.instanceMatrix.needsUpdate = true;
      if (grasses.instanceColor) grasses.instanceColor.needsUpdate = true;
      targetGroup.add(grasses);
    }
  }

  createGrassPatch(
    count: number,
    width: number,
    depth: number,
    centerX: number,
    centerZ: number,
    groundY: number,
    seed = 777
  ): THREE.InstancedMesh {
    const rng = mulberry32(seed);
    const mesh = new THREE.InstancedMesh(this.grassGeo, this.grassMat, count);
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      dummy.position.set(
        centerX + (rng() - 0.5) * width,
        groundY - 0.03,
        centerZ + (rng() - 0.5) * depth
      );
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.65 + rng() * 0.75);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const tint = 0.85 + rng() * 0.35;
      color.setRGB(0.28 * tint, 0.58 * tint, 0.23 * tint);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }
}
