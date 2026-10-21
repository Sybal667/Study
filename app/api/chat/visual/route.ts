
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const maxDuration = 60

const ALLOWED_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
  'openai/gpt-oss-120b',
]

const MAX_REPAIR_ATTEMPTS = 2

const VISUAL_INSTRUCTIONS = `
You create educational visuals from a specific AI answer.

SOURCE RULES:
1. The supplied ANSWER is the authoritative source.
2. Use the QUESTION only to clarify the answer.
3. Do not use or infer information from any PDF or external document.
4. Preserve the answer's facts, values, formulas and reasoning.
5. Never invent numerical data or unsupported steps.
6. Choose a useful visual format regardless of academic discipline.
7. If no accurate, useful visual can be made, return type "none".
8. Do not invent data for quantitative graphs.

MERMAID RULES:
9. Use flowchart TD or flowchart LR.
10. Put every connection on its own line.
11. Never combine separate connections on one line.
12. Quote labels containing parentheses, commas, colons or special characters.
13. Use simple node IDs containing only letters, numbers and underscores.
14. Avoid unsupported Mermaid syntax and Markdown fences.
15. Generate a complete, syntactically valid Mermaid diagram.

Return ONLY valid JSON:
{
  "type": "none" | "mermaid" | "graph",
  "title": "Short descriptive title",
  "explanation": "What the visual illustrates",
  "mermaid": "Mermaid source or empty string",
  "graph": {
    "xLabel": "Horizontal axis label",
    "yLabel": "Vertical axis label",
    "points": [{"x": 0, "y": 0}]
  }
}

For "mermaid", provide a complete flowchart.
For "graph", use only numerical points supported by the answer.
For "none", use an empty Mermaid string and an empty points array.
Do not include text outside the JSON.
`

const REPAIR_INSTRUCTIONS = `
You repair Mermaid flowchart syntax.

Return ONLY valid JSON in this exact shape:
{"mermaid":"corrected Mermaid source"}

Rules:
- Preserve the diagram's intended meaning and relationships.
- Do not add facts or concepts that are not in the supplied diagram.
- Use flowchart TD or flowchart LR.
- Put each node declaration and connection on its own line.
- Never put multiple connections on one line.
- Quote labels containing parentheses, commas, colons or special characters.
- Use simple node IDs containing only letters, numbers and underscores.
- Do not include Markdown fences or explanations.
`

function extractJsonObject(text: string): string {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')

  if (start === -1 || end <= start) {
    throw new Error('AI returned invalid JSON')
  }

  return cleaned.slice(start, end + 1)
}

function parseJsonResponse(text: string) {
  const result = JSON.parse(extractJsonObject(text))

  if (
    !['none', 'mermaid', 'graph'].includes(result.type) ||
    typeof result.title !== 'string' ||
    typeof result.explanation !== 'string' ||
    typeof result.mermaid !== 'string' ||
    !result.graph ||
    !Array.isArray(result.graph.points)
  ) {
    throw new Error('AI returned an invalid visual format')
  }

  if (
    result.type === 'mermaid' &&
    !result.mermaid.trim()
  ) {
    throw new Error('AI returned an empty diagram')
  }

  if (
    result.type === 'graph' &&
    !result.graph.points.every(
      (point: { x: unknown; y: unknown }) =>
        typeof point.x === 'number' &&
        Number.isFinite(point.x) &&
        typeof point.y === 'number' &&
        Number.isFinite(point.y),
    )
  ) {
    throw new Error('AI returned invalid graph points')
  }

  return result
}

