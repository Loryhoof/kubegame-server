import { Quaternion, Vector3 } from "./mathUtils";
import { WorldSettings } from "./Types/worldTypes";

export const speedFactor = 0.05;
export const serverHz = 30;

export const Rad2Deg = 180 / Math.PI;

export const CAR_COIN_AMOUNT = 100; // test

export function multiplyScalar(
  vector: { x: number; y: number; z: number },
  scalar: number
): { x: number; y: number; z: number } {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar,
    z: vector.z * scalar,
  };
}

// Function to normalize an object with {x, y, z}
export function normalize(vector: { x: number; y: number; z: number }): {
  x: number;
  y: number;
  z: number;
} {
  const length = Math.sqrt(
    vector.x * vector.x + vector.y * vector.y + vector.z * vector.z
  );

  if (length === 0) return { ...vector }; // Return unchanged if the length is 0 to avoid division by 0

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}
