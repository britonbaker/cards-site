# CLAUDE.md — cards-site

Interactive shader-based game card showcase. Three cards with WebGL shader backgrounds, detail views with per-game shaders + procedural music. Deployed at [britonbaker.github.io/cards-site](https://britonbaker.github.io/cards-site).

## File Structure

- `index.html` — Layout, card markup, inline per-card shader scripts (Cube Runner ASCII, Signal Drift isometric cubes, Crystal Core ASCII), magnetic card hover effect
- `main.js` — All logic: music player (Web Audio API procedural synthesis), card slot animation (GSAP), game manager (Three.js detail views), piano roll editor (Crystal Core only), sound effects, URL routing, visualizer
- `style.css` — All styles including responsive breakpoints, piano roll editor UI, slot/glow animations
- `server.js` — Dev server with SPA fallback (`node server.js`, port 3002)
- `404.html` — Custom GitHub Pages 404 (redirects to index for SPA routing)

## The 3 Cards

| Card | Card Shader | Detail Shader | Music |
|------|-------------|---------------|-------|
| **Cube Runner** | ASCII characters (fbm noise, mouse ripple) on light blue | ASCII with font atlas + Sobel edge detection over 3D cube | 140 BPM chiptune — square lead, sawtooth bass, drums, strings |
| **Signal Drift** | Isometric cube grid (pink/purple/teal, mouse push) | Same isometric shader sampling 3D torus wireframe | 88 BPM warm electronic — triangle arps with tape wobble, sub bass pads |
| **Crystal Core** | Red/purple ASCII characters (fbm noise, mouse ripple) | Red ASCII shader sampling 3D icosahedron + interactive piano roll | 160 BPM energetic — editable melody/drums/bass via piano roll |

## Key Architecture

- **Card backgrounds**: Inline `<script>` blocks in index.html create WebGL contexts per card canvas
- **Detail views**: `gameManager` creates Three.js scenes rendered to offscreen canvas, then a second WebGL shader (ASCII or isometric) reads the offscreen canvas as a texture
- **Music**: Fully procedural via Web Audio API oscillators — no audio files
- **Piano roll** (Crystal Core): Full MIDI-style editor with melody, drums, bass tracks; patterns saved to localStorage
- **Slot animation**: GSAP timeline — card slides into slot bar, other cards fly away, content area appears

## Dependencies (CDN)

- Three.js r128: `cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
- GSAP 3.12.2: `cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js`
- HugeIcons (stroke): `cdn.hugeicons.com/font/hgi-stroke-rounded.css`
- GoatCounter analytics

## Font

`GeistPixel-Square.woff2` in `assets/` — bitmap pixel font used for card labels and the shader font atlas (Cube Runner detail view builds a canvas atlas from this font for edge-aware ASCII rendering).

## Deploy

GitHub Pages from `main` branch — push to main = live. No build step.

## Dev

```bash
node server.js  # http://localhost:3002
```

## Expansion Plans

See [CARD-SYSTEM-PLANNING.md](./CARD-SYSTEM-PLANNING.md) for future card ideas and architecture plans.
