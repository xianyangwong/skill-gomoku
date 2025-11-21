import * as THREE from 'three';
import { GameLogic, BOARD_SIZE, PLAYER_BLACK, PLAYER_WHITE, EMPTY } from './game_logic.js';
import { SceneManager } from './managers/SceneManager.js';
import { UIManager } from './managers/UIManager.js';
import { NetworkManager } from './managers/NetworkManager.js';
import { AudioManager } from './managers/AudioManager.js';
import { InputManager } from './managers/InputManager.js';

// --- Global Variables ---
const sceneManager = new SceneManager();
const uiManager = new UIManager();
const networkManager = new NetworkManager();
const audioManager = new AudioManager();
const game = new GameLogic();
const inputManager = new InputManager(sceneManager, uiManager, networkManager, audioManager, game);

// State
let myRole = null;
let roomId = null;
let myPlayerId = null;
let isGameActive = false;

// --- Initialization ---
function init() {
    console.log("Initializing Game Client (Refactored)...");

    // 1. Init Managers
    sceneManager.init('canvas-container');
    
    const socketConnected = networkManager.init();
    if (!socketConnected) {
        uiManager.updateLobbyStatus("Error: Socket.io not loaded.", true);
    }

    // 2. Player ID Setup
    myPlayerId = sessionStorage.getItem('skillGomoku_playerId');
    if (!myPlayerId) {
        myPlayerId = 'player_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        sessionStorage.setItem('skillGomoku_playerId', myPlayerId);
    }
    console.log("My Player ID:", myPlayerId);
    
    // Debug ID in Lobby
    const debugId = document.createElement('div');
    debugId.style.position = 'absolute';
    debugId.style.bottom = '10px';
    debugId.style.right = '10px';
    debugId.style.color = '#444';
    debugId.style.fontSize = '10px';
    debugId.textContent = 'ID: ' + myPlayerId;
    document.querySelector('.lobby-box').appendChild(debugId);

    // Auto-fill Room ID
    const savedRoomId = sessionStorage.getItem('skillGomoku_roomId');
    if (savedRoomId) {
        uiManager.roomIdInput.value = savedRoomId;
    }

    // 3. UI Callbacks
    uiManager.init({
        onJoin: (id) => {
            if (id) {
                roomId = id;
                sessionStorage.setItem('skillGomoku_roomId', id);
                uiManager.updateLobbyStatus(uiManager.t('connecting'));
                networkManager.joinRoom(id, myPlayerId);
                // Try play music
                audioManager.playMusic().then(active => uiManager.setMusicActive(active));
            }
        },
        onRestart: () => {
            if (roomId) networkManager.restartGame(roomId);
        },
        onMusic: () => {
            audioManager.toggleMusic().then(active => uiManager.setMusicActive(active));
        },
        onEmote: (emote) => {
            if (roomId) networkManager.sendChat(roomId, emote);
        },
        onLangChange: () => {
            // UI updates automatically, but we might need to refresh dynamic text
            uiManager.update(game, myRole);
        }
    });

    // 4. Network Listeners
    setupNetworkListeners();

    // 5. Input Listeners
    inputManager.setupInputListeners();

    // 6. Start Loop
    animate();
}

function setupNetworkListeners() {
    networkManager.on('room_list', (rooms) => {
        uiManager.updateRoomList(rooms);
    });

    networkManager.on('room_joined', (data) => {
        roomId = data.roomId;
        myRole = data.role;
        inputManager.setRoomId(roomId);
        inputManager.setMyRole(myRole);
        uiManager.updateLobbyStatus(uiManager.t('joinedRoom', {
            id: roomId, 
            role: myRole === PLAYER_BLACK ? uiManager.t('roleHost') : uiManager.t('roleGuest')
        }));
        
        if (myRole === PLAYER_BLACK) {
            uiManager.hideLobby();
            uiManager.showMessage(uiManager.t('waitingOpponent'));
        }
    });

    networkManager.on('player_update', (data) => {
        if (data.count === 2) {
            uiManager.hideLobby();
            uiManager.showMessage(uiManager.t('gameStart'), 2000);
        }
    });

    networkManager.on('game_start', (data) => {
        isGameActive = true;
        inputManager.setGameActive(true);
        syncGameState(data);
        
        // Show draft animation
        if (myRole && game.playerSkills[myRole]) {
            uiManager.showSkillDraftAnimation(game.playerSkills[myRole]);
            // Play sound
            audioManager.playDraftSound();
        }
    });

    networkManager.on('game_sync', (data) => {
        isGameActive = true;
        inputManager.setGameActive(true);
        syncGameState(data);
        
        if (game.gameOver) {
             uiManager.showVictory(game.winner, () => networkManager.restartGame(roomId));
        } else {
             uiManager.showMessage("");
        }
    });

    networkManager.on('game_update', (data) => {
        // Sync state
        game.board = data.board;
        game.currentPlayer = data.currentPlayer;
        game.hiddenPieces = data.hiddenPieces || [];
        
        if (data.type === 'move') {
            sceneManager.createPiece(data.x, data.y, data.player);
            audioManager.playMoveSound();
            if (data.player !== myRole) sceneManager.triggerShake(0.8);
        } else if (data.type === 'skill') {
            handleSkillEffect(data);
        }

        // Tick cooldowns locally for UI
        const prevPlayer = data.currentPlayer === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
        tickCooldowns(prevPlayer);
        
        // Set cooldown if skill used
        if (data.type === 'skill') {
            setSkillCooldown(data.player, data.skillType);
        }

        uiManager.update(game, myRole);
        sceneManager.updatePieceVisibility(game, myRole);
    });

    networkManager.on('game_over', (data) => {
        game.gameOver = true;
        game.winner = data.winner;
        uiManager.showVictory(game.winner, () => networkManager.restartGame(roomId));
        sceneManager.updatePieceVisibility(game, myRole);
        inputManager.resetSkillMode();
    });

    networkManager.on('game_restart', (data) => {
        isGameActive = true;
        inputManager.setGameActive(true);
        inputManager.resetSkillMode();
        game.initBoard();
        game.gameOver = false;
        game.winner = null;
        game.hiddenPieces = data.hiddenPieces || [];
        game.playerSkills = data.playerSkills || {};
        
        sceneManager.clearPieces();
        uiManager.showMessage(uiManager.t('gameReset'), 2000);
        uiManager.update(game, myRole);

        if (myRole && game.playerSkills[myRole]) {
            uiManager.showSkillDraftAnimation(game.playerSkills[myRole]);
            audioManager.playDraftSound();
        }
    });

    networkManager.on('error_message', (msg) => {
        uiManager.updateLobbyStatus("Error: " + msg, true);
    });
    
    networkManager.on('player_left', () => {
        uiManager.showMessage(uiManager.t('opponentLeft'));
        isGameActive = false;
        inputManager.setGameActive(false);
        inputManager.resetSkillMode();
        game.gameOver = true;
    });

    networkManager.on('chat_message', (data) => {
        uiManager.addChatMessage(data.message, data.sender === networkManager.id);
    });
}

