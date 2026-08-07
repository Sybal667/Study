'use client'

import { navButtonStyle } from '@/lib/studyStyles'
import { AI_MODELS } from '@/lib/aiProviders/models'

interface ModelPickerProps {
  selectedModel: string
  onSelect: (id: string) => void
}

export default function ModelPicker({ selectedModel, onSelect }: ModelPickerProps) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {AI_MODELS.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          title={m.description}
          style={{
            ...navButtonStyle,
            padding: '6px 10px',
            fontSize: '11px',
            backgroundColor: selectedModel === m.id ? 'rgba(30, 58, 138, 0.6)' : 'rgba(255,255,255,0.05)',
            borderColor: selectedModel === m.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
            color: 'white',
          }}
        >
          {m.provider === 'groq' ? '⚡' : '✨'} {m.label}
        </button>
      ))}
    </div>
  )
}