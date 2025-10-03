import { Server } from "socket.io";

import Zone from "./interfaces/Zone";
import {
  distanceToBezier,
  generateUUID,
  Quaternion,
  randomHex,
  randomIntBetween,
} from "./mathUtils";
import Player from "./Player";
import Collider from "./interfaces/Collider";
import Box from "./Shapes/Box";
import PhysicsManager from "./PhysicsManager";
import Vector3 from "./Math/Vector3";
import Interactable from "./interfaces/Interactable";
import RAPIER from "@dimforge/rapier3d-compat";
import Pickup from "./Entities/Pickup";
import Vehicle from "./Vehicle/Vehicle";

import { createNoise2D } from "simplex-noise";
import path from "path";
import { readdirSync, readFileSync } from "fs";
import Trimesh from "./Shapes/Trimesh";
import NPC from "./NPC";
import Lobby from "./Lobby";
import { ServerNotification } from "./server";
import { TerrainData, WorldSettings } from "./Types/worldTypes";
import TriggerZone from "./Entities/TriggerZone";
import Race from "./Minigames/Race";
import { start } from "repl";

const zoneSpawnLimit: number = 10;

type ObjectMapType = { vertices: any; indices: any };

class World {
  public id: string;
  private io: Server;
  private players: Map<string, Player> = new Map();
  private zones: Zone[] = [];
  private colliders: Collider[] = [];
  private entities: any[] = [];
  private interactables: Interactable[] = [];
  private vehicles: Vehicle[] = [];
  private terrains: TerrainData[] = [];
  private npcs: NPC[] = [];

  private objectMap: Map<string, ObjectMapType>;

  public lobby: Lobby;

  public worldSettings: WorldSettings;

  private spawnerIntervals: NodeJS.Timeout[] = [];

  private minigame: Race | null = null;

