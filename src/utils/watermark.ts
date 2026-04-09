import { dwt2, idwt2, type DWTResult } from "./dwt";
import { svd, svdReconstruct } from "./svd";
import { resizeGray, binarize, calculatePSNR } from "./imageUtils";

// ========== BLIND DWT EMBEDDING ==========

export function blindDwtEmbed(
  coverGray: number[][],
  watermarkGray: number[][],
  alpha: number
): number[][] {
  const coeffs = dwt2(coverGray);
  const wmH = coeffs.LL.length;
  const wmW = coeffs.LL[0].length;
  
  // Resize and binarize watermark to fit LL subband
  const wmResized = binarize(resizeGray(watermarkGray, wmW, wmH));
  
  // Embed in LL subband
  for (let y = 0; y < wmH; y++) {
    for (let x = 0; x < wmW; x++) {
      const wmBit = wmResized[y][x] > 128 ? 1 : 0;
      coeffs.LL[y][x] += alpha * (wmBit * 2 - 1);
    }
  }
  
  return idwt2(coeffs);
}

// ========== BLIND DWT EXTRACTION ==========

export function blindDwtExtract(
  watermarkedGray: number[][],
  originalGray: number[][],
  alpha: number,
  wmWidth: number,
  wmHeight: number
): number[][] {
  const wmCoeffs = dwt2(watermarkedGray);
  const origCoeffs = dwt2(originalGray);
  
  const h = wmCoeffs.LL.length;
  const w = wmCoeffs.LL[0].length;
  
  const extracted: number[][] = [];
  for (let y = 0; y < h; y++) {
    extracted[y] = [];
    for (let x = 0; x < w; x++) {
      const diff = wmCoeffs.LL[y][x] - origCoeffs.LL[y][x];
      extracted[y][x] = diff > 0 ? 255 : 0;
    }
  }
  
  return resizeGray(extracted, wmWidth, wmHeight);
}

// ========== NON-BLIND DWT-SVD EMBEDDING ==========

export function dwtSvdEmbed(
  coverGray: number[][],
  watermarkGray: number[][],
  alpha: number
): { watermarked: number[][]; svdData: { U: number[][]; S: number[]; V: number[][]; rows: number; cols: number } } {
  const coeffs = dwt2(coverGray);
  const llH = coeffs.LL.length;
  const llW = coeffs.LL[0].length;
  
  // SVD of cover LL
  const coverSvd = svd(coeffs.LL);
  
  // Resize watermark to match LL
  const wmResized = resizeGray(watermarkGray, llW, llH);
  const wmSvd = svd(wmResized);
  
  // Modify singular values: S_w = S_cover + alpha * S_watermark
  const modifiedS = coverSvd.S.map((s, i) => {
    const wmS = i < wmSvd.S.length ? wmSvd.S[i] : 0;
    return s + alpha * wmS;
  });
  
  // Reconstruct LL with modified singular values
  const modifiedLL = svdReconstruct({
    U: coverSvd.U,
    S: modifiedS,
    V: coverSvd.V,
    rows: coverSvd.rows,
    cols: coverSvd.cols,
  });
  
  coeffs.LL = modifiedLL;
  
  return {
    watermarked: idwt2(coeffs),
    svdData: { U: coverSvd.U, S: coverSvd.S, V: coverSvd.V, rows: coverSvd.rows, cols: coverSvd.cols },
  };
}

// ========== NON-BLIND DWT-SVD EXTRACTION ==========

export function dwtSvdExtract(
  watermarkedGray: number[][],
  originalGray: number[][],
  alpha: number,
  wmWidth: number,
  wmHeight: number
): number[][] {
  const wmCoeffs = dwt2(watermarkedGray);
  const origCoeffs = dwt2(originalGray);
  
  const wmSvd = svd(wmCoeffs.LL);
  const origSvd = svd(origCoeffs.LL);
  
  // Extract: S_watermark = (S_watermarked - S_original) / alpha
  const extractedS = wmSvd.S.map((s, i) => {
    const origS = i < origSvd.S.length ? origSvd.S[i] : 0;
    return Math.max(0, (s - origS) / alpha);
  });
  
  // Reconstruct extracted watermark
  const extracted = svdReconstruct({
    U: wmSvd.U,
    S: extractedS,
    V: wmSvd.V,
    rows: wmSvd.rows,
    cols: wmSvd.cols,
  });
  
  return resizeGray(
    extracted.map(row => row.map(v => Math.max(0, Math.min(255, v)))),
    wmWidth,
    wmHeight
  );
}

// ========== GENETIC ALGORITHM ==========

interface GAIndividual {
  alpha: number;
  fitness: number;
}

