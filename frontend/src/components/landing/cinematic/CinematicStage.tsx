/*
 * React Three Fiber is imperative by design: per-frame updates mutate three.js
 * objects inside useFrame instead of re-rendering React. The compiler-oriented
 * immutability rule flags exactly that pattern, so it is disabled for this file.
 */
/* oxlint-disable react/immutability */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { CARD_TEX_H, CARD_TEX_W, drawCardBack, drawCardFront } from './cardRenderer'
import { createResolutionGovernor, type ResolutionGovernor } from './resolutionGovernor'
import { drawScreen, SCREEN_H, SCREEN_W, type Rect, type ScreenState } from './screenRenderer'
import {
  buildOverlayTimeline,
  buildSceneTimeline,
  createStoryState,
  TALL_LAYOUT,
  WIDE_LAYOUT,
  type StoryState,
} from './storyTimeline'

gsap.registerPlugin(ScrollTrigger)

/*
 * Geometry is authored in code at real proportions (1 unit = device width,
 * 71.6 × 147.6 × 7.8 mm). Nothing here is a licensed or branded asset.
 */
const PW = 1
const PH = 2.06
const PD = 0.11
const PR = 0.165 // plan-view corner radius
const PB = 0.03 // edge roundover
const SW = PW - 2 * PB - 0.044 // display, inset inside the front glass
const SH = (SW * SCREEN_H) / SCREEN_W
const SR = PR - PB - 0.026
const SCREEN_Z = PD / 2 + 0.0008

const CW = 1.5 // virtual card (ISO 7810 aspect)
const CH = CW / 1.586
const CT = 0.02
const CR = 0.07
const CB = 0.0075

const FRAME_COLOR = new THREE.Color('#a6a9b0')
const EDGE_COLOR = new THREE.Color('#8a8d95')
const BACK_COLOR = new THREE.Color('#25272c')

const tall = () => window.matchMedia('(max-aspect-ratio: 1/1)').matches
const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}
const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + h - r)
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + h)
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

/** Rounded slab with smooth (welded) normals so metal highlights don't facet. */
function slab(w: number, h: number, d: number, r: number, bevel: number, segments: number) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - 2 * bevel, h - 2 * bevel, r - bevel), {
    depth: d - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: segments,
    curveSegments: 56,
  })
  g.translate(0, 0, -(d - 2 * bevel) / 2)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  const welded = mergeVertices(g, 1e-5)
  welded.computeVertexNormals()
  g.dispose()
  return welded
}

/** Flat rounded face with 0–1 UVs across its bounds (for canvas artwork). */
function face(w: number, h: number, r: number) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), 40)
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5)
  uv.needsUpdate = true
  return g
}

/**
 * A 2D canvas whose backing store is `scale`× its logical size. The context is
 * pre-scaled, so drawing code works in logical units while the texture carries
 * the extra resolution.
 */
function canvas2d(w: number, h: number, scale = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0)
  return { canvas, ctx }
}

/**
 * Supersampling for a text texture: ~1.6 texels per device pixel at the closest
 * camera framing (`maxCssPx` = the artwork's largest on-screen size), so
 * filtering through perspective and rotation never softens glyph edges.
 * Capped at 2× to bound GPU memory; 1× wherever the artwork stays small.
 */
function textureScale(logicalPx: number, maxCssPx: number, dpr: number) {
  const k = (1.6 * maxCssPx * dpr) / logicalPx
  return Math.min(2, Math.max(1, Math.ceil(k * 4) / 4))
}

type Art = ReturnType<typeof useArt>

