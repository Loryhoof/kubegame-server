import { Quaternion } from "./mathUtils";
import NPC from "./NPC";
import Player, { PlayerData } from "./Player";

export function serializePlayer(p: Player): PlayerData {
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
  };
}

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
    keys: npc.keys,
    isSitting: npc.isSitting,
  };
}
