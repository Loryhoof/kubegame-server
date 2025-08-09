import { speedFactor } from "./constants";
import DamageZone from "./Entities/DamageZone";
import HealthZone from "./Entities/HealthZone";
import Entity from "./interfaces/Entity";
import Zone from "./interfaces/Zone";
import { randomHex } from "./mathUtils";
import Player from "./Player";

class World {
  private players: Map<string, Player> = new Map();
  private entities: Entity[] = [];
  private zones: Zone[] = [];

  constructor() {
    this.init();
  }
  init() {
    const healthZone = new HealthZone(
      5,
      2,
      5,
      { x: 0, y: -0.5, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 }
    );
    const damageZone = new DamageZone(
      10,
      2,
      10,
      { x: 20, y: -0.5, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 }
    );

    this.zones.push(healthZone, damageZone);
  }
  update() {
    for (const [key, player] of this.players) {
      player.update();

      console.log(`${player.id}: ${player.health}`);

      if (player.health <= 0) {
        player.setPosition({ x: 0, y: 0, z: 0 });
        player.health = 100;
      }
      player.position.x += player.velocity.x * speedFactor;
      player.position.z += player.velocity.z * speedFactor;

      this.zones.forEach((zone) => {
        if (zone.contains(player)) {
          zone.trigger(player);
        }
      });
    }

    // this.entities.forEach((entity) => {
    //   entity.update();
    // });
  }
  getState() {
    return {
      players: this.players,
      zones: this.zones,
    };
  }
  addPlayer(networkId: string) {
    const newPlayer = new Player(
      networkId,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 },
      randomHex()
    );

    this.players.set(networkId, newPlayer);
  }
  removePlayer(networkId: string) {
    this.players.delete(networkId);
  }
}

export default World;
