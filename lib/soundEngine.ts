/**
 * DADO SALVAJE — Premium Sound Engine
 * Centralized audio system with cinematic game sounds
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function getMaster(): GainNode {
  getCtx();
  return masterGain!;
}

// ===== UTILITY =====

function createNoise(duration: number, volume: number = 0.1): AudioBuffer {
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume;
  }
  return buffer;
}

function playNote(freq: number, type: OscillatorType, startTime: number, duration: number, volume: number = 0.12, fadeOut: boolean = true) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(volume, startTime);
  if (fadeOut) {
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  }
  osc.connect(gain);
  gain.connect(getMaster());
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// ===== COUNTDOWN TICK (ascending pitch) =====

export function playCountdownTick(number: number) {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const baseFreq = 600 + (4 - number) * 200;
    
    playNote(baseFreq, "sine", t, 0.15, 0.18);
    playNote(baseFreq * 1.5, "sine", t + 0.01, 0.1, 0.06);
    playNote(80, "sine", t, 0.08, 0.15);
  } catch {}
}

// ===== COUNTDOWN "GO!" =====

export function playCountdownGo() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(1600, t + 0.3);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(getMaster());
    osc.start(t);
    osc.stop(t + 0.4);

    playNote(100, "sine", t + 0.05, 0.2, 0.2);
    playNote(200, "triangle", t + 0.05, 0.15, 0.1);
  } catch {}
}

// ===== DRUM ROLL with CRESCENDO =====

let drumRollInterval: ReturnType<typeof setInterval> | null = null;
let sharedDrumBuffer: AudioBuffer | null = null;

export function startDrumRoll() {
  if (drumRollInterval) return;
  try {
    const ctx = getCtx();
    let volume = 0.03;
    if (!sharedDrumBuffer) {
      sharedDrumBuffer = createNoise(0.08, 1.0);
    }
    
    drumRollInterval = setInterval(() => {
      const t = ctx.currentTime;
      
      const source = ctx.createBufferSource();
      source.buffer = sharedDrumBuffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 2000 + Math.random() * 1000;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(getMaster());
      source.start(t);

      volume = Math.min(volume + 0.003, 0.2);
    }, 50);
  } catch {}
}

export function stopDrumRoll() {
  if (drumRollInterval) {
    clearInterval(drumRollInterval);
    drumRollInterval = null;
  }
}

// ===== DICE ROLL SOUND =====

export function playRollSound() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    const buffer = createNoise(0.12, 0.15);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800 + Math.random() * 600;
    filter.Q.value = 2;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(getMaster());
    source.start(t);
  } catch {}
}

// ===== DICE LAND — REALISTIC PHYSICS SYNTHESIS =====
// Simula: impacto duro + rebotes amortiguados + resonancia de mesa + chasquido de plástico

export function playDiceLand(diceValue: number = 3) {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;

    // 1. IMPACTO PRINCIPAL — golpe seco de dado contra mesa
    const impactNoise = createNoise(0.08, 1.0);
    const impactSrc = ctx.createBufferSource();
    impactSrc.buffer = impactNoise;

    const impactFilter = ctx.createBiquadFilter();
    impactFilter.type = 'bandpass';
    impactFilter.frequency.value = 300 + diceValue * 40;
    impactFilter.Q.value = 0.8;

    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(0.55, t);
    impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    impactSrc.connect(impactFilter);
    impactFilter.connect(impactGain);
    impactGain.connect(getMaster());
    impactSrc.start(t);

    // 2. RESONANCIA BAJA — cuerpo hueco resonando
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(120 - diceValue * 8, t);
    bodyOsc.frequency.exponentialRampToValueAtTime(30, t + 0.25);
    bodyGain.gain.setValueAtTime(0.35, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(getMaster());
    bodyOsc.start(t);
    bodyOsc.stop(t + 0.25);

    // 3. CHASQUIDO de esquina del dado (high transient)
    const clickNoise = createNoise(0.015, 1.0);
    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = clickNoise;
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.value = 4500;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.3, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
    clickSrc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(getMaster());
    clickSrc.start(t);

    // 4. REBOTES DE AMORTIGUACIÓN — 2-3 pequeños rebotes después del impacto
    const numBounces = diceValue >= 5 ? 3 : 2;
    for (let b = 0; b < numBounces; b++) {
      const bounceDelay = t + 0.08 + b * (0.06 - b * 0.015);
      const bounceVol = 0.2 - b * 0.06;

      const bNoise = createNoise(0.03, 1.0);
      const bSrc = ctx.createBufferSource();
      bSrc.buffer = bNoise;
      const bFilter = ctx.createBiquadFilter();
      bFilter.type = 'bandpass';
      bFilter.frequency.value = 500 + b * 200;
      bFilter.Q.value = 1.5;
      const bGain = ctx.createGain();
      bGain.gain.setValueAtTime(bounceVol, bounceDelay);
      bGain.gain.exponentialRampToValueAtTime(0.001, bounceDelay + 0.04);
      bSrc.connect(bFilter);
      bFilter.connect(bGain);
      bGain.connect(getMaster());
      bSrc.start(bounceDelay);
    }

    // 5. Si es 6 (Salvaje) — tono metálico dramático extra
    if (diceValue === 6) {
      const metalOsc = ctx.createOscillator();
      const metalGain = ctx.createGain();
      metalOsc.type = 'sine';
      metalOsc.frequency.setValueAtTime(800, t + 0.02);
      metalOsc.frequency.exponentialRampToValueAtTime(200, t + 0.4);
      metalGain.gain.setValueAtTime(0.12, t + 0.02);
      metalGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      metalOsc.connect(metalGain);
      metalGain.connect(getMaster());
      metalOsc.start(t + 0.02);
      metalOsc.stop(t + 0.4);
    }
  } catch {}
}


// ===== CRITICAL HIT =====

export function playCriticalHit() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    [130.81, 164.81, 196.00, 261.63].forEach((freq, i) => {
      playNote(freq, "sawtooth", t + i * 0.02, 0.4, 0.08);
    });
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(2000, t + 0.3);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(getMaster());
    osc.start(t);
    osc.stop(t + 0.4);

    const buffer = createNoise(0.1, 0.3);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    source.connect(g);
    g.connect(getMaster());
    source.start(t + 0.15);
  } catch {}
}

// ===== TIE-BREAKER LIGHTNING =====

export function playTieBreaker() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    for (let i = 0; i < 5; i++) {
      const buffer = createNoise(0.03, 0.4);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      const offset = i * 0.06 + Math.random() * 0.02;
      gain.gain.setValueAtTime(0.1, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.04);
      
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 3000 + Math.random() * 2000;
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(getMaster());
      source.start(t + offset);
    }
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(60, t + 0.2);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.8);
    gain.gain.setValueAtTime(0.12, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc.connect(gain);
    gain.connect(getMaster());
    osc.start(t + 0.2);
    osc.stop(t + 0.8);
  } catch {}
}

// ===== WIN FANFARE =====

export function playWinFanfare() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    const progression = [
      { notes: [261.63, 329.63, 392.00], time: 0 },
      { notes: [349.23, 440.00, 523.25], time: 0.15 },
      { notes: [392.00, 493.88, 587.33], time: 0.30 },
      { notes: [523.25, 659.25, 783.99], time: 0.45 },
      { notes: [1046.50], time: 0.65 },
    ];
    
    progression.forEach(chord => {
      chord.notes.forEach(freq => {
        playNote(freq, "sine", t + chord.time, 0.35, 0.1);
        playNote(freq * 1.003, "triangle", t + chord.time, 0.3, 0.04);
      });
    });
    
    const arp = [523.25, 659.25, 783.99, 1046.50, 1318.50];
    arp.forEach((freq, i) => {
      playNote(freq, "sine", t + 0.7 + i * 0.08, 0.3, 0.08);
    });
    
    playNote(2093, "sine", t + 1.2, 0.5, 0.04);
    playNote(2637, "sine", t + 1.25, 0.4, 0.03);
  } catch {}
}

// ===== CROWD CHEER =====

export function playCrowdCheer() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    const bands = [
      { freq: 400, q: 0.5 },
      { freq: 800, q: 0.8 },
      { freq: 1200, q: 1.0 },
      { freq: 2000, q: 0.6 },
    ];
    
    bands.forEach(band => {
      const buffer = createNoise(1.5, 0.15);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = band.freq;
      filter.Q.value = band.q;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.2);
      gain.gain.setValueAtTime(0.04, t + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(getMaster());
      source.start(t);
    });
  } catch {}
}

// ===== SUSPENSE BUILD =====

export function playSuspenseBuild() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.linearRampToValueAtTime(120, t + 2);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    osc.connect(gain);
    gain.connect(getMaster());
    osc.start(t);
    osc.stop(t + 2.2);
    
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(220, t);
    osc2.frequency.linearRampToValueAtTime(440, t + 2);
    
    lfo.type = "sine";
    lfo.frequency.value = 6;
    lfoGain.gain.value = 0.03;
    
    lfo.connect(lfoGain);
    lfoGain.connect(gain2.gain);
    gain2.gain.setValueAtTime(0.03, t);
    gain2.gain.linearRampToValueAtTime(0.06, t + 1.5);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 2);
    
    osc2.connect(gain2);
    gain2.connect(getMaster());
    osc2.start(t);
    lfo.start(t);
    osc2.stop(t + 2);
    lfo.stop(t + 2);
  } catch {}
}

// ===== LEVEL UP SOUND =====

export function playLevelUp() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.50, 1567.98, 2093.00];
    notes.forEach((freq, i) => {
      playNote(freq, "sine", t + i * 0.07, 0.5 - i * 0.04, 0.1);
      playNote(freq * 2, "sine", t + i * 0.07 + 0.02, 0.3, 0.03); 
    });
    
    for (let i = 0; i < 8; i++) {
      const freq = 2000 + Math.random() * 3000;
      playNote(freq, "sine", t + 0.5 + i * 0.05, 0.1, 0.02);
    }
  } catch {}
}

// ===== CLEANUP =====

export function cleanup() {
  stopDrumRoll();
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
    masterGain = null;
  }
}