  constructor(lobby: Lobby, io: Server, worldSettings: WorldSettings) {
    this.worldSettings = worldSettings;

    this.lobby = lobby;
    this.id = generateUUID();

    this.objectMap = this.readObjects();
    this.io = io;
    this.init();
  }
  init() {
    this.worldSettings.gameObjects.forEach((object) => {
      switch (object.type) {
        case "trimesh":
          const o = new Trimesh(
            this.lobby,
            object.position,
            object.quaternion,
            this.objectMap.get(object.name)?.vertices,
            this.objectMap.get(object.name)?.indices,
            object.name
          );
          this.entities.push(o);
          break;

        case "box":
          PhysicsManager.createFixedBox(
            this.lobby.physicsWorld,
            object.position,
            object.scale
          );

          break;

        case "npc":
          const npc = new NPC(
            this.lobby,
            this,
            new Vector3(0, 5, 0),
            new Quaternion(),
            randomHex()
          );
          this.npcs.push(npc);
          break;

        case "car":
          const car = new Vehicle(this.lobby, object.position);
          this.vehicles.push(car);
          break;

        case "spawner":
          if (object.spawnerType == "coin") {
            const intervalId = setInterval(() => {
              if (this.interactables.length >= object.maxNumSpawn) return;

              let pickup = new Pickup(
                new Vector3(
                  randomIntBetween(0, 40),
                  0,
                  randomIntBetween(0, 40)
                ),
                new Quaternion(0, 0, 0, 1),
                "coin",
                randomIntBetween(5, 15),
                () => this.removeInteractable(pickup)
              );

              this.interactables.push(pickup);
              this.io.to(this.lobby.id).emit("interactableCreated", pickup);
            }, object.delay);

            this.spawnerIntervals.push(intervalId); // ✅ store it
          }

          if (object.spawnerType == "npc") {
            const intervalId = setInterval(() => {
              if (this.npcs.length >= object.maxNumSpawn) return;

              this.addNPC(
                new Vector3(
                  randomIntBetween(-50, 50),
                  5,
                  randomIntBetween(-50, 50)
                )
              );
            }, object.delay);

            this.spawnerIntervals.push(intervalId); // ✅ store it
          }
          break;
      }
    });

    if (this.worldSettings.minigame) {
      if (this.worldSettings.minigame.type == "race") {
        this.minigame = new Race(this);
        this.minigame.start();
      }
    }

    // const physics = PhysicsManager.getInstance();

    // PhysicsManager.createFixedBox(
    //   this.lobby.physicsWorld,
    //   new Vector3(0, -0.5, 0),
    //   new Vector3(500, 0.1, 500)
    // );

    // const ground = new Box(
    //   500,
    //   0.1,
    //   500,
    //   new Vector3(0, -0.5, 0),
    //   new Quaternion(),
    //   "#ff0000"
    // );
    // this.entities.push(ground);
    // car test

    // const npc = new NPC(
    //   this.lobby,
    //   this,
    //   new Vector3(0, 5, 0),
    //   new Quaternion(),
    //   randomHex()
    // );

    // this.npcs.push(npc);

    // const ramp = new Trimesh(
    //   this.lobby,

    //   new Vector3(40, -0.5, 10),
    //   new Quaternion(),
    //   this.objectMap.get("ramp")?.vertices,
    //   this.objectMap.get("ramp")?.indices,
    //   "ramp"
    // );

    // const ramp2 = new Trimesh(
    //   this.lobby,

    //   new Vector3(80, -0.5, 10),
    //   new Quaternion(),
    //   this.objectMap.get("ramp")?.vertices,
    //   this.objectMap.get("ramp")?.indices,
    //   "ramp"
    // );

    // const ramp3 = new Trimesh(
    //   this.lobby,

    //   new Vector3(40, -0.5, 80),
    //   new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
    //   this.objectMap.get("ramp")?.vertices,
    //   this.objectMap.get("ramp")?.indices,
    //   "ramp"
    // );

    // const ramp4 = new Trimesh(
    //   this.lobby,
    //   new Vector3(80, -0.5, 80),
    //   new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
    //   this.objectMap.get("ramp")?.vertices,
    //   this.objectMap.get("ramp")?.indices,
    //   "ramp"
    // );

    // this.entities.push(ramp, ramp2, ramp3, ramp4);

    // const car = new Vehicle(this.lobby, new Vector3(-20, 10, 10));
    // this.vehicles.push(car);

    // const car2 = new Vehicle(this.lobby, new Vector3(-20, 5, 20));
    // this.vehicles.push(car2);

    //this.createTerrain();

    // setInterval(() => {
    //   if (this.interactables.length >= 10) return;

    //   let pickup = new Pickup(
    //     new Vector3(randomIntBetween(0, 40), 0, randomIntBetween(0, 40)),
    //     new Quaternion(0, 0, 0, 1),
    //     "coin",
    //     randomIntBetween(5, 15),
    //     () => {
    //       this.removeInteractable(pickup);
    //     }
    //   );

    //   this.interactables.push(pickup);
    //   this.io.emit("interactableCreated", pickup);
    // }, 5000);

    // setInterval(() => {
    //   if (this.npcs.length > 0) return;

    //   this.addNPC(
    //     new Vector3(randomIntBetween(-50, 50), 5, randomIntBetween(-50, 50))
    //   );
    // }, 1000);

    // this.entities.push(box, box2, box3, box4);
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

  // restartMinigame() {
  //   if (this.minigame) this.minigame.restart();
  //   // this.minigame = new Race(this);

  //   // this.players.forEach((player) => {
  //   //   this.minigame?.addPlayer(player);
  //   // });

  //   // this.minigame.start();
  // }

  shotFired(position: Vector3) {
    this.io.to(this.lobby.id).emit("shot-fired", {
      position: position,
    });
  }

  registerHit(
    position: Vector3,
    hitPlayer: string | null = null,
    hitBodyPart: string | null = null
  ) {
    this.io.to(this.lobby.id).emit("register-hit", {
      position: position,
      hitPlayer: hitPlayer,
      hitBodyPart: hitBodyPart,
    });
  }
  getIO(): Server {
    return this.io;
  }
  createServerNotification(notification: ServerNotification) {
    this.io.to(this.lobby.id).emit("server-notification", notification);
  }
  createHitmarker(position: Vector3) {
    this.io.to(this.lobby.id).emit("create-hitmarker", { position: position });
  }
  readObjects() {
    const dirPath = path.join(process.cwd(), "src/Objects");
    const fileMap = new Map();

    try {
      const files = readdirSync(dirPath).filter((f) => f.endsWith(".json"));

      files.forEach((file) => {
        const filePath = path.join(dirPath, file);

        try {
          const data = readFileSync(filePath, "utf-8");
          const json = JSON.parse(data);

          const key = path.basename(file, ".json");

          const object = {
            vertices: new Float32Array(Object.values(json.vertices)),
            indices: new Uint16Array(Object.values(json.indices)),
          };

          fileMap.set(key, object);
        } catch (err: any) {
          console.error(`❌ Failed to read/parse ${file}:`, err.message);
        }
      });
    } catch (err: any) {
      console.error("❌ Error reading directory:", err.message);
    }

    console.log("✅ Loaded objects:", Array.from(fileMap.keys()));
    return fileMap;
  }
  createTerrain() {
    const nrows = 200;
    const ncols = 200;
    const heights = new Float32Array(nrows * ncols);

    const position = new Vector3();
    const quaternion = new Quaternion();

    const scaleFactor = 3;
    const heightScaleFactor = 1.5;

    const roadWidth = 6;
    const roadFlattenHeight = -1.5;

    const circleA = { centerX: 0, centerZ: 0, radius: 10 };
    const circleB = { centerX: 200, centerZ: 200, radius: 10 };

    const noise2D = createNoise2D();

    // Define Bezier control points for the road
    const roadP0 = new Vector3(circleA.centerX, 0, circleA.centerZ);
    const roadP1 = new Vector3(circleA.centerX + 100, 0, circleA.centerZ);
    const roadP2 = new Vector3(circleB.centerX, 0, circleB.centerZ + 100);
    const roadP3 = new Vector3(circleB.centerX, 0, circleB.centerZ);

    for (let x = 0; x < nrows; x++) {
      for (let z = 0; z < ncols; z++) {
        const index = x * ncols + z;

        let noise = noise2D(x, z);
        let sinZ = Math.sin(z) * 0.1 + noise * 0.05;
        let sinX = Math.sin(x) * 0.1 + noise * 0.05;
        let currentHeight = sinX + sinZ;

        // Flatten circles
        const dxA = circleA.centerX - x;
        const dzA = circleA.centerZ - z;
        const distanceFromCircleA = Math.sqrt(dxA * dxA + dzA * dzA);

        const dxB = circleB.centerX - x;
        const dzB = circleB.centerZ - z;
        const distanceFromCircleB = Math.sqrt(dxB * dxB + dzB * dzB);

        if (
          distanceFromCircleA <= circleA.radius ||
          distanceFromCircleB <= circleB.radius
        ) {
          currentHeight = roadFlattenHeight;
        } else {
          // Flatten along Bezier road
          const point = new Vector3(x, 0, z);
          const distToRoad = distanceToBezier(
            point,
            roadP0,
            roadP1,
            roadP2,
            roadP3
          );
          if (distToRoad <= roadWidth / 2) {
            currentHeight = roadFlattenHeight;
          }
        }

        heights[index] = currentHeight;
      }
    }

    const scale = new Vector3(
      nrows * scaleFactor,
      2 * heightScaleFactor,
      ncols * scaleFactor
    );

    const terrainData: TerrainData = {
      position,
      quaternion,
      heights,
      nrows,
      ncols,
      scale,
    };

    this.terrains.push(terrainData);

    PhysicsManager.createHeightfield(
      this.lobby.physicsWorld,
      position,
      quaternion,
      heights,
      scale,
      nrows - 1,
      ncols - 1
    );
  }

  fixedUpdate(delta: number) {
    for (const [key, player] of this.players) {
      player.update(delta);

      if (player.health <= 0) {
        if (!player.isDead) {
          player.die();
          this.io.to(this.lobby.id).emit("player-death", player.id);
        }
      }

      // if (player.health <= 0) {
      //   // player.setPosition(new Vector3(0, 0, 0));

      //   player.teleportTo(new Vector3(0, 10, 0));

      //   player.health = 100;
      // }

      if (player.position.y <= -100) {
        player.teleportTo(new Vector3(0, 5, 0));
      }

      if (player.wantsToInteract) {
        this.scanInteractables(player);
      }
    }

    this.vehicles.forEach((vehicle) => {
      vehicle.update(delta);
    });
  }
  update(delta: number) {
    this.npcs.forEach((npc) => {
      npc.update(delta);
    });

    if (this.minigame) {
      this.minigame.update();
    }

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
        type: entity.type,
        modelName: entity.modelName,
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
      terrains: this.terrains,
      npcs: this.npcs,
      zones: this.zones,
    };
  }

