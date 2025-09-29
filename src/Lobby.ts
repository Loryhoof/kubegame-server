import RAPIER from "@dimforge/rapier3d-compat";
import { generateShortUUID } from "./mathUtils";
import World from "./World";
import { Server, Socket } from "socket.io";
import { attachSocketHandlers } from "./socket/handlers";
import PhysicsManager from "./PhysicsManager";
import { serializeNPC, serializePlayer, serializeVehicle } from "./serialize";
import { PlayerData } from "./Player";
import NPC from "./NPC";
import LobbyManager, { LobbyType, MinigameMeta } from "./LobbyManager";
import { WorldSettings } from "./Types/worldTypes";
import { loadWorldSettings } from "./fileUtils";

type ChatMessage = { id: string; nickname: string; text: string };

export default class Lobby {
  private io: Server;
  public id: string;
  public gameWorld: World;
  public physicsWorld: RAPIER.World;
  public type: LobbyType;
  public players: Set<string> = new Set();
  public chat: ChatMessage[] = [];

  public minigame?: MinigameMeta;

  private lobbyManager: LobbyManager;

  constructor(
    lobbyManager: LobbyManager,
    type: LobbyType,
    io: Server,
    id: string = generateShortUUID()
  ) {
    this.lobbyManager = lobbyManager;
    this.type = type;
    this.io = io;
    this.id = id;
    this.physicsWorld = PhysicsManager.createWorld();

    const worldSettings: WorldSettings =
      this.type == "Hub"
        ? loadWorldSettings("./src/WorldFiles/defaultWorldSettings.json")
        : loadWorldSettings("./src/WorldFiles/raceWorldSettings.json");

    this.gameWorld = new World(this, this.io, worldSettings);
  }

  removePlayerByUUID(uuid: string) {
    this.players.delete(uuid);
    this.gameWorld.removePlayer(uuid);
  }

  joinLobby(socket: Socket) {
    socket.join(this.id);
    console.log(`Socket ${socket.id} joined lobby ${this.id}`);

    this.players.add(socket.id);

    // Now attach all per-player event handlers
    attachSocketHandlers(this.io, this, socket, this.lobbyManager);
  }

  fixedUpdate(delta: number) {
    this.gameWorld.fixedUpdate(delta);
    this.physicsWorld.step();
  }

  cleanup() {
    this.gameWorld.cleanup();
  }

  //   update(delta: number) {
  //     const { vehicles, npcs, players } = this.gameWorld.getState();

  //     const transformedPlayers: Record<string, PlayerData> = {};
  //     for (const [id, player] of players.entries()) {
  //       transformedPlayers[id] = serializePlayer(player);
  //     }

  //     const worldData = {
  //       vehicles: vehicles.map(serializeVehicle),
  //       npcs: npcs.map((npc: NPC) => serializeNPC(npc)),
  //     };

  //     for (const id of this.players) {
  //       const socket = this.io.sockets.sockets.get(id);
  //       if (socket) {
  //         socket.emit("updateData", {
  //           time: Date.now(),
  //           world: worldData,
  //           players: transformedPlayers,
  //         });
  //       }
  //     }
  //   }

  update(delta: number) {
    this.gameWorld.update(delta);

    const { vehicles, npcs, players } = this.gameWorld.getState();

    const transformedPlayers: Record<string, PlayerData> = {};
    for (const [id, player] of players.entries()) {
      transformedPlayers[id] = serializePlayer(player);
    }

    const worldData = {
      vehicles: vehicles.map(serializeVehicle),
      npcs: npcs.map((npc: NPC) => serializeNPC(npc)),
    };

    // Emit to everyone in this lobby room at once
    this.io.to(this.id).emit("updateData", {
      lobby: this.id,
      time: Date.now(),
      world: worldData,
      players: transformedPlayers,
    });
  }
}
