const WebSocket = require("ws");

const server = new WebSocket.Server({
	port: process.env.PORT || 10000
});

const rooms = {};

// =========================================================
function send(ws, data) {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(data));
	}
}

// =========================================================
server.on("connection", (ws) => {

	ws.roomId = null;
	ws.carType = null;
	ws.playerId = null;
	ws.upgrades = null;

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

			// 🧠 STORE PLAYER UPGRADES (from config file sent by client)
			ws.upgrades = data.stats || {
				engine_power: 1400,
				brake_power: 60,
				max_rpm: 8000,
				weight: 1200
			};

			if (!rooms[ws.roomId]) {
				rooms[ws.roomId] = {
					scene: ws.scene,
					players: [],
					race_started: false
				};
			}

			const room = rooms[ws.roomId];

			room.players.push(ws);
			ws.playerId = "p" + room.players.length;

			console.log("================================");
			console.log("[SERVER] Player:", ws.playerId);
			console.log("[SERVER] Car:", ws.carType);
			console.log("[SERVER] Room:", ws.roomId);
			console.log("[SERVER] Upgrades:", ws.upgrades);
			console.log("================================");

			// =====================================================
			// ROOM JOIN CONFIRM
			// =====================================================
			send(ws, {
				type: "room_joined",
				roomId: ws.roomId,
				scene: ws.scene
			});

			// =====================================================
			// STORE SPAWN DATA
			// =====================================================
			ws.spawnData = {
				player_id: ws.playerId,
				car_type: ws.carType
			};

			// =====================================================
			// SPAWN SYNC (existing system unchanged)
			// =====================================================
			for (let other of room.players) {
				if (other !== ws && other.spawnData) {

					// send new player to others
					send(other, {
						type: "spawn",
						player_id: ws.playerId,
						car_type: ws.carType,
						is_local: false
					});

					// send existing to new
					send(ws, {
						type: "spawn",
						player_id: other.playerId,
						car_type: other.carType,
						is_local: false
					});
				}
			}

			// spawn self
			send(ws, {
				type: "spawn",
				player_id: ws.playerId,
				car_type: ws.carType,
				is_local: true
			});

			// =====================================================
			// 🚀 AUTO START RACE WHEN 2 PLAYERS
			// =====================================================
			if (room.players.length === 2 && !room.race_started) {

				room.race_started = true;

				const p1 = room.players[0];
				const p2 = room.players[1];

				// =================================================
				// 🏁 RACE SNAPSHOT (THE IMPORTANT PART)
				// =================================================

				const snapshot = {
					type: "race_start",
					p1: {
						player_id: p1.playerId,
						stats: p1.upgrades
					},
					p2: {
						player_id: p2.playerId,
						stats: p2.upgrades
					}
				};

				// send to both players
				send(p1, snapshot);
				send(p2, snapshot);

				console.log("🏁 Race started with snapshot");
			}

			return;
		}

		// =========================================================
		// CAR SYNC
		// =========================================================
		if (data.type === "car_sync") {

			const room = rooms[ws.roomId];
			if (!room) return;

			for (let player of room.players) {

				if (player !== ws) {
					send(player, {
						type: "car_sync",
						player_id: ws.playerId,
						pos: data.pos,
						rot: data.rot
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
