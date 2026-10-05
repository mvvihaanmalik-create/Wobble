# Squishi.

A very small sushi bar where everything wobbles. Soft mochi animals order nigiri. Each ticket carries a photo of the plate they want. You make it across four stations, each with its own camera angle, and get scored on how close you got. At the end of a shift your best plates can go up on a shared wall next to everyone else's.

The game runs in the browser. The only server part is the wall: one small function that stores plate photos and a board of best shifts. There are no accounts, no analytics and no cookies. The wall keeps only the name a player types and their plate photos.

## How to play

| Station | Angle | What you do |
| --- | --- | --- |
| 01 Counter 受付 | Eye level, across the bar | A guest hops in and pins an order ticket with a photo of the plate they want. Take the order. Poke the guest if you like. |
| 02 Rice 酢飯 | Over the rice tub | Hold to scoop, let go inside the green band. Then hold to press and let go in the green, three times. Press too hard and the rice squashes flat. Onigiri are made here too: scoop, pick the filling, press it into a triangle and tap to wrap the nori. |
| 03 Knife 包丁 | Low, along the cutting board | Swipe down through the fish block along the dashed guide. Angle and thickness are scored. Salmon and tuna want a 45° cut, egg a straight one. |
| 04 Build 盛付 | Three quarters, over the serving board | Tap the rice for wasabi (one tap per dab), drag a slice onto the rice, then add the toppings on the ticket. Serve. |
| 05 Stove コンロ | Close over the pot or the pan (stages 6 to 10) | Udon, gyoza, ramen and takoyaki, step by step. See The stove below. |

The guest eats it and reacts. Every bite goes somewhere: nigiri, roll pieces, gyoza and takoyaki are lifted off the board one at a time and carried in an arc into the guest's mouth; an onigiri is held up to the mouth and bitten down in three; noodles are slurped, a few strands at a time rising out of the bowl into the mouth while the nest thins strand by strand, the toppings go between slurps and the broth goes down. Nothing shrinks in place or sinks through its dish. Each plate is scored on rice, cut, build and wait time, and tips follow the score.

### Grades, the Cooking Mama way

Every step gets a grade stamped where the work happened: **Perfect!**, **Great!**, **OK** or **Oops!**, with a few words on why ("Too hard", "Right in the middle"). Each grade has its own sound.
- **Pochi cheers you on:** he grins at a perfect step and calls out after three in a row.
- **Pochi fixes slips:** press the rice too hard and he steps in with "Don't worry, I'll fix it!". The mound is reshaped, but the step still scores low.
- **Gesture hints:** stay still on a step for a moment and a cat paw acts out the move: hold over the tub, stroke down the dashed line, drag the slice onto the rice.
- **Medals:** each plate earns a gold, silver or bronze medal, plus a tally of its step grades. A 96 or better gets "Even better than Pochi!".



### The cast

The guests are round little animals in the spirit of Animal Crossing villagers, each with their own look:
- **Mochi**, a calico cat with lashes and a bell collar, in a red and cream striped top.
- **Kinako**, a shiba in a blue bandana and a gingham shirt.
- **Ume**, a bunny with a pink bow and a polka dot shirt.
- **Azuki**, a bear with button eyes, a green scarf and a plaid shirt.
- **Sasa**, a panda with soft drooping patches, a bamboo leaf and a sunny dotted shirt.
- **Yuzu**, a sleepy-eyed fox with a yuzu hair pin and a sailor stripe top.

Each one has a big, round soft-body head that squashes and wobbles, on a small round body in a patterned shirt with sleeves, round paws, little feet and a tail. At the counter they sit with their paws on the ledge. They wave when poked, throw both arms up at a great plate, hold their paws to their mouths while eating and tap a paw when they get impatient. A soft ink outline goes around every part.

