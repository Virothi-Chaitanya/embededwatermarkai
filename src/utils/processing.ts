// Downscale image for fast processing
export function downscaleForProcessing(gray: number[][], maxDim: number = 256): number[][] {
  const h = gray.length;
  const w = gray[0].length;
  if (h <= maxDim && w <= maxDim) return gray;

  const scale = maxDim / Math.max(h, w);
  const newH = Math.floor(h * scale);
  const newW = Math.floor(w * scale);

  const result: number[][] = [];
  for (let y = 0; y < newH; y++) {
    result[y] = [];
    for (let x = 0; x < newW; x++) {
      result[y][x] = gray[Math.min(Math.floor(y / scale), h - 1)][Math.min(Math.floor(x / scale), w - 1)];
    }
  }
  return result;
}

// Run heavy function asynchronously (yields to UI between chunks)
export function runAsync<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (e) {
        reject(e);
      }
    }, 50);
  });
}
