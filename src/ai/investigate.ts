import { GameMap } from '../game/map';
import { Predator } from '../game/predator';
import { PhysicsSystem, MapOffset } from '../systems/physics';
import { findPathAStar } from './algorithms/astar';
import { GridNode } from './algorithms/bfs';

/**
 * Predator Investigate Behavior Controller.
 *
 * When the predator hears a suspicious sound, it enters INVESTIGATE state.
 * This controller navigates using A* toward the grid cell where the sound
 * originated. When it arrives, the FSM can transition to PATROL.
 *
 * Usage:
 *   investigateController.setTarget(col, row); // call when transitioning to INVESTIGATE
 *   investigateController.update(...)          // call every frame while in INVESTIGATE
 *   investigateController.hasArrived()         // returns true when destination reached
 */
export class InvestigateController {
  private targetCol: number = 0;
  private targetRow: number = 0;
  private currentPath: GridNode[] = [];
  private currentStepIndex: number = 0;
  private arrived: boolean = false;

  /**
   * Sets a new investigation target and resets movement state.
   * Must be called each time the predator enters INVESTIGATE.
   *
   * @param col - Target grid column (sound source)
   * @param row - Target grid row (sound source)
   */
  public setTarget(col: number, row: number): void {
    this.targetCol = col;
    this.targetRow = row;
    this.currentPath = [];
    this.currentStepIndex = 0;
    this.arrived = false;
  }

  /**
   * Resets the controller to a clean state (no target).
   */
  public reset(): void {
    this.currentPath = [];
    this.currentStepIndex = 0;
    this.arrived = false;
  }

  /**
   * Returns true when the predator has reached its investigation target cell.
   * The FSM should use this to transition back to PATROL.
   */
  public hasArrived(): boolean {
    return this.arrived;
  }

  /**
   * Updates the predator's investigation navigation every frame.
   *
   * @param predator  - The predator entity (mutated in place)
   * @param map       - The facility map for A* pathfinding and collision
   * @param offset    - Map pixel offset on the canvas
   * @param deltaTime - Seconds elapsed since the last frame
   */
  public update(
    predator: Predator,
    map: GameMap,
    offset: MapOffset,
    deltaTime: number
  ): void {
    if (this.arrived) return;

    const predGrid = PhysicsSystem.canvasToGrid(predator.x, predator.y, map, offset);

    // Check if the predator has reached the target tile
    if (predGrid.col === this.targetCol && predGrid.row === this.targetRow) {
      this.arrived = true;
      return;
    }

    // Calculate a new A* path if one is needed
    if (this.currentPath.length === 0 || this.currentStepIndex >= this.currentPath.length) {
      const path = findPathAStar(predGrid, { col: this.targetCol, row: this.targetRow }, map);

      if (path.length > 1) {
        this.currentPath = path.slice(1); // skip the starting cell
        this.currentStepIndex = 0;
      } else {
        // Destination is unreachable — treat as arrived to avoid getting stuck
        this.arrived = true;
        return;
      }
    }

    // Move toward the next cell in the A* path
    const targetCell = this.currentPath[this.currentStepIndex];
    const targetX = offset.x + (targetCell.col + 0.5) * map.tileSize;
    const targetY = offset.y + (targetCell.row + 0.5) * map.tileSize;

    const dx = targetX - predator.x;
    const dy = targetY - predator.y;
    const distance = Math.hypot(dx, dy);
    const stepDistance = predator.speed * deltaTime;

    // Arrived at current cell center
    if (distance <= stepDistance || distance < 14) {
      predator.x = targetX;
      predator.y = targetY;
      this.currentStepIndex++;
    } else {
      // Move smoothly toward the cell center
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

    // Always keep facing direction current
    predator.angle = Math.atan2(dy, dx);
  }
}
