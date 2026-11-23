import * as THREE from 'three';
import { UpdatableService } from '../core/Engine';
import { clamp, smoothstep } from '../core/MathNoise';
import { TerrainService, WATER_LEVEL } from './TerrainService';
import { TextureService } from './TextureService';
import { VegetationService } from './VegetationService';

const CHUNK_SIZE = 96;
const CHUNK_SEGMENTS = 32;
const RENDER_RADIUS = 5; // 11x11 chunks (~1050m across)
const MAX_CHUNKS_PER_FRAME = 2;

interface ChunkEntry {
  key: string;
  cx: number;
  cz: number;
  group: THREE.Group;
  terrainGeo: THREE.BufferGeometry;
}

export class ChunkService implements UpdatableService {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private terrain: TerrainService;
  private vegetation: VegetationService;
  private terrainMat: THREE.MeshStandardMaterial;

  private chunks = new Map<string, ChunkEntry>();
  private lastCenterCx = Number.NaN;
  private lastCenterCz = Number.NaN;
  private pendingQueue: Array<{ cx: number; cz: number; distSq: number }> = [];

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    terrain: TerrainService,
    textures: TextureService,
    vegetation: VegetationService
  ) {
    this.scene = scene;
    this.camera = camera;
    this.terrain = terrain;
    this.vegetation = vegetation;

    this.terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: textures.terrainDetailTexture,
      roughness: 0.9,
      metalness: 0.02,
    });
  }

  get loadedCount(): number {
    return this.chunks.size;
  }

  /**
   * Synchronously build initial chunks around the starting camera so the first frame is populated.
   */
  warmup(): void {
    const cx = Math.floor(this.camera.position.x / CHUNK_SIZE);
    const cz = Math.floor(this.camera.position.z / CHUNK_SIZE);
    this.refreshQueue(cx, cz);
    // Build immediate 3x3 + Samosir/village chunks right away
    let built = 0;
    while (this.pendingQueue.length > 0 && built < 28) {
      const next = this.pendingQueue.shift()!;
      this.createChunk(next.cx, next.cz);
      built++;
    }
  }

  update(): void {
    const cx = Math.floor(this.camera.position.x / CHUNK_SIZE);
    const cz = Math.floor(this.camera.position.z / CHUNK_SIZE);

    if (cx !== this.lastCenterCx || cz !== this.lastCenterCz) {
      this.lastCenterCx = cx;
      this.lastCenterCz = cz;
      this.refreshQueue(cx, cz);
      this.unloadFarChunks(cx, cz);
    }

    let built = 0;
    while (this.pendingQueue.length > 0 && built < MAX_CHUNKS_PER_FRAME) {
      const next = this.pendingQueue.shift()!;
      const key = `${next.cx},${next.cz}`;
      if (!this.chunks.has(key)) {
        this.createChunk(next.cx, next.cz);
        built++;
      }
    }
  }

  private refreshQueue(centerCx: number, centerCz: number): void {
    const list: Array<{ cx: number; cz: number; distSq: number }> = [];
    for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
      for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
        const distSq = dx * dx + dz * dz;
        if (distSq > (RENDER_RADIUS + 0.5) * (RENDER_RADIUS + 0.5)) continue;
        const cx = centerCx + dx;
        const cz = centerCz + dz;
        const key = `${cx},${cz}`;
        if (!this.chunks.has(key)) {
          list.push({ cx, cz, distSq });
        }
      }
    }
    list.sort((a, b) => a.distSq - b.distSq);
    this.pendingQueue = list;
  }

  private unloadFarChunks(centerCx: number, centerCz: number): void {
    const maxDistSq = (RENDER_RADIUS + 2) * (RENDER_RADIUS + 2);
    for (const [key, entry] of this.chunks.entries()) {
      const dx = entry.cx - centerCx;
      const dz = entry.cz - centerCz;
      if (dx * dx + dz * dz > maxDistSq) {
        this.scene.remove(entry.group);
        entry.terrainGeo.dispose();
        this.chunks.delete(key);
      }
    }
  }

  private createChunk(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    const group = new THREE.Group();
    group.name = `chunk_${key}`;

    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const baseX = cx * CHUNK_SIZE + CHUNK_SIZE * 0.5;
    const baseZ = cz * CHUNK_SIZE + CHUNK_SIZE * 0.5;
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    const cSand = new THREE.Color(0xc7b38a);
    const cGrass = new THREE.Color(0x4a7c3a);
    const cLush = new THREE.Color(0x36652c);
    const cRock = new THREE.Color(0x6c6e72);
    const cDeep = new THREE.Color(0x2d4039);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const wx = baseX + lx;
      const wz = baseZ + lz;
      const wy = this.terrain.getHeight(wx, wz);
      pos.setY(i, wy);

      // Compute biome/slope vertex color
      const slope = this.terrain.getSlope(wx, wz);
      if (wy < WATER_LEVEL - 1.5) {
        tmp.copy(cDeep);
      } else if (wy < WATER_LEVEL + 1.8) {
        const t = smoothstep(WATER_LEVEL - 1.5, WATER_LEVEL + 1.8, wy);
        tmp.copy(cDeep).lerp(cSand, t);
      } else {
        const grassMix = clamp((wy - 12) / 36, 0, 1);
        tmp.copy(cGrass).lerp(cLush, grassMix);
        const shoreMix = 1 - smoothstep(WATER_LEVEL + 1.2, WATER_LEVEL + 4.2, wy);
        tmp.lerp(cSand, shoreMix * 0.7);

        // Steep caldera cliffs -> rock
        const rockMask = smoothstep(0.42, 0.92, slope);
        tmp.lerp(cRock, rockMask);
      }

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.terrainMat);
    mesh.position.set(baseX, 0, baseZ);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    group.add(mesh);

    // Populate procedural trees, bushes, boulders
    this.vegetation.populateChunk(cx, cz, CHUNK_SIZE, group);

    this.scene.add(group);
    this.chunks.set(key, { key, cx, cz, group, terrainGeo: geo });
  }
}
