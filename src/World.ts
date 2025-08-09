import { Server } from "socket.io";
import { speedFactor } from "./constants";
import TriggerZone from "./Entities/TriggerZone";

import Entity from "./interfaces/Entity";
import Zone from "./interfaces/Zone";
import { randomHex, randomIntBetween } from "./mathUtils";
import Player from "./Player";

class World {
  private io: Server;
  private players: Map<string, Player> = new Map();
  private entities: Entity[] = [];
  private zones: Zone[] = [];

  constructor(io: Server) {
    this.io = io;
    this.init();
  }
  init() {
    const healthZone = new TriggerZone(
      5,
      2,
      5,
      { x: 20, y: -0.5, z: 20 },
      { x: 0, y: 0, z: 0, w: 1 },
      "#00ff00",
      { type: "heal", amount: 0.1 }
    );
    const damageZone = new TriggerZone(
      10,
      2,
      10,
      { x: 20, y: -0.5, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 },
      "#ff0000",
      { type: "damage", amount: 0.1 }
    );
    // const pickupZone = new TriggerZone(
    //   2,
    //   2,
    //   2,
    //   { x: 10, y: -0.5, z: 15 },
    //   { x: 0, y: 0, z: 0, w: 1 },
    //   "#FFA500",
    //   { type: "pickup", itemId: "gold", amount: 105 },
    //   () => this.removeZone(pickupZone)
    // );

    this.zones.push(healthZone, damageZone);

    setInterval(() => {
      let tz = new TriggerZone(
        2,
        2,
        2,
        { x: randomIntBetween(-20, 20), y: -0.5, z: randomIntBetween(-20, 20) },
        { x: 0, y: 0, z: 0, w: 1 },
        "#FFA500",
        { type: "pickup", itemId: "coins", amount: randomIntBetween(5, 25) },
        () => this.removeZone(tz)
      );

      this.zones.push(tz);
      this.io.emit("zoneCreated", tz);
    }, 5000);
  }
  update() {
    for (const [key, player] of this.players) {
      player.update();

      if (player.health <= 0) {
        player.setPosition({ x: 0, y: 0, z: 0 });
        player.health = 100;
        //this.removePlayer(player.id);
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
  removeZone(zone: Zone) {
    const uuid = zone.id;
    this.zones = this.zones.filter((zone) => zone.id !== uuid);
    this.io.emit("zoneRemoved", uuid);
  }
}

export default World;
