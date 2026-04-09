import { dwt2, idwt2 } from "./dwt";
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
  const wmResized = binarize(resizeGray(watermarkGray, wmW, wmH));

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
  _alpha: number,
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
): { watermarked: number[][] } {
  const coeffs = dwt2(coverGray);
  const llH = coeffs.LL.length;
  const llW = coeffs.LL[0].length;

  const coverSvd = svd(coeffs.LL);
  const wmResized = resizeGray(watermarkGray, llW, llH);
  const wmSvd = svd(wmResized);

  const modifiedS = coverSvd.S.map((s, i) => {
    const wmS = i < wmSvd.S.length ? wmSvd.S[i] : 0;
    return s + alpha * wmS;
  });

  coeffs.LL = svdReconstruct({
    U: coverSvd.U,
    S: modifiedS,
    V: coverSvd.V,
    rows: coverSvd.rows,
    cols: coverSvd.cols,
  });

  return { watermarked: idwt2(coeffs) };
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

  const extractedS = wmSvd.S.map((s, i) => {
    const origS = i < origSvd.S.length ? origSvd.S[i] : 0;
    return Math.max(0, (s - origS) / alpha);
  });

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

// ========== GENETIC ALGORITHM WITH TRACKING ==========

export interface GAGenerationData {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  bestAlpha: number;
}

export interface GAResult {
  bestAlpha: number;
  bestPSNR: number;
  history: GAGenerationData[];
}

interface GAIndividual {
  alpha: number;
  fitness: number;
}

export function geneticAlgorithmOptimize(
  coverGray: number[][],
  watermarkGray: number[][],
  populationSize: number = 10,
  generations: number = 6
): GAResult {
  let population: GAIndividual[] = [];
  for (let i = 0; i < populationSize; i++) {
    population.push({ alpha: 0.01 + Math.random() * 0.49, fitness: 0 });
  }

  const evaluate = (ind: GAIndividual) => {
    const watermarked = blindDwtEmbed(coverGray, watermarkGray, ind.alpha);
    ind.fitness = calculatePSNR(coverGray, watermarked);
    return ind;
  };

  let best: GAIndividual = { alpha: 0.1, fitness: 0 };
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
    });

    const survivors = population.slice(0, Math.ceil(populationSize / 2));
    const newPop: GAIndividual[] = [...survivors];
    while (newPop.length < populationSize) {
      const p1 = survivors[Math.floor(Math.random() * survivors.length)];
      const p2 = survivors[Math.floor(Math.random() * survivors.length)];
      let childAlpha = (p1.alpha + p2.alpha) / 2;
      if (Math.random() < 0.15) childAlpha += (Math.random() - 0.5) * 0.1;
      childAlpha = Math.max(0.01, Math.min(0.5, childAlpha));
      newPop.push({ alpha: childAlpha, fitness: 0 });
    }
    population = newPop;
  }

  return { bestAlpha: best.alpha, bestPSNR: best.fitness, history };
}

// ========== DWT COEFFICIENT ENERGY (for visualization) ==========

export interface DWTEnergyData {
  subband: string;
  energy: number;
  percentage: number;
}

export function getDWTEnergy(gray: number[][]): DWTEnergyData[] {
  const coeffs = dwt2(gray);
  const calcEnergy = (band: number[][]) => {
    let e = 0;
    for (const row of band) for (const v of row) e += v * v;
    return e;
  };

  const energies = {
    LL: calcEnergy(coeffs.LL),
    LH: calcEnergy(coeffs.LH),
    HL: calcEnergy(coeffs.HL),
    HH: calcEnergy(coeffs.HH),
  };
  const total = energies.LL + energies.LH + energies.HL + energies.HH;

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

// ========== HYBRID EMBEDDING ==========

export interface HybridEmbedResult {
  watermarkedImage: number[][];
  blindAlpha: number;
  svdAlpha: number;
  psnr: number;
  gaOptimizedAlpha: number;
  gaPSNR: number;
  gaHistory: GAGenerationData[];
  dwtEnergy: DWTEnergyData[];
  dwtEnergyWatermarked: DWTEnergyData[];
  pixelDiffHistogram: HistogramBin[];
  processingTimeMs: number;
  imageDimensions: { width: number; height: number };
}

export function hybridEmbed(
  coverGray: number[][],
  watermarkGray: number[][],
  svdAlpha: number = 0.1
): HybridEmbedResult {
  const startTime = performance.now();

  const gaResult = geneticAlgorithmOptimize(coverGray, watermarkGray);
  const blindWatermarked = blindDwtEmbed(coverGray, watermarkGray, gaResult.bestAlpha);
  const { watermarked } = dwtSvdEmbed(blindWatermarked, watermarkGray, svdAlpha);
  const clamped = watermarked.map(row => row.map(v => Math.max(0, Math.min(255, v))));

  const psnr = calculatePSNR(coverGray, clamped);
  const dwtEnergy = getDWTEnergy(coverGray);
  const dwtEnergyWatermarked = getDWTEnergy(clamped);
  const pixelDiffHistogram = getPixelDiffHistogram(coverGray, clamped);

  return {
    watermarkedImage: clamped,
    blindAlpha: gaResult.bestAlpha,
    svdAlpha,
    psnr,
    gaOptimizedAlpha: gaResult.bestAlpha,
    gaPSNR: gaResult.bestPSNR,
    gaHistory: gaResult.history,
    dwtEnergy,
    dwtEnergyWatermarked,
    pixelDiffHistogram,
    processingTimeMs: performance.now() - startTime,
    imageDimensions: { width: coverGray[0].length, height: coverGray.length },
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
  const svdExtracted = dwtSvdExtract(watermarkedGray, originalGray, svdAlpha, wmWidth, wmHeight);
  const blindExtracted = blindDwtExtract(watermarkedGray, originalGray, blindAlpha, wmWidth, wmHeight);

  const combined: number[][] = [];
  for (let y = 0; y < wmHeight; y++) {
    combined[y] = [];
    for (let x = 0; x < wmWidth; x++) {
      const svdVal = y < svdExtracted.length && x < svdExtracted[0].length ? svdExtracted[y][x] : 0;
      const blindVal = y < blindExtracted.length && x < blindExtracted[0].length ? blindExtracted[y][x] : 0;
      combined[y][x] = (svdVal + blindVal) / 2;
    }
  }

  return {
    extractedWatermark: binarize(combined),
    psnr: calculatePSNR(
      binarize(resizeGray(originalGray, wmWidth, wmHeight)),
      binarize(combined)
    ),
  };
}
