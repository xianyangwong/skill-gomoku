import * as THREE from 'three';
import { EMPTY } from '../game_logic.js';

export class InputManager {
    constructor(sceneManager, uiManager, networkManager, audioManager, game) {
        this.sceneManager = sceneManager;
        this.uiManager = uiManager;
        this.networkManager = networkManager;
        this.audioManager = audioManager;
        this.game = game;

        // State
        this.myRole = null;
        this.roomId = null;
        this.isGameActive = false;
        this.currentSkillMode = null; // 'sand', 'mist', 'skip', 'swap'
        this.swapSource = null; // {x, y}
        
        this.mouse = new THREE.Vector2();
    }

    setMyRole(role) {
        this.myRole = role;
    }

    setRoomId(id) {
        this.roomId = id;
    }

    setGameActive(active) {
        this.isGameActive = active;
    }

    setupInputListeners() {
        // Mouse Click
        window.addEventListener('click', (event) => {
            if (event.target.closest('#ui-container') || 
                event.target.closest('#lobby-overlay') || 
                event.target.closest('#rules-modal')) return;

            if (!this.isGameActive || this.game.gameOver || this.game.currentPlayer !== this.myRole) return;

            // Calculate mouse pos for raycaster
            const mouse = {
                x: (event.clientX / window.innerWidth) * 2 - 1,
                y: -(event.clientY / window.innerHeight) * 2 + 1
            };

            const gridPos = this.sceneManager.getIntersection(mouse);
            if (gridPos) {
                this.handleGridClick(gridPos.x, gridPos.y);
            }
        });

        // Mouse Move (for preview)
        window.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            this.sceneManager.updatePreview(this.mouse, this.sceneManager.camera, this.game, this.myRole, this.currentSkillMode);
        });

        // Keyboard
        window.addEventListener('keydown', (event) => {
            if (this.game.currentPlayer !== this.myRole) return;
            if (event.key === 'q' || event.key === 'Q') this.toggleSkillMode(0);
            else if (event.key === 'w' || event.key === 'W') this.toggleSkillMode(1);
        });

        // Skill Buttons
        this.uiManager.btnSkillQ.addEventListener('click', () => this.toggleSkillMode(0));
        this.uiManager.btnSkillW.addEventListener('click', () => this.toggleSkillMode(1));
    }

    handleGridClick(x, y) {
        if (this.currentSkillMode) {
            if (this.currentSkillMode === 'swap') {
                if (!this.swapSource) {
                    this.swapSource = { x, y };
                    this.uiManager.showMessage(this.uiManager.t('msgSelectSecond'));
                } else {
                    this.networkManager.useSkill({ 
                        roomId: this.roomId, 
                        skillType: 'swap', 
                        x1: this.swapSource.x, y1: this.swapSource.y, 
                        x2: x, y2: y 
                    });
                    this.resetSkillMode();
                    this.uiManager.showMessage("");
                }
            } else {
                this.networkManager.useSkill({ roomId: this.roomId, skillType: this.currentSkillMode, x, y });
                this.resetSkillMode();
            }
        } else {
            if (this.game.board[y][x] === EMPTY) {
                this.networkManager.makeMove(this.roomId, x, y);
            }
        }
    }

    toggleSkillMode(slotIndex) {
        if (this.game.gameOver || this.game.currentPlayer !== this.myRole) return;
        
        const mySkills = this.game.playerSkills[this.myRole] || [];
        if (!mySkills[slotIndex]) return;

        const skillType = mySkills[slotIndex];

        if (this.currentSkillMode === skillType) {
            this.resetSkillMode();
            return;
        }

        if (!this.game.isSkillReady(this.myRole, skillType)) return;

        this.currentSkillMode = skillType;
        
        this.uiManager.setSkillActive(0, slotIndex === 0);
        this.uiManager.setSkillActive(1, slotIndex === 1);

        if (skillType === 'swap') {
            this.swapSource = null;
            this.uiManager.showMessage(this.uiManager.t('msgSelectFirst'));
        }
    }

    resetSkillMode() {
        this.currentSkillMode = null;
        this.swapSource = null;
        this.uiManager.setSkillActive(0, false);
        this.uiManager.setSkillActive(1, false);
    }
}
