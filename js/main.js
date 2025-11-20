import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GameLogic, BOARD_SIZE, PLAYER_BLACK, PLAYER_WHITE, EMPTY } from './game_logic.js';

// --- Constants ---
const CELL_SIZE = 2;
const BOARD_WIDTH = BOARD_SIZE * CELL_SIZE;
const PIECE_RADIUS = CELL_SIZE * 0.4;
const PIECE_HEIGHT = 0.5;

// --- Global Variables ---
let scene, camera, renderer, controls;
let raycaster, mouse, mouseDownPosition;
let boardMesh;
let pieceMeshes = []; // Array to store piece meshes for removal
let previewMesh; // Ghost piece
let game;
let currentSkillMode = null; // 'sand' or 'mist' or 'skip' or 'swap'
let swapSource = null; // {x, y} for first click of swap skill

// Multiplayer Variables
let socket;
let myRole = null; // PLAYER_BLACK or PLAYER_WHITE
let roomId = null;

// UI Elements
const uiPlayerName = document.getElementById('current-player');
const uiPlayerPortrait = document.getElementById('current-player-portrait');
const uiMessage = document.getElementById('message-area');
const btnSkillQ = document.getElementById('skill-q-btn');
const btnSkillW = document.getElementById('skill-w-btn');
const btnRestart = document.getElementById('restart-btn');
const btnMusic = document.getElementById('music-btn');
const bgm = document.getElementById('bgm');

// Chat Elements
const chatContainer = document.getElementById('chat-container');
const chatMessages = document.getElementById('chat-messages');
const emotePanel = document.getElementById('emote-panel');
const toggleChatBtn = document.getElementById('toggle-chat-btn');
const emoteBtns = document.querySelectorAll('.emote-btn');

// Lobby Elements
const lobbyOverlay = document.getElementById('lobby-overlay');
const roomIdInput = document.getElementById('room-id-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const lobbyStatus = document.getElementById('lobby-status');
const roomListElement = document.getElementById('room-list');

// Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- I18N ---
let currentLang = 'en';
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
        
        draftTitle: "Skill Draft"
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
        
        draftTitle: "技能抽取"
    }
};

function t(key, params = {}) {
    let text = TRANSLATIONS[currentLang][key] || key;
    for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
    }
    return text;
}

function changeLanguage(lang) {
    currentLang = lang;
    
    // Update static elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerHTML = t(key); // Use innerHTML to support <br>
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    // Update dynamic UI if game is running
    updateUI();
    
    // Update lobby status if visible
    if (lobbyOverlay.style.display !== 'none') {
        // We can't easily refresh the list without re-fetching, but new updates will be translated.
        if (lobbyStatus.textContent) {
             // Try to refresh status text if it matches a known pattern? 
             // It's hard to reverse-engineer the params. 
             // For now, just leave it, it will update on next event.
        }
    }
}

// --- Skill Details ---
const SKILL_DETAILS = {
    'sand': { nameKey: 'skillSandName', descKey: 'skillSandDesc', icon: '🌪️' },
    'mist': { nameKey: 'skillMistName', descKey: 'skillMistDesc', icon: '👁️' },
    'skip': { nameKey: 'skillSkipName', descKey: 'skillSkipDesc', icon: '🏔️' },
    'swap': { nameKey: 'skillSwapName', descKey: 'skillSwapDesc', icon: '🌌' }
};

