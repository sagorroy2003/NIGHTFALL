/**
 * The four core behavioral states of the NIGHTFALL predator.
 */
export enum PredatorState {
  PATROL = 'PATROL',           // Routine autonomous patrolling along facility waypoints
  CHASE = 'CHASE',             // Direct aggressive pursuit of a sighted player
  INVESTIGATE = 'INVESTIGATE', // Inspecting a point of interest or last known location
  SEARCH = 'SEARCH',           // Actively searching adjacent rooms when target is lost
}

export type StateChangeListener = (from: PredatorState, to: PredatorState) => void;

/**
 * Standalone Finite State Machine (FSM) for managing predator behaviors.
 * Handles state tracking, transition validation, and duration timers.
 */
export class PredatorFSM {
  private currentState: PredatorState;
  private previousState: PredatorState | null = null;
  private timeInState: number = 0;
  private listeners: StateChangeListener[] = [];

  constructor(initialState: PredatorState = PredatorState.PATROL) {
    this.currentState = initialState;
  }

  /**
   * Returns the current active state.
   */
  public getState(): PredatorState {
    return this.currentState;
  }

  /**
   * Returns the state prior to the most recent transition.
   */
  public getPreviousState(): PredatorState | null {
    return this.previousState;
  }

  /**
   * Returns the accumulated duration (in seconds) spent in the current state.
   */
  public getTimeInState(): number {
    return this.timeInState;
  }

  /**
   * Transitions the predator to a new state.
   * Prevents redundant transitions if already in the target state.
   *
   * @param nextState - The destination PredatorState
   * @returns boolean - True if the transition occurred, false if ignored
   */
  public transitionTo(nextState: PredatorState): boolean {
    // Prevent redundant transition if already in requested state
    if (this.currentState === nextState) {
      return false;
    }

    const fromState = this.currentState;
    this.previousState = fromState;
    this.currentState = nextState;
    this.timeInState = 0;

    // Notify subscribers of the transition
    for (const listener of this.listeners) {
      listener(fromState, nextState);
    }

    return true;
  }

  /**
   * Advances the state duration timer by delta time.
   */
  public update(deltaTime: number): void {
    this.timeInState += deltaTime;
  }

  /**
   * Registers a callback invoked upon state changes.
   */
  public onStateChange(listener: StateChangeListener): void {
    this.listeners.push(listener);
  }
}