function useArt() {
  const gl = useThree((st) => st.gl)
  const art = useMemo(() => {
    // Largest on-screen sizes come from the timeline framings: the display fills
    // ~84% of the viewport height in the wide SMS close-up (~56% in portrait), the
    // card ~42% of the viewport width (~80% in portrait).
    const dpr = gl.getPixelRatio()
    const isTall = tall()
    const screenScale = textureScale(SCREEN_H, (isTall ? 0.56 : 0.84) * window.innerHeight, dpr)
    const cardScale = textureScale(CARD_TEX_W, (isTall ? 0.8 : 0.42) * window.innerWidth, dpr)
    const front = canvas2d(CARD_TEX_W, CARD_TEX_H, cardScale)
    const back = canvas2d(CARD_TEX_W, CARD_TEX_H, cardScale)
    const screen = canvas2d(SCREEN_W, SCREEN_H, screenScale)
    const shadow = canvas2d(128, 128)
    drawCardFront(front.ctx)
    drawCardBack(back.ctx, 0)
    const g = shadow.ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
    g.addColorStop(0, 'rgba(0,0,0,0.9)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    shadow.ctx.fillStyle = g
    shadow.ctx.fillRect(0, 0, 128, 128)
    // Trilinear mipmaps + anisotropic filtering: text stays clean when the
    // supersampled texture is minified or seen at an angle.
    const texture = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.minFilter = THREE.LinearMipmapLinearFilter
      t.magFilter = THREE.LinearFilter
      t.generateMipmaps = true
      t.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy())
      return t
    }
    return {
      front,
      back,
      screen,
      frontTex: texture(front.canvas),
      backTex: texture(back.canvas),
      screenTex: texture(screen.canvas),
      shadowTex: texture(shadow.canvas),
      /** Where the card bubble sits in the thread (screen px), for the 3D hand-off. */
      cardRect: { current: null as Rect | null },
      /** Bumped to force a screen redraw (e.g. after web fonts load). */
      version: { current: 0 },
    }
  }, [gl])

  useEffect(() => {
    let alive = true
    document.fonts?.ready.then(() => {
      if (!alive) return
      drawCardFront(art.front.ctx)
      art.frontTex.needsUpdate = true
      art.version.current += 1
    })
    return () => {
      alive = false
      art.frontTex.dispose()
      art.backTex.dispose()
      art.screenTex.dispose()
      art.shadowTex.dispose()
    }
  }, [art])
  return art
}

