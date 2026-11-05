/**
 * Predator Memory System.
 *
 * Stores the last grid position where the predator saw the player.
 * Memory is preserved after vision is lost so the predator can
 * navigate toward where the player was last observed.
 * Memory is only cleared intentionally (e.g., when returning to PATROL).
 */

/** The snapshot of the predator's remembered player location. */
export interface PlayerMemory {
  /** Column of the last seen player position, or null if never seen. */
  lastKnownCol: number | null;
  /** Row of the last seen player position, or null if never seen. */
  lastKnownRow: number | null;
  /** True if the predator has at least one valid memory entry. */
  hasMemory: boolean;
}

/**
 * Tracks the last known player grid position.
 * Only updates while the player is visible; retains data after sight is lost.
 */
export class PredatorMemory {
  private lastKnownCol: number | null = null;
  private lastKnownRow: number | null = null;

  /**
   * Called every frame with the current visibility state.
   * Updates stored position only when the player is currently visible.
   *
   * @param playerVisible - True if vision system confirms the player is seen
   * @param playerCol     - Player's current grid column
   * @param playerRow     - Player's current grid row
   */
  public update(playerVisible: boolean, playerCol: number, playerRow: number): void {
    if (playerVisible) {
      this.lastKnownCol = playerCol;
      this.lastKnownRow = playerRow;
    }
    // When player is NOT visible, we intentionally do NOT update —
    // the last seen position is preserved for navigation during SEARCH.
  }

  /**
   * Returns the current memory snapshot.
   */
  public get(): PlayerMemory {
    return {
      lastKnownCol: this.lastKnownCol,
      lastKnownRow: this.lastKnownRow,
      hasMemory: this.lastKnownCol !== null && this.lastKnownRow !== null,
    };
  }

  /**
   * Erases all stored memory.
   * Call this when the predator gives up and returns to PATROL.
   */
  public clear(): void {
    this.lastKnownCol = null;
    this.lastKnownRow = null;
  }
}
