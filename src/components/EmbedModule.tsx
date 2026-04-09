import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { MetricsPanel } from "./MetricsPanel";
import { AnalyticsCharts } from "./AnalyticsCharts";
import { loadImageFromFile, toGrayscale, fromGrayscale, imageDataToDataURL, calculateSSIM } from "@/utils/imageUtils";
import { hybridEmbed, type HybridEmbedResult } from "@/utils/watermark";
import { downscaleForProcessing, runAsync } from "@/utils/processing";

export function EmbedModule() {
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<HybridEmbedResult | null>(null);
  const [ssim, setSsim] = useState<number | undefined>();

  const handleCoverSelect = useCallback((file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert("File too large. Max 5MB."); return; }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setResultPreview(null); setResult(null);
  }, []);

  const handleWatermarkSelect = useCallback((file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert("File too large. Max 5MB."); return; }
    setWatermarkFile(file);
    setWatermarkPreview(URL.createObjectURL(file));
    setResultPreview(null); setResult(null);
  }, []);

  const handleEmbed = useCallback(async () => {
    if (!coverFile || !watermarkFile) return;
    setProcessing(true);
    setProgress("Loading images...");

    try {
      const [coverData, wmData] = await Promise.all([
        loadImageFromFile(coverFile),
        loadImageFromFile(watermarkFile),
      ]);

      setProgress("Downscaling for processing...");
      await new Promise(r => setTimeout(r, 30));

      const coverGray = downscaleForProcessing(toGrayscale(coverData), 256);
      const wmGray = downscaleForProcessing(toGrayscale(wmData), 128);

      setProgress("Running Genetic Algorithm + DWT + SVD...");
      const embedResult = await runAsync(() => hybridEmbed(coverGray, wmGray, 0.1));

      setProgress("Computing SSIM...");
      const ssimVal = await runAsync(() => calculateSSIM(coverGray, embedResult.watermarkedImage));
      setSsim(ssimVal);

      const resultImageData = fromGrayscale(embedResult.watermarkedImage);
      setResultPreview(imageDataToDataURL(resultImageData));
      setResult(embedResult);
      setProgress("");
    } catch (err) {
      console.error("Embedding error:", err);
      setProgress("Error during processing");
    } finally {
      setProcessing(false);
    }
  }, [coverFile, watermarkFile]);

  const handleDownload = useCallback(() => {
    if (!resultPreview) return;
    const a = document.createElement("a");
    a.href = resultPreview;
    a.download = "watermarked_image.png";
    a.click();
  }, [resultPreview]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ImageUpload
          label="Cover Image"
          description="The host image to embed the watermark into"
          onFileSelect={handleCoverSelect}
          preview={coverPreview}
          onClear={() => { setCoverFile(null); setCoverPreview(null); setResultPreview(null); setResult(null); }}
        />
        <ImageUpload
          label="Watermark Image"
          description="Binary or grayscale logo/mark to embed"
          onFileSelect={handleWatermarkSelect}
          preview={watermarkPreview}
          onClear={() => { setWatermarkFile(null); setWatermarkPreview(null); setResultPreview(null); setResult(null); }}
        />
      </div>

      <Button
        onClick={handleEmbed}
        disabled={!coverFile || !watermarkFile || processing}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading"
        size="lg"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {progress || "Processing..."}
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            Embed Watermark (Hybrid GA + DWT + SVD)
          </>
        )}
      </Button>

      {resultPreview && result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="p-4 rounded-xl border border-border bg-card">
            <h3 className="text-sm font-semibold font-heading text-foreground mb-3">Watermarked Result</h3>
            <img src={resultPreview} alt="Watermarked" className="w-full rounded-lg border border-border" />
            <Button
              onClick={handleDownload}
              variant="outline"
              className="w-full mt-3 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Watermarked Image
            </Button>
          </div>

          <MetricsPanel
            psnr={result.psnr}
            ssim={ssim}
            gaAlpha={result.gaOptimizedAlpha}
            gaPSNR={result.gaPSNR}
            blindAlpha={result.blindAlpha}
            svdAlpha={result.svdAlpha}
            processingTime={result.processingTimeMs}
            dimensions={result.imageDimensions}
          />

          <AnalyticsCharts
            gaHistory={result.gaHistory}
            dwtEnergy={result.dwtEnergy}
            dwtEnergyWatermarked={result.dwtEnergyWatermarked}
            pixelDiffHistogram={result.pixelDiffHistogram}
          />
        </motion.div>
      )}
    </div>
  );
}
