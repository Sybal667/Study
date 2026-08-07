'use client'

import { useEffect, useRef, useState } from 'react'
import type { TourStepDef } from '@/lib/tourSteps'

interface Props {
  step: TourStepDef
  onNext: () => void
  onSkip: () => void
  isLastStep: boolean
}

function bezierPoint(t: number, p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }) {
  const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x
  const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y
  return { x, y }
}

function bezierAngle(t: number, p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }) {
  const dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x)
  const dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

export default function TourTooltip({ step, onNext, onSkip, isLastStep }: Props) {
 const [rect, setRect] = useState<DOMRect | null>(null)
  const [secondaryRect, setSecondaryRect] = useState<DOMRect | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null)

useEffect(() => {
    if (!tooltipRef.current) return
    const update = () => setTooltipRect(tooltipRef.current!.getBoundingClientRect())
    update()
    const id = window.setInterval(update, 300)
    return () => window.clearInterval(id)
  }, [step.target, rect])

useEffect(() => {
    const update = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`)
      if (el) setRect(el.getBoundingClientRect())

      if (step.secondaryTarget) {
        const secEl = document.querySelector(`[data-tour="${step.secondaryTarget}"]`)
        setSecondaryRect(secEl ? secEl.getBoundingClientRect() : null)
      } else {
        setSecondaryRect(null)
      }
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const id = window.setInterval(update, 300) // catches hover-panel layout shifts
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.clearInterval(id)
    }
  }, [step.target, step.secondaryTarget])

  if (!rect) return null

const pad = 8
const makeSpotlight = (r: DOMRect, withDim: boolean): React.CSSProperties => ({
    position: 'fixed',
    top: r.top - pad,
    left: r.left - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
    borderRadius: 10,
    boxShadow: withDim
      ? '0 0 0 3px rgba(255,255,255,0.95), 0 0 24px 8px rgba(255,255,255,0.65), 0 0 0 9999px rgba(0,0,0,0.7)'
      : '0 0 0 3px rgba(255,255,255,0.95), 0 0 24px 8px rgba(255,255,255,0.65)',
    pointerEvents: 'none',
    zIndex: 10000,
    transition: 'all 0.2s ease',
  })
const spotlightStyle = makeSpotlight(rect, true)
  const secondarySpotlightStyle = secondaryRect ? makeSpotlight(secondaryRect, true) : null

const tooltipPos = getTooltipPosition(rect, step.placement ?? 'bottom')
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10001,
    maxWidth: 280,
    backgroundColor: 'rgba(20,20,20,0.97)',
    color: 'white',
    borderRadius: 10,
    padding: '16px 18px',
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    ...tooltipPos,
  }

const ringStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.bottom - 6,
    right: window.innerWidth - rect.right - 6,
    width: 14,
    height: 14,
    borderRadius: '50%',
    zIndex: 10002,
    pointerEvents: 'none',
  }

const ringCenterX = rect.right - 6
  const ringCenterY = rect.bottom - 6

  const tooltipCenterX = tooltipRect ? tooltipRect.left + tooltipRect.width / 2 : (tooltipPos.left as number)
  const tooltipCenterY = tooltipRect ? tooltipRect.top + tooltipRect.height / 2 : (tooltipPos.top as number)

  const p0 = { x: tooltipCenterX, y: tooltipCenterY }
  const p1 = { x: (tooltipCenterX + ringCenterX) / 2, y: (tooltipCenterY + ringCenterY) / 2 - 30 }
  const rawEnd = { x: ringCenterX, y: ringCenterY }

  const gap = 12 // roughly 3mm, so the trail stops short of the ring instead of touching it
  const dx = rawEnd.x - p1.x
  const dy = rawEnd.y - p1.y
  const dLen = Math.sqrt(dx * dx + dy * dy) || 1
  const p2 = { x: rawEnd.x - (dx / dLen) * gap, y: rawEnd.y - (dy / dLen) * gap }

const chevrons = tooltipRect
    ? [0.35, 0.6, 0.85].map((t) => ({
        pos: bezierPoint(t, p0, p1, p2),
        angle: bezierAngle(t, p0, p1, p2),
      }))
    : []

  const dashedPath = tooltipRect ? `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}` : ''

  let secondaryChevrons: { pos: { x: number; y: number }; angle: number }[] = []
  let secondaryDashedPath = ''
  if (tooltipRect && secondaryRect) {
    const secRingCenterX = secondaryRect.right - 6
    const secRingCenterY = secondaryRect.bottom - 6
    const secP1 = { x: (tooltipCenterX + secRingCenterX) / 2, y: (tooltipCenterY + secRingCenterY) / 2 - 30 }
    const secRawEnd = { x: secRingCenterX, y: secRingCenterY }
    const secDx = secRawEnd.x - secP1.x
    const secDy = secRawEnd.y - secP1.y
    const secLen = Math.sqrt(secDx * secDx + secDy * secDy) || 1
    const secP2 = { x: secRawEnd.x - (secDx / secLen) * gap, y: secRawEnd.y - (secDy / secLen) * gap }

    secondaryChevrons = [0.35, 0.6, 0.85].map((t) => ({
      pos: bezierPoint(t, p0, secP1, secP2),
      angle: bezierAngle(t, p0, secP1, secP2),
    }))
    secondaryDashedPath = `M ${p0.x} ${p0.y} Q ${secP1.x} ${secP1.y} ${secP2.x} ${secP2.y}`
  }

  return (
    <>
      <style>{tourAnimStyles}</style>
      <div style={spotlightStyle} />
      {secondarySpotlightStyle && <div style={secondarySpotlightStyle} />}
<svg
        style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 10001, pointerEvents: 'none' }}
      >
        {dashedPath && (
          <path
            d={dashedPath}
            fill="none"
            stroke="#E24B4A"
            strokeWidth={1.5}
            strokeDasharray="1,6"
            strokeLinecap="round"
            style={{ opacity: 0, animation: 'tour-chevron-fade 0.3s ease-out forwards' }}
          />
        )}
        {secondaryDashedPath && (
          <path
            d={secondaryDashedPath}
            fill="none"
            stroke="#E24B4A"
            strokeWidth={1.5}
            strokeDasharray="1,6"
            strokeLinecap="round"
            style={{ opacity: 0, animation: 'tour-chevron-fade 0.3s ease-out forwards' }}
          />
        )}
        {secondaryChevrons.map((c, i) => (
          <path
            key={`sec-${i}`}
            d="M -6,-6 L 5,0 L -6,6"
            fill="none"
            stroke="#E24B4A"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform={`translate(${c.pos.x}, ${c.pos.y}) rotate(${c.angle})`}
            style={{ opacity: 0, animation: `tour-chevron-fade 0.25s ease-out forwards ${i * 0.12}s` }}
          />
        ))}
        {chevrons.map((c, i) => (
          <path
            key={i}
            d="M -6,-6 L 5,0 L -6,6"
            fill="none"
            stroke="#E24B4A"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform={`translate(${c.pos.x}, ${c.pos.y}) rotate(${c.angle})`}
            style={{ opacity: 0, animation: `tour-chevron-fade 0.25s ease-out forwards ${i * 0.12}s` }}
          />
        ))}
      </svg>
     <span style={{ ...ringStyle, backgroundColor: '#E24B4A' }} />
      <span style={{ ...ringStyle, backgroundColor: '#E24B4A', opacity: 0.6, animation: 'tour-ping 1.1s cubic-bezier(0,0,0.2,1) infinite' }} />
      {secondaryRect && (
        <>
          <span
            style={{
              position: 'fixed',
              top: secondaryRect.bottom - 6,
              right: window.innerWidth - secondaryRect.right - 6,
              width: 14,
              height: 14,
              borderRadius: '50%',
              zIndex: 10002,
              pointerEvents: 'none',
              backgroundColor: '#E24B4A',
            }}
          />
          <span
            style={{
              position: 'fixed',
              top: secondaryRect.bottom - 6,
              right: window.innerWidth - secondaryRect.right - 6,
              width: 14,
              height: 14,
              borderRadius: '50%',
              zIndex: 10002,
              pointerEvents: 'none',
              backgroundColor: '#E24B4A',
              opacity: 0.6,
              animation: 'tour-ping 1.1s cubic-bezier(0,0,0.2,1) infinite',
            }}
          />
        </>
      )}
       <div ref={tooltipRef} style={tooltipStyle}>
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 15 }}>{step.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.9, marginBottom: step.hint ? 8 : 14 }}>
          {step.content}
        </div>
        {step.hint && (
          <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.6, marginBottom: 14, fontStyle: 'italic' }}>
            {step.hint}
          </div>
        )}
      {step.blocking ? (
          <div style={{ fontSize: 12, opacity: 0.6, fontStyle: 'italic' }}>
            Waiting for you to upload a document...
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={onSkip} style={skipButtonStyle}>Skip tour</button>
            <button onClick={onNext} style={nextButtonStyle}>{isLastStep ? 'Got it' : 'Next'}</button>
          </div>
        )}
      </div>
    </>
  )
}

function getTooltipPosition(rect: DOMRect, placement: string): React.CSSProperties {
  const gap = 16
  const arrowRoom = 140 // extra spacing so the chevron trail has room to be visible
  switch (placement) {
    case 'right': return { top: rect.top, left: rect.right + gap + arrowRoom }
    case 'left': return { top: rect.top, left: rect.left - gap - arrowRoom - 280 }
    case 'top': return { top: rect.top - gap - arrowRoom - 120, left: rect.left }
    case 'bottom':
    default: return { top: rect.bottom + gap + arrowRoom, left: rect.left }
  }
}

const skipButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
  fontSize: 12, cursor: 'pointer', padding: 0,
}

const nextButtonStyle: React.CSSProperties = {
  backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: 6,
  padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

const tourAnimStyles = `
  @keyframes tour-ping {
    0% { transform: scale(1); opacity: 0.6; }
    80%, 100% { transform: scale(2.4); opacity: 0; }
  }
  @keyframes tour-chevron-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`