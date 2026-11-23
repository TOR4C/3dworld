import { EventBus, WeatherType } from '../core/EventBus';
import { clamp } from '../core/MathNoise';
import { ControlsService } from './ControlsService';

export class HudService {
  private root: HTMLElement;
  private bus: EventBus;
  private controls: ControlsService;

  private biomeEl!: HTMLElement;
  private statsEl!: HTMLElement;
  private crosshairEl!: HTMLElement;
  private hintEl!: HTMLElement;
  private touchUiEl!: HTMLElement;
  private weatherBtns = new Map<WeatherType, HTMLButtonElement>();
  private pauseBtn!: HTMLButtonElement;

  private stickPointerId: number | null = null;
  private upPointerId: number | null = null;
  private downPointerId: number | null = null;
  private touchEnabled = false;
  private hudHidden = false;

  constructor(root: HTMLElement, bus: EventBus, controls: ControlsService) {
    this.root = root;
    this.bus = bus;
    this.controls = controls;

    this.touchEnabled =
      ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 1024;

    this.render();
    this.bindEvents();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-card">
          <div class="hud-title">
            <span id="hud-biome">Danau Toba</span>
            <span class="hud-badge" id="hud-gl">WebGL2</span>
          </div>
          <div class="hud-stats" id="hud-stats">FPS: -- | Alt: --m | Speed: -- m/s</div>
        </div>

        <div class="hud-card hud-controls-bar">
          <button class="hud-btn active" data-weather="clear">Cerah</button>
          <button class="hud-btn" data-weather="mist">Kabut</button>
          <button class="hud-btn" data-weather="rain">Hujan</button>
          <span style="opacity:0.3">|</span>
          <button class="hud-btn" data-time="0.30">Pagi</button>
          <button class="hud-btn" data-time="0.50">Siang</button>
          <button class="hud-btn" data-time="0.73">Senja</button>
          <button class="hud-btn" data-time="0.02">Malam</button>
          <button class="hud-btn" id="btn-pause-time">Jeda</button>
          <button class="hud-btn" id="btn-auto-view" title="Tur Sinematik Otomatis (V)">Auto View</button>
          <button class="hud-btn" id="btn-toggle-touch">Touch</button>
          <button class="hud-btn" id="btn-hide-hud" title="Sembunyikan HUD (H)">Hide HUD</button>
        </div>
      </div>

      <button class="hud-card hud-btn hud-restore-btn" id="btn-show-hud">Tampilkan HUD (H)</button>
      <div class="cinematic-banner" id="cinematic-banner">Tur Sinematik</div>

      <div class="crosshair" id="hud-crosshair"></div>
      <div class="desktop-hint" id="hud-hint">
        Klik layar untuk kontrol mouse • WASD (arah pandang) • Space/C (naik/turun) • Shift (cepat) • Scroll (kecepatan) • ESC (lepas)
      </div>

      <div class="touch-ui ${this.touchEnabled ? 'enabled' : ''}" id="touch-ui">
        <div class="joystick-zone" id="joystick-zone">
          <div class="joystick-knob" id="joystick-knob"></div>
        </div>
        <div class="touch-actions">
          <button class="touch-btn" id="btn-touch-boost">Cepat</button>
          <div class="touch-btn-row">
            <button class="touch-btn" id="btn-touch-down">Turun</button>
            <button class="touch-btn" id="btn-touch-up">Naik</button>
          </div>
        </div>
      </div>
    `;

    this.biomeEl = this.root.querySelector('#hud-biome')!;
    this.statsEl = this.root.querySelector('#hud-stats')!;
    this.crosshairEl = this.root.querySelector('#hud-crosshair')!;
    this.hintEl = this.root.querySelector('#hud-hint')!;
    this.touchUiEl = this.root.querySelector('#touch-ui')!;
    this.pauseBtn = this.root.querySelector('#btn-pause-time')!;

    this.root.querySelectorAll<HTMLButtonElement>('[data-weather]').forEach((btn) => {
      const w = btn.dataset.weather as WeatherType;
      this.weatherBtns.set(w, btn);
    });
  }

  private bindEvents(): void {
    // Weather buttons
    this.weatherBtns.forEach((btn, weather) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.bus.emit('weather:change', weather);
        this.setActiveWeather(weather);
      });
    });

    // Time buttons
    this.root.querySelectorAll<HTMLButtonElement>('[data-time]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.bus.emit('time:set', Number(btn.dataset.time));
      });
    });

    this.pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.pauseBtn.classList.toggle('active');
      this.bus.emit('time:toggle-pause', undefined);
    });

    const toggleTouchBtn = this.root.querySelector<HTMLButtonElement>('#btn-toggle-touch')!;
    if (this.touchEnabled) toggleTouchBtn.classList.add('active');
    toggleTouchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.touchEnabled = !this.touchEnabled;
      this.touchUiEl.classList.toggle('enabled', this.touchEnabled);
      toggleTouchBtn.classList.toggle('active', this.touchEnabled);
    });

    const toggleHud = () => {
      this.hudHidden = !this.hudHidden;
      this.root.classList.toggle('hud-hidden', this.hudHidden);
    };
    this.root.querySelector<HTMLButtonElement>('#btn-hide-hud')!.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHud();
    });
    this.root.querySelector<HTMLButtonElement>('#btn-show-hud')!.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHud();
    });
    const autoViewBtn = this.root.querySelector<HTMLButtonElement>('#btn-auto-view')!;
    const bannerEl = this.root.querySelector<HTMLElement>('#cinematic-banner')!;
    autoViewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.bus.emit('cinematic:toggle', undefined);
    });
    this.bus.on('cinematic:status', (st) => {
      autoViewBtn.classList.toggle('active', st.active);
      bannerEl.classList.toggle('visible', st.active);
      if (st.active) {
        bannerEl.textContent = `Tur Sinematik • ${st.label}`;
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH' && !e.repeat) {
        toggleHud();
      } else if (e.code === 'KeyV' && !e.repeat) {
        this.bus.emit('cinematic:toggle', undefined);
      }
    });

    this.controls.onLockChange((locked) => {
      this.crosshairEl.classList.toggle('visible', locked);
      this.hintEl.classList.toggle('hidden', locked);
    });

    this.bus.on('telemetry:update', (t) => {
      this.biomeEl.textContent = t.biome;
      const glBadge = this.root.querySelector('#hud-gl');
      if (glBadge) glBadge.textContent = t.webgl2 ? 'WebGL2' : 'WebGL1';

      const hh = Math.floor(t.timeOfDay * 24)
        .toString()
        .padStart(2, '0');
      const mm = Math.floor(((t.timeOfDay * 24) % 1) * 60)
        .toString()
        .padStart(2, '0');

      const latStr = `${Math.abs(t.lat).toFixed(4)}°${t.lat >= 0 ? 'N' : 'S'}`;
      const lonStr = `${Math.abs(t.lon).toFixed(4)}°${t.lon >= 0 ? 'E' : 'W'}`;

      this.statsEl.textContent =
        `${t.fps} FPS | ${hh}:${mm} | ${latStr}, ${lonStr} | Alt ${t.altMdpl.toFixed(0)}m mdpl (+${t.y.toFixed(1)}m) | ` +
        `Vel ${t.speed.toFixed(1)} m/s | Chunks ${t.chunksLoaded}`;

      this.setActiveWeather(t.weather);
    });

    this.bindTouchJoystick();
    this.bindTouchButtons();
  }

  private setActiveWeather(w: WeatherType): void {
    this.weatherBtns.forEach((btn, key) => {
      btn.classList.toggle('active', key === w);
    });
  }

  private bindTouchJoystick(): void {
    const zone = this.root.querySelector<HTMLElement>('#joystick-zone')!;
    const knob = this.root.querySelector<HTMLElement>('#joystick-knob')!;
    const maxRadius = 42;
    const touchState = this.controls.getTouchState();

    const updateStick = (clientX: number, clientY: number) => {
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      touchState.moveX = clamp(dx / maxRadius, -1, 1);
      touchState.moveY = clamp(-dy / maxRadius, -1, 1);
    };

    const resetStick = () => {
      this.stickPointerId = null;
      knob.style.transform = 'translate(0px, 0px)';
      touchState.moveX = 0;
      touchState.moveY = 0;
    };

    zone.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.stickPointerId === null) {
        this.stickPointerId = e.pointerId;
        zone.setPointerCapture?.(e.pointerId);
        updateStick(e.clientX, e.clientY);
      }
    });

    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickPointerId) return;
      e.stopPropagation();
      updateStick(e.clientX, e.clientY);
    });

    zone.addEventListener('pointerup', (e) => {
      if (e.pointerId === this.stickPointerId) {
        e.stopPropagation();
        resetStick();
      }
    });
    zone.addEventListener('pointercancel', (e) => {
      if (e.pointerId === this.stickPointerId) resetStick();
    });
  }

  private bindTouchButtons(): void {
    const upBtn = this.root.querySelector<HTMLButtonElement>('#btn-touch-up')!;
    const downBtn = this.root.querySelector<HTMLButtonElement>('#btn-touch-down')!;
    const boostBtn = this.root.querySelector<HTMLButtonElement>('#btn-touch-boost')!;
    const touchState = this.controls.getTouchState();

    // Up button with independent pointerId
    upBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.upPointerId === null) {
        this.upPointerId = e.pointerId;
        upBtn.setPointerCapture?.(e.pointerId);
        touchState.ascend = true;
        upBtn.classList.add('pressed');
      }
    });
    const endUp = (e: PointerEvent) => {
      if (e.pointerId === this.upPointerId) {
        this.upPointerId = null;
        touchState.ascend = false;
        upBtn.classList.remove('pressed');
      }
    };
    upBtn.addEventListener('pointerup', endUp);
    upBtn.addEventListener('pointercancel', endUp);

    // Down button with independent pointerId
    downBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.downPointerId === null) {
        this.downPointerId = e.pointerId;
        downBtn.setPointerCapture?.(e.pointerId);
        touchState.descend = true;
        downBtn.classList.add('pressed');
      }
    });
    const endDown = (e: PointerEvent) => {
      if (e.pointerId === this.downPointerId) {
        this.downPointerId = null;
        touchState.descend = false;
        downBtn.classList.remove('pressed');
      }
    };
    downBtn.addEventListener('pointerup', endDown);
    downBtn.addEventListener('pointercancel', endDown);

    // Boost toggle button (aktif / off)
    boostBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      touchState.boost = !touchState.boost;
      boostBtn.classList.toggle('boost-on', touchState.boost);
    });
  }
}
