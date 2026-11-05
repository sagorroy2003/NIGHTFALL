# NIGHTFALL

> A browser-based top-down survival horror game built from scratch using TypeScript and HTML5 Canvas.  
> You are trapped inside an abandoned, hostile research facility. An autonomous predator stalks the corridors, tracking your movements and sounds.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Architecture Philosophy](#2-tech-stack--architecture-philosophy)
3. [Quick Start](#3-quick-start)
4. [Repository & Directory Structure](#4-repository--directory-structure)
5. [Facility Grid & Map Design](#5-facility-grid--map-design)
6. [Core Entities](#6-core-entities)
7. [Engine Systems](#7-engine-systems)
   - [InputSystem](#inputsystem)
   - [PhysicsSystem](#physicssystem)
   - [Renderer & Visual Effects](#renderer--visual-effects)
8. [Predator AI & Intelligence Architecture](#8-predator-ai--intelligence-architecture)
   - [Pathfinding: BFS vs. A*](#pathfinding-bfs-vs-a)
   - [Finite State Machine (FSM)](#finite-state-machine-fsm)
   - [Perception: Vision Cone & Raycast LOS](#perception-vision-cone--raycast-los)
   - [Perception: Sound Investigation System](#perception-sound-investigation-system)
   - [Predator Memory](#predator-memory)
   - [Behavior Controllers (Patrol, Chase, Search, Investigate)](#behavior-controllers)
9. [Game Loop & Orchestration (`game.ts`)](#9-game-loop--orchestration-gamets)
10. [Configuration & Numeric Constants](#10-configuration--numeric-constants)
11. [Controls & Debug Overlay](#11-controls--debug-overlay)
12. [Current State & Completed Work](#12-current-state--completed-work)
13. [Pending Features & Development Roadmap](#13-pending-features--development-roadmap)
14. [Design Conventions for Collaborating AIs & Developers](#14-design-conventions-for-collaborating-ais--developers)

---

## 1. Project Overview

**NIGHTFALL** is designed as a modular, pure-code game without external engine dependencies (no Phaser, PixiJS, or Three.js). Every mechanic—from circle-to-AABB wall collision and sub-tile raycasting to Manhattan A* pathfinding and multi-sensor finite state transitions—is written from fundamental mathematical and algorithmic principles.

### Core Experience
- **Atmospheric Tension:** Low-visibility horror atmosphere with dark concrete palettes, vignette shading, and directional indicators.
- **Autonomous Stalking:** An imposing predator cycles through distinct facility wings, dynamically navigating around corridors and bulkheads.
- **Dynamic Pursuit & Search:** When spotted, the predator shifts into rapid pursuit. Losing line of sight causes it to advance to your last known position and methodically sweep adjacent tiles before returning to patrol.
- **Auditory Distractions:** Sound events allow room for stealth and distraction mechanics.

---

## 2. Tech Stack & Architecture Philosophy

| Technology | Purpose |
|---|---|
| **TypeScript (5.8.x)** | Type safety, strict compilation, clear entity and event contracts |
| **Vite (6.x)** | Fast HMR dev server and bundled production distribution |
| **HTML5 Canvas 2D** | Direct pixel and vector rendering with zero abstraction overhead |
| **Node.js** | Lightweight headless verification and test simulation scripts |

### Architectural Principles
- **Decoupled Modules:** Game logic does not render; rendering does not update state; AI controllers do not mutate global game states directly.
- **Frame-rate Independence:** All motion, timers, and state transitions are multiplied by `deltaTime` (capped at 100ms to avoid tab-switch physics explosions).
- **Zero Third-Party Game Libraries:** Written from scratch to preserve complete inspectability, educational value, and lightweight footprint.

---

## 3. Quick Start

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation & Execution
```bash
# Clone or navigate to the workspace
cd d:\Projects\Academic\NIGHTFALL

# Install dev dependencies (TypeScript & Vite)
npm install

# Start development server
npm run dev
# Vite will serve the project at http://localhost:5173/

# Type check and build production bundle
npm run build

# Preview production build
npm run preview
```

---

## 4. Repository & Directory Structure

```
NIGHTFALL/
├── index.html                   # Canvas root page
├── package.json                 # Build scripts & dev dependencies
├── tsconfig.json                # Strict TypeScript configuration
├── README.md                    # Project documentation & context
└── src/
    ├── main.ts                  # Bootstrap: attaches Game instance to DOM
    ├── game/
    │   ├── game.ts              # Master coordinator: game loop, FSM evaluation, rendering calls
    │   ├── map.ts               # Facility layout grid, tile queries (isWall, isWalkable)
    │   ├── player.ts            # Player entity factory, dimensions, speed, appearance
    │   └── predator.ts          # Predator entity factory, dimensions, base speed
    ├── systems/
    │   ├── input.ts             # Keyboard listener (WASD/Arrows), vector normalization
    │   ├── physics.ts           # Circle-AABB collision, axis-split wall sliding, coordinate transforms
    │   └── renderer.ts          # Canvas drawer (Map, Player, Predator, Vignette, Debug HUD)
    └── ai/
        ├── fsm.ts               # PredatorFSM: states, transitions, time in state
        ├── memory.ts            # PredatorMemory: tracks last seen player position
        ├── vision.ts            # VisionSystem: radial distance, FOV cone, raycast line-of-sight
        ├── sound.ts             # SoundSystem: grid sound emission, distance-intensity evaluation
        ├── patrol.ts            # PatrolController: cycles 4 key facility rooms via A*
        ├── chase.ts             # ChaseController: high-speed target pursuit with dynamic repathing
        ├── search.ts            # SearchController: investigate last known tile + sweep neighbors
        ├── investigate.ts       # InvestigateController: navigates to audible sound coordinates
        └── algorithms/
            ├── bfs.ts           # Standalone Breadth-First Search (shortest unweighted hop path)
            └── astar.ts         # Standalone A* pathfinding using Manhattan distance heuristic
```

---

## 5. Facility Grid & Map Design

The facility is modeled as a 2D tile matrix (`14 rows × 20 cols`) where each cell is `48 × 48 px`. Total world dimensions: `960 × 672 px`.

- `0 = TILE_FLOOR`: Walkable corridor, room interior, or doorway.
- `1 = TILE_WALL`: Impassable concrete/metal bulkhead.

```
       0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
Row 0  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  <- North Wall
Row 1  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1]  <- Security (L) / Research Lab (R)
Row 2  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1]  <- (Predator Spawn: 16, 2)
Row 3  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]  <- North Hallway Corridor
Row 4  [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1]
Row 5  [1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1]  <- Room Doorways & Dividers
Row 6  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]  <- Central Hall (Player Spawn: 10, 6)
Row 7  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]  <- Central Hall
Row 8  [1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1]  <- Room Doorways & Dividers
Row 9  [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1]
Row 10 [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]  <- South Hallway Corridor
Row 11 [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1]  <- Storage (L) / Generator (R)
Row 12 [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1]
Row 13 [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  <- South Wall
```

### Key Locations & Spawn Points
| Zone / Checkpoint | Coordinates (`col, row`) | Description |
|---|---|---|
| **Research Lab (Lair)** | `(16, 2)` | Predator initial spawn & Patrol Point 0 |
| **Storage Bay** | `(3, 11)` | Southwest wing room & Patrol Point 1 |
| **Generator Room** | `(16, 11)` | Southeast wing room & Patrol Point 2 |
| **Security Bay** | `(3, 2)` | Northwest wing room & Patrol Point 3 |
| **Central Concourse** | `(10, 6)` | Player initial spawn |

---

## 6. Core Entities

Both entities are defined as plain data interfaces (`Player`, `Predator`) and created via factory functions to keep state decoupled from logic.

### Player (`src/game/player.ts`)
```typescript
interface Player {
  x: number;       // Center X position on canvas (px)
  y: number;       // Center Y position on canvas (px)
  radius: number;  // 16 px collision radius
  speed: number;   // 240 px/s (responsive survival movement)
  angle: number;   // Heading orientation in radians (points to movement vector)
  color: string;   // '#4fa3d1' (steel cyan token)
}
```

### Predator (`src/game/predator.ts`)
```typescript
interface Predator {
  x: number;       // Center X position on canvas (px)
  y: number;       // Center Y position on canvas (px)
  radius: number;  // 18 px (distinct silhouette, clears 48px corridors smoothly)
  speed: number;   // 120 px/s default stalk speed (chase mode elevates to 160 px/s)
  angle: number;   // Facing orientation in radians
  color: string;   // '#9e2a2b' (crimson monster hull)
}
```

---

## 7. Engine Systems

### InputSystem (`src/systems/input.ts`)
- Listens to `keydown` and `keyup` for `W, A, S, D` and Arrow keys.
- Normalizes diagonal movement so diagonal traversing does not grant a $\sqrt{2} \approx 1.414\times$ speed advantage.
- Prevents default window scrolling behavior on arrow keys.

### PhysicsSystem (`src/systems/physics.ts`)
- **Coordinate Conversion:** Translates continuous canvas pixel coordinates into discrete grid indices via `canvasToGrid()`.
- **Circle-vs-AABB Collision:** Tests an entity's circular perimeter against adjacent grid tile boxes (`checkCollision()`).
- **Axis-Split Wall Sliding:** When moving into a wall obliquely, motion along X and Y is evaluated independently. If an entity bumps a vertical wall while pressing up-right, horizontal motion is rejected while vertical movement continues unimpeded.

### Renderer & Visual Effects (`src/systems/renderer.ts`)
- **DPR Scaling:** Handles device pixel ratio to ensure crisp rendering on Retina / high-DPI displays.
- **2.5D Tile Styling:** Wall tiles feature top bevel highlights and bottom drop shadows to give depth to the top-down perspective.
- **Horror Vignette:** A radial gradient centered over the player obscures distant rooms in pitch-black shadow while keeping the immediate vicinity faintly illuminated.
- **Entity Accents:** The predator features a pulsating threat aura and glowing yellow optical sensors aligned to its heading angle.
- **Debug HUD:** Monospace diagnostic panel in the upper-right corner toggled via the `F` key.

---

## 8. Predator AI & Intelligence Architecture

The predator's brain is composed of specialized, decoupled subsystems:

```
                      +-------------------+
                      |   VisionSystem    |
                      | (FOV + Raycasting)|
                      +---------+---------+
                                | canSeePlayer
                                v
+------------------+  +-------------------+  +--------------------+
|   SoundSystem    |->|    PredatorFSM    |<-|   PredatorMemory   |
| (Intensity Queue)|  | (Priority Arbiter)|  | (Last Known Grid)  |
+------------------+  +---------+---------+  +--------------------+
                                | Current State
         +----------------------+----------------------+
         |                      |                      |
         v                      v                      v
+------------------+  +-------------------+  +--------------------+
| PatrolController |  |  ChaseController  |  |  SearchController  |
| (4-room circuit) |  | (Target Pursuit)  |  | (Sweep & Neighbor) |
+------------------+  +-------------------+  +--------------------+
         |                      |                      |
         +----------------------+----------------------+
                                |
                                v
                      +-------------------+
                      |   findPathAStar   |
                      | (Grid Navigation) |
                      +-------------------+
```

### Pathfinding: BFS vs. A*
Located in `src/ai/algorithms/`:
1. **BFS (`bfs.ts`):** Unweighted FIFO queue exploration that guarantees the fewest tile hops. Kept as a pure baseline and benchmarking tool.
2. **A* (`astar.ts`):** Heuristic-guided search utilizing Manhattan distance ($|dx| + |dy|$) and cost values ($f = g + h$). Explores four cardinal directions (Up, Down, Left, Right). Evaluated on every pathfinding decision across all controllers.

### Finite State Machine (FSM)
Defined in `src/ai/fsm.ts`:
- **States:**
  - `PATROL`: Wanders between predefined facility wings.
  - `CHASE`: Direct aggressive pursuit of a visible player.
  - `SEARCH`: Methodical sweep of the area where the player was last seen.
  - `INVESTIGATE`: Navigating to the source of an audible disturbance.
- **Arbitration Priority:**  
  $$\text{CHASE} > \text{INVESTIGATE} > \text{SEARCH} > \text{PATROL}$$
- **Key Invariant:** An active `CHASE` is never interrupted by sound events.

### Perception: Vision Cone & Raycast LOS
Defined in `src/ai/vision.ts`:
1. **Distance Check:** Euclidean distance must be $\le 260\text{ px}$ (~$5.4$ tiles).
2. **Field-of-View (FOV) Check:** Angular divergence between the predator's heading and the target must be within half the cone angle ($\pm 54^\circ$, total $108^\circ$).
3. **Raycast Line-of-Sight (LOS):** Casts a ray sampled every $12\text{ px}$ (quarter-tile resolution) from predator center to player center. If any sample strikes a wall tile, vision is blocked.

### Perception: Sound Investigation System
Defined in `src/ai/sound.ts`:
- Emits events on the grid with an intensity multiplier (`0.0` to `3.0`).
- **Effective Hearing Radius:** $\text{EffectiveRange} = 160\text{ px} \times \text{intensity}$.
- The loudest audible sound within hearing distance triggers an transition to `INVESTIGATE`.

### Predator Memory
Defined in `src/ai/memory.ts`:
- Captures and stores `(col, row)` only while `canSeePlayer === true`.
- When the player breaks line of sight, the stored location is locked in place and supplied to the `SearchController`.
- Cleared when the predator gives up and returns to `PATROL`.

### Behavior Controllers
- **`PatrolController` (`src/ai/patrol.ts`):** Navigates to room waypoints, pausing for $1.5\text{ s}$ upon arrival before routing to the next.
- **`ChaseController` (`src/ai/chase.ts`):** Pursues the player at elevated speed ($160\text{ px/s}$). Re-computes A* paths every $250\text{ ms}$ or immediately when the player enters a new grid cell.
- **`SearchController` (`src/ai/search.ts`):** Traverses directly to the last known position. Upon reaching it, inspects up to 4 adjacent walkable tiles (pausing $0.6\text{ s}$ per tile). Times out after $6.0\text{ s}$ and falls back to `PATROL`.
- **`InvestigateController` (`src/ai/investigate.ts`):** Routes to the tile coordinates of a detected sound event. Transitions to `PATROL` upon arrival.

---

## 9. Game Loop & Orchestration (`game.ts`)

The `Game` class handles per-frame orchestration via `requestAnimationFrame`:

```
Frame Start
 ├── 1. Read input vector from InputSystem
 ├── 2. Update player position & slide against walls (PhysicsSystem)
 ├── 3. Increment FSM timer (predatorFSM.update)
 ├── 4. Evaluate predator vision (VisionSystem)
 ├── 5. Update predator memory (only updates if player is visible)
 ├── 6. Evaluate FSM transitions based on priority:
 │       ├─ Can see player? ──► CHASE
 │       ├─ Lost player from CHASE? ──► SEARCH (load memory target)
 │       ├─ Audible sound & not in CHASE? ──► INVESTIGATE
 │       ├─ Search timer expired? ──► PATROL (clear memory)
 │       └─ Arrived at sound target? ──► PATROL
 ├── 7. Dispatch movement update to active controller
 ├── 8. Render pass:
 │       Background ──► Map ──► Predator ──► Vignette ──► Player ──► Debug HUD (if enabled)
 └── Request next frame
```

---

## 10. Configuration & Numeric Constants

| Constant | Value | Defined In | Purpose |
|---|---|---|---|
| `tileSize` | `48 px` | `map.ts` | Base grid cell width & height |
| `player.radius` | `16 px` | `player.ts` | Player collision circle |
| `player.speed` | `240 px/s` | `player.ts` | Player movement velocity |
| `predator.radius` | `18 px` | `predator.ts` | Predator collision circle |
| `predator.speed` (patrol) | `120 px/s` | `predator.ts` | Base stalking movement speed |
| `chaseSpeed` | `160 px/s` | `chase.ts` | Accelerated sprint during pursuit |
| `repathInterval` | `0.25 s` | `chase.ts` | A* re-calculation cadence during chase |
| `vision.range` | `260 px` | `vision.ts` | Maximum perception radius (~5.4 tiles) |
| `vision.fovAngle` | `108 deg` | `vision.ts` | Vision cone spread |
| `vision.rayStep` | `12 px` | `vision.ts` | Sub-tile LOS sampling resolution |
| `hearing.baseRange` | `160 px` | `sound.ts` | Hearing radius at intensity 1.0 (~3.3 tiles) |
| `patrol.pauseDuration` | `1.5 s` | `patrol.ts` | Rest duration at each patrol room |
| `search.duration` | `6.0 s` | `search.ts` | Total search patience before returning to patrol |
| `search.pauseDuration`| `0.6 s` | `search.ts` | Observation pause at inspected neighbor tiles |

---

## 11. Controls & Debug Overlay

### Player Controls
- **`W` / `Arrow Up`**: Move North
- **`S` / `Arrow Down`**: Move South
- **`A` / `Arrow Left`**: Move West
- **`D` / `Arrow Right`**: Move East
- Supports smooth diagonal traversal and continuous wall sliding.

### Developer Debug HUD
Press **`F`** at any time during gameplay to toggle the real-time AI overlay:
- **`STATE`**: Color-coded active FSM state (Green = `PATROL`, Red = `CHASE`, Amber = `SEARCH`, Blue = `INVESTIGATE`).
- **`DETECTED`**: Real-time line-of-sight status (`YES` / `NO`).
- **`LAST SEEN`**: Current grid coordinates stored in predator memory.
- **`SOUND AT`**: Coordinates of the active sound target being investigated.

---

## 12. Current State & Completed Work

- [x] Strict TypeScript configuration and Vite bundler pipeline.
- [x] Facility grid map with multi-room layout and outer wall isolation.
- [x] Continuous player physics with axis-split circle-AABB wall sliding.
- [x] Dark atmospheric renderer with 2.5D bevelled bulkheads, player glow, and horror vignette.
- [x] Standalone BFS pathfinding algorithm (`src/ai/algorithms/bfs.ts`).
- [x] Standalone A* pathfinding algorithm with Manhattan heuristic (`src/ai/algorithms/astar.ts`).
- [x] Autonomous 4-room waypoint patrol cycling (`Research Lab -> Storage -> Generator -> Security`).
- [x] Vision perception system with distance clipping, angular FOV cone, and raycast line-of-sight testing.
- [x] Predator Finite State Machine with transition protections and state duration timers.
- [x] Dynamic chase pursuit with intelligent repathing.
- [x] Predator memory retention of last observed player coordinates.
- [x] Search controller with pathing to last known position and neighbor sweep.
- [x] Sound perception system with distance/intensity evaluation and investigate navigation.
- [x] Real-time diagnostic debug HUD toggled with the `F` key.

---

## 13. Pending Features & Development Roadmap

If you are an AI assistant or human developer continuing work on NIGHTFALL, here is the intended sequence of next tasks:

### 1. Player Footstep Sound Integration
- Hook into `PhysicsSystem.updatePlayerMovement()` or `Game.update()`.
- Emit a `SoundEvent` with intensity `1.0` (or `1.8` while running) when the player traverses across tile boundaries.

### 2. Player Catch & Damage Condition
- In `Game.update()`, check the distance between predator and player centers.
- If $\text{distance} < \text{predator.radius} + \text{player.radius}$, trigger damage or a game-over sequence.

### 3. Facility Objectives & Generator System
- Spawn collectible **Power Cells** across the map (e.g., Security and Storage bays).
- Allow player interaction (press `E`) to pick up power cells.
- Require bringing cells to the **Generator Room** `(16, 11)` to restore power.
- Powering the generator opens the facility exit door in the Security Bay `(3, 2)` for victory.

### 4. Audio Effects & Polish
- Add ambient facility hum, predator groans upon spotting the player, and footstep audio.

---

## 14. Design Conventions for Collaborating AIs & Developers

1. **Keep AI Modules Modular:** Do not merge `memory.ts`, `search.ts`, `chase.ts`, or `sound.ts` into a single monolithic file. Keep single-purpose modules.
2. **Preserve Path Slicing:** Pathfinding algorithms return paths that include the starting cell at index `0`. Controllers must always slice index `0` (`path.slice(1)`) to avoid stuttering on the cell the entity already occupies.
3. **Do Not Commit Automatically:** Make all changes in the working tree and run `npm run build` to verify compilation. Leave git staging/committing to the project maintainer unless explicitly requested.
4. **Preserve Documentation Integrity:** Maintain JSDoc comments and typing clarity on all public methods.

---

*NIGHTFALL — Survival Horror Engine. Built with precision and clean architecture.*
