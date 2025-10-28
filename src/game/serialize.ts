import { Quaternion, Vector3 } from "./mathUtils";
import NPC from "./NPC";
import Player, { PlayerData } from "./Player";

export const INPUT_BITS = {
  moveForward: 1 << 0,
  moveBackward: 1 << 1,
  moveLeft: 1 << 2,
  moveRight: 1 << 3,
  jump: 1 << 4,
  sprint: 1 << 5,
  interact: 1 << 6,
  reload: 1 << 7,
  shoot: 1 << 8,
  aim: 1 << 9,
  spawnVehicle: 1 << 10,
  useHorn: 1 << 11,
  slot1: 1 << 12,
  slot2: 1 << 13,
  slot3: 1 << 14,
  slot4: 1 << 15,
} as const;

export type InputKey = keyof typeof INPUT_BITS;

export function encodeKeys(keys: Record<InputKey, boolean>): number {
  let mask = 0;
  (Object.keys(INPUT_BITS) as InputKey[]).forEach((key) => {
    if (keys[key]) mask |= INPUT_BITS[key];
  });
  return mask;
}

export function decodeKeys(mask: number): Record<InputKey, boolean> {
  const result = {} as Record<InputKey, boolean>;

  // Always populate all keys
  (Object.keys(INPUT_BITS) as InputKey[]).forEach((key) => {
    result[key] = (mask & INPUT_BITS[key]) !== 0;
  });

  return result;
}

export function serializePlayer(p: Player): any {
  return {
    velocity: p.velocity,
    health: p.health,
    coins: p.coins,
    ammo: p.ammo,
    id: p.id,
    position: p.position,
    quaternion: p.quaternion,
    color: p.color,
    keys: p.actions,
    isSitting: p.isSitting,
    controlledObject: p.controlledObject ? { id: p.controlledObject.id } : null,
    lastProcessedInputSeq: p.lastProcessedInputSeq,
    nickname: p.nickname ?? "",
    leftHand: p.leftHand,
    rightHand: p.rightHand,
    viewQuaternion: p.viewQuaternion ?? new Quaternion(),
    isDead: p.isDead,
    killCount: p.killCount,
    lobbyId: p.lobby.id,
    selectedItemSlot: p.selectedItemSlot,
    itemSlots: p.itemSlots,
  };
}

// export function serializeBinaryPlayers(
//   players: Map<string, Player>
// ): ArrayBuffer {
//   const entries = Array.from(players.values());

//   // First: compute total bytes
//   let totalBytes = 2; // playerCount (Uint16)
//   for (const p of entries) {
//     const idBytes = new TextEncoder().encode(p.id);
//     totalBytes += 1 + idBytes.length; // id length + id bytes
//     totalBytes += (3 + 4 + 3 + 4) * 4; // pos + quat + vel + viewQuat floats
//     totalBytes += 1; // isDead (Uint8)
//     totalBytes += 2; // keys mask (Uint16)
//     totalBytes += 2; // seq (Uint16)
//   }

//   const buffer = new ArrayBuffer(totalBytes);
//   const view = new DataView(buffer);
//   let offset = 0;

//   // Write player count
//   view.setUint16(offset, entries.length);
//   offset += 2;

//   for (const p of entries) {
//     const idBytes = new TextEncoder().encode(p.id);

//     // 1) ID
//     view.setUint8(offset++, idBytes.length);
//     idBytes.forEach((b) => view.setUint8(offset++, b));

//     // 2) Position
//     view.setFloat32(offset, p.position.x);
//     offset += 4;
//     view.setFloat32(offset, p.position.y);
//     offset += 4;
//     view.setFloat32(offset, p.position.z);
//     offset += 4;

//     // 3) Quaternion
//     view.setFloat32(offset, p.quaternion.x);
//     offset += 4;
//     view.setFloat32(offset, p.quaternion.y);
//     offset += 4;
//     view.setFloat32(offset, p.quaternion.z);
//     offset += 4;
//     view.setFloat32(offset, p.quaternion.w);
//     offset += 4;

