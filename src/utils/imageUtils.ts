// Load image from File to ImageData
export async function loadImageFromFile(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Convert ImageData to grayscale 2D array
export function toGrayscale(imageData: ImageData): number[][] {
  const { width, height, data } = imageData;
  const gray: number[][] = [];
  for (let y = 0; y < height; y++) {
    gray[y] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      gray[y][x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  }
  return gray;
}

// Convert grayscale 2D array to ImageData
export function fromGrayscale(gray: number[][]): ImageData {
  const height = gray.length;
  const width = gray[0].length;
  const imageData = new ImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = Math.max(0, Math.min(255, Math.round(gray[y][x])));
      imageData.data[i] = v;
      imageData.data[i + 1] = v;
      imageData.data[i + 2] = v;
      imageData.data[i + 3] = 255;
    }
  }
  return imageData;
}

// Split ImageData into R, G, B channels (each a 2D array)
export function splitRGB(imageData: ImageData): { r: number[][]; g: number[][]; b: number[][] } {
  const { width, height, data } = imageData;
  const r: number[][] = [], g: number[][] = [], b: number[][] = [];
  for (let y = 0; y < height; y++) {
    r[y] = []; g[y] = []; b[y] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      r[y][x] = data[i];
      g[y][x] = data[i + 1];
      b[y][x] = data[i + 2];
    }
  }
  return { r, g, b };
}

// Merge R, G, B channels back into ImageData
export function mergeRGB(r: number[][], g: number[][], b: number[][]): ImageData {
  const height = r.length;
  const width = r[0].length;
  const imageData = new ImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      imageData.data[i] = Math.max(0, Math.min(255, Math.round(r[y][x])));
      imageData.data[i + 1] = Math.max(0, Math.min(255, Math.round(g[y][x])));
      imageData.data[i + 2] = Math.max(0, Math.min(255, Math.round(b[y][x])));
      imageData.data[i + 3] = 255;
    }
  }
  return imageData;
}

// Resize a full-color ImageData using canvas (preserves color)
export function resizeImageData(imageData: ImageData, targetW: number, targetH: number): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);
  
  const canvas2 = document.createElement("canvas");
  canvas2.width = targetW;
  canvas2.height = targetH;
  const ctx2 = canvas2.getContext("2d")!;
  ctx2.drawImage(canvas, 0, 0, targetW, targetH);
  return ctx2.getImageData(0, 0, targetW, targetH);
}

// Convert ImageData to data URL
export function imageDataToDataURL(imageData: ImageData): string {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

// Bilinear interpolation resize for better quality
export function resizeGray(gray: number[][], targetW: number, targetH: number): number[][] {
  const srcH = gray.length;
  const srcW = gray[0].length;
  if (srcH === targetH && srcW === targetW) return gray.map(r => [...r]);
  
  const result: number[][] = [];
  for (let y = 0; y < targetH; y++) {
    result[y] = [];
    for (let x = 0; x < targetW; x++) {
      const srcX = (x / targetW) * srcW;
      const srcY = (y / targetH) * srcH;
      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);
      const fx = srcX - x0;
      const fy = srcY - y0;
      result[y][x] =
        gray[y0][x0] * (1 - fx) * (1 - fy) +
        gray[y0][x1] * fx * (1 - fy) +
        gray[y1][x0] * (1 - fx) * fy +
        gray[y1][x1] * fx * fy;
    }
  }
  return result;
}

// Binarize grayscale image (threshold at 128)
export function binarize(gray: number[][]): number[][] {
  return gray.map(row => row.map(v => (v > 128 ? 255 : 0)));
}

// Calculate MSE
export function calculateMSE(original: number[][], modified: number[][]): number {
  const h = original.length;
  const w = original[0].length;
  let mse = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const diff = original[y][x] - modified[y][x];
      mse += diff * diff;
    }
  }
  return mse / (h * w);
}

// Calculate PSNR
export function calculatePSNR(original: number[][], modified: number[][]): number {
  const mse = calculateMSE(original, modified);
  if (mse === 0) return Infinity;
  return 10 * Math.log10((255 * 255) / mse);
}

// Calculate SSIM
export function calculateSSIM(original: number[][], modified: number[][]): number {
  const h = original.length;
  const w = original[0].length;
  const n = h * w;

  let meanX = 0, meanY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      meanX += original[y][x];
      meanY += modified[y][x];
    }
  }
  meanX /= n;
  meanY /= n;

  let varX = 0, varY = 0, covXY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = original[y][x] - meanX;
      const dy = modified[y][x] - meanY;
      varX += dx * dx;
      varY += dy * dy;
      covXY += dx * dy;
    }
  }
  varX /= n;
  varY /= n;
  covXY /= n;

  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;

  return ((2 * meanX * meanY + C1) * (2 * covXY + C2)) /
         ((meanX ** 2 + meanY ** 2 + C1) * (varX + varY + C2));
}

// Calculate NCC (Normalized Cross-Correlation)
export function calculateNCC(original: number[][], extracted: number[][]): number {
  const h = Math.min(original.length, extracted.length);
  const w = Math.min(original[0].length, extracted[0].length);
  
  let meanA = 0, meanB = 0;
  const n = h * w;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      meanA += original[y][x];
      meanB += extracted[y][x];
    }
  }
  meanA /= n;
  meanB /= n;
  
  let num = 0, denA = 0, denB = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = original[y][x] - meanA;
      const b = extracted[y][x] - meanB;
      num += a * b;
      denA += a * a;
      denB += b * b;
    }
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

// Clamp image values to 0-255
export function clampImage(gray: number[][]): number[][] {
  return gray.map(row => row.map(v => Math.max(0, Math.min(255, v))));
}
