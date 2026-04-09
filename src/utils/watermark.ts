import { dwt2Level, idwt2Level } from "./dwt";
import { svd, svdReconstruct } from "./svd";
import { resizeGray, calculatePSNR, calculateSSIM, calculateNCC, calculateMSE, clampImage } from "./imageUtils";

// ========== EMBEDDING (2-Level DWT + SVD) ==========

export interface EmbedParams {
  coverU: number[][];
  coverV: number[][];
  wmU: number[][];
  wmV: number[][];
  alpha: number;
  wmRows: number;
  wmCols: number;
}

export interface EmbedResult {
  watermarkedImage: number[][];
  params: EmbedParams;
  psnr: number;
  ssim: number;
  mse: number;
  alpha: number;
  processingTimeMs: number;
  imageDimensions: { width: number; height: number };
  gaHistory: GAGenerationData[];
  gaOptimizedAlpha: number;
  gaPSNR: number;
  alphaSweep: AlphaSweepPoint[];
  dwtBands: DWTBandData;
  svdData: SVDVisualizationData;
}

export interface DWTBandData {
  LL: number[][];
  LH: number[][];
  HL: number[][];
  HH: number[][];
  LL2: number[][];
}

export interface SVDVisualizationData {
  coverSingularValues: number[];
  wmSingularValues: number[];
  modifiedSingularValues: number[];
}

export interface AlphaSweepPoint {
  alpha: number;
  psnr: number;
  ssim: number;
  ncc: number;
  mse: number;
}

function embedWithAlpha(
  coverGray: number[][],
  watermarkGray: number[][],
  alpha: number
): { watermarked: number[][]; params: EmbedParams; svdData: SVDVisualizationData } {
  const coeffs = dwt2Level(coverGray);
  const ll2 = coeffs.LL2;
  const h = ll2.length;
  const w = ll2[0].length;

  // SVD on LL2 sub-band
  const coverSvd = svd(ll2);

  // Resize & SVD on watermark
  const wmResized = resizeGray(watermarkGray, w, h);
  const wmSvd = svd(wmResized);

  // Modify singular values: S' = S + alpha * Sw
  const modifiedS = coverSvd.S.map((s, i) => {
    const sw = i < wmSvd.S.length ? wmSvd.S[i] : 0;
    return s + alpha * sw;
  });

  // Reconstruct LL2' = U * S' * V^T
  coeffs.LL2 = svdReconstruct({
    U: coverSvd.U,
    S: modifiedS,
    V: coverSvd.V,
    rows: coverSvd.rows,
    cols: coverSvd.cols,
  });

  const watermarked = clampImage(idwt2Level(coeffs));

  return {
    watermarked,
    params: {
      coverU: coverSvd.U,
      coverV: coverSvd.V,
      wmU: wmSvd.U,
      wmV: wmSvd.V,
      alpha,
      wmRows: wmSvd.rows,
      wmCols: wmSvd.cols,
    },
    svdData: {
      coverSingularValues: coverSvd.S.slice(0, 20),
      wmSingularValues: wmSvd.S.slice(0, 20),
      modifiedSingularValues: modifiedS.slice(0, 20),
    },
  };
}

// ========== EXTRACTION (2-Level DWT + SVD) ==========

export interface ExtractResult {
  extractedWatermark: number[][];
  psnr: number;
  ssim: number;
  ncc: number;
  mse: number;
}

