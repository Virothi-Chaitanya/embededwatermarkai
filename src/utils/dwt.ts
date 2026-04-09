// Haar Wavelet DWT implementation with multi-level support

export interface DWTResult {
  LL: number[][];
  LH: number[][];
  HL: number[][];
  HH: number[][];
  originalH: number;
  originalW: number;
}

export interface DWT2LevelResult {
  LL2: number[][];
  LH2: number[][];
  HL2: number[][];
  HH2: number[][];
  LH1: number[][];
  HL1: number[][];
  HH1: number[][];
  level1H: number;
  level1W: number;
  originalH: number;
  originalW: number;
}

// Forward 2D DWT (Haar wavelet) - single level
export function dwt2(image: number[][]): DWTResult {
  const h = image.length;
  const w = image[0].length;
  const evenH = h % 2 === 0 ? h : h - 1;
  const evenW = w % 2 === 0 ? w : w - 1;
  const halfH = evenH / 2;
  const halfW = evenW / 2;

  const LL: number[][] = [];
  const LH: number[][] = [];
  const HL: number[][] = [];
  const HH: number[][] = [];

  for (let y = 0; y < halfH; y++) {
    LL[y] = [];
    LH[y] = [];
    HL[y] = [];
    HH[y] = [];
    for (let x = 0; x < halfW; x++) {
      const a = image[2 * y][2 * x];
      const b = image[2 * y][2 * x + 1];
      const c = image[2 * y + 1][2 * x];
      const d = image[2 * y + 1][2 * x + 1];

      LL[y][x] = (a + b + c + d) / 4;
      LH[y][x] = (a + b - c - d) / 4;
      HL[y][x] = (a - b + c - d) / 4;
      HH[y][x] = (a - b - c + d) / 4;
    }
  }

  return { LL, LH, HL, HH, originalH: h, originalW: w };
}

// Inverse 2D DWT (Haar wavelet)
export function idwt2(coeffs: DWTResult): number[][] {
  const { LL, LH, HL, HH, originalH, originalW } = coeffs;
  const halfH = LL.length;
  const halfW = LL[0].length;

  const result: number[][] = [];
  for (let y = 0; y < originalH; y++) {
    result[y] = new Array(originalW).fill(0);
  }

  for (let y = 0; y < halfH; y++) {
    for (let x = 0; x < halfW; x++) {
      const ll = LL[y][x];
      const lh = LH[y][x];
      const hl = HL[y][x];
      const hh = HH[y][x];

      result[2 * y][2 * x] = ll + lh + hl + hh;
      result[2 * y][2 * x + 1] = ll + lh - hl - hh;
      result[2 * y + 1][2 * x] = ll - lh + hl - hh;
      result[2 * y + 1][2 * x + 1] = ll - lh - hl + hh;
    }
  }

  return result;
}

// 2-level DWT decomposition
export function dwt2Level(image: number[][]): DWT2LevelResult {
  const level1 = dwt2(image);
  const level2 = dwt2(level1.LL);

  return {
    LL2: level2.LL,
    LH2: level2.LH,
    HL2: level2.HL,
    HH2: level2.HH,
    LH1: level1.LH,
    HL1: level1.HL,
    HH1: level1.HH,
    level1H: level1.LL.length,
    level1W: level1.LL[0].length,
    originalH: image.length,
    originalW: image[0].length,
  };
}

// 2-level inverse DWT
export function idwt2Level(coeffs: DWT2LevelResult): number[][] {
  // Reconstruct level 2 → LL1
  const ll1 = idwt2({
    LL: coeffs.LL2,
    LH: coeffs.LH2,
    HL: coeffs.HL2,
    HH: coeffs.HH2,
    originalH: coeffs.level1H,
    originalW: coeffs.level1W,
  });

  // Reconstruct level 1 → original
  return idwt2({
    LL: ll1,
    LH: coeffs.LH1,
    HL: coeffs.HL1,
    HH: coeffs.HH1,
    originalH: coeffs.originalH,
    originalW: coeffs.originalW,
  });
}
