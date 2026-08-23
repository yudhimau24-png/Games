/**
 * MYSTERY OF THE LOST KINGDOM - IndexedDB Database & Game Restart Engine
 */

// --- NATIVE WEB DATABASE ENGINE (IndexedDB) ---
const GameDatabase = {
    dbName: 'MysteryLostKingdomDB',
    dbVersion: 1,
    db: null,
    async init() {
        return new Promise((resolve) => {
            const req = indexedDB.open(this.dbName, this.dbVersion);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('saves')) {
                    db.createObjectStore('saves', { keyPath: 'id' });
                }
            };
            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            req.onerror = () => {
                resolve(null);
            };
        });
    },
    async save(saveData) {
        if (!this.db) {
            localStorage.setItem('MYSTERY_LOST_KINGDOM_SAVE', JSON.stringify(saveData));
            return;
        }
        try {
            const tx = this.db.transaction('saves', 'readwrite');
            const store = tx.objectStore('saves');
            store.put({ id: 'player_save', data: saveData, timestamp: Date.now() });
        } catch (e) {
            localStorage.setItem('MYSTERY_LOST_KINGDOM_SAVE', JSON.stringify(saveData));
        }
    },
    async load() {
        if (!this.db) {
            const data = localStorage.getItem('MYSTERY_LOST_KINGDOM_SAVE');
            return data ? JSON.parse(data) : null;
        }
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction('saves', 'readonly');
                const store = tx.objectStore('saves');
                const req = store.get('player_save');
                req.onsuccess = () => resolve(req.result ? req.result.data : null);
                req.onerror = () => {
                    const data = localStorage.getItem('MYSTERY_LOST_KINGDOM_SAVE');
                    resolve(data ? JSON.parse(data) : null);
                };
            } catch (e) {
                const data = localStorage.getItem('MYSTERY_LOST_KINGDOM_SAVE');
                resolve(data ? JSON.parse(data) : null);
            }
        });
    },
    async clear() {
        localStorage.removeItem('MYSTERY_LOST_KINGDOM_SAVE');
        if (this.db) {
            try {
                const tx = this.db.transaction('saves', 'readwrite');
                tx.objectStore('saves').clear();
            } catch (e) {}
        }
    }
};

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

