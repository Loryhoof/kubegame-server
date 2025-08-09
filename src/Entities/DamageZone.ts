import Zone from "../interfaces/Zone";
import { Quaternion, Vector3 } from "../mathUtils";
import Player from "../Player";

export default class DamageZone implements Zone {
  public width: number;
  public height: number;
  public depth: number;
  public position: Vector3;
  public quaternion: Quaternion;
  public color: string = "#ff0000";

  constructor(
    width: number,
    height: number,
    depth: number,
    position: Vector3,
    quaternion: Quaternion
  ) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.position = position;
    this.quaternion = quaternion;
  }

  contains(player: Player): boolean {
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
    player.damage(0.1);
  }

  update() {
    // Implement logic here if needed
  }
}
