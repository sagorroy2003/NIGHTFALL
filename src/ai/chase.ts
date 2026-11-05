import { GameMap } from '../game/map';
import { Player } from '../game/player';
import { Predator } from '../game/predator';
import { PhysicsSystem, MapOffset } from '../systems/physics';
import { findPathAStar, GridNode } from './algorithms/astar';

/**
 * Manages predator chase pursuit behavior.
 * Uses the A* algorithm to calculate paths to the player's current grid position,
 * advances cell-by-cell without clipping walls, and adapts dynamically as the player moves.
 */
export class ChaseController {
  private currentPath: GridNode[] = [];
  private currentStepIndex: number = 0;
  private lastTargetCol: number = -1;
  private lastTargetRow: number = -1;
  private repathTimer: number = 0;
  private repathInterval: number = 0.25; // Recalculate path every 250ms or when player changes tile
  private chaseSpeed: number = 160;     // Accelerated pursuit speed (pixels/sec)

  public getPath(): readonly GridNode[] {
    return this.currentPath;
  }

  public getStepIndex(): number {
    return this.currentStepIndex;
  }

  /**
   * Resets active chase path when leaving CHASE state.
   */
  public reset(): void {
    this.currentPath = [];
    this.currentStepIndex = 0;
    this.lastTargetCol = -1;
    this.lastTargetRow = -1;
    this.repathTimer = 0;
  }

  /**
   * Updates chase pursuit towards the player.
   */
  public update(
    predator: Predator,
    player: Player,
    map: GameMap,
    offset: MapOffset,
    deltaTime: number
  ): void {
    this.repathTimer -= deltaTime;

    const predatorGrid = PhysicsSystem.canvasToGrid(predator.x, predator.y, map, offset);
    const playerGrid = PhysicsSystem.canvasToGrid(player.x, player.y, map, offset);

    // 1. Recalculate A* path if the player changed tile, timer expired, or path is exhausted
    const targetCellMoved =
      playerGrid.col !== this.lastTargetCol || playerGrid.row !== this.lastTargetRow;
    const pathExhausted =
      this.currentPath.length === 0 || this.currentStepIndex >= this.currentPath.length;

    if (targetCellMoved || this.repathTimer <= 0 || pathExhausted) {
      const calculatedPath = findPathAStar(predatorGrid, playerGrid, map);
      if (calculatedPath.length > 1) {
        // Skip index 0 because predator is already at start cell
        this.currentPath = calculatedPath.slice(1);
        this.currentStepIndex = 0;
      } else {
        this.currentPath = [];
        this.currentStepIndex = 0;
      }

      this.lastTargetCol = playerGrid.col;
      this.lastTargetRow = playerGrid.row;
      this.repathTimer = this.repathInterval;
    }

    // 2. If predator and player are currently on the same tile, move directly towards player center
    if (predatorGrid.col === playerGrid.col && predatorGrid.row === playerGrid.row) {
      this.moveTowards(predator, player.x, player.y, map, offset, deltaTime);
      return;
    }

    // 3. Otherwise, follow the next cell in the calculated A* path
    if (this.currentPath.length > 0 && this.currentStepIndex < this.currentPath.length) {
      const targetCell = this.currentPath[this.currentStepIndex];
      const targetX = offset.x + (targetCell.col + 0.5) * map.tileSize;
      const targetY = offset.y + (targetCell.row + 0.5) * map.tileSize;

      const arrivedAtCell = this.moveTowards(
        predator,
        targetX,
        targetY,
        map,
        offset,
        deltaTime
      );

      if (arrivedAtCell) {
        this.currentStepIndex++;
      }
    }
  }

  /**
   * Moves the predator toward a target point while enforcing collision safety.
   */
  private moveTowards(
    predator: Predator,
    targetX: number,
    targetY: number,
    map: GameMap,
    offset: MapOffset,
    deltaTime: number
  ): boolean {
    const dx = targetX - predator.x;
    const dy = targetY - predator.y;
    const distance = Math.hypot(dx, dy);

    const stepDistance = this.chaseSpeed * deltaTime;

    // Arrived at target point
    if (distance <= stepDistance || distance < 2) {
      predator.x = targetX;
      predator.y = targetY;
      return true;
    }

    const dirX = dx / distance;
    const dirY = dy / distance;

    const newX = predator.x + dirX * stepDistance;
    const newY = predator.y + dirY * stepDistance;

    // Turn predator to face direction of travel
    predator.angle = Math.atan2(dy, dx);

    // Verify wall collision safety before updating coordinates
    if (!PhysicsSystem.checkCollision(newX, newY, predator.radius, map, offset)) {
      predator.x = newX;
      predator.y = newY;
    }

    return false;
  }
}
