/**
 * Represents the player entity.
 * Contains position, size, speed, orientation, and visual properties.
 */
export interface Player {
  x: number;
  y: number;
  radius: number;
  speed: number; // Movement speed in pixels per second
  angle: number; // Heading angle in radians
  color: string;
}

export function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    radius: 16,
    speed: 240, // 240 px/s offers smooth, responsive survival pacing
    angle: -Math.PI / 2, // Facing upward initially
    color: '#4fa3d1',
  };
}
