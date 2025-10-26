import { Vector3 } from "../mathUtils";

export default interface Collider {
  contains(position: Vector3, halfSize: Vector3): boolean;
}