function Phone({ s, art, groupRef }: { s: StoryState; art: Art; groupRef: RefObject<THREE.Group | null> }) {
  const geo = useMemo(
    () => ({
      body: slab(PW, PH, PD, PR, PB, 10),
      screen: face(SW, SH, SR),
      back: face(PW - 2 * PB, PH - 2 * PB, PR - PB),
      bump: slab(0.4, 0.4, 0.03, 0.105, 0.009, 4),
      lens: new THREE.CylinderGeometry(0.066, 0.07, 0.03, 48),
      glass: new THREE.CircleGeometry(0.052, 48),
      shadow: new THREE.PlaneGeometry(1, 1),
      power: slab(0.018, 0.3, 0.046, 0.0085, 0.006, 3),
      action: slab(0.018, 0.12, 0.046, 0.0085, 0.006, 3),
      volume: slab(0.018, 0.2, 0.046, 0.0085, 0.006, 3),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      frame: new THREE.MeshPhysicalMaterial({
        color: FRAME_COLOR,
        metalness: 1,
        roughness: 0.22,
        clearcoat: 0.3,
        clearcoatRoughness: 0.25,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#040406',
        roughness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
      }),
      back: new THREE.MeshPhysicalMaterial({
        color: BACK_COLOR,
        roughness: 0.5,
        metalness: 0.15,
        clearcoat: 0.5,
        clearcoatRoughness: 0.45,
      }),
      lensGlass: new THREE.MeshPhysicalMaterial({
        color: '#05070d',
        roughness: 0.02,
        clearcoat: 1,
        iridescence: 0.6,
        iridescenceIOR: 1.6,
      }),
      screen: new THREE.MeshPhysicalMaterial({
        color: '#000000',
        roughness: 0.05,
        emissive: '#ffffff',
        emissiveMap: art.screenTex,
        emissiveIntensity: 0,
      }),
      shadow: new THREE.MeshBasicMaterial({
        map: art.shadowTex,
        color: '#000000',
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    }),
    [art],
  )
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geo, mats],
  )

  const shadowRef = useRef<THREE.Mesh>(null)
  const drawn = useRef('')

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    // Entrance from darkness: rises and turns into its three-quarter pose.
    const k = 1 - easeOutCubic(s.intro)
    g.visible = s.dim > 0.001
    g.position.set(s.px, s.py - k * 0.55, s.pz - k * 1.6)
    g.rotation.set(s.prx + k * 0.1, s.pry - k * 0.45, s.prz)

    // Receding into darkness: kill reflections and direct light together.
    const d = s.dim
    mats.frame.color.copy(FRAME_COLOR).multiplyScalar(d)
    mats.back.color.copy(BACK_COLOR).multiplyScalar(d)
    for (const m of [mats.frame, mats.glass, mats.back, mats.lensGlass]) {
      m.envMapIntensity = d
      m.specularIntensity = d
    }
    // Keep the glass sheen on the display subtle so it never washes out text.
    mats.screen.envMapIntensity = d * 0.5
    mats.screen.specularIntensity = d * 0.6
    mats.frame.clearcoat = Math.max(0.01, d * 0.3)
    mats.back.clearcoat = Math.max(0.01, d * 0.5)
    mats.glass.clearcoat = Math.max(0.01, d)
    // Always-on display glows faintly in the hero; the notification wakes it fully.
    const aod = 0.22 * easeOutCubic(s.intro)
    mats.screen.emissiveIntensity = Math.max(aod, s.wake) * d

    // Nothing to redraw while the phone is out of shot.
    if (!g.visible) return

    const screen: ScreenState = {
      notif: s.notif,
      expand: s.expand,
      m1: s.m1,
      typing: s.typing,
      m2: s.m2,
      policy: s.policy,
      m3: s.m3,
      bubble: s.bubble,
      lifted: s.emerge > 0.002,
    }
    // 1% steps are visually continuous and cap how often the texture re-uploads.
    const key = `${art.version.current}|${Object.values(screen)
      .map((v) => (typeof v === 'number' ? v.toFixed(2) : String(v)))
      .join('|')}`
    if (key !== drawn.current) {
      drawn.current = key
      art.cardRect.current = drawScreen(art.screen.ctx, screen, art.front.canvas)
      art.screenTex.needsUpdate = true
    }

    // Soft shadow the lifting card casts onto the display.
    const rect = art.cardRect.current
    const shadow = shadowRef.current
    if (shadow && rect) {
      const e = s.emerge
      const lift = smooth(e / 0.4)
      mats.shadow.opacity = e > 0.002 ? 0.7 * (1 - lift) * Math.min(1, e * 30) : 0
      const w = (rect.w / SCREEN_W) * SW
      const h = (rect.h / SCREEN_H) * SH
      shadow.position.set(
        ((rect.x + rect.w / 2) / SCREEN_W - 0.5) * SW + 0.04 * lift,
        (0.5 - (rect.y + rect.h / 2) / SCREEN_H) * SH - 0.07 * lift,
        SCREEN_Z + 0.0006,
      )
      shadow.scale.set(w * (1.15 + lift * 0.9), h * (1.25 + lift * 1.1), 1)
    }
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={geo.body} material={[mats.glass, mats.frame]} />
      <mesh geometry={geo.screen} material={mats.screen} position-z={SCREEN_Z} />
      <mesh ref={shadowRef} geometry={geo.shadow} material={mats.shadow} renderOrder={2} />
      <mesh geometry={geo.back} material={mats.back} position-z={-PD / 2 - 0.0006} rotation-y={Math.PI} />

      {/* Side buttons */}
      <mesh geometry={geo.power} material={mats.frame} position={[PW / 2 + 0.004, 0.36, 0]} />
      <mesh geometry={geo.action} material={mats.frame} position={[-PW / 2 - 0.004, 0.68, 0]} />
      <mesh geometry={geo.volume} material={mats.frame} position={[-PW / 2 - 0.004, 0.44, 0]} />
      <mesh geometry={geo.volume} material={mats.frame} position={[-PW / 2 - 0.004, 0.18, 0]} />

      {/* Camera module on the back */}
      <group position={[0.24, 0.74, -PD / 2 - 0.015]}>
        <mesh geometry={geo.bump} material={mats.back} />
        {[
          [-0.085, 0.085],
          [-0.085, -0.085],
          [0.085, 0],
        ].map(([x, y]) => (
          <group key={`${x}${y}`} position={[x, y, -0.02]}>
            <mesh geometry={geo.lens} material={mats.frame} rotation-x={Math.PI / 2} />
            <mesh geometry={geo.glass} material={mats.lensGlass} position-z={-0.0155} rotation-y={Math.PI} />
          </group>
        ))}
      </group>
    </group>
  )
}

