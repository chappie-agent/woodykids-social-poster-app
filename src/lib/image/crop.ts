// src/lib/image/crop.ts
//
// Server-side image cropping voor Instagram-feed.
//
// De editor toont de afbeelding in een 4:5 container met `object-cover`,
// gescaled met `cropData.scale` en gepand met `cropData.x`/`cropData.y`
// (fracties van containerafmetingen, transformOrigin: center).
//
// Deze module recreëert exact die transform server-side: het berekent
// welke rechthoek uit de originele afbeelding overeenkomt met wat de
// gebruiker in de editor zag, en cropt + resized naar 1080×1350 jpeg.
//
// Output formaat = 4:5 (0.8) → ruim binnen Instagram's 0.75–1.91 range.

import sharp from 'sharp'
import type { CropData } from '@/lib/types'

const TARGET_W = 1080
const TARGET_H = 1350 // 4:5
const JPEG_QUALITY = 88

/**
 * Bereken de bron-rechthoek (in originele image-coördinaten) die
 * overeenkomt met wat de gebruiker in de editor ziet.
 *
 * Container: virtueel 4:5. We kiezen 1000×1250 voor numerieke stabiliteit;
 * de schaal valt eruit zodra we naar bron-coördinaten converteren.
 */
export function computeSourceCrop(
  imageW: number,
  imageH: number,
  cropData: CropData,
): { left: number; top: number; width: number; height: number } {
  const containerW = 1000
  const containerH = 1250

  // object-cover: schaal zodat het kleinste opvulling krijgt → de andere as overspilt
  const baseScale = Math.max(containerW / imageW, containerH / imageH)
  const totalScale = baseScale * cropData.scale

  const scaledW = imageW * totalScale
  const scaledH = imageH * totalScale

  // Image-positie in container (transformOrigin: center, dan translate)
  const imgLeft = (containerW - scaledW) / 2 + cropData.x * containerW
  const imgTop = (containerH - scaledH) / 2 + cropData.y * containerH

  // Visible region in scaled image-coördinaten → terug naar originele
  let sourceX = -imgLeft / totalScale
  let sourceY = -imgTop / totalScale
  let sourceW = containerW / totalScale
  let sourceH = containerH / totalScale

  // Clamp binnen image-bounds (sharp.extract crasht anders)
  if (sourceX < 0) {
    sourceW += sourceX
    sourceX = 0
  }
  if (sourceY < 0) {
    sourceH += sourceY
    sourceY = 0
  }
  if (sourceX + sourceW > imageW) sourceW = imageW - sourceX
  if (sourceY + sourceH > imageH) sourceH = imageH - sourceY

  return {
    left: Math.max(0, Math.round(sourceX)),
    top: Math.max(0, Math.round(sourceY)),
    width: Math.max(1, Math.round(sourceW)),
    height: Math.max(1, Math.round(sourceH)),
  }
}

/**
 * Fetch een image-URL, pas de user-crop toe, resize naar 1080×1350 en
 * geef de jpeg-buffer terug.
 */
export async function cropImageFromUrl(
  url: string,
  cropData: CropData,
): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch ${res.status} for ${url}`)
  const arrayBuffer = await res.arrayBuffer()
  const inputBuffer = Buffer.from(arrayBuffer)

  const meta = await sharp(inputBuffer).metadata()
  if (!meta.width || !meta.height) {
    throw new Error(`Geen afmetingen voor ${url}`)
  }

  const region = computeSourceCrop(meta.width, meta.height, cropData)

  return await sharp(inputBuffer)
    .rotate() // EXIF orientation
    .extract(region)
    .resize(TARGET_W, TARGET_H, { fit: 'fill' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()
}
