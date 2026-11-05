/**
 * Contract for the in-browser image tools (background removal with BEN2, masked inpainting with LaMa).
 *
 * The runtime modules and their workers implement this interface. The UI handles preview, cancellation,
 * and saving results as new linked resources.
 *
 * Rules (docs/DESIGN_EDITOR.md, "Image tools"):
 * - Runs in the browser only. The user's pixels never leave the device; the only network traffic is downloading the
 *   model weights, from a source named in `ModelInfo`, and only after the user starts the tool.
 * - Results are new images; the original is never modified. Inpainting is a reconstruction, not recovery.
 * - No fallback that pretends: if the model can't load or run, the promise rejects with a plain message. Never a
 *   colour key or blur presented as the model's output.
 * - Cancellable at every stage through the AbortSignal; a cancelled run rejects with an AbortError and frees memory.
 */

export type ModelInfo = {
  /** e.g. "BEN2" or "LaMa". */
  name: string;
  licence: string;
  /** Where the weights are downloaded from (shown to the user before the first download). */
  source: string;
  /** Approximate download size in bytes, for the confirmation and progress. */
  bytes: number;
};

export type ToolProgress =
  | { stage: "download"; loaded: number; total: number | null }
  | { stage: "load" }
  | { stage: "run" }
  | { stage: "encode" };

export type ToolOptions = { signal?: AbortSignal; onProgress?: (p: ToolProgress) => void };

export type ToolResult = {
  /** PNG; RGBA for cutouts (transparent background), RGB(A) at the input's size for inpainting. */
  png: Blob;
  width: number;
  height: number;
  model: ModelInfo;
  /** Wall-clock milliseconds, for honest reporting (not a guarantee). */
  ms: { load: number; run: number };
};

export interface CutoutTool {
  readonly model: ModelInfo;
  /** Whether this browser can run it (WebGPU or WASM available), checked without downloading anything. */
  supported(): Promise<{ ok: true } | { ok: false; reason: string }>;
  removeBackground(image: Blob, opts?: ToolOptions): Promise<ToolResult>;
}

export interface InpaintTool {
  readonly model: ModelInfo;
  supported(): Promise<{ ok: true } | { ok: false; reason: string }>;
  /**
   * Fill the masked area. `mask` is a PNG the same size as `image`: white (255) = reconstruct, black = keep.
   * Pixels outside the mask must come back unchanged (byte-identical after compositing).
   */
  inpaint(image: Blob, mask: Blob, opts?: ToolOptions): Promise<ToolResult>;
}
