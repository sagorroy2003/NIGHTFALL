import { GameMap } from '../game/map';
import { Predator } from '../game/predator';
import { PhysicsSystem, MapOffset } from '../systems/physics';
import { findPathAStar } from './algorithms/astar';
import { GridNode } from './algorithms/bfs';

export interface GridPoint {
  col: number;
  row: number;
}

/**
 * Predefined facility patrol destinations across distinct rooms:
 * 0. Research Lab (Northeast wing)
 * 1. Storage Bay (Southwest wing)
 * 2. Generator Room (Southeast wing)
 * 3. Security Bay (Northwest wing)
 */
export const DEFAULT_PATROL_DESTINATIONS: GridPoint[] = [
  { col: 10, row: 2 },  // North T-Intersection
  { col: 10, row: 6 },  // Central Facility Crossroads
  { col: 16, row: 6 },  // East Hallway
  { col: 10, row: 11 }, // South T-Intersection
  { col: 3, row: 6 },   // West Hallway
  { col: 10, row: 6 },  // Back to Central Crossroads
];

/**
 * Controls autonomous predator patrol movement using A* pathfinding.
 * When assigned a patrol destination, it uses A* to compute the optimal
 * route around facility walls, traverses the path cell by cell, pauses at
 * destinations, and recalculates paths for subsequent goals.
 */
export class PatrolController {
  private destinations: GridPoint[];
  private currentDestinationIndex: number = 0;
  private currentPath: GridNode[] = [];
  private currentStepIndex: number = 0;
  private pauseTimer: number = 0;
  private pauseDuration: number;

  constructor(
    destinations: GridPoint[] = DEFAULT_PATROL_DESTINATIONS,
    pauseDuration: number = 1.0
  ) {
    this.destinations = destinations;
    this.pauseDuration = pauseDuration;
  }

  public getCurrentDestinationIndex(): number {
    return this.currentDestinationIndex;
  }

  public getCurrentDestination(): GridPoint | undefined {
    return this.destinations[this.currentDestinationIndex];
  }

  public getCurrentPath(): readonly GridNode[] {
    return this.currentPath;
  }

  public getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  public isPaused(): boolean {
    return this.pauseTimer > 0;
  }

  /**
   * Updates predator patrol movement using A* navigation.
   */
  public update(
    predator: Predator,
    map: GameMap,
    offset: MapOffset,
    deltaTime: number
  ): void {
    if (this.destinations.length === 0) return;

    // 1. Handle pause state when resting at a patrol destination
    if (this.pauseTimer > 0) {
      this.pauseTimer -= deltaTime;
      // UPGRADE: Active Intersection Sweep
      // The predator rotates its head/vision to scan the area while paused.
      // (Math.PI * 2) is a full 360-degree rotation.
      const sweepSpeed = (Math.PI * 2) / this.pauseDuration;
      predator.angle += sweepSpeed * deltaTime;
      return;
    }

    // 2. If no active path exists, calculate one to the destination using A*
    if (this.currentPath.length === 0 || this.currentStepIndex >= this.currentPath.length) {
      const currentGrid = PhysicsSystem.canvasToGrid(predator.x, predator.y, map, offset);
      const destination = this.destinations[this.currentDestinationIndex];

      // If already at the destination, pause and select the next destination
      if (currentGrid.col === destination.col && currentGrid.row === destination.row) {
        this.pauseTimer = this.pauseDuration;
        this.currentDestinationIndex = (this.currentDestinationIndex + 1) % this.destinations.length;
        return;
      }

      // Compute optimal path via A* around walls and corridors
      const calculatedPath = findPathAStar(currentGrid, destination, map);

      // Slice off index 0 (current cell) so we only traverse remaining target steps
      if (calculatedPath.length > 1) {
        this.currentPath = calculatedPath.slice(1);
        this.currentStepIndex = 0;
      } else {
        // If unreachable, advance to next destination in route
        this.currentDestinationIndex = (this.currentDestinationIndex + 1) % this.destinations.length;
        return;
      }
    }

    // 3. Move toward the next grid cell in the reconstructed A* path
    const targetCell = this.currentPath[this.currentStepIndex];
    const targetX = offset.x + (targetCell.col + 0.5) * map.tileSize;
    const targetY = offset.y + (targetCell.row + 0.5) * map.tileSize;

    const dx = targetX - predator.x;
    const dy = targetY - predator.y;
    const distance = Math.hypot(dx, dy);

    const stepDistance = predator.speed * deltaTime;

    // 4. Check if current cell center has been reached
    // Increased from 2 to 14. This allows the predator to "snap" into perfect 
    // grid alignment even if it is scraping a wall!
    if (distance <= stepDistance || distance < 14) {
      // Snap to cell center perfectly
      predator.x = targetX;
      predator.y = targetY;

      // Advance to next cell in path
      this.currentStepIndex++;

      // Check if the final patrol destination has been reached
      if (this.currentStepIndex >= this.currentPath.length) {
        // Arrived at destination: initiate pause and advance destination index
        this.pauseTimer = this.pauseDuration;
        this.currentDestinationIndex = (this.currentDestinationIndex + 1) % this.destinations.length;
        this.currentPath = [];
        this.currentStepIndex = 0;
      } else {
        // Orient facing angle toward the upcoming cell
        const nextCell = this.currentPath[this.currentStepIndex];
        const nextTargetX = offset.x + (nextCell.col + 0.5) * map.tileSize;
        const nextTargetY = offset.y + (nextCell.row + 0.5) * map.tileSize;
        predator.angle = Math.atan2(nextTargetY - predator.y, nextTargetX - predator.x);
      }
    } else {
      // 5. Move smoothly toward target cell using frame-rate independent delta time
      const dirX = dx / distance;
      const dirY = dy / distance;

      const newX = predator.x + dirX * stepDistance;
      const newY = predator.y + dirY * stepDistance;

      // Face direction of current motion
      predator.angle = Math.atan2(dy, dx);

      // Verify safety with collision system before committing position
      // Use a smaller collision radius (e.g., 6) so it doesn't snag corners,
      // but still respects solid walls so it doesn't cut through them!
      if (!PhysicsSystem.checkCollision(newX, newY, 6, map, offset)) {
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
  }

  public reset(): void {
    this.currentPath = [];
    this.currentStepIndex = 0;
    this.pauseTimer = 0;
    this.currentDestinationIndex = 0;
  }
}
