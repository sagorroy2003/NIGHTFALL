import { GameMap } from '../../game/map';

/**
 * Represents a single coordinate on the tile grid.
 */
export interface GridNode {
  col: number;
  row: number;
}

/**
 * Interface representing any grid that can answer wall/walkability queries.
 * Matches the existing GameMap structure.
 */
export interface NavGrid {
  cols: number;
  rows: number;
  isWall(col: number, row: number): boolean;
}

/**
 * The four cardinal exploration directions: Up, Down, Left, Right.
 */
export const CARDINAL_DIRECTIONS: readonly GridNode[] = [
  { col: 0, row: -1 }, // Up
  { col: 0, row: 1 },  // Down
  { col: -1, row: 0 }, // Left
  { col: 1, row: 0 },  // Right
];

/**
 * Generates a unique string key for a grid coordinate.
 */
function toKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * Standalone Breadth-First Search (BFS) pathfinding algorithm.
 *
 * Discovers the unweighted shortest path from a start cell to a goal cell
 * across the facility grid.
 *
 * @param start - Starting grid cell { col, row }
 * @param goal - Destination grid cell { col, row }
 * @param map - Facility map implementing NavGrid (or GameMap)
 * @returns Array of GridNodes from start to goal [start, ..., goal], or [] if no path exists.
 */
export function findPathBFS(
  start: GridNode,
  goal: GridNode,
  map: NavGrid | GameMap
): GridNode[] {
  // 1. Validate start and goal positions
  if (
    map.isWall(start.col, start.row) ||
    map.isWall(goal.col, goal.row)
  ) {
    return [];
  }

  // If start is already the goal, return single-node path
  if (start.col === goal.col && start.row === goal.row) {
    return [{ col: start.col, row: start.row }];
  }

  // 2. Initialize FIFO queue and tracking structures
  // Queue stores nodes awaiting neighbor exploration
  const queue: GridNode[] = [];

  // Visited set ensures cells are not explored more than once
  const visited = new Set<string>();

  // Parent map stores where we came from to reconstruct the path
  const parentMap = new Map<string, GridNode>();

  const startKey = toKey(start.col, start.row);
  queue.push(start);
  visited.add(startKey);

  let goalReached = false;

  // 3. FIFO Queue exploration loop
  while (queue.length > 0) {
    // Dequeue the oldest node (First-In, First-Out)
    const current = queue.shift()!;

    // Check if destination has been reached
    if (current.col === goal.col && current.row === goal.row) {
      goalReached = true;
      break;
    }

    // Explore 4 cardinal neighbors: Up, Down, Left, Right
    for (const dir of CARDINAL_DIRECTIONS) {
      const neighborCol = current.col + dir.col;
      const neighborRow = current.row + dir.row;
      const neighborKey = toKey(neighborCol, neighborRow);

      // Skip if out-of-bounds or solid wall
      if (map.isWall(neighborCol, neighborRow)) {
        continue;
      }

      // Skip if already visited
      if (visited.has(neighborKey)) {
        continue;
      }

      // Mark visited, record parent, and enqueue
      visited.add(neighborKey);
      parentMap.set(neighborKey, current);
      queue.push({ col: neighborCol, row: neighborRow });
    }
  }

  // 4. If destination was not reached, return empty array
  if (!goalReached) {
    return [];
  }

  // 5. Reconstruct shortest path by tracing back from goal to start
  const path: GridNode[] = [];
  let currentStep: GridNode | undefined = goal;

  while (currentStep) {
    path.push(currentStep);

    // Stop once we have traced back to start
    if (currentStep.col === start.col && currentStep.row === start.row) {
      break;
    }

    currentStep = parentMap.get(toKey(currentStep.col, currentStep.row));
  }

  // Reverse so the path proceeds in order from start to goal
  path.reverse();
  return path;
}
