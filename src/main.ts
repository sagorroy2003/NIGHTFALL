import { Game } from './game/game';

// Wait for the DOM to fully load before initializing the game
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

  if (!canvas) {
    console.error("Canvas element not found!");
    return;
  }

  const game = new Game(canvas);
  game.start();
});
