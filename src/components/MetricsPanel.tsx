import { motion } from "framer-motion";
import { BarChart3, Shield, Zap, Clock, Maximize } from "lucide-react";

interface MetricsPanelProps {
  psnr?: number;
  ssim?: number;
  nc?: number;
  gaAlpha?: number;
  gaPSNR?: number;
  blindAlpha?: number;
  svdAlpha?: number;
  processingTime?: number;
  dimensions?: { width: number; height: number };
}

function MetricCard({ icon: Icon, label, value, unit, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
    >
      <div className={`p-2 rounded-md ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold font-heading text-foreground">
          {value}{unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}
        </p>
      </div>
    </motion.div>
  );
}

export function MetricsPanel({ psnr, ssim, nc, gaAlpha, gaPSNR, blindAlpha, svdAlpha, processingTime, dimensions }: MetricsPanelProps) {
  const hasMetrics = psnr !== undefined || ssim !== undefined || nc !== undefined;
  const hasParams = gaAlpha !== undefined || blindAlpha !== undefined;

  if (!hasMetrics && !hasParams) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 p-4 rounded-xl border border-border bg-card"
    >
      <h3 className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        Performance Metrics
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {psnr !== undefined && (
          <MetricCard icon={Shield} label="PSNR" value={psnr === Infinity ? "∞" : psnr.toFixed(2)} unit="dB" color="bg-primary/10 text-primary" />
        )}
        {ssim !== undefined && (
          <MetricCard icon={Shield} label="SSIM" value={ssim.toFixed(4)} color="bg-accent/10 text-accent" />
        )}
        {nc !== undefined && (
          <MetricCard icon={Zap} label="NC" value={nc.toFixed(4)} color="bg-success/10 text-success" />
        )}
        {gaPSNR !== undefined && (
          <MetricCard icon={Zap} label="GA Best PSNR" value={gaPSNR.toFixed(2)} unit="dB" color="bg-info/10 text-info" />
        )}
        {processingTime !== undefined && (
          <MetricCard icon={Clock} label="Processing Time" value={(processingTime / 1000).toFixed(2)} unit="s" color="bg-warning/10 text-warning" />
        )}
        {dimensions && (
          <MetricCard icon={Maximize} label="Processed Size" value={`${dimensions.width}×${dimensions.height}`} unit="px" color="bg-muted text-foreground" />
        )}
      </div>

      {hasParams && (
        <div className="pt-2 border-t border-border grid grid-cols-3 gap-2 text-xs">
          {gaAlpha !== undefined && (
            <div className="p-2 rounded bg-muted/50">
              <span className="text-muted-foreground">GA α</span>
              <p className="font-mono font-semibold text-foreground">{gaAlpha.toFixed(4)}</p>
            </div>
          )}
          {blindAlpha !== undefined && (
            <div className="p-2 rounded bg-muted/50">
              <span className="text-muted-foreground">Blind α</span>
              <p className="font-mono font-semibold text-foreground">{blindAlpha.toFixed(4)}</p>
            </div>
          )}
          {svdAlpha !== undefined && (
            <div className="p-2 rounded bg-muted/50">
              <span className="text-muted-foreground">SVD α</span>
              <p className="font-mono font-semibold text-foreground">{svdAlpha.toFixed(4)}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
