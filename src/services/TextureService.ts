import * as THREE from 'three';
import { mulberry32 } from '../core/MathNoise';

export class TextureService {
  public readonly barkTexture: THREE.CanvasTexture;
  public readonly woodPlankTexture: THREE.CanvasTexture;
  public readonly darkWoodTexture: THREE.CanvasTexture;
  public readonly thatchTexture: THREE.CanvasTexture;
  public readonly stoneTexture: THREE.CanvasTexture;
  public readonly fabricRedTexture: THREE.CanvasTexture;
  public readonly fabricBlueTexture: THREE.CanvasTexture;
  public readonly fabricGoldTexture: THREE.CanvasTexture;
  public readonly waterNormalTexture: THREE.CanvasTexture;
  public readonly terrainDetailTexture: THREE.CanvasTexture;

  constructor() {
    this.barkTexture = this.createBarkTexture();
    this.woodPlankTexture = this.createWoodPlankTexture('#7c5333', '#5c3b22', 101);
    this.darkWoodTexture = this.createWoodPlankTexture('#3e2719', '#28170d', 202);
    this.thatchTexture = this.createThatchTexture();
    this.stoneTexture = this.createStoneTexture();
    this.fabricRedTexture = this.createFabricTexture('#b91c1c', '#991b1b', 301);
    this.fabricBlueTexture = this.createFabricTexture('#1d4ed8', '#1e40af', 302);
    this.fabricGoldTexture = this.createFabricTexture('#d97706', '#b45309', 303);
    this.waterNormalTexture = this.createWaterNormalTexture();
    this.terrainDetailTexture = this.createTerrainDetailTexture();
  }

  private makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    return [canvas, ctx];
  }

  private wrapTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1, srgb = true): THREE.CanvasTexture {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  private createBarkTexture(): THREE.CanvasTexture {
    const [canvas, ctx] = this.makeCanvas(256);
    const rng = mulberry32(41);
    ctx.fillStyle = '#4a3525';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 420; i++) {
      const x = rng() * 256;
      const y = rng() * 256;
      const w = 2 + rng() * 5;
      const h = 18 + rng() * 44;
      const shade = rng() > 0.5 ? 'rgba(28, 18, 10, 0.35)' : 'rgba(105, 79, 58, 0.25)';
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, w, h);
    }
    return this.wrapTexture(canvas, 1, 2);
  }

  private createWoodPlankTexture(base: string, grain: string, seed: number): THREE.CanvasTexture {
    const [canvas, ctx] = this.makeCanvas(256);
    const rng = mulberry32(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);

    const planks = 6;
    const pw = 256 / planks;
    for (let p = 0; p < planks; p++) {
      ctx.fillStyle = grain;
      ctx.globalAlpha = 0.25 + rng() * 0.2;
      ctx.fillRect(p * pw, 0, 2, 256);
      for (let i = 0; i < 35; i++) {
        const x = p * pw + 3 + rng() * (pw - 6);
        const y = rng() * 256;
        ctx.fillRect(x, y, 1 + rng() * 1.5, 20 + rng() * 60);
      }
    }
    ctx.globalAlpha = 1;
    return this.wrapTexture(canvas, 1, 1);
  }

  private createThatchTexture(): THREE.CanvasTexture {
    const [canvas, ctx] = this.makeCanvas(256);
    const rng = mulberry32(77);
    ctx.fillStyle = '#3b2f24';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const x = rng() * 256;
      const y = rng() * 256;
      ctx.strokeStyle = rng() > 0.45 ? '#574636' : '#261e16';
      ctx.lineWidth = 1 + rng() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 6, y + 10 + rng() * 18);
      ctx.stroke();
    }
    return this.wrapTexture(canvas, 2, 2);
  }

  private createStoneTexture(): THREE.CanvasTexture {
    const [canvas, ctx] = this.makeCanvas(256);
    const rng = mulberry32(99);
    ctx.fillStyle = '#737982';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 650; i++) {
      const x = rng() * 256;
      const y = rng() * 256;
      const r = 2 + rng() * 9;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(20,24,30,0.14)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return this.wrapTexture(canvas, 2, 2);
  }

  private createFabricTexture(c1: string, c2: string, seed: number): THREE.CanvasTexture {
    const [canvas, ctx] = this.makeCanvas(128);
    const rng = mulberry32(seed);
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = c2;
    for (let x = 0; x < 128; x += 16) {
      ctx.fillRect(x, 0, 8, 128);
    }
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(rng() * 128, rng() * 128, 2, 2);
    }
    return this.wrapTexture(canvas, 2, 2);
  }

  private createTerrainDetailTexture(): THREE.CanvasTexture {
    const [canvas, ctx] = this.makeCanvas(256);
    const rng = mulberry32(555);
    ctx.fillStyle = '#d4d4d4';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2500; i++) {
      const x = rng() * 256;
      const y = rng() * 256;
      const v = Math.floor(175 + rng() * 65);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 2 + rng() * 3, 2 + rng() * 3);
    }
    return this.wrapTexture(canvas, 18, 18);
  }

  private createWaterNormalTexture(): THREE.CanvasTexture {
    const size = 256;
    const [canvas, ctx] = this.makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const data = img.data;

    const h = (x: number, y: number): number => {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      return (
        Math.sin(u * 3 + v * 2) * 0.35 +
        Math.cos(u * 5 - v * 4) * 0.25 +
        Math.sin(u * 9 + v * 7) * 0.15 +
        Math.cos(u * 13 - v * 11) * 0.08
      );
    };

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (h((x + 1) % size, y) - h((x - 1 + size) % size, y)) * 1.4;
        const dy = (h(x, (y + 1) % size) - h(x, (y - 1 + size) % size)) * 1.4;
        const nx = -dx;
        const ny = -dy;
        const nz = 1.0;
        const len = Math.hypot(nx, ny, nz);
        const idx = (y * size + x) * 4;
        data[idx] = Math.floor(((nx / len) * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.floor(((ny / len) * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.floor(((nz / len) * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return this.wrapTexture(canvas, 12, 12, false);
  }

  dispose(): void {
    this.barkTexture.dispose();
    this.woodPlankTexture.dispose();
    this.darkWoodTexture.dispose();
    this.thatchTexture.dispose();
    this.stoneTexture.dispose();
    this.fabricRedTexture.dispose();
    this.fabricBlueTexture.dispose();
    this.fabricGoldTexture.dispose();
    this.waterNormalTexture.dispose();
    this.terrainDetailTexture.dispose();
  }
}
