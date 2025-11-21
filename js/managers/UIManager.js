import { PLAYER_BLACK, PLAYER_WHITE } from '../game_logic.js';

const TRANSLATIONS = {
    'en': {
        gameTitle: "Skill Gomoku",
        joinGame: "Join Game",
        waitingInput: "Waiting for input...",
        roomList: "Room List",
        enterRoomId: "Enter Room ID",
        teamOrder: "Order (Black)",
        teamChaos: "Chaos (White)",
        playerBlack: "Black",
        playerWhite: "White",
        skillSandName: "Sandstorm",
        skillSandDesc: "Destroy all pieces in a 3x3 area.<br>Cooldown: 5 turns",
        skillMistName: "Mist Veil",
        skillMistDesc: "Place a hidden piece, invisible to enemy for 6 turns.<br>Cooldown: 5 turns",
        skillSwapName: "Void Swap",
        skillSwapDesc: "Swap positions of any two pieces.<br>Cooldown: 7 turns",
        skillSkipName: "Mountain Force",
        skillSkipDesc: "Place a piece and skip opponent's turn.<br>Cooldown: 3 turns",
        
        // Dynamic
        roomNoRooms: "No rooms available",
        roomPrefix: "Room: ",
        roomFull: "Full",
        roomWaiting: "Waiting",
        roomPeople: " players",
        joinedRoom: "Joined room {id}. You are {role}. Waiting for opponent...",
        roleHost: "Black (Host)",
        roleGuest: "White",
        waitingOpponent: "Waiting for opponent...",
        gameStart: "Game Start!",
        turnBlack: "Black's Turn",
        turnWhite: "White's Turn",
        victoryBlack: "Victory - Black",
        victoryWhite: "Victory - White",
        playAgain: "Play Again",
        gameReset: "Game Reset",
        opponentLeft: "Opponent disconnected",
        errorSocket: "Error: Socket not connected.",
        connecting: "Connecting...",
        
        // Skills
        msgSkip: "Mountain Force! Opponent skipped!",
        msgSwap: "Void Swap!",
        msgSelectSecond: "Select second position",
        msgSelectFirst: "Select first position",
        
        draftTitle: "Skill Draft",
        
        // Rules
        rulesTitle: "Game Rules",
        rulesContent: `
            1. <strong>Objective</strong>: Connect 5 stones in a row (horizontal, vertical, or diagonal) to win.<br>
            2. <strong>Skills</strong>: Each player gets 2 random skills at the start.<br>
            3. <strong>Cooldowns</strong>: Skills have cooldowns. Use them wisely!<br>
            4. <strong>Turn</strong>: Black goes first.
        `,
        closeRules: "Got it!",
        
        // Tooltips
        tooltipLang: "Language",
        tooltipRules: "Rules",
        tooltipMusic: "Music",
        tooltipRestart: "Restart"
    },
    'zh': {
        gameTitle: "技能五子棋",
        joinGame: "进入游戏",
        waitingInput: "等待输入...",
        roomList: "房间列表",
        enterRoomId: "输入房间号",
        teamOrder: "秩序 (黑方)",
        teamChaos: "混沌 (白方)",
        playerBlack: "黑方",
        playerWhite: "白方",
        skillSandName: "飞沙走石",
        skillSandDesc: "摧毁 3x3 范围内的所有棋子。<br>冷却: 5 回合",
        skillMistName: "雾里看花",
        skillMistDesc: "落下一子，对敌方隐形 6 回合。<br>冷却: 5 回合",
        skillSwapName: "移形换位",
        skillSwapDesc: "交换任意两枚棋子的位置。<br>冷却: 7 回合",
        skillSkipName: "力拔山兮",
        skillSkipDesc: "落下一子，并使对手暂停一回合。<br>冷却: 3 回合",
        
        // Dynamic
        roomNoRooms: "暂无房间",
        roomPrefix: "房间: ",
        roomFull: "满员",
        roomWaiting: "等待中",
        roomPeople: " 人",
        joinedRoom: "已加入房间 {id}。你是 {role}。等待对手...",
        roleHost: "黑方 (房主)",
        roleGuest: "白方",
        waitingOpponent: "等待对手加入...",
        gameStart: "游戏开始！",
        turnBlack: "黑方回合",
        turnWhite: "白方回合",
        victoryBlack: "胜利 - 黑方",
        victoryWhite: "胜利 - 白方",
        playAgain: "再来一局",
        gameReset: "游戏已重置",
        opponentLeft: "对手已断开连接",
        errorSocket: "错误：Socket 未连接。",
        connecting: "正在连接...",
        
        // Skills
        msgSkip: "力拔山兮！对手暂停一回合！",
        msgSwap: "移形换位！",
        msgSelectSecond: "请选择第二个位置",
        msgSelectFirst: "请选择第一个位置",
        
        draftTitle: "技能抽取",
        
        // Rules
        rulesTitle: "游戏规则",
        rulesContent: `
            1. <strong>目标</strong>: 横、竖、斜任意方向连成五子即可获胜。<br>
            2. <strong>技能</strong>: 每位玩家开局随机获得 2 个技能。<br>
            3. <strong>冷却</strong>: 技能有冷却时间，请策略性使用！<br>
            4. <strong>回合</strong>: 黑方先行。
        `,
        closeRules: "明白了！",

        // Tooltips
        tooltipLang: "切换语言",
        tooltipRules: "游戏规则",
        tooltipMusic: "背景音乐",
        tooltipRestart: "重新开始"
    }
};

