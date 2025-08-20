import Quaternion from "./Math/Quaternion";
import Vector3 from "./Math/Vector3";

function generateUUID() {
  // RFC4122 version 4 compliant UUID generator (simple)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getVectorLength(vec: Vector3) {
  return Math.sqrt(vec.x ** 2 + vec.y ** 2 + vec.z ** 2);
}

function randomHex(): string {
  return (
    "#" +
    Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getYRotationQuaternion(q: Quaternion): Quaternion {
  // Convert quaternion to Euler angles (yaw, pitch, roll)
  // Then rebuild a quaternion with only yaw

  const { x, y, z, w } = q;

  // Yaw (rotation around Y-axis)
  const yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x));

  // Build quaternion for rotation around Y by yaw angle
  const halfYaw = yaw / 2;

  return new Quaternion(0, Math.sin(halfYaw), 0, Math.cos(halfYaw));
}

function applyQuaternion(vec: Vector3, q: Quaternion): Vector3 {
  const x = vec.x,
    y = vec.y,
    z = vec.z;
  const qx = q.x,
    qy = q.y,
    qz = q.z,
    qw = q.w;

  // calculate quat * vector
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return new Vector3(
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx
  );
}

function randomIntBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isFacingHit(
  playerPos: Vector3,
  playerQuat: Quaternion,
  hitPos: Vector3,
  maxAngleDeg: number = 45
) {
  // Direction from player to hit
  const dir = new Vector3(
    hitPos.x - playerPos.x,
    hitPos.y - playerPos.y,
    hitPos.z - playerPos.z
  ).normalize();

  // Player forward vector

  const quat = {
    x: playerQuat.x,
    y: playerQuat.y,
    z: playerQuat.z,
    w: playerQuat.w,
  };

  const forward = new Vector3(0, 0, -1).applyQuaternion(quat).normalize();

  // Angle between vectors
  const dot = forward.dot(dir);
  const angleDeg = Math.acos(Math.min(Math.max(dot, -1), 1)) * (180 / Math.PI);

  return angleDeg <= maxAngleDeg;
}

function getYawQuaternion(q: Quaternion): Quaternion {
  // Convert quaternion to Euler angles (pitch, yaw, roll)
  // We'll only keep the yaw (rotation around Y axis)

  const ysqr = q.y * q.y;

  // yaw (y-axis rotation)
  const t3 = +2.0 * (q.w * q.y + q.z * q.x);
  const t4 = +1.0 - 2.0 * (ysqr + q.z * q.z);
  const yaw = Math.atan2(t3, t4);

  // Construct a new quaternion representing yaw only
  // Quaternion for yaw angle around Y axis is:
  // q = [0, sin(yaw/2), 0, cos(yaw/2)]

  return new Quaternion(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
}

function eulerToQuaternion(pitch: number, yaw: number, roll: number) {
  const cy = Math.cos(yaw * 0.5);
  const sy = Math.sin(yaw * 0.5);
  const cp = Math.cos(pitch * 0.5);
  const sp = Math.sin(pitch * 0.5);
  const cr = Math.cos(roll * 0.5);
  const sr = Math.sin(roll * 0.5);

  return {
    x: sr * cp * cy - cr * sp * sy,
    y: cr * sp * cy + sr * cp * sy,
    z: cr * cp * sy - sr * sp * cy,
    w: cr * cp * cy + sr * sp * sy,
  };
}
function slerp(
  q1: { x: number; y: number; z: number; w: number },
  q2: { x: number; y: number; z: number; w: number },
  t: number
) {
  // Calculate angle between them.
  let cosHalfTheta = q1.w * q2.w + q1.x * q2.x + q1.y * q2.y + q1.z * q2.z;

  if (Math.abs(cosHalfTheta) >= 1.0) {
    // quaternions are very close, so just return q1
    return q1;
  }

  // If q2 is on opposite hemisphere from q1, invert q2 to take shorter path
  if (cosHalfTheta < 0) {
    q2 = { x: -q2.x, y: -q2.y, z: -q2.z, w: -q2.w };
    cosHalfTheta = -cosHalfTheta;
  }

  const halfTheta = Math.acos(cosHalfTheta);
  const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

  if (Math.abs(sinHalfTheta) < 0.001) {
    // Quaternions are very close, linear interpolate
    return {
      w: 0.5 * (q1.w + q2.w),
      x: 0.5 * (q1.x + q2.x),
      y: 0.5 * (q1.y + q2.y),
      z: 0.5 * (q1.z + q2.z),
    };
  }

  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

  return {
    w: q1.w * ratioA + q2.w * ratioB,
    x: q1.x * ratioA + q2.x * ratioB,
    y: q1.y * ratioA + q2.y * ratioB,
    z: q1.z * ratioA + q2.z * ratioB,
  };
}

/**
 * Compute a point on a cubic Bezier curve at t.
 */
function cubicBezierPoint(
  t: number,
  p0: Vector3,
  p1: Vector3,
  p2: Vector3,
  p3: Vector3
): Vector3 {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return p0
    .clone()
    .multiplyScalar(uuu)
    .add(p1.clone().multiplyScalar(3 * uu * t))
    .add(p2.clone().multiplyScalar(3 * u * tt))
    .add(p3.clone().multiplyScalar(ttt));
}

/**
 * Approximate the distance from a point to a cubic Bezier curve.
 */
function distanceToBezier(
  point: Vector3,
  p0: Vector3,
  p1: Vector3,
  p2: Vector3,
  p3: Vector3,
  steps = 100
): number {
  let minDist = Infinity;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const curvePoint = cubicBezierPoint(t, p0, p1, p2, p3);
    const dist = point.distanceTo(curvePoint);
    if (dist < minDist) minDist = dist;
  }

  return minDist;
}

function worldToGrid(
  worldX: number,
  worldZ: number,
  terrainScale: Vector3,
  nrows: number,
  ncols: number
) {
  const gridX = Math.round(
    ((worldX - terrainScale.x / 2) / terrainScale.x) * nrows
  );
  const gridZ = Math.round(
    ((worldZ - terrainScale.z / 2) / terrainScale.z) * ncols
  );
  return { gridX, gridZ };
}

export {
  getYRotationQuaternion,
  applyQuaternion,
  Vector3,
  Quaternion,
  randomHex,
  generateUUID,
  randomIntBetween,
  eulerToQuaternion,
  slerp,
  getYawQuaternion,
  isFacingHit,
  clamp,
  getVectorLength,
  distanceToBezier,
  cubicBezierPoint,
  worldToGrid,
};
