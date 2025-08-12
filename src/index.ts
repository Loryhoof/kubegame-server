import express from "express";
import { Server } from "socket.io";
import http from "http";
import {
  applyQuaternion,
  getYawQuaternion,
  Quaternion,
  Vector3,
} from "./mathUtils";
import World from "./World";
import { serverHz } from "./constants";
import PhysicsManager from "./PhysicsManager";
const app = express();
const PORT = process.env.PORT || 3000;

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Attach Socket.IO to the HTTP server
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const physicsManager = PhysicsManager.getInstance();

async function init() {
  await physicsManager.init();

  setInterval(tick, 1000 / serverHz);

  io.on("connection", (socket) => {
    console.log("connected!", socket.id);

    socket.broadcast.emit("addPlayer", socket.id);

    // const { zones, colliders } = world.getState();
    const { entities, interactables } = world.getState();
    socket.emit("initWorld", {
      entities: entities,
      interactables: interactables,
    });

    world.addPlayer(socket.id);

    type PlayerInput = {
      keys: {
        w: boolean;
        a: boolean;
        s: boolean;
        d: boolean;
        shift: boolean;
        e: boolean;
        " ": boolean;
      };
      quaternion: [number, number, number, number];
    };

    socket.on("playerInput", (data: PlayerInput) => {
      const { players } = world.getState();
      const player = players.get(socket.id);
      if (!player) return;

      let inputDir: Vector3 = { x: 0, y: 0, z: 0 };

      if (data.keys.w) inputDir.z -= 1;
      if (data.keys.s) inputDir.z += 1;
      if (data.keys.a) inputDir.x -= 1;
      if (data.keys.d) inputDir.x += 1;

      if (data.keys[" "]) player.jump();

      // console.log(inputDir);

      // if (data.keys.e) {
      //   // if (Date.now() - player.lastAttackTime >= 500) {
      //   //   player.lastAttackTime = Date.now();
      //   //   socket.emit("user_action", { type: "attack" });
      //   // }
      //   player.wantsToInteract = true
      // }

      player.wantsToInteract = data.keys.e;

      const length = Math.sqrt(
        inputDir.x * inputDir.x + inputDir.z * inputDir.z
      );
      if (length > 0) {
        inputDir.x /= length;
        inputDir.z /= length;

        const cameraQuat = {
          x: data.quaternion[0],
          y: data.quaternion[1],
          z: data.quaternion[2],
          w: data.quaternion[3],
        };

        const yawQuat = getYawQuaternion(cameraQuat);

        const worldDir = applyQuaternion(inputDir, yawQuat);

        // --- YAW ONLY: make player face movement direction ---
        const yaw = Math.atan2(-worldDir.x, -worldDir.z);
        player.quaternion = {
          x: 0,
          y: Math.sin(yaw / 2),
          z: 0,
          w: Math.cos(yaw / 2),
        };

        // Apply velocity
        let sprintFactor = data.keys.shift ? 1.5 : 1;
        player.velocity.x = worldDir.x * sprintFactor * 5;
        player.velocity.z = worldDir.z * sprintFactor * 5;
        //player.velocity.y = -9.81;
      } else {
        player.velocity.x = 0;
        player.velocity.z = 0;
      }
    });

    socket.on("disconnect", () => {
      world.removePlayer(socket.id);
      socket.broadcast.emit("removePlayer", socket.id);
    });
  });

  const world = new World(io);

  // update loop
  function tick() {
    world.update();

    if (physicsManager.isReady()) physicsManager.update(0, 0);

    const { players } = world.getState();

    type PlayerData = {
      velocity: Vector3;
      health: number;
      coins: number;
      id: string;
      position: Vector3;
      quaternion: Quaternion;
      color: string;
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
      };
    }

    io.emit("updatePlayers", transformedPlayers);
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
