/**
 * MYSTERY OF THE LOST KINGDOM - 50 Arenas & Aircraft Warzone Engine
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
            req.onerror = () => { resolve(null); };
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
                addFloatingText(enemy.x, enemy.y - 10, `-${dmg}`, b.color || '#f39c12');
                addParticle(b.x, b.y, b.color || '#ffaa00', 8, 4);

                if (enemy.hp <= 0) {
                    player.gold += enemy.gold;
                    addEXP(enemy.exp);
                    if (enemy.isBoss) {
                        if (currentMapKey === 'map_50') {
                            currentState = GameState.VICTORY;
                            showScreen('screen-victory');
                        }
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

    // Leaves FX
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
    speed: 4.5, isMoving: false,
    hp: 150, maxHp: 150,
    level: 1, exp: 0, nextExp: 100,
    attack: 25, defense: 5,
    activeWeapon: 'sword',
    gold: 0, direction: 'right',
    isAttacking: false, attackTimer: 0,
    inventory: [{ id: 'potion', name: 'Health Potion', count: 4, type: 'heal', value: 45 }]
};

// --- GENERATOR 50 QUESTS & MAPS ---
const quests = [];
const mapData = {};
let currentMapKey = 'village';

// Inisialisasi Name & Theme Masing-masing Dari 50 Arena
const arenaThemes = [
    { name: '1. Village Forest', theme: 'forest' },
    { name: '2. Dark Forest Swarm', theme: 'forest' },
    { name: '3. Mystic Canopy', theme: 'forest' },
    { name: '4. Outpost Armory', theme: 'armory', weapon: 'weapon_rifle' },
    { name: '5. Ancient Cave', theme: 'cave' },
    { name: '6. Necromancer Crypt', theme: 'cave' },
    { name: '7. Volcano Pass', theme: 'volcano', weapon: 'weapon_wand' },
    { name: '8. Forgotten Temple', theme: 'temple' },
    { name: '9. Dragon Lair', theme: 'volcano', weapon: 'weapon_shotgun' },
    { name: '10. Blood Warfield', theme: 'war' },
    { name: '11. Abyss Citadel', theme: 'abyss' },
    { name: '12. Sky Fortress Hangar', theme: 'sky' },
    { name: '13. Aerial Warzone Alpha', theme: 'sky' },
    { name: '14. Stealth Jet Corridor', theme: 'sky' },
    { name: '15. Flying Gunship Bay', theme: 'sky' },
    { name: '16. Cloud Stratosphere', theme: 'sky' },
    { name: '17. Mech Aircraft Factory', theme: 'tech' },
    { name: '18. Cyber Drone Trench', theme: 'tech' },
    { name: '19. Thunder Aviation Base', theme: 'sky' },
    { name: '20. Plasma Jet Airfield', theme: 'tech' },
    { name: '21. Infernal Skyway', theme: 'volcano' },
    { name: '22. Phantom Air Armada', theme: 'sky' },
    { name: '23. Heavy Gunship Deck', theme: 'sky' },
    { name: '24. Vredefort Crater', theme: 'war' },
    { name: '25. Obsidian Skyhold', theme: 'abyss' },
    { name: '26. Deathwing Airzone', theme: 'sky' },
    { name: '27. Dark Comet Runway', theme: 'sky' },
    { name: '28. Armored Bomber Trench', theme: 'war' },
    { name: '29. Eclipse Aerial Platform', theme: 'sky' },
    { name: '30. Bio-Aircraft Lab', theme: 'tech' },
    { name: '31. Nether Dragon Flight', theme: 'volcano' },
    { name: '32. Void Bomber Hangar', theme: 'abyss' },
    { name: '33. Storm Jet Canyon', theme: 'sky' },
    { name: '34. Iron Carrier Deck', theme: 'tech' },
    { name: '35. Shadow Fighter Skyway', theme: 'abyss' },
    { name: '36. Titan Air Dreadnought', theme: 'sky' },
    { name: '37. Meteor Gunship Pass', theme: 'volcano' },
    { name: '38. Doom Fighter Runway', theme: 'war' },
    { name: '39. Cyber Wing Garrison', theme: 'tech' },
    { name: '40. Blood Sky Warzone', theme: 'war' },
    { name: '41. High-Altitude Citadel', theme: 'sky' },
    { name: '42. Plasma Bomber Vault', theme: 'tech' },
    { name: '43. Overlord Air Armada', theme: 'sky' },
    { name: '44. Infernal Carrier Deck', theme: 'volcano' },
    { name: '45. Abyssal Jet Core', theme: 'abyss' },
    { name: '46. Warhead Hangar Delta', theme: 'war' },
    { name: '47. Final Air Defense Pass', theme: 'sky' },
    { name: '48. Royal Air Citadel', theme: 'temple' },
    { name: '49. Overlord Dragon Rampart', theme: 'volcano' },
    { name: '50. Overlord Castle Supreme', theme: 'abyss', isFinal: true }
];

// Pilihan Jenis Musuh Berdasarkan Tema & Level
function generateEnemiesForArena(index, theme) {
    if (index === 0) return []; // Village damai
    let enemyList = [];
    let count = Math.min(3 + Math.floor(index / 2.5), 10);

    for (let i = 0; i < count; i++) {
        let x = 250 + (i % 4) * 120;
        let y = 140 + Math.floor(i / 4) * 120 + (i % 2) * 30;
        let hpScale = 50 + index * 25;
        let atkScale = 12 + Math.floor(index * 2.2);

        // Memasukkan Musuh Pesawat Terbang (Aircraft) pada level udara/teknologi
        if (theme === 'sky' || theme === 'tech' || index >= 12 && i % 2 === 0) {
            enemyList.push({
                id: `e_${index}_${i}`, type: 'Aircraft', isRanged: true,
                x, y, w: 52, h: 44, hp: hpScale * 1.2, maxHp: hpScale * 1.2,
                atk: atkScale, exp: 50 + index * 10, gold: 25 + index * 5
            });
        } else if (theme === 'cave' || index < 6) {
            let types = ['MummyGoblin', 'Skeleton', 'DarkWolf'];
            enemyList.push({
                id: `e_${index}_${i}`, type: types[i % types.length],
                x, y, w: 38, h: 38, hp: hpScale, maxHp: hpScale,
                atk: atkScale, exp: 35 + index * 8, gold: 20 + index * 4
            });
        } else if (theme === 'volcano') {
            let types = ['FireElemental', 'DragonSentinel'];
            enemyList.push({
                id: `e_${index}_${i}`, type: types[i % types.length], isRanged: true,
                x, y, w: 44, h: 44, hp: hpScale * 1.3, maxHp: hpScale * 1.3,
                atk: atkScale + 4, exp: 60 + index * 10, gold: 30 + index * 5
            });
        } else {
            let types = ['WarDemon', 'ShadowKnight', 'Necromancer'];
            enemyList.push({
                id: `e_${index}_${i}`, type: types[i % types.length], isRanged: (i % 2 === 0),
                x, y, w: 42, h: 42, hp: hpScale * 1.1, maxHp: hpScale * 1.1,
                atk: atkScale + 2, exp: 55 + index * 9, gold: 28 + index * 4
            });
        }
    }

    // Penambahan Boss di Arena Ke-50
    if (index === 49) {
        enemyList = [{
            id: 'boss_50', type: 'GuardianBoss', isBoss: true, isRanged: true, phase: 1,
            x: 500, y: 180, w: 96, h: 96, hp: 3500, maxHp: 3500, atk: 75, exp: 5000, gold: 2500
        }];
    }
    return enemyList;
}

// Membangun 50 Map Data & Quests
for (let i = 0; i < 50; i++) {
    let key = i === 0 ? 'village' : `map_${i + 1}`;
    let nextKey = i < 49 ? `map_${i + 2}` : null;
    let prevKey = i > 0 ? (i === 1 ? 'village' : `map_${i}`) : null;
    let info = arenaThemes[i];

    quests.push({
        id: i + 1,
        title: `Arena ${i + 1}: ${info.name}`,
        desc: i === 0 ? 'Bicara dengan Kepala Desa.' : `Kalahkan seluruh ancaman di ${info.name}!`,
        status: i === 0 ? 'Not Started' : 'In Progress'
    });

    let items = [];
    if (info.weapon === 'weapon_rifle') items.push({ x: 400, y: 280, w: 32, h: 32, id: 'rifle', name: 'Plasma Rifle', type: 'weapon_rifle' });
    if (info.weapon === 'weapon_wand') items.push({ x: 400, y: 280, w: 30, h: 30, id: 'wand', name: 'Flame Wand', type: 'weapon_wand' });
    if (info.weapon === 'weapon_shotgun') items.push({ x: 400, y: 280, w: 32, h: 32, id: 'shotgun', name: 'Demon Shotgun', type: 'weapon_shotgun' });

    let mapColor = '#1a0505';
    if (info.theme === 'forest') mapColor = '#0d210b';
    if (info.theme === 'armory' || info.theme === 'tech') mapColor = '#2c3e50';
    if (info.theme === 'cave') mapColor = '#121015';
    if (info.theme === 'volcano') mapColor = '#3d0c02';
    if (info.theme === 'sky') mapColor = '#1a2536';
    if (info.theme === 'war') mapColor = '#3b0606';

    mapData[key] = {
        name: info.name,
        forestTheme: info.theme === 'forest',
        skyTheme: info.theme === 'sky',
        warTheme: info.theme === 'war',
        color: mapColor,
        dark: info.theme === 'cave' || info.isFinal,
        walls: [{ x: 0, y: 0, w: 800, h: 40 }, { x: 0, y: 560, w: 800, h: 40 }],
        door: nextKey ? { x: 750, y: 250, w: 40, h: 100, targetMap: nextKey, spawnX: 80, spawnY: 300 } : null,
        prevDoor: prevKey ? { x: 0, y: 250, w: 40, h: 100, targetMap: prevKey, spawnX: 680, spawnY: 300 } : null,
        npcs: i === 0 ? [{ x: 220, y: 220, w: 40, h: 44, name: 'Kepala Desa', text: '50 Arena Perang menantimu! Pesawat tempur musuh menyerang dari udara!', questTrigger: 1 }] : [],
        enemies: generateEnemiesForArena(i, info.theme),
        items: items,
        puzzles: []
    };
}

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

    let speed = 15;
    let vx = 0, vy = 0;
    if (player.direction === 'up') vy = -speed;
    if (player.direction === 'down') vy = speed;
    if (player.direction === 'left') vx = -speed;
    if (player.direction === 'right') vx = speed;

    if (wp === 'rifle') {
        bullets.push({ x: player.x + 20, y: player.y + 20, vx, vy, life: 50, damage: player.attack + 25, color: '#00f0ff' });
        SoundEngine.sfxGun();
    } else if (wp === 'wand') {
        bullets.push({ x: player.x + 20, y: player.y + 20, vx: vx * 0.8, vy: vy * 0.8, life: 60, damage: player.attack + 40, color: '#ff4400' });
        SoundEngine.sfxWand();
    } else if (wp === 'shotgun') {
        for (let angleOffset of [-0.25, 0, 0.25]) {
            let baseAngle = Math.atan2(vy, vx);
            let finalAngle = baseAngle + angleOffset;
            bullets.push({
                x: player.x + 20, y: player.y + 20,
                vx: Math.cos(finalAngle) * speed,
                vy: Math.sin(finalAngle) * speed,
                life: 35, damage: player.attack + 22, color: '#a000ff'
            });
        }
        SoundEngine.sfxShotgun();
    }
    addParticle(player.x + 20, player.y + 20, '#e67e22', 6, 4);
}

async function restartGame() {
    if (confirm("Reset seluruh Database 50 Arena & Restart dari awal?")) {
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
            saveGame();
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

    if (currentMap.enemies.length === 0) return true;

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
            triggerDialogue('Item Pickup', `Mendapatkan ${item.name}! Tekan [1-4] ganti senjata & [F] tembak.`);
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

                if (enemy.isBoss && currentMapKey === 'map_50') {
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

// --- ENEMY AI LOGIC WITH FLYING AIRCRAFT PATTERNS ---
function updateEnemies() {
    if (currentState !== GameState.PLAYING) return;

    const currentMap = mapData[currentMapKey];
    for (let enemy of currentMap.enemies) {
        let dist = getDistance(player, enemy);
        let detectRange = enemy.isBoss ? 500 : 300;

        if (dist < detectRange) {
            let spd = enemy.type === 'Aircraft' ? 2.4 : (enemy.isBoss && enemy.phase === 2 ? 2.8 : 1.8);
            if (enemy.x < player.x) enemy.x += spd;
            if (enemy.x > player.x) enemy.x -= spd;
            if (enemy.y < player.y) enemy.y += spd;
            if (enemy.y > player.y) enemy.y -= spd;

            // Tembakan Beruntun dari Pesawat / Musuh Jarak Jauh
            if (enemy.isRanged && Math.random() < (enemy.type === 'Aircraft' ? 0.035 : 0.025)) {
                let angle = Math.atan2((player.y + 20) - (enemy.y + 20), (player.x + 20) - (enemy.x + 20));
                enemyBullets.push({
                    x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2,
                    vx: Math.cos(angle) * 6.5,
                    vy: Math.sin(angle) * 6.5,
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
    showHUD();
    currentState = GameState.PLAYING;
}

// --- VISUAL WEAPONS & PLAYER RENDER ---
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

// --- RENDER MUSUH PESAWAT TERBANG PERANG (FLYING AIRCRAFT) ---
function renderAircraft(enemy, time) {
    let ex = enemy.x, ey = enemy.y;
    let propSpin = Math.sin(time * 0.05) * 12;

    // Bayangan Terbang di Tanah
    drawShadow(ex, ey + 45, enemy.w);

    ctx.save();
    ctx.translate(ex + enemy.w / 2, ey + enemy.h / 2);

    // Badan Utama Pesawat Tempur (Fuselage)
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a252f'; ctx.lineWidth = 2; ctx.stroke();

    // Sayap Pesawat Metalik
    ctx.fillStyle = '#7f8c8d';
    ctx.beginPath();
    ctx.moveTo(-8, -18); ctx.lineTo(8, -18); ctx.lineTo(12, -4); ctx.lineTo(-12, -4); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, 18); ctx.lineTo(8, 18); ctx.lineTo(12, 4); ctx.lineTo(-12, 4); ctx.fill();

    // Kaca Kokpit Pesawat (Glowing Cyan Canopy)
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath(); ctx.arc(6, -2, 6, 0, Math.PI * 2); ctx.fill();

    // Baling-Baling Depan Berputar / Jet Thruster
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(-26, -propSpin / 2, 3, propSpin);

    // Meriam Senapan Laser Ganda
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(18, -8, 8, 3);
    ctx.fillRect(18, 5, 8, 3);

    ctx.restore();
}

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
    if (enemy.type === 'Aircraft') renderAircraft(enemy, time);
    else if (enemy.type === 'MummyGoblin' || enemy.type === 'Goblin') renderMummyGoblin(enemy, time);
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

function drawSkyBackground() {
    let grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, '#101d2c'); grad.addColorStop(0.5, '#1e3047'); grad.addColorStop(1, '#0b131e');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Cloud Effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 0; i < 5; i++) {
        let cx = (i * 180 + Date.now() * 0.03) % 900 - 100;
        ctx.beginPath(); ctx.arc(cx, 120 + i * 80, 50, 0, Math.PI * 2); ctx.fill();
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
    else if (currentMap.skyTheme) drawSkyBackground();
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