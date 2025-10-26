import Vector3 from "./Math/Vector3";
import PhysicsManager, { PhysicsObject } from "./PhysicsManager";
import {
  computeHitInfo,
  distanceDamageFactor,
  generateUUID,
  Quaternion,
  randomFromArray,
  randomIntBetween,
} from "./mathUtils";
import Vehicle from "./Vehicle/Vehicle";
import World from "./World";
import Player, { Hand } from "./Player";
import Lobby from "./Lobby";
import Weapon from "./Holdable/Weapon";
import { IHoldable } from "./interfaces/IHoldable";
import { findPath } from "./Utils/pathfinding";

const REPATH_DISTANCE_THRESHOLD = 3; // how far target can move before recalculating
const REACTION_MIN = 300;
const REACTION_MAX = 500;

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

  private lastShotTime: number = 0;
  private nextShotReadyAt: number | null = null;

  // strafing control
  private strafeDir: number = 1; // 1 = right, -1 = left
  private nextStrafeSwitch: number = 0;

  public controlledObject: Vehicle | null = null;

  // interaction
  public wantsToInteract: boolean = false;
  public lastInteractedTime: number = 0;

  // car spawning
  public lastSpawnedCarTime: number = 0;

  // anim/keys
  public actions: Record<string, boolean> = {};
  public prevActions: Record<string, boolean> = {};

  public isSitting: boolean = false;

  private world: World;

  private hasTarget: boolean = false;
  private currentTarget: Player | null = null;

  public isDead: boolean = false;

  public lobby: Lobby;

  public leftHand: Hand;
  public rightHand: Hand;

  public viewQuaternion: Quaternion;

  private nextStyleSwitch: number = 0;

  private sawTargetAt: number | null = null;

  // Path finding
  private path: Vector3[] = [];
  private pathIndex: number = 0;
  private repathAt: number = 0; // time for next recalculation
  private lastPathGoal: Vector3 | null = null;

  constructor(
    lobby: Lobby,
    world: World,
    position: Vector3,
    quaternion: Quaternion,
    color: string
  ) {
    this.lobby = lobby;
    this.world = world;
    this.id = generateUUID();
    this.position = position;
    this.quaternion = quaternion;
    this.color = color;

    this.leftHand = { side: "left" };

    const pistol = new Weapon("pistol");
    this.rightHand = { side: "right", item: pistol };

    this.physicsObject = PhysicsManager.createPlayerCapsule(
      this.lobby.physicsWorld,
      position
    );

    this.viewQuaternion = new Quaternion();
  }

  private requestPathTo(targetPos: Vector3) {
    const start = { x: this.position.x, z: this.position.z };
    const goal = { x: targetPos.x, z: targetPos.z };
    const navGrid = this.world.navCells;

    const newPath = findPath(start, goal, navGrid, new Vector3(-50, 0, -50), 1);

    if (newPath.length > 0) {
      this.path = newPath;
      this.pathIndex = 0;
      this.lastPathGoal = new Vector3(targetPos.x, targetPos.y, targetPos.z); // ✅ remember where we were pathing to
    }
  }

  handleCombat() {
    const wasMouseLeft = this.prevActions.shoot;
    const wasReload = this.prevActions.reload;

    const handItem = this.getHandItem() as Weapon | null;
    const aiming = this.actions.aim;

    if (aiming && handItem) {
      const now = Date.now();
      const firePressed = this.actions.shoot && !wasMouseLeft;
      const canShoot =
        now - handItem.lastShotTime >= (handItem.fireRateMs || 100) &&
        !handItem.isReloading;

      if (firePressed && canShoot && handItem.ammo > 0) {
        handItem.ammo--;
        handItem.lastShotTime = now;

        this.world.shotFired(this.position);

        let shootDir: Vector3;
        if (this.currentTarget) {
          shootDir = new Vector3(
            this.currentTarget.position.x,
            this.currentTarget.position.y,
            this.currentTarget.position.z
          )
            .clone()
            .sub(this.position)
            .normalize();

          // add distance-based spread
          const distance = new Vector3(
            this.currentTarget.position.x,
            this.currentTarget.position.y,
            this.currentTarget.position.z
          ).distanceTo(this.position);
          const spread = 0.01 + distance * 0.001;
          shootDir.x += (Math.random() - 0.5) * spread;
          shootDir.y += (Math.random() - 0.5) * spread;
          shootDir.z += (Math.random() - 0.5) * spread;
          shootDir.normalize();
        } else {
          shootDir = new Vector3(0, 0, -1)
            .applyQuaternion(this.viewQuaternion)
            .normalize();
        }

        const hit = PhysicsManager.raycastFull(
          this.world.lobby.physicsWorld,
          this.position,
          shootDir,
          this.physicsObject.rigidBody,
          100
        );

        if (hit?.hit) {
          const hitPlayer = this.world.getPlayerFromCollider(hit.hit.collider);

          if (hitPlayer) {
            const worldHit = hit.hitPos!;
            const {
              distance,
              hitBodyPart,
              bodyPartMultiplier,
              falloffStart,
              falloffEnd,
              minFactor,
            } = computeHitInfo(this.position, worldHit, hit.hit.collider);

            const baseDamage = handItem.damage ?? 25;
            const finalDamage =
              baseDamage *
              bodyPartMultiplier *
              distanceDamageFactor(
                distance,
                falloffStart,
                falloffEnd,
                minFactor
              );

            hitPlayer.damage(finalDamage);
            this.world.registerHit(worldHit, hitPlayer.id, hitBodyPart);
          } else {
            this.world.registerHit(hit.hitPos!);
          }
        }
      } else {
        const weapon = this.getHandItem() as Weapon;
        if (weapon.ammo <= 0) {
          weapon.reload(weapon.capacity);
        }
      }
    }
  }

  hasLineOfSight(target: Player): boolean {
    const eyePos = this.position.clone();
    const toTarget = target.position.clone().sub(eyePos).normalize();

    const hit = PhysicsManager.raycastFull(
      this.lobby.physicsWorld,
      eyePos,
      toTarget,
      this.physicsObject.rigidBody,
      100
    );

    if (hit?.hit) {
      const hitPlayer = this.world.getPlayerFromCollider(hit.hit.collider);
      return hitPlayer?.id === target.id;
    }
    return false;
  }

  updateAI(delta: number) {
    this.prevActions = { ...this.actions };

    if (!this.alive()) return;

    const MOVEMENT_SPEED = 4;
    const FIRE_INTERVAL = randomIntBetween(500, 1000);
    const MAX_COMBAT_DIST = 30;
    const REPATH_DISTANCE_THRESHOLD = 3;

    const { players } = this.world.getState();
    if (players.size === 0) return;

    // ----------------------------
    // ✅ Target selection
    // ----------------------------
    if (!this.currentTarget || !players.has(this.currentTarget.id)) {
      this.currentTarget = randomFromArray(Array.from(players.values()));
      this.nextShotReadyAt = null;
      this.sawTargetAt = null;
      this.path = [];
      this.pathIndex = 0;
      this.lastPathGoal = null;
    }
    if (!this.currentTarget) return;

    // compute direction
    const toTarget = new Vector3(
      this.currentTarget.position.x - this.position.x,
      this.currentTarget.position.y - this.position.y,
      this.currentTarget.position.z - this.position.z
    );
    const dirToTarget = toTarget.clone().normalize();
    const distance = toTarget.length();

    // ----------------------------
    // ✅ LOS check
    // ----------------------------
    let hasLOS = false;
    const hit = PhysicsManager.raycastFull(
      this.lobby.physicsWorld,
      this.position,
      dirToTarget,
      this.physicsObject.rigidBody,
      100
    );
    if (hit?.hit) {
      const hitPlayer = this.world.getPlayerFromCollider(hit.hit.collider);
      hasLOS = hitPlayer?.id === this.currentTarget.id;
    }

    // ============================================================
    // ✅ NO LOS → PATHFIND
    // ============================================================
    if (!hasLOS) {
      this.actions["aim"] = false;
      this.actions["shoot"] = false;
      this.sawTargetAt = null;

      const targetMovedTooFar =
        !this.lastPathGoal ||
        this.lastPathGoal.distanceTo(this.currentTarget.position) >
          REPATH_DISTANCE_THRESHOLD;

      if (targetMovedTooFar && Date.now() > this.repathAt) {
        this.requestPathTo(this.currentTarget.position);
        this.repathAt = Date.now() + randomIntBetween(1000, 2000);
      }

      if (this.path.length > 0) {
        const nextPoint = this.path[this.pathIndex];
        const toNext = new Vector3(
          nextPoint.x - this.position.x,
          nextPoint.y - this.position.y,
          nextPoint.z - this.position.z
        );
        const distToNext = toNext.length();

        if (distToNext < 1 && this.pathIndex < this.path.length - 1) {
          this.pathIndex++;
          return;
        }

        toNext.normalize();
        const speed = distance > 6 ? MOVEMENT_SPEED * 2 : MOVEMENT_SPEED;
        this.velocity.copy(toNext.multiplyScalar(speed));

        const ang = Math.atan2(toNext.x, toNext.z) + Math.PI;
        this.setQuaternion(
          new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ang)
        );
      } else {
        this.velocity.set(0, 0, 0);
      }

      return;
    }

    // ============================================================
    // ✅ HAS LOS BUT TOO FAR → MOVE CLOSER
    // ============================================================
    if (distance > MAX_COMBAT_DIST) {
      this.actions["aim"] = false;
      this.actions["shoot"] = false;
      this.sawTargetAt = null;
      this.path = [];

      const forward = dirToTarget.clone().normalize();
      this.velocity.copy(forward.multiplyScalar(MOVEMENT_SPEED));

      const ang = Math.atan2(toTarget.x, toTarget.z) + Math.PI;
      this.setQuaternion(
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ang)
      );

      return;
    }

    // ============================================================
    // ✅ COMBAT MODE (LOS + IN RANGE)
    // ============================================================
    this.actions["aim"] = true;
    this.path = [];

    const ang = Math.atan2(toTarget.x, toTarget.z) + Math.PI;
    const lookQuat = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      ang
    );
    this.setQuaternion(lookQuat);
    this.viewQuaternion = lookQuat;

    // ✅ REACTION DELAY (no instant shooting)
    if (this.sawTargetAt === null) {
      this.sawTargetAt = Date.now();
      this.velocity.set(0, 0, 0);
      return;
    }
    const reacted =
      Date.now() - this.sawTargetAt >=
      randomIntBetween(REACTION_MIN, REACTION_MAX);

    if (!reacted) {
      this.velocity.set(0, 0, 0);
      return;
    }

    // 🎯 MOVEMENT STYLE
    if (!this.nextStyleSwitch || Date.now() > this.nextStyleSwitch) {
      (this as any).combatStyle = Math.random() < 0.6 ? "strafe" : "stand";
      this.nextStyleSwitch = Date.now() + randomIntBetween(2000, 4000);
      this.nextStrafeSwitch = 0;
    }

    if ((this as any).combatStyle === "strafe") {
      if (Date.now() > this.nextStrafeSwitch) {
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
        this.nextStrafeSwitch = Date.now() + randomIntBetween(1000, 2000);
      }

      const forward = new Vector3(dirToTarget.x, 0, dirToTarget.z).normalize();
      const right = new Vector3(forward.z, 0, -forward.x).normalize();

      const strafe = right.multiplyScalar(
        this.strafeDir * MOVEMENT_SPEED * 0.7
      );
      const advance = forward.multiplyScalar(MOVEMENT_SPEED * 0.2);

      this.velocity.copy(strafe.add(advance));
    } else {
      this.velocity.set(0, 0, 0);
    }

    // 🔫 SHOOTING (after reaction delay)
    if (this.nextShotReadyAt === null) {
      this.nextShotReadyAt = Date.now() + randomIntBetween(200, 600);
    }
    if (
      Date.now() >= this.nextShotReadyAt &&
      Date.now() - this.lastShotTime >= FIRE_INTERVAL
    ) {
      this.shoot();
    }
  }

  shoot() {
    if (!this.actions["aim"]) return;
    this.actions["shoot"] = true;
    this.handleCombat();
    this.actions["shoot"] = false;
    this.lastShotTime = Date.now();
  }

  alive(): boolean {
    return this.health > 0;
  }

  handleDeath() {
    if (this.isDead) return;
    this.isDead = true;
    this.velocity.set(0, 0, 0);
    this.physicsObject.rigidBody.sleep();
    this.lobby.physicsWorld.removeCollider(this.physicsObject.collider, true);
    this.world.removeNPC(this, 2000);
  }

  getHandItem(): IHoldable | null {
    return this.rightHand.item ?? null;
  }

  update(delta: number) {
    if (!this.alive()) this.handleDeath();
    this.updateAI(delta);

    if (this.position.y <= -100) {
      this.teleportTo(new Vector3(0, 5, 0));
    }

    if (this.isGrounded()) {
      this.grounded = true;
      this.lastGroundedTime = Date.now();
    } else {
      this.grounded = false;
    }

    const displacement = this.velocity.clone().multiplyScalar(0.03 * 20);
    const linVel = this.physicsObject.rigidBody.linvel();
    displacement.y = linVel.y;

    PhysicsManager.setLinearVelocity(
      this.physicsObject.rigidBody,
      displacement
    );
    this.setPosition(this.physicsObject.rigidBody.translation() as Vector3);

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
    PhysicsManager.setTranslation(this.physicsObject, position);
  }

  damage(amount: number) {
    this.health -= amount;
  }
  heal(amount: number) {
    if (this.health < 100) this.health += amount;
    if (this.health > 100) this.health = 100;
  }

  isGrounded(): boolean {
    return PhysicsManager.grounded(
      this.lobby.physicsWorld,
      this.physicsObject.rigidBody
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
      this.physicsObject.rigidBody.applyImpulse({ x: 0, y: 1.5, z: 0 }, true);
    }
  }
}

export default NPC;
