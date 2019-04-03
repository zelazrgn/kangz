export var WeaponType;
(function (WeaponType) {
    WeaponType[WeaponType["MACE"] = 0] = "MACE";
    WeaponType[WeaponType["SWORD"] = 1] = "SWORD";
})(WeaponType || (WeaponType = {}));
export class Weapon {
    constructor(type, min, max, speed) {
        this.type = type;
        this.min = min;
        this.max = max;
        this.speed = speed;
        this.nextSwingTime = 100;
    }
    get dps() {
        return (this.min + this.max) / 2 / this.speed;
    }
}
//# sourceMappingURL=weapon.js.map