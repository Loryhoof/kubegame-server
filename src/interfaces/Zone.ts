import { Quaternion, Vector3 } from "../mathUtils";
import Player from "../Player";

export default interface Zone {
  color: string;
  width: number;
  height: number;
  depth: number;
  position: Vector3;
  quaternion: Quaternion;
  contains(player: Player): boolean;
  trigger(player: Player): void;
  update(): void;
}