export function geneticAlgorithmOptimize(
  coverGray: number[][],
  watermarkGray: number[][],
  populationSize: number = 12,
  generations: number = 8
): { bestAlpha: number; bestPSNR: number } {
  // Initialize population with random alpha values [0.01, 0.5]
  let population: GAIndividual[] = [];
  for (let i = 0; i < populationSize; i++) {
    const alpha = 0.01 + Math.random() * 0.49;
    population.push({ alpha, fitness: 0 });
  }
  
  // Evaluate fitness (PSNR)
  const evaluate = (ind: GAIndividual) => {
    const watermarked = blindDwtEmbed(coverGray, watermarkGray, ind.alpha);
    ind.fitness = calculatePSNR(coverGray, watermarked);
    return ind;
  };
  
  let best: GAIndividual = { alpha: 0.1, fitness: 0 };
  
  for (let gen = 0; gen < generations; gen++) {
    // Evaluate all
    population = population.map(evaluate);
    
    // Sort by fitness (higher PSNR is better)
    population.sort((a, b) => b.fitness - a.fitness);
    
    // Track best
    if (population[0].fitness > best.fitness) {
      best = { ...population[0] };
    }
    
    // Selection: keep top half
    const survivors = population.slice(0, Math.ceil(populationSize / 2));
    
    // Crossover and mutation
    const newPop: GAIndividual[] = [...survivors];
    while (newPop.length < populationSize) {
      const p1 = survivors[Math.floor(Math.random() * survivors.length)];
      const p2 = survivors[Math.floor(Math.random() * survivors.length)];
      
      // Crossover
      let childAlpha = (p1.alpha + p2.alpha) / 2;
      
      // Mutation (10% chance)
      if (Math.random() < 0.1) {
        childAlpha += (Math.random() - 0.5) * 0.1;
      }
      
      childAlpha = Math.max(0.01, Math.min(0.5, childAlpha));
      newPop.push({ alpha: childAlpha, fitness: 0 });
    }
    
    population = newPop;
  }
  
  return { bestAlpha: best.alpha, bestPSNR: best.fitness };
}

// ========== HYBRID EMBEDDING (DWT blind + DWT-SVD non-blind) ==========

export interface HybridEmbedResult {
  watermarkedImage: number[][];
  blindAlpha: number;
  svdAlpha: number;
  psnr: number;
  gaOptimizedAlpha: number;
  gaPSNR: number;
}

export function hybridEmbed(
  coverGray: number[][],
  watermarkGray: number[][],
  svdAlpha: number = 0.1
): HybridEmbedResult {
  // Step 1: GA optimization for blind DWT alpha
  const gaResult = geneticAlgorithmOptimize(coverGray, watermarkGray);
  
  // Step 2: Blind DWT embedding with GA-optimized alpha
  const blindWatermarked = blindDwtEmbed(coverGray, watermarkGray, gaResult.bestAlpha);
  
  // Step 3: Non-blind DWT-SVD embedding on top
  const { watermarked } = dwtSvdEmbed(blindWatermarked, watermarkGray, svdAlpha);
  
  // Clamp values
  const clamped = watermarked.map(row => row.map(v => Math.max(0, Math.min(255, v))));
  
  const psnr = calculatePSNR(coverGray, clamped);
  
  return {
    watermarkedImage: clamped,
    blindAlpha: gaResult.bestAlpha,
    svdAlpha,
    psnr,
    gaOptimizedAlpha: gaResult.bestAlpha,
    gaPSNR: gaResult.bestPSNR,
  };
}

// ========== HYBRID EXTRACTION ==========

export interface HybridExtractResult {
  extractedWatermark: number[][];
  psnr: number;
}

export function hybridExtract(
  watermarkedGray: number[][],
  originalGray: number[][],
  blindAlpha: number,
  svdAlpha: number,
  wmWidth: number,
  wmHeight: number
): HybridExtractResult {
  // Step 1: DWT-SVD extraction (non-blind)
  const svdExtracted = dwtSvdExtract(watermarkedGray, originalGray, svdAlpha, wmWidth, wmHeight);
  
  // Step 2: Blind DWT extraction
  const blindExtracted = blindDwtExtract(watermarkedGray, originalGray, blindAlpha, wmWidth, wmHeight);
  
  // Combine: average the two extractions
  const combined: number[][] = [];
  for (let y = 0; y < wmHeight; y++) {
    combined[y] = [];
    for (let x = 0; x < wmWidth; x++) {
      const svdVal = y < svdExtracted.length && x < svdExtracted[0].length ? svdExtracted[y][x] : 0;
      const blindVal = y < blindExtracted.length && x < blindExtracted[0].length ? blindExtracted[y][x] : 0;
      combined[y][x] = (svdVal + blindVal) / 2;
    }
  }
  
  const binarized = binarize(combined);
  
  return {
    extractedWatermark: binarized,
    psnr: calculatePSNR(
      binarize(resizeGray(originalGray, wmWidth, wmHeight)),
      binarized
    ),
  };
}