// --- Initialization ---
function init() {
    console.log("Initializing Game Client...");

    // Create Skill Draft Overlay
    const draftOverlay = document.createElement('div');
    draftOverlay.id = 'skill-draft-overlay';
    draftOverlay.innerHTML = `
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
    document.body.appendChild(draftOverlay);

    // Language Switcher
    const langBtnLobby = document.getElementById('lang-btn-lobby');
    const langBtnGame = document.getElementById('lang-btn-game');
    
    const toggleLang = () => {
        const newLang = currentLang === 'en' ? 'zh' : 'en';
        changeLanguage(newLang);
    };

    if (langBtnLobby) langBtnLobby.addEventListener('click', toggleLang);
    if (langBtnGame) langBtnGame.addEventListener('click', toggleLang);

    // 0. Socket Setup
    if (typeof io !== 'undefined') {
        socket = io();
    } else {
        console.error("Socket.io is not defined. Make sure you are running the server on port 3000.");
        lobbyStatus.textContent = "Error: Socket.io not loaded.";
        lobbyStatus.style.color = "#ff4444";
    }

    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);
    scene.fog = new THREE.Fog(0x333333, 20, 100);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Adjust camera for mobile
    if (window.innerWidth < 768) {
        camera.position.set(0, 55, 40); // Higher and further back for mobile
    } else {
        camera.position.set(0, 40, 30);
    }
    camera.lookAt(0, 0, 0);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // 4. Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // 6. Game Logic (Client side mirror)
    game = new GameLogic();

    // 7. Create Objects
    createBoard();
    createPreviewPiece();

    // 8. Event Listeners
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    mouseDownPosition = new THREE.Vector2();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('click', onMouseClick);
    window.addEventListener('keydown', onKeyDown);
    
    // Mobile Touch Support
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    
    btnSkillQ.addEventListener('click', () => toggleSkillMode(0));
    btnSkillW.addEventListener('click', () => toggleSkillMode(1));
    btnRestart.addEventListener('click', requestRestart);
    btnMusic.addEventListener('click', toggleMusic);

    // Chat Listeners
    toggleChatBtn.addEventListener('click', () => {
        emotePanel.classList.toggle('visible');
    });

    emoteBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const emote = btn.getAttribute('data-emote');
            sendEmote(emote);
            emotePanel.classList.remove('visible');
        });
    });

    // Lobby Listeners
    joinRoomBtn.addEventListener('click', joinRoom);
    roomIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinRoom();
    });

    // Socket Listeners
    if (socket) {
        setupSocketListeners();
    }

    // 9. Start Loop
    animate();
    updateUI();
}

function showSkillDraftAnimation(skills) {
    const overlay = document.getElementById('skill-draft-overlay');
    const card1 = document.getElementById('draft-card-1');
    const card2 = document.getElementById('draft-card-2');
    
    if (!skills || skills.length < 2) return;

    const s1 = SKILL_DETAILS[skills[0]];
    const s2 = SKILL_DETAILS[skills[1]];

    card1.querySelector('.draft-card-icon').textContent = s1.icon;
    card1.querySelector('.draft-card-name').textContent = t(s1.nameKey);
    
    card2.querySelector('.draft-card-icon').textContent = s2.icon;
    card2.querySelector('.draft-card-name').textContent = t(s2.nameKey);

    // Show
    overlay.classList.add('visible');

    // Play sound effect?
    if (audioCtx.state !== 'suspended') {
        // Simple "whoosh" sound
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.5);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.0);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 1.0);
    }

    // Hide after delay
    setTimeout(() => {
        overlay.classList.remove('visible');
    }, 3000);
}

function setupSocketListeners() {
    socket.on('room_list', (rooms) => {
        if (!roomListElement) return;
        roomListElement.innerHTML = '';
        if (rooms.length === 0) {
            const li = document.createElement('li');
            li.textContent = t('roomNoRooms');
            li.style.textAlign = "center";
            li.style.color = "#888";
            li.style.cursor = "default";
            roomListElement.appendChild(li);
            return;
        }

        rooms.forEach(room => {
            const li = document.createElement('li');
            li.className = room.count >= 2 ? 'full' : '';
            
            const spanId = document.createElement('span');
            spanId.textContent = t('roomPrefix') + room.id;
            
            const spanStatus = document.createElement('span');
            spanStatus.className = 'status';
            spanStatus.textContent = `${room.count}/2` + t('roomPeople');
            
            li.appendChild(spanId);
            li.appendChild(spanStatus);
            
            if (room.count < 2) {
                li.addEventListener('click', () => {
                    roomIdInput.value = room.id;
                });
            }
            
            roomListElement.appendChild(li);
        });
    });

    socket.on('room_joined', (data) => {
        roomId = data.roomId;
        myRole = data.role;
        lobbyStatus.textContent = t('joinedRoom', {
            id: roomId, 
            role: myRole === PLAYER_BLACK ? t('roleHost') : t('roleGuest')
        });
        
        // If I am black, I can see the board but game hasn't started really until 2 players
        if (myRole === PLAYER_BLACK) {
            lobbyOverlay.style.display = 'none';
            uiMessage.textContent = t('waitingOpponent');
        }
    });

    socket.on('player_update', (data) => {
        if (data.count === 2) {
            lobbyOverlay.style.display = 'none';
            uiMessage.textContent = t('gameStart');
            setTimeout(() => uiMessage.textContent = "", 2000);
        }
    });

    socket.on('game_start', (data) => {
        game.board = data.board;
        game.currentPlayer = data.currentPlayer;
        game.hiddenPieces = data.hiddenPieces || [];
        game.playerSkills = data.playerSkills || {};
        
        updateUI();
        updatePieceVisibility();

        // Show draft animation for my skills
        if (myRole && game.playerSkills[myRole]) {
            showSkillDraftAnimation(game.playerSkills[myRole]);
        }
    });

    socket.on('game_update', (data) => {
        // Sync state
        game.board = data.board;
        game.currentPlayer = data.currentPlayer;
        game.hiddenPieces = data.hiddenPieces || [];
        
        if (data.type === 'move') {
            createPiece(data.x, data.y, data.player);
            playMoveSound();
        } else if (data.type === 'skill') {
            if (data.skillType === 'sand') {
                playSkillSound('sand');
                // Remove pieces
                if (data.removedPieces) {
                    data.removedPieces.forEach(p => {
                        const meshIndex = pieceMeshes.findIndex(m => m.userData.gridX === p.x && m.userData.gridY === p.y);
                        if (meshIndex !== -1) {
                            const mesh = pieceMeshes[meshIndex];
                            createExplosion(mesh.position);
                            scene.remove(mesh);
                            pieceMeshes.splice(meshIndex, 1);
                        }
                    });
                }
                const worldPos = gridToWorld(data.x, data.y);
                createExplosion(new THREE.Vector3(worldPos.x, 0, worldPos.z), 0xffaa00, 20);
            } else if (data.skillType === 'mist') {
                playSkillSound('mist');
                createPiece(data.x, data.y, data.player);
                const worldPos = gridToWorld(data.x, data.y);
                createExplosion(new THREE.Vector3(worldPos.x, 0, worldPos.z), 0x9c27b0, 15);
            } else if (data.skillType === 'skip') {
                playSkillSound('skip');
                createPiece(data.x, data.y, data.player);
                const worldPos = gridToWorld(data.x, data.y);
                createExplosion(new THREE.Vector3(worldPos.x, 0, worldPos.z), 0x4caf50, 25); 
                uiMessage.textContent = t('msgSkip');
                setTimeout(() => uiMessage.textContent = "", 3000);
            } else if (data.skillType === 'swap') {
                playSkillSound('swap');
                // Clear all meshes
                pieceMeshes.forEach(mesh => scene.remove(mesh));
                pieceMeshes = [];
                
                // Re-create all pieces from board state
                for(let y=0; y<BOARD_SIZE; y++) {
                    for(let x=0; x<BOARD_SIZE; x++) {
                        if (data.board[y][x] !== EMPTY) {
                            createPiece(x, y, data.board[y][x]);
                        }
                    }
                }
                
                // Visual effects at both locations
                const p1 = gridToWorld(data.x1, data.y1);
                const p2 = gridToWorld(data.x2, data.y2);
                createExplosion(new THREE.Vector3(p1.x, 0, p1.z), 0x00ffff, 15);
                createExplosion(new THREE.Vector3(p2.x, 0, p2.z), 0x00ffff, 15);
                
                uiMessage.textContent = t('msgSwap');
                setTimeout(() => uiMessage.textContent = "", 2000);
            }
        }

        // HACK: Manually tick cooldowns locally to update UI
        const prevPlayer = data.currentPlayer === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
        if (game.skillCooldowns[prevPlayer].sand > 0) game.skillCooldowns[prevPlayer].sand--;
        if (game.skillCooldowns[prevPlayer].mist > 0) game.skillCooldowns[prevPlayer].mist--;
        if (game.skillCooldowns[prevPlayer].skip > 0) game.skillCooldowns[prevPlayer].skip--;
        if (game.skillCooldowns[prevPlayer].swap > 0) game.skillCooldowns[prevPlayer].swap--;
        
        // If it was a skill use, set cooldown
        if (data.type === 'skill') {
            if (data.skillType === 'sand') game.skillCooldowns[data.player].sand = game.SKILL_SAND_COOLDOWN;
            if (data.skillType === 'mist') game.skillCooldowns[data.player].mist = game.SKILL_MIST_COOLDOWN;
            if (data.skillType === 'skip') game.skillCooldowns[data.player].skip = game.SKILL_SKIP_COOLDOWN;
            if (data.skillType === 'swap') game.skillCooldowns[data.player].swap = game.SKILL_SWAP_COOLDOWN;
        }

        updateUI();
        updatePieceVisibility();
    });

    socket.on('game_over', (data) => {
        game.gameOver = true;
        game.winner = data.winner;
        checkGameState();
        updatePieceVisibility(); // Reveal all
    });

    socket.on('game_restart', (data) => {
        game.initBoard();
        game.gameOver = false;
        game.winner = null;
        game.hiddenPieces = data.hiddenPieces || [];
        game.playerSkills = data.playerSkills || {};
        
        // Clear meshes
        pieceMeshes.forEach(mesh => scene.remove(mesh));
        pieceMeshes = [];
        
        uiMessage.textContent = t('gameReset');
        setTimeout(() => uiMessage.textContent = "", 2000);
        
        updateUI();

        // Show draft animation for my skills
        if (myRole && game.playerSkills[myRole]) {
            showSkillDraftAnimation(game.playerSkills[myRole]);
        }
    });

    socket.on('error_message', (msg) => {
        lobbyStatus.textContent = "Error: " + msg;
        lobbyStatus.style.color = "#ff4444";
    });
    
    socket.on('player_left', () => {
        uiMessage.textContent = t('opponentLeft');
        game.gameOver = true; // Pause game effectively
    });

    socket.on('chat_message', (data) => {
        addChatMessage(data.message, data.sender === socket.id);
    });
}

function sendEmote(emote) {
    if (roomId && socket) {
        socket.emit('send_chat', { roomId, message: emote });
        // Optimistic update? No, wait for server echo to ensure order/delivery
    }
}

function addChatMessage(msg, isSelf) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isSelf ? 'self' : 'opponent'}`;
    bubble.textContent = msg;
    chatMessages.appendChild(bubble);
    
    // Auto scroll
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Auto remove after 5 seconds
    setTimeout(() => {
        bubble.style.opacity = '0';
        setTimeout(() => bubble.remove(), 500);
    }, 5000);
}

