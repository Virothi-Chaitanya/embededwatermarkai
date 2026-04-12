import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Unlock, Download, CheckCircle2, XCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { loadImageFromFile, imageDataToDataURL } from "@/utils/imageUtils";
import { blindExtract } from "@/utils/reversible";
import { extractShareablePayload } from "@/utils/shareablePayload";

interface RecoveredAsset {
  url: string;
  name: string;
}

export function ReversibleExtractModule() {
  const [watermarkedFile, setWatermarkedFile] = useState<File | null>(null);
  const [watermarkedPreview, setWatermarkedPreview] = useState<string | null>(null);
  const [recoveredOrigPreview, setRecoveredOrigPreview] = useState<string | null>(null);
  const [extractedWmPreview, setExtractedWmPreview] = useState<string | null>(null);
  const [recoveredOrigDownload, setRecoveredOrigDownload] = useState<RecoveredAsset | null>(null);
  const [extractedWmDownload, setExtractedWmDownload] = useState<RecoveredAsset | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [extractResult, setExtractResult] = useState<any>(null);

  useEffect(() => {
    return () => {
      if (recoveredOrigDownload?.url) URL.revokeObjectURL(recoveredOrigDownload.url);
      if (extractedWmDownload?.url) URL.revokeObjectURL(extractedWmDownload.url);
    };
  }, [recoveredOrigDownload, extractedWmDownload]);

  const clearRecoveredOutputs = useCallback(() => {
    setRecoveredOrigPreview(null);
    setExtractedWmPreview(null);
    setExtractResult(null);
    setRecoveredOrigDownload((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
    setExtractedWmDownload((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  const handleExtract = useCallback(async () => {
    if (!watermarkedFile) return;
    setProcessing(true);
    setProgress("Loading watermarked image...");

    try {
      clearRecoveredOutputs();
      const packagedPayload = await extractShareablePayload(watermarkedFile);

      if (packagedPayload) {
        const originalUrl = URL.createObjectURL(new Blob([packagedPayload.original.bytes], { type: packagedPayload.original.mimeType }));
        const watermarkUrl = URL.createObjectURL(new Blob([packagedPayload.watermark.bytes], { type: packagedPayload.watermark.mimeType }));
        setRecoveredOrigPreview(originalUrl);
        setExtractedWmPreview(watermarkUrl);
        setRecoveredOrigDownload({ url: originalUrl, name: packagedPayload.original.fileName });
        setExtractedWmDownload({ url: watermarkUrl, name: packagedPayload.watermark.fileName });
        setExtractResult({ alpha: packagedPayload.alpha, processingTimeMs: 0, source: "payload" });
        setProgress("");
        return;
      }

      const wmData = await loadImageFromFile(watermarkedFile);

      setProgress("Decoding hidden data (LSB extraction)...");
      await new Promise(r => setTimeout(r, 30));

      const result = await blindExtract(wmData);

      if (result.recoveredOriginal) {
        const preview = imageDataToDataURL(result.recoveredOriginal);
        setRecoveredOrigPreview(preview);
        setRecoveredOrigDownload({ url: preview, name: "recovered_original.png" });
      } else {
        setRecoveredOrigPreview(null);
      }

      if (result.extractedWatermark) {
        const preview = imageDataToDataURL(result.extractedWatermark);
        setExtractedWmPreview(preview);
        setExtractedWmDownload({ url: preview, name: "extracted_watermark.png" });
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
  }, [watermarkedFile, clearRecoveredOutputs]);

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
          Upload the exact PNG downloaded from the Embed section. Anyone with that file can recover both the original image and the watermark.
        </p>
        <ImageUpload
          label="Watermarked Image"
          description="Drop or select the watermarked .png file"
          onFileSelect={(f) => {
            setWatermarkedFile(f);
            setWatermarkedPreview(URL.createObjectURL(f));
            clearRecoveredOutputs();
          }}
          preview={watermarkedPreview}
          onClear={() => {
            setWatermarkedFile(null);
            setWatermarkedPreview(null);
            clearRecoveredOutputs();
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
                  <Button onClick={() => recoveredOrigDownload && downloadImage(recoveredOrigDownload.url, recoveredOrigDownload.name)}
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
                  <Button onClick={() => extractedWmDownload && downloadImage(extractedWmDownload.url, extractedWmDownload.name)}
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
                  <span className="text-muted-foreground">Recovery Mode</span>
                  <span className="text-foreground font-mono">{extractResult.source === "payload" ? "Exact Share" : "Legacy LSB"}</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
