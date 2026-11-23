import * as THREE from 'three';
import { UpdatableService } from '../core/Engine';
import { TerrainService, WATER_LEVEL } from './TerrainService';
import { TextureService } from './TextureService';

const WATER_SIZE = 2200;
const WATER_SEGMENTS = 100;
const GRID_STEP = WATER_SIZE / WATER_SEGMENTS;

export class WaterService implements UpdatableService {
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private camera: THREE.Camera;
  private terrain: TerrainService;
  private depthAttr: THREE.BufferAttribute;

  private lastSnapX = Number.NaN;
  private lastSnapZ = Number.NaN;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    textures: TextureService,
    terrain: TerrainService
  ) {
    this.camera = camera;
    this.terrain = terrain;

    const geo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const vertCount = geo.attributes.position.count;
    const depths = new Float32Array(vertCount);
    this.depthAttr = new THREE.BufferAttribute(depths, 1);
    geo.setAttribute('aDepth', this.depthAttr);

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms: {
        uTime: { value: 0 },
        uNormalMap: { value: textures.waterNormalTexture },
        uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(0xfff4d6) },
        uSkyTop: { value: new THREE.Color(0x2563eb) },
        uSkyHorizon: { value: new THREE.Color(0x93c5fd) },
        uFogColor: { value: new THREE.Color(0x93c5fd) },
        uFogDensity: { value: 0.00115 },
        uDayFactor: { value: 1.0 },
      },
      vertexShader: `
        attribute float aDepth;
        uniform float uTime;

        varying vec3 vWorldPos;
        varying float vDepth;
        varying float vWaveSlopeX;
        varying float vWaveSlopeZ;

        void main() {
          vDepth = aDepth;
          vec4 worldBase = modelMatrix * vec4(position, 1.0);

          // Dampen deep-water waves close to shore, add rolling shoreline swell
          float shoreDamp = clamp(aDepth / 2.2, 0.12, 1.0);
          float shoreZone = smoothstep(0.0, 0.45, aDepth) * (1.0 - smoothstep(1.4, 4.5, aDepth));
          float shoreSwell = sin(aDepth * 3.2 + uTime * 2.2 + worldBase.x * 0.08 + worldBase.z * 0.08) * 0.14 * shoreZone;

          float w1 = sin(worldBase.x * 0.14 + uTime * 1.45 + worldBase.z * 0.06) * 0.14;
          float w2 = cos(worldBase.z * 0.18 - uTime * 1.25 + worldBase.x * 0.08) * 0.11;
          float w3 = sin((worldBase.x + worldBase.z) * 0.32 + uTime * 2.1) * 0.05;

          float waveY = (w1 + w2 + w3) * shoreDamp + shoreSwell;

          // Approximate wave derivatives for normal perturbation
          float dwDx = (cos(worldBase.x * 0.14 + uTime * 1.45 + worldBase.z * 0.06) * 0.14 * 0.14
                      - sin(worldBase.z * 0.18 - uTime * 1.25 + worldBase.x * 0.08) * 0.11 * 0.08
                      + cos((worldBase.x + worldBase.z) * 0.32 + uTime * 2.1) * 0.05 * 0.32) * shoreDamp;
          float dwDz = (cos(worldBase.x * 0.14 + uTime * 1.45 + worldBase.z * 0.06) * 0.14 * 0.06
                      - sin(worldBase.z * 0.18 - uTime * 1.25 + worldBase.x * 0.08) * 0.11 * 0.18
                      + cos((worldBase.x + worldBase.z) * 0.32 + uTime * 2.1) * 0.05 * 0.32) * shoreDamp;

          vWaveSlopeX = dwDx;
          vWaveSlopeZ = dwDz;

          vec3 displaced = position + vec3(0.0, waveY, 0.0);
          vec4 wp = modelMatrix * vec4(displaced, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uNormalMap;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSkyTop;
        uniform vec3 uSkyHorizon;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        uniform float uDayFactor;

        varying vec3 vWorldPos;
        varying float vDepth;
        varying float vWaveSlopeX;
        varying float vWaveSlopeZ;

        void main() {
          // Two scrolling normal map layers for shimmering water ripples
          vec2 uv1 = vWorldPos.xz * 0.032 + vec2(uTime * 0.022, uTime * 0.014);
          vec2 uv2 = vWorldPos.xz * 0.055 - vec2(uTime * 0.017, -uTime * 0.025);
          vec3 n1 = texture2D(uNormalMap, uv1).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(uNormalMap, uv2).xyz * 2.0 - 1.0;

          vec3 rippleN = normalize(vec3(
            (n1.x + n2.x) * 0.38 - vWaveSlopeX * 2.4,
            1.0,
            (n1.y + n2.y) * 0.38 - vWaveSlopeZ * 2.4
          ));

          vec3 viewDir = normalize(cameraPosition - vWorldPos);

          // Depth-based water color (lighter turquoise near shore, darker navy in deep caldera)
          float depthT = clamp(vDepth / 18.0, 0.0, 1.0);
          vec3 shallowCol = mix(vec3(0.04, 0.14, 0.18), vec3(0.11, 0.48, 0.54), uDayFactor);
          vec3 midCol     = mix(vec3(0.02, 0.08, 0.13), vec3(0.05, 0.27, 0.38), uDayFactor);
          vec3 deepCol    = mix(vec3(0.01, 0.03, 0.07), vec3(0.02, 0.11, 0.20), uDayFactor);

          vec3 waterCol = mix(shallowCol, midCol, smoothstep(0.0, 0.35, depthT));
          waterCol = mix(waterCol, deepCol, smoothstep(0.35, 1.0, depthT));

          // Fresnel sky reflection
          float fresnel = pow(1.0 - max(dot(rippleN, viewDir), 0.0), 3.6);
          fresnel = clamp(fresnel * 0.85 + 0.08, 0.0, 0.92);
          vec3 reflDir = reflect(-viewDir, rippleN);
          vec3 skyRefl = mix(uSkyHorizon, uSkyTop, clamp(reflDir.y * 0.8 + 0.15, 0.0, 1.0));
          vec3 col = mix(waterCol, skyRefl, fresnel);

          // Sun / Moon specular light reflection (glinting path across waves)
          vec3 lightDir = normalize(uSunDir);
          vec3 halfVec = normalize(lightDir + viewDir);
          float specCore = pow(max(dot(rippleN, halfVec), 0.0), 210.0) * 2.4;
          float specSheen = pow(max(dot(rippleN, halfVec), 0.0), 26.0) * 0.22;
          col += uSunColor * (specCore + specSheen);

          // Shoreline breaking wave bands & lapping foam at land-water border
          float surfZone = (1.0 - smoothstep(0.1, 3.8, vDepth)) * step(0.001, vDepth);
          float organicJitter = (n1.x + n2.y) * 0.85 + sin(vWorldPos.x * 0.22 + vWorldPos.z * 0.19) * 0.6;
          float wavePattern = sin(vDepth * 3.8 + uTime * 2.3 + organicJitter);
          float waveCrests = smoothstep(0.45, 0.94, wavePattern) * surfZone;
          float edgeFoam = (1.0 - smoothstep(0.0, 0.55, vDepth)) * step(0.001, vDepth);
          float totalFoam = clamp(waveCrests * 0.78 + edgeFoam * (0.65 + 0.35 * sin(uTime * 2.6 + organicJitter)), 0.0, 1.0);
          vec3 foamCol = vec3(0.88, 0.95, 0.99) * (0.38 + 0.62 * uDayFactor);
          col = mix(col, foamCol, totalFoam * 0.85);

          // Exponential squared fog matching scene.fog
          float dist = length(cameraPosition - vWorldPos);
          float fogFactor = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
          col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

          float alpha = clamp(0.68 + depthT * 0.28 + fresnel * 0.15, 0.68, 0.96);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = WATER_LEVEL;
    scene.add(this.mesh);
  }

  setAtmosphere(
    lightDir: THREE.Vector3,
    lightColor: THREE.Color,
    skyTop: THREE.Color,
    skyHorizon: THREE.Color,
    fogColor: THREE.Color,
    fogDensity: number,
    dayFactor: number
  ): void {
    this.material.uniforms.uSunDir.value.copy(lightDir);
    this.material.uniforms.uSunColor.value.copy(lightColor);
    this.material.uniforms.uSkyTop.value.copy(skyTop);
    this.material.uniforms.uSkyHorizon.value.copy(skyHorizon);
    this.material.uniforms.uFogColor.value.copy(fogColor);
    this.material.uniforms.uFogDensity.value = fogDensity;
    this.material.uniforms.uDayFactor.value = dayFactor;
  }

  private refreshDepths(centerX: number, centerZ: number): void {
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const arr = this.depthAttr.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const wx = centerX + pos.getX(i);
      const wz = centerZ + pos.getZ(i);
      const groundH = this.terrain.getHeight(wx, wz);
      arr[i] = Math.max(0, WATER_LEVEL - groundH);
    }
    this.depthAttr.needsUpdate = true;
  }

  update(_dt: number, elapsed: number): void {
    this.material.uniforms.uTime.value = elapsed;

    const snapX = Math.round(this.camera.position.x / GRID_STEP) * GRID_STEP;
    const snapZ = Math.round(this.camera.position.z / GRID_STEP) * GRID_STEP;

    if (snapX !== this.lastSnapX || snapZ !== this.lastSnapZ) {
      this.lastSnapX = snapX;
      this.lastSnapZ = snapZ;
      this.mesh.position.x = snapX;
      this.mesh.position.z = snapZ;
      this.refreshDepths(snapX, snapZ);
    }
  }
}
