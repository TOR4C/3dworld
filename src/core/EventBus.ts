export type WeatherType = 'clear' | 'mist' | 'rain';

export interface WorldEvents {
  'weather:change': WeatherType;
  'time:set': number; // normalized 0..1 (0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset)
  'time:toggle-pause': void;
  'cinematic:toggle': void;
  'cinematic:status': { active: boolean; label: string };
  'telemetry:update': {
    fps: number;
    x: number;
    y: number;
    z: number;
    lat: number;
    lon: number;
    altMdpl: number;
    speed: number;
    baseSpeed: number;
    timeOfDay: number;
    weather: WeatherType;
    biome: string;
    chunksLoaded: number;
    webgl2: boolean;
  };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<keyof WorldEvents, Set<Handler<unknown>>>();

  on<K extends keyof WorldEvents>(event: K, handler: Handler<WorldEvents[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => set?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof WorldEvents>(event: K, payload: WorldEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      (fn as Handler<WorldEvents[K]>)(payload);
    }
  }
}
