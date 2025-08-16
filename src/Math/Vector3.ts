export default class Vector3 {
  public x: number;
  public y: number;
  public z: number;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(vec: Vector3): this {
    this.x += vec.x;
    this.y += vec.y;
    this.z += vec.z;
    return this;
  }

  sub(vec: Vector3): this {
    this.x -= vec.x;
    this.y -= vec.y;
    this.z -= vec.z;
    return this;
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  multiplyScalar(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  distanceTo(vec: Vector3): number {
    const dx = this.x - vec.x;
    const dy = this.y - vec.y;
    const dz = this.z - vec.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }

  // --- New Methods ---

  normalize(): this {
    const length = Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
    if (length > 0) {
      this.x /= length;
      this.y /= length;
      this.z /= length;
    }
    return this;
  }

  length(): number {
    return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
  }

  applyQuaternion(q: { x: number; y: number; z: number; w: number }): this {
    const x = this.x,
      y = this.y,
      z = this.z;
    const qx = q.x,
      qy = q.y,
      qz = q.z,
      qw = q.w;

    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;

    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;

    return this;
  }

  // Dot product with another vector
  dot(vec: Vector3): number {
    return this.x * vec.x + this.y * vec.y + this.z * vec.z;
  }

  copy(vec: Vector3): this {
    this.x = vec.x;
    this.y = vec.y;
    this.z = vec.z;
    return this;
  }
}
