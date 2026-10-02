# Squishi.

A very small sushi bar where everything wobbles. Soft mochi animals order nigiri. Each ticket carries a photo of the plate they want. You make it across four stations, each with its own camera angle, and get scored on how close you got. At the end of a shift your best plates can go up on a shared wall next to everyone else's.

The game runs in the browser. The only server part is the wall: one small function that stores plate photos and a board of best shifts. There are no accounts, no analytics and no cookies. The wall keeps only the name a player types and their plate photos.

## How to play

| Station | Angle | What you do |
| --- | --- | --- |
| 01 Counter 受付 | Eye level, across the bar | A guest hops in and pins an order ticket with a photo of the plate they want. Take the order. Poke the guest if you like. |
| 02 Rice 酢飯 | Over the rice tub | Hold to scoop, let go inside the green band. Then hold to press and let go in the green, three times. Press too hard and the rice squashes flat. |
| 03 Knife 包丁 | Low, along the cutting board | Swipe down through the fish block along the dashed guide. Angle and thickness are scored. Salmon and tuna want a 45° cut, egg a straight one. |
| 04 Build 盛付 | Three quarters, over the serving board | Tap the rice for wasabi (one tap per dab), drag a slice onto the rice, then add the toppings on the ticket. Serve. |

The guest eats it in three bites and reacts. Each plate is scored on rice, cut, build and wait time, and tips follow the score.

### Grades, the Cooking Mama way

Every step gets a grade stamped where the work happened: **Perfect!**, **Great!**, **OK** or **Oops!**, with a few words on why ("Too hard", "Right in the middle"). Each grade has its own sound.
- **Pochi cheers you on:** he grins at a perfect step and calls out after three in a row.
- **Pochi fixes slips:** press the rice too hard and he steps in with "Don't worry, I'll fix it!". The mound is reshaped, but the step still scores low.
- **Gesture hints:** stay still on a step for a moment and a cat paw acts out the move: hold over the tub, stroke down the dashed line, drag the slice onto the rice.
- **Medals:** each plate earns a gold, silver or bronze medal, plus a tally of its step grades. A 96 or better gets "Even better than Pochi!".



The guests are mochi animals: a calico cat, a shiba, a bunny, a bear, a panda and a fox. Each is a soft body with fur markings drawn in the shader. Ears, eyes, blush, nose, whiskers and mouth are pinned to the surface and follow every squash. Ears droop when a guest waits too long, and eyes close into happy arcs at a great plate.

Pochi, the shiba sous chef, sits on the counter in a chef's toque. He greets each guest, cheers good plates and frets over bad ones. The chef is a cat: a paw cups the rice when you scoop and presses it on the mat.

### The Sushi book 図鑑

The Sushi book on the title screen is the bar's field guide, and it fills in as you play.
- **Dishes:** all seven dishes, numbered. One you have never served shows as a dark silhouette (or a "?" until its day is open). Once served, it gets its photo, how many you have made and your best score.
- **Regulars:** each guest gets a portrait once you have served them. Every regular has a favourite dish: Mochi loves salmon nigiri, Kinako tamago, Ume cucumber rolls, Azuki unagi, Sasa tuna rolls and Yuzu tuna nigiri. It shows as "Favourite: ?" until you find it.
- **Favourites in play:** regulars often ask for their favourite once it is on the menu, and the ticket marks it with a beating heart. Serve it with a score of 85 or more for an extra 25% tip, and the book fills in that guest's favourite.

The photos come from the same photo booth as the tickets. They are rendered the first time the book opens and kept for the session. The book is saved with your progress in the browser.

### The wall

At the end of a shift, the summary shows today's plate photos. Type a name and post: your three best plates go up on the wall, and the shift goes on a board ranked by tips. The wall is also on the title screen.

