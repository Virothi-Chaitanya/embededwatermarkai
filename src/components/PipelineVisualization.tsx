import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Layers, Grid3X3, Cpu, ArrowRight, CheckCircle2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { loadImageFromFile, toGrayscale, fromGrayscale, imageDataToDataURL, resizeGray } from "@/utils/imageUtils";
import { dwt2Level, idwt2Level } from "@/utils/dwt";
import { svd } from "@/utils/svd";
import { downscaleForProcessing, runAsync } from "@/utils/processing";
import { Loader2 } from "lucide-react";

interface StepData {
  coverPreview: string;
  wmPreview: string;
  dwtBands: { ll: string; lh: string; hl: string; hh: string };
  svdValues: number[];
  embeddedPreview: string;
  reconstructedPreview: string;
}

const steps = [
  { id: 1, label: "Upload Images", icon: Upload, color: "text-primary" },
  { id: 2, label: "DWT Decomposition", icon: Layers, color: "text-accent" },
  { id: 3, label: "SVD Transform", icon: Grid3X3, color: "text-warning" },
  { id: 4, label: "Embedding", icon: Cpu, color: "text-success" },
  { id: 5, label: "Reconstruction", icon: CheckCircle2, color: "text-primary" },
];

function bandToPreview(band: number[][]): string {
  let min = Infinity, max = -Infinity;
  for (const r of band) for (const v of r) { if (v < min) min = v; if (v > max) max = v; }
  const range = max - min || 1;
  const normalized = band.map(r => r.map(v => ((v - min) / range) * 255));
  return imageDataToDataURL(fromGrayscale(normalized));
}

