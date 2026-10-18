import { CARD_COPY } from './story'

/**
 * 2D canvas artwork for the virtual card's front and back faces.
 * All coordinates are in logical CARD_TEX units; the caller supplies a context
 * whose transform maps them onto a (supersampled) backing canvas.
 */

export const CARD_TEX_W = 1024
export const CARD_TEX_H = 646

export const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif'
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Deterministic PRNG so the brushed-metal grain is identical on every render. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function brushed(ctx: CanvasRenderingContext2D, seed: number, alpha: number) {
  const rand = mulberry32(seed)
  for (let i = 0; i < 420; i++) {
    const y = rand() * CARD_TEX_H
    ctx.strokeStyle = `rgba(255,255,255,${(rand() * alpha).toFixed(3)})`
    ctx.lineWidth = rand() * 1.2 + 0.3
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(CARD_TEX_W, y + (rand() - 0.5) * 6)
    ctx.stroke()
  }
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  let cursor = x
  for (const ch of text) {
    ctx.fillText(ch, cursor, y)
    cursor += ctx.measureText(ch).width + spacing
  }
  return cursor - spacing
}

function spacedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  let w = 0
  for (const ch of text) w += ctx.measureText(ch).width + spacing
  return w - spacing
}

/**
 * Light ink with a hairline engraved shadow beneath it: on brushed metal this
 * defines glyph edges far better than flat fills. (Shadow offsets are in
 * backing pixels, so they're scaled by the context transform.)
 */
function engraved(ctx: CanvasRenderingContext2D, draw: () => void) {
  const k = ctx.getTransform().a
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
  ctx.shadowBlur = 1.5 * k
  ctx.shadowOffsetY = 1.2 * k
  draw()
  ctx.restore()
}

function emvChip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h)
  g.addColorStop(0, '#f4e5b2')
  g.addColorStop(0.42, '#cdae66')
  g.addColorStop(0.62, '#a9894c')
  g.addColorStop(1, '#efdca2')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 18)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 17)
  ctx.stroke()
  // contact pads around a central die
  const dx = x + w * 0.32
  const dw = w * 0.36
  const dy = y + h * 0.22
  const dh = h * 0.56
  ctx.strokeStyle = 'rgba(88, 64, 22, 0.6)'
  ctx.lineWidth = 2.2
  ctx.beginPath()
  for (const fy of [0.34, 0.66]) {
    ctx.moveTo(x, y + h * fy)
    ctx.lineTo(dx, y + h * fy)
    ctx.moveTo(dx + dw, y + h * fy)
    ctx.lineTo(x + w, y + h * fy)
  }
  ctx.moveTo(x + w / 2, y)
  ctx.lineTo(x + w / 2, dy)
  ctx.moveTo(x + w / 2, dy + dh)
  ctx.lineTo(x + w / 2, y + h)
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(dx, dy, dw, dh, 9)
  ctx.stroke()
}

