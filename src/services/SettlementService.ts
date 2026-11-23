import * as THREE from 'three';
import { UpdatableService } from '../core/Engine';
import { TerrainService, WATER_LEVEL } from './TerrainService';
import { TextureService } from './TextureService';

export class SettlementService implements UpdatableService {
  private root = new THREE.Group();
  private boats: Array<{ mesh: THREE.Object3D; baseY: number; phase: number }> = [];
  private lanternLights: THREE.PointLight[] = [];
  private lanternMeshes: THREE.MeshStandardMaterial[] = [];

  constructor(scene: THREE.Scene, terrain: TerrainService, textures: TextureService) {
    this.root.name = 'DanauTobaLandmarks';

    // 1. Desa Rumah Bolon (East shore terrace)
    this.buildRumahBolon(314, -44, 0.35, terrain, textures, 1.0);
    this.buildRumahBolon(328, -28, 0.15, terrain, textures, 0.92);
    this.buildRumahBolon(356, -20, -0.45, terrain, textures, 1.05);
    this.buildRumahBolon(304, -22, 0.62, terrain, textures, 0.84);

    // 2. Pasar Pinggir Danau (Market Plaza at 332, 26)
    this.buildMarketPlaza(332, 26, terrain, textures);

    // 3. Lakeside Pier & Moored Boats (at 282, 24)
    this.buildPierAndBoats(282, 24, Math.PI, terrain, textures);

    // 4. Pulau Samosir Pier & Gazebo Spot (at 118, 12)
    this.buildSamosirSpot(118, 12, terrain, textures);

    scene.add(this.root);
  }

