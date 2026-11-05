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
  startX: number; // For restarting
  startY: number; // For restarting
}

/**
 * Creates a Predator entity at the given canvas coordinates.
 */
export function createPredator(x: number, y: number): Predator {
  return {
    x,
    y,
    radius: 18, // Distinct, imposing silhouette
    speed: 120, // Stalking patrol speed for horror tension
    angle: Math.PI / 2, // Facing downward initially
    color: '#9e2a2b', // Deep crimson horror tone
    startX: x,
    startY: y
  };
}

/**
 * Checks if the predator has caught the player using bounding circle overlap.
 */
export function checkPredatorCatch(predator: Predator, player: { x: number, y: number, radius: number }): boolean {
  const dx = predator.x - player.x;
  const dy = predator.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Caught if the distance between centers is less than 80% of their combined radii
  return distance < (predator.radius + player.radius) * 0.8;
}
