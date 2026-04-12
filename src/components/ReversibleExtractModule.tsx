import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Unlock, Download, CheckCircle2, XCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { loadImageFromFile, imageDataToDataURL } from "@/utils/imageUtils";
import { blindExtract } from "@/utils/reversible";
import { runAsync } from "@/utils/processing";

export function ReversibleExtractModule() {
  const [watermarkedFile, setWatermarkedFile] = useState<File | null>(null);
  const [watermarkedPreview, setWatermarkedPreview] = useState<string | null>(null);
  const [recoveredOrigPreview, setRecoveredOrigPreview] = useState<string | null>(null);
  const [extractedWmPreview, setExtractedWmPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [extractResult, setExtractResult] = useState<any>(null);

  const handleExtract = useCallback(async () => {
    if (!watermarkedFile) return;
    setProcessing(true);
    setProgress("Loading watermarked image...");

    try {
      const wmData = await loadImageFromFile(watermarkedFile);

      setProgress("Decoding hidden data (LSB extraction)...");
      await new Promise(r => setTimeout(r, 30));

      const result = await blindExtract(wmData);

      if (result.recoveredOriginal) {
        setRecoveredOrigPreview(imageDataToDataURL(result.recoveredOriginal));
      } else {
        setRecoveredOrigPreview(null);
      }

      if (result.extractedWatermark) {
        setExtractedWmPreview(imageDataToDataURL(result.extractedWatermark));
      } else {
        setExtractedWmPreview(null);
      }

      setExtractResult(result);
      setProgress("");
    } catch (err) {
      console.error("Extraction error:", err);
      setProgress("Error during extraction");
    } finally {
      setProcessing(false);
    }
  }, [watermarkedFile]);

  const downloadImage = (dataUrl: string, name: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name;
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Upload Section */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold font-heading text-foreground mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-accent" />
          Upload Watermarked Image
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Upload the watermarked image generated from the Embed section. The system will automatically recover both the original image and the watermark.
        </p>
        <ImageUpload
          label="Watermarked Image"
          description="Drop or select the watermarked .png file"
          onFileSelect={(f) => {
            setWatermarkedFile(f);
            setWatermarkedPreview(URL.createObjectURL(f));
            setRecoveredOrigPreview(null);
            setExtractedWmPreview(null);
            setExtractResult(null);
          }}
          preview={watermarkedPreview}
          onClear={() => {
            setWatermarkedFile(null);
            setWatermarkedPreview(null);
            setRecoveredOrigPreview(null);
            setExtractedWmPreview(null);
            setExtractResult(null);
          }}
        />
      </div>

      {/* Extract Button */}
      <Button
        onClick={handleExtract}
        disabled={!watermarkedFile || processing}
        className="w-full h-12 text-sm font-heading bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/25"
        size="lg"
      >
        {processing ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress || "Extracting..."}</>
        ) : (
          <><Unlock className="w-4 h-4 mr-2" />Extract & Recover Both Images</>
        )}
      </Button>

      {/* Results: side by side */}
      {extractResult && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recovered Original */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold font-heading text-foreground mb-3 flex items-center gap-2">
                {recoveredOrigPreview ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                Recovered Original Image
              </h3>
              {recoveredOrigPreview ? (
                <>
                  <img src={recoveredOrigPreview} alt="Recovered Original" className="w-full rounded-xl border border-border bg-muted" />
                  <Button onClick={() => downloadImage(recoveredOrigPreview, "recovered_original.png")}
                    variant="outline" className="w-full mt-3 border-success/30 text-success hover:bg-success/10" size="sm">
                    <Download className="w-3.5 h-3.5 mr-2" /> Download Original
                  </Button>
                </>
              ) : (
                <div className="h-48 rounded-xl border border-border bg-muted flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Could not recover — image may not contain embedded data</p>
                </div>
              )}
            </div>

            {/* Extracted Watermark */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold font-heading text-foreground mb-3 flex items-center gap-2">
                {extractedWmPreview ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                Extracted Watermark
              </h3>
              {extractedWmPreview ? (
                <>
                  <img src={extractedWmPreview} alt="Extracted Watermark" className="w-full rounded-xl border border-border bg-muted" />
                  <Button onClick={() => downloadImage(extractedWmPreview, "extracted_watermark.png")}
                    variant="outline" className="w-full mt-3 border-primary/30 text-primary hover:bg-primary/10" size="sm">
                    <Download className="w-3.5 h-3.5 mr-2" /> Download Watermark
                  </Button>
                </>
              ) : (
                <div className="h-48 rounded-xl border border-border bg-muted flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Could not extract watermark data</p>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          {extractResult.alpha > 0 && (
            <div className="glass-card p-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Detected Alpha (α)</span>
                  <span className="text-foreground font-mono">{extractResult.alpha.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing Time</span>
                  <span className="text-foreground font-mono">{extractResult.processingTimeMs?.toFixed(0)}ms</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
