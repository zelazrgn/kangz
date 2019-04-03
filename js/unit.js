import { clamp } from "./math.js";
export class Unit {
    constructor(armor) {
        this.armor = armor;
    }
    get defenseSkill() {
        return 315;
    }
    get dodgeChance() {
        return 5;
    }
    calculateArmorReducedDamage(damage) {
        const armor = Math.max(0, this.armor);
        const level = 60;
        let tmpvalue = 0.1 * armor / ((8.5 * level) + 40);
        tmpvalue /= (1 + tmpvalue);
        const armorModifier = clamp(tmpvalue, 0, 0.75);
        return Math.max(1, damage - (damage * armorModifier));
    }
}
//# sourceMappingURL=unit.js.map