import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, Unlock, Eye, BarChart3, Fingerprint, Sparkles, ArrowRight, Cpu, Layers, Binary } from "lucide-react";
import { ReversibleEmbedModule } from "@/components/ReversibleEmbedModule";
import { ReversibleExtractModule } from "@/components/ReversibleExtractModule";
import { AccuracyDashboard } from "@/components/AccuracyDashboard";
import { PipelineVisualization } from "@/components/PipelineVisualization";

const tabs = [
  { id: "embed" as const, label: "Embed", icon: Lock, desc: "Hide watermark + encode original" },
  { id: "extract" as const, label: "Extract", icon: Unlock, desc: "Recover both images" },
  { id: "accuracy" as const, label: "Accuracy", icon: BarChart3, desc: "Metrics & graphs" },
  { id: "process" as const, label: "Process", icon: Eye, desc: "Step-by-step visualization" },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<"embed" | "extract" | "accuracy" | "process">("embed");
  const [sharedData, setSharedData] = useState<any>(null);

  return (
    <div className="min-h-screen bg-background dot-pattern">
      {/* Ambient glow effects */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-border/50 bg-card/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 animate-pulse-glow">
                <Fingerprint className="w-5 h-5 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-bold font-heading text-foreground tracking-tight">
                Intelligent <span className="gradient-text">Reversible</span> Watermarking
              </h1>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                DWT • SVD • LSB • Genetic Algorithm
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-muted/50 rounded-full p-1 border border-border/50 backdrop-blur-sm">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-heading transition-all duration-300 ${
                  activeTab === id
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero - only on embed tab */}
      {activeTab === "embed" && (
        <section className="container mx-auto px-4 pt-12 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card mb-6"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-accent font-heading font-medium">
                Reversible Image Protection System
              </span>
            </motion.div>

            <h2 className="text-4xl md:text-6xl font-bold font-heading text-foreground mb-5 leading-[1.1]">
              Upload 2 Images, Get 1.<br />
              <span className="gradient-text">Recover Both.</span>
            </h2>

            <p className="text-muted-foreground text-sm leading-relaxed max-w-xl mx-auto mb-10">
              A hybrid frequency + spatial domain system that embeds a watermark <em>and</em> encodes
              the original image into a single output — enabling <span className="text-accent font-medium">near-perfect
              recovery of both</span>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {[
                { icon: Layers, title: "DWT + SVD", desc: "Frequency-domain watermark embedding using 2-level wavelet decomposition and singular value modification." },
                { icon: Binary, title: "LSB Encoding", desc: "Spatial-domain original image recovery — compressed pixel data stored in least significant bits." },
                { icon: Cpu, title: "GA Optimization", desc: "Genetic algorithm finds the optimal alpha for maximum PSNR, SSIM, and NCC simultaneously." },
              ].map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="glass-card-hover p-5 text-left"
                >
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 w-fit mb-3">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold font-heading text-foreground mb-1.5">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Flow arrow */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex items-center justify-center gap-3 mt-8 text-xs text-muted-foreground font-heading"
            >
              <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">Original</span>
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent border border-accent/20">+ Watermark</span>
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 gradient-border">
                1 Protected Image
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="px-3 py-1.5 rounded-lg bg-success/10 text-success border border-success/20">Both Recovered ✓</span>
            </motion.div>
          </motion.div>
        </section>
      )}

      {/* Main Content */}
      <section className="container mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="max-w-7xl mx-auto"
          >
            {activeTab === "embed" && <ReversibleEmbedModule onComplete={setSharedData} />}
            {activeTab === "extract" && <ReversibleExtractModule />}
            {activeTab === "accuracy" && <AccuracyDashboard data={sharedData} />}
            {activeTab === "process" && <PipelineVisualization />}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 mt-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            Intelligent Reversible Image Watermarking System — DWT + SVD + LSB + GA — All processing runs locally in your browser
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
