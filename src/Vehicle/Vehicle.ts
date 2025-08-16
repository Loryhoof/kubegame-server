import { Rad2Deg } from "../constants";
import { generateUUID, Quaternion, Vector3 } from "../mathUtils";
import PhysicsManager, { PhysicsObject } from "../PhysicsManager";
import Player from "../Player";
import Wheel from "./Wheel";

export default class Vehicle {
  public id = generateUUID();
  public position: Vector3;
  public quaternion: Quaternion = new Quaternion();

  private driver: Player | null = null;

  public physicsObject: PhysicsObject;

  public wheels: Wheel[] = [];

  // car specs
  private wheelBase: number = 2.55;
  private rearTrack: number = 1.525;
  private turnRadius: number = 10.8;

  private ackermannAngleLeft: number = 0;
  private ackermannAngleRight: number = 0;

  constructor(position: Vector3) {
    this.position = position;

    this.physicsObject = PhysicsManager.getInstance().createCar(position);

    this.wheels = [
      new Wheel(
        this,
        0.5,
        new Vector3(1.5, -0.2, 1.5),
        new Quaternion(),
        "FrontLeft"
      ),
      new Wheel(
        this,
        0.5,
        new Vector3(-1.5, -0.2, 1.5),
        new Quaternion(),
        "FrontRight"
      ),
      new Wheel(
        this,
        0.5,
        new Vector3(1.5, -0.2, -1.5),
        new Quaternion(),
        "RearLeft"
      ),
      new Wheel(
        this,
        0.5,
        new Vector3(-1.5, -0.2, -1.5),
        new Quaternion(),
        "RearRight"
      ),
    ];
  }

  setDriver(player: Player) {
    this.driver = player;
  }

  updateControls() {
    if (!this.driver) return;

    const forceFactor = 5;

    const { w, a, s, d } = this.driver.keys;

    // if (w) {
    //   this.physicsObject.rigidBody.applyImpulse(
    //     new Vector3(0, 0, forceFactor).applyQuaternion(
    //       this.physicsObject.rigidBody.rotation()
    //     ),
    //     true
    //   );
    // }
    // if (s) {
    //   this.physicsObject.rigidBody.applyImpulse(
    //     new Vector3(0, 0, -forceFactor).applyQuaternion(
    //       this.physicsObject.rigidBody.rotation()
    //     ),
    //     true
    //   );
    // }

    const steerInput = a ? -1 : 1;
    // right
    if (d) {
      this.ackermannAngleLeft =
        Rad2Deg *
        Math.atan(this.wheelBase / (this.turnRadius + this.rearTrack / 2)) *
        steerInput;
      this.ackermannAngleRight =
        Rad2Deg *
        Math.atan(this.wheelBase / (this.turnRadius - this.rearTrack / 2)) *
        steerInput;
    } else if (a) {
      this.ackermannAngleLeft =
        Rad2Deg *
        Math.atan(this.wheelBase / (this.turnRadius - this.rearTrack / 2)) *
        steerInput;
      this.ackermannAngleRight =
        Rad2Deg *
        Math.atan(this.wheelBase / (this.turnRadius + this.rearTrack / 2)) *
        steerInput;
    } else {
      this.ackermannAngleLeft = 0;
      this.ackermannAngleRight = 0;
    }
  }

  update(delta: number) {
    this.wheels.forEach((wheel) => {
      if (wheel.wheelType == "FrontLeft")
        wheel.steerAngle = this.ackermannAngleLeft;

      if (wheel.wheelType == "FrontRight")
        wheel.steerAngle = this.ackermannAngleRight;

      wheel.update(delta);
    });

    const { x, y, z } = this.physicsObject.rigidBody.translation();
    let rot = this.physicsObject.rigidBody.rotation();

    this.position.set(x, y, z);
    this.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    this.updateControls();
  }
}
