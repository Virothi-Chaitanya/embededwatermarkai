import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Activity, Target, FileText } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { sweepAlpha, gaOptimize, type AlphaSweepPoint, type GAGeneration } from "@/utils/reversible";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { runAsync } from "@/utils/processing";

interface Props { data?: any; }

const COLORS = {
  primary: "hsl(260, 80%, 62%)",
  accent: "hsl(200, 90%, 55%)",
  success: "hsl(160, 70%, 45%)",
  warning: "hsl(38, 92%, 50%)",
  destructive: "hsl(0, 72%, 51%)",
};

const tooltipStyle = {
  backgroundColor: "hsl(232, 32%, 10%)",
  border: "1px solid hsl(232, 22%, 20%)",
  borderRadius: "12px",
  fontSize: "11px",
};

function ChartCard({ title, icon: Icon, children, delay = 0 }: { title: string; icon: any; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold font-heading text-foreground">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

export function AccuracyDashboard({ data }: Props) {
  const [sweepData, setSweepData] = useState<AlphaSweepPoint[]>([]);
  const [gaData, setGaData] = useState<GAGeneration[]>([]);
  const [computing, setComputing] = useState(false);

  const computeCharts = async () => {
    if (!data?.coverImageData || !data?.watermarkImageData) return;
    setComputing(true);
    try {
      const sweep = await runAsync(() => sweepAlpha(data.coverImageData, data.watermarkImageData, 10));
      setSweepData(sweep);
      const ga = await runAsync(() => gaOptimize(data.coverImageData, data.watermarkImageData, 10, 10));
      setGaData(ga.history);
    } catch (e) { console.error(e); }
    finally { setComputing(false); }
  };

  useEffect(() => {
    if (data?.coverImageData && sweepData.length === 0) computeCharts();
  }, [data]);

  if (!data) {
    return (
      <div className="glass-card p-12 text-center">
        <BarChart3 className="w-10 h-10 text-primary/30 mx-auto mb-4" />
        <h3 className="text-sm font-heading text-muted-foreground mb-1">No Data Yet</h3>
        <p className="text-xs text-muted-foreground/60">Embed a watermark first to see accuracy metrics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <BigMetric label="PSNR" value={data.psnr?.toFixed(2)} unit="dB" color="text-primary" />
        <BigMetric label="SNR" value={data.snr?.toFixed(2)} unit="dB" color="text-accent" />
        <BigMetric label="SSIM" value={data.ssim?.toFixed(4)} color="text-accent" />
        <BigMetric label="NCC" value={data.ncc?.toFixed(4)} color="text-success" />
        <BigMetric label="MSE" value={data.mse?.toFixed(4)} color="text-warning" />
        <BigMetric label="Recovery" value={data.recoveryCapable ? "100%" : "N/A"} color="text-success" />
      </div>

      {/* Extraction accuracy */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold font-heading text-foreground mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-success" /> Extraction Accuracy Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-success/5 border border-success/20 text-center">
            <p className="text-muted-foreground">Blind Recovery</p>
            <p className="text-lg font-bold text-success">{data.recoveryCapable ? '✓ Yes' : '✗ No'}</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
            <p className="text-muted-foreground">PSNR Quality</p>
            <p className="text-lg font-bold text-primary">{data.psnr > 40 ? 'Excellent' : data.psnr > 30 ? 'Good' : 'Fair'}</p>
          </div>
          <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 text-center">
            <p className="text-muted-foreground">Visual Fidelity</p>
            <p className="text-lg font-bold text-accent">{(data.ssim * 100).toFixed(1)}%</p>
          </div>
          <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 text-center">
            <p className="text-muted-foreground">Correlation</p>
            <p className="text-lg font-bold text-warning">{(data.ncc * 100).toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {computing && (
        <div className="glass-card p-8 text-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Computing analysis charts...</p>
        </div>
      )}

      {sweepData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="PSNR vs Alpha (α)" icon={TrendingUp} delay={0.1}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={sweepData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(232,22%,18%)" />
                <XAxis dataKey="alpha" tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="psnr" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} name="PSNR (dB)" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="SNR vs Alpha (α)" icon={TrendingUp} delay={0.15}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={sweepData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(232,22%,18%)" />
                <XAxis dataKey="alpha" tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="snr" stroke={COLORS.success} strokeWidth={2} dot={{ r: 3 }} name="SNR (dB)" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="SSIM vs Alpha (α)" icon={Activity} delay={0.2}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={sweepData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(232,22%,18%)" />
                <XAxis dataKey="alpha" tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} domain={[0, 1]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="ssim" stroke={COLORS.accent} strokeWidth={2} dot={{ r: 3 }} name="SSIM" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="MSE vs Alpha (α)" icon={Target} delay={0.3}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sweepData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(232,22%,18%)" />
                <XAxis dataKey="alpha" tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="mse" fill={COLORS.warning} radius={[4, 4, 0, 0]} name="MSE" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {gaData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard title="GA Fitness Convergence" icon={TrendingUp} delay={0.5}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={gaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(232,22%,18%)" />
                <XAxis dataKey="generation" tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="bestFitness" stroke={COLORS.primary} strokeWidth={2} name="Best" dot={false} />
                <Line type="monotone" dataKey="avgFitness" stroke={COLORS.accent} strokeWidth={1} strokeDasharray="4 4" name="Average" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="GA Alpha Evolution" icon={Target} delay={0.6}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={gaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(232,22%,18%)" />
                <XAxis dataKey="generation" tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="bestAlpha" stroke={COLORS.warning} strokeWidth={2} dot={false} name="Alpha (α)" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="GA PSNR & SSIM per Generation" icon={BarChart3} delay={0.7}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={gaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(232,22%,18%)" />
                <XAxis dataKey="generation" tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line yAxisId="left" type="monotone" dataKey="bestPSNR" stroke={COLORS.primary} strokeWidth={2} name="PSNR" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="bestSSIM" stroke={COLORS.accent} strokeWidth={2} name="SSIM" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="GA SNR per Generation" icon={Activity} delay={0.8}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={gaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(232,22%,18%)" />
                <XAxis dataKey="generation" tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,12%,50%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="bestSNR" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.15} strokeWidth={2} name="SNR (dB)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function BigMetric({ label, value, unit, color }: { label: string; value?: string; unit?: string; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-4 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold font-heading ${color}`}>{value || '—'}</p>
      {unit && <p className="text-[10px] text-muted-foreground">{unit}</p>}
    </motion.div>
  );
}
