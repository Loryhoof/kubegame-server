type Vector3 = { x: number; y: number; z: number };
type Quaternion = { x: number; y: number; z: number; w: number };

const zeroVector: Vector3 = { x: 0, y: 0, z: 0 };
const zeroQuaternion: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

function generateUUID() {
  // RFC4122 version 4 compliant UUID generator (simple)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function randomHex(): string {
  return (
    "#" +
    Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")
  );
}

function getYRotationQuaternion(q: Quaternion): Quaternion {
  // Convert quaternion to Euler angles (yaw, pitch, roll)
  // Then rebuild a quaternion with only yaw

  const { x, y, z, w } = q;

  // Yaw (rotation around Y-axis)
  const yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x));

  // Build quaternion for rotation around Y by yaw angle
  const halfYaw = yaw / 2;
  return {
    x: 0,
    y: Math.sin(halfYaw),
    z: 0,
    w: Math.cos(halfYaw),
  };
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

  // calculate result * inverse quat
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

function randomIntBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export {
  getYRotationQuaternion,
  applyQuaternion,
  Vector3,
  Quaternion,
  zeroVector,
  zeroQuaternion,
  randomHex,
  generateUUID,
  randomIntBetween,
};
