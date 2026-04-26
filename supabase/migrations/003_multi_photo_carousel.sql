-- Shopify: selectedImageIndex → selectedImageIndices
UPDATE posts
SET source = jsonb_set(
  source - 'selectedImageIndex',
  '{selectedImageIndices}',
  jsonb_build_array(COALESCE((source->>'selectedImageIndex')::int, 0))
)
WHERE source->>'kind' = 'shopify'
  AND source ? 'selectedImageIndex'
  AND NOT source ? 'selectedImageIndices';

-- Upload: mediaUrl → mediaUrls
UPDATE posts
SET source = jsonb_set(
  source - 'mediaUrl',
  '{mediaUrls}',
  jsonb_build_array(source->>'mediaUrl')
)
WHERE source->>'kind' = 'upload'
  AND source ? 'mediaUrl'
  AND NOT source ? 'mediaUrls';
