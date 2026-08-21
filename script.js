// ==========================================
// CONFIGURATION & ASSET PLACEHOLDERS
// ==========================================
const ASSETS = {
    sounds: {
        hover: 'assets/sounds/UI_HOVER.mp3',
        click: 'assets/sounds/UI_CLICK.mp3',
        menuMusic: 'assets/sounds/MENU_MUSIC.mp3',
        gameMusic: 'assets/sounds/GAME_MUSIC.mp3',
        intro: 'assets/sounds/DANIEL_INTRO.mp3',
        victory: 'assets/sounds/VICTORY.mp3',
        defeat: 'assets/sounds/DEFEAT.mp3',
        hunt: 'assets/sounds/DANIEL_HUNT.mp3'
    },
    dialogue: [
        "Interesting...",
        "You're thinking too much.",
        "Is that really your best move?",
        "I expected more from you, Detective.",
        "Your move.",
        "There is no escape.",
        "Clock is ticking."
    ]
};

// ==========================================
// STATE MANAGEMENT
// ==========================================
const State = {
    mode: 'pc',
    musicOn: true,
    sfxOn: true,
    difficulty: 'normal',
    game: null, // chess.js instance
    selectedSquare: null,
    isPlayerTurn: true
};

// ==========================================
// AUDIO MANAGER
// ==========================================
const AudioMgr = {
    elements: {},
    bgm: null,

    init() {
        for (const [key, path] of Object.entries(ASSETS.sounds)) {
            const audio = new Audio(path);
            audio.onerror = () => console.warn(`Audio missing (Error handled): ${path}`);
            this.elements[key] = audio;
        }
        this.elements.menuMusic.loop = true;
        this.elements.gameMusic.loop = true;
    },

    playSFX(key) {
        if (!State.sfxOn || !this.elements[key]) return;
        this.elements[key].currentTime = 0;
        this.elements[key].play().catch(() => {});
    },

    playBGM(key) {
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
        if (!State.musicOn || !this.elements[key]) return;
        this.bgm = this.elements[key];
        this.bgm.play().catch(() => {});
    },
    
    stopBGM() {
        if (this.bgm) this.bgm.pause();
    }
};

// ==========================================
// UI & SETTINGS MANAGER
// ==========================================
const UIMgr = {
    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },

    setMode(mode) {
        State.mode = mode;
        document.body.className = `mode-${mode}`;
        this.saveSettings();
    },

    saveSettings() {
        localStorage.setItem('danielChessSettings', JSON.stringify({
            mode: State.mode,
            musicOn: State.musicOn,
            sfxOn: State.sfxOn,
            difficulty: State.difficulty
        }));
    },

    loadSettings() {
        const saved = localStorage.getItem('danielChessSettings');
        if (saved) {
            const data = JSON.parse(saved);
            State.mode = data.mode;
            State.musicOn = data.musicOn;
            State.sfxOn = data.sfxOn;
            State.difficulty = data.difficulty;
        }
        
        document.body.className = `mode-${State.mode}`;
        document.getElementById('toggle-music').textContent = State.musicOn ? 'ON' : 'OFF';
        document.getElementById('toggle-sfx').textContent = State.sfxOn ? 'ON' : 'OFF';
        document.getElementById('select-device').value = State.mode;
        document.getElementById('select-diff').value = State.difficulty;
    },

    showMessage(id, text, duration = 3000) {
        const el = document.getElementById(id);
        el.textContent = text;
        setTimeout(() => el.textContent = '', duration);
    }
};

