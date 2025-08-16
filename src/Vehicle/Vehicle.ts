import { Rad2Deg } from "../constants";
import { generateUUID, Quaternion, Vector3 } from "../mathUtils";
import PhysicsManager, { PhysicsObject } from "../PhysicsManager";
import Player from "../Player";
import Wheel from "./Wheel";

type Seat = {
  position: Vector3;
  type: "driver" | "passenger";
  seater: Player | null;
};

export default class Vehicle {
  public id = generateUUID();
  public position: Vector3;
  public quaternion: Quaternion = new Quaternion();

  public driver: Player | null = null;

  public physicsObject: PhysicsObject;

  public wheels: Wheel[] = [];

  // car specs
  private wheelBase: number = 2.55;
  private rearTrack: number = 1.525;
  private turnRadius: number = 10.8 * 0.5;

  private ackermannAngleLeft: number = 0;
  private ackermannAngleRight: number = 0;

  private steerSpeed: number = 2;

  private seats: Seat[] = [];

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

    this.seats = [
      { position: new Vector3(0.5, 0, 0.5), type: "driver", seater: null },
      { position: new Vector3(-0.5, 0, 0.5), type: "passenger", seater: null },
      { position: new Vector3(-0.5, 0, -0.5), type: "passenger", seater: null },
      { position: new Vector3(-0.5, 0, -0.5), type: "passenger", seater: null },
    ];
  }

  // setDriver(player: Player) {
  //   this.driver = player;
  // }

  enterVehicle(player: Player) {
    console.log(player.controlledObject);
    if (player.controlledObject) return;

    const seat = this.seats.find((s) => s.seater == null);

    console.log(seat);

    if (!seat) return;

    if (seat.type == "driver") this.driver = player;

    seat.seater = player;

    console.log("TRIGGEREDDD");
  }

  getSeatPosition(player: Player): Vector3 {
    const seat = this.seats.find((item) => item.seater == player);

    if (!seat) return new Vector3();

    return new Vector3()
      .copy(this.physicsObject.rigidBody.translation() as Vector3)
      .add(seat.position.clone().applyQuaternion(this.quaternion));
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

    let steerInput = 0;
    if (a) steerInput = 1; // left
    else if (d) steerInput = -1; // right

    // right
    if (d) {
      this.ackermannAngleLeft =
        Math.atan(this.wheelBase / (this.turnRadius + this.rearTrack / 2)) *
        steerInput;
      this.ackermannAngleRight =
        Math.atan(this.wheelBase / (this.turnRadius - this.rearTrack / 2)) *
        steerInput;
    } else if (a) {
      this.ackermannAngleLeft =
        Math.atan(this.wheelBase / (this.turnRadius - this.rearTrack / 2)) *
        steerInput;
      this.ackermannAngleRight =
        Math.atan(this.wheelBase / (this.turnRadius + this.rearTrack / 2)) *
        steerInput;
    } else {
      this.ackermannAngleLeft = 0;
      this.ackermannAngleRight = 0;
    }
  }

  update(delta: number) {
    this.wheels.forEach((wheel) => {
      let targetSteerAngle = 0;

      if (wheel.wheelType === "FrontLeft")
        targetSteerAngle = this.ackermannAngleLeft;
      if (wheel.wheelType === "FrontRight")
        targetSteerAngle = this.ackermannAngleRight;

      // Gradually approach target angle
      wheel.steerAngle +=
        (targetSteerAngle - wheel.steerAngle) *
        Math.min(1, this.steerSpeed * delta);

      wheel.update(delta);
    });

    const { x, y, z } = this.physicsObject.rigidBody.translation();
    let rot = this.physicsObject.rigidBody.rotation();

    this.position.set(x, y, z);
    this.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    this.updateControls();
  }
}
