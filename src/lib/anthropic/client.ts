import Anthropic from '@anthropic-ai/sdk'

export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set (empty or missing — check .env.local and that the parent shell did not inject an empty value)')
  return new Anthropic({ apiKey })
}