function cleanMermaidSource(source: string): string {
  return source
    .trim()
    .replace(/^```(?:mermaid)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

async function validateMermaid(source: string): Promise<void> {
  const mermaid = (await import('mermaid')).default

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'dark',
  })

  await mermaid.parse(cleanMermaidSource(source))
}

async function callModel(
  model: string,
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
): Promise<string> {
  if (model.startsWith('gemini-')) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    )

    if (!response.ok) {
      const details = await response.text()
      console.error('Gemini visual request failed:', response.status, details)
      throw new Error('AI visual request failed')
    }

    const data = await response.json()

    return (
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? '')
        .join('') ?? ''
    )
  }

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        stream: false,
      }),
      signal: AbortSignal.timeout(15000),
    },
  )

  if (!response.ok) {
    const details = await response.text()
    console.error('Groq visual request failed:', response.status, details)
    throw new Error('AI visual request failed')
  }

  const data = await response.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

async function repairMermaid(
  model: string,
  apiKey: string,
  question: string,
  answer: string,
  invalidSource: string,
): Promise<string> {
  const repairPrompt = `
Original question:
${question}

Exact AI answer being visualized:
${answer}

Mermaid source that failed syntax validation:
${invalidSource}

Repair the syntax while preserving the existing diagram's meaning.
Return the corrected source in the required JSON format.
`

  const responseText = await callModel(
    model,
    apiKey,
    REPAIR_INSTRUCTIONS,
    repairPrompt,
  )

  if (!responseText.trim()) {
    throw new Error('AI returned an empty repair')
  }

  const repaired = JSON.parse(extractJsonObject(responseText))

  if (
    typeof repaired.mermaid !== 'string' ||
    !repaired.mermaid.trim()
  ) {
    throw new Error('AI returned an invalid Mermaid repair')
  }

  return cleanMermaidSource(repaired.mermaid)
}

async function validateAndRepairVisual(
  visual: ReturnType<typeof parseJsonResponse>,
  model: string,
  apiKey: string,
  question: string,
  answer: string,
) {
  if (visual.type !== 'mermaid') {
    return visual
  }

  let source = cleanMermaidSource(visual.mermaid)

  for (
    let attempt = 0;
    attempt <= MAX_REPAIR_ATTEMPTS;
    attempt++
  ) {
    try {
      await validateMermaid(source)

      return {
        ...visual,
        mermaid: source,
      }
    } catch (error) {
      console.warn(
        `Mermaid validation failed on attempt(And to be honest , ai explain things better than us  , (it suggested i say human instead of us but humans rule i made a choise of my own )been coding for a while i think now i am getting crazy) ${attempt + 1}:`,
        error instanceof Error ? error.message : error,
      )

      if (attempt === MAX_REPAIR_ATTEMPTS) {
        break
      }

      try {
        source = await repairMermaid(
          model,
          apiKey,
          question,
          answer,
          source,
        )
      } catch (repairError) {
        console.warn(
          `Mermaid repair attempt ${attempt + 1} failed:`,
          repairError instanceof Error
            ? repairError.message
            : repairError,
        )
      }
    }
  }

  return {
    type: 'none' as const,
    title: 'Diagram could not be generated',
    explanation:
      'The generated diagram did not pass syntax validation after two repair attempts. You can try generating the visual again.Its not me  ,ke Ai',
    mermaid: '',
    graph: {
      xLabel: '',
      yLabel: '',
      points: [],
    },
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 },
      )
    }

    const { data: student, error: studentError } =
      await supabaseAdmin
        .from('students')
        .select('student_number')
        .eq('auth_user_id', user.id)
        .maybeSingle()

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Unable to verify student account' },
        { status: 403 },
      )
    }

    let body: {
      pdf_id?: unknown
      question?: unknown
      answer?: unknown
      model?: unknown
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      )
    }

    const { pdf_id, question, answer, model } = body

    if (
      typeof pdf_id !== 'number' ||
      !Number.isSafeInteger(pdf_id) ||
      pdf_id <= 0 ||
      typeof question !== 'string' ||
      !question.trim() ||
      question.length > 10000 ||
      typeof answer !== 'string' ||
      !answer.trim() ||
      answer.length > 20000 ||
      typeof model !== 'string' ||
      !ALLOWED_MODELS.includes(model)
    ) {
      return NextResponse.json(
        { error: 'Invalid PDF, question, answer or model' },
        { status: 400 },
      )
    }

    // Verify ownership only; never retrieve PDF content for visual generation.
    const { data: pdfRow, error: pdfError } =
      await supabaseAdmin
        .from('student_pdfs')
        .select('pdf_id')
        .eq('pdf_id', pdf_id)
        .eq('student_number', student.student_number)
        .maybeSingle()

    if (pdfError) {
      return NextResponse.json(
        { error: 'Failed to verify PDF access' },
        { status: 500 },
      )
    }

    if (!pdfRow) {
      return NextResponse.json(
        { error: 'PDF not found' },
        { status: 404 },
      )
    }

    const apiKey = model.startsWith('gemini-')
      ? process.env.GEMINI_API_KEY
      : process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI provider is not configured' },
        { status: 500 },
      )
    }

    const userPrompt = `
QUESTION:
${question.trim()}

EXACT AI ANSWER TO VISUALIZE:
${answer.trim()}

Create a visual that explains this answer only.
`

    const generatedText = await callModel(
      model,
      apiKey,
      VISUAL_INSTRUCTIONS,
      userPrompt,
    )

    if (!generatedText.trim()) {
      return NextResponse.json(
        { error: 'The AI returned an empty visual response' },
        { status: 502 },
      )
    }

    const initialVisual = parseJsonResponse(generatedText)

    const visual = await validateAndRepairVisual(
      initialVisual,
      model,
      apiKey,
      question.trim(),
      answer.trim(),
    )

    return NextResponse.json(visual, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Visual API error:', error)

    return NextResponse.json(
      { error: 'Unable to generate a visual. Please try again.' },
      { status: 500 },
    )
  }
}
