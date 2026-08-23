/**
 * MYSTERY OF NURUL & ALTHAFF- Ultimate Horror & War Expansion Engine
 * (With 3D Volumetric Characters, 3D Volumetric Water Ponds, & Textured Environment)
 */

// --- SYNTHETIC AUDIO ENGINE ---
const SoundEngine = {
    ctx: null,
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    playTone(freq, type, duration, vol = 0.1) {
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(); osc.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    },
    sfxAttack() { this.playTone(180, 'sawtooth', 0.1, 0.15); },
    sfxGun() { this.playTone(420, 'sawtooth', 0.08, 0.25); },
    sfxWand() { this.playTone(650, 'sine', 0.15, 0.2); },
    sfxShotgun() { this.playTone(220, 'square', 0.18, 0.3); },
    sfxHit() { this.playTone(90, 'square', 0.15, 0.2); },
    sfxCoin() { this.playTone(850, 'sine', 0.12, 0.15); },
    sfxPickup() { this.playTone(580, 'sine', 0.18, 0.12); },
    sfxDoor() { this.playTone(180, 'triangle', 0.3, 0.15); },
    sfxBossHit() { this.playTone(45, 'sawtooth', 0.4, 0.3); }
};

// --- DYNAMIC BULLETS, PARTICLES & TEXT ---
let bullets = [];
let enemyBullets = [];
let particles = [];
let fallingLeaves = [];
let floatingTexts = [];

// Environment Particles
for (let i = 0; i < 45; i++) {
    fallingLeaves.push({
        x: Math.random() * 800, y: Math.random() * 600,
        size: Math.random() * 4 + 3,
        speedY: Math.random() * 0.8 + 0.4,
        speedX: Math.random() * 0.6 - 0.3,
        color: Math.random() > 0.5 ? '#2ecc71' : '#f39c12'
    });
}

function addParticle(x, y, color, count = 6, speed = 3) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * speed,
            vy: (Math.random() - 0.5) * speed,
            life: 20, color, size: Math.random() * 3 + 2
        });
    }
}

function addFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, life: 35, vy: -1 });
}

function updateEffects() {
    // Player Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;

        const currentMap = mapData[currentMapKey];
        for (let j = currentMap.enemies.length - 1; j >= 0; j--) {
            let enemy = currentMap.enemies[j];
            if (checkRectOverlap({ x: b.x, y: b.y, w: 8, h: 8 }, enemy)) {
                let dmg = b.damage;
                enemy.hp -= dmg;
                SoundEngine.sfxHit();
                screenShake = Math.max(screenShake, 4);
                addFloatingText(enemy.x, enemy.y - 10, `-${dmg}`, b.color || '#f39c12');
                addParticle(b.x, b.y, b.color || '#ffaa00', 8, 4);

                if (enemy.hp <= 0) {
                    player.gold += enemy.gold;
                    addEXP(enemy.exp);
                    if (enemy.isBoss) {
                        currentState = GameState.VICTORY;
                        showScreen('screen-victory');
                    }
                    currentMap.enemies.splice(j, 1);
                }
                bullets.splice(i, 1);
                break;
            }
        }
        if (b.life <= 0 || b.x < 0 || b.x > CANVAS_WIDTH || b.y < 0 || b.y > CANVAS_HEIGHT) bullets.splice(i, 1);
    }

    // Enemy Bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        let eb = enemyBullets[i];
        eb.x += eb.vx; eb.y += eb.vy; eb.life--;

        if (checkRectOverlap({ x: eb.x, y: eb.y, w: 10, h: 10 }, player)) {
            let dmg = Math.max(1, eb.damage - player.defense);
            player.hp -= dmg;
            screenShake = 10;
            addFloatingText(player.x, player.y - 10, `-${dmg}`, '#e74c3c');
            addParticle(player.x + 20, player.y + 20, '#e74c3c', 12, 4);
            SoundEngine.sfxHit();
            enemyBullets.splice(i, 1);

            if (player.hp <= 0) {
                player.hp = 0;
                currentState = GameState.GAMEOVER;
                showScreen('screen-gameover');
            }
            continue;
        }
        if (eb.life <= 0 || eb.x < 0 || eb.x > CANVAS_WIDTH || eb.y < 0 || eb.y > CANVAS_HEIGHT) enemyBullets.splice(i, 1);
    }

    // Environmental FX
    for (let leaf of fallingLeaves) {
        leaf.y += leaf.speedY; leaf.x += leaf.speedX;
        if (leaf.y > 600) leaf.y = -10;
        if (leaf.x > 800) leaf.x = 0;
        if (leaf.x < 0) leaf.x = 800;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        let ft = floatingTexts[i]; ft.y += ft.vy; ft.life--;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
}

// --- GAME STATE & GLOBAL VARIABLES ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const GameState = {
    MENU: 'MENU', PLAYING: 'PLAYING', PAUSED: 'PAUSED',
    DIALOGUE: 'DIALOGUE', GAMEOVER: 'GAMEOVER', VICTORY: 'VICTORY'
};

let currentState = GameState.MENU;
let canvas, ctx;
let keys = {};
let screenShake = 0;

let persistentUnlockedWeapons = {
    sword: true,
    rifle: false,
    wand: false,
    shotgun: false
};

// --- PLAYER MODEL ---
const player = {
    x: 100, y: 300,
    width: 40, height: 40,
    speed: 4.2, isMoving: false,
    hp: 150, maxHp: 150,
    level: 1, exp: 0, nextExp: 100,
    attack: 25, defense: 5,
    activeWeapon: 'sword',
    gold: 0, direction: 'right',
    isAttacking: false, attackTimer: 0,
    inventory: [{ id: 'potion', name: 'Health Potion', count: 5, type: 'heal', value: 50 }]
};

// --- QUEST SYSTEM (25 HARDCORE WAR LEVELS) ---
const quests = [
    { id: 1, title: 'Find the Lost Sword', desc: 'Bicara dengan Kepala Desa.', status: 'Not Started' },
    { id: 2, title: 'Clear Mummy-Goblins', desc: 'Eliminasi Mummy Goblin di Dark Forest.', status: 'In Progress' },
    { id: 3, title: 'Survive Mystic Canopy', desc: 'Kalahkan Monster Treant.', status: 'Not Started' },
    { id: 4, title: 'Unlock Plasma Rifle', desc: 'Ambil Plasma Rifle di Outpost Armory.', status: 'Not Started' },
    { id: 5, title: 'Purge Skeleton Cave', desc: 'Kalahkan Pasukan Skeleton & DarkWolf.', status: 'Not Started' },
    { id: 6, title: 'Defeat Necromancer', desc: 'Kalahkan Penyihir Kegelapan di Crypt.', status: 'Not Started' },
    { id: 7, title: 'Unlock Flame Wand', desc: 'Ambil Flame Wand di Volcano Pass.', status: 'Not Started' },
    { id: 8, title: 'Temple Puzzle Seal', desc: 'Aktifkan Sakelar Segel Kuil.', status: 'Not Started' },
    { id: 9, title: 'Unlock Demon Shotgun', desc: 'Ambil Demon Shotgun di Dragon Lair.', status: 'Not Started' },
    { id: 10, title: 'Survive Blood Warfield', desc: 'Kalahkan Pasukan Iblis Perang.', status: 'Not Started' },
    { id: 11, title: 'Cross Frozen Tundra', desc: 'Bantai Pasukan Es di Tundra Beku.', status: 'Not Started' },
    { id: 12, title: 'Clear Cursed Swamp', desc: 'Bebaskan Rawa Beracun dari Monster.', status: 'Not Started' },
    { id: 13, title: 'Reclaim Desolate Outpost', desc: 'Hancurkan Pertahanan Musuh di Outpost.', status: 'Not Started' },
    { id: 14, title: 'Cross Ashen Wasteland', desc: 'Bertahan Hidup di Padang Abu Vulkanik.', status: 'Not Started' },
    { id: 15, title: 'Breach Shadow Gorge', desc: 'Kalahkan Penjaga Jurang Bayangan.', status: 'Not Started' },
    { id: 16, title: 'Storm Iron Fortress', desc: 'Tembus Benteng Besi Musuh.', status: 'Not Started' },
    { id: 17, title: 'Survive Toxic Barrens', desc: 'Bantai Pasukan Beracun di Barrens.', status: 'Not Started' },
    { id: 18, title: 'Descend Crimson Chasm', desc: 'Taklukkan Jurang Darah Merah.', status: 'Not Started' },
    { id: 19, title: 'Purify Soul Graveyard', desc: 'Bersihkan Kuburan Jiwa Tersiksa.', status: 'Not Started' },
    { id: 20, title: 'Overcome Blighted Front', desc: 'Sapu Bersih Lini Depan Perang.', status: 'Not Started' },
    { id: 21, title: 'Breach Abyss Citadel', desc: 'Kalahkan Iblis Elite di Benteng Abyss.', status: 'Not Started' },
    { id: 22, title: 'Survive Void Rift', desc: 'Bertahan di Retakan Ruang Hampa.', status: 'Not Started' },
    { id: 23, title: 'Conquer Infernal Gates', desc: 'Tembus Gerbang Neraka Musuh.', status: 'Not Started' },
    { id: 24, title: 'Clear Throne of Bones', desc: 'Hancurkan Pengawal Takhta Tulang.', status: 'Not Started' },
    { id: 25, title: 'Slay Castle Guardian', desc: 'Kalahkan Boss Utama Lost Kingdom!', status: 'Not Started' }
];

