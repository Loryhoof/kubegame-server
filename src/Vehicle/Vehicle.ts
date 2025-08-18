import { Rad2Deg } from "../constants";
import { generateUUID, Quaternion, Vector3 } from "../mathUtils";
import PhysicsManager, { PhysicsObject } from "../PhysicsManager";
import Player from "../Player";
import World from "../World";
import Wheel from "./Wheel";

const INACTIVE_TIME_LIMIT = 10; // seconds

type Seat = {
  position: Vector3;
  type: "driver" | "passenger";
  seater: Player | null;
};

export default class Vehicle {
  public id = generateUUID();
  public position: Vector3;
  public quaternion: Quaternion = new Quaternion();

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

  public lastTimeSinceOccupied: number;

  private world: World;

  constructor(world: World, position: Vector3) {
    this.world = world;

    this.position = position;

    this.physicsObject = PhysicsManager.getInstance().createCar(position);

    this.wheels = [
      new Wheel(
        this,
        0.5,
        new Vector3(1, -0.2, 1.5),
        new Quaternion(),
        "FrontLeft"
      ),
      new Wheel(
        this,
        0.5,
        new Vector3(-1, -0.2, 1.5),
        new Quaternion(),
        "FrontRight"
      ),
      new Wheel(
        this,
        0.5,
        new Vector3(1, -0.2, -1.5),
        new Quaternion(),
        "RearLeft"
      ),
      new Wheel(
        this,
        0.5,
        new Vector3(-1, -0.2, -1.5),
        new Quaternion(),
        "RearRight"
      ),
    ];

    this.seats = [
      { position: new Vector3(0.45, 0.2, 0.2), type: "driver", seater: null },
      {
        position: new Vector3(-0.5, 0.2, 0.2),
        type: "passenger",
        seater: null,
      },
      {
        position: new Vector3(-0.5, 0.2, -0.6),
        type: "passenger",
        seater: null,
      },
      {
        position: new Vector3(0.45, 0.2, -0.6),
        type: "passenger",
        seater: null,
      },
    ];

    this.lastTimeSinceOccupied = Date.now();
  }

  getDriver(): Player | null {
    return this.seats[0].seater != null ? this.seats[0].seater : null;
  }

  enterVehicle(player: Player) {
    if (player.controlledObject) return;

    const seat = this.seats.find((s) => s.seater == null);

    if (!seat) return;

    seat.seater = player;
  }

  exitVehicle(player: Player) {
    const seat = this.seats.find((s) => s.seater == player);

    if (!seat) return console.log("Player not found when exiting vehicle");

    seat.seater = null;

    const otherSeaters = this.seats.find((s) => s.seater != null);

    if (!otherSeaters) {
      this.lastTimeSinceOccupied = Date.now();
    }
  }

  getSeatPosition(player: Player): Vector3 {
    const seat = this.seats.find((item) => item.seater == player);

    if (!seat) return new Vector3();

    return new Vector3()
      .copy(this.physicsObject.rigidBody.translation() as Vector3)
      .add(seat.position.clone().applyQuaternion(this.quaternion));
  }

  updateControls() {
    const forceFactor = 5;

    const driver = this.seats[0].seater;

    if (!driver) return;

    const { w, a, s, d, r } = driver.keys;

    if (r) {
      PhysicsManager.getInstance().setTranslation(
        this.physicsObject,
        new Vector3(30, 2, 30)
      );

      this.physicsObject.rigidBody.setRotation(new Quaternion(), true);

      this.physicsObject.rigidBody.setLinvel(new Vector3(0, 0, 0), true);
      this.physicsObject.rigidBody.setAngvel(new Vector3(0, 0, 0), true);
    }

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

  despawn() {
    // making sure all players exit the vehicle
    this.seats.forEach((seat) => {
      if (seat.seater) {
        seat.seater.exitVehicle();
        seat.seater = null;
      }
    });

    PhysicsManager.getInstance().remove(this.physicsObject);

    this.world.removeVehicle(this);
  }

  update(delta: number) {
    const now = Date.now();

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

    if (now - this.lastTimeSinceOccupied >= INACTIVE_TIME_LIMIT * 1000) {
      this.despawn();
    }
  }
}
