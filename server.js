import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from 'redis';
import { GameLogic, PLAYER_BLACK, PLAYER_WHITE } from './js/game_logic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Redis Setup
const redisClient = createClient({ 
    url: process.env.REDIS_URL || 'redis://localhost:6379' 
});
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Serve static files
app.use(express.static(__dirname));

// Local map to track socket -> room for disconnect handling
const socketRoomMap = new Map();

// --- Redis Helpers ---

async function getRoom(roomId) {
    try {
        const data = await redisClient.get(`room:${roomId}`);
        if (!data) return null;
        const room = JSON.parse(data);
        // Rehydrate GameLogic
        const gameLogic = new GameLogic();
        gameLogic.fromJSON(room.game);
        room.game = gameLogic;
        return room;
    } catch (e) {
        console.error("Error getting room:", e);
        return null;
    }
}

async function saveRoom(room) {
    try {
        const data = {
            id: room.id,
            game: room.game.toJSON(),
            players: room.players,
            spectators: room.spectators || []
        };
        // Set expiry to 24 hours to clean up abandoned rooms
        await redisClient.set(`room:${room.id}`, JSON.stringify(data), { EX: 86400 });
    } catch (e) {
        console.error("Error saving room:", e);
    }
}

async function deleteRoom(roomId) {
    await redisClient.del(`room:${roomId}`);
}

async function broadcastRoomList() {
    try {
        const keys = await redisClient.keys('room:*');
        const roomList = [];
        
        for (const key of keys) {
            const data = await redisClient.get(key);
            if (data) {
                const r = JSON.parse(data);
                roomList.push({
                    id: r.id,
                    count: r.players.length,
                    status: r.players.length === 2 ? 'Playing' : 'Waiting'
                });
            }
        }
        io.emit('room_list', roomList);
    } catch (e) {
        console.error("Error broadcasting room list:", e);
    }
}