Faces are painted textures swapped per expression (`src/sushi/faces.js`):
- **Eyes:** small, glossy village eyes with one big highlight, in a different shape per guest: tall beads, button dots, lashes, a sleepy lid, or a pale rim so the panda's eyes read on its patches. They squint ^^ when happy, turn to hearts, stars or tears, and go >< when cross.
- **The rest:** soft brows that only show when they mean something, a little ω mouth (with a fang for the cat and fox), and hatched blush (with whiskers for the cat and fox).
- **Emotes:** ! ? ♪ ♥ 💢 💧 ✨ and gloom lines pop over their heads.
- **Blinking:** they blink, and their ears droop when a guest waits too long.

Pochi, the shiba sous chef, sits on the counter in a chef's toque and a red neckerchief. He greets each guest, cheers good plates and sweats over bad ones. The chef is a cat: a paw cups the rice when you scoop and presses it on the mat.

### The Sushi book 図鑑

The Sushi book on the title screen is the bar's field guide, and it fills in as you play.
- **Dishes:** all fifteen dishes, numbered. One you have never served shows as a dark silhouette (or a "?" until its stage is open). Once served, it gets its photo, how many you have made and your best score.
- **Regulars:** each guest gets a portrait once you have served them. Every regular has a favourite dish: Mochi loves salmon nigiri, Kinako shoyu ramen, Ume ume onigiri, Azuki unagi, Sasa takoyaki and Yuzu kitsune udon. It shows as "Favourite: ?" until you find it.
- **Favourites in play:** regulars often ask for their favourite once it is on the menu, and the ticket marks it with a beating heart. Serve it with a score of 85 or more for an extra 25% tip, and the book fills in that guest's favourite.

The photos come from the same photo booth as the tickets. They are rendered the first time the book opens and kept for the session. The book is saved with your progress in the browser.

### The wall

At the end of a shift, the summary shows today's plate photos. Type a name and post: your three best plates go up on the wall, and the shift goes on a board ranked by tips. The wall is also on the title screen.

- `api/gallery.js` is a Vercel function. It needs a Redis REST store: add **Upstash for Redis** (or Vercel KV) to the project in the Vercel dashboard under Storage. That sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`).
- Without a store, the wall still works but only shows the player's own shifts, saved in their browser, and says so.
- `npm run dev` and `npm run preview` serve the same API from memory, so the wall works locally with no setup. It resets when the server restarts.
- Limits: names up to 16 letters, numbers, spaces and `._'-`. Photos are small JPEG data URLs (320 by 200, under 60 KB). Six posts per visitor per minute. The newest 48 plates and the best 100 shifts are kept.

Ten stages, each with its own menu and a new dish to learn:

| Stage | Name | What's new |
| --- | --- | --- |
| 1 | First shift | Salmon nigiri only. Learn the counter. |
| 2 | Tuna day | Tuna, sesame and scallion. |
| 3 | Onigiri | Ume and salmon rice balls: fill, shape, wrap. |
| 4 | Rolls | Hosomaki with cucumber or tuna. |
| 5 | Sweet and glazed | Tamago in a nori belt, glazed unagi, ikura, salmon rolls. |
| 6 | Udon | Kitsune and tempura udon at the stove. |
| 7 | Gyoza | Fill, pleat and fry. Rush hour arrives. |
| 8 | Ramen | Shoyu and tonkotsu ramen with all the toppings. |
| 9 | Takoyaki | Pour, turn and top six octopus balls. |
| 10 | Grand night | The whole menu, two nigiri a plate and a long rush. |

Orders come from a shuffled menu bag for the stage, so the same dish never comes twice in a row, and the stage's new dish is always the first order. Each stage has three star goals in tips, shown on its intro card. All ten stages are open for now so testers can jump to any of them. Stars and best tips show on the level select. Progress is kept in the browser.

### The stove

The left end of the counter has a little two-burner stove: a pot of water for noodles, an iron pan for gyoza (swapped for a takoyaki iron on takoyaki orders), a donburi in front of the pot and a folding board in front of the pan. The camera closes in on whichever dish the ticket asks for. Every step is graded, Cooking Mama style.

