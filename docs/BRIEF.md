# PETALWORKS
## First-Pass Development Brief | Browser Game | Version 1.0

### The assignment
Build **Petalworks**, a playable, polished vertical slice of a cosy 2D flower-factory automation game for desktop browsers. The player designs a flower-production operation by placing growing beds, conveyor belts and processing machines, then fulfils orders to earn currency and unlock expansion. **There is no controllable character.** All interaction is direct, through the mouse and interface.

The result must feel like a real game, not a technology demo. Prioritise one complete, delightful gameplay loop over a large collection of incomplete systems. Make reasonable implementation decisions without repeatedly asking for clarification. Document decisions and trade-offs.

### Product vision
A tiny garden becomes a flourishing automated flower workshop. Players grow flowers, route them through machines, transform them into arrangements and fulfil customer orders. The pleasure comes from watching a thoughtfully designed factory operate: little flower sprites moving on belts, processing stations animating, products appearing, and orders clicking into completion. The mood is warm, tactile, whimsical and quietly clever, not frantic or industrial.

**Genre:** cosy factory automation + light logistics puzzle + progression.
**Perspective:** readable, true top-down or gentle three-quarter 2D view; choose one and use it consistently. Prefer true top-down for unambiguous grid logic.
**Primary platform:** desktop browser, mouse and keyboard. Plan responsive mobile interactions but do not sacrifice the desktop first pass to force mobile support.
**Target session:** 15–30 minutes for the first-pass slice; architecture should support a future 2+ hour progression arc.
**Business model:** no monetisation, no ads, no login, no energy timers, no forced waits.

### Non-negotiable design principles
1. **Gameplay is real.** Machines have inputs, outputs, recipes, buffers, processing times and observable states. Belts transport discrete items. Orders require actual produced inventory.
2. **The player is the operator, not an avatar.** No Wren movement, pathfinding, dialogue or character controller. Wren may exist later in flavour text, not in the core loop.
3. **Visual quality is a first-class feature.** Do not ship a board made of plain rectangles, flat SVG machines, emoji flowers or default UI components and call it a visual pass. If polished art assets are unavailable, create a small, cohesive, deliberately illustrated asset set first and limit the scope accordingly. Do not pretend temporary assets are final.
4. **Legibility before decoration.** Every machine must be recognisable, its input/output direction clear, and every moving flower visible against the ground.
5. **Deterministic simulation.** The game logic must be independent of frame rate and rendering, with a fixed simulation tick and explicit item-transfer rules.
6. **Delight without friction.** Fast building, undo for placement, clear error feedback, satisfying audio/animation, pause and speed controls.
7. **No fake features.** Every visible control works. If a feature is not implemented, do not show an interactive-looking button for it.
8. **Keep systems modular.** Art can be replaced without rewriting simulation code; recipes and machine definitions are data-driven.

### Technology
- **Vite + TypeScript** for project structure and development.
- **Phaser 3** for world rendering, camera, pointer interactions, particles and in-world animation.
- **React** for HUD, build menu, orders, tooltips, settings and overlays.
- A pure TypeScript simulation layer with no React or Phaser imports.
- Local persistence via IndexedDB or localStorage with a versioned save schema. For the modest first pass, localStorage is acceptable if save payloads remain small.
- Web Audio / small locally bundled sound assets for sound; honour browser audio-unlock rules.
- No backend, accounts, multiplayer, analytics, advertisements or external APIs.
- All required assets bundled locally so the game can run without network access after initial load, if a service worker is implemented.

### Art direction
**Style:** painterly, hand-crafted, storybook-gouache 2D. Soft but rich colour, textured edges, subtle paper grain, warm highlights and delicate shadows. Think a lovingly illustrated tabletop garden with charming mechanical contraptions. Avoid glossy mobile-game plastic, generic vector geometry, excessive bloom, hyperrealism, neon and muddy low-contrast palettes.

**Palette starting point (adjust for legibility):** cream `#F6EBD5`, sage `#A8B99A`, moss `#657C58`, petal pink `#E9A8AF`, coral `#D77F70`, lavender `#B7A4CE`, honey `#DDB66C`, ink `#39463B`. Use named semantic tokens, not scattered hardcoded hex values.

**Asset hierarchy:** garden ground tiles, edge foliage, flower beds, belts (straight, corner, end and directional variants), seed/flower items, processing machines, finished goods, UI icons and small decorative accents. Keep consistent light direction, scale, line weight, shadow depth and texture.

**Art pipeline:** use a manifest such as `assets/manifest.ts` mapping semantic keys to files and metadata. Art must be swappable independently of logic. Prefer transparent PNG/WebP sprite assets or carefully illustrated sprite sheets. Avoid runtime procedural shape art as the final appearance. A simple neutral debug layer is allowed behind a developer flag only.

