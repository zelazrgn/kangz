import { clamp } from "./math.js";

export class Unit {
    armor: number;

    constructor(armor: number) {
        this.armor = armor;
    }

    get defenseSkill() {
        return 315;
    }

    get dodgeChance() {
        // TODO - should bosses have 5.6% dodge? source code looks like it is always 5
        return 5;
    }

    calculateArmorReducedDamage(damage: number) {
        const armor = Math.max(0, this.armor);

        const level = 60; // TODO - should it be attacker level or this units level?
        
        let tmpvalue = 0.1 * armor  / ((8.5 * level) + 40);
        tmpvalue /= (1 + tmpvalue);

        const armorModifier = clamp(tmpvalue, 0, 0.75);

        return Math.max(1, damage - (damage * armorModifier));
    }
}
