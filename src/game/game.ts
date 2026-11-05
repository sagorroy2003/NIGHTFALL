import { Renderer } from '../systems/renderer';
import { InputSystem } from '../systems/input';
import { PhysicsSystem } from '../systems/physics';
import { PatrolController } from '../ai/patrol';
import { ChaseController } from '../ai/chase';
import { SearchController } from '../ai/search';
import { InvestigateController } from '../ai/investigate';
import { VisionSystem, VisionResult } from '../ai/vision';
import { PredatorFSM, PredatorState } from '../ai/fsm';
import { PredatorMemory } from '../ai/memory';
import { SoundSystem, SoundEvent } from '../ai/sound';
import { Player, createPlayer } from './player';
import { Predator, createPredator } from './predator';
import { GameMap } from './map';

/**
 * Main Game class — NIGHTFALL Predator Intelligence Integration.
 *
 * Orchestrates the complete game loop:
 *   - Player movement with wall collision (WASD / Arrow keys)
 *   - Predator FSM with priority: CHASE > INVESTIGATE > SEARCH > PATROL
 *   - A* navigation for all predator states
 *   - Predator memory (last known player position)
 *   - Vision perception (FOV + ray-cast LOS)
 *   - Sound perception (grid-based events, intensity-scaled range)
 *   - Debug HUD overlay (toggled with the F key)
 *   - Rendering: map, predator, vignette, player, optional HUD
 */
export class Game {
  // ── Core systems ────────────────────────────────────────────────────────
  private renderer: Renderer;
  private inputSystem: InputSystem;
  private map: GameMap;

  // ── Entities ────────────────────────────────────────────────────────────
  private player: Player;
  private predator: Predator;

  // ── AI sub-systems ───────────────────────────────────────────────────────
  private patrolController: PatrolController;
  private chaseController: ChaseController;
  private searchController: SearchController;
  private investigateController: InvestigateController;
  private visionSystem: VisionSystem;
  private predatorFSM: PredatorFSM;
  private predatorMemory: PredatorMemory;
  private soundSystem: SoundSystem;

  // ── Frame state ──────────────────────────────────────────────────────────
  private latestVisionResult: VisionResult | null = null;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number | null = null;

  // ── Viewport ─────────────────────────────────────────────────────────────
  private resizeHandler: () => void;
  private currentOffset: { x: number; y: number };

  // ── Debug HUD ────────────────────────────────────────────────────────────
  /**
   * When true, the AI debug HUD is rendered.
   * Toggle by pressing the F key while the game is running.
   */
  private debugEnabled: boolean = false;

  /**
   * Column of the last active sound investigation target (shown in HUD).
   * Cleared when investigation ends.
   */
  private lastInvestigateCol: number | null = null;
  /**
   * Row of the last active sound investigation target (shown in HUD).
   */
  private lastInvestigateRow: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.inputSystem = new InputSystem();
    this.map = new GameMap();

    // ── AI controllers ────────────────────────────────────────────────────
    this.patrolController      = new PatrolController();
    this.chaseController       = new ChaseController();
    this.searchController      = new SearchController();
    this.investigateController = new InvestigateController();
    this.visionSystem          = new VisionSystem();
    this.predatorFSM           = new PredatorFSM(PredatorState.PATROL);
    this.predatorMemory        = new PredatorMemory();
    this.soundSystem           = new SoundSystem();

    this.currentOffset = this.getMapOffset();

    // ── Spawn player in central hallway (Row 6, Col 10) ──────────────────
    const playerSpawnX = this.currentOffset.x + (10 + 0.5) * this.map.tileSize;
    const playerSpawnY = this.currentOffset.y + (6  + 0.5) * this.map.tileSize;
    this.player = createPlayer(playerSpawnX, playerSpawnY);

    // ── Spawn predator in Research Lab (Row 2, Col 16) ───────────────────
    const predatorSpawnX = this.currentOffset.x + (16 + 0.5) * this.map.tileSize;
    const predatorSpawnY = this.currentOffset.y + (2  + 0.5) * this.map.tileSize;
    this.predator = createPredator(predatorSpawnX, predatorSpawnY);

