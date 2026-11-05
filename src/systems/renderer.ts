import { Player } from '../game/player';
import { Predator } from '../game/predator';
import { GameMap, TILE_FLOOR, TILE_WALL } from '../game/map';
import { PredatorState } from '../ai/fsm';

/**
 * Handles all 2D HTML5 Canvas rendering operations for NIGHTFALL.
 * Renders environment background, tile-based facility map, player, and predator entities.
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;
  private resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to acquire 2D rendering context from canvas.');
    }
    this.ctx = context;

    this.resizeHandler = () => this.handleResize();
    this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  /**
   * Resizes canvas buffer to match CSS display dimensions 1:1 with DPR scaling.
   */
  public handleResize(): void {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = this.canvas.clientWidth || window.innerWidth;
    const displayHeight = this.canvas.clientHeight || window.innerHeight;

    this.canvas.width = Math.floor(displayWidth * dpr);
    this.canvas.height = Math.floor(displayHeight * dpr);

    this.width = displayWidth;
    this.height = displayHeight;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  public getWidth(): number {
    return this.width;
  }

  public getHeight(): number {
    return this.height;
  }

  /**
   * Clears the entire canvas viewport.
   */
  public clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Renders the deep void background of the canvas.
   */
  public renderBackground(): void {
    this.ctx.fillStyle = '#06070a';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Renders the tile-based facility map.
   * Draws 0 as metal/concrete floor slabs and 1 as reinforced facility walls.
   */
  public renderMap(map: GameMap, offsetX: number, offsetY: number): void {
    const ctx = this.ctx;
    const tileSize = map.tileSize;

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const x = offsetX + c * tileSize;
        const y = offsetY + r * tileSize;
        const tile = map.getTile(c, r);

        if (tile === TILE_FLOOR) {
          // --- Floor Tile (Walkable Corridor / Room) ---
          ctx.fillStyle = '#11141b';
          ctx.fillRect(x, y, tileSize, tileSize);

          // Subtle inner concrete slab accent
          ctx.fillStyle = '#141822';
          ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

          // Tile boundary seam
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
        } else if (tile === TILE_WALL) {
          // --- Wall Tile (Reinforced Facility Bulkhead) ---
          ctx.fillStyle = '#222836';
          ctx.fillRect(x, y, tileSize, tileSize);

          // Top highlight (giving a 2.5D elevated perspective)
          ctx.fillStyle = '#343e52';
          ctx.fillRect(x, y, tileSize, 4);

          // Bottom shadow
          ctx.fillStyle = '#10131a';
          ctx.fillRect(x, y + tileSize - 4, tileSize, 4);

          // Inner panel border
          ctx.strokeStyle = '#181c25';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);

          // Wall face decorative rivet / plate inset
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.strokeRect(x + 5.5, y + 6.5, tileSize - 11, tileSize - 13);
        }
      }
    }
  }

  /**
   * Draws an atmospheric horror vignette overlay centered around the player or screen.
   */
  public renderVignette(focusX: number, focusY: number): void {
    const ctx = this.ctx;
    const maxRadius = Math.max(this.width, this.height) * 0.7;

    const vignette = ctx.createRadialGradient(
      focusX,
      focusY,
      80,
      focusX,
      focusY,
      maxRadius
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.55, 'rgba(3, 4, 6, 0.45)');
    vignette.addColorStop(1, 'rgba(1, 2, 3, 0.92)');

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draws the player placeholder shape with orientation and ambient light glow.
   */
  public renderPlayer(player: Player): void {
    const ctx = this.ctx;

    ctx.save();

    // Subtle player survival glow
    const glowGradient = ctx.createRadialGradient(
      player.x,
      player.y,
      player.radius * 0.5,
      player.x,
      player.y,
      player.radius * 2.8
    );
    glowGradient.addColorStop(0, 'rgba(79, 163, 209, 0.28)');
    glowGradient.addColorStop(1, 'rgba(79, 163, 209, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Player body token
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();

    // Outer border
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#d5e8f5';
    ctx.stroke();

    // Directional indicator dot oriented along player angle
    const indicatorDist = player.radius * 0.55;
    const indicatorX = player.x + Math.cos(player.angle) * indicatorDist;
    const indicatorY = player.y + Math.sin(player.angle) * indicatorDist;

    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draws the Predator entity distinctly from the player.
   * Features a larger silhouette, dark crimson hull, menacing red aura,
   * and glowing predatory eyes.
   */
  public renderPredator(predator: Predator): void {
    const ctx = this.ctx;

    ctx.save();

    // 1. Menacing red threat aura
    const threatAura = ctx.createRadialGradient(
      predator.x,
      predator.y,
      predator.radius * 0.4,
      predator.x,
      predator.y,
      predator.radius * 3.0
    );
    threatAura.addColorStop(0, 'rgba(217, 4, 41, 0.35)');
    threatAura.addColorStop(0.6, 'rgba(158, 42, 43, 0.15)');
    threatAura.addColorStop(1, 'rgba(158, 42, 43, 0)');

    ctx.fillStyle = threatAura;
    ctx.beginPath();
    ctx.arc(predator.x, predator.y, predator.radius * 3.0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Predator main body (heavy crimson silhouette)
    ctx.beginPath();
    ctx.arc(predator.x, predator.y, predator.radius, 0, Math.PI * 2);
    ctx.fillStyle = predator.color;
    ctx.fill();

    // Inner darker core ring
    ctx.beginPath();
    ctx.arc(predator.x, predator.y, predator.radius * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = '#640d14';
    ctx.fill();

    // 3. Dark armored outer border
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#370617';
    ctx.stroke();

    // 4. Piercing glowing predator eyes (angled along facing direction)
    const forwardX = Math.cos(predator.angle);
    const forwardY = Math.sin(predator.angle);
    const perpX = -Math.sin(predator.angle);
    const perpY = Math.cos(predator.angle);

    const eyeDistanceForward = predator.radius * 0.45;
    const eyeSpacing = 6;

    // Left eye
    const eye1X = predator.x + forwardX * eyeDistanceForward + perpX * eyeSpacing;
    const eye1Y = predator.y + forwardY * eyeDistanceForward + perpY * eyeSpacing;
    // Right eye
    const eye2X = predator.x + forwardX * eyeDistanceForward - perpX * eyeSpacing;
    const eye2Y = predator.y + forwardY * eyeDistanceForward - perpY * eyeSpacing;

    // Draw glowing eyes
    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    ctx.arc(eye1X, eye1Y, 2.5, 0, Math.PI * 2);
    ctx.arc(eye2X, eye2Y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Cleans up event listeners.
   */
  public cleanup(): void {
    window.removeEventListener('resize', this.resizeHandler);
  }

  /**
   * Renders the debug HUD overlay in the top-right corner of the canvas.
   * Shows the predator's current AI state, detection status, and navigation targets.
   *
   * @param state            - Current FSM state label
   * @param detected         - Whether the predator currently sees the player
   * @param lastKnownCol     - Last known player column, or null
   * @param lastKnownRow     - Last known player row, or null
   * @param investigateCol   - Sound investigation column, or null
   * @param investigateRow   - Sound investigation row, or null
   */
  public renderDebugHUD(
    state: PredatorState,
    detected: boolean,
    lastKnownCol: number | null,
    lastKnownRow: number | null,
    investigateCol: number | null,
    investigateRow: number | null
  ): void {
    const ctx = this.ctx;

    // ── Layout constants ────────────────────────────────────────────────────
    const panelW = 230;
    const lineH = 18;
    const padding = 10;
    const lines = 5; // number of text rows
    const panelH = padding * 2 + lineH * lines;
    const panelX = this.width - panelW - 12;
    const panelY = 12;

    // ── Background panel ───────────────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = '#05080f';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = '#1a2030';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

    // ── State colour ───────────────────────────────────────────────────────
    const stateColors: Record<PredatorState, string> = {
      [PredatorState.PATROL]:      '#3ddc84', // green
      [PredatorState.CHASE]:       '#ff4444', // red
      [PredatorState.SEARCH]:      '#ffb703', // amber
      [PredatorState.INVESTIGATE]: '#74b9ff', // blue
    };
    const stateColor = stateColors[state] ?? '#ffffff';

    // ── Text rendering ─────────────────────────────────────────────────────
    ctx.font = '11px "Courier New", Courier, monospace';
    ctx.textBaseline = 'top';

    const tx = panelX + padding;
    let ty = panelY + padding;

    // Row 1: Title
    ctx.fillStyle = '#8899aa';
    ctx.fillText('── PREDATOR AI ──', tx, ty);
    ty += lineH;

    // Row 2: State
    ctx.fillStyle = '#8899aa';
    ctx.fillText('STATE: ', tx, ty);
    ctx.fillStyle = stateColor;
    ctx.fillText(state, tx + 55, ty);
    ty += lineH;

    // Row 3: Detection
    ctx.fillStyle = '#8899aa';
    ctx.fillText('DETECTED: ', tx, ty);
    ctx.fillStyle = detected ? '#ff4444' : '#3ddc84';
    ctx.fillText(detected ? 'YES' : 'NO', tx + 72, ty);
    ty += lineH;

    // Row 4: Last known position
    const lastKnownStr =
      lastKnownCol !== null && lastKnownRow !== null
        ? `(${lastKnownCol}, ${lastKnownRow})`
        : 'N/A';
    ctx.fillStyle = '#8899aa';
    ctx.fillText('LAST SEEN: ', tx, ty);
    ctx.fillStyle = lastKnownCol !== null ? '#ffb703' : '#445566';
    ctx.fillText(lastKnownStr, tx + 78, ty);
    ty += lineH;

    // Row 5: Investigate target
    const investigateStr =
      investigateCol !== null && investigateRow !== null
        ? `(${investigateCol}, ${investigateRow})`
        : 'N/A';
    ctx.fillStyle = '#8899aa';
    ctx.fillText('SOUND AT:  ', tx, ty);
    ctx.fillStyle = investigateCol !== null ? '#74b9ff' : '#445566';
    ctx.fillText(investigateStr, tx + 78, ty);

    ctx.restore();
  }
}