- `api/gallery.js` is a Vercel function. It needs a Redis REST store: add **Upstash for Redis** (or Vercel KV) to the project in the Vercel dashboard under Storage. That sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`).
- Without a store, the wall still works but only shows the player's own shifts, saved in their browser, and says so.
- `npm run dev` and `npm run preview` serve the same API from memory, so the wall works locally with no setup. It resets when the server restarts.
- Limits: names up to 16 letters, numbers, spaces and `._'-`. Photos are small JPEG data URLs (320 by 200, under 60 KB). Six posts per visitor per minute. The newest 48 plates and the best 100 shifts are kept.

Seven days, each adding something:

| Day | What's new |
| --- | --- |
| 1 | Salmon only. Learn the counter. |
| 2 | Tuna, sesame and scallion. |
| 3 | Tamago nigiri in a nori belt, and ikura. |
| 4 | Rolls: hosomaki with cucumber or tuna. |
| 5 | Unagi, grilled and glazed, with tare and a nori belt. Salmon rolls. |
| 6 | Rush hour: seven guests, and a rush mid shift. |
| 7 | Omakase night: everything, two nigiri a plate. |

Each day has three star goals in tips, shown on its intro card. One star (or an average of 50) unlocks the next day. Stars and best tips show on the level select. Progress is kept in the browser.

### Rolls

A roll order runs its own little chain:
1. **Rice:** with the nigiri rice done, a nori sheet waits on the mat. Scoop rice onto it, then hold to spread it (same green band as pressing).
2. **Fill:** pick the filling the ticket asks for.
3. **Roll:** swipe up across the mat.
4. **Knife:** the log comes to the board with five dashed lines. Swipe down through each. Each cut is scored on how close it lands to its line.

The six pieces then stand up on the serving board, cut face up. The cut faces are drawn by a shader: nori rim, packed rice grains, then the filling (cucumber with its seeds, tuna or salmon).

### Rush

- **Combo:** plates scoring 80 or more in a row raise the tip, up to x2. The streak shows as a flame in the top bar.
- **Speedy:** serving well inside the guest's patience adds 20%.
- **Rush hour:** on Days 6 and 7, a run of guests arrives in a rush. They have less patience but tip x1.5, and a banner announces them.
- **Favourite:** a regular's favourite dish served at 85 or more adds 25%.
- **Walkouts:** a guest whose patience runs out leaves without paying, and the combo breaks.

Keys: `1` to `4` switch stations; hold `Space` to scoop and press; `Esc` pauses (resume, restart the day or quit to the title). The pause button in the top bar does the same on phones.

The ticket ticks off each request as you go: wasabi and ikura show a count (`Wasabi 2/3`, `Ikura 4/5`), toppings turn green when added, and a 済 stamp lands when a piece matches. In the build station the tools switch to the next thing the ticket needs on their own, and a "!" marks the ones still missing. Guests lose patience on game time, so pausing or switching tabs costs nothing. Record makes a 6 second clip of the screen with the bar's name, the day, tips and the last plate's stars. Photo saves a PNG.

### Look

Rendering goes through a post chain (`src/sushi/stage.js`):
- **Ambient occlusion** (N8AO).
- **Depth of field.** Each station keeps its subject sharp and lets the rest go soft, like food photography.
- **Bloom** on the lanterns and glints.
- **Grade:** neutral tone mapping, which keeps colours bright and clean where ACES went brown, plus a little extra saturation and contrast, a soft vignette and SMAA.

Lighting aims for a bright, toy-like look:
- A warm key from high and to the left, a soft warm fill from the front, and a hemisphere light with warm sky above and wood bounce below. Pin spots sit over each station.
- A cool rim behind the guests.
- Reflections come from a generated restaurant environment: a softbox over the counter and two lanterns.

The animals carry a shader rim light: a soft cream glow along the edges that face the sky, toned down on white fur so the panda and bunny do not blow out. Each one sits on a soft contact shadow that shrinks and fades as it hops. The guest at the counter casts a long one onto the counter, so they read as sitting at the bar rather than floating behind it.

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

### Loading

