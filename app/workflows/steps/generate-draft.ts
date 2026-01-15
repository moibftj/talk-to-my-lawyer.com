/**
 * Workflow Step: Generate AI Draft
 *
 * Uses OpenAI GPT-4 to generate legal letter content.
 * Automatically retries on failure (configured in step options).
 *
 * Returns: Generated letter content as string
 */
import { step } from "workflow"
import { generateTextWithRetry } from "@/lib/ai/openai-retry"

export interface GenerateDraftInput {
  letterType: string
  intakeData: Record<string, unknown>
  recipientInfo?: {
    name?: string
    email?: string
    address?: string
  }
}

/**
 * Build AI prompt from letter type and intake data
 */
function buildPrompt(letterType: string, intakeData: Record<string, unknown>) {
  const fields = (key: string) => {
    const value = intakeData[key]
    if (value === undefined || value === null || value === '') return ''
    const fieldName = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ')
    return `${fieldName}: ${String(value)}`
  }

  const amountField = intakeData["amountDemanded"]
    ? `Amount Demanded: $${Number(intakeData["amountDemanded"]).toLocaleString()}`
    : ""

  const deadlineField = intakeData["deadlineDate"]
    ? `Deadline: ${intakeData["deadlineDate"]}`
    : ""

  const incidentDateField = intakeData["incidentDate"]
    ? `Incident Date: ${intakeData["incidentDate"]}`
    : ""

  return `
Generate a professional legal ${letterType} with the following details:

${Object.keys(intakeData).filter(k => !["amountDemanded", "deadlineDate", "incidentDate"].includes(k)).map(fields).filter(Boolean).join('\n')}
${amountField}
${deadlineField}
${incidentDateField}

Requirements:
- Professional formal tone
- Legally sound language
- Proper letter formatting
- Clear and concise
- Include all relevant details
- End with appropriate closing
`.trim()
}

export async function generateDraftStep(input: GenerateDraftInput): Promise<string> {
  return await step(
    "generate-ai-draft",
    async () => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured")
      }

      const prompt = buildPrompt(input.letterType, input.intakeData)

      console.log('[GenerateDraft] Starting AI generation with retry logic')

      const { text: generatedContent, attempts, duration } = await generateTextWithRetry({
        prompt,
        system: "You are a professional legal attorney drafting formal legal letters. Always produce professional, legally sound content with proper formatting.",
        temperature: 0.7,
        maxOutputTokens: 2048,
        model: "gpt-4-turbo"
      })

      console.log(`[GenerateDraft] AI generation completed:`, {
        attempts,
        duration,
        contentLength: generatedContent.length
      })

      if (!generatedContent || generatedContent.trim().length === 0) {
        throw new Error("AI returned empty content")
      }

      return generatedContent
    },
    {
      // Automatic retry configuration
      maxAttempts: 3,
      backoff: "exponential"
    }
  )
}
