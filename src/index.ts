import express from "express";
import { Server } from "socket.io";
import http from "http";
import { applyQuaternion, Vector3 } from "./mathUtils";
import World from "./World";
import { serverHz } from "./constants";

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

setInterval(tick, 1000 / serverHz);

const world = new World(io);

// update loop
function tick() {
  world.update();

  const { players } = world.getState();
  const playersObject = Object.fromEntries(players.entries());
  io.emit("updatePlayers", playersObject);
}

io.on("connection", (socket) => {
  console.log("connected!", socket.id);

  socket.broadcast.emit("addPlayer", socket.id);

  const { zones, colliders } = world.getState();
  socket.emit("initWorld", { zones: zones, colliders: colliders });

  world.addPlayer(socket.id);

  type PlayerInput = {
    keys: {
      w: boolean;
      a: boolean;
      s: boolean;
      d: boolean;
      shift: boolean;
      e: boolean;
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

    // console.log(inputDir);

    // if (data.keys.e) {
    //   if (Date.now() - player.lastAttackTime >= 500) {
    //     player.lastAttackTime = Date.now();
    //     socket.emit("user_action", { type: "attack" });
    //   }
    // }

    const length = Math.sqrt(inputDir.x * inputDir.x + inputDir.z * inputDir.z);
    if (length > 0) {
      inputDir.x /= length;
      inputDir.z /= length;

      // Convert camera quaternion array to object
      const cameraQuat = {
        x: data.quaternion[0],
        y: data.quaternion[1],
        z: data.quaternion[2],
        w: data.quaternion[3],
      };

      // Rotate input vector by the camera quaternion (movement relative to camera)
      const worldDir = applyQuaternion(inputDir, cameraQuat);

      // Flatten so no vertical tilt
      worldDir.y = 0;

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
      player.velocity.x = worldDir.x * sprintFactor;
      player.velocity.z = worldDir.z * sprintFactor;
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

server.listen(
  {
    port: PORT,
    host: "0.0.0.0",
  },
  () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  }
);
