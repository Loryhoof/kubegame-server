import { Server } from "socket.io";
import { speedFactor } from "./constants";
import TriggerZone from "./Entities/TriggerZone";

import Zone from "./interfaces/Zone";
import { randomHex, randomIntBetween } from "./mathUtils";
import Player from "./Player";
import Collider from "./interfaces/Collider";
import BoxCollider from "./Colliders/BoxCollider";

const zoneSpawnLimit: number = 10;

class World {
  private io: Server;
  private players: Map<string, Player> = new Map();
  private zones: Zone[] = [];
  private colliders: Collider[] = [];

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

    const wall = new BoxCollider(
      1,
      2,
      100,
      { x: 50, y: -0.5, z: -60 },
      { x: 0, y: 0, z: 0, w: 1 },
      "#ffffff"
    );

    const wall2 = new BoxCollider(
      100,
      2,
      1,
      { x: -50, y: -0.5, z: 40 },
      { x: 0, y: 0, z: 0, w: 1 },
      "#ffffff"
    );

    const wall3 = new BoxCollider(
      1,
      2,
      100,
      { x: -50, y: -0.5, z: -60 },
      { x: 0, y: 0, z: 0, w: 1 },
      "#ffffff"
    );

    const wall4 = new BoxCollider(
      100,
      2,
      1,
      { x: -50, y: -0.5, z: -60 },
      { x: 0, y: 0, z: 0, w: 1 },
      "#ffffff"
    );

    const collider2 = new BoxCollider(
      5,
      2,
      5,
      { x: -10, y: -0.5, z: 25 },
      { x: 0, y: 0, z: 0, w: 1 },
      "#ffffff"
    );

    this.colliders.push(wall, wall2, wall3, wall4, collider2);
    this.zones.push(healthZone, damageZone);

    setInterval(() => {
      if (this.zones.length >= zoneSpawnLimit) return;

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
    }, 20000);
  }
  update() {
    for (const [key, player] of this.players) {
      player.update();

      if (player.health <= 0) {
        player.setPosition({ x: 0, y: 0, z: 0 });
        player.health = 100;
      }

      // estimate pos

      const playerHalfSize = { x: 0.5, y: 0.5, z: 0.5 };
      let allowMove = true;

      this.colliders.forEach((collider) => {
        let fakePosition = {
          x: player.position.x,
          y: player.position.y,
          z: player.position.z,
        };
        fakePosition.x += player.velocity.x * speedFactor;
        fakePosition.z += player.velocity.z * speedFactor;
        if (collider.contains(fakePosition, playerHalfSize)) allowMove = false;
      });

      if (allowMove) {
        player.position.x += player.velocity.x * speedFactor;
        player.position.z += player.velocity.z * speedFactor;
      }

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
      colliders: this.colliders,
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