export function extractWatermark(
  watermarkedGray: number[][],
  originalGray: number[][],
  alpha: number,
  wmWidth: number,
  wmHeight: number
): ExtractResult {
  const wmCoeffs = dwt2Level(watermarkedGray);
  const origCoeffs = dwt2Level(originalGray);

  const wmSvd = svd(wmCoeffs.LL2);
  const origSvd = svd(origCoeffs.LL2);

  // Extract: Sw' = (Sw - S) / alpha
  const extractedS = wmSvd.S.map((s, i) => {
    const origS = i < origSvd.S.length ? origSvd.S[i] : 0;
    return Math.max(0, (s - origS) / alpha);
  });

  // Reconstruct watermark using extracted singular values
  const extracted = svdReconstruct({
    U: wmSvd.U,
    S: extractedS,
    V: wmSvd.V,
    rows: wmSvd.rows,
    cols: wmSvd.cols,
  });

  // Normalize to 0-255 range
  let minV = Infinity, maxV = -Infinity;
  for (const row of extracted) {
    for (const v of row) {
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }
  const range = maxV - minV || 1;
  const normalized = extracted.map(row =>
    row.map(v => Math.max(0, Math.min(255, ((v - minV) / range) * 255)))
  );

  const resized = resizeGray(normalized, wmWidth, wmHeight);

  // Compute metrics against a reference (binarized original watermark proxy)
  const origWmProxy = resizeGray(originalGray, wmWidth, wmHeight);

  return {
    extractedWatermark: resized,
    psnr: calculatePSNR(origWmProxy, resized),
    ssim: calculateSSIM(origWmProxy, resized),
    ncc: calculateNCC(origWmProxy, resized),
    mse: calculateMSE(origWmProxy, resized),
  };
}

// ========== GENETIC ALGORITHM ==========

export interface GAGenerationData {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  bestAlpha: number;
  bestPSNR: number;
  bestSSIM: number;
  bestNCC: number;
}

export interface GAResult {
  bestAlpha: number;
  bestPSNR: number;
  bestSSIM: number;
  bestNCC: number;
  history: GAGenerationData[];
}

interface GAIndividual {
  alpha: number;
  fitness: number;
  psnr: number;
  ssim: number;
  ncc: number;
}

export function geneticAlgorithmOptimize(
  coverGray: number[][],
  watermarkGray: number[][],
  populationSize: number = 20,
  generations: number = 30
): GAResult {
  let population: GAIndividual[] = [];
  for (let i = 0; i < populationSize; i++) {
    population.push({ alpha: 0.01 + Math.random() * 0.49, fitness: 0, psnr: 0, ssim: 0, ncc: 0 });
  }

  const evaluate = (ind: GAIndividual): GAIndividual => {
    const { watermarked } = embedWithAlpha(coverGray, watermarkGray, ind.alpha);
    const psnr = calculatePSNR(coverGray, watermarked);
    const ssim = calculateSSIM(coverGray, watermarked);

    // Quick extraction for NCC
    const extracted = extractWatermark(watermarked, coverGray, ind.alpha, 64, 64);
    const ncc = extracted.ncc;

    // Multi-objective fitness: weighted combination
    // Normalize PSNR (typical range 20-60), SSIM (0-1), NCC (0-1)
    const psnrNorm = Math.min(psnr / 60, 1);
    const fitness = 0.4 * psnrNorm + 0.3 * ssim + 0.3 * ncc;

    return { ...ind, fitness, psnr, ssim, ncc };
  };

  let best: GAIndividual = { alpha: 0.1, fitness: 0, psnr: 0, ssim: 0, ncc: 0 };
  const history: GAGenerationData[] = [];

  for (let gen = 0; gen < generations; gen++) {
    population = population.map(evaluate);
    population.sort((a, b) => b.fitness - a.fitness);

    if (population[0].fitness > best.fitness) {
      best = { ...population[0] };
    }

    const avgFitness = population.reduce((s, p) => s + p.fitness, 0) / population.length;
    history.push({
      generation: gen + 1,
      bestFitness: population[0].fitness,
      avgFitness,
      bestAlpha: population[0].alpha,
      bestPSNR: population[0].psnr,
      bestSSIM: population[0].ssim,
      bestNCC: population[0].ncc,
    });

    // Selection: top 50%
    const survivors = population.slice(0, Math.ceil(populationSize / 2));
    const newPop: GAIndividual[] = [...survivors];

    while (newPop.length < populationSize) {
      const p1 = survivors[Math.floor(Math.random() * survivors.length)];
      const p2 = survivors[Math.floor(Math.random() * survivors.length)];
      let childAlpha = (p1.alpha + p2.alpha) / 2;

      // Mutation
      if (Math.random() < 0.2) {
        childAlpha += (Math.random() - 0.5) * 0.1;
      }
      childAlpha = Math.max(0.01, Math.min(0.5, childAlpha));
      newPop.push({ alpha: childAlpha, fitness: 0, psnr: 0, ssim: 0, ncc: 0 });
    }
    population = newPop;
  }

  return {
    bestAlpha: best.alpha,
    bestPSNR: best.psnr,
    bestSSIM: best.ssim,
    bestNCC: best.ncc,
    history,
  };
}

// ========== ALPHA SWEEP (for PSNR/SSIM/NCC vs Alpha charts) ==========

export function sweepAlpha(
  coverGray: number[][],
  watermarkGray: number[][],
  steps: number = 10
): AlphaSweepPoint[] {
  const points: AlphaSweepPoint[] = [];
  for (let i = 1; i <= steps; i++) {
    const alpha = (i / steps) * 0.5;
    const { watermarked } = embedWithAlpha(coverGray, watermarkGray, alpha);
    const psnr = calculatePSNR(coverGray, watermarked);
    const ssim = calculateSSIM(coverGray, watermarked);
    const mse = calculateMSE(coverGray, watermarked);
    const ext = extractWatermark(watermarked, coverGray, alpha, 64, 64);
    points.push({ alpha: Math.round(alpha * 1000) / 1000, psnr, ssim, ncc: ext.ncc, mse });
  }
  return points;
}

// ========== DWT BAND ENERGY ==========

export interface DWTEnergyData {
  subband: string;
  energy: number;
  percentage: number;
}

export function getDWTEnergy(gray: number[][]): DWTEnergyData[] {
  const coeffs = dwt2Level(gray);
  const calcEnergy = (band: number[][]) => {
    let e = 0;
    for (const row of band) for (const v of row) e += v * v;
    return e;
  };

  const energies: Record<string, number> = {
    LL2: calcEnergy(coeffs.LL2),
    LH2: calcEnergy(coeffs.LH2),
    HL2: calcEnergy(coeffs.HL2),
    HH2: calcEnergy(coeffs.HH2),
    LH1: calcEnergy(coeffs.LH1),
    HL1: calcEnergy(coeffs.HL1),
    HH1: calcEnergy(coeffs.HH1),
  };
  const total = Object.values(energies).reduce((a, b) => a + b, 0);

  return Object.entries(energies).map(([subband, energy]) => ({
    subband,
    energy: Math.round(energy),
    percentage: total > 0 ? Math.round((energy / total) * 10000) / 100 : 0,
  }));
}

// ========== PIXEL DIFFERENCE HISTOGRAM ==========

export interface HistogramBin {
  range: string;
  count: number;
}

export function getPixelDiffHistogram(original: number[][], watermarked: number[][]): HistogramBin[] {
  const bins: Record<string, number> = {
    "0": 0, "0.01-0.1": 0, "0.1-0.5": 0, "0.5-1": 0, "1-2": 0, "2-5": 0, "5+": 0,
  };
  const h = original.length;
  const w = original[0].length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const diff = Math.abs(original[y][x] - watermarked[y][x]);
      if (diff === 0) bins["0"]++;
      else if (diff <= 0.1) bins["0.01-0.1"]++;
      else if (diff <= 0.5) bins["0.1-0.5"]++;
      else if (diff <= 1) bins["0.5-1"]++;
      else if (diff <= 2) bins["1-2"]++;
      else if (diff <= 5) bins["2-5"]++;
      else bins["5+"]++;
    }
  }
  return Object.entries(bins).map(([range, count]) => ({ range, count }));
}

