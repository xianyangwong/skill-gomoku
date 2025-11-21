export const BOARD_SIZE = 15;
export const PLAYER_BLACK = 1;
export const PLAYER_WHITE = 2;
export const EMPTY = 0;

export const SKILL_TYPES = ['sand', 'mist', 'skip', 'swap'];

export class GameLogic {
    constructor() {
        this.board = [];
        this.currentPlayer = PLAYER_BLACK;
        this.gameOver = false;
        this.winner = null;
        
        // Skill state
        // Cooldown: number of turns until ready. 0 means ready.
        this.skillCooldowns = {
            [PLAYER_BLACK]: { sand: 0, mist: 0, skip: 0 },
            [PLAYER_WHITE]: { sand: 0, mist: 0, skip: 0 }
        };
        this.SKILL_SAND_COOLDOWN = 5;
        this.SKILL_MIST_COOLDOWN = 5;
        this.SKILL_SKIP_COOLDOWN = 3;
        this.SKILL_SWAP_COOLDOWN = 7;
        
        // Assigned skills for each player (array of strings)
        this.playerSkills = {
            [PLAYER_BLACK]: [],
            [PLAYER_WHITE]: []
        };

        // Hidden pieces: array of {x, y, player, turnsLeft}
        this.hiddenPieces = [];

        this.initBoard();
    }

