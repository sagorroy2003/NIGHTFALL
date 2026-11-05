import { Player } from '../game/player';
import { Predator } from '../game/predator';
import { GameMap, TILE_FLOOR, TILE_WALL } from '../game/map';
import { PredatorState } from '../ai/fsm';
import { Interactable, InteractableType } from '../game/interactables';
import { ObjectiveSystem } from '../game/objectives';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // NEW: Dedicated offscreen canvas just for the lighting system
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;

  private width: number = 0;
  private height: number = 0;
  private resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to acquire 2D rendering context');
    this.ctx = context;

    // Initialize the offscreen lighting canvas
    this.lightCanvas = document.createElement('canvas');
    const lightContext = this.lightCanvas.getContext('2d');
    if (!lightContext) throw new Error('Unable to acquire light context');
    this.lightCtx = lightContext;

    this.resizeHandler = () => this.handleResize();
    this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  public handleResize(): void {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = this.canvas.clientWidth || window.innerWidth;
    const displayHeight = this.canvas.clientHeight || window.innerHeight;

    // Scale main canvas
    this.canvas.width = Math.floor(displayWidth * dpr);
    this.canvas.height = Math.floor(displayHeight * dpr);
    this.width = displayWidth;
    this.height = displayHeight;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Scale lighting canvas to perfectly match the main canvas
    this.lightCanvas.width = this.canvas.width;
    this.lightCanvas.height = this.canvas.height;
    this.lightCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  public getWidth(): number { return this.width; }
  public getHeight(): number { return this.height; }
  public clear(): void { this.ctx.clearRect(0, 0, this.width, this.height); }

  public renderBackground(): void {
    this.ctx.fillStyle = '#06070a';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  public renderMap(map: GameMap, offsetX: number, offsetY: number): void {
    const ctx = this.ctx;
    const tileSize = map.tileSize;
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const x = offsetX + c * tileSize; const y = offsetY + r * tileSize;
        const tile = map.getTile(c, r);
        if (tile === TILE_FLOOR) {
          ctx.fillStyle = '#11141b'; ctx.fillRect(x, y, tileSize, tileSize);
          ctx.fillStyle = '#141822'; ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'; ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
        } else if (tile === TILE_WALL) {
          ctx.fillStyle = '#222836'; ctx.fillRect(x, y, tileSize, tileSize);
          ctx.fillStyle = '#343e52'; ctx.fillRect(x, y, tileSize, 4);
          ctx.fillStyle = '#10131a'; ctx.fillRect(x, y + tileSize - 4, tileSize, 4);
          ctx.strokeStyle = '#181c25'; ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
        }
      }
    }
  }

  public renderInteractables(items: Interactable[], map: GameMap, offsetX: number, offsetY: number, generatorActive: boolean): void {
    const ctx = this.ctx; const tileSize = map.tileSize;
    ctx.save();
    for (const item of items) {
      if (!item.active && item.type === InteractableType.POWER_CELL) continue;
      const x = offsetX + item.col * tileSize; const y = offsetY + item.row * tileSize;
      const cx = x + tileSize / 2; const cy = y + tileSize / 2;

      if (item.type === InteractableType.POWER_CELL) {
        ctx.fillStyle = '#00ffff'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 15;
        ctx.fillRect(cx - 6, cy - 10, 12, 20); ctx.shadowBlur = 0;
      }
      else if (item.type === InteractableType.GENERATOR) {
        ctx.fillStyle = generatorActive ? '#2ecc71' : '#e67e22'; ctx.shadowColor = generatorActive ? '#2ecc71' : '#000';
        ctx.shadowBlur = generatorActive ? 20 : 0; ctx.fillRect(x + 4, y + 4, tileSize - 8, tileSize - 8);
        ctx.fillStyle = '#2c3e50'; ctx.fillRect(x + 8, y + 8, tileSize - 16, tileSize - 16); ctx.shadowBlur = 0;
      }
      else if (item.type === InteractableType.EXIT) {
        ctx.fillStyle = generatorActive ? '#2ecc71' : '#c0392b'; ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
        ctx.fillStyle = '#000'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('EXIT', cx, cy);
      }
    }
    ctx.restore();
  }

  public renderPredatorVision(predator: Predator): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(predator.x, predator.y);
    ctx.rotate(predator.angle);

    ctx.globalCompositeOperation = 'lighter';

    ctx.beginPath();
    ctx.moveTo(0, 0);
    // Increased radius to 450 for a massive sightline
    ctx.arc(0, 0, 450, -Math.PI / 4, Math.PI / 4);
    ctx.closePath();

    // Match the gradient radius to 450
    const radarGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 450);
    radarGrad.addColorStop(0, 'rgba(217, 4, 41, 0.6)');
    radarGrad.addColorStop(1, 'rgba(217, 4, 41, 0)');

    ctx.fillStyle = radarGrad;
    ctx.fill();
    ctx.restore();
  }

  public renderPlayer(player: Player): void {
    const ctx = this.ctx; ctx.save();
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2); ctx.fillStyle = player.color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#d5e8f5'; ctx.stroke();
    const indDist = player.radius * 0.55;
    ctx.beginPath(); ctx.arc(player.x + Math.cos(player.angle) * indDist, player.y + Math.sin(player.angle) * indDist, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
  }

  public renderPredator(predator: Predator): void {
    const ctx = this.ctx; ctx.save();
    ctx.beginPath(); ctx.arc(predator.x, predator.y, predator.radius, 0, Math.PI * 2); ctx.fillStyle = predator.color; ctx.fill();
    ctx.beginPath(); ctx.arc(predator.x, predator.y, predator.radius * 0.65, 0, Math.PI * 2); ctx.fillStyle = '#640d14'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#370617'; ctx.stroke();
    const fx = Math.cos(predator.angle); const fy = Math.sin(predator.angle); const px = -Math.sin(predator.angle); const py = Math.cos(predator.angle);
    const eDist = predator.radius * 0.45; const eSpc = 6;
    ctx.fillStyle = '#ffb703'; ctx.beginPath();
    ctx.arc(predator.x + fx * eDist + px * eSpc, predator.y + fy * eDist + py * eSpc, 2.5, 0, Math.PI * 2);
    ctx.arc(predator.x + fx * eDist - px * eSpc, predator.y + fy * eDist - py * eSpc, 2.5, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();
  }

  // NEW: Added lightningIntensity parameter
  public renderLighting(player: Player, generatorActive: boolean, lightningIntensity: number = 0): void {
    if (generatorActive) return;

    const lctx = this.lightCtx;
    lctx.clearRect(0, 0, this.width, this.height);

    lctx.globalCompositeOperation = 'source-over';

    // LIGHTNING LOGIC: Subtract the lightning flash intensity from the base darkness.
    // If intensity is 1.0 (strike), darkness is 0 (fully visible).
    const currentDarkness = Math.max(0, 0.94 - lightningIntensity);

    lctx.fillStyle = `rgba(2, 3, 5, ${currentDarkness})`;
    lctx.fillRect(0, 0, this.width, this.height);

    // Only bother punching flashlight holes if it's actually dark!
    if (currentDarkness > 0.1) {
      lctx.globalCompositeOperation = 'destination-out';

      const baseGlow = Math.random() > 0.9 ? 70 : 90;
      const ambient = lctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, baseGlow);
      ambient.addColorStop(0, 'rgba(255,255,255,1)');
      ambient.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = ambient;
      lctx.beginPath(); lctx.arc(player.x, player.y, 90, 0, Math.PI * 2); lctx.fill();

      let flashAlpha = 0.9;
      let flashRadius = 450;
      const flickerChance = Math.random();
      if (flickerChance > 0.98) { flashAlpha = 0.1; flashRadius = 200; }
      else if (flickerChance > 0.92) { flashAlpha = 0.4 + Math.random() * 0.3; flashRadius = 350 + Math.random() * 50; }

      lctx.save(); lctx.translate(player.x, player.y); lctx.rotate(player.angle);
      const flashlight = lctx.createRadialGradient(0, 0, 0, 0, 0, flashRadius);
      flashlight.addColorStop(0, `rgba(255,255,255,${flashAlpha})`);
      flashlight.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = flashlight;
      lctx.beginPath(); lctx.moveTo(0, 0); lctx.arc(0, 0, flashRadius, -Math.PI / 4, Math.PI / 4); lctx.closePath(); lctx.fill(); lctx.restore();
    }

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.lightCanvas, 0, 0);
    this.ctx.restore();
  }

  public renderObjectiveHUD(objectives: ObjectiveSystem): void {
    const ctx = this.ctx; ctx.save();
    const pX = 16; const pY = 16; const pW = 280; const pH = 110;
    ctx.fillStyle = 'rgba(5, 8, 15, 0.85)'; ctx.fillRect(pX, pY, pW, pH);
    ctx.strokeStyle = '#1a2030'; ctx.lineWidth = 1; ctx.strokeRect(pX + 0.5, pY + 0.5, pW - 1, pH - 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const tx = pX + 16; let ty = pY + 16;
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#ffb703'; ctx.fillText('── OBJECTIVES ──', tx, ty); ty += 22;
    ctx.font = '12px monospace'; ctx.fillStyle = '#ffffff'; ctx.fillText(`► ${objectives.getCurrentObjectiveText()}`, tx, ty); ty += 22;
    ctx.fillStyle = '#8899aa'; ctx.fillText(`POWER CELLS: ${objectives.powerCellsCollected} / 3`, tx, ty); ty += 18;
    ctx.fillStyle = objectives.generatorActive ? '#2ecc71' : '#e74c3c'; ctx.fillText(`GENERATOR: ${objectives.generatorActive ? 'ONLINE' : 'OFFLINE'}`, tx, ty);
    if (objectives.feedbackMessage) {
      ctx.textAlign = 'center'; ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#e74c3c';
      ctx.fillText(objectives.feedbackMessage, this.width / 2, this.height - 120);
    }
    ctx.restore();
  }

  public renderInteractionPrompt(promptText: string): void {
    const ctx = this.ctx; ctx.save();
    ctx.textAlign = 'center'; ctx.font = '15px monospace'; ctx.fillStyle = '#ffffff';
    ctx.fillText(promptText, this.width / 2, this.height - 70); ctx.restore();
  }

  public renderDebugHUD(state: PredatorState, detected: boolean, lastKnownCol: number | null, lastKnownRow: number | null, investigateCol: number | null, investigateRow: number | null): void {
    const ctx = this.ctx;
    const panelW = 230; const lineH = 18; const padding = 16; const lines = 5;
    const panelH = padding * 2 + lineH * lines;
    const panelX = this.width - panelW - 16; const panelY = 16;
    ctx.save(); ctx.globalAlpha = 0.78; ctx.fillStyle = '#05080f'; ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.globalAlpha = 1.0; ctx.strokeStyle = '#1a2030'; ctx.lineWidth = 1; ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);
    const stateColors: Record<PredatorState, string> = { [PredatorState.PATROL]: '#3ddc84', [PredatorState.CHASE]: '#ff4444', [PredatorState.SEARCH]: '#ffb703', [PredatorState.INVESTIGATE]: '#74b9ff' };
    const stateColor = stateColors[state] ?? '#ffffff';
    ctx.font = '11px "Courier New", Courier, monospace'; ctx.textBaseline = 'top';
    const tx = panelX + padding; let ty = panelY + padding;
    ctx.fillStyle = '#8899aa'; ctx.fillText('── PREDATOR AI ──', tx, ty); ty += lineH;
    ctx.fillStyle = '#8899aa'; ctx.fillText('STATE: ', tx, ty); ctx.fillStyle = stateColor; ctx.fillText(state, tx + 55, ty); ty += lineH;
    ctx.fillStyle = '#8899aa'; ctx.fillText('DETECTED: ', tx, ty); ctx.fillStyle = detected ? '#ff4444' : '#3ddc84'; ctx.fillText(detected ? 'YES' : 'NO', tx + 72, ty); ty += lineH;
    const lastKnownStr = lastKnownCol !== null && lastKnownRow !== null ? `(${lastKnownCol}, ${lastKnownRow})` : 'N/A';
    ctx.fillStyle = '#8899aa'; ctx.fillText('LAST SEEN: ', tx, ty); ctx.fillStyle = lastKnownCol !== null ? '#ffb703' : '#445566'; ctx.fillText(lastKnownStr, tx + 78, ty); ty += lineH;
    const investigateStr = investigateCol !== null && investigateRow !== null ? `(${investigateCol}, ${investigateRow})` : 'N/A';
    ctx.fillStyle = '#8899aa'; ctx.fillText('SOUND AT:  ', tx, ty); ctx.fillStyle = investigateCol !== null ? '#74b9ff' : '#445566'; ctx.fillText(investigateStr, tx + 78, ty);
    ctx.restore();
  }

  public cleanup(): void { window.removeEventListener('resize', this.resizeHandler); }
}
