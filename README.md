# Squishi.

A very small sushi bar where everything wobbles. Soft mochi animals order nigiri. Each ticket carries a photo of the plate they want. You make it across four stations, each with its own camera angle, and get scored on how close you got. At the end of a shift your best plates can go up on a shared wall next to everyone else's.

The word toy that started this, **Squish.**, is still here as the Break room at `/break.html`.

The game runs in the browser. The only server part is the wall: one small function that stores plate photos and a board of best shifts. There are no accounts, no analytics and no cookies. The wall keeps only the name a player types and their plate photos.

## How to play

| Station | Angle | What you do |
| --- | --- | --- |
| 01 Counter 受付 | Eye level, across the bar | A guest hops in and pins an order ticket with a photo of the plate they want. Take the order. Poke the guest if you like. |
| 02 Rice 酢飯 | Over the rice tub | Hold to scoop, let go inside the green band. Then hold to press and let go in the green, three times. Press too hard and the rice squashes flat. |
| 03 Knife 包丁 | Low, along the cutting board | Swipe down through the fish block along the dashed guide. Angle and thickness are scored. Salmon and tuna want a 45° cut, egg a straight one. |
| 04 Build 盛付 | Three quarters, over the serving board | Tap the rice for wasabi (one tap per dab), drag a slice onto the rice, then add the toppings on the ticket. Serve. |

The guest eats it in three bites and reacts. Each plate is scored on rice, cut, build and wait time, and tips follow the score.

### The cast

The guests are mochi animals: a calico cat, a shiba, a bunny, a bear, a panda and a fox. Each is a soft body with fur markings drawn in the shader. Ears, eyes, blush, nose, whiskers and mouth are pinned to the surface and follow every squash. Ears droop when a guest waits too long, and eyes close into happy arcs at a great plate.

Pochi, the shiba sous chef, sits on the counter in a chef's toque. He greets each guest, cheers good plates and frets over bad ones. The chef is a cat: a paw cups the rice when you scoop and presses it on the mat.

### The wall

At the end of a shift, the summary shows today's plate photos. Type a name and post: your three best plates go up on the wall, and the shift goes on a board ranked by tips. The wall is also on the title screen.

- `api/gallery.js` is a Vercel function. It needs a Redis REST store: add **Upstash for Redis** (or Vercel KV) to the project in the Vercel dashboard under Storage. That sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`).
- Without a store, the wall still works but only shows the player's own shifts, saved in their browser, and says so.
- `npm run dev` and `npm run preview` serve the same API from memory, so the wall works locally with no setup. It resets when the server restarts.
- Limits: names up to 16 letters, numbers, spaces and `._'-`. Photos are small JPEG data URLs (320 by 200, under 60 KB). Six posts per visitor per minute. The newest 48 plates and the best 100 shifts are kept.

- **Day 1:** salmon only.
- **Day 2:** tuna, sesame and scallion.
- **Day 3:** egg, ikura and sweet sauce.

An average of 50 or more unlocks the next day. Progress is kept in the browser.

Keys: `1` to `4` switch stations; hold `Space` to scoop and press; `Esc` pauses (resume, restart the day or quit to the title). The pause button in the top bar does the same on phones.

The ticket ticks off each request as you go: wasabi and ikura show a count (`Wasabi 2/3`, `Ikura 4/5`), toppings turn green when added, and a 済 stamp lands when a piece matches. In the build station the tools switch to the next thing the ticket needs on their own, and a "!" marks the ones still missing. Guests lose patience on game time, so pausing or switching tabs costs nothing. Record makes a 6 second clip of the screen with the bar's name, the day, tips and the last plate's stars. Photo saves a PNG.

### Look

Rendering goes through a post chain (`src/sushi/stage.js`):
- **Ambient occlusion** (N8AO).
- **Depth of field.** Each station keeps its subject sharp and lets the rest go soft, like food photography.
- **Bloom** on the lanterns and glints.
- **Grade:** ACES tone mapping, a light grade, vignette, fine grain and SMAA.

Lighting is a warm key with pin spots over each station and a cool rim behind the guests. Reflections come from a generated restaurant environment: a softbox over the counter and two lanterns.

Quality tiers (`high`, `medium`, `low`, `minimal`):
- Phones start on `medium`, desktops on `high`.
- If frames stay slow for a few seconds, the game steps down a tier on its own.
- `?tier=low` forces a tier.