const SKILL_DETAILS = {
    'sand': { nameKey: 'skillSandName', descKey: 'skillSandDesc', icon: '🌪️' },
    'mist': { nameKey: 'skillMistName', descKey: 'skillMistDesc', icon: '👁️' },
    'skip': { nameKey: 'skillSkipName', descKey: 'skillSkipDesc', icon: '🏔️' },
    'swap': { nameKey: 'skillSwapName', descKey: 'skillSwapDesc', icon: '🌌' }
};

export class UIManager {
    constructor() {
        this.currentLang = 'en';
        
        // Elements
        this.uiPlayerName = document.getElementById('current-player');
        this.uiPlayerPortrait = document.getElementById('current-player-portrait');
        this.uiMessage = document.getElementById('message-area');
        this.btnSkillQ = document.getElementById('skill-q-btn');
        this.btnSkillW = document.getElementById('skill-w-btn');
        this.btnRestart = document.getElementById('restart-btn');
        this.btnMusic = document.getElementById('music-btn');
        this.btnRules = document.getElementById('rules-btn');
        
        this.chatContainer = document.getElementById('chat-container');
        this.chatMessages = document.getElementById('chat-messages');
        this.emotePanel = document.getElementById('emote-panel');
        this.toggleChatBtn = document.getElementById('toggle-chat-btn');
        
        this.lobbyOverlay = document.getElementById('lobby-overlay');
        this.roomIdInput = document.getElementById('room-id-input');
        this.joinRoomBtn = document.getElementById('join-room-btn');
        this.lobbyStatus = document.getElementById('lobby-status');
        this.roomListElement = document.getElementById('room-list');
        
        this.rulesModal = document.getElementById('rules-modal');
        this.closeRulesBtn = document.getElementById('close-rules-btn');
        
        this.langBtnLobby = document.getElementById('lang-btn-lobby');
        this.langBtnGame = document.getElementById('lang-btn-game');
    }

