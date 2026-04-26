type ZernioPostInput = {
  content: string
  scheduledFor: string
  mediaUrls?: string[]
}

export async function scheduleZernioPost(input: ZernioPostInput): Promise<void> {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) throw new Error('ZERNIO_API_KEY is not set')

  const instagramId = process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID
  const facebookId = process.env.ZERNIO_FACEBOOK_ACCOUNT_ID

  const platforms: Array<{ platform: string; accountId: string }> = []
  if (instagramId) platforms.push({ platform: 'instagram', accountId: instagramId })
  if (facebookId) platforms.push({ platform: 'facebook', accountId: facebookId })
  if (platforms.length === 0) {
    throw new Error('No Zernio platform account IDs configured')
  }

  const body: Record<string, unknown> = {
    content: input.content,
    scheduledFor: input.scheduledFor,
    platforms,
  }

  if (input.mediaUrls?.length) {
    body.mediaItems = input.mediaUrls.map(url => ({ type: 'image', url }))
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  let res: Response
  try {
    res = await fetch('https://zernio.com/api/v1/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zernio ${res.status}: ${text}`)
  }
}
