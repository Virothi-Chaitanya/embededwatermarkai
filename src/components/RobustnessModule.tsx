import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Shield, Zap, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { loadImageFromFile, toGrayscale, fromGrayscale, imageDataToDataURL, calculatePSNR, calculateSSIM, calculateNCC, calculateMSE } from "@/utils/imageUtils";
import { extractWatermark } from "@/utils/watermark";
import { applyAttack, ATTACK_CONFIGS, type AttackType } from "@/utils/attacks";
import { downscaleForProcessing, runAsync } from "@/utils/processing";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

interface AttackResult {
  type: string;
  attackedPreview: string;
  extractedPreview: string;
  psnr: number;
  ssim: number;
  ncc: number;
  mse: number;
  robustnessScore: number;
}

const tooltipStyle = {
  backgroundColor: "hsl(232, 32%, 10%)",
  border: "1px solid hsl(232, 22%, 20%)",
  borderRadius: "12px",
  fontSize: "11px",
};

function computeRobustnessScore(psnr: number, ssim: number, ncc: number): number {
  const psnrScore = Math.min(psnr / 50, 1) * 100;
  const ssimScore = ssim * 100;
  const nccScore = Math.max(0, ncc) * 100;
  return Math.round(0.3 * psnrScore + 0.4 * ssimScore + 0.3 * nccScore);
}

