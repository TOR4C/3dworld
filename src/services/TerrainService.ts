import { clamp, fbm2D, lerp, ridged2D, smoothstep } from '../core/MathNoise';

export const WATER_LEVEL = 0;

export interface FlatZone {
  x: number;
  z: number;
  radius: number;
  falloff: number;
  targetHeight: number;
}

/**
 * Defines flattened pads for lakeside settlements, market, and piers
 * so procedural 3D structures sit cleanly on the terrain.
 */
export const SETTLEMENT_ZONES: FlatZone[] = [
  // Pasar (Lakeside Market Plaza)
  { x: 332, z: 26, radius: 24, falloff: 20, targetHeight: 3.2 },
  // Desa Rumah Bolon (Batak Houses Cluster)
  { x: 318, z: -38, radius: 26, falloff: 22, targetHeight: 4.8 },
  { x: 358, z: -18, radius: 18, falloff: 16, targetHeight: 5.8 },
  // Lakeside Pier & Beach Spot
  { x: 282, z: 24, radius: 12, falloff: 14, targetHeight: 0.9 },
  // Samosir Island Pier & Gazebo Spot
  { x: 118, z: 12, radius: 14, falloff: 16, targetHeight: 1.6 },
];

export const LOWLAND_URBAN_BOUNDS = {
  minX: -115,
  maxX: 295,
  minZ: 276,
  maxZ: 425,
  elevation: 2.2,
};

export const EAST_COAST_CORRIDOR = {
  minX: 280,
  maxX: 318,
  minZ: 36,
  maxZ: 325,
  elevation: 2.4,
};

export class TerrainService {
  getHeight(x: number, z: number): number {
    // Domain warp for organic shorelines
    const warp = fbm2D(x * 0.0026, z * 0.0026, 3, 2.0, 0.5, 701) * 0.22;

    // 1. Lake Toba Caldera shape (elongated N-S like real Toba)
    const rx = x / 385;
    const rz = z / 465;
    const dCaldera = Math.hypot(rx, rz) + warp;

    // 2. Infinite procedural highlands outside the caldera
    const macro = fbm2D(x * 0.0014, z * 0.0014, 4, 2.05, 0.52, 101);
    const ridges = ridged2D(x * 0.0024, z * 0.0024, 4, 2.0, 0.5, 303);
    const detail = fbm2D(x * 0.012, z * 0.012, 3, 2.0, 0.45, 505) * 3.5;
    const infiniteHeight = macro * 42 + ridges * 46 - 4 + detail;

    // 3. Caldera basin & rim
    const lakeDepth = -30 + fbm2D(x * 0.005, z * 0.005, 2) * 6;
    const rimMask = Math.exp(-Math.pow((dCaldera - 1.24) / 0.28, 2));
    const rimHeight = rimMask * (58 + ridges * 34);

    // Eastern lakeside gentle cove (around x ~ 280..380, z ~ -60..80) so village & market have a natural terrace
    const coveDist = Math.hypot((x - 325) / 85, (z - 0) / 95);
    const coveFlatten = 1 - smoothstep(0.45, 1.15, coveDist);

    const calderaBlend = smoothstep(0.86, 1.14, dCaldera);
    let h = lerp(lakeDepth, Math.max(2.5, infiniteHeight * 0.72 + 18) + rimHeight, calderaBlend);

    // Apply eastern lakeside terrace carving
    if (coveFlatten > 0.001) {
      const terraceH = 3.8 + fbm2D(x * 0.01, z * 0.01, 2) * 1.5;
      // Only terrace above water
      const shoreFade = smoothstep(268, 305, x);
      h = lerp(h, terraceH, coveFlatten * shoreFade * 0.88);
    }

    // Blend smoothly into pure infinite terrain far from Lake Toba
    const farBlend = smoothstep(1.38, 2.15, dCaldera);
    h = lerp(h, infiniteHeight, farBlend);

    // 4. Pulau Samosir (Central Island inside the caldera)
    const sx = (x + 12) / 138;
    const sz = (z + 10) / 162;
    const dIsland = Math.hypot(sx, sz) + warp * 0.55;
    if (dIsland < 1.18) {
      const islandMask = 1 - smoothstep(0.72, 1.08, dIsland);
      const islandProfile =
        Math.pow(1 - clamp(dIsland / 1.05, 0, 1), 0.78) * 34 +
        ridged2D(x * 0.006, z * 0.006, 3, 2.0, 0.5, 909) * 22 +
        detail * 0.7;
      const islandH = -2 + islandProfile;
      h = lerp(h, Math.max(h, islandH), islandMask);
    }

    // 5. Settlement flattening pads
    for (let i = 0; i < SETTLEMENT_ZONES.length; i++) {
      const zPad = SETTLEMENT_ZONES[i];
      const dist = Math.hypot(x - zPad.x, z - zPad.z);
      if (dist < zPad.radius + zPad.falloff) {
        const w = 1 - smoothstep(zPad.radius, zPad.radius + zPad.falloff, dist);
        h = lerp(h, zPad.targetHeight, w);
      }
    }

    // 6. Lakeshore Lowland Plain (Hotel, Perumahan, Parkiran, Camping, Jalan Aspal)
    const lb = LOWLAND_URBAN_BOUNDS;
    const dx = Math.max(lb.minX - x, 0, x - lb.maxX);
    const dz = Math.max(lb.minZ - z, 0, z - lb.maxZ);
    const boxDist = Math.hypot(dx, dz);
    if (boxDist < 36) {
      const lw = 1 - smoothstep(0, 36, boxDist);
      h = lerp(h, lb.elevation, lw);
    }

    // 7. Eastern Coastal Road Corridor (connecting Boulevard to Pasar & Desa)
    const ec = EAST_COAST_CORRIDOR;
    const ecx = Math.max(ec.minX - x, 0, x - ec.maxX);
    const ecz = Math.max(ec.minZ - z, 0, z - ec.maxZ);
    const ecDist = Math.hypot(ecx, ecz);
    if (ecDist < 26) {
      const ew = 1 - smoothstep(0, 26, ecDist);
      h = lerp(h, ec.elevation, ew);
    }

    return h;
  }

