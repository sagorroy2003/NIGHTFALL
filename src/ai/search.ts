import { GameMap } from '../game/map';
import { Predator } from '../game/predator';
import { PhysicsSystem, MapOffset } from '../systems/physics';
import { findPathAStar } from './algorithms/astar';
import { GridNode } from './algorithms/bfs';

/**
 * Predator Search Behavior Controller.
 *
 * When the predator loses sight of the player, it enters SEARCH state.
 * This controller navigates using A* toward the last known player position,
 * then pauses to investigate nearby tiles before giving up and returning to PATROL.
 *
 * Usage:
 *   searchController.reset(col, row);  // call when transitioning to SEARCH
 *   searchController.update(...)       // call every frame while in SEARCH
 *   searchController.isComplete()      // returns true when search time expires
 */
export class SearchController {
  /** Maximum time to spend in search mode before giving up (seconds). */
  private readonly SEARCH_DURATION = 6.0;

  /** Time the predator waits at each investigation tile (seconds). */
  private readonly INVESTIGATION_PAUSE = 0.6;

  /** Number of adjacent tiles to briefly investigate upon arrival. */
  private readonly MAX_INVESTIGATION_TILES = 4;

  private targetCol: number = 0;
  private targetRow: number = 0;
  private currentPath: GridNode[] = [];
  private currentStepIndex: number = 0;
  private searchTimer: number = 0;
  private pauseTimer: number = 0;
  private investigationTiles: Array<{ col: number; row: number }> = [];
  private investigationIndex: number = 0;
  private hasArrived: boolean = false;

  /**
   * Initializes a new search toward the given target grid cell.
   * Must be called each time the predator transitions to SEARCH state.
   *
   * @param targetCol - Column of the last known player position
   * @param targetRow - Row of the last known player position
   */
  public reset(targetCol: number, targetRow: number): void {
    this.targetCol = targetCol;
    this.targetRow = targetRow;
    this.currentPath = [];
    this.currentStepIndex = 0;
    this.searchTimer = 0;
    this.pauseTimer = 0;
    this.investigationTiles = [];
    this.investigationIndex = 0;
    this.hasArrived = false;
  }

  /**
   * Returns true when the predator has exhausted its search duration.
   * The FSM should use this to transition back to PATROL.
   */
  public isComplete(): boolean {
    return this.searchTimer >= this.SEARCH_DURATION;
  }

