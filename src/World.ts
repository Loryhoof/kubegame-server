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
import { ServerNotification } from ".";

const zoneSpawnLimit: number = 10;

export type TerrainData = {
  position: Vector3;
  quaternion: Quaternion;
  heights: Float32Array;
  nrows: number;
  ncols: number;
  scale: Vector3;

  roadMask: Float32Array;
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

    // physics.createFixedBox(new Vector3(0, -0.5, 0), new Vector3(500, 0.1, 500));

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
    //   this,
    //   new Vector3(0, 5, 0),
    //   new Quaternion(),
    //   randomHex()
    // );

    // this.npcs.push(npc);

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

    this.createTerrain();

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

    setInterval(() => {
      if (this.npcs.length > 0) return;

      this.addNPC(
        new Vector3(randomIntBetween(-50, 50), 5, randomIntBetween(-50, 50))
      );
    }, 1000);

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

  registerHit(
    position: Vector3,
    hitPlayer: string | null = null,
    hitBodyPart: string | null = null
  ) {
    this.io.emit("register-hit", {
      position: position,
      hitPlayer: hitPlayer,
      hitBodyPart: hitBodyPart,
    });
  }
  createServerNotification(notification: ServerNotification) {
    this.io.emit("server-notification", notification);
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
    const nrows = 1000;
    const ncols = 1000;

    const heights = new Float32Array(nrows * ncols);
    const roadMask = new Float32Array(nrows * ncols); // legacy typing / debug

    const position = new Vector3();
    const quaternion = new Quaternion();

    const scaleFactor = 1;
    const heightScaleFactor = 1.5;

    // ---- Road params (grid units) ----
    const roadWidth = 18; // full flat platform
    const asphaltWidth = 14; // inner black ribbon
    const roadHalf = roadWidth * 0.5;
    const asphaltHalf = asphaltWidth * 0.5;

    const roadHeight = 0.0; // flat Y in grid coords
    const roadFalloff = 6.0; // blend back to terrain

    // ---- Base terrain ----
    const noise2D = createNoise2D();
    const noiseScale = 0.015;

    // ------------------------------------------------------------
    // 1) Generate a closed loop that *alternates* left/right turns
    //    (warped ring via harmonics -> S-bends, then CR->Bezier)
    // ------------------------------------------------------------
    type V2 = { x: number; z: number };
    const v2 = (x: number, z: number): V2 => ({ x, z });
    const add = (a: V2, b: V2) => v2(a.x + b.x, a.z + b.z);
    const sub = (a: V2, b: V2) => v2(a.x - b.x, a.z - b.z);
    const mul = (a: V2, s: number) => v2(a.x * s, a.z * s);
    const len = (a: V2) => Math.hypot(a.x, a.z);
    const clamp = (x: number, a: number, b: number) =>
      Math.max(a, Math.min(b, x));

    // Center & base radius
    const cx = nrows * 0.5;
    const cz = ncols * 0.5;
    const R = Math.min(nrows, ncols) * 0.33; // ~330

    // Harmonically warped ring -> produces natural S-bends
    const PTS = 64; // polyline resolution
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) | 0;
      return (seed >>> 0) / 0xffffffff;
    };
    const phase1 = rand() * Math.PI * 2;
    const phase2 = rand() * Math.PI * 2;

    // Keep harmonics modest to avoid self-intersections, but enough to flip curvature sign
    const r1 = R * 0.18; // 2nd harmonic
    const r2 = R * 0.1; // 3rd harmonic
    const sx = 1.0; // slight ellipse if desired (1.0 = circle)
    const sz = 1.0;

    const poly: V2[] = [];
    for (let i = 0; i < PTS; i++) {
      const t = (i / PTS) * Math.PI * 2.0;
      // Base circle
      let x = Math.cos(t) * R;
      let z = Math.sin(t) * R;

      // 2nd harmonic (phase offsets differ on x/z to force S waves)
      x += Math.cos(2.0 * t + phase1) * r1;
      z += Math.sin(2.0 * t + phase1 + Math.PI / 3) * r1;

      // 3rd harmonic with different phase -> more variety, more inflections
      x += Math.cos(3.0 * t + phase2) * r2;
      z += -Math.sin(3.0 * t + phase2 + Math.PI / 5) * r2;

      poly.push(v2(cx + x * sx, cz + z * sz));
    }

    // Catmull–Rom (closed) → cubic Bézier with clamped handles (limit tightness)
    const HANDLE_SCALE = 1.0 / 6.0; // CR→Bezier base factor
    const HANDLE_CLAMP = 0.32; // max handle = 0.32 * local segment length (curvature cap)

    const curves: Array<[V2, V2, V2, V2]> = [];
    for (let i = 0; i < PTS; i++) {
      const P0 = poly[(i - 1 + PTS) % PTS];
      const P1 = poly[i];
      const P2 = poly[(i + 1) % PTS];
      const P3 = poly[(i + 2) % PTS];

      // Raw CR→Bezier
      let H1 = mul(sub(P2, P0), HANDLE_SCALE);
      let H2 = mul(sub(P3, P1), HANDLE_SCALE);

      // Clamp handle lengths relative to adjacent spans (avoid hairpins)
      const L1 = len(sub(P2, P1));
      const L0 = len(sub(P1, P0));
      const L2 = len(sub(P3, P2));

      const h1Max = HANDLE_CLAMP * Math.min(L0, L1);
      const h2Max = HANDLE_CLAMP * Math.min(L1, L2);

      const h1Len = len(H1);
      const h2Len = len(H2);

      if (h1Len > 1e-6) H1 = mul(H1, clamp(h1Max / h1Len, 0.0, 1.0));
      if (h2Len > 1e-6) H2 = mul(H2, clamp(h2Max / h2Len, 0.0, 1.0));

      const B0 = P1;
      const B1 = add(P1, H1);
      const B2 = sub(P2, H2);
      const B3 = P2;

      curves.push([B0, B1, B2, B3]);
    }

    // Export for client ribbon (Float32Array of p0..p3 per segment in GRID x,z)
    const roadCurves: Float32Array = (() => {
      const out: number[] = [];
      for (const [b0, b1, b2, b3] of curves) {
        out.push(b0.x, b0.z, b1.x, b1.z, b2.x, b2.z, b3.x, b3.z);
      }
      return new Float32Array(out);
    })();

    // ------------------------------------------------------------
    // 2) Base terrain first
    // ------------------------------------------------------------
    for (let x = 0; x < nrows; x++) {
      for (let z = 0; z < ncols; z++) {
        const idx = x * ncols + z;

        const n = noise2D(x * noiseScale, z * noiseScale);
        const base =
          Math.sin(z * 0.05) * 0.3 +
          n * 0.5 +
          Math.sin(x * 0.05) * 0.3 +
          n * 0.5;

        heights[idx] = base;
        roadMask[idx] = 0;
      }
    }

    // ------------------------------------------------------------
    // 3) Flatten road by stamping along the curve (fast)
    // ------------------------------------------------------------
    const bezPoint = (b0: V2, b1: V2, b2: V2, b3: V2, t: number): V2 => {
      const u = 1 - t;
      const uu = u * u,
        tt = t * t;
      const uuu = uu * u,
        ttt = tt * t;
      const px =
        b0.x * uuu + 3 * b1.x * uu * t + 3 * b2.x * u * tt + b3.x * ttt;
      const pz =
        b0.z * uuu + 3 * b1.z * uu * t + 3 * b2.z * u * tt + b3.z * ttt;
      return v2(px, pz);
    };

    const stamp = (cxg: number, czg: number) => {
      const R = roadHalf + roadFalloff + 1;
      const x0 = Math.max(0, Math.floor(cxg - R));
      const x1 = Math.min(nrows - 1, Math.ceil(cxg + R));
      const z0 = Math.max(0, Math.floor(czg - R));
      const z1 = Math.min(ncols - 1, Math.ceil(czg + R));

      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const dx = x + 0.5 - cxg;
          const dz = z + 0.5 - czg;
          const d = Math.hypot(dx, dz);
          const idx = x * ncols + z;

          if (d <= roadHalf) {
            heights[idx] = roadHeight;
            roadMask[idx] = 1;
          } else if (d <= roadHalf + roadFalloff) {
            const t = (d - roadHalf) / roadFalloff;
            const s = t * t * (3 - 2 * t); // smoothstep
            const base = heights[idx];
            heights[idx] = roadHeight * (1 - s) + base * s;
          }
        }
      }
    };

    // sample density along each cubic; balanced for perf and quality
    const samplesPerSegment = 140;
    for (const [b0, b1, b2, b3] of curves) {
      for (let i = 0; i <= samplesPerSegment; i++) {
        const t = i / samplesPerSegment;
        const p = bezPoint(b0, b1, b2, b3, t);
        stamp(p.x, p.z);
      }
    }

    // ------------------------------------------------------------
    // 4) Package terrain + physics
    // ------------------------------------------------------------
    const scale = new Vector3(
      nrows * scaleFactor,
      2 * heightScaleFactor,
      ncols * scaleFactor
    );

    const terrainData: any = {
      position,
      quaternion,
      heights,
      roadMask, // compat
      nrows,
      ncols,
      scale,

      // client ribbon inputs:
      roadCurves,
      asphaltHalf,
      roadHeight,
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
        if (!player.isDead) {
          player.die();
          this.io.emit("player-death", player.id);
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

  addNPC(position: Vector3) {
    const npc = new NPC(this, position, new Quaternion(), randomHex());

    this.npcs.push(npc);

    const data = {
      velocity: npc.velocity,
      health: npc.health,
      coins: npc.coins,
      id: npc.id,
      position: npc.position,
      quaternion: npc.quaternion,
      color: npc.color,
      keys: npc.keys,
      isSitting: npc.isSitting,
    };

    this.io.emit("addNPC", data);
  }

  removeVehicle(vehicle: Vehicle) {
    const uuid = vehicle.id;

    PhysicsManager.getInstance().remove(vehicle.physicsObject);

    this.vehicles = this.vehicles.filter((vehicle) => vehicle.id !== uuid);

    this.io.emit("vehicleRemoved", uuid);
  }

  removeNPC(npc: NPC, delay: number = 0) {
    const uuid = npc.id;

    setTimeout(() => {
      PhysicsManager.getInstance().remove(npc.physicsObject);
      this.npcs = this.npcs.filter((n) => n.id !== uuid);
      this.io.emit("npcRemoved", uuid);
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
