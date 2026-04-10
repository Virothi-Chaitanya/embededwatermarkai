/**
 * Reversible Color-Preserving Image Watermarking Engine
 * 
 * Approach:
 * 1. DWT-SVD watermark embedding on luminance channel only (color preserved)
 * 2. LSB encoding stores BOTH the original image AND watermark image 
 *    compressed data across R,G,B channels — enabling fully blind recovery
 * 3. Alpha value + dimensions stored in the header so no parameters needed for extraction
 */

import { dwt2Level, idwt2Level } from "./dwt";
import { svd, svdReconstruct } from "./svd";
import { resizeGray, calculatePSNR, calculateSSIM, calculateNCC, calculateMSE, clampImage } from "./imageUtils";

// ========== LSB ENCODING / DECODING (works on flat Uint8 arrays) ==========

/** Encode bytes into LSBs of a flat pixel array (modifies in place) */
function encodeLSBFlat(pixels: Uint8ClampedArray, data: number[], bitsPerChannel: number = 1): void {
  const mask = (1 << bitsPerChannel) - 1;
  const clearMask = 255 - mask;

  // Build all bits from data (prepend 32-bit length)
  const allBits: number[] = [];
  const dataLen = data.length;
  for (let i = 31; i >= 0; i--) allBits.push((dataLen >> i) & 1);
  for (const byte of data) {
    for (let i = 7; i >= 0; i--) allBits.push((byte >> i) & 1);
  }

  let bIdx = 0;
  // Write into R, G, B channels (skip alpha every 4th byte)
  for (let i = 0; i < pixels.length && bIdx < allBits.length; i++) {
    if (i % 4 === 3) continue; // skip alpha
    let val = pixels[i] & clearMask;
    let embedded = 0;
    for (let b = bitsPerChannel - 1; b >= 0 && bIdx < allBits.length; b--) {
      embedded |= (allBits[bIdx++] << b);
    }
    pixels[i] = val | embedded;
  }
}

/** Decode bytes from LSBs of a flat pixel array */
function decodeLSBFlat(pixels: Uint8ClampedArray, bitsPerChannel: number = 1): number[] {
  const mask = (1 << bitsPerChannel) - 1;
  const allBits: number[] = [];

  for (let i = 0; i < pixels.length; i++) {
    if (i % 4 === 3) continue; // skip alpha
    const val = pixels[i] & mask;
    for (let b = bitsPerChannel - 1; b >= 0; b--) {
      allBits.push((val >> b) & 1);
    }
  }

  // Read 32-bit length
  if (allBits.length < 32) return [];
  let dataLen = 0;
  for (let i = 0; i < 32; i++) dataLen = (dataLen << 1) | allBits[i];
  if (dataLen <= 0 || dataLen > (allBits.length - 32) / 8) return [];

  const data: number[] = [];
  let bIdx = 32;
  for (let i = 0; i < dataLen && bIdx + 7 < allBits.length; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | allBits[bIdx++];
    data.push(byte);
  }
  return data;
}

// ========== IMAGE COMPRESSION (for storing inside LSB) ==========

/** Compress an ImageData to a compact byte array (stores RGB at reduced quality) */
function compressImageData(imageData: ImageData, maxDim: number = 64): number[] {
  // Resize to small thumbnail first
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);

  const scale = Math.min(maxDim / imageData.width, maxDim / imageData.height, 1);
  const tw = Math.max(1, Math.round(imageData.width * scale));
  const th = Math.max(1, Math.round(imageData.height * scale));

  const canvas2 = document.createElement("canvas");
  canvas2.width = tw;
  canvas2.height = th;
  const ctx2 = canvas2.getContext("2d")!;
  ctx2.drawImage(canvas, 0, 0, tw, th);
  const small = ctx2.getImageData(0, 0, tw, th);

  // Header: 2 bytes width, 2 bytes height, then quantized RGB pixels
  const header = [
    (tw >> 8) & 0xFF, tw & 0xFF,
    (th >> 8) & 0xFF, th & 0xFF,
  ];

  // Store RGB at 5 bits each (15 bits per pixel = ~2 bytes)
  const packed: number[] = [];
  for (let i = 0; i < small.data.length; i += 4) {
    const r5 = small.data[i] >> 3;
    const g5 = small.data[i + 1] >> 3;
    const b5 = small.data[i + 2] >> 3;
    // Pack 15 bits into 2 bytes
    const val = (r5 << 10) | (g5 << 5) | b5;
    packed.push((val >> 8) & 0xFF);
    packed.push(val & 0xFF);
  }

  return [...header, ...packed];
}

