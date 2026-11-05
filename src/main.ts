import { Game } from './game/game';

// Initialize the game once the DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    console.error('Fatal: Failed to locate #game-canvas element.');
    return;
  }

  const game = new Game(canvas);
  game.start();
});
