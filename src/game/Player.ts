import RAPIER, { QueryFilterFlags } from "@dimforge/rapier3d-compat";
import Vector3 from "./Math/Vector3";
import PhysicsManager, { PhysicsObject } from "./PhysicsManager";
import { Quaternion, randomFromArray, randomIntBetween } from "./mathUtils";
import Vehicle from "./Vehicle/Vehicle";
import { IHoldable } from "./interfaces/IHoldable";
import Weapon from "./Holdable/Weapon";
import Lobby from "./Lobby";
import { PlayerSettings } from "./Types/worldTypes";
import { UserService } from "../services/user.service";
import { it } from "node:test";

export type InputSeq = {
  seq: number;
  keys: any;
  dt: number;
};

type HoldItem = {
  name: string;
};

export type Hand = {
  side: "left" | "right";
  item?: IHoldable;
};

export type PlayerData = {
  velocity: Vector3;
  health: number;
  coins: number;
  ammo: number;
  id: string;
  position: Vector3;
  quaternion: Quaternion;
  color: string;
  keys: any;
  isSitting: boolean;
  controlledObject: { id: string } | null;
  lastProcessedInputSeq: number;
  nickname: string;
  leftHand: Hand;
  rightHand: Hand;
  viewQuaternion: Quaternion;
  isDead: boolean;
  killCount: number;
  lobbyId: string;
  selectedItemSlot: number;
  itemSlots: ItemSlot[];
};

export type ItemSlot = {
  item: IHoldable | undefined;
};

class Player {
  public id: string;
  public position: Vector3;
  public quaternion: Quaternion;
  public velocity: Vector3 = new Vector3(0, 0, 0);
  public color: string;
  public health: number = 100;
  public coins: number = 150;
  public ammo: number = 64;
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
  public actions: Record<string, boolean> = {};
  public prevActions: Record<string, boolean> = {};

  public isSitting: boolean = false;

  public lastProcessedInputSeq: number = 0;

  //
  public nickname: string | null = null;

  public leftHand: Hand;
  public rightHand: Hand;

  public viewQuaternion: Quaternion | null = null;

  public killCount: number = 0;
  public deathCount: number = 0;

  public isDead: boolean = false;

  public lobby: Lobby;

  private playerSettings: PlayerSettings;

  public userId: string;

  public selectedItemSlot: number = 0;

  public itemSlots: ItemSlot[];

  constructor(
    lobby: Lobby,
    id: string,
    position: Vector3,
    quaternion: Quaternion,
    color: string,
    playerSettings: PlayerSettings,
    userId: string
  ) {
    this.lobby = lobby;
    this.id = id;
    this.position = position;
    this.quaternion = quaternion;
    this.color = color;
    this.playerSettings = playerSettings;

    this.userId = userId;

    this.physicsObject = PhysicsManager.createPlayerCapsule(
      lobby.physicsWorld,
      position
    );

    this.itemSlots = [
      { item: undefined },
      { item: undefined },
      { item: undefined },
      { item: undefined },
    ];

    this.setupSettings();

    this.leftHand = { side: "left" };
    this.rightHand = {
      side: "right",
      item: this.itemSlots[this.selectedItemSlot].item,
    };

    // this.lobby.emitPlayerEvent(this, "player-init", {
    //   lobby: this.lobby.id,
    //   color: this.color,
    //   userId: this.userId,
    //   itemSlots: this.itemSlots,
    //   selectedItemSlot: this.selectedItemSlot,
    //   coins: this.coins,
    //   leftHand: this.leftHand,
    //   rightHand: this.rightHand,
    //   ammo: this.ammo,
    //   controlledObject: this.controlledObject ? this.controlledObject.id : null,
    //   killCount: this.killCount,
    //   deathCount: this.deathCount,
    //   isDead: this.isDead,
    //   health: this.health,
    // });
  }

  setupSettings() {
    this.playerSettings.itemSlots.forEach((slot, index) => {
      console.log(slot, slot.item);
      if (slot.item) {
        const name = slot.item;

        if (name == "pistol") this.itemSlots[index].item = new Weapon("pistol");
      }
    });
  }

  selectSlot(slot: number) {
    this.selectedItemSlot = slot;

    const item = this.itemSlots[this.selectedItemSlot].item;
    this.rightHand.item = item;

    this.lobby.emitPlayerEvent(this, "update-selected-slot", {
      value: this.selectedItemSlot,
    });
  }

  getHandItem(): IHoldable | null {
    return this.rightHand.item ?? null;
  }

  setNickname(n: string) {
    this.nickname = n;
    UserService.updateNickname(this.userId, n);
  }

  update(delta: number) {
    // if (!this.isDead && this.health <= 0) {
    //   this.isDead = true;
    // }

    // if (this.isDead) return;
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

    if (this.controlledObject) {
      this.isSitting = true;
      this.physicsObject.rigidBody.sleep();
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
    PhysicsManager.setLinearVelocity(rb, desired);

    // Sync position
    this.setPosition(rb.translation() as Vector3);

    // Reset jump state when on ground
    if (this.grounded) {
      this.isJumping = false;
    }
  }

  die() {
    this.isDead = true;
    this.physicsObject.rigidBody.sleep();

    this.deathCount++;
    UserService.updateDeathcount(this.userId, this.deathCount);
  }

  respawn() {
    this.health = 100;
    this.isDead = false;

    this.physicsObject.rigidBody.wakeUp();

    const spawnPosition =
      randomFromArray(this.lobby.worldSettings.spawnPoints) ??
      new Vector3(0, 5, 0);

    this.teleportTo(spawnPosition);

    this.lobby.emitPlayerEvent(this, "respawn");
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

    this.lobby.emitPlayerEvent(this, "update-health", {
      value: this.health,
    });
  }

  heal(amount: number) {
    if (this.health < 100) this.health += amount;
    if (this.health > 100) this.health = 100;

    this.lobby.emitPlayerEvent(this, "update-health", {
      value: this.health,
    });
  }

  incrementKillcount() {
    this.killCount++;
    UserService.updateKillcount(this.userId, this.killCount);
  }

  addCoins(amount: number) {
    this.coins += amount;
    UserService.updateCoins(this.userId, this.coins);

    this.lobby.emitPlayerEvent(this, "update-coins", { value: this.coins });
  }

  spendCoins(amount: number): boolean {
    if (this.coins < amount) {
      return false;
    }

    this.coins -= amount;
    UserService.updateCoins(this.userId, this.coins);

    this.lobby.emitPlayerEvent(this, "update-coins", { value: this.coins });

    return true;
  }

  give(item: any, amount: number) {
    if (item === "coin") this.addCoins(amount);
    if (item === "pistol") this.rightHand.item = new Weapon("pistol");
    if (item === "ammo") this.ammo += amount;
  }

  isGrounded(): boolean {
    return PhysicsManager.grounded(
      this.lobby.physicsWorld,
      this.physicsObject.rigidBody
    );
  }

  enterVehicle(vehicle: Vehicle) {
    vehicle.enterVehicle(this);
    this.controlledObject = vehicle;

    this.lobby.emitPlayerEvent(this, "enter-vehicle", { id: vehicle.id });
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

    this.lobby.emitPlayerEvent(this, "exit-vehicle");
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

export default Player;