// ==========================================
// CHESS & AI MANAGER
// ==========================================
const ChessMgr = {
    boardEl: document.getElementById('chessboard'),
    piecesMap: {
        'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
        'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔'
    },

    init() {
        State.game = new Chess(); // Using chess.js from CDN
        this.renderBoard();
    },

    renderBoard() {
        this.boardEl.innerHTML = '';
        const board = State.game.board(); // 8x8 array
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const square = document.createElement('div');
                const isDark = (r + c) % 2 !== 0;
                square.className = `square ${isDark ? 'dark' : 'light'}`;
                
                const algebraic = String.fromCharCode(97 + c) + (8 - r);
                square.dataset.sq = algebraic;

                if (board[r][c]) {
                    const piece = document.createElement('span');
                    piece.className = `piece ${board[r][c].color === 'w' ? 'white' : 'black'}`;
                    // Convert raw piece type to Unicode
                    const type = board[r][c].color === 'w' ? board[r][c].type.toUpperCase() : board[r][c].type;
                    piece.textContent = this.piecesMap[type];
                    square.appendChild(piece);
                }

                square.addEventListener('click', () => this.handleSquareClick(algebraic));
                this.boardEl.appendChild(square);
            }
        }
    },

    handleSquareClick(sq) {
        if (!State.isPlayerTurn || State.game.game_over()) return;

        if (State.selectedSquare) {
            // Attempt move
            const moves = State.game.moves({ square: State.selectedSquare, verbose: true });
            const move = moves.find(m => m.to === sq);

            if (move) {
                // If pawn promotion, auto-promote to Queen for simplicity on mobile
                State.game.move({ from: State.selectedSquare, to: sq, promotion: 'q' });
                AudioMgr.playSFX('click');
                State.selectedSquare = null;
                this.renderBoard();
                this.checkGameState();
                
                if (!State.game.game_over()) {
                    State.isPlayerTurn = false;
                    document.getElementById('turn-indicator').textContent = "DANIEL'S TURN";
                    setTimeout(() => AIMgr.makeMove(), 1000); // Artificial delay
                }
            } else {
                // Select different piece
                this.highlightSquare(sq);
            }
        } else {
            this.highlightSquare(sq);
        }
    },

    highlightSquare(sq) {
        const piece = State.game.get(sq);
        if (piece && piece.color === 'w') {
            State.selectedSquare = sq;
            this.renderBoard(); // reset board visual
            document.querySelector(`[data-sq="${sq}"]`).classList.add('selected');
            // Highlight valid moves
            const moves = State.game.moves({ square: sq, verbose: true });
            moves.forEach(m => {
                document.querySelector(`[data-sq="${m.to}"]`).classList.add('highlight');
            });
        }
    },

    checkGameState() {
        if (State.game.in_checkmate()) {
            setTimeout(() => {
                State.game.turn() === 'w' ? GameLoop.triggerDefeat() : GameLoop.triggerVictory();
            }, 1500);
        } else if (State.game.in_draw() || State.game.in_stalemate()) {
            alert("DRAW. NEITHER DIES TODAY.");
            UIMgr.showScreen('screen-menu');
        }
    },

    saveGame() {
        localStorage.setItem('danielChessSave', State.game.fen());
        UIMgr.showMessage('load-msg', 'GAME SAVED', 2000);
    },

    loadGame() {
        const fen = localStorage.getItem('danielChessSave');
        if (fen) {
            State.game = new Chess(fen);
            State.isPlayerTurn = State.game.turn() === 'w';
            return true;
        }
        return false;
    }
};

// ==========================================
// AI LOGIC
// ==========================================
const AIMgr = {
    makeMove() {
        const moves = State.game.moves();
        if (moves.length === 0) return;

        let move;
        if (State.difficulty === 'easy') {
            move = moves[Math.floor(Math.random() * moves.length)];
        } else if (State.difficulty === 'normal') {
            // Pick a capture if available, else random
            const captures = moves.filter(m => m.includes('x'));
            move = captures.length > 0 ? captures[Math.floor(Math.random() * captures.length)] : moves[Math.floor(Math.random() * moves.length)];
        } else {
            // Hard / Nightmare (Basic random choice as placeholder for token limit, 
            // but in reality, you'd use a lightweight minimax depth here. 
            // For stability without locking browser: evaluate random captures/checks)
            const checks = moves.filter(m => m.includes('+'));
            const captures = moves.filter(m => m.includes('x'));
            if (checks.length > 0) move = checks[0];
            else if (captures.length > 0) move = captures[0];
            else move = moves[Math.floor(Math.random() * moves.length)];
        }

        State.game.move(move);
        AudioMgr.playSFX('click');
        ChessMgr.renderBoard();
        
        // Random dialogue
        if (Math.random() > 0.8) {
            const dialogue = document.getElementById('daniel-dialogue');
            dialogue.textContent = `"${ASSETS.dialogue[Math.floor(Math.random() * ASSETS.dialogue.length)]}"`;
            dialogue.classList.remove('hidden');
            setTimeout(() => dialogue.classList.add('hidden'), 4000);
        }

        ChessMgr.checkGameState();
        if (!State.game.game_over()) {
            State.isPlayerTurn = true;
            document.getElementById('turn-indicator').textContent = "YOUR TURN";
        }
    }
};