export function drawCardFront(ctx: CanvasRenderingContext2D) {
  const W = CARD_TEX_W
  const H = CARD_TEX_H
  ctx.clearRect(0, 0, W, H)

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#2b2d34')
  bg.addColorStop(0.55, '#15161b')
  bg.addColorStop(1, '#1c1b27')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(W * 0.88, H * 0.1, 10, W * 0.88, H * 0.1, W * 0.7)
  glow.addColorStop(0, 'rgba(129,140,248,0.15)')
  glow.addColorStop(1, 'rgba(129,140,248,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  brushed(ctx, 7, 0.045)

  ctx.textBaseline = 'alphabetic'

  // Monogram + wordmark
  const mark = ctx.createLinearGradient(66, 64, 112, 110)
  mark.addColorStop(0, '#8d8ffa')
  mark.addColorStop(1, '#4f46e5')
  ctx.fillStyle = mark
  ctx.beginPath()
  ctx.roundRect(66, 66, 46, 46, 12)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 21px ${SANS}`
  ctx.textAlign = 'center'
  ctx.fillText('FC', 89, 97)
  ctx.textAlign = 'left'
  engraved(ctx, () => {
    ctx.fillStyle = '#f6f7f9'
    ctx.font = `700 50px ${SANS}`
    ctx.fillText('Fieldcard', 128, 106)
  })

  // Sandbox pill
  ctx.font = `700 24px ${MONO}`
  const label = 'SANDBOX'
  const pillW = spacedWidth(ctx, label, 5) + 46
  ctx.fillStyle = 'rgba(253, 230, 138, 0.1)'
  ctx.strokeStyle = 'rgba(253, 230, 138, 0.7)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(W - 66 - pillW, 62, pillW, 58, 29)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fde68a'
  spaced(ctx, label, W - 66 - pillW + 23, 100, 5)

  emvChip(ctx, 66, 192, 130, 100)

  // Contactless mark
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 4.5
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.arc(232, 242, 13 + i * 12, -0.78, 0.78)
    ctx.stroke()
  }

  // Masked number: geometric dots (crisper than bullet glyphs) + last four
  ctx.fillStyle = 'rgba(232, 234, 239, 0.9)'
  for (let group = 0; group < 3; group++) {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.arc(72 + group * 168 + i * 28, 420, 7.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  engraved(ctx, () => {
    ctx.fillStyle = '#ffffff'
    ctx.font = `600 60px ${MONO}`
    spaced(ctx, CARD_COPY.lastFour, 572, 441, 6)
  })

  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  ctx.font = `600 22px ${MONO}`
  spaced(ctx, 'SINGLE-USE VIRTUAL', 66, 514, 4)
  engraved(ctx, () => {
    ctx.fillStyle = '#f3f4f7'
    ctx.font = `700 33px ${MONO}`
    spaced(ctx, CARD_COPY.holder, 66, 564, 3)
  })

  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(190, 200, 255, 0.95)'
  ctx.font = `600 24px ${SANS}`
  ctx.fillText('Simulation — not a live card', W - 66, 564)
  ctx.textAlign = 'left'

  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(1.5, 1.5, W - 3, H - 3, 46)
  ctx.stroke()
}

/** Back face: the job constraints "print" row by row as `reveal` goes 0 → 1. */
export function drawCardBack(ctx: CanvasRenderingContext2D, reveal: number) {
  const W = CARD_TEX_W
  const H = CARD_TEX_H
  ctx.clearRect(0, 0, W, H)

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#15171d')
  bg.addColorStop(1, '#0d0e12')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  brushed(ctx, 19, 0.03)

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = `600 22px ${MONO}`
  spaced(ctx, 'FIELDCARD · SANDBOX VIRTUAL CARD', 66, 86, 4)
  ctx.fillStyle = 'rgba(253, 230, 138, 0.85)'
  ctx.textAlign = 'right'
  ctx.fillText(`•••• ${CARD_COPY.lastFour}`, W - 66, 86)
  ctx.textAlign = 'left'

  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillRect(66, 112, W - 132, 2)

  const rows = CARD_COPY.specs
  rows.forEach((row, i) => {
    const a = clamp01(reveal * rows.length - i)
    if (a <= 0) return
    const y = 178 + i * 84
    const dx = (1 - a) * 18
    ctx.globalAlpha = a
    ctx.fillStyle = 'rgba(255,255,255,0.58)'
    ctx.font = `600 22px ${MONO}`
    spaced(ctx, row.label.toUpperCase(), 66 + dx, y, 3)
    engraved(ctx, () => {
      ctx.fillStyle = '#f6f7f9'
      ctx.font = `600 38px ${SANS}`
      ctx.fillText(row.value, 300 + dx, y + 2)
    })
    // check mark
    ctx.strokeStyle = '#34d399'
    ctx.lineWidth = 5.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(W - 98, y - 10)
    ctx.lineTo(W - 86, y + 2)
    ctx.lineTo(W - 64, y - 22)
    ctx.stroke()
    if (i < rows.length - 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(66, y + 32, W - 132, 2)
    }
    ctx.globalAlpha = 1
  })

  ctx.fillStyle = 'rgba(255,255,255,0.48)'
  ctx.font = `500 22px ${SANS}`
  ctx.fillText('Sandbox simulation — not a live payment card.', 66, H - 34)

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(1.5, 1.5, W - 3, H - 3, 46)
  ctx.stroke()
}