for (let i = 0; i < 35; i++) {
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

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        let eb = enemyBullets[i];
        eb.x += eb.vx; eb.y += eb.vy; eb.life--;

        if (checkRectOverlap({ x: eb.x, y: eb.y, w: 10, h: 10 }, player)) {
            let dmg = Math.max(1, eb.damage - player.defense);
            player.hp -= dmg;
            addFloatingText(player.x, player.y - 10, `-${dmg}`, '#e74c3c');
            addParticle(player.x + 20, player.y + 20, '#e74c3c', 8, 3);
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
    inventory: [{ id: 'potion', name: 'Health Potion', count: 4, type: 'heal', value: 45 }]
};

// --- QUEST SYSTEM ---
const quests = [
    { id: 1, title: 'Find the Lost Sword', desc: 'Bicara dengan Kepala Desa.', status: 'Not Started' },
    { id: 2, title: 'Clear Mummy-Goblins', desc: 'Eliminasi Mummy Goblin.', status: 'In Progress' },
    { id: 3, title: 'Survive Spider Canopy', desc: 'Kalahkan Monster Treant.', status: 'Not Started' },
    { id: 4, title: 'Unlock Plasma Rifle', desc: 'Ambil Plasma Rifle.', status: 'Not Started' },
    { id: 5, title: 'Purge Skeleton Cave', desc: 'Kalahkan Pasukan Skeleton.', status: 'Not Started' },
    { id: 6, title: 'Defeat Necromancer', desc: 'Kalahkan Penyihir Kegelapan.', status: 'Not Started' },
    { id: 7, title: 'Unlock Flame Wand', desc: 'Ambil Flame Wand di Volcano Pass.', status: 'Not Started' },
    { id: 8, title: 'Temple Puzzle Seal', desc: 'Aktifkan Sakelar Kuil.', status: 'Not Started' },
    { id: 9, title: 'Unlock Demon Shotgun', desc: 'Ambil Demon Shotgun di Dragon Lair.', status: 'Not Started' },
    { id: 10, title: 'Survive Blood Warfield', desc: 'Kalahkan Pasukan Iblis Perang.', status: 'Not Started' },
    { id: 11, title: 'Breach Abyss Citadel', desc: 'Kalahkan Demon Warlord.', status: 'Not Started' },
    { id: 12, title: 'Slay Castle Guardian', desc: 'Kalahkan Boss Utama Lost Kingdom!', status: 'Not Started' }
];

// --- MAPS DATA ---
let currentMapKey = 'village';

const mapData = {
    village: {
        name: '1. Village Forest', forestTheme: true, color: '#1b3814', dark: false,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }, { x: 0, y: 0, w: 40, h: 600 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'darkForest', spawnX: 80, spawnY: 300 },
        npcs: [{ x: 220, y: 220, w: 40, h: 44, name: 'Kepala Desa', text: 'Pasukan Iblis Perang telah bangkit! Ambil pedang ini!', questTrigger: 1 }],
        enemies: [], items: [{ x: 340, y: 220, w: 28, h: 28, id: 'sword', name: 'Iron Sword', type: 'weapon_sword' }], puzzles: []
    },
    darkForest: {
        name: '2. Dark Forest', forestTheme: true, color: '#0d210b', dark: false,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'mysticCanopy', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'village', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'g1', type: 'MummyGoblin', x: 280, y: 140, w: 38, h: 38, hp: 80, maxHp: 80, atk: 18, exp: 40, gold: 20 },
            { id: 'g2', type: 'MummyGoblin', x: 420, y: 220, w: 38, h: 38, hp: 80, maxHp: 80, atk: 18, exp: 40, gold: 20 },
            { id: 'g3', type: 'MummyGoblin', x: 580, y: 160, w: 38, h: 38, hp: 80, maxHp: 80, atk: 18, exp: 40, gold: 20 },
            { id: 'g4', type: 'MummyGoblin', x: 340, y: 380, w: 38, h: 38, hp: 80, maxHp: 80, atk: 18, exp: 40, gold: 20 },
            { id: 'g5', type: 'MummyGoblin', x: 500, y: 440, w: 38, h: 38, hp: 80, maxHp: 80, atk: 18, exp: 40, gold: 20 }
        ],
        items: [], puzzles: []
    },
    mysticCanopy: {
        name: '3. Mystic Canopy', forestTheme: true, color: '#092b1a', dark: false,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'armory', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'darkForest', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 't1', type: 'Treant', x: 320, y: 180, w: 42, h: 42, hp: 160, maxHp: 160, atk: 22, exp: 60, gold: 30 },
            { id: 't2', type: 'Treant', x: 480, y: 320, w: 42, h: 42, hp: 160, maxHp: 160, atk: 22, exp: 60, gold: 30 },
            { id: 't3', type: 'Treant', x: 620, y: 180, w: 42, h: 42, hp: 160, maxHp: 160, atk: 22, exp: 60, gold: 30 }
        ],
        items: [], puzzles: []
    },
    armory: {
        name: '4. Outpost Armory', color: '#2c3e50', dark: false,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'ancientCave', spawnX: 80, spawnY: 300, reqGun: true },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'mysticCanopy', spawnX: 680, spawnY: 300 },
        npcs: [], enemies: [],
        items: [{ x: 400, y: 280, w: 32, h: 32, id: 'rifle', name: 'Plasma Rifle', type: 'weapon_rifle' }],
        puzzles: []
    },
    ancientCave: {
        name: '5. Ancient Cave', color: '#121015', dark: true,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'necromancerLair', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'armory', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 's1', type: 'Skeleton', x: 280, y: 150, w: 36, h: 36, hp: 140, maxHp: 140, atk: 26, exp: 50, gold: 30 },
            { id: 's2', type: 'Skeleton', x: 420, y: 220, w: 36, h: 36, hp: 140, maxHp: 140, atk: 26, exp: 50, gold: 30 },
            { id: 'w1', type: 'DarkWolf', x: 350, y: 380, w: 42, h: 36, hp: 120, maxHp: 120, atk: 30, exp: 55, gold: 30 },
            { id: 'w2', type: 'DarkWolf', x: 550, y: 420, w: 42, h: 36, hp: 120, maxHp: 120, atk: 30, exp: 55, gold: 30 }
        ],
        items: [], puzzles: []
    },
    necromancerLair: {
        name: '6. Necromancer Crypt', color: '#180a29', dark: true,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'volcanoPass', spawnX: 80, spawnY: 300, reqItem: 'Ancient Key' },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'ancientCave', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'necro', type: 'Necromancer', isRanged: true, x: 550, y: 260, w: 44, h: 44, hp: 320, maxHp: 320, atk: 32, exp: 150, gold: 100 },
            { id: 's4', type: 'Skeleton', x: 350, y: 200, w: 36, h: 36, hp: 140, maxHp: 140, atk: 26, exp: 50, gold: 30 }
        ],
        items: [{ x: 650, y: 120, w: 24, h: 24, id: 'ancient_key', name: 'Ancient Key', type: 'key' }],
        puzzles: []
    },
    volcanoPass: {
        name: '7. Volcano Pass', color: '#3d0c02', dark: false,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'forgottenTemple', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'necromancerLair', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'v1', type: 'FireElemental', isRanged: true, x: 320, y: 180, w: 40, h: 40, hp: 200, maxHp: 200, atk: 34, exp: 80, gold: 50 },
            { id: 'v2', type: 'FireElemental', isRanged: true, x: 480, y: 340, w: 40, h: 40, hp: 200, maxHp: 200, atk: 34, exp: 80, gold: 50 },
            { id: 'v3', type: 'FireElemental', isRanged: true, x: 620, y: 180, w: 40, h: 40, hp: 200, maxHp: 200, atk: 34, exp: 80, gold: 50 }
        ],
        items: [{ x: 400, y: 280, w: 30, h: 30, id: 'wand', name: 'Flame Wand', type: 'weapon_wand' }],
        puzzles: []
    },
    forgottenTemple: {
        name: '8. Forgotten Temple', color: '#221c16', dark: false,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'dragonLair', spawnX: 80, spawnY: 300, reqPuzzle: true },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'volcanoPass', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'sk1', type: 'ShadowKnight', x: 350, y: 180, w: 42, h: 42, hp: 250, maxHp: 250, atk: 38, exp: 110, gold: 70 },
            { id: 'sk2', type: 'ShadowKnight', x: 520, y: 360, w: 42, h: 42, hp: 250, maxHp: 250, atk: 38, exp: 110, gold: 70 }
        ],
        items: [],
        puzzles: [{ x: 380, y: 100, w: 40, h: 40, active: false, label: 'Sakelar Segel Kuil' }]
    },
    dragonLair: {
        name: '9. Dragon Lair', color: '#2a0505', dark: false,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'bloodWarfield', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'forgottenTemple', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'dragon', type: 'DragonSentinel', isRanged: true, x: 480, y: 200, w: 72, h: 72, hp: 500, maxHp: 500, atk: 42, exp: 350, gold: 200 }
        ],
        items: [{ x: 350, y: 280, w: 32, h: 32, id: 'shotgun', name: 'Demon Shotgun', type: 'weapon_shotgun' }],
        puzzles: []
    },
    bloodWarfield: {
        name: '10. Blood Warfield', warTheme: true, color: '#3b0606', dark: false,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'abyssCitadel', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'dragonLair', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'wd1', type: 'WarDemon', x: 300, y: 160, w: 46, h: 46, hp: 320, maxHp: 320, atk: 40, exp: 140, gold: 90 },
            { id: 'wd2', type: 'WarDemon', x: 480, y: 320, w: 46, h: 46, hp: 320, maxHp: 320, atk: 40, exp: 140, gold: 90 },
            { id: 'wd3', type: 'WarDemon', x: 620, y: 180, w: 46, h: 46, hp: 320, maxHp: 320, atk: 40, exp: 140, gold: 90 }
        ],
        items: [], puzzles: []
    },
    abyssCitadel: {
        name: '11. Abyss Citadel', color: '#16021f', dark: true,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: { x: 750, y: 250, w: 40, h: 100, targetMap: 'lostKingdom', spawnX: 80, spawnY: 300 },
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'bloodWarfield', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            { id: 'wd4', type: 'WarDemon', x: 350, y: 180, w: 48, h: 48, hp: 380, maxHp: 380, atk: 44, exp: 180, gold: 110 },
            { id: 'sk4', type: 'ShadowKnight', x: 550, y: 350, w: 44, h: 44, hp: 300, maxHp: 300, atk: 40, exp: 150, gold: 90 }
        ],
        items: [], puzzles: []
    },
    lostKingdom: {
        name: '12. Lost Kingdom Castle', color: '#100202', dark: true,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }, { x: 760, y: 0, w: 40, h: 600 }],
        prevDoor: { x: 0, y: 250, w: 40, h: 100, targetMap: 'abyssCitadel', spawnX: 680, spawnY: 300 },
        npcs: [],
        enemies: [
            {
                id: 'boss', type: 'GuardianBoss', isBoss: true, isRanged: true, phase: 1,
                x: 500, y: 180, w: 90, h: 90, hp: 950, maxHp: 950, atk: 50, exp: 2000, gold: 1000
            }
        ],
        items: [], puzzles: []
    }
};

