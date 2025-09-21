import { IHoldable } from "../interfaces/IHoldable";

export default class Weapon implements IHoldable {
  public name: string;
  public ammoCapacity: number;
  public ammo: number;
  public lastShotTime: number = -Infinity;
  public lastReloadTime: number = -Infinity;
  public fireRateMs: number = 100;
  public damage: number = 25;
  public isReloading: boolean = false;
  public reloadDurationMs: number = 1000;

  constructor(name: string, ammoCapacity: number = 16) {
    this.name = name;
    this.ammoCapacity = ammoCapacity;

    this.ammo = ammoCapacity;
  }

  reload(): void {
    this.isReloading = true;

    setTimeout(() => {
      this.ammo = this.ammoCapacity;
      this.isReloading = false;
    }, this.reloadDurationMs);
  }

  use(): void {
    console.log("Boom!");
  }
}
