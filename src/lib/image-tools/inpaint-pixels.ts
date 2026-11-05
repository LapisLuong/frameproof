/** Composite reconstructed RGB only into the white mask; every other original RGBA byte is retained. */
export function compositeInpaint(original: Uint8ClampedArray, reconstructed: Uint8ClampedArray, mask: Uint8ClampedArray): Uint8ClampedArray<ArrayBuffer> {
  if (original.length !== reconstructed.length || original.length !== mask.length || original.length % 4) throw new Error("Image and mask dimensions don't match.");
  const out = new Uint8ClampedArray(original);
  for (let i = 0; i < out.length; i += 4) {
    if (mask[i]! >= 128 && mask[i + 1]! >= 128 && mask[i + 2]! >= 128 && mask[i + 3]! > 0) {
      out[i] = reconstructed[i]!;
      out[i + 1] = reconstructed[i + 1]!;
      out[i + 2] = reconstructed[i + 2]!;
    }
  }
  return out;
}

/** Convert model CHW RGB values (0..255) into opaque RGBA. */
export function inpaintRgb(data: ArrayLike<number>, size: number): Uint8ClampedArray<ArrayBuffer> {
  if (data.length !== size * 3) throw new Error("The inpainting model returned an unexpected image size.");
  const rgba = new Uint8ClampedArray(size * 4);
  for (let i = 0; i < size; i++) {
    for (let channel = 0; channel < 3; channel++) {
      const value = data[channel * size + i]!;
      if (!Number.isFinite(value)) throw new Error("The inpainting model returned invalid pixels.");
      rgba[i * 4 + channel] = Math.max(0, Math.min(255, Math.round(value)));
    }
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}
