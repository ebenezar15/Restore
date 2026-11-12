# RoomTone — Studio Designer

An offline-first 3D room designer for recording studios, control rooms, booths,
podcast rooms and home theaters. It covers both the interior look and the
acoustics: you can plan treatment, check the numbers and hand a PDF to a client
or builder.

It runs entirely in the browser and needs no account, server or internet
connection once it's loaded.

## Run it

| Option | How |
| --- | --- |
| **Single file (easiest)** | Open `dist/RoomTone-standalone.html` by double-clicking it. Everything is inlined, so it works from disk with no connection. |
| **Installable app (PWA)** | Serve the folder over http(s), e.g. `npx http-server studio-designer` or GitHub Pages. Then use "Install app" / "Add to Home Screen". A service worker caches everything, so the app keeps working offline afterwards. |

The camera needs `https://` or `localhost`. On phones, "Upload photo" also opens the native camera.

## Features

- **Modelling like SketchUp, but simpler:** you get Select, Move, Rotate and Scale gizmos with grid and 15° snapping. There are also a tape measure, align and distribute, duplicate, *Array*, and *Mirror across the room centre* for symmetric layouts. You can lock and hide items, undo and redo, nudge with the keyboard, and drag items from the library onto a wall, the floor or the ceiling.
- **Room shapes:** design any room shape, not just a rectangle.
  - **Preset outlines:** rectangle, trapezoid, splayed control room, L, T and U shapes, alcove, angled corner, pentagon, hexagon, octagon, round/oval, curved back wall and fan.
  - **Edit corners on the plan:** drag corners with grid and square-up snapping, click a wall's midpoint to add a corner, and double-click a corner to delete it.
  - **Draw an outline freehand** on the plan.
  - **Edit walls numerically:** type each wall's length or the X/Z of each corner, curve any wall outward or inward, split or remove walls, and mirror, flip or rotate the outline.
  - **Ceilings:** flat, sloped (shed), pitched (gable/cathedral), barrel vault or dome, with low and high heights and a direction.
  - **Real wall openings:** doors, windows and pass-throughs cut holes through the wall. Wall thickness is adjustable.
  - **Acoustics follow the real shape:** volume, surface areas, RT60 and image-source reflections all use the actual geometry, and angled corner traps fit any corner angle.
  - **Prompts work too**, for example `make the room L shaped`, `sloped ceiling 2.4 to 3.4`, `vaulted ceiling 4`, `curve the back wall 0.6`.
- **Materials & colours:** a visual material picker with 60+ finishes in ten groups.
  - **Paint & plaster:** matte, eggshell, satin, gloss, Venetian plaster, limewash.
  - **Fabrics:** acoustic fabric, linen, velvet, bouclé, herringbone weave, tweed, felt, suede, leather, grille cloth.
  - **Wood:** oak, walnut, ash, maple, cherry, ebonised, bamboo, plywood, slatted wood.
  - **Stone & masonry:** stone, concrete, polished concrete, red or painted brick, marble, terrazzo, slate.
  - **Tile:** square, subway, hexagon, mosaic.
  - **Metal:** brushed steel, black steel, chrome, brass, copper, perforated.
  - **Glass & mirror:** clear, frosted, grey-tinted, bronze, reflective, fluted/reeded, laminated acoustic, mirror.
  - **Wallcoverings:** striped, geometric and damask wallpaper, cork, stretched-fabric wall.
  - **Flooring:** cut-pile and loop carpet, wide plank, herringbone and chevron parquet, rubber, vinyl.
  - **Colour palettes:** Studio, Earth, Jewel and Soft, a named fabric-colour range and recently used colours, plus hex entry.
  - **Two-tone walls:** a dado/wainscot with its own material, colour and rail.
  - **Glass walls:** any room wall can be made glass.
- **Doors, windows & walls:**
  - **Doors:** flush, panel, acoustic studio, vision-panel, half-glass, glass, double, French, sliding and barn. Choose the hinge side, open angle, handle, glass type, frame material and hardware colour.
  - **Windows:** studio double/triple with an angled pane, fixed, grid, casement, sliding, arched and round, with a choice of glass type. Arched and round windows cut matching shaped openings in the wall.
  - **Walls & glass:** partitions (solid, half, glass-topped, slatted, frameless glass, steel-framed glass), glass screens, feature-wall cladding (boards, battens, tiles, hex tiles, wainscot) and mirrors.
- **Custom shape builder (✦):**
  - **Profiles:** pick one (rectangle, rounded, circle, triangle, diamond, N-sided polygon, star, arch, half-circle, trapezoid, L, T, cross, wave) or draw your own on a grid.
  - **Build it:** extrude the profile, or revolve one of the preset profiles (cylinder, cone, dome, sphere, vase, bowl, column, hourglass, tube).
  - **Size and finish:** exact width, height and depth, plus edge bevel, a hollow frame, and the material, colour and acoustic behaviour.
  - **Placement:** free-standing, wall-mounted or hanging. Shapes can be saved to *My Shapes* in the library.
