import { Server } from "socket.io";

import Zone from "./interfaces/Zone";
import {
  distanceToBezier,
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
import { readdir, readdirSync, readFileSync } from "fs";
import Trimesh from "./Shapes/Trimesh";
import NPC from "./NPC";

const zoneSpawnLimit: number = 10;

export type TerrainData = {
  position: Vector3;
  quaternion: Quaternion;
  heights: Float32Array;
  nrows: number;
  ncols: number;
  scale: Vector3;
};

type ObjectMapType = { vertices: any; indices: any };

class World {
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

  constructor(io: Server) {
    this.objectMap = this.readObjects();
    this.io = io;
    this.init();
  }
  init() {
    const physics = PhysicsManager.getInstance();

    physics.createFixedBox(new Vector3(0, -0.5, 0), new Vector3(500, 0.1, 500));

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

    const npc = new NPC(
      this,
      new Vector3(0, 5, 0),
      new Quaternion(),
      randomHex()
    );

    this.npcs.push(npc);

    const ramp = new Trimesh(
      new Vector3(40, -0.5, 10),
      new Quaternion(),
      this.objectMap.get("ramp")?.vertices,
      this.objectMap.get("ramp")?.indices,
      "ramp"
    );

    const ramp2 = new Trimesh(
      new Vector3(80, -0.5, 10),
      new Quaternion(),
      this.objectMap.get("ramp")?.vertices,
      this.objectMap.get("ramp")?.indices,
      "ramp"
    );

    const ramp3 = new Trimesh(
      new Vector3(40, -0.5, 80),
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
      this.objectMap.get("ramp")?.vertices,
      this.objectMap.get("ramp")?.indices,
      "ramp"
    );

    const ramp4 = new Trimesh(
      new Vector3(80, -0.5, 80),
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
      this.objectMap.get("ramp")?.vertices,
      this.objectMap.get("ramp")?.indices,
      "ramp"
    );

    this.entities.push(ramp, ramp2, ramp3, ramp4);

    const car = new Vehicle(this, new Vector3(-20, 10, 10));
    this.vehicles.push(car);

    const car2 = new Vehicle(this, new Vector3(-20, 5, 20));
    this.vehicles.push(car2);

    // const brige = new Box(
    //   6,
    //   0.75,
    //   33,
    //   new Vector3(62, 0, 28),
    //   new Quaternion().setFromEuler(0, Math.PI / 2, 0),
    //   "#383838"
    // );
    // this.entities.push(brige);
    // const bridge = new THREE.Mesh(
    //   new THREE.BoxGeometry(6, 0.5, 30),
    //   new THREE.MeshStandardMaterial({ color: 0x383838 })
    // );
    // bridge.position.set(60, 0, 28);
    // bridge.rotation.y = Math.PI / 2;

    // this.scene.add(bridge);

    // const box = new Box(
    //   5,
    //   5,
    //   5,
    //   new Vector3(0, 0, 0),
    //   new Quaternion(),
    //   "#0000ff"
    // );

    // const box2 = new Box(
    //   5,
    //   3,
    //   5,
    //   new Vector3(5, 0, 0),
    //   new Quaternion(),
    //   "#00ff00"
    // );

    // const box3 = new Box(
    //   5,
    //   1.25,
    //   5,
    //   new Vector3(10, 0, 0),
    //   new Quaternion(),
    //   "#ff00ff"
    // );

    // const box4 = new Box(
    //   5,
    //   0.5,
    //   5,
    //   new Vector3(30, 0.5, 20),
    //   new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 6),
    //   "#0000ff"
    // );

    //this.createTerrain();

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

  registerHit(position: Vector3, hitPlayer: string | null = null) {
    this.io.emit("register-hit", {
      position: position,
      hitPlayer: hitPlayer,
    });
  }
  createHitmarker(position: Vector3) {
    this.io.emit("create-hitmarker", { position: position });
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

    PhysicsManager.getInstance().createHeightfield(
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
    }
    this.vehicles.forEach((vehicle) => {
      vehicle.update(delta);
    });
  }
  update(delta: number) {
    this.npcs.forEach((npc) => {
      npc.update(delta);
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
    };
  }

  getPlayerFromCollider(col: RAPIER.Collider): Player | NPC | null {
    for (const [key, player] of this.players) {
      const { collider } = player.physicsObject;

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

  addVehicle(position: Vector3, player?: Player) {
    const car = new Vehicle(this, position);
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

    this.io.emit("addVehicle", data);

    player?.enterVehicle(car);
  }

  removeVehicle(vehicle: Vehicle) {
    const uuid = vehicle.id;
    this.vehicles = this.vehicles.filter((vehicle) => vehicle.id !== uuid);
    this.io.emit("vehicleRemoved", uuid);
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
    const player = this.players.get(networkId);

    console.log("REMVOING PLAYER", player);

    if (!player) return;

    if (player.controlledObject) {
      player.exitVehicle();
    }

    PhysicsManager.getInstance().remove(player.physicsObject);

    this.players.delete(networkId);
  }
  removeZone(zone: Zone) {
    const uuid = zone.id;
    this.zones = this.zones.filter((zone) => zone.id !== uuid);
    this.io.emit("zoneRemoved", uuid);
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

    this.io.emit("interactableRemoved", payload);
  }
}

export default World;
