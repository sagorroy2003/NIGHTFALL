import { GameMap } from '../game/map';
import { MapOffset, PhysicsSystem } from '../systems/physics';

/**
 * A single sound event emitted at a grid position with an intensity value.
 * Intensity 1.0 = normal footstep; higher values = louder sounds (e.g. 2.0 = running/bang).
 */
export interface SoundEvent {
  col: number;
  row: number;
  intensity: number; // 0.0 – 3.0, scales effective hearing radius
}

/**
 * Result returned by SoundSystem.evaluate().
 */
export interface SoundResult {
  detectedEvent: SoundEvent | null; // The loudest audible event this frame, or null
  hearingDistance: number;          // Max hearing distance in pixels for reference
}

/**
 * Base hearing range in pixels at intensity 1.0.
 */
const BASE_HEARING_RANGE_PX = 160;

/**
 * Standalone sound perception system.
 * Maintains a queue of pending sound events and evaluates which
 * (if any) the predator can hear based on distance and intensity.
 * Fully decoupled from rendering and AI decision-making.
 */
export class SoundSystem {
  private pendingEvents: SoundEvent[] = [];

  /**
   * Emits a sound event at a given map grid cell with the given intensity.
   * Call from input, physics, or any other system.
   */
  public emit(event: SoundEvent): void {
    this.pendingEvents.push(event);
  }

  /**
   * Convenience helper: emit a sound at canvas pixel coordinates.
   */
  public emitAtCanvas(
    canvasX: number,
    canvasY: number,
    intensity: number,
    map: GameMap,
    offset: MapOffset
  ): void {
    const grid = PhysicsSystem.canvasToGrid(canvasX, canvasY, map, offset);
    this.pendingEvents.push({ col: grid.col, row: grid.row, intensity });
  }

  /**
   * Evaluates all pending sounds and returns the loudest audible event for the predator.
   * Clears the pending queue each frame.
   *
   * @param predatorCanvasX - Predator X in canvas pixels
   * @param predatorCanvasY - Predator Y in canvas pixels
   * @param map - Facility grid
   * @param offset - Map viewport offset
   */
  public evaluate(
    predatorCanvasX: number,
    predatorCanvasY: number,
    map: GameMap,
    offset: MapOffset
  ): SoundResult {
    const events = this.pendingEvents;
    this.pendingEvents = [];

    let bestEvent: SoundEvent | null = null;
    let bestScore = -1;

    for (const event of events) {
      // Convert sound grid position to canvas pixels (tile center)
      const soundX = offset.x + (event.col + 0.5) * map.tileSize;
      const soundY = offset.y + (event.row + 0.5) * map.tileSize;

      const dist = Math.hypot(soundX - predatorCanvasX, soundY - predatorCanvasY);
      const effectiveRange = BASE_HEARING_RANGE_PX * event.intensity;

      if (dist <= effectiveRange) {
        // Score = intensity / distance — louder and closer events win
        const score = event.intensity / (dist + 1);
        if (score > bestScore) {
          bestScore = score;
          bestEvent = event;
        }
      }
    }

    return {
      detectedEvent: bestEvent,
      hearingDistance: BASE_HEARING_RANGE_PX,
    };
  }

  /**
   * Discards all pending events without evaluation.
   */
  public flush(): void {
    this.pendingEvents = [];
  }
}
