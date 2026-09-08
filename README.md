# The Executor: Power Struggle

A browser-based 2D fighting game built with vanilla JavaScript and HTML5 Canvas. No build step, no framework, no backend.

## Running locally

Serve the folder with any static file server, then open it in a browser:

```
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

A local server is recommended over double-clicking `index.html` directly — a couple of browsers are inconsistent about local asset loading from `file://` URLs, and this is also exactly how it'll be served once deployed.

## Project structure

```
the-executor/
├── index.html            entry point, loads css + js
├── css/
│   └── game.css
├── js/                    loaded in this order (classic scripts, shared global scope)
│   ├── fighter.js         Fighter class, sprite loading, CPU AI controller
│   ├── input.js           keyboard state + menu/gameplay input handling
│   ├── combat.js          hit resolution, round win/reset logic
│   ├── stages.js          parallax background rendering
│   ├── characterSelect.js roster data + character-select screen
│   └── game.js            fighter instantiation, HUD, menus, main loop
└── assets/
    ├── characters/
    │   ├── white-noise/<animation>/<frame>.webp
    │   ├── liberty-belle/<animation>/<frame>.webp
    │   └── botanist/<animation>/<frame>.webp   (in progress, see below)
    ├── portraits/         character-select roster tile art
    ├── logos/             stylized character name graphics
    ├── stages/             background layers
    └── ui/                title screen, character-select backdrop
```

**Note on the JS files:** these are loaded as ordinary sequential `<script>` tags, not ES modules — they share one global scope, the same way the original single-file prototype worked. That was a deliberate choice: splitting into real ES modules would mean threading shared state (`keys`, `p1`, `p2`, the canvas context) through explicit imports/exports, which is a bigger, riskier change than "move this code to its own file." This gets the folder structure and separation of concerns without that additional risk. Converting to real modules later is a reasonable follow-up once the game has more coverage.

**Note on character sprites:** `js/fighter.js` loads and renders every character's animations through one data-driven registry (`CHAR_ANIMS`, `SPRITES`, `SIMPLE_STATE_ANIM`) instead of per-character code. Adding a character or a new animation for one that already exists is a data change — add or extend that character's entry in `CHAR_ANIMS` with `{ animName: frameCount }`, drop the frames at `assets/characters/<key>/<anim-folder>/<i>.webp` (folder names are in `ANIM_FOLDER`), and it's wired up automatically: no new loading code, no new render branch. A character can have any subset of animations — `draw()` falls back to the placeholder box for any state it doesn't have art for yet, so a roster slot can be built up incrementally across sessions. The handful of things that aren't plain per-animation data (the special move's hitbox/choreography, its dash timing, which crouch frame is the "settled" pose, a display-height correction) live in small per-character lookups near the top of `fighter.js` (`SPECIAL_BOUNDARIES`, `SPECIAL_DUR`, `CROUCH_HOLD_AT`, `CHAR_HEIGHT_SCALE`) — a character with no entry there just gets sane generic defaults.

**Note on character height:** every character renders at a fixed 180px sprite height by default, which only lines characters up visually when their art fills a similar fraction of its own 500x720 canvas. White Noise's compact hoodie-and-hood silhouette leaves more empty headroom above him than Liberty Belle's flowing hair or Botanist's leaf cloak do, so without correction he renders noticeably shorter than the other two at the same 180px. `CHAR_HEIGHT_SCALE` in `fighter.js` (currently `{ seth: 1.165 }`) corrects this per-character at render time — it's a display-only multiplier applied in `drawSpriteFrame()`, separate from the fixed `w`/`h` used for hurtbox/hitbox math, so it doesn't touch hit detection. If a new character renders at a noticeably different height than the rest of the roster, tune this rather than re-exporting their art.

## Current roster

**White Noise**, **Liberty Belle**, and **The Botanist** (he/him) are playable — all three have a complete moveset (walk, idle, jump, crouch, light/heavy attacks, crouching and airborne variants, block, special move, victory/defeat animations, hitstun reaction). The Botanist's defeat animation is a themed variant where he collapses into a mound that sprouts and blooms into a flower rather than staying visible prone — that's intentional, not a bug. His special also has no hand-tuned hitbox/dash choreography of its own yet (see the note in `CHAR_ANIMS`) — it borrows White Noise's until he gets his own branch in `attackHitbox()` and `update()`.