- **Views:** 3D orbit, a true-to-scale Plan with an adjustable cut height, Front, Back, Left and Right elevations with section depth, a Quad view, a first-person Walkthrough and the Listener's-eye view. Walls nearest the camera are cut away automatically, and there's an X-ray mode.
- **80+ items:**
  - **Absorption:** broadband 50/100 mm panels, framed panels, printed art panels, foam, PET felt, curtains, gobos and rugs.
  - **Bass control:** corner superchunks, wall–ceiling traps, 200 mm panels, membrane / limp-mass traps, tube traps and Helmholtz panels.
  - **Diffusion:** QRD (prime 7/11/13/17), 2D skyline, polycylindrical, hybrid BAD panels and bookcases.
  - **Reflection control:** wood slats, slot resonators, angled reflectors and louvred re-directors.
  - **Ceiling:** clouds, baffles, a ceiling skyline, a tile grid and a slatted canopy.
  - **Lighting:** LED panels, downlights, pendants, track spots, RGB strips and tubes, lamps, sconces and an ON AIR sign. These are real light sources with adjustable colour and intensity.
  - **Studio gear:** desks, consoles, monitors (nearfield, midfield and mains), subs, stands, racks, displays, keys, piano, drums, amps, guitars and mics.
  - **Architecture:** acoustic doors, double-glazed windows, partitions, soffits, columns, risers, iso booths and steps.
  - **Primitive shapes:** box, cylinder, sphere, wedge, cone, pyramid, arch and more.
- **Properties:** position, rotation, size presets, two colours, 15 finishes (fabric, felt, wood, concrete, brick, marble, metal, glass and others), per-item options and the acoustic material.
- **Colours:** a colour picker with swatches, colour schemes for the whole room, and colours sampled from the camera.
- **Acoustic analysis:**
  - RT60 per octave band (Sabine and Eyring), compared against the EBU Tech 3276 target.
  - Room modes up to 300 Hz, with clustering and gap warnings, and the Schroeder frequency.
  - A Bolt-area room-ratio check that can apply a recommended ratio.
  - Image-source first-reflection points, drawn in 3D and marked green when treated and red when not.
  - SBIR null frequencies, the stereo listening triangle and the 38 % rule.
  - Plain-language recommendations.
- **✨ Auto-treat** presets for mixing, mastering, tracking, podcast and home theater. They place bass traps, panels at the computed reflection points, a cloud, diffusion and more.
- **Prompt bar (offline, no AI service):** for example `room 4.5 x 6 x 2.8`, `add a barn door on the right wall`, `add 6 hexagon panels on the back wall`, `make the floor herringbone`, `add a velvet sofa`, `add bass traps in all corners and a cloud above the listener`, `paint walls charcoal and floor oak`, `move selected 0.3 left`, `lights warm`, `treat room for mastering`, `top view`, `export pdf`. Feet and centimetres are understood. Voice input works where the browser supports it.
- **Scan and import:**
  - Camera capture can map photos onto walls, sample colours, make printed art panels or set a floor-plan underlay.
  - A guided 6-surface room scan.
  - GLB/OBJ import, including LiDAR room scans from phone apps. A scan sizes the room automatically.
  - Floor-plan images can be imported and traced.
- **Export:**
  - **PDF:** a cover sheet; plan and elevations at standard scales with a title block and scale bar; saved scenes; an item schedule and bill of materials; a colour and material board; and an acoustic report.
  - **Images:** a high-res PNG of any view, or PNGs of every view and scene.
  - **Models and data:** GLB and OBJ models, and the schedule as CSV.
  - **Project file:** saved as JSON.
- **Persistence:** autosaves to IndexedDB on the device. Projects can also be saved and opened as files.

## Keyboard

`V` select · `O` edit room outline · `M` move · `R` rotate · `S` scale · `T` measure · `1–6` views · `7` quad · `8` walk · `F` focus · arrows nudge (Shift ×10) · `[` `]` rotate 15° · `Ctrl+D` duplicate · `Ctrl+Z/Y` undo/redo · `Del` delete · `/` prompt · `?` help

## Code layout

```
index.html            app shell (import map → vendored three.js)
css/app.css           UI theme (responsive; drawers on phones/tablets)
js/main.js            scene, views, tools, placement, panels, history, I/O
js/catalog.js         item definitions + procedural 3D builders
js/acoustics.js       RT60, modes, ratios, reflections, SBIR
js/geometry.js        room outlines, ceiling profiles, areas & volume, shape presets
js/prompt.js          offline natural-language command interpreter
js/scan.js            camera capture, colour sampling, guided scan
js/shapebuilder.js    custom shape builder (profile editor, extrude / revolve, preview)
js/export.js          PDF generation (jsPDF)
js/materials.js       procedural textures, finishes, colour names
sw.js, manifest.webmanifest   offline PWA
vendor/               three.js r169 + addons, jsPDF 2.5.2 (MIT)
tools/build-standalone.mjs    builds dist/RoomTone-standalone.html (npm i && npm run build)
```

Acoustic figures are design estimates based on standard formulas and published
absorption coefficients. Verify the finished room with measurement (e.g. REW).
