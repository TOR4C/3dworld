import * as THREE from 'three';
import { UpdatableService } from '../core/Engine';
import { EAST_COAST_CORRIDOR, LOWLAND_URBAN_BOUNDS } from './TerrainService';
import { TextureService } from './TextureService';
import { VegetationService } from './VegetationService';

export class UrbanService implements UpdatableService {
  private root = new THREE.Group();
  private streetLampMats: THREE.MeshStandardMaterial[] = [];
  private streetLights: THREE.PointLight[] = [];
  private windowMats: THREE.MeshStandardMaterial[] = [];
  private campfires: Array<{ flame: THREE.Mesh; light: THREE.PointLight; phase: number }> = [];
  private currentNightFactor = 0;

  constructor(scene: THREE.Scene, textures: TextureService, vegetation: VegetationService) {
    this.root.name = 'LakeshoreUrbanLowland';
    const groundY = LOWLAND_URBAN_BOUNDS.elevation;
    const eastY = EAST_COAST_CORRIDOR.elevation;

    // 1. Interconnected Asphalt Roads, Sidewalks (Trotoar), & Guardrails (Pembatas Jalan)
    this.buildRoadNetwork(groundY, eastY, textures);

    // 2. Hotel Danau Toba (Multi-story lakeside hotel + pool)
    this.buildHotel(138, 352, groundY, textures, vegetation);

    // 3. Perumahan dengan Vibes Berbeda-beda + Rumah Pinggir Jalan Timur
    this.buildResidentialClusters(groundY, eastY, textures, vegetation);

    // 4. Lapangan Parkiran (Asphalt Parking Lot + Parked Vehicles)
    this.buildParkingLot(248, 372, groundY, textures);

    // 5. Beberapa Warung / Toko Sederhana
    this.buildWarungs(groundY, eastY, textures);

    // 6. Area Camping Tepi Danau
    this.buildCampingArea(-62, 294, groundY, textures, vegetation);

    // 7. Taman Wisata Air (Water Park) & Tempat Wisata (Promenade, Bangunan, Tenda)
    this.buildWaterPark(-156, 358, groundY, textures, vegetation);
    this.buildTouristSpot(-236, 294, groundY, textures, vegetation);

    // 8. Tanah Berumput (3D Wind-swaying Grass Lawns)
    this.buildGrassLawns(groundY, vegetation);

    // 9. Roadside & Boulevard Trees (Palm, Shade, Broadleaf, Pine)
    this.plantBoulevardTrees(groundY, eastY, vegetation);

    scene.add(this.root);
  }

