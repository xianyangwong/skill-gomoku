import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BOARD_SIZE, PLAYER_BLACK, PLAYER_WHITE, EMPTY } from '../game_logic.js';

// --- Constants ---
const CELL_SIZE = 2;
const BOARD_WIDTH = BOARD_SIZE * CELL_SIZE;
const PIECE_RADIUS = CELL_SIZE * 0.4;
const PIECE_HEIGHT = 0.5;

export class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        
        this.boardMesh = null;
        this.pieceMeshes = [];
        this.previewMesh = null;
        
        this.cameraTargetPos = new THREE.Vector3();
        this.isIntroAnimating = true;
        this.shakeIntensity = 0;
        this.SHAKE_DECAY = 0.9;
    }

    init(containerId) {
        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x333333);
        this.scene.fog = new THREE.Fog(0x333333, 20, 100);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 200, 100); // Initial far position
        
        if (window.innerWidth < 768) {
            this.cameraTargetPos.set(0, 60, 30);
        } else {
            this.cameraTargetPos.set(0, 50, 25);
        }
        this.camera.lookAt(0, 0, 3);

        // 3. Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById(containerId).appendChild(this.renderer.domElement);

        // 4. Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
        this.controls.target.set(0, 0, 3);
        this.controls.update();

        // 5. Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // 6. Objects
        this.createBoard();
        this.createPreviewPiece();

        // 7. Start Loop
        this.animate();

        // Resize listener
        window.addEventListener('resize', () => this.onWindowResize());
    }

    createBoard() {
        // Board Base
        const geometry = new THREE.BoxGeometry(BOARD_WIDTH + 1.5, 1.5, BOARD_WIDTH + 1.5);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xE6C288, 
            roughness: 0.3,
            metalness: 0.05
        });
        this.boardMesh = new THREE.Mesh(geometry, material);
        this.boardMesh.position.y = -0.75;
        this.boardMesh.receiveShadow = true;
        this.scene.add(this.boardMesh);

        // Grid Lines
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.5, transparent: true });
        const points = [];
        const halfSize = BOARD_WIDTH / 2;
        const start = -halfSize + CELL_SIZE / 2;

        for (let i = 0; i < BOARD_SIZE; i++) {
            const pos = start + i * CELL_SIZE;
            const limit = halfSize - 0.5; 
            points.push(new THREE.Vector3(pos, 0.01, -limit));
            points.push(new THREE.Vector3(pos, 0.01, limit));
            points.push(new THREE.Vector3(-limit, 0.01, pos));
            points.push(new THREE.Vector3(limit, 0.01, pos));
        }
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
        this.scene.add(lines);

        // Star Points
        const starIndices = [3, 7, 11];
        const dotGeometry = new THREE.CircleGeometry(0.15, 32);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.8, transparent: true });

        starIndices.forEach(x => {
            starIndices.forEach(y => {
                const dot = new THREE.Mesh(dotGeometry, dotMaterial);
                dot.rotation.x = -Math.PI / 2;
                const worldPos = this.gridToWorld(x, y);
                dot.position.set(worldPos.x, 0.02, worldPos.z);
                this.scene.add(dot);
            });
        });
    }

    createPreviewPiece() {
        const geometry = new THREE.SphereGeometry(PIECE_RADIUS, 32, 16);
        geometry.scale(1, 0.4, 1);
        
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.5,
            roughness: 0.2,
            metalness: 0.1
        });
        this.previewMesh = new THREE.Mesh(geometry, material);
        this.previewMesh.visible = false;
        this.scene.add(this.previewMesh);
    }

    createPiece(x, y, player) {
        const isBlack = player === PLAYER_BLACK;
        const color = isBlack ? 0x111111 : 0xffffff;
        
        const geometry = new THREE.SphereGeometry(PIECE_RADIUS, 32, 16);
        geometry.scale(1, 0.4, 1);

        const material = new THREE.MeshStandardMaterial({ 
            color: color, 
            roughness: isBlack ? 0.2 : 0.1,
            metalness: 0.1,
            envMapIntensity: 1.0
        });
        
        const piece = new THREE.Mesh(geometry, material);
        const worldPos = this.gridToWorld(x, y);
        piece.position.set(worldPos.x, PIECE_RADIUS * 0.4, worldPos.z); 
        
        piece.castShadow = true;
        piece.receiveShadow = true;
        piece.userData = { gridX: x, gridY: y };
        
        this.scene.add(piece);
        this.pieceMeshes.push(piece);
        return piece;
    }

    clearPieces() {
        this.pieceMeshes.forEach(mesh => this.scene.remove(mesh));
        this.pieceMeshes = [];
    }

    removePieceAt(x, y) {
        const meshIndex = this.pieceMeshes.findIndex(m => m.userData.gridX === x && m.userData.gridY === y);
        if (meshIndex !== -1) {
            const mesh = this.pieceMeshes[meshIndex];
            this.createExplosion(mesh.position);
            this.scene.remove(mesh);
            this.pieceMeshes.splice(meshIndex, 1);
        }
    }

    updatePieceVisibility(game, myRole) {
        if (game.gameOver) {
            this.pieceMeshes.forEach(mesh => {
                mesh.visible = true;
                mesh.material.transparent = false;
                mesh.material.opacity = 1.0;
                mesh.material.emissive.setHex(0x000000);
            });
            return;
        }

        this.pieceMeshes.forEach(mesh => {
            const x = mesh.userData.gridX;
            const y = mesh.userData.gridY;
            
            const hiddenPiece = game.hiddenPieces.find(p => p.x === x && p.y === y);
            
            if (hiddenPiece) {
                if (hiddenPiece.player === myRole) {
                    mesh.visible = true;
                    mesh.material.transparent = true;
                    mesh.material.opacity = 0.6; 
                    mesh.material.emissive.setHex(0x222222);
                } else {
                    mesh.visible = false;
                }
            } else {
                mesh.visible = true;
                mesh.material.transparent = false;
                mesh.material.opacity = 1.0;
                mesh.material.emissive.setHex(0x000000);
            }
        });
    }

    updatePreview(mouse, camera, game, myRole, currentSkillMode) {
        if (!game || !myRole) return;
        
        // Only show preview if it's my turn and game is active
        if (game.gameOver || game.currentPlayer !== myRole) {
            this.previewMesh.visible = false;
            return;
        }

        this.raycaster.setFromCamera(mouse, camera);
        const intersects = this.raycaster.intersectObject(this.boardMesh);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            const gridPos = this.worldToGrid(point.x, point.z);

            if (gridPos.x >= 0 && gridPos.x < BOARD_SIZE && gridPos.y >= 0 && gridPos.y < BOARD_SIZE) {
                const worldPos = this.gridToWorld(gridPos.x, gridPos.y);
                this.previewMesh.position.set(worldPos.x, PIECE_HEIGHT / 2, worldPos.z);
                
                if (currentSkillMode) {
                    if (currentSkillMode === 'sand') {
                        this.previewMesh.material.color.setHex(0xff0000);
                        this.previewMesh.material.opacity = 0.3;
                    } else if (currentSkillMode === 'mist') {
                        this.previewMesh.material.color.setHex(0x9c27b0);
                        this.previewMesh.material.opacity = 0.5;
                    } else if (currentSkillMode === 'skip') {
                        this.previewMesh.material.color.setHex(0x4caf50);
                        this.previewMesh.material.opacity = 0.5;
                    } else if (currentSkillMode === 'swap') {
                        this.previewMesh.material.color.setHex(0x00ffff);
                        this.previewMesh.material.opacity = 0.5;
                    }
                    this.previewMesh.scale.set(1, 1, 1);
                    this.previewMesh.visible = true;
                } else {
                    if (game.board[gridPos.y][gridPos.x] === EMPTY) {
                        this.previewMesh.visible = true;
                        this.previewMesh.scale.set(1, 1, 1);
                        const color = myRole === PLAYER_BLACK ? 0x000000 : 0xffffff;
                        this.previewMesh.material.color.setHex(color);
                        this.previewMesh.material.opacity = 0.5;
                    } else {
                        this.previewMesh.visible = false;
                    }
                }
            } else {
                this.previewMesh.visible = false;
            }
        } else {
            this.previewMesh.visible = false;
        }
    }

    getIntersection(mouse) {
        this.raycaster.setFromCamera(mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.boardMesh);
        if (intersects.length > 0) {
            return this.worldToGrid(intersects[0].point.x, intersects[0].point.z);
        }
        return null;
    }

    createExplosion(position, color = 0x888888, count = 10) {
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
            this.scene.add(particle);
            const animateParticle = () => {
                particle.position.add(particle.userData.velocity);
                particle.userData.velocity.y -= 0.02;
                particle.rotation.x += 0.1;
                particle.rotation.y += 0.1;
                if (particle.position.y < -5) {
                    this.scene.remove(particle);
                } else {
                    requestAnimationFrame(animateParticle);
                }
            };
            animateParticle();
        }
    }

    triggerShake(intensity = 1.0) {
        this.shakeIntensity = intensity;
    }

    gridToWorld(x, y) {
        const halfSize = BOARD_WIDTH / 2;
        const start = -halfSize + CELL_SIZE / 2;
        return {
            x: start + x * CELL_SIZE,
            z: start + y * CELL_SIZE
        };
    }

    worldToGrid(x, z) {
        const halfSize = BOARD_WIDTH / 2;
        const start = -halfSize;
        const localX = x - start;
        const localZ = z - start;
        const gridX = Math.floor(localX / CELL_SIZE);
        const gridY = Math.floor(localZ / CELL_SIZE);
        return { x: gridX, y: gridY };
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        if (window.innerWidth < 768) {
            this.cameraTargetPos.set(0, 60, 30);
        } else {
            this.cameraTargetPos.set(0, 50, 25);
        }

        if (!this.isIntroAnimating) {
            if (window.innerWidth < 768) {
                if (this.camera.position.y < 55) {
                     this.camera.position.copy(this.cameraTargetPos);
                     this.camera.lookAt(0, 0, 3);
                     this.controls.target.set(0, 0, 3);
                }
            } else {
                if (this.camera.position.y > 55) {
                     this.camera.position.copy(this.cameraTargetPos);
                     this.camera.lookAt(0, 0, 3);
                     this.controls.target.set(0, 0, 3);
                }
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.isIntroAnimating) {
            this.camera.position.lerp(this.cameraTargetPos, 0.03);
            if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.5) {
                this.isIntroAnimating = false;
                this.controls.target.set(0, 0, 3);
            }
        }

        this.controls.update();

        if (this.shakeIntensity > 0) {
            const rx = (Math.random() - 0.5) * this.shakeIntensity;
            const ry = (Math.random() - 0.5) * this.shakeIntensity;
            const rz = (Math.random() - 0.5) * this.shakeIntensity;
            
            const shakeOffset = new THREE.Vector3(rx, ry, rz);
            this.camera.position.add(shakeOffset);
            this.renderer.render(this.scene, this.camera);
            this.camera.position.sub(shakeOffset);

            this.shakeIntensity *= this.SHAKE_DECAY;
            if (this.shakeIntensity < 0.05) this.shakeIntensity = 0;
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}
