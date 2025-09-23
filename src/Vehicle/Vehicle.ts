import RAPIER from "@dimforge/rapier3d-compat";
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

  public seats: Seat[] = [];
  public lastTimeSinceOccupied: number;
  private world: World;

  // sounds
  public hornPlaying: boolean = false;
  public lastProcessedInputSeq: number = 0;

  private hasFlipped: boolean = false;
  private lastFlipTime: number = -Infinity;

  private isInAir: boolean = false;

  // stunt tracking
  private stuntAttempt: boolean = false;

  // vehicle controls
  private throttle: number = 0;
  private brake: number = 0;
  private handbrake: number = 0;
  private steer: number = 0;

  private failedStunt: boolean = false;

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
      { position: new Vector3(0.45, 0.6, 0.2), type: "driver", seater: null },
      {
        position: new Vector3(-0.5, 0.6, 0.2),
        type: "passenger",
        seater: null,
      },
      {
        position: new Vector3(-0.5, 0.6, -0.6),
        type: "passenger",
        seater: null,
      },
      {
        position: new Vector3(0.45, 0.6, -0.6),
        type: "passenger",
        seater: null,
      },
    ];

    this.lastTimeSinceOccupied = Date.now();
  }

  setHorn(bool: boolean) {
    this.hornPlaying = bool;
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

    if ((seat.type = "driver")) this.hornPlaying = false;
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

  isFlipped(): boolean {
    const worldUp = new Vector3(0, 1, 0);
    const vehicleUp = new Vector3(0, 1, 0).applyQuaternion(this.quaternion);
    const dot = vehicleUp.dot(worldUp);
    return dot < 0.2;
  }

  isAirborne(): boolean {
    let nonGrounded = 0;
    this.wheels.forEach((wheel) => {
      if (!wheel.grounded) nonGrounded++;
    });
    return nonGrounded == 4;
  }

  updateControls() {
    const driver = this.seats[0].seater;
    if (!driver) return;

    // const { w, a, s, d, " ": space } = driver.keys;

    this.throttle = 0;
    this.brake = 0;
    this.handbrake = 0;
    this.steer = 0;

    let forwardVel = 0;
    const vel = this.physicsObject.rigidBody.linvel();
    const forwardDir = new Vector3(0, 0, 1).applyQuaternion(this.quaternion);
    forwardVel = new Vector3(vel.x, vel.y, vel.z).dot(forwardDir);

    if (driver.actions.moveForward) this.throttle = 1;
    if (driver.actions.moveBackward) {
      if (forwardVel > 1) this.brake = 1;
      else this.throttle = -1;
    }

    if (driver.actions.jump) this.handbrake = 1;

    if (driver.actions.moveLeft) this.steer = 1;
    else if (driver.actions.moveRight) this.steer = -1;

    if (this.steer > 0) {
      this.ackermannAngleLeft =
        Math.atan(this.wheelBase / (this.turnRadius - this.rearTrack / 2)) *
        this.steer;
      this.ackermannAngleRight =
        Math.atan(this.wheelBase / (this.turnRadius + this.rearTrack / 2)) *
        this.steer;
    } else if (this.steer < 0) {
      this.ackermannAngleLeft =
        Math.atan(this.wheelBase / (this.turnRadius + this.rearTrack / 2)) *
        this.steer;
      this.ackermannAngleRight =
        Math.atan(this.wheelBase / (this.turnRadius - this.rearTrack / 2)) *
        this.steer;
    } else {
      this.ackermannAngleLeft = 0;
      this.ackermannAngleRight = 0;
    }

    const speed = new Vector3(vel.x, vel.y, vel.z).length();
    const steerFactor = Math.max(Math.min(1 - speed / 50, 1), 0.3);

    this.ackermannAngleLeft *= steerFactor;
    this.ackermannAngleRight *= steerFactor;
  }

  despawn() {
    this.seats.forEach((seat) => {
      if (seat.seater) {
        seat.seater.exitVehicle();
        seat.seater = null;
      }
    });
    this.hornPlaying = false;
    this.world.removeVehicle(this);
  }

  getSpeed() {
    return new Vector3(
      this.physicsObject.rigidBody.linvel().x,
      this.physicsObject.rigidBody.linvel().y,
      this.physicsObject.rigidBody.linvel().z
    ).length();
  }

  handleForeignCollision() {
    const phyWorld = PhysicsManager.getInstance().physicsWorld as RAPIER.World;
    const speed = this.getSpeed();

    phyWorld.contactPairsWith(this.physicsObject.collider, (otherCollider) => {
      const foundPlayer = this.world.getPlayerFromCollider(otherCollider);
      if (!foundPlayer || foundPlayer == this.getDriver()) return;

      const otherRb = otherCollider.parent();
      if (!otherRb) return;

      const myPos = this.physicsObject.rigidBody.translation();
      const otherPos = otherRb.translation();
      const toOther = {
        x: otherPos.x - myPos.x,
        y: otherPos.y - myPos.y,
        z: otherPos.z - myPos.z,
      };
      const len = Math.sqrt(
        toOther.x * toOther.x + toOther.y * toOther.y + toOther.z * toOther.z
      );
      if (len > 0) {
        toOther.x /= len;
        toOther.y /= len;
        toOther.z /= len;
      }

      const forwardDir = new Vector3(0, 0, 1).applyQuaternion(this.quaternion);

      const dot =
        forwardDir.x * toOther.x +
        forwardDir.y * toOther.y +
        forwardDir.z * toOther.z;

      if (dot < 0.5) return;

      const maxSpeed = 10;
      const maxDamage = 100;
      const damage = Math.min((speed / maxSpeed) * maxDamage, maxDamage);

      if (speed >= 1 && !foundPlayer.isDead) {
        foundPlayer.damage(damage);
      }
    });
  }

  teleportTo(position: Vector3) {
    PhysicsManager.getInstance().setTranslation(this.physicsObject, position);
  }

  update(delta: number) {
    const now = Date.now();
    this.handleForeignCollision();

    // respawn if stuck upside down too long
    if (this.isFlipped()) {
      if (!this.hasFlipped) {
        this.hasFlipped = true;
        this.lastFlipTime = Date.now();
      } else {
        if (Date.now() - this.lastFlipTime >= 2000 && this.getSpeed() < 5) {
          const pos = this.physicsObject.rigidBody.translation();
          this.teleportTo(new Vector3(pos.x, pos.y + 10, pos.z));

          this.physicsObject.rigidBody.setRotation(new Quaternion(), true);
          this.physicsObject.rigidBody.setLinvel(new Vector3(0, 0, 0), true);
          this.physicsObject.rigidBody.setAngvel(new Vector3(0, 0, 0), true);

          this.failedStunt = true; // this counts as fail
        }
      }
    } else {
      this.hasFlipped = false;
      this.lastFlipTime = -Infinity;
    }

    // went airborne
    if (this.isAirborne() && !this.isInAir) {
      this.isInAir = true;
      this.stuntAttempt = false;
      this.failedStunt = false;
    }

    // track stunt attempt
    if (this.isInAir && this.isFlipped()) {
      this.stuntAttempt = true;
    }

    // landed
    if (!this.isAirborne() && this.isInAir) {
      this.isInAir = false;

      if (this.stuntAttempt && !this.failedStunt && !this.isFlipped()) {
        const driver = this.getDriver();

        driver?.give("coin", 100);

        this.world.createServerNotification({
          recipient: driver?.id ?? "",
          type: "achievement",
          content: "Stunt completed! +100 coins!",
        });
      }

      this.stuntAttempt = false;
    }

    // Reset timer if anyone is in the car
    if (this.seats.some((seat) => seat.seater != null)) {
      this.lastTimeSinceOccupied = now;
    }

    // update wheels
    this.wheels.forEach((wheel) => {
      let targetSteerAngle = 0;
      if (wheel.wheelType === "FrontLeft")
        targetSteerAngle = this.ackermannAngleLeft;
      if (wheel.wheelType === "FrontRight")
        targetSteerAngle = this.ackermannAngleRight;

      wheel.steerAngle +=
        (targetSteerAngle - wheel.steerAngle) *
        Math.min(1, this.steerSpeed * delta);

      wheel.update(delta);
    });

    // sync position/rotation
    const { x, y, z } = this.physicsObject.rigidBody.translation();
    const rot = this.physicsObject.rigidBody.rotation();
    this.position.set(x, y, z);
    this.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    this.updateControls();

    if (now - this.lastTimeSinceOccupied >= INACTIVE_TIME_LIMIT * 1000) {
      this.despawn();
    }
  }
}