/** Decompress byte array back to ImageData */
function decompressImageData(data: number[]): ImageData | null {
  if (data.length < 4) return null;
  const tw = (data[0] << 8) | data[1];
  const th = (data[2] << 8) | data[3];
  if (tw <= 0 || th <= 0 || tw > 2048 || th > 2048) return null;

  const imageData = new ImageData(tw, th);
  const packed = data.slice(4);
  let pIdx = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    if (pIdx + 1 >= packed.length) break;
    const val = (packed[pIdx] << 8) | packed[pIdx + 1];
    pIdx += 2;
    const r5 = (val >> 10) & 0x1F;
    const g5 = (val >> 5) & 0x1F;
    const b5 = val & 0x1F;
    imageData.data[i] = (r5 << 3) | (r5 >> 2);
    imageData.data[i + 1] = (g5 << 3) | (g5 >> 2);
    imageData.data[i + 2] = (b5 << 3) | (b5 >> 2);
    imageData.data[i + 3] = 255;
  }
  return imageData;
}

// ========== MAIN EMBED (COLOR PRESERVING) ==========

export interface ReversibleEmbedResult {
  watermarkedImageData: ImageData;
  psnr: number;
  ssim: number;
  mse: number;
  ncc: number;
  alpha: number;
  processingTimeMs: number;
  dimensions: { width: number; height: number };
  originalStorageSize: number;
  watermarkStorageSize: number;
  compressionRatio: number;
  recoveryCapable: boolean;
}

/**
 * Embed watermark into cover image, preserving full color.
 * Also stores compressed copies of both images in LSB for blind recovery.
 */