A loading screen shows straight away, before any script arrives. Behind it the game builds one of every dish and tool, compiles every shader and runs one frame through the post chain. That way the first minutes of play never stall on a shader compiling.

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
- **Unagi:** lacquered tare glaze with charred grill bars, char speckles and a dark skin edge.
- **Nori:** near-black green with a fibrous sheen and pinholes. Used for the belts, roll sheets and roll sides.
- **Rice:** packed grains, plus plump, glossy, slightly translucent grains riding on the surface, and steam rising off the tub.
- **Wood:** growth rings, pores, plank seams and knife scratches on the hinoki counter, cutting board, serving board, rice tub staves and walnut wall slats.
- **Ceramics:** six glazes that pool and speckle, with raw clay feet.
- **Noren:** the curtain's seigaiha wave print.

Fish blocks and slices are rounded outlines, extruded with soft bevels and then smoothed, so nothing has a hard edge.

Rice, fish, blocks and customers are all soft bodies on one shared simulation (`src/jelly.js`). Rice forming and fish draping over rice are shape changes the simulation wobbles through.

Ticket pictures and served-plate photos come from a photo booth (`src/sushi/booth.js`) that renders small stills on the main renderer between frames.

### Squishi files

```
index.html            the bar
src/sushi/config.js    layout, camera angles, days, scoring, every tuning number
src/sushi/game.js      flow, customers, serving, input, capture, quality
src/sushi/stations.js  counter, rice, knife and build stations
src/sushi/food.js      rice, fish blocks and slices, toppings, nigiri pieces, nori belts
src/sushi/maki.js      rolls: sheet, rolling, log, cut pieces, cut-face shader
src/sushi/critters.js  mochi animal guests, the sous chef, the chef's paw
src/sushi/booth.js     ticket pictures and plate photos
src/sushi/wall.js      the wall: posting, loading, local fallback
src/sushi/ui.js        HUD, tickets, cards, the wall and the Sushi book
src/sushi/icons.js     the UI's SVG icons
src/sushi/set.js       counter, curtain, lanterns, sign, tub, boards, bowls, knife
api/gallery.js         Vercel function for the wall
server/gallery-core.js the wall's storage logic, shared with the dev server
src/sushi/glsl.js      generated food and wood textures
src/sushi/orders.js    order generation and scoring
src/jelly.js           the soft body simulation
src/meshutils.js       subdivision and vertex ordering for soft meshes
src/record.js          clip recording and sharing
src/audio.js           Web Audio sound
src/config.js          soft body, sound and recording numbers
```

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

`dist/` is a plain static folder with relative paths, so it works at a domain root or in a subfolder. `vercel.json` pins the build settings, so a Vercel import needs no setup.

- **Vercel:** import the repo. Framework preset Vite, build command `npm run build`, output directory `dist`. For the shared wall, add Upstash for Redis under Storage (see The wall above). Other hosts serve the game without the wall's server part, so the wall falls back to each player's own shifts.
- **Netlify:** build command `npm run build`, publish directory `dist`. Or drag `dist/` onto the Netlify dashboard.
- **Anywhere else:** upload the contents of `dist/`.

## Tuning

Game numbers live in [`src/sushi/config.js`](src/sushi/config.js): layout, camera angles, days, scoring, rush, favourites, guests and dishes. The soft body feel (`SIM.spring`, `SIM.damping`, `SIM.coupling`, `SIM.pressure`) is in [`src/config.js`](src/config.js).

Debug URL flags: `?tier=low` forces a quality tier, `?fixed` turns off automatic quality changes, `?debug` exposes the game as `window.game`.

## Notes

- Fonts are bundled from `src/fonts/`: Titan One (display and numbers), Noto Serif JP (the shop sign and stamps) and M PLUS Rounded 1c (the game UI). All are under the SIL Open Font License; the license texts sit next to the files. Noto Serif JP is subset to the 70 or so characters the bar uses (13 KB), and M PLUS Rounded to Latin, kana and the UI's kanji.
- Browser support for recording: Chrome and Edge record MP4 (WebM on older versions), Safari records MP4, Firefox records WebM.
