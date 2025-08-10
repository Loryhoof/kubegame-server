import Collider from "../interfaces/Collider";
import { generateUUID, Quaternion, Vector3 } from "../mathUtils";

export default class BoxCollider implements Collider {
  public id: string;
  public width: number;
  public height: number;
  public depth: number;
  public position: Vector3;
  public quaternion: Quaternion;
  public color: string;

  constructor(
    width: number,
    height: number,
    depth: number,
    position: Vector3,
    quaternion: Quaternion,
    color: string
  ) {
    this.id = generateUUID();
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.position = position;
    this.quaternion = quaternion;
    this.color = color;
  }

  contains(position: Vector3, halfSize: Vector3): boolean {
    const playerMin = {
      x: position.x - halfSize.x,
      y: position.y - halfSize.y,
      z: position.z - halfSize.z,
    };
    const playerMax = {
      x: position.x + halfSize.x,
      y: position.y + halfSize.y,
      z: position.z + halfSize.z,
    };

    const colliderMin = this.position;
    const colliderMax = {
      x: this.position.x + this.width,
      y: this.position.y + this.height,
      z: this.position.z + this.depth,
    };

    return (
      playerMax.x >= colliderMin.x &&
      playerMin.x <= colliderMax.x &&
      playerMax.y >= colliderMin.y &&
      playerMin.y <= colliderMax.y &&
      playerMax.z >= colliderMin.z &&
      playerMin.z <= colliderMax.z
    );
  }
}
