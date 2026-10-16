// Seal portraits: a deterministic painting generated from a memory's SHA-256.
// Same text -> same hash -> same portrait. Change one character -> a different portrait.
// Lineage: Perrig & Song, "Hash Visualization" (1999), the idea behind SSH's randomart.
import type { ArtStyle } from '../types'

const PIGMENTS = ['#1f4e8c', '#b23a2a', '#c8962e', '#3f7f5f', '#6b3d2e', '#8a2f5c', '#2e6f86', '#d6b25e']

interface StyleSpec {
  bg: [string, string]
  palette: string[] | null
  stroke: boolean
  blur: number
  layersMax: number
  opacity: [number, number]
  glow: string | null
}

const STYLES: Record<ArtStyle, StyleSpec> = {
  Cinematic: { bg: ['#2a1d10', '#080807'], palette: ['#FFB84D', '#F4D18E', '#c8962e', '#b4532a', '#6b3d2e'], stroke: false, blur: 0, layersMax: 5, opacity: [0.35, 0.8], glow: '#FFB84D' },
  Watercolor: { bg: ['#f3ecdf', '#d9cdb6'], palette: PIGMENTS, stroke: false, blur: 3, layersMax: 5, opacity: [0.25, 0.55], glow: null },
  Sketch: { bg: ['#ece6da', '#cfc6b5'], palette: ['#3a332b', '#5a5046', '#2b2622'], stroke: true, blur: 0, layersMax: 4, opacity: [0.6, 0.9], glow: null },
  Minimal: { bg: ['#1b1a18', '#111110'], palette: ['#F6EBDD', '#9c9488', '#F4D18E'], stroke: false, blur: 0, layersMax: 2, opacity: [0.25, 0.6], glow: null },
  Fantasy: { bg: ['#2a1238', '#0b0712'], palette: ['#c46be0', '#7a5cff', '#ff7ac6', '#F4D18E', '#3fd0d4'], stroke: false, blur: 1, layersMax: 5, opacity: [0.35, 0.75], glow: '#c46be0' },
}

function rng(hex: string) {
  let seed = (parseInt(hex.slice(0, 8), 16) ^ parseInt(hex.slice(8, 16), 16)) | 0
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function portraitSvg(hash: string | null, style: ArtStyle = 'Cinematic'): string {
  if (!hash) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#0d0c0b"/><circle cx="100" cy="100" r="58" fill="none" stroke="#3a3128" stroke-width="2" stroke-dasharray="4 7"/></svg>`
  }
  const s = STYLES[style]
  const r = rng(hash)
  const pal = s.palette ?? PIGMENTS
  const pick = () => pal[Math.floor(r() * pal.length)]
  const cols = [pick(), pick(), pick()]
  const sym = 5 + Math.floor(r() * 5)
  const layers = Math.min(s.layersMax, 2 + Math.floor(r() * 4))
  const id = hash.slice(0, 8)
  let shapes = ''
  for (let L = 0; L < layers; L++) {
    const radius = 16 + r() * 52
    const w = 6 + r() * 24
    const h = 14 + r() * 38
    const rot = r() * 360
    const fill = cols[L % 3]
    const op = (s.opacity[0] + r() * (s.opacity[1] - s.opacity[0])).toFixed(2)
    for (let k = 0; k < sym; k++) {
      const a = (rot + (360 / sym) * k).toFixed(1)
      shapes += s.stroke
        ? `<ellipse cx="100" cy="${(100 - radius).toFixed(1)}" rx="${w.toFixed(1)}" ry="${h.toFixed(1)}" fill="none" stroke="${fill}" stroke-opacity="${op}" stroke-width="1.2" transform="rotate(${a} 100 100)"/>`
        : `<ellipse cx="100" cy="${(100 - radius).toFixed(1)}" rx="${w.toFixed(1)}" ry="${h.toFixed(1)}" fill="${fill}" fill-opacity="${op}" transform="rotate(${a} 100 100)"/>`
    }
  }
  const ring = 68 + r() * 10
  const dots = Array.from({ length: sym * 2 }, (_, k) => {
    const a = (Math.PI * 2 * k) / (sym * 2)
    return `<circle cx="${(100 + ring * Math.cos(a)).toFixed(1)}" cy="${(100 + ring * Math.sin(a)).toFixed(1)}" r="${(1.2 + r() * 2.2).toFixed(1)}" fill="${s.stroke ? '#3a332b' : '#F4D18E'}" fill-opacity="0.8"/>`
  }).join('')
  const filter = s.blur ? `<filter id="w${id}"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${parseInt(hash.slice(16, 20), 16) % 97}"/><feDisplacementMap in="SourceGraphic" scale="9"/><feGaussianBlur stdDeviation="${s.blur}"/></filter>` : ''
  const glow = s.glow ? `<circle cx="100" cy="100" r="70" fill="url(#gl${id})"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
<defs><radialGradient id="bg${id}" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="${s.bg[0]}"/><stop offset="1" stop-color="${s.bg[1]}"/></radialGradient>
${s.glow ? `<radialGradient id="gl${id}"><stop offset="0" stop-color="${s.glow}" stop-opacity="0.35"/><stop offset="1" stop-color="${s.glow}" stop-opacity="0"/></radialGradient>` : ''}${filter}</defs>
<rect width="200" height="200" fill="url(#bg${id})"/>${glow}
<g${s.blur ? ` filter="url(#w${id})"` : ''}>${shapes}</g>
<circle cx="100" cy="100" r="${(7 + r() * 9).toFixed(1)}" fill="${cols[1]}" fill-opacity="0.9"/>${dots}</svg>`
}

export const portraitUri = (hash: string | null, style: ArtStyle = 'Cinematic') =>
  `data:image/svg+xml;utf8,${encodeURIComponent(portraitSvg(hash, style))}`
