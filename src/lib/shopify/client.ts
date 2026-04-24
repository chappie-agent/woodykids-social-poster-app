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

const baseUrl = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01`

function shopifyHeaders() {
  return { 'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN! }
}

export async function getProducts(): Promise<ShopifyProduct[]> {
  const [productsRes, collectsRes] = await Promise.all([
    fetch(`${baseUrl}/products.json?limit=250&fields=id,title,images,variants`, {
      headers: shopifyHeaders(),
      next: { revalidate: 300 },
    }),
    fetch(`${baseUrl}/collects.json?limit=250`, {
      headers: shopifyHeaders(),
      next: { revalidate: 300 },
    }),
  ])

  const { products }: { products: ShopifyApiProduct[] } = await productsRes.json()
  const { collects }: { collects: ShopifyApiCollect[] } = await collectsRes.json()

  const collectionMap = new Map<string, string[]>()
  for (const collect of collects) {
    const pid = String(collect.product_id)
    if (!collectionMap.has(pid)) collectionMap.set(pid, [])
    collectionMap.get(pid)!.push(String(collect.collection_id))
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
  const res = await fetch(`${baseUrl}/custom_collections.json?limit=250`, {
    headers: shopifyHeaders(),
    next: { revalidate: 300 },
  })
  const { custom_collections }: { custom_collections: ShopifyApiCollection[] } = await res.json()
  return custom_collections.map(c => ({ id: String(c.id), title: c.title }))
}