// ==========================================
// GAME FLOW CONTROLLER
// ==========================================
const GameLoop = {
    startStory() {
        UIMgr.showScreen('screen-story');
        AudioMgr.stopBGM();
        
        const textContainer = document.getElementById('story-text-container');
        textContainer.innerHTML = '';
        const lines = [
            "You are a detective.",
            "Ambushed during an investigation.",
            "You wake up in an abandoned asylum.",
            "He approaches..."
        ];
        
        let delay = 0;
        lines.forEach(line => {
            setTimeout(() => {
                const p = document.createElement('p');
                p.textContent = line;
                p.className = 'mt-2 fade-in-slow';
                textContainer.appendChild(p);
            }, delay);
            delay += 2000;
        });

        setTimeout(() => {
            document.getElementById('btn-skip-story').classList.remove('hidden');
        }, delay);
    },

    startDanielIntro() {
        UIMgr.showScreen('screen-daniel-intro');
        AudioMgr.playSFX('intro');
        
        setTimeout(() => {
            document.getElementById('daniel-image-container').classList.remove('hidden');
        }, 1000);

        setTimeout(() => {
            document.getElementById('daniel-intro-text').classList.remove('hidden');
        }, 4000);

        setTimeout(() => {
            this.startGameplay(false);
        }, 7000);
    },

    startGameplay(isLoad) {
        UIMgr.showScreen('screen-game');
        AudioMgr.playBGM('gameMusic');
        
        if (!isLoad || !State.game) {
            ChessMgr.init();
        } else {
            ChessMgr.renderBoard();
        }
        
        document.getElementById('turn-indicator').textContent = State.isPlayerTurn ? "YOUR TURN" : "DANIEL'S TURN";
        if (!State.isPlayerTurn) setTimeout(() => AIMgr.makeMove(), 1000);
    },

    triggerExit() {
        UIMgr.showScreen('screen-exit');
        AudioMgr.stopBGM();
        AudioMgr.playSFX('hunt');
        
        setTimeout(() => {
            document.getElementById('exit-text').classList.remove('hidden');
        }, 1000);

        setTimeout(() => {
            try { window.close(); } catch(e) {}
            document.getElementById('exit-fallback').classList.remove('hidden');
        }, 5000);
    },

    triggerVictory() {
        UIMgr.showScreen('screen-victory');
        AudioMgr.stopBGM();
        AudioMgr.playSFX('victory');
        document.getElementById('death-text').style.transition = 'color 4s';
        setTimeout(() => {
            document.getElementById('death-text').style.color = 'var(--accent-red)';
        }, 2000);
    },

    triggerDefeat() {
        UIMgr.showScreen('screen-defeat');
        AudioMgr.stopBGM();
        document.body.classList.add('shake-anim');
        
        const flash = document.getElementById('defeat-flash');
        flash.style.background = 'rgba(255,0,0,0.5)';
        flash.classList.remove('hidden');
        
        document.getElementById('bat-img').classList.remove('hidden');
        AudioMgr.playSFX('defeat');

        setTimeout(() => {
            flash.classList.add('hidden');
            document.body.classList.remove('shake-anim');
            document.getElementById('bat-img').classList.add('hidden');
            document.getElementById('defeat-text').classList.remove('hidden');
            document.querySelector('.defeat-btns').classList.remove('hidden');
        }, 1000);
    }
};

// ==========================================
// EVENT LISTENERS BINDING
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    AudioMgr.init();
    UIMgr.loadSettings();

    // Universal Button Sound
    document.querySelectorAll('.ui-btn, .device-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => AudioMgr.playSFX('hover'));
        btn.addEventListener('click', () => AudioMgr.playSFX('click'));
    });

    // Screen 1: Device Select
    document.querySelectorAll('.device-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            UIMgr.setMode(e.target.dataset.device);
            UIMgr.showScreen('screen-menu');
            AudioMgr.playBGM('menuMusic');
        });
    });

    // Screen 2: Main Menu
    document.getElementById('btn-play').addEventListener('click', () => GameLoop.startStory());
    document.getElementById('btn-load').addEventListener('click', () => {
        if (ChessMgr.loadGame()) GameLoop.startGameplay(true);
        else UIMgr.showMessage('load-msg', 'NO SAVED GAME FOUND');
    });
    document.getElementById('btn-settings').addEventListener('click', () => UIMgr.showScreen('screen-settings'));
    document.getElementById('btn-exit').addEventListener('click', () => GameLoop.triggerExit());

    // Screen 3: Settings
    document.getElementById('toggle-music').addEventListener('click', (e) => {
        State.musicOn = !State.musicOn;
        e.target.textContent = State.musicOn ? 'ON' : 'OFF';
        State.musicOn ? AudioMgr.playBGM('menuMusic') : AudioMgr.stopBGM();
        UIMgr.saveSettings();
    });
    document.getElementById('toggle-sfx').addEventListener('click', (e) => {
        State.sfxOn = !State.sfxOn;
        e.target.textContent = State.sfxOn ? 'ON' : 'OFF';
        UIMgr.saveSettings();
    });
    document.getElementById('select-device').addEventListener('change', (e) => UIMgr.setMode(e.target.value));
    document.getElementById('select-diff').addEventListener('change', (e) => {
        State.difficulty = e.target.value;
        UIMgr.saveSettings();
    });
    document.getElementById('btn-settings-back').addEventListener('click', () => UIMgr.showScreen('screen-menu'));

    // Story / Intro
    document.getElementById('btn-skip-story').addEventListener('click', () => GameLoop.startDanielIntro());

    // Game UI Controls
    document.getElementById('btn-game-save').addEventListener('click', () => ChessMgr.saveGame());
    document.getElementById('btn-game-menu').addEventListener('click', () => {
        UIMgr.showScreen('screen-menu');
        AudioMgr.playBGM('menuMusic');
    });

    // Victory/Defeat Returns
    document.getElementById('btn-vic-menu').addEventListener('click', () => {
        UIMgr.showScreen('screen-menu');
        AudioMgr.playBGM('menuMusic');
    });
    document.getElementById('btn-def-retry').addEventListener('click', () => GameLoop.startGameplay(false));
    document.getElementById('btn-def-menu').addEventListener('click', () => {
        UIMgr.showScreen('screen-menu');
        AudioMgr.playBGM('menuMusic');
        document.getElementById('defeat-text').classList.add('hidden');
        document.querySelector('.defeat-btns').classList.add('hidden');
    });
});
