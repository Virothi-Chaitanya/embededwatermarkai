import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, Unlock, Waves, Binary, Zap, Info, BarChart3 } from "lucide-react";
import { EmbedModule } from "@/components/EmbedModule";
import { ExtractModule } from "@/components/ExtractModule";
import { RobustnessModule } from "@/components/RobustnessModule";
import { ProcessVisualization } from "@/components/ProcessVisualization";

const Index = () => {
  const [activeTab, setActiveTab] = useState<"embed" | "extract" | "robustness" | "process">("embed");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 animate-pulse-glow">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold font-heading text-foreground">
                Hybrid <span className="text-primary">Image Protection</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">DWT-SVD QIM Optimization</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-muted rounded-full p-1 border border-border">
            <button
              onClick={() => setActiveTab("embed")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-heading transition-all ${
                activeTab === "embed"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lock className="w-3.5 h-3.5" /> Embed
            </button>
            <button
              onClick={() => setActiveTab("extract")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-heading transition-all ${
                activeTab === "extract"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Unlock className="w-3.5 h-3.5" /> Extract
            </button>
            <button
              onClick={() => setActiveTab("robustness")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-heading transition-all ${
                activeTab === "robustness"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Robustness
            </button>
            <button
              onClick={() => setActiveTab("process")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-heading transition-all ${
                activeTab === "process"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Process
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section - only on embed tab */}
      {activeTab === "embed" && (
        <section className="container mx-auto px-4 pt-10 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted border border-border mb-6">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-heading">
                Next-Gen Digital Watermarking
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold font-heading text-foreground mb-4 leading-tight">
              Protect Your Assets with<br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Intelligent Security
              </span>
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xl mx-auto">
              Advanced Hybrid Image DWT-SVD protection using QIM optimized by Genetic Algorithms.{" "}
              <span className="text-accent">No original image needed for extraction.</span>
            </p>

            <div className="grid grid-cols-3 gap-4 mt-8 max-w-2xl mx-auto">
              {[
                { icon: Waves, title: "DWT Decomposition", desc: "Splits image into frequency sub-bands (LL, LH, HL, HH) to find the most stable areas for embedding." },
                { icon: Binary, title: "SVD Transformation", desc: "Modifies singular values of the LL sub-band, providing high capacity and resistance to geometric attacks." },
                { icon: Zap, title: "Hybrid Image Extraction", desc: "Uses Quantization Index Modulation (QIM) to extract the watermark without needing the original cover image." },
              ].map(({ icon: Icon, title, desc }) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="p-5 rounded-xl border border-border bg-card/50 text-left"
                >
                  <div className="p-2 rounded-lg bg-muted w-fit mb-3">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold font-heading text-foreground mb-1">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* Main Content */}
      <section className="container mx-auto px-4 py-6">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-6xl mx-auto"
        >
          {activeTab === "embed" && <EmbedModule />}
          {activeTab === "extract" && <ExtractModule />}
          {activeTab === "robustness" && <RobustnessModule />}
          {activeTab === "process" && <ProcessVisualization />}
        </motion.div>
      </section>

      {/* About Section */}
      <section className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto p-5 rounded-xl border border-border bg-card/50">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold font-heading text-foreground">About Hybrid Image Protection</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This project implements a state-of-the-art <strong className="text-foreground">Hybrid Image Digital Watermarking</strong> system.
            By combining <strong className="text-foreground">Discrete Wavelet Transform (DWT)</strong> and{" "}
            <strong className="text-foreground">Singular Value Decomposition (SVD)</strong>, we ensure that your watermarks
            can be extracted without needing the original image. The <strong className="text-foreground">Genetic Algorithm (GA)</strong>{" "}
            optimizes embedding strength for the best balance between invisibility and robustness.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            Hybrid DWT-SVD Watermarking with GA Optimization — All processing runs locally in your browser
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
