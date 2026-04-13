import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock, Download, CheckCircle2, Sparkles, Cpu, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { loadImageFromFile, imageDataToDataURL } from "@/utils/imageUtils";
import { reversibleEmbed, gaOptimizeAsync } from "@/utils/reversible";
import { runAsync } from "@/utils/processing";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { createShareableWatermarkedBlob } from "@/utils/shareablePayload";

interface Props {
  onComplete?: (data: any) => void;
}

export function ReversibleEmbedModule({ onComplete }: Props) {
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [wmFile, setWmFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [wmPreview, setWmPreview] = useState<string | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<any>(null);
  const [alpha, setAlpha] = useState(0.002);
  const [gaRunning, setGaRunning] = useState(false);
  const [gaProgress, setGaProgress] = useState(0);
  const [gaResult, setGaResult] = useState<any>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const resetOutputs = useCallback(() => {
    setResultPreview(null);
    setResult(null);
    setGaResult(null);
    setGaProgress(0);
    setProgress("");
    setDownloadUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  const handleEmbed = useCallback(async () => {
    if (!coverFile || !wmFile) return;
    setProcessing(true);
    setProgress("Loading images...");
    try {
      const [coverData, wmData] = await Promise.all([loadImageFromFile(coverFile), loadImageFromFile(wmFile)]);
      setProgress("Embedding watermark (DWT-SVD)...");
      await new Promise(r => setTimeout(r, 10));
      const embedResult = await new Promise<any>((resolve, reject) => {
        setTimeout(() => {
          try { resolve(reversibleEmbed(coverData, wmData, alpha, 128)); }
          catch (e) { reject(e); }
        }, 20);
      });
      setProgress("Packing exact-share PNG...");
      const shareable = await createShareableWatermarkedBlob(embedResult.watermarkedImageData, coverFile, wmFile, embedResult.alpha);
      const nextDownloadUrl = URL.createObjectURL(shareable.blob);
      setDownloadUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextDownloadUrl;
      });
      const finalResult = {
        ...embedResult,
        recoveryCapable: true,
        originalStorageSize: coverFile.size,
        watermarkStorageSize: wmFile.size,
        packagedFileSize: shareable.outputBytes,
        compressionRatio: shareable.payloadBytes > 0 ? shareable.outputBytes / shareable.payloadBytes : 1,
      };
      setResult(finalResult);
      setResultPreview(imageDataToDataURL(embedResult.watermarkedImageData));
      setProgress("");
      onComplete?.({ ...finalResult, coverImageData: coverData, watermarkImageData: wmData });
    } catch (err) {
      console.error("Embed error:", err);
      setProgress("Error during processing");
    } finally {
      setProcessing(false);
    }
  }, [coverFile, wmFile, alpha, onComplete]);

  const handleGAOptimize = useCallback(async () => {
    if (!coverFile || !wmFile) return;
    setGaRunning(true);
    setGaProgress(0);
    try {
      const [coverData, wmData] = await Promise.all([loadImageFromFile(coverFile), loadImageFromFile(wmFile)]);
      const ga = await gaOptimizeAsync(coverData, wmData, 8, 8, (gen, total) => {
        setGaProgress(Math.round((gen / total) * 100));
      });
      setGaResult(ga);
      setAlpha(ga.bestAlpha);
    } catch (err) {
      console.error("GA error:", err);
    } finally {
      setGaRunning(false);
    }
  }, [coverFile, wmFile]);

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "watermarked_shareable.png";
    a.click();
  };

  const handleDownloadReport = () => {
    if (!result) return;
    const report = [
      "=== WATERMARKING EMBEDDING REPORT ===",
      `Date: ${new Date().toISOString()}`,
      `\n--- Image Dimensions ---`,
      `Width: ${result.dimensions.width}px`,
      `Height: ${result.dimensions.height}px`,
      `\n--- Quality Metrics ---`,
      `PSNR: ${result.psnr?.toFixed(4)} dB`,
      `SNR: ${result.snr?.toFixed(4)} dB`,
      `SSIM: ${result.ssim?.toFixed(6)}`,
      `NCC: ${result.ncc?.toFixed(6)}`,
      `MSE: ${result.mse?.toFixed(6)}`,
      `\n--- Parameters ---`,
      `Alpha (α): ${result.alpha?.toFixed(6)}`,
      `Processing Time: ${result.processingTimeMs?.toFixed(0)} ms`,
      `PSNR Target Met: ${result.psnr >= 40.95 ? 'Yes' : 'No'}`,
      `Exact Recovery Ready: ${result.recoveryCapable ? 'Yes' : 'No'}`,
      `Original File Size: ${result.originalStorageSize} bytes`,
      `Watermark File Size: ${result.watermarkStorageSize} bytes`,
      `Shareable PNG Size: ${result.packagedFileSize || 0} bytes`,
      gaResult ? `\n--- GA Optimization ---\nBest Alpha: ${gaResult.bestAlpha?.toFixed(6)}\nBest PSNR: ${gaResult.bestPSNR?.toFixed(4)} dB\nBest SSIM: ${gaResult.bestSSIM?.toFixed(6)}\nBest SNR: ${gaResult.bestSNR?.toFixed(4)} dB` : '',
      `\n--- Method ---`,
      `Algorithm: 2-Level DWT + SVD (frequency domain)`,
      `Recovery: Exact source files packed inside downloaded PNG`,
      `Optimization: Non-blocking Genetic Algorithm`,
    ].join("\n");
    const blob = new Blob([report], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "embedding_report.txt";
    a.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold font-heading text-foreground mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> Input Images
          </h3>
          <div className="space-y-4">
            <ImageUpload label="Original Image" description="The image to protect (max 20MB)"
              onFileSelect={(f) => { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)); resetOutputs(); }}
              preview={coverPreview}
              onClear={() => { setCoverFile(null); setCoverPreview(null); resetOutputs(); }} />
            <ImageUpload label="Watermark Image" description="Logo or pattern to embed secretly"
              onFileSelect={(f) => { setWmFile(f); setWmPreview(URL.createObjectURL(f)); resetOutputs(); }}
              preview={wmPreview}
              onClear={() => { setWmFile(null); setWmPreview(null); resetOutputs(); }} />
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold font-heading text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" /> Parameters
          </h3>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Alpha (α): <span className="text-accent font-mono">{alpha.toFixed(4)}</span>
            </Label>
            <Slider value={[alpha * 10000]} onValueChange={([v]) => setAlpha(v / 10000)}
              min={10} max={200} step={5} className="mt-1" />
            <p className="text-[10px] text-muted-foreground mt-1">Auto-tuned to keep PSNR ≥ 40.95 dB. Range: 0.001 – 0.02</p>
          </div>

          {/* GA Optimization */}
          <div className="mt-4 pt-4 border-t border-border">
            <Button onClick={handleGAOptimize} disabled={!coverFile || !wmFile || gaRunning || processing}
              variant="outline" className="w-full border-accent/30 text-accent hover:bg-accent/10" size="sm">
              {gaRunning ? (
                <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Optimizing ({gaProgress}%)...</>
              ) : (
                <><Cpu className="w-3.5 h-3.5 mr-2" />GA Auto-Optimize Alpha</>
              )}
            </Button>
            {gaRunning && <Progress value={gaProgress} className="mt-2 h-1.5" />}
            {gaResult && !gaRunning && (
              <div className="mt-2 p-2 rounded-lg bg-accent/5 border border-accent/20 text-[10px] text-accent">
                ✓ Best α = {gaResult.bestAlpha.toFixed(4)} | PSNR = {gaResult.bestPSNR.toFixed(2)}dB | SNR = {gaResult.bestSNR?.toFixed(2)}dB
              </div>
            )}
          </div>
        </div>

        <Button onClick={handleEmbed} disabled={!coverFile || !wmFile || processing}
          className="w-full h-12 text-sm font-heading bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25" size="lg">
          {processing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress || "Processing..."}</>
          ) : (
            <><Lock className="w-4 h-4 mr-2" />Embed Watermark</>
          )}
        </Button>
      </div>

      {/* Right: Results */}
      <div className="space-y-5">
        {!resultPreview && !processing && (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 mb-4 animate-float">
              <Lock className="w-8 h-8 text-primary/40" />
            </div>
            <h3 className="text-sm font-heading text-muted-foreground mb-1">Awaiting Input</h3>
            <p className="text-xs text-muted-foreground/60">Upload both images and click embed to begin</p>
          </div>
        )}

        {processing && (
          <div className="glass-card p-12 flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-sm font-heading text-foreground mb-1">Processing</p>
            <p className="text-xs text-muted-foreground">{progress}</p>
          </div>
        )}

        {resultPreview && result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold font-heading text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                High-Fidelity Watermarked Image
              </h3>
              <img src={resultPreview} alt="Watermarked" className="w-full rounded-xl border border-border bg-muted" />
              <p className="text-[10px] text-muted-foreground mt-3">Download and share this PNG file directly so anyone can extract the exact original and watermark.</p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button onClick={handleDownload} disabled={!downloadUrl} variant="outline" className="border-primary/30 text-primary hover:bg-primary/10" size="sm">
                  <Download className="w-3.5 h-3.5 mr-2" /> Download Image
                </Button>
                <Button onClick={handleDownloadReport} variant="outline" className="border-accent/30 text-accent hover:bg-accent/10" size="sm">
                  <FileText className="w-3.5 h-3.5 mr-2" /> Download Report
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="PSNR" value={result.psnr?.toFixed(2)} unit="dB" good={result.psnr >= 40.95} />
              <MetricCard label="SNR" value={result.snr?.toFixed(2)} unit="dB" good={result.snr >= 40} />
              <MetricCard label="SSIM" value={result.ssim?.toFixed(4)} good={result.ssim > 0.95} />
              <MetricCard label="NCC" value={result.ncc?.toFixed(4)} good={result.ncc > 0.9} />
              <MetricCard label="MSE" value={result.mse?.toFixed(4)} good={result.mse < 10} />
              <MetricCard label="Recovery" value={result.recoveryCapable ? "100%" : "N/A"} good={result.recoveryCapable} />
            </div>

            <div className="glass-card p-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Alpha (α)</span><span className="text-foreground font-mono">{result.alpha?.toFixed(4)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Processing</span><span className="text-foreground font-mono">{result.processingTimeMs?.toFixed(0)}ms</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">PSNR Target</span><span className="text-foreground font-mono">≥ 40.95 dB</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Image Size</span><span className="text-foreground font-mono">{result.dimensions?.width}×{result.dimensions?.height}</span></div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, good }: { label: string; value?: string; unit?: string; good?: boolean }) {
  return (
    <div className="glass-card p-3 flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-bold font-heading ${good ? 'text-success' : 'text-warning'}`}>{value || '—'}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
