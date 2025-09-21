import { IHoldable } from "../interfaces/IHoldable";

export default class Weapon implements IHoldable {
  public name: string;
  public capacity: number;
  public ammo: number;
  public lastShotTime: number = -Infinity;
  public lastReloadTime: number = -Infinity;
  public fireRateMs: number = 100;
  public damage: number = 25;
  public isReloading: boolean = false;
  public reloadDurationMs: number = 1000;

  constructor(name: string, capacity: number = 16) {
    this.name = name;
    this.capacity = capacity;

    this.ammo = capacity;
  }

  reload(): void {
    this.isReloading = true;

    setTimeout(() => {
      this.ammo = this.capacity;
      this.isReloading = false;
    }, this.reloadDurationMs);
  }

  use(): void {
    console.log("Boom!");
  }
}
