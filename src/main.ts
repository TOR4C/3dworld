import './style.css';
import { Engine } from './core/Engine';
import { EventBus } from './core/EventBus';
import { AtmosphereService } from './services/AtmosphereService';
import { ChunkService } from './services/ChunkService';
import { ControlsService } from './services/ControlsService';
import { FaunaService } from './services/FaunaService';
import { HudService } from './services/HudService';
import { SettlementService } from './services/SettlementService';
import { TerrainService } from './services/TerrainService';
import { TextureService } from './services/TextureService';
import { VegetationService } from './services/VegetationService';
import { WaterService } from './services/WaterService';
import { WeatherService } from './services/WeatherService';

function bootstrap(): void {
  const canvas = document.getElementById('world-canvas') as HTMLCanvasElement;
  const hudRoot = document.getElementById('hud-root') as HTMLElement;

  const bus = new EventBus();
  const engine = new Engine(canvas);

  const textures = new TextureService();
  const terrain = new TerrainService();
  const vegetation = new VegetationService(terrain, textures);
  const chunks = new ChunkService(engine.scene, engine.camera, terrain, textures, vegetation);
  const water = new WaterService(engine.scene, engine.camera, textures);
  const settlement = new SettlementService(engine.scene, terrain, textures);
  const atmosphere = new AtmosphereService(engine.scene, engine.camera, water, settlement, bus);
  const weather = new WeatherService(engine.scene, engine.camera, atmosphere, bus);
  const fauna = new FaunaService(engine.scene, atmosphere);
  const controls = new ControlsService(engine.camera, canvas, terrain);
  new HudService(hudRoot, bus, controls);

  // Build initial chunks around Danau Toba before first frame
  chunks.warmup();

  // Register update order
  engine.registerService(controls);
  engine.registerService(chunks);
  engine.registerService(water);
  engine.registerService(settlement);
  engine.registerService(atmosphere);
  engine.registerService(weather);
  engine.registerService(fauna);

  let telemetryTimer = 0;
  engine.registerService({
    update(dt: number) {
      telemetryTimer += dt;
      if (telemetryTimer >= 0.25) {
        telemetryTimer = 0;
        const p = engine.camera.position;
        bus.emit('telemetry:update', {
          fps: engine.currentFps,
          x: p.x,
          y: p.y,
          z: p.z,
          speed: controls.currentSpeed,
          baseSpeed: controls.baseSpeed,
          timeOfDay: atmosphere.timeOfDay,
          weather: weather.currentWeather,
          biome: terrain.getBiomeLabel(p.x, p.z),
          chunksLoaded: chunks.loadedCount,
          webgl2: engine.isWebGL2,
        });
      }
    },
  });

  engine.start();
}

bootstrap();
