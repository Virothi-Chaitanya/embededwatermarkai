import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Unlock, Download, Image, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { loadImageFromFile, toGrayscale, fromGrayscale, imageDataToDataURL } from "@/utils/imageUtils";
import { extractFromWatermarked, blindExtract } from "@/utils/reversible";
import { downscaleForProcessing, runAsync } from "@/utils/processing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export function ReversibleExtractModule() {
  const [watermarkedFile, setWatermarkedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [watermarkedPreview, setWatermarkedPreview] = useState<string | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [extractedWmPreview, setExtractedWmPreview] = useState<string | null>(null);
  const [recoveredOrigPreview, setRecoveredOrigPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [metrics, setMetrics] = useState<any>(null);
  const [alpha, setAlpha] = useState(0.1);
  const [useBlind, setUseBlind] = useState(false);

  const handleExtract = useCallback(async () => {
    if (!watermarkedFile) return;
    setProcessing(true);
    setProgress("Loading image...");

    try {
      const wmData = await loadImageFromFile(watermarkedFile);
      const wmGray = downscaleForProcessing(toGrayscale(wmData), 256);

      if (originalFile && !useBlind) {
        // Non-blind extraction
        setProgress("Loading original for comparison...");
        const origData = await loadImageFromFile(originalFile);
        const origGray = downscaleForProcessing(toGrayscale(origData), 256);

        setProgress("Extracting watermark (DWT-SVD)...");
        const result = await runAsync(() =>
          extractFromWatermarked(wmGray, origGray, alpha, 64, 64)
        );

        setExtractedWmPreview(imageDataToDataURL(fromGrayscale(result.extractedWatermark)));
        if (result.recoveredOriginal) {
          setRecoveredOrigPreview(imageDataToDataURL(fromGrayscale(result.recoveredOriginal)));
        }
        setMetrics(result);
      } else {
        // Blind extraction
        setProgress("Blind extraction (LSB decoding)...");
        const result = await runAsync(() => blindExtract(wmGray, alpha, 64, 64));

        if (result.original) {
          setRecoveredOrigPreview(imageDataToDataURL(fromGrayscale(result.original)));
        }
        if (result.watermark) {
          setExtractedWmPreview(imageDataToDataURL(fromGrayscale(result.watermark)));
        }
        setMetrics({ blindMode: true, hasOriginal: !!result.original, hasWatermark: !!result.watermark });
      }

      setProgress("");
    } catch (err) {
      console.error("Extraction error:", err);
      setProgress("Error during extraction");
    } finally {
      setProcessing(false);
    }
  }, [watermarkedFile, originalFile, alpha, useBlind]);

  const downloadImage = (dataUrl: string, name: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <div className="glass-card p-4 flex items-center gap-4">
        <button
          onClick={() => setUseBlind(false)}
          className={`flex-1 py-2.5 rounded-xl text-xs font-heading transition-all ${
            !useBlind ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Non-Blind (with original)
        </button>
        <button
          onClick={() => setUseBlind(true)}
          className={`flex-1 py-2.5 rounded-xl text-xs font-heading transition-all ${
            useBlind ? 'bg-accent text-accent-foreground shadow-lg shadow-accent/25' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Blind (watermarked only)
        </button>
      </div>

      {/* Upload */}
      <div className={`grid grid-cols-1 ${!useBlind ? 'md:grid-cols-2' : ''} gap-4`}>
        <ImageUpload
          label="Watermarked Image"
          description="The protected image containing embedded data"
          onFileSelect={(f) => { setWatermarkedFile(f); setWatermarkedPreview(URL.createObjectURL(f)); setExtractedWmPreview(null); setRecoveredOrigPreview(null); setMetrics(null); }}
          preview={watermarkedPreview}
          onClear={() => { setWatermarkedFile(null); setWatermarkedPreview(null); setExtractedWmPreview(null); setRecoveredOrigPreview(null); setMetrics(null); }}
        />
        {!useBlind && (
          <ImageUpload
            label="Original Cover Image"
            description="For non-blind extraction comparison"
            onFileSelect={(f) => { setOriginalFile(f); setOriginalPreview(URL.createObjectURL(f)); }}
            preview={originalPreview}
            onClear={() => { setOriginalFile(null); setOriginalPreview(null); }}
          />
        )}
      </div>

      {/* Alpha */}
      <div className="glass-card p-4">
        <Label className="text-xs text-muted-foreground mb-2 block">
          Alpha (α): <span className="text-accent font-mono">{alpha.toFixed(2)}</span>
          <span className="text-[10px] text-muted-foreground/60 ml-2">— must match the value used during embedding</span>
        </Label>
        <Slider value={[alpha * 100]} onValueChange={([v]) => setAlpha(v / 100)}
          min={1} max={50} step={1} className="mt-1" />
      </div>

      {/* Extract button */}
      <Button
        onClick={handleExtract}
        disabled={!watermarkedFile || processing || (!useBlind && !originalFile)}
        className="w-full h-12 text-sm font-heading bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/25"
        size="lg"
      >
        {processing ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress || "Extracting..."}</>
        ) : (
          <><Unlock className="w-4 h-4 mr-2" />Extract & Recover Both Images</>
        )}
      </Button>

      {/* Results: side by side */}
      {(extractedWmPreview || recoveredOrigPreview) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recovered Original */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold font-heading text-foreground mb-3 flex items-center gap-2">
                {recoveredOrigPreview ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                Recovered Original
              </h3>
              {recoveredOrigPreview ? (
                <>
                  <img src={recoveredOrigPreview} alt="Recovered Original" className="w-full rounded-xl border border-border bg-muted" />
                  <Button onClick={() => downloadImage(recoveredOrigPreview, "recovered_original.png")}
                    variant="outline" className="w-full mt-3 border-success/30 text-success hover:bg-success/10" size="sm">
                    <Download className="w-3.5 h-3.5 mr-2" /> Download Original
                  </Button>
                </>
              ) : (
                <div className="h-48 rounded-xl border border-border bg-muted flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Could not recover — data may be corrupted</p>
                </div>
              )}
            </div>

            {/* Extracted Watermark */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold font-heading text-foreground mb-3 flex items-center gap-2">
                {extractedWmPreview ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                Extracted Watermark
              </h3>
              {extractedWmPreview ? (
                <>
                  <img src={extractedWmPreview} alt="Extracted Watermark" className="w-full rounded-xl border border-border bg-muted" />
                  <Button onClick={() => downloadImage(extractedWmPreview, "extracted_watermark.png")}
                    variant="outline" className="w-full mt-3 border-primary/30 text-primary hover:bg-primary/10" size="sm">
                    <Download className="w-3.5 h-3.5 mr-2" /> Download Watermark
                  </Button>
                </>
              ) : (
                <div className="h-48 rounded-xl border border-border bg-muted flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Watermark extraction requires original image</p>
                </div>
              )}
            </div>
          </div>

          {/* Metrics */}
          {metrics && !metrics.blindMode && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <QuickMetric label="WM PSNR" value={metrics.wmPSNR?.toFixed(2)} unit="dB" />
              <QuickMetric label="WM SSIM" value={metrics.wmSSIM?.toFixed(4)} />
              <QuickMetric label="WM NCC" value={metrics.wmNCC?.toFixed(4)} />
              <QuickMetric label="Recovery %" value={metrics.origRecoveryAccuracy?.toFixed(1)} unit="%" />
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function QuickMetric({ label, value, unit }: { label: string; value?: string; unit?: string }) {
  return (
    <div className="glass-card p-3">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="text-lg font-bold font-heading text-foreground mt-0.5">
        {value || '—'}{unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}
      </div>
    </div>
  );
}
