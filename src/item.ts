import { Player } from "./player.js";
import { StatValues, Stats } from "./stats.js";
import { Proc, Spell, LearnedSpell } from "./spell.js";
import { EnchantDescription } from "./data/enchants.js";

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

export const itemSlotHasEnchant: {[TKey in ItemSlot]: boolean} = {
    [ItemSlot.MAINHAND]: true,
    [ItemSlot.OFFHAND]: true,
    [ItemSlot.TRINKET1]: false,
    [ItemSlot.TRINKET2]: false,
    [ItemSlot.HEAD]: true,
    [ItemSlot.NECK]: false,
    [ItemSlot.SHOULDER]: true,
    [ItemSlot.BACK]: true,
    [ItemSlot.CHEST]: true,
    [ItemSlot.WRIST]: true,
    [ItemSlot.HANDS]: true,
    [ItemSlot.WAIST]: false,
    [ItemSlot.LEGS]: true,
    [ItemSlot.FEET]: true,
    [ItemSlot.RING1]: false,
    [ItemSlot.RING2]: false,
    [ItemSlot.RANGED]: false,
};

export const itemSlotHasTemporaryEnchant: {[TKey in ItemSlot]: boolean} = {
    [ItemSlot.MAINHAND]: true,
    [ItemSlot.OFFHAND]: true,
    [ItemSlot.TRINKET1]: false,
    [ItemSlot.TRINKET2]: false,
    [ItemSlot.HEAD]: false,
    [ItemSlot.NECK]: false,
    [ItemSlot.SHOULDER]: false,
    [ItemSlot.BACK]: false,
    [ItemSlot.CHEST]: false,
    [ItemSlot.WRIST]: false,
    [ItemSlot.HANDS]: false,
    [ItemSlot.WAIST]: false,
    [ItemSlot.LEGS]: false,
    [ItemSlot.FEET]: false,
    [ItemSlot.RING1]: false,
    [ItemSlot.RING2]: false,
    [ItemSlot.RANGED]: false,
};

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
    MACE2H,
    SWORD2H,
    AXE2H,
}

export const normalizedWeaponSpeed: {[TKey in WeaponType]: number} = {
    [WeaponType.MACE]: 2.4,
    [WeaponType.SWORD]: 2.4,
    [WeaponType.AXE]: 2.4,
    [WeaponType.DAGGER]: 1.7,
    [WeaponType.MACE2H]: 3.3,
    [WeaponType.SWORD2H]: 3.3,
    [WeaponType.AXE2H]: 3.3,
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

        if (item.onequip) { // TODO, move this to buffproc? this may be simpler though since we know the buff won't be removed
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
    protected procs: Proc[] = [];
    protected player: Player;
    public temporaryEnchant?: EnchantDescription;

    constructor(item: WeaponDescription, player: Player, enchant?: EnchantDescription, temporaryEnchant?: EnchantDescription) {
        super(item, player);
        this.weapon = item;
        
        if (item.onhit) {
            this.addProc(item.onhit)
        }

        if (enchant && enchant.proc) {
            this.addProc(enchant.proc);
        }

        this.player = player;
        this.temporaryEnchant = temporaryEnchant;

        this.nextSwingTime = 100; // TODO - need to reset this properly if ever want to simulate fights where you run out
    }

    private get plusDamage() {
        if (this.temporaryEnchant && this.temporaryEnchant.stats && this.temporaryEnchant.stats.plusDamage) {
            return this.temporaryEnchant.stats.plusDamage
        } else {
            return 0;
        }
    }

    get min() {
        return this.weapon.min + this.plusDamage;
    }

    get max() {
        return this.weapon.max + this.plusDamage;
    }

    addProc(p: Proc) {
        this.procs.push(p);
    }

    proc(time: number) {
        for (let proc of this.procs) {
            proc.run(this.player, this.weapon, time);
        }

        // windfury procs last
        if (this.temporaryEnchant && this.temporaryEnchant.proc) {
            this.temporaryEnchant.proc.run(this.player, this.weapon, time);
        }
    }
}
