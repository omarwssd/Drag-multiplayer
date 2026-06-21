const WebSocket = require("ws");

const server = new WebSocket.Server({
	port: process.env.PORT || 10000
});

const rooms = {};

// =========================================================
// SEND HELPER
// =========================================================
function send(ws, data) {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(data));
	}
}

// =========================================================
// CONNECTION
// =========================================================
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
			ws.carType = data.car_id || "";
			ws.scene = data.scene;

			if (ws.carType === "") {
				console.log("❌ REJECTED: empty car_id");
				return;
			}

			if (!rooms[ws.roomId]) {
				rooms[ws.roomId] = {
					scene: ws.scene,
					players: []
				};
			}

			const room = rooms[ws.roomId];

			room.players.push(ws);

			ws.playerId = "p" + room.players.length;

			console.log("================================");
			console.log("[SERVER] Player:", ws.playerId);
			console.log("[SERVER] Car:", ws.carType);
			console.log("[SERVER] Room:", ws.roomId);
			console.log("================================");

			// =========================================================
			// ROOM JOIN (NO CAR DATA)
			// =========================================================
			send(ws, {
				type: "room_joined",
				roomId: ws.roomId,
				scene: ws.scene
			});

			// =========================================================
			// STORE PLAYER DATA IN ROOM (IMPORTANT FIX)
			// =========================================================
			ws.spawnData = {
				player_id: ws.playerId,
				car_type: ws.carType
			};

			// =========================================================
			// SPAWN SELF
			// =========================================================
			send(ws, {
				type: "spawn",
				player_id: ws.playerId,
				car_type: ws.carType,
				is_local: true
			});

			// =========================================================
			// SPAWN OTHER PLAYERS
			// =========================================================
			for (let other of room.players) {
				if (other !== ws && other.spawnData) {

					send(other, {
						type: "spawn",
						player_id: ws.playerId,
						car_type: ws.carType,
						is_local: false
					});

					// ALSO send existing player back to new player
					send(ws, {
						type: "spawn",
						player_id: other.playerId,
						car_type: other.carType,
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
