import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameLogic, PLAYER_BLACK, PLAYER_WHITE } from './js/game_logic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve static files
app.use(express.static(__dirname));

// Room state
const rooms = new Map();

function broadcastRoomList() {
    const roomList = [];
    for (const [id, room] of rooms.entries()) {
        roomList.push({
            id: id,
            count: room.players.length,
            status: room.players.length === 2 ? 'Playing' : 'Waiting'
        });
    }
    io.emit('room_list', roomList);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Send current room list to new user
    broadcastRoomList();

    socket.on('join_room', (roomId) => {
        let room = rooms.get(roomId);

        if (!room) {
            // Create new room
            room = {
                id: roomId,
                game: new GameLogic(),
                players: [], // Array of { id, role }
                spectators: []
            };
            rooms.set(roomId, room);
            broadcastRoomList(); // Notify creation
        }

        // Check if player is already in room (reconnection?) - simplified for now: no reconnection logic
        
        if (room.players.length < 2) {
            const role = room.players.length === 0 ? PLAYER_BLACK : PLAYER_WHITE;
            const player = { id: socket.id, role: role };
            room.players.push(player);
            socket.join(roomId);
            
            // Notify player of their role
            socket.emit('room_joined', { roomId, role });
            
            // Notify room of player count
            io.to(roomId).emit('player_update', { 
                count: room.players.length,
                players: room.players.map(p => ({ role: p.role }))
            });
            
            broadcastRoomList(); // Notify player count change

            // If full, start game
            if (room.players.length === 2) {
                room.game.assignRandomSkills();
                io.to(roomId).emit('game_start', { 
                    board: room.game.board,
                    currentPlayer: room.game.currentPlayer,
                    hiddenPieces: room.game.hiddenPieces,
                    playerSkills: room.game.playerSkills
                });
            }
        } else {
            socket.emit('error_message', 'Room is full');
        }
    });

    socket.on('make_move', ({ roomId, x, y }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // Check if it's player's turn
        if (room.game.currentPlayer !== player.role) return;

        // Attempt move
        if (room.game.placePiece(x, y)) {
            io.to(roomId).emit('game_update', {
                type: 'move',
                x, y,
                player: player.role,
                board: room.game.board,
                currentPlayer: room.game.currentPlayer,
                hiddenPieces: room.game.hiddenPieces,
                lastMove: { x, y, player: player.role }
            });

            if (room.game.gameOver) {
                io.to(roomId).emit('game_over', { winner: room.game.winner });
            }
        }
    });

    socket.on('use_skill', (data) => {
        const { roomId, skillType, x, y, x1, y1, x2, y2 } = data;
        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        if (room.game.currentPlayer !== player.role) return;

        // Validate player has the skill
        if (!room.game.playerSkills[player.role].includes(skillType)) {
            return;
        }

        let success = false;
        let removedPieces = [];

        if (skillType === 'sand') {
            removedPieces = room.game.useSkill(x, y);
            if (removedPieces) success = true;
        } else if (skillType === 'mist') {
            success = room.game.useSkillMist(x, y);
        } else if (skillType === 'skip') {
            success = room.game.useSkillSkip(x, y);
        } else if (skillType === 'swap') {
            success = room.game.useSkillSwap(x1, y1, x2, y2);
        }

        if (success) {
            io.to(roomId).emit('game_update', {
                type: 'skill',
                skillType,
                x, y, x1, y1, x2, y2,
                player: player.role,
                board: room.game.board,
                currentPlayer: room.game.currentPlayer,
                hiddenPieces: room.game.hiddenPieces,
                removedPieces // For sand skill
            });

            if (room.game.gameOver) {
                io.to(roomId).emit('game_over', { winner: room.game.winner });
            }
        }
    });

    socket.on('restart_game', (roomId) => {
        const room = rooms.get(roomId);
        if (!room) return;
        
        // Only host (Black) can restart? Or anyone? Let's allow anyone for now or check role
        // const player = room.players.find(p => p.id === socket.id);
        // if (player.role !== PLAYER_BLACK) return;

        room.game.initBoard();
        room.game.assignRandomSkills();
        io.to(roomId).emit('game_restart', {
            board: room.game.board,
            currentPlayer: room.game.currentPlayer,
            hiddenPieces: room.game.hiddenPieces,
            playerSkills: room.game.playerSkills
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Find room and remove player
        for (const [roomId, room] of rooms.entries()) {
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                io.to(roomId).emit('player_left');
                // If room empty, delete it
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                } else {
                    // Reset game if someone leaves?
                    // For now, just notify.
                }
                broadcastRoomList(); // Notify update
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
