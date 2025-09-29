import Lobby from "../Lobby";
import { generateUUID, Quaternion, Vector3 } from "../mathUtils";
import PhysicsManager, { PhysicsObject } from "../PhysicsManager";
import WorldShape, { WorldShapeType } from "./WorldShape";

export default class Box implements WorldShape {
  public id: string;
  public width: number;
  public height: number;
  public depth: number;
  public position: Vector3;
  public quaternion: Quaternion;
  public color: string;
  public physicsObject: PhysicsObject | null = null;

  public readonly type: WorldShapeType = "box";

  public lobby: Lobby;

  public solid: boolean = true;

  constructor(
    lobby: Lobby,
    width: number,
    height: number,
    depth: number,
    position: Vector3,
    quaternion: Quaternion,
    color: string,
    solid: boolean = true
  ) {
    this.lobby = lobby;
    this.id = generateUUID();
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.position = position;
    this.quaternion = quaternion;
    this.color = color;
    this.solid = solid;

    if (this.solid) {
      this.physicsObject = PhysicsManager.createFixedBox(
        this.lobby.physicsWorld,
        position,
        new Vector3(width, height, depth),
        this.quaternion
      );
    }
  }
}
