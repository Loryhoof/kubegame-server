import TriggerZone from "../Entities/TriggerZone";
import { Quaternion, Vector3 } from "../mathUtils";
import Player from "../Player";
import { ServerNotification } from "../server";
import ServerStore from "../Store/ServerStore";
import World from "../World";

type Waypoint = {
  position: Vector3;
  object: TriggerZone;
  trackIndex: number; // index in pathPoints (0..pathPoints.length-1)
  sequence: number; // global sequence in race (0..totalWaypointCount-1)
};

export default class Race {
  private world: World;
  public players: Player[] = [];

  private pathPoints: Vector3[] = [];
  private activeWaypoints: Waypoint[] = [];

  private visibleWaypointsCount = 3;

  private nextTrackIndex = 0; // next pathPoints index to spawn
  private spawnedCount = 0; // how many checkpoints spawned in race
  private reachedCount = 0; // how many checkpoints reached in race
  private totalWaypointCount = 0; // pathPoints.length * maxLaps

  private lap = 0; // laps completed
  private maxLaps = 1;

  private raceStartTime: number | null = null;
  private raceEndTime: number | null = null;

  private hasStarted = false;
  private hasFinished = false;

  constructor(world: World, player?: Player) {
    this.world = world;
    if (player) this.players.push(player);

    this.pathPoints = this.generateCircuitPath();
    this.totalWaypointCount = this.pathPoints.length * this.maxLaps;
  }

  getStartPosition(): Vector3 {
    return this.pathPoints.length > 0
      ? this.pathPoints[0]
      : new Vector3(0, 0, 0);
  }

  start() {
    this.clearAllWaypoints();

    this.activeWaypoints = [];
    this.nextTrackIndex = 0;
    this.spawnedCount = 0;
    this.reachedCount = 0;
    this.lap = 0;
    this.hasStarted = false;
    this.hasFinished = false;
    this.raceStartTime = null;
    this.raceEndTime = null;

    // Preload only up to the finish line
    const toPreload = Math.min(
      this.visibleWaypointsCount,
      this.totalWaypointCount
    );
    for (let i = 0; i < toPreload; i++) {
      this.createNextWaypoint();
    }
  }

  public restart() {
    // Clear active waypoints from the world
    this.clearAllWaypoints();

    // Reset all race state variables
    this.activeWaypoints = [];
    this.pathPoints = this.generateCircuitPath(); // regenerate the path
    this.totalWaypointCount = this.pathPoints.length * this.maxLaps;

    this.nextTrackIndex = 0;
    this.spawnedCount = 0;
    this.reachedCount = 0;
    this.lap = 0;

    this.hasStarted = false;
    this.hasFinished = false;
    this.raceStartTime = null;
    this.raceEndTime = null;

    // Respawn initial checkpoints just like a fresh race
    const toPreload = Math.min(
      this.visibleWaypointsCount,
      this.totalWaypointCount
    );
    for (let i = 0; i < toPreload; i++) {
      this.createNextWaypoint();
    }

    // Reset all players back to the start position
    for (const player of this.players) {
      const car = player.controlledObject;
      if (car && this.pathPoints.length > 0) {
        const start = this.pathPoints[0];
        car.teleportTo(new Vector3(start.x, start.y + 5, start.z - 20));
      }
    }
  }

  addPlayer(player: Player) {
    this.players.push(player);

    const car = player.controlledObject;
    if (car && this.pathPoints.length > 0) {
      const start = this.pathPoints[0];
      car.teleportTo(new Vector3(start.x, start.y + 5, start.z - 20));
    }
  }

  removePlayer(player: Player) {
    const index = this.players.findIndex((p) => p.id === player.id);
    if (index !== -1) this.players.splice(index, 1);
  }

  // === Path Generation (Bezier, evenly spaced, flat Y) ===

  private generateBezierPoint(
    t: number,
    p0: Vector3,
    p1: Vector3,
    p2: Vector3,
    p3: Vector3
  ): Vector3 {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    const p = p0
      .clone()
      .multiplyScalar(uuu)
      .add(p1.clone().multiplyScalar(3 * uu * t))
      .add(p2.clone().multiplyScalar(3 * u * tt))
      .add(p3.clone().multiplyScalar(ttt));

    p.y = 0; // force flat
    return p;
  }

  private generateBezierPath(
    p0: Vector3,
    p1: Vector3,
    p2: Vector3,
    p3: Vector3,
    segments: number,
    minDistance: number = 30
  ): Vector3[] {
    const points: Vector3[] = [];
    let distanceAccum = 0;

    let prev = this.generateBezierPoint(0, p0, p1, p2, p3);
    points.push(prev.clone());

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const current = this.generateBezierPoint(t, p0, p1, p2, p3);

      distanceAccum += current.distanceTo(prev);
      if (distanceAccum >= minDistance) {
        points.push(current.clone());
        distanceAccum = 0;
      }

      prev = current;
    }