// --- MAPS DATA (25 HIGH INTENSITY WAR MAPS) ---
let currentMapKey = 'village';

const mapData = {
    village: {
        name: '1. Village Forest', theme: 'village', color: '#1b3814',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }, { x: 0, y: 0, w: 40, h: 600 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'darkForest', spawnX: 80, spawnY: 300 },
        npcs: [{ x: 220, y: 220, w: 40, h: 44, name: 'Kepala Desa', text: 'Pasukan Iblis Perang telah bangkit! Ambil pedang ini!', questTrigger: 1 }],
        enemies: [], items: [{ x: 340, y: 220, w: 28, h: 28, id: 'sword', name: 'Iron Sword', type: 'weapon_sword' }], puzzles: []
    },
    darkForest: {
        name: '2. Dark Forest', theme: 'darkForest', color: '#0d210b',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'mysticCanopy', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'village', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'g1', type: 'MummyGoblin', x: 280, y: 140, w: 38, h: 38, hp: 120, maxHp: 120, atk: 24, exp: 55, gold: 25 },
            { id: 'g2', type: 'MummyGoblin', x: 420, y: 220, w: 38, h: 38, hp: 120, maxHp: 120, atk: 24, exp: 55, gold: 25 },
            { id: 'g3', type: 'MummyGoblin', x: 580, y: 160, w: 38, h: 38, hp: 120, maxHp: 120, atk: 24, exp: 55, gold: 25 },
            { id: 'g4', type: 'MummyGoblin', x: 340, y: 380, w: 38, h: 38, hp: 120, maxHp: 120, atk: 24, exp: 55, gold: 25 },
            { id: 'g5', type: 'MummyGoblin', x: 500, y: 440, w: 38, h: 38, hp: 120, maxHp: 120, atk: 24, exp: 55, gold: 25 }
        ],
        items: [], puzzles: []
    },
    mysticCanopy: {
        name: '3. Mystic Canopy', theme: 'mysticCanopy', color: '#092b1a',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'armory', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'darkForest', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 't1', type: 'Treant', x: 320, y: 180, w: 42, h: 42, hp: 220, maxHp: 220, atk: 30, exp: 75, gold: 35 },
            { id: 't2', type: 'Treant', x: 480, y: 320, w: 42, h: 42, hp: 220, maxHp: 220, atk: 30, exp: 75, gold: 35 },
            { id: 't3', type: 'Treant', x: 620, y: 180, w: 42, h: 42, hp: 220, maxHp: 220, atk: 30, exp: 75, gold: 35 }
        ],
        items: [], puzzles: []
    },
    armory: {
        name: '4. Outpost Armory', theme: 'armory', color: '#2c3e50',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'ancientCave', spawnX: 80, spawnY: 300, reqGun: true },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'mysticCanopy', spawnX: 680, spawnY: 300 },
        npcs: [], enemies: [],
        items: [{ x: 400, y: 280, w: 32, h: 32, id: 'rifle', name: 'Plasma Rifle', type: 'weapon_rifle' }],
        puzzles: []
    },
    ancientCave: {
        name: '5. Ancient Cave', theme: 'cave', color: '#121015',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'necromancerLair', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'armory', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 's1', type: 'Skeleton', x: 280, y: 150, w: 36, h: 36, hp: 250, maxHp: 250, atk: 35, exp: 80, gold: 45 },
            { id: 's2', type: 'Skeleton', x: 420, y: 220, w: 36, h: 36, hp: 250, maxHp: 250, atk: 35, exp: 80, gold: 45 },
            { id: 'w1', type: 'DarkWolf', x: 350, y: 380, w: 42, h: 36, hp: 200, maxHp: 200, atk: 38, exp: 85, gold: 45 },
            { id: 'w2', type: 'DarkWolf', x: 550, y: 420, w: 42, h: 36, hp: 200, maxHp: 200, atk: 38, exp: 85, gold: 45 }
        ],
        items: [], puzzles: []
    },
    necromancerLair: {
        name: '6. Necromancer Crypt', theme: 'crypt', color: '#180a29',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'volcanoPass', spawnX: 80, spawnY: 300, reqItem: 'Ancient Key' },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'ancientCave', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'necro', type: 'Necromancer', isRanged: true, x: 550, y: 260, w: 44, h: 44, hp: 500, maxHp: 500, atk: 48, exp: 220, gold: 130 },
            { id: 's4', type: 'Skeleton', x: 350, y: 200, w: 36, h: 36, hp: 250, maxHp: 250, atk: 35, exp: 80, gold: 45 }
        ],
        items: [{ x: 650, y: 120, w: 24, h: 24, id: 'ancient_key', name: 'Ancient Key', type: 'key' }],
        puzzles: []
    },
    volcanoPass: {
        name: '7. Volcano Pass', theme: 'volcano', color: '#3d0c02',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'forgottenTemple', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'necromancerLair', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'v1', type: 'FireElemental', isRanged: true, x: 320, y: 180, w: 40, h: 40, hp: 350, maxHp: 350, atk: 50, exp: 120, gold: 70 },
            { id: 'v2', type: 'FireElemental', isRanged: true, x: 480, y: 340, w: 40, h: 40, hp: 350, maxHp: 350, atk: 50, exp: 120, gold: 70 },
            { id: 'v3', type: 'FireElemental', isRanged: true, x: 620, y: 180, w: 40, h: 40, hp: 350, maxHp: 350, atk: 50, exp: 120, gold: 70 }
        ],
        items: [{ x: 400, y: 280, w: 30, h: 30, id: 'wand', name: 'Flame Wand', type: 'weapon_wand' }],
        puzzles: []
    },
    forgottenTemple: {
        name: '8. Forgotten Temple', theme: 'temple', color: '#221c16',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'dragonLair', spawnX: 80, spawnY: 300, reqPuzzle: true },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'volcanoPass', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'sk1', type: 'ShadowKnight', x: 350, y: 180, w: 42, h: 42, hp: 420, maxHp: 420, atk: 55, exp: 160, gold: 100 },
            { id: 'sk2', type: 'ShadowKnight', x: 520, y: 360, w: 42, h: 42, hp: 420, maxHp: 420, atk: 55, exp: 160, gold: 100 }
        ],
        items: [],
        puzzles: [{ x: 380, y: 100, w: 40, h: 40, active: false, label: 'Sakelar Segel Kuil' }]
    },
    dragonLair: {
        name: '9. Dragon Lair', theme: 'dragonLair', color: '#2a0505',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'bloodWarfield', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'forgottenTemple', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'dragon', type: 'DragonSentinel', isRanged: true, x: 480, y: 200, w: 72, h: 72, hp: 850, maxHp: 850, atk: 62, exp: 500, gold: 300 }
        ],
        items: [{ x: 350, y: 280, w: 32, h: 32, id: 'shotgun', name: 'Demon Shotgun', type: 'weapon_shotgun' }],
        puzzles: []
    },
    bloodWarfield: {
        name: '10. Blood Warfield', theme: 'warfield', color: '#3b0606',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'frozenTundra', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'dragonLair', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'wd1', type: 'WarDemon', x: 300, y: 160, w: 46, h: 46, hp: 520, maxHp: 520, atk: 60, exp: 200, gold: 120 },
            { id: 'wd2', type: 'WarDemon', x: 480, y: 320, w: 46, h: 46, hp: 520, maxHp: 520, atk: 60, exp: 200, gold: 120 },
            { id: 'wd3', type: 'WarDemon', x: 620, y: 180, w: 46, h: 46, hp: 520, maxHp: 520, atk: 60, exp: 200, gold: 120 }
        ],
        items: [], puzzles: []
    },
    frozenTundra: {
        name: '11. Frozen Tundra', theme: 'tundra', color: '#112233',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'cursedSwamp', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'bloodWarfield', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'ft1', type: 'DarkWolf', x: 300, y: 160, w: 42, h: 36, hp: 580, maxHp: 580, atk: 65, exp: 220, gold: 130 },
            { id: 'ft2', type: 'Skeleton', x: 480, y: 280, w: 36, h: 36, hp: 600, maxHp: 600, atk: 65, exp: 220, gold: 130 },
            { id: 'ft3', type: 'ShadowKnight', x: 620, y: 200, w: 42, h: 42, hp: 650, maxHp: 650, atk: 68, exp: 240, gold: 140 }
        ],
        items: [], puzzles: []
    },
    cursedSwamp: {
        name: '12. Cursed Swamp', theme: 'swamp', color: '#0b1f14',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'desolateOutpost', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'frozenTundra', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'cs1', type: 'Treant', x: 280, y: 180, w: 44, h: 44, hp: 700, maxHp: 700, atk: 72, exp: 260, gold: 150 },
            { id: 'cs2', type: 'MummyGoblin', x: 450, y: 320, w: 40, h: 40, hp: 650, maxHp: 650, atk: 70, exp: 250, gold: 140 },
            { id: 'cs3', type: 'Necromancer', isRanged: true, x: 620, y: 220, w: 44, h: 44, hp: 720, maxHp: 720, atk: 75, exp: 280, gold: 160 }
        ],
        items: [], puzzles: []
    },
    desolateOutpost: {
        name: '13. Desolate Outpost', theme: 'outpost', color: '#2b231d',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'ashenWasteland', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'cursedSwamp', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'do1', type: 'WarDemon', x: 320, y: 150, w: 46, h: 46, hp: 780, maxHp: 780, atk: 78, exp: 300, gold: 180 },
            { id: 'do2', type: 'ShadowKnight', x: 520, y: 330, w: 44, h: 44, hp: 800, maxHp: 800, atk: 80, exp: 320, gold: 190 }
        ],
        items: [], puzzles: []
    },
    ashenWasteland: {
        name: '14. Ashen Wasteland', theme: 'ashen', color: '#211c1c',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'shadowGorge', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'desolateOutpost', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'aw1', type: 'FireElemental', isRanged: true, x: 280, y: 160, w: 42, h: 42, hp: 820, maxHp: 820, atk: 82, exp: 330, gold: 200 },
            { id: 'aw2', type: 'FireElemental', isRanged: true, x: 480, y: 340, w: 42, h: 42, hp: 820, maxHp: 820, atk: 82, exp: 330, gold: 200 },
            { id: 'aw3', type: 'WarDemon', x: 600, y: 200, w: 46, h: 46, hp: 850, maxHp: 850, atk: 85, exp: 350, gold: 210 }
        ],
        items: [], puzzles: []
    },
    shadowGorge: {
        name: '15. Shadow Gorge', theme: 'gorge', color: '#100b1a',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'ironFortress', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'ashenWasteland', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'sg1', type: 'ShadowKnight', x: 320, y: 180, w: 44, h: 44, hp: 900, maxHp: 900, atk: 88, exp: 380, gold: 220 },
            { id: 'sg2', type: 'DragonSentinel', isRanged: true, x: 550, y: 240, w: 72, h: 72, hp: 1100, maxHp: 1100, atk: 92, exp: 550, gold: 320 }
        ],
        items: [], puzzles: []
    },
    ironFortress: {
        name: '16. Iron Fortress', theme: 'fortress', color: '#1c2833',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'toxicBarrens', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'shadowGorge', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'if1', type: 'ShadowKnight', x: 280, y: 160, w: 46, h: 46, hp: 1000, maxHp: 1000, atk: 95, exp: 400, gold: 240 },
            { id: 'if2', type: 'WarDemon', x: 460, y: 320, w: 48, h: 48, hp: 1020, maxHp: 1020, atk: 98, exp: 420, gold: 250 },
            { id: 'if3', type: 'ShadowKnight', x: 620, y: 180, w: 46, h: 46, hp: 1000, maxHp: 1000, atk: 95, exp: 400, gold: 240 }
        ],
        items: [], puzzles: []
    },
    toxicBarrens: {
        name: '17. Toxic Barrens', theme: 'barrens', color: '#1e2d08',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'crimsonChasm', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'ironFortress', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'tb1', type: 'Treant', x: 300, y: 180, w: 46, h: 46, hp: 1100, maxHp: 1100, atk: 100, exp: 450, gold: 260 },
            { id: 'tb2', type: 'Necromancer', isRanged: true, x: 500, y: 280, w: 46, h: 46, hp: 1150, maxHp: 1150, atk: 104, exp: 480, gold: 270 }
        ],
        items: [], puzzles: []
    },
    crimsonChasm: {
        name: '18. Crimson Chasm', theme: 'chasm', color: '#4a0808',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'soulGraveyard', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'toxicBarrens', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'cc1', type: 'WarDemon', x: 280, y: 160, w: 48, h: 48, hp: 1200, maxHp: 1200, atk: 108, exp: 500, gold: 290 },
            { id: 'cc2', type: 'FireElemental', isRanged: true, x: 480, y: 340, w: 44, h: 44, hp: 1200, maxHp: 1200, atk: 108, exp: 500, gold: 290 },
            { id: 'cc3', type: 'WarDemon', x: 620, y: 180, w: 48, h: 48, hp: 1250, maxHp: 1250, atk: 112, exp: 520, gold: 300 }
        ],
        items: [], puzzles: []
    },
    soulGraveyard: {
        name: '19. Soul Graveyard', theme: 'graveyard', color: '#0d0a14',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'blightedFront', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'crimsonChasm', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'sgv1', type: 'Skeleton', x: 300, y: 160, w: 40, h: 40, hp: 1300, maxHp: 1300, atk: 115, exp: 550, gold: 320 },
            { id: 'sgv2', type: 'Necromancer', isRanged: true, x: 500, y: 260, w: 46, h: 46, hp: 1350, maxHp: 1350, atk: 118, exp: 580, gold: 340 },
            { id: 'sgv3', type: 'Skeleton', x: 620, y: 360, w: 40, h: 40, hp: 1300, maxHp: 1300, atk: 115, exp: 550, gold: 320 }
        ],
        items: [], puzzles: []
    },
    blightedFront: {
        name: '20. Blighted Warfront', theme: 'blighted', color: '#30081e',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'abyssCitadel', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'soulGraveyard', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'bf1', type: 'WarDemon', x: 280, y: 180, w: 50, h: 50, hp: 1450, maxHp: 1450, atk: 125, exp: 620, gold: 370 },
            { id: 'bf2', type: 'ShadowKnight', x: 480, y: 320, w: 46, h: 46, hp: 1400, maxHp: 1400, atk: 122, exp: 600, gold: 360 },
            { id: 'bf3', type: 'WarDemon', x: 620, y: 180, w: 50, h: 50, hp: 1450, maxHp: 1450, atk: 125, exp: 620, gold: 370 }
        ],
        items: [], puzzles: []
    },
    abyssCitadel: {
        name: '21. Abyss Citadel', theme: 'citadel', color: '#16021f',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'voidRift', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'blightedFront', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'ac1', type: 'WarDemon', x: 350, y: 180, w: 50, h: 50, hp: 1600, maxHp: 1600, atk: 132, exp: 680, gold: 400 },
            { id: 'ac2', type: 'ShadowKnight', x: 550, y: 350, w: 48, h: 48, hp: 1550, maxHp: 1550, atk: 130, exp: 660, gold: 390 }
        ],
        items: [], puzzles: []
    },
    voidRift: {
        name: '22. Void Rift', theme: 'void', color: '#090214',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'infernalGates', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'abyssCitadel', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'vr1', type: 'DragonSentinel', isRanged: true, x: 320, y: 180, w: 72, h: 72, hp: 1850, maxHp: 1850, atk: 140, exp: 850, gold: 480 },
            { id: 'vr2', type: 'Necromancer', isRanged: true, x: 580, y: 280, w: 48, h: 48, hp: 1750, maxHp: 1750, atk: 138, exp: 800, gold: 450 }
        ],
        items: [], puzzles: []
    },
    infernalGates: {
        name: '23. Infernal Gates', theme: 'gates', color: '#520303',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'throneOfBones', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'voidRift', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'ig1', type: 'WarDemon', x: 280, y: 160, w: 52, h: 52, hp: 2000, maxHp: 2000, atk: 148, exp: 900, gold: 520 },
            { id: 'ig2', type: 'FireElemental', isRanged: true, x: 480, y: 340, w: 46, h: 46, hp: 1950, maxHp: 1950, atk: 145, exp: 880, gold: 500 },
            { id: 'ig3', type: 'WarDemon', x: 620, y: 180, w: 52, h: 52, hp: 2000, maxHp: 2000, atk: 148, exp: 900, gold: 520 }
        ],
        items: [], puzzles: []
    },
    throneOfBones: {
        name: '24. Throne of Bones', theme: 'throne', color: '#1a1313',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'lostKingdom', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'infernalGates', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'tbk1', type: 'ShadowKnight', x: 300, y: 180, w: 50, h: 50, hp: 2300, maxHp: 2300, atk: 158, exp: 1000, gold: 600 },
            { id: 'tbk2', type: 'ShadowKnight', x: 550, y: 320, w: 50, h: 50, hp: 2300, maxHp: 2300, atk: 158, exp: 1000, gold: 600 }
        ],
        items: [], puzzles: []
    },
    lostKingdom: {
        name: '25. Lost Kingdom Castle', theme: 'castle', color: '#100202',
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }, { x: 760, y: 0, w: 40, h: 600 }],
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'throneOfBones', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            {
                id: 'boss', type: 'GuardianBoss', isBoss: true, isRanged: true, phase: 1,
                x: 500, y: 180, w: 90, h: 90, hp: 4200, maxHp: 4200, atk: 200, exp: 6000, gold: 3000
            }
        ],
        items: [], puzzles: []
    }
};

