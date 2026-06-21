const WebSocket = require("ws");

const server = new WebSocket.Server({
    port: process.env.PORT || 10000
});

const rooms = {};
// structure:
// rooms[roomId] = {
//   players: Set(ws),
//   scene: number
// }

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(roomId, data) {
    if (!rooms[roomId]) return;

    for (const client of rooms[roomId].players) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    }
}

server.on("connection", (ws) => {
    ws.roomId = null;

    ws.on("message", (msg) => {
        let data;

        try {
            data = JSON.parse(msg);
        } catch (e) {
            return;
        }

        // =========================
        // CREATE OR JOIN ROOM
        // =========================
        if (data.type === "create_or_join") {
            const roomId = data.roomId;
            const scene = data.scene;

            if (!roomId) return;

            // =========================
            // CREATE ROOM
            // =========================
            if (!rooms[roomId]) {
                rooms[roomId] = {
                    players: new Set(),
                    scene: scene
                };

                rooms[roomId].players.add(ws);
                ws.roomId = roomId;

                send(ws, {
                    type: "room_created",
                    roomId: roomId,
                    scene: scene
                });

                console.log(`[SERVER] Room created: ${roomId} (scene ${scene})`);
            }

            // =========================
            // JOIN ROOM
            // =========================
            else {
                rooms[roomId].players.add(ws);
                ws.roomId = roomId;

                send(ws, {
                    type: "room_joined",
                    roomId: roomId,
                    scene: rooms[roomId].scene
                });

                broadcast(roomId, {
                    type: "player_joined"
                });

                console.log(`[SERVER] Player joined: ${roomId}`);
            }
        }

        // =========================
        // FUTURE: GAME DATA (optional later)
        // =========================
        if (data.type === "update") {
            if (!ws.roomId) return;

            broadcast(ws.roomId, {
                type: "update",
                data: data.data
            });
        }
    });

    // =========================
    // DISCONNECT CLEANUP
    // =========================
    ws.on("close", () => {
        const roomId = ws.roomId;

        if (!roomId || !rooms[roomId]) return;

        rooms[roomId].players.delete(ws);

        if (rooms[roomId].players.size === 0) {
            console.log(`[SERVER] Room deleted: ${roomId}`);
            delete rooms[roomId];
        } else {
            broadcast(roomId, {
                type: "player_left"
            });
        }
    });
});

console.log("[SERVER] WebSocket running on port", process.env.PORT || 10000);
