/**
 * Path prefix when the app is served from a sub-folder (GitHub Pages serves it at /frameproof).
 * Next.js adds it to <Link> and router paths itself; plain fetch() calls need it added by hand.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** True in the static build: there is no server, so the AI route doesn't exist. */
export const STATIC_EXPORT = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

export const withBase = (path: string) => `${BASE_PATH}${path}`;
