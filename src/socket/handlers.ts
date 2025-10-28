import { Server, Socket } from "socket.io";
import {
  Vector3,
  Quaternion,
  applyQuaternion,
  extractYaw,
  randomIntBetween,
  computeHitInfo,
  distanceDamageFactor,
} from "../game/mathUtils";
import { CAR_COIN_AMOUNT } from "../game/constants";
import NPC from "../game/NPC";
import World from "../game/World";
import PhysicsManager from "../game/PhysicsManager";
import {
  deserializeBinaryPlayerInput,
  serializeNPC,
  serializePlayer,
} from "../game/serialize";
import Player from "../game/Player";
import Weapon from "../game/Holdable/Weapon";
import { ServerNotification } from "../server";
import Lobby from "../game/Lobby";
import RAPIER from "@dimforge/rapier3d-compat";
import LobbyManager from "../game/LobbyManager";
import ServerStore from "../game/Store/ServerStore";

type ChatMessage = { id: string; nickname: string; text: string };
type PlayerInput = {
  actions: any;
  seq: number;
  dt: number;
  camQuat: [number, number, number, number];
  camPos: Vector3;
};

// export interface Lobby {
//   id: string;
//   world: World;
//   players: Set<string>;
//   chat: ChatMessage[];
// }

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

  player.addCoins(reward);
  socket.emit("server-notification", notification);
}

