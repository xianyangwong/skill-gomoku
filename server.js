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

    socket.on('join_room', (data) => {
        console.log(`[Join] Socket ${socket.id} requesting join. Data:`, JSON.stringify(data));

        // Handle both old (string) and new (object) formats for backward compatibility
        const rawRoomId = typeof data === 'object' ? data.roomId : data;
        const roomId = String(rawRoomId); // Ensure string
        // Ensure playerId is valid, otherwise fallback to socket.id
        const playerId = (typeof data === 'object' && data.playerId) ? data.playerId : socket.id;

        console.log(`[Join] Parsed - Room: ${roomId}, PlayerID: ${playerId}`);

        let room = rooms.get(roomId);

        if (!room) {
            console.log(`[Join] Creating new room ${roomId}`);
            // Create new room
            room = {
                id: roomId,
                game: new GameLogic(),
                players: [], // Array of { socketId, playerId, role, connected }
                spectators: [],
                disconnectTimers: new Map() // Store cleanup timers
            };
            rooms.set(roomId, room);
            broadcastRoomList(); // Notify creation
        }

        // Check if player is reconnecting
        const existingPlayer = room.players.find(p => p.playerId === playerId);

        if (existingPlayer) {
            // Reconnection Logic
            console.log(`[Join] Player ${playerId} reconnecting to room ${roomId}`);
            
            // Clear any disconnect timer
            if (room.disconnectTimers.has(playerId)) {
                console.log(`[Join] Clearing disconnect timer for ${playerId}`);
                clearTimeout(room.disconnectTimers.get(playerId));
                room.disconnectTimers.delete(playerId);
            }

            // Update socket info
            existingPlayer.socketId = socket.id;
            existingPlayer.connected = true;
            socket.join(roomId);

            // Notify player of their role
            socket.emit('room_joined', { roomId, role: existingPlayer.role });

            // Sync game state if game is running
            // Sync even if not full, to restore board state if any
            socket.emit('game_sync', {
                board: room.game.board,
                currentPlayer: room.game.currentPlayer,
                hiddenPieces: room.game.hiddenPieces,
                playerSkills: room.game.playerSkills,
                winner: room.game.winner
            });

            // Notify room
            io.to(roomId).emit('chat_message', {
                sender: 'System',
                message: 'Player reconnected.'
            });

        } else {
            // New Player Logic
            console.log(`[Join] New player ${playerId} joining room ${roomId}. Current count: ${room.players.length}`);
            
            if (room.players.length < 2) {
                // Determine role: if 0 players, Black; if 1 player, check what role is taken
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
                
                console.log(`[Join] Assigned role ${role} to ${playerId}`);

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
                    // Check if game is already in progress (has skills assigned)
                    const hasSkills = Object.keys(room.game.playerSkills[PLAYER_BLACK]).length > 0;
                    
                    if (!hasSkills) {
                        console.log(`[Join] Room ${roomId} full. Starting NEW game.`);
                        room.game.assignRandomSkills();
                        io.to(roomId).emit('game_start', { 
                            board: room.game.board,
                            currentPlayer: room.game.currentPlayer,
                            hiddenPieces: room.game.hiddenPieces,
                            playerSkills: room.game.playerSkills
                        });
                    } else {
                        console.log(`[Join] Room ${roomId} full. Resuming existing game.`);
                        // Send sync to everyone to ensure state is consistent
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
                console.log(`[Join] Current players in room ${roomId}:`, room.players.map(p => ({ 
                    pid: p.playerId, 
                    sid: p.socketId, 
                    conn: p.connected 
                })));
                socket.emit('error_message', 'Room is full');
            }
        }
    });

    socket.on('make_move', ({ roomId, x, y }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
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

        const player = room.players.find(p => p.socketId === socket.id);
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

    socket.on('send_chat', (data) => {
        const { roomId, message } = data;
        // Broadcast to room
        io.to(roomId).emit('chat_message', {
            sender: socket.id,
            message: message
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Find room and handle disconnection
        for (const [roomId, room] of rooms.entries()) {
            const player = room.players.find(p => p.socketId === socket.id);
            
            if (player) {
                console.log(`[Disconnect] Player ${player.playerId} left room ${roomId}`);
                
                // Remove player immediately (No reconnection grace period)
                const index = room.players.indexOf(player);
                if (index !== -1) {
                    room.players.splice(index, 1);
                    
                    // Notify remaining player
                    io.to(roomId).emit('player_left');
                    io.to(roomId).emit('chat_message', {
                        sender: 'System',
                        message: 'Opponent disconnected.'
                    });
                    
                    // Update room list
                    broadcastRoomList();
                    
                    // If room empty, delete it
                    if (room.players.length === 0) {
                        rooms.delete(roomId);
                    } else {
                        // Notify remaining player of update (so they know they are alone)
                        io.to(roomId).emit('player_update', { 
                            count: room.players.length,
                            players: room.players.map(p => ({ role: p.role }))
                        });
                    }
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