function VirtualCard({ s, art, phoneRef }: { s: StoryState; art: Art; phoneRef: RefObject<THREE.Group | null> }) {
  const geo = useMemo(
    () => ({
      body: slab(CW, CH, CT, CR, CB, 4),
      face: face(CW - 2 * CB, CH - 2 * CB, CR - CB),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      edge: new THREE.MeshPhysicalMaterial({ color: EDGE_COLOR, metalness: 1, roughness: 0.24 }),
      core: new THREE.MeshStandardMaterial({ color: '#0d0e12', roughness: 0.6 }),
      front: new THREE.MeshPhysicalMaterial({
        map: art.frontTex,
        emissive: '#ffffff',
        emissiveMap: art.frontTex,
        emissiveIntensity: 0.18,
        metalness: 0.55,
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      }),
      back: new THREE.MeshPhysicalMaterial({
        map: art.backTex,
        emissive: '#ffffff',
        emissiveMap: art.backTex,
        emissiveIntensity: 0.24,
        metalness: 0.4,
        roughness: 0.38,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
      }),
    }),
    [art],
  )
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [geo, mats],
  )

  const ref = useRef<THREE.Group>(null)
  const specsDrawn = useRef(-1)
  // The card stays hidden until the hand-off. Its first draw compiles shaders,
  // uploads textures and fetches uniforms — a visible hitch at the hero moment —
  // so draw it once, microscopically, during the dark intro instead.
  const warmUp = useRef(true)
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      local: new THREE.Vector3(),
      identity: new THREE.Quaternion(),
      p0: new THREE.Vector3(),
      q0: new THREE.Quaternion(),
      s0: new THREE.Vector3(),
      p1: new THREE.Vector3(),
      q1: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      normal: new THREE.Vector3(),
      lifted: new THREE.Vector3(),
      peel: new THREE.Quaternion(),
      xAxis: new THREE.Vector3(1, 0, 0),
    }),
    [],
  )

  useFrame(({ invalidate }) => {
    const card = ref.current
    const phone = phoneRef.current
    if (!card || !phone) return

    if (warmUp.current) {
      warmUp.current = false
      card.visible = true
      // The rig's target is on the optical axis in every layout, so it is never
      // frustum-culled (the phone itself can sit below the frame on portrait).
      card.position.set(s.tx, s.ty, s.tz)
      card.scale.setScalar(1e-4)
      invalidate() // next frame hides it again
      return
    }

    // 12 steps per printed row: smooth to the eye, few re-uploads.
    const specs = Math.round(s.specs * 60) / 60
    if (specs !== specsDrawn.current) {
      specsDrawn.current = specs
      drawCardBack(art.back.ctx, specs)
      art.backTex.needsUpdate = true
    }

    const rect = art.cardRect.current
    const e = s.emerge
    card.visible = e > 0.002 && rect !== null
    if (!card.visible || !rect) return

    // Start pose: exactly over the card bubble in the SMS thread, in world space.
    phone.updateWorldMatrix(true, false)
    const scale0 = ((rect.w / SCREEN_W) * SW) / (CW - 2 * CB)
    tmp.local.set(
      ((rect.x + rect.w / 2) / SCREEN_W - 0.5) * SW,
      (0.5 - (rect.y + rect.h / 2) / SCREEN_H) * SH,
      SCREEN_Z + 0.002 + (CT / 2) * scale0,
    )
    tmp.m.compose(tmp.local, tmp.identity, tmp.s0.setScalar(scale0)).premultiply(phone.matrixWorld)
    tmp.m.decompose(tmp.p0, tmp.q0, tmp.s0)

    // End pose: the hero pose the timeline is steering.
    tmp.p1.set(s.cx, s.cy, s.cz)
    tmp.q1.setFromEuler(tmp.euler.set(s.crx, s.cry, s.crz))

    // A physical hand-off, on separate curves: it first rises straight off the
    // glass with its top edge leading (a peel), then carries over to the hero
    // pose; rotation trails the motion slightly and the card grows as it nears
    // the camera.
    const lift = smooth(e / 0.3)
    const travel = smooth((e - 0.1) / 0.9)
    const turn = smooth((e - 0.18) / 0.82)
    const grow = smooth((e - 0.04) / 0.76)
    tmp.normal.set(0, 0, 1).applyQuaternion(tmp.q0)
    tmp.lifted.copy(tmp.p0).addScaledVector(tmp.normal, 0.3 * lift)
    card.position.lerpVectors(tmp.lifted, tmp.p1, travel)
    card.position.addScaledVector(tmp.normal, Math.sin(Math.PI * travel) * 0.22)
    card.quaternion.slerpQuaternions(tmp.q0, tmp.q1, turn)
    const peel = Math.sin(Math.PI * Math.min(1, e / 0.5)) * 0.3 * (1 - 0.6 * travel)
    card.quaternion.multiply(tmp.peel.setFromAxisAngle(tmp.xAxis, peel))
    card.scale.setScalar(THREE.MathUtils.lerp(tmp.s0.x, 1, grow))

    // Lit like the display while it's still "on screen", then becomes a physical
    // object; after the approval it dims slightly as focus moves to the dashboard.
    const k = s.cdim
    mats.front.emissiveIntensity = THREE.MathUtils.lerp(0.18, s.wake * s.dim, 1 - smooth(e / 0.5)) * k
    mats.back.emissiveIntensity = 0.24 * k
    mats.front.color.setScalar(k)
    mats.back.color.setScalar(k)
    mats.edge.color.copy(EDGE_COLOR).multiplyScalar(k)
    for (const m of [mats.front, mats.back, mats.edge]) m.envMapIntensity = k
  })

  return (
    <group ref={ref} visible={false}>
      <mesh geometry={geo.body} material={[mats.core, mats.edge]} />
      <mesh geometry={geo.face} material={mats.front} position-z={CT / 2 + 0.0005} />
      <mesh geometry={geo.face} material={mats.back} position-z={-CT / 2 - 0.0005} rotation-y={Math.PI} />
    </group>
  )
}