function joinRoom() {
    const id = roomIdInput.value.trim();
    if (id) {
        lobbyStatus.textContent = t('connecting');
        if (socket) {
            socket.emit('join_room', id);
            // Try to start music on user interaction
            bgm.volume = 0.02;
            bgm.play().catch(e => console.log("Auto-play blocked:", e));
        } else {
            lobbyStatus.textContent = t('errorSocket');
        }
    }
}

// --- Object Creation ---
function createBoard() {
    const geometry = new THREE.BoxGeometry(BOARD_WIDTH + 2, 1, BOARD_WIDTH + 2);
    const material = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.6 });
    boardMesh = new THREE.Mesh(geometry, material);
    boardMesh.position.y = -0.5;
    boardMesh.receiveShadow = true;
    scene.add(boardMesh);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.5, transparent: true });
    const points = [];
    const halfSize = BOARD_WIDTH / 2;
    const start = -halfSize + CELL_SIZE / 2;

    for (let i = 0; i < BOARD_SIZE; i++) {
        const pos = start + i * CELL_SIZE;
        points.push(new THREE.Vector3(pos, 0.01, -halfSize));
        points.push(new THREE.Vector3(pos, 0.01, halfSize));
        points.push(new THREE.Vector3(-halfSize, 0.01, pos));
        points.push(new THREE.Vector3(halfSize, 0.01, pos));
    }
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);
}

