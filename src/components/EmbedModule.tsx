import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { MetricsPanel } from "./MetricsPanel";
import { loadImageFromFile, toGrayscale, fromGrayscale, imageDataToDataURL, calculateSSIM } from "@/utils/imageUtils";
import { hybridEmbed, type HybridEmbedResult } from "@/utils/watermark";

export function EmbedModule() {
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<HybridEmbedResult | null>(null);
  const [ssim, setSsim] = useState<number | undefined>();

  const handleCoverSelect = useCallback((file: File) => {
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setResultPreview(null);
    setResult(null);
  }, []);

  const handleWatermarkSelect = useCallback((file: File) => {
    setWatermarkFile(file);
    setWatermarkPreview(URL.createObjectURL(file));
    setResultPreview(null);
    setResult(null);
  }, []);

  const handleEmbed = useCallback(async () => {
    if (!coverFile || !watermarkFile) return;
    setProcessing(true);

    try {
      // Use setTimeout to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const coverData = await loadImageFromFile(coverFile);
      const wmData = await loadImageFromFile(watermarkFile);
      
      const coverGray = toGrayscale(coverData);
      const wmGray = toGrayscale(wmData);
      
      const embedResult = hybridEmbed(coverGray, wmGray, 0.1);
      
      const ssimVal = calculateSSIM(coverGray, embedResult.watermarkedImage);
      setSsim(ssimVal);
      
      const resultImageData = fromGrayscale(embedResult.watermarkedImage);
      const dataUrl = imageDataToDataURL(resultImageData);
      
      setResultPreview(dataUrl);
      setResult(embedResult);
    } catch (err) {
      console.error("Embedding error:", err);
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
            Processing with GA + DWT + SVD...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            Embed Watermark (Hybrid)
          </>
        )}
      </Button>

      {resultPreview && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
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

          {result && (
            <MetricsPanel
              psnr={result.psnr}
              ssim={ssim}
              gaAlpha={result.gaOptimizedAlpha}
              gaPSNR={result.gaPSNR}
              blindAlpha={result.blindAlpha}
              svdAlpha={result.svdAlpha}
            />
          )}
        </motion.div>
      )}
    </div>
  );
}