function Scene({ s }: { s: StoryState }) {
  const art = useArt()
  const phoneRef = useRef<THREE.Group>(null)
  return (
    <>
      <Phone s={s} art={art} groupRef={phoneRef} />
      <VirtualCard s={s} art={art} phoneRef={phoneRef} />
    </>
  )
}

/** Studio light panels (position, size, intensity, colour), baked once into an environment map. */
const PANELS: { pos: [number, number, number]; size: [number, number]; intensity: number; color?: string; ring?: boolean }[] = [
  // broad key softbox, front-left: the sheen on glass and clearcoat
  { pos: [-3.5, 1.8, 5], size: [4.5, 5.5], intensity: 1.1 },
  // wide softbox at the hero angle, so the three-quarter glass carries a sheen
  { pos: [-5.6, 1.2, 3.1], size: [3.2, 6.5], intensity: 0.9 },
  { pos: [0, 5, 2.5], size: [7, 3], intensity: 1.4 },
  // tall strip lights: the long highlights down the titanium edges
  { pos: [-5, 0.6, 2], size: [0.45, 9], intensity: 3.2 },
  { pos: [5, 0.4, 1.2], size: [0.45, 9], intensity: 2.4 },
  // cool rim behind the subject
  { pos: [0, 1.6, -6], size: [9, 0.9], intensity: 4.5, color: '#dfe5ff' },
  { pos: [3, 3, 5], size: [1.4, 1.4], intensity: 1.1, ring: true },
  // faint indigo bounce from below
  { pos: [0, -5, 1], size: [10, 4], intensity: 0.45, color: '#5b5ff0' },
]

function Studio() {
  const gl = useThree((st) => st.gl)
  const scene = useThree((st) => st.scene)
  const invalidate = useThree((st) => st.invalidate)
  useLayoutEffect(() => {
    const studio = new THREE.Scene()
    const plane = new THREE.PlaneGeometry(1, 1)
    const ring = new THREE.RingGeometry(0.5, 1, 64)
    const materials: THREE.Material[] = []
    for (const p of PANELS) {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(p.color ?? '#ffffff').multiplyScalar(p.intensity),
        side: THREE.DoubleSide,
        toneMapped: false,
      })
      materials.push(material)
      const panel = new THREE.Mesh(p.ring ? ring : plane, material)
      panel.position.set(...p.pos)
      panel.scale.set(p.size[0], p.size[1], 1)
      panel.lookAt(0, 0, 0)
      studio.add(panel)
    }
    const pmrem = new THREE.PMREMGenerator(gl)
    const target = pmrem.fromScene(studio, 0.02)
    scene.environment = target.texture
    pmrem.dispose()
    plane.dispose()
    ring.dispose()
    materials.forEach((m) => m.dispose())
    invalidate()
    return () => {
      scene.environment = null
      target.dispose()
    }
  }, [gl, scene, invalidate])
  return null
}

