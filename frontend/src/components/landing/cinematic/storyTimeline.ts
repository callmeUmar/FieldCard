/**
 * One continuous story, 0 → STORY_DURATION, scrubbed by scroll.
 *
 * The scene timeline animates a plain state object (camera rig, phone, screen,
 * card); React Three Fiber reads it every rendered frame. The overlay timeline
 * animates the DOM copy on the same clock.
 */

export const STORY_DURATION = 10.8

/** Beat start times — shared by the scene, the overlay and the tests. */
export const T = {
  heroOut: 0.1,
  wake: 0.55,
  notif: 1.0,
  expand: 1.45,
  m1: 2.0,
  typing: 2.35,
  m2: 2.62,
  policy: 2.95,
  m3: 3.25,
  bubble: 3.62,
  orbit: 3.95,
  emerge: 4.25,
  recede: 5.05,
  flip: 6.0,
  specs: 6.6,
  flipBack: 7.95,
  approve: 8.3,
  sweep: 8.35,
  approveOut: 9.1,
  /** Focus racks from the card to the owner's dashboard… */
  payoff: 9.2,
  /** …where the purchase posts to the job. */
  post: 9.8,
} as const

export type StoryState = {
  /** Camera rig: orbit around a target, plus a lens shift (fraction of the viewport). */
  tx: number
  ty: number
  tz: number
  dist: number
  yaw: number
  pitch: number
  shiftX: number
  shiftY: number
  /** Phone pose and brightness (0 = lost in darkness). */
  px: number
  py: number
  pz: number
  prx: number
  pry: number
  prz: number
  dim: number
  /** Screen beats. */
  wake: number
  notif: number
  expand: number
  m1: number
  typing: number
  m2: number
  policy: number
  m3: number
  bubble: number
  /** Card: 0 = lying in the SMS thread, 1 = at its hero pose. */
  emerge: number
  cx: number
  cy: number
  cz: number
  crx: number
  cry: number
  crz: number
  specs: number
  /** Card brightness: 1 = hero, lower = handed focus to the dashboard (behind glass). */
  cdim: number
  /** 0 → 1: the camera frames the card against the dashboard panel's on-screen position. */
  dock: number
  /** Lighting: intro fade from darkness (time-based), approval light sweep and emerald glow. */
  intro: number
  sweep: number
  glow: number
}

type Framing = { dist: number; shiftX: number; shiftY: number }

export type StoryLayout = {
  hero: Framing
  phone: Framing
  read: { dist: number }
  orbit: { dist: number; yaw: number }
  card: Framing & { pos: [number, number, number] }
  flip: { dist: number }
  approve: { dist: number; shiftY: number }
  /** The card against the dashboard panel (its screen position is tracked at runtime). */
  payoff: { dist: number }
}

/** Landscape viewports: copy on the left, subject right of centre. */
export const WIDE_LAYOUT: StoryLayout = {
  hero: { dist: 7.4, shiftX: 0.2, shiftY: 0 },
  phone: { dist: 4.9, shiftX: 0.14, shiftY: 0 },
  read: { dist: 4.6 },
  orbit: { dist: 5.3, yaw: 0.62 },
  card: { dist: 4.6, shiftX: 0.15, shiftY: 0, pos: [0.45, 0.12, 1.5] },
  flip: { dist: 4.25 },
  approve: { dist: 6.5, shiftY: -0.26 },
  // the card straddles the panel's top edge: sharp above, frosted behind the glass
  payoff: { dist: 7.4 },
}

/** Portrait viewports: copy on top, subject lower and further away. */
export const TALL_LAYOUT: StoryLayout = {
  hero: { dist: 9.6, shiftX: 0, shiftY: -0.43 },
  phone: { dist: 7.1, shiftX: 0, shiftY: -0.12 },
  read: { dist: 6.6 },
  orbit: { dist: 7.8, yaw: 0.4 },
  card: { dist: 8.2, shiftX: 0, shiftY: -0.08, pos: [0.15, 0.1, 1.5] },
  flip: { dist: 7.8 },
  approve: { dist: 9.6, shiftY: -0.2 },
  // portrait: the card settles behind the panel, seen through the frosted glass
  payoff: { dist: 10.2 },
}

