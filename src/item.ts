import { Player } from "./player.js";
import { StatValues } from "./stats.js";
import { Proc, Spell, LearnedSpell } from "./spell.js";

export enum ItemSlot {
    MAINHAND = 1 << 0,
    OFFHAND = 1 << 1,
    TRINKET1 = 1 << 2,
    TRINKET2 = 1 << 3,
    HEAD = 1 << 4,
    NECK = 1 << 5,
    SHOULDER = 1 << 6,
    BACK = 1 << 7,
    CHEST = 1 << 8,
    WRIST = 1 << 9,
    HANDS = 1 << 10,
    WAIST = 1 << 11,
    LEGS = 1 << 12,
    FEET = 1 << 13,
    RING1 = 1 << 14,
    RING2 = 1 << 15,
    RANGED = 1 << 16,
}

export interface ItemDescription {
    name: string,
    slot: ItemSlot,
    stats?: StatValues,
    onuse?: Spell,
    onequip?: Proc,
}

export enum WeaponType {
    MACE,
    SWORD,
    AXE,
    DAGGER,
}

export interface WeaponDescription extends ItemDescription {
    type: WeaponType,
    min: number,
    max: number,
    speed: number,
    onhit?: Proc,
}

export function isWeapon(item: ItemDescription): item is WeaponDescription {
    return "speed" in item;
}

export function isEquipedWeapon(item: ItemEquiped): item is WeaponEquiped {
    return "weapon" in item;
}

export class ItemEquiped {
    item: ItemDescription;
    onuse?: LearnedSpell;

    constructor(item: ItemDescription, player: Player) {
        this.item = item;

        if (item.onuse) {
            this.onuse = new LearnedSpell(item.onuse, player);
        }

        if (item.onequip) {
            player.addProc(item.onequip);
        }
    }

    use(time: number) {
        if (this.onuse) {
            this.onuse.cast(time);
        }
    }
}

export class WeaponEquiped extends ItemEquiped {
    weapon: WeaponDescription;
    nextSwingTime: number;
    procs: Proc[] = [];
    player: Player;

    constructor(item: WeaponDescription, player: Player) {
        super(item, player);
        this.weapon = item;
        
        if (item.onhit) {
            this.addProc(item.onhit)
        }

        this.player = player;

        this.nextSwingTime = 100; // TODO - need to reset this properly if ever want to simulate fights where you run out
    }

    addProc(p: Proc) {
        this.procs.push(p);
    }

    addStone() {
        // TODO - add support for weapon stones
    }

    proc(time: number) {
        for (let proc of this.procs) {
            proc.run(this.player, this.weapon, time);
        }
    }
}
