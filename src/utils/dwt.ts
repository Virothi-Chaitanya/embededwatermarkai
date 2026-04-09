// Simple Haar Wavelet DWT implementation

export interface DWTResult {
  LL: number[][];
  LH: number[][];
  HL: number[][];
  HH: number[][];
  originalH: number;
  originalW: number;
}

// Forward 2D DWT (Haar wavelet) - single level
export function dwt2(image: number[][]): DWTResult {
  const h = image.length;
  const w = image[0].length;
  
  // Ensure even dimensions
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
  const h = originalH;
  const w = originalW;
  
  const result: number[][] = [];
  for (let y = 0; y < h; y++) {
    result[y] = new Array(w).fill(0);
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
