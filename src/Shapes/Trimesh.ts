import { generateUUID, Quaternion, Vector3 } from "../mathUtils";
import PhysicsManager, { PhysicsObject } from "../PhysicsManager";
import WorldShape, { WorldShapeType } from "./WorldShape";

export default class Trimesh implements WorldShape {
  public id: string;
  public position: Vector3;
  public quaternion: Quaternion;
  public physicsObject: PhysicsObject | any = null;
  public vertices: Float32Array;
  public indices: Uint16Array;
  public modelName: string;

  public readonly type: WorldShapeType = "trimesh";

  constructor(
    position: Vector3,
    quaternion: Quaternion,
    vertices: any,
    indices: any,
    modelName: string
  ) {
    this.id = generateUUID();
    this.position = position;
    this.quaternion = quaternion;
    this.modelName = modelName;

    this.vertices = vertices;
    this.indices = indices;

    this.physicsObject = PhysicsManager.getInstance().createTrimesh(
      this.position,
      this.quaternion,
      this.vertices,
      new Uint32Array(this.indices)
    );
  }
}
