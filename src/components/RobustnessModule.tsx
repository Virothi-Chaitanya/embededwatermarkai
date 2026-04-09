import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { MetricsPanel } from "./MetricsPanel";
import { Slider } from "@/components/ui/slider";
import { loadImageFromFile, toGrayscale, fromGrayscale, imageDataToDataURL, calculatePSNR, calculateSSIM, calculateNCC, calculateMSE } from "@/utils/imageUtils";
import { extractWatermark } from "@/utils/watermark";
import { applyAttack, ATTACK_CONFIGS, type AttackType } from "@/utils/attacks";
import { downscaleForProcessing, runAsync } from "@/utils/processing";

interface AttackResult {
  type: string;
  attackedPreview: string;
  extractedPreview: string;
  psnr: number;
  ssim: number;
  ncc: number;
  mse: number;
}

export function RobustnessModule() {
  const [watermarkedFile, setWatermarkedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [watermarkedPreview, setWatermarkedPreview] = useState<string | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<AttackResult[]>([]);
  const [selectedAttack, setSelectedAttack] = useState<AttackType>("gaussian");
  const [attackParam, setAttackParam] = useState(25);
  const [alpha, setAlpha] = useState("0.1");

  const config = ATTACK_CONFIGS.find(c => c.type === selectedAttack)!;

  const handleTest = useCallback(async () => {
    if (!watermarkedFile || !originalFile) return;
    setProcessing(true);
    setProgress("Loading images...");

    try {
      const [wmData, origData] = await Promise.all([
        loadImageFromFile(watermarkedFile),
        loadImageFromFile(originalFile),
      ]);

      const wmGray = downscaleForProcessing(toGrayscale(wmData), 256);
      const origGray = downscaleForProcessing(toGrayscale(origData), 256);
      const a = parseFloat(alpha) || 0.1;

      setProgress(`Applying ${config.label}...`);
      const attacked = await runAsync(() => applyAttack(wmGray, selectedAttack, attackParam));
      const attackedPreview = imageDataToDataURL(fromGrayscale(attacked));

      setProgress("Extracting watermark from attacked image...");
      const ext = await runAsync(() => extractWatermark(attacked, origGray, a, 64, 64));
      const extractedPreview = imageDataToDataURL(fromGrayscale(ext.extractedWatermark));

      // Also compute cover vs attacked metrics
      const psnr = calculatePSNR(wmGray, attacked);
      const ssim = calculateSSIM(wmGray, attacked);
      const mse = calculateMSE(wmGray, attacked);

      setResults(prev => [
        {
          type: config.label,
          attackedPreview,
          extractedPreview,
          psnr,
          ssim,
          ncc: ext.ncc,
          mse,
        },
        ...prev,
      ]);
      setProgress("");
    } catch (err) {
      console.error("Attack test error:", err);
      setProgress("Error during testing");
    } finally {
      setProcessing(false);
    }
  }, [watermarkedFile, originalFile, selectedAttack, attackParam, alpha, config.label]);

  const handleRunAll = useCallback(async () => {
    if (!watermarkedFile || !originalFile) return;
    setProcessing(true);
    const allResults: AttackResult[] = [];

    try {
      const [wmData, origData] = await Promise.all([
        loadImageFromFile(watermarkedFile),
        loadImageFromFile(originalFile),
      ]);

      const wmGray = downscaleForProcessing(toGrayscale(wmData), 256);
      const origGray = downscaleForProcessing(toGrayscale(origData), 256);
      const a = parseFloat(alpha) || 0.1;

      for (const cfg of ATTACK_CONFIGS) {
        setProgress(`Testing ${cfg.label}...`);
        const attacked = await runAsync(() => applyAttack(wmGray, cfg.type, cfg.param));
        const attackedPreview = imageDataToDataURL(fromGrayscale(attacked));
        const ext = await runAsync(() => extractWatermark(attacked, origGray, a, 64, 64));
        const extractedPreview = imageDataToDataURL(fromGrayscale(ext.extractedWatermark));
        const psnr = calculatePSNR(wmGray, attacked);
        const ssim = calculateSSIM(wmGray, attacked);
        const mse = calculateMSE(wmGray, attacked);
        allResults.push({ type: cfg.label, attackedPreview, extractedPreview, psnr, ssim, ncc: ext.ncc, mse });
      }

      setResults(allResults);
      setProgress("");
    } catch (err) {
      console.error("Error:", err);
      setProgress("Error during testing");
    } finally {
      setProcessing(false);
    }
  }, [watermarkedFile, originalFile, alpha]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ImageUpload label="Watermarked Image" description="The watermarked image to attack"
          onFileSelect={(f) => { setWatermarkedFile(f); setWatermarkedPreview(URL.createObjectURL(f)); }}
          preview={watermarkedPreview}
          onClear={() => { setWatermarkedFile(null); setWatermarkedPreview(null); setResults([]); }} />
        <ImageUpload label="Original Cover Image" description="For non-blind extraction after attack"
          onFileSelect={(f) => { setOriginalFile(f); setOriginalPreview(URL.createObjectURL(f)); }}
          preview={originalPreview}
          onClear={() => { setOriginalFile(null); setOriginalPreview(null); setResults([]); }} />
      </div>

      <div className="p-4 rounded-xl border border-border bg-card space-y-4">
        <h3 className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> Attack Configuration
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {ATTACK_CONFIGS.map((cfg) => (
            <button key={cfg.type}
              onClick={() => { setSelectedAttack(cfg.type); setAttackParam(cfg.param); }}
              className={`p-2 rounded-lg text-xs font-heading border transition-colors ${
                selectedAttack === cfg.type
                  ? "bg-primary/20 border-primary text-primary"
                  : "bg-muted border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{config.paramLabel}</span>
            <span className="font-mono text-foreground">{attackParam}</span>
          </div>
          <Slider
            value={[attackParam]}
            onValueChange={([v]) => setAttackParam(v)}
            min={config.min}
            max={config.max}
            step={config.step}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Alpha (α)</label>
          <input value={alpha} onChange={e => setAlpha(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded-md bg-muted border border-border text-foreground" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={handleTest} disabled={!watermarkedFile || !originalFile || processing}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading" size="lg">
          {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress}</> : (
            <><Zap className="w-4 h-4 mr-2" />Run Selected Attack</>
          )}
        </Button>
        <Button onClick={handleRunAll} disabled={!watermarkedFile || !originalFile || processing}
          variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 font-heading" size="lg">
          Run All Attacks
        </Button>
      </div>

      {results.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <h3 className="text-sm font-bold font-heading text-foreground">Attack Results</h3>
          {results.map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-xl border border-border bg-card space-y-3">
              <h4 className="text-xs font-semibold font-heading text-primary">{r.type}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Attacked Image</p>
                  <img src={r.attackedPreview} alt="Attacked" className="w-full rounded border border-border" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Extracted Watermark</p>
                  <img src={r.extractedPreview} alt="Extracted" className="w-full rounded border border-border bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">PSNR</span>
                  <p className="font-mono font-semibold text-foreground">{r.psnr.toFixed(2)} dB</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">SSIM</span>
                  <p className="font-mono font-semibold text-foreground">{r.ssim.toFixed(4)}</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">NCC</span>
                  <p className="font-mono font-semibold text-foreground">{r.ncc.toFixed(4)}</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">MSE</span>
                  <p className="font-mono font-semibold text-foreground">{r.mse.toFixed(2)}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
