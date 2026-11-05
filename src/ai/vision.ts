import { GameMap } from '../game/map';
import { Player } from '../game/player';
import { Predator } from '../game/predator';
import { MapOffset } from '../systems/physics';

/**
 * Configuration options for the predator vision perception system.
 */
export interface VisionConfig {
  range?: number;    // Maximum detection distance in pixels (default: 260px)
  fovAngle?: number; // Total field-of-view cone angle in radians (default: 108 deg)
}

/**
 * Detailed perception evaluation result.
 * Separates overall detection from individual diagnostic checks.
 */
export interface VisionResult {
  canSeePlayer: boolean;   // True if within range, within FOV, and has clear line of sight
  distance: number;        // Euclidean distance to player in pixels
  angleDiff: number;       // Absolute angular difference from predator facing heading (radians)
  isWithinRange: boolean;  // True if distance <= range
  isWithinFOV: boolean;    // True if player lies inside predator vision cone
  hasLineOfSight: boolean; // True if direct ray to player is unblocked by walls
}

/**
 * Standalone vision perception module.
 * Evaluates target visibility using radial range, angular field-of-view,
 * and grid-based wall raycasting.
 */
export class VisionSystem {
  public range: number;
  public fovAngle: number;

  constructor(config?: VisionConfig) {
    this.range = config?.range ?? 260; // ~5.4 tiles at 48px/tile
    this.fovAngle = config?.fovAngle ?? Math.PI * 0.6; // ~108 degrees
  }

  /**
   * Evaluates whether the predator can see the player.
   *
   * @param predator - The viewing predator entity
   * @param player - The target player entity
   * @param map - The facility tile map for wall occlusion queries
   * @param offset - Viewport offset of the map on canvas
   * @returns Comprehensive VisionResult
   */
  public evaluate(
    predator: Predator,
    player: Player,
    map: GameMap,
    offset: MapOffset
  ): VisionResult {
    const dx = player.x - predator.x;
    const dy = player.y - predator.y;
    const distance = Math.hypot(dx, dy);

    // 1. Distance Range Check
    const isWithinRange = distance <= this.range;

    // 2. Field-of-View (FOV) Angle Check
    const angleToPlayer = Math.atan2(dy, dx);
    let diff = angleToPlayer - predator.angle;

    // Normalize angular difference into range [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const angleDiff = Math.abs(diff);

    // Within vision cone if angular deviation is within half of total FOV
    const isWithinFOV = angleDiff <= this.fovAngle / 2;

    // 3. Line-of-Sight (LOS) Wall Occlusion Check
    // Only perform raycasting if already within range and FOV to save computations
    let hasLineOfSight = false;
    if (isWithinRange && isWithinFOV) {
      hasLineOfSight = this.hasLineOfSight(
        predator.x,
        predator.y,
        player.x,
        player.y,
        map,
        offset
      );
    }

    const canSeePlayer = isWithinRange && isWithinFOV && hasLineOfSight;

    return {
      canSeePlayer,
      distance,
      angleDiff,
      isWithinRange,
      isWithinFOV,
      hasLineOfSight,
    };
  }

  /**
   * Checks whether the straight line between (startX, startY) and (targetX, targetY)
   * is unobstructed by solid wall tiles in the facility grid.
   */
  public hasLineOfSight(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    map: GameMap,
    offset: MapOffset
  ): boolean {
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.hypot(dx, dy);

    if (distance < 2) {
      return true;
    }

    // Sample along the ray at 12px intervals (1/4 of a 48px tile)
    // Ensures no wall tile can be skipped between samples
    const stepSize = 12;
    const steps = Math.ceil(distance / stepSize);

    for (let i = 1; i < steps; i++) {
      const sampleX = startX + (dx * i) / steps;
      const sampleY = startY + (dy * i) / steps;

      const col = Math.floor((sampleX - offset.x) / map.tileSize);
      const row = Math.floor((sampleY - offset.y) / map.tileSize);

      if (map.isWall(col, row)) {
        return false; // Vision ray intersected a solid wall tile
      }
    }

    return true; // Clear line of sight
  }
}
