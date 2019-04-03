export enum WeaponType {
    MACE,
    SWORD,
}

export class Weapon {
    min: number;
    max: number;
    speed: number;
    nextSwingTime: number;
    type: WeaponType;

    constructor(type: WeaponType, min: number, max: number, speed: number) {
        this.type = type;
        this.min = min;
        this.max = max;
        this.speed = speed;
        this.nextSwingTime = 0;
    }

    get dps() {
        return (this.min + this.max) / 2 / this.speed;
    }
}
