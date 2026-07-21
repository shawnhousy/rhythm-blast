// ========== 音频系统 ==========
let audioCtx = null;
let audioEnabled = false;

function initAudio() {
    if (audioEnabled) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioEnabled = true;
    } catch (e) { console.log('Audio not supported'); }
}

function playTone(freq, dur, type = 'sine', vol = 0.3) {
    if (!audioEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + dur);
}

function playHitSound(type) {
    const sounds = {
        perfect: () => { playTone(880, 0.08, 'sine', 0.4); playTone(1320, 0.06, 'sine', 0.2); },
        great: () => { playTone(660, 0.08, 'sine', 0.3); },
        good: () => { playTone(440, 0.08, 'sine', 0.25); },
        miss: () => { playTone(150, 0.15, 'sawtooth', 0.2); }
    };
    (sounds[type] || sounds.good)();
}

function playBeat() {
    playTone(80, 0.08, 'sine', 0.3);
}

// ========== 背景粒子 ==========
function initBgParticles() {
    const canvas = document.getElementById('bgCanvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    function create() {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            hue: Math.random() * 60 + 220
        };
    }
    
    resize();
    for (let i = 0; i < 60; i++) particles.push(create());
    window.addEventListener('resize', resize);
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, 0.6)`;
            ctx.fill();
        });
        requestAnimationFrame(animate);
    }
    animate();
}

// ========== 歌曲数据 ==========
// 格式: [时间(ms), 轨道(0-3)]
const SONGS = [
    {
        id: 1,
        title: "新手入门",
        artist: "Tutorial",
        cover: "🎓",
        bpm: 90,
        difficulty: "easy",
        difficultyLabel: "简单",
        color: "#10b981",
        notes: generatePattern(90, 30, [0.6, 0.3, 0.08, 0.02])
    },
    {
        id: 2,
        title: "电子脉冲",
        artist: "Cyber Beat",
        cover: "⚡",
        bpm: 120,
        difficulty: "normal",
        difficultyLabel: "普通",
        color: "#22d3ee",
        notes: generatePattern(120, 50, [0.35, 0.3, 0.25, 0.1])
    },
    {
        id: 3,
        title: "霓虹之夜",
        artist: "Neon Dreams",
        cover: "🌃",
        bpm: 140,
        difficulty: "hard",
        difficultyLabel: "困难",
        color: "#f59e0b",
        notes: generatePattern(140, 70, [0.25, 0.3, 0.25, 0.2])
    },
    {
        id: 4,
        title: "终极挑战",
        artist: "Final Boss",
        cover: "👹",
        bpm: 170,
        difficulty: "expert",
        difficultyLabel: "专家",
        color: "#ef4444",
        notes: generatePattern(170, 100, [0.2, 0.3, 0.3, 0.2])
    }
];

// 生成谱面
function generatePattern(bpm, count, laneWeights) {
    const interval = 60000 / bpm;
    const notes = [];
    let time = 2000; // 2秒预备
    
    // 归一化权重
    const totalWeight = laneWeights.reduce((a, b) => a + b, 0);
    const normalized = laneWeights.map(w => w / totalWeight);
    
    for (let i = 0; i < count; i++) {
        // 选择轨道
        let r = Math.random();
        let lane = 0;
        let cum = 0;
        for (let j = 0; j < 4; j++) {
            cum += normalized[j];
            if (r < cum) { lane = j; break; }
        }
        
        notes.push([time, lane]);
        
        // 下一个音符的时间间隔
        let gap = interval;
        if (Math.random() < 0.15) gap = interval / 2; // 偶尔双倍速
        else if (Math.random() < 0.1) gap = interval * 1.5; // 偶尔放慢
        
        time += gap;
        
        // 偶尔添加和弦（同时多个音符）
        if (Math.random() < 0.08 && bpm >= 120) {
            let lane2 = (lane + 1 + Math.floor(Math.random() * 3)) % 4;
            notes.push([time, lane2]);
        }
    }
    
    return notes.sort((a, b) => a[0] - b[0]);
}

// ========== 游戏状态 ==========
const game = {
    currentSong: null,
    notes: [],
    activeNotes: [],
    startTime: 0,
    paused: false,
    pausedTime: 0,
    pauseStart: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    stats: { perfect: 0, great: 0, good: 0, miss: 0 },
    running: false,
    animationId: null,
    noteSpeed: 400 // px/s
};

// ========== 屏幕切换 ==========
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function showMenu() {
    stopGame();
    showScreen('menu');
}

function showHowToPlay() { showScreen('howtoplay'); }
function showTalentTest() { showScreen('talent'); }

function showSongSelect() {
    renderSongList();
    showScreen('songSelect');
}

// ========== 歌曲列表 ==========
function renderSongList() {
    const list = document.getElementById('songList');
    list.innerHTML = SONGS.map(song => `
        <div class="song-card" onclick="startGame(${song.id})">
            <div class="song-cover" style="background: linear-gradient(135deg, ${song.color}, ${song.color}88);">
                ${song.cover}
            </div>
            <div class="song-info">
                <h3>${song.title}</h3>
                <p>${song.artist}</p>
            </div>
            <div class="song-difficulty">
                <span class="difficulty-badge difficulty-${song.difficulty}">${song.difficultyLabel}</span>
                <span class="song-bpm">BPM ${song.bpm}</span>
            </div>
        </div>
    `).join('');
}

// ========== 游戏初始化 ==========
function startGame(songId) {
    const song = SONGS.find(s => s.id === songId);
    if (!song) return;
    
    game.currentSong = song;
    game.notes = [...song.notes];
    game.activeNotes = [];
    game.score = 0;
    game.combo = 0;
    game.maxCombo = 0;
    game.stats = { perfect: 0, great: 0, good: 0, miss: 0 };
    game.paused = false;
    game.pausedTime = 0;
    game.running = true;
    
    // 计算音符速度 (根据BPM调整)
    game.noteSpeed = 300 + (song.bpm - 90) * 2;
    
    // 重置UI
    updateScore();
    updateCombo();
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressText').textContent = '0%';
    document.getElementById('pauseMenu').classList.remove('show');
    
    // 初始化轨道
    initTrack();
    
    showScreen('game');
    
    // 开始游戏循环
    game.startTime = performance.now();
    gameLoop();
    
    // 4拍倒计时
    startCountdown(song.bpm);
}

function initTrack() {
    const container = document.getElementById('trackContainer');
    container.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const lane = document.createElement('div');
        lane.className = 'track-lane';
        lane.dataset.lane = i;
        // 添加键位光效元素
        const glow = document.createElement('div');
        glow.className = 'key-glow';
        lane.appendChild(glow);
        container.appendChild(lane);
    }
}

function startCountdown(bpm) {
    const interval = 60000 / bpm;
    let count = 4;
    playBeat();
    const timer = setInterval(() => {
        count--;
        if (count > 0) playBeat();
        else clearInterval(timer);
    }, interval);
}

// ========== 游戏循环 ==========
function gameLoop() {
    if (!game.running) return;
    
    game.animationId = requestAnimationFrame(gameLoop);
    
    if (game.paused) return;
    
    const now = performance.now() - game.startTime - game.pausedTime;
    const trackContainer = document.getElementById('trackContainer');
    const trackHeight = trackContainer.clientHeight;
    const judgeY = trackHeight - 100; // 判定线位置
    
    // 生成新音符
    const fallTime = judgeY / game.noteSpeed * 1000;
    while (game.notes.length > 0 && game.notes[0][0] - fallTime <= now) {
        const noteData = game.notes.shift();
        spawnNote(noteData[0], noteData[1]);
    }
    
    // 更新音符位置
    for (let i = game.activeNotes.length - 1; i >= 0; i--) {
        const note = game.activeNotes[i];
        const progress = (now - note.spawnTime) / (note.targetTime - note.spawnTime);
        const y = progress * judgeY;
        
        note.element.style.top = y + 'px';
        
        // 检查是否过了判定线（Miss）
        if (now > note.targetTime + 200 && !note.hit) {
            noteMiss(note);
            game.activeNotes.splice(i, 1);
        }
    }
    
    // 更新进度
    if (game.currentSong) {
        const totalDuration = game.currentSong.notes[game.currentSong.notes.length - 1][0] + 2000;
        const progress = Math.min(100, (now / totalDuration) * 100);
        document.getElementById('progressFill').style.width = progress + '%';
        document.getElementById('progressText').textContent = Math.round(progress) + '%';
        
        // 检查是否结束
        if (game.activeNotes.length === 0 && game.notes.length === 0 && now > totalDuration) {
            endGame();
        }
    }
}

function spawnNote(targetTime, lane) {
    const now = performance.now() - game.startTime - game.pausedTime;
    const laneEl = document.querySelector(`.track-lane[data-lane="${lane}"]`);
    if (!laneEl) return;
    
    const noteEl = document.createElement('div');
    noteEl.className = 'note';
    noteEl.style.top = '-30px';
    laneEl.appendChild(noteEl);
    
    game.activeNotes.push({
        element: noteEl,
        lane: lane,
        targetTime: targetTime,
        spawnTime: now,
        hit: false
    });
}

// ========== 输入处理 ==========
const keys = { d: 0, f: 1, j: 2, k: 3 };

document.addEventListener('keydown', (e) => {
    initAudio();
    const key = e.key.toLowerCase();
    
    // 暂停
    if ((key === 'escape' || key === ' ') && game.running) {
        e.preventDefault();
        togglePause();
        return;
    }
    
    if (!game.running || game.paused) return;
    
    const lane = keys[key];
    if (lane === undefined) return;
    
    e.preventDefault();
    pressKey(lane);
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    const lane = keys[key];
    if (lane !== undefined) releaseKey(lane);
});

function pressKey(lane) {
    const keyEl = document.querySelector(`.key[data-key="${['d','f','j','k'][lane]}"]`);
    if (keyEl) keyEl.classList.add('active');
    
    // 寻找最接近判定线的音符
    const now = performance.now() - game.startTime - game.pausedTime;
    let closestNote = null;
    let closestDiff = Infinity;
    
    for (const note of game.activeNotes) {
        if (note.lane === lane && !note.hit) {
            const diff = Math.abs(now - note.targetTime);
            if (diff < closestDiff && diff < 300) {
                closestDiff = diff;
                closestNote = note;
            }
        }
    }
    
    if (closestNote) {
        hitNote(closestNote, closestDiff);
    }
}

function releaseKey(lane) {
    const keyEl = document.querySelector(`.key[data-key="${['d','f','j','k'][lane]}"]`);
    if (keyEl) keyEl.classList.remove('active');
}

// ========== 触控支持 ==========
function initTouchControls() {
    // ---- 整个游戏轨道的全局触控（覆盖所有区域：轨道+判定线+按键） ----
    const gameTrack = document.querySelector('.game-track');
    const activeTouches = new Map(); // touchId -> lane

    function getLaneFromX(clientX) {
        if (!gameTrack) return -1;
        const rect = gameTrack.getBoundingClientRect();
        const x = clientX - rect.left;
        const laneWidth = rect.width / 4;
        const lane = Math.floor(x / laneWidth);
        return Math.max(0, Math.min(3, lane));
    }

    function triggerLane(lane) {
        if (lane < 0 || lane > 3) return;
        if (!game.running || game.paused) return;
        initAudio();
        pressKey(lane);
    }

    function releaseLane(lane) {
        if (lane < 0 || lane > 3) return;
        releaseKey(lane);
    }

    // 触摸事件 - 整个游戏区域
    gameTrack.addEventListener('touchstart', (e) => {
        e.preventDefault();
        initAudio();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const lane = getLaneFromX(touch.clientX);
            if (lane >= 0) {
                activeTouches.set(touch.identifier, lane);
                triggerLane(lane);
            }
        }
    }, { passive: false });

    gameTrack.addEventListener('touchmove', (e) => {
        e.preventDefault();
        // 手指滑动到不同轨道时，切换打击轨道
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const newLane = getLaneFromX(touch.clientX);
            const oldLane = activeTouches.get(touch.identifier);
            if (oldLane !== undefined && oldLane !== newLane) {
                releaseLane(oldLane);
                activeTouches.set(touch.identifier, newLane);
                triggerLane(newLane);
            }
        }
    }, { passive: false });

    gameTrack.addEventListener('touchend', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const lane = activeTouches.get(touch.identifier);
            if (lane !== undefined) {
                releaseLane(lane);
                activeTouches.delete(touch.identifier);
            }
        }
    }, { passive: false });

    gameTrack.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const lane = activeTouches.get(touch.identifier);
            if (lane !== undefined) {
                releaseLane(lane);
                activeTouches.delete(touch.identifier);
            }
        }
    }, { passive: false });

    // 鼠标事件 - 桌面端点击整个游戏区域
    let mousePressed = false;
    let currentMouseLane = -1;

    gameTrack.addEventListener('mousedown', (e) => {
        e.preventDefault();
        mousePressed = true;
        initAudio();
        const lane = getLaneFromX(e.clientX);
        currentMouseLane = lane;
        triggerLane(lane);
    });

    document.addEventListener('mousemove', (e) => {
        if (!mousePressed) return;
        const lane = getLaneFromX(e.clientX);
        if (lane !== currentMouseLane) {
            releaseLane(currentMouseLane);
            currentMouseLane = lane;
            triggerLane(lane);
        }
    });

    document.addEventListener('mouseup', () => {
        if (mousePressed) {
            mousePressed = false;
            releaseLane(currentMouseLane);
            currentMouseLane = -1;
        }
    });

    // 防止页面滚动/缩放
    document.addEventListener('touchmove', (e) => {
        if (game.running) e.preventDefault();
    }, { passive: false });

    // 双指缩放
    document.addEventListener('gesturestart', (e) => {
        if (game.running) e.preventDefault();
    });
}

// 检测是否为移动设备
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth <= 768;
}

// ========== 判定 ==========
function hitNote(note, diff) {
    note.hit = true;
    note.element.classList.add('hit');
    
    let judgment, scoreAdd;
    
    if (diff <= 50) {
        judgment = 'perfect';
        scoreAdd = 1000;
    } else if (diff <= 100) {
        judgment = 'great';
        scoreAdd = 700;
    } else if (diff <= 200) {
        judgment = 'good';
        scoreAdd = 400;
    } else {
        judgment = 'miss';
        scoreAdd = 0;
    }
    
    if (judgment !== 'miss') {
        game.combo++;
        game.maxCombo = Math.max(game.maxCombo, game.combo);
        // Combo加成
        const comboBonus = Math.min(1 + game.combo * 0.01, 2);
        game.score += Math.round(scoreAdd * comboBonus);
    } else {
        game.combo = 0;
    }
    
    game.stats[judgment]++;
    
    showJudgment(judgment);
    playHitSound(judgment);
    createParticles(note.lane, judgment);
    updateScore();
    updateCombo();
    
    // 移除音符
    setTimeout(() => {
        const idx = game.activeNotes.indexOf(note);
        if (idx > -1) game.activeNotes.splice(idx, 1);
        if (note.element.parentNode) note.element.parentNode.removeChild(note.element);
    }, 200);
}

function noteMiss(note) {
    if (note.hit) return;
    game.stats.miss++;
    game.combo = 0;
    showJudgment('miss');
    playHitSound('miss');
    updateCombo();
    
    if (note.element.parentNode) note.element.parentNode.removeChild(note.element);
}

function showJudgment(type) {
    const display = document.getElementById('judgeDisplay');
    const texts = { perfect: 'PERFECT!', great: 'GREAT!', good: 'GOOD', miss: 'MISS' };
    display.textContent = texts[type] || '';
    display.className = `judge-display show ${type}`;
    
    setTimeout(() => {
        display.className = `judge-display ${type}`;
    }, 500);
}

function createParticles(lane, judgment) {
    const trackContainer = document.getElementById('trackContainer');
    const laneEl = document.querySelector(`.track-lane[data-lane="${lane}"]`);
    if (!laneEl) return;
    
    const laneRect = laneEl.getBoundingClientRect();
    const containerRect = trackContainer.getBoundingClientRect();
    const x = laneRect.left - containerRect.left + laneRect.width / 2;
    const y = containerRect.height - 100;
    
    const colors = ['#6366f1', '#ec4899', '#22d3ee', '#10b981'];
    const color = colors[lane];
    
    // 粒子数量根据判定等级
    const particleCount = judgment === 'perfect' ? 20 : judgment === 'great' ? 14 : 8;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const angle = (Math.PI * 2 / particleCount) * i + (Math.random() - 0.5) * 0.8;
        const dist = 60 + Math.random() * 80;
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        const size = 4 + Math.random() * 8;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.background = color;
        particle.style.color = color;
        particle.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        particle.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
        trackContainer.appendChild(particle);
        
        setTimeout(() => particle.remove(), 800);
    }
    
    // 打击光环
    const ring = document.createElement('div');
    ring.className = 'hit-ring';
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    ring.style.width = '60px';
    ring.style.height = '60px';
    ring.style.color = color;
    trackContainer.appendChild(ring);
    setTimeout(() => ring.remove(), 600);
    
    // 第二个光环（延迟）
    setTimeout(() => {
        const ring2 = document.createElement('div');
        ring2.className = 'hit-ring';
        ring2.style.left = x + 'px';
        ring2.style.top = y + 'px';
        ring2.style.width = '40px';
        ring2.style.height = '40px';
        ring2.style.color = '#ffffff';
        ring2.style.opacity = '0.6';
        trackContainer.appendChild(ring2);
        setTimeout(() => ring2.remove(), 600);
    }, 50);
    
    // 打击闪光
    if (judgment === 'perfect' || judgment === 'great') {
        const flash = document.createElement('div');
        flash.className = 'hit-flash';
        flash.style.left = x + 'px';
        flash.style.top = y + 'px';
        flash.style.width = '100px';
        flash.style.height = '100px';
        trackContainer.appendChild(flash);
        setTimeout(() => flash.remove(), 300);
    }
    
    // 键位光效
    const keyGlow = laneEl.querySelector('.key-glow');
    if (keyGlow) {
        keyGlow.classList.remove('active');
        void keyGlow.offsetWidth;
        keyGlow.classList.add('active');
    }
    
    // 屏幕震动（仅 PERFECT 且高连击时）
    if (judgment === 'perfect' && game.combo > 30) {
        const gameTrack = document.querySelector('.game-track');
        if (gameTrack) {
            gameTrack.classList.remove('screen-shake');
            void gameTrack.offsetWidth;
            gameTrack.classList.add('screen-shake');
        }
    }
}

// ========== UI更新 ==========
function updateScore() {
    document.getElementById('score').textContent = game.score.toLocaleString();
}

function updateCombo() {
    const comboDisplay = document.getElementById('comboDisplay');
    const comboNum = document.getElementById('combo');
    
    if (game.combo > 0) {
        comboDisplay.classList.add('show');
        comboNum.textContent = game.combo;
        
        // 高连击特效
        if (game.combo >= 50) {
            comboDisplay.classList.add('hot');
        } else {
            comboDisplay.classList.remove('hot');
        }
        
        // 脉冲动画
        comboDisplay.classList.remove('pulse');
        void comboDisplay.offsetWidth;
        comboDisplay.classList.add('pulse');
    } else {
        comboDisplay.classList.remove('show', 'hot');
    }
}

// ========== 暂停 ==========
function togglePause() {
    if (!game.running) return;
    
    game.paused = !game.paused;
    
    if (game.paused) {
        game.pauseStart = performance.now();
        document.getElementById('pauseMenu').classList.add('show');
    } else {
        game.pausedTime += performance.now() - game.pauseStart;
        document.getElementById('pauseMenu').classList.remove('show');
    }
}

function restartSong() {
    if (game.currentSong) {
        stopGame();
        startGame(game.currentSong.id);
    }
}

function quitGame() {
    stopGame();
    showSongSelect();
}

function stopGame() {
    game.running = false;
    if (game.animationId) cancelAnimationFrame(game.animationId);
    
    // 清理音符
    document.querySelectorAll('.note').forEach(n => n.remove());
    document.querySelectorAll('.particle').forEach(p => p.remove());
}

// ========== 结算 ==========
function endGame() {
    stopGame();
    
    // 计算准确率
    const total = game.stats.perfect + game.stats.great + game.stats.good + game.stats.miss;
    const accuracy = total > 0 
        ? ((game.stats.perfect * 100 + game.stats.great * 80 + game.stats.good * 50) / (total * 100) * 100)
        : 0;
    
    // 评级
    let rank;
    if (accuracy >= 95) rank = 'S+';
    else if (accuracy >= 90) rank = 'S';
    else if (accuracy >= 80) rank = 'A';
    else if (accuracy >= 70) rank = 'B';
    else if (accuracy >= 60) rank = 'C';
    else rank = 'D';
    
    // 计算积分
    const pointsData = calculatePoints(accuracy, rank, game.score, game.maxCombo);
    
    document.getElementById('resultRank').textContent = rank;
    document.getElementById('resultScore').textContent = game.score.toLocaleString();
    document.getElementById('resultMaxCombo').textContent = game.maxCombo;
    document.getElementById('resultPerfect').textContent = game.stats.perfect;
    document.getElementById('resultGreat').textContent = game.stats.great;
    document.getElementById('resultGood').textContent = game.stats.good;
    document.getElementById('resultMiss').textContent = game.stats.miss;
    document.getElementById('resultAccuracy').textContent = accuracy.toFixed(2) + '%';
    
    // 显示积分
    document.getElementById('pointsBreakdown').innerHTML = `
        <div class="points-item"><span>基础分 (${game.score.toLocaleString()})</span><span>×1</span></div>
        <div class="points-item"><span>准确率 (${accuracy.toFixed(1)}%)</span><span>×${(accuracy/100).toFixed(2)}</span></div>
        <div class="points-item"><span>难度 (${game.currentSong.difficultyLabel})</span><span>×${pointsData.difficultyMultiplier}</span></div>
        <div class="points-item"><span>评级加成 (${rank})</span><span>×${pointsData.rankMultiplier}</span></div>
        <div class="points-item"><span>最大连击 (${game.maxCombo})</span><span>+${pointsData.comboBonus}</span></div>
    `;
    document.getElementById('pointsEarned').textContent = '+' + pointsData.total;
    
    // 保存记录
    saveGameRecord({
        songId: game.currentSong.id,
        songTitle: game.currentSong.title,
        score: game.score,
        accuracy: accuracy,
        rank: rank,
        maxCombo: game.maxCombo,
        points: pointsData.total,
        stats: { ...game.stats },
        timestamp: Date.now()
    });
    
    showScreen('result');
}

// ========== 积分系统 ==========
function calculatePoints(accuracy, rank, score, maxCombo) {
    // 难度倍率
    const difficultyMultipliers = { easy: 1, normal: 1.5, hard: 2, expert: 3 };
    const diffMult = difficultyMultipliers[game.currentSong.difficulty] || 1;
    
    // 评级倍率
    const rankMultipliers = { 'S+': 2, 'S': 1.7, 'A': 1.4, 'B': 1.2, 'C': 1.0, 'D': 0.8 };
    const rankMult = rankMultipliers[rank] || 1;
    
    // 连击加成
    const comboBonus = Math.floor(maxCombo / 10) * 10;
    
    // 总分计算
    const basePoints = Math.floor(score / 100);
    let total = Math.floor(basePoints * (accuracy / 100) * diffMult * rankMult) + comboBonus;
    total = Math.max(0, total);
    
    return {
        basePoints,
        difficultyMultiplier: diffMult,
        rankMultiplier: rankMult,
        comboBonus,
        total
    };
}

// ========== API 配置（Cloudflare Pages Functions）==========
const API_BASE = ''; // 空字符串表示同源（/api/*）
let apiAvailable = false;

// 检测 API 是否可用
async function checkApiAvailability() {
    try {
        const res = await fetch(`${API_BASE}/api/leaderboard?type=total`, { method: 'GET' });
        apiAvailable = res.ok;
        return apiAvailable;
    } catch {
        apiAvailable = false;
        return false;
    }
}

// ========== 数据存储（仅云端，不使用本地缓存）==========
const PLAYER_STORAGE_KEY = 'rhythmBlastPlayer';
const OLD_STORAGE_KEY = 'rhythmBlastData';
const OLD_SB_KEY = 'rhythmBlastSupabaseConfig';

// 清理旧版本的本地缓存数据
(function cleanOldCache() {
    try {
        localStorage.removeItem(OLD_STORAGE_KEY);
        localStorage.removeItem(OLD_SB_KEY);
    } catch {}
})();

let currentTotalPoints = 0;

// 只保存玩家昵称到本地（昵称不是敏感数据）
function loadPlayerName() {
    try {
        return localStorage.getItem(PLAYER_STORAGE_KEY) || '';
    } catch {
        return '';
    }
}

function savePlayerNameToStorage(name) {
    try {
        localStorage.setItem(PLAYER_STORAGE_KEY, name);
    } catch {}
}

async function saveGameRecord(record) {
    const playerName = loadPlayerName() || '匿名玩家';
    record.playerName = playerName;
    
    // 只通过 API 存入数据库，不存本地
    if (apiAvailable) {
        try {
            const res = await fetch(`${API_BASE}/api/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_name: record.playerName,
                    song_id: String(record.songId),
                    song_title: record.songTitle,
                    score: record.score,
                    accuracy: record.accuracy,
                    rank: record.rank,
                    max_combo: record.maxCombo,
                    points: record.points,
                    perfect: record.stats.perfect,
                    great: record.stats.great,
                    good: record.stats.good,
                    miss: record.stats.miss,
                    difficulty: game.currentSong ? game.currentSong.difficulty : 'normal'
                })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error('保存到数据库失败:', err.error || res.statusText);
                alert('保存失败: ' + (err.error || res.statusText));
            } else {
                // 更新总积分
                currentTotalPoints += record.points;
                updatePlayerDisplay();
            }
        } catch (err) {
            console.error('保存错误:', err);
            alert('网络错误，无法保存记录');
        }
    } else {
        alert('云端 API 未连接，记录无法保存。请确保已部署到 Cloudflare Pages 并配置环境变量。');
    }
}