    init(callbacks) {
        // Callbacks: { onJoin, onRestart, onMusic, onEmote, onLangChange }
        
        if (this.langBtnLobby) this.langBtnLobby.addEventListener('click', () => this.toggleLang());
        if (this.langBtnGame) this.langBtnGame.addEventListener('click', () => this.toggleLang());
        
        if (this.btnRules) this.btnRules.addEventListener('click', () => this.showRules());
        if (this.closeRulesBtn) this.closeRulesBtn.addEventListener('click', () => this.hideRules());
        
        this.toggleChatBtn.addEventListener('click', () => {
            this.emotePanel.classList.toggle('visible');
        });
        
        document.querySelectorAll('.emote-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const emote = btn.getAttribute('data-emote');
                if (callbacks.onEmote) callbacks.onEmote(emote);
                this.emotePanel.classList.remove('visible');
            });
        });
        
        this.joinRoomBtn.addEventListener('click', () => {
            if (callbacks.onJoin) callbacks.onJoin(this.roomIdInput.value.trim());
        });
        
        this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && callbacks.onJoin) callbacks.onJoin(this.roomIdInput.value.trim());
        });
        
        this.btnRestart.addEventListener('click', () => {
            if (callbacks.onRestart) callbacks.onRestart();
        });
        
        this.btnMusic.addEventListener('click', () => {
            if (callbacks.onMusic) callbacks.onMusic();
        });

        // Initial Lang
        this.changeLanguage(this.currentLang);
        
        // Check Rules
        const hasSeenRules = localStorage.getItem('skillGomoku_hasSeenRules');
        if (!hasSeenRules) {
            this.showRules();
        }
    }

    t(key, params = {}) {
        let text = TRANSLATIONS[this.currentLang][key] || key;
        for (const [k, v] of Object.entries(params)) {
            text = text.replace(`{${k}}`, v);
        }
        return text;
    }

    toggleLang() {
        const newLang = this.currentLang === 'en' ? 'zh' : 'en';
        this.changeLanguage(newLang);
    }

    changeLanguage(lang) {
        this.currentLang = lang;
        
        document.body.classList.remove('lang-en', 'lang-zh');
        document.body.classList.add(`lang-${lang}`);

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.innerHTML = this.t(key);
        });
        
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });
    }

    update(game, myRole) {
        if (!game) return;
        const isBlackTurn = game.currentPlayer === PLAYER_BLACK;
        
        // Update Top Bar Status
        const gameStatus = document.getElementById('game-status');
        if (game.gameOver) {
            gameStatus.textContent = this.t('gameTitle');
            gameStatus.style.color = "#c8aa6e";
        } else {
            gameStatus.textContent = isBlackTurn ? this.t('turnBlack') : this.t('turnWhite');
            gameStatus.style.color = isBlackTurn ? "#0acbe6" : "#e84057";
        }

        // Update Bottom HUD
        if (myRole) {
            const isMeBlack = myRole === PLAYER_BLACK;
            this.uiPlayerName.textContent = isMeBlack ? this.t('teamOrder') : this.t('teamChaos');
            this.uiPlayerName.style.color = isMeBlack ? "#0acbe6" : "#e84057";
            
            const imgUrl = isMeBlack 
                ? "https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/Yasuo.png" 
                : "https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/Zed.png";
            this.uiPlayerPortrait.style.backgroundImage = `url('${imgUrl}')`;
        }

        // Skills
        if (myRole) {
            const mySkills = game.playerSkills[myRole] || [];
            this.updateSkillButton(this.btnSkillQ, mySkills[0], game, myRole, 'slot-q');
            this.updateSkillButton(this.btnSkillW, mySkills[1], game, myRole, 'slot-w');
        }
    }

    updateSkillButton(btn, skillType, game, myRole, tooltipId) {
        if (skillType) {
            const details = SKILL_DETAILS[skillType];
            btn.style.display = 'flex';
            btn.querySelector('.skill-icon').textContent = details.icon;
            
            // Tooltip
            const tooltip = document.getElementById(tooltipId);
            if (tooltip) {
                tooltip.querySelector('.tt-title').textContent = this.t(details.nameKey);
                tooltip.querySelector('.tt-desc').innerHTML = this.t(details.descKey);
            }

            const cooldown = game.getSkillCooldown(myRole, skillType);
            const overlay = btn.querySelector('.cooldown-overlay');
            if (cooldown > 0) {
                btn.disabled = true;
                overlay.textContent = cooldown;
            } else {
                btn.disabled = false;
                overlay.textContent = "";
            }
        } else {
            btn.style.display = 'none';
        }
    }

    updateRoomList(rooms) {
        if (!this.roomListElement) return;
        this.roomListElement.innerHTML = '';
        if (rooms.length === 0) {
            const li = document.createElement('li');
            li.textContent = this.t('roomNoRooms');
            li.style.textAlign = "center";
            li.style.color = "#888";
            li.style.cursor = "default";
            this.roomListElement.appendChild(li);
            return;
        }

        rooms.forEach(room => {
            const li = document.createElement('li');
            li.className = room.count >= 2 ? 'full' : '';
            
            const spanId = document.createElement('span');
            spanId.textContent = this.t('roomPrefix') + room.id;
            
            const spanStatus = document.createElement('span');
            spanStatus.className = 'status';
            spanStatus.textContent = `${room.count}/2` + this.t('roomPeople');
            
            li.appendChild(spanId);
            li.appendChild(spanStatus);
            
            if (room.count < 2) {
                li.addEventListener('click', () => {
                    this.roomIdInput.value = room.id;
                });
            }
            
            this.roomListElement.appendChild(li);
        });
    }

    showLobby() {
        this.lobbyOverlay.style.display = 'flex';
    }

    hideLobby() {
        this.lobbyOverlay.style.display = 'none';
    }

    updateLobbyStatus(text, isError = false) {
        this.lobbyStatus.textContent = text;
        this.lobbyStatus.style.color = isError ? "#ff4444" : "#888";
    }

    showRules() {
        if (this.rulesModal) this.rulesModal.style.display = 'flex';
    }

    hideRules() {
        if (this.rulesModal) this.rulesModal.style.display = 'none';
        localStorage.setItem('skillGomoku_hasSeenRules', 'true');
    }

    addChatMessage(msg, isSelf) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isSelf ? 'self' : 'opponent'}`;
        bubble.textContent = msg;
        this.chatMessages.appendChild(bubble);
        
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        setTimeout(() => {
            bubble.style.opacity = '0';
            setTimeout(() => bubble.remove(), 500);
        }, 5000);
    }

    showMessage(msg, duration = 0) {
        this.uiMessage.textContent = msg;
        if (duration > 0) {
            setTimeout(() => {
                if (this.uiMessage.textContent === msg) {
                    this.uiMessage.textContent = "";
                }
            }, duration);
        }
    }
    
    showVictory(winner, onRestart) {
        const winnerName = winner === PLAYER_BLACK ? this.t('victoryBlack') : this.t('victoryWhite');
        this.uiMessage.innerHTML = `
            <div>${winnerName}</div>
            <button id="victory-restart-btn" class="victory-button">${this.t('playAgain')}</button>
        `;
        this.uiMessage.style.color = "#c8aa6e";
        
        const btn = document.getElementById('victory-restart-btn');
        if (btn) btn.addEventListener('click', onRestart);
    }

    showSkillDraftAnimation(skills) {
        const overlay = document.getElementById('skill-draft-overlay');
        // Create overlay if not exists (it was in init() in main.js, let's assume it exists or create it)
        if (!overlay) {
            const div = document.createElement('div');
            div.id = 'skill-draft-overlay';
            div.innerHTML = `
                <div class="draft-title" data-i18n="draftTitle">Skill Draft</div>
                <div class="draft-cards">
                    <div class="draft-card" id="draft-card-1">
                        <div class="draft-card-icon"></div>
                        <div class="draft-card-name"></div>
                    </div>
                    <div class="draft-card" id="draft-card-2">
                        <div class="draft-card-icon"></div>
                        <div class="draft-card-name"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(div);
        }
        
        const card1 = document.getElementById('draft-card-1');
        const card2 = document.getElementById('draft-card-2');
        const draftOverlay = document.getElementById('skill-draft-overlay');
        
        if (!skills || skills.length < 2) return;

        const s1 = SKILL_DETAILS[skills[0]];
        const s2 = SKILL_DETAILS[skills[1]];

        card1.querySelector('.draft-card-icon').textContent = s1.icon;
        card1.querySelector('.draft-card-name').textContent = this.t(s1.nameKey);
        
        card2.querySelector('.draft-card-icon').textContent = s2.icon;
        card2.querySelector('.draft-card-name').textContent = this.t(s2.nameKey);

        draftOverlay.classList.add('visible');
        setTimeout(() => {
            draftOverlay.classList.remove('visible');
        }, 3000);
    }

    setSkillActive(slotIndex, isActive) {
        this.btnSkillQ.classList.remove('active');
        this.btnSkillW.classList.remove('active');
        
        if (isActive) {
            if (slotIndex === 0) this.btnSkillQ.classList.add('active');
            if (slotIndex === 1) this.btnSkillW.classList.add('active');
            document.body.style.cursor = "crosshair";
        } else {
            document.body.style.cursor = "default";
        }
    }
    
    setMusicActive(isActive) {
        if (isActive) {
            this.btnMusic.querySelector('.item-icon').textContent = "🎵";
            this.btnMusic.classList.add('active');
        } else {
            this.btnMusic.querySelector('.item-icon').textContent = "🔇";
            this.btnMusic.classList.remove('active');
        }
    }
}
