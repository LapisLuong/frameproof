import type { EffectLayer } from "./schema";

/**
 * Light and texture layers drawn as plain SVG: gradients, Gaussian blur, seeded noise and seeded sparkles. Pure and
 * deterministic (same layer, same markup), so the editor, SVG export and PNG export agree. Nothing here reads pixels
 * or invents a picture; it only paints light over the layers beneath, with the chosen blend mode.
 */

const r = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ""));

/** Small seeded PRNG (mulberry32): the same seed always gives the same sparkles. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A four-pointed star centred on (cx, cy): long thin rays, the classic "sparkle". */
function starPath(cx: number, cy: number, size: number, thin = 0.16): string {
  const a = size;
  const b = size * thin;
  return `M${r(cx)} ${r(cy - a)}Q${r(cx + b)} ${r(cy - b)} ${r(cx + a)} ${r(cy)}Q${r(cx + b)} ${r(cy + b)} ${r(cx)} ${r(cy + a)}Q${r(cx - b)} ${r(cy + b)} ${r(cx - a)} ${r(cy)}Q${r(cx - b)} ${r(cy - b)} ${r(cx)} ${r(cy - a)}Z`;
}

export function effectSvg(l: EffectLayer, id: string, frame: string): string {
  const { x, y, w, h, color: c, intensity: k, spread: s } = l;
  const blend = l.blend === "normal" ? "" : `mix-blend-mode:${l.blend};`;
  const blurId = `${id}-blur`;
  const blurDef = l.blur > 0 ? `<filter id="${blurId}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${r(l.blur / 2)}"/></filter>` : "";
  const blurAttr = l.blur > 0 ? ` filter="url(#${blurId})"` : "";
  const open = (defs: string) => `<g data-layer="${l.id}" ${frame} style="${blend}"><defs>${defs}${blurDef}</defs><g${blurAttr}>`;
  const close = `</g></g>`;
  const cx = x + w / 2;
  const cy = y + h / 2;

  switch (l.effect) {
    case "glow": {
      // Radial light: full colour at the centre, fading out; spread pushes the solid core outwards.
      const core = r(Math.round(s * 60));
      const defs = `<radialGradient id="${id}-g"><stop offset="0%" stop-color="${c}" stop-opacity="${r(k)}"/><stop offset="${core}%" stop-color="${c}" stop-opacity="${r(k * 0.75)}"/><stop offset="100%" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
      return `${open(defs)}<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(w / 2)}" ry="${r(h / 2)}" fill="url(#${id}-g)"/>${close}`;
    }
    case "beam": {
      // A shaft of light from the top edge of the box, widening downwards and fading out; spread = how much it widens.
      const top = w * (0.15 + 0.35 * (1 - s));
      const pts = [`${r(cx - top / 2)},${r(y)}`, `${r(cx + top / 2)},${r(y)}`, `${r(x + w)},${r(y + h)}`, `${r(x)},${r(y + h)}`].join(" ");
      const defs =
        `<linearGradient id="${id}-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${c}" stop-opacity="${r(k)}"/><stop offset="70%" stop-color="${c}" stop-opacity="${r(k * 0.35)}"/><stop offset="100%" stop-color="${c}" stop-opacity="0"/></linearGradient>` +
        `<linearGradient id="${id}-hz" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#fff" stop-opacity="0"/><stop offset="50%" stop-color="#fff" stop-opacity="1"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
        `<mask id="${id}-m" maskUnits="userSpaceOnUse" x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}"><rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="url(#${id}-hz)"/></mask>`;
      return `${open(defs)}<polygon points="${pts}" fill="url(#${id}-v)" mask="url(#${id}-m)"/>${close}`;
    }
    case "trail": {
      // A curved stroke of light across the box, bright core over a soft halo; spread = width; curve = bend.
      const bend = l.curve * h;
      const d = `M${r(x)} ${r(y + h * 0.75)}Q${r(cx)} ${r(cy - bend)} ${r(x + w)} ${r(y + h * 0.25)}`;
      const width = Math.max(1, Math.min(w, h) * (0.01 + 0.08 * s));
      const defs = `<linearGradient id="${id}-t" gradientUnits="userSpaceOnUse" x1="${r(x)}" y1="0" x2="${r(x + w)}" y2="0"><stop offset="0%" stop-color="${c}" stop-opacity="0"/><stop offset="45%" stop-color="${c}" stop-opacity="${r(k)}"/><stop offset="100%" stop-color="${c}" stop-opacity="${r(k * 0.2)}"/></linearGradient><filter id="${id}-halo" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${r(width * 1.5)}"/></filter>`;
      return `${open(defs)}<path d="${d}" fill="none" stroke="url(#${id}-t)" stroke-width="${r(width * 3)}" stroke-linecap="round" filter="url(#${id}-halo)"/><path d="${d}" fill="none" stroke="url(#${id}-t)" stroke-width="${r(width)}" stroke-linecap="round"/>${close}`;
    }
    case "sparkle": {
      // Seeded four-point stars scattered in the box; spread = how many; one or two larger "hero" sparkles.
      const rand = seeded(l.seed);
      const count = Math.max(1, Math.round(1 + s * 23));
      const base = Math.min(w, h) * 0.08;
      let stars = "";
      for (let i = 0; i < count; i++) {
        const px = x + rand() * w;
        const py = y + rand() * h;
        const hero = i < Math.min(2, count) ? 1 : 0;
        const size = base * (hero ? 0.9 + rand() * 0.6 : 0.2 + rand() * 0.45);
        const op = k * (hero ? 1 : 0.45 + rand() * 0.55);
        stars += `<path d="${starPath(px, py, size)}" fill="${c}" fill-opacity="${r(op)}"/>`;
      }
      return `${open("")}${stars}${close}`;
    }
    case "grain": {
      // Seeded fractal noise, kept to the box; spread = coarseness, intensity = how visible.
      const freq = 0.9 - s * 0.75;
      const defs = `<filter id="${id}-n" x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="${r(freq)}" numOctaves="2" seed="${l.seed}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 ${hexUnit(c, 0)} 0 0 0 0 ${hexUnit(c, 1)} 0 0 0 0 ${hexUnit(c, 2)} 0 0 0 ${r(k * 1.4)} -${r(k * 0.5)}"/></filter>`;
      return `${open(defs)}<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" filter="url(#${id}-n)"/>${close}`;
    }
    case "vignette": {
      // Clear centre, colour at the edges; spread = how far in the edge colour reaches.
      const clear = r(Math.round((1 - s) * 70));
      const defs = `<radialGradient id="${id}-g" cx="50%" cy="50%" r="72%"><stop offset="${clear}%" stop-color="${c}" stop-opacity="0"/><stop offset="100%" stop-color="${c}" stop-opacity="${r(k)}"/></radialGradient>`;
      return `${open(defs)}<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="url(#${id}-g)"/>${close}`;
    }
  }
}

/** One channel of a #rrggbb colour as 0..1, for the noise colour matrix. */
function hexUnit(hex: string, channel: 0 | 1 | 2): string {
  return r(parseInt(hex.slice(1 + channel * 2, 3 + channel * 2), 16) / 255);
}