async function fetchMyTotalPoints() {
    if (!apiAvailable) return 0;
    const playerName = loadPlayerName() || '匿名玩家';
    try {
        const res = await fetch(`${API_BASE}/api/leaderboard?type=total`);
        if (!res.ok) return 0;
        const { data } = await res.json();
        const myData = data.find(p => p.player_name === playerName);
        return myData ? Number(myData.total_points) : 0;
    } catch {
        return 0;
    }
}

function updatePlayerDisplay() {
    const nameInput = document.getElementById('playerName');
    const savedName = loadPlayerName();
    if (nameInput && savedName) nameInput.value = savedName;
    const pointsEl = document.getElementById('totalPoints');
    if (pointsEl) pointsEl.textContent = currentTotalPoints.toLocaleString();
}

function savePlayerName() {
    const nameInput = document.getElementById('playerName');
    if (!nameInput) return;
    const name = nameInput.value.trim() || '匿名玩家';
    savePlayerNameToStorage(name);
    // 重新获取总积分
    fetchMyTotalPoints().then(p => {
        currentTotalPoints = p;
        updatePlayerDisplay();
    });
}

// ========== 排行榜（仅云端）==========
let currentLeaderboardTab = 'total';

function showLeaderboard() {
    renderLeaderboard();
    showScreen('leaderboard');
}

