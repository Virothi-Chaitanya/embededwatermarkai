import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, AreaChart, Area, ScatterChart, Scatter, ZAxis,
} from "recharts";
import type { GAGenerationData, DWTEnergyData, HistogramBin, AlphaSweepPoint } from "@/utils/watermark";

interface AnalyticsChartsProps {
  gaHistory?: GAGenerationData[];
  dwtEnergy?: DWTEnergyData[];
  pixelDiffHistogram?: HistogramBin[];
  alphaSweep?: AlphaSweepPoint[];
}

const COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

const tooltipStyle = {
  contentStyle: { background: "hsl(220 18% 10%)", border: "1px solid hsl(220 14% 18%)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "hsl(210 20% 92%)" },
};

const tickStyle = { fill: "hsl(215 12% 50%)", fontSize: 11 };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-border bg-card">
      <h4 className="text-sm font-semibold font-heading text-foreground mb-3">{title}</h4>
      {children}
    </motion.div>
  );
}

export function AnalyticsCharts({ gaHistory, dwtEnergy, pixelDiffHistogram, alphaSweep }: AnalyticsChartsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold font-heading text-foreground">📊 Analytics & Graphs</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* PSNR vs Alpha */}
        {alphaSweep && alphaSweep.length > 0 && (
          <ChartCard title="PSNR vs Alpha (α)">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={alphaSweep}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="alpha" tick={tickStyle} label={{ value: "α", position: "insideBottom", offset: -5, fill: "hsl(215 12% 50%)" }} />
                <YAxis tick={tickStyle} label={{ value: "PSNR (dB)", angle: -90, position: "insideLeft", fill: "hsl(215 12% 50%)" }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="psnr" stroke="#0d9488" strokeWidth={2} dot={{ fill: "#0d9488" }} name="PSNR" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* SSIM vs Alpha */}
        {alphaSweep && alphaSweep.length > 0 && (
          <ChartCard title="SSIM vs Alpha (α)">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={alphaSweep}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="alpha" tick={tickStyle} />
                <YAxis tick={tickStyle} domain={[0, 1]} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="ssim" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1" }} name="SSIM" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* NCC vs Generations */}
        {gaHistory && gaHistory.length > 0 && (
          <ChartCard title="NCC vs Generations (GA)">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={gaHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="generation" tick={tickStyle} />
                <YAxis tick={tickStyle} domain={[0, 1]} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="bestNCC" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} strokeWidth={2} name="Best NCC" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* MSE Comparison */}
        {alphaSweep && alphaSweep.length > 0 && (
          <ChartCard title="MSE vs Alpha (Original vs Watermarked)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={alphaSweep}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="alpha" tick={tickStyle} />
                <YAxis tick={tickStyle} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="mse" fill="#ef4444" name="MSE" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* GA Convergence */}
        {gaHistory && gaHistory.length > 0 && (
          <ChartCard title="GA Fitness Convergence">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={gaHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="generation" tick={tickStyle} />
                <YAxis tick={tickStyle} domain={["auto", "auto"]} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="bestFitness" stroke="#0d9488" strokeWidth={2} name="Best Fitness" dot={{ fill: "#0d9488", r: 2 }} />
                <Line type="monotone" dataKey="avgFitness" stroke="#6366f1" strokeWidth={2} name="Avg Fitness" dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* GA Alpha Evolution */}
        {gaHistory && gaHistory.length > 0 && (
          <ChartCard title="GA Alpha (α) Evolution">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={gaHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="generation" tick={tickStyle} />
                <YAxis tick={tickStyle} domain={["auto", "auto"]} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="bestAlpha" stroke="#f59e0b" strokeWidth={2} name="Best α" dot={{ fill: "#f59e0b", r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* GA PSNR + SSIM per Generation */}
        {gaHistory && gaHistory.length > 0 && (
          <ChartCard title="GA: PSNR & SSIM per Generation">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={gaHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="generation" tick={tickStyle} />
                <YAxis yAxisId="psnr" tick={tickStyle} />
                <YAxis yAxisId="ssim" orientation="right" tick={tickStyle} domain={[0, 1]} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="psnr" type="monotone" dataKey="bestPSNR" stroke="#0d9488" strokeWidth={2} name="PSNR (dB)" dot={false} />
                <Line yAxisId="ssim" type="monotone" dataKey="bestSSIM" stroke="#8b5cf6" strokeWidth={2} name="SSIM" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* DWT Energy */}
        {dwtEnergy && (
          <ChartCard title="DWT Subband Energy Distribution">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={dwtEnergy} dataKey="percentage" nameKey="subband" cx="50%" cy="50%" outerRadius={80}
                  label={({ subband, percentage }) => `${subband}: ${percentage}%`}>
                  {dwtEnergy.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Pixel Diff Histogram */}
        {pixelDiffHistogram && (
          <ChartCard title="Pixel Difference Distribution">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pixelDiffHistogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="range" tick={{ ...tickStyle, fontSize: 10 }} />
                <YAxis tick={tickStyle} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill="#0d9488" name="Pixel Count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* GA Summary Table */}
        {gaHistory && gaHistory.length > 0 && (
          <ChartCard title="GA Generation Summary">
            <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1.5 text-left">Gen</th>
                    <th className="py-1.5 text-right">Fitness</th>
                    <th className="py-1.5 text-right">PSNR</th>
                    <th className="py-1.5 text-right">SSIM</th>
                    <th className="py-1.5 text-right">NCC</th>
                    <th className="py-1.5 text-right">Alpha</th>
                  </tr>
                </thead>
                <tbody>
                  {gaHistory.map((g) => (
                    <tr key={g.generation} className="border-b border-border/50">
                      <td className="py-1 font-mono text-foreground">{g.generation}</td>
                      <td className="py-1 text-right font-mono text-primary">{g.bestFitness.toFixed(4)}</td>
                      <td className="py-1 text-right font-mono text-foreground">{g.bestPSNR.toFixed(2)}</td>
                      <td className="py-1 text-right font-mono text-foreground">{g.bestSSIM.toFixed(4)}</td>
                      <td className="py-1 text-right font-mono text-foreground">{g.bestNCC.toFixed(4)}</td>
                      <td className="py-1 text-right font-mono text-accent">{g.bestAlpha.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        )}
      </div>
    </div>
  );
}