function createPreviewPiece() {
    const geometry = new THREE.CylinderGeometry(PIECE_RADIUS, PIECE_RADIUS, PIECE_HEIGHT, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    previewMesh = new THREE.Mesh(geometry, material);
    previewMesh.visible = false;
    scene.add(previewMesh);
}

function createPiece(x, y, player) {
    const color = player === PLAYER_BLACK ? 0x111111 : 0xffffff;
    const geometry = new THREE.CylinderGeometry(PIECE_RADIUS, PIECE_RADIUS, PIECE_HEIGHT, 32);
    const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.2 });
    const piece = new THREE.Mesh(geometry, material);
    
    const worldPos = gridToWorld(x, y);
    piece.position.set(worldPos.x, PIECE_HEIGHT / 2, worldPos.z);
    piece.castShadow = true;
    piece.receiveShadow = true;
    piece.userData = { gridX: x, gridY: y };
    
    scene.add(piece);
    pieceMeshes.push(piece);
}

// --- Helpers ---
function gridToWorld(x, y) {
    const halfSize = BOARD_WIDTH / 2;
    const start = -halfSize + CELL_SIZE / 2;
    return {
        x: start + x * CELL_SIZE,
        z: start + y * CELL_SIZE
    };
}

function worldToGrid(x, z) {
    const halfSize = BOARD_WIDTH / 2;
    const start = -halfSize;
    const localX = x - start;
    const localZ = z - start;
    const gridX = Math.floor(localX / CELL_SIZE);
    const gridY = Math.floor(localZ / CELL_SIZE);
    return { x: gridX, y: gridY };
}

