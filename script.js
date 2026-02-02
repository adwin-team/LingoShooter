/**
 * LingoShooter - Game Logic
 */

class HistoryManager {
    static async save(data) {
        const payload = {
            user_id: localStorage.getItem('lingo_user_id') || this.generateUserId(),
            question_id: data.question_id,
            correct: data.correct,
            answer_index: data.answer_index,
            time: data.time,
            played_at: new Date().toISOString()
        };

        try {
            // 将来的な API エンドポイントへの送信を試行
            const response = await fetch('/api/save_history.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return await response.json();
        } catch (e) {
            // API未実装や通信エラー時はコンソール出力のみで握りつぶす
            console.log('History saved locally (API offline):', payload);
            return { status: 'offline', message: 'Saved to local log' };
        }
    }

    static generateUserId() {
        const id = 'u' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('lingo_user_id', id);
        return id;
    }
}

class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.isMuted = false;
        this.bgmOscillators = [];
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.3; // 全体の音量
    }

    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        } else {
            this.masterGain.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.1);
        }
        return this.isMuted;
    }

    playTone(freq, type, duration, startTime = 0, vol = 1.0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);

        return osc;
    }

    playShoot() {
        if (this.isMuted) return;
        // ピュンという音
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playExplosion() {
        if (this.isMuted) return;
        // ノイズ生成は少し複雑なので、簡易的に低周波の荒い音で代用
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playCorrect() {
        if (this.isMuted) return;
        this.playTone(880, 'sine', 0.1, 0, 0.5); // A5
        this.playTone(1108, 'sine', 0.3, 0.1, 0.5); // C#6
    }

    playWrong() {
        if (this.isMuted) return;
        this.playTone(150, 'sawtooth', 0.3, 0, 0.5);
        this.playTone(130, 'sawtooth', 0.3, 0.1, 0.5);
    }

    playReload() {
        if (this.isMuted) return;
        this.playTone(600, 'square', 0.05, 0, 0.3);
        this.playTone(600, 'square', 0.05, 0.1, 0.3);
    }

    startBGM() {
        // 簡易的なループBGM
        if (this.bgmTimer) return;

        const noteLength = 0.2;
        const sequence = [
            { f: 110, t: 'triangle' }, // A2
            { f: 110, t: 'triangle' },
            { f: 130, t: 'triangle' }, // C3
            { f: 0, t: null },
            { f: 164, t: 'triangle' }, // E3
            { f: 110, t: 'triangle' },
            { f: 196, t: 'triangle' }, // G3
            { f: 164, t: 'triangle' },
        ];

        let step = 0;
        this.bgmTimer = setInterval(() => {
            if (this.isMuted) return;
            const note = sequence[step % sequence.length];
            if (note.t) {
                this.playTone(note.f, note.t, noteLength, 0, 0.2);
            }
            step++;
        }, noteLength * 1000);
    }

    stopBGM() {
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
    }
}

const DEFAULT_QUESTIONS = [
    {
        "id": "q_0001",
        "level": 1,
        "category": "daily",
        "question": "How are you today?",
        "choices": ["I'm fine, thank you.", "Yes, I am.", "I go to school.", "At seven o'clock."],
        "answer": 0,
        "explanation": "挨拶への自然な返答。"
    },
    {
        "id": "q_0002",
        "level": 1,
        "category": "daily",
        "question": "What time is it now?",
        "choices": ["It's sunny.", "It's ten o'clock.", "I'm hungry.", "Yes, please."],
        "answer": 1,
        "explanation": "時間を尋ねる問いへの返答。"
    },
    {
        "id": "q_0003",
        "level": 1,
        "category": "daily",
        "question": "Where is the nearest station?",
        "choices": ["I like trains.", "Go straight and turn left.", "Yesterday morning.", "By bus."],
        "answer": 1,
        "explanation": "場所を尋ねる問いへの道案内。"
    }
];

class Game {
    constructor() {
        this.hp = 100;
        this.score = 0;
        this.questions = [];
        this.currentQuestion = null;
        this.isReloading = false;
        this.enemyDistance = 0; // 0が最遠、100が衝突
        this.gameActive = false;
        this.startTime = 0;
        this.lastFrameTime = 0;
        this.difficulty = 1.0;
        this.questionHistory = []; // 出題済みの問題ID履歴

        // DOM Elements
        this.hpBar = document.getElementById('hp-bar');
        this.scoreText = document.getElementById('score');
        this.questionText = document.getElementById('question-text');
        this.choiceBtns = document.querySelectorAll('.choice-btn');
        this.enemy = document.getElementById('enemy');
        this.reloadOverlay = document.getElementById('reload-overlay');
        this.reloadFill = document.getElementById('reload-fill');
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over');
        this.finalScoreText = document.getElementById('final-score');

        this.audio = new AudioManager(); // Audio Manager

        this.initEventListeners();
    }

    initEventListeners() {
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('retry-btn').addEventListener('click', () => this.start());

        // Sound Toggle
        const soundBtn = document.getElementById('sound-btn');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                const isMuted = this.audio.toggleMute();
                soundBtn.textContent = isMuted ? 'SOUND: OFF' : 'SOUND: ON';
                soundBtn.classList.toggle('muted', isMuted);
            });
        }

        this.choiceBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleAnswer(parseInt(e.target.dataset.index)));
        });
    }

    async loadQuestions() {
        try {
            const response = await fetch('questions.json');
            if (!response.ok) throw new Error('Network response was not ok');
            this.questions = await response.json();
        } catch (e) {
            console.warn('Failed to load questions via fetch, using default fallback:', e);
            this.questions = DEFAULT_QUESTIONS;
        }
    }

    async start() {
        if (this.questions.length === 0) {
            this.questionText.textContent = "Error: No missions available.";
            return;
        }

        // Audio init must be triggered by user interaction
        await this.audio.init();
        this.audio.startBGM();

        this.hp = 100;
        this.score = 0;
        this.difficulty = 1.0;
        this.updateUI();
        this.startScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
        this.gameActive = true;
        this.nextQuestion();
        this.lastFrameTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    nextQuestion() {
        if (!this.gameActive || this.questions.length === 0) return;

        // 除外する履歴の長さを決定（問題数の半分、最小1）
        const historyLimit = Math.max(1, Math.floor(this.questions.length / 2));

        let availableQuestions = this.questions;
        if (this.questions.length > 1) {
            availableQuestions = this.questions.filter(q => !this.questionHistory.includes(q.id));
        }

        // 万が一除外されすぎて空になった場合のセーフティ
        if (availableQuestions.length === 0) availableQuestions = this.questions;

        const questionData = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
        this.currentQuestion = questionData;

        // 履歴の更新
        this.questionHistory.push(questionData.id);
        if (this.questionHistory.length > historyLimit) {
            this.questionHistory.shift(); // 古い履歴を削除
        }

        this.questionText.textContent = questionData.question;
        this.enemyDistance = 0;
        this.startTime = performance.now();

        // 選択肢に元のインデックスを紐付けてからシャッフル
        const choices = questionData.choices.map((text, index) => ({ text, originalIndex: index }));
        for (let i = choices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [choices[i], choices[j]] = [choices[j], choices[i]];
        }

        this.shuffledChoices = choices;
        this.currentCorrectIndex = choices.findIndex(c => c.originalIndex === questionData.answer);

        this.choiceBtns.forEach((btn, i) => {
            btn.textContent = choices[i].text || "";
            btn.classList.remove('correct', 'wrong');
            btn.disabled = false;
        });

        // 敵の位置をリセット
        this.enemy.style.transform = `scale(1) translateY(0)`;
    }

    handleAnswer(index) {
        if (this.isReloading || !this.gameActive) return;

        const isCorrect = (index === this.currentCorrectIndex);
        const timeTaken = (performance.now() - this.startTime) / 1000;

        // 履歴保存 (バックグラウンド)
        HistoryManager.save({
            question_id: this.currentQuestion.id,
            correct: isCorrect,
            answer_index: this.shuffledChoices[index].originalIndex,
            time: timeTaken
        });

        if (isCorrect) {
            this.audio.playShoot();
            this.choiceBtns[index].classList.add('correct');
            this.score += Math.max(10, Math.floor(100 - this.enemyDistance));
            this.difficulty += 0.05;
            this.triggerWinEffect();
            setTimeout(() => this.nextQuestion(), 500);
        } else {
            this.audio.playWrong();
            this.triggerReload();
            this.takeDamage(10);
            this.choiceBtns[index].classList.add('wrong');
        }

        this.updateUI();
    }

    triggerWinEffect() {
        // 敵が吹き飛ぶアニメーションなど
        this.audio.playExplosion();
        this.audio.playCorrect();
        this.enemy.classList.add('shoot-up');
        setTimeout(() => this.enemy.classList.remove('shoot-up'), 500);
    }

    triggerReload() {
        this.isReloading = true;
        this.audio.playReload();
        this.reloadOverlay.classList.remove('hidden');
        let progress = 0;
        const reloadTime = 2000; // 2秒
        const step = 20;

        const interval = setInterval(() => {
            progress += (step / reloadTime) * 100;
            this.reloadFill.style.width = `${progress}%`;

            if (progress >= 100) {
                clearInterval(interval);
                this.isReloading = false;
                this.reloadOverlay.classList.add('hidden');
                this.reloadFill.style.width = '0%';
            }
        }, step);
    }

    takeDamage(amount) {
        this.hp -= amount;
        document.getElementById('game-container').classList.add('shake');
        setTimeout(() => document.getElementById('game-container').classList.remove('shake'), 500);

        if (this.hp <= 0) {
            this.hp = 0;
            this.endGame();
        }
        this.updateUI();
    }

    updateUI() {
        this.hpBar.style.width = `${this.hp}%`;
        this.scoreText.textContent = this.score.toString().padStart(6, '0');

        // HPが低いときに赤くする
        if (this.hp < 30) {
            this.hpBar.style.background = 'var(--danger-color)';
        } else {
            this.hpBar.style.background = 'linear-gradient(90deg, var(--accent-color), var(--success-color))';
        }
    }

    gameLoop(currentTime) {
        if (!this.gameActive) return;

        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // 敵の接近スピード (難易度に応じて上昇)
        const approachSpeed = 0.005 * this.difficulty * deltaTime;
        this.enemyDistance += approachSpeed;

        // 視覚的表現 (スケールアップ)
        const scale = 1 + (this.enemyDistance / 100) * 3;
        const translateY = (this.enemyDistance / 100) * 200;
        this.enemy.style.transform = `scale(${scale}) translateY(${translateY}px)`;

        // 一定距離以上で継続ダメージ
        if (this.enemyDistance > 100) {
            this.audio.playWrong(); // ダメージ音（簡易）
            this.takeDamage(1); // 衝突ダメージ
            this.enemyDistance = 80; // 少し押し戻す
        }

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    endGame() {
        this.gameActive = false;
        this.audio.stopBGM();
        this.finalScoreText.textContent = this.score;
        this.gameOverScreen.classList.remove('hidden');
    }
}

// 初期化
const game = new Game();
game.loadQuestions();
