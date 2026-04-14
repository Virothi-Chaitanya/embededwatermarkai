import { describe, expect, it } from "vitest";
import { reversibleEmbed } from "@/utils/reversible";

function createGradientImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      data[index] = Math.round((x / Math.max(width - 1, 1)) * 255);
      data[index + 1] = Math.round((y / Math.max(height - 1, 1)) * 255);
      data[index + 2] = Math.round((((x + y) / Math.max(width + height - 2, 1)) * 255));
      data[index + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
}

function createPatternImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const value = (x * 17 + y * 31) % 256;
      data[index] = value;
      data[index + 1] = 255 - value;
      data[index + 2] = (value * 3) % 256;
      data[index + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
}

describe("reversibleEmbed", () => {
  it("keeps simulated PSNR in the high-fidelity range", () => {
    const cover = createGradientImage(96, 96);
    const watermark = createPatternImage(32, 32);
    const result = reversibleEmbed(cover, watermark, 0.002, 64);

    expect(result.watermarkedImageData.width).toBe(96);
    expect(result.watermarkedImageData.height).toBe(96);
    expect(result.psnr).toBeGreaterThan(40);
    expect(result.psnr).toBeLessThan(50.5);
    expect(result.snr).toBeGreaterThan(40);
  });
});