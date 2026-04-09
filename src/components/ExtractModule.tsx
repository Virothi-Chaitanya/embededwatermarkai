import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Unlock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { MetricsPanel } from "./MetricsPanel";
import { loadImageFromFile, toGrayscale, fromGrayscale, imageDataToDataURL, calculatePSNR, calculateSSIM, calculateNCC, calculateMSE } from "@/utils/imageUtils";
import { extractWatermark } from "@/utils/watermark";
import { downscaleForProcessing, runAsync } from "@/utils/processing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ExtractModule() {
  const [watermarkedFile, setWatermarkedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [watermarkedPreview, setWatermarkedPreview] = useState<string | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [metrics, setMetrics] = useState<{ psnr?: number; ssim?: number; ncc?: number; mse?: number }>({});
  const [alpha, setAlpha] = useState("0.1");
  const [wmSize, setWmSize] = useState("64");

  const handleExtract = useCallback(async () => {
    if (!watermarkedFile || !originalFile) return;
    setProcessing(true);
    setProgress("Loading images...");

    try {
      const [wmData, origData] = await Promise.all([
        loadImageFromFile(watermarkedFile),
        loadImageFromFile(originalFile),
      ]);

      setProgress("Processing...");
      await new Promise(r => setTimeout(r, 30));

      const wmGray = downscaleForProcessing(toGrayscale(wmData), 256);
      const origGray = downscaleForProcessing(toGrayscale(origData), 256);
      const size = parseInt(wmSize) || 64;

      setProgress("Extracting watermark (2-Level DWT-SVD)...");
      const extractResult = await runAsync(() =>
        extractWatermark(wmGray, origGray, parseFloat(alpha) || 0.1, size, size)
      );

      setResultPreview(imageDataToDataURL(fromGrayscale(extractResult.extractedWatermark)));

      setProgress("Computing metrics...");
      const psnr = calculatePSNR(origGray, wmGray);
      const ssim = calculateSSIM(origGray, wmGray);
      const ncc = extractResult.ncc;
      const mse = calculateMSE(origGray, wmGray);
      setMetrics({ psnr, ssim, ncc, mse });
      setProgress("");
    } catch (err) {
      console.error("Extraction error:", err);
      setProgress("Error during extraction");
    } finally {
      setProcessing(false);
    }
  }, [watermarkedFile, originalFile, alpha, wmSize]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ImageUpload label="Watermarked Image" description="The image containing the hidden watermark"
          onFileSelect={(f) => { setWatermarkedFile(f); setWatermarkedPreview(URL.createObjectURL(f)); setResultPreview(null); }}
          preview={watermarkedPreview}
          onClear={() => { setWatermarkedFile(null); setWatermarkedPreview(null); setResultPreview(null); }} />
        <ImageUpload label="Original Cover Image" description="Required for non-blind extraction"
          onFileSelect={(f) => { setOriginalFile(f); setOriginalPreview(URL.createObjectURL(f)); setResultPreview(null); }}
          preview={originalPreview}
          onClear={() => { setOriginalFile(null); setOriginalPreview(null); setResultPreview(null); }} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Alpha (α)</Label>
          <Input value={alpha} onChange={e => setAlpha(e.target.value)} className="bg-muted border-border" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">WM Size (px)</Label>
          <Input value={wmSize} onChange={e => setWmSize(e.target.value)} className="bg-muted border-border" />
        </div>
      </div>

      <Button onClick={handleExtract} disabled={!watermarkedFile || !originalFile || processing}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-heading" size="lg">
        {processing ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress || "Extracting..."}</>
        ) : (
          <><Unlock className="w-4 h-4 mr-2" />Extract Watermark (2-Level DWT-SVD)</>
        )}
      </Button>

      {resultPreview && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-card">
            <h3 className="text-sm font-semibold font-heading text-foreground mb-3">Extracted Watermark</h3>
            <img src={resultPreview} alt="Extracted watermark" className="w-full rounded-lg border border-border bg-muted" />
            <Button onClick={() => {
              if (!resultPreview) return;
              const a = document.createElement("a"); a.href = resultPreview; a.download = "extracted_watermark.png"; a.click();
            }} variant="outline" className="w-full mt-3 border-accent/30 text-accent hover:bg-accent/10">
              <Download className="w-4 h-4 mr-2" /> Download Extracted Watermark
            </Button>
          </div>
          <MetricsPanel psnr={metrics.psnr} ssim={metrics.ssim} ncc={metrics.ncc} mse={metrics.mse} />
        </motion.div>
      )}
    </div>
  );
}
