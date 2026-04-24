import type { ShopifyProduct, ShopifyCollection, ShopifyVariant } from '@/lib/types'

type ShopifyApiImage = { src: string }
type ShopifyApiVariant = { id: number; title: string; price: string }
type ShopifyApiProduct = {
  id: number
  title: string
  images: ShopifyApiImage[]
  variants: ShopifyApiVariant[]
}
type ShopifyApiCollection = { id: number; title: string }
type ShopifyApiCollect = { product_id: number; collection_id: number }

function shopifyHeaders() {
  const token = process.env.SHOPIFY_ADMIN_TOKEN
  if (!token) throw new Error('SHOPIFY_ADMIN_TOKEN is not set')
  return { 'X-Shopify-Access-Token': token }
}

function baseUrl() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN
  if (!domain) throw new Error('SHOPIFY_STORE_DOMAIN is not set')
  return `https://${domain}/admin/api/2025-01`
}

export async function getProducts(): Promise<ShopifyProduct[]> {
  const url = baseUrl()

  // 250 is the Shopify API maximum page size. Pagination is not implemented (future work).
  const [productsRes, collectsRes] = await Promise.all([
    fetch(`${url}/products.json?limit=250&fields=id,title,images,variants`, {
      headers: shopifyHeaders(),
      next: { revalidate: 300 },
    }),
    fetch(`${url}/collects.json?limit=250`, {
      headers: shopifyHeaders(),
      next: { revalidate: 300 },
    }),
  ])

  if (!productsRes.ok) {
    throw new Error(`Shopify API error ${productsRes.status}: ${await productsRes.text()}`)
  }
  if (!collectsRes.ok) {
    throw new Error(`Shopify API error ${collectsRes.status}: ${await collectsRes.text()}`)
  }

  const { products }: { products: ShopifyApiProduct[] } = await productsRes.json()
  const { collects }: { collects: ShopifyApiCollect[] } = await collectsRes.json()

  if (products.length === 250) {
    console.warn('Shopify: getProducts returned 250 products — pagination may be needed')
  }
  if (collects.length === 250) {
    console.warn('Shopify: getProducts returned 250 collects — pagination may be needed')
  }

  const collectionMap = new Map<string, string[]>()
  for (const collect of collects) {
    const pid = String(collect.product_id)
    const existing = collectionMap.get(pid) ?? []
    collectionMap.set(pid, [...existing, String(collect.collection_id)])
  }

  return products.map(p => ({
    id: String(p.id),
    title: p.title,
    images: p.images.map(img => img.src),
    variants: p.variants.map((v): ShopifyVariant => ({
      id: String(v.id),
      title: v.title,
      price: v.price,
    })),
    collectionIds: collectionMap.get(String(p.id)) ?? [],
  }))
}

export async function getCollections(): Promise<ShopifyCollection[]> {
  // Only fetches custom_collections, not smart_collections.
  // This is intentional: WoodyKids only uses custom collections (YAGNI).
  const url = baseUrl()

  // 250 is the Shopify API maximum page size. Pagination is not implemented (future work).
  const res = await fetch(`${url}/custom_collections.json?limit=250`, {
    headers: shopifyHeaders(),
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    throw new Error(`Shopify API error ${res.status}: ${await res.text()}`)
  }

  const { custom_collections }: { custom_collections: ShopifyApiCollection[] } = await res.json()

  if (custom_collections.length === 250) {
    console.warn('Shopify: getCollections returned 250 collections — pagination may be needed')
  }

  return custom_collections.map(c => ({ id: String(c.id), title: c.title }))
}
