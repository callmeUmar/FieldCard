import { describe, expect, it } from 'vitest'
import { createResolutionGovernor } from './resolutionGovernor'

const frames = (governor: ReturnType<typeof createResolutionGovernor>, delta: number, count: number) => {
  let last: number | null = null
  for (let i = 0; i < count; i++) last = governor.sample(delta) ?? last
  return last
}

describe('cinematic resolution governor', () => {
  it('keeps full resolution while frames are fast', () => {
    const g = createResolutionGovernor({ max: 2 })
    frames(g, 1 / 60, 500)
    expect(g.current).toBe(2)
  })

  it('ignores the long gaps between on-demand frames during slow scrolling', () => {
    const g = createResolutionGovernor({ max: 2 })
    // a slow, bursty scroll: fast frames interleaved with idle gaps
    for (let i = 0; i < 300; i++) g.sample(i % 3 === 0 ? 0.25 : 1 / 60)
    expect(g.current).toBe(2)
  })

  it('steps down only under sustained load, and never below the floor', () => {
    const g = createResolutionGovernor({ max: 2, min: 1 })
    expect(frames(g, 1 / 25, 45)).toBe(1.5)
    expect(frames(g, 1 / 25, 45)).toBe(1)
    frames(g, 1 / 25, 450)
    expect(g.current).toBe(1)
  })

  it('returns to full resolution whenever the scene comes to rest', () => {
    const g = createResolutionGovernor({ max: 2 })
    frames(g, 1 / 25, 90)
    expect(g.current).toBe(1)
    expect(g.rest()).toBe(2)
    expect(g.rest()).toBeNull()
  })

  it('gives the same resolution at rest scrolling down, back up and down again', () => {
    const g = createResolutionGovernor({ max: 2 })
    const atRest: number[] = []
    for (const load of [1 / 60, 1 / 25, 1 / 25, 1 / 60, 1 / 25, 1 / 60]) {
      frames(g, load, 120) // a scroll gesture through a chapter, either direction
      g.rest()
      atRest.push(g.current)
    }
    expect(atRest).toEqual([2, 2, 2, 2, 2, 2])
  })
})
