import express from "express";
import { Server } from "socket.io";
import http from "http";
import https from "https";

import { readFileSync } from "fs";
import { config } from "dotenv";
import LobbyManager from "./LobbyManager";
import { serverHz } from "./constants";
import PhysicsManager from "./PhysicsManager";
import { attachSocketHandlers } from "./socket/handlers";

export type ServerNotification = {
  recipient: string;
  type: "error" | "success" | "info" | "achievement";
  content: string;
};

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
}

init();

server.listen({ port: PORT as number, host: "0.0.0.0" }, () =>
  console.log(`Server running on http://0.0.0.0:${PORT}`)
);
