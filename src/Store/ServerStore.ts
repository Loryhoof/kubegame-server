type RaceLeaderboardEntry = {
  id: string;
  nickname: string | null;
  time: number;
};

export default class ServerStore {
  private static instance: ServerStore;

  private raceLeaderboard: RaceLeaderboardEntry[] = [];

  private constructor() {}

  public static getInstance(): ServerStore {
    if (!ServerStore.instance) {
      ServerStore.instance = new ServerStore();
    }
    return ServerStore.instance;
  }

  /**
   * Always updates the player's entry if it's better,
   * replaces their previous one otherwise.
   */
  public addLeaderboardEntry(data: RaceLeaderboardEntry) {
    const existingIndex = this.raceLeaderboard.findIndex(
      (entry) => entry.id === data.id
    );

    if (existingIndex !== -1) {
      // Player already exists → keep the *best* time
      this.raceLeaderboard[existingIndex].time = Math.min(
        this.raceLeaderboard[existingIndex].time,
        data.time
      );
    } else {
      // No previous entry → add new one
      this.raceLeaderboard.push(data);
    }

    // Sort leaderboard by ascending time (best time first)
    this.raceLeaderboard.sort((a, b) => a.time - b.time);
  }

  public getLeaderboard(): RaceLeaderboardEntry[] {
    return this.raceLeaderboard;
  }
}
