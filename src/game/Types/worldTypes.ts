import { Vector3, Quaternion } from "../mathUtils";
import { ItemSlot } from "../Player";
import Vehicle from "../Vehicle/Vehicle";

type TrimeshObject = {
  type: "trimesh";
  name: string;
  position: Vector3;
  quaternion: Quaternion;
};

type BoxObject = {
  type: "box";
  name: string;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
};

type NPCObject = {
  type: "npc";
  name: string;
  position: Vector3;
  quaternion: Quaternion;
};

type CarObject = {
  type: "car";
  name: string;
  position: Vector3;
  quaternion: Quaternion;
};

type SpawnerObject = {
  type: "spawner";
  name: string;
  delay: number; // required for spawner
  maxNumSpawn: number; // required for spawner
  spawnerType: "coin" | "npc";
};

type Minigame = {
  type: "race" | "deathmatch";
};

type DummySlot = {
  item: string | undefined;
};

export type PlayerSettings = {
  spawnPosition: Vector3;
  controlledObject: boolean;
  itemSlots: DummySlot[];
};

// The union
export type WorldGameObject =
  | TrimeshObject
  | BoxObject
  | NPCObject
  | CarObject
  | SpawnerObject;

export type WorldSettings = {
  gameObjects: WorldGameObject[];
  minigame?: Minigame;
  spawnPoints: Vector3[];
  playerSettings: PlayerSettings;
};

export type TerrainData = {
  position: Vector3;
  quaternion: Quaternion;
  heights: Float32Array;
  nrows: number;
  ncols: number;
  scale: Vector3;
};
