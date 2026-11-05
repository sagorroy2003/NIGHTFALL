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
import { Predator, createPredator, checkPredatorCatch } from './predator';
import { GameMap } from './map';
import { GameState, stateManager } from './gameState';
import { ObjectiveSystem } from './objectives';
import { Interactable, InteractableType, generateRandomInteractables } from './interactables';
import { AudioManager } from '../systems/audio'; // NEW AUDIO


export class Game {
  private renderer: Renderer;
  private inputSystem: InputSystem;
  private map: GameMap;

  private player: Player;
  private predator: Predator;

  private patrolController: PatrolController;
  private chaseController: ChaseController;
  private searchController: SearchController;
  private investigateController: InvestigateController;
  private visionSystem: VisionSystem;
  private predatorFSM: PredatorFSM;
  private predatorMemory: PredatorMemory;
  private soundSystem: SoundSystem;
  private objectiveSystem: ObjectiveSystem;
  private audioManager: AudioManager; // NEW AUDIO

  private latestVisionResult: VisionResult | null = null;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number | null = null;

  private resizeHandler: () => void;
  private currentOffset: { x: number; y: number };

  private debugEnabled: boolean = false;
  private lastInvestigateCol: number | null = null;
  private lastInvestigateRow: number | null = null;

  private items: Interactable[] = [];
  private currentInteractionPrompt: string | null = null;
  private nearestInteractable: Interactable | null = null;

  private lightningTimer: number = 5 + Math.random() * 10;
  private lightningFlashIntensity: number = 0;

  private spawnPoints = [
    { col: 3, row: 2 },
    { col: 16, row: 2 },
    { col: 3, row: 11 },
    { col: 10, row: 2 },
    { col: 10, row: 11 }
  ];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.inputSystem = new InputSystem();
    this.map = new GameMap();
    this.objectiveSystem = new ObjectiveSystem();
    this.audioManager = new AudioManager(); // NEW AUDIO
    this.items = generateRandomInteractables(this.map);

    this.patrolController = new PatrolController();
    this.chaseController = new ChaseController();
    this.searchController = new SearchController();
    this.investigateController = new InvestigateController();
    this.visionSystem = new VisionSystem();
    this.predatorFSM = new PredatorFSM(PredatorState.PATROL);
    this.predatorMemory = new PredatorMemory();
    this.soundSystem = new SoundSystem();

    this.currentOffset = this.getMapOffset();

    this.player = createPlayer(0, 0);
    this.predator = createPredator(0, 0);
    this.randomizeSpawns();