/** Card yaw in its hero pose: a three-quarter turn relative to the camera. */
const CARD_YAW = -0.1

export function createStoryState(L: StoryLayout): StoryState {
  return {
    tx: 0,
    ty: 0,
    tz: 0,
    dist: L.hero.dist,
    yaw: 0,
    pitch: 0.035,
    shiftX: L.hero.shiftX,
    shiftY: L.hero.shiftY,
    px: 0,
    py: 0,
    pz: 0,
    prx: -0.05,
    pry: -0.52,
    prz: 0.035,
    dim: 1,
    wake: 0,
    notif: 0,
    expand: 0,
    m1: 0,
    typing: 0,
    m2: 0,
    policy: 0,
    m3: 0,
    bubble: 0,
    emerge: 0,
    cx: L.card.pos[0],
    cy: L.card.pos[1],
    cz: L.card.pos[2],
    crx: 0.06,
    cry: CARD_YAW,
    crz: -0.03,
    specs: 0,
    cdim: 1,
    dock: 0,
    intro: 0,
    sweep: 0,
    glow: 0,
  }
}

export function buildSceneTimeline(tl: gsap.core.Timeline, s: StoryState, L: StoryLayout) {
  const io = 'power2.inOut'

  // A → B: dolly toward the screen as it wakes; the notification lands.
  tl.to(
    s,
    {
      dist: L.phone.dist,
      shiftX: L.phone.shiftX,
      shiftY: L.phone.shiftY,
      ty: 0.32,
      pitch: 0.02,
      prx: 0,
      pry: -0.2,
      prz: 0,
      duration: 1.35,
      ease: io,
    },
    0,
  )
  tl.to(s, { wake: 1, duration: 0.45, ease: 'power1.out' }, T.wake)
  tl.to(s, { notif: 1, duration: 0.4, ease: 'power3.out' }, T.notif)

  // C: the notification opens into the thread; the conversation plays out.
  tl.to(s, { expand: 1, duration: 0.5, ease: io }, T.expand)
  tl.to(s, { dist: L.read.dist, ty: 0, pry: -0.13, duration: 1.2, ease: 'sine.inOut' }, 1.5)
  tl.to(s, { m1: 1, duration: 0.3, ease: 'power2.out' }, T.m1)
  tl.to(s, { typing: 1, duration: 0.27, ease: 'none' }, T.typing)
  tl.to(s, { m2: 1, duration: 0.3, ease: 'power2.out' }, T.m2)
  tl.to(s, { policy: 1, duration: 0.28, ease: 'power2.out' }, T.policy)
  tl.to(s, { m3: 1, duration: 0.33, ease: 'power2.out' }, T.m3)
  tl.to(s, { bubble: 1, duration: 0.3, ease: 'power2.out' }, T.bubble)
  tl.to(s, { dist: L.read.dist - 0.25, duration: 1.2, ease: 'sine.inOut' }, 2.7)

  // D: the camera swings round; the card lifts out of the screen.
  tl.to(
    s,
    { yaw: L.orbit.yaw, pitch: 0.1, dist: L.orbit.dist, tx: 0.2, ty: 0, tz: 0.55, pry: -0.04, duration: 1.3, ease: io },
    T.orbit,
  )
  tl.to(s, { emerge: 1, duration: 1.05, ease: io }, T.emerge)

  // E: the phone recedes into darkness; the card becomes the hero object.
  tl.to(
    s,
    { px: -1.6, py: -0.3, pz: -3.6, prx: 0.05, pry: -0.75, dim: 0.08, duration: 1.25, ease: io },
    T.recede,
  )
  tl.to(
    s,
    {
      tx: L.card.pos[0],
      ty: L.card.pos[1],
      tz: L.card.pos[2],
      yaw: 0.28,
      pitch: 0.05,
      dist: L.card.dist,
      shiftX: L.card.shiftX,
      shiftY: L.card.shiftY,
      duration: 1.25,
      ease: io,
    },
    T.recede,
  )

  // F: the card turns over; its constraints print onto the back.
  tl.to(s, { cry: CARD_YAW + Math.PI, crx: -0.05, duration: 1.0, ease: io }, T.flip)
  tl.to(s, { dist: L.flip.dist, duration: 1.6, ease: 'sine.inOut' }, T.flip)
  tl.to(s, { specs: 1, duration: 1.1, ease: 'none' }, T.specs)
  // ...while the phone slides out of frame entirely.
  tl.to(s, { px: -12, py: -1, pz: -8, dim: 0, duration: 1.3, ease: 'power2.in' }, T.flip)

  // G: front again, tilted toward the camera; a light sweep marks the approval.
  tl.to(s, { cry: CARD_YAW + Math.PI * 2, crx: 0.24, crz: 0, duration: 0.95, ease: io }, T.flipBack)
  tl.to(
    s,
    { pitch: 0.2, dist: L.approve.dist, shiftX: 0, shiftY: L.approve.shiftY, duration: 1.05, ease: io },
    T.flipBack,
  )
  // The confirmation: an emerald rim light catches the metal edge as the camera
  // settles in, and a highlight sweeps across the face.
  tl.to(s, { glow: 1, duration: 0.55, ease: 'power2.out' }, T.approve)
  tl.to(s, { dist: L.approve.dist - 0.35, duration: 0.8, ease: 'expo.out' }, T.approve + 0.05)
  tl.to(s, { sweep: 1, duration: 0.85, ease: 'power1.inOut' }, T.sweep)

  // H: focus racks to the dashboard — the card turns away and settles back behind
  // the glass panel, still lit, as the purchase posts to the job.
  tl.to(
    s,
    { dist: L.payoff.dist, pitch: 0.12, dock: 1, duration: 1.1, ease: io },
    T.payoff,
  )
  tl.to(
    s,
    { cz: L.card.pos[2] - 0.5, cry: CARD_YAW + Math.PI * 2 + 0.34, crx: 0.12, cdim: 0.85, glow: 0.4, duration: 1.0, ease: io },
    T.payoff,
  )
  tl.to(s, { cy: L.card.pos[1] + 0.05, duration: 0.9, ease: 'sine.inOut' }, T.post)

  // Pin the total length so scroll distance maps 1:1 onto STORY_DURATION.
  tl.to({}, { duration: 0.01 }, STORY_DURATION - 0.01)
}