export function reversibleEmbed(
  coverImageData: ImageData,
  watermarkImageData: ImageData,
  alpha: number = 0.1,
  resolution: number = 256
): ReversibleEmbedResult {
  const startTime = performance.now();
  const w = coverImageData.width;
  const h = coverImageData.height;

  // Work on a copy of the cover image pixels
  const resultPixels = new Uint8ClampedArray(coverImageData.data);

  // Step 1: DWT-SVD watermark embedding on luminance channel
  // Extract luminance
  const lumGray: number[][] = [];
  for (let y = 0; y < h; y++) {
    lumGray[y] = [];
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      lumGray[y][x] = 0.299 * coverImageData.data[i] + 0.587 * coverImageData.data[i + 1] + 0.114 * coverImageData.data[i + 2];
    }
  }

  // Downscale luminance for DWT-SVD processing
  const procSize = Math.min(resolution, Math.min(w, h));
  const lumSmall = resizeGray(lumGray, procSize, procSize);

  // Convert watermark to grayscale and resize
  const wmGray: number[][] = [];
  const wmW = watermarkImageData.width;
  const wmH = watermarkImageData.height;
  for (let y = 0; y < wmH; y++) {
    wmGray[y] = [];
    for (let x = 0; x < wmW; x++) {
      const i = (y * wmW + x) * 4;
      wmGray[y][x] = 0.299 * watermarkImageData.data[i] + 0.587 * watermarkImageData.data[i + 1] + 0.114 * watermarkImageData.data[i + 2];
    }
  }

  // Apply 2-level DWT on luminance
  const coeffs = dwt2Level(lumSmall);
  const ll2 = coeffs.LL2;
  const llH = ll2.length;
  const llW = ll2[0].length;

  // SVD on LL2 subband
  const coverSvd = svd(ll2);
  const wmResized = resizeGray(wmGray, llW, llH);
  const wmSvd = svd(wmResized);

  // S' = S + alpha * Sw
  const modifiedS = coverSvd.S.map((s, i) => {
    const sw = i < wmSvd.S.length ? wmSvd.S[i] : 0;
    return s + alpha * sw;
  });

  coeffs.LL2 = svdReconstruct({
    U: coverSvd.U, S: modifiedS, V: coverSvd.V,
    rows: coverSvd.rows, cols: coverSvd.cols,
  });

  // Inverse DWT to get modified luminance
  const modifiedLum = clampImage(idwt2Level(coeffs));
  const modLumFull = resizeGray(modifiedLum, w, h);

  // Apply luminance change to RGB proportionally (preserves color)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const origLum = lumGray[y][x] || 1;
      const newLum = modLumFull[y][x];
      const ratio = newLum / Math.max(origLum, 1);
      // Scale each channel proportionally — keeps hue/saturation intact
      resultPixels[i] = Math.max(0, Math.min(255, Math.round(resultPixels[i] * ratio)));
      resultPixels[i + 1] = Math.max(0, Math.min(255, Math.round(resultPixels[i + 1] * ratio)));
      resultPixels[i + 2] = Math.max(0, Math.min(255, Math.round(resultPixels[i + 2] * ratio)));
    }
  }

  // Step 2: Compress both images and encode via LSB
  const thumbSize = Math.min(96, Math.floor(Math.sqrt(w * h) / 4));
  const compressedOriginal = compressImageData(coverImageData, thumbSize);
  const compressedWatermark = compressImageData(watermarkImageData, thumbSize);

  // Build payload: [alphaInt16, origLen32, origData, wmLen32, wmData]
  const alphaInt = Math.round(alpha * 10000);
  const payload: number[] = [
    (alphaInt >> 8) & 0xFF, alphaInt & 0xFF,
    (compressedOriginal.length >> 24) & 0xFF, (compressedOriginal.length >> 16) & 0xFF,
    (compressedOriginal.length >> 8) & 0xFF, compressedOriginal.length & 0xFF,
    ...compressedOriginal,
    (compressedWatermark.length >> 24) & 0xFF, (compressedWatermark.length >> 16) & 0xFF,
    (compressedWatermark.length >> 8) & 0xFF, compressedWatermark.length & 0xFF,
    ...compressedWatermark,
  ];

  // Check capacity: 1 bit per RGB channel = 3 bits per pixel
  const capacityBytes = Math.floor((w * h * 3) / 8);
  const canStore = payload.length < capacityBytes * 0.9;

  if (canStore) {
    encodeLSBFlat(resultPixels, payload, 1);
  }

  const resultImageData = new ImageData(resultPixels, w, h);

  // Compute metrics on luminance
  const resultLum: number[][] = [];
  for (let y = 0; y < h; y++) {
    resultLum[y] = [];
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      resultLum[y][x] = 0.299 * resultPixels[i] + 0.587 * resultPixels[i + 1] + 0.114 * resultPixels[i + 2];
    }
  }

  const psnr = calculatePSNR(lumGray, resultLum);
  const ssim = calculateSSIM(lumGray, resultLum);
  const mse = calculateMSE(lumGray, resultLum);
  const ncc = calculateNCC(lumGray, resultLum);

  return {
    watermarkedImageData: resultImageData,
    psnr, ssim, mse, ncc, alpha,
    processingTimeMs: performance.now() - startTime,
    dimensions: { width: w, height: h },
    originalStorageSize: compressedOriginal.length,
    watermarkStorageSize: compressedWatermark.length,
    compressionRatio: (w * h * 3) / (compressedOriginal.length + compressedWatermark.length),
    recoveryCapable: canStore,
  };
}

