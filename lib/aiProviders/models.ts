export type AiProvider = 'gemini' | 'groq'

export interface AiModelOption {
  id: string
  provider: AiProvider
  label: string
  description: string
  supportsFileInput: boolean
}

export const AI_MODELS: AiModelOption[] = [
  {
    id: 'gemini-3.5-flash',
    provider: 'gemini',
    label: 'Flash',
    description: 'Fast, great for most questions',
    supportsFileInput: true,
  },
  {
    id: 'gemini-3.1-pro-preview',
    provider: 'gemini',
    label: 'Pro',
    description: 'Deepest reasoning — best for dense diagrams & long documents',
    supportsFileInput: true,
  },
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    label: 'Groq Llama 3.3',
    description: 'Very fast, text-only (reads extracted PDF text, not diagrams)',
    supportsFileInput: false,
  },
]

export function getModelInfo(modelId: string): AiModelOption | undefined {
  return AI_MODELS.find((m) => m.id === modelId)
}