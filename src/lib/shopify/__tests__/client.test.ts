import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getProducts, getCollections } from '@/lib/shopify/client'

describe('getProducts', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps Shopify API response to ShopifyProduct[]', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          products: [{
            id: 123,
            title: 'Houten treintje',
            images: [{ src: 'https://cdn.shopify.com/img.jpg' }],
            variants: [{ id: 456, title: 'Standaard', price: '24.95' }],
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          collects: [{ product_id: 123, collection_id: 789 }],
        }),
      } as Response)

    const products = await getProducts()

    expect(products).toHaveLength(1)
    expect(products[0]).toEqual({
      id: '123',
      title: 'Houten treintje',
      images: ['https://cdn.shopify.com/img.jpg'],
      variants: [{ id: '456', title: 'Standaard', price: '24.95' }],
      collectionIds: ['789'],
    })
  })

  it('geeft lege array bij product zonder collectie', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          products: [{ id: 1, title: 'Solo', images: [], variants: [] }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ collects: [] }),
      } as Response)

    const products = await getProducts()
    expect(products[0].collectionIds).toEqual([])
  })
})

describe('getCollections', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps Shopify custom_collections to ShopifyCollection[]', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({
        custom_collections: [
          { id: 10, title: 'Houten speelgoed' },
          { id: 20, title: 'Buitenspeelgoed' },
        ],
      }),
    } as Response)

    const collections = await getCollections()

    expect(collections).toHaveLength(2)
    expect(collections[0]).toEqual({ id: '10', title: 'Houten speelgoed' })
    expect(collections[1]).toEqual({ id: '20', title: 'Buitenspeelgoed' })
  })
})