function handleCombat(
  player: Player,
  data: PlayerInput,
  world: World,
  physicsWorld: RAPIER.World,
  socket: any
) {
  const wasMouseLeft = player.prevActions.shoot;
  const wasReload = player.prevActions.reload;

  const handItem = player.getHandItem() as Weapon | null;
  const aiming = data.actions.aim;

  // --- Reload (R edge) ---
  const reloadPressed = data.actions.reload && !wasReload;
  if (reloadPressed && handItem) {
    if (player.ammo > 0) {
      if (Date.now() - handItem.lastReloadTime >= handItem.reloadDurationMs) {
        handItem.lastReloadTime = Date.now();

        const needed = handItem.capacity - handItem.ammo;
        const toLoad = Math.min(needed, player.ammo);

        if (handItem.reload(toLoad)) {
          player.ammo -= toLoad;

          world.lobby.emitPlayerEvent(player, "reload-weapon", {
            duration: handItem.reloadDurationMs,
            ammo: player.ammo,
            amount: toLoad,
          });
        }
      }
    }
  }

  // --- Ranged (aim + left click edge, semi-auto)
  if (aiming && handItem) {
    const now = Date.now();
    const firePressed = data.actions.shoot && !wasMouseLeft;
    const canShoot =
      now - handItem.lastShotTime >= (handItem.fireRateMs || 100) &&
      !handItem.isReloading;

    if (firePressed && canShoot && handItem.ammo > 0) {
      handItem.ammo--;
      handItem.lastShotTime = now;

      const forward = new Vector3(0, 0, -1)
        .applyQuaternion((player as any).viewQuaternion)
        .normalize();

      const hit = PhysicsManager.raycastFull(
        physicsWorld,
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
            player.addCoins(rewardAmount);
            player.incrementKillcount();
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

export function attachSocketHandlers(
  io: Server,
  lobby: Lobby,
  socket: Socket,
  lobbyManager: LobbyManager
) {
  const { id: roomId, gameWorld: world, players, chat, physicsWorld } = lobby;

  console.log(`[${roomId}] connected!`, socket.id);
  socket.join(roomId);

  // ============================
  // Basic Sync & Player Init
  // ============================
  socket.broadcast.to(roomId).emit("addPlayer", socket.id);

  socket.on("syncTime", (clientSent) => {
    socket.emit("syncTimeResponse", { clientSent, serverNow: Date.now() });
  });

  // socket.on("init-user-settings", ({ nickname }: { nickname?: string }) => {
  //   if (nickname) {
  //     world.getPlayerById(socket.id)?.setNickname(nickname);
  //   }
  // });

  socket.on("readyForWorld", (data) => {
    const inviteId = data?.inviteId;

    world.addPlayer(socket.id, socket.data.userId);

    if (inviteId) {
      const inviteLobby = lobbyManager.findLobbyById(inviteId);
      const player = world.getPlayerById(socket.id);

      if (inviteLobby && player) {
        lobbyManager.transferPlayer(lobby, inviteLobby, player, socket);
        return;
      }
    }

    players.add(socket.id);

    const {
      entities,
      interactables,
      vehicles,
      terrains,
      npcs,
      players: playerMap,
      zones,
    } = world.getState();

    const transformedPlayers: Record<string, any> = {};
    for (const [id, player] of playerMap.entries()) {
      if (id !== socket.id) transformedPlayers[id] = serializePlayer(player);
    }

    socket.emit("initWorld", {
      entities,
      interactables,
      zones,
      vehicles: vehicles.map((v) => ({
        id: v.id,
        position: v.position,
        quaternion: v.quaternion,
        wheels: v.wheels.map((w) => ({
          radius: w.radius,
          position: w.position,
          quaternion: w.quaternion,
          worldPosition: w.worldPosition,
        })),
        linearVelocity: v.physicsObject.rigidBody.linvel(),
        angularVelocity: v.physicsObject.rigidBody.angvel(),
        seats: v.seats.map((seat) => ({
          position: seat.position,
          type: seat.type,
          seater: seat.seater ? seat.seater.id : null,
        })),
        lastProcessedInputSeq: v.lastProcessedInputSeq,
      })),
      terrains,
      npcs: npcs.map((npc: NPC) => serializeNPC(npc)),
      players: transformedPlayers,
      lobby: { id: lobby.id, type: lobby.type },
    });

    socket.emit("init-chat", { messages: chat });
  });

  // ============================
  // Chat
  // ============================
  socket.on("send-chat-message", (e: ChatMessage) => {
    if (!e.id || !e.text || e.text.length > 500) return;
    const p = world.getPlayerById(e.id);
    if (p) e.nickname = p.nickname ?? "";

    chat.push(e);
    io.to(roomId).emit("chat-message", e);
  });

  // ============================
  // Minigames
  // ============================
  socket.on("minigame-restart", () => {
    const player = world.getPlayerById(socket.id);

    if (!player) return;

    const newLobby = lobbyManager.createMinigameLobby("race", world.lobby.id);
    // lobbyManager.transferPlayer(player.lobby, lobby, player, socket);

    lobbyManager.migrate(player.lobby, newLobby);
  });

  socket.on("minigame-exit", () => {
    const player = world.getPlayerById(socket.id);

    if (!player) return;

    lobbyManager.transferPlayer(
      player.lobby,
      lobbyManager.hubLobby!,
      player,
      socket
    );
  });

  // ============================
  // Commands
  // ============================
  socket.on("user-command", ({ command, value, amount = 1 }) => {
    const player = world.getPlayerById(socket.id);
    if (!player) return;

    if (command === "change-nickname" && value.length <= 20) {
      player.setNickname(value);
    }
    // if (command === "give") player.give(value, amount);
    if (command === "suicide") player.damage(100);

    if (command == "race") {
      if (player.lobby && player.lobby.type == "Minigame")
        socket.emit("minigame-cancel");

      const lobby = lobbyManager.createMinigameLobby("race");

      lobbyManager.transferPlayer(player.lobby, lobby, player, socket);
    }

    if (command == "deathmatch") {
      if (player.lobby && player.lobby.type == "Minigame")
        socket.emit("minigame-cancel");

      const lobby = lobbyManager.createMinigameLobby("deathmatch");

      lobbyManager.transferPlayer(player.lobby, lobby, player, socket);
    }

    if (command == "hub") {
      const lobby = lobbyManager.getHub();
      if (!lobby) return;

      // dont go if already in it
      if (player.lobby == lobby) return;

      lobbyManager.transferPlayer(player.lobby, lobby, player, socket);

      socket.emit("minigame-cancel");
    }

    if (command == "server") {
      const data = {
        uptime: ServerStore.getInstance().getServerUptime(),
        hub: {
          players: lobbyManager.hubLobby?.players.size,
        },
        minigames: lobbyManager.minigameLobbies.length,
        totalClients: ServerStore.getInstance().getUserRecords().length,
      };

      socket.emit("server-info", data);
    }

    if (command == "stats") {
      const data = {
        kills: player.killCount,
        deaths: player.deathCount,
      };

      socket.emit("player-stats", data);
    }
  });

  socket.on("pingCheck", (startTime) => {
    socket.emit("pongCheck", startTime);
  });

  // ============================
  // Vehicle Input
  // ============================
  socket.on("vehicleInput", (data: PlayerInput) => {
    if (!players.has(socket.id)) return;
    const { players: playerMap } = world.getState();
    const player = playerMap.get(socket.id);
    if (!player || !player.controlledObject) return;

    const vehicle = player.controlledObject;
    vehicle.lastProcessedInputSeq = data.seq;
    player.prevActions = { ...player.actions };
    player.actions = data.actions;
    player.viewQuaternion = new Quaternion(...data.camQuat);

    handleCombat(player, data, world, physicsWorld, socket);

    // Exit vehicle
    if (
      data.actions.interact &&
      Date.now() - player.lastInteractedTime >= 500
    ) {
      player.lastInteractedTime = Date.now();
      player.exitVehicle();
    }

    // Horn
    vehicle.setHorn(data.actions.useHorn && vehicle.getDriver() === player);
  });

  // ============================
  // Respawn
  // ============================
  socket.on("player-respawn", () => {
    if (!players.has(socket.id)) return;
    const player = world.getPlayerById(socket.id);
    if (!player) return;
    player.respawn();
    io.to(roomId).emit("player-respawn", player.id);
  });

  // ============================
  // Player Input (on foot)
  // ============================
  socket.on("playerInput", (buffer: Buffer) => {
    const data = deserializeBinaryPlayerInput(buffer) as any;

    LobbyManager.totalBytesThisSecond += buffer.byteLength;

    if (!players.has(socket.id)) return;
    const { players: playerMap, vehicles } = world.getState();
    const player = playerMap.get(socket.id);
    if (!player) return;

    player.lastProcessedInputSeq = data.seq;
    player.prevActions = { ...player.actions };
    player.actions = data.actions;
    player.wantsToInteract = data.actions.interact;
    player.viewQuaternion = data.camQuat;

    // Interact: enter/exit vehicle
    if (
      data.actions.interact &&
      Date.now() - player.lastInteractedTime >= 500
    ) {
      player.lastInteractedTime = Date.now();
      if (player.controlledObject) {
        player.exitVehicle();
      } else {
        vehicles.forEach((v) => {
          if (v.position.distanceTo(player.position) <= 2)
            player.enterVehicle(v);
        });
      }
    }

    if (data.actions.slot1 && !player.prevActions.slot1) player.selectSlot(0);
    else if (data.actions.slot2 && !player.prevActions.slot2)
      player.selectSlot(1);
    else if (data.actions.slot3 && !player.prevActions.slot3)
      player.selectSlot(2);
    else if (data.actions.slot4 && !player.prevActions.slot4)
      player.selectSlot(3);

    if (data.actions.jump && !player.prevActions.jump) {
      player.jump();
    }

    // Spawn car
    if (
      data.actions.spawnVehicle &&
      Date.now() - player.lastSpawnedCarTime >= 500
    ) {
      player.lastSpawnedCarTime = Date.now();
      if (!player.controlledObject && !player.isSitting) {
        if (player.spendCoins(CAR_COIN_AMOUNT)) {
          socket.emit("server-notification", {
            recipient: socket.id,
            type: "success",
            content: `Purchased car for ${CAR_COIN_AMOUNT} coins`,
          });
          world.addVehicle(
            new Vector3(
              player.position.x,
              player.position.y + 5,
              player.position.z
            ),
            player
          );
        } else {
          socket.emit("server-notification", {
            recipient: socket.id,
            type: "error",
            content: `Not enough coins. Car costs ${CAR_COIN_AMOUNT} coins`,
          });
        }
      }
    }

    // Movement
    const inputDir = new Vector3(
      (data.actions.moveLeft ? -1 : 0) + (data.actions.moveRight ? 1 : 0),
      0,
      (data.actions.moveForward ? -1 : 0) + (data.actions.moveBackward ? 1 : 0)
    );
    if (!player.controlledObject) {
      if (inputDir.x || inputDir.z) {
        const len = Math.hypot(inputDir.x, inputDir.z);
        inputDir.x /= len;
        inputDir.z /= len;

        const yawQuat = extractYaw(player.viewQuaternion);
        const worldDir = applyQuaternion(inputDir, yawQuat);
        const yaw = Math.atan2(-worldDir.x, -worldDir.z);

        player.quaternion = data.actions.aim
          ? yawQuat
          : new Quaternion(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));

        const speed = data.actions.sprint && !data.actions.aim ? 8 : 4;
        player.velocity.x = worldDir.x * speed;
        player.velocity.z = worldDir.z * speed;
      } else {
        player.velocity.x = 0;
        player.velocity.z = 0;
      }
    }

    // Shooting + melee
    handleCombat(player, data, world, physicsWorld, socket);

    const hasWeapon = !!player.getHandItem();
    const wantsMelee = !hasWeapon || !data.actions.aim;

    if (
      wantsMelee &&
      data.actions.shoot &&
      !player.prevActions.shoot &&
      !player.controlledObject
    ) {
      if (Date.now() - player.lastAttackTime >= 500) {
        player.lastAttackTime = Date.now();
        const forward = new Vector3(0, 0, -1).applyQuaternion(
          player.quaternion
        );
        const pos = player.physicsObject.rigidBody.translation();

        const hit = PhysicsManager.raycastFull(
          physicsWorld,
          new Vector3(pos.x, pos.y, pos.z),
          forward,
          player.physicsObject.rigidBody,
          1
        );

        const hitPlayer =
          hit?.hit && hit.hit.collider
            ? world.getPlayerFromCollider(hit.hit.collider)
            : null;
        if (hitPlayer) hitPlayer.damage(25);

        io.to(roomId).emit("user_action", {
          id: socket.id,
          type: "attack",
          hasHit: !!hitPlayer,
        });
      }
    }
  });

  // ============================
  // Disconnect
  // ============================
  socket.on("disconnect", () => {
    players.delete(socket.id);
    world.removePlayer(socket.id);
    socket.broadcast.to(roomId).emit("removePlayer", socket.id);
  });
}