// --- INITIALIZATION ---
window.onload = async () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    await GameDatabase.init();

    window.addEventListener('keydown', e => {
        keys[e.key.toLowerCase()] = true;
        handleKeyPress(e.key.toLowerCase());
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

    document.getElementById('btn-new-game').onclick = () => startNewGame();
    document.getElementById('btn-continue').onclick = () => loadGame();
    document.getElementById('btn-restart-hud').onclick = () => restartGame();
    document.getElementById('btn-restart-menu').onclick = () => restartGame();
    document.getElementById('btn-restart-die').onclick = () => restartGame();
    document.getElementById('btn-restart-vic').onclick = () => restartGame();
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

// RESET DATABASE & RESTART GAME FUNCTION
async function restartGame() {
    if (confirm("Apakah Anda yakin ingin RESET seluruh Database & Restart Game dari awal?")) {
        await GameDatabase.clear();
        persistentUnlockedWeapons = { sword: true, rifle: false, wand: false, shotgun: false };
        startNewGame();
        addFloatingText(player.x, player.y - 20, 'DATABASE RESET! Restarting...', '#e74c3c');
    }
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
    saveGame();
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
            saveGame(); // Auto save Database pada transisi pintu
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
            saveGame(); // Database Sync
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
            saveGame();
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

            addFloatingText(enemy.x + 10, enemy.y - 10, `-${dmg}`, '#8e44ad');
            addParticle(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#8e44ad', 10, 5);

            if (enemy.isBoss) {
                screenShake = 12;
                if (enemy.hp <= enemy.maxHp * 0.5 && enemy.phase === 1) {
                    enemy.phase = 2; enemy.atk += 15;
                    triggerDialogue('Boss', 'Guardian memasuki Mode Marah!');
                }
            }

            if (enemy.hp <= 0) {
                player.gold += enemy.gold;
                addFloatingText(enemy.x, enemy.y, `+${enemy.gold}G`, '#f1c40f');
                addEXP(enemy.exp);

                if (enemy.isBoss) {
                    let q12 = quests.find(q => q.id === 12); if (q12) q12.status = 'Completed';
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
        saveGame();
    }
}

// --- ENEMY AI LOGIC ---
function updateEnemies() {
    if (currentState !== GameState.PLAYING) return;

    const currentMap = mapData[currentMapKey];
    for (let enemy of currentMap.enemies) {
        let dist = getDistance(player, enemy);
        let detectRange = enemy.isBoss ? 500 : 250;

        if (dist < detectRange) {
            let spd = enemy.isBoss && enemy.phase === 2 ? 2.8 : 1.8;
            if (enemy.x < player.x) enemy.x += spd;
            if (enemy.x > player.x) enemy.x -= spd;
            if (enemy.y < player.y) enemy.y += spd;
            if (enemy.y > player.y) enemy.y -= spd;

            if (enemy.isRanged && Math.random() < 0.025) {
                let angle = Math.atan2((player.y + 20) - (enemy.y + 20), (player.x + 20) - (enemy.x + 20));
                enemyBullets.push({
                    x: enemy.x + 20, y: enemy.y + 20,
                    vx: Math.cos(angle) * 6,
                    vy: Math.sin(angle) * 6,
                    life: 80, damage: enemy.atk
                });
            }

            if (checkRectOverlap(player, enemy)) {
                let damage = Math.max(1, enemy.atk - player.defense);
                player.hp -= damage * 0.06;
                if (Math.random() < 0.1) {
                    addFloatingText(player.x, player.y - 10, `-${Math.ceil(damage)}`, '#e74c3c');
                    addParticle(player.x + 20, player.y + 20, '#e74c3c', 4, 3);
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

// --- DATABASE SYNC FUNCTIONS ---
async function saveGame() {
    const saveData = {
        player: { ...player },
        currentMapKey,
        quests,
        puzzles: mapData.forgottenTemple.puzzles,
        persistentUnlockedWeapons
    };
    await GameDatabase.save(saveData);
}

async function loadGame() {
    const parsed = await GameDatabase.load();
    if (!parsed) { alert('Tidak ada file simpanan di Database.'); return; }
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

// --- REAL PROCEDURAL PLAYER RENDER ---
function renderPlayer(time) {
    let px = player.x, py = player.y;
    let walkStep = player.isMoving ? Math.sin(time * 0.015) : 0;
    let legOffset = walkStep * 7;

    drawShadow(px, py + player.height - 4, player.width);

    ctx.save();
    ctx.translate(px + player.width / 2, py + player.height / 2);
    if (player.direction === 'left') ctx.scale(-1, 1);

    ctx.fillStyle = '#111';
    ctx.fillRect(-8 + legOffset, 8, 6, 12);
    ctx.fillRect(2 - legOffset, 8, 6, 12);

    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-10 + legOffset, 18, 9, 4);
    ctx.fillRect(0 - legOffset, 18, 9, 4);

    ctx.fillStyle = '#8e44ad';
    ctx.fillRect(-10, -6, 20, 16);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(0, 8); ctx.lineTo(10, -6); ctx.fill();

    ctx.fillStyle = '#ffeaa7';
    ctx.beginPath(); ctx.arc(0, -12, 8, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#8e44ad';
    ctx.fillRect(2, -14, 3, 4);

    let hatSway = Math.sin(time * 0.008) * 3;
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(-14 + hatSway, -28); ctx.lineTo(0, -20); ctx.fill();
    ctx.fillStyle = '#8e44ad';
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(10 + hatSway, -28); ctx.lineTo(6, -18); ctx.fill();

    drawPlayerWeapon(time);

    ctx.restore();

    if (player.isAttacking && player.activeWeapon === 'sword') {
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 5;
        ctx.beginPath();
        let swingArc = (12 - player.attackTimer) * 0.3;
        ctx.arc(px + 20, py + 20, 32, swingArc - 0.5, swingArc + 0.8);
        ctx.stroke();
    }
}

// --- ANIMATED VILLAGE ELDER ---
function renderNPC(npc, time) {
    let nx = npc.x, ny = npc.y;
    let breath = Math.sin(time * 0.003) * 2;
    drawShadow(nx, ny + npc.h - 4, npc.w);

    ctx.save();
    ctx.translate(nx + npc.w / 2, ny + npc.h / 2 + breath);

    ctx.fillStyle = '#1b4965'; ctx.fillRect(-14, -8, 28, 24);
    ctx.fillStyle = '#e0aaff'; ctx.beginPath(); ctx.arc(0, -14, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-6, -18, 5, 3); ctx.fillRect(1, -18, 5, 3);
    ctx.restore();

    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Georgia';
    ctx.fillText(npc.name, nx - 10, ny + breath - 10);
}

// --- HORROR ENEMY PROCEDURAL RENDERERS ---
function renderMummyGoblin(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let walkAnim = Math.sin(time * 0.012 + ex) * 6;
    let headShake = Math.cos(time * 0.01 + ey) * 2;

    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    ctx.fillStyle = '#d5c8a0'; ctx.fillRect(-10 + walkAnim, 8, 7, 12); ctx.fillRect(3 - walkAnim, 8, 7, 12);
    ctx.fillStyle = '#c2b280'; ctx.fillRect(-12, -6, 24, 16);
    ctx.fillStyle = '#4a7c59'; ctx.beginPath(); ctx.arc(headShake, -14, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d5c8a0'; ctx.beginPath(); ctx.arc(headShake, -14, 11, 0.4, Math.PI * 1.8); ctx.fill();

    ctx.fillStyle = '#111'; ctx.fillRect(-6 + headShake, -17, 5, 5); ctx.fillRect(2 + headShake, -17, 5, 5);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(-4 + headShake, -16, 2, 2); ctx.fillRect(4 + headShake, -16, 2, 2);

    ctx.restore();
}

function renderTreant(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let sway = Math.sin(time * 0.005 + ex) * 3;

    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    ctx.fillStyle = '#3a2e1e'; ctx.fillRect(-14 + sway, -12, 28, 26);
    ctx.fillStyle = '#1e3a1e'; ctx.beginPath(); ctx.arc(sway, -20, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(-6 + sway, -12, 3, 3); ctx.fillRect(4 + sway, -12, 3, 3);

    ctx.restore();
}

function renderSkeleton(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    ctx.fillStyle = '#bdc3c7'; ctx.fillRect(-8, -8, 16, 14);
    ctx.fillStyle = '#ecf0f1'; ctx.beginPath(); ctx.arc(0, -16, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3498db'; ctx.fillRect(-5, -16, 2, 2); ctx.fillRect(3, -16, 2, 2);

    ctx.restore();
}

function renderDarkWolf(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    ctx.fillStyle = '#2c3e50'; ctx.fillRect(-18, -10, 36, 18);
    ctx.fillStyle = '#1a252f'; ctx.beginPath(); ctx.arc(12, -12, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(14, -14, 3, 3);

    ctx.restore();
}

function renderNecromancer(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let floatY = Math.sin(time * 0.005) * 6;

    drawShadow(ex, ey + enemy.h, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2 + floatY);

    ctx.fillStyle = '#4a154b'; ctx.beginPath(); ctx.moveTo(-16, -10); ctx.lineTo(16, -10); ctx.lineTo(20, 20); ctx.lineTo(-20, 20); ctx.fill();
    ctx.fillStyle = '#ecf0f1'; ctx.beginPath(); ctx.arc(0, -18, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2ecc71'; ctx.fillRect(-5, -20, 3, 3); ctx.fillRect(2, -20, 3, 3);

    ctx.restore();
}

function renderFireElemental(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let pulse = Math.sin(time * 0.015) * 3;

    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(0, 0, 16 + pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(0, 0, 10 + pulse / 2, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
}

function renderShadowKnight(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    ctx.fillStyle = '#1a1a24'; ctx.fillRect(-14, -14, 28, 28);
    ctx.fillStyle = '#a000ff'; ctx.fillRect(-8, -10, 16, 4);

    ctx.restore();
}

function renderWarDemon(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let pulse = Math.sin(time * 0.01) * 2;

    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    ctx.fillStyle = '#5c0606'; ctx.fillRect(-18 - pulse, -18 - pulse, 36 + pulse * 2, 36 + pulse * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.moveTo(-12, -18); ctx.lineTo(-20, -32); ctx.lineTo(-6, -18); ctx.fill();
    ctx.beginPath(); ctx.moveTo(12, -18); ctx.lineTo(20, -32); ctx.lineTo(6, -18); ctx.fill();
    ctx.fillStyle = '#ff0000'; ctx.fillRect(-8, -8, 4, 4); ctx.fillRect(4, -8, 4, 4);

    ctx.restore();
}

function renderDragon(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let wingFlap = Math.sin(time * 0.008) * 10;

    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    ctx.fillStyle = '#900c3f';
    ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(-35, -25 + wingFlap); ctx.lineTo(-15, 10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(35, -25 + wingFlap); ctx.lineTo(15, 10); ctx.fill();

    ctx.fillStyle = '#c0392b'; ctx.fillRect(-18, -18, 36, 36);
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(-8, -12, 4, 4); ctx.fillRect(4, -12, 4, 4);

    ctx.restore();
}

function renderBoss(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let pulse = Math.sin(time * 0.006) * 4;

    drawShadow(ex, ey + enemy.h - 4, enemy.w);
    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    ctx.fillStyle = enemy.phase === 2 ? '#900c3f' : '#4a0e17';
    ctx.fillRect(-35 - pulse / 2, -35 - pulse / 2, 70 + pulse, 70 + pulse);

    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.moveTo(-25, -35); ctx.lineTo(-35, -55); ctx.lineTo(-15, -35); ctx.fill();
    ctx.beginPath(); ctx.moveTo(25, -35); ctx.lineTo(35, -55); ctx.lineTo(15, -35); ctx.fill();

    ctx.fillStyle = '#f1c40f'; ctx.fillRect(-15, -15, 8, 8); ctx.fillRect(7, -15, 8, 8);

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
    else {
        renderMummyGoblin(enemy, time);
    }

    ctx.fillStyle = '#000'; ctx.fillRect(enemy.x, enemy.y - 10, enemy.w, 5);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(enemy.x, enemy.y - 10, (enemy.hp / enemy.maxHp) * enemy.w, 5);
}

function drawRealForestBackground() {
    let grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, '#0c1a0a'); grad.addColorStop(0.5, '#173312'); grad.addColorStop(1, '#0e240b');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#081206';
    const treeX = [20, 110, 210, 320, 430, 540, 650, 750];
    for (let tx of treeX) {
        ctx.fillRect(tx + 18, 20, 20, 560);
        ctx.beginPath();
        ctx.moveTo(tx - 30, 220); ctx.lineTo(tx + 28, 40); ctx.lineTo(tx + 86, 220);
        ctx.moveTo(tx - 25, 340); ctx.lineTo(tx + 28, 140); ctx.lineTo(tx + 81, 340); ctx.fill();
    }
}

function drawWarBackground() {
    let grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, '#2b0000'); grad.addColorStop(0.5, '#4a0505'); grad.addColorStop(1, '#1f0000');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#ff3300';
    for (let i = 0; i < 15; i++) {
        let ex = (i * 60 + Date.now() * 0.05) % 800;
        let ey = (i * 40 + Date.now() * 0.08) % 600;
        ctx.fillRect(ex, ey, 3, 3);
    }
}

function drawShadow(x, y, width) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath(); ctx.ellipse(x + width / 2, y + 4, width / 2, 6, 0, 0, Math.PI * 2); ctx.fill();
}

function render() {
    let time = Date.now();
    ctx.save();

    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        screenShake--;
    }

    const currentMap = mapData[currentMapKey];
    if (currentMap.forestTheme) drawRealForestBackground();
    else if (currentMap.warTheme) drawWarBackground();
    else { ctx.fillStyle = currentMap.color; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); }

    ctx.fillStyle = 'rgba(20, 15, 10, 0.85)';
    for (let w of currentMap.walls) ctx.fillRect(w.x, w.y, w.w, w.h);
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