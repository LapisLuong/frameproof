import type { ModelInfo, ToolProgress, ToolResult } from "./types";

export const BEN2_REVISION = "c552aa82688edce09f0ac9d2e31ad53d9d629010";
export const BEN2_MODEL: ModelInfo = {
  name: "BEN2",
  licence: "MIT",
  source: `https://huggingface.co/onnx-community/BEN2-ONNX/tree/${BEN2_REVISION}`,
  bytes: 219_121_675,
};

/** A bounded preview/resource raster; the result reports its real dimensions, never the original's size. */
export const CUTOUT_MAX_SIDE = 512;
/** The alpha mask is resized onto original RGB, keeping detail without upscaling the whole low-res inference. */
export const CUTOUT_OUTPUT_MAX_SIDE = 2048;
export type CutoutRequest = { image: Blob; runtimeUrl: string; wasmBase: string };
export type CutoutMessage =
  | { type: "progress"; progress: ToolProgress }
  | { type: "result"; result: ToolResult }
  | { type: "error"; error: string };
