const WebSocket = require("ws");

const server = new WebSocket.Server({
	port: process.env.PORT || 10000
});

// =========================
// ROOMS
// =========================
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
	ws.displayName = "Guest";
	ws.scene = null;

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
			ws.scene = data.scene;

			// ✅ FIX: correct field from client
			ws.carType = data.car_id;

			if (!ws.roomId) return;

			// create room if missing
			if (!rooms[ws.roomId]) {
				rooms[ws.roomId] = {
					scene: ws.scene,
					players: new Set()
				};
			}

			rooms[ws.roomId].players.add(ws);

			console.log("[SERVER] ROOM JOIN:", ws.roomId);
			console.log("[SERVER] SCENE:", ws.scene);
			console.log("[SERVER] CAR RECEIVED:", ws.carType);

			// send confirmation
			send(ws, {
				type: "room_joined",
				roomId: ws.roomId,
				scene: ws.scene,
				car_type: ws.carType
			});

			return;
		}

		// =========================================================
		// SET IDENTITY (optional future use)
		// =========================================================
		if (data.type === "set_identity") {
			ws.playerId = data.data.player_id;
			ws.displayName = data.data.display_name;
			return;
		}
	});

	// =========================================================
	// DISCONNECT
	// =========================================================
	ws.on("close", () => {

		if (!ws.roomId || !rooms[ws.roomId]) return;

		rooms[ws.roomId].players.delete(ws);

		if (rooms[ws.roomId].players.size === 0) {
			delete rooms[ws.roomId];
			console.log("[SERVER] Deleted empty room:", ws.roomId);
		}
	});
});

console.log("[SERVER] Running...");