function switchLeaderboardTab(tab) {
    currentLeaderboardTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    renderLeaderboard();
}

async function renderLeaderboard() {
    const container = document.getElementById('leaderboardContent');
    const currentName = loadPlayerName() || '匿名玩家';
    
    if (!apiAvailable) {
        container.innerHTML = `
            <div class="empty-leaderboard">
                <div class="empty-icon">⚠️</div>
                <p>云端 API 未连接</p>
                <p style="font-size:13px;color:var(--text-muted);margin-top:8px;">请确保已部署到 Cloudflare Pages 并配置了 Supabase 环境变量</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '<div class="empty-leaderboard"><p>加载中...</p></div>';
    
    try {
        if (currentLeaderboardTab === 'total') {
            const res = await fetch(`${API_BASE}/api/leaderboard?type=total`);
            if (!res.ok) throw new Error(res.statusText);
            const { data: totals } = await res.json();
            
            // 确保当前玩家在列表中
            const myData = totals.find(p => p.player_name === currentName);
            if (!myData && currentTotalPoints > 0) {
                totals.push({
                    player_name: currentName,
                    total_points: currentTotalPoints,
                    play_count: 0,
                    best_accuracy: 0
                });
                totals.sort((a, b) => b.total_points - a.total_points);
            }
            
            if (totals.length === 0) {
                container.innerHTML = `
                    <div class="empty-leaderboard">
                        <div class="empty-icon">🎮</div>
                        <p>还没有游戏记录</p>
                        <p>去玩一把游戏，创造你的记录吧！</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="leaderboard-section">
                        <h3>🏆 全球总积分排名</h3>
                        ${totals.map((p, i) => renderRankRow(
                            i + 1, 
                            p.player_name, 
                            Number(p.total_points).toLocaleString() + ' 分', 
                            `${p.play_count || 0} 次${p.best_accuracy ? ' · 最高 ' + Number(p.best_accuracy).toFixed(1) + '%' : ''}`, 
                            p.player_name === currentName
                        )).join('')}
                    </div>
                `;
            }
        } else {
            // 单曲排行
            let html = '';
            for (const song of SONGS) {
                const res = await fetch(`${API_BASE}/api/leaderboard?type=songs&song_id=${song.id}`);
                if (!res.ok) continue;
                const { data: songRecords } = await res.json();
                
                if (songRecords && songRecords.length > 0) {
                    html += `
                        <div class="leaderboard-section">
                            <h3>${song.cover} ${song.title} <span style="font-size:12px;color:var(--text-muted);">(${song.difficultyLabel})</span></h3>
                            ${songRecords.slice(0, 5).map((r, i) => renderRankRow(
                                i + 1, 
                                r.player_name, 
                                Number(r.score).toLocaleString(), 
                                `${r.rank} · ${Number(r.accuracy).toFixed(1)}% · ${r.max_combo}combo`, 
                                r.player_name === currentName
                            )).join('')}
                        </div>
                    `;
                }
            }
            
            container.innerHTML = html || `
                <div class="empty-leaderboard">
                    <div class="empty-icon">🎵</div>
                    <p>还没有单曲记录</p>
                    <p>完成歌曲后会在这里显示排行榜</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('排行榜加载失败:', err);
        container.innerHTML = `
            <div class="empty-leaderboard">
                <div class="empty-icon">❌</div>
                <p>排行榜加载失败</p>
                <p style="font-size:13px;color:var(--text-muted);margin-top:8px;">${err.message || '网络错误'}</p>
            </div>
        `;
    }
}

