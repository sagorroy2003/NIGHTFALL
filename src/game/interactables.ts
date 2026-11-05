import { GameMap, TILE_FLOOR } from './map';

export enum InteractableType { POWER_CELL, GENERATOR, EXIT }

export interface Interactable {
    id: string;
    type: InteractableType;
    col: number;
    row: number;
    active: boolean;
}

/**
 * Scans the map for floor tiles and randomly places all objectives.
 */
export function generateRandomInteractables(map: GameMap): Interactable[] {
    const validSpots: { col: number; row: number }[] = [];

    // 1. Collect every single valid floor tile on the map
    for (let r = 1; r < map.rows - 1; r++) {
        for (let c = 1; c < map.cols - 1; c++) {
            if (map.getTile(c, r) === TILE_FLOOR) {
                validSpots.push({ col: c, row: r });
            }
        }
    }

    // 2. Shuffle the spots randomly (Fisher-Yates shuffle)
    for (let i = validSpots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [validSpots[i], validSpots[j]] = [validSpots[j], validSpots[i]];
    }

    // 3. Assign the first 5 random floor spots to our items
    return [
        { id: 'cell_1', type: InteractableType.POWER_CELL, col: validSpots[0].col, row: validSpots[0].row, active: true },
        { id: 'cell_2', type: InteractableType.POWER_CELL, col: validSpots[1].col, row: validSpots[1].row, active: true },
        { id: 'cell_3', type: InteractableType.POWER_CELL, col: validSpots[2].col, row: validSpots[2].row, active: true },
        { id: 'gen_1', type: InteractableType.GENERATOR, col: validSpots[3].col, row: validSpots[3].row, active: true },
        { id: 'exit_1', type: InteractableType.EXIT, col: validSpots[4].col, row: validSpots[4].row, active: true }
    ];
}
