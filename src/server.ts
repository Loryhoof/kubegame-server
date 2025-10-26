import "dotenv/config";

import express from "express";
import { Server } from "socket.io";
import http from "http";
import https from "https";

import { readFileSync } from "fs";
import LobbyManager from "./game/LobbyManager";
import { serverHz } from "./game/constants";
import PhysicsManager from "./game/PhysicsManager";
import ServerStore from "./game/Store/ServerStore";

import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";

import cors from "cors";

import jwt from "jsonwebtoken";

export type ServerNotification = {
  recipient: string;
  type: "error" | "success" | "info" | "achievement";
  content: string;
};

const PORT = process.env.PORT || 3000;

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://kubegame.com",
  "https://www.kubegame.com",
];

app.use(express.json());

app.options("*", cors()); // <-- MUST be before any CORS restriction

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("/users", userRoutes);
app.use("/auth", authRoutes);

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

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as jwt.JwtPayload & {
      userId: string;
    };

    socket.data.userId = payload.userId;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

let lastTime = Date.now();

const lobbyManager = new LobbyManager(io);

function startTick() {
  setInterval(() => {
    const now = Date.now();
    const delta = (now - lastTime) / 1000;

    lobbyManager.update(delta);

    lastTime = now;
  }, 1000 / serverHz);
}

function startPhysicsLoop() {
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
      lobbyManager.fixedUpdate(PHYSICS_STEP);

      accumulator -= PHYSICS_STEP;
    }
    setImmediate(loop);
  }

  loop();
}

async function init() {
  await PhysicsManager.init();

  lobbyManager.init();
  startTick();
  startPhysicsLoop();

  ServerStore.getInstance().setServerStartTime(Date.now());
}

init();

server.listen({ port: PORT as number, host: "0.0.0.0" }, () =>
  console.log(`Server running on http://0.0.0.0:${PORT}`)
);
