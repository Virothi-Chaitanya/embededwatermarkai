const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAGIC = encoder.encode("IRWS_SHARE_V1");

export interface ShareableRecoveredImage {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}

export interface ShareablePayloadResult {
  alpha: number;
  original: ShareableRecoveredImage;
  watermark: ShareableRecoveredImage;
}

function createLengthBlock(originalLength: number, watermarkLength: number, metaLength: number): Uint8Array {
  const buffer = new ArrayBuffer(12);
  const view = new DataView(buffer);
  view.setUint32(0, originalLength);
  view.setUint32(4, watermarkLength);
  view.setUint32(8, metaLength);
  return new Uint8Array(buffer);
}

async function imageDataToPngBlob(imageData: ImageData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to create shareable PNG"));
    }, "image/png");
  });
}

export async function createShareableWatermarkedBlob(
  watermarkedImageData: ImageData,
  originalFile: File,
  watermarkFile: File,
  alpha: number
): Promise<{ blob: Blob; outputBytes: number; payloadBytes: number }> {
  const pngBlob = await imageDataToPngBlob(watermarkedImageData);
  const [originalBytes, watermarkBytes] = await Promise.all([
    originalFile.arrayBuffer(),
    watermarkFile.arrayBuffer(),
  ]);

  const metadata = encoder.encode(JSON.stringify({
    alpha,
    originalName: originalFile.name,
    originalType: originalFile.type || "image/png",
    watermarkName: watermarkFile.name,
    watermarkType: watermarkFile.type || "image/png",
  }));

  const lengthBlock = createLengthBlock(originalBytes.byteLength, watermarkBytes.byteLength, metadata.length);
  const blob = new Blob(
    [pngBlob, originalBytes, watermarkBytes, metadata, lengthBlock, MAGIC],
    { type: "image/png" }
  );

  return {
    blob,
    outputBytes: blob.size,
    payloadBytes: originalBytes.byteLength + watermarkBytes.byteLength + metadata.length,
  };
}

export async function extractShareablePayload(file: File): Promise<ShareablePayloadResult | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length <= MAGIC.length + 12) return null;

  const magicStart = bytes.length - MAGIC.length;
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[magicStart + i] !== MAGIC[i]) return null;
  }

  const lengthsStart = magicStart - 12;
  if (lengthsStart < 0) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset + lengthsStart, 12);
  const originalLength = view.getUint32(0);
  const watermarkLength = view.getUint32(4);
  const metaLength = view.getUint32(8);
  const metaStart = lengthsStart - metaLength;
  const watermarkStart = metaStart - watermarkLength;
  const originalStart = watermarkStart - originalLength;

  if (originalStart < 0 || watermarkStart < 0 || metaStart < 0) return null;

  try {
    const metadata = JSON.parse(decoder.decode(bytes.slice(metaStart, lengthsStart)));
    return {
      alpha: Number(metadata.alpha) || 0,
      original: {
        bytes: bytes.slice(originalStart, watermarkStart),
        mimeType: metadata.originalType || "image/png",
        fileName: metadata.originalName || "recovered_original",
      },
      watermark: {
        bytes: bytes.slice(watermarkStart, metaStart),
        mimeType: metadata.watermarkType || "image/png",
        fileName: metadata.watermarkName || "extracted_watermark",
      },
    };
  } catch {
    return null;
  }
}