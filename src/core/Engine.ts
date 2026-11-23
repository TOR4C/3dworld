import * as THREE from 'three';

export interface UpdatableService {
  update(dt: number, elapsed: number): void;
}

export class Engine {
  public readonly canvas: HTMLCanvasElement;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly isWebGL2: boolean;

  private services: UpdatableService[] = [];
  private rafId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  public currentFps = 60;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Explicitly target WebGL2 context
    const gl2 = canvas.getContext('webgl2', {
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl2 ?? undefined,
      antialias: true,
      powerPreference: 'high-performance',
    });

    this.isWebGL2 = this.renderer.capabilities.isWebGL2;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x9ec5e6, 0.0014);

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.5,
      1800
    );

    window.addEventListener('resize', this.onResize);
  }

  registerService(service: UpdatableService): void {
    this.services.push(service);
  }

  start(): void {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      this.rafId = requestAnimationFrame(tick);
      const rawDt = (now - this.lastTime) * 0.001;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      this.elapsed += dt;

      this.fpsAccum += rawDt;
      this.fpsFrames++;
      if (this.fpsAccum >= 0.5) {
        this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }

      for (const s of this.services) {
        s.update(dt, this.elapsed);
      }

      this.renderer.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };
}