//     // 4) Velocity
//     view.setFloat32(offset, p.velocity.x);
//     offset += 4;
//     view.setFloat32(offset, p.velocity.y);
//     offset += 4;
//     view.setFloat32(offset, p.velocity.z);
//     offset += 4;

//     // 5) isDead (Uint8)
//     view.setUint8(offset++, p.isDead ? 1 : 0);

//     // 6) Keys bitmask
//     view.setUint16(offset, encodeKeys(p.actions));
//     offset += 2;

//     // 7) lastProcessedInputSeq
//     view.setUint16(offset, p.lastProcessedInputSeq);
//     offset += 2;

//     // 8) View Quaternion (fallback to identity if null)
//     const vq = p.viewQuaternion ?? { x: 0, y: 0, z: 0, w: 1 };
//     view.setFloat32(offset, vq.x);
//     offset += 4;
//     view.setFloat32(offset, vq.y);
//     offset += 4;
//     view.setFloat32(offset, vq.z);
//     offset += 4;
//     view.setFloat32(offset, vq.w);
//     offset += 4;
//   }

//   return buffer;
// }

export function serializeBinaryWorld(
  time: number,
  players: Map<string, any>,
  vehicles: any[],
  npcs: any[]
): ArrayBuffer {
  const playerCount = players.size;
  const vehicleCount = vehicles.length;
  const npcCount = npcs.length;

  // Rough safe allocation (added extra space for seats with IDs)
  const buffer = new ArrayBuffer(
    8 + // Float64 time
      2 +
      playerCount * 120 +
      2 +
      vehicleCount * 400 + // more room for wheels + seat IDs
      2 +
      npcCount * 110
  );
  const view = new DataView(buffer);
  let offset = 0;

  // ---- TIME ----
  view.setFloat64(offset, time);
  offset += 8;

  // ---- PLAYERS ----
  view.setUint16(offset, playerCount);
  offset += 2;

  for (const [id, p] of players) {
    const idBytes = new TextEncoder().encode(p.id);
    const idLength = idBytes.length;
    view.setUint8(offset++, idLength);
    idBytes.forEach((b) => view.setUint8(offset++, b));

    // Position
    view.setFloat32(offset, p.position.x);
    offset += 4;
    view.setFloat32(offset, p.position.y);
    offset += 4;
    view.setFloat32(offset, p.position.z);
    offset += 4;

    // Rotation
    view.setFloat32(offset, p.quaternion.x);
    offset += 4;
    view.setFloat32(offset, p.quaternion.y);
    offset += 4;
    view.setFloat32(offset, p.quaternion.z);
    offset += 4;
    view.setFloat32(offset, p.quaternion.w);
    offset += 4;

    // Velocity
    view.setFloat32(offset, p.velocity.x);
    offset += 4;
    view.setFloat32(offset, p.velocity.y);
    offset += 4;
    view.setFloat32(offset, p.velocity.z);
    offset += 4;

    // View quaternion
    const vq = p.viewQuaternion ?? { x: 0, y: 0, z: 0, w: 1 };
    view.setFloat32(offset, vq.x);
    offset += 4;
    view.setFloat32(offset, vq.y);
    offset += 4;
    view.setFloat32(offset, vq.z);
    offset += 4;
    view.setFloat32(offset, vq.w);
    offset += 4;

    // Keys + seq
    view.setUint16(offset, encodeKeys(p.actions));
    offset += 2;
    view.setUint16(offset, p.lastProcessedInputSeq ?? 0);
    offset += 2;
  }

  // ---- VEHICLES ----
  view.setUint16(offset, vehicleCount);
  offset += 2;

  for (const v of vehicles) {
    const idBytes = new TextEncoder().encode(v.id);
    const idLength = idBytes.length;
    view.setUint8(offset++, idLength);
    idBytes.forEach((b) => view.setUint8(offset++, b));

    // Position
    view.setFloat32(offset, v.position.x);
    offset += 4;
    view.setFloat32(offset, v.position.y);
    offset += 4;
    view.setFloat32(offset, v.position.z);
    offset += 4;

    // Rotation
    view.setFloat32(offset, v.quaternion.x);
    offset += 4;
    view.setFloat32(offset, v.quaternion.y);
    offset += 4;
    view.setFloat32(offset, v.quaternion.z);
    offset += 4;
    view.setFloat32(offset, v.quaternion.w);
    offset += 4;

    // Linear + angular velocity
    const lv = v.physicsObject?.rigidBody.linvel?.() ??
      v.linearVelocity ?? { x: 0, y: 0, z: 0 };
    const av = v.physicsObject?.rigidBody.angvel?.() ??
      v.angularVelocity ?? { x: 0, y: 0, z: 0 };

    view.setFloat32(offset, lv.x);
    offset += 4;
    view.setFloat32(offset, lv.y);
    offset += 4;
    view.setFloat32(offset, lv.z);
    offset += 4;

    view.setFloat32(offset, av.x);
    offset += 4;
    view.setFloat32(offset, av.y);
    offset += 4;
    view.setFloat32(offset, av.z);
    offset += 4;

    // Horn
    view.setUint8(offset++, v.hornPlaying ? 1 : 0);

    // ---- Wheels ----
    const wheels = v.wheels ?? [];
    const wheelCount = Math.min(wheels.length, 8);
    view.setUint8(offset++, wheelCount);

    for (let i = 0; i < wheelCount; i++) {
      const w = wheels[i];
      view.setFloat32(offset, w.position.x);
      offset += 4;
      view.setFloat32(offset, w.position.y);
      offset += 4;
      view.setFloat32(offset, w.position.z);
      offset += 4;
      view.setFloat32(offset, w.quaternion.x);
      offset += 4;
      view.setFloat32(offset, w.quaternion.y);
      offset += 4;
      view.setFloat32(offset, w.quaternion.z);
      offset += 4;
      view.setFloat32(offset, w.quaternion.w);
      offset += 4;
    }

    // ---- Seats ----
    const seatCount = v.seats?.length ?? 0;
    view.setUint8(offset++, seatCount);

    for (const seat of v.seats ?? []) {
      // Write seater ID (string)
      if (seat.seater && seat.seater.id) {
        const sidBytes = new TextEncoder().encode(seat.seater.id);
        const sidLength = sidBytes.length;
        view.setUint8(offset++, sidLength);
        sidBytes.forEach((b) => view.setUint8(offset++, b));
      } else {
        view.setUint8(offset++, 0); // 0 length = no seater
      }

      // Seat position
      view.setFloat32(offset, seat.position.x);
      offset += 4;
      view.setFloat32(offset, seat.position.y);
      offset += 4;
      view.setFloat32(offset, seat.position.z);
      offset += 4;
    }

    // ---- Last Processed Input Seq ----
    view.setUint16(offset, v.lastProcessedInputSeq ?? 0);
    offset += 2;
  }

  // ---- NPCS ----
  view.setUint16(offset, npcCount);
  offset += 2;

  for (const n of npcs) {
    const idBytes = new TextEncoder().encode(n.id ?? "");
    const idLength = idBytes.length;
    view.setUint8(offset++, idLength);
    idBytes.forEach((b) => view.setUint8(offset++, b));

    // Position
    view.setFloat32(offset, n.position.x);
    offset += 4;
    view.setFloat32(offset, n.position.y);
    offset += 4;
    view.setFloat32(offset, n.position.z);
    offset += 4;

    // Rotation quaternion
    view.setFloat32(offset, n.quaternion.x);
    offset += 4;
    view.setFloat32(offset, n.quaternion.y);
    offset += 4;
    view.setFloat32(offset, n.quaternion.z);
    offset += 4;
    view.setFloat32(offset, n.quaternion.w);
    offset += 4;

    // Velocity
    view.setFloat32(offset, n.velocity.x);
    offset += 4;
    view.setFloat32(offset, n.velocity.y);
    offset += 4;
    view.setFloat32(offset, n.velocity.z);
    offset += 4;

    // View quaternion
    const vq = n.viewQuaternion ?? { x: 0, y: 0, z: 0, w: 1 };
    view.setFloat32(offset, vq.x);
    offset += 4;
    view.setFloat32(offset, vq.y);
    offset += 4;
    view.setFloat32(offset, vq.z);
    offset += 4;
    view.setFloat32(offset, vq.w);
    offset += 4;

    // Keys
    view.setUint16(offset, encodeKeys(n.actions ?? {}));
    offset += 2;
  }

  return buffer.slice(0, offset);
}

