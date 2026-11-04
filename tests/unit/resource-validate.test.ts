import { expect, it } from "vitest";
import { sniffFont, sniffResource, validateFontFile } from "@/lib/design/resource-validate";
import { MAX_FONT_BYTES } from "@/lib/design/resource";
const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
it.each([["\0\x01\0\0", "font/ttf"], ["true", "font/ttf"], ["OTTO", "font/otf"], ["wOFF", "font/woff"], ["wOF2", "font/woff2"]])("accepts %s by signature", (signature, mime) => {
  expect(sniffFont(bytes(signature))).toBe(mime); expect(validateFontFile(bytes(signature))).toEqual({ ok: true, mime }); expect(sniffResource(bytes(signature))).toBe(mime);
});
it("rejects empty, oversized, renamed images and text fonts", () => {
  for (const b of [new Uint8Array(), new Uint8Array(MAX_FONT_BYTES + 1), bytes("hello.ttf"), Uint8Array.of(137,80,78,71,13,10,26,10)]) expect(validateFontFile(b).ok).toBe(false);
  expect(sniffFont(bytes("OTT"))).toBeNull();
});
it.each([[Uint8Array.of(137,80,78,71,13,10,26,10), "image/png"], [Uint8Array.of(255,216,255), "image/jpeg"], [bytes("GIF89a"), "image/gif"], [bytes("RIFFxxxxWEBP"), "image/webp"], [bytes("unknown"), null]])("sniffs image signatures", (b, mime) => expect(sniffResource(b)).toBe(mime));