/**
 * Drives the canvas pixel ratio from the resolution governor: full native
 * density whenever the scene is at rest, a step down only under sustained load
 * while it moves (see resolutionGovernor.ts).
 */
function AdaptiveResolution({
  s,
  governor,
  dpr,
  setDpr,
}: {
  s: StoryState
  governor: ResolutionGovernor
  dpr: number
  setDpr: (dpr: number) => void
}) {
  const invalidate = useThree((st) => st.invalidate)
  const restTimer = useRef(0)
  // Browser frame pacing while the scene moves. R3F's own delta spans skipped
  // vsyncs (on-demand frames during a scroll), so it measures input cadence,
  // not load; the vsync interval measures actual back-pressure.
  const beat = useRef({ prev: 0, curr: 0, raf: 0 })
  const stopBeat = () => {
    window.cancelAnimationFrame(beat.current.raf)
    beat.current = { prev: 0, curr: 0, raf: 0 }
  }
  useEffect(
    () => () => {
      window.clearTimeout(restTimer.current)
      stopBeat()
    },
    [],
  )
  // On-demand loop: draw once more whenever the pixel ratio changes.
  useEffect(() => invalidate(), [dpr, invalidate])
  useFrame(() => {
    const b = beat.current
    if (!b.raf) {
      const tick = (t: number) => {
        beat.current.prev = beat.current.curr
        beat.current.curr = t
        beat.current.raf = window.requestAnimationFrame(tick)
      }
      b.raf = window.requestAnimationFrame(tick)
    }
    window.clearTimeout(restTimer.current)
    restTimer.current = window.setTimeout(() => {
      stopBeat()
      const next = governor.rest()
      if (next !== null) setDpr(next)
    }, 300)
    if (s.intro < 1 || !b.prev) return
    const next = governor.sample((b.curr - b.prev) / 1000)
    if (next !== null) setDpr(next)
  })
  return null
}

function Lights({ s }: { s: StoryState }) {
  const scene = useThree((st) => st.scene)
  const key = useRef<THREE.DirectionalLight>(null)
  const rim = useRef<THREE.DirectionalLight>(null)
  const sweep = useRef<THREE.PointLight>(null)
  const approval = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    const on = easeOutCubic(s.intro)
    // Policy passed: the studio lifts a touch and an emerald rim light catches
    // the card's metal edge. (Always mounted, so no shader recompiles.)
    scene.environmentIntensity = on * (1 + 0.12 * s.glow)
    if (key.current) key.current.intensity = 1.4 * on
    if (rim.current) rim.current.intensity = 3 * on
    if (approval.current) {
      approval.current.position.set(s.cx + 3.2, s.cy + 1.6, s.cz - 4.2)
      approval.current.intensity = 2.6 * s.glow * on
    }
    if (sweep.current) {
      sweep.current.position.set(s.cx - 2.4 + 4.8 * s.sweep, s.cy + 0.55, s.cz + 1.3)
      sweep.current.intensity = Math.sin(Math.PI * s.sweep) * 14
    }
  })
  return (
    <>
      <directionalLight ref={key} position={[3.5, 4, 6]} intensity={0} />
      <directionalLight ref={rim} position={[-6, 2.5, -5]} color="#cdd6ff" intensity={0} />
      <pointLight ref={sweep} distance={7} decay={2} color="#f2fff8" intensity={0} />
      <directionalLight ref={approval} color="#34d399" intensity={0} />
    </>
  )
}

/**
 * Orbit-style rig with a lens shift, so framing moves without perspective
 * distortion. During the payoff the lens shift is solved from the dashboard
 * panel's real on-screen position, so the card lands on it on any viewport:
 * straddling its top edge in wide layouts, behind the glass in portrait.
 */