**First visual milestone:** a static but polished in-engine garden containing one bed, two belt shapes, one machine, flowers and a small HUD. Approve this quality internally before expanding mechanics. If custom artwork cannot be produced programmatically to the desired standard, leave clear asset specifications and be transparent about the limitation; do not claim the aesthetic is finished.

### Core gameplay loop
1. Inspect a customer order.
2. Place flower beds and connect their output to machines using directional conveyor belts.
3. Wait briefly for flowers to grow, then watch items move through the system.
4. Transform flowers into products using machines.
5. Route finished products to a packing/shipping station.
6. Complete orders, earn coins, and unlock the next machine, recipe or patch of garden.
7. Rearrange and optimise the layout to satisfy increasingly varied orders.

The player should always know what to do next and why a factory chain is or is not working.

### First-pass content and production rules
Use a **16 × 12** buildable tile grid initially. Each tile holds at most one structure or belt. Keep decorative ground separate from occupancy. Start with a compact accessible region, with an optional one-time expansion to **20 × 14** after a milestone. The camera can pan and zoom within sensible limits.

**Resources:**
- Daisy: produced by Daisy Bed every 4 seconds.
- Lavender: produced by Lavender Bed every 6 seconds, unlocked after early orders.
- Daisy Bundle: created by a Bundling Table from 2 daisies in 5 seconds.
- Lavender Sachet: created by a Drying Bench from 2 lavender in 7 seconds.
- Mixed Bouquet: created by an Arrangement Table from 1 Daisy Bundle + 1 Lavender Sachet in 8 seconds.

These values are starting balance parameters, not fixed lore. Store them in data files.

**Buildings:**
- Daisy Bed and Lavender Bed: produce one flower at a time; pause when output is blocked. Visually indicate growing, ready and blocked states.
- Conveyor Belt: one item per tile, moves in its indicated direction at a clear, consistent cadence; supports corners via directional tile adjacency, with a simple rotation control. No teleportation.
- Bundling Table: buffers inputs, consumes exact ingredients, waits processing duration, outputs bundle when space is available.
- Drying Bench: same, producing sachets.
- Arrangement Table: combines two different inputs into a bouquet. To avoid ambiguous input ports, permit receiving valid inputs from any adjacent belt and output only in the machine's marked facing direction.
- Packing Station: accepts completed goods, stores counts and allocates them to active orders. It must not magically accept items that were never delivered.

**Transport:** process the network in fixed ticks. On each tick, resolve proposed item moves deterministically, avoiding two items entering the same destination. Item movement must be visually interpolated between tile centres. Belts cannot overwrite occupied tiles or push through blocked machines. An item reaching a machine with no matching recipe or a full input buffer stops, with visible feedback. No item duplication or loss during normal transport. Allow player rotation of belts before or after placement, but prevent invalid changes from deleting inventory.

**Build controls:** left-click to place/select, drag to lay belts, `R` to rotate, right-click or `Esc` to cancel, delete tool to remove empty structures, `Z` for undo of recent build actions when safe. If a structure contains items, either block removal with an explanation or return them to a clearly defined recoverable inventory; choose one consistent policy. Show a ghost preview, placement validity and cost before confirmation.

**Economy:** start with enough coins to build a functioning Daisy Bundle chain without softlocking. Completing orders pays coins. Construction costs must be affordable within reachable order rewards. Selling/removing structures should have a documented refund policy. No recurring upkeep or fuel for first pass.

**Orders and progression:** include at least 6 hand-authored orders in a fixed sequence that teach the game progressively:
1. Deliver 2 raw daisies (teach production and shipping).
2. Deliver 2 Daisy Bundles (teach processing).
3. Deliver 4 Daisy Bundles (teach throughput and layout).
4. Deliver 2 raw lavender (unlock lavender).
5. Deliver 2 Lavender Sachets (teach second production chain).
6. Deliver 1 Mixed Bouquet (teach multi-input crafting).

Display current order, requirements, progress and reward. Only show recipes and build options the player has unlocked. On completion, provide clear celebratory feedback and unlock the next objective. After the sixth order, show a completion moment and allow sandbox continuation; do not leave the player at a dead end.

### UX and interface
**Desktop layout:** central world canvas; compact top bar with coins, current order, pause/speed and settings; collapsible left or bottom build palette; contextual inspector for selected machines; lightweight notifications. Avoid permanent giant panels that obscure the board.

**Controls:** mouse-wheel zoom centred near pointer; click-drag on empty space or middle mouse to pan; clicking a building selects it; build mode and camera pan must not conflict. Provide a short interactive tutorial with contextual prompts that can be skipped and reopened. No modal interruptions during routine gameplay.

**Feedback:** hover tooltips show cost and purpose; selected machines show recipe, progress, buffer status and output direction. Clearly distinguish growing, processing, blocked, waiting for inputs and ready to output. Add tiny visual pops when products finish, subtle belt motion, and a warm completion animation. Respect reduced-motion preferences and offer sound/music toggles.