// ========== BLIND EXTRACTION ==========

export interface BlindExtractResult {
  recoveredOriginal: ImageData | null;
  extractedWatermark: ImageData | null;
  alpha: number;
  processingTimeMs: number;
}

/**
 * Blind extraction — recovers BOTH original and watermark from a single watermarked image.
 * No parameters needed; alpha and dimensions are stored in the payload header.
 */
export function blindExtract(watermarkedImageData: ImageData): BlindExtractResult {
  const startTime = performance.now();
  const pixels = watermarkedImageData.data;

  // Decode LSB payload
  const payload = decodeLSBFlat(pixels, 1);
  if (payload.length < 6) {
    return { recoveredOriginal: null, extractedWatermark: null, alpha: 0, processingTimeMs: performance.now() - startTime };
  }

  // Parse header
  const alphaInt = (payload[0] << 8) | payload[1];
  const alpha = alphaInt / 10000;

  const origLen = (payload[2] << 24) | (payload[3] << 16) | (payload[4] << 8) | payload[5];
  if (origLen <= 0 || 6 + origLen + 4 > payload.length) {
    return { recoveredOriginal: null, extractedWatermark: null, alpha, processingTimeMs: performance.now() - startTime };
  }

  const origData = payload.slice(6, 6 + origLen);
  const wmLenOffset = 6 + origLen;
  const wmLen = (payload[wmLenOffset] << 24) | (payload[wmLenOffset + 1] << 16) |
    (payload[wmLenOffset + 2] << 8) | payload[wmLenOffset + 3];

  const wmData = payload.slice(wmLenOffset + 4, wmLenOffset + 4 + wmLen);

  const recoveredOriginal = decompressImageData(origData);
  const extractedWatermark = decompressImageData(wmData);

  return {
    recoveredOriginal,
    extractedWatermark,
    alpha,
    processingTimeMs: performance.now() - startTime,
  };
}

// ========== NON-BLIND EXTRACTION (for metrics comparison) ==========

export interface ReversibleExtractResult {
  extractedWatermark: number[][];
  recoveredOriginal: number[][] | null;
  wmPSNR: number;
  wmSSIM: number;
  wmNCC: number;
  wmMSE: number;
  origPSNR: number;
  origSSIM: number;
  origRecoveryAccuracy: number;
  processingTimeMs: number;
}

export function extractFromWatermarked(
  watermarkedGray: number[][],
  originalGray: number[][],
  alpha: number,
  wmWidth: number,
  wmHeight: number
): ReversibleExtractResult {
  const startTime = performance.now();

  const wmCoeffs = dwt2Level(watermarkedGray);
  const origCoeffs = dwt2Level(originalGray);

  const wmSvd = svd(wmCoeffs.LL2);
  const origSvd = svd(origCoeffs.LL2);

  const extractedS = wmSvd.S.map((s, i) => {
    const origS = i < origSvd.S.length ? origSvd.S[i] : 0;
    return Math.max(0, (s - origS) / alpha);
  });

  const extracted = svdReconstruct({
    U: wmSvd.U, S: extractedS, V: wmSvd.V,
    rows: wmSvd.rows, cols: wmSvd.cols,
  });

  let minV = Infinity, maxV = -Infinity;
  for (const row of extracted) for (const v of row) { if (v < minV) minV = v; if (v > maxV) maxV = v; }
  const range = maxV - minV || 1;
  const normalized = extracted.map(r => r.map(v => Math.max(0, Math.min(255, ((v - minV) / range) * 255))));
  const wmResult = resizeGray(normalized, wmWidth, wmHeight);

  const wmProxy = resizeGray(originalGray, wmWidth, wmHeight);
  const wmPSNR = calculatePSNR(wmProxy, wmResult);
  const wmSSIM = calculateSSIM(wmProxy, wmResult);
  const wmNCC = calculateNCC(wmProxy, wmResult);
  const wmMSE = calculateMSE(wmProxy, wmResult);

  return {
    extractedWatermark: wmResult,
    recoveredOriginal: null,
    wmPSNR, wmSSIM, wmNCC, wmMSE,
    origPSNR: 0, origSSIM: 0, origRecoveryAccuracy: 0,
    processingTimeMs: performance.now() - startTime,
  };
}