function CameraRig({ s, overlayRef }: { s: StoryState; overlayRef: RefObject<HTMLElement | null> }) {
  const target = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size, gl }) => {
    let shiftX = s.shiftX
    let shiftY = s.shiftY
    const panel = s.dock > 0 ? overlayRef.current?.querySelector('[data-panel]') : null
    if (panel) {
      const r = panel.getBoundingClientRect()
      const stage = gl.domElement.getBoundingClientRect()
      const x = r.left + r.width / 2 - stage.left
      const y = (size.width >= size.height ? r.top : r.top + r.height / 2) - stage.top
      shiftX = THREE.MathUtils.lerp(shiftX, (x - size.width / 2) / size.width, s.dock)
      shiftY = THREE.MathUtils.lerp(shiftY, (size.height / 2 - y) / size.height, s.dock)
    }
    const cam = camera as THREE.PerspectiveCamera
    const cp = Math.cos(s.pitch)
    target.set(s.tx, s.ty, s.tz)
    cam.position.set(
      s.tx + s.dist * cp * Math.sin(s.yaw),
      s.ty + s.dist * Math.sin(s.pitch),
      s.tz + s.dist * cp * Math.cos(s.yaw),
    )
    cam.lookAt(target)
    cam.setViewOffset(size.width, size.height, -shiftX * size.width, shiftY * size.height, size.width, size.height)
    cam.updateProjectionMatrix()
  })
  return null
}

type Layouts = { wide: StoryState; tall: StoryState }

/**
 * Each frame renders whichever layout matches the viewport's current aspect.
 * Both layouts are animated on the same clock, so a resize or rotation never
 * rebuilds the timeline (rebuilding mid-refresh makes ScrollTrigger lose the
 * scroll position). Runs before every other frame callback.
 */
function LayoutSync({ s, layouts }: { s: StoryState; layouts: Layouts }) {
  useFrame(({ size }) => {
    Object.assign(s, size.width >= size.height ? layouts.wide : layouts.tall)
  }, -1)
  return null
}

/** Builds the scroll-scrubbed timeline and the intro from darkness. */
function Director({
  layouts,
  sectionRef,
  overlayRef,
  onReady,
}: {
  layouts: Layouts
  sectionRef: RefObject<HTMLElement | null>
  overlayRef: RefObject<HTMLElement | null>
  onReady: () => void
}) {
  const invalidate = useThree((st) => st.invalidate)

  useLayoutEffect(() => {
    const section = sectionRef.current
    const overlay = overlayRef.current
    if (!section || !overlay) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        onUpdate: () => invalidate(),
        scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 1.1 },
      })
      const wide = gsap.timeline()
      const tall = gsap.timeline()
      buildSceneTimeline(wide, layouts.wide, WIDE_LAYOUT)
      buildSceneTimeline(tall, layouts.tall, TALL_LAYOUT)
      tl.add(wide, 0).add(tall, 0)
      buildOverlayTimeline(tl, overlay)

      gsap.to([layouts.wide, layouts.tall], {
        intro: 1,
        duration: 2.6,
        delay: 0.15,
        ease: 'power2.out',
        onUpdate: () => invalidate(),
      })
    })
    invalidate()

    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(onReady)
    })
    return () => {
      cancelAnimationFrame(frame)
      ctx.revert()
    }
  }, [layouts, sectionRef, overlayRef, onReady, invalidate])

  return null
}

export default function CinematicStage({
  sectionRef,
  overlayRef,
  onReady,
}: {
  sectionRef: RefObject<HTMLElement | null>
  overlayRef: RefObject<HTMLElement | null>
  onReady: () => void
}) {
  const layouts = useMemo<Layouts>(
    () => ({ wide: createStoryState(WIDE_LAYOUT), tall: createStoryState(TALL_LAYOUT) }),
    [],
  )
  // The state every frame callback reads; LayoutSync fills it from the active layout.
  const state = useMemo(() => ({ ...(tall() ? layouts.tall : layouts.wide) }), [layouts])
  // Native Retina sharpness up to 2× (3× phones gain little beyond that for the
  // cost). The governor may lower it while moving under sustained load, and
  // always restores it when the scene comes to rest.
  const maxDpr = useMemo(() => Math.min(window.devicePixelRatio || 1, 2), [])
  const governor = useMemo(() => createResolutionGovernor({ max: maxDpr }), [maxDpr])
  const [dpr, setDpr] = useState(maxDpr)

  return (
    <Canvas
      frameloop="demand"
      dpr={dpr}
      camera={{ fov: 30, near: 0.1, far: 80, position: [0, 0, 7.4] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <LayoutSync s={state} layouts={layouts} />
      <AdaptiveResolution s={state} governor={governor} dpr={dpr} setDpr={setDpr} />
      <Studio />
      <Lights s={state} />
      <Scene s={state} />
      <CameraRig s={state} overlayRef={overlayRef} />
      <Director layouts={layouts} sectionRef={sectionRef} overlayRef={overlayRef} onReady={onReady} />
    </Canvas>
  )
}