**Udon** (kitsune with fried tofu, or tempura with a shrimp):
1. **Drop:** tap the pot to drop the noodles in.
2. **Stir:** draw circles over the pot, three times, so they do not stick.
3. **Lift:** lift them when the boil timer is in the green. Too early is firm, too late is soggy. Wander off and they keep cooking.
4. **Dashi:** hold to ladle broth into the bowl and let go at the line. Overfill it and Pochi ladles some back out.
5. **Toppings:** add what the ticket says: kamaboko, scallion, and the aburaage or the ebi tempura.

**Gyoza** (three to a plate):
1. **Fill:** hold to spoon filling onto a wrapper and let go in the green. Overfill it and Pochi scoops some out.
2. **Pleat:** a beat runs along the meter. Tap on each mark to pinch a pleat, five per gyoza.
3. **Fry:** they sizzle in the pan. When the bottoms are golden, add water and the lid.
4. **Steam:** lift the lid when the steam timer is in the green. They come out browned side up with a dish of sauce.

**Ramen** (shoyu or tonkotsu) runs like udon with thin, wavy yellow noodles and a rich broth, topped with chashu, naruto, menma, a marinated egg, nori and scallion.

**Takoyaki** (six to a boat):
1. **Batter:** hold to pour batter into the iron and let go in the green. Overfill it and Pochi wipes it back.
2. **Octopus:** tap to drop a piece into each well.
3. **Turn:** each ball browns underneath in turn. Tap it to flip it with the pick when the underside is golden. Too pale or too dark costs points, and one left too long burns.
4. **Toppings:** into the boat for takoyaki sauce, mayo, bonito flakes and aonori.

Finished dishes slide down the counter onto the serving board for the guest. The stove sits far enough back that the bowl and the folding board clear the pot, the pan and the stove body. Takoyaki toppings belong to each ball, so a ball leaves the boat fully dressed. Their score card reads Boil, Dashi (or Broth) and Toppings; Filling, Pleats and Frying; or Batter, Turning and Toppings. Onigiri read Rice, Filling and Wrap.

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
- **Rush hour:** on stages 7 to 10, a run of guests arrives in a rush. They have less patience but tip x1.5, and a banner announces them.
- **Favourite:** a regular's favourite dish served at 85 or more adds 25%.
- **Walkouts:** a guest whose patience runs out leaves without paying, and the combo breaks.

Keys: `1` to `5` switch stations; hold `Space` to scoop and press; `Esc` pauses (resume, restart the day or quit to the title). The pause button in the top bar does the same on phones.

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

The animals carry a shader rim light: a soft cream glow along the edges that face the sky, toned down on white fur so the panda and bunny do not blow out. Each one sits on a soft contact shadow that shrinks and fades as it hops. The guest at the counter casts a soft one onto the ledge where their paws rest.

Quality tiers (`high`, `medium`, `low`, `minimal`):
- The starting tier comes from the GPU's name: integrated and mobile GPUs start on `low`, unknown ones on `medium`, big desktop GPUs on `high`.
- If frames run over the 60 fps budget, the game first renders at a slightly lower resolution, in steps down to 64%, and keeps every effect. Only if that is not enough does it step down a tier. When frames are smooth again for a while, the resolution climbs back.
- `?tier=low` forces a tier.

Keeping it smooth:
- **Even frames on fast screens:** on 120 Hz and faster displays the game draws every second refresh, a steady 60 fps, instead of stumbling between 120 and 60. 60 and 90 Hz screens draw every refresh.
- **Smoothed time step:** motion uses a lightly smoothed frame time, so a millisecond of timer jitter never shows as judder.
- **Light rice:** the thousands of instanced rice grains use a lighter capsule (half the triangles) and do not cast their own shadows; the mound does. The scene draws about half the triangles it used to.
- **Curtains on the GPU:** the noren sway in the vertex shader instead of rebuilding their mesh on the CPU every frame.
- **Quiet UI:** the station bar and the patience bar only touch the page when something on them changed.