// --- Interaction ---
function onMouseMove(event) {
    // Only show preview if it's my turn
    if (game.currentPlayer !== myRole) {
        previewMesh.visible = false;
        return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(boardMesh);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        const gridPos = worldToGrid(point.x, point.z);

        if (gridPos.x >= 0 && gridPos.x < BOARD_SIZE && gridPos.y >= 0 && gridPos.y < BOARD_SIZE) {
            const worldPos = gridToWorld(gridPos.x, gridPos.y);
            previewMesh.position.set(worldPos.x, PIECE_HEIGHT / 2, worldPos.z);
            
            if (currentSkillMode) {
                if (currentSkillMode === 'sand') {
                    previewMesh.material.color.setHex(0xff0000);
                    previewMesh.material.opacity = 0.3;
                } else if (currentSkillMode === 'mist') {
                    previewMesh.material.color.setHex(0x9c27b0);
                    previewMesh.material.opacity = 0.5;
                } else if (currentSkillMode === 'skip') {
                    previewMesh.material.color.setHex(0x4caf50);
                    previewMesh.material.opacity = 0.5;
                } else if (currentSkillMode === 'swap') {
                    previewMesh.material.color.setHex(0x00ffff);
                    previewMesh.material.opacity = 0.5;
                }
                previewMesh.scale.set(1, 1, 1);
                previewMesh.visible = true;
            } else {
                if (game.board[gridPos.y][gridPos.x] === EMPTY) {
                    previewMesh.visible = true;
                    previewMesh.scale.set(1, 1, 1);
                    const color = myRole === PLAYER_BLACK ? 0x000000 : 0xffffff;
                    previewMesh.material.color.setHex(color);
                    previewMesh.material.opacity = 0.5;
                } else {
                    previewMesh.visible = false;
                }
            }
        } else {
            previewMesh.visible = false;
        }
    } else {
        previewMesh.visible = false;
    }
}

function onMouseDown(event) {
    mouseDownPosition.set(event.clientX, event.clientY);
}