    initBoard() {
        this.board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(EMPTY));
        this.currentPlayer = PLAYER_BLACK;
        this.gameOver = false;
        this.winner = null;
        this.skillCooldowns = {
            [PLAYER_BLACK]: { sand: 0, mist: 0, skip: 0, swap: 0 },
            [PLAYER_WHITE]: { sand: 0, mist: 0, skip: 0, swap: 0 }
        };
        this.hiddenPieces = [];
        // Skills are assigned by server or explicitly called
    }

    assignRandomSkills() {
        const getRandomSkills = () => {
            const shuffled = [...SKILL_TYPES].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, 2);
        };
        this.playerSkills[PLAYER_BLACK] = getRandomSkills();
        this.playerSkills[PLAYER_WHITE] = getRandomSkills();
    }

    isValidMove(x, y) {
        return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && this.board[y][x] === EMPTY;
    }

    placePiece(x, y) {
        if (this.gameOver || !this.isValidMove(x, y)) return false;

        this.board[y][x] = this.currentPlayer;
        
        if (this.checkWin(x, y, this.currentPlayer)) {
            this.gameOver = true;
            this.winner = this.currentPlayer;
        } else {
            this.switchTurn();
        }
        return true;
    }

    switchTurn() {
        // Decrease cooldowns for the player who just finished
        // Actually, let's decrease cooldowns for the NEXT player to indicate their turn start?
        // Standard: Cooldown ticks down at start of your turn.
        
        this.currentPlayer = this.currentPlayer === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
        
        // Tick cooldowns for current player
        if (this.skillCooldowns[this.currentPlayer].sand > 0) this.skillCooldowns[this.currentPlayer].sand--;
        if (this.skillCooldowns[this.currentPlayer].mist > 0) this.skillCooldowns[this.currentPlayer].mist--;
        if (this.skillCooldowns[this.currentPlayer].skip > 0) this.skillCooldowns[this.currentPlayer].skip--;
        if (this.skillCooldowns[this.currentPlayer].swap > 0) this.skillCooldowns[this.currentPlayer].swap--;

        // Tick hidden pieces
        // If a piece has turnsLeft > 0, decrement.
        // We filter out expired ones.
        // Note: We decrement ALL hidden pieces, or just the ones belonging to the player whose turn just ended?
        // "Lasts 3 turns" usually means 3 full rounds or 3 of the owner's turns.
        // Let's say 3 rounds (switchTurn called 3 times? No, that's too short).
        // Let's say 3 of the OWNER's turns.
        
        for (let i = this.hiddenPieces.length - 1; i >= 0; i--) {
            const p = this.hiddenPieces[i];
            // Decrement only when it's the owner's turn again? 
            // Or just every turn switch? "3 turns" usually means 3 moves.
            // Let's decrement every switchTurn. So 3 turns = 1.5 rounds.
            // If we want it to last longer, let's say 6 switchTurns (3 rounds).
            p.turnsLeft--;
            if (p.turnsLeft <= 0) {
                this.hiddenPieces.splice(i, 1);
            }
        }
    }


    checkWin(x, y, player) {
        const directions = [
            [1, 0],  // Horizontal
            [0, 1],  // Vertical
            [1, 1],  // Diagonal \
            [1, -1]  // Diagonal /
        ];

        for (let [dx, dy] of directions) {
            let count = 1;
            
            // Check forward
            let i = 1;
            while (true) {
                const nx = x + dx * i;
                const ny = y + dy * i;
                if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE || this.board[ny][nx] !== player) break;
                count++;
                i++;
            }

            // Check backward
            i = 1;
            while (true) {
                const nx = x - dx * i;
                const ny = y - dy * i;
                if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE || this.board[ny][nx] !== player) break;
                count++;
                i++;
            }

            if (count >= 5) return true;
        }
        return false;
    }

    // Skill: Flying Sand and Rolling Stones (飞沙走石)
    // Removes a single piece at (x, y)
    // Can be used on occupied spots.
    useSkill(x, y) {
        if (this.gameOver) return null;
        if (this.skillCooldowns[this.currentPlayer].sand > 0) return null;

        const removedPieces = [];
        
        if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            if (this.board[y][x] !== EMPTY) {
                removedPieces.push({ x: x, y: y, player: this.board[y][x] });
                this.board[y][x] = EMPTY;
                
                // Also remove from hiddenPieces if it was hidden
                const hiddenIdx = this.hiddenPieces.findIndex(p => p.x === x && p.y === y);
                if (hiddenIdx !== -1) {
                    this.hiddenPieces.splice(hiddenIdx, 1);
                }
            }
        }

        // Set cooldown
        this.skillCooldowns[this.currentPlayer].sand = this.SKILL_SAND_COOLDOWN;
        
        // Using a skill consumes the turn
        this.switchTurn();

        return removedPieces;
    }

    // Skill: Mist (雾里看花)
    // Places a piece that is hidden from opponent for X turns
    useSkillMist(x, y) {
        if (this.gameOver) return false;
        if (this.skillCooldowns[this.currentPlayer].mist > 0) return false;
        if (!this.isValidMove(x, y)) return false;

        // Place the piece
        this.board[y][x] = this.currentPlayer;
        
        // Mark as hidden
        // Duration: 6 turns (3 rounds)
        this.hiddenPieces.push({
            x, y, 
            player: this.currentPlayer,
            turnsLeft: 6 
        });

        // Set cooldown
        this.skillCooldowns[this.currentPlayer].mist = this.SKILL_MIST_COOLDOWN;

        // Check win (yes, you can win with a hidden piece)
        if (this.checkWin(x, y, this.currentPlayer)) {
            this.gameOver = true;
            this.winner = this.currentPlayer;
        } else {
            this.switchTurn();
        }
        return true;
    }

    // Skill: Strength to Uproot Mountains (力拔山兮)
    // Places a piece and skips the opponent's next turn.
    useSkillSkip(x, y) {
        if (this.gameOver) return false;
        if (this.skillCooldowns[this.currentPlayer].skip > 0) return false;
        if (!this.isValidMove(x, y)) return false;

        // Place the piece
        this.board[y][x] = this.currentPlayer;

        // Set cooldown
        this.skillCooldowns[this.currentPlayer].skip = this.SKILL_SKIP_COOLDOWN;

        // Check win
        if (this.checkWin(x, y, this.currentPlayer)) {
            this.gameOver = true;
            this.winner = this.currentPlayer;
        } else {
            // Skip opponent's turn
            // We simulate this by switching turn twice.
            // 1. Switch to opponent (Opponent's turn starts)
            this.switchTurn();
            // 2. Switch back to me (Opponent's turn ends immediately)
            this.switchTurn();
        }
        return true;
    }

    // Skill: Swap (移形换位)
    // Swaps the positions of two pieces at (x1, y1) and (x2, y2)
    useSkillSwap(x1, y1, x2, y2) {
        if (this.gameOver) return false;
        if (this.skillCooldowns[this.currentPlayer].swap > 0) return false;
        
        // Validate coordinates
        if (x1 < 0 || x1 >= BOARD_SIZE || y1 < 0 || y1 >= BOARD_SIZE) return false;
        if (x2 < 0 || x2 >= BOARD_SIZE || y2 < 0 || y2 >= BOARD_SIZE) return false;
        
        // Must be two different spots
        if (x1 === x2 && y1 === y2) return false;

        // Must be occupied spots (swapping empty with empty is useless, but allowed? No, let's require at least one piece?)
        // Actually, swapping a piece with an empty spot is a "Move".
        // Swapping two pieces is a "Swap".
        // Let's allow swapping ANY two cells as long as they are not the same cell.
        // This covers: Move (Piece <-> Empty), Swap (Piece <-> Piece).
        
        const p1 = this.board[y1][x1];
        const p2 = this.board[y2][x2];
        
        // Perform swap
        this.board[y1][x1] = p2;
        this.board[y2][x2] = p1;
        
        // Update hidden pieces coordinates if moved
        const h1 = this.hiddenPieces.find(p => p.x === x1 && p.y === y1);
        const h2 = this.hiddenPieces.find(p => p.x === x2 && p.y === y2);
        
        if (h1) { h1.x = x2; h1.y = y2; }
        if (h2) { h2.x = x1; h2.y = y1; }

        // Set cooldown
        this.skillCooldowns[this.currentPlayer].swap = this.SKILL_SWAP_COOLDOWN;

        // Check win for BOTH players?
        // If I swap and create a line for opponent, they win?
        // Or if I create a line for myself, I win?
        // Let's check current player first.
        if (this.checkWin(x1, y1, this.currentPlayer) || this.checkWin(x2, y2, this.currentPlayer)) {
            this.gameOver = true;
            this.winner = this.currentPlayer;
        } else {
            // Check opponent win?
            const opponent = this.currentPlayer === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
            // We need to scan the board or just check the moved pieces?
            // Just check the moved pieces for opponent color.
            if (this.checkWin(x1, y1, opponent) || this.checkWin(x2, y2, opponent)) {
                this.gameOver = true;
                this.winner = opponent;
            } else {
                this.switchTurn();
            }
        }
        return true;
    }

    getSkillCooldown(player, skillType) {
        return this.skillCooldowns[player][skillType];
    }
    
    isSkillReady(player, skillType) {
        return this.skillCooldowns[player][skillType] === 0;
    }

    isHidden(x, y) {
        return this.hiddenPieces.some(p => p.x === x && p.y === y);
    }

    toJSON() {
        return {
            board: this.board,
            currentPlayer: this.currentPlayer,
            gameOver: this.gameOver,
            winner: this.winner,
            skillCooldowns: this.skillCooldowns,
            playerSkills: this.playerSkills,
            hiddenPieces: this.hiddenPieces
        };
    }

    fromJSON(data) {
        this.board = data.board;
        this.currentPlayer = data.currentPlayer;
        this.gameOver = data.gameOver;
        this.winner = data.winner;
        this.skillCooldowns = data.skillCooldowns;
        this.playerSkills = data.playerSkills;
        this.hiddenPieces = data.hiddenPieces;
    }
}