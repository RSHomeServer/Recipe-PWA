/**
 * Resize and center-crop a user image for recipe storage.
 * Output is JPEG (or PNG when the source has transparency and we keep PNG),
 * capped at max edge while preserving a fixed aspect ratio.
 */

export type ResizedRecipeImage = {
  blob: Blob;
  width: number;
  height: number;
};

export type ResizeRecipeImageOptions = {
  /** Longest edge after resize (default 1200). */
  maxEdge?: number;
  /** Width / height (default 4/3 banner). */
  aspect?: number;
  /** JPEG quality 0–1 (default 0.85). */
  quality?: number;
};

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

/**
 * Center-crop to `aspect`, then scale so the longest edge ≤ `maxEdge`.
 */
export async function resizeRecipeImage(
  source: Blob,
  options: ResizeRecipeImageOptions = {},
): Promise<ResizedRecipeImage> {
  const maxEdge = options.maxEdge ?? 1200;
  const aspect = options.aspect ?? 4 / 3;
  const quality = options.quality ?? 0.85;

  const img = await loadImage(source);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (srcW <= 0 || srcH <= 0) {
    throw new Error("Image has invalid dimensions");
  }

  let cropW = srcW;
  let cropH = srcW / aspect;
  if (cropH > srcH) {
    cropH = srcH;
    cropW = srcH * aspect;
  }
  const sx = (srcW - cropW) / 2;
  const sy = (srcH - cropH) / 2;

  let outW = Math.round(cropW);
  let outH = Math.round(cropH);
  const longEdge = Math.max(outW, outH);
  if (longEdge > maxEdge) {
    const scale = maxEdge / longEdge;
    outW = Math.max(1, Math.round(outW * scale));
    outH = Math.max(1, Math.round(outH * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not available");
  }
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);

  const mimeType =
    source.type === "image/png" || source.type === "image/webp"
      ? "image/jpeg"
      : source.type.startsWith("image/")
        ? "image/jpeg"
        : "image/jpeg";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("Could not encode image"));
          return;
        }
        resolve(result);
      },
      mimeType,
      quality,
    );
  });

  return { blob, width: outW, height: outH };
}
