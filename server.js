const WebSocket = require("ws");

const server = new WebSocket.Server({
	port: process.env.PORT || 10000
});

const rooms = {};

// =========================
// HELPERS
// =========================
function send(ws, data) {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(data));
	}
}

// =========================
// CONNECTION
// =========================
server.on("connection", (ws) => {

	ws.roomId = null;
	ws.carType = null;
	ws.playerId = null;

	ws.on("message", (msg) => {

		let data;
		try {
			data = JSON.parse(msg);
		} catch {
			return;
		}

		// =========================================================
		// CREATE / JOIN ROOM
		// =========================================================
		if (data.type === "create_or_join") {

			ws.roomId = data.roomId;
			ws.carType = data.car_id;
			ws.scene = data.scene;

			if (!rooms[ws.roomId]) {
				rooms[ws.roomId] = {
					scene: ws.scene,
					players: []
				};
			}

			const room = rooms[ws.roomId];

			room.players.push(ws);

			ws.playerId = "p" + room.players.length;

			console.log("[SERVER] Player joined:", ws.playerId, ws.carType);

			// =========================================================
			// 1. SEND ROOM CONFIRMATION (NO SPAWN DATA HERE)
			// =========================================================
			send(ws, {
				type: "room_joined",
				roomId: ws.roomId,
				scene: ws.scene
			});

			// =========================================================
			// 2. SEND SPAWN PACKET TO THIS PLAYER
			// =========================================================
			send(ws, {
				type: "spawn",
				player_id: ws.playerId,
				car_type: ws.carType,
				is_local: true
			});

			// =========================================================
			// 3. NOTIFY OTHER PLAYERS
			// =========================================================
			for (let other of room.players) {
				if (other !== ws) {
					send(other, {
						type: "spawn",
						player_id: ws.playerId,
						car_type: ws.carType,
						is_local: false
					});
				}
			}

			return;
		}
	});

	// =========================================================
	// DISCONNECT
	// =========================================================
	ws.on("close", () => {

		if (!ws.roomId || !rooms[ws.roomId]) return;

		let room = rooms[ws.roomId];

		room.players = room.players.filter(p => p !== ws);

		if (room.players.length === 0) {
			delete rooms[ws.roomId];
			console.log("[SERVER] Room deleted:", ws.roomId);
		}
	});
});

console.log("[SERVER] Running...");
