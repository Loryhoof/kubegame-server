export default class Quaternion {
  public x: number;
  public y: number;
  public z: number;
  public w: number;

  constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  set(x: number, y: number, z: number, w: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  copy(q: Quaternion): this {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }

  // Normalize quaternion
  normalize(): this {
    const len = Math.sqrt(
      this.x ** 2 + this.y ** 2 + this.z ** 2 + this.w ** 2
    );
    if (len === 0) {
      this.x = this.y = this.z = 0;
      this.w = 1;
    } else {
      this.x /= len;
      this.y /= len;
      this.z /= len;
      this.w /= len;
    }
    return this;
  }

  // Multiply by another quaternion
  multiply(q: Quaternion): this {
    const x = this.x,
      y = this.y,
      z = this.z,
      w = this.w;

    this.x = w * q.x + x * q.w + y * q.z - z * q.y;
    this.y = w * q.y - x * q.z + y * q.w + z * q.x;
    this.z = w * q.z + x * q.y - y * q.x + z * q.w;
    this.w = w * q.w - x * q.x - y * q.y - z * q.z;

    return this;
  }

  // Return a new quaternion from multiplication
  multiplied(q: Quaternion): Quaternion {
    return this.clone().multiply(q);
  }

  // Invert quaternion
  invert(): this {
    return this.conjugate().normalize();
  }

  conjugate(): this {
    this.x *= -1;
    this.y *= -1;
    this.z *= -1;
    return this;
  }

  // Set quaternion from axis + angle
  setFromAxisAngle(
    axis: { x: number; y: number; z: number },
    angle: number
  ): this {
    const half = angle / 2;
    const s = Math.sin(half);
    this.x = axis.x * s;
    this.y = axis.y * s;
    this.z = axis.z * s;
    this.w = Math.cos(half);
    return this;
  }

  // Set quaternion from Euler angles (in radians, order: XYZ)
  setFromEuler(
    x: number,
    y: number,
    z: number,
    order: "XYZ" | "YXZ" | "ZXY" | "ZYX" | "YZX" | "XZY" = "XYZ"
  ): this {
    const c1 = Math.cos(x / 2);
    const c2 = Math.cos(y / 2);
    const c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2);
    const s2 = Math.sin(y / 2);
    const s3 = Math.sin(z / 2);

    switch (order) {
      case "XYZ":
        this.x = s1 * c2 * c3 + c1 * s2 * s3;
        this.y = c1 * s2 * c3 - s1 * c2 * s3;
        this.z = c1 * c2 * s3 + s1 * s2 * c3;
        this.w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "YXZ":
        this.x = s1 * c2 * c3 + c1 * s2 * s3;
        this.y = c1 * s2 * c3 - s1 * c2 * s3;
        this.z = c1 * c2 * s3 - s1 * s2 * c3;
        this.w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case "ZXY":
        this.x = s1 * c2 * c3 - c1 * s2 * s3;
        this.y = c1 * s2 * c3 + s1 * c2 * s3;
        this.z = c1 * c2 * s3 + s1 * s2 * c3;
        this.w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "ZYX":
        this.x = s1 * c2 * c3 - c1 * s2 * s3;
        this.y = c1 * s2 * c3 + s1 * c2 * s3;
        this.z = c1 * c2 * s3 - s1 * s2 * c3;
        this.w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case "YZX":
        this.x = s1 * c2 * c3 + c1 * s2 * s3;
        this.y = c1 * s2 * c3 + s1 * c2 * s3;
        this.z = c1 * c2 * s3 - s1 * s2 * c3;
        this.w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "XZY":
        this.x = s1 * c2 * c3 - c1 * s2 * s3;
        this.y = c1 * s2 * c3 - s1 * c2 * s3;
        this.z = c1 * c2 * s3 + s1 * s2 * c3;
        this.w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
    }

    return this;
  }

  // Rotate a Vector3 by this quaternion
  applyToVector3(v: { x: number; y: number; z: number }): {
    x: number;
    y: number;
    z: number;
  } {
    const qx = this.x,
      qy = this.y,
      qz = this.z,
      qw = this.w;
    const x = v.x,
      y = v.y,
      z = v.z;

    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;

    return {
      x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
      y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
      z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
    };
  }

  // Spherical Linear Interpolation
  slerp(q: Quaternion, t: number): this {
    let cosHalfTheta =
      this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w;

    if (cosHalfTheta < 0) {
      this.x = -q.x;
      this.y = -q.y;
      this.z = -q.z;
      this.w = -q.w;
      cosHalfTheta = -cosHalfTheta;
    } else {
      this.copy(q);
    }

    if (cosHalfTheta >= 1.0) {
      return this;
    }

    const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
    if (Math.abs(sinHalfTheta) < 0.001) {
      this.x = 0.5 * (this.x + q.x);
      this.y = 0.5 * (this.y + q.y);
      this.z = 0.5 * (this.z + q.z);
      this.w = 0.5 * (this.w + q.w);
      return this;
    }

    const halfTheta = Math.acos(cosHalfTheta);
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

    this.x = this.x * ratioA + q.x * ratioB;
    this.y = this.y * ratioA + q.y * ratioB;
    this.z = this.z * ratioA + q.z * ratioB;
    this.w = this.w * ratioA + q.w * ratioB;

    return this;
  }

  static identity(): Quaternion {
    return new Quaternion(0, 0, 0, 1);
  }
}
