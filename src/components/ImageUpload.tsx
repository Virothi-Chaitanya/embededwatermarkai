import { useCallback, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ImageUploadProps {
  label: string;
  description?: string;
  onFileSelect: (file: File) => void;
  preview?: string | null;
  onClear?: () => void;
  accept?: string;
}

export function ImageUpload({ label, description, onFileSelect, preview, onClear, accept = "image/png,image/jpeg" }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground font-heading">{label}</label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      
      <AnimatePresence mode="wait">
        {preview ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative rounded-lg overflow-hidden border border-border bg-card"
          >
            <img src={preview} alt={label} className="w-full h-48 object-contain bg-muted/50" />
            {onClear && (
              <button
                onClick={onClear}
                className="absolute top-2 right-2 p-1 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-destructive hover:border-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed transition-all cursor-pointer
              ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground bg-card/50"}`}
          >
            <input
              type="file"
              accept={accept}
              onChange={handleChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className={`p-3 rounded-full transition-colors ${isDragging ? "bg-primary/10" : "bg-muted"}`}>
              {isDragging ? <ImageIcon className="w-6 h-6 text-primary" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Drop image here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">PNG or JPG, max 5MB</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