**Accessibility:** readable text, strong contrast, keyboard-accessible menus, visible focus states, non-colour-only status indicators, configurable sound, reduced motion. Make tile targets sufficiently large at default zoom. Do not rely solely on tiny pictograms.

### Save and recovery
Autosave after meaningful build actions, order completion and periodically during play. Persist grid occupancy, structure orientations, production buffers, items in transit, money, unlocks, active order, completed orders, tutorial state and settings. On reload, restore a valid game without duplication. Include `New Game` with confirmation and `Continue` when a save exists. Use a schema version and safe handling for corrupted saves.

### Simulation architecture
Suggested modules:
- `src/sim/types.ts`: world, item, machine, recipe, order and save types.
- `src/sim/data/`: machine definitions, recipes, unlocks, balance and orders.
- `src/sim/grid.ts`: occupancy, placement and neighbour lookup.
- `src/sim/transport.ts`: deterministic belt and transfer rules.
- `src/sim/production.ts`: timed growth, buffers, crafting and output.
- `src/sim/orders.ts`: packing and reward allocation.
- `src/sim/game.ts`: simulation tick and action dispatcher.
- `src/sim/save.ts`: serialisation, validation and migration.
- `src/game/`: Phaser scenes, camera, sprite registry and effects.
- `src/ui/`: React HUD, build palette, inspector, tutorial and menus.

Simulation updates should return state changes/events that the renderer can animate. Phaser must not be the source of truth for inventory or production. Avoid deeply coupled singleton state and giant all-in-one scene files.

### Build phases and checkpoints
**Phase 1: foundation and visual proof.** Scaffold Vite, TypeScript, React and Phaser. Implement camera, grid, art registry, representative illustrated assets and HUD. Verify the world is attractive at the intended screen size before proceeding.

**Phase 2: complete Daisy chain.** Implement placement, rotation, Daisy Bed, belts, Bundling Table, Packing Station, discrete item transport, first two orders, money and save/load. This is the first truly playable milestone.

**Phase 3: progression.** Add Lavender Bed, Drying Bench, Arrangement Table, orders 3–6, unlocks, expansion and sandbox continuation. Verify no softlocks.

**Phase 4: polish.** Add contextual tutorial, inspector, animations, sound, keyboard controls, reduced motion, balancing and bug fixes. Test fresh starts and restored saves.

### Acceptance criteria
The first pass is complete only when all the following are true:
- A fresh player can complete all 6 orders without developer intervention.
- A Daisy Bed can feed a Bundling Table through belts, and bundles can travel to Packing Station.
- Lavender and mixed bouquets work through actual production chains.
- Items do not duplicate, vanish, jump across gaps or overlap illegally.
- Incorrect placement and blocked outputs produce clear feedback.
- Save/reload restores progress, inventory, machinery and the current order.
- The player cannot become permanently stuck because required equipment is unaffordable or an unlock is unreachable.
- The game looks intentionally illustrated and cohesive at first launch, not like an engineering prototype.
- All visible buttons, settings and controls function.
- It runs locally with documented commands and produces a deployable static build.
- No runtime errors in a normal 20-minute play session.

### Tests to write
Use Vitest for pure simulation tests covering recipe consumption, blocked outputs, full buffers, simultaneous belt moves, contested destinations, rotation, building removal, insufficient funds, order allocation, unlocks, saving and restoration. Add at least one browser smoke test using Playwright if available. Test a clean save and a completed save. Verify that processing times do not depend on browser frame rate. Document known limitations.

### Out of scope for the first pass
No controllable character, NPC pathfinding, multiplayer, backend, cloud saves, monetisation, mobile app packaging, seasonal events, bees, genetic flower splicing, weather, complex power networks, procedural map generation, infinite order generation or 3D. These are candidates for future milestones, not promises for the first implementation.

### Deliverables
1. A working project with clear README setup, run, test and build commands.
2. A playable first-pass game with six orders and sandbox continuation.
3. Cohesive local art assets and an asset registry.
4. Data-driven recipes, machines, orders and unlocks.
5. Automated tests for critical simulation rules.
6. A brief `DESIGN_DECISIONS.md` explaining architecture, art approach, controls, trade-offs and next priorities.
7. A `KNOWN_ISSUES.md` listing anything incomplete without disguising it as finished.

### Instructions to the coding agent
Implement the project in the stated phases. Do not stop after generating a plan or writing documentation; produce and run code. Keep the game playable after each phase. Make sensible choices independently and avoid asking for permission on routine decisions. Run the build and tests, fix errors, and verify the main gameplay path. If time or tool limits prevent completing every phase, deliver the strongest genuinely playable slice first and clearly identify the missing work. Never report a feature as complete without implementing and testing it. Above all: do not sacrifice visual cohesion or a working core loop to create more nominal features.
