import { Quaternion, Vector3 } from "./mathUtils";

class Player {
  public id: string;
  public position: Vector3;
  public quaternion: Quaternion;
  public velocity: Vector3 = { x: 0, y: 0, z: 0 };
  public color: string;
  public health: number = 100;
  public coins: number = 0;

  constructor(
    id: string,
    position: Vector3,
    quaternion: Quaternion,
    color: string
  ) {
    this.id = id;
    this.position = position;
    this.quaternion = quaternion;
    this.color = color;
  }

  update() {}
  setPosition(position: Vector3) {
    this.position = position;
  }
  damage(amount: number) {
    this.health -= amount;
  }
  heal(amount: number) {
    if (this.health < 100) this.health += amount;
    if (this.health > 100) this.health = 100;
  }
  give(item: any, amount: number) {
    if (item == "coins") this.coins += amount;
  }
}

export default Player;
