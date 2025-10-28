import RAPIER from "@dimforge/rapier3d-compat";
import { generateShortUUID } from "./mathUtils";
import World from "./World";
import { Server, Socket } from "socket.io";
import { attachSocketHandlers } from "../socket/handlers";
import PhysicsManager from "./PhysicsManager";
import {
  serializeBinaryWorld,
  serializeNPC,
  serializePlayer,
  serializeVehicle,
} from "./serialize";
import Player, { PlayerData } from "./Player";
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

  public worldSettings: WorldSettings;

  private lastState = {
    players: new Map<string, any>(),
    vehicles: new Map<string, any>(),
    npcs: new Map<string, any>(),
  };

  constructor(
    lobbyManager: LobbyManager,
    type: LobbyType,
    io: Server,
    worldSettings: WorldSettings,
    id: string = generateShortUUID()
  ) {
    this.lobbyManager = lobbyManager;
    this.type = type;
    this.io = io;
    this.id = id;
    this.physicsWorld = PhysicsManager.createWorld();

    // const worldSettings: WorldSettings =
    //   this.type == "Hub" && loadWorldSettings("./src/WorldFiles/defaultWorldSettings.json")
    //     ? loadWorldSettings("./src/WorldFiles/defaultWorldSettings.json")
    //     : loadWorldSettings("./src/WorldFiles/raceWorldSettings.json");

    this.worldSettings = worldSettings;

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

  emitNPCEvent(player: NPC, event: string, payload: any = undefined) {
    this.io
      .to(this.id)
      .emit("npc-event", { event: event, id: player.id, payload });
  }

  emitPlayerEvent(player: Player, event: string, payload: any = undefined) {
    this.io
      .to(this.id)
      .emit("player-event", { event: event, id: player.id, payload });
  }

  update(delta: number) {
    this.gameWorld.update(delta);
    const { players, vehicles, npcs } = this.gameWorld.getState();

    if (players.size === 0) return;

    const buffer = serializeBinaryWorld(Date.now(), players, vehicles, npcs);
    LobbyManager.totalBytesThisSecond += buffer.byteLength;
    this.io.to(this.id).emit("updateBinary", buffer);
  }
}
