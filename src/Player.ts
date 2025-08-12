import Vector3 from "./Math/Vector3";
import { Quaternion } from "./mathUtils";
import PhysicsManager, { PhysicsObject } from "./PhysicsManager";

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

  // interaction
  public wantsToInteract: boolean = false;

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

  update() {
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
    this.setPosition(this.physicsObject.rigidBody.translation());

    // Reset jump state when on ground
    if (this.grounded) {
      this.isJumping = false;
    }
  }

  setPosition(position: Vector3) {
    this.position = position;
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
