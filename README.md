# Squish.

Type a word. It turns into a block of jelly. Drag it, poke it, drop a weight on it. A counter tracks how much stress you have released, and the Record button makes a 6 second clip with that counter in it.

Everything runs in the browser: no backend, no accounts, no analytics, no requests to anything but the page's own files.

## Run

```sh
npm install
npm run dev
```

Open the printed URL. On a phone on the same network, use the `Network` URL Vite prints.

## Build and deploy

```sh
npm run build     # static site in dist/
npm run preview   # serve dist/ locally to check it
```

`dist/` is a plain static folder with relative paths, so it works at a domain root or in a subfolder.

- **Vercel:** import the repo. Framework preset Vite, build command `npm run build`, output directory `dist`.
- **Netlify:** build command `npm run build`, publish directory `dist`. Or drag `dist/` onto the Netlify dashboard.
- **Anywhere else:** upload the contents of `dist/`.

## Controls

| Input | What it does |
| --- | --- |
| Drag | Grabs the surface and pulls. The letter leans and stretches with it, then snaps back. |
| Tap | Squash impulse where you tap. Holding longer presses deeper and hits harder. |
| Double tap | Drops a weight on the nearest letter. |
| Two fingers | Each finger grabs the jelly. Off the jelly, pinch squashes and twist sways. |
| Nudge / Reset / Mute | A random poke / back to rest and 0% / sound off (remembered). |
| Record | 6 second clip of the jelly with the word, counter and watermark. |
| Screenshot | PNG of the same frame. |

Recording crops to 9:16 by default. 1:1 and 16:9 are in the Capture section (under More on phones).

## Tuning

Every feel and look number lives in [`src/config.js`](src/config.js), each with a one-line comment. Good places to start:

- `APP.url` is the short URL drawn under the watermark in clips and screenshots. Change it before posting.
- `SIM.spring`, `SIM.damping`, `SIM.coupling`, `SIM.pressure` shape the jelly itself.
- `MODES.*` is the whole-letter sway and squash layered on top.
- `INPUT.*` covers grab radius, poke strength, drag limits and how much of a drag the letter leans into.
- `STRESS.scale` sets how fast the counter climbs. At 1.0 it takes about 40 seconds of steady play to finish.
- `FLAVORS` holds the colors.

## How it works

- **Geometry** (`src/geometry.js`): the TTF is loaded with three's `TTFLoader`. Each glyph is extruded with `TextGeometry` and a deep bevel, and `mergeVertices` fuses the hard edges so the surface is closed. Each letter is dropped so it rests on its own lowest point. A red-green subdivision then splits long edges until the vertex budget (about 26k) is met. Flat faces get finer triangles than bevels. Splits are decided per edge, so there are no T-junctions to crack open when it bends. Vertices are then sorted along a Morton curve so the simulation reads memory in order.
- **Soft body** (`src/jelly.js`): per-vertex offset and velocity in typed arrays, stepped at a fixed 1/120 s with a substep cap. The forces:
  - a spring to rest, stiffer near the floor
  - damping
  - Laplacian neighbor coupling, with a little velocity smoothing so it never buzzes
  - a pressure term from a blurred grid of "how far in is the surface here", so a dent makes the surrounding surface bulge out
  - a stiffening soft limit plus a hard clamp, so it cannot tear or explode

  On top of that, each letter has a small sway and squash oscillator anchored at the floor and chained to its neighbors. That is what makes the whole word wobble. Normals are recomputed every frame. When nothing moves, the per-vertex layer sleeps and only the idle breathing runs.
- **Look** (`src/material.js`, `src/scene.js`): `MeshPhysicalMaterial` with transmission, IOR 1.4, clearcoat and attenuation color, rendered double sided so you see the inner walls through the front. `RoomEnvironment` lighting, ACES tone mapping, a gradient backdrop, and tiny specks and bubbles inside the letters that ride along with the wobble. The contact shadow and colored light pool are multiplied onto the floor in the opaque pass, so they also show through the jelly.
- **Capture** (`src/record.js`): each frame the WebGL canvas crop, the word, the counter and the watermark are drawn into an offscreen 2D canvas, which is recorded with `captureStream(60)` and `MediaRecorder`. MIME type is picked at runtime: MP4 (H.264, with AAC sound when the browser can) first, then WebM. The preview offers Share where `navigator.share` accepts files, and Download everywhere.
- **Sound** (`src/audio.js`): Web Audio only. Squelches are filtered noise with a falling tone, the thump is a pitched-down sine with low noise, ticks mark each 25%.

## Performance

Measured on a slow 2.8 GHz cloud CPU: about 8 to 10 ms of simulation per frame while the jelly moves at the default budget, and near zero at rest. A recent laptop or phone runs JavaScript roughly twice as fast. If frames stay slow for a few seconds, the pixel ratio steps down (2, 1.5, 1.25, 1), then the mesh is rebuilt at a lower vertex budget. The loop pauses while the tab is hidden. `prefers-reduced-motion` turns off camera drift, parallax and screen shake.

Debug URL flags: `?fixed` turns off automatic quality changes, `?pr=1` forces a pixel ratio, `?debug` exposes the app as `window.squish` in production builds.

## Notes

- three's `TTFLoader` imports opentype.js from a CDN. `vite.config.js` aliases that URL to the local `opentype.js` package, so it is bundled and nothing is fetched at runtime.
- Fonts are bundled from `src/fonts/`: Titan One (the jelly), Instrument Serif (display), IBM Plex Mono (labels). All are under the SIL Open Font License; the license texts sit next to the files. The UI fonts are subset to Latin.
- Browser support for recording: Chrome and Edge record MP4 (WebM on older versions), Safari records MP4, Firefox records WebM.
