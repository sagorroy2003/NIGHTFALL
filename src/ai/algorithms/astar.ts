import { GameMap } from '../../game/map';
import { GridNode, NavGrid } from './bfs';

export type { GridNode, NavGrid };

/**
 * Node used by A* containing cost evaluations and path tracing references.
 */
export interface AStarNode {
  col: number;
  row: number;
  g: number; // Cost from start node to this node (exact distance traveled)
  h: number; // Heuristic estimated cost from this node to goal (Manhattan distance)
  f: number; // Total estimated path cost (f = g + h)
  parent?: AStarNode; // Reference to predecessor node for path reconstruction
}

/**
 * Four cardinal exploration directions: Up, Down, Left, Right.
 */
export const CARDINAL_DIRECTIONS: readonly GridNode[] = [
  { col: 0, row: -1 }, // Up
  { col: 0, row: 1 },  // Down
  { col: -1, row: 0 }, // Left
  { col: 1, row: 0 },  // Right
];

/**
 * Calculates the Manhattan distance between two grid coordinates.
 *
 * Manhattan distance (|dx| + |dy|) represents the minimum number of orthogonal
 * grid steps needed to travel between two points. It is an admissible heuristic
 * for 4-directional grid movement because it never overestimates actual distance.
 */
export function manhattanDistance(a: GridNode, b: GridNode): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/**
 * Generates a unique string key for a coordinate cell.
 */
function toKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * Standalone A* (A-Star) pathfinding algorithm.
 *
 * Finds the optimal shortest path between start and goal on a 4-directional
 * facility grid using Manhattan distance heuristic.
 *
 * @param start - Starting grid cell { col, row }
 * @param goal - Destination grid cell { col, row }
 * @param map - Facility map implementing NavGrid (or GameMap)
 * @returns Array of GridNodes from start to goal [start, ..., goal], or [] if no path exists.
 */
export function findPathAStar(
  start: GridNode,
  goal: GridNode,
  map: NavGrid | GameMap
): GridNode[] {
  // 1. Initial validation
  if (
    map.isWall(start.col, start.row) ||
    map.isWall(goal.col, goal.row)
  ) {
    return [];
  }

  // If already at goal, return single-node path
  if (start.col === goal.col && start.row === goal.row) {
    return [{ col: start.col, row: start.row }];
  }

  // 2. Open set (discovered nodes to evaluate) and Closed set (already evaluated nodes)
  const openSet: AStarNode[] = [];
  const closedSet = new Set<string>();

  // Tracks lowest known g-cost to each cell
  const gScore = new Map<string, number>();

  // Map to easily check and update nodes already in openSet
  const openSetMap = new Map<string, AStarNode>();

  const startH = manhattanDistance(start, goal);
  const startNode: AStarNode = {
    col: start.col,
    row: start.row,
    g: 0,
    h: startH,
    f: startH,
  };

  const startKey = toKey(start.col, start.row);
  openSet.push(startNode);
  openSetMap.set(startKey, startNode);
  gScore.set(startKey, 0);

  // 3. Main A* loop
  while (openSet.length > 0) {
    // Select node in openSet with the lowest f-cost (tie-breaking with lower h-cost)
    let lowestIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (
        openSet[i].f < openSet[lowestIndex].f ||
        (openSet[i].f === openSet[lowestIndex].f && openSet[i].h < openSet[lowestIndex].h)
      ) {
        lowestIndex = i;
      }
    }

    const current = openSet.splice(lowestIndex, 1)[0];
    const currentKey = toKey(current.col, current.row);
    openSetMap.delete(currentKey);

    // Check if goal has been reached
    if (current.col === goal.col && current.row === goal.row) {
      // 4. Reconstruct optimal path by tracing parents back to start
      const path: GridNode[] = [];
      let step: AStarNode | undefined = current;

      while (step) {
        path.push({ col: step.col, row: step.row });
        step = step.parent;
      }

      path.reverse();
      return path;
    }

    // Move current node to closed set
    closedSet.add(currentKey);

    // Explore 4 cardinal neighbors (Up, Down, Left, Right)
    for (const dir of CARDINAL_DIRECTIONS) {
      const neighborCol = current.col + dir.col;
      const neighborRow = current.row + dir.row;
      const neighborKey = toKey(neighborCol, neighborRow);

      // Skip walls and out-of-bounds cells
      if (map.isWall(neighborCol, neighborRow)) {
        continue;
      }

      // Skip already evaluated nodes
      if (closedSet.has(neighborKey)) {
        continue;
      }

      // Orthogonal step cost is 1
      const tentativeG = current.g + 1;
      const existingG = gScore.get(neighborKey) ?? Infinity;

      if (tentativeG < existingG) {
        // Discovered a better (or new) path to this neighbor
        gScore.set(neighborKey, tentativeG);
        const h = manhattanDistance({ col: neighborCol, row: neighborRow }, goal);
        const f = tentativeG + h;

        const existingNode = openSetMap.get(neighborKey);
        if (existingNode) {
          // Update existing node in openSet with cheaper costs and parent
          existingNode.g = tentativeG;
          existingNode.f = f;
          existingNode.parent = current;
        } else {
          // Add new node to openSet
          const neighborNode: AStarNode = {
            col: neighborCol,
            row: neighborRow,
            g: tentativeG,
            h,
            f,
            parent: current,
          };
          openSet.push(neighborNode);
          openSetMap.set(neighborKey, neighborNode);
        }
      }
    }
  }

  // Goal was unreachable
  return [];
}
