import RAPIER, { QueryFilterFlags } from "@dimforge/rapier3d-compat";
import Vector3 from "./Math/Vector3";
import PhysicsManager, { PhysicsObject } from "./PhysicsManager";
import { Quaternion } from "./mathUtils";
import Vehicle from "./Vehicle/Vehicle";

export type InputSeq = {
  seq: number;
  keys: any;
  dt: number;
};

class Player {
  public id: string;
  public position: Vector3;
  public quaternion: Quaternion;
  public velocity: Vector3 = new Vector3(0, 0, 0);
  public color: string;
  public health: number = 100;
  public coins: number = 0;
  public lastAttackTime: number = 0;
  public controller: any | undefined;
  public physicsObject: PhysicsObject;
  public grounded: boolean = false;

  // Jump control variables
  private isJumping: boolean = false;
  private lastJumpTime: number = 0;
  private lastGroundedTime: number = 0;
  private jumpCooldown: number = 200; // ms between jumps
  private coyoteTime: number = 100; // ms grace period after leaving ground

  public controlledObject: Vehicle | null = null;

  // interaction
  public wantsToInteract: boolean = false;
  public lastInteractedTime: number = 0;

  // car spawning
  public lastSpawnedCarTime: number = 0;

  // anim/keys
  public keys: Record<string, boolean> = {};

  public isSitting: boolean = false;

  public lastProcessedInputSeq: number = 0;

  constructor(
    id: string,
    position: Vector3,
    quaternion: Quaternion,
    color: string
  ) {
    this.id = id;
    this.position = position;
    this.quaternion = quaternion;
    this.color = color;

    this.physicsObject = PhysicsManager.getInstance().createPlayerCapsule();
  }

  update(delta: number) {
    if (this.controlledObject) {
      this.isSitting = true;
      this.physicsObject.rigidBody.sleep();
      // this.setPosition(
      //   this.controlledObject.physicsObject.rigidBody.translation() as Vector3
      // );

      const seatPos = this.controlledObject.getSeatPosition(this);
      this.setPosition(seatPos);

      // please fix this.. we do opposite quaternion which i feel like is bad at runtime
      const oppositeQuat = new Quaternion();
      oppositeQuat.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);

      this.setQuaternion(
        this.controlledObject.quaternion.clone().multiply(oppositeQuat)
      );
      return;
    } else {
      this.isSitting = false;
    }

    // Check grounded before movement
    if (this.isGrounded()) {
      this.grounded = true;
      this.lastGroundedTime = Date.now();
    } else {
      this.grounded = false;
    }

    //const displacement = this.velocity.clone().multiplyScalar(delta);

    const rb = this.physicsObject.rigidBody;

    const current = rb.linvel();

    const desired = { x: this.velocity.x, y: current.y, z: this.velocity.z };

    // Apply movement
    PhysicsManager.getInstance().setLinearVelocity(rb, desired);

    // Sync position
    this.setPosition(rb.translation() as Vector3);

    // Reset jump state when on ground
    if (this.grounded) {
      this.isJumping = false;
    }
  }

  setPosition(position: Vector3) {
    this.position = position;
  }
  setQuaternion(quaternion: Quaternion) {
    this.quaternion = quaternion;
  }

  teleportTo(position: Vector3) {
    PhysicsManager.getInstance().setTranslation(this.physicsObject, position);
  }

  damage(amount: number) {
    this.health -= amount;
  }

  heal(amount: number) {
    if (this.health < 100) this.health += amount;
    if (this.health > 100) this.health = 100;
  }

  give(item: any, amount: number) {
    if (item === "coin") this.coins += amount;
  }

  isGrounded(): boolean {
    return PhysicsManager.getInstance().grounded(this.physicsObject.rigidBody);
  }

  enterVehicle(vehicle: Vehicle) {
    vehicle.enterVehicle(this);
    this.controlledObject = vehicle;
  }

  exitVehicle() {
    if (!this.controlledObject) return;

    const lastPosition = this.controlledObject.position.clone();
    const lastQuaternion = this.controlledObject.quaternion.clone();

    this.controlledObject.exitVehicle(this);
    this.controlledObject = null;

    this.teleportTo(
      lastPosition.add(new Vector3(2, 0, 0).applyQuaternion(lastQuaternion))
    );
  }

  jump() {
    const now = Date.now();
    const canJump =
      (this.grounded || now - this.lastGroundedTime <= this.coyoteTime) &&
      now - this.lastJumpTime > this.jumpCooldown;

    if (canJump) {
      this.lastJumpTime = now;
      this.isJumping = true;
      this.physicsObject.rigidBody.applyImpulse({ x: 0, y: 0.8, z: 0 }, true);
    }
  }
}

export default Player;