function renderRankRow(rank, player, score, extra, isYou) {
    const rankClass = rank <= 3 ? `top${rank}` : '';
    const badgeClass = rank === 1 ? 'r1' : rank === 2 ? 'r2' : rank === 3 ? 'r3' : 'normal';
    return `
        <div class="leaderboard-row ${rankClass}">
            <div class="rank-badge ${badgeClass}">${rank}</div>
            <div class="rank-player ${isYou ? 'you' : ''}">${player}${isYou ? ' (你)' : ''}</div>
            <div class="rank-score">${score}</div>
            <div class="rank-extra">${extra}</div>
        </div>
    `;
}

function clearLeaderboard() {
    alert('云端记录无法从客户端删除。如需清除，请在 Supabase 控制台操作。');
}

// ========== 天赋测试（简化版）==========
let miniCpsState = { running: false, count: 0, timer: null };

function startMiniCps() {
    initAudio();
    if (miniCpsState.running) return;
    
    miniCpsState.running = true;
    miniCpsState.count = 0;
    let timeLeft = 10;
    
    const countEl = document.getElementById('miniCpsCount');
    const timeEl = document.getElementById('miniCpsTime');
    const cpsEl = document.getElementById('miniCps');
    const resultEl = document.getElementById('miniCpsResult');
    const btnEl = document.getElementById('miniCpsBtn');
    
    resultEl.style.display = 'none';
    cpsEl.classList.add('active');
    btnEl.style.display = 'none';
    
    const updateTime = () => {
        timeEl.textContent = timeLeft.toFixed(1) + 's';
    };
    
    const onClick = () => {
        if (!miniCpsState.running) return;
        miniCpsState.count++;
        countEl.textContent = miniCpsState.count;
        playClick();
    };
    
    cpsEl.addEventListener('click', onClick);
    
    miniCpsState.timer = setInterval(() => {
        timeLeft -= 0.1;
        updateTime();
        
        if (timeLeft <= 0) {
            clearInterval(miniCpsState.timer);
            miniCpsState.running = false;
            cpsEl.classList.remove('active');
            cpsEl.removeEventListener('click', onClick);
            
            const cps = miniCpsState.count / 10;
            let rank;
            if (cps >= 10) rank = '神级手速！';
            else if (cps >= 8) rank = '非常优秀！';
            else if (cps >= 6) rank = '不错哦！';
            else if (cps >= 4) rank = '继续加油！';
            else rank = '多多练习！';
            
            resultEl.textContent = `CPS: ${cps.toFixed(2)} - ${rank}`;
            resultEl.style.display = 'block';
            btnEl.style.display = '';
            btnEl.textContent = '再测一次';
        }
    }, 100);
}

