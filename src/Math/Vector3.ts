export default class Vector3 {
  public x: number;
  public y: number;
  public z: number;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  // Modifies this vector by adding another vector to it
  add(vec: Vector3): this {
    this.x += vec.x;
    this.y += vec.y;
    this.z += vec.z;
    return this; // Return this for chaining
  }

  // Modifies this vector by subtracting another vector from it
  sub(vec: Vector3): this {
    this.x -= vec.x;
    this.y -= vec.y;
    this.z -= vec.z;
    return this; // Return this for chaining
  }

  // Set the values of the vector
  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  // Multiplies this vector's components by a scalar
  multiplyScalar(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this; // Return this for chaining
  }

  distanceTo(vec: Vector3): number {
    const dx = this.x - vec.x;
    const dy = this.y - vec.y;
    const dz = this.z - vec.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Returns a new vector with the same values as this vector
  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  // A static method to return a zero vector
  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }
}
