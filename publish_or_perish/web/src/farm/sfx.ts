// 効果音. 音は「音: 入」を押してから鳴らす (ブラウザは操作の前に音を出させない).
let actx: AudioContext | null = null

export const soundOn = () => actx !== null

export function toggleSound(): boolean {
  if (!actx) {
    actx = new AudioContext()
    sfx.buy()
  } else {
    void actx.close()
    actx = null
  }
  return soundOn()
}

export function tone(freq: number, t0: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) {
  if (!actx) return
  const o = actx.createOscillator(),
    g = actx.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(vol, actx.currentTime + t0)
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + t0 + dur)
  o.connect(g).connect(actx.destination)
  o.start(actx.currentTime + t0)
  o.stop(actx.currentTime + t0 + dur + 0.05)
}

export const sfx = {
  harvest: () => {
    tone(988, 0, 0.12, 'square', 0.06)
    tone(1319, 0.08, 0.3, 'square', 0.06)
  },
  water: () => {
    tone(420, 0, 0.12, 'sine', 0.12)
    tone(300, 0.05, 0.15, 'sine', 0.1)
  },
  plant: () => tone(180, 0, 0.15, 'triangle', 0.2),
  wither: () => {
    tone(300, 0, 0.3, 'sawtooth', 0.04)
    tone(200, 0.2, 0.4, 'sawtooth', 0.04)
  },
  wall: () => tone(90, 0, 0.12, 'square', 0.08),
  buy: () => {
    tone(1568, 0, 0.1, 'square', 0.05)
    tone(2093, 0.1, 0.25, 'square', 0.05)
  },
  bell: () => [0, 0.18].forEach(t0 => tone(1320, t0, 0.9, 'sine', 0.12)),
  mission: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.15)),
  achievement: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.25, 'sine', 0.12)),
  level: () => [392, 523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.35, 'square', 0.06)),
}
