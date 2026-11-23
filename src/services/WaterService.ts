import * as THREE from 'three';
import { UpdatableService } from '../core/Engine';
import { WATER_LEVEL } from './TerrainService';
import { TextureService } from './TextureService';

export class WaterService implements UpdatableService {
  private mesh: THREE.Mesh;
  private material: THREE.MeshStandardMaterial;
  private normalTex: THREE.CanvasTexture;
  private camera: THREE.Camera;

  constructor(scene: THREE.Scene, camera: THREE.Camera, textures: TextureService) {
    this.camera = camera;
    this.normalTex = textures.waterNormalTexture;
    this.normalTex.repeat.set(36, 36);

    const geo = new THREE.PlaneGeometry(2400, 2400, 1, 1);
    geo.rotateX(-Math.PI / 2);

    this.material = new THREE.MeshStandardMaterial({
      color: 0x165e73,
      normalMap: this.normalTex,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.14,
      metalness: 0.3,
      transparent: true,
      opacity: 0.88,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = WATER_LEVEL;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  setTint(color: THREE.Color, skyMix: number): void {
    const dayWater = new THREE.Color(0x16647a);
    const nightWater = new THREE.Color(0x091a28);
    this.material.color.copy(nightWater).lerp(dayWater, skyMix).lerp(color, 0.22);
  }

  update(dt: number, elapsed: number): void {
    // Follow camera XZ in large steps so ripples stay world-locked without jitter
    const snap = 2400 / 36;
    this.mesh.position.x = Math.round(this.camera.position.x / snap) * snap;
    this.mesh.position.z = Math.round(this.camera.position.z / snap) * snap;

    this.normalTex.offset.x = (elapsed * 0.018) % 1;
    this.normalTex.offset.y = (elapsed * 0.012 + Math.sin(elapsed * 0.2) * 0.004) % 1;
    void dt;
  }
}