    return points;
  }

  private generateCircuitPath(): Vector3[] {
    const curves = [
      [
        new Vector3(-100, 0, -100),
        new Vector3(-50, 0, 150),
        new Vector3(50, 0, -150),
        new Vector3(100, 0, 100),
      ],
      [
        new Vector3(100, 0, 100),
        new Vector3(200, 0, 200),
        new Vector3(300, 0, -200),
        new Vector3(-100, 0, -100), // back to start
      ],
    ];

    let allPoints: Vector3[] = [];
    for (let c of curves) {
      allPoints = allPoints.concat(
        this.generateBezierPath(c[0], c[1], c[2], c[3], 200, 100)
      );
    }

    // Ensure unique first point and non-empty
    if (allPoints.length === 0) {
      allPoints.push(new Vector3(0, 0, 0));
    }
    return allPoints;
  }

  // === Waypoint Lifecycle ===

  private createNextWaypoint(): void {
    if (this.hasFinished) return;
    if (this.pathPoints.length === 0) return;
    if (this.spawnedCount >= this.totalWaypointCount) return; // never spawn beyond finish line

    const pos = this.pathPoints[this.nextTrackIndex];

    const tz = new TriggerZone(
      5,
      5,
      5,
      pos,
      new Quaternion(),
      "#FFA500",
      { type: "passive" },
      undefined
    );

    const waypoint: Waypoint = {
      position: pos,
      object: tz,
      trackIndex: this.nextTrackIndex,
      sequence: this.spawnedCount,
    };

    this.world.addZone(tz);
    this.activeWaypoints.push(waypoint);

    // advance indices/counters for the next spawn
    this.spawnedCount++;
    this.nextTrackIndex++;
    if (this.nextTrackIndex >= this.pathPoints.length) {
      this.nextTrackIndex = 0;
    }
  }

  private onReachWaypoint() {
    if (this.activeWaypoints.length === 0 || this.hasFinished) return;

    const reached = this.activeWaypoints.shift()!;
    // remove the reached zone from the world
    this.world.removeZone(reached.object);

    this.reachedCount++;

    // Lap boundary detection: finished a lap when we reach the last track index
    if (reached.trackIndex === this.pathPoints.length - 1) {
      this.lap++;
      // console.log(`Lap ${this.lap} completed`);
    }

    // If this was the final checkpoint of the race, finish immediately
    if (reached.sequence === this.totalWaypointCount - 1) {
      this.finishGame();
      return; // DO NOT spawn any further waypoints
    }

    // Otherwise, maintain the lookahead window but never exceed finish line
    const stillNeed = this.visibleWaypointsCount - this.activeWaypoints.length;
    for (let i = 0; i < stillNeed; i++) {
      this.createNextWaypoint();
      if (this.hasFinished) break;
    }
  }

  private finishGame() {
    if (this.hasFinished) return;

    this.hasFinished = true;
    this.raceEndTime = Date.now();

    // Clear any remaining visible waypoints
    this.clearAllWaypoints();

    if (!this.raceStartTime) {
      // Edge case: finished without starting (single checkpoint etc.)
      this.raceStartTime = this.raceEndTime;
    }

    const totalTime = (this.raceEndTime - this.raceStartTime) / 1000;
    // console.log(
    //   `Race finished in ${totalTime.toFixed(2)}s after ${this.lap} laps!`
    // );

    const player = this.players[0];

    console.log(player.nickname, "PLAYER NICKNAME");

    ServerStore.getInstance().addLeaderboardEntry({
      id: player.id,
      nickname: player.nickname ?? null,
      time: totalTime,
    });

    const leaderboard = ServerStore.getInstance().getLeaderboard();

    const event = {
      type: "race",
      recipient: player.id,
      totalTime: totalTime,
      leaderboard: leaderboard,
    };

    this.world
      .getIO()
      .to(this.world.lobby.id)
      .to(player.id)
      .emit("minigame-end", event);
  }

  private clearAllWaypoints() {
    if (!this.activeWaypoints) return;
    for (const wp of this.activeWaypoints) {
      this.world.removeZone(wp.object);
    }
    this.activeWaypoints = [];
  }

  // === Tick ===

  update() {
    if (this.hasFinished) return;
    if (this.activeWaypoints.length === 0 || this.players.length === 0) return;

    const player = this.players[0];
    const car = player.controlledObject;
    if (!car) return;

    const carPosition = new Vector3(
      car.position.x,
      car.position.y,
      car.position.z
    );
    const currentTarget = this.activeWaypoints[0];

    const distance = carPosition.distanceTo(currentTarget.position);
    if (distance <= 5) {
      if (!this.hasStarted) {
        this.hasStarted = true;
        this.raceStartTime = Date.now();

        const event = {
          type: "race",
          recipient: player.id,
          startTime: this.raceStartTime,
        };

        this.world
          .getIO()
          .to(this.world.lobby.id)
          .to(player.id)
          .emit("minigame-start", event);
      }

      this.onReachWaypoint();
    }
  }
}
