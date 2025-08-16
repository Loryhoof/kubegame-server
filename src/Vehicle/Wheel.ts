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

  private springStiffness: number = 33000;
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

    // 1️⃣ Wheel world rotation including steer
    const wheelQuat = this.parent.quaternion
      .clone()
      .multiply(
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), this.steerAngle)
      );

    // 2️⃣ Wheel world position including steer
    const wheelWorldPos = this.parent.position
      .clone()
      .add(this.position.clone().applyQuaternion(wheelQuat));

    // 3️⃣ Suspension raycast
    const worldDown = DOWN.clone().applyQuaternion(wheelQuat);
    const rayHit = phy.raycastFull(
      wheelWorldPos,
      worldDown,
      undefined,
      this.maxLength + this.radius
    );
    if (!rayHit?.hit) return;

    const { ray, hit } = rayHit;

    // 4️⃣ Compute spring length
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

    // 5️⃣ Compute suspension velocity & forces
    this.springVelocity = (this.lastLength - this.springLength) / delta;
    this.springForce =
      this.springStiffness * (this.restLength - this.springLength);
    this.damperForce = this.damperStiffness * this.springVelocity;
    this.suspensionForce = worldDown
      .clone()
      .multiplyScalar(-(this.springForce + this.damperForce));

    // 6️⃣ Wheel velocity at wheel world position
    const wheelVelocity =
      this.parent.physicsObject.rigidBody.velocityAtPoint(wheelWorldPos);

    // 7️⃣ Wheel axes in world space
    const forwardDir = new Vector3(0, 0, 1)
      .applyQuaternion(wheelQuat)
      .normalize();
    const rightDir = new Vector3(1, 0, 0)
      .applyQuaternion(wheelQuat)
      .normalize();

    // 8️⃣ Driver input
    let forwardInput = 0;
    if (this.parent.driver?.keys.w) forwardInput = 1;
    else if (this.parent.driver?.keys.s) forwardInput = -1;

    const normalForce = this.suspensionForce.length();
    const tireGrip = 1; // adjustable

    // 9️⃣ Longitudinal force (throttle)
    this.Fx = forwardInput * 0.5 * normalForce * tireGrip;

    // 🔟 Braking force (opposes forward velocity)
    if (this.parent.driver?.keys[" "]) {
      const forwardVel = new Vector3()
        .copy(wheelVelocity as Vector3)
        .dot(forwardDir);
      const maxBrake = 5000;
      console.log(-forwardVel * 50);
      this.brakeForce = clamp(forwardVel * 500, 0, maxBrake); // 50 is brake stiffness
    } else {
      this.brakeForce = 0;
    }

    // 1️⃣1️⃣ Lateral force
    const lateralStiffness = 5000; // adjustable
    this.Fy = clamp(
      -new Vector3().copy(wheelVelocity as Vector3).dot(rightDir) *
        lateralStiffness,
      -normalForce * tireGrip,
      normalForce * tireGrip
    );

    // 1️⃣2️⃣ Convert to world space and total force
    const fXWorld = forwardDir
      .clone()
      .multiplyScalar(this.Fx - this.brakeForce);
    const fYWorld = rightDir.clone().multiplyScalar(this.Fy);

    const totalForce = this.suspensionForce.clone().add(fXWorld).add(fYWorld);

    // 1️⃣3️⃣ Apply impulse at wheel world position
    const impulse = totalForce.clone().multiplyScalar(delta);
    this.parent.physicsObject.rigidBody.applyImpulseAtPoint(
      impulse,
      wheelWorldPos,
      true
    );

    // 1️⃣4️⃣ Update wheel quaternion for rendering
    this.quaternion = this.baseQuaternion.clone().multiply(wheelQuat);
  }
}