    this.resizeHandler = () => {
      const newOffset = this.getMapOffset();
      const deltaX = newOffset.x - this.currentOffset.x;
      const deltaY = newOffset.y - this.currentOffset.y;
      this.player.x += deltaX; this.player.y += deltaY;
      this.player.startX += deltaX; this.player.startY += deltaY;
      this.predator.x += deltaX; this.predator.y += deltaY;
      this.predator.startX += deltaX; this.predator.startY += deltaY;
      this.currentOffset = newOffset;
    };
    window.addEventListener('resize', this.resizeHandler);
    this.setupGlobalControls();
  }

  public getVisionResult(): VisionResult | null { return this.latestVisionResult; }
  public getPredatorFSM(): PredatorFSM { return this.predatorFSM; }
  public emitSound(event: SoundEvent): void { this.soundSystem.emit(event); }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    stateManager.state = GameState.MENU;
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
    this.inputSystem.cleanup();
    this.renderer.cleanup();
    this.audioManager.stopAll();
    window.removeEventListener('resize', this.resizeHandler);
  }

  private gameLoop = (currentTime: number): void => {
    if (!this.isRunning) return;
    const rawDelta = (currentTime - this.lastTime) / 1000;
    const deltaTime = Math.min(rawDelta, 0.1);
    this.lastTime = currentTime;

    this.update(deltaTime, currentTime); // Passed currentTime for audio
    this.render();

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  private update(deltaTime: number, currentTime: number): void {
    if (!stateManager.isPlaying()) return;

    const movement = this.inputSystem.getMovementVector();
    const offset = this.getMapOffset();

    PhysicsSystem.updatePlayerMovement(this.player, movement, this.map, offset, deltaTime);
    this.objectiveSystem.update(deltaTime);

    // --- CONTINUOUS BROKEN LIGHT LOGIC ---
    this.lightningTimer -= deltaTime;

    if (this.lightningTimer <= 0) {
      // Random intensity: sometimes a bright spark (1.0), sometimes a dim glow (0.2)
      this.lightningFlashIntensity = 0.2 + Math.random() * 0.8;

      // Extremely short intervals for a continuous, erratic strobe (0.05s to 0.4s)
      this.lightningTimer = 0.05 + Math.random() * 0.35;

      // Only play the loud audio 5% of the time so the speakers don't distort
      if (Math.random() > 0.95) {
        this.audioManager.playThunder();
      }
    }

    // Fade out rapidly to create the constant "dipping" and "dimming" effect
    if (this.lightningFlashIntensity > 0) {
      this.lightningFlashIntensity -= deltaTime * 5.0;
      if (this.lightningFlashIntensity < 0) {
        this.lightningFlashIntensity = 0;
      }
    }
    // --------------------------------------

    // AUDIO: Update Heartbeat based on distance
    const distToPredator = Math.hypot(this.player.x - this.predator.x, this.player.y - this.predator.y);
    this.audioManager.updateHeartbeat(distToPredator, currentTime);

    if (!this.player.isDead && checkPredatorCatch(this.predator, this.player)) {
      this.player.isDead = true;
      stateManager.state = GameState.GAME_OVER;
      this.audioManager.stopAll(); // Stop scary sounds
      this.updateHTMLOverlay();
      return;
    }

    this.updateInteractions(offset);
    this.predatorFSM.update(deltaTime);

    this.latestVisionResult = this.visionSystem.evaluate(this.predator, this.player, this.map, offset);
    const canSeePlayer = this.latestVisionResult.canSeePlayer;

    const playerGrid = PhysicsSystem.canvasToGrid(this.player.x, this.player.y, this.map, offset);
    this.predatorMemory.update(canSeePlayer, playerGrid.col, playerGrid.row);

    this.evaluateTransitions(canSeePlayer, offset, deltaTime);
    this.executeBehavior(offset, deltaTime);
  }

  private updateInteractions(offset: { x: number; y: number }): void {
    const INTERACT_RADIUS = this.map.tileSize * 1.5;
    this.nearestInteractable = null;
    this.currentInteractionPrompt = null;
    let closestDist = Infinity;

    for (const item of this.items) {
      if (!item.active) continue;
      const itemX = offset.x + (item.col + 0.5) * this.map.tileSize;
      const itemY = offset.y + (item.row + 0.5) * this.map.tileSize;
      const dist = Math.hypot(this.player.x - itemX, this.player.y - itemY);
      if (dist < INTERACT_RADIUS && dist < closestDist) {
        closestDist = dist;
        this.nearestInteractable = item;
      }
    }

    if (this.nearestInteractable) {
      switch (this.nearestInteractable.type) {
        case InteractableType.POWER_CELL: this.currentInteractionPrompt = "Press E — Collect Power Cell"; break;
        case InteractableType.GENERATOR: this.currentInteractionPrompt = "Press E — Activate Generator"; break;
        case InteractableType.EXIT: this.currentInteractionPrompt = "Press E — Escape"; break;
      }
    }
  }

  private handleInteraction(): void {
    if (!stateManager.isPlaying() || !this.nearestInteractable) return;

    const item = this.nearestInteractable;
    const playerGrid = PhysicsSystem.canvasToGrid(this.player.x, this.player.y, this.map, this.currentOffset);

    if (item.type === InteractableType.POWER_CELL) {
      item.active = false;
      this.objectiveSystem.powerCellsCollected++;
      this.emitSound({ col: playerGrid.col, row: playerGrid.row, intensity: 1.0 });
    } else if (item.type === InteractableType.GENERATOR) {
      if (this.objectiveSystem.powerCellsCollected >= 3) {
        this.objectiveSystem.generatorActive = true;
        this.objectiveSystem.setFeedback("GENERATOR ONLINE - EXIT UNLOCKED");
        this.emitSound({ col: playerGrid.col, row: playerGrid.row, intensity: 2.0 });
      } else {
        this.objectiveSystem.setFeedback("GENERATOR OFFLINE - NEEDS 3 CELLS");
      }
    } else if (item.type === InteractableType.EXIT) {
      if (this.objectiveSystem.generatorActive) {
        stateManager.state = GameState.VICTORY;
        this.audioManager.stopAll();
        this.updateHTMLOverlay();
      } else {
        this.objectiveSystem.setFeedback("EXIT LOCKED - RESTORE POWER FIRST");
      }
    }
  }

  private evaluateTransitions(canSeePlayer: boolean, offset: { x: number; y: number }, _deltaTime: number): void {
    const state = this.predatorFSM.getState();
    if (canSeePlayer && state !== PredatorState.CHASE) {
      if (this.predatorFSM.transitionTo(PredatorState.CHASE)) this.chaseController.reset();
      return;
    }
    if (state === PredatorState.CHASE && !canSeePlayer) {
      this.chaseController.reset();
      const memory = this.predatorMemory.get();
      if (memory.hasMemory) this.searchController.reset(memory.lastKnownCol!, memory.lastKnownRow!);
      this.predatorFSM.transitionTo(PredatorState.SEARCH);
      return;
    }
    if (state !== PredatorState.CHASE) {
      const soundResult = this.soundSystem.evaluate(this.predator.x, this.predator.y, this.map, offset);
      if (soundResult.detectedEvent !== null) {
        const ev = soundResult.detectedEvent;
        this.investigateController.setTarget(ev.col, ev.row);
        this.lastInvestigateCol = ev.col;
        this.lastInvestigateRow = ev.row;
        this.predatorFSM.transitionTo(PredatorState.INVESTIGATE);
        return;
      }
    }
    switch (state) {
      case PredatorState.SEARCH:
        if (this.searchController.isComplete()) {
          this.predatorMemory.clear();
          this.lastInvestigateCol = null;
          this.lastInvestigateRow = null;
          this.predatorFSM.transitionTo(PredatorState.PATROL);
        }
        break;
      case PredatorState.INVESTIGATE:
        if (this.investigateController.hasArrived()) {
          this.lastInvestigateCol = null;
          this.lastInvestigateRow = null;
          this.predatorFSM.transitionTo(PredatorState.PATROL);
        }
        break;
    }
  }

  private executeBehavior(offset: { x: number; y: number }, deltaTime: number): void {
    switch (this.predatorFSM.getState()) {
      case PredatorState.PATROL: this.patrolController.update(this.predator, this.map, offset, deltaTime); break;
      case PredatorState.CHASE: this.chaseController.update(this.predator, this.player, this.map, offset, deltaTime); break;
      case PredatorState.SEARCH: this.searchController.update(this.predator, this.map, offset, deltaTime); break;
      case PredatorState.INVESTIGATE: this.investigateController.update(this.predator, this.map, offset, deltaTime); break;
    }
  }

  private render(): void {
    const offset = this.getMapOffset();

    this.renderer.clear();
    this.renderer.renderBackground();
    this.renderer.renderMap(this.map, offset.x, offset.y);

    // Draw the items, predator, and player UNDER the darkness
    this.renderer.renderInteractables(this.items, this.map, offset.x, offset.y, this.objectiveSystem.generatorActive);
    this.renderer.renderPredator(this.predator);
    this.renderer.renderPlayer(this.player);

    // 1. Apply the Pitch-Black Flashlight Darkness (or turn it off if power is restored!)
    // Change your renderLighting line to this:
    this.renderer.renderLighting(this.player, this.objectiveSystem.generatorActive, this.lightningFlashIntensity);

    // 2. Draw Predator's Red Radar Cone ON TOP of the darkness so it glows!
    this.renderer.renderPredatorVision(this.predator);

    // Draw UI on top of everything
    if (stateManager.isPlaying()) {
      this.renderer.renderObjectiveHUD(this.objectiveSystem);
      if (this.currentInteractionPrompt) {
        this.renderer.renderInteractionPrompt(this.currentInteractionPrompt);
      }
    }
    if (this.debugEnabled) {
      const memory = this.predatorMemory.get();
      this.renderer.renderDebugHUD(
        this.predatorFSM.getState(),
        this.latestVisionResult?.canSeePlayer ?? false,
        memory.lastKnownCol, memory.lastKnownRow,
        this.lastInvestigateCol, this.lastInvestigateRow
      );
    }
  }

  private getMapOffset(): { x: number; y: number } {
    const mapW = this.map.getWidthInPixels();
    const mapH = this.map.getHeightInPixels();
    return {
      x: Math.max(0, Math.floor((this.renderer.getWidth() - mapW) / 2)),
      y: Math.max(0, Math.floor((this.renderer.getHeight() - mapH) / 2)),
    };
  }

  private randomizeSpawns(): void {
    const offset = this.currentOffset || this.getMapOffset();
    const playerIndex = Math.floor(Math.random() * this.spawnPoints.length);
    let predatorIndex = Math.floor(Math.random() * this.spawnPoints.length);
    while (predatorIndex === playerIndex) predatorIndex = Math.floor(Math.random() * this.spawnPoints.length);

    const pSpawn = this.spawnPoints[playerIndex];
    const mSpawn = this.spawnPoints[predatorIndex];

    this.player.startX = offset.x + (pSpawn.col + 0.5) * this.map.tileSize;
    this.player.startY = offset.y + (pSpawn.row + 0.5) * this.map.tileSize;
    this.player.x = this.player.startX; this.player.y = this.player.startY;

    this.predator.startX = offset.x + (mSpawn.col + 0.5) * this.map.tileSize;
    this.predator.startY = offset.y + (mSpawn.row + 0.5) * this.map.tileSize;
    this.predator.x = this.predator.startX; this.predator.y = this.predator.startY;
  }

  private updateHTMLOverlay(): void {
    const layer = document.getElementById('ui-layer');
    const title = document.getElementById('ui-title');
    const subtitle = document.getElementById('ui-subtitle');
    const btnPlay = document.getElementById('btn-play');
    const btnRestart = document.getElementById('btn-restart');
    const btnMenu = document.getElementById('btn-menu');
    const instructions = document.getElementById('ui-instructions');

    if (!layer || !title || !subtitle || !btnPlay || !btnRestart || !btnMenu || !instructions) return;

    title.className = ''; btnPlay.className = 'btn hidden';
    btnRestart.className = 'btn hidden'; btnMenu.className = 'btn hidden';
    instructions.className = 'instructions hidden';

    const state = stateManager.state;

    if (state === GameState.PLAYING) {
      layer.classList.add('hidden');
    } else {
      layer.classList.remove('hidden');
      if (state === GameState.MENU) {
        title.innerText = 'NIGHTFALL';
        subtitle.innerText = 'SURVIVE THE FACILITY';
        btnPlay.className = 'btn';
        instructions.className = 'instructions';
      } else if (state === GameState.GAME_OVER) {
        title.innerText = 'YOU ARE DEAD';
        title.className = 'dead';
        subtitle.innerText = 'THE PREDATOR CAUGHT YOU';
        btnRestart.className = 'btn danger';
        btnMenu.className = 'btn';
      } else if (state === GameState.VICTORY) {
        title.innerText = 'FACILITY ESCAPED';
        title.className = 'win';
        subtitle.innerText = 'YOU SURVIVED NIGHTFALL';
        btnRestart.className = 'btn success';
        btnMenu.className = 'btn';
      }
    }
  }

  private setupGlobalControls(): void {
    document.getElementById('btn-play')?.addEventListener('click', () => this.resetGame());
    document.getElementById('btn-restart')?.addEventListener('click', () => this.resetGame());
    document.getElementById('btn-menu')?.addEventListener('click', () => {
      stateManager.state = GameState.MENU;
      this.updateHTMLOverlay();
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') this.debugEnabled = !this.debugEnabled;
      if (e.key === 'e' || e.key === 'E') this.handleInteraction();
      if (e.key === 'Enter') {
        const current = stateManager.state;
        if (current === GameState.MENU || current === GameState.GAME_OVER || current === GameState.VICTORY) {
          this.resetGame();
        }
      }
    });

    this.updateHTMLOverlay();
  }

  private resetGame(): void {
    this.randomizeSpawns();
    this.player.isDead = false;
    this.objectiveSystem.reset();
    this.items = generateRandomInteractables(this.map);
    this.predatorFSM.transitionTo(PredatorState.PATROL);
    this.predatorMemory.clear();
    this.patrolController.reset();
    this.chaseController.reset();
    this.lastInvestigateCol = null;
    this.lastInvestigateRow = null;

    stateManager.state = GameState.PLAYING;
    this.updateHTMLOverlay();

    // START THE CREEPY AUDIO
    this.audioManager.init();
    this.audioManager.startDrone();

    this.lightningTimer = 3 + Math.random() * 5; // First strike happens quickly
    this.lightningFlashIntensity = 0;
  }
}