  private buildRumahBolon(
    x: number,
    z: number,
    rotY: number,
    terrain: TerrainService,
    textures: TextureService,
    scale = 1
  ): void {
    const y = terrain.getHeight(x, z);
    const house = new THREE.Group();
    house.position.set(x, y, z);
    house.rotation.y = rotY;
    house.scale.setScalar(scale);

    const darkWoodMat = new THREE.MeshStandardMaterial({
      map: textures.darkWoodTexture,
      roughness: 0.85,
    });
    const plankMat = new THREE.MeshStandardMaterial({
      map: textures.woodPlankTexture,
      roughness: 0.82,
    });
    const thatchMat = new THREE.MeshStandardMaterial({
      map: textures.thatchTexture,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const accentRedMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 });
    const accentWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 });

    // Wooden stilts (tiang)
    const stiltGeo = new THREE.CylinderGeometry(0.18, 0.22, 2.2, 8);
    const stiltCoords = [
      [-2.4, -3.2],
      [0, -3.2],
      [2.4, -3.2],
      [-2.4, 0],
      [2.4, 0],
      [-2.4, 3.2],
      [0, 3.2],
      [2.4, 3.2],
    ];
    for (const [sx, sz] of stiltCoords) {
      const stilt = new THREE.Mesh(stiltGeo, darkWoodMat);
      stilt.position.set(sx, 1.0, sz);
      stilt.castShadow = true;
      stilt.receiveShadow = true;
      house.add(stilt);
    }

    // Platform floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.3, 7.6), darkWoodMat);
    floor.position.y = 2.15;
    floor.castShadow = true;
    floor.receiveShadow = true;
    house.add(floor);

    // Main cabin walls (slightly outward-slanted Batak style)
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.4, 6.2), plankMat);
    body.position.y = 3.45;
    body.castShadow = true;
    body.receiveShadow = true;
    house.add(body);

    // Carved decorative front & back trim
    const trimFront = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.35, 0.16), accentRedMat);
    trimFront.position.set(0, 4.45, 3.12);
    const trimWhite = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.14, 0.18), accentWhiteMat);
    trimWhite.position.set(0, 4.45, 3.14);
    house.add(trimFront, trimWhite);

    // Saddle-back curved roof (custom curved vertex mesh)
    const roofGeo = this.createSaddleRoofGeometry(6.6, 9.6, 4.2, 1.8);
    const roof = new THREE.Mesh(roofGeo, thatchMat);
    roof.position.y = 4.55;
    roof.castShadow = true;
    roof.receiveShadow = true;
    house.add(roof);

    // Front wooden stairs
    for (let s = 0; s < 5; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.38), plankMat);
      step.position.set(0, 0.4 + s * 0.4, 4.4 - s * 0.28);
      step.castShadow = true;
      house.add(step);
    }

    // Porch lantern
    this.addLantern(house, 1.4, 3.9, 3.35, true);

    this.root.add(house);
  }

  private createSaddleRoofGeometry(width: number, length: number, peakH: number, sag: number): THREE.BufferGeometry {
    const segZ = 16;
    const segX = 8;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let iz = 0; iz <= segZ; iz++) {
      const tz = iz / segZ; // 0..1
      const z = (tz - 0.5) * length;
      // Saddle curve: higher at front & back ends, dipping in middle
      const endCurve = Math.pow((tz - 0.5) * 2, 2);
      const ridgeY = peakH - sag * (1 - endCurve);
      // Overhang flares outward at ends
      const flare = 1 + endCurve * 0.18;

      for (let ix = 0; ix <= segX; ix++) {
        const tx = ix / segX; // 0..1
        const side = (tx - 0.5) * 2; // -1..1
        const x = side * (width * 0.5) * flare;
        const y = ridgeY * (1 - Math.abs(side));
        positions.push(x, y, z);
        uvs.push(tx * 2, tz * 2);
      }
    }

    const row = segX + 1;
    for (let iz = 0; iz < segZ; iz++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = iz * row + ix;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private buildMarketPlaza(
    cx: number,
    cz: number,
    terrain: TerrainService,
    textures: TextureService
  ): void {
    const baseY = terrain.getHeight(cx, cz);
    const plaza = new THREE.Group();
    plaza.position.set(cx, baseY, cz);

    // Cobblestone market ground pad
    const padGeo = new THREE.CylinderGeometry(19, 20, 0.25, 24);
    const padMat = new THREE.MeshStandardMaterial({
      map: textures.stoneTexture,
      color: 0x9ca3af,
      roughness: 0.92,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 0.05;
    pad.receiveShadow = true;
    plaza.add(pad);

    const canopies = [textures.fabricRedTexture, textures.fabricBlueTexture, textures.fabricGoldTexture];
    const stallPositions = [
      { x: -9, z: -7, rot: 0.3 },
      { x: 0, z: -9.5, rot: 0.0 },
      { x: 9, z: -7, rot: -0.35 },
      { x: -10, z: 4, rot: 1.3 },
      { x: 10, z: 4, rot: -1.3 },
      { x: -4.5, z: 10.5, rot: Math.PI + 0.15 },
      { x: 4.5, z: 10.5, rot: Math.PI - 0.15 },
    ];

    stallPositions.forEach((sp, idx) => {
      this.buildMarketStall(plaza, sp.x, sp.z, sp.rot, canopies[idx % canopies.length], textures, idx === 1 || idx === 4);
    });

    // Central market tree/signpost & benches
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, 4.2, 8),
      new THREE.MeshStandardMaterial({ map: textures.darkWoodTexture, roughness: 0.85 })
    );
    pole.position.set(0, 2.1, 0);
    pole.castShadow = true;
    plaza.add(pole);
    this.addLantern(plaza, 0, 4.1, 0, true);

    this.root.add(plaza);
  }

  private buildMarketStall(
    parent: THREE.Group,
    x: number,
    z: number,
    rotY: number,
    canopyTex: THREE.CanvasTexture,
    textures: TextureService,
    hasLight: boolean
  ): void {
    const stall = new THREE.Group();
    stall.position.set(x, 0.15, z);
    stall.rotation.y = rotY;

    const woodMat = new THREE.MeshStandardMaterial({ map: textures.woodPlankTexture, roughness: 0.85 });
    const canopyMat = new THREE.MeshStandardMaterial({
      map: canopyTex,
      roughness: 0.88,
      side: THREE.DoubleSide,
    });

    // 4 wooden posts
    const postGeo = new THREE.CylinderGeometry(0.08, 0.09, 2.7, 6);
    for (const [px, pz] of [
      [-1.9, -1.1],
      [1.9, -1.1],
      [-1.9, 1.1],
      [1.9, 1.1],
    ]) {
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(px, 1.35, pz);
      post.castShadow = true;
      stall.add(post);
    }

    // Slanted fabric canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 3.0), canopyMat);
    canopy.position.set(0, 2.7, 0);
    canopy.rotation.x = 0.14;
    canopy.castShadow = true;
    stall.add(canopy);

    // Display table
    const table = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.14, 1.2), woodMat);
    table.position.set(0, 0.92, 0.2);
    table.castShadow = true;
    table.receiveShadow = true;
    stall.add(table);

    // Table legs
    const legGeo = new THREE.BoxGeometry(0.12, 0.9, 0.12);
    for (const lx of [-1.55, 1.55]) {
      for (const lz of [-0.3, 0.7]) {
        const leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(lx, 0.45, lz);
        stall.add(leg);
      }
    }

    // 3D Market goods: baskets, fruits, pottery jars
    const basketMat = new THREE.MeshStandardMaterial({ map: textures.thatchTexture, color: 0xc29b61, roughness: 0.9 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.6 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65 });
    const potMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.75 });

    for (let b = -1; b <= 1; b++) {
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.34, 10), basketMat);
      basket.position.set(b * 1.05, 1.16, 0.22);
      basket.castShadow = true;
      stall.add(basket);

      // Produce inside basket
      for (let f = 0; f < 4; f++) {
        const fruit = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 6),
          b === 0 ? greenMat : orangeMat
        );
        fruit.position.set(
          b * 1.05 + ((f % 2) - 0.5) * 0.22,
          1.34,
          0.22 + (Math.floor(f / 2) - 0.5) * 0.22
        );
        stall.add(fruit);
      }
    }

    // Clay jars beside stall
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.65, 10), potMat);
    jar.position.set(-2.2, 0.32, 0.5);
    jar.castShadow = true;
    stall.add(jar);

    if (hasLight) {
      this.addLantern(stall, 0, 2.45, 0.9, true);
    }

    parent.add(stall);
  }

  private buildPierAndBoats(
    x: number,
    z: number,
    dirAngle: number,
    terrain: TerrainService,
    textures: TextureService
  ): void {
    const pier = new THREE.Group();
    pier.position.set(x, WATER_LEVEL, z);
    pier.rotation.y = dirAngle;

    const woodMat = new THREE.MeshStandardMaterial({ map: textures.woodPlankTexture, roughness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ map: textures.darkWoodTexture, roughness: 0.88 });

    // Wooden deck extending into the lake (16m long)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 16), woodMat);
    deck.position.set(0, 0.95, 7.5);
    deck.castShadow = true;
    deck.receiveShadow = true;
    pier.add(deck);

    // Support pilings
    const pileGeo = new THREE.CylinderGeometry(0.14, 0.16, 3.6, 8);
    for (let pz = 1.5; pz <= 14.5; pz += 3.2) {
      for (const px of [-1.35, 1.35]) {
        const pile = new THREE.Mesh(pileGeo, darkMat);
        pile.position.set(px, -0.4, pz);
        pile.castShadow = true;
        pier.add(pile);
      }
    }

    this.addLantern(pier, 1.35, 2.1, 14.5, true);

    // Two moored traditional wooden boats
    this.createBoat(pier, 2.8, 11.5, 0.15, textures, 0);
    this.createBoat(pier, -2.9, 13.5, -0.25, textures, 2.1);

    this.root.add(pier);
    void terrain;
  }

  private buildSamosirSpot(
    x: number,
    z: number,
    terrain: TerrainService,
    textures: TextureService
  ): void {
    const y = terrain.getHeight(x, z);
    const spot = new THREE.Group();
    spot.position.set(x, y, z);

    const woodMat = new THREE.MeshStandardMaterial({ map: textures.woodPlankTexture, roughness: 0.84 });
    const thatchMat = new THREE.MeshStandardMaterial({ map: textures.thatchTexture, roughness: 0.92 });

    // Viewing Gazebo (Bale-bale)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.35, 8), woodMat);
    base.position.y = 0.2;
    base.receiveShadow = true;
    spot.add(base);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 6), woodMat);
      post.position.set(Math.cos(a) * 2.6, 1.6, Math.sin(a) * 2.6);
      post.castShadow = true;
      spot.add(post);
    }

    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.0, 2.2, 6), thatchMat);
    roof.position.y = 4.0;
    roof.castShadow = true;
    spot.add(roof);

    this.addLantern(spot, 0, 2.85, 0, true);
    this.root.add(spot);
  }

  private createBoat(
    parent: THREE.Group,
    x: number,
    z: number,
    rotY: number,
    textures: TextureService,
    phase: number
  ): void {
    const boat = new THREE.Group();
    boat.position.set(x, 0.12, z);
    boat.rotation.y = rotY;

    const hullMat = new THREE.MeshStandardMaterial({ map: textures.darkWoodTexture, roughness: 0.8 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 4.2), hullMat);
    hull.castShadow = true;
    boat.add(hull);

    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 4), hullMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.z = 2.6;
    boat.add(bow);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.1, 4.1), trimMat);
    stripe.position.y = 0.18;
    boat.add(stripe);

    parent.add(boat);
    this.boats.push({ mesh: boat, baseY: 0.12, phase });
  }

  private addLantern(parent: THREE.Group, x: number, y: number, z: number, withLight: boolean): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.4,
      roughness: 0.4,
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mat);
    globe.position.set(x, y, z);
    parent.add(globe);
    this.lanternMeshes.push(mat);

    if (withLight) {
      const light = new THREE.PointLight(0xffb347, 0, 18, 1.8);
      light.position.set(x, y - 0.1, z);
      parent.add(light);
      this.lanternLights.push(light);
    }
  }

  setNightFactor(nightFactor: number): void {
    const intensity = nightFactor * 2.8;
    for (const l of this.lanternLights) {
      l.intensity = intensity;
    }
    for (const m of this.lanternMeshes) {
      m.emissiveIntensity = 0.25 + nightFactor * 2.0;
    }
  }

  update(_dt: number, elapsed: number): void {
    for (const b of this.boats) {
      b.mesh.position.y = b.baseY + Math.sin(elapsed * 1.4 + b.phase) * 0.06;
      b.mesh.rotation.z = Math.sin(elapsed * 1.1 + b.phase) * 0.04;
      b.mesh.rotation.x = Math.cos(elapsed * 0.9 + b.phase) * 0.025;
    }
  }
}
