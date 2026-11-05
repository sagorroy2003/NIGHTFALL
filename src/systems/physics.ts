import { GameMap } from '../game/map';
import { Player } from '../game/player';

export interface MapOffset {
  x: number;
  y: number;
}

/**
 * Handles spatial queries, collision detection, and movement physics for NIGHTFALL.
 * Implements circle-vs-tile AABB collision and supports smooth wall sliding.
 */
export class PhysicsSystem {
  /**
   * Converts a canvas pixel coordinate into map grid tile coordinates.
   */
  public static canvasToGrid(
    canvasX: number,
    canvasY: number,
    map: GameMap,
    offset: MapOffset
  ): { col: number; row: number } {
    const mapX = canvasX - offset.x;
    const mapY = canvasY - offset.y;
    return {
      col: Math.floor(mapX / map.tileSize),
      row: Math.floor(mapY / map.tileSize),
    };
  }

  /**
   * Checks whether a circular shape at (canvasX, canvasY) with the given radius
   * overlaps any solid wall tiles or map boundaries.
   */
  public static checkCollision(
    canvasX: number,
    canvasY: number,
    radius: number,
    map: GameMap,
    offset: MapOffset
  ): boolean {
    const mapX = canvasX - offset.x;
    const mapY = canvasY - offset.y;

    const mapWidth = map.getWidthInPixels();
    const mapHeight = map.getHeightInPixels();

    // 1. Boundary check: ensure player circle remains fully inside map
    if (
      mapX - radius < 0 ||
      mapX + radius > mapWidth ||
      mapY - radius < 0 ||
      mapY + radius > mapHeight
    ) {
      return true;
    }

    // 2. Identify the range of grid tiles overlapping the player's bounding box
    const startCol = Math.floor((mapX - radius) / map.tileSize);
    const endCol = Math.floor((mapX + radius) / map.tileSize);
    const startRow = Math.floor((mapY - radius) / map.tileSize);
    const endRow = Math.floor((mapY + radius) / map.tileSize);

    // 3. Test circle-vs-AABB collision for each overlapping wall tile
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (map.isWall(col, row)) {
          const tileLeft = col * map.tileSize;
          const tileRight = tileLeft + map.tileSize;
          const tileTop = row * map.tileSize;
          const tileBottom = tileTop + map.tileSize;

          // Find the closest point on the tile to the player circle center
          const closestX = Math.max(tileLeft, Math.min(tileRight, mapX));
          const closestY = Math.max(tileTop, Math.min(tileBottom, mapY));

          const distX = mapX - closestX;
          const distY = mapY - closestY;

          // If distance from closest point is less than radius, a collision occurs
          if (distX * distX + distY * distY < radius * radius) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Updates player position with delta time and handles collisions.
   * Separates movement into X and Y axes to naturally support wall sliding.
   */
  public static updatePlayerMovement(
    player: Player,
    movement: { x: number; y: number },
    map: GameMap,
    offset: MapOffset,
    deltaTime: number
  ): void {
    if (movement.x === 0 && movement.y === 0) {
      return;
    }

    // Update orientation angle to match input direction
    player.angle = Math.atan2(movement.y, movement.x);

    const deltaX = movement.x * player.speed * deltaTime;
    const deltaY = movement.y * player.speed * deltaTime;

    // --- Axis 1: Horizontal Movement (X) ---
    if (deltaX !== 0) {
      const targetX = player.x + deltaX;
      if (!this.checkCollision(targetX, player.y, player.radius, map, offset)) {
        player.x = targetX;
      } else {
        // Step forward in fractional intervals to stop flush against wall
        const step = deltaX / 4;
        for (let i = 0; i < 3; i++) {
          if (!this.checkCollision(player.x + step, player.y, player.radius, map, offset)) {
            player.x += step;
          } else {
            break;
          }
        }
      }
    }

    // --- Axis 2: Vertical Movement (Y) ---
    if (deltaY !== 0) {
      const targetY = player.y + deltaY;
      if (!this.checkCollision(player.x, targetY, player.radius, map, offset)) {
        player.y = targetY;
      } else {
        // Step forward in fractional intervals to stop flush against wall
        const step = deltaY / 4;
        for (let i = 0; i < 3; i++) {
          if (!this.checkCollision(player.x, player.y + step, player.radius, map, offset)) {
            player.y += step;
          } else {
            break;
          }
        }
      }
    }
  }
}