export function RobustnessModule() {
  const [watermarkedFile, setWatermarkedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [watermarkedPreview, setWatermarkedPreview] = useState<string | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [results, setResults] = useState<AttackResult[]>([]);
  const [selectedAttack, setSelectedAttack] = useState<AttackType>("gaussian");
  const [attackParam, setAttackParam] = useState(25);
  const [alpha, setAlpha] = useState("0.01");

  const config = ATTACK_CONFIGS.find(c => c.type === selectedAttack)!;

  const processAttack = async (wmGray: number[][], origGray: number[][], a: number, cfg: typeof config) => {
    const attacked = await runAsync(() => applyAttack(wmGray, cfg.type, cfg.param));
    const attackedPreview = imageDataToDataURL(fromGrayscale(attacked));
    const ext = await runAsync(() => extractWatermark(attacked, origGray, a, 64, 64));
    const extractedPreview = imageDataToDataURL(fromGrayscale(ext.extractedWatermark));
    const psnr = calculatePSNR(wmGray, attacked);
    const ssim = calculateSSIM(wmGray, attacked);
    const mse = calculateMSE(wmGray, attacked);
    const robustnessScore = computeRobustnessScore(psnr, ssim, ext.ncc);
    return { type: cfg.label, attackedPreview, extractedPreview, psnr, ssim, ncc: ext.ncc, mse, robustnessScore };
  };

  const handleTest = useCallback(async () => {
    if (!watermarkedFile || !originalFile) return;
    setProcessing(true);
    setProgress("Loading...");
    try {
      const [wmData, origData] = await Promise.all([loadImageFromFile(watermarkedFile), loadImageFromFile(originalFile)]);
      const wmGray = downscaleForProcessing(toGrayscale(wmData), 256);
      const origGray = downscaleForProcessing(toGrayscale(origData), 256);
      const a = parseFloat(alpha) || 0.01;
      setProgress(`Applying ${config.label}...`);
      const r = await processAttack(wmGray, origGray, a, { ...config, param: attackParam });
      setResults(prev => [r, ...prev]);
      setProgress("");
    } catch (err) {
      console.error(err);
      setProgress("Error");
    } finally {
      setProcessing(false);
    }
  }, [watermarkedFile, originalFile, selectedAttack, attackParam, alpha, config]);

  const handleRunAll = useCallback(async () => {
    if (!watermarkedFile || !originalFile) return;
    setProcessing(true);
    const allResults: AttackResult[] = [];
    try {
      const [wmData, origData] = await Promise.all([loadImageFromFile(watermarkedFile), loadImageFromFile(originalFile)]);
      const wmGray = downscaleForProcessing(toGrayscale(wmData), 256);
      const origGray = downscaleForProcessing(toGrayscale(origData), 256);
      const a = parseFloat(alpha) || 0.01;
      for (let i = 0; i < ATTACK_CONFIGS.length; i++) {
        const cfg = ATTACK_CONFIGS[i];
        setProgress(`Testing ${cfg.label}...`);
        setProgressPct(Math.round(((i + 1) / ATTACK_CONFIGS.length) * 100));
        const r = await processAttack(wmGray, origGray, a, cfg);
        allResults.push(r);
      }
      setResults(allResults);
      setProgress("");
    } catch (err) {
      console.error(err);
      setProgress("Error");
    } finally {
      setProcessing(false);
      setProgressPct(0);
    }
  }, [watermarkedFile, originalFile, alpha]);

  const handleDownloadReport = () => {
    if (results.length === 0) return;
    const lines = [
      "=== ROBUSTNESS ANALYSIS REPORT ===",
      `Date: ${new Date().toISOString()}`,
      `Alpha: ${alpha}`,
      "",
      ...results.map(r => [
        `--- ${r.type} ---`,
        `PSNR: ${r.psnr.toFixed(4)} dB`,
        `SSIM: ${r.ssim.toFixed(6)}`,
        `NCC: ${r.ncc.toFixed(6)}`,
        `MSE: ${r.mse.toFixed(4)}`,
        `Robustness Score: ${r.robustnessScore}%`,
        "",
      ].join("\n")),
      `\nOverall Avg Robustness: ${(results.reduce((s, r) => s + r.robustnessScore, 0) / results.length).toFixed(1)}%`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "robustness_report.txt";
    a.click();
  };

  // Chart data
  const barData = results.map(r => ({ name: r.type.substring(0, 8), PSNR: +r.psnr.toFixed(2), SSIM: +(r.ssim * 100).toFixed(1), NCC: +(r.ncc * 100).toFixed(1), Score: r.robustnessScore }));
  const radarData = results.map(r => ({ attack: r.type.substring(0, 8), score: r.robustnessScore, psnr: Math.min(r.psnr, 50), ssim: r.ssim * 100 }));

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
                selectedAttack === cfg.type ? "bg-primary/20 border-primary text-primary" : "bg-muted border-border text-muted-foreground hover:border-primary/50"
              }`}>{cfg.label}</button>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{config.paramLabel}</span><span className="font-mono text-foreground">{attackParam}</span>
          </div>
          <Slider value={[attackParam]} onValueChange={([v]) => setAttackParam(v)} min={config.min} max={config.max} step={config.step} />
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
          {processing && progressPct === 0 ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress}</> : <><Zap className="w-4 h-4 mr-2" />Run Selected Attack</>}
        </Button>
        <Button onClick={handleRunAll} disabled={!watermarkedFile || !originalFile || processing}
          variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 font-heading" size="lg">
          {processing && progressPct > 0 ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress}</> : "Run All Attacks"}
        </Button>
      </div>
      {processing && progressPct > 0 && <Progress value={progressPct} className="h-1.5" />}

      {results.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Overall Score */}
          <div className="glass-card p-5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Overall Robustness Score</p>
            <p className="text-4xl font-bold font-heading text-primary">
              {(results.reduce((s, r) => s + r.robustnessScore, 0) / results.length).toFixed(1)}%
            </p>
          </div>

          {/* Charts */}
          {results.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="glass-card p-5">
                <h4 className="text-sm font-semibold font-heading text-foreground mb-3">Robustness Scores by Attack</h4>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(232,22%,18%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(215,12%,50%)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="Score" fill="hsl(260, 80%, 62%)" radius={[4, 4, 0, 0]} name="Score %" />
                    <Bar dataKey="PSNR" fill="hsl(200, 90%, 55%)" radius={[4, 4, 0, 0]} name="PSNR" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card p-5">
                <h4 className="text-sm font-semibold font-heading text-foreground mb-3">Radar: Quality After Attacks</h4>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(232,22%,18%)" />
                    <PolarAngleAxis dataKey="attack" tick={{ fontSize: 9, fill: "hsl(215,12%,50%)" }} />
                    <PolarRadiusAxis tick={{ fontSize: 8, fill: "hsl(215,12%,50%)" }} />
                    <Radar name="Score" dataKey="score" stroke="hsl(260, 80%, 62%)" fill="hsl(260, 80%, 62%)" fillOpacity={0.3} />
                    <Radar name="SSIM%" dataKey="ssim" stroke="hsl(200, 90%, 55%)" fill="hsl(200, 90%, 55%)" fillOpacity={0.15} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleDownloadReport} variant="outline" size="sm" className="border-accent/30 text-accent hover:bg-accent/10">
              <FileText className="w-3.5 h-3.5 mr-2" /> Download Robustness Report
            </Button>
          </div>

          <h3 className="text-sm font-bold font-heading text-foreground">Attack Results</h3>
          {results.map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="p-4 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold font-heading text-primary">{r.type}</h4>
                <span className={`text-xs font-bold font-heading px-2 py-0.5 rounded-full ${
                  r.robustnessScore >= 70 ? 'bg-success/20 text-success' : r.robustnessScore >= 40 ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'
                }`}>{r.robustnessScore}%</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[10px] text-muted-foreground mb-1">Attacked Image</p>
                  <img src={r.attackedPreview} alt="Attacked" className="w-full rounded border border-border" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Extracted Watermark</p>
                  <img src={r.extractedPreview} alt="Extracted" className="w-full rounded border border-border bg-muted" /></div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded bg-muted/50"><span className="text-muted-foreground">PSNR</span><p className="font-mono font-semibold text-foreground">{r.psnr.toFixed(2)} dB</p></div>
                <div className="p-2 rounded bg-muted/50"><span className="text-muted-foreground">SSIM</span><p className="font-mono font-semibold text-foreground">{r.ssim.toFixed(4)}</p></div>
                <div className="p-2 rounded bg-muted/50"><span className="text-muted-foreground">NCC</span><p className="font-mono font-semibold text-foreground">{r.ncc.toFixed(4)}</p></div>
                <div className="p-2 rounded bg-muted/50"><span className="text-muted-foreground">MSE</span><p className="font-mono font-semibold text-foreground">{r.mse.toFixed(2)}</p></div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
