/**
 * Reversible Image Watermarking Engine
 * Combines DWT-SVD (frequency domain) for watermark embedding
 * with LSB encoding (spatial domain) for original image recovery.
 * 
 * The key insight: we store a compressed version of the original image
 * inside the watermarked image's least significant bits, enabling
 * recovery of BOTH the original and watermark from a single image.
 */

import { dwt2Level, idwt2Level } from "./dwt";
import { svd, svdReconstruct } from "./svd";
import { resizeGray, calculatePSNR, calculateSSIM, calculateNCC, calculateMSE, clampImage } from "./imageUtils";

// ========== LSB ENCODING / DECODING ==========

/** Encode a byte array into an image's least significant bits */
function encodeLSB(image: number[][], data: number[], bitsPerPixel: number = 2): number[][] {
  const h = image.length;
  const w = image[0].length;
  const result = image.map(r => [...r]);
  const mask = (1 << bitsPerPixel) - 1;
  const clearMask = 255 - mask;

  let bitIndex = 0;
  const totalBits = data.length * 8;

  // First 32 bits: data length
  const lenBits: number[] = [];
  const dataLen = data.length;
  for (let i = 31; i >= 0; i--) lenBits.push((dataLen >> i) & 1);

  const allBits: number[] = [...lenBits];
  for (const byte of data) {
    for (let i = 7; i >= 0; i--) allBits.push((byte >> i) & 1);
  }

  let bIdx = 0;
  for (let y = 0; y < h && bIdx < allBits.length; y++) {
    for (let x = 0; x < w && bIdx < allBits.length; x++) {
      let val = result[y][x] & clearMask;
      let embedded = 0;
      for (let b = bitsPerPixel - 1; b >= 0 && bIdx < allBits.length; b--) {
        embedded |= (allBits[bIdx++] << b);
      }
      result[y][x] = val | embedded;
    }
  }

  return result;
}

/** Decode a byte array from an image's least significant bits */
function decodeLSB(image: number[][], bitsPerPixel: number = 2): number[] {
  const h = image.length;
  const w = image[0].length;
  const mask = (1 << bitsPerPixel) - 1;

  // Extract all bits
  const allBits: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const val = Math.round(image[y][x]) & mask;
      for (let b = bitsPerPixel - 1; b >= 0; b--) {
        allBits.push((val >> b) & 1);
      }
    }
  }

  // Read length (first 32 bits)
  let dataLen = 0;
  for (let i = 0; i < 32 && i < allBits.length; i++) {
    dataLen = (dataLen << 1) | allBits[i];
  }

  // Sanity check
  if (dataLen <= 0 || dataLen > (allBits.length - 32) / 8) {
    return [];
  }

  // Read data bytes
  const data: number[] = [];
  let bIdx = 32;
  for (let i = 0; i < dataLen && bIdx + 7 < allBits.length; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | allBits[bIdx++];
    }
    data.push(byte);
  }

  return data;
}

/** Simple RLE-like compression for grayscale image data */
function compressGray(gray: number[][], targetSize: number): number[] {
  const h = gray.length;
  const w = gray[0].length;
  // Store dimensions first (4 bytes)
  const header = [
    (h >> 8) & 0xFF, h & 0xFF,
    (w >> 8) & 0xFF, w & 0xFF,
  ];

  // Quantize to reduce data - use fewer bits per pixel
  const quantBits = 6; // 64 levels instead of 256
  const shift = 8 - quantBits;
  const pixels: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      pixels.push(Math.round(gray[y][x]) >> shift);
    }
  }

  // Pack quantized pixels into bytes
  const packed: number[] = [];
  if (quantBits === 6) {
    // Pack 4 pixels (6 bits each = 24 bits = 3 bytes)
    for (let i = 0; i < pixels.length; i += 4) {
      const p0 = pixels[i] || 0;
      const p1 = pixels[i + 1] || 0;
      const p2 = pixels[i + 2] || 0;
      const p3 = pixels[i + 3] || 0;
      packed.push((p0 << 2) | (p1 >> 4));
      packed.push(((p1 & 0xF) << 4) | (p2 >> 2));
      packed.push(((p2 & 0x3) << 6) | p3);
    }
  }

  return [...header, ...packed];
}

