import { Server } from "socket.io";
import { speedFactor } from "./constants";
import TriggerZone from "./Entities/TriggerZone";

import Zone from "./interfaces/Zone";
import { Quaternion, randomHex, randomIntBetween } from "./mathUtils";
import Player from "./Player";
import Collider from "./interfaces/Collider";
import Box from "./Shapes/Box";
import PhysicsManager from "./PhysicsManager";
import Vector3 from "./Math/Vector3";
import Interactable from "./interfaces/Interactable";
import RAPIER from "@dimforge/rapier3d-compat";
import Pickup from "./Entities/Pickup";
import Vehicle from "./Vehicle/Vehicle";

const zoneSpawnLimit: number = 10;

class World {
  private io: Server;
  private players: Map<string, Player> = new Map();
  private zones: Zone[] = [];
  private colliders: Collider[] = [];
  private entities: any[] = [];
  private interactables: Interactable[] = [];
  private vehicles: Vehicle[] = [];

  constructor(io: Server) {
    this.io = io;
    this.init();
  }
  init() {
    const physics = PhysicsManager.getInstance();

    // ground
    physics.createFixedBox(
      new Vector3(0, -0.5, 0),
      new Vector3(5000, 0.1, 5000)
    );

    // car test

    const car = new Vehicle(new Vector3(25, 5, 0));
    this.vehicles.push(car);

    const car2 = new Vehicle(new Vector3(40, 5, 0));
    this.vehicles.push(car2);

    const box = new Box(
      5,
      5,
      5,
      new Vector3(0, 0, 0),
      new Quaternion(),
      "#0000ff"
    );

    const box2 = new Box(
      5,
      3,
      5,
      new Vector3(5, 0, 0),
      new Quaternion(),
      "#00ff00"
    );

    const box3 = new Box(
      5,
      1.25,
      5,
      new Vector3(10, 0, 0),
      new Quaternion(),
      "#ff00ff"
    );

    const box4 = new Box(
      5,
      0.5,
      5,
      new Vector3(30, 0.5, 20),
      new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 6),
      "#0000ff"
    );

    setInterval(() => {
      if (this.interactables.length >= 10) return;

      let pickup = new Pickup(
        new Vector3(randomIntBetween(0, 40), 0, randomIntBetween(0, 40)),
        new Quaternion(0, 0, 0, 1),
        "coin",
        randomIntBetween(5, 15),
        () => {
          this.removeInteractable(pickup);
        }
      );

      this.interactables.push(pickup);
      this.io.emit("interactableCreated", pickup);
    }, 5000);

    this.entities.push(box, box2, box3, box4);
    //this.interactables.push(interactable, interactable2, interactable3);

    //physics.createBoxCollider({ x: 5, y: 5, z: 5 }, { x: 5, y: 0, z: 5 });

    //this.colliders.push(wall, wall2, wall3, wall4, collider2, phyCollider);
    //this.zones.push(healthZone, damageZone);

    // setInterval(() => {
    //   if (this.zones.length >= zoneSpawnLimit) return;

    //   let tz = new TriggerZone(
    //     2,
    //     2,
    //     2,
    //     { x: randomIntBetween(-20, 20), y: -0.5, z: randomIntBetween(-20, 20) },
    //     { x: 0, y: 0, z: 0, w: 1 },
    //     "#FFA500",
    //     { type: "pickup", itemId: "coins", amount: randomIntBetween(5, 25) },
    //     () => this.removeZone(tz)
    //   );

