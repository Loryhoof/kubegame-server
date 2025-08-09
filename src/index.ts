import express from "express";
import { Server } from "socket.io";
import http from "http";
import { applyQuaternion, getYRotationQuaternion, Vector3 } from "./mathUtils";
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

const world = new World();

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

  const { zones } = world.getState();

  socket.emit("initWorld", { zones: zones });

  world.addPlayer(socket.id);

  type PlayerInput = {
    keys: { w: boolean; a: boolean; s: boolean; d: boolean; shift: boolean };
    quaternion: [number, number, number, number];
  };

  socket.on("playerInput", (data: PlayerInput) => {
    const { players } = world.getState();

    const player = players.get(socket.id);
    if (!player) return;

    // Local input direction vector
    let inputDir: Vector3 = { x: 0, y: 0, z: 0 };

    if (data.keys.w) inputDir.z -= 1;
    if (data.keys.s) inputDir.z += 1;
    if (data.keys.a) inputDir.x -= 1;
    if (data.keys.d) inputDir.x += 1;

    // Normalize input direction to avoid faster diagonal movement
    const length = Math.sqrt(inputDir.x * inputDir.x + inputDir.z * inputDir.z);
    if (length > 0) {
      inputDir.x /= length;
      inputDir.z /= length;

      // FIXED: Update player rotation from input quaternion (array to object)
      const fullRotation = {
        x: data.quaternion[0],
        y: data.quaternion[1],
        z: data.quaternion[2],
        w: data.quaternion[3],
      };

      player.quaternion = getYRotationQuaternion(fullRotation);
    }

    // Rotate input direction by player rotation quaternion
    const worldDir = applyQuaternion(inputDir, player.quaternion);

    let sprintFactor = data.keys.shift ? 1.5 : 1;

    // Apply velocity (y is ignored here)
    player.velocity.x = worldDir.x * sprintFactor;
    player.velocity.z = worldDir.z * sprintFactor;
  });

  socket.on("disconnect", () => {
    world.removePlayer(socket.id);
    socket.broadcast.emit("removePlayer", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
