// Static build for GitHub Pages. The AI route needs a server, so it is moved aside for the
// duration of the build and always restored. Output: ./out
//   NEXT_PUBLIC_BASE_PATH=/frameproof npm run build:static
import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

const api = "src/app/api";
const parked = ".api-parked";
if (existsSync(parked)) throw new Error(`${parked} exists from an interrupted build; move it back to ${api} first.`);
renameSync(api, parked);
let status = 1;
try {
  const r = spawnSync("npx", ["next", "build"], { stdio: "inherit", env: { ...process.env, STATIC_EXPORT: "1" } });
  status = r.status ?? 1;
} finally {
  renameSync(parked, api);
}
process.exit(status);