// export function serializePlayer(p: Player): any {
//   return {
//     i: p.id,
//     p: [p.position.x, p.position.y, p.position.z],
//     q: [p.quaternion.x, p.quaternion.y, p.quaternion.z, p.quaternion.w],
//     v: [p.velocity.x, p.velocity.y, p.velocity.z],
//     k: encodeKeys(p.actions),
//     s: p.lastProcessedInputSeq,
//     vq: [
//       p.viewQuaternion ? p.viewQuaternion.x : 0,
//       p.viewQuaternion ? p.viewQuaternion.y : 0,
//       p.viewQuaternion ? p.viewQuaternion.z : 0,
//       p.viewQuaternion ? p.viewQuaternion.w : 0,
//     ],
//   };
// }

export function serializeVehicle(vehicle: any) {
  return {
    id: vehicle.id,
    position: vehicle.position,
    quaternion: vehicle.quaternion,
    hornPlaying: vehicle.hornPlaying,
    wheels: vehicle.wheels.map((wheel: any) => ({
      radius: wheel.radius,
      position: wheel.position,
      quaternion: wheel.quaternion,
      worldPosition: wheel.worldPosition,
    })),
    linearVelocity: vehicle.physicsObject.rigidBody.linvel(),
    angularVelocity: vehicle.physicsObject.rigidBody.angvel(),
    seats: vehicle.seats.map((seat: any) => ({
      position: seat.position,
      type: seat.type,
      seater: seat.seater ? seat.seater.id : null,
    })),
    lastProcessedInputSeq: vehicle.lastProcessedInputSeq,
  };
}

