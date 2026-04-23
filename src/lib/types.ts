export type PostSourceShopify = {
  kind: 'shopify'
  productId: string
  productTitle: string
  images: string[]
  selectedImageIndex: number
}

export type PostSourceUpload = {
  kind: 'upload'
  mediaUrl: string
  mediaType: 'image' | 'video'
  userPrompt: string
}

export type PostSource = PostSourceShopify | PostSourceUpload

export type CropData = {
  x: number
  y: number
  scale: number
}

export type CaptionBlock = {
  variants: [string, string, string]
  selected: 0 | 1 | 2
}

export type Hashtag = {
  text: string
  active: boolean
}

export type PostCaption = {
  opener: CaptionBlock
  middle: CaptionBlock
  closer: CaptionBlock
  hashtags: Hashtag[]
}

export type PostState = 'empty' | 'draft' | 'conflict' | 'locked'

export type Post = {
  id: string
  state: PostState
  position: number        // 0 = top-left (newest), ascending = older
  source: PostSource | null
  cropData: CropData
  caption: PostCaption | null
  scheduledAt: string | null   // ISO 8601
  isPerson: boolean
}

export type Product = {
  id: string
  title: string
  images: string[]
}

export type ToneOfVoice = {
  content: string
}