function onTouchStart(event) {
    if (event.touches.length === 1) {
        mouseDownPosition.set(event.touches[0].clientX, event.touches[0].clientY);
        
        // Update mouse position for raycaster immediately to show preview if needed
        mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
        
        // Trigger a "move" update to show preview
        // We can reuse onMouseMove logic but we need to mock the event or extract the logic
        // Let's just extract the logic or call it with a mocked object
        // But onMouseMove expects a MouseEvent.
        // Let's refactor onMouseMove slightly or just manually update raycaster here.
        
        // Actually, on mobile, we might not want the preview to jump around during drag.
        // Let's leave it for now. The click event will handle the action.
    }
}

function onMouseClick(event) {
    if (event.target.closest('#ui-container') || event.target.closest('#lobby-overlay')) return;
    
    // Prevent click if dragged (camera rotation)
    // For touch, we might need a larger threshold
    const clientX = event.clientX || (event.changedTouches && event.changedTouches[0] ? event.changedTouches[0].clientX : 0);
    const clientY = event.clientY || (event.changedTouches && event.changedTouches[0] ? event.changedTouches[0].clientY : 0);
    
    const currentPos = new THREE.Vector2(clientX, clientY);
    const threshold = (event.type === 'touchend') ? 20 : 5; // Larger threshold for touch
    
    if (mouseDownPosition.distanceTo(currentPos) > threshold) return;

    if (game.gameOver) return;
    if (game.currentPlayer !== myRole) return; // Not my turn

    // Update mouse for raycaster
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(boardMesh);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        const gridPos = worldToGrid(point.x, point.z);

        if (gridPos.x >= 0 && gridPos.x < BOARD_SIZE && gridPos.y >= 0 && gridPos.y < BOARD_SIZE) {
            if (currentSkillMode) {
                // Execute skill
                if (currentSkillMode === 'swap') {
                    if (!swapSource) {
                        // First click: Select source
                        swapSource = { x: gridPos.x, y: gridPos.y };
                        uiMessage.textContent = t('msgSelectSecond');
                    } else {
                        // Second click: Select target and execute
                        socket.emit('use_skill', { 
                            roomId, 
                            skillType: 'swap', 
                            x1: swapSource.x, y1: swapSource.y, 
                            x2: gridPos.x, y2: gridPos.y 
                        });
                        resetSkillMode();
                        uiMessage.textContent = "";
                    }
                } else {
                    // Single target skills (sand, mist, skip)
                    socket.emit('use_skill', { roomId, skillType: currentSkillMode, x: gridPos.x, y: gridPos.y });
                    resetSkillMode();
                }
            } else {
                // Normal move
                if (game.board[gridPos.y][gridPos.x] === EMPTY) {
                    socket.emit('make_move', { roomId, x: gridPos.x, y: gridPos.y });
                }
            }
        }
    }
}

function resetSkillMode() {
    currentSkillMode = null;
    swapSource = null;
    btnSkillQ.classList.remove('active');
    btnSkillW.classList.remove('active');
    document.body.style.cursor = "default";
}

function onKeyDown(event) {
    if (game.currentPlayer !== myRole) return;
    if (event.key === 'q' || event.key === 'Q') {
        toggleSkillMode(0);
    } else if (event.key === 'w' || event.key === 'W') {
        toggleSkillMode(1);
    }
}

function toggleSkillMode(slotIndex) {
    if (game.gameOver) return;
    if (game.currentPlayer !== myRole) return;
    
    const mySkills = game.playerSkills[myRole] || [];
    if (!mySkills[slotIndex]) return;

    const skillType = mySkills[slotIndex];

    if (currentSkillMode === skillType) {
        resetSkillMode();
        return;
    }

    if (!game.isSkillReady(myRole, skillType)) return;

    currentSkillMode = skillType;
    
    btnSkillQ.classList.remove('active');
    btnSkillW.classList.remove('active');

    if (slotIndex === 0) btnSkillQ.classList.add('active');
    if (slotIndex === 1) btnSkillW.classList.add('active');

    if (skillType === 'swap') {
        swapSource = null; // Reset selection
        uiMessage.textContent = t('msgSelectFirst');
    }
    
    document.body.style.cursor = "crosshair";
}

