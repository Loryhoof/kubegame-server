import express from "express";
import { Server } from "socket.io";
import http from "http";
import https from "https";
import {
  applyQuaternion,
  extractYaw,
  Quaternion,
  randomIntBetween,
  Vector3,
} from "./mathUtils";
import World from "./World";
import { CAR_COIN_AMOUNT, serverHz } from "./constants";
import PhysicsManager from "./PhysicsManager";
import { readFileSync } from "fs";
import { config } from "dotenv";
import NPC from "./NPC";
import Player, { Hand } from "./Player";
import Weapon from "./Holdable/Weapon";

// ============================
// Types
// ============================

type ChatMessage = { id: string; nickname: string; text: string };

type PlayerData = {
  velocity: Vector3;
  health: number;
  coins: number;
  ammo: number;
  id: string;
  position: Vector3;
  quaternion: Quaternion;
  color: string;
  keys: any;
  isSitting: boolean;
  controlledObject: { id: string } | null;
  lastProcessedInputSeq: number;
  nickname: string;
  leftHand: Hand;
  rightHand: Hand;
  viewQuaternion: Quaternion;
  isDead: boolean;
  killCount: number;
};

export type ServerNotification = {
  recipient: string;
  type: "error" | "success" | "info" | "achievement";
  content: string;
};

type PlayerInput = {
  keys: {
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
    shift: boolean;
    e: boolean;
    k: boolean;
    r: boolean;
    h: boolean;
    " ": boolean;
    mouseLeft: boolean;
    mouseRight: boolean;
  };
  seq: number;
  dt: number;
  camQuat: [number, number, number, number];
  camPos: Vector3;
};

// ============================
// Setup & Globals
// ============================

config();

const app = express();
const PORT = process.env.PORT || 3000;

const server =
  process.env.ENVIRONMENT === "PROD"
    ? https.createServer(
        {
          key: readFileSync(
            "/etc/letsencrypt/live/server-eu.kubegame.com/privkey.pem"
          ),
          cert: readFileSync(
            "/etc/letsencrypt/live/server-eu.kubegame.com/fullchain.pem"
          ),
        } as any,
        app
      )
    : http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

const physicsManager = PhysicsManager.getInstance();
const readyPlayers = new Set<string>(); // players that called readyForWorld
const serverChatMessages: ChatMessage[] = [];

let lastTime = Date.now();

// ============================
// Serialization Helpers
// ============================

function serializePlayer(p: Player): PlayerData {
  return {
    velocity: p.velocity,
    health: p.health,
    coins: p.coins,
    ammo: p.ammo,
    id: p.id,
    position: p.position,
    quaternion: p.quaternion,
    color: p.color,
    keys: p.keys,
    isSitting: p.isSitting,
    controlledObject: p.controlledObject ? { id: p.controlledObject.id } : null,
    lastProcessedInputSeq: p.lastProcessedInputSeq,
    nickname: p.nickname ?? "",
    leftHand: p.leftHand,
    rightHand: p.rightHand,
    viewQuaternion: p.viewQuaternion ?? new Quaternion(),
    isDead: p.isDead,
    killCount: p.killCount,
  };
}

function serializeVehicle(vehicle: any) {
  return {
    id: vehicle.id,
    position: vehicle.position,
    quaternion: vehicle.quaternion,
    hornPlaying: vehicle.hornPlaying,
    wheels: vehicle.wheels.map((wheel: any) => ({
      radius: wheel.radius,
      position: wheel.position,
      quaternion: wheel.quaternion,
      worldPosition: wheel.worldPosition,
    })),
    linearVelocity: vehicle.physicsObject.rigidBody.linvel(),
    angularVelocity: vehicle.physicsObject.rigidBody.angvel(),
    seats: vehicle.seats.map((seat: any) => ({
      position: seat.position,
      type: seat.type,
      seater: seat.seater ? seat.seater.id : null,
    })),
    lastProcessedInputSeq: vehicle.lastProcessedInputSeq,
  };
}

