import express from "express";
import { Server } from "socket.io";
import http from "http";
import https from "https";
import {
  applyQuaternion,
  extractYaw,
  getYawQuaternion,
  Quaternion,
  Vector3,
} from "./mathUtils";
import World from "./World";
import { CAR_COIN_AMOUNT, serverHz } from "./constants";
import PhysicsManager from "./PhysicsManager";
import { readFileSync } from "fs";
import { config } from "dotenv";
import NPC from "./NPC";

type ChatMessage = { id: string; text: string };

type PlayerData = {
  velocity: Vector3;
  health: number;
  coins: number;
  id: string;
  position: Vector3;
  quaternion: Quaternion;
  color: string;
  keys: any;
  isSitting: boolean;
  controlledObject: { id: string } | null;
  lastProcessedInputSeq: number;
};

type ServerNotification = {
  type: "error" | "success" | "info";
  content: string;
};

const serverChatMessages: ChatMessage[] = [];

config();
const app = express();

let lastTime = Date.now();
let startTime = Date.now();

let server;

if (process.env.ENVIRONMENT == "PROD") {
  const options = {
    key: readFileSync(
      "/etc/letsencrypt/live/server-eu.kubegame.com/privkey.pem"
    ),
    cert: readFileSync(
      "/etc/letsencrypt/live/server-eu.kubegame.com/fullchain.pem"
    ),
  } as any;
  server = https.createServer(options, app);
} else {
  server = http.createServer(app);
}

const PORT = process.env.PORT || 3000;

// Attach Socket.IO to the HTTP server
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

let tickIndex = 0;
let physicsTickIndex = 0;

const physicsManager = PhysicsManager.getInstance();
const readyPlayers = new Set<string>(); // track players that called readyForWorld

