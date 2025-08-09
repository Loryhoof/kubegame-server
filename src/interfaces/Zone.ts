import { Quaternion, Vector3 } from "../mathUtils";
import Player from "../Player";

export type TriggerAction =
  | { type: "heal"; amount: number }
  | { type: "damage"; amount: number }
  | { type: "pickup"; itemId: string; amount: number };

export default interface Zone {
  id: string;
  color: string;
  width: number;
  height: number;
  depth: number;
  position: Vector3;
  quaternion: Quaternion;
  triggerAction: TriggerAction;
  contains(player: Player): boolean;
  trigger(player: Player): void;
  update(): void;
}