function serializeNPC(npc: NPC) {
  return {
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
}

// ============================
// Gameplay Helpers
// ============================

function emitAchievement(socket: any, player: Player) {
  const milestones = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
  if (!milestones.includes(player.killCount)) return;

  const reward = 100;
  const prefix =
    player.killCount === 1 ? "First Kill!" : `${player.killCount} Kills!`;

  const notification: ServerNotification = {
    recipient: socket.id,
    type: "achievement",
    content: `${prefix} +${reward} Coins!`,
  };

  player.coins += reward;
  socket.emit("server-notification", notification);
}

function computeHitInfo(
  camPos: Vector3,
  worldHit: Vector3,
  collider: any
): {
  distance: number;
  hitBodyPart: "head" | "torso" | "legs";
  bodyPartMultiplier: number;
  falloffStart: number;
  falloffEnd: number;
  minFactor: number;
} {
  const distance = worldHit.distanceTo(camPos);
  const colPos = collider.translation();
  const local = {
    x: worldHit.x - colPos.x,
    y: worldHit.y - colPos.y,
    z: worldHit.z - colPos.z,
  };

  // Defaults (torso)
  let hitBodyPart: "head" | "torso" | "legs" = "torso";
  let bodyPartMultiplier = 1.0;
  let falloffStart = 10;
  let falloffEnd = 50;
  let minFactor = 0.2;

  if (local.y > 0.45) {
    hitBodyPart = "head";
    bodyPartMultiplier = 4.0;
    falloffStart = 20;
    falloffEnd = 100;
    minFactor = 0.5;
  } else if (local.y < 0.0) {
    hitBodyPart = "legs";
    bodyPartMultiplier = 0.5;
    falloffStart = 5;
    falloffEnd = 40;
    minFactor = 0.2;
  }

  return {
    distance,
    hitBodyPart,
    bodyPartMultiplier,
    falloffStart,
    falloffEnd,
    minFactor,
  };
}

function distanceDamageFactor(
  distance: number,
  start: number,
  end: number,
  minFactor: number
) {
  if (distance <= start) return 1.0;
  const t = (distance - start) / (end - start);
  return Math.max(minFactor, 1.0 - t);
}

/**
 * Shared combat handler: supports reload and ranged shooting.
 * Works for BOTH playerInput (on foot) and vehicleInput (while driving).
 * - Uses player.lastMouseLeft / lastR across input streams so semi-auto edge detection stays correct.
 * - Uses player.viewQuaternion and data.camPos for ray origin/direction (same as before).
 */
function handleCombat(
  player: Player,
  data: PlayerInput,
  world: World,
  socket: any
) {
  const wasMouseLeft = player.lastMouseLeft;
  const wasReload = player.lastR;

  // Update edge-tracking immediately for next frame, regardless of success paths
  player.lastMouseLeft = data.keys.mouseLeft;
  player.lastR = data.keys.r;

  const handItem = player.getHandItem() as Weapon | null;
  const aiming = data.keys.mouseRight;

  // --- Reload (R edge) ---
  const reloadPressed = data.keys.r && !wasReload;
  if (reloadPressed && handItem) {
    if (player.ammo > 0) {
      if (Date.now() - handItem.lastReloadTime >= handItem.reloadDurationMs) {
        handItem.lastReloadTime = Date.now();

        const needed = handItem.capacity - handItem.ammo;
        const toLoad = Math.min(needed, player.ammo);

        player.ammo -= toLoad;
        handItem.reload(toLoad);
      }
    }
  }

  // --- Ranged (aim + left click edge, semi-auto)
  if (aiming && handItem) {
    const now = Date.now();
    const firePressed = data.keys.mouseLeft && !wasMouseLeft;
    const canShoot =
      now - handItem.lastShotTime >= (handItem.fireRateMs || 100) &&
      !handItem.isReloading;

    if (firePressed && canShoot && handItem.ammo > 0) {
      handItem.ammo--;
      handItem.lastShotTime = now;

      const forward = new Vector3(0, 0, -1)
        .applyQuaternion((player as any).viewQuaternion)
        .normalize();

      const hit = PhysicsManager.getInstance().raycastFull(
        data.camPos,
        forward,
        player.physicsObject.rigidBody,
        100
      );

      if (hit?.hit) {
        const hitPlayer = world.getPlayerFromCollider(hit.hit.collider);

        if (hitPlayer) {
          const worldHit = hit.hitPos!;
          const {
            distance,
            hitBodyPart,
            bodyPartMultiplier,
            falloffStart,
            falloffEnd,
            minFactor,
          } = computeHitInfo(data.camPos, worldHit, hit.hit.collider);

          const baseDamage = handItem.damage ?? 25;
          const finalDamage =
            baseDamage *
            bodyPartMultiplier *
            distanceDamageFactor(distance, falloffStart, falloffEnd, minFactor);

          hitPlayer.damage(finalDamage);

          if (hitPlayer.health <= 0) {
            const rewardAmount = randomIntBetween(4, 9);
            player.give("coin", rewardAmount);
            player.killCount++;
            emitAchievement(socket, player);
          }

          world.registerHit(worldHit, hitPlayer.id, hitBodyPart);
        } else {
          world.registerHit(hit.hitPos!);
        }
      }
    }
  }
}

// ============================
// Physics Loop
// ============================

function startPhysicsLoop(world: World) {
  const PHYSICS_HZ = 60;
  const PHYSICS_STEP = 1 / PHYSICS_HZ;
  let accumulator = 0;
  let last = Date.now();

  function loop() {
    const now = Date.now();
    let frameTime = (now - last) / 1000;
    if (frameTime > 0.25) frameTime = 0.25;
    last = now;

    accumulator += frameTime;
    while (accumulator >= PHYSICS_STEP) {
      physicsManager.update();
      world.fixedUpdate(PHYSICS_STEP);
      accumulator -= PHYSICS_STEP;
    }
    setImmediate(loop);
  }

  loop();
}

// ============================
// Main Update Loop
// ============================

function startTick(world: World) {
  setInterval(() => {
    const now = Date.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    world.update(delta);

    const { players, vehicles, npcs } = world.getState();

    const transformedPlayers: Record<string, PlayerData> = {};
    for (const [id, player] of players.entries()) {
      transformedPlayers[id] = serializePlayer(player);
    }

    const worldData = {
      vehicles: vehicles.map(serializeVehicle),
      npcs: npcs.map((npc: NPC) => serializeNPC(npc)),
    };

    for (const id of readyPlayers) {
      const socket = io.sockets.sockets.get(id);
      if (socket) {
        socket.emit("updateData", {
          time: Date.now(),
          world: worldData,
          players: transformedPlayers,
        });
      }
    }
  }, 1000 / serverHz);
}

// ============================
// Socket Handlers
// ============================

function attachSocketHandlers(io: Server, world: World) {
  io.on("connection", (socket) => {
    console.log("connected!", socket.id);

    socket.broadcast.emit("addPlayer", socket.id);

    socket.on("syncTime", (clientSent) => {
      socket.emit("syncTimeResponse", { clientSent, serverNow: Date.now() });
    });

    socket.on("readyForWorld", () => {
      readyPlayers.add(socket.id);

      const { entities, interactables, vehicles, terrains, npcs, players } =
        world.getState();

      const transformedPlayers: Record<string, PlayerData> = {};
      for (const [id, player] of players.entries()) {
        if (id === socket.id) continue; // do not add own player
        transformedPlayers[id] = serializePlayer(player);
      }

      socket.emit("initWorld", {
        entities,
        interactables,
        vehicles: vehicles.map((v) => ({
          id: v.id,
          position: v.position,
          quaternion: v.quaternion,
          wheels: v.wheels.map((wheel: any) => ({
            radius: wheel.radius,
            position: wheel.position,
            quaternion: wheel.quaternion,
            worldPosition: wheel.worldPosition,
          })),
          linearVelocity: v.physicsObject.rigidBody.linvel(),
          angularVelocity: v.physicsObject.rigidBody.angvel(),
          seats: v.seats.map((seat: any) => ({
            position: seat.position,
            type: seat.type,
            seater: seat.seater ? seat.seater.id : null,
          })),
          lastProcessedInputSeq: v.lastProcessedInputSeq,
        })),
        terrains,
        npcs: npcs.map((npc: NPC) => serializeNPC(npc)),
        players: transformedPlayers,
      });

      socket.emit("init-chat", { messages: serverChatMessages });

      world.addPlayer(socket.id);
    });

    socket.on("send-chat-message", (e: ChatMessage) => {
      const MESSAGE_CHAR_LIMIT = 500;
      if (!e.id || !e.text) return;
      if (
        e.id.length === 0 ||
        e.text.length === 0 ||
        e.text.length > MESSAGE_CHAR_LIMIT
      )
        return;

      const p = world.getPlayerById(e.id);
      if (p) e.nickname = p.nickname ?? "";

      serverChatMessages.push(e);
      io.emit("chat-message", e);
    });

    type CommandData = { command: string; value: string; amount?: number };
    socket.on("user-command", (data: CommandData) => {
      const amount = data.amount ?? 1;

      if (data.command === "change-nickname") {
        if (data.value.length <= 20) {
          world.getPlayerById(socket.id)?.setNickname(data.value);
        }
      }

      if (data.command === "give") {
        world.getPlayerById(socket.id)?.give(data.value, amount);
      }

      if (data.command === "suicide") {
        world.getPlayerById(socket.id)?.damage(100);
      }
    });

    socket.on("pingCheck", (startTime) => {
      socket.emit("pongCheck", startTime);
    });

    // --- Vehicle Input ---
    socket.on("vehicleInput", (data: PlayerInput) => {
      if (!readyPlayers.has(socket.id)) return;

      const { players } = world.getState();
      const player = players.get(socket.id);
      if (!player || !player.controlledObject) return;

      const vehicle = player.controlledObject;
      vehicle.lastProcessedInputSeq = data.seq;
      player.keys = data.keys;

      // Update player view from camera (needed for aiming/shooting in vehicles)
      player.viewQuaternion = new Quaternion(
        data.camQuat[0],
        data.camQuat[1],
        data.camQuat[2],
        data.camQuat[3]
      );

      // Allow the same reload + shooting logic in vehicles
      handleCombat(player, data, world, socket);

      // Exit vehicle
      if (data.keys.e && Date.now() - player.lastInteractedTime >= 500) {
        player.lastInteractedTime = Date.now();
        player.exitVehicle();
        return;
      }

      // Horn via 'h' while driving
      if (data.keys.h && vehicle.getDriver() === player) {
        vehicle.setHorn(true);
      } else {
        vehicle.setHorn(false);
      }
    });

    // --- Respawn ---
    socket.on("player-respawn", () => {
      if (!readyPlayers.has(socket.id)) return;

      const { players } = world.getState();
      const player = players.get(socket.id);
      if (!player) return;

      player.respawn();
      io.emit("player-respawn", player.id);
    });

    // --- Player Input (on foot) ---
    socket.on("playerInput", (data: PlayerInput) => {
      if (!readyPlayers.has(socket.id)) return;

      const { players, vehicles } = world.getState();
      const player = players.get(socket.id);
      if (!player) return;

      player.lastProcessedInputSeq = data.seq;

      // Movement input
      const inputDir = new Vector3(
        (data.keys.a ? -1 : 0) + (data.keys.d ? 1 : 0),
        0,
        (data.keys.w ? -1 : 0) + (data.keys.s ? 1 : 0)
      );

      if (data.keys[" "]) player.jump();

      player.keys = data.keys;
      player.wantsToInteract = data.keys.e;

      // Update view quaternion from camera (used for aiming & shooting)
      const cameraQuat = new Quaternion(
        data.camQuat[0],
        data.camQuat[1],
        data.camQuat[2],
        data.camQuat[3]
      );

      player.viewQuaternion = cameraQuat;

      // Interact / Enter-Exit vehicle
      if (data.keys.e && Date.now() - player.lastInteractedTime >= 500) {
        player.lastInteractedTime = Date.now();

        if (player.controlledObject) {
          player.exitVehicle();
        } else {
          vehicles.forEach((vehicle) => {
            if (vehicle.position.distanceTo(player.position) <= 2) {
              player.enterVehicle(vehicle);
            }
          });
        }
      }

      // Spawn car (K)
      if (data.keys.k && Date.now() - player.lastSpawnedCarTime >= 500) {
        player.lastSpawnedCarTime = Date.now();

        if (player.controlledObject != null || player.isSitting) return;

        if (player.coins < CAR_COIN_AMOUNT) {
          const notEnough: ServerNotification = {
            recipient: socket.id,
            type: "error",
            content: `Not enough coins. Car costs ${CAR_COIN_AMOUNT} coins`,
          };
          socket.emit("server-notification", notEnough);

          if (player.coins === 0) {
            const tip: ServerNotification = {
              recipient: socket.id,
              type: "info",
              content: `Tip: Pick up the red boxes for coins`,
            };
            socket.emit("server-notification", tip);
          }
        } else {
          player.coins -= CAR_COIN_AMOUNT;
          const ok: ServerNotification = {
            recipient: socket.id,
            type: "success",
            content: `Purchased car for ${CAR_COIN_AMOUNT} coins`,
          };
          socket.emit("server-notification", ok);

          world.addVehicle(
            new Vector3(
              player.position.x,
              player.position.y + 5,
              player.position.z
            ),
            player
          );
        }
      }

      // Apply movement & facing (only when on foot)
      if (!player.controlledObject) {
        if (inputDir.x !== 0 || inputDir.z !== 0) {
          const len = Math.hypot(inputDir.x, inputDir.z);
          inputDir.x /= len;
          inputDir.z /= len;

          const yawQuat = extractYaw(cameraQuat);
          const worldDir = applyQuaternion(inputDir, yawQuat);
          const yaw = Math.atan2(-worldDir.x, -worldDir.z);

          if (data.keys.mouseRight) {
            player.quaternion = yawQuat;
          } else {
            player.quaternion = new Quaternion(
              0,
              Math.sin(yaw / 2),
              0,
              Math.cos(yaw / 2)
            );
          }

          let sprintFactor = data.keys.shift ? 2 : 1;
          if (data.keys.mouseRight) sprintFactor = 1;

          const BASE_SPEED = 4;
          player.velocity.x = worldDir.x * sprintFactor * BASE_SPEED;
          player.velocity.z = worldDir.z * sprintFactor * BASE_SPEED;
        } else {
          player.velocity.x = 0;
          player.velocity.z = 0;
        }
      }

      // Shared reload + ranged shooting (on foot)
      handleCombat(player, data, world, socket);

      // Non-aiming left-click melee (on foot only)
      const wasMouseLeft = player.lastMouseLeft; // already updated inside handleCombat
      if (
        !data.keys.mouseRight &&
        data.keys.mouseLeft &&
        !wasMouseLeft &&
        !player.controlledObject
      ) {
        if (Date.now() - player.lastAttackTime >= 500) {
          player.lastAttackTime = Date.now();

          const forward = new Vector3(0, 0, -1).applyQuaternion(
            player.quaternion
          );
          const pos = player.physicsObject.rigidBody.translation();

          const hit = PhysicsManager.getInstance().raycastFull(
            new Vector3(pos.x, pos.y, pos.z),
            forward,
            player.physicsObject.rigidBody,
            1
          );

          if (hit?.hit && hit.hit.collider) {
            const hitPlayer = world.getPlayerFromCollider(hit.hit.collider);
            if (hitPlayer) hitPlayer.damage(25);

            io.emit("user_action", {
              id: socket.id,
              type: "attack",
              hasHit: true,
            });
          } else {
            io.emit("user_action", {
              id: socket.id,
              type: "attack",
              hasHit: null,
            });
          }
        }
      }
    });

    socket.on("disconnect", () => {
      readyPlayers.delete(socket.id);
      world.removePlayer(socket.id);
      socket.broadcast.emit("removePlayer", socket.id);
    });
  });
}

// ============================
// Init
// ============================

async function init() {
  await physicsManager.init();

  const world = new World(io);
  startPhysicsLoop(world);
  startTick(world);
  attachSocketHandlers(io, world);
}

init();

server.listen({ port: PORT as number, host: "0.0.0.0" }, () =>
  console.log(`Server running on http://0.0.0.0:${PORT}`)
);