export function serializeNPC(npc: NPC) {
  return {
    velocity: npc.velocity,
    health: npc.health,
    coins: npc.coins,
    id: npc.id,
    position: npc.position,
    quaternion: npc.quaternion,
    color: npc.color,
    keys: npc.actions,
    isSitting: npc.isSitting,
    leftHand: npc.leftHand,
    rightHand: npc.rightHand,
    viewQuaternion: npc.viewQuaternion,
  };
}

export function deserializeBinaryPlayerInput(buffer: Buffer) {
  // Convert Node.js Buffer → proper ArrayBuffer slice for DataView
  const arr = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  const view = new DataView(arr);
  let offset = 0;

  // --- Bitmask ---
  const keyMask = view.getUint16(offset);
  offset += 2;

  // --- Sequence ---
  const seq = view.getUint16(offset);
  offset += 2;

  // --- Delta time ---
  const dt = view.getUint8(offset) / 255;
  offset += 1;

  // --- Camera quaternion ---
  const qx = view.getFloat32(offset);
  offset += 4;
  const qy = view.getFloat32(offset);
  offset += 4;
  const qz = view.getFloat32(offset);
  offset += 4;
  const qw = view.getFloat32(offset);
  offset += 4;

  // --- Camera position ---
  const px = view.getFloat32(offset);
  offset += 4;
  const py = view.getFloat32(offset);
  offset += 4;
  const pz = view.getFloat32(offset);
  offset += 4;

  return {
    seq,
    dt,
    actions: decodeKeys(keyMask),
    camQuat: new Quaternion(qx, qy, qz, qw),
    camPos: new Vector3(px, py, pz),
  };
}
