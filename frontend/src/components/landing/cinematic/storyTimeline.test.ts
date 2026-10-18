import { gsap } from 'gsap'
import { describe, expect, it } from 'vitest'
import {
  buildSceneTimeline,
  createStoryState,
  STORY_DURATION,
  T,
  TALL_LAYOUT,
  WIDE_LAYOUT,
  type StoryLayout,
  type StoryState,
} from './storyTimeline'

function story(layout: StoryLayout) {
  const s = createStoryState(layout)
  const tl = gsap.timeline({ paused: true })
  buildSceneTimeline(tl, s, layout)
  const at = (time: number): StoryState => {
    tl.seek(time, false)
    return { ...s }
  }
  return { tl, at }
}

/** > 0 when the card's printed front faces the camera, < 0 when its back does. */
const frontFacing = (s: StoryState) => Math.cos(s.cry - s.yaw)

describe.each([
  ['wide', WIDE_LAYOUT],
  ['tall', TALL_LAYOUT],
])('cinematic story timeline (%s layout)', (_name, layout) => {
  it('spans exactly the scroll length it is mapped onto', () => {
    expect(story(layout).tl.duration()).toBeCloseTo(STORY_DURATION, 5)
  })

  it('opens on the dark hero frame with nothing revealed', () => {
    const s = story(layout).at(0)
    expect(s.wake).toBe(0)
    expect(s.notif).toBe(0)
    expect(s.emerge).toBe(0)
    expect(s.specs).toBe(0)
    expect(s.dist).toBe(layout.hero.dist)
  })

  it('plays the SMS thread in order before the card leaves the phone', () => {
    const { at } = story(layout)
    expect(at(T.expand).notif).toBe(1)
    expect(at(T.m2).m1).toBe(1)
    expect(at(T.bubble).m3).toBe(1)
    const handOff = at(T.emerge)
    expect(handOff.bubble).toBe(1)
    expect(handOff.emerge).toBe(0)
  })

  it('only recedes the phone once the card is mostly off its screen', () => {
    expect(story(layout).at(T.recede).emerge).toBeGreaterThan(0.6)
  })

  it('prints the constraints while the back of the card faces the camera', () => {
    const { at } = story(layout)
    for (let t = T.specs + 0.05; t < T.flipBack; t += 0.1) {
      const s = at(t)
      if (s.specs > 0 && s.specs < 1) expect(frontFacing(s)).toBeLessThan(0)
    }
  })

  it('resolves to the approved card, front-on, with the phone gone', () => {
    const s = story(layout).at(STORY_DURATION)
    expect(s.bubble).toBe(1)
    expect(s.emerge).toBe(1)
    expect(s.specs).toBe(1)
    expect(s.sweep).toBe(1)
    expect(s.dim).toBe(0)
    expect(frontFacing(s)).toBeGreaterThan(0.8)
  })

  it('confirms the approval, then racks focus from the card to the dashboard', () => {
    const { at } = story(layout)
    expect(at(T.approve).glow).toBe(0)
    const confirmed = at(T.payoff)
    expect(confirmed.glow).toBe(1)
    expect(confirmed.cdim).toBe(1)
    const settled = at(STORY_DURATION)
    expect(settled.cdim).toBeLessThan(0.9)
    expect(at(T.payoff).dock).toBe(0)
    expect(settled.dock).toBe(1)
    expect(settled.glow).toBeGreaterThan(0)
    expect(T.post).toBeGreaterThan(T.payoff)
    expect(T.post + 0.6).toBeLessThan(STORY_DURATION) // the update finishes with room to read it
  })

  it('scrubs backwards to the same state it passed going forwards', () => {
    const { at } = story(layout)
    const forward = at(5.5)
    at(STORY_DURATION)
    expect(at(5.5)).toEqual(forward)
  })
})
