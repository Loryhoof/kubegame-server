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
  public basePosition: Vector3;

  // Suspension
  private restLength: number = 0.1;
  private springTravel: number = 0.2;

  private springStiffness: number = 35000;
  private damperStiffness: number = 3000;

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

  private Fx: number = 0;
  private Fy: number = 0;
  private brakeForce: number = 0;

  private dragCoeff: number = 2;

  // Grip smoothing for handbrake
  private currentGrip: number = 4;

  public worldPosition: Vector3 = new Vector3();

  public grounded: boolean = false;

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
    this.basePosition = this.position.clone();
  }

  update(delta: number) {
    // Wheel world rotation
    const bodyQuat = this.parent.quaternion.clone();
    const wheelWorldPos = this.parent.position
      .clone()
      .add(this.position.clone().applyQuaternion(bodyQuat));

    const steerQuat = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      this.steerAngle
    );
    const wheelQuat = bodyQuat.clone().multiply(steerQuat);

    // Suspension raycast
    const worldDown = DOWN.clone().applyQuaternion(wheelQuat);
    const rayHit = PhysicsManager.raycastFull(
      this.parent.lobby.physicsWorld,
      wheelWorldPos,
      worldDown,
      this.parent.physicsObject.rigidBody,
      this.maxLength + this.radius
    );

    this.grounded = rayHit.hit != null;

    if (!rayHit?.hit) return;

    const { ray, hit } = rayHit;

    // Spring length & suspension forces
    this.lastLength = this.springLength;
    const targetPoint = (ray.origin as Vector3)
      .clone()
      .add(worldDown.clone().multiplyScalar(hit.timeOfImpact));
    const dist = (ray.origin as Vector3).distanceTo(targetPoint);
    this.springLength = clamp(
      dist - this.radius,
      this.minLength,
      this.maxLength
    );

    this.springVelocity = (this.lastLength - this.springLength) / delta;
    this.springForce =
      this.springStiffness * (this.restLength - this.springLength);
    this.damperForce = this.damperStiffness * this.springVelocity;
    this.suspensionForce = worldDown
      .clone()
      .multiplyScalar(-(this.springForce + this.damperForce));

    // Wheel velocity at contact point
    const wheelVelocity =
      this.parent.physicsObject.rigidBody.velocityAtPoint(wheelWorldPos);

    // Wheel directions
    const forwardDir = new Vector3(0, 0, 1)
      .applyQuaternion(wheelQuat)
      .normalize();
    const rightDir = new Vector3(1, 0, 0)
      .applyQuaternion(wheelQuat)
      .normalize();

    // Inputs from Vehicle controls
    const { throttle, brake, handbrake } = this.parent as any;
    const forwardInput = throttle * 1;

    const normalForce = this.suspensionForce.length();
    const engineForce = 3000; // drive power

    // Engine force
    this.Fx = forwardInput * engineForce;

    // Normal braking force on all wheels
    if (brake > 0) {
      const forwardVel = new Vector3()
        .copy(wheelVelocity as Vector3)
        .dot(forwardDir);
      const maxBrake = 8000;
      this.brakeForce = clamp(forwardVel * 1200, 0, maxBrake);
    } else {
      this.brakeForce = 0;
    }

    // Handbrake reduces rear grip instantly, recovers gradually
    const normalGrip = 4;
    const brakeGrip = 2;
    if (
      handbrake > 0 &&
      (this.wheelType === "RearLeft" || this.wheelType === "RearRight")
    ) {
      this.currentGrip = brakeGrip;
    } else {
      this.currentGrip += (normalGrip - this.currentGrip) * 0.05;
    }
    const tireGrip = this.currentGrip;

    // Lateral force
    const lateralStiffness = 5000;
    this.Fy = clamp(
      -new Vector3().copy(wheelVelocity as Vector3).dot(rightDir) *
        lateralStiffness,
      -normalForce * tireGrip,
      normalForce * tireGrip
    );

    // Friction circle clamp
    const maxForce = normalForce * tireGrip;
    const totalLongitudinal = this.Fx - this.brakeForce;
    const totalLateral = this.Fy;
    const totalForceLength = Math.sqrt(
      totalLongitudinal * totalLongitudinal + totalLateral * totalLateral
    );

    if (totalForceLength > maxForce) {
      const scale = maxForce / totalForceLength;
      this.Fx *= scale;
      this.Fy *= scale;
    }

    // Apply forces
    const forwardVel = new Vector3()
      .copy(wheelVelocity as Vector3)
      .dot(forwardDir);
    const dragForce = forwardDir
      .clone()
      .multiplyScalar(-this.dragCoeff * forwardVel * Math.abs(forwardVel));

    const fXWorld = forwardDir
      .clone()
      .multiplyScalar(this.Fx - this.brakeForce)
      .add(dragForce);
    const fYWorld = rightDir.clone().multiplyScalar(this.Fy);
    const totalForce = this.suspensionForce.clone().add(fXWorld).add(fYWorld);

    const impulse = totalForce.clone().multiplyScalar(delta);
    this.parent.physicsObject.rigidBody.applyImpulseAtPoint(
      impulse,
      wheelWorldPos,
      true
    );

    // Update wheel orientation for rendering
    const steerQuat2 = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      this.steerAngle
    );
    this.quaternion = this.baseQuaternion.clone().multiply(steerQuat2);

    // Local space wheel position for rendering
    const wheelCenterWorldPos = targetPoint
      .clone()
      .add(worldDown.clone().multiplyScalar(-this.radius));
    this.worldPosition = wheelCenterWorldPos
      .clone()
      .sub(this.parent.position)
      .applyQuaternion(this.parent.quaternion.clone().invert());
  }
}
