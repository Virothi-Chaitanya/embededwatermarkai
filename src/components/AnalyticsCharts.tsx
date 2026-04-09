import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import type { GAGenerationData, DWTEnergyData, HistogramBin } from "@/utils/watermark";

interface AnalyticsChartsProps {
  gaHistory?: GAGenerationData[];
  dwtEnergy?: DWTEnergyData[];
  dwtEnergyWatermarked?: DWTEnergyData[];
  pixelDiffHistogram?: HistogramBin[];
}

const COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444"];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-border bg-card"
    >
      <h4 className="text-sm font-semibold font-heading text-foreground mb-3">{title}</h4>
      {children}
    </motion.div>
  );
}

export function AnalyticsCharts({ gaHistory, dwtEnergy, dwtEnergyWatermarked, pixelDiffHistogram }: AnalyticsChartsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold font-heading text-foreground">📊 Analytics & Graphs</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GA Convergence */}
        {gaHistory && gaHistory.length > 0 && (
          <ChartCard title="GA Convergence (PSNR per Generation)">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={gaHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="generation" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "hsl(220 18% 10%)", border: "1px solid hsl(220 14% 18%)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(210 20% 92%)" }}
                />
                <Line type="monotone" dataKey="bestFitness" stroke="#0d9488" strokeWidth={2} name="Best PSNR" dot={{ fill: "#0d9488" }} />
                <Line type="monotone" dataKey="avgFitness" stroke="#6366f1" strokeWidth={2} name="Avg PSNR" dot={{ fill: "#6366f1" }} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* GA Alpha Evolution */}
        {gaHistory && gaHistory.length > 0 && (
          <ChartCard title="GA Alpha Optimization">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={gaHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="generation" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "hsl(220 18% 10%)", border: "1px solid hsl(220 14% 18%)", borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="bestAlpha" stroke="#f59e0b" strokeWidth={2} name="Best Alpha" dot={{ fill: "#f59e0b" }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* DWT Energy Distribution (Original vs Watermarked) */}
        {dwtEnergy && dwtEnergyWatermarked && (
          <ChartCard title="DWT Subband Energy Distribution">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dwtEnergy.map((d, i) => ({
                subband: d.subband,
                original: d.percentage,
                watermarked: dwtEnergyWatermarked[i]?.percentage ?? 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="subband" tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{ background: "hsl(220 18% 10%)", border: "1px solid hsl(220 14% 18%)", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="original" fill="#0d9488" name="Original" radius={[4, 4, 0, 0]} />
                <Bar dataKey="watermarked" fill="#6366f1" name="Watermarked" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Pixel Difference Histogram */}
        {pixelDiffHistogram && (
          <ChartCard title="Pixel Difference Distribution">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pixelDiffHistogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="range" tick={{ fill: "hsl(215 12% 50%)", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(215 12% 50%)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(220 18% 10%)", border: "1px solid hsl(220 14% 18%)", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#0d9488" name="Pixel Count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* DWT Energy Pie Chart */}
        {dwtEnergy && (
          <ChartCard title="Original Image Energy Breakdown">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={dwtEnergy}
                  dataKey="percentage"
                  nameKey="subband"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ subband, percentage }) => `${subband}: ${percentage}%`}
                >
                  {dwtEnergy.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(220 18% 10%)", border: "1px solid hsl(220 14% 18%)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Summary Stats Table */}
        {gaHistory && gaHistory.length > 0 && (
          <ChartCard title="GA Generation Summary">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1.5 text-left">Gen</th>
                    <th className="py-1.5 text-right">Best PSNR</th>
                    <th className="py-1.5 text-right">Avg PSNR</th>
                    <th className="py-1.5 text-right">Alpha</th>
                  </tr>
                </thead>
                <tbody>
                  {gaHistory.map((g) => (
                    <tr key={g.generation} className="border-b border-border/50">
                      <td className="py-1.5 font-mono text-foreground">{g.generation}</td>
                      <td className="py-1.5 text-right font-mono text-primary">{g.bestFitness.toFixed(2)}</td>
                      <td className="py-1.5 text-right font-mono text-accent">{g.avgFitness.toFixed(2)}</td>
                      <td className="py-1.5 text-right font-mono text-foreground">{g.bestAlpha.toFixed(4)}</td>
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
