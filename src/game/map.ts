/**
 * Facility tile types.
 * 0 = Walkable Floor
 * 1 = Impassable Wall
 */
export const TILE_FLOOR = 0;
export const TILE_WALL = 1;

export type TileType = typeof TILE_FLOOR | typeof TILE_WALL;

/**
 * Predefined 14x20 facility layout.
 * Outer boundaries are solid walls.
 * Encloses four specialized rooms (Security, Lab, Storage, Reactor)
 * interconnected by corridors and doorways.
 */
export const DEFAULT_FACILITY_LAYOUT: number[][] = [
  // 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0  (North Boundary)
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1], // Row 1  (Security / Lab)
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1], // Row 2
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 3  (North Hallway)
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1], // Row 4
  [1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1], // Row 5  (Room Partitions)
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 6  (Main Central Corridor)
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 7  (Main Central Corridor)
  [1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1], // Row 8  (Room Partitions)
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1], // Row 9
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Row 10 (South Hallway)
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1], // Row 11 (Storage / Reactor)
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1], // Row 12
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 13 (South Boundary)
];

export interface MapOptions {
  tileSize?: number;
  layout?: number[][];
}

/**
 * Manages facility map data, grid dimensions, and tile lookups.
 * Keeps map data decoupled from rendering and physics systems.
 */
export class GameMap {
  public readonly tileSize: number;
  public readonly rows: number;
  public readonly cols: number;
  public readonly grid: number[][];

  constructor(options?: MapOptions) {
    this.tileSize = options?.tileSize ?? 48;
    this.grid = options?.layout ?? DEFAULT_FACILITY_LAYOUT;
    this.rows = this.grid.length;
    this.cols = this.grid[0]?.length ?? 0;
  }

  /**
   * Total width of the map in world pixels.
   */
  public getWidthInPixels(): number {
    return this.cols * this.tileSize;
  }

  /**
   * Total height of the map in world pixels.
   */
  public getHeightInPixels(): number {
    return this.rows * this.tileSize;
  }

  /**
   * Returns tile type at grid coordinate (col, row).
   * Out-of-bounds coordinates return TILE_WALL as safe boundary.
   */
  public getTile(col: number, row: number): number {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return TILE_WALL;
    }
    return this.grid[row][col];
  }

  /**
   * Checks whether the specified tile is a wall.
   */
  public isWall(col: number, row: number): boolean {
    return this.getTile(col, row) === TILE_WALL;
  }

  /**
   * Checks whether the specified tile is walkable (not a wall, within bounds).
   */
  public isWalkable(col: number, row: number): boolean {
    return this.getTile(col, row) === TILE_FLOOR;
  }
}
