export enum GameState {
    MENU,
    PLAYING,
    GAME_OVER,
    VICTORY
}

class StateManager {
    private currentState: GameState = GameState.MENU;

    public get state(): GameState {
        return this.currentState;
    }

    public set state(newState: GameState) {
        this.currentState = newState;
        console.log(`[GameState] changed to: ${GameState[newState]}`);
    }

    public isPlaying(): boolean {
        return this.currentState === GameState.PLAYING;
    }
}

export const stateManager = new StateManager();
