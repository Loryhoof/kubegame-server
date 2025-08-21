import express from "express";
import { Server } from "socket.io";
import http from "http";
import https from "https";
import {
  applyQuaternion,
  getYawQuaternion,
  Quaternion,
  Vector3,
} from "./mathUtils";
import World from "./World";
import { serverHz } from "./constants";
import PhysicsManager from "./PhysicsManager";
import { readFileSync } from "fs";
import { config } from "dotenv";

type ChatMessage = { id: string; text: string };

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

const physicsManager = PhysicsManager.getInstance();
const readyPlayers = new Set<string>(); // track players that called readyForWorld

async function init() {
  await physicsManager.init();

  setInterval(tick, 1000 / serverHz);

  const world = new World(io);

  io.on("connection", (socket) => {
    console.log("connected!", socket.id);

    socket.broadcast.emit("addPlayer", socket.id);

    // Player marks themselves as ready
    socket.on("readyForWorld", () => {
      readyPlayers.add(socket.id);

      const { entities, interactables, vehicles, terrains } = world.getState();
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
        })),
        terrains: terrains,
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
      quaternion: [number, number, number, number];
    };

    socket.on("pingCheck", (startTime) => {
      socket.emit("pongCheck", startTime);
    });

    socket.on("playerInput", (data: PlayerInput) => {
      if (!readyPlayers.has(socket.id)) return; // ignore input if not ready

      const { players, vehicles } = world.getState();
      const player = players.get(socket.id);
      if (!player) return;

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

        console.log("pressing e");

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

      if (data.keys.k && Date.now() - player.lastSpawnedCarTime >= 5000) {
        if (player.controlledObject != null || player.isSitting) return;

        player.lastSpawnedCarTime = Date.now();

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
          data.quaternion[0],
          data.quaternion[1],
          data.quaternion[2],
          data.quaternion[3]
        );

        const yawQuat = getYawQuaternion(cameraQuat);
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

        // if(player.controlledObject) {
        //   player.quaternion = player.controlledObject.quaternion
        // }

        let sprintFactor = data.keys.shift ? 2 : 1;
        player.velocity.x = worldDir.x * sprintFactor * 5;
        player.velocity.z = worldDir.z * sprintFactor * 5;
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

  // update loop
  function tick() {
    const now = Date.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    const elapsedTime = (now - startTime) / 1000; // seconds since init

    world.update(delta);
    if (physicsManager.isReady()) physicsManager.update(elapsedTime, delta);

    const { players, vehicles } = world.getState();

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
    };

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
      })),
    };

    // only send to ready players
    for (const id of readyPlayers) {
      const socket = io.sockets.sockets.get(id);
      if (socket) {
        socket.emit("updateData", {
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
