import * as THREE from 'three';
import { UpdatableService } from '../core/Engine';
import { EventBus, WeatherType } from '../core/EventBus';
import { lerp } from '../core/MathNoise';
import { AtmosphereService } from './AtmosphereService';

export class WeatherService implements UpdatableService {
  public currentWeather: WeatherType = 'clear';

  private atmosphere: AtmosphereService;
  private camera: THREE.Camera;
  private rainLines: THREE.LineSegments;
  private rainMat: THREE.LineBasicMaterial;
  private rainPositions: Float32Array;
  private readonly dropCount = 1400;

  private targetFogMult = 1.0;
  private targetDim = 1.0;
  private rainOpacity = 0.0;
  private autoTimer = 0;

  constructor(scene: THREE.Scene, camera: THREE.Camera, atmosphere: AtmosphereService, bus: EventBus) {
    this.camera = camera;
    this.atmosphere = atmosphere;

    // 3D Rain streaks
    this.rainPositions = new Float32Array(this.dropCount * 6);
    for (let i = 0; i < this.dropCount; i++) {
      this.resetDrop(i, 0, 0, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(geo, this.rainMat);
    this.rainLines.frustumCulled = false;
    scene.add(this.rainLines);

    bus.on('weather:change', (w) => {
      this.setWeather(w);
      this.autoTimer = 0;
    });
  }

  setWeather(w: WeatherType): void {
    this.currentWeather = w;
    if (w === 'clear') {
      this.targetFogMult = 1.0;
      this.targetDim = 1.0;
    } else if (w === 'mist') {
      this.targetFogMult = 2.85;
      this.targetDim = 0.82;
    } else {
      this.targetFogMult = 2.4;
      this.targetDim = 0.58;
    }
  }

  private resetDrop(i: number, cx: number, cy: number, cz: number): void {
    const x = cx + (Math.random() - 0.5) * 90;
    const y = cy + Math.random() * 55 - 10;
    const z = cz + (Math.random() - 0.5) * 90;
    const idx = i * 6;
    this.rainPositions[idx] = x;
    this.rainPositions[idx + 1] = y;
    this.rainPositions[idx + 2] = z;
    this.rainPositions[idx + 3] = x - 0.25;
    this.rainPositions[idx + 4] = y - 1.6;
    this.rainPositions[idx + 5] = z - 0.15;
  }

  update(dt: number): void {
    // Gentle automatic weather cycle every ~95 seconds
    this.autoTimer += dt;
    if (this.autoTimer > 95) {
      this.autoTimer = 0;
      const order: WeatherType[] = ['clear', 'mist', 'rain'];
      const next = order[(order.indexOf(this.currentWeather) + 1) % order.length];
      this.setWeather(next);
    }

    const t = 1 - Math.exp(-1.5 * dt);
    this.atmosphere.weatherFogMultiplier = lerp(this.atmosphere.weatherFogMultiplier, this.targetFogMult, t);
    this.atmosphere.weatherDimFactor = lerp(this.atmosphere.weatherDimFactor, this.targetDim, t);

    const targetRain = this.currentWeather === 'rain' ? 0.52 : 0;
    this.rainOpacity = lerp(this.rainOpacity, targetRain, t);
    this.rainMat.opacity = this.rainOpacity;
    this.rainLines.visible = this.rainOpacity > 0.02;

    if (this.rainLines.visible) {
      const cx = this.camera.position.x;
      const cy = this.camera.position.y;
      const cz = this.camera.position.z;
      const fallY = 38 * dt;
      const windX = -3.2 * dt;
      const windZ = -1.8 * dt;

      for (let i = 0; i < this.dropCount; i++) {
        const idx = i * 6;
        this.rainPositions[idx] += windX;
        this.rainPositions[idx + 1] -= fallY;
        this.rainPositions[idx + 2] += windZ;
        this.rainPositions[idx + 3] += windX;
        this.rainPositions[idx + 4] -= fallY;
        this.rainPositions[idx + 5] += windZ;

        if (
          this.rainPositions[idx + 1] < cy - 22 ||
          Math.abs(this.rainPositions[idx] - cx) > 50 ||
          Math.abs(this.rainPositions[idx + 2] - cz) > 50
        ) {
          this.resetDrop(i, cx, cy + 28, cz);
        }
      }
      this.rainLines.geometry.attributes.position.needsUpdate = true;
    }
  }
}