    //   this.zones.push(tz);
    //   this.io.emit("zoneCreated", tz);
    // }, 20000);
  }
  update(delta: number) {
    for (const [key, player] of this.players) {
      player.update();

      if (player.health <= 0) {
        // player.setPosition(new Vector3(0, 0, 0));

        player.teleportTo(new Vector3(0, 10, 0));

        player.health = 100;
      }

      if (player.position.y <= -100) {
        player.teleportTo(new Vector3(0, 5, 0));
      }

      if (player.wantsToInteract) {
        this.scanInteractables(player);
      }

      // estimate pos

      //const playerHalfSize = { x: 0.5, y: 0.5, z: 0.5 };
      //let allowMove = true;

      // this.colliders.forEach((collider) => {
      //   let fakePosition = {
      //     x: player.position.x,
      //     y: player.position.y,
      //     z: player.position.z,
      //   };
      //   fakePosition.x += player.velocity.x * speedFactor;
      //   fakePosition.z += player.velocity.z * speedFactor;
      //   if (collider.contains(fakePosition, playerHalfSize)) allowMove = false;
      // });

      // if (allowMove) {
      //   //player.position.x += player.velocity.x * speedFactor;
      //   //player.position.z += player.velocity.z * speedFactor;
      // }

      //player.move(player.velocity);

      //const newPos = player.getTranslation();
      //if (newPos) player.setPosition({ x: newPos.x, y: newPos.y, z: newPos.z });

      // this.zones.forEach((zone) => {
      //   if (zone.contains(player)) {
      //     zone.trigger(player);
      //   }
      // });

      //       function checkPlayerInteractables(player: ClientPlayer) {
      //   let closestInteractable = null;
      //   let minDist = Infinity;

      //   type InteractableType = { id: string; mesh: THREE.Mesh };

      //   const interactables = world.interactables as InteractableType[];

      //   for (const interactable of interactables) {
      //     const dist = player.getPosition().distanceTo(interactable.mesh.position);
      //     if (dist < minDist) {
      //       minDist = dist;
      //       closestInteractable = interactable;
      //     }
      //   }

      //   // console.log(closestInteractable, minDist);

      //   if (minDist <= 1.5) {
      //     wantsToInteract = true;
      //   } else {
      //     wantsToInteract = false;
      //   }
      // }
    }

    this.vehicles.forEach((vehicle) => {
      vehicle.update(delta);
    });

    // this.entities.forEach((entity) => {
    //   entity.update();
    // });
  }
  scanInteractables(player: Player) {
    let closestInteractable = null;
    let minDist = Infinity;

    for (const interactable of this.interactables) {
      const fromVec = new Vector3(
        player.position.x,
        player.position.y,
        player.position.z
      );
      const toVec = new Vector3(
        interactable.position.x,
        interactable.position.y,
        interactable.position.z
      );

      const dist = fromVec.distanceTo(toVec);
      // const dist = player.position.distanceTo(interactable.position);
      if (dist < minDist) {
        minDist = dist;
        closestInteractable = interactable;
      }
    }

    //console.log(minDist, "Mindist");

    if (minDist <= 1.5) {
      console.log("USING", closestInteractable);
      closestInteractable?.use(player);
    }
  }
  getState() {
    return {
      players: this.players,
      // zones: this.zones,
      // colliders: this.colliders,
      entities: this.entities.map((entity) => ({
        id: entity.id,
        width: entity.width,
        height: entity.height,
        depth: entity.depth,
        color: entity.color,
        position: entity.position,
        quaternion: entity.quaternion,
      })),

      interactables: this.interactables.map((entity) => ({
        id: entity.id,
        position: entity.position,
        quaternion: entity.quaternion,
      })),

      // vehicles: this.vehicles.map((vehicle) => ({
      //   id: vehicle.id,
      //   position: vehicle.position,
      //   quaternion: vehicle.quaternion,
      //   wheels: vehicle.wheels.map((wheel) => ({
      //     radius: wheel.radius,
      //     position: wheel.position,
      //     quaternion: wheel.quaternion,
      //   })),
      // })),
      vehicles: this.vehicles,
    };
  }

  getPlayerFromCollider(col: RAPIER.Collider): Player | null {
    for (const [key, player] of this.players) {
      const { collider } = player.physicsObject;

      if (collider.handle == col.handle) {
        return player;
      }
    }

    return null;
  }

  addPlayer(networkId: string) {
    const newPlayer = new Player(
      networkId,
      new Vector3(0, 0, 0),
      new Quaternion(0, 0, 0, 1),
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
  removeInteractable(interactable: Interactable) {
    const uuid = interactable.id;
    this.interactables = this.interactables.filter(
      (interactable) => interactable.id !== uuid
    );
    this.io.emit("interactableRemoved", uuid);
  }
}

export default World;