Seven more character slots (Rainwalker, P.H.I., The Coyote, Frontman, Lady Voix, Archi-Tech, Echo) exist in the character-select roster with portrait art + name logos, but have no sprite sets started yet.

## Known gaps

- No sound or music.
- No single-file build/bundle step — this is meant to be served as-is.
- No grabs/throws — blocking is currently a fully safe option.
- No intro poses — round start is instant.
- Seven roster slots are locked pending full movesets (see `ROSTER` in `js/characterSelect.js`).

## Asset tooling

`_tools/split_sheet.ps1` splits a multi-pose AI-generated sprite sheet (transparent PNG) into individual frames, using column-density local minima to find the true gaps between poses — robust even when trailing effects (motion lines, dust, hair) leave faint pixels bridging adjacent poses. `_tools/find_band.ps1` finds vertical content bands by row-density, for the pre-crop step described below. `_tools/server.ps1` is a minimal static file server (plus a `/save` POST endpoint) used to drive a browser-canvas compositing pass for scale calibration and final WebP export, since this machine has no Python/PIL or ImageMagick available — Chrome's canvas is the only working image encoder here. The original source sheets for every character are kept in `_tools/<character>_src/` in case frames ever need re-deriving (different crop, different scale, more frames).

Things that have bitten this pipeline in practice:

- **Labeled sheets contaminate the crop.** Some generated sheets carry a title banner at the top, a description blurb, and/or numbered circle labels under each pose. `split_sheet.ps1`'s column-based bbox spans the *full* image height, so it will happily include that banner/label text in the "tight" per-frame crop. Run `find_band.ps1` first — it computes a row-density profile and reports contiguous content bands — and pre-crop to just the band containing character content before running `split_sheet.ps1`. Sheets with no banner/labels (a plain character-only sheet) don't need this step — check for it, don't assume it.
- **A number label can sit closer to the feet than it looks.** Even after picking a content band, a label just below the feet can still land inside the crop for poses with a wide stance — the safe cutoff is often only a handful of pixels below the shortest character's feet. If a processed frame shows a stray black circle fragment at the bottom, trim the band tighter (crop a diagnostic strip around the boundary and look directly at the pixels) rather than guessing at a wider margin.
- **Multi-row sheets don't always separate cleanly.** A sheet with poses laid out in more than one row usually has clean whitespace between rows (crop each row's band separately, same as above), but trailing effects (a dust trail, a growing vine) can bridge two rows with zero fully-transparent rows between them anywhere across the width, so `find_band.ps1` reports one giant run instead of several. When that happens, crop each row by a manually-determined pixel boundary instead: crop diagnostic strips around the suspected row transition and read off where one row's content actually ends and the next begins.
- **Scale can drift between sheets for the same character, in the same session** — and drift a lot: Botanist's walk sheet needed ~1.15x, his crouch/light-punch sheets ~0.85x, and his strong-attack/jump-attack sheets ~1.8x, all calibrated against the same White Noise reference frame, all generated within the same session. Calibrate every new sheet against a reference frame independently; never assume a scale factor established for one of a character's sheets carries over to a sibling sheet.
- **A multi-hit combo sheet can bleed a limb into the wrong frame's crop.** On Botanist's crouching-attack sheets, the punch's extended fist from one pose ended up as a small disconnected blob inside the *next* pose's column segment — density-based splitting only guarantees the boundary falls in a low-density column, not that every pixel on each side actually belongs to that frame's own pose. It won't always show up in `split_sheet.ps1`'s bbox numbers (a disconnected blob at a different height than the main body can keep the column density nonzero right through where the "gap" should be, so nothing looks wrong in the log). Actually look at every processed frame before compositing; if a stray fist/prop appears floating at one edge, crop that fixed pixel range off that one frame's raw PNG before it goes through scale calibration and export.
- **Not every sheet has a transparent background.** Botanist's Hitstun sheet was exported with an opaque decorative card background (a textured dark vignette) instead of the usual transparent PNG the rest of his sheets use — `Bitmap.GetPixel` alpha samples came back non-zero even at what looked like empty space. A simple color-distance chroma key was too risky to attempt automatically here since the background's dark olive tone sits close to the character's black hair and dark clothing in RGB space — a bad key would eat into the art rather than just failing loudly. The pragmatic fix is to ask for the sheet to be re-exported with a transparent background like its siblings, rather than trying to rescue it computationally.

See the hitstun frames under `assets/characters/*/hitstun/` and the Botanist frames under `assets/characters/botanist/` for worked examples of this pipeline.
