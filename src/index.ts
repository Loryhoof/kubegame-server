import express from "express";
import { Server } from "socket.io";
import http from "http";

function rotateVectorByQuaternion(v: Vec3, q: Quaternion): Vec3 {
  const { x: vx, y: vy, z: vz } = v;
  const { x: qx, y: qy, z: qz, w: qw } = q;

  // Quaternion multiplication: q * v
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;

  // Result: (q * v) * q^-1
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

function applyQuaternion(vec: Vec3, q: Quaternion): Vec3 {
  const x = vec.x,
    y = vec.y,
    z = vec.z;
  const qx = q.x,
    qy = q.y,
    qz = q.z,
    qw = q.w;

  // calculate quat * vector
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  // calculate result * inverse quat
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

type Vec3 = { x: number; y: number; z: number };
type Quaternion = { x: number; y: number; z: number; w: number };

type Player = {
  id: string;
  position: Vec3;
  rotation: Quaternion;
  velocity: Vec3;
};

const players = new Map<string, Player>();

const app = express();
const PORT = process.env.PORT || 3000;

const speedFactor = 0.1;

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Attach Socket.IO to the HTTP server
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const hz = 90;
setInterval(tick, 1000 / hz);

function tick() {
  for (const [key, value] of players) {
    value.position.x += value.velocity.x * speedFactor;
    value.position.z += value.velocity.z * speedFactor;
  }
  // players.forEach((player) => {
  //   player.position.x += player.velocity.x * speedFactor;
  //   player.position.z += player.velocity.z * speedFactor;
  // });

  const playersObject = Object.fromEntries(players.entries());
  io.emit("updatePlayers", playersObject);
}

io.on("connection", (socket) => {
  console.log("connected!", socket.id);

  socket.broadcast.emit("addPlayer", socket.id);

  const user: Player = {
    id: socket.id,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: 0 },
  };

  players.set(socket.id, user);

  type PlayerInput = {
    keys: { w: boolean; a: boolean; s: boolean; d: boolean };
    quaternion: [number, number, number, number];
  };

  socket.on("playerInput", (data: PlayerInput) => {
    const player = players.get(socket.id);
    if (!player) return;

    // FIXED: Update player rotation from input quaternion (array to object)
    player.rotation = {
      x: data.quaternion[0],
      y: data.quaternion[1],
      z: data.quaternion[2],
      w: data.quaternion[3],
    };

    // Local input direction vector
    let inputDir: Vec3 = { x: 0, y: 0, z: 0 };

    if (data.keys.w) inputDir.z -= 1;
    if (data.keys.s) inputDir.z += 1;
    if (data.keys.a) inputDir.x -= 1;
    if (data.keys.d) inputDir.x += 1;

    // Normalize input direction to avoid faster diagonal movement
    const length = Math.sqrt(inputDir.x * inputDir.x + inputDir.z * inputDir.z);
    if (length > 0) {
      inputDir.x /= length;
      inputDir.z /= length;
    }

    // Rotate input direction by player rotation quaternion
    const worldDir = applyQuaternion(inputDir, player.rotation);

    // Apply velocity (y is ignored here)
    player.velocity.x = worldDir.x;
    player.velocity.z = worldDir.z;
  });

  socket.on("disconnect", () => {
    // socket.broadcast.emit(socket.id);
    console.log(`${socket.id} disconnected`);
    players.delete(socket.id);

    socket.broadcast.emit("removePlayer", socket.id);
  });
});

// Start the HTTP server (not app)
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
