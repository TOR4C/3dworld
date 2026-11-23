import * as THREE from 'three';
import { UpdatableService } from '../core/Engine';
import { clamp } from '../core/MathNoise';
import { TerrainService, WATER_LEVEL } from './TerrainService';

export interface TouchInputState {
  moveX: number; // -1..1 (strafe)
  moveY: number; // -1..1 (forward = +1, back = -1)
  ascend: boolean;
  descend: boolean;
  boost: boolean;
}

export class ControlsService implements UpdatableService {
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private terrain: TerrainService;

  public yaw = 0;
  public pitch = -0.14;
  public baseSpeed = 24;
  public readonly boostMultiplier = 2.8;
  public isPointerLocked = false;
  public currentSpeed = 0;

  private velocity = new THREE.Vector3();
  private keys = new Set<string>();
  private touchState: TouchInputState = {
    moveX: 0,
    moveY: 0,
    ascend: false,
    descend: false,
    boost: false,
  };

  // Dedicated pointerId for touch-look on canvas so it never conflicts with joystick/buttons
  private lookPointerId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;

  private forwardVec = new THREE.Vector3();
  private rightVec = new THREE.Vector3();
  private upVec = new THREE.Vector3(0, 1, 0);
  private targetVel = new THREE.Vector3();

  private onLockChangeCallback?: (locked: boolean) => void;

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, terrain: TerrainService) {
    this.camera = camera;
    this.canvas = canvas;
    this.terrain = terrain;

    // Starting scenic vantage point overlooking Lake Toba, Pulau Samosir, Pasar & Rumah Bolon
    this.camera.position.set(228, 36, 118);
    this.yaw = 0.92;
    this.pitch = -0.15;
    this.applyRotation();

    this.bindEvents();
  }

  onLockChange(cb: (locked: boolean) => void): void {
    this.onLockChangeCallback = cb;
  }

  getTouchState(): TouchInputState {
    return this.touchState;
  }

  private bindEvents(): void {
    // Pointer Lock on canvas click (desktop)
    this.canvas.addEventListener('click', () => {
      const isTouch = 'ontouchstart' in window && navigator.maxTouchPoints > 0 && window.innerWidth < 1024;
      if (!isTouch && document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
      this.onLockChangeCallback?.(this.isPointerLocked);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;
      const sens = 0.0022;
      this.yaw -= e.movementX * sens;
      this.pitch = clamp(this.pitch - e.movementY * sens, -Math.PI * 0.47, Math.PI * 0.47);
    });

    // Touch look on canvas with dedicated pointerId tracking
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if (this.lookPointerId === null) {
        this.lookPointerId = e.pointerId;
        this.lastLookX = e.clientX;
        this.lastLookY = e.clientY;
        this.canvas.setPointerCapture?.(e.pointerId);
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointerId) return;
      const dx = e.clientX - this.lastLookX;
      const dy = e.clientY - this.lastLookY;
      this.lastLookX = e.clientX;
      this.lastLookY = e.clientY;

      const sens = 0.0042;
      this.yaw -= dx * sens;
      this.pitch = clamp(this.pitch - dy * sens, -Math.PI * 0.47, Math.PI * 0.47);
    });

    const endLook = (e: PointerEvent) => {
      if (e.pointerId === this.lookPointerId) {
        this.lookPointerId = null;
      }
    };
    this.canvas.addEventListener('pointerup', endLook);
    this.canvas.addEventListener('pointercancel', endLook);

    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });

    // Scroll wheel adjusts flying speed
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.14 : 0.88;
        this.baseSpeed = clamp(this.baseSpeed * factor, 6, 150);
      },
      { passive: false }
    );
  }

  private applyRotation(): void {
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  update(dt: number): void {
    this.applyRotation();

    // Forward vector includes pitch as required!
    this.camera.getWorldDirection(this.forwardVec).normalize();
    this.rightVec.crossVectors(this.forwardVec, this.upVec).normalize();

    let moveForward = 0;
    let moveRight = 0;
    let moveUp = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveForward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveForward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveRight += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveRight -= 1;
    if (this.keys.has('Space')) moveUp += 1;
    if (this.keys.has('KeyC')) moveUp -= 1;

    // Combine with mobile virtual joystick & buttons
    moveForward += this.touchState.moveY;
    moveRight += this.touchState.moveX;
    if (this.touchState.ascend) moveUp += 1;
    if (this.touchState.descend) moveUp -= 1;

    const isBoost =
      this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchState.boost;
    const speed = this.baseSpeed * (isBoost ? this.boostMultiplier : 1);

    this.targetVel.set(0, 0, 0);
    this.targetVel.addScaledVector(this.forwardVec, moveForward);
    this.targetVel.addScaledVector(this.rightVec, moveRight);
    this.targetVel.addScaledVector(this.upVec, moveUp);

    if (this.targetVel.lengthSq() > 1) {
      this.targetVel.normalize();
    }
    this.targetVel.multiplyScalar(speed);

    // Smooth exponential velocity damping (never teleport per frame)
    const damping = 8.5;
    const alpha = 1 - Math.exp(-damping * dt);
    this.velocity.lerp(this.targetVel, alpha);

    this.camera.position.addScaledVector(this.velocity, dt);

    // Prevent penetrating terrain or diving underwater
    const terrainY = this.terrain.getHeight(this.camera.position.x, this.camera.position.z);
    const minY = Math.max(terrainY + 2.0, WATER_LEVEL + 1.4);
    if (this.camera.position.y < minY) {
      this.camera.position.y = minY;
      if (this.velocity.y < 0) {
        this.velocity.y = 0;
      }
    }

    this.currentSpeed = this.velocity.length();
  }
}