async function init() {
  await physicsManager.init();

  setInterval(tick, 1000 / serverHz);

  const world = new World(io);

  startPhysicsLoop(world);

  io.on("connection", (socket) => {
    console.log("connected!", socket.id);

    socket.broadcast.emit("addPlayer", socket.id);

    socket.on("syncTime", (clientSent) => {
      socket.emit("syncTimeResponse", {
        clientSent,
        serverNow: Date.now(),
      });
    });

    // Player marks themselves as ready
    socket.on("readyForWorld", () => {
      readyPlayers.add(socket.id);

      const { entities, interactables, vehicles, terrains, npcs, players } =
        world.getState();

      const transformedPlayers: Record<string, PlayerData> = {};
      for (const [id, player] of players.entries()) {
        // dont add own player
        if (id == socket.id) continue;

        transformedPlayers[id] = {
          velocity: player.velocity,
          health: player.health,
          coins: player.coins,
          id: player.id,
          position: player.position,
          quaternion: player.quaternion,
          color: player.color,
          keys: player.keys,
          isSitting: player.isSitting,
          controlledObject: player.controlledObject
            ? { id: player.controlledObject.id }
            : null,
          lastProcessedInputSeq: player.lastProcessedInputSeq,
        };
      }

      socket.emit("initWorld", {
        entities,
        interactables,
        vehicles: vehicles.map((vehicle) => ({
          id: vehicle.id,
          position: vehicle.position,
          quaternion: vehicle.quaternion,
          wheels: vehicle.wheels.map((wheel) => ({
            radius: wheel.radius,
            position: wheel.position,
            quaternion: wheel.quaternion,
            worldPosition: wheel.worldPosition,
          })),
          linearVelocity: vehicle.physicsObject.rigidBody.linvel(),
          angularVelocity: vehicle.physicsObject.rigidBody.angvel(),
          seats: vehicle.seats.map((seat) => ({
            position: seat.position,
            type: seat.type,
            seater: seat.seater ? seat.seater.id : null,
          })),
          lastProcessedInputSeq: vehicle.lastProcessedInputSeq,
        })),
        terrains: terrains,
        npcs: npcs.map((npc: NPC) => ({
          velocity: npc.velocity,
          health: npc.health,
          coins: npc.coins,
          id: npc.id,
          position: npc.position,
          quaternion: npc.quaternion,
          color: npc.color,
          keys: npc.keys,
          isSitting: npc.isSitting,
          // controlledObject: npc.controlledObject
          //   ? { id: npc.controlledObject.id }
          //   : null,
        })),
        players: transformedPlayers,
      });

      socket.emit("init-chat", { messages: serverChatMessages });

      world.addPlayer(socket.id);
    });

    socket.on("send-chat-message", (e: ChatMessage) => {
      const MESSAGE_CHAR_LIMIT = 500;

      if (!e.id || !e.text) return;
      if (
        e.id.length == 0 ||
        e.text.length == 0 ||
        e.text.length > MESSAGE_CHAR_LIMIT
      )
        return;

      serverChatMessages.push(e);
      socket.broadcast.emit("chat-message", e);
    });

    type PlayerInput = {
      keys: {
        w: boolean;
        a: boolean;
        s: boolean;
        d: boolean;
        shift: boolean;
        e: boolean;
        k: boolean;
        " ": boolean;
        mouseLeft: boolean;
        mouseRight: boolean;
      };
      seq: number;
      dt: number;
      camQuat: [number, number, number, number];
    };

    type RegisterObjectType = {
      position: Vector3;
      quaternion: Quaternion;
      vertices: any[];
      indices: any[];
      scale: Vector3;
    };
    // socket.on("register-object", (e: RegisterObjectType) => {
    //   const aligned = new Uint8Array(e.vertices).buffer;
    //   const vertices = new Float32Array(aligned);

    //   const aligned2 = new Uint8Array(e.indices).buffer;
    //   const indices = new Uint16Array(aligned2);
    //   const uint32 = new Uint32Array(indices);

    //   // writeFile(
    //   //   "WorldFiles/lala.json",
    //   //   JSON.stringify({
    //   //     vertices: vertices,
    //   //     indices: indices,
    //   //   }),
    //   //   (err) => {
    //   //     if (err) {
    //   //       console.log("we got rror)");
    //   //     }
    //   //   }
    //   // );

    //   PhysicsManager.getInstance().createTrimesh(
    //     e.position,
    //     e.quaternion,
    //     vertices,
    //     uint32
    //   );
    // });

    socket.on("pingCheck", (startTime) => {
      socket.emit("pongCheck", startTime);
    });

    socket.on("vehicleInput", (data: PlayerInput) => {
      if (!readyPlayers.has(socket.id)) return; // ignore input if not ready

      const { players } = world.getState();
      const player = players.get(socket.id);
      if (!player) return;

      if (!player.controlledObject) return;

      const vehicle = player.controlledObject;

      vehicle.lastProcessedInputSeq = data.seq;
      player.keys = data.keys;

      if (data.keys.e && Date.now() - player.lastInteractedTime >= 500) {
        player.lastInteractedTime = Date.now();

        player.exitVehicle();
        return;
      }
    });

    socket.on("playerInput", (data: PlayerInput) => {
      if (!readyPlayers.has(socket.id)) return; // ignore input if not ready

      const { players, vehicles } = world.getState();
      const player = players.get(socket.id);
      if (!player) return;

      player.lastProcessedInputSeq = data.seq;

      let inputDir: Vector3 = new Vector3();

      if (data.keys.w) inputDir.z -= 1;
      if (data.keys.s) inputDir.z += 1;
      if (data.keys.a) inputDir.x -= 1;
      if (data.keys.d) inputDir.x += 1;

      if (data.keys[" "]) player.jump();

      player.keys = data.keys;
      player.wantsToInteract = data.keys.e;

      if (data.keys.e && Date.now() - player.lastInteractedTime >= 500) {
        player.lastInteractedTime = Date.now();

        if (player.controlledObject) {
          player.exitVehicle();
          return;
        }

        vehicles.forEach((vehicle) => {
          if (vehicle.position.distanceTo(player.position) <= 2) {
            player.enterVehicle(vehicle);
          }
        });
      }

      if (data.keys.k && Date.now() - player.lastSpawnedCarTime >= 500) {
        player.lastSpawnedCarTime = Date.now();

        if (player.controlledObject != null || player.isSitting) return;

        // transact
        if (player.coins < CAR_COIN_AMOUNT) {
          const notification: ServerNotification = {
            type: "error",
            content: `Not enough coins. Car costs ${CAR_COIN_AMOUNT} coins`,
          };
          socket.emit("server-notification", notification);

          if (player.coins == 0) {
            const notification: ServerNotification = {
              type: "info",
              content: `Tip: Pick up the red boxes for coins`,
            };
            socket.emit("server-notification", notification);
          }

          return;
        }

        player.coins -= CAR_COIN_AMOUNT;

        const notification: ServerNotification = {
          type: "success",
          content: `Purchased car for ${CAR_COIN_AMOUNT} coins`,
        };
        socket.emit("server-notification", notification);

        world.addVehicle(
          new Vector3(
            player.position.x,
            player.position.y + 5,
            player.position.z
          ),
          player
        );
      }

      const length = Math.sqrt(
        inputDir.x * inputDir.x + inputDir.z * inputDir.z
      );
      if (length > 0) {
        inputDir.x /= length;
        inputDir.z /= length;

        const cameraQuat = new Quaternion(
          data.camQuat[0],
          data.camQuat[1],
          data.camQuat[2],
          data.camQuat[3]
        );

        const yawQuat = extractYaw(cameraQuat);
        const worldDir = applyQuaternion(inputDir, yawQuat);
        const yaw = Math.atan2(-worldDir.x, -worldDir.z);

        if (!player.controlledObject) {
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
        }

        // if(player.controlledObject) {
        //   player.quaternion = player.controlledObject.quaternion
        // }

        let sprintFactor = data.keys.shift ? 2 : 1;

        const BASE_SPEED = 4;
        player.velocity.x = worldDir.x * sprintFactor * BASE_SPEED;
        player.velocity.z = worldDir.z * sprintFactor * BASE_SPEED;
      } else {
        player.velocity.x = 0;
        player.velocity.z = 0;
      }

      if (data.keys.mouseLeft) {
        if (player.controlledObject) {
          if (player.controlledObject.getDriver() == player) {
            player.controlledObject.setHorn(true);
            return;
          }
        }

        if (Date.now() - player.lastAttackTime >= 500) {
          player.lastAttackTime = Date.now();

          const forward = new Vector3(0, 0, -1);
          forward.applyQuaternion(player.quaternion);

          const pos = player.physicsObject.rigidBody.translation();
          const hit = PhysicsManager.getInstance().raycastFull(
            new Vector3(pos.x, pos.y, pos.z),
            forward,
            player.physicsObject.rigidBody,
            1
          );

          if (hit && hit.hit && hit.hit.collider) {
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
      } else {
        if (
          player.controlledObject &&
          player.controlledObject.getDriver() == player &&
          player.controlledObject.hornPlaying
        ) {
          player.controlledObject.setHorn(false);
        }
      }
    });

    socket.on("disconnect", () => {
      readyPlayers.delete(socket.id);
      world.removePlayer(socket.id);
      socket.broadcast.emit("removePlayer", socket.id);
    });
  });

  function startPhysicsLoop(world: World) {
    const PHYSICS_HZ = 60;
    const PHYSICS_STEP = 1 / PHYSICS_HZ;
    let accumulator = 0;
    let lastTime = Date.now();

    function loop() {
      const now = Date.now();
      let frameTime = (now - lastTime) / 1000;
      if (frameTime > 0.25) frameTime = 0.25; // safety clamp
      lastTime = now;

      accumulator += frameTime;
      while (accumulator >= PHYSICS_STEP) {
        physicsManager.update();
        world.fixedUpdate(PHYSICS_STEP);
        accumulator -= PHYSICS_STEP;
        physicsTickIndex++;
      }
      setImmediate(loop);
    }

    loop();
  }

  // update loop
  function tick() {
    const now = Date.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    tickIndex++;

    // accumulator += delta;

    const elapsedTime = (now - startTime) / 1000; // seconds since init

    // while (accumulator >= FIXED_STEP) {
    //   physicsManager.update();
    //   accumulator -= FIXED_STEP;
    // }

    world.update(delta);

    const { players, vehicles, npcs } = world.getState();

    const transformedPlayers: Record<string, PlayerData> = {};
    for (const [id, player] of players.entries()) {
      transformedPlayers[id] = {
        velocity: player.velocity,
        health: player.health,
        coins: player.coins,
        id: player.id,
        position: player.position,
        quaternion: player.quaternion,
        color: player.color,
        keys: player.keys,
        isSitting: player.isSitting,
        controlledObject: player.controlledObject
          ? { id: player.controlledObject.id }
          : null,
        lastProcessedInputSeq: player.lastProcessedInputSeq,
      };
    }

    const worldData = {
      vehicles: vehicles.map((vehicle) => ({
        id: vehicle.id,
        position: vehicle.position,
        quaternion: vehicle.quaternion,
        hornPlaying: vehicle.hornPlaying,
        wheels: vehicle.wheels.map((wheel) => ({
          radius: wheel.radius,
          position: wheel.position,
          quaternion: wheel.quaternion,
          worldPosition: wheel.worldPosition,
        })),
        linearVelocity: vehicle.physicsObject.rigidBody.linvel(),
        angularVelocity: vehicle.physicsObject.rigidBody.angvel(),
        seats: vehicle.seats.map((seat) => ({
          position: seat.position,
          type: seat.type,
          seater: seat.seater ? seat.seater.id : null,
        })),
        lastProcessedInputSeq: vehicle.lastProcessedInputSeq,
      })),
      npcs: npcs.map((npc: NPC) => ({
        velocity: npc.velocity,
        health: npc.health,
        coins: npc.coins,
        id: npc.id,
        position: npc.position,
        quaternion: npc.quaternion,
        color: npc.color,
        keys: npc.keys,
        isSitting: npc.isSitting,
        // controlledObject: npc.controlledObject
        //   ? { id: npc.controlledObject.id }
        //   : null,
      })),
    };

    // only send to ready players
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
  }
}
init();

server.listen(
  {
    port: PORT,
    host: "0.0.0.0",
  },
  () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  }
);
