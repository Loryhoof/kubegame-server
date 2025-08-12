import * as RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "./mathUtils";
// import { Quaternion, Vector3 } from "./interfaces/Math";

function distanceBetween(v1: Vector3, v2: Vector3): number {
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  const dz = v2.z - v1.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

let ray = new RAPIER.Ray(
  new RAPIER.Vector3(0, 0, 0),
  new RAPIER.Vector3(0, 0, 0)
);

let DOWN = new RAPIER.Vector3(0, -1, 0);

export interface PhysicsObject {
  rigidBody: any;
  collider: any;
}

export default class PhysicsManager {
  public gravity: any;
  public physicsWorld: any;
  private static instance: PhysicsManager;

  private physicsIsReady: boolean = false;

  private constructor() {}

  async init(): Promise<void> {
    await RAPIER.init();
    this.physicsIsReady = true;

    this.gravity = new RAPIER.Vector3(0.0, -9.81, 0.0); // - 9.81
    this.physicsWorld = new RAPIER.World(this.gravity);

    console.log("Rapier physics initialized");
  }

  async waitForPhysicsInit(): Promise<void> {
    if (this.physicsIsReady) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const checkReady = () => {
        if (this.physicsIsReady) {
          resolve();
        } else {
          setTimeout(checkReady, 50); // Check again in 50ms
        }
      };
      checkReady();
    });
  }

  public static getInstance(): PhysicsManager {
    if (!PhysicsManager.instance) {
      PhysicsManager.instance = new PhysicsManager();
    }
    return PhysicsManager.instance;
  }

  isReady(): boolean {
    return this.physicsIsReady;
  }

  remove(physicsObject: PhysicsObject) {
    this.physicsWorld.removeRigidBody(physicsObject.rigidBody);
  }

  createDynamicBox(position: Vector3, scale: Vector3): PhysicsObject {
    const rbDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
      position.x,
      position.y,
      position.z
    );
    const rigidBody = this.physicsWorld.createRigidBody(rbDesc);

    const colDesc = RAPIER.ColliderDesc.cuboid(scale.x, scale.y, scale.z);
    const collider = this.physicsWorld.createCollider(colDesc, rigidBody);

    return { rigidBody, collider };
  }

  grounded(rigidBody: RAPIER.RigidBody) {
    const origin = rigidBody.translation();
    const ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: 0, y: -1, z: 0 }
    );

    const maxToi = 1.0;
    const solid = false;
    let filterFlags = undefined;
    let filterGroups = undefined;
    let filterExcludeRigidBody = rigidBody;

    let hit = this.physicsWorld.castRay(
      ray,
      maxToi,
      solid,
      filterFlags,
      filterGroups,
      filterExcludeRigidBody
    );

    return hit != null;
  }

  createFixedBox(
    position: Vector3,
    scale: Vector3,
    rotation: Quaternion = new RAPIER.Quaternion(0, 0, 0, 1)
  ): PhysicsObject {
    const rbDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({
        w: rotation.w,
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      });
    const rigidBody = this.physicsWorld.createRigidBody(rbDesc);

    const colDesc = RAPIER.ColliderDesc.cuboid(
      scale.x / 2,
      scale.y / 2,
      scale.z / 2
    );
    const collider = this.physicsWorld.createCollider(colDesc, rigidBody);

    return { rigidBody, collider };
  }

  createPlayerCapsule(): PhysicsObject {
    let rbDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 5, 0)
      .lockRotations(); //kinematicVelocityBased
    let rigidBody = this.physicsWorld.createRigidBody(rbDesc);

    let halfHeight = 0.2; // weird s
    let radius = 0.275;

    let capsuleColDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
    let collider = this.physicsWorld.createCollider(capsuleColDesc, rigidBody);

    return { rigidBody, collider };
  }

  createCharacterController() {
    const controller = this.physicsWorld.createCharacterController(0.01);
    return controller;
  }

  setTranslation(physicsObject: PhysicsObject, vec: Vector3) {
    physicsObject.rigidBody.setTranslation(vec, true);
  }

  intersectShape(
    shapePos: any,
    shapeRot: any,
    shape: any,
    collisionGroup: number | undefined
  ) {
    return this.physicsWorld.intersectionWithShape(
      shapePos,
      shapeRot,
      shape,
      undefined,
      collisionGroup
    );
  }

  moveCharacter(
    controller: any,
    collider: any,
    rigidBody: any,
    translation: any | Vector3
  ) {
    controller.computeColliderMovement(collider, translation);

    let correctedMovement = controller.computedMovement();

    this.setLinearVelocity(rigidBody, correctedMovement);
  }

  raycast(origin: Vector3, dir: Vector3, rb: any) {
    ray.origin = origin;
    ray.dir = dir;

    let maxToi = 4.0;
    let solid = false;

    let hit = this.physicsWorld.castRay(
      ray,
      maxToi,
      solid,
      undefined,
      undefined,
      undefined,
      rb
    );

    if (hit !== null) {
      let hitPoint = ray.pointAt(hit.timeOfImpact);
      return distanceBetween(origin, hitPoint);
    }
    return null;
  }

  raycastFull(origin: Vector3, dir: Vector3, rb: any = undefined) {
    ray.origin = origin;
    ray.dir = dir;

    let maxToi = 4.0;
    let solid = false;

    let hit = this.physicsWorld.castRay(
      ray,
      maxToi,
      solid,
      undefined,
      undefined,
      undefined,
      rb
    );

    return { ray, hit };
  }

  setLinearVelocity(rigidBody: any, velocity: any | Vector3) {
    rigidBody.setLinvel(velocity, true);
  }

  update(elapsedTime: number, deltaTime: number) {
    if (!this.physicsIsReady) {
      return;
    }
    this.physicsWorld.step();
  }
}