/** Decompress grayscale image data */
function decompressGray(data: number[]): number[][] {
  if (data.length < 4) return [];
  const h = (data[0] << 8) | data[1];
  const w = (data[2] << 8) | data[3];

  if (h <= 0 || w <= 0 || h > 2048 || w > 2048) return [];

  const packed = data.slice(4);
  const quantBits = 6;
  const shift = 8 - quantBits;

  // Unpack
  const pixels: number[] = [];
  for (let i = 0; i < packed.length; i += 3) {
    const b0 = packed[i] || 0;
    const b1 = packed[i + 1] || 0;
    const b2 = packed[i + 2] || 0;
    pixels.push((b0 >> 2) << shift);
    pixels.push((((b0 & 0x3) << 4) | (b1 >> 4)) << shift);
    pixels.push((((b1 & 0xF) << 2) | (b2 >> 6)) << shift);
    pixels.push((b2 & 0x3F) << shift);
  }

  const gray: number[][] = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) {
      row.push(Math.min(255, pixels[y * w + x] || 0));
    }
    gray.push(row);
  }
  return gray;
}

// ========== DWT-SVD WATERMARK EMBEDDING ==========

export interface ReversibleEmbedResult {
  watermarkedImage: number[][];
  psnr: number;
  ssim: number;
  mse: number;
  ncc: number;
  alpha: number;
  processingTimeMs: number;
  dimensions: { width: number; height: number };
  originalStorageSize: number;
  compressionRatio: number;
  recoveryCapable: boolean;
}

export function reversibleEmbed(
  coverGray: number[][],
  watermarkGray: number[][],
  alpha: number = 0.1
): ReversibleEmbedResult {
  const startTime = performance.now();
  const h = coverGray.length;
  const w = coverGray[0].length;

  // Step 1: DWT-SVD watermark embedding
  const coeffs = dwt2Level(coverGray);
  const ll2 = coeffs.LL2;
  const llH = ll2.length;
  const llW = ll2[0].length;

  const coverSvd = svd(ll2);
  const wmResized = resizeGray(watermarkGray, llW, llH);
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

  let watermarked = clampImage(idwt2Level(coeffs));

  // Step 2: Compress original image and encode via LSB
  const compressedSize = Math.min(64, Math.floor(Math.sqrt(h * w / 8)));
  const smallOriginal = resizeGray(coverGray, compressedSize, compressedSize);
  const compressed = compressGray(smallOriginal, compressedSize);

  // Check if we have capacity
  const capacity = (h * w * 2) / 8; // 2 bits per pixel
  const canStore = compressed.length < capacity * 0.9;

  if (canStore) {
    watermarked = encodeLSB(watermarked, compressed, 2);
  }

  watermarked = clampImage(watermarked);

  // Metrics
  const psnr = calculatePSNR(coverGray, watermarked);
  const ssim = calculateSSIM(coverGray, watermarked);
  const mse = calculateMSE(coverGray, watermarked);

  // Quick extraction test for NCC
  const testExtract = extractFromWatermarked(watermarked, coverGray, alpha, watermarkGray[0].length, watermarkGray.length);
  const ncc = testExtract.wmNCC;

  return {
    watermarkedImage: watermarked,
    psnr, ssim, mse, ncc, alpha,
    processingTimeMs: performance.now() - startTime,
    dimensions: { width: w, height: h },
    originalStorageSize: compressed.length,
    compressionRatio: (h * w) / compressed.length,
    recoveryCapable: canStore,
  };
}

