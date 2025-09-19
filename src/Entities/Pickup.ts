import Interactable from "../interfaces/Interactable";
import Vector3 from "../Math/Vector3";
import { generateUUID, Quaternion } from "../mathUtils";
import Player from "../Player";

export default class Pickup implements Interactable {
  public id: string;
  public item: string;
  public amount: number;

  public position: Vector3;
  public quaternion: Quaternion;

  private active: boolean = true;

  public onRemove: () => void;

  constructor(
    position: Vector3,
    quaternion: Quaternion,
    item: string,
    amount: number,
    onRemove: () => void
  ) {
    this.id = generateUUID();

    this.position = position;
    this.quaternion = quaternion;
    this.item = item;
    this.amount = amount;
    this.onRemove = onRemove;
  }

  use(player: Player) {
    if (this.active) {
      this.active = false;
      player.give(this.item, this.amount);
      this.remove();
    }
  }

  remove() {
    this.onRemove();
  }
}