// ========== MAIN EMBED FUNCTION ==========

export function hybridEmbed(
  coverGray: number[][],
  watermarkGray: number[][],
  userAlpha?: number
): EmbedResult {
  const startTime = performance.now();

  // GA optimization
  const gaResult = geneticAlgorithmOptimize(coverGray, watermarkGray, 20, 30);
  const alpha = userAlpha ?? gaResult.bestAlpha;

  // Embed with optimal alpha
  const { watermarked, params, svdData } = embedWithAlpha(coverGray, watermarkGray, alpha);

  // Metrics
  const psnr = calculatePSNR(coverGray, watermarked);
  const ssim = calculateSSIM(coverGray, watermarked);
  const mse = calculateMSE(coverGray, watermarked);

  // Alpha sweep for charts
  const alphaSweep = sweepAlpha(coverGray, watermarkGray, 10);

  // DWT band visualization data
  const coeffs = dwt2Level(coverGray);
  const dwtBands: DWTBandData = {
    LL: coeffs.LL2, // Show level-2 LL
    LH: coeffs.LH1,
    HL: coeffs.HL1,
    HH: coeffs.HH1,
    LL2: coeffs.LL2,
  };

  return {
    watermarkedImage: watermarked,
    params,
    psnr,
    ssim,
    mse,
    alpha,
    processingTimeMs: performance.now() - startTime,
    imageDimensions: { width: coverGray[0].length, height: coverGray.length },
    gaHistory: gaResult.history,
    gaOptimizedAlpha: gaResult.bestAlpha,
    gaPSNR: gaResult.bestPSNR,
    alphaSweep,
    dwtBands,
    svdData,
  };
}

// Re-export for extraction module
export { extractWatermark as hybridExtract };
