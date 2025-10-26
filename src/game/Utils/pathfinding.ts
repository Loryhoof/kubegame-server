import PF from "pathfinding";
import { Vector3 } from "../mathUtils";

export type PathNode = {
  x: number;
  z: number;
  g: number;
  h: number;
  f: number;
  parent?: PathNode | null;
};

export type NavCell = {
  walkable: boolean;
  y: number;
};

// kept for signature compatibility
export function heuristic(_a: PathNode, _b: PathNode) {
  return 0;
}
// kept for signature compatibility
export function getNeighbors() {
  return [];
}

export function worldToGrid(
  worldX: number,
  worldZ: number,
  origin: Vector3,
  cellSize: number
) {
  const x = Math.floor((worldX - origin.x) / cellSize);
  const z = Math.floor((worldZ - origin.z) / cellSize);
  return { x, z };
}

export function findPath(
  start: { x: number; z: number }, // WORLD POS
  goal: { x: number; z: number }, // WORLD POS
  grid: { walkable: boolean; y: number }[][],
  origin: Vector3,
  cellSize: number
): Vector3[] {
  const width = grid.length;
  const depth = grid[0].length;

  // ✅ Convert WORLD → GRID coords
  const sx = Math.floor((start.x - origin.x) / cellSize);
  const sz = Math.floor((start.z - origin.z) / cellSize);
  const gx = Math.floor((goal.x - origin.x) / cellSize);
  const gz = Math.floor((goal.z - origin.z) / cellSize);

  // ✅ Bounds + walkable check
  if (sx < 0 || sz < 0 || gx < 0 || gz < 0) return [];
  if (sx >= width || gx >= width || sz >= depth || gz >= depth) return [];
  if (!grid[sx][sz].walkable || !grid[gx][gz].walkable) return [];

  // ✅ Build matrix[z][x] for PF
  const matrix: number[][] = [];
  for (let z = 0; z < depth; z++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      row.push(grid[x][z].walkable ? 0 : 1);
    }
    matrix.push(row);
  }

  const finder = new PF.AStarFinder({
    allowDiagonal: true,
    dontCrossCorners: true,
  });
  const pfGrid = new PF.Grid(matrix);
  const path = finder.findPath(sx, sz, gx, gz, pfGrid);

  if (!path.length) return [];

  // ✅ Convert GRID → WORLD coords
  return path.map(([x, z]) => {
    const cell = grid[x][z];
    return new Vector3(
      origin.x + x * cellSize,
      cell.y,
      origin.z + z * cellSize
    );
  });
}
