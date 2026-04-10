import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Download, Lock, Upload, Settings2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { MetricsPanel } from "./MetricsPanel";
import { AnalyticsCharts } from "./AnalyticsCharts";
import { loadImageFromFile, toGrayscale, fromGrayscale, imageDataToDataURL } from "@/utils/imageUtils";
import { hybridEmbed, getDWTEnergy, getPixelDiffHistogram, type EmbedResult } from "@/utils/watermark";
import { downscaleForProcessing, runAsync } from "@/utils/processing";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function EmbedModule() {
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<EmbedResult | null>(null);

  // Pre-processing controls
  const [jpegQuality, setJpegQuality] = useState(90);
  const [targetResolution, setTargetResolution] = useState("720");
  const [scalingFactor, setScalingFactor] = useState(60);
  const [watermarkOpacity, setWatermarkOpacity] = useState(100);

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

  const resMap: Record<string, number> = { "480": 480, "720": 720, "1080": 1080, "256": 256 };

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

      const maxDim = resMap[targetResolution] || 256;
      const coverGray = downscaleForProcessing(toGrayscale(coverData), Math.min(maxDim, 256));
      const wmGray = downscaleForProcessing(toGrayscale(wmData), 64);

      // Apply opacity to watermark
      if (watermarkOpacity < 100) {
        const factor = watermarkOpacity / 100;
        for (let y = 0; y < wmGray.length; y++)
          for (let x = 0; x < wmGray[0].length; x++)
            wmGray[y][x] = wmGray[y][x] * factor;
      }

      const alpha = scalingFactor / 100 * 0.5; // map 0-100 to 0-0.5
      setProgress("Running GA (pop=20, gen=30) + DWT-SVD...");
      const embedResult = await runAsync(() => hybridEmbed(coverGray, wmGray, alpha));

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
  }, [coverFile, watermarkFile, targetResolution, scalingFactor, watermarkOpacity]);

  const handleDownload = useCallback(() => {
    if (!resultPreview) return;
    const a = document.createElement("a");
    a.href = resultPreview;
    a.download = "watermarked_image.png";
    a.click();
  }, [resultPreview]);

  const dwtEnergy = result ? getDWTEnergy(result.watermarkedImage) : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel - Controls */}
      <div className="space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Upload className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold font-heading text-foreground">Hybrid Image Embedding Engine</h2>
        </div>

        {/* Pre-Processing Controls */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold font-heading uppercase tracking-wider text-muted-foreground">Pre-Processing Controls</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted-foreground">JPEG Quality</span>
                <span className="text-xs font-semibold text-primary">{jpegQuality}%</span>
              </div>
              <Slider value={[jpegQuality]} onValueChange={([v]) => setJpegQuality(v)} min={10} max={100} step={5} className="w-full" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-2">Target Resolution</span>
              <Select value={targetResolution} onValueChange={setTargetResolution}>
                <SelectTrigger className="bg-muted border-border text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="256">256p (Fast)</SelectItem>
                  <SelectItem value="480">480p (SD)</SelectItem>
                  <SelectItem value="720">720p (HD)</SelectItem>
                  <SelectItem value="1080">1080p (FHD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Image Uploads */}
        <ImageUpload label="Original Cover Image" description="Drop cover image here"
          onFileSelect={handleCoverSelect} preview={coverPreview}
          onClear={() => { setCoverFile(null); setCoverPreview(null); setResultPreview(null); setResult(null); }} />

        <ImageUpload label="Watermark Logo" description="Drop logo/signature here"
          onFileSelect={handleWatermarkSelect} preview={watermarkPreview}
          onClear={() => { setWatermarkFile(null); setWatermarkPreview(null); setResultPreview(null); setResult(null); }} />

        {/* Scaling Factor */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scaling Factor (Q)</span>
            <span className="text-sm font-bold text-foreground">{(scalingFactor / 10).toFixed(1)}</span>
          </div>
          <Slider value={[scalingFactor]} onValueChange={([v]) => setScalingFactor(v)} min={1} max={100} step={1} />
          <div className="flex justify-between">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">More Invisible</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">More Robust</span>
          </div>
        </div>

        {/* Watermark Opacity */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Watermark Opacity</span>
            <span className="text-sm font-bold text-accent">{watermarkOpacity}%</span>
          </div>
          <Slider value={[watermarkOpacity]} onValueChange={([v]) => setWatermarkOpacity(v)} min={10} max={100} step={5} />
          <div className="flex justify-between">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Transparent</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Opaque</span>
          </div>
        </div>

        {/* Embed Button */}
        <Button onClick={handleEmbed} disabled={!coverFile || !watermarkFile || processing}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading h-12 text-sm" size="lg">
          {processing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress || "Processing..."}</>
          ) : (
            <><Lock className="w-4 h-4 mr-2" />Embed Watermark</>
          )}
        </Button>
      </div>

      {/* Right Panel - Results */}
      <div className="space-y-5">
        {!resultPreview && !processing ? (
          <div className="h-full min-h-[500px] flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30">
            <div className="p-4 rounded-full bg-muted mb-4">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold font-heading text-muted-foreground mb-1">Awaiting Input</h3>
            <p className="text-xs text-muted-foreground text-center max-w-[240px]">
              Upload your images on the left to begin the intelligent watermarking process.
            </p>
          </div>
        ) : processing ? (
          <div className="h-full min-h-[500px] flex flex-col items-center justify-center rounded-xl border border-border bg-card/30">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <h3 className="text-base font-semibold font-heading text-foreground mb-1">Processing</h3>
            <p className="text-xs text-muted-foreground">{progress || "Please wait..."}</p>
          </div>
        ) : result && resultPreview ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="p-4 rounded-xl border border-border bg-card">
              <h3 className="text-xs font-semibold font-heading uppercase tracking-wider text-muted-foreground mb-3">Watermarked Result</h3>
              <img src={resultPreview} alt="Watermarked" className="w-full rounded-lg border border-border" />
              <Button onClick={handleDownload} variant="outline"
                className="w-full mt-3 border-primary/30 text-primary hover:bg-primary/10">
                <Download className="w-4 h-4 mr-2" /> Download Watermarked Image
              </Button>
            </div>

            <MetricsPanel
              psnr={result.psnr}
              ssim={result.ssim}
              mse={result.mse}
              gaAlpha={result.gaOptimizedAlpha}
              gaPSNR={result.gaPSNR}
              alpha={result.alpha}
              processingTime={result.processingTimeMs}
              dimensions={result.imageDimensions}
            />

            <AnalyticsCharts
              gaHistory={result.gaHistory}
              dwtEnergy={dwtEnergy}
              pixelDiffHistogram={getPixelDiffHistogram(result.watermarkedImage, result.watermarkedImage)}
              alphaSweep={result.alphaSweep}
            />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
