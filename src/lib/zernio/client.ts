type ZernioPostInput = {
  content: string
  scheduledFor: string
  imageUrl?: string
}

export async function scheduleZernioPost(input: ZernioPostInput): Promise<void> {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) throw new Error('ZERNIO_API_KEY is not set')

  const instagramId = process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID
  if (!instagramId) throw new Error('ZERNIO_INSTAGRAM_ACCOUNT_ID is not set')

  const facebookId = process.env.ZERNIO_FACEBOOK_ACCOUNT_ID
  if (!facebookId) throw new Error('ZERNIO_FACEBOOK_ACCOUNT_ID is not set')

  const body: Record<string, unknown> = {
    accountIds: [instagramId, facebookId],
    content: input.content,
    scheduledFor: input.scheduledFor,
  }

  if (input.imageUrl) {
    body.media = [{ url: input.imageUrl }]
  }

  const res = await fetch('https://zernio.com/api/v1/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zernio ${res.status}: ${text}`)
  }
}
