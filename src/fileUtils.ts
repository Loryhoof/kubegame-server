import { readFileSync } from "fs";
import { WorldSettings } from "./Types/worldTypes";
import { Vector3 } from "./mathUtils";
import { Quaternion } from "@dimforge/rapier3d-compat";

export function loadWorldSettings(path: string): WorldSettings {
  const data = JSON.parse(readFileSync(path, "utf-8")) as WorldSettings;

  // Convert gameObjects back into proper classes
  data.gameObjects = data.gameObjects.map((obj: any) => ({
    ...obj,
    position: obj.position
      ? new Vector3(obj.position.x, obj.position.y, obj.position.z)
      : undefined,
    quaternion: obj.quaternion
      ? new Quaternion(
          obj.quaternion.x,
          obj.quaternion.y,
          obj.quaternion.z,
          obj.quaternion.w
        )
      : undefined,
    scale: obj.scale
      ? new Vector3(obj.scale.x, obj.scale.y, obj.scale.z)
      : undefined,
  }));

  // Convert playerSettings if present in JSON
  if (data.playerSettings) {
    data.playerSettings = {
      leftHand: data.playerSettings.leftHand ?? null,
      rightHand: data.playerSettings.rightHand ?? null,
      spawnPosition: data.playerSettings.spawnPosition
        ? new Vector3(
            data.playerSettings.spawnPosition.x,
            data.playerSettings.spawnPosition.y,
            data.playerSettings.spawnPosition.z
          )
        : new Vector3(0, 0, 0),
      controlledObject: data.playerSettings.controlledObject ?? false,
    };
  } else {
    // Default if missing
    data.playerSettings = {
      leftHand: null,
      rightHand: null,
      spawnPosition: new Vector3(0, 0, 0),
      controlledObject: false,
    };
  }

  if (data.spawnPoints) {
    data.spawnPoints = data.spawnPoints.map((point: any) => {
      if (Array.isArray(point) && point.length === 3) {
        return new Vector3(point[0], point[1], point[2]);
      }
      return point as Vector3;
    });
  } else {
    data.spawnPoints = [];
  }

  // if (data.minigame) {
  //   data.minigame = { type: data.minigame.type }
  // }

  return data;
}
