const WebSocket = require("ws");

const server = new WebSocket.Server({
    port: process.env.PORT || 9090
});

const rooms = {}; 
// {
//   roomId: {
//     players: Set(ws)
//   }
// }

function send(ws, data) {
    ws.send(JSON.stringify(data));
}

function broadcast(roomId, data) {
    if (!rooms[roomId]) return;

    for (const client of rooms[roomId].players) {
        if (client.readyState === WebSocket.OPEN) {
            send(client, data);
        }
    }
}

server.on("connection", (ws) => {
    ws.roomId = null;

    // ---- MESSAGE HANDLER ----
    ws.on("message", (msg) => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch (e) {
            return;
        }

        // =========================
        // CREATE ROOM
        // =========================
        if (data.type === "create_room") {
            const roomId = data.roomId;

            if (!roomId) return;

            if (!rooms[roomId]) {
                rooms[roomId] = {
                    players: new Set()
                };
            }

            rooms[roomId].players.add(ws);
            ws.roomId = roomId;

            send(ws, {
                type: "room_created",
                roomId
            });

            broadcast(roomId, {
                type: "player_joined",
                roomId
            });
        }

        // =========================
        // JOIN ROOM
        // =========================
        if (data.type === "join_room") {
            const roomId = data.roomId;

            if (!rooms[roomId]) {
                send(ws, {
                    type: "error",
                    msg: "Room does not exist"
                });
                return;
            }

            rooms[roomId].players.add(ws);
            ws.roomId = roomId;

            send(ws, {
                type: "room_joined",
                roomId
            });

            broadcast(roomId, {
                type: "player_joined"
            });
        }

        // =========================
        // GAME UPDATE (POSITION, SPEED, ETC)
        // =========================
        if (data.type === "update") {
            if (!ws.roomId) return;

            broadcast(ws.roomId, {
                type: "update",
                data: data.data
            });
        }
    });

    // ---- DISCONNECT ----
    ws.on("close", () => {
        const roomId = ws.roomId;
        if (!roomId || !rooms[roomId]) return;

        rooms[roomId].players.delete(ws);

        if (rooms[roomId].players.size === 0) {
            delete rooms[roomId]; // clean empty room
        } else {
            broadcast(roomId, {
                type: "player_left"
            });
        }
    });
});

console.log("WebSocket server running");