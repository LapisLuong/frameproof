import { localAiOrigin } from "./request";

export function authOrigin(env: NodeJS.ProcessEnv = process.env): URL | null {
  try {
    const url = new URL(env.AUTH_URL ?? "");
    if (url.href !== `${url.origin}/`) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) return null;
    if (!env.AUTH_GOOGLE_ID?.trim() || !env.AUTH_GOOGLE_SECRET?.trim() || (env.AUTH_SECRET?.trim().length ?? 0) < 32) return null;
    return url;
  } catch {
    return null;
  }
}

export function matchesAuthHost(req: Request, origin: URL): boolean {
  return (req.headers.get("host") ?? new URL(req.url).host).toLowerCase() === origin.host;
}

export function allowsLocalExport(req: Request, env: NodeJS.ProcessEnv = process.env): boolean {
  return !env.AUTH_URL && (env.NODE_ENV === "development" || env.FRAMEPROOF_LOCAL_EXPORTS === "1") && localAiOrigin(req) !== null;
}

export function safeAuthReturn(value: string, origin: URL): string {
  try {
    const to = new URL(value, origin);
    if (to.origin === origin.origin && !to.username && !to.password) return to.href;
  } catch { /* Fall back to the Desk. */ }
  return origin.href;
}