  getSlope(x: number, z: number): number {
    const eps = 1.5;
    const hx = this.getHeight(x + eps, z) - this.getHeight(x - eps, z);
    const hz = this.getHeight(x, z + eps) - this.getHeight(x, z - eps);
    return Math.hypot(hx, hz) / (2 * eps);
  }

  getBiomeLabel(x: number, z: number): string {
    const h = this.getHeight(x, z);
    const dOrigin = Math.hypot(x, z);
    if (x >= -108 && x <= -20 && z >= 274 && z <= 312) {
      return 'Area Camping Tepi Danau';
    }
    if (
      x >= LOWLAND_URBAN_BOUNDS.minX - 10 &&
      x <= LOWLAND_URBAN_BOUNDS.maxX + 10 &&
      z >= LOWLAND_URBAN_BOUNDS.minZ - 10 &&
      z <= LOWLAND_URBAN_BOUNDS.maxZ + 10
    ) {
      return 'Kawasan Pesisir & Hotel';
    }
    if (
      x >= EAST_COAST_CORRIDOR.minX - 8 &&
      x <= EAST_COAST_CORRIDOR.maxX + 8 &&
      z >= EAST_COAST_CORRIDOR.minZ &&
      z <= EAST_COAST_CORRIDOR.maxZ
    ) {
      return 'Jalan Lingkar Pesisir Timur';
    }
    if (Math.hypot(x - 332, z - 26) < 42) return 'Pasar Pinggir Danau';
    if (Math.hypot(x - 330, z + 30) < 55) return 'Desa Rumah Bolon';
    if (Math.hypot(x + 12, z + 10) < 155 && h > WATER_LEVEL) return 'Pulau Samosir';
    if (dOrigin < 470 && h <= WATER_LEVEL + 0.5) return 'Perairan Danau Toba';
    if (dOrigin < 680) return 'Kaldera Danau Toba';
    if (h > 42) return 'Pegunungan Bukit Barisan';
    if (h <= WATER_LEVEL) return 'Danau Dataran Tinggi';
    return 'Lembah Hijau Tak Terbatas';
  }
}
