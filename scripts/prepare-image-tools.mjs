import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Reproducible local runtime assets. No model weights or user content are downloaded during build.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = path.join(root, "node_modules");
const output = path.join(root, "public/image-tools/runtime");
const hf = path.join(modules, "@huggingface/transformers");
const ort = path.join(modules, "onnxruntime-web");
const versions = { transformers: "4.3.2", onnxruntime: "1.31.0-dev.20260914-8d85527a0" };
for (const [dir, expected] of [[hf, versions.transformers], [ort, versions.onnxruntime]]) {
  const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
  if (pkg.version !== expected) throw new Error(`Image runtime version mismatch: ${pkg.name}. Run npm ci.`);
}
await mkdir(output, { recursive: true });
const files = {};
async function emit(name, bytes) {
  await writeFile(path.join(output, name), bytes);
  files[name] = { bytes: Buffer.byteLength(bytes), sha256: createHash("sha256").update(bytes).digest("hex") };
}
let bundle = await readFile(path.join(hf, "dist/transformers.web.js"), "utf8");
for (const specifier of ["onnxruntime-web/webgpu", "onnxruntime-common"]) {
  const needle = `from "${specifier}"`;
  if (bundle.split(needle).length !== 2) throw new Error(`Unexpected Transformers import: ${specifier}`);
  bundle = bundle.replace(needle, 'from "./ort.webgpu.bundle.min.mjs"');
}
// Both imports share one ORT instance. Keeping them separate creates incompatible Tensor environments.
await emit("transformers.web.js", bundle);
for (const name of ["ort.webgpu.bundle.min.mjs", "ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm", "ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"]) {
  await emit(name, await readFile(path.join(ort, "dist", name)));
}
await emit("TRANSFORMERS-LICENSE.txt", await readFile(path.join(hf, "LICENSE")));
await emit("ONNXRUNTIME-LICENSE.txt", `MIT License

Copyright (c) Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`);
await writeFile(path.join(output, "manifest.json"), JSON.stringify({ versions, files }, null, 2) + "\n");
console.log(`Prepared local image runtime (${Math.round(Object.values(files).reduce((n, f) => n + f.bytes, 0) / 1024 / 1024)} MB). Models download only when a tool is started.`);
