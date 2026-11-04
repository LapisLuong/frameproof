# Font sources

All families are licensed under the SIL Open Font License 1.1; each licence is next to the files (`OFL-*.txt`).
Copies in `public/fonts` are byte-identical and exist so exported SVGs can embed the faces.

Interface and artwork: Lora, Be Vietnam Pro, IBM Plex Mono (github.com/google/fonts).

Artwork only (poster pack, checked by Codex desktop on 2026-11-04: source URL, git blob id and SHA-256 in
`poster-fonts-manifest.json`; all 134 Vietnamese code points present in every file, `poster-fonts-glyph-check.json`).
Files were renamed only to drop the axis brackets; bytes are unchanged (SHA-256 below re-checked on copy).

| File here | Original in google/fonts | SHA-256 |
|---|---|---|
| Anton-Regular.ttf | ofl/anton/Anton-Regular.ttf | a4ba3a92350ebb031da0cb47630ac49eb265082ca1bc0450442f4a83ab947cab |
| Archivo-Variable.ttf | ofl/archivo/Archivo[wdth,wght].ttf | 0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053 |
| Archivo-Italic-Variable.ttf | ofl/archivo/Archivo-Italic[wdth,wght].ttf | 305d13b4eb80e62f7d517f78d7c045250d977552a420f2dbed906f314e761305 |
| Fraunces-Variable.ttf | ofl/fraunces/Fraunces[SOFT,WONK,opsz,wght].ttf | 177ff6c0f14e5550a3c624247cd1189611d4eb65d000b14944c63d967958abbb |
| Fraunces-Italic-Variable.ttf | ofl/fraunces/Fraunces-Italic[SOFT,WONK,opsz,wght].ttf | b24448c43702fac4ee856781d461a0dfba8d8e594b6e8e190234b75fed2c0e01 |
| PlayfairDisplay-Variable.ttf | ofl/playfairdisplay/PlayfairDisplay[wght].ttf | c40f2293766a503bc70cce9e512ef844a4ccb7cbcde792fe2ea31d191917d8d6 |
| PlayfairDisplay-Italic-Variable.ttf | ofl/playfairdisplay/PlayfairDisplay-Italic[wght].ttf | a5e26dc5e2e77fb2803a0bf02fd4f81ee136ec8dea863ccdb0c59a263b21378b |

Bodoni Moda was considered and left out: its metadata doesn't declare Vietnamese support.