Feedback while you play:
- Rating pop-ups and glints on good moves.
- Rice grains that fly when you scoop and press.
- A ring under your finger while holding.
- A light trail and a short slow-motion beat when the knife goes through.
- Haptics on phones that support them.

### Music

The bar has its own lo-fi band, written live in Web Audio (`src/sushi/music.js`). No track is downloaded, so there is nothing to license and nothing to fetch.
- **Sound:** a warm, slightly detuned electric piano plays lush seventh and ninth chords over a round, soft bass. A breathy flute-like lead with a slow vibrato and a gentle echo sings a melody every other pass. Behind them sit a soft kick that makes the keys breathe, a rim click, quiet swung hats and vinyl crackle, all through a tape-style warmth and a rolled-off top.
- **Two songs:** a slow evening tune for the title and the end of a shift, and a shuffling one for service. They change only at the top of the loop, so nothing jumps mid phrase.
- **Follows the game:** mellow on the title screen, grooving during a shift, a little busier with a shaker in rush hour. Pausing muffles it, like a radio in the next room.
- **Controls:** the note button in the top bar (or the "Music on" pill on the title screen) turns the music off and remembers the choice. The speaker button mutes everything. Clips you record include the music.
- **Loud enough to hear:** the band plays into the limiter at about -23 dB, below the effects. On iPhones it asks for media playback, so the ring/silent switch does not mute it.

### Loading

A loading screen shows straight away, before any game script arrives. It has a mochi you can poke (it squishes, says "boing!" and counts your squishes), a real progress bar and a rotating gameplay tip.

Behind it the game compiles only what the title camera can see, a dozen meshes at a time with a frame in between, so the loading screen stays alive and the bar shows real progress. The game loop does not draw while this runs, so no time goes to frames nobody sees. Then one frame runs through the post chain and the title comes up.

While the title is showing, the stations off camera and one of every dish compile in the background, a few at a time so the title never freezes. If you press start before that is done, the button fills up as a progress bar ("Warming the plates 60%") and the stage opens by itself when it is ready.

### Phones

The game is built to be played sideways on a phone:
- **Landscape layout:** on a short, wide screen (under 500 px tall) the top bar slims down, the ticket shrinks to three quarters on the left, the station bar becomes a compact row of icons at the bottom, actions stack down the right edge and Pochi's tips sit between them. The title puts the logo and buttons on the left and the stages on the right. Cards scroll, with their buttons stuck to the bottom. Notches are kept clear with the safe areas.
- **Upright:** still playable. Starting a stage upright suggests turning the phone sideways.
- **Sharp on retina:** phones render at up to 1.6x to 2x, and the automatic resolution never drops below one rendered pixel per point, so the picture never turns blocky.
- **No freezes mid-game:** while the title shows, every station is drawn once offstage with one of every dish, tool, particle and hidden stove prop, which compiles exactly the shaders play will use. Phones (iPhones above all) stall on every new shader, so nothing new compiles during a shift. Shader error logs are only read back while developing.
- **Photos without stalls:** ticket and plate photos render with the bar's own lights and fog into a 4x multisampled buffer (so they share the bar's shaders), then are toned, read back asynchronously and encoded when ready. The game never waits on the GPU for a photo.
- **Clean pixels on iPhone and iPad:** a guard pass right after the scene clamps any broken pixel before bloom or depth of field can smear it into black blocks, and on iPhones and iPads the food drops see-through glass, rainbow sheen and near-mirror coats, the shader corners those GPUs get wrong.
- **Rotation:** the canvas resizes at once on the first change, then again only when the size holds still, so a rotation does not rebuild the post chain on every frame. The page itself is pinned so iOS cannot scroll it under the browser bars.

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
src/sushi/hot.js       stove, udon bowl, noodles, toppings, gyoza that fold and brown
src/sushi/stove.js     the stove station: udon and gyoza steps
src/sushi/critters.js  chibi animal guests, the sous chef, the chef's paw
src/sushi/faces.js     painted eyes, brows, mouths, blush and emotes
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
