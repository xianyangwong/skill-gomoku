export class NetworkManager {
    constructor() {
        this.socket = null;
    }

    init() {
        if (typeof io !== 'undefined') {
            this.socket = io();
            return true;
        } else {
            console.error("Socket.io is not defined.");
            return false;
        }
    }

    joinRoom(roomId, playerId) {
        if (this.socket) {
            this.socket.emit('join_room', { roomId, playerId });
        }
    }

    makeMove(roomId, x, y) {
        if (this.socket) {
            this.socket.emit('make_move', { roomId, x, y });
        }
    }

    useSkill(data) {
        if (this.socket) {
            this.socket.emit('use_skill', data);
        }
    }

    restartGame(roomId) {
        if (this.socket) {
            this.socket.emit('restart_game', roomId);
        }
    }

    sendChat(roomId, message) {
        if (this.socket) {
            this.socket.emit('send_chat', { roomId, message });
        }
    }

    on(event, callback) {
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }
    
    get id() {
        return this.socket ? this.socket.id : null;
    }
}
