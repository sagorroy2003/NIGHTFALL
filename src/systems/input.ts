/**
 * Manages keyboard input for player controls.
 * Supports WASD and Arrow keys, normalizes diagonal input vectors,
 * and handles listener registration and cleanup.
 */
export class InputSystem {
  private activeKeys: Set<string> = new Set();
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleKeyUpBound: (e: KeyboardEvent) => void;

  constructor() {
    this.handleKeyDownBound = this.handleKeyDown.bind(this);
    this.handleKeyUpBound = this.handleKeyUp.bind(this);

    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Prevent page scrolling when using arrow keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    this.activeKeys.add(e.code);
    this.activeKeys.add(e.key.toLowerCase());
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.activeKeys.delete(e.code);
    this.activeKeys.delete(e.key.toLowerCase());
  }

  /**
   * Calculates a 2D direction vector from pressed keys.
   * Diagonal vectors are normalized to ensure uniform speed in all directions.
   */
  public getMovementVector(): { x: number; y: number } {
    let dx = 0;
    let dy = 0;

    const up = this.isPressed('KeyW', 'w', 'ArrowUp', 'arrowup');
    const down = this.isPressed('KeyS', 's', 'ArrowDown', 'arrowdown');
    const left = this.isPressed('KeyA', 'a', 'ArrowLeft', 'arrowleft');
    const right = this.isPressed('KeyD', 'd', 'ArrowRight', 'arrowright');

    if (up) dy -= 1;
    if (down) dy += 1;
    if (left) dx -= 1;
    if (right) dx += 1;

    // Normalize diagonal movement (prevents ~1.414x speed boost)
    if (dx !== 0 && dy !== 0) {
      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;
    }

    return { x: dx, y: dy };
  }

  private isPressed(...keys: string[]): boolean {
    return keys.some((key) => this.activeKeys.has(key));
  }

  /**
   * Cleans up event listeners to prevent memory leaks.
   */
  public cleanup(): void {
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    this.activeKeys.clear();
  }
}
