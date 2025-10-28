import * as RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "./mathUtils";

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
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

export default class PhysicsManager {
  public static gravity: any;
  private static physicsIsReady: boolean = false;

  static async init(): Promise<void> {
    await RAPIER.init();
    this.physicsIsReady = true;
    this.gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    console.log("Rapier physics initialized");
  }

  static async waitForPhysicsInit(): Promise<void> {
    if (this.physicsIsReady) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const checkReady = () => {
        if (this.physicsIsReady) {
          resolve();
        } else {
          setTimeout(checkReady, 50);
        }
      };
      checkReady();
    });
  }

  static isReady(): boolean {
    return this.physicsIsReady;
  }

  static createWorld(): RAPIER.World {
    return new RAPIER.World(
      this.gravity || new RAPIER.Vector3(0.0, -9.81, 0.0)
    );
  }

  static remove(world: RAPIER.World, physicsObject: PhysicsObject) {
    world.removeRigidBody(physicsObject.rigidBody);
    world.removeCollider(physicsObject.collider, true);
  }

  static createDynamicBox(
    world: RAPIER.World,
    position: Vector3,
    scale: Vector3
  ): PhysicsObject {
    const rbDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
      position.x,
      position.y,
      position.z
    );
    const rigidBody = world.createRigidBody(rbDesc);

    const colDesc = RAPIER.ColliderDesc.cuboid(scale.x, scale.y, scale.z);
    const collider = world.createCollider(colDesc, rigidBody);

    return { rigidBody, collider };
  }

  static grounded(world: RAPIER.World, rigidBody: RAPIER.RigidBody) {
    const origin = rigidBody.translation();
    const ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: 0, y: -1, z: 0 }
    );

    let hit = world.castRay(
      ray,
      1.0,
      false,
      undefined,
      undefined,
      undefined,
      rigidBody
    );
    return hit != null;
  }

  static createFixedBox(
    world: RAPIER.World,
    position: Vector3,
    scale: Vector3,
    rotation: Quaternion = new Quaternion(0, 0, 0, 1)
  ): PhysicsObject {
    const rbDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({
        w: rotation.w,
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      });
    const rigidBody = world.createRigidBody(rbDesc);

    const colDesc = RAPIER.ColliderDesc.cuboid(
      scale.x / 2,
      scale.y / 2,
      scale.z / 2
    );
    const collider = world.createCollider(colDesc, rigidBody);

    return { rigidBody, collider };
  }

  static createTrimesh(
    world: RAPIER.World,
    position: Vector3,
    rotation: Quaternion,
    vertices: Float32Array,
    indices: Uint32Array
  ) {
    const rbDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({
        w: rotation.w,
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      });
    const rigidBody = world.createRigidBody(rbDesc);

    const colDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
    const collider = world.createCollider(colDesc, rigidBody);

    return { rigidBody, collider };
  }

  static createPlayerCapsule(
    world: RAPIER.World,
    position: Vector3 = new Vector3(0, 5, 0)
  ): PhysicsObject {
    let rbDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .lockRotations();
    let rigidBody = world.createRigidBody(rbDesc);

    let halfHeight = 0.55;
    let radius = 0.275;

    let capsuleColDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
    let collider = world.createCollider(capsuleColDesc, rigidBody);

    return { rigidBody, collider };
  }

  static createCar(world: RAPIER.World, position: Vector3): PhysicsObject {
    let rbDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setAdditionalMass(1500);
    let rigidBody = world.createRigidBody(rbDesc);

    let boxColDesc = RAPIER.ColliderDesc.cuboid(1, 0.25, 2.5);
    let collider = world.createCollider(boxColDesc, rigidBody);

    return { rigidBody, collider };
  }

  static createCharacterController(world: RAPIER.World) {
    return world.createCharacterController(0.01);
  }

  static createHeightfield(
    world: RAPIER.World,
    position: Vector3,
    rotation: Quaternion,
    heights: Float32Array,
    scale: Vector3,
    nrows: number,
    ncols: number
  ) {
    const colliderDesc = RAPIER.ColliderDesc.heightfield(
      nrows,
      ncols,
      heights,
      scale
    );
    const collider = world.createCollider(colliderDesc);

    const rbDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({
        w: rotation.w,
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      });
    const rigidbody = world.createRigidBody(rbDesc);

    return { rigidbody, collider };
  }

  static setTranslation(physicsObject: PhysicsObject, vec: Vector3) {
    physicsObject.rigidBody.setTranslation(vec, true);
  }

  static intersectShape(
    world: RAPIER.World,
    shapePos: any,
    shapeRot: any,
    shape: any,
    filterExcludeCollider: any,
    filterExcludeRigidBody: any
  ) {
    return world.intersectionWithShape(
      shapePos,
      shapeRot,
      shape,
      undefined,
      undefined,
      filterExcludeCollider,
      filterExcludeRigidBody
    );
  }

  static getNearestColliderHitPosition(
    world: RAPIER.World,
    physicsObject: PhysicsObject
  ) {
    let shapeRot = { w: 1.0, x: 0.0, y: 0.0, z: 0.0 };
    let shape = new RAPIER.Cuboid(1.0, 1.0, 1.0);

    let pos = physicsObject.rigidBody.translation();
    pos.y = pos.y + 1;

    let hit = world.castShape(
      pos,
      shapeRot,
      { x: 0, y: 0, z: 1 },
      shape,
      0.0,
      1.0,
      true,
      undefined,
      0x000b0001,
      physicsObject.collider,
      physicsObject.rigidBody
    );

    return hit != null;
  }

  static moveCharacter(
    controller: any,
    collider: any,
    rigidBody: any,
    translation: any | Vector3
  ) {
    controller.computeColliderMovement(collider, translation);
    let correctedMovement = controller.computedMovement();
    rigidBody.setLinvel(correctedMovement, true);
  }

  static raycast(
    world: RAPIER.World,
    origin: Vector3,
    dir: Vector3,
    rb: any,
    toi: number = 4
  ) {
    ray.origin = origin;
    ray.dir = dir;

    let hit = world.castRay(
      ray,
      toi,
      false,
      undefined,
      undefined,
      undefined,
      rb
    );

    if (hit !== null) {
      let hitPoint = ray.pointAt(hit.timeOfImpact);
      return distanceBetween(origin, hitPoint as Vector3);
    }
    return null;
  }

  static raycastFull(
    world: RAPIER.World,
    origin: Vector3,
    dir: Vector3,
    rb: any,
    toi: number = 4
  ) {
    ray.origin = origin;
    ray.dir = dir;

    const hit = world.castRay(
      ray,
      toi,
      false,
      undefined,
      undefined,
      undefined,
      rb
    );

    let hitPos: Vector3 | null = null;
    if (hit) {
      const point = ray.pointAt(hit.timeOfImpact);
      hitPos = new Vector3(point.x, point.y, point.z);
    }

    return { ray, hit, hitPos };
  }

  static setLinearVelocity(rigidBody: any, velocity: any | Vector3) {
    rigidBody.setLinvel(velocity, true);
  }

  static update(world: RAPIER.World) {
    if (!this.physicsIsReady) {
      return;
    }
    world.step();
  }
}
