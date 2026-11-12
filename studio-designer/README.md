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
- **Design faster (Design ▾ menu):**
  - **✨ Design wizard:** answer a short brief (purpose, size, shape, ceiling, isolation level, budget level, colour scheme, lighting) and get a complete starting design — listening position, treatment at the calculated reflection points, tuned bass traps, construction build-ups, colours, lighting and a door.
  - **🏆 Studio Score:** a live 0–100 score in the status bar. Its breakdown covers bass response at the mix position, reverberation time, first reflections, speaker/listener geometry, room proportions and modes, bass trapping and sound isolation. Each row has a one-click fix, and "Fix everything below 70" applies them all.
  - **🔀 Design options:** save full snapshots of alternatives and compare them side by side on score, RT60, bass smoothness, weakest isolation, item count and cost, with the best value starred.
  - **💰 Cost estimate & bill of quantities:** quantities come straight from the model — board and insulation areas with waste, stud and channel lengths, clip, hanger and pad counts, sealant tubes, and every placed item. Unit prices are editable placeholders remembered on the device, with currency, waste, labour, contingency and a budget check. Exports to CSV and a PDF page.
  - **⇋ Symmetry lock:** anything you add, move, resize, recolour or delete off the centre line is mirrored to the other side automatically.
  - **Magnetic walls:** wall-mounted items stay flush to the nearest wall as you drag them.
  - **Editing:** copy/paste (`Ctrl+C` / `Ctrl+V`), group/ungroup (`Ctrl+G` / `Ctrl+Shift+G`), and text notes with a leader pin.
- **Present & share (Present ▾ menu):**
  - **Render styles:** Realistic, Clay model, Sketch (line drawing), Blueprint and Night. The chosen style also applies to PNG and PDF exports.
  - **🌐 360° panorama:** an equirectangular JPG from the listening position, for 360 viewers and VR headsets.
  - **🎬 Video:** a 12-second turntable or a tour of your saved scenes, recorded in the browser as WebM.
  - **🔗 Share as one HTML file:** a single file with the design embedded. A client opens it in any browser, offline, and can orbit, walk through and edit — nothing to install.
  - **🪄 AI render hand-off:** a clay, line or colour reference image of the current view plus a prompt written from your design, for cloud AI renderers when you are online.
- **CAD interchange:** export the plan as DXF (millimetres, layered: walls, openings, treatment, furniture, lighting, construction, dimensions, text) or SVG; import a room outline from a DXF (closed polyline or connected lines; mm, cm, m, in or ft).
- **🧱 Construction & sound isolation:**
  - **Studio materials library (84 materials):**
    - **Mass & boards:** drywall types, laminated damped gypsum, cement board, gypsum fibreboard, OSB, plywood, MDF, CLT, mass-loaded vinyl, lead.
    - **Structure:** concrete, block, brick, AAC, screed.
    - **Damping:** viscoelastic compound, damping tape, constrained-layer damping sheets.
    - **Decoupling hardware:** isolation clips + hat channel, resilient channel, wood channel/battens, neoprene and spring hangers, isolation pads, spring floor isolators, elastomer strips.
    - **Framing:** timber and steel studs, staggered and independent studs, joists, sleepers.
    - **Insulation & cavity:** mineral wool, glass wool, rigid fibreglass, PET, cellulose, wood fibre, cotton, air gaps.
    - **Seals & joints:** acoustic sealant, perimeter strip, putty pads, backer rod.
    - **Floor build-up:** underlays, hardwood, engineered wood, rubber.
    - **Glazing:** float and laminated acoustic glass.
    - **Treatment media:** melamine, PU foam, wood-wool, PET felt, perforated MDF, acoustic plaster, stretch-fabric systems, ceiling tile.
    - **Extras:** the library also lists the absorption-coefficient tables and every aesthetic finish. It can be searched and exported to CSV.
  - **Build-ups for every wall, the floor and the ceiling:** start from a preset or build your own layer by layer (material, thickness, spacing), reorder layers, and apply one build-up to all walls.
    - **Wall presets:** single/double/staggered stud, resilient channel, clips + hat channel, steel stud, room-in-room, double stud, battens.
    - **Floor presets:** slab, floating floor on pads, floating deck on rubber underlay, floating screed, spring jack-up slab, raised joist floor.
    - **Ceiling presets:** resilient channel, clips, spring hangers, independent joists.
  - **3D construction:** layers render with the openings cut through them. Studs and plates frame around doors and windows, with channels, clips, hangers, pads and sealant beads.
  - **Section and isolation per surface:** a section drawing plus an isolation estimate — transmission loss per octave, an Rw/STC-style rating, mass–air–mass resonance f₀, thickness and surface mass, with warnings (rigid bridging, f₀ too high, empty cavity, no damping).
  - **Isolation summary (Acoustics tab):** composite ratings that include the doors and windows (Rw estimated by door/window style), the weakest element highlighted, and one-click "pro" (room-in-room) and "home-studio" construction sets.
  - **Placeable construction items:** boards/sheets of any library material, stud frame sections, isolation clips, channel/batten runs, ceiling hangers, pads/spring mounts and a floating floor platform.
