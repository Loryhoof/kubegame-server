import { generateUUID, Quaternion, Vector3 } from "../mathUtils";
import PhysicsManager, { PhysicsObject } from "../PhysicsManager";

export default class Box {
  public id: string;
  public width: number;
  public height: number;
  public depth: number;
  public position: Vector3;
  public quaternion: Quaternion;
  public color: string;
  public physicsObject: PhysicsObject;

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

    this.physicsObject = PhysicsManager.getInstance().createFixedBox(
      position,
      new Vector3(width, height, depth),
      this.quaternion
    );
  }
}