  getPlayerFromCollider(col: RAPIER.Collider): Player | NPC | null {
    if (!col) return null;

    for (const [key, player] of this.players) {
      const { collider } = player.physicsObject;

      if (!collider) return null;

      if (collider.handle == col.handle) {
        return player;
      }
    }

    const npc = this.npcs.find(
      (npc) => npc.physicsObject.collider.handle == col.handle
    );

    if (npc) return npc;

    return null;
  }

  getPlayerById(id: string): Player | null {
    return this.players.get(id) ?? null;
  }

  addVehicle(position: Vector3, player?: Player): Vehicle {
    const car = new Vehicle(this.lobby, position);
    this.vehicles.push(car);

    const data = {
      id: car.id,
      position: car.position,
      quaternion: car.quaternion,
      wheels: car.wheels.map((wheel) => ({
        radius: wheel.radius,
        position: wheel.position,
        quaternion: wheel.quaternion,
        worldPosition: wheel.worldPosition,
      })),
      seats: car.seats.map((seat) => ({
        position: seat.position,
        type: seat.type,
        seater: seat.seater ? seat.seater.id : null,
      })),
    };

    this.io.to(this.lobby.id).emit("addVehicle", data);

    player?.enterVehicle(car);

    return car;
  }

  addNPC(position: Vector3) {
    console.log("ADDING NPC", position);
    const npc = new NPC(
      this.lobby,
      this,
      position,
      new Quaternion(),
      randomHex()
    );

    this.npcs.push(npc);

    const data = {
      velocity: npc.velocity,
      health: npc.health,
      coins: npc.coins,
      id: npc.id,
      position: npc.position,
      quaternion: npc.quaternion,
      color: npc.color,
      keys: npc.actions,
      isSitting: npc.isSitting,
    };

    this.io.to(this.lobby.id).emit("addNPC", data);
  }