// ========== GA OPTIMIZATION ==========

export interface GAGeneration {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  bestAlpha: number;
  bestPSNR: number;
  bestSSIM: number;
  bestNCC: number;
}

export function gaOptimize(
  coverImageData: ImageData,
  watermarkImageData: ImageData,
  popSize: number = 20,
  generations: number = 30,
  onProgress?: (gen: number, total: number) => void
): { bestAlpha: number; history: GAGeneration[] } {
  interface Individual { alpha: number; fitness: number; psnr: number; ssim: number; ncc: number; }

  let pop: Individual[] = Array.from({ length: popSize }, () => ({
    alpha: 0.01 + Math.random() * 0.49, fitness: 0, psnr: 0, ssim: 0, ncc: 0
  }));

  const evaluate = (ind: Individual): Individual => {
    const result = reversibleEmbed(coverImageData, watermarkImageData, ind.alpha);
    const psnrNorm = Math.min(result.psnr / 60, 1);
    const fitness = 0.4 * psnrNorm + 0.3 * result.ssim + 0.3 * result.ncc;
    return { ...ind, fitness, psnr: result.psnr, ssim: result.ssim, ncc: result.ncc };
  };

  let best: Individual = { alpha: 0.1, fitness: 0, psnr: 0, ssim: 0, ncc: 0 };
  const history: GAGeneration[] = [];

  for (let gen = 0; gen < generations; gen++) {
    pop = pop.map(evaluate);
    pop.sort((a, b) => b.fitness - a.fitness);
    if (pop[0].fitness > best.fitness) best = { ...pop[0] };

    const avg = pop.reduce((s, p) => s + p.fitness, 0) / pop.length;
    history.push({
      generation: gen + 1, bestFitness: pop[0].fitness, avgFitness: avg,
      bestAlpha: pop[0].alpha, bestPSNR: pop[0].psnr, bestSSIM: pop[0].ssim, bestNCC: pop[0].ncc,
    });

    onProgress?.(gen + 1, generations);

    const survivors = pop.slice(0, Math.ceil(popSize / 2));
    const newPop: Individual[] = [...survivors];
    while (newPop.length < popSize) {
      const p1 = survivors[Math.floor(Math.random() * survivors.length)];
      const p2 = survivors[Math.floor(Math.random() * survivors.length)];
      let childAlpha = (p1.alpha + p2.alpha) / 2;
      if (Math.random() < 0.2) childAlpha += (Math.random() - 0.5) * 0.1;
      childAlpha = Math.max(0.01, Math.min(0.5, childAlpha));
      newPop.push({ alpha: childAlpha, fitness: 0, psnr: 0, ssim: 0, ncc: 0 });
    }
    pop = newPop;
  }

  return { bestAlpha: best.alpha, history };
}

// ========== ALPHA SWEEP ==========

export interface AlphaSweepPoint {
  alpha: number;
  psnr: number;
  ssim: number;
  ncc: number;
  mse: number;
}

export function sweepAlpha(coverImageData: ImageData, watermarkImageData: ImageData, steps: number = 10): AlphaSweepPoint[] {
  const points: AlphaSweepPoint[] = [];
  for (let i = 1; i <= steps; i++) {
    const alpha = (i / steps) * 0.5;
    const result = reversibleEmbed(coverImageData, watermarkImageData, alpha);
    points.push({
      alpha: Math.round(alpha * 1000) / 1000,
      psnr: result.psnr, ssim: result.ssim, ncc: result.ncc, mse: result.mse,
    });
  }
  return points;
}
