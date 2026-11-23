import * as THREE from 'three';
import { UpdatableService } from '../core/Engine';
import { EventBus } from '../core/EventBus';
import { smoothstep } from '../core/MathNoise';
import { ControlsService } from './ControlsService';
import { TerrainService, WATER_LEVEL } from './TerrainService';

interface TourStop {
  name: string;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startLook: THREE.Vector3;
  endLook: THREE.Vector3;
  duration: number;
}

export class CinematicService implements UpdatableService {
  private camera: THREE.PerspectiveCamera;
  private controls: ControlsService;
  private terrain: TerrainService;
  private bus: EventBus;

  public active = false;
  private stopIndex = 0;
  private stopTime = 0;
  private transitionTime = 0;
  private readonly transitionDuration = 2.2;

  private fromPos = new THREE.Vector3();
  private fromLook = new THREE.Vector3();
  private curPos = new THREE.Vector3();
  private curLook = new THREE.Vector3();

  private readonly stops: TourStop[] = [
    {
      name: 'Kaldera Danau Toba & Pulau Samosir',
      startPos: new THREE.Vector3(228, 42, 130),
      endPos: new THREE.Vector3(165, 34, 68),
      startLook: new THREE.Vector3(-12, 12, -10),
      endLook: new THREE.Vector3(20, 10, 5),
      duration: 10,
    },
    {
      name: 'Pulau Samosir & Gazebo Tepi Danau',
      startPos: new THREE.Vector3(160, 20, 48),
      endPos: new THREE.Vector3(148, 16, -24),
      startLook: new THREE.Vector3(105, 5, 10),
      endLook: new THREE.Vector3(118, 4, 12),
      duration: 9,
    },
    {
      name: 'Desa Adat Rumah Bolon',
      startPos: new THREE.Vector3(276, 22, -62),
      endPos: new THREE.Vector3(340, 24, -72),
      startLook: new THREE.Vector3(322, 7, -34),
      endLook: new THREE.Vector3(325, 6, -25),
      duration: 9,
    },
    {
      name: 'Pasar Pinggir Danau & Dermaga',
      startPos: new THREE.Vector3(256, 20, 46),
      endPos: new THREE.Vector3(282, 22, -12),
      startLook: new THREE.Vector3(322, 5, 25),
      endLook: new THREE.Vector3(295, 4, 24),
      duration: 9,
    },
    {
      name: 'Hotel Danau Toba & Boulevard Pesisir',
      startPos: new THREE.Vector3(215, 26, 280),
      endPos: new THREE.Vector3(115, 24, 286),
      startLook: new THREE.Vector3(155, 8, 345),
      endLook: new THREE.Vector3(140, 7, 352),
      duration: 10,
    },
    {
      name: 'Perumahan, Warung & Area Camping',
      startPos: new THREE.Vector3(55, 24, 274),
      endPos: new THREE.Vector3(-82, 20, 266),
      startLook: new THREE.Vector3(45, 5, 355),
      endLook: new THREE.Vector3(-60, 4, 296),
      duration: 10,
    },
    {
      name: 'Taman Wisata Air & Tempat Wisata',
      startPos: new THREE.Vector3(-135, 28, 278),
      endPos: new THREE.Vector3(-252, 26, 264),
      startLook: new THREE.Vector3(-160, 6, 355),
      endLook: new THREE.Vector3(-228, 5, 305),
      duration: 10,
    },
  ];

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: ControlsService,
    terrain: TerrainService,
    bus: EventBus
  ) {
    this.camera = camera;
    this.controls = controls;
    this.terrain = terrain;
    this.bus = bus;

    bus.on('cinematic:toggle', () => {
      this.setActive(!this.active);
    });
  }

  setActive(enabled: boolean): void {
    if (this.active === enabled) return;
    this.active = enabled;
    this.controls.cinematicOverride = enabled;

    if (enabled) {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      this.stopIndex = 0;
      this.stopTime = 0;
      this.transitionTime = 0;
      this.fromPos.copy(this.camera.position);
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.fromLook.copy(this.camera.position).addScaledVector(dir, 40);
      this.bus.emit('cinematic:status', {
        active: true,
        label: this.stops[0].name,
      });
    } else {
      // Sync manual controls yaw/pitch with current camera orientation
      const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.controls.yaw = euler.y;
      this.controls.pitch = euler.x;
      this.bus.emit('cinematic:status', { active: false, label: '' });
    }
  }

  update(dt: number): void {
    if (!this.active) return;

    const stop = this.stops[this.stopIndex];
    this.stopTime += dt;
    this.transitionTime += dt;

    const t = Math.min(this.stopTime / stop.duration, 1);
    const eased = smoothstep(0, 1, t);

    this.curPos.lerpVectors(stop.startPos, stop.endPos, eased);
    this.curLook.lerpVectors(stop.startLook, stop.endLook, eased);

    // Smoothly blend from previous stop/camera position
    if (this.transitionTime < this.transitionDuration) {
      const bt = smoothstep(0, 1, this.transitionTime / this.transitionDuration);
      this.curPos.lerpVectors(this.fromPos, this.curPos, bt);
      this.curLook.lerpVectors(this.fromLook, this.curLook, bt);
    }

    // Safety ground/water clearance
    const minY = Math.max(this.terrain.getHeight(this.curPos.x, this.curPos.z) + 2.5, WATER_LEVEL + 1.8);
    if (this.curPos.y < minY) this.curPos.y = minY;

    this.camera.position.copy(this.curPos);
    this.camera.lookAt(this.curLook);

    if (this.stopTime >= stop.duration) {
      this.fromPos.copy(this.curPos);
      this.fromLook.copy(this.curLook);
      this.stopIndex = (this.stopIndex + 1) % this.stops.length;
      this.stopTime = 0;
      this.transitionTime = 0;
      this.bus.emit('cinematic:status', {
        active: true,
        label: this.stops[this.stopIndex].name,
      });
    }
  }
}
