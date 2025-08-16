import { clamp, Quaternion, Vector3 } from "../mathUtils";
import PhysicsManager from "../PhysicsManager";
import Vehicle from "./Vehicle";

const DOWN = new Vector3(0, -1, 0);

export type WheelType = "FrontLeft" | "FrontRight" | "RearLeft" | "RearRight";

export default class Wheel {
  public parent: Vehicle;
  public radius: number;
  public position: Vector3;
  public quaternion: Quaternion;

  public baseQuaternion: Quaternion;

  // Suspension
  private restLength: number = 0.4;
  private springTravel: number = 0.2;

  private springStiffness: number = 30000;
  private damperStiffness: number = 2000;

  private minLength: number;
  private maxLength: number;
  private lastLength: number = 0;

  private springLength: number = 0;
  private springForce: number = 0;
  private suspensionForce: Vector3 = new Vector3();

  private springVelocity: number = 0;
  private damperForce: number = 0;

  public wheelType: WheelType;

  public steerAngle: number = 0;

  constructor(
    parent: Vehicle,
    radius: number,
    position: Vector3,
    quaternion: Quaternion,
    wheelType: WheelType
  ) {
    this.parent = parent;
    this.radius = radius;
    this.position = position;
    this.quaternion = quaternion;

    this.wheelType = wheelType;

    this.minLength = this.restLength - this.springTravel;
    this.maxLength = this.restLength + this.springTravel;

    this.baseQuaternion = this.quaternion.clone();
  }

  update(delta: number) {
    const phy = PhysicsManager.getInstance();

    const worldDown = DOWN.clone().applyQuaternion(this.parent.quaternion);

    //console.log(worldDown);

    const globalPosition = this.parent.position
      .clone()
      .add(this.position.clone().applyQuaternion(this.parent.quaternion));

    const rayHit = phy.raycastFull(
      globalPosition,
      worldDown,
      undefined,
      this.maxLength + this.radius
    );

    if (!rayHit) return;

    const { ray, hit } = rayHit;

    const origin = ray.origin;

    if (!hit) return;

    this.lastLength = this.springLength;

    const targetPoint = new Vector3(
      origin.x + DOWN.x * hit.timeOfImpact,
      origin.y + DOWN.y * hit.timeOfImpact,
      origin.z + DOWN.z * hit.timeOfImpact
    );

    const dist = new Vector3(origin.x, origin.y, origin.z).distanceTo(
      targetPoint
    );

    this.springLength = dist - this.radius;
    this.springLength = clamp(
      this.springLength,
      this.minLength,
      this.maxLength
    );

    // console.log(this.springLength, "BEFORE");

    this.springVelocity = (this.lastLength - this.springLength) / delta;

    this.springForce =
      this.springStiffness * (this.restLength - this.springLength);

    this.damperForce = this.damperStiffness * this.springVelocity;

    this.suspensionForce = new Vector3(0, 1, 0).multiplyScalar(
      this.springForce + this.damperForce
    );

    const impulse = this.suspensionForce.multiplyScalar(delta);
    this.parent.physicsObject.rigidBody.applyImpulseAtPoint(
      impulse,
      { x: globalPosition.x, y: globalPosition.y, z: globalPosition.z },
      true
    );

    const steerQuat = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0), // Y-axis
      this.steerAngle
    );

    // final wheel orientation = base orientation * steering rotation
    this.quaternion = this.baseQuaternion.clone().multiply(steerQuat);

    // this.quaternion.setFromEuler(
    //   this.rotation.x,
    //   this.rotation.y + this.steerAngle,
    //   this.rotation.z
    // );
  }
}