function requestRestart() {
    if (roomId) {
        socket.emit('restart_game', roomId);
    }
}

function toggleMusic() {
    if (bgm.paused) {
        bgm.play().then(() => {
            btnMusic.querySelector('.item-icon').textContent = "🎵";
            btnMusic.classList.add('active');
        }).catch(e => console.log("Audio play failed:", e));
    } else {
        bgm.pause();
        btnMusic.querySelector('.item-icon').textContent = "🔇";
        btnMusic.classList.remove('active');
    }
}

function playMoveSound() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const t = audioCtx.currentTime;

    // High click (Stone hitting board)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.frequency.setValueAtTime(1200, t);
    osc1.frequency.exponentialRampToValueAtTime(100, t + 0.05);
    gain1.gain.setValueAtTime(0.1, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(t);
    osc1.stop(t + 0.05);

    // Low thud (Resonance)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.frequency.setValueAtTime(300, t);
    osc2.frequency.exponentialRampToValueAtTime(50, t + 0.15);
    gain2.gain.setValueAtTime(0.1, t);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(t);
    osc2.stop(t + 0.15);
}

function playSkillSound(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const t = audioCtx.currentTime;

    if (type === 'sand') {
        // Crumbling/Wind sound (Noise buffer)
        const bufferSize = audioCtx.sampleRate * 0.5; // 0.5 seconds
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = audioCtx.createGain();
        
        // Filter to make it sound more like sand/wind
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 1;

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start(t);
    } else if (type === 'mist') {
        // Mysterious chime (Sine waves with reverb-like decay)
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t); // A5
        osc.frequency.exponentialRampToValueAtTime(440, t + 1.0); // Drop to A4

        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 1.5);
    } else if (type === 'skip') {
        // Heavy impact / Power down
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 0.5);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
    } else if (type === 'swap') {
        // Warp sound
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.linearRampToValueAtTime(800, t + 0.2);
        osc.frequency.linearRampToValueAtTime(200, t + 0.4);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
    }
}

function updatePieceVisibility() {
    if (game.gameOver) {
        pieceMeshes.forEach(mesh => {
            mesh.visible = true;
            mesh.material.transparent = false;
            mesh.material.opacity = 1.0;
            mesh.material.emissive.setHex(0x000000);
        });
        return;
    }

    pieceMeshes.forEach(mesh => {
        const x = mesh.userData.gridX;
        const y = mesh.userData.gridY;
        
        // Find if this piece is in the hidden list
        const hiddenPiece = game.hiddenPieces.find(p => p.x === x && p.y === y);
        
        if (hiddenPiece) {
            // It is a hidden piece
            if (hiddenPiece.player === myRole) {
                // My hidden piece: Visible but distinct (ghostly)
                mesh.visible = true;
                mesh.material.transparent = true;
                mesh.material.opacity = 0.6; 
                mesh.material.emissive.setHex(0x222222);
            } else {
                // Opponent's hidden piece: Invisible
                mesh.visible = false;
            }
        } else {
            // Normal piece
            mesh.visible = true;
            mesh.material.transparent = false;
            mesh.material.opacity = 1.0;
            mesh.material.emissive.setHex(0x000000);
        }
    });
}

function createExplosion(position, color = 0x888888, count = 10) {
    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const material = new THREE.MeshBasicMaterial({ color: color });
    
    for (let i = 0; i < count; i++) {
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            Math.random() * 0.5,
            (Math.random() - 0.5) * 0.5
        );
        scene.add(particle);
        const animateParticle = () => {
            particle.position.add(particle.userData.velocity);
            particle.userData.velocity.y -= 0.02;
            particle.rotation.x += 0.1;
            particle.rotation.y += 0.1;
            if (particle.position.y < -5) {
                scene.remove(particle);
            } else {
                requestAnimationFrame(animateParticle);
            }
        };
        animateParticle();
    }
}