  /**
   * Updates the predator's search navigation every frame.
   *
   * @param predator  - The predator entity (mutated in place)
   * @param map       - The facility map for A* and collision
   * @param offset    - Map pixel offset on the canvas
   * @param deltaTime - Seconds elapsed since the last frame
   */
  public update(
    predator: Predator,
    map: GameMap,
    offset: MapOffset,
    deltaTime: number
  ): void {
    // Count down overall search lifetime
    this.searchTimer += deltaTime;

    // Phase 1: Navigate to the last known position
    if (!this.hasArrived) {
      this.navigateTo(predator, this.targetCol, this.targetRow, map, offset, deltaTime);
      return;
    }

    // Phase 2: Investigate adjacent walkable tiles
    if (this.investigationTiles.length === 0) {
      // Build a list of valid neighbouring tiles to sweep through
      this.investigationTiles = this.findNearbyWalkableTiles(this.targetCol, this.targetRow, map);
    }

    if (this.investigationIndex >= this.investigationTiles.length) {
      // All nearby tiles inspected — just stand and wait for search timer
      return;
    }

    // Handle the inter-tile pause
    if (this.pauseTimer > 0) {
      this.pauseTimer -= deltaTime;
      return;
    }

    const tile = this.investigationTiles[this.investigationIndex];
    this.navigateTo(predator, tile.col, tile.row, map, offset, deltaTime);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Navigates the predator toward (destCol, destRow) one A* step at a time.
   * Marks arrival by advancing investigation state.
   */
  private navigateTo(
    predator: Predator,
    destCol: number,
    destRow: number,
    map: GameMap,
    offset: MapOffset,
    deltaTime: number
  ): void {
    const predGrid = PhysicsSystem.canvasToGrid(predator.x, predator.y, map, offset);

    // Check if we've arrived at the destination cell
    if (predGrid.col === destCol && predGrid.row === destRow) {
      if (!this.hasArrived) {
        // Reached last known position for the first time
        this.hasArrived = true;
        this.currentPath = [];
        this.currentStepIndex = 0;
        return;
      }
      // Reached an investigation tile — pause then advance
      this.pauseTimer = this.INVESTIGATION_PAUSE;
      this.investigationIndex++;
      this.currentPath = [];
      this.currentStepIndex = 0;
      return;
    }

    // Calculate or continue following A* path
    if (this.currentPath.length === 0 || this.currentStepIndex >= this.currentPath.length) {
      const path = findPathAStar(predGrid, { col: destCol, row: destRow }, map);
      if (path.length > 1) {
        this.currentPath = path.slice(1); // skip current cell
        this.currentStepIndex = 0;
      } else {
        // Unreachable — skip to next investigation tile
        if (this.hasArrived) {
          this.investigationIndex++;
        } else {
          this.hasArrived = true; // treat as arrived
        }
        this.currentPath = [];
        this.currentStepIndex = 0;
        return;
      }
    }

    // Move to next cell in path
    const targetCell = this.currentPath[this.currentStepIndex];
    const targetX = offset.x + (targetCell.col + 0.5) * map.tileSize;
    const targetY = offset.y + (targetCell.row + 0.5) * map.tileSize;

    const dx = targetX - predator.x;
    const dy = targetY - predator.y;
    const distance = Math.hypot(dx, dy);
    const stepDistance = predator.speed * deltaTime;

    if (distance <= stepDistance || distance < 14) {
      predator.x = targetX;
      predator.y = targetY;
      this.currentStepIndex++;
    } else {
      const dirX = dx / distance;
      const dirY = dy / distance;
      const newX = predator.x + dirX * stepDistance;
      const newY = predator.y + dirY * stepDistance;
      predator.angle = Math.atan2(dy, dx);
      // Use the tiny hitbox (2) so the predator doesn't snag corners while chasing!
      if (!PhysicsSystem.checkCollision(newX, newY, 2, map, offset)) {
        predator.x = newX;
        predator.y = newY;
      } else {
        // 5. Move smoothly toward target cell (IGNORE PHYSICS)
        // A* guarantees the path is walkable, so we bypass strict collision.
        const dirX = dx / distance;
        const dirY = dy / distance;

        predator.x += dirX * stepDistance;
        predator.y += dirY * stepDistance;

        // Face direction of current motion
        predator.angle = Math.atan2(dy, dx);
      }
    }

    // Always face direction of motion
    predator.angle = Math.atan2(dy, dx);
  }

  /**
   * Finds up to MAX_INVESTIGATION_TILES walkable grid cells adjacent to the target.
   * Uses cardinal directions: up, down, left, right.
   */
  private findNearbyWalkableTiles(
    col: number,
    row: number,
    map: GameMap
  ): Array<{ col: number; row: number }> {
    const directions = [
      { col: 0, row: -1 }, // up
      { col: 0, row: 1 },  // down
      { col: -1, row: 0 }, // left
      { col: 1, row: 0 },  // right
    ];

    const result: Array<{ col: number; row: number }> = [];
    for (const d of directions) {
      const nc = col + d.col;
      const nr = row + d.row;
      if (nc >= 0 && nr >= 0 && nc < map.cols && nr < map.rows && map.isWalkable(nc, nr)) {
        result.push({ col: nc, row: nr });
        if (result.length >= this.MAX_INVESTIGATION_TILES) break;
      }
    }
    return result;
  }
}
