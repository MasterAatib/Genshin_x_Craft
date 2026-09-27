import {
    world,
    system,
    EquipmentSlot,
    EntityDamageCause
} from '@minecraft/server';

// ============================================================
//  CONFIG
// ============================================================

// Full armor set required for Resistance II
// NOTE: If your boots identifier is literally "gi:zhongli",
//       change ARMOR.feet below to 'gi:zhongli'.
const ARMOR = {
    head:  'gi:zhongli_hair',
    chest: 'gi:zhongli_top',
    legs:  'gi:zhongli_bottom',
    feet:  'gi:zhongli_shoes'
};

// Skill item
const SKILL_ITEM     = 'gi:zhongli_skill';
const SKILL_FUNCTION = 'zhongli/activate';

// Resistance (amplifier 0 = Resistance I, so 1 = Resistance II)
const RESISTANCE_DURATION  = 40;   // ticks — refreshed every tick
const RESISTANCE_AMPLIFIER = 1;
const ARMOR_PARTICLE       = 'zhongli:shield';

// Pillar
const PILLAR_ENTITY   = 'zhongli:pillar';
const PILLAR_RADIUS   = 5;
const PILLAR_DAMAGE   = 5;
const PILLAR_INTERVAL = 40;        // ticks
const PILLAR_PARTICLE = 'gi:geo_area';

const DIMENSIONS = ['overworld', 'nether', 'the_end'];

// ============================================================
//  1. FULL ARMOR SET -> RESISTANCE II + PARTICLES (every tick)
// ============================================================
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const equippable = player.getComponent('minecraft:equippable');
        if (!equippable) continue;

        const head  = equippable.getEquipment(EquipmentSlot.Head);
        const chest = equippable.getEquipment(EquipmentSlot.Chest);
        const legs  = equippable.getEquipment(EquipmentSlot.Legs);
        const feet  = equippable.getEquipment(EquipmentSlot.Feet);

        const wearingFullSet =
            head?.typeId  === ARMOR.head  &&
            chest?.typeId === ARMOR.chest &&
            legs?.typeId  === ARMOR.legs  &&
            feet?.typeId  === ARMOR.feet;

        if (!wearingFullSet) continue;

        // Apply / refresh Resistance II
        player.addEffect('minecraft:resistance', RESISTANCE_DURATION, {
            amplifier: RESISTANCE_AMPLIFIER,
            showParticles: false
        });

        // Particle aura
        player.dimension.spawnParticle(ARMOR_PARTICLE, {
            x: player.location.x,
            y: player.location.y,
            z: player.location.z
        });
    }
}, 10);

// ============================================================
//  2. SKILL ITEM USE -> run function zhongli/activate
// ============================================================
world.afterEvents.itemUse.subscribe((event) => {
    const { source: player, itemStack } = event;
    if (!itemStack || itemStack.typeId !== SKILL_ITEM) return;

    try {
        player.runCommand(`function ${SKILL_FUNCTION}`);
    } catch (err) {
        // Silently ignore if the function isn't loaded
        console.warn(`[zhongli] Failed to run ${SKILL_FUNCTION}: ${err}`);
    }
});

// ============================================================
//  3. PILLAR AURA -> damage hostile mobs every 40 ticks
// ============================================================
system.runInterval(() => {
    for (const dimId of DIMENSIONS) {
        const dim = world.getDimension(dimId);
        const pillars = dim.getEntities({ type: PILLAR_ENTITY });

        for (const pillar of pillars) {
            // Only hostile mobs (family: "monster")
            const targets = dim.getEntities({
                location: pillar.location,
                maxDistance: PILLAR_RADIUS,
                families: ['monster']
            });

            for (const mob of targets) {
                mob.applyDamage(PILLAR_DAMAGE, {
                    cause: EntityDamageCause.entityAttack,
                    damagingEntity: pillar
                });
            }

            // Particle on the pillar
            dim.spawnParticle(PILLAR_PARTICLE, pillar.location);
        }
    }
}, PILLAR_INTERVAL);
// ============================================================
//  4. ZHONGLI TRADER — SPAWN ONLY ONCE IN THE WORLD
// ============================================================

const TRADER_ID              = 'gi:zhongli_trader';
const TRADER_FLAG            = 'zhongli_trader_spawned';   // world dynamic property
const TRADER_SPAWN_INTERVAL  = 600;   // ticks — 30 seconds
const TRADER_SPAWN_RADIUS    = 8;     // blocks away from the player
const TRADER_MIN_DISTANCE    = 3;     // don't spawn inside the player

system.runInterval(() => {
    // If we've already spawned the trader in this world, do nothing.
    const alreadySpawned = world.getDynamicProperty(TRADER_FLAG);
    if (alreadySpawned === true) return;

    // Safety check: is there already a trader alive somewhere?
    for (const dimId of DIMENSIONS) {
        const dim = world.getDimension(dimId);
        const existing = dim.getEntities({ type: TRADER_ID });
        if (existing.length > 0) {
            // Flag it as spawned so we stop checking
            world.setDynamicProperty(TRADER_FLAG, true);
            return;
        }
    }

    // Pick a random player to spawn near
    const players = world.getAllPlayers();
    if (players.length === 0) return;   // nobody online, wait

    const player = players[Math.floor(Math.random() * players.length)];
    const dim    = player.dimension;

    // Pick a random position around the player
    const angle  = Math.random() * Math.PI * 2;
    const dist   = TRADER_MIN_DISTANCE +
                   Math.random() * (TRADER_SPAWN_RADIUS - TRADER_MIN_DISTANCE);

    const spawnX = player.location.x + Math.cos(angle) * dist;
    const spawnZ = player.location.z + Math.sin(angle) * dist;
    const spawnY = player.location.y;

    try {
        dim.spawnEntity(TRADER_ID, { x: spawnX, y: spawnY, z: spawnZ });
        world.setDynamicProperty(TRADER_FLAG, true);
        player.sendMessage('§p§lZhongli: §r§6Osmanthus wine tastes the same as I remember ...§r');
    } catch (err) {
        // Spawn failed (e.g. inside a block) — try again next interval
        console.warn(`[zhongli] Trader spawn failed: ${err}`);
    }
}, TRADER_SPAWN_INTERVAL);