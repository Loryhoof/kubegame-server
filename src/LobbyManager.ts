import { Server, Socket } from "socket.io";
import Lobby from "./Lobby";
import Player from "./Player";
import { serializeNPC, serializePlayer } from "./serialize";
import NPC from "./NPC";
import { loadWorldSettings } from "./fileUtils";
import { WorldSettings } from "./Types/worldTypes";
import ServerStore, { UserRecord } from "./Store/ServerStore";

export type MinigameType = "race" | "deathmatch" | "custom";

export type MinigameMeta = {
  type: MinigameType;
  name: string;
  description: string;
};

export type LobbyType = "Hub" | "Minigame";

export type LobbyDetails = {
  id: string;
  type: LobbyType;
  minigame?: MinigameMeta;
};

// const minigames: MinigameMeta[] = [
//   {
//     type: "race",
//     name: "Race to the Death",
//     description: "a good circuit race mode",
//   },
// ];

export default class LobbyManager {
  private io: Server;
  public minigameLobbies: Lobby[] = [];
  public hubLobby: Lobby | null = null;
  private serverIsReady: boolean = false;

  private worldSettingsTemplates: Record<string, WorldSettings> = {};

  constructor(io: Server) {
    this.io = io;

    this.worldSettingsTemplates["hub"] = loadWorldSettings(
      "./src/WorldFiles/defaultWorldSettings.json"
    );

    this.worldSettingsTemplates["race"] = loadWorldSettings(
      "./src/WorldFiles/raceWorldSettings.json"
    );

    this.worldSettingsTemplates["deathmatch"] = loadWorldSettings(
      "./src/WorldFiles/deathmatchWorldSettings.json"
    );
  }

  init() {
    this.hubLobby = new Lobby(
      this,
      "Hub",
      this.io,
      this.worldSettingsTemplates["hub"]
    );

    this.io.on("connection", (socket) => this.handleConnection(socket));

    this.serverIsReady = true;
  }

  private handleConnection(socket: Socket) {
    console.log("Socket connected:", socket.id);

    const userRecord: UserRecord = {
      id: socket.id,
      dateJoined: Date.now(),
    };

    ServerStore.getInstance().addUserRecordEntry(userRecord);

    // For now, always join Hub lobby
    if (this.hubLobby) {
      this.hubLobby.joinLobby(socket);
    }

    // Later: socket.on("join-lobby", id => this.joinLobby(socket, id))
  }

  resetLobby(lobby: Lobby) {
    lobby.cleanup();
    const index = this.minigameLobbies.findIndex((item) => item.id == lobby.id);
    this.minigameLobbies.splice(index, 1);

    lobby = new Lobby(this, lobby.type, this.io, lobby.worldSettings, lobby.id);
  }

  getHub() {
    return this.hubLobby;
  }

  createMinigameLobby(type: MinigameType, id?: string): Lobby {
    const setting = this.worldSettingsTemplates[type];
    const lobby = new Lobby(this, "Minigame", this.io, setting);
    // lobby.setMinigame(minigames[0]);
    this.minigameLobbies.push(lobby);

    return lobby;
  }

  findLobbyById(uuid: string): Lobby | undefined {
    return this.minigameLobbies.find((lobby) => lobby.id == uuid);
  }

  migrate(from: Lobby, to: Lobby) {
    // Copy IDs into an array to avoid modifying the set while iterating
    const playerIds = Array.from(from.players);

    for (const socketId of playerIds) {
      const playerSocket = this.io.sockets.sockets.get(socketId);
      if (!playerSocket) {
        console.warn(`Socket not found for id ${socketId}`);
        continue;
      }

      const player = from.gameWorld.getPlayerById(socketId);
      if (!player) {
        console.warn(`Player not found in gameWorld for id ${socketId}`);
        continue;
      }

      this.transferPlayer(from, to, player, playerSocket);
    }

    console.log(
      `Migrated ${playerIds.length} players from lobby ${from.id} -> ${to.id}`
    );
  }

  transferPlayer(from: Lobby, to: Lobby, player: Player, playerSocket: Socket) {
    // remove from current
    from.players.delete(playerSocket.id);
    from.gameWorld.removePlayer(playerSocket.id);
    playerSocket.broadcast.to(from.id).emit("removePlayer", playerSocket.id);
    ///

    // 1. Remove from old lobby state
    from.removePlayerByUUID(player.id);
    playerSocket.leave(from.id);

    // 2. Join new lobby room
    playerSocket.join(to.id);

    // 3. Add to new lobby's player set

    // 4. Add player to new game world
    to.gameWorld.addPlayer(playerSocket.id);

    // 5. Attach socket handlers for the new lobby
    //    (cleans up old ones if needed inside attachSocketHandlers)
    // to.attachPlayerHandlers(playerSocket);

    // 6. Get new world state for this lobby
    const {
      entities,
      interactables,
      vehicles,
      terrains,
      npcs,
      players,
      zones,
    } = to.gameWorld.getState();

    const transformedPlayers: Record<string, any> = {};
    for (const [id, p] of players.entries()) {
      if (id !== playerSocket.id) transformedPlayers[id] = serializePlayer(p);
    }

    // 7. Tell the client to reset and load the new lobby

    playerSocket.emit("switch-world", {
      entities,
      interactables,
      zones,
      vehicles: vehicles.map((v) => ({
        id: v.id,
        position: v.position,
        quaternion: v.quaternion,
        wheels: v.wheels.map((w) => ({
          radius: w.radius,
          position: w.position,
          quaternion: w.quaternion,
          worldPosition: w.worldPosition,
        })),
        linearVelocity: v.physicsObject.rigidBody.linvel(),
        angularVelocity: v.physicsObject.rigidBody.angvel(),
        seats: v.seats.map((seat) => ({
          position: seat.position,
          type: seat.type,
          seater: seat.seater ? seat.seater.id : null,
        })),
        lastProcessedInputSeq: v.lastProcessedInputSeq,
      })),
      terrains,
      npcs: npcs.map((npc: NPC) => serializeNPC(npc)),
      players: transformedPlayers,
      lobby: { id: to.id, type: to.type, minigame: to.minigame },
    });

    // 8. Send chat history for new lobby
    playerSocket.emit("init-chat", { messages: to.chat });

    // console.log(
    //   `Player ${playerSocket.id} switched from ${from.id} -> ${to.id}`
    // );

    to.joinLobby(playerSocket);
  }

  updateLifecycle() {
    this.minigameLobbies.forEach((lobby, index) => {
      if (lobby.players.size == 0) {
        console.log(
          "Deleting lobby",
          lobby.id,
          lobby.type,
          lobby.minigame?.type
        );
        lobby.cleanup();
        this.minigameLobbies.splice(index, 1);
      }
    });
  }

  update(delta: number) {
    if (!this.serverIsReady) return;

    this.updateLifecycle();

    this.hubLobby?.update(delta);
    this.minigameLobbies.forEach((lobby) => lobby.update(delta));
  }

  fixedUpdate(delta: number) {
    if (!this.serverIsReady) return;

    this.hubLobby?.fixedUpdate(delta);
    this.minigameLobbies.forEach((lobby) => lobby.fixedUpdate(delta));
  }
}
