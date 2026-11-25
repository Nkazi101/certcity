/**
 * Procedural ambient sound for the 3D city. Everything is synthesized with the Web Audio API: no audio files are
 * downloaded. Sound stays off until the learner turns it on; after that the choice is remembered and the context
 * resumes on the next user gesture (browsers block audio before one).
 */

export type SoundMix = { scene: "city" | "depot" | "mission"; district: string; night: number; calm: boolean };

const storageKey = "certcity.sound.v1";
type Bed = "wind" | "hum" | "water";
type Levels = Record<Bed, number> & { birds: number; crickets: number };

const parks = new Set(["forest-park", "gardens"]);
const busy = new Set(["downtown", "delmar", "enterprise", "ballpark"]);

function levelsFor({ scene, district, night }: SoundMix): Levels {
  let levels: Levels;
  if (scene !== "city") levels = { wind: .07, hum: .42, water: 0, birds: .08, crickets: 0 };
  else if (district === "riverfront") levels = { wind: .5, hum: .18, water: .42, birds: .35, crickets: 0 };
  else if (parks.has(district)) levels = { wind: .42, hum: .07, water: 0, birds: .95, crickets: 0 };
  else if (busy.has(district)) levels = { wind: .24, hum: .5, water: 0, birds: .28, crickets: 0 };
  else levels = { wind: .3, hum: .22, water: 0, birds: .6, crickets: 0 };
  const dark = Math.min(1, Math.max(0, (night - .45) / .45));
  return {
    ...levels,
    hum: levels.hum * (1 - dark * .35),
    wind: levels.wind * (1 + dark * .15),
    birds: levels.birds * (1 - dark),
    crickets: scene === "city" ? (levels.birds * .7 + .1) * dark : 0,
  };
}

function readPreference() {
  try {
    return window.localStorage.getItem(storageKey) === "on";
  } catch {
    return false;
  }
}

function writePreference(on: boolean) {
  try {
    window.localStorage.setItem(storageKey, on ? "on" : "off");
  } catch {
    // The choice still applies for this visit.
  }
}

class Soundscape {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private beds: Partial<Record<Bed, GainNode>> = {};
  private levels: Levels = { wind: 0, hum: 0, water: 0, birds: 0, crickets: 0 };
  private mix: SoundMix = { scene: "city", district: "downtown", night: 0, calm: false };
  private timers: number[] = [];
  private listeners = new Set<() => void>();
  private wanted = false;
  private gestureArmed = false;

  /** Whether the learner has chosen to hear the city. */
  get on() {
    return this.wanted;
  }

  init() {
    if (this.gestureArmed || typeof window === "undefined") return;
    this.wanted = readPreference();
    if (!this.wanted) return;
    this.gestureArmed = true;
    const resume = () => {
      window.removeEventListener("pointerdown", resume, true);
      window.removeEventListener("keydown", resume, true);
      if (this.wanted) this.start();
    };
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  /** Must be called from a user gesture the first time. */
  toggle() {
    this.wanted = !this.wanted;
    writePreference(this.wanted);
    if (this.wanted) this.start();
    else this.stop();
    this.notify();
  }

  setMix(mix: SoundMix) {
    this.mix = mix;
    this.apply();
  }

  /** A soft click for selections; silent unless sound is on. */
  tick(pitch = 1) {
    const context = this.context;
    if (!context || !this.master || !this.wanted || context.state !== "running") return;
    const now = context.currentTime;
    const tone = context.createOscillator();
    const body = context.createGain();
    tone.type = "sine";
    tone.frequency.setValueAtTime(1180 * pitch, now);
    tone.frequency.exponentialRampToValueAtTime(820 * pitch, now + .07);
    body.gain.setValueAtTime(0, now);
    body.gain.linearRampToValueAtTime(.09, now + .006);
    body.gain.exponentialRampToValueAtTime(.0001, now + .11);
    tone.connect(body).connect(this.master);
    tone.start(now);
    tone.stop(now + .13);
  }

  private start() {
    try {
      if (!this.context) this.build();
      void this.context?.resume();
      this.apply();
      this.schedule();
    } catch {
      this.wanted = false;
      this.notify();
    }
  }

  private stop() {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers = [];
    const context = this.context;
    if (!context || !this.master) return;
    this.master.gain.setTargetAtTime(0, context.currentTime, .12);
    window.setTimeout(() => {
      if (!this.wanted) void context.suspend();
    }, 600);
  }

  private noise(context: AudioContext, brown = false) {
    const length = context.sampleRate * 4;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + .02 * white) / 1.02;
        data[i] = last * 3.4;
      } else data[i] = white;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  private lfo(context: AudioContext, rate: number, depth: number, target: AudioParam) {
    const oscillator = context.createOscillator();
    const amount = context.createGain();
    oscillator.frequency.value = rate;
    amount.gain.value = depth;
    oscillator.connect(amount).connect(target);
    oscillator.start();
  }