/** DOM copy on the same clock. */
export function buildOverlayTimeline(tl: gsap.core.Timeline, root: HTMLElement) {
  const beat = (key: string) => root.querySelector<HTMLElement>(`[data-beat="${key}"]`)
  const parts = (el: HTMLElement | null) =>
    el ? Array.from(el.querySelectorAll<HTMLElement>('[data-part]')) : []

  const enter = (key: string, at: number) => {
    const el = beat(key)
    if (!el) return
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.out', immediateRender: false }, at)
    tl.set(parts(el), { y: 36 }, at)
    tl.to(parts(el), { y: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out' }, at)
  }
  const exit = (key: string, at: number) => {
    const el = beat(key)
    if (!el) return
    tl.to(el, { autoAlpha: 0, duration: 0.28, ease: 'power1.in' }, at)
    tl.to(parts(el), { y: -28, duration: 0.3, stagger: 0.03, ease: 'power2.in' }, at)
  }

  const hero = beat('hero')
  if (hero) tl.to(hero, { autoAlpha: 0, y: -56, duration: 0.55, ease: 'power2.in' }, T.heroOut)
  const cue = beat('cue')
  if (cue) tl.to(cue, { autoAlpha: 0, duration: 0.25 }, 0)

  enter('request', 0.85)
  exit('request', 1.95)
  enter('policy', 2.3)
  exit('policy', 3.72)
  enter('card', 4.45)
  exit('card', 5.9)
  enter('limits', 6.25)
  exit('limits', 7.85)

  const approve = beat('approve')
  if (approve) {
    tl.fromTo(approve, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, immediateRender: false }, T.approve)
    tl.fromTo(
      approve.querySelector('[data-word]'),
      { yPercent: 108, letterSpacing: '0.08em' },
      { yPercent: 0, letterSpacing: '-0.045em', duration: 0.6, ease: 'power3.out', immediateRender: false },
      T.approve,
    )
    tl.fromTo(
      approve.querySelector('[data-line]'),
      { scaleX: 0 },
      { scaleX: 1, duration: 0.55, ease: 'power2.inOut', immediateRender: false },
      T.approve + 0.25,
    )
    tl.fromTo(
      parts(approve),
      { y: 24, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.08, ease: 'power2.out', immediateRender: false },
      T.approve + 0.15,
    )
    // The amount is the exact transaction value from its first frame — it only
    // fades and settles into place, so a paused scroll can never show a figure
    // other than the approved amount.
    tl.fromTo(
      approve.querySelector('[data-amount]'),
      { autoAlpha: 0, scale: 0.94 },
      { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'power2.out', immediateRender: false },
      T.approve + 0.12,
    )
    // A precise checkmark: the ring draws, then the tick.
    tl.fromTo(
      approve.querySelector('[data-check-ring]'),
      { strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut', immediateRender: false },
      T.approve,
    )
    tl.fromTo(
      approve.querySelector('[data-check-mark]'),
      { strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 0.32, ease: 'power3.out', immediateRender: false },
      T.approve + 0.32,
    )
    tl.to(approve, { autoAlpha: 0, y: -30, duration: 0.3, ease: 'power1.in' }, T.approveOut)
  }

  // Environmental light: an emerald pool under the card when policy passes.
  const glow = root.parentElement?.querySelector('[data-glow]')
  if (glow) {
    tl.fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out', immediateRender: false }, T.approve)
    tl.to(glow, { opacity: 0.3, duration: 0.8, ease: 'power1.inOut' }, T.payoff)
  }

  // Payoff: the dashboard panel arrives, then the purchase posts to the job.
  enter('payoff', T.payoff + 0.05)
  const payoff = beat('payoff')
  const panel = payoff?.querySelector('[data-panel]')
  if (payoff && panel) {
    tl.fromTo(
      panel,
      { y: 48, scale: 0.97, autoAlpha: 0 },
      { y: 0, scale: 1, autoAlpha: 1, duration: 0.6, ease: 'power3.out', immediateRender: false },
      T.payoff + 0.12,
    )
    // Exact figures only — the old values slide out as the new ones slide in,
    // so no intermediate amount is ever shown.
    const from = Array.from(panel.querySelectorAll('[data-from]'))
    const to = Array.from(panel.querySelectorAll('[data-to]'))
    tl.fromTo(from, { yPercent: 0, autoAlpha: 1 }, { yPercent: -60, autoAlpha: 0, duration: 0.3, ease: 'power2.in', immediateRender: false }, T.post)
    tl.fromTo(to, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.4, ease: 'power3.out', immediateRender: false }, T.post + 0.16)
    tl.fromTo(
      panel.querySelector('[data-delta]'),
      { scaleX: 0 },
      { scaleX: 1, duration: 0.5, ease: 'power2.inOut', immediateRender: false },
      T.post + 0.05,
    )
    tl.fromTo(
      panel.querySelector('[data-activity]'),
      { y: 14, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out', immediateRender: false },
      T.post + 0.22,
    )
  }

  const progress = root.querySelector('[data-progress]')
  if (progress) {
    tl.fromTo(progress, { scaleX: 0 }, { scaleX: 1, duration: STORY_DURATION, ease: 'none' }, 0)
  }
}