function checkGameState() {
    if (game.gameOver) {
        const winnerName = game.winner === PLAYER_BLACK ? t('victoryBlack') : t('victoryWhite');
        uiMessage.innerHTML = `
            <div>${winnerName}</div>
            <button id="victory-restart-btn" class="victory-button">${t('playAgain')}</button>
        `;
        document.getElementById('victory-restart-btn').addEventListener('click', requestRestart);
        uiMessage.style.color = "#c8aa6e";
        btnSkillQ.disabled = true;
        btnSkillW.disabled = true;
    } else {
        uiMessage.textContent = "";
    }
}

function updateUI() {
    const isBlackTurn = game.currentPlayer === PLAYER_BLACK;
    
    // Update Top Bar Status (Current Turn)
    const gameStatus = document.getElementById('game-status');
    if (game.gameOver) {
        gameStatus.textContent = t('gameTitle'); // Or Game Over?
        gameStatus.style.color = "#c8aa6e";
    } else {
        gameStatus.textContent = isBlackTurn ? t('turnBlack') : t('turnWhite');
        gameStatus.style.color = isBlackTurn ? "#0acbe6" : "#e84057";
    }

    // Update Bottom HUD (My Profile)
    if (myRole) {
        const isMeBlack = myRole === PLAYER_BLACK;
        uiPlayerName.textContent = isMeBlack ? t('teamOrder') : t('teamChaos');
        uiPlayerName.style.color = isMeBlack ? "#0acbe6" : "#e84057";
        
        const imgUrl = isMeBlack 
            ? "https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/Yasuo.png" 
            : "https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/Zed.png";
        uiPlayerPortrait.style.backgroundImage = `url('${imgUrl}')`;
    }

    // Only show cooldowns for MY player
    if (myRole) {
        const mySkills = game.playerSkills[myRole] || [];

        // Slot Q (Index 0)
        if (mySkills[0]) {
            const skillType = mySkills[0];
            const details = SKILL_DETAILS[skillType];
            
            btnSkillQ.style.display = 'flex';
            btnSkillQ.querySelector('.skill-icon').textContent = details.icon;
            
            // Tooltip
            const slotQ = document.getElementById('slot-q');
            slotQ.querySelector('.tt-title').textContent = t(details.nameKey);
            slotQ.querySelector('.tt-desc').innerHTML = t(details.descKey);

            const cooldown = game.getSkillCooldown(myRole, skillType);
            const overlay = btnSkillQ.querySelector('.cooldown-overlay');
            if (cooldown > 0) {
                btnSkillQ.disabled = true;
                overlay.textContent = cooldown;
            } else {
                btnSkillQ.disabled = false;
                overlay.textContent = "";
            }
        } else {
            btnSkillQ.style.display = 'none';
        }

        // Slot W (Index 1)
        if (mySkills[1]) {
            const skillType = mySkills[1];
            const details = SKILL_DETAILS[skillType];
            
            btnSkillW.style.display = 'flex';
            btnSkillW.querySelector('.skill-icon').textContent = details.icon;
            
            // Tooltip
            const slotW = document.getElementById('slot-w');
            slotW.querySelector('.tt-title').textContent = t(details.nameKey);
            slotW.querySelector('.tt-desc').innerHTML = t(details.descKey);

            const cooldown = game.getSkillCooldown(myRole, skillType);
            const overlay = btnSkillW.querySelector('.cooldown-overlay');
            if (cooldown > 0) {
                btnSkillW.disabled = true;
                overlay.textContent = cooldown;
            } else {
                btnSkillW.disabled = false;
                overlay.textContent = "";
            }
        } else {
            btnSkillW.style.display = 'none';
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Adjust camera position on resize if crossing breakpoint
    if (window.innerWidth < 768) {
        // Only adjust if we are significantly off (simple check)
        if (camera.position.y < 50) {
             camera.position.set(0, 55, 40);
             camera.lookAt(0, 0, 0);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Start
init();
