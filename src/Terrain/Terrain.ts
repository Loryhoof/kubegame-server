// import { createNoise2D } from "simplex-noise";
// import { Quaternion, Vector3 } from "../mathUtils";
// import { TerrainData } from "../World";

// export default class Terrain {
//   private nrows: number;
//   private ncols: number;
//   private heights: Float32Array;
//   private position: Vector3;
//   private quaternion: Quaternion;

//   constructor(
//     nrows: number,
//     ncols: number,
//     position: Vector3,
//     quaternion: Quaternion
//   ) {
//     this.nrows = nrows;
//     this.ncols = ncols;
//     this.position = position;
//     this.quaternion = quaternion;

//     this.heights = new Float32Array(nrows * ncols);

//   }

//   createTerrain() {
//     const scaleFactor = 3;
//     const heightScaleFactor = 1.5;

//     const roadWidth = 5;
//     const roadFlattenHeight = -0.5;
//     const circleHeight = -0.5;

//     const circleA = { centerX: 30, centerZ: 30, radius: 10 };
//     const circleB = { centerX: 80, centerZ: 80, radius: 10 };

//     const noise2D = createNoise2D();

//     for (let x = 0; x < this.nrows; x++) {
//       for (let z = 0; z < this.ncols; z++) {
//         const index = x * this.ncols + z;

//         let noise = noise2D(x, z);

//         // Base terrain using noise/sin
//         let sinZ = Math.sin(z) * 0.1 + noise * 0.05;
//         let sinX = Math.sin(x) * 0.1 + noise * 0.05;
//         let currentHeight = sinX + sinZ;

//         // Distance from circle centers
//         const dxA = circleA.centerX - x;
//         const dzA = circleA.centerZ - z;
//         const distanceFromCircleA = Math.sqrt(dxA * dxA + dzA * dzA);

//         const dxB = circleB.centerX - x;
//         const dzB = circleB.centerZ - z;
//         const distanceFromCircleB = Math.sqrt(dxB * dxB + dzB * dzB);

//         const insideCircleA = distanceFromCircleA <= circleA.radius;
//         const insideCircleB = distanceFromCircleB <= circleB.radius;

//         // Flatten circles
//         if (insideCircleA || insideCircleB) {
//           currentHeight = circleHeight;
//         } else {
//           // Flatten road connecting the two circles (only outside circles)
//           const lineDX = circleB.centerX - circleA.centerX;
//           const lineDZ = circleB.centerZ - circleA.centerZ;
//           const lineLengthSquared = lineDX * lineDX + lineDZ * lineDZ;

//           // Project point (x,z) onto line AB
//           const t =
//             ((x - circleA.centerX) * lineDX + (z - circleA.centerZ) * lineDZ) /
//             lineLengthSquared;

//           if (t >= 0 && t <= 1) {
//             // Distance from point to line
//             const perpDist =
//               Math.abs(
//                 lineDZ * (x - circleA.centerX) - lineDX * (z - circleA.centerZ)
//               ) / Math.sqrt(lineLengthSquared);
//             if (perpDist <= roadWidth / 2) {
//               currentHeight = roadFlattenHeight;
//             }
//           }
//         }

//         this.heights[index] = currentHeight;
//       }
//     }

//     const scale = new Vector3(
//       this.nrows * scaleFactor,
//       2 * heightScaleFactor,
//       this.ncols * scaleFactor
//     );

//     // const terrainData: TerrainData = {
//     //   this.position,
//     //   quaternion,
//     //   heights,
//     //   nrows,
//     //   ncols,
//     //   scale,
//     // };

//     //this.terrains.push(terrainData);

//     PhysicsManager.getInstance().createHeightfield(
//       position,
//       quaternion,
//       heights,
//       scale,
//       nrows - 1,
//       ncols - 1
//     );
//   }
// }
