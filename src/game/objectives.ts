export class ObjectiveSystem {
    public powerCellsCollected: number = 0;
    public generatorActive: boolean = false;
    public exitUnlocked: boolean = false;

    // Temporary UI feedback messages (e.g., "Generator Offline - Need 3 Cells")
    public feedbackMessage: string | null = null;
    private feedbackTimer: number = 0;

    public reset(): void {
        this.powerCellsCollected = 0;
        this.generatorActive = false;
        this.exitUnlocked = false;
        this.feedbackMessage = null;
        this.feedbackTimer = 0;
    }

    public setFeedback(msg: string, duration: number = 2.5): void {
        this.feedbackMessage = msg;
        this.feedbackTimer = duration;
    }

    public update(deltaTime: number): void {
        if (this.feedbackTimer > 0) {
            this.feedbackTimer -= deltaTime;
            if (this.feedbackTimer <= 0) {
                this.feedbackMessage = null;
            }
        }
    }

    public getCurrentObjectiveText(): string {
        if (this.powerCellsCollected < 3) {
            return `FIND POWER CELLS (${this.powerCellsCollected}/3)`;
        } else if (!this.generatorActive) {
            return 'ACTIVATE MAIN GENERATOR';
        } else {
            return 'ESCAPE THE FACILITY';
        }
    }
}
