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

function broadcast(roomId, data, excludeWs = null) {
	if (!rooms[roomId]) return;

	for (const client of rooms[roomId].players) {
		if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify(data));
		}
	}
}

// =========================
// CONNECTION
// =========================
server.on("connection", (ws) => {
	ws.roomId = null;

	// NEW PLAYER DATA (IMPORTANT)
	ws.playerId = null;
	ws.displayName = "Guest";
	ws.carType = null;

	ws.on("message", (msg) => {
		let data;

		try {
			data = JSON.parse(msg);
		} catch {
			return;
		}

		// =====================================
		// SET IDENTITY
		// =====================================
		if (data.type === "set_identity") {
			ws.playerId = data.data.player_id;
			ws.displayName = data.data.display_name;
			return;
		}

		// =====================================
		// SET CAR (CAMERA SYSTEM)
		// =====================================
		if (data.type === "set_car_from_camera") {
			ws.carType = data.car_id;
			return;
		}

		// =====================================
		// CREATE OR JOIN ROOM
		// =====================================
		if (data.type === "create_or_join") {
			const roomId = data.roomId;
			const scene = data.scene;

			if (!roomId) return;

			// create room if not exists
			if (!rooms[roomId]) {
				rooms[roomId] = {
					scene: scene,
					players: new Set()
				};
			}

			rooms[roomId].players.add(ws);
			ws.roomId = roomId;

			// =========================
			// SEND SELF DATA
			// =========================
			send(ws, {
				type: "room_joined",
				roomId: roomId,
				scene: rooms[roomId].scene,
				player_id: ws.playerId,
				display_name: ws.displayName,
				car_type: ws.carType
			});

			// =========================
			// NOTIFY OTHERS
			// =========================
			broadcast(roomId, {
				type: "player_joined",
				player_id: ws.playerId,
				display_name: ws.displayName,
				car_type: ws.carType
			}, ws);

			console.log(
				`[SERVER] ${ws.displayName} joined ${roomId} with ${ws.carType}`
			);
		}
	});

	// =====================================
	// DISCONNECT
	// =====================================
	ws.on("close", () => {
		const roomId = ws.roomId;

		if (!roomId || !rooms[roomId]) return;

		rooms[roomId].players.delete(ws);

		// notify others
		broadcast(roomId, {
			type: "player_left",
			player_id: ws.playerId
		});

		// delete empty room
		if (rooms[roomId].players.size === 0) {
			delete rooms[roomId];
			console.log(`[SERVER] Deleted room ${roomId}`);
		}
	});
});

console.log("[SERVER] Running on port", process.env.PORT || 10000);
