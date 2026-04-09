import { clampImage } from "./imageUtils";

// Gaussian noise
export function addGaussianNoise(gray: number[][], sigma: number = 25): number[][] {
  const h = gray.length;
  const w = gray[0].length;
  const result: number[][] = [];
  for (let y = 0; y < h; y++) {
    result[y] = [];
    for (let x = 0; x < w; x++) {
      // Box-Muller transform
      const u1 = Math.random();
      const u2 = Math.random();
      const noise = sigma * Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
      result[y][x] = gray[y][x] + noise;
    }
  }
  return clampImage(result);
}

// Salt & Pepper noise
export function addSaltPepperNoise(gray: number[][], density: number = 0.05): number[][] {
  const h = gray.length;
  const w = gray[0].length;
  const result = gray.map(r => [...r]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = Math.random();
      if (r < density / 2) result[y][x] = 0;
      else if (r < density) result[y][x] = 255;
    }
  }
  return result;
}

// JPEG compression simulation (DCT-based quality reduction)
export function simulateJPEGCompression(gray: number[][], quality: number = 50): number[][] {
  // Simulate compression by quantizing DCT-like blocks
  const h = gray.length;
  const w = gray[0].length;
  const blockSize = 8;
  const qFactor = (100 - quality) / 100;
  const result = gray.map(r => [...r]);

  for (let by = 0; by < h; by += blockSize) {
    for (let bx = 0; bx < w; bx += blockSize) {
      const endY = Math.min(by + blockSize, h);
      const endX = Math.min(bx + blockSize, w);

      // Calculate block mean and quantize
      let sum = 0, count = 0;
      for (let y = by; y < endY; y++) {
        for (let x = bx; x < endX; x++) {
          sum += result[y][x];
          count++;
        }
      }
      const mean = sum / count;

      for (let y = by; y < endY; y++) {
        for (let x = bx; x < endX; x++) {
          const diff = result[y][x] - mean;
          // Quantize high-frequency components more aggressively
          const quantized = Math.round(diff / (1 + qFactor * 20)) * (1 + qFactor * 20);
          result[y][x] = Math.max(0, Math.min(255, mean + quantized));
        }
      }
    }
  }
  return result;
}

// Rotation (simple nearest-neighbor)
export function rotateImage(gray: number[][], angleDeg: number): number[][] {
  const h = gray.length;
  const w = gray[0].length;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = w / 2;
  const cy = h / 2;

  const result: number[][] = [];
  for (let y = 0; y < h; y++) {
    result[y] = [];
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const srcX = Math.round(dx * cos + dy * sin + cx);
      const srcY = Math.round(-dx * sin + dy * cos + cy);
      if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
        result[y][x] = gray[srcY][srcX];
      } else {
        result[y][x] = 0;
      }
    }
  }
  return result;
}

// Cropping (crop center and pad back to original size)
export function cropImage(gray: number[][], cropPercent: number = 10): number[][] {
  const h = gray.length;
  const w = gray[0].length;
  const cropH = Math.floor(h * cropPercent / 100);
  const cropW = Math.floor(w * cropPercent / 100);

  const result: number[][] = [];
  for (let y = 0; y < h; y++) {
    result[y] = [];
    for (let x = 0; x < w; x++) {
      if (y >= cropH && y < h - cropH && x >= cropW && x < w - cropW) {
        result[y][x] = gray[y][x];
      } else {
        result[y][x] = 0;
      }
    }
  }
  return result;
}

// Median filter (smoothing attack)
export function medianFilter(gray: number[][], kernelSize: number = 3): number[][] {
  const h = gray.length;
  const w = gray[0].length;
  const half = Math.floor(kernelSize / 2);
  const result: number[][] = [];

  for (let y = 0; y < h; y++) {
    result[y] = [];
    for (let x = 0; x < w; x++) {
      const values: number[] = [];
      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const ny = Math.max(0, Math.min(h - 1, y + ky));
          const nx = Math.max(0, Math.min(w - 1, x + kx));
          values.push(gray[ny][nx]);
        }
      }
      values.sort((a, b) => a - b);
      result[y][x] = values[Math.floor(values.length / 2)];
    }
  }
  return result;
}

export type AttackType = "gaussian" | "salt_pepper" | "jpeg" | "rotation" | "crop" | "median";

export interface AttackConfig {
  type: AttackType;
  label: string;
  param: number;
  paramLabel: string;
  min: number;
  max: number;
  step: number;
}

export const ATTACK_CONFIGS: AttackConfig[] = [
  { type: "gaussian", label: "Gaussian Noise", param: 25, paramLabel: "Sigma", min: 5, max: 100, step: 5 },
  { type: "salt_pepper", label: "Salt & Pepper", param: 0.05, paramLabel: "Density", min: 0.01, max: 0.2, step: 0.01 },
  { type: "jpeg", label: "JPEG Compression", param: 50, paramLabel: "Quality", min: 5, max: 95, step: 5 },
  { type: "rotation", label: "Rotation", param: 5, paramLabel: "Angle (°)", min: 1, max: 45, step: 1 },
  { type: "crop", label: "Cropping", param: 10, paramLabel: "Crop %", min: 5, max: 30, step: 5 },
  { type: "median", label: "Median Filter", param: 3, paramLabel: "Kernel Size", min: 3, max: 7, step: 2 },
];

export function applyAttack(gray: number[][], type: AttackType, param: number): number[][] {
  switch (type) {
    case "gaussian": return addGaussianNoise(gray, param);
    case "salt_pepper": return addSaltPepperNoise(gray, param);
    case "jpeg": return simulateJPEGCompression(gray, param);
    case "rotation": return rotateImage(gray, param);
    case "crop": return cropImage(gray, param);
    case "median": return medianFilter(gray, param);
    default: return gray;
  }
}