  private buildRoadNetwork(groundY: number, eastY: number, textures: TextureService): void {
    const asphaltMat = new THREE.MeshStandardMaterial({
      map: textures.asphaltTexture,
      roughness: 0.88,
      metalness: 0.05,
    });
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: textures.sidewalkTexture,
      roughness: 0.86,
    });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
    const whiteLineMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
    const yellowLineMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });

    // --- 1. Extended Southern Lakeside Boulevard (X: -262..298, Z: 318, width 10m) ---
    const blvdLen = 560;
    const blvdW = 10;
    const blvdX = 18;
    const blvdZ = 318;

    const blvdRoad = new THREE.Mesh(new THREE.BoxGeometry(blvdLen, 0.12, blvdW), asphaltMat);
    blvdRoad.position.set(blvdX, groundY + 0.06, blvdZ);
    blvdRoad.receiveShadow = true;
    this.root.add(blvdRoad);

    const edgeN = new THREE.Mesh(new THREE.BoxGeometry(blvdLen - 4, 0.02, 0.16), whiteLineMat);
    edgeN.position.set(blvdX, groundY + 0.125, blvdZ - 4.4);
    const edgeS = edgeN.clone();
    edgeS.position.z = blvdZ + 4.4;
    this.root.add(edgeN, edgeS);

    for (let x = -256; x < 292; x += 7.5) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.02, 0.18), yellowLineMat);
      dash.position.set(x, groundY + 0.125, blvdZ);
      this.root.add(dash);
    }

    // North Trotoar along Boulevard
    const swWidth = 2.6;
    const swNorth = new THREE.Mesh(new THREE.BoxGeometry(blvdLen - 8, 0.24, swWidth), sidewalkMat);
    swNorth.position.set(blvdX - 4, groundY + 0.12, blvdZ - blvdW / 2 - swWidth / 2);
    swNorth.receiveShadow = true;
    this.root.add(swNorth);

    // South Trotoar along Boulevard (segmented around all road/driveway openings)
    const southSegments: Array<[number, number]> = [
      [-260, -220],
      [-210, -162],
      [-150, -59],
      [-49, 45],
      [55, 132],
      [144, 190],
      [200, 243],
      [253, 289],
    ];
    for (const [sx1, sx2] of southSegments) {
      const segLen = sx2 - sx1;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.24, swWidth), sidewalkMat);
      seg.position.set((sx1 + sx2) * 0.5, groundY + 0.12, blvdZ + blvdW / 2 + swWidth / 2);
      seg.receiveShadow = true;
      this.root.add(seg);
    }

    // Water Park Entrance Driveway (x = -156, z = 323..335)
    const wpDrive = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 13), asphaltMat);
    wpDrive.position.set(-156, groundY + 0.06, 329);
    wpDrive.receiveShadow = true;
    this.root.add(wpDrive);

    // Hotel Entrance Driveway (connecting Boulevard z=323 to Hotel Forecourt z=334)
    const hotelDrive = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 12), asphaltMat);
    hotelDrive.position.set(138, groundY + 0.06, 328.5);
    hotelDrive.receiveShadow = true;
    this.root.add(hotelDrive);

    // Parking Lot Access Driveway (connecting Boulevard z=323 to Parking Lot z=358)
    const parkDrive = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 36), asphaltMat);
    parkDrive.position.set(248, groundY + 0.06, 340.5);
    parkDrive.receiveShadow = true;
    this.root.add(parkDrive);
    for (let dz = 326; dz < 356; dz += 6.5) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 3.0), whiteLineMat);
      dash.position.set(248, groundY + 0.125, dz);
      this.root.add(dash);
    }

    // Lakeside Guardrail (Pembatas Jalan) along North Sidewalk
    this.addGuardrailLine(-256, 286, blvdZ - blvdW / 2 - swWidth - 0.15, groundY, true);

    // --- 2. Eastern Coastal Connector Road (X: 294, Z: 44..323, width 9m) ---
    const eastLen = 280;
    const eastW = 9;
    const eastX = 294;
    const eastZ = 184;

    const eastRoad = new THREE.Mesh(new THREE.BoxGeometry(eastW, 0.14, eastLen), asphaltMat);
    eastRoad.position.set(eastX, eastY + 0.07, eastZ);
    eastRoad.receiveShadow = true;
    this.root.add(eastRoad);

    for (let z = 50; z < 312; z += 7.5) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 3.2), yellowLineMat);
      dash.position.set(eastX, eastY + 0.145, z);
      this.root.add(dash);
    }

    // Trotoar on both sides of Eastern Coastal Road (stop before Boulevard intersection z=313)
    const eastSwW = 2.2;
    const eastSwLen = 266;
    const eastSwZ = 179;
    const eastSwL = new THREE.Mesh(new THREE.BoxGeometry(eastSwW, 0.24, eastSwLen), sidewalkMat);
    eastSwL.position.set(eastX - eastW / 2 - eastSwW / 2, eastY + 0.12, eastSwZ);
    eastSwL.receiveShadow = true;
    const eastSwR = new THREE.Mesh(new THREE.BoxGeometry(eastSwW, 0.24, eastLen - 2), sidewalkMat);
    eastSwR.position.set(eastX + eastW / 2 + eastSwW / 2, eastY + 0.12, eastZ);
    eastSwR.receiveShadow = true;
    this.root.add(eastSwL, eastSwR);

    // Guardrail on lakeside (West) of Eastern Coastal Road
    this.addGuardrailLine(50, 308, eastX - eastW / 2 - eastSwW - 0.15, eastY, false);

    // Short connector from Eastern Road (294, 44) to Pasar Plaza (324, 44)
    const connRoad = new THREE.Mesh(new THREE.BoxGeometry(34, 0.14, 8), asphaltMat);
    connRoad.position.set(310, eastY + 0.07, 44);
    connRoad.receiveShadow = true;
    this.root.add(connRoad);

    // --- 3. Side Streets for Different Residential Vibes ---
    const sideStreets = [
      { x: 195, z: 369, len: 92 }, // Modern Minimalis cluster
      { x: 50, z: 368, len: 90 }, // Vila Kayu Eco-Resort cluster
      { x: -54, z: 362, len: 78 }, // Rumah Warna-Warni Pesisir cluster
      { x: -215, z: 366, len: 86 }, // Klaster Rumah Wisata Barat
    ];

    for (const st of sideStreets) {
      const resW = 8;
      const resRoad = new THREE.Mesh(new THREE.BoxGeometry(resW, 0.12, st.len), asphaltMat);
      resRoad.position.set(st.x, groundY + 0.06, st.z);
      resRoad.receiveShadow = true;
      this.root.add(resRoad);

      for (let dz = -st.len / 2 + 4; dz < st.len / 2 - 4; dz += 6.5) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 3.0), whiteLineMat);
        dash.position.set(st.x, groundY + 0.125, st.z + dz);
        this.root.add(dash);
      }

      const resSwW = 2.0;
      const resSwL = new THREE.Mesh(new THREE.BoxGeometry(resSwW, 0.24, st.len - 2), sidewalkMat);
      resSwL.position.set(st.x - resW / 2 - resSwW / 2, groundY + 0.12, st.z);
      resSwL.receiveShadow = true;
      const resSwR = resSwL.clone();
      resSwR.position.x = st.x + resW / 2 + resSwW / 2;
      this.root.add(resSwL, resSwR);

      // Corner bollards
      const bollardGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.85, 8);
      for (const bx of [st.x - 5.2, st.x + 5.2]) {
        const b = new THREE.Mesh(bollardGeo, curbMat);
        b.position.set(bx, groundY + 0.42, blvdZ + 7.2);
        b.castShadow = true;
        this.root.add(b);
      }

      // Street lamps along each side street
      for (let lz = blvdZ + 18; lz <= st.z + st.len / 2 - 6; lz += 24) {
        this.addStreetLamp(st.x - 4.8, groundY + 0.24, lz, Math.PI / 2);
      }
    }

    // Street lamps along Southern Boulevard & Eastern Coastal Road
    for (let lx = -250; lx <= 280; lx += 30) {
      this.addStreetLamp(lx, groundY + 0.24, blvdZ - 6.0, 0);
    }
    for (let lz = 62; lz <= 300; lz += 32) {
      this.addStreetLamp(eastX - 5.4, eastY + 0.24, lz, Math.PI / 2);
    }
  }

  private addGuardrailLine(
    start: number,
    end: number,
    fixedCoord: number,
    y: number,
    alongX: boolean
  ): void {
    const railMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.4, metalness: 0.65 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.4 });
    const redReflectorMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.35,
    });

    const len = end - start;
    const mid = (start + end) * 0.5;
    const beam = new THREE.Mesh(
      alongX ? new THREE.BoxGeometry(len, 0.22, 0.12) : new THREE.BoxGeometry(0.12, 0.22, len),
      railMat
    );
    beam.position.set(alongX ? mid : fixedCoord, y + 0.72, alongX ? fixedCoord : mid);
    beam.castShadow = true;
    this.root.add(beam);

    const postGeo = new THREE.BoxGeometry(0.14, 0.9, 0.14);
    for (let p = start; p <= end; p += 4.5) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(alongX ? p : fixedCoord, y + 0.45, alongX ? fixedCoord : p);
      post.castShadow = true;
      this.root.add(post);

      if (Math.round(p) % 9 === 0) {
        const ref = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), redReflectorMat);
        ref.position.set(alongX ? p : fixedCoord + 0.02, y + 0.72, alongX ? fixedCoord + 0.02 : p);
        this.root.add(ref);
      }
    }
  }

  private addStreetLamp(x: number, y: number, z: number, rotY: number): void {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.8, 8), poleMat);
    pole.position.y = 2.4;
    pole.castShadow = true;
    g.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.1), poleMat);
    arm.position.set(0, 4.75, 0.45);
    g.add(arm);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: 0xfde047,
      emissiveIntensity: 0.3,
    });
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.48), bulbMat);
    bulb.position.set(0, 4.68, 0.9);
    g.add(bulb);
    this.streetLampMats.push(bulbMat);

    const light = new THREE.PointLight(0xffe4a0, 0, 22, 1.8);
    light.position.set(0, 4.4, 0.9);
    g.add(light);
    this.streetLights.push(light);

    this.root.add(g);
  }

  private buildHotel(
    x: number,
    z: number,
    groundY: number,
    textures: TextureService,
    vegetation: VegetationService
  ): void {
    const hotel = new THREE.Group();
    hotel.position.set(x, groundY, z);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.78 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 });
    const woodMat = new THREE.MeshStandardMaterial({ map: textures.woodPlankTexture, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ map: textures.roofTileTexture, roughness: 0.82 });
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      emissive: 0xfef08a,
      emissiveIntensity: 0.12,
      roughness: 0.25,
      metalness: 0.35,
    });
    this.windowMats.push(winMat);

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(50, 0.16, 40),
      new THREE.MeshStandardMaterial({ map: textures.sidewalkTexture, roughness: 0.88 })
    );
    pad.position.set(0, 0.08, -2);
    pad.receiveShadow = true;
    hotel.add(pad);

    const mainW = 34;
    const mainH = 14.5;
    const mainD = 13;
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(mainW, mainH, mainD), wallMat);
    mainBody.position.set(0, mainH / 2 + 0.16, 6);
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    hotel.add(mainBody);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(mainW * 0.72, 3.6, 4), roofMat);
    roof.scale.set(1.0, 1.0, mainD / mainW);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, mainH + 1.9, 6);
    roof.castShadow = true;
    hotel.add(roof);

    const portico = new THREE.Mesh(new THREE.BoxGeometry(10, 0.35, 5), accentMat);
    portico.position.set(0, 3.4, -2.5);
    portico.castShadow = true;
    hotel.add(portico);
    for (const px of [-4.2, 4.2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 3.4, 8), wallMat);
      col.position.set(px, 1.7, -4.5);
      col.castShadow = true;
      hotel.add(col);
    }

    for (let floor = 1; floor <= 3; floor++) {
      const fy = floor * 3.4 + 0.6;
      const balcony = new THREE.Mesh(new THREE.BoxGeometry(mainW - 2, 0.2, 1.4), accentMat);
      balcony.position.set(0, fy - 1.1, -1.0);
      balcony.castShadow = true;
      hotel.add(balcony);

      for (let wx = -13; wx <= 13; wx += 4.3) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 0.15), winMat);
        win.position.set(wx, fy, -0.52);
        hotel.add(win);
      }
    }

    const poolDeck = new THREE.Mesh(new THREE.BoxGeometry(16, 0.22, 9), woodMat);
    poolDeck.position.set(-14, 0.22, -11);
    poolDeck.receiveShadow = true;
    hotel.add(poolDeck);

    const poolWater = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.1, 6),
      new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.15, metalness: 0.2 })
    );
    poolWater.position.set(-14, 0.32, -11);
    hotel.add(poolWater);

    for (const [tx, tz] of [
      [-21, -15],
      [18, -14],
      [21, -4],
    ]) {
      const palm = vegetation.createOrnamentalTree('palm');
      palm.position.set(tx, 0.15, tz);
      hotel.add(palm);
    }

    this.root.add(hotel);
  }

  private buildResidentialClusters(
    groundY: number,
    eastY: number,
    textures: TextureService,
    vegetation: VegetationService
  ): void {
    // Vibe 1: Modern Minimalis Tropis (around x = 195)
    const modernPalettes = [
      { wall: 0xfef3c7, roof: 0x9a3412 },
      { wall: 0xe2e8f0, roof: 0x334155 },
      { wall: 0xdcfce7, roof: 0x7c2d12 },
    ];
    const modernHouses = [
      { x: 180, z: 344, rot: Math.PI / 2, p: 0 },
      { x: 180, z: 368, rot: Math.PI / 2, p: 1 },
      { x: 180, z: 392, rot: Math.PI / 2, p: 2 },
      { x: 212, z: 344, rot: -Math.PI / 2, p: 1 },
      { x: 212, z: 368, rot: -Math.PI / 2, p: 2 },
      { x: 212, z: 392, rot: -Math.PI / 2, p: 0 },
    ];
    modernHouses.forEach((h, idx) => {
      const pal = modernPalettes[h.p];
      this.buildModernHouse(h.x, h.z, groundY, h.rot, pal.wall, pal.roof, textures, vegetation, idx);
    });

    // Vibe 2: Vila Kayu Eco-Resort (around x = 50)
    const vilaHouses = [
      { x: 34, z: 344, rot: Math.PI / 2 },
      { x: 34, z: 368, rot: Math.PI / 2 },
      { x: 34, z: 392, rot: Math.PI / 2 },
      { x: 66, z: 344, rot: -Math.PI / 2 },
      { x: 66, z: 368, rot: -Math.PI / 2 },
      { x: 66, z: 392, rot: -Math.PI / 2 },
    ];
    vilaHouses.forEach((h, idx) => {
      this.buildTimberVila(h.x, h.z, groundY, h.rot, textures, vegetation, idx);
    });

    // Vibe 3: Rumah Warna-Warni Pesisir (around x = -54)
    const coastalColors = [0xfca5a5, 0x7dd3fc, 0xfde047, 0x86efac, 0xfdba74, 0xc4b5fd];
    const coastalHouses = [
      { x: -69, z: 342, rot: Math.PI / 2 },
      { x: -69, z: 364, rot: Math.PI / 2 },
      { x: -69, z: 386, rot: Math.PI / 2 },
      { x: -39, z: 342, rot: -Math.PI / 2 },
      { x: -39, z: 364, rot: -Math.PI / 2 },
      { x: -39, z: 386, rot: -Math.PI / 2 },
    ];
    coastalHouses.forEach((h, idx) => {
      this.buildModernHouse(
        h.x,
        h.z,
        groundY,
        h.rot,
        coastalColors[idx % coastalColors.length],
        0x1e3a8a,
        textures,
        vegetation,
        idx + 3
      );
    });

    // Individual roadside houses along Eastern Coastal Road (x = 308)
    const eastHouses = [
      { x: 309, z: 112, rot: -Math.PI / 2, p: 0 },
      { x: 309, z: 138, rot: -Math.PI / 2, p: 1 },
      { x: 309, z: 205, rot: -Math.PI / 2, p: 2 },
      { x: 309, z: 268, rot: -Math.PI / 2, p: 0 },
    ];
    eastHouses.forEach((h, idx) => {
      const pal = modernPalettes[h.p];
      this.buildModernHouse(h.x, h.z, eastY, h.rot, pal.wall, pal.roof, textures, vegetation, idx);
    });

    // Vibe 4: Klaster Rumah Wisata Barat (around x = -215)
    const westHouses = [
      { x: -230, z: 344, rot: Math.PI / 2, p: 2 },
      { x: -230, z: 368, rot: Math.PI / 2, p: 0 },
      { x: -230, z: 392, rot: Math.PI / 2, p: 1 },
      { x: -200, z: 344, rot: -Math.PI / 2, p: 0 },
      { x: -200, z: 368, rot: -Math.PI / 2, p: 1 },
      { x: -200, z: 392, rot: -Math.PI / 2, p: 2 },
    ];
    westHouses.forEach((h, idx) => {
      const pal = modernPalettes[h.p];
      this.buildModernHouse(h.x, h.z, groundY, h.rot, pal.wall, pal.roof, textures, vegetation, idx + 1);
    });
  }

  private buildModernHouse(
    x: number,
    z: number,
    groundY: number,
    rotY: number,
    wallColor: number,
    roofColor: number,
    textures: TextureService,
    vegetation: VegetationService,
    idx: number
  ): void {
    const house = new THREE.Group();
    house.position.set(x, groundY, z);
    house.rotation.y = rotY;

    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.82 });
    const roofMat = new THREE.MeshStandardMaterial({
      map: textures.roofTileTexture,
      color: roofColor,
      roughness: 0.84,
    });
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.88 });
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0xfef08a,
      emissiveIntensity: 0.15,
      roughness: 0.3,
    });
    this.windowMats.push(winMat);

    const body = new THREE.Mesh(new THREE.BoxGeometry(9.2, 3.6, 8.0), wallMat);
    body.position.y = 1.8;
    body.castShadow = true;
    body.receiveShadow = true;
    house.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 2.5, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 4.85;
    roof.castShadow = true;
    house.add(roof);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 2.0), fenceMat);
    canopy.position.set(0, 2.6, 4.8);
    house.add(canopy);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2.2, 0.12),
      new THREE.MeshStandardMaterial({ map: textures.darkWoodTexture, roughness: 0.8 })
    );
    door.position.set(0, 1.1, 4.02);
    house.add(door);

    for (const wx of [-2.6, 2.6]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.12), winMat);
      w.position.set(wx, 1.9, 4.02);
      house.add(w);
    }

    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(14, 0.9, 0.2), fenceMat);
    wallBack.position.set(0, 0.45, -6.5);
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 13), fenceMat);
    wallL.position.set(-7, 0.45, 0);
    const wallR = wallL.clone();
    wallR.position.x = 7;
    house.add(wallBack, wallL, wallR);

    const types: Array<'palm' | 'shade' | 'broad' | 'pine'> = ['palm', 'shade', 'broad', 'pine'];
    const tree = vegetation.createOrnamentalTree(types[idx % types.length]);
    tree.scale.setScalar(0.75);
    tree.position.set(4.8, 0, 5.2);
    house.add(tree);

    this.root.add(house);
  }

  private buildTimberVila(
    x: number,
    z: number,
    groundY: number,
    rotY: number,
    textures: TextureService,
    vegetation: VegetationService,
    idx: number
  ): void {
    const vila = new THREE.Group();
    vila.position.set(x, groundY, z);
    vila.rotation.y = rotY;

    const woodMat = new THREE.MeshStandardMaterial({ map: textures.woodPlankTexture, roughness: 0.84 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ map: textures.darkWoodTexture, roughness: 0.88 });
    const thatchMat = new THREE.MeshStandardMaterial({ map: textures.thatchTexture, roughness: 0.92 });
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0xfdba74,
      emissiveIntensity: 0.18,
      roughness: 0.3,
    });
    this.windowMats.push(winMat);

    // Elevated wooden deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.55, 10.5), darkWoodMat);
    deck.position.y = 0.28;
    deck.receiveShadow = true;
    vila.add(deck);

    // Timber cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.4, 7.2), woodMat);
    cabin.position.set(0, 2.2, -0.8);
    cabin.castShadow = true;
    cabin.receiveShadow = true;
    vila.add(cabin);

    // Steep tropical resort thatch roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.8, 3.2, 4), thatchMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 5.5, -0.8);
    roof.castShadow = true;
    vila.add(roof);

    // Veranda posts & railing
    for (const px of [-3.8, 3.8]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.0, 6), darkWoodMat);
      post.position.set(px, 2.0, 4.4);
      vila.add(post);
    }

    for (const wx of [-2.2, 2.2]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.4, 0.14), winMat);
      w.position.set(wx, 2.3, 2.82);
      vila.add(w);
    }

    const tree = vegetation.createOrnamentalTree(idx % 2 === 0 ? 'pine' : 'palm');
    tree.scale.setScalar(0.8);
    tree.position.set(-5.5, 0, 4.2);
    vila.add(tree);

    this.root.add(vila);
  }

  private buildParkingLot(x: number, z: number, groundY: number, textures: TextureService): void {
    const lot = new THREE.Group();
    lot.position.set(x, groundY, z);

    const asphaltMat = new THREE.MeshStandardMaterial({ map: textures.asphaltTexture, roughness: 0.9 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });

    // Main asphalt pad (38m x 28m)
    const pad = new THREE.Mesh(new THREE.BoxGeometry(38, 0.12, 28), asphaltMat);
    pad.position.y = 0.06;
    pad.receiveShadow = true;
    lot.add(pad);

    // Perimeter curbs
    const curbS = new THREE.Mesh(new THREE.BoxGeometry(38.4, 0.28, 0.4), curbMat);
    curbS.position.set(0, 0.14, 14);
    const curbE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 28.4), curbMat);
    curbE.position.set(19, 0.14, 0);
    const curbW = curbE.clone();
    curbW.position.x = -19;
    lot.add(curbS, curbE, curbW);

    // Painted parking bay lines (2 rows)
    for (let bx = -15; bx <= 15; bx += 3.8) {
      const lineN = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 5.2), lineMat);
      lineN.position.set(bx, 0.13, -9.5);
      const lineS = lineN.clone();
      lineS.position.z = 9.5;
      lot.add(lineN, lineS);
    }

    // Parked procedural vehicles
    const carColors = [0xdc2626, 0x2563eb, 0xf8fafc, 0x475569, 0x059669, 0xf59e0b];
    const carPositions = [
      { x: -13.1, z: -9.5, rot: 0 },
      { x: -5.5, z: -9.5, rot: 0 },
      { x: 5.9, z: -9.5, rot: 0 },
      { x: -9.3, z: 9.5, rot: Math.PI },
      { x: 2.1, z: 9.5, rot: Math.PI },
      { x: 13.5, z: 9.5, rot: Math.PI },
    ];
    carPositions.forEach((cp, idx) => {
      this.createParkedCar(lot, cp.x, 0.12, cp.z, cp.rot, carColors[idx % carColors.length]);
    });

    this.addStreetLamp(0, 0.12, 0, 0);
    lot.add(this.streetLights[this.streetLights.length - 1].parent!);

    this.root.add(lot);
  }

  private createParkedCar(
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    rotY: number,
    color: number
  ): void {
    const car = new THREE.Group();
    car.position.set(x, y, z);
    car.rotation.y = rotY;

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.6 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.72, 4.1), bodyMat);
    chassis.position.y = 0.52;
    chassis.castShadow = true;
    car.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.62, 2.2), glassMat);
    cabin.position.set(0, 1.15, -0.15);
    cabin.castShadow = true;
    car.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const [wx, wz] of [
      [-0.92, 1.25],
      [0.92, 1.25],
      [-0.92, -1.25],
      [0.92, -1.25],
    ]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.32, wz);
      car.add(w);
    }

    parent.add(car);
  }

  private buildWarungs(groundY: number, eastY: number, textures: TextureService): void {
    const spots = [
      { x: 224, y: groundY, z: 332, rot: Math.PI, color: 0x2563eb },
      { x: 96, y: groundY, z: 332, rot: Math.PI, color: 0xdc2626 },
      { x: -16, y: groundY, z: 332, rot: Math.PI, color: 0x16a34a },
      { x: 306, y: eastY, z: 168, rot: -Math.PI / 2, color: 0xd97706 },
      { x: 306, y: eastY, z: 235, rot: -Math.PI / 2, color: 0x0284c7 },
    ];

    for (const s of spots) {
      this.createWarung(s.x, s.y, s.z, s.rot, s.color, textures);
    }
  }

  private createWarung(
    x: number,
    y: number,
    z: number,
    rotY: number,
    awningColor: number,
    textures: TextureService
  ): void {
    const w = new THREE.Group();
    w.position.set(x, y, z);
    w.rotation.y = rotY;

    const wallMat = new THREE.MeshStandardMaterial({ map: textures.woodPlankTexture, roughness: 0.85 });
    const counterMat = new THREE.MeshStandardMaterial({ map: textures.darkWoodTexture, roughness: 0.8 });
    const awningMat = new THREE.MeshStandardMaterial({
      color: awningColor,
      roughness: 0.78,
      side: THREE.DoubleSide,
    });

    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.8, 3.6), wallMat);
    kiosk.position.y = 1.4;
    kiosk.castShadow = true;
    kiosk.receiveShadow = true;
    w.add(kiosk);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.14, 4.8), awningMat);
    roof.position.set(0, 2.95, 0.4);
    roof.rotation.x = 0.16;
    roof.castShadow = true;
    w.add(roof);

    // Serving counter & wooden bench
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.9, 0.7), counterMat);
    counter.position.set(0, 0.45, 2.15);
    w.add(counter);

    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.42, 0.55), wallMat);
    bench.position.set(0, 0.21, 3.15);
    w.add(bench);

    // Warm warung light
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.4,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), bulbMat);
    bulb.position.set(0, 2.55, 2.2);
    w.add(bulb);
    this.streetLampMats.push(bulbMat);

    const light = new THREE.PointLight(0xffb347, 0, 14, 1.8);
    light.position.set(0, 2.35, 2.2);
    w.add(light);
    this.streetLights.push(light);

    this.root.add(w);
  }

  private buildCampingArea(
    cx: number,
    cz: number,
    groundY: number,
    textures: TextureService,
    vegetation: VegetationService
  ): void {
    const camp = new THREE.Group();
    camp.position.set(cx, groundY, cz);

    const tentColors = [0xf97316, 0x0ea5e9, 0xeab308, 0x22c55e, 0xef4444, 0x3b82f6, 0xa855f7];
    const tentSpots = [
      { x: -24, z: -6, rot: 0.4 },
      { x: -12, z: -10, rot: -0.2 },
      { x: 2, z: -8, rot: 0.15 },
      { x: 16, z: -9, rot: -0.5 },
      { x: -20, z: 6, rot: 0.8 },
      { x: 8, z: 5, rot: -0.7 },
      { x: 22, z: 3, rot: -1.1 },
    ];

    tentSpots.forEach((ts, idx) => {
      const tentMat = new THREE.MeshStandardMaterial({
        color: tentColors[idx % tentColors.length],
        roughness: 0.85,
      });
      const tent = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.8, 4), tentMat);
      tent.rotation.y = Math.PI / 4 + ts.rot;
      tent.position.set(ts.x, 0.9, ts.z);
      tent.castShadow = true;
      tent.receiveShadow = true;
      camp.add(tent);
    });

    // Two stone-ring campfires with animated flames
    for (const [fx, fz, phase] of [
      [-6, 1, 0],
      [14, -1, 1.8],
    ]) {
      const stoneMat = new THREE.MeshStandardMaterial({ map: textures.stoneTexture, roughness: 0.9 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneMat);
        st.position.set(fx + Math.cos(a) * 0.72, 0.15, fz + Math.sin(a) * 0.72);
        camp.add(st);
      }

      const flameMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.6,
      });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 6), flameMat);
      flame.position.set(fx, 0.45, fz);
      camp.add(flame);

      const fireLight = new THREE.PointLight(0xff7b29, 0, 18, 1.6);
      fireLight.position.set(fx, 0.9, fz);
      camp.add(fireLight);

      this.campfires.push({ flame, light: fireLight, phase });
    }

    // Wooden picnic tables
    const woodMat = new THREE.MeshStandardMaterial({ map: textures.woodPlankTexture, roughness: 0.85 });
    for (const [px, pz] of [
      [-14, 0],
      [6, 1],
    ]) {
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.2), woodMat);
      table.position.set(px, 0.75, pz);
      table.castShadow = true;
      camp.add(table);
    }

    // Shade & Pine trees around camping ground
    for (const [tx, tz, type] of [
      [-30, -2, 'pine'],
      [-18, -14, 'shade'],
      [10, -14, 'palm'],
      [26, -6, 'pine'],
    ] as const) {
      const tree = vegetation.createOrnamentalTree(type);
      tree.position.set(tx, 0, tz);
      camp.add(tree);
    }

    this.root.add(camp);
  }

  private buildWaterPark(
    cx: number,
    cz: number,
    groundY: number,
    textures: TextureService,
    vegetation: VegetationService
  ): void {
    const wp = new THREE.Group();
    wp.position.set(cx, groundY, cz);

    const deckMat = new THREE.MeshStandardMaterial({ map: textures.sidewalkTexture, roughness: 0.85 });
    const poolMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.12,
      metalness: 0.25,
    });
    const tileBorderMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.5 });

    // Paved Water Park Plaza (48m x 46m)
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(48, 0.16, 46), deckMat);
    plaza.position.y = 0.08;
    plaza.receiveShadow = true;
    wp.add(plaza);

    // Main Leisure Pool & Splash Pool
    for (const [px, pz, pw, pd] of [
      [-8, 4, 22, 18],
      [12, -6, 16, 14],
    ]) {
      const border = new THREE.Mesh(new THREE.BoxGeometry(pw + 1.4, 0.28, pd + 1.4), tileBorderMat);
      border.position.set(px, 0.16, pz);
      border.receiveShadow = true;
      const water = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.12, pd), poolMat);
      water.position.set(px, 0.28, pz);
      wp.add(border, water);
    }

    // Water Slide Tower + 2 Colorful Slides
    const tower = new THREE.Mesh(new THREE.BoxGeometry(4.5, 8.5, 4.5), steelMat);
    tower.position.set(14, 4.3, 10);
    tower.castShadow = true;
    wp.add(tower);

    const slideYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25 });
    const slideRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25 });

    const slide1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 13.5), slideYellowMat);
    slide1.position.set(12.5, 4.4, 2.2);
    slide1.rotation.x = 0.58;
    slide1.castShadow = true;

    const slide2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 13.5), slideRedMat);
    slide2.position.set(15.2, 4.4, 2.2);
    slide2.rotation.x = 0.58;
    slide2.castShadow = true;
    wp.add(slide1, slide2);

    // Ticket Booth & Changing Room Building (Loket & Ruang Bilas)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ map: textures.roofTileTexture, roughness: 0.8 });
    const booth = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 5.5), wallMat);
    booth.position.set(-12, 1.7, -17);
    booth.castShadow = true;
    const boothRoof = new THREE.Mesh(new THREE.ConeGeometry(8.5, 2.2, 4), roofMat);
    boothRoof.rotation.y = Math.PI / 4;
    boothRoof.position.set(-12, 4.3, -17);
    boothRoof.castShadow = true;
    wp.add(booth, boothRoof);

    // Poolside Tents & Umbrellas (Tenda Wisata)
    const tentColors = [0x0ea5e9, 0xf97316, 0x22c55e, 0xe11d48];
    for (let i = 0; i < 4; i++) {
      const tx = -18 + i * 7.5;
      const tz = -8;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6), steelMat);
      pole.position.set(tx, 1.4, tz);
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 0.9, 6),
        new THREE.MeshStandardMaterial({ color: tentColors[i], roughness: 0.8 })
      );
      canopy.position.set(tx, 2.9, tz);
      canopy.castShadow = true;
      wp.add(pole, canopy);
    }

    // Palm & Shade trees around Water Park
    for (const [tx, tz, type] of [
      [-21, 18, 'palm'],
      [-21, -18, 'palm'],
      [21, 18, 'shade'],
      [21, -18, 'palm'],
    ] as const) {
      const tree = vegetation.createOrnamentalTree(type);
      tree.position.set(tx, 0.15, tz);
      wp.add(tree);
    }

    this.root.add(wp);
  }

  private buildTouristSpot(
    cx: number,
    cz: number,
    groundY: number,
    textures: TextureService,
    vegetation: VegetationService
  ): void {
    const spot = new THREE.Group();
    spot.position.set(cx, groundY, cz);

    const plazaMat = new THREE.MeshStandardMaterial({ map: textures.stoneTexture, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ map: textures.woodPlankTexture, roughness: 0.84 });

    // Stone tourist plaza & lakeside viewing deck
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(20, 21, 0.25, 24), plazaMat);
    plaza.position.y = 0.12;
    plaza.receiveShadow = true;
    spot.add(plaza);

    // 2-story Tourist Center & Lakeside Cafe Building
    const cafeBody = new THREE.Mesh(
      new THREE.BoxGeometry(12, 6.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.78 })
    );
    cafeBody.position.set(-10, 3.2, 4);
    cafeBody.castShadow = true;
    cafeBody.receiveShadow = true;
    const cafeRoof = new THREE.Mesh(
      new THREE.BoxGeometry(13.2, 0.35, 9.2),
      new THREE.MeshStandardMaterial({ map: textures.darkWoodTexture, roughness: 0.85 })
    );
    cafeRoof.position.set(-10, 6.4, 4);
    cafeRoof.castShadow = true;
    spot.add(cafeBody, cafeRoof);

    // Photo Spot Archway overlooking Lake Toba
    const archMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.65 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5.2, 0.8), archMat);
    p1.position.set(4, 2.6, -12);
    const p2 = p1.clone();
    p2.position.x = 12;
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.9, 1.0), archMat);
    topBar.position.set(8, 5.2, -12);
    spot.add(p1, p2, topBar);

    // 6 Bazar & Souvenir Tents (Tenda Wisata)
    const tentCols = [0xdc2626, 0x2563eb, 0xd97706, 0x16a34a, 0x9333ea, 0x0284c7];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI + 0.2;
      const tx = Math.cos(angle) * 12 + 4;
      const tz = Math.sin(angle) * 9;
      const tent = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 2.2, 4),
        new THREE.MeshStandardMaterial({ color: tentCols[i], roughness: 0.82 })
      );
      tent.rotation.y = Math.PI / 4;
      tent.position.set(tx, 2.5, tz);
      tent.castShadow = true;
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 1.2), woodMat);
      table.position.set(tx, 0.55, tz);
      spot.add(tent, table);
    }

    const palm = vegetation.createOrnamentalTree('palm');
    palm.position.set(16, 0.2, 8);
    spot.add(palm);

    this.root.add(spot);
  }

  private buildGrassLawns(groundY: number, vegetation: VegetationService): void {
    const lawns: Array<[number, number, number, number, number, number]> = [
      // [count, width, depth, centerX, centerZ, seed]
      [240, 80, 32, -62, 294, 101],   // Camping ground grass
      [220, 70, 30, -200, 294, 202],  // Tourist park & lakeshore grass
      [200, 75, 28, 30, 296, 303],    // Central lakeshore lawn
      [180, 60, 26, 230, 296, 404],   // Eastern lakeshore lawn
      [180, 48, 70, 102, 375, 505],   // Between Hotel & Vila cluster
    ];

    for (const [count, w, d, cx, cz, seed] of lawns) {
      const patch = vegetation.createGrassPatch(count, w, d, cx, cz, groundY, seed);
      this.root.add(patch);
    }
  }

  private plantBoulevardTrees(groundY: number, eastY: number, vegetation: VegetationService): void {
    const species: Array<'palm' | 'shade' | 'broad' | 'pine'> = ['palm', 'shade', 'palm', 'broad'];
    let idx = 0;

    for (let x = -252; x <= 284; x += 16) {
      const tree = vegetation.createOrnamentalTree(species[idx % species.length]);
      tree.scale.setScalar(0.85 + (idx % 3) * 0.1);
      tree.position.set(x, groundY + 0.2, 309.2);
      this.root.add(tree);
      idx++;
    }

    for (let z = 60; z <= 296; z += 18) {
      const tree = vegetation.createOrnamentalTree(species[idx % species.length]);
      tree.scale.setScalar(0.85);
      tree.position.set(286.6, eastY + 0.2, z);
      this.root.add(tree);
      idx++;
    }
  }

  setNightFactor(nightFactor: number): void {
    this.currentNightFactor = nightFactor;
    const lampIntensity = nightFactor * 3.2;
    for (const l of this.streetLights) {
      l.intensity = lampIntensity;
    }
    for (const m of this.streetLampMats) {
      m.emissiveIntensity = 0.25 + nightFactor * 2.2;
    }
    for (const w of this.windowMats) {
      w.emissiveIntensity = 0.08 + nightFactor * 0.95;
    }
  }

  update(_dt: number, elapsed: number): void {
    for (const cf of this.campfires) {
      const flicker = 0.85 + Math.sin(elapsed * 9.5 + cf.phase) * 0.18;
      cf.flame.scale.set(1, flicker, 1);
      cf.light.intensity = (0.6 + this.currentNightFactor * 3.2) * flicker;
    }
  }
}