- **👁 Visibility layers** (toolbar *Layers ▾* and the Layers tab):
  - **Layers:** plain surfaces, structure, boards, membranes, insulation, framing, isolation hardware, treatment, doors/windows, partitions, placed construction items, furniture, gear, lighting, shapes and annotations.
  - **Controls:** a show/hide eye and a *solo* button on each layer, plus presets (Plain room, Construction only, Framing & hardware, Treatment only, Interior design).
  - **Prompt support:** e.g. "show only framing", "hide treatment", "make it room in room", "add a floating floor", "add MLV sheet on the left wall".
- **🎛 Room Mode Calculator (AMROC-style, `K`):**
  - **Inputs:** length, width and height in **metres or feet**, temperature (°C/°F, which sets the speed of sound), and a range up to 150–500 Hz.
  - **Mode table:** every axial, tangential and oblique mode with its indices, a description, the musical note and cents, wavelength, spacing and flags for coincident modes. Play any mode as a tone, or export the table as CSV.
  - **Spectrum and Bonello:** a modal spectrum with the Schroeder frequency marked and coincidence/gap markers, plus a Bonello ⅓-octave check (pass/fail).
  - **Pressure maps:** each mode shown in plan, side or front section with the speaker and listener positions. The same map can be overlaid in the 3D room as a slice you can move, and you can step through modes there.
  - **Response and best seat:** a modal simulation of the bass response at the listening position (both, left or right speaker), compared with the bare room. It includes tuned traps, and shows the low-frequency RT60 per ⅓-octave.
  - **Best listening position finder:** a smoothness heat map, a recommended seat, and one click to move the listener, chair, desk and speakers there.
  - **Treatment zones:** problem frequencies ranked for *your* speaker and listener positions (peaks or nulls at the listener, coincident modes), with where to treat and how. One click adds tuned traps or the recommended low-frequency treatment.
  - **Trap designer:** membrane/panel traps (with a panel mass list), perforated Helmholtz panels, slot resonators and porous quarter-wave depth. Results can be added straight to the room.
  - **Room ratios:** a Bolt-area chart with Sepmeyer, Louden, IEC and golden ratios, and "try" buttons.
  - **Tone generator:** sine tones and sweeps for finding modes by ear in the real room.
  - **PDF page:** a "Room modes & low-frequency treatment" page in the export.
- **Units:** a quick **m / ft** toggle in the toolbar applies everywhere.
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

`V` select · `O` edit room outline · `K` room modes · `Ctrl+C/V` copy/paste · `Ctrl+G` group · `M` move · `R` rotate · `S` scale · `T` measure · `1–6` views · `7` quad · `8` walk · `F` focus · arrows nudge (Shift ×10) · `[` `]` rotate 15° · `Ctrl+D` duplicate · `Ctrl+Z/Y` undo/redo · `Del` delete · `/` prompt · `?` help

## Code layout

```
index.html            app shell (import map → vendored three.js)
css/app.css           UI theme (responsive; drawers on phones/tablets)
js/main.js            scene, views, tools, placement, panels, history, I/O
js/catalog.js         item definitions + procedural 3D builders
js/acoustics.js       RT60, modes, ratios, reflections, SBIR
js/pro.js             Studio Score, design wizard, costing, options, DXF/SVG, sharing, AI hand-off
js/studiomaterials.js studio materials DB, build-up presets, sound-isolation estimator
js/modes.js           room-mode calculator, modal simulation, trap tuning, tone generator
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