  private build() {
    const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) throw new Error("Web Audio is unavailable");
    const context = new Context();
    const master = context.createGain();
    master.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    master.connect(compressor).connect(context.destination);

    // Wind: white noise through a slowly breathing low-pass filter.
    const wind = this.noise(context);
    const windFilter = context.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 420;
    windFilter.Q.value = .6;
    this.lfo(context, .071, 210, windFilter.frequency);
    const windGain = context.createGain();
    windGain.gain.value = 0;
    const windSwell = context.createGain();
    windSwell.gain.value = .75;
    this.lfo(context, .043, .25, windSwell.gain);
    wind.connect(windFilter).connect(windSwell).connect(windGain).connect(master);
    wind.start();

    // City hum: brown noise kept low and warm, like distant traffic.
    const hum = this.noise(context, true);
    const humFilter = context.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.value = 260;
    const humGain = context.createGain();
    humGain.gain.value = 0;
    hum.connect(humFilter).connect(humGain).connect(master);
    hum.start();

    // River: band-passed noise with a slow lapping swell.
    const water = this.noise(context);
    const waterFilter = context.createBiquadFilter();
    waterFilter.type = "bandpass";
    waterFilter.frequency.value = 720;
    waterFilter.Q.value = .8;
    const waterSwell = context.createGain();
    waterSwell.gain.value = .6;
    this.lfo(context, .23, .3, waterSwell.gain);
    const waterGain = context.createGain();
    waterGain.gain.value = 0;
    water.connect(waterFilter).connect(waterSwell).connect(waterGain).connect(master);
    water.start();

    this.context = context;
    this.master = master;
    this.beds = { wind: windGain, hum: humGain, water: waterGain };
  }

  private apply() {
    const context = this.context;
    if (!context || !this.master || !this.wanted) return;
    const now = context.currentTime;
    this.levels = levelsFor(this.mix);
    const scale = { wind: .16, hum: .3, water: .1 } satisfies Record<Bed, number>;
    for (const bed of ["wind", "hum", "water"] as const) {
      this.beds[bed]?.gain.setTargetAtTime(this.levels[bed] * scale[bed], now, 1.3);
    }
    this.master.gain.setTargetAtTime(this.mix.calm ? .28 : .85, now, this.mix.calm ? .35 : .9);
  }

  private schedule() {
    if (this.timers.length) return;
    const birdLoop = () => {
      const level = this.levels.birds * (this.mix.calm ? .2 : 1);
      if (level > .04) this.chirp(level);
      this.timers[0] = window.setTimeout(birdLoop, 1400 + Math.random() * 5200 / Math.max(.25, level));
    };
    const cricketLoop = () => {
      const level = this.levels.crickets * (this.mix.calm ? .3 : 1);
      if (level > .04) this.cricket(level);
      this.timers[1] = window.setTimeout(cricketLoop, 700 + Math.random() * 900);
    };
    this.timers[0] = window.setTimeout(birdLoop, 900);
    this.timers[1] = window.setTimeout(cricketLoop, 1300);
  }

  private chirp(level: number) {
    const context = this.context;
    if (!context || !this.master || context.state !== "running") return;
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2300 + Math.random() * 1700;
    const pan = context.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - .8;
    pan.connect(this.master);
    let at = context.currentTime + .02;
    for (let i = 0; i < notes; i++) {
      const tone = context.createOscillator();
      const gain = context.createGain();
      const length = .05 + Math.random() * .07;
      const pitch = base * (1 + (Math.random() - .3) * .25);
      tone.type = "sine";
      tone.frequency.setValueAtTime(pitch, at);
      tone.frequency.exponentialRampToValueAtTime(pitch * (1.15 + Math.random() * .35), at + length * .6);
      tone.frequency.exponentialRampToValueAtTime(pitch * .9, at + length);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.028 * level, at + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, at + length);
      tone.connect(gain).connect(pan);
      tone.start(at);
      tone.stop(at + length + .02);
      at += length + .03 + Math.random() * .08;
    }
  }

  private cricket(level: number) {
    const context = this.context;
    if (!context || !this.master || context.state !== "running") return;
    let at = context.currentTime + .02;
    const pitch = 4300 + Math.random() * 500;
    for (let i = 0; i < 3; i++) {
      const tone = context.createOscillator();
      const gain = context.createGain();
      tone.frequency.value = pitch;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.008 * level, at + .006);
      gain.gain.linearRampToValueAtTime(0, at + .032);
      tone.connect(gain).connect(this.master);
      tone.start(at);
      tone.stop(at + .04);
      at += .055;
    }
  }
}

export const soundscape = new Soundscape();
