import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { dwt2 } from "@/utils/dwt";
import { toGrayscale, imageDataToDataURL, fromGrayscale } from "@/utils/imageUtils";
import { downscaleForProcessing } from "@/utils/processing";

interface Props {
  imageData: ImageData | null;
  psnr?: number;
  ssim?: number;
  alpha?: number;
}

function subbandToImageURL(band: number[][]): string {
  const h = band.length;
  const w = band[0].length;
  let min = Infinity, max = -Infinity;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (band[y][x] < min) min = band[y][x];
      if (band[y][x] > max) max = band[y][x];
    }
  const range = max - min || 1;
  const normalized: number[][] = [];
  for (let y = 0; y < h; y++) {
    normalized[y] = [];
    for (let x = 0; x < w; x++) {
      normalized[y][x] = Math.round(((band[y][x] - min) / range) * 255);
    }
  }
  return imageDataToDataURL(fromGrayscale(normalized));
}

export function DWTSubbandAnalysis({ imageData, psnr, ssim, alpha }: Props) {
  const subbands = useMemo(() => {
    if (!imageData) return null;
    const gray = toGrayscale(imageData);
    const small = downscaleForProcessing(gray, 256);
    const { LL, LH, HL, HH } = dwt2(small);
    return {
      ll: subbandToImageURL(LL),
      lh: subbandToImageURL(LH),
      hl: subbandToImageURL(HL),
      hh: subbandToImageURL(HH),
    };
  }, [imageData]);

  if (!subbands) return null;

  const bands = [
    { label: "LOW-LOW (LL)", sub: "APPROXIMATION", src: subbands.ll },
    { label: "LOW-HIGH (LH)", sub: "HORIZONTAL DETAILS", src: subbands.lh },
    { label: "HIGH-LOW (HL)", sub: "VERTICAL DETAILS", src: subbands.hl },
    { label: "HIGH-HIGH (HH)", sub: "DIAGONAL DETAILS", src: subbands.hh },
  ];

  return (
    <div className="space-y-5">
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold font-heading text-foreground mb-5 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          DWT Sub-band Analysis
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {bands.map((b) => (
            <div key={b.label} className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                {b.label}
              </span>
              <img
                src={b.src}
                alt={b.label}
                className="w-full aspect-square rounded-lg border border-border bg-muted object-cover"
              />
              <span className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-wider">
                {b.sub}
              </span>
            </div>
          ))}
        </div>
      </div>

      {(psnr !== undefined || ssim !== undefined || alpha !== undefined) && (
        <div className="grid grid-cols-3 gap-3">
          {psnr !== undefined && (
            <div className="glass-card p-4 flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">PSNR</span>
              <span className="text-2xl font-bold font-heading text-primary">
                {psnr.toFixed(2)} <span className="text-xs text-muted-foreground font-normal">dB</span>
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">Peak Signal to Noise</span>
            </div>
          )}
          {ssim !== undefined && (
            <div className="glass-card p-4 flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">SSIM</span>
              <span className="text-2xl font-bold font-heading text-primary">
                {ssim.toFixed(4)}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">Structural Similarity</span>
            </div>
          )}
          {alpha !== undefined && (
            <div className="glass-card p-4 flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">STEP (Q)</span>
              <span className="text-2xl font-bold font-heading text-accent">
                {(alpha * 1000).toFixed(2)}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">GA Optimized Key</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
