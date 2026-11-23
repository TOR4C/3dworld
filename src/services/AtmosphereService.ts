import * as THREE from 'three';
import { UpdatableService } from '../core/Engine';
import { EventBus } from '../core/EventBus';
import { clamp, mulberry32 } from '../core/MathNoise';
import { SettlementService } from './SettlementService';
import { WaterService } from './WaterService';

export class AtmosphereService implements UpdatableService {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private water: WaterService;
  private settlement: SettlementService;

  public timeOfDay = 0.38; // Start at bright morning (~09:08)
  public cycleSpeed = 0.0045; // ~220 seconds per full day/night cycle
  public paused = false;
  public weatherFogMultiplier = 1.0;
  public weatherDimFactor = 1.0;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private skyMat: THREE.ShaderMaterial;
  private skyMesh: THREE.Mesh;
  private stars: THREE.Points;
  private starsMat: THREE.PointsMaterial;

  private sunDir = new THREE.Vector3();
  private skyTop = new THREE.Color();
  private skyHorizon = new THREE.Color();
  private fogColor = new THREE.Color();

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    water: WaterService,
    settlement: SettlementService,
    bus: EventBus
  ) {
    this.scene = scene;
    this.camera = camera;
    this.water = water;
    this.settlement = settlement;

    this.hemiLight = new THREE.HemisphereLight(0x8ecae6, 0x3b4d2b, 0.75);
    scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4d6, 2.0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 420;
    const d = 140;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Procedural Sky Dome
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(0x2563eb) },
        uHorizonColor: { value: new THREE.Color(0x93c5fd) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(0xfff3c4) },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        varying vec3 vWorldDir;
        void main() {
          float h = clamp(vWorldDir.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.58));
          float sunDot = max(dot(normalize(vWorldDir), normalize(uSunDir)), 0.0);
          float halo = pow(sunDot, 14.0) * 0.32;
          float disc = smoothstep(0.9985, 0.9996, sunDot) * 1.4;
          col += uSunColor * (halo + disc);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(1450, 24, 16), this.skyMat);
    scene.add(this.skyMesh);

    // Procedural Stars
    const starCount = 900;
    const starPos = new Float32Array(starCount * 3);
    const rng = mulberry32(777);
    for (let i = 0; i < starCount; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(0.05 + rng() * 0.95);
      const r = 1350;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 2.6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeo, this.starsMat);
    scene.add(this.stars);

    bus.on('time:set', (t) => {
      this.timeOfDay = ((t % 1) + 1) % 1;
    });
    bus.on('time:toggle-pause', () => {
      this.paused = !this.paused;
    });
  }

  update(dt: number): void {
    if (!this.paused) {
      this.timeOfDay = (this.timeOfDay + dt * this.cycleSpeed) % 1;
    }

    // Sun angle: 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 0/1 = midnight
    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle) * 0.85;
    const sunZ = 0.35;
    this.sunDir.set(sunX, sunY, sunZ).normalize();

    const dayFactor = clamp((sunY + 0.12) / 0.45, 0, 1);
    const sunsetFactor = Math.exp(-Math.pow(sunY / 0.18, 2));
    const nightFactor = 1 - dayFactor;

    // Sky & fog colors
    const dayTop = new THREE.Color(0x2563eb);
    const dayHoriz = new THREE.Color(0x93c5fd);
    const sunsetTop = new THREE.Color(0x3b2f63);
    const sunsetHoriz = new THREE.Color(0xf59e0b);
    const nightTop = new THREE.Color(0x050914);
    const nightHoriz = new THREE.Color(0x0f172a);

    this.skyTop.copy(nightTop).lerp(dayTop, dayFactor).lerp(sunsetTop, sunsetFactor * 0.65);
    this.skyHorizon.copy(nightHoriz).lerp(dayHoriz, dayFactor).lerp(sunsetHoriz, sunsetFactor * 0.75);

    // Weather overcast dim
    const overcast = new THREE.Color(0x64748b);
    const dimMix = 1 - this.weatherDimFactor;
    this.skyTop.lerp(overcast, dimMix * 0.75);
    this.skyHorizon.lerp(overcast, dimMix * 0.8);

    this.fogColor.copy(this.skyHorizon);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.fogColor);
      this.scene.fog.density = 0.00115 * this.weatherFogMultiplier;
    }

    // Update sky & stars
    this.skyMesh.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.skyMat.uniforms.uTopColor.value.copy(this.skyTop);
    this.skyMat.uniforms.uHorizonColor.value.copy(this.skyHorizon);
    this.skyMat.uniforms.uSunDir.value.copy(this.sunDir);
    this.starsMat.opacity = clamp(nightFactor * 0.9 * this.weatherDimFactor, 0, 0.9);

    // Sun shadow follows camera XZ
    const cx = Math.round(this.camera.position.x / 10) * 10;
    const cz = Math.round(this.camera.position.z / 10) * 10;
    const lightDir = sunY > -0.05 ? this.sunDir : this.sunDir.clone().negate();
    this.sunLight.position.set(cx, 0, cz).addScaledVector(lightDir, 180);
    this.sunLight.target.position.set(cx, 0, cz);

    const sunColor = new THREE.Color(0xfff4d6).lerp(new THREE.Color(0xff8c42), sunsetFactor * 0.8);
    if (sunY <= -0.05) {
      this.sunLight.color.setHex(0x8fb3e8);
      this.sunLight.intensity = 0.35 * nightFactor;
    } else {
      this.sunLight.color.copy(sunColor);
      this.sunLight.intensity = (0.3 + dayFactor * 2.1) * this.weatherDimFactor;
    }

    this.hemiLight.intensity = (0.28 + dayFactor * 0.58) * (0.65 + 0.35 * this.weatherDimFactor);
    this.hemiLight.color.copy(this.skyTop).lerp(new THREE.Color(0xffffff), 0.35);

    this.water.setTint(this.skyHorizon, dayFactor);
    this.settlement.setNightFactor(nightFactor);
  }
}