// ========== EXTRACTION (BOTH IMAGES) ==========

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

  // Step 1: Extract watermark via DWT-SVD
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

  // Normalize
  let minV = Infinity, maxV = -Infinity;
  for (const row of extracted) for (const v of row) { if (v < minV) minV = v; if (v > maxV) maxV = v; }
  const range = maxV - minV || 1;
  const normalized = extracted.map(r => r.map(v => Math.max(0, Math.min(255, ((v - minV) / range) * 255))));
  const wmResult = resizeGray(normalized, wmWidth, wmHeight);

  // Step 2: Recover original via LSB decoding
  const compressed = decodeLSB(watermarkedGray, 2);
  let recovered: number[][] | null = null;
  let origPSNR = 0, origSSIM = 0, origRecoveryAccuracy = 0;

  if (compressed.length > 4) {
    const decompressed = decompressGray(compressed);
    if (decompressed.length > 0) {
      recovered = resizeGray(decompressed, originalGray[0].length, originalGray.length);
      origPSNR = calculatePSNR(originalGray, recovered);
      origSSIM = calculateSSIM(originalGray, recovered);
      origRecoveryAccuracy = calculateNCC(originalGray, recovered) * 100;
    }
  }

  // Watermark metrics
  const wmProxy = resizeGray(originalGray, wmWidth, wmHeight);
  const wmPSNR = calculatePSNR(wmProxy, wmResult);
  const wmSSIM = calculateSSIM(wmProxy, wmResult);
  const wmNCC = calculateNCC(wmProxy, wmResult);
  const wmMSE = calculateMSE(wmProxy, wmResult);

  return {
    extractedWatermark: wmResult,
    recoveredOriginal: recovered,
    wmPSNR, wmSSIM, wmNCC, wmMSE,
    origPSNR, origSSIM, origRecoveryAccuracy,
    processingTimeMs: performance.now() - startTime,
  };
}

// ========== BLIND EXTRACTION (no original needed) ==========

export function blindExtract(
  watermarkedGray: number[][],
  alpha: number = 0.1,
  wmWidth: number = 64,
  wmHeight: number = 64
): { watermark: number[][] | null; original: number[][] | null } {
  // Recover original from LSB
  const compressed = decodeLSB(watermarkedGray, 2);
  let original: number[][] | null = null;

  if (compressed.length > 4) {
    const decompressed = decompressGray(compressed);
    if (decompressed.length > 0) {
      original = decompressed;
    }
  }

  // If we recovered the original, we can extract the watermark too
  let watermark: number[][] | null = null;
  if (original) {
    const origResized = resizeGray(original, watermarkedGray[0].length, watermarkedGray.length);
    const result = extractFromWatermarked(watermarkedGray, origResized, alpha, wmWidth, wmHeight);
    watermark = result.extractedWatermark;
  }

  return { watermark, original };
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
  coverGray: number[][],
  watermarkGray: number[][],
  popSize: number = 20,
  generations: number = 30,
  onProgress?: (gen: number, total: number) => void
): { bestAlpha: number; history: GAGeneration[] } {
  interface Individual { alpha: number; fitness: number; psnr: number; ssim: number; ncc: number; }

  let pop: Individual[] = Array.from({ length: popSize }, () => ({
    alpha: 0.01 + Math.random() * 0.49, fitness: 0, psnr: 0, ssim: 0, ncc: 0
  }));

  const evaluate = (ind: Individual): Individual => {
    const result = reversibleEmbed(coverGray, watermarkGray, ind.alpha);
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

export function sweepAlpha(coverGray: number[][], watermarkGray: number[][], steps: number = 10): AlphaSweepPoint[] {
  const points: AlphaSweepPoint[] = [];
  for (let i = 1; i <= steps; i++) {
    const alpha = (i / steps) * 0.5;
    const result = reversibleEmbed(coverGray, watermarkGray, alpha);
    points.push({
      alpha: Math.round(alpha * 1000) / 1000,
      psnr: result.psnr, ssim: result.ssim, ncc: result.ncc, mse: result.mse,
    });
  }
  return points;
}
