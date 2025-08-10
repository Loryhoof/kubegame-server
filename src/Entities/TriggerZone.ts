import Zone, { TriggerAction } from "../interfaces/Zone";
import { generateUUID, Quaternion, Vector3 } from "../mathUtils";
import Player from "../Player";

export default class TriggerZone implements Zone {
  public id: string;
  public width: number;
  public height: number;
  public depth: number;
  public position: Vector3;
  public quaternion: Quaternion;
  public color: string;
  public triggerAction: TriggerAction;

  private onRemove?: (zone: TriggerZone) => void;

  constructor(
    width: number,
    height: number,
    depth: number,
    position: Vector3,
    quaternion: Quaternion,
    color: string,
    triggerAction: TriggerAction,
    onRemove?: (zone: TriggerZone) => void
  ) {
    this.id = generateUUID();
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.position = position;
    this.quaternion = quaternion;
    this.color = color;
    this.triggerAction = triggerAction;
    this.onRemove = onRemove;
  }

  contains(player: Player): boolean {
    // Axis-Aligned Bounding Box check
    return (
      player.position.x >= this.position.x &&
      player.position.x <= this.position.x + this.width &&
      player.position.y >= this.position.y &&
      player.position.y <= this.position.y + this.height &&
      player.position.z >= this.position.z &&
      player.position.z <= this.position.z + this.depth
    );
  }

  trigger(player: Player): void {
    switch (this.triggerAction.type) {
      case "damage":
        player.damage(this.triggerAction.amount);
        break;

      case "heal":
        player.heal(this.triggerAction.amount);
        break;

      case "pickup":
        player.give(this.triggerAction.itemId, this.triggerAction.amount);
        if (this.onRemove) this.onRemove(this);
        break;

      default:
        // Optional: handle unknown triggerAction types
        console.warn("Unknown trigger action:", this.triggerAction);
        break;
    }
  }
  destroy(): void {}

  update(): void {
    // Implement additional logic per frame if needed
  }
}