    // ── Reposition entities when viewport is resized ──────────────────────
    this.resizeHandler = () => {
      const newOffset = this.getMapOffset();
      const deltaX = newOffset.x - this.currentOffset.x;
      const deltaY = newOffset.y - this.currentOffset.y;
      this.player.x  += deltaX;
      this.player.y  += deltaY;
      this.predator.x += deltaX;
      this.predator.y += deltaY;
      this.currentOffset = newOffset;
    };
    window.addEventListener('resize', this.resizeHandler);

    // ── Debug HUD toggle key (F) ──────────────────────────────────────────
    this.setupDebugKey();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Returns the most recent vision evaluation result.
   */
  public getVisionResult(): VisionResult | null {
    return this.latestVisionResult;
  }

  /**
   * Returns the predator FSM for external inspection or testing.
   */
  public getPredatorFSM(): PredatorFSM {
    return this.predatorFSM;
  }

  /**
   * Submits a sound event to the sound perception system.
   * Any game system (input, physics, story triggers) can call this.
   *
   * @param event - SoundEvent with grid position and intensity
   */
  public emitSound(event: SoundEvent): void {
    this.soundSystem.emit(event);
  }

  /**
   * Starts the game loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
    console.log('[NIGHTFALL] Game loop started. Press F to toggle AI debug HUD.');
  }

  /**
   * Stops the game loop and cleans up event listeners.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.inputSystem.cleanup();
    this.renderer.cleanup();
    window.removeEventListener('resize', this.resizeHandler);
    console.log('[NIGHTFALL] Game loop stopped.');
  }

  // ─── Core Loop ────────────────────────────────────────────────────────────

  /** Main animation frame callback. */
  private gameLoop = (currentTime: number): void => {
    if (!this.isRunning) return;

    // Cap delta time to 100ms to prevent spiral-of-death on hidden tabs
    const rawDelta = (currentTime - this.lastTime) / 1000;
    const deltaTime = Math.min(rawDelta, 0.1);
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  /**
   * Per-frame update: player movement, vision, sound, FSM transitions, AI behavior.
   */
  private update(deltaTime: number): void {
    const movement = this.inputSystem.getMovementVector();
    const offset   = this.getMapOffset();

    // ── 1. Move player ────────────────────────────────────────────────────
    PhysicsSystem.updatePlayerMovement(this.player, movement, this.map, offset, deltaTime);

    // ── 2. Advance FSM timer ──────────────────────────────────────────────
    this.predatorFSM.update(deltaTime);

    // ── 3. Evaluate predator vision ───────────────────────────────────────
    this.latestVisionResult = this.visionSystem.evaluate(
      this.predator, this.player, this.map, offset
    );
    const canSeePlayer = this.latestVisionResult.canSeePlayer;

    // ── 4. Update predator memory (only records when player is visible) ───
    const playerGrid = PhysicsSystem.canvasToGrid(this.player.x, this.player.y, this.map, offset);
    this.predatorMemory.update(canSeePlayer, playerGrid.col, playerGrid.row);

    // ── 5. FSM Transition Logic (Priority: CHASE > INVESTIGATE > SEARCH > PATROL) ──
    this.evaluateTransitions(canSeePlayer, offset, deltaTime);

    // ── 6. Execute behavior for the current active state ──────────────────
    this.executeBehavior(offset, deltaTime);
  }

  /**
   * Evaluates FSM state transitions with the defined priority order.
   *
   * Priority rules:
   *   1. CHASE has highest priority — any visible player triggers or sustains it.
   *   2. INVESTIGATE — triggered by sound when NOT already chasing.
   *   3. SEARCH — entered when CHASE loses the player.
   *   4. PATROL — lowest priority fallback.
   */
  private evaluateTransitions(
    canSeePlayer: boolean,
    offset: { x: number; y: number },
    _deltaTime: number
  ): void {
    const state = this.predatorFSM.getState();

    // Priority 1: Visible player always triggers CHASE (from any state)
    if (canSeePlayer && state !== PredatorState.CHASE) {
      if (this.predatorFSM.transitionTo(PredatorState.CHASE)) {
        this.chaseController.reset();
        console.log('[FSM] → CHASE (player spotted)');
      }
      return;
    }

    // Priority 2: Active CHASE — no sound interruptions; lose sight → SEARCH
    if (state === PredatorState.CHASE && !canSeePlayer) {
      this.chaseController.reset();
      const memory = this.predatorMemory.get();
      if (memory.hasMemory) {
        this.searchController.reset(memory.lastKnownCol!, memory.lastKnownRow!);
      }
      if (this.predatorFSM.transitionTo(PredatorState.SEARCH)) {
        console.log('[FSM] → SEARCH (player lost)');
      }
      return;
    }

    // Priority 3: Sound detection (only when NOT in CHASE)
    if (state !== PredatorState.CHASE) {
      const soundResult = this.soundSystem.evaluate(
        this.predator.x,
        this.predator.y,
        this.map,
        offset
      );

      if (soundResult.detectedEvent !== null) {
        const ev = soundResult.detectedEvent;
        this.investigateController.setTarget(ev.col, ev.row);
        this.lastInvestigateCol = ev.col;
        this.lastInvestigateRow = ev.row;
        if (this.predatorFSM.transitionTo(PredatorState.INVESTIGATE)) {
          console.log(`[FSM] → INVESTIGATE sound at (${ev.col}, ${ev.row})`);
        }
        return;
      }
    }

    // Priority 4: State-specific exit conditions
    switch (state) {
      case PredatorState.SEARCH:
        if (this.searchController.isComplete()) {
          this.predatorMemory.clear();
          this.lastInvestigateCol = null;
          this.lastInvestigateRow = null;
          if (this.predatorFSM.transitionTo(PredatorState.PATROL)) {
            console.log('[FSM] → PATROL (search timeout)');
          }
        }
        break;

      case PredatorState.INVESTIGATE:
        if (this.investigateController.hasArrived()) {
          this.lastInvestigateCol = null;
          this.lastInvestigateRow = null;
          if (this.predatorFSM.transitionTo(PredatorState.PATROL)) {
            console.log('[FSM] → PATROL (investigation complete)');
          }
        }
        break;

      default:
        break;
    }
  }

  /**
   * Dispatches behavior execution to the appropriate controller
   * for the predator's current FSM state.
   */
  private executeBehavior(offset: { x: number; y: number }, deltaTime: number): void {
    switch (this.predatorFSM.getState()) {
      case PredatorState.PATROL:
        this.patrolController.update(this.predator, this.map, offset, deltaTime);
        break;

      case PredatorState.CHASE:
        this.chaseController.update(
          this.predator, this.player, this.map, offset, deltaTime
        );
        break;

      case PredatorState.SEARCH:
        this.searchController.update(this.predator, this.map, offset, deltaTime);
        break;

      case PredatorState.INVESTIGATE:
        this.investigateController.update(this.predator, this.map, offset, deltaTime);
        break;
    }
  }

  /**
   * Renders the frame: background → map → predator → vignette → player → HUD.
   */
  private render(): void {
    const offset = this.getMapOffset();

    this.renderer.clear();
    this.renderer.renderBackground();
    this.renderer.renderMap(this.map, offset.x, offset.y);
    this.renderer.renderPredator(this.predator);
    this.renderer.renderVignette(this.player.x, this.player.y);
    this.renderer.renderPlayer(this.player);

    if (this.debugEnabled) {
      const memory = this.predatorMemory.get();
      this.renderer.renderDebugHUD(
        this.predatorFSM.getState(),
        this.latestVisionResult?.canSeePlayer ?? false,
        memory.lastKnownCol,
        memory.lastKnownRow,
        this.lastInvestigateCol,
        this.lastInvestigateRow
      );
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Calculates the pixel offset needed to center the map on the viewport.
   */
  private getMapOffset(): { x: number; y: number } {
    const mapW = this.map.getWidthInPixels();
    const mapH = this.map.getHeightInPixels();
    return {
      x: Math.max(0, Math.floor((this.renderer.getWidth()  - mapW) / 2)),
      y: Math.max(0, Math.floor((this.renderer.getHeight() - mapH) / 2)),
    };
  }

  /**
   * Registers the F-key listener that toggles the AI debug HUD.
   */
  private setupDebugKey(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        this.debugEnabled = !this.debugEnabled;
        console.log(`[NIGHTFALL] Debug HUD ${this.debugEnabled ? 'ON' : 'OFF'}`);
      }
    });
  }
}
