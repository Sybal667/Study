
'use client'

import { useEffect, useId, useRef, useState } from 'react'

interface VisualResultData {
  type: 'none' | 'mermaid' | 'graph'
  title: string
  explanation: string
  mermaid: string
  graph: {
    xLabel?: string
    yLabel?: string
    points: { x: number; y: number }[]
  }
}

export default function VisualResult({
  visual,
}: {
  visual: VisualResultData
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const generatedId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [diagramError, setDiagramError] = useState(false)

  useEffect(() => {
    if (visual.type !== 'mermaid' || !containerRef.current) return

    let cancelled = false


const renderDiagram = async () => {
  try {
    const mermaid = (await import('mermaid')).default

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'dark',
    })

    // Validate the generated Mermaid source before rendering.
    await mermaid.parse(visual.mermaid)

    const { svg } = await mermaid.render(
      `studyhub-visual-${generatedId}`,
      visual.mermaid,
    )

    if (!cancelled && containerRef.current) {
      containerRef.current.innerHTML = svg
      setDiagramError(false)
    }
  } catch (error) {
    console.error('Mermaid validation/rendering failed:', error)

    if (!cancelled) {
      setDiagramError(true)
    }
  }
}


    void renderDiagram()

    return () => {
      cancelled = true
    }
  }, [visual.mermaid, visual.type, generatedId])

  if (visual.type === 'none') {
    return (
      <div style={panelStyle}>
        <strong>{visual.title || 'No suitable visual'}</strong>
        <p style={paragraphStyle}>{visual.explanation}</p>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <strong>{visual.title}</strong>
      <p style={paragraphStyle}>{visual.explanation}</p>

      {visual.type === 'mermaid' && (
        <div
          ref={containerRef}
          style={{ width: '100%', overflowX: 'auto', marginTop: 12 }}
        >
          {diagramError && (
            <p style={paragraphStyle}>
              This diagram could not be rendered. Try generating it again.
            </p>
          )}
        </div>
      )}

      {visual.type === 'graph' && (
        <GraphVisual graph={visual.graph} />
      )}
    </div>
  )
}

function GraphVisual({
  graph,
}: {
  graph: VisualResultData['graph']
}) {
  const points = graph.points

  if (
    points.length < 2 ||
    !points.every(
      (point) =>
        Number.isFinite(point.x) && Number.isFinite(point.y),
    )
  ) {
    return (
      <p style={paragraphStyle}>
        There is not enough valid numerical data to draw this graph.
      </p>
    )
  }

  const width = 600
  const height = 320
  const left = 60
  const right = 24
  const top = 20
  const bottom = 55

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const xRange = maxX - minX || 1
  const yRange = maxY - minY || 1

  const plotWidth = width - left - right
  const plotHeight = height - top - bottom

  const coordinates = points.map((point) => ({
    x: left + ((point.x - minX) / xRange) * plotWidth,
    y: top + plotHeight - ((point.y - minY) / yRange) * plotHeight,
  }))

  return (
    <div style={{ width: '100%', overflowX: 'auto', marginTop: 12 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${graph.yLabel || 'Y'} against ${graph.xLabel || 'X'}`}
        style={{ width: '100%', minWidth: 300, display: 'block' }}
      >
        <line
          x1={left}
          y1={top}
          x2={left}
          y2={height - bottom}
          stroke="currentColor"
        />
        <line
          x1={left}
          y1={height - bottom}
          x2={width - right}
          y2={height - bottom}
          stroke="currentColor"
        />

        <polyline
          points={coordinates.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#60a5fa"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {coordinates.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#60a5fa"
          />
        ))}

        <text
          x={left + plotWidth / 2}
          y={height - 12}
          fill="currentColor"
          textAnchor="middle"
          fontSize="13"
        >
          {graph.xLabel || 'X'}
        </text>

        <text
          x="16"
          y={top + plotHeight / 2}
          fill="currentColor"
          textAnchor="middle"
          fontSize="13"
          transform={`rotate(-90 16 ${top + plotHeight / 2})`}
        >
          {graph.yLabel || 'Y'}
        </text>
      </svg>

      <p style={paragraphStyle}>
        Points are connected in the order supplied by the AI.
      </p>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 12,
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 10,
  background: 'rgba(15,23,42,0.75)',
  color: 'white',
  width: '100%',
  boxSizing: 'border-box',
}

const paragraphStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  opacity: 0.8,
  whiteSpace: 'pre-wrap',
}
