import Vector3 from "./Math/Vector3";
import PhysicsManager, { PhysicsObject } from "./PhysicsManager";
import { generateUUID, Quaternion, randomFromArray } from "./mathUtils";
import Vehicle from "./Vehicle/Vehicle";
import World from "./World";
import Player from "./Player";

class NPC {
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

  private world: World;

  private hasTarget: boolean = false;
  private currentTarget: Player | null = null;

  constructor(
    world: World,
    position: Vector3,
    quaternion: Quaternion,
    color: string
  ) {
    this.world = world;
    this.id = generateUUID();
    this.position = position;
    this.quaternion = quaternion;
    this.color = color;

    this.physicsObject = PhysicsManager.getInstance().createPlayerCapsule();
  }

  updateAI(delta: number) {
    const MIN_DISTANCE = 3;
    const MOVEMENT_SPEED = 4;

    const { players } = this.world.getState();

    if (players.size == 0) return;
    if (!this.currentTarget || !players.has(this.currentTarget.id))
      this.currentTarget = randomFromArray(Array.from(players.values()));

    if (this.currentTarget == null) return;

    const distance = new Vector3(
      this.currentTarget.position.x,
      this.currentTarget.position.y,
      this.currentTarget.position.z
    ).distanceTo(
      new Vector3(this.position.x, this.position.y, this.position.z)
    );

    if (distance <= MIN_DISTANCE) {
      this.velocity.set(0, 0, 0);
    } else {
      const dir = new Vector3()
        .copy(this.currentTarget.position)
        .sub(this.position)
        .normalize();

      const speedFactor = distance > 10 ? 2 : 1;

      this.velocity.copy(dir.multiplyScalar(MOVEMENT_SPEED * speedFactor));

      console.log(this.velocity.length());

      const angle = Math.atan2(dir.x, dir.z) + Math.PI;
      const lookQuat = new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        angle
      );
      this.setQuaternion(lookQuat);
    }
  }

  update(delta: number) {
    this.updateAI(delta);
    // if (this.controlledObject) {
    //   this.isSitting = true;
    //   this.physicsObject.rigidBody.sleep();
    //   // this.setPosition(
    //   //   this.controlledObject.physicsObject.rigidBody.translation() as Vector3
    //   // );

    //   const seatPos = this.controlledObject.getSeatPosition(this);
    //   this.setPosition(seatPos);

    //   // please fix this.. we do opposite quaternion which i feel like is bad at runtime
    //   const oppositeQuat = new Quaternion();
    //   oppositeQuat.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);

    //   this.setQuaternion(
    //     this.controlledObject.quaternion.clone().multiply(oppositeQuat)
    //   );
    //   return;
    // } else {
    //   this.isSitting = false;
    // }

    if (this.health <= 0) {
      this.health = 100;
      this.teleportTo(new Vector3(0, 5, 0));
    }

    // Check grounded before movement
    if (this.isGrounded()) {
      this.grounded = true;
      this.lastGroundedTime = Date.now();
    } else {
      this.grounded = false;
    }

    const displacement = this.velocity.clone().multiplyScalar(0.03 * 20);

    // Preserve current vertical velocity from physics
    const linVel = this.physicsObject.rigidBody.linvel();
    displacement.y = linVel.y;

    // Apply movement
    PhysicsManager.getInstance().setLinearVelocity(
      this.physicsObject.rigidBody,
      displacement
    );

    // Sync position
    this.setPosition(this.physicsObject.rigidBody.translation() as Vector3);

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
    console.log(this.health);
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

export default NPC;
