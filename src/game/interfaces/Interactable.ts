import Vector3 from "../Math/Vector3";
import { Quaternion } from "../mathUtils";
import Player from "../Player";

export default interface Interactable {
  id: string;
  position: Vector3;
  quaternion: Quaternion;
  use(player: Player): void;
}