// --- INITIALIZATION ---
window.onload = () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    const savedData = localStorage.getItem('MYSTERY_LOST_KINGDOM_SAVE');
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            if (parsed.persistentUnlockedWeapons) persistentUnlockedWeapons = parsed.persistentUnlockedWeapons;
        } catch (e) {}
    }

    window.addEventListener('keydown', e => {
        keys[e.key.toLowerCase()] = true;
        handleKeyPress(e.key.toLowerCase());
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

    document.getElementById('btn-new-game').onclick = () => startNewGame();
    document.getElementById('btn-continue').onclick = () => loadGame();
    document.getElementById('btn-retry').onclick = () => retryGame();
    document.getElementById('btn-load-die').onclick = () => loadGame();
    document.getElementById('btn-menu-die').onclick = () => showScreen('main-menu');
    document.getElementById('btn-victory-menu').onclick = () => showScreen('main-menu');

    requestAnimationFrame(gameLoop);
};

// --- CONTROLS & LOGIC ---
function handleKeyPress(key) {
    if (currentState === GameState.MENU) return;
    if (key === 'e' || key === ' ') {
        if (currentState === GameState.DIALOGUE) { advanceDialogue(); return; }
    }
    if (currentState === GameState.PLAYING) {
        if (key === 'i') toggleModal('modal-inventory');
        if (key === 'q') toggleModal('modal-quest');
        if (key === 'e') interact();
        if (key === ' ') playerAttack();
        if (key === 'f') shootGun();

        if (key === '1' && persistentUnlockedWeapons.sword) switchWeapon('sword');
        if (key === '2' && persistentUnlockedWeapons.rifle) switchWeapon('rifle');
        if (key === '3' && persistentUnlockedWeapons.wand) switchWeapon('wand');
        if (key === '4' && persistentUnlockedWeapons.shotgun) switchWeapon('shotgun');
    }
}

function switchWeapon(wp) {
    player.activeWeapon = wp;
    let nameMap = { sword: 'Iron Sword', rifle: 'Plasma Rifle', wand: 'Flame Wand', shotgun: 'Demon Shotgun' };
    addFloatingText(player.x, player.y - 15, `Weapon: ${nameMap[wp]}`, '#f1c40f');
}

function shootGun() {
    let wp = player.activeWeapon;
    if (wp === 'sword') {
        playerAttack();
        return;
    }

    let speed = 14;
    let vx = 0, vy = 0;
    if (player.direction === 'up') vy = -speed;
    if (player.direction === 'down') vy = speed;
    if (player.direction === 'left') vx = -speed;
    if (player.direction === 'right') vx = speed;

    if (wp === 'rifle') {
        bullets.push({ x: player.x + 20, y: player.y + 20, vx, vy, life: 50, damage: player.attack + 20, color: '#00f0ff' });
        SoundEngine.sfxGun();
    } else if (wp === 'wand') {
        bullets.push({ x: player.x + 20, y: player.y + 20, vx: vx * 0.8, vy: vy * 0.8, life: 60, damage: player.attack + 35, color: '#ff4400' });
        SoundEngine.sfxWand();
    } else if (wp === 'shotgun') {
        for (let angleOffset of [-0.2, 0, 0.2]) {
            let baseAngle = Math.atan2(vy, vx);
            let finalAngle = baseAngle + angleOffset;
            bullets.push({
                x: player.x + 20, y: player.y + 20,
                vx: Math.cos(finalAngle) * speed,
                vy: Math.sin(finalAngle) * speed,
                life: 35, damage: player.attack + 18, color: '#a000ff'
            });
        }
        SoundEngine.sfxShotgun();
    }
    addParticle(player.x + 20, player.y + 20, '#e67e22', 6, 4);
}

function retryGame() {
    player.hp = player.maxHp = 150 + (player.level - 1) * 25;
    player.x = 100; player.y = 300;
    showHUD();
    currentState = GameState.PLAYING;
    addFloatingText(player.x, player.y - 20, 'Respawned! Weapons Intact!', '#2ecc71');
}

function startNewGame() {
    SoundEngine.init();
    player.hp = player.maxHp = 150;
    player.level = 1; player.exp = 0; player.gold = 0; player.attack = 25;
    player.x = 100; player.y = 300;
    currentMapKey = 'village';

    quests.forEach(q => { q.status = 'Not Started'; if (q.progress) q.progress = 0; });
    showHUD();
    currentState = GameState.PLAYING;
}

function showHUD() {
    document.querySelectorAll('.ui-screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('hud').classList.remove('hidden');
}

function showScreen(screenId) {
    document.querySelectorAll('.ui-screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    currentState = screenId === 'main-menu' ? GameState.MENU : GameState.PLAYING;
}

function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal.classList.contains('hidden')) {
        if (modalId === 'modal-inventory') renderInventory();
        if (modalId === 'modal-quest') renderQuests();
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

// --- PLAYER MOVEMENT & COLLISION ---
function updatePlayer() {
    if (currentState !== GameState.PLAYING) return;

    let dx = 0, dy = 0;
    player.isMoving = false;

    if (keys['w'] || keys['arrowup']) { dy -= player.speed; player.direction = 'up'; player.isMoving = true; }
    if (keys['s'] || keys['arrowdown']) { dy += player.speed; player.direction = 'down'; player.isMoving = true; }
    if (keys['a'] || keys['arrowleft']) { dx -= player.speed; player.direction = 'left'; player.isMoving = true; }
    if (keys['d'] || keys['arrowright']) { dx += player.speed; player.direction = 'right'; player.isMoving = true; }

    let nextX = player.x + dx;
    let nextY = player.y + dy;

    const currentMap = mapData[currentMapKey];
    let collide = false;

    for (let wall of currentMap.walls) {
        if (checkRectOverlap({ x: nextX, y: nextY, w: player.width, h: player.height }, wall)) {
            collide = true; break;
        }
    }

    if (!collide) {
        player.x = Math.max(0, Math.min(CANVAS_WIDTH - player.width, nextX));
        player.y = Math.max(0, Math.min(CANVAS_HEIGHT - player.height, nextY));
    }

    if (currentMap.door && checkRectOverlap(player, currentMap.door)) {
        if (checkDoorRequirement(currentMap.door)) {
            currentMapKey = currentMap.door.targetMap;
            player.x = currentMap.door.spawnX;
            player.y = currentMap.door.spawnY;
            SoundEngine.sfxDoor();
        }
    }
    if (currentMap.prevDoor && checkRectOverlap(player, currentMap.prevDoor)) {
        currentMapKey = currentMap.prevDoor.targetMap;
        player.x = currentMap.prevDoor.spawnX;
        player.y = currentMap.prevDoor.spawnY;
        SoundEngine.sfxDoor();
    }

    if (player.isAttacking) {
        player.attackTimer--;
        if (player.attackTimer <= 0) player.isAttacking = false;
    }
}

function checkDoorRequirement(door) {
    const currentMap = mapData[currentMapKey];

    if (currentMap.enemies.length === 0) {
        let q2 = quests.find(q => q.id === 2);
        if (q2) q2.status = 'Completed';
        return true;
    }

    if (door.reqQuest && currentMap.enemies.length > 0) {
        triggerDialogue('Sistem', `Selesaikan dulu ${currentMap.enemies.length} musuh di area ini!`);
        player.x -= 50;
        return false;
    }
    if (door.reqGun && !persistentUnlockedWeapons.rifle) {
        triggerDialogue('Sistem', 'Ambil Plasma Rifle terlebih dahulu!');
        player.x -= 50;
        return false;
    }
    if (door.reqItem && !player.inventory.find(i => i.name === door.reqItem)) {
        triggerDialogue('Sistem', `Pintu terkunci. Butuh ${door.reqItem}.`);
        player.x -= 50;
        return false;
    }
    if (door.reqPuzzle && !mapData.forgottenTemple.puzzles[0].active) {
        triggerDialogue('Sistem', 'Pintu gerbang masih tersegel. Aktifkan sakelar kuil!');
        player.x -= 50;
        return false;
    }
    return true;
}

// --- INTERACTION & COMBAT ---
function interact() {
    const currentMap = mapData[currentMapKey];

    for (let npc of currentMap.npcs) {
        if (getDistance(player, npc) < 50) {
            triggerDialogue(npc.name, npc.text);
            if (npc.questTrigger) {
                let q = quests.find(item => item.id === npc.questTrigger);
                if (q && q.status === 'Not Started') q.status = 'In Progress';
            }
            return;
        }
    }

    for (let i = currentMap.items.length - 1; i >= 0; i--) {
        let item = currentMap.items[i];
        if (checkRectOverlap(player, item)) {
            if (item.type === 'weapon_sword') { persistentUnlockedWeapons.sword = true; player.activeWeapon = 'sword'; }
            if (item.type === 'weapon_rifle') { persistentUnlockedWeapons.rifle = true; player.activeWeapon = 'rifle'; }
            if (item.type === 'weapon_wand') { persistentUnlockedWeapons.wand = true; player.activeWeapon = 'wand'; }
            if (item.type === 'weapon_shotgun') { persistentUnlockedWeapons.shotgun = true; player.activeWeapon = 'shotgun'; }

            player.inventory.push({ id: item.id, name: item.name, count: 1, type: item.type });
            addParticle(item.x + 10, item.y + 10, '#f1c40f', 12, 5);
            addFloatingText(item.x, item.y, `+${item.name}`, '#f1c40f');
            currentMap.items.splice(i, 1);
            SoundEngine.sfxPickup();
            saveGame();
            triggerDialogue('Item Pickup', `Mendapatkan ${item.name}! Tekan [1, 2, 3, 4] untuk ganti senjata & [F] untuk menembak.`);
            return;
        }
    }

    for (let puzzle of currentMap.puzzles) {
        if (checkRectOverlap(player, puzzle) && !puzzle.active) {
            puzzle.active = true;
            addParticle(puzzle.x + 20, puzzle.y + 20, '#2ecc71', 15, 6);
            SoundEngine.sfxCoin();
            triggerDialogue('Puzzle', `${puzzle.label} telah diaktifkan! Segel terbuka.`);
            let q8 = quests.find(q => q.id === 8); if (q8) q8.status = 'Completed';
            return;
        }
    }
}

function playerAttack() {
    if (player.isAttacking) return;
    player.isAttacking = true;
    player.attackTimer = 12;
    SoundEngine.sfxAttack();

    let attackArea = { x: player.x, y: player.y, w: player.width, h: player.height };
    if (player.direction === 'up') attackArea.y -= 32;
    if (player.direction === 'down') attackArea.y += 32;
    if (player.direction === 'left') attackArea.x -= 32;
    if (player.direction === 'right') attackArea.x += 32;

    addParticle(attackArea.x + 16, attackArea.y + 16, '#8e44ad', 10, 4);

    const currentMap = mapData[currentMapKey];
    for (let i = currentMap.enemies.length - 1; i >= 0; i--) {
        let enemy = currentMap.enemies[i];
        if (checkRectOverlap(attackArea, enemy)) {
            let dmg = Math.max(1, player.attack);
            enemy.hp -= dmg;
            SoundEngine.sfxHit();
            screenShake = Math.max(screenShake, 6);

            addFloatingText(enemy.x + 10, enemy.y - 10, `-${dmg}`, '#8e44ad');
            addParticle(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#8e44ad', 10, 5);

            if (enemy.isBoss) {
                screenShake = 16;
                if (enemy.hp <= enemy.maxHp * 0.5 && enemy.phase === 1) {
                    enemy.phase = 2; enemy.atk += 40;
                    triggerDialogue('Boss', 'Guardian memasuki Mode Marah Murka!');
                }
            }

            if (enemy.hp <= 0) {
                player.gold += enemy.gold;
                addFloatingText(enemy.x, enemy.y, `+${enemy.gold}G`, '#f1c40f');
                addEXP(enemy.exp);

                if (enemy.isBoss) {
                    let q25 = quests.find(q => q.id === 25); if (q25) q25.status = 'Completed';
                    currentMap.enemies.splice(i, 1);
                    currentState = GameState.VICTORY;
                    showScreen('screen-victory');
                    return;
                }

                currentMap.enemies.splice(i, 1);
            }
        }
    }
}

function addEXP(amount) {
    player.exp += amount;
    addFloatingText(player.x, player.y - 20, `+${amount} EXP`, '#3498db');
    if (player.exp >= player.nextExp) {
        player.level++;
        player.exp -= player.nextExp;
        player.nextExp = Math.floor(player.nextExp * 1.5);
        player.maxHp += 25; player.hp = player.maxHp;
        player.attack += 6; player.defense += 3;
        addParticle(player.x + 16, player.y + 16, '#2ecc71', 20, 7);
        triggerDialogue('Level Up!', `Selamat! Anda naik ke Level ${player.level}! Status meningkat.`);
    }
}

// --- ENEMY AI LOGIC (HIGH INTENSITY AGGRESSIVE) ---
function updateEnemies() {
    if (currentState !== GameState.PLAYING) return;

    const currentMap = mapData[currentMapKey];
    for (let enemy of currentMap.enemies) {
        let dist = getDistance(player, enemy);
        let detectRange = enemy.isBoss ? 600 : 320;

        if (dist < detectRange) {
            let isBerserk = enemy.hp < enemy.maxHp * 0.3;
            let spd = (enemy.isBoss && enemy.phase === 2 ? 3.2 : 2.2) + (isBerserk ? 0.8 : 0);
            
            if (enemy.x < player.x) enemy.x += spd;
            if (enemy.x > player.x) enemy.x -= spd;
            if (enemy.y < player.y) enemy.y += spd;
            if (enemy.y > player.y) enemy.y -= spd;

            if (enemy.isRanged && Math.random() < (isBerserk ? 0.05 : 0.03)) {
                let angle = Math.atan2((player.y + 20) - (enemy.y + 20), (player.x + 20) - (enemy.x + 20));
                enemyBullets.push({
                    x: enemy.x + 20, y: enemy.y + 20,
                    vx: Math.cos(angle) * 7.5,
                    vy: Math.sin(angle) * 7.5,
                    life: 80, damage: enemy.atk * (isBerserk ? 1.25 : 1)
                });
            }

            if (checkRectOverlap(player, enemy)) {
                let damage = Math.max(1, (enemy.atk * (isBerserk ? 1.3 : 1)) - player.defense);
                player.hp -= damage * 0.08;
                screenShake = Math.max(screenShake, 5);
                
                if (Math.random() < 0.15) {
                    addFloatingText(player.x, player.y - 10, `-${Math.ceil(damage)}`, '#e74c3c');
                    addParticle(player.x + 20, player.y + 20, '#e74c3c', 6, 4);
                    if (enemy.isBoss) SoundEngine.sfxBossHit();
                    else SoundEngine.sfxHit();
                }

                if (player.hp <= 0) {
                    player.hp = 0;
                    currentState = GameState.GAMEOVER;
                    showScreen('screen-gameover');
                }
            }
        }
    }
}

// --- DIALOGUE SYSTEM ---
function triggerDialogue(speaker, text) {
    document.getElementById('dialogue-speaker').innerText = speaker;
    document.getElementById('dialogue-text').innerText = text;
    document.getElementById('dialogue-box').classList.remove('hidden');
    currentState = GameState.DIALOGUE;
}

function advanceDialogue() {
    document.getElementById('dialogue-box').classList.add('hidden');
    currentState = GameState.PLAYING;
}

// --- SAVE & LOAD SYSTEM ---
function saveGame() {
    const saveData = {
        player: { ...player },
        currentMapKey,
        quests,
        puzzles: mapData.forgottenTemple.puzzles,
        persistentUnlockedWeapons
    };
    localStorage.setItem('MYSTERY_LOST_KINGDOM_SAVE', JSON.stringify(saveData));
}

function loadGame() {
    const data = localStorage.getItem('MYSTERY_LOST_KINGDOM_SAVE');
    if (!data) { alert('Tidak ada file simpanan.'); return; }
    const parsed = JSON.parse(data);
    Object.assign(player, parsed.player);
    currentMapKey = parsed.currentMapKey;
    if (parsed.persistentUnlockedWeapons) persistentUnlockedWeapons = parsed.persistentUnlockedWeapons;
    if (parsed.puzzles) mapData.forgottenTemple.puzzles = parsed.puzzles;
    showHUD();
    currentState = GameState.PLAYING;
}

// --- VISUAL WEAPONS RENDERERS ---
function drawWeaponOnGround(item, time) {
    let floatY = item.y + Math.sin(time / 200) * 4;
    ctx.save();
    ctx.translate(item.x + item.w / 2, floatY + item.h / 2);

    if (item.type === 'weapon_sword') {
        ctx.fillStyle = '#bdc3c7'; ctx.fillRect(-2, -12, 4, 16);
        ctx.fillStyle = '#f1c40f'; ctx.fillRect(-6, 2, 12, 3); ctx.fillRect(-2, 5, 4, 6);
    } else if (item.type === 'weapon_rifle') {
        ctx.fillStyle = '#34495e'; ctx.fillRect(-10, -4, 20, 8);
        ctx.fillStyle = '#00f0ff'; ctx.fillRect(2, -2, 12, 4);
    } else if (item.type === 'weapon_wand') {
        ctx.fillStyle = '#8e44ad'; ctx.fillRect(-2, -10, 4, 20);
        ctx.fillStyle = '#ff4400'; ctx.beginPath(); ctx.arc(0, -12, 6, 0, Math.PI * 2); ctx.fill();
    } else if (item.type === 'weapon_shotgun') {
        ctx.fillStyle = '#111'; ctx.fillRect(-12, -5, 24, 10);
        ctx.fillStyle = '#a000ff'; ctx.fillRect(4, -3, 10, 2); ctx.fillRect(4, 1, 10, 2);
    }
    ctx.restore();
}

function drawPlayerWeapon(time) {
    let wp = player.activeWeapon;
    ctx.save();

    if (wp === 'sword') {
        ctx.fillStyle = '#bdc3c7'; ctx.fillRect(6, -14, 4, 18);
        ctx.fillStyle = '#f1c40f'; ctx.fillRect(2, 2, 12, 3);
    } else if (wp === 'rifle') {
        ctx.fillStyle = '#2c3e50'; ctx.fillRect(2, -4, 20, 7);
        ctx.fillStyle = '#00f0ff'; ctx.fillRect(14, -2, 8, 3);
    } else if (wp === 'wand') {
        ctx.fillStyle = '#5e2a84'; ctx.fillRect(2, -12, 4, 22);
        ctx.fillStyle = '#ff4400'; ctx.beginPath(); ctx.arc(4, -14, 7, 0, Math.PI * 2); ctx.fill();
    } else if (wp === 'shotgun') {
        ctx.fillStyle = '#222'; ctx.fillRect(2, -5, 22, 9);
        ctx.fillStyle = '#a000ff'; ctx.fillRect(16, -3, 8, 2); ctx.fillRect(16, 1, 8, 2);
    }

    ctx.restore();
}

// --- 3D VOLUMETRIC PROCEDURAL PLAYER RENDER ---
function renderPlayer(time) {
    let px = player.x, py = player.y;
    let walkStep = player.isMoving ? Math.sin(time * 0.015) : 0;
    let legOffset = walkStep * 7;

    drawShadow(px, py + player.height - 4, player.width);

    ctx.save();
    ctx.translate(px + player.width / 2, py + player.height / 2);
    if (player.direction === 'left') ctx.scale(-1, 1);

    // Kaki 3D (Cylinder Shading)
    let legGrad1 = ctx.createLinearGradient(-8 + legOffset, 8, -2 + legOffset, 20);
    legGrad1.addColorStop(0, '#333'); legGrad1.addColorStop(1, '#050505');
    ctx.fillStyle = legGrad1; ctx.fillRect(-8 + legOffset, 8, 6, 12);

    let legGrad2 = ctx.createLinearGradient(2 - legOffset, 8, 8 - legOffset, 20);
    legGrad2.addColorStop(0, '#333'); legGrad2.addColorStop(1, '#050505');
    ctx.fillStyle = legGrad2; ctx.fillRect(2 - legOffset, 8, 6, 12);

    // Sepatu 3D
    ctx.fillStyle = '#900c3f'; ctx.fillRect(-10 + legOffset, 18, 9, 4); ctx.fillRect(0 - legOffset, 18, 9, 4);

    // Tubuh 3D (Spherical Cylinder Shading)
    let bodyGrad = ctx.createLinearGradient(-10, -6, 10, 10);
    bodyGrad.addColorStop(0, '#aa00ff'); bodyGrad.addColorStop(0.5, '#6a00b8'); bodyGrad.addColorStop(1, '#2a0050');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath(); ctx.roundRect(-10, -6, 20, 16, 4); ctx.fill();

    // Jubah 3D
    ctx.fillStyle = '#a00020';
    ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(0, 8); ctx.lineTo(10, -6); ctx.fill();

    // Kepala 3D (Sphere Highlight Gradient)
    let headGrad = ctx.createRadialGradient(-3, -15, 2, 0, -12, 10);
    headGrad.addColorStop(0, '#fff5cc'); headGrad.addColorStop(0.7, '#f1c40f'); headGrad.addColorStop(1, '#9a7d0a');
    ctx.fillStyle = headGrad;
    ctx.beginPath(); ctx.arc(0, -12, 9, 0, Math.PI * 2); ctx.fill();

    // Topi Penyihir 3D Volumetrik
    let hatGrad = ctx.createLinearGradient(-14, -28, 10, -18);
    hatGrad.addColorStop(0, '#e74c3c'); hatGrad.addColorStop(1, '#4a0e17');
    let hatSway = Math.sin(time * 0.008) * 3;
    ctx.fillStyle = hatGrad;
    ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(-14 + hatSway, -28); ctx.lineTo(0, -20); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(10 + hatSway, -28); ctx.lineTo(6, -18); ctx.fill();

    drawPlayerWeapon(time);

    ctx.restore();

    if (player.isAttacking && player.activeWeapon === 'sword') {
        ctx.strokeStyle = '#d689e6';
        ctx.lineWidth = 5;
        ctx.beginPath();
        let swingArc = (12 - player.attackTimer) * 0.3;
        ctx.arc(px + 20, py + 20, 34, swingArc - 0.5, swingArc + 0.8);
        ctx.stroke();
    }
}

// --- ANIMATED VILLAGE ELDER 3D ---
function renderNPC(npc, time) {
    let nx = npc.x, ny = npc.y;
    let breath = Math.sin(time * 0.003) * 2;
    drawShadow(nx, ny + npc.h - 4, npc.w);

    ctx.save();
    ctx.translate(nx + npc.w / 2, ny + npc.h / 2 + breath);

    let robeGrad = ctx.createLinearGradient(-14, -8, 14, 16);
    robeGrad.addColorStop(0, '#2b5b84'); robeGrad.addColorStop(1, '#0b1d2c');
    ctx.fillStyle = robeGrad; ctx.fillRect(-14, -8, 28, 24);

    let headGrad = ctx.createRadialGradient(-2, -16, 2, 0, -14, 9);
    headGrad.addColorStop(0, '#ffffff'); headGrad.addColorStop(1, '#a88beb');
    ctx.fillStyle = headGrad; ctx.beginPath(); ctx.arc(0, -14, 9, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Georgia';
    ctx.fillText(npc.name, nx - 10, ny + breath - 10);
}

// --- 3D VOLUMETRIC HORROR ENEMY RENDERERS ---
function renderMummyGoblin(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let walkAnim = Math.sin(time * 0.012 + ex) * 6;
    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    let bodyGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 14);
    bodyGrad.addColorStop(0, '#e6dcbe'); bodyGrad.addColorStop(1, '#7a6e4d');
    ctx.fillStyle = bodyGrad; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();

    let headGrad = ctx.createRadialGradient(-3, -16, 2, 0, -14, 11);
    headGrad.addColorStop(0, '#629e73'); headGrad.addColorStop(1, '#1b3b24');
    ctx.fillStyle = headGrad; ctx.beginPath(); ctx.arc(0, -14, 11, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ff2200'; ctx.fillRect(-4, -16, 3, 3); ctx.fillRect(3, -16, 3, 3);
    ctx.restore();
}

function renderTreant(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let sway = Math.sin(time * 0.005 + ex) * 3;
    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    let trunkGrad = ctx.createLinearGradient(-14, 0, 14, 0);
    trunkGrad.addColorStop(0, '#59442d'); trunkGrad.addColorStop(1, '#1c140b');
    ctx.fillStyle = trunkGrad; ctx.fillRect(-14 + sway, -12, 28, 26);

    let crownGrad = ctx.createRadialGradient(sway - 4, -24, 4, sway, -20, 18);
    crownGrad.addColorStop(0, '#386e38'); crownGrad.addColorStop(1, '#0e240e');
    ctx.fillStyle = crownGrad; ctx.beginPath(); ctx.arc(sway, -20, 18, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ffff00'; ctx.fillRect(-6 + sway, -12, 4, 4); ctx.fillRect(4 + sway, -12, 4, 4);
    ctx.restore();
}

function renderSkeleton(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    let headGrad = ctx.createRadialGradient(-2, -18, 2, 0, -16, 10);
    headGrad.addColorStop(0, '#ffffff'); headGrad.addColorStop(1, '#7f8c8d');
    ctx.fillStyle = headGrad; ctx.beginPath(); ctx.arc(0, -16, 10, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#00f0ff'; ctx.fillRect(-4, -17, 3, 3); ctx.fillRect(2, -17, 3, 3);
    ctx.restore();
}

function renderDarkWolf(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    let bodyGrad = ctx.createLinearGradient(-18, -10, 18, 10);
    bodyGrad.addColorStop(0, '#4a6572'); bodyGrad.addColorStop(1, '#121b22');
    ctx.fillStyle = bodyGrad; ctx.beginPath(); ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ff0000'; ctx.fillRect(10, -6, 3, 3);
    ctx.restore();
}

function renderNecromancer(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let floatY = Math.sin(time * 0.005) * 6;
    drawShadow(ex, ey + enemy.h, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2 + floatY);

    let robeGrad = ctx.createLinearGradient(-16, -10, 16, 20);
    robeGrad.addColorStop(0, '#7b1fa2'); robeGrad.addColorStop(1, '#1a0033');
    ctx.fillStyle = robeGrad; ctx.beginPath(); ctx.arc(0, 5, 16, 0, Math.PI * 2); ctx.fill();

    let headGrad = ctx.createRadialGradient(-3, -20, 2, 0, -18, 10);
    headGrad.addColorStop(0, '#e0e0e0'); headGrad.addColorStop(1, '#424242');
    ctx.fillStyle = headGrad; ctx.beginPath(); ctx.arc(0, -18, 10, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#00ff66'; ctx.fillRect(-4, -19, 3, 3); ctx.fillRect(2, -19, 3, 3);
    ctx.restore();
}

function renderFireElemental(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let pulse = Math.sin(time * 0.015) * 4;
    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    let fireGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 18 + pulse);
    fireGrad.addColorStop(0, '#ffffff'); fireGrad.addColorStop(0.4, '#ff9900'); fireGrad.addColorStop(1, '#cc0000');
    ctx.fillStyle = fireGrad; ctx.beginPath(); ctx.arc(0, 0, 18 + pulse, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function renderShadowKnight(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    let armorGrad = ctx.createLinearGradient(-14, -14, 14, 14);
    armorGrad.addColorStop(0, '#3a3a4f'); armorGrad.addColorStop(1, '#0a0a12');
    ctx.fillStyle = armorGrad; ctx.beginPath(); ctx.roundRect(-14, -14, 28, 28, 6); ctx.fill();

    ctx.fillStyle = '#a000ff'; ctx.fillRect(-8, -8, 16, 4);
    ctx.restore();
}

function renderWarDemon(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    let demonGrad = ctx.createRadialGradient(-4, -4, 3, 0, 0, 20);
    demonGrad.addColorStop(0, '#b71c1c'); demonGrad.addColorStop(1, '#3b0000');
    ctx.fillStyle = demonGrad; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ff1744'; ctx.fillRect(-8, -6, 4, 4); ctx.fillRect(4, -6, 4, 4);
    ctx.restore();
}

function renderDragon(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let wingFlap = Math.sin(time * 0.008) * 12;
    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    let dragonGrad = ctx.createRadialGradient(-6, -6, 4, 0, 0, 24);
    dragonGrad.addColorStop(0, '#d81b60'); dragonGrad.addColorStop(1, '#4a001e');
    ctx.fillStyle = dragonGrad; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ffd54f'; ctx.fillRect(-10, -8, 5, 5); ctx.fillRect(5, -8, 5, 5);
    ctx.restore();
}

function renderBoss(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let pulse = Math.sin(time * 0.006) * 6;
    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    let bossGrad = ctx.createRadialGradient(-10, -10, 6, 0, 0, 38 + pulse);
    if (enemy.phase === 2) {
        bossGrad.addColorStop(0, '#ff1744'); bossGrad.addColorStop(1, '#4a000a');
    } else {
        bossGrad.addColorStop(0, '#8e24aa'); bossGrad.addColorStop(1, '#1a0026');
    }
    ctx.fillStyle = bossGrad; ctx.beginPath(); ctx.arc(0, 0, 38 + pulse, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ffeb3b'; ctx.fillRect(-16, -12, 10, 10); ctx.fillRect(6, -12, 10, 10);
    ctx.restore();
}

function renderEnemy(enemy, time) {
    if (enemy.type === 'MummyGoblin' || enemy.type === 'Goblin') renderMummyGoblin(enemy, time);
    else if (enemy.type === 'Treant') renderTreant(enemy, time);
    else if (enemy.type === 'Skeleton') renderSkeleton(enemy, time);
    else if (enemy.type === 'DarkWolf') renderDarkWolf(enemy, time);
    else if (enemy.type === 'Necromancer') renderNecromancer(enemy, time);
    else if (enemy.type === 'FireElemental') renderFireElemental(enemy, time);
    else if (enemy.type === 'ShadowKnight') renderShadowKnight(enemy, time);
    else if (enemy.type === 'WarDemon') renderWarDemon(enemy, time);
    else if (enemy.type === 'DragonSentinel') renderDragon(enemy, time);
    else if (enemy.isBoss) renderBoss(enemy, time);
    else renderMummyGoblin(enemy, time);

    ctx.fillStyle = '#000'; ctx.fillRect(enemy.x, enemy.y - 12, enemy.w, 6);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(enemy.x, enemy.y - 12, (enemy.hp / enemy.maxHp) * enemy.w, 6);
}

// --- 3D VOLUMETRIC POOL/POND RENDERER ---
function drawRealistic3DPond(x, y, radiusX, radiusY, time, type = 'water') {
    ctx.save();

    // 1. Bayangan & Tebing Batu 3D Rim (Outer Bevel Rim)
    drawShadow(x - radiusX - 10, y, (radiusX + 10) * 2);

    let rimGrad = ctx.createLinearGradient(x, y - radiusY - 12, x, y + radiusY + 12);
    rimGrad.addColorStop(0, '#7f8c8d'); rimGrad.addColorStop(0.5, '#34495e'); rimGrad.addColorStop(1, '#111822');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, radiusX + 12, radiusY + 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Kolam Kedalaman 3D (Deep Center Radial Shadow)
    let waterGrad = ctx.createRadialGradient(x, y, 5, x, y, Math.max(radiusX, radiusY));
    if (type === 'lava') {
        waterGrad.addColorStop(0, '#ffffff'); waterGrad.addColorStop(0.3, '#ff5500'); waterGrad.addColorStop(1, '#550000');
    } else if (type === 'toxic') {
        waterGrad.addColorStop(0, '#aaff00'); waterGrad.addColorStop(0.4, '#2d7a00'); waterGrad.addColorStop(1, '#092400');
    } else {
        waterGrad.addColorStop(0, '#00e5ff'); waterGrad.addColorStop(0.3, '#005580'); waterGrad.addColorStop(1, '#001a26');
    }

    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Gelombang Caustics Surface 3D
    ctx.strokeStyle = type === 'lava' ? 'rgba(255, 230, 0, 0.4)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let waveOffset = Math.sin(time * 0.003) * 6;
    ctx.ellipse(x + waveOffset * 0.5, y + waveOffset * 0.2, radiusX * 0.6, radiusY * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

// --- REALISTIC PROCEDURAL MAP BACKGROUNDS FOR ALL 25 MAPS ---
function drawCustomMapBackground(map, time) {
    ctx.fillStyle = map.color || '#111';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    switch(map.theme) {
        case 'village':
            drawRealistic3DPond(400, 300, 180, 80, time, 'water');
            break;
        case 'darkForest':
            drawRealistic3DPond(200, 200, 90, 45, time, 'water');
            drawRealistic3DPond(600, 400, 100, 50, time, 'water');
            break;
        case 'mysticCanopy':
            drawRealistic3DPond(400, 300, 140, 70, time, 'toxic');
            break;
        case 'armory':
            ctx.fillStyle = '#1c2833';
            for (let x = 60; x < 800; x += 100) ctx.fillRect(x, 40, 4, 520);
            break;
        case 'cave':
            drawRealistic3DPond(500, 350, 110, 55, time, 'water');
            break;
        case 'crypt':
            drawRealistic3DPond(400, 300, 120, 60, time, 'toxic');
            break;
        case 'volcano':
            drawRealistic3DPond(400, 300, 260, 75, time, 'lava');
            break;
        case 'temple':
            ctx.fillStyle = '#3a3125';
            for (let x = 120; x < 700; x += 160) ctx.fillRect(x, 40, 40, 520);
            break;
        case 'dragonLair':
            drawRealistic3DPond(400, 450, 280, 65, time, 'lava');
            break;
        case 'warfield':
        case 'chasm':
        case 'blighted':
            drawRealistic3DPond(400, 300, 220, 70, time, 'lava');
            break;
        case 'tundra':
            drawRealistic3DPond(400, 300, 160, 70, time, 'water');
            break;
        case 'swamp':
            drawRealistic3DPond(400, 300, 240, 90, time, 'toxic');
            break;
        case 'outpost':
            ctx.fillStyle = '#42342b';
            ctx.fillRect(200, 150, 400, 20); ctx.fillRect(200, 430, 400, 20);
            break;
        case 'ashen':
            drawRealistic3DPond(350, 320, 130, 55, time, 'lava');
            break;
        case 'gorge':
            ctx.fillStyle = '#050308'; ctx.fillRect(250, 40, 300, 520);
            break;
        case 'fortress':
            ctx.strokeStyle = '#34495e'; ctx.lineWidth = 6;
            ctx.strokeRect(60, 60, 680, 480);
            break;
        case 'barrens':
            drawRealistic3DPond(400, 300, 170, 75, time, 'toxic');
            break;
        case 'graveyard':
            drawRealistic3DPond(250, 250, 80, 40, time, 'water');
            break;
        case 'citadel':
            drawRealistic3DPond(400, 350, 150, 60, time, 'toxic');
            break;
        case 'void':
            ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.fillStyle = '#a000ff';
            for (let i = 0; i < 30; i++) ctx.fillRect((i * 29) % 800, (i * 47) % 600, 2, 2);
            break;
        case 'gates':
            drawRealistic3DPond(400, 300, 250, 60, time, 'lava');
            break;
        case 'throne':
            ctx.fillStyle = '#e5d8d8';
            ctx.fillRect(360, 80, 80, 100);
            break;
        case 'castle':
            drawRealistic3DPond(400, 300, 200, 80, time, 'lava');
            break;
    }
}

function drawShadow(x, y, width) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath(); ctx.ellipse(x + width / 2, y + 4, width / 2, 6, 0, 0, Math.PI * 2); ctx.fill();
}

// 3D TEMBOK BATU
function drawRealisticWall(w) {
    let wallGrad = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
    wallGrad.addColorStop(0, '#3a3f47'); wallGrad.addColorStop(1, '#111317');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(w.x, w.y, w.w, w.h);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(w.x, w.y, w.w, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
}

function render() {
    let time = Date.now();
    ctx.save();

    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        screenShake--;
    }

    const currentMap = mapData[currentMapKey];
    drawCustomMapBackground(currentMap, time);

    for (let w of currentMap.walls) drawRealisticWall(w);

    if (currentMap.door) { ctx.fillStyle = '#d4af37'; ctx.fillRect(currentMap.door.x, currentMap.door.y, currentMap.door.w, currentMap.door.h); }
    if (currentMap.prevDoor) { ctx.fillStyle = '#555'; ctx.fillRect(currentMap.prevDoor.x, currentMap.prevDoor.y, currentMap.prevDoor.w, currentMap.prevDoor.h); }

    for (let item of currentMap.items) {
        if (item.type.startsWith('weapon_')) drawWeaponOnGround(item, time);
        else { ctx.fillStyle = '#f1c40f'; ctx.fillRect(item.x, item.y, item.w, item.h); }
    }

    for (let npc of currentMap.npcs) renderNPC(npc, time);
    for (let enemy of currentMap.enemies) renderEnemy(enemy, time);

    renderPlayer(time);

    for (let b of bullets) {
        ctx.fillStyle = b.color || '#f39c12';
        ctx.fillRect(b.x - 2, b.y - 2, 6, 6);
    }

    ctx.fillStyle = '#e74c3c';
    for (let eb of enemyBullets) {
        ctx.beginPath(); ctx.arc(eb.x, eb.y, 5, 0, Math.PI * 2); ctx.fill();
    }

    for (let p of particles) { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
    for (let ft of floatingTexts) { ctx.fillStyle = ft.color; ctx.font = 'bold 14px Georgia'; ctx.fillText(ft.text, ft.x, ft.y); }

    // LOW HP BLOOD FLASH
    if (player.hp < player.maxHp * 0.3) {
        let alpha = 0.2 + Math.sin(time * 0.01) * 0.15;
        ctx.fillStyle = `rgba(180, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.restore();
    updateHUDUI();
}

function updateHUDUI() {
    document.getElementById('hp-bar-fill').style.width = `${(player.hp / player.maxHp) * 100}%`;
    document.getElementById('hp-text').innerText = `${Math.ceil(player.hp)}/${player.maxHp}`;
    
    document.getElementById('exp-bar-fill').style.width = `${(player.exp / player.nextExp) * 100}%`;
    document.getElementById('exp-text').innerText = `Lvl ${player.level} (${player.exp}/${player.nextExp})`;
    
    document.getElementById('gold-text').innerText = player.gold;
    document.getElementById('location-text').innerText = `${mapData[currentMapKey].name} | [1-4] Switch Weapon`;
}

function renderInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';
    player.inventory.forEach(item => {
        const div = document.createElement('div');
        div.className = 'inv-item';
        div.innerText = `${item.name} (${item.count})`;
        div.onclick = () => useItem(item);
        grid.appendChild(div);
    });
}

function useItem(item) {
    if (item.type === 'heal') {
        player.hp = Math.min(player.maxHp, player.hp + item.value);
        addFloatingText(player.x, player.y - 10, `+${item.value} HP`, '#2ecc71');
        addParticle(player.x + 16, player.y + 16, '#2ecc71', 12, 4);
        item.count--;
        if (item.count <= 0) player.inventory = player.inventory.filter(i => i !== item);
        renderInventory();
    }
}

function renderQuests() {
    const list = document.getElementById('quest-list');
    list.innerHTML = '';
    quests.forEach(q => {
        const div = document.createElement('div');
        div.className = `quest-item ${q.status.toLowerCase().replace(' ', '-')}`;
        let extra = q.max ? ` (${q.progress}/${q.max})` : '';
        div.innerHTML = `<strong>${q.title}</strong> [${q.status}]${extra}<br><small>${q.desc}</small>`;
        list.appendChild(div);
    });
}

// --- UTILITIES & GAME LOOP ---
function checkRectOverlap(rect1, rect2) {
    return rect1.x < rect2.x + rect2.w &&
           rect1.x + (rect1.w || rect1.width) > rect2.x &&
           rect1.y < rect2.y + rect2.h &&
           rect1.y + (rect1.h || rect1.height) > rect2.y;
}

function getDistance(a, b) {
    return Math.hypot((a.x + (a.w/2 || 16)) - (b.x + (b.w/2 || 16)), (a.y + (a.h/2 || 16)) - (b.y + (b.h/2 || 16)));
}

function gameLoop() {
    updatePlayer();
    updateEnemies();
    updateEffects();
    render();
    requestAnimationFrame(gameLoop);
}