function syncGameState(data) {
    game.board = data.board;
    game.currentPlayer = data.currentPlayer;
    game.hiddenPieces = data.hiddenPieces || [];
    game.playerSkills = data.playerSkills || {};
    game.gameOver = !!data.winner;
    game.winner = data.winner;
    
    // Rebuild scene
    sceneManager.clearPieces();
    for(let y=0; y<BOARD_SIZE; y++) {
        for(let x=0; x<BOARD_SIZE; x++) {
            if (game.board[y][x] !== EMPTY) {
                sceneManager.createPiece(x, y, game.board[y][x]);
            }
        }
    }

    uiManager.update(game, myRole);
    sceneManager.updatePieceVisibility(game, myRole);
}

function handleSkillEffect(data) {
    if (data.skillType === 'sand') {
        audioManager.playSkillSound('sand');
        if (data.removedPieces) {
            data.removedPieces.forEach(p => sceneManager.removePieceAt(p.x, p.y));
        }
        const worldPos = sceneManager.gridToWorld(data.x, data.y);
        sceneManager.createExplosion(new THREE.Vector3(worldPos.x, 0, worldPos.z), 0xffaa00, 20);
    } else if (data.skillType === 'mist') {
        audioManager.playSkillSound('mist');
        sceneManager.createPiece(data.x, data.y, data.player);
        const worldPos = sceneManager.gridToWorld(data.x, data.y);
        sceneManager.createExplosion(new THREE.Vector3(worldPos.x, 0, worldPos.z), 0x9c27b0, 15);
    } else if (data.skillType === 'skip') {
        audioManager.playSkillSound('skip');
        sceneManager.createPiece(data.x, data.y, data.player);
        const worldPos = sceneManager.gridToWorld(data.x, data.y);
        sceneManager.createExplosion(new THREE.Vector3(worldPos.x, 0, worldPos.z), 0x4caf50, 25); 
        uiManager.showMessage(uiManager.t('msgSkip'), 3000);
    } else if (data.skillType === 'swap') {
        audioManager.playSkillSound('swap');
        sceneManager.clearPieces();
        for(let y=0; y<BOARD_SIZE; y++) {
            for(let x=0; x<BOARD_SIZE; x++) {
                if (data.board[y][x] !== EMPTY) {
                    sceneManager.createPiece(x, y, data.board[y][x]);
                }
            }
        }
        const p1 = sceneManager.gridToWorld(data.x1, data.y1);
        const p2 = sceneManager.gridToWorld(data.x2, data.y2);
        sceneManager.createExplosion(new THREE.Vector3(p1.x, 0, p1.z), 0x00ffff, 15);
        sceneManager.createExplosion(new THREE.Vector3(p2.x, 0, p2.z), 0x00ffff, 15);
        uiManager.showMessage(uiManager.t('msgSwap'), 2000);
    }
}

function animate() {
    requestAnimationFrame(animate);
}

// Helpers
function tickCooldowns(player) {
    if (game.skillCooldowns[player].sand > 0) game.skillCooldowns[player].sand--;
    if (game.skillCooldowns[player].mist > 0) game.skillCooldowns[player].mist--;
    if (game.skillCooldowns[player].skip > 0) game.skillCooldowns[player].skip--;
    if (game.skillCooldowns[player].swap > 0) game.skillCooldowns[player].swap--;
}

function setSkillCooldown(player, skillType) {
    if (skillType === 'sand') game.skillCooldowns[player].sand = game.SKILL_SAND_COOLDOWN;
    if (skillType === 'mist') game.skillCooldowns[player].mist = game.SKILL_MIST_COOLDOWN;
    if (skillType === 'skip') game.skillCooldowns[player].skip = game.SKILL_SKIP_COOLDOWN;
    if (skillType === 'swap') game.skillCooldowns[player].swap = game.SKILL_SWAP_COOLDOWN;
}

// Start
init();
