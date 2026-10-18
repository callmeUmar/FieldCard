import { CARD_TEX_H, CARD_TEX_W, MONO, SANS } from './cardRenderer'
import { SCREEN_COPY } from './story'

/**
 * Draws the phone's screen (lock screen → notification → SMS thread) into a
 * 2D canvas used as the screen texture. Every element is driven by 0→1
 * progress values, so the story can be scrubbed forwards and backwards.
 *
 * Coordinates are logical SCREEN_W × SCREEN_H units (≈1.9 units per iOS
 * point); the caller's context transform maps them onto a supersampled canvas.
 */

export const SCREEN_W = 750
export const SCREEN_H = 1624

export type ScreenState = {
  notif: number
  expand: number
  m1: number
  typing: number
  m2: number
  policy: number
  m3: number
  bubble: number
  /** The 3D card has lifted off the screen — leave its slot empty. */
  lifted: boolean
}

export type Rect = { x: number; y: number; w: number; h: number }

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const smooth = (t: number) => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const BUBBLE = { size: 35, line: 45, padX: 28, padY: 18, maxW: 566, radius: 38, gap: 16 }
const SIDE = 30
const THREAD_TOP = 352
const INPUT_TOP = 1468
const CARD_BUBBLE_W = 468
const CARD_BUBBLE_H = Math.round((CARD_BUBBLE_W * CARD_TEX_H) / CARD_TEX_W)
const BANNER: Rect = { x: 26, y: 650, w: 698, h: 196 }

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (line && ctx.measureText(test).width > maxW) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

type Bubble = { lines: string[]; w: number; h: number }

function measureBubble(ctx: CanvasRenderingContext2D, text: string): Bubble {
  ctx.font = `400 ${BUBBLE.size}px ${SANS}`
  const lines = wrap(ctx, text, BUBBLE.maxW - BUBBLE.padX * 2)
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + BUBBLE.padX * 2
  return { lines, w: Math.ceil(w), h: lines.length * BUBBLE.line + BUBBLE.padY * 2 }
}

type Slot = { y: number; h: number }

export type ThreadLayout = {
  checkIn: Bubble & { x: number; y: number }
  request: Bubble & { x: number; y: number }
  typing: Slot
  checking: Bubble & { x: number; y: number }
  policy: Slot
  approved: Bubble & { x: number; y: number }
  card: Rect
  stampY: number
}

/** Positions of every thread element for the given progress (scroll offset applied). */
export function layoutThread(ctx: CanvasRenderingContext2D, s: ScreenState): ThreadLayout {
  const checkIn = measureBubble(ctx, SCREEN_COPY.checkIn)
  const request = measureBubble(ctx, SCREEN_COPY.request)
  const checking = measureBubble(ctx, SCREEN_COPY.checking)
  const approved = measureBubble(ctx, SCREEN_COPY.approved)
  const typingH = 80
  const policyH = 60
  const cardH = CARD_BUBBLE_H + 50

  let y = THREAD_TOP
  const stampY = y
  y += 58
  const checkInY = y
  y += checkIn.h + BUBBLE.gap
  const requestY = y
  y += (request.h + BUBBLE.gap) * smooth(s.m1 * 1.25)
  const replyY = y
  y += (lerp(typingH, checking.h, smooth(s.m2)) + BUBBLE.gap) * smooth(Math.max(s.typing, s.m2) * 1.4)
  const policyY = y
  y += (policyH + BUBBLE.gap) * smooth(s.policy * 1.25)
  const approvedY = y
  y += (approved.h + BUBBLE.gap) * smooth(s.m3 * 1.25)
  const cardY = y
  y += (cardH + BUBBLE.gap) * smooth(s.bubble * 1.25)

  const offset = Math.max(0, y - (INPUT_TOP - 30))

  return {
    stampY: stampY - offset,
    checkIn: { ...checkIn, x: SIDE, y: checkInY - offset },
    request: { ...request, x: SCREEN_W - SIDE - request.w, y: requestY - offset },
    typing: { y: replyY - offset, h: typingH },
    checking: { ...checking, x: SIDE, y: replyY - offset },
    policy: { y: policyY - offset, h: policyH },
    approved: { ...approved, x: SIDE, y: approvedY - offset },
    card: { x: SIDE, y: cardY - offset, w: CARD_BUBBLE_W, h: CARD_BUBBLE_H },
  }
}