Feedback while you play:
- Rating pop-ups and glints on good moves.
- Rice grains that fly when you scoop and press.
- A ring under your finger while holding.
- A light trail and a short slow-motion beat when the knife goes through.
- Haptics on phones that support them.

### Interface

The UI is drawn like a cozy cooking game rather than a web page:
- **Type:** Titan One for display and numbers, M PLUS Rounded for everything else, including kana.
- **Buttons:** chunky cream or lacquer red, with brown ink outlines and a lip they press down onto.
- **Top bar:** a walnut plaque with the day as a red seal, plates served, and a coin counter that counts up.
- **Tickets:** the order hangs on a wooden peg. A red 済 stamp lands on each finished piece.
- **Stations:** a hotbar with a "!" on stations that need work. Pochi gives the tips in a speech bubble.
- **Results:** stars pop in one by one and the score counts up. Rating pops are outlined and bounce.
- **The wall:** polaroids pinned to a cork board, with medals for the top three shifts.

All icons are hand-written SVG in `src/sushi/icons.js`. Nothing is loaded from outside.

### What is generated

Every texture is a shader driven by 3D coordinates baked into each piece (`src/sushi/glsl.js`), so a cut face shows the grain that was inside the block:
- **Salmon:** glossy, translucent orange flesh with soft peach seams and a fine juicy pulp, like fruit jelly.
- **Tuna:** ruby red jelly with faint sinew and a little iridescence.
- **Tamago:** glossy custard layers with a browned top.
- **Rice:** packed grains, plus plump, glossy, slightly translucent grains riding on the surface, and steam rising off the tub.
- **Wood:** growth rings, pores, plank seams and knife scratches on the hinoki counter, cutting board, serving board, rice tub staves and walnut wall slats.
- **Ceramics:** six glazes that pool and speckle, with raw clay feet.
- **Noren:** the curtain's seigaiha wave print.

Fish blocks and slices are rounded outlines, extruded with soft bevels and then smoothed, so nothing has a hard edge.

Rice, fish, blocks and customers are all soft bodies on the same simulation as the word toy. Rice forming and fish draping over rice are shape changes the simulation wobbles through.

Ticket pictures and served-plate photos come from a photo booth (`src/sushi/booth.js`) that renders small stills on the main renderer between frames.

### Squishi files

```
index.html            the bar
src/sushi/config.js    layout, camera angles, days, scoring, every tuning number
src/sushi/game.js      flow, customers, serving, input, capture, quality
src/sushi/stations.js  counter, rice, knife and build stations
src/sushi/food.js      rice, fish blocks and slices, toppings, nigiri pieces
src/sushi/critters.js  mochi animal guests, the sous chef, the chef's paw
src/sushi/booth.js     ticket pictures and plate photos
src/sushi/wall.js      the wall: posting, loading, local fallback
src/sushi/ui.js        HUD, tickets, cards, the wall screen
src/sushi/icons.js     the UI's SVG icons
src/sushi/set.js       counter, curtain, lanterns, sign, tub, boards, bowls, knife
api/gallery.js         Vercel function for the wall
server/gallery-core.js the wall's storage logic, shared with the dev server
src/sushi/glsl.js      generated food and wood textures
src/sushi/orders.js    order generation and scoring
```

---

# Squish. (Break room)

Type a word. It turns into a block of jelly. Drag it, poke it, drop a weight on it. A counter tracks how much stress you have released, and the Record button makes a 6 second clip with that counter in it.

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

`dist/` is a plain static folder with relative paths, so it works at a domain root or in a subfolder. It holds two pages: `index.html` (the bar) and `break.html` (the word toy). `vercel.json` pins the build settings, so a Vercel import needs no setup.

- **Vercel:** import the repo. Framework preset Vite, build command `npm run build`, output directory `dist`. For the shared wall, add Upstash for Redis under Storage (see The wall above). Other hosts serve the game without the wall's server part, so the wall falls back to each player's own shifts.
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
- Fonts are bundled from `src/fonts/`: Titan One (the jelly), Instrument Serif and IBM Plex Mono (the Break room), Noto Serif JP (the shop sign and stamps) and M PLUS Rounded 1c (the game UI). All are under the SIL Open Font License; the license texts sit next to the files. The UI fonts are subset to Latin, Noto Serif JP to the 70 or so characters the bar uses (13 KB), and M PLUS Rounded to Latin, kana and the UI's kanji (33 KB per weight).
- Browser support for recording: Chrome and Edge record MP4 (WebM on older versions), Safari records MP4, Firefox records WebM.