  removeVehicle(vehicle: Vehicle) {
    const uuid = vehicle.id;

    PhysicsManager.remove(this.lobby.physicsWorld, vehicle.physicsObject);

    this.vehicles = this.vehicles.filter((vehicle) => vehicle.id !== uuid);

    console.log("removnig vehicle");

    this.io.to(this.lobby.id).emit("vehicleRemoved", uuid);
  }

  removeNPC(npc: NPC, delay: number = 0) {
    const uuid = npc.id;

    setTimeout(() => {
      PhysicsManager.remove(this.lobby.physicsWorld, npc.physicsObject);
      this.npcs = this.npcs.filter((n) => n.id !== uuid);
      this.io.to(this.lobby.id).emit("npcRemoved", uuid);
    }, delay);

    // setTimeout(() => {
    //   const pos = new Vector3(
    //     randomIntBetween(-50, 50),
    //     5,
    //     randomIntBetween(-50, 50)
    //   );
    //   this.addNPC(pos);
    // }, 1000);
  }

  addPlayer(networkId: string) {
    const newPlayer = new Player(
      this.lobby,
      networkId,
      new Vector3(0, 0, 0),
      new Quaternion(0, 0, 0, 1),
      randomHex(),
      this.worldSettings.playerSettings
    );

    this.players.set(networkId, newPlayer);

    if (this.worldSettings.playerSettings.controlledObject) {
      this.addVehicle(new Vector3(0, 5, 0), newPlayer);
    }

    if (this.minigame) {
      this.minigame.addPlayer(newPlayer);
    }

    // if (this.minigame) {
    //   this.minigame.addPlayer(newPlayer);

    //   const startPosition = this.minigame.getStartPosition();
    //   // newPlayer.teleportTo(startPosition);
    //   newPlayer.controlledObject?.teleportTo(startPosition);
    // }
  }
  removePlayer(networkId: string) {
    const player = this.players.get(networkId);

    console.log("REMVOING PLAYER", player);

    if (!player) return;

    if (this.minigame) this.minigame.removePlayer(player);

    if (player.controlledObject) {
      player.exitVehicle();
    }

    PhysicsManager.remove(this.lobby.physicsWorld, player.physicsObject);

    this.players.delete(networkId);
  }

  addZone(z: Zone) {
    this.zones.push(z);
    this.io.to(this.lobby.id).emit("zoneCreated", z);
  }
  removeZone(zone: Zone) {
    const uuid = zone.id;
    this.zones = this.zones.filter((zone) => zone.id !== uuid);
    this.io.to(this.lobby.id).emit("zoneRemoved", uuid);
  }
  removeInteractable(interactable: Interactable) {
    const uuid = interactable.id;

    let payload = {
      id: uuid,
      meta: {
        type: "",
        item: "",
        amount: 0,
        usedBy: "",
      },
    };

    if (interactable instanceof Pickup) {
      payload.meta.type = "pickup";
      payload.meta.item = interactable.item;
      payload.meta.amount = interactable.amount;
      payload.meta.usedBy = interactable.usedBy ? interactable.usedBy.id : "";
    }

    this.interactables = this.interactables.filter(
      (interactable) => interactable.id !== uuid
    );

    this.io.to(this.lobby.id).emit("interactableRemoved", payload);
  }

  public cleanup(): void {
    this.spawnerIntervals.forEach((intervalId) => clearInterval(intervalId));
    this.spawnerIntervals = [];
  }
}

export default World;
