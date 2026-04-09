import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, Unlock, Waves, Dna, Binary } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmbedModule } from "@/components/EmbedModule";
import { ExtractModule } from "@/components/ExtractModule";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 animate-pulse-glow">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-heading text-foreground">Hybrid Image Watermarking</h1>
            <p className="text-xs text-muted-foreground">DWT · SVD · Genetic Algorithm</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mb-3">
            Secure Digital Copyright Protection
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Embed invisible watermarks using a hybrid approach combining Discrete Wavelet Transform,
            Singular Value Decomposition, and Genetic Algorithm optimization for maximum robustness.
          </p>
          
          <div className="flex items-center justify-center gap-6 mt-6">
            {[
              { icon: Waves, label: "DWT" },
              { icon: Binary, label: "SVD" },
              { icon: Dna, label: "GA" },
            ].map(({ icon: Icon, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border"
              >
                <Icon className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium font-heading text-foreground">{label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Main Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <Tabs defaultValue="embed" className="w-full">
            <TabsList className="w-full grid grid-cols-2 bg-muted border border-border">
              <TabsTrigger value="embed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-heading gap-2">
                <Lock className="w-4 h-4" />
                Embed Watermark
              </TabsTrigger>
              <TabsTrigger value="extract" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground font-heading gap-2">
                <Unlock className="w-4 h-4" />
                Extract Watermark
              </TabsTrigger>
            </TabsList>
            
            <div className="mt-6">
              <TabsContent value="embed">
                <EmbedModule />
              </TabsContent>
              <TabsContent value="extract">
                <ExtractModule />
              </TabsContent>
            </div>
          </Tabs>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-10">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            Hybrid DWT-SVD Watermarking with Genetic Algorithm Optimization — All processing runs locally in your browser
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