function statusBar(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#fff'
  ctx.font = `600 32px ${SANS}`
  ctx.textAlign = 'center'
  ctx.fillText('9:41', 130, 76)
  ctx.textAlign = 'left'
  // signal
  for (let i = 0; i < 4; i++) {
    const h = 10 + i * 5.5
    ctx.beginPath()
    ctx.roundRect(548 + i * 12, 76 - h, 8, h, 2)
    ctx.fill()
  }
  // wifi
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(624, 78, 7 + i * 8, -Math.PI * 0.75, -Math.PI * 0.25)
    ctx.stroke()
  }
  // battery
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(652, 54, 50, 25, 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(656, 58, 38, 17, 5)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.roundRect(705, 62, 4, 10, 2)
  ctx.fill()
  // camera cut-out
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.roundRect(SCREEN_W / 2 - 110, 24, 220, 64, 32)
  ctx.fill()
}

function lockScreen(ctx: CanvasRenderingContext2D, alpha: number) {
  if (alpha <= 0) return
  ctx.globalAlpha = alpha
  const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H)
  g.addColorStop(0, '#191d43')
  g.addColorStop(0.5, '#0d0f20')
  g.addColorStop(1, '#040509')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
  const glowA = ctx.createRadialGradient(220, 520, 20, 220, 520, 640)
  glowA.addColorStop(0, 'rgba(99,102,241,0.5)')
  glowA.addColorStop(1, 'rgba(99,102,241,0)')
  ctx.fillStyle = glowA
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
  const glowB = ctx.createRadialGradient(640, 1080, 20, 640, 1080, 560)
  glowB.addColorStop(0, 'rgba(56,189,248,0.18)')
  glowB.addColorStop(1, 'rgba(56,189,248,0)')
  ctx.fillStyle = glowB
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.86)'
  ctx.font = `600 34px ${SANS}`
  ctx.fillText('Saturday, October 17', SCREEN_W / 2, 252)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = `700 196px ${SANS}`
  ctx.fillText('9:41', SCREEN_W / 2, 448)
  ctx.textAlign = 'left'

  // flashlight / camera affordances
  for (const x of [112, SCREEN_W - 112]) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.beginPath()
    ctx.arc(x, SCREEN_H - 176, 50, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(100, SCREEN_H - 200, 24, 46, 6)
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(SCREEN_W - 134, SCREEN_H - 194, 44, 34, 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(SCREEN_W - 112, SCREEN_H - 177, 9, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function bubble(
  ctx: CanvasRenderingContext2D,
  b: Bubble & { x: number; y: number },
  sent: boolean,
  p: number,
) {
  const a = smooth(p * 1.3)
  if (a <= 0) return
  const dy = (1 - smooth(p)) * 26
  ctx.globalAlpha = a
  if (sent) {
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h)
    g.addColorStop(0, '#1a8cff')
    g.addColorStop(1, '#0a74ea')
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = '#26262a'
  }
  ctx.beginPath()
  ctx.roundRect(b.x, b.y + dy, b.w, b.h, sent ? [38, 38, 10, 38] : [38, 38, 38, 10])
  ctx.fill()
  ctx.fillStyle = sent ? '#ffffff' : '#f2f2f7'
  ctx.font = `400 ${BUBBLE.size}px ${SANS}`
  b.lines.forEach((line, i) => {
    ctx.fillText(line, b.x + BUBBLE.padX, b.y + dy + BUBBLE.padY + 33 + i * BUBBLE.line)
  })
  ctx.globalAlpha = 1
}

function thread(
  ctx: CanvasRenderingContext2D,
  s: ScreenState,
  L: ThreadLayout,
  alpha: number,
  cardArt: CanvasImageSource,
) {
  if (alpha <= 0) return
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#9a9aa0'
  ctx.font = `500 25px ${SANS}`
  ctx.fillText('Simulated SMS · Today 9:41 AM', SCREEN_W / 2, L.stampY + 28)
  ctx.textAlign = 'left'
  ctx.globalAlpha = 1

  // Check-in bubble is drawn by the notification morph until the thread is fully open.
  if (s.expand >= 1) bubble(ctx, L.checkIn, false, 1)
  bubble(ctx, L.request, true, s.m1)

  // Typing indicator, replaced in place by the "checking" reply
  const typingA = smooth(s.typing * 1.6) * (1 - smooth(s.m2 * 1.6))
  if (typingA > 0) {
    ctx.globalAlpha = typingA
    ctx.fillStyle = '#26262a'
    ctx.beginPath()
    ctx.roundRect(SIDE, L.typing.y, 128, L.typing.h, [38, 38, 38, 10])
    ctx.fill()
    for (let i = 0; i < 3; i++) {
      const lift = Math.max(0, Math.sin(s.typing * Math.PI * 6 - i * 0.9)) * 7
      ctx.fillStyle = `rgba(160,160,168,${0.55 + lift / 16})`
      ctx.beginPath()
      ctx.arc(SIDE + 36 + i * 26, L.typing.y + L.typing.h / 2 - lift, 9, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  bubble(ctx, L.checking, false, s.m2)

  // Policy result: a centred pill that reads at a glance
  const policyA = smooth(s.policy * 1.3)
  if (policyA > 0) {
    ctx.globalAlpha = policyA
    ctx.font = `600 27px ${SANS}`
    const items = SCREEN_COPY.policyChecks
    const check = 26
    const gap = 30
    const widths = items.map((t) => ctx.measureText(t).width)
    const total = widths.reduce((w, x) => w + check + 10 + x, 0) + gap * (items.length - 1) + 48
    const x0 = SCREEN_W / 2 - total / 2
    const y = L.policy.y + (1 - smooth(s.policy)) * 14
    const h = L.policy.h - 8
    ctx.fillStyle = 'rgba(48, 209, 88, 0.12)'
    ctx.strokeStyle = 'rgba(48, 209, 88, 0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(x0, y, total, h, h / 2)
    ctx.fill()
    ctx.stroke()
    let x = x0 + 24
    const mid = y + h / 2
    items.forEach((t, i) => {
      ctx.strokeStyle = '#30d158'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(x + 3, mid)
      ctx.lineTo(x + 10, mid + 7)
      ctx.lineTo(x + check - 2, mid - 8)
      ctx.stroke()
      x += check + 10
      ctx.fillStyle = '#e5e5ea'
      ctx.fillText(t, x, mid + 10)
      x += widths[i] + gap
    })
    ctx.globalAlpha = 1
  }
  bubble(ctx, L.approved, false, s.m3)

  // Card bubble — the same artwork as the 3D card that later lifts out of it
  const cardA = smooth(s.bubble * 1.3)
  if (cardA > 0) {
    const r = L.card
    const dy = (1 - smooth(s.bubble)) * 30
    ctx.globalAlpha = cardA
    if (s.lifted) {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'
      ctx.setLineDash([12, 10])
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.roundRect(r.x, r.y + dy, r.w, r.h, 26)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#7c7c82'
      ctx.font = `500 27px ${SANS}`
      ctx.textAlign = 'center'
      ctx.fillText('Card issued', r.x + r.w / 2, r.y + dy + r.h / 2 + 9)
      ctx.textAlign = 'left'
    } else {
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(r.x, r.y + dy, r.w, r.h, 26)
      ctx.clip()
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(cardArt, r.x, r.y + dy, r.w, r.h)
      ctx.restore()
    }
    ctx.fillStyle = '#9a9aa0'
    ctx.font = `500 25px ${SANS}`
    ctx.fillText('Single-use · expires 1:41 PM', r.x + 6, r.y + dy + r.h + 36)
    ctx.globalAlpha = 1
  }

  // Header (covers messages that scroll beneath it)
  const headerA = clamp01(s.expand * 1.6 - 0.4)
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#0b0b0d'
  ctx.fillRect(0, 0, SCREEN_W, 320)
  ctx.fillStyle = '#1f1f23'
  ctx.fillRect(0, 319, SCREEN_W, 2)
  ctx.globalAlpha = alpha * headerA
  const av = ctx.createLinearGradient(323, 116, 427, 220)
  av.addColorStop(0, '#7c7cf8')
  av.addColorStop(1, '#4338ca')
  ctx.fillStyle = av
  ctx.beginPath()
  ctx.arc(SCREEN_W / 2, 170, 52, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.font = `600 34px ${SANS}`
  ctx.fillText('FC', SCREEN_W / 2, 182)
  ctx.font = `600 30px ${SANS}`
  ctx.fillText('Fieldcard', SCREEN_W / 2, 266)
  ctx.fillStyle = '#9a9aa0'
  ctx.font = `500 23px ${SANS}`
  ctx.fillText(SCREEN_COPY.company, SCREEN_W / 2, 299)
  ctx.textAlign = 'left'

  // Input bar
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#000'
  ctx.fillRect(0, INPUT_TOP - 22, SCREEN_W, SCREEN_H - INPUT_TOP + 22)
  ctx.globalAlpha = alpha * headerA
  ctx.fillStyle = '#2c2c2e'
  ctx.beginPath()
  ctx.arc(66, INPUT_TOP + 38, 34, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#aeaeb2'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(52, INPUT_TOP + 38)
  ctx.lineTo(80, INPUT_TOP + 38)
  ctx.moveTo(66, INPUT_TOP + 24)
  ctx.lineTo(66, INPUT_TOP + 52)
  ctx.stroke()
  ctx.strokeStyle = '#3a3a3c'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(118, INPUT_TOP, SCREEN_W - 148, 76, 38)
  ctx.stroke()
  ctx.fillStyle = '#6e6e73'
  ctx.font = `400 29px ${SANS}`
  ctx.fillText('Text Message', 150, INPUT_TOP + 48)
  ctx.globalAlpha = 1
}

/** Notification banner that slides in, then morphs into the first thread bubble. */
function notification(ctx: CanvasRenderingContext2D, s: ScreenState, L: ThreadLayout) {
  if (s.notif <= 0 || s.expand >= 1) return
  const t = smooth(s.expand)
  const arrive = smooth(s.notif)
  const from = { ...BANNER, y: BANNER.y - (1 - arrive) * 70 }
  const to = L.checkIn
  const x = lerp(from.x, to.x, t)
  const y = lerp(from.y, to.y, t)
  const w = lerp(from.w, to.w, t)
  const h = lerp(from.h, to.h, t)

  ctx.globalAlpha = arrive
  ctx.fillStyle = `rgba(${Math.round(lerp(62, 38, t))}, ${Math.round(lerp(64, 38, t))}, ${Math.round(lerp(78, 42, t))}, ${lerp(0.82, 1, t)})`
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, lerp(48, 36, t))
  ctx.fill()
  ctx.strokeStyle = `rgba(255,255,255,${0.1 * (1 - t)})`
  ctx.lineWidth = 2
  ctx.stroke()

  const bannerA = arrive * (1 - smooth(t * 2.2))
  if (bannerA > 0) {
    ctx.globalAlpha = bannerA
    const icon = ctx.createLinearGradient(x + 24, y + 26, x + 110, y + 112)
    icon.addColorStop(0, '#7c7cf8')
    icon.addColorStop(1, '#4338ca')
    ctx.fillStyle = icon
    ctx.beginPath()
    ctx.roundRect(x + 24, y + 28, 86, 86, 22)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = `700 30px ${SANS}`
    ctx.fillText('FC', x + 67, y + 82)
    ctx.textAlign = 'left'
    ctx.font = `600 29px ${SANS}`
    ctx.fillText('Fieldcard', x + 132, y + 62)
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = `500 24px ${SANS}`
    ctx.fillText('now', x + w - 30, y + 62)
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.font = `400 27px ${SANS}`
    wrap(ctx, SCREEN_COPY.checkIn, w - 132 - 30)
      .slice(0, 3)
      .forEach((line, i) => ctx.fillText(line, x + 132, y + 104 + i * 35))
  }

  const textA = smooth(t * 2 - 1)
  if (textA > 0) {
    ctx.globalAlpha = textA
    ctx.fillStyle = '#f2f2f7'
    ctx.font = `400 ${BUBBLE.size}px ${SANS}`
    to.lines.forEach((line, i) => {
      ctx.fillText(line, x + BUBBLE.padX, y + BUBBLE.padY + 33 + i * BUBBLE.line)
    })
  }
  ctx.globalAlpha = 1
}

/** Renders the full screen and returns the card bubble's rect for the 3D hand-off. */
export function drawScreen(
  ctx: CanvasRenderingContext2D,
  s: ScreenState,
  cardArt: CanvasImageSource,
): Rect {
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
  const L = layoutThread(ctx, s)
  const open = smooth(s.expand)
  lockScreen(ctx, 1 - open)
  thread(ctx, s, L, open, cardArt)
  notification(ctx, s, L)
  statusBar(ctx)

  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.beginPath()
  ctx.roundRect(SCREEN_W / 2 - 134, SCREEN_H - 34, 268, 10, 5)
  ctx.fill()

  // Simulation watermark, always visible on the device
  ctx.fillStyle = 'rgba(255,255,255,0.42)'
  ctx.font = `600 19px ${MONO}`
  ctx.textAlign = 'center'
  ctx.fillText('SANDBOX DEMO · SIMULATED SMS', SCREEN_W / 2, SCREEN_H - 56)
  ctx.textAlign = 'left'
  return L.card
}
