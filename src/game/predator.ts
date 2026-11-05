/**
 * Represents the Predator (monster entity) in NIGHTFALL.
 * Encapsulates position, dimensions, movement speed, orientation, and visual properties.
 */
export interface Predator {
  x: number;
  y: number;
  radius: number;
  speed: number; // Pixels per second
  angle: number; // Orientation angle in radians
  color: string;
}

/**
 * Creates a Predator entity at the given canvas coordinates.
 */
export function createPredator(x: number, y: number): Predator {
  return {
    x,
    y,
    radius: 18, // Distinct, imposing silhouette (player is 16px) with clean corridor clearance
    speed: 120, // Stalking patrol speed for horror tension
    angle: Math.PI / 2, // Facing downward initially
    color: '#9e2a2b', // Deep crimson horror tone
  };
}
