import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, Unlock, Eye, BarChart3, Fingerprint, Sparkles, ArrowRight, Cpu, Layers, Binary } from "lucide-react";
import { ReversibleEmbedModule } from "@/components/ReversibleEmbedModule";
import { ReversibleExtractModule } from "@/components/ReversibleExtractModule";
import { AccuracyDashboard } from "@/components/AccuracyDashboard";
import { PipelineVisualization } from "@/components/PipelineVisualization";
import { RobustnessModule } from "@/components/RobustnessModule";

const tabs = [
  { id: "embed" as const, label: "Embed", icon: Lock, desc: "Hide watermark + encode original" },
  { id: "extract" as const, label: "Extract", icon: Unlock, desc: "Recover both images" },
  { id: "robustness" as const, label: "Robustness", icon: Shield, desc: "Attack simulations" },
  { id: "accuracy" as const, label: "Accuracy", icon: BarChart3, desc: "Metrics & graphs" },
  { id: "process" as const, label: "Process", icon: Eye, desc: "Step-by-step visualization" },
];

type TabId = typeof tabs[number]["id"];

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("embed");
  const [sharedData, setSharedData] = useState<any>(null);

  return (
    <div className="min-h-screen bg-background dot-pattern">
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      <header className="border-b border-border/50 bg-card/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
  <div className="relative flex items-center">
    <img 
      src="/vignan.png" 
      alt="logo"
      className="h-8 w-8 object-contain"
    />

    {/* small status dot (optional) */}
    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent rounded-full animate-pulse" />
  </div>

  <div></div>
            <div>
              <h1 className="text-sm font-bold font-heading text-foreground tracking-tight">
                Hybrid <span className="gradient-text"> Watermarking</span> System
              </h1>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                DWT • SVD • LSB • Genetic Algorithm
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-muted/50 rounded-full p-1 border border-border/50 backdrop-blur-sm">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-heading transition-all duration-300 ${
                  activeTab === id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {activeTab === "embed" && (
        <section className="container mx-auto px-4 pt-10 pb-6">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center max-w-4xl mx-auto">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card mb-5">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-accent font-heading font-medium">
                PSNR &gt; 40dB • SNR &gt; 40dB • Full Color Fidelity
              </span>
            </motion.div>
            <h2 className="text-4xl md:text-5xl font-bold font-heading text-foreground mb-4 leading-[1.1]">
              A Resilient Hybrid DWT-SVD<br /><span className="gradient-text">Watermarking Framework</span>
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xl mx-auto mb-8">
              Hybrid frequency + spatial domain system with GA optimization. Supports up to <span className="text-accent font-medium">20MB images</span> with near-lossless quality.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {[
                { icon: Layers, title: "DWT + SVD", desc: "2-level wavelet decomposition with SVD for frequency-domain watermarking" },
                { icon: Binary, title: "LSB 2-bit", desc: "Full-color recovery via 2-bit LSB encoding with 8-bit RGB compression" },
                { icon: Cpu, title: "GA Optimize", desc: "Auto-finds optimal α for maximum PSNR, SNR, SSIM simultaneously" },
              ].map(({ icon: Icon, title, desc }, i) => (
                <motion.div key={title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className="glass-card-hover p-5 text-left">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 w-fit mb-3"><Icon className="w-4 h-4 text-primary" /></div>
                  <h3 className="text-sm font-semibold font-heading text-foreground mb-1.5">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-3 mt-6 text-xs text-muted-foreground font-heading flex-wrap">
              <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">Original</span>
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent border border-accent/20">+ Watermark</span>
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">1 Image</span>
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="px-3 py-1.5 rounded-lg bg-success/10 text-success border border-success/20">Both Recovered ✓</span>
            </motion.div>
          </motion.div>
        </section>
      )}

      <section className="container mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }} className="max-w-7xl mx-auto">
            {activeTab === "embed" && <ReversibleEmbedModule onComplete={setSharedData} />}
            {activeTab === "extract" && <ReversibleExtractModule />}
            {activeTab === "robustness" && <RobustnessModule />}
            {activeTab === "accuracy" && <AccuracyDashboard data={sharedData} />}
            {activeTab === "process" && <PipelineVisualization />}
          </motion.div>
        </AnimatePresence>
      </section>

      <footer className="border-t border-border/50 py-6 mt-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            Intelligent Reversible Image Watermarking — DWT + SVD + LSB + GA — All processing runs locally in your browser
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