export function PipelineVisualization() {
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [wmFile, setWmFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [wmPreview, setWmPreview] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepData, setStepData] = useState<StepData | null>(null);
  const [processing, setProcessing] = useState(false);

  const runVisualization = async () => {
    if (!coverFile || !wmFile) return;
    setProcessing(true);
    setCurrentStep(1);

    try {
      const [coverData, wmData] = await Promise.all([
        loadImageFromFile(coverFile),
        loadImageFromFile(wmFile),
      ]);

      const coverGray = downscaleForProcessing(toGrayscale(coverData), 256);
      const wmGray = downscaleForProcessing(toGrayscale(wmData), 64);
      await new Promise(r => setTimeout(r, 500));

      // Step 2: DWT
      setCurrentStep(2);
      const coeffs = await runAsync(() => dwt2Level(coverGray));
      const dwtBands = {
        ll: bandToPreview(coeffs.LL2),
        lh: bandToPreview(coeffs.LH1),
        hl: bandToPreview(coeffs.HL1),
        hh: bandToPreview(coeffs.HH1),
      };
      await new Promise(r => setTimeout(r, 600));

      // Step 3: SVD
      setCurrentStep(3);
      const svdResult = await runAsync(() => svd(coeffs.LL2));
      await new Promise(r => setTimeout(r, 600));

      // Step 4: Embedding
      setCurrentStep(4);
      const wmResized = resizeGray(wmGray, coeffs.LL2[0].length, coeffs.LL2.length);
      const wmSvd = await runAsync(() => svd(wmResized));
      const alpha = 0.1;
      const modS = svdResult.S.map((s, i) => s + alpha * (wmSvd.S[i] || 0));
      await new Promise(r => setTimeout(r, 600));

      // Step 5: Reconstruction
      setCurrentStep(5);
      const { svdReconstruct } = await import("@/utils/svd");
      coeffs.LL2 = svdReconstruct({ U: svdResult.U, S: modS, V: svdResult.V, rows: svdResult.rows, cols: svdResult.cols });
      const reconstructed = await runAsync(() => {
        const img = idwt2Level(coeffs);
        return img.map(r => r.map(v => Math.max(0, Math.min(255, v))));
      });

      setStepData({
        coverPreview: coverPreview!,
        wmPreview: wmPreview!,
        dwtBands,
        svdValues: svdResult.S.slice(0, 20),
        embeddedPreview: imageDataToDataURL(fromGrayscale(wmResized)),
        reconstructedPreview: imageDataToDataURL(fromGrayscale(reconstructed)),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                currentStep >= step.id
                  ? 'bg-primary/10 border border-primary/20'
                  : 'opacity-40'
              }`}>
                <step.icon className={`w-4 h-4 ${currentStep >= step.id ? step.color : 'text-muted-foreground'}`} />
                <span className="text-xs font-heading text-foreground hidden md:inline">{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className={`w-4 h-4 mx-2 ${currentStep > step.id ? 'text-primary' : 'text-muted-foreground/30'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Upload section */}
      {currentStep === 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ImageUpload label="Cover Image" description="The host image"
              onFileSelect={(f) => { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)); }}
              preview={coverPreview}
              onClear={() => { setCoverFile(null); setCoverPreview(null); }} />
            <ImageUpload label="Watermark" description="Image to embed"
              onFileSelect={(f) => { setWmFile(f); setWmPreview(URL.createObjectURL(f)); }}
              preview={wmPreview}
              onClear={() => { setWmFile(null); setWmPreview(null); }} />
          </div>
          <Button onClick={runVisualization} disabled={!coverFile || !wmFile}
            className="w-full h-12 font-heading bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
            <Play className="w-4 h-4 mr-2" /> Visualize Pipeline
          </Button>
        </div>
      )}

      {/* Processing */}
      {processing && (
        <div className="glass-card p-8 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm font-heading text-foreground">Running Step {currentStep}: {steps[currentStep - 1]?.label}</p>
        </div>
      )}

      {/* Results per step */}
      {stepData && !processing && (
        <div className="space-y-5">
          {/* DWT Bands */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <h3 className="text-sm font-semibold font-heading text-foreground mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" /> DWT Sub-band Decomposition
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "LL2 (Approx)", src: stepData.dwtBands.ll },
                { label: "LH (Horizontal)", src: stepData.dwtBands.lh },
                { label: "HL (Vertical)", src: stepData.dwtBands.hl },
                { label: "HH (Diagonal)", src: stepData.dwtBands.hh },
              ].map(({ label, src }) => (
                <div key={label} className="text-center">
                  <img src={src} alt={label} className="w-full rounded-lg border border-border bg-muted" />
                  <p className="text-[10px] text-muted-foreground mt-1.5 font-heading">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* SVD Singular Values */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
            <h3 className="text-sm font-semibold font-heading text-foreground mb-3 flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-warning" /> SVD Singular Values (Top 20)
            </h3>
            <div className="flex items-end gap-1 h-32">
              {stepData.svdValues.map((v, i) => {
                const max = Math.max(...stepData.svdValues);
                const height = max > 0 ? (v / max) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-primary to-accent transition-all"
                      style={{ height: `${height}%`, minHeight: 2 }}
                    />
                    <span className="text-[8px] text-muted-foreground">{i + 1}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Final result */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
            <h3 className="text-sm font-semibold font-heading text-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" /> Reconstructed Watermarked Image
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <img src={stepData.coverPreview} alt="Original" className="w-full rounded-lg border border-border" />
                <p className="text-xs text-muted-foreground mt-2 font-heading">Original</p>
              </div>
              <div className="text-center">
                <img src={stepData.embeddedPreview} alt="Watermark" className="w-full rounded-lg border border-border" />
                <p className="text-xs text-muted-foreground mt-2 font-heading">Watermark (resized)</p>
              </div>
              <div className="text-center">
                <img src={stepData.reconstructedPreview} alt="Result" className="w-full rounded-lg border border-border" />
                <p className="text-xs text-muted-foreground mt-2 font-heading">Watermarked Output</p>
              </div>
            </div>
          </motion.div>

          <Button onClick={() => { setCurrentStep(0); setStepData(null); }}
            variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/10">
            Run Again
          </Button>
        </div>
      )}
    </div>
  );
}