// --- Socket Logic ---

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Send current room list to new user
    broadcastRoomList();

    socket.on('join_room', async (data) => {
        console.log(`[Join] Socket ${socket.id} requesting join. Data:`, JSON.stringify(data));

        const rawRoomId = typeof data === 'object' ? data.roomId : data;
        const roomId = String(rawRoomId);
        const playerId = (typeof data === 'object' && data.playerId) ? data.playerId : socket.id;

        console.log(`[Join] Parsed - Room: ${roomId}, PlayerID: ${playerId}`);

        let room = await getRoom(roomId);

        if (!room) {
            console.log(`[Join] Creating new room ${roomId}`);
            room = {
                id: roomId,
                game: new GameLogic(),
                players: [],
                spectators: []
            };
            await saveRoom(room);
            broadcastRoomList();
        }

        // Check if player is reconnecting
        const existingPlayer = room.players.find(p => p.playerId === playerId);

        if (existingPlayer) {
            // Reconnection Logic
            console.log(`[Join] Player ${playerId} reconnecting to room ${roomId}`);
            
            existingPlayer.socketId = socket.id;
            existingPlayer.connected = true;
            socket.join(roomId);
            socketRoomMap.set(socket.id, roomId);

            await saveRoom(room);

            socket.emit('room_joined', { roomId, role: existingPlayer.role });

            socket.emit('game_sync', {
                board: room.game.board,
                currentPlayer: room.game.currentPlayer,
                hiddenPieces: room.game.hiddenPieces,
                playerSkills: room.game.playerSkills,
                winner: room.game.winner
            });

            io.to(roomId).emit('chat_message', {
                sender: 'System',
                message: 'Player reconnected.'
            });

        } else {
            // New Player Logic
            console.log(`[Join] New player ${playerId} joining room ${roomId}. Current count: ${room.players.length}`);
            
            if (room.players.length < 2) {
                let role = PLAYER_BLACK;
                if (room.players.length > 0) {
                    role = room.players[0].role === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
                }

                const player = { 
                    socketId: socket.id, 
                    playerId: playerId, 
                    role: role, 
                    connected: true 
                };
                room.players.push(player);
                socket.join(roomId);
                socketRoomMap.set(socket.id, roomId);
                
                await saveRoom(room);
                
                console.log(`[Join] Assigned role ${role} to ${playerId}`);

                socket.emit('room_joined', { roomId, role });
                
                io.to(roomId).emit('player_update', { 
                    count: room.players.length,
                    players: room.players.map(p => ({ role: p.role }))
                });
                
                broadcastRoomList();

                if (room.players.length === 2) {
                    const hasSkills = Object.keys(room.game.playerSkills[PLAYER_BLACK]).length > 0;
                    
                    if (!hasSkills) {
                        console.log(`[Join] Room ${roomId} full. Starting NEW game.`);
                        room.game.assignRandomSkills();
                        await saveRoom(room); // Save assigned skills
                        
                        io.to(roomId).emit('game_start', { 
                            board: room.game.board,
                            currentPlayer: room.game.currentPlayer,
                            hiddenPieces: room.game.hiddenPieces,
                            playerSkills: room.game.playerSkills
                        });
                    } else {
                        console.log(`[Join] Room ${roomId} full. Resuming existing game.`);
                        io.to(roomId).emit('game_sync', {
                            board: room.game.board,
                            currentPlayer: room.game.currentPlayer,
                            hiddenPieces: room.game.hiddenPieces,
                            playerSkills: room.game.playerSkills,
                            winner: room.game.winner
                        });
                    }
                }
            } else {
                console.log(`[Join] Room ${roomId} is full. Rejecting ${playerId}.`);
                socket.emit('error_message', 'Room is full');
            }
        }
    });

    socket.on('make_move', async ({ roomId, x, y }) => {
        const room = await getRoom(roomId);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        if (room.game.currentPlayer !== player.role) return;

        if (room.game.placePiece(x, y)) {
            await saveRoom(room);

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

    socket.on('use_skill', async (data) => {
        const { roomId, skillType, x, y, x1, y1, x2, y2 } = data;
        const room = await getRoom(roomId);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        if (room.game.currentPlayer !== player.role) return;

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
            await saveRoom(room);

            io.to(roomId).emit('game_update', {
                type: 'skill',
                skillType,
                x, y, x1, y1, x2, y2,
                player: player.role,
                board: room.game.board,
                currentPlayer: room.game.currentPlayer,
                hiddenPieces: room.game.hiddenPieces,
                removedPieces
            });

            if (room.game.gameOver) {
                io.to(roomId).emit('game_over', { winner: room.game.winner });
            }
        }
    });

    socket.on('restart_game', async (roomId) => {
        const room = await getRoom(roomId);
        if (!room) return;
        
        room.game.initBoard();
        room.game.assignRandomSkills();
        await saveRoom(room);

        io.to(roomId).emit('game_restart', {
            board: room.game.board,
            currentPlayer: room.game.currentPlayer,
            hiddenPieces: room.game.hiddenPieces,
            playerSkills: room.game.playerSkills
        });
    });

    socket.on('send_chat', (data) => {
        const { roomId, message } = data;
        io.to(roomId).emit('chat_message', {
            sender: socket.id,
            message: message
        });
    });

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
        
        const roomId = socketRoomMap.get(socket.id);
        if (roomId) {
            socketRoomMap.delete(socket.id);
            
            const room = await getRoom(roomId);
            if (room) {
                const player = room.players.find(p => p.socketId === socket.id);
                
                if (player) {
                    console.log(`[Disconnect] Player ${player.playerId} left room ${roomId}`);
                    
                    const index = room.players.indexOf(player);
                    if (index !== -1) {
                        room.players.splice(index, 1);
                        
                        io.to(roomId).emit('player_left');
                        io.to(roomId).emit('chat_message', {
                            sender: 'System',
                            message: 'Opponent disconnected.'
                        });
                        
                        if (room.players.length === 0) {
                            await deleteRoom(roomId);
                        } else {
                            await saveRoom(room);
                            io.to(roomId).emit('player_update', { 
                                count: room.players.length,
                                players: room.players.map(p => ({ role: p.role }))
                            });
                        }
                        broadcastRoomList();
                    }
                }
            }
        }
    });
});

// Start Server
(async () => {
    await redisClient.connect();
    console.log('Connected to Redis');
    
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
})();
