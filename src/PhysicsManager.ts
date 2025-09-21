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
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
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
    this.physicsWorld.removeCollider(physicsObject.collider);
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
    const rigidBody = this.physicsWorld.createRigidBody(rbDesc);

    const colDesc = RAPIER.ColliderDesc.cuboid(
      scale.x / 2,
      scale.y / 2,
      scale.z / 2
    );
    const collider = this.physicsWorld.createCollider(colDesc, rigidBody);

    return { rigidBody, collider };
  }

  createTrimesh(
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
    const rigidBody = this.physicsWorld.createRigidBody(rbDesc);

    const colDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);

    const collider = this.physicsWorld.createCollider(colDesc, rigidBody);

    return { rigidBody, collider };
  }

  createPlayerCapsule(): PhysicsObject {
    let rbDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 5, 0)
      .lockRotations(); //kinematicVelocityBased
    let rigidBody = this.physicsWorld.createRigidBody(rbDesc);

    let halfHeight = 0.55; // weird s
    let radius = 0.275;

    let capsuleColDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
    let collider = this.physicsWorld.createCollider(capsuleColDesc, rigidBody);

    return { rigidBody, collider };
  }

  createCar(position: Vector3): PhysicsObject {
    let rbDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setAdditionalMass(1500);
    let rigidBody = this.physicsWorld.createRigidBody(rbDesc);

    let boxColDesc = RAPIER.ColliderDesc.cuboid(1, 0.25, 2);
    let collider = this.physicsWorld.createCollider(boxColDesc, rigidBody);

    return { rigidBody, collider };
  }

  createCharacterController() {
    const controller = this.physicsWorld.createCharacterController(0.01);
    return controller;
  }

  createHeightfield(
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
    const collider = this.physicsWorld.createCollider(colliderDesc);

    const rbDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({
        w: rotation.w,
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      });
    const rigidbody = this.physicsWorld.createRigidBody(rbDesc);

    return { rigidbody, collider };
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

  getNearestColliderHitPosition(physicsObject: PhysicsObject) {
    let shapeRot = { w: 1.0, x: 0.0, y: 0.0, z: 0.0 };
    let shape = new RAPIER.Cuboid(1.0, 1.0, 1.0);
    let targetDistance = 0.0;
    let maxToi = 1.0;
    // Optional parameters:
    let stopAtPenetration = true;
    let filterFlags = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC;
    let filterGroups = 0x000b0001;
    let filterExcludeCollider = physicsObject.collider;
    let filterExcludeRigidBody = physicsObject.rigidBody;

    let pos = physicsObject.rigidBody.translation();
    pos.y = pos.y + 1;

    let hit = PhysicsManager.getInstance().physicsWorld.castShape(
      pos,
      shapeRot,
      { x: 0, y: 0, z: 1 }, //physicsObject.rigidBody.linvel(),
      shape,
      targetDistance,
      maxToi,
      stopAtPenetration,
      undefined, // "Filterflags"
      filterGroups,
      filterExcludeCollider,
      filterExcludeRigidBody
    );

    if (hit != null) {
      return true;
    } else {
      return false;
    }

    // if (hit != null) {
    //   const collider = hit.collider;
    //   const rb = collider.parent();
    //   if (rb) {
    //     const pos = rb.translation(); // world position of the object
    //     return pos;
    //   }
    // }

    return null;
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

  raycast(origin: Vector3, dir: Vector3, rb: any, toi: number = 4) {
    ray.origin = origin;
    ray.dir = dir;

    let maxToi = toi;
    let solid = false;

    let hit = (this.physicsWorld as RAPIER.World).castRay(
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
      return distanceBetween(origin, hitPoint as Vector3);
    }
    return null;
  }

  raycastFull(origin: Vector3, dir: Vector3, rb: any, toi: number = 4) {
    ray.origin = origin;
    ray.dir = dir;

    const hit = this.physicsWorld.castRay(
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
      const point = ray.pointAt(hit.timeOfImpact); // Rapier Vec3
      hitPos = new Vector3(point.x, point.y, point.z); // Convert to THREE vec
    }

    return { ray, hit, hitPos };
  }

  // getPlayerFromCollider(collider: any) {
  //   if (!collider) return;

  //   // this.physicsWorld.colliders.forEach((col: any) => {
  //   //   console.log(collider.handle, col.handle);
  //   //   if (collider.handle == col.handle) {
  //   //     console.log("Found it");
  //   //   }
  //   // });
  // }

  setLinearVelocity(rigidBody: any, velocity: any | Vector3) {
    rigidBody.setLinvel(velocity, true);
  }

  update() {
    if (!this.physicsIsReady) {
      return;
    }
    (this.physicsWorld as RAPIER.World).step();
  }
}
