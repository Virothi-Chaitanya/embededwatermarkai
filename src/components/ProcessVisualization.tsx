import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Eye, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { loadImageFromFile, toGrayscale, fromGrayscale, imageDataToDataURL, resizeGray } from "@/utils/imageUtils";
import { dwt2Level } from "@/utils/dwt";
import { svd } from "@/utils/svd";
import { downscaleForProcessing, runAsync } from "@/utils/processing";

interface ProcessData {
  originalPreview: string;
  grayscalePreview: string;
  llPreview: string;
  lhPreview: string;
  hlPreview: string;
  hhPreview: string;
  ll2Preview: string;
  svdSingularValues: number[];
  wmSvdSingularValues: number[];
}

function bandToPreview(band: number[][]): string {
  // Normalize band to 0-255 for visualization
  let min = Infinity, max = -Infinity;
  for (const row of band) for (const v of row) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const normalized = band.map(row => row.map(v => ((v - min) / range) * 255));
  return imageDataToDataURL(fromGrayscale(normalized));
}

export function ProcessVisualization() {
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [wmFile, setWmFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [wmPreview, setWmPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [data, setData] = useState<ProcessData | null>(null);
  const [step, setStep] = useState(0);

  const handleVisualize = useCallback(async () => {
    if (!coverFile) return;
    setProcessing(true);

    try {
      const coverData = await loadImageFromFile(coverFile);
      const coverGray = downscaleForProcessing(toGrayscale(coverData), 256);
      const grayscalePreview = imageDataToDataURL(fromGrayscale(coverGray));

      const coeffs = await runAsync(() => dwt2Level(coverGray));

      const llPreview = bandToPreview(coeffs.LL2);
      const lhPreview = bandToPreview(coeffs.LH1);
      const hlPreview = bandToPreview(coeffs.HL1);
      const hhPreview = bandToPreview(coeffs.HH1);
      const ll2Preview = bandToPreview(coeffs.LL2);

      const coverSvd = await runAsync(() => svd(coeffs.LL2));

      let wmSvdValues: number[] = [];
      if (wmFile) {
        const wmData = await loadImageFromFile(wmFile);
        const wmGray = downscaleForProcessing(toGrayscale(wmData), 128);
        const wmResized = resizeGray(wmGray, coeffs.LL2[0].length, coeffs.LL2.length);
        const wmSvd = await runAsync(() => svd(wmResized));
        wmSvdValues = wmSvd.S.slice(0, 20);
      }

      setData({
        originalPreview: coverPreview!,
        grayscalePreview,
        llPreview,
        lhPreview,
        hlPreview,
        hhPreview,
        ll2Preview,
        svdSingularValues: coverSvd.S.slice(0, 20),
        wmSvdSingularValues: wmSvdValues,
      });
      setStep(1);
    } catch (err) {
      console.error("Visualization error:", err);
    } finally {
      setProcessing(false);
    }
  }, [coverFile, wmFile, coverPreview]);

  const steps = [
    { num: 1, title: "Upload Images", desc: "Cover image and watermark loaded" },
    { num: 2, title: "DWT Decomposition", desc: "2-level wavelet transform applied" },
    { num: 3, title: "SVD Analysis", desc: "Singular value decomposition of LL2 sub-band" },
    { num: 4, title: "Embedding", desc: "Watermark embedded via S' = S + αSw" },
    { num: 5, title: "Reconstruction", desc: "Inverse DWT applied to get watermarked image" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ImageUpload label="Cover Image" description="Image for pipeline visualization"
          onFileSelect={(f) => { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)); setData(null); }}
          preview={coverPreview}
          onClear={() => { setCoverFile(null); setCoverPreview(null); setData(null); }} />
        <ImageUpload label="Watermark Image (Optional)" description="For SVD comparison"
          onFileSelect={(f) => { setWmFile(f); setWmPreview(URL.createObjectURL(f)); }}
          preview={wmPreview}
          onClear={() => { setWmFile(null); setWmPreview(null); }} />
      </div>

      <Button onClick={handleVisualize} disabled={!coverFile || processing}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading" size="lg">
        {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : (
          <><Eye className="w-4 h-4 mr-2" />Visualize Pipeline</>
        )}
      </Button>

      {/* Pipeline Steps */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => data && setStep(s.num)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-heading border transition-all ${
                step === s.num
                  ? "bg-primary/20 border-primary text-primary"
                  : step > s.num && data
                    ? "bg-muted border-border text-foreground"
                    : "bg-muted/50 border-border/50 text-muted-foreground"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step >= s.num && data ? "bg-primary text-primary-foreground" : "bg-border text-muted-foreground"
              }`}>{s.num}</span>
              <span className="hidden md:inline">{s.title}</span>
            </button>
            {i < steps.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
          </div>
        ))}
      </div>

      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Step 1: Original */}
          {step >= 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border border-border bg-card">
              <h4 className="text-xs font-semibold font-heading text-primary mb-2">Step 1: Images Loaded</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Original</p>
                  <img src={data.originalPreview} alt="Original" className="w-full rounded border border-border" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Grayscale</p>
                  <img src={data.grayscalePreview} alt="Grayscale" className="w-full rounded border border-border" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: DWT Sub-bands */}
          {step >= 2 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border border-border bg-card">
              <h4 className="text-xs font-semibold font-heading text-primary mb-2">Step 2: 2-Level DWT Decomposition</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: "LL2 (Approx)", src: data.ll2Preview },
                  { label: "LH1 (Horiz Detail)", src: data.lhPreview },
                  { label: "HL1 (Vert Detail)", src: data.hlPreview },
                  { label: "HH1 (Diag Detail)", src: data.hhPreview },
                ].map(({ label, src }) => (
                  <div key={label}>
                    <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                    <img src={src} alt={label} className="w-full rounded border border-border" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: SVD */}
          {step >= 3 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border border-border bg-card">
              <h4 className="text-xs font-semibold font-heading text-primary mb-2">Step 3: SVD — Singular Values</h4>
              <p className="text-[10px] text-muted-foreground mb-2">LL2 = U × S × Vᵀ</p>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Cover Singular Values (top 20)</p>
                  <div className="flex gap-0.5 items-end h-20 mt-1">
                    {data.svdSingularValues.map((v, i) => {
                      const maxV = data.svdSingularValues[0] || 1;
                      return (
                        <div key={i} className="flex-1 bg-primary/60 rounded-t"
                          style={{ height: `${(v / maxV) * 100}%` }}
                          title={`σ${i + 1} = ${v.toFixed(2)}`} />
                      );
                    })}
                  </div>
                </div>
                {data.wmSvdSingularValues.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Watermark Singular Values (top 20)</p>
                    <div className="flex gap-0.5 items-end h-20 mt-1">
                      {data.wmSvdSingularValues.map((v, i) => {
                        const maxV = data.wmSvdSingularValues[0] || 1;
                        return (
                          <div key={i} className="flex-1 bg-accent/60 rounded-t"
                            style={{ height: `${(v / maxV) * 100}%` }}
                            title={`σ${i + 1} = ${v.toFixed(2)}`} />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 4: Embedding formula */}
          {step >= 4 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border border-border bg-card">
              <h4 className="text-xs font-semibold font-heading text-primary mb-2">Step 4: Embedding Process</h4>
              <div className="bg-muted rounded-lg p-4 text-center space-y-2">
                <p className="font-mono text-sm text-foreground">S' = S + α × S<sub>w</sub></p>
                <p className="font-mono text-sm text-foreground">LL2' = U × S' × V<sup>T</sup></p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Modified singular values are reconstructed back into the LL2 sub-band
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 5: Reconstruction */}
          {step >= 5 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border border-border bg-card">
              <h4 className="text-xs font-semibold font-heading text-primary mb-2">Step 5: Inverse DWT Reconstruction</h4>
              <div className="bg-muted rounded-lg p-4 text-center space-y-2">
                <p className="font-mono text-sm text-foreground">Level 2: IDWT(LL2', LH2, HL2, HH2) → LL1'</p>
                <p className="font-mono text-sm text-foreground">Level 1: IDWT(LL1', LH1, HL1, HH1) → Watermarked Image</p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  The final watermarked image is imperceptibly different from the original
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