// 反应测试
let miniReactionState = { state: 'idle', startTime: 0, timeout: null, best: Infinity, count: 0, total: 0 };

document.addEventListener('DOMContentLoaded', () => {
    const box = document.getElementById('miniReactionBox');
    if (!box) return;
    
    box.addEventListener('click', () => {
        initAudio();
        const s = miniReactionState;
        const resultEl = document.getElementById('miniReactionResult');
        
        switch (s.state) {
            case 'idle':
            case 'result':
                s.state = 'waiting';
                box.className = 'mini-reaction-box waiting';
                box.textContent = '等待...';
                resultEl.style.display = 'none';
                
                s.timeout = setTimeout(() => {
                    s.state = 'go';
                    s.startTime = Date.now();
                    box.className = 'mini-reaction-box go';
                    box.textContent = '按！';
                }, Math.random() * 3000 + 1000);
                break;
                
            case 'waiting':
                clearTimeout(s.timeout);
                s.state = 'too-early';
                box.className = 'mini-reaction-box too-early';
                box.textContent = '太早了！';
                playError();
                setTimeout(() => {
                    s.state = 'idle';
                    box.className = 'mini-reaction-box';
                    box.textContent = '点击开始';
                }, 1000);
                break;
                
            case 'go':
                const rt = Date.now() - s.startTime;
                s.state = 'result';
                s.count++;
                s.total += rt;
                s.best = Math.min(s.best, rt);
                box.className = 'mini-reaction-box';
                box.textContent = `${rt} ms`;
                playTone(660, 0.1);
                
                resultEl.textContent = `平均: ${Math.round(s.total/s.count)}ms · 最快: ${s.best}ms (${s.count}次)`;
                resultEl.style.display = 'block';
                break;
        }
    });
});

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    initBgParticles();
    initTouchControls();
    
    // 移动端特殊处理
    if (isMobile()) {
        document.body.classList.add('mobile');
    }
    
    // 加载玩家信息
    updatePlayerDisplay();
    
    // 检测云端 API 是否可用，并获取玩家总积分
    checkApiAvailability().then(() => {
        if (apiAvailable) {
            fetchMyTotalPoints().then(p => {
                currentTotalPoints = p;
                updatePlayerDisplay();
            });
        }
    });
    
    // 保存昵称
    const nameInput = document.getElementById('playerName');
    if (nameInput) {
        nameInput.addEventListener('change', savePlayerName);
        nameInput.addEventListener('blur', savePlayerName);
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') nameInput.blur();
        });
    }
    
    // 点击任意位置启用音频
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
});
