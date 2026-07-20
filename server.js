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
	ws.spawnData = null;


	ws.on("message", (msg) => {

		let data;

		try {
			data = JSON.parse(msg);
		} 
		catch {
			return;
		}


		// =====================================================
		// CREATE / JOIN ROOM
		// =====================================================
		if (data.type === "create_or_join") {


			ws.roomId = data.roomId;
			ws.carType = data.car_id || "";


			// ================================================
			// CREATE ROOM IF IT DOES NOT EXIST
			// ================================================
			if (!rooms[ws.roomId]) {

				rooms[ws.roomId] = {
					scene: data.scene,
					players: [],
					race_started: false
				};

				console.log("[SERVER] Created room:", ws.roomId);
			}


			const room = rooms[ws.roomId];


			// ================================================
			// ROOM FULL CHECK
			// ================================================
			if (room.players.length >= 2) {

				send(ws, {
					type: "room_full"
				});

				console.log("[SERVER] Room full:", ws.roomId);

				return;
			}


			// ================================================
			// USE ROOM OWNER'S SCENE
			// ================================================
			ws.scene = room.scene;



			// ================================================
			// STORE PLAYER UPGRADES
			// ================================================
			ws.upgrades = data.stats || {

				engine_power: 1400,
				brake_power: 60,
				max_rpm: 8000,
				weight: 1200

			};



			room.players.push(ws);

			ws.playerId = "p" + room.players.length;



			console.log("================================");
			console.log("[SERVER] Player:", ws.playerId);
			console.log("[SERVER] Car:", ws.carType);
			console.log("[SERVER] Room:", ws.roomId);
			console.log("[SERVER] Scene:", ws.scene);
			console.log("[SERVER] Upgrades:", ws.upgrades);
			console.log("================================");



			// ================================================
			// CONFIRM JOIN
			// ================================================
			send(ws, {

				type: "room_joined",
				roomId: ws.roomId,
				scene: ws.scene

			});



			// ================================================
			// SAVE SPAWN DATA
			// ================================================
			ws.spawnData = {

				player_id: ws.playerId,
				car_type: ws.carType

			};



			// ================================================
			// SYNC EXISTING PLAYERS
			// ================================================
			for (let other of room.players) {

				if (other !== ws && other.spawnData) {


					// send new player to old player
					send(other, {

						type: "spawn",
						player_id: ws.playerId,
						car_type: ws.carType,
						is_local: false

					});


					// send old player to new player
					send(ws, {

						type: "spawn",
						player_id: other.playerId,
						car_type: other.carType,
						is_local: false

					});
				}
			}



			// ================================================
			// SPAWN LOCAL PLAYER
			// ================================================
			send(ws, {

				type: "spawn",
				player_id: ws.playerId,
				car_type: ws.carType,
				is_local: true

			});




			// ================================================
			// START RACE WHEN 2 PLAYERS
			// ================================================
			if (
				room.players.length === 2 &&
				!room.race_started
			) {


				room.race_started = true;


				const p1 = room.players[0];
				const p2 = room.players[1];



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



				send(p1, snapshot);
				send(p2, snapshot);


				console.log("🏁 Race started");

			}


			return;
		}



		// =====================================================
		// CAR SYNC
		// =====================================================
		if (data.type === "car_sync") {


			const room = rooms[ws.roomId];

			if (!room)
				return;



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



	// =====================================================
	// DISCONNECT
	// =====================================================
	ws.on("close", () => {


		if (!ws.roomId)
			return;


		const room = rooms[ws.roomId];


		if (!room)
			return;



		room.players =
			room.players.filter(
				p => p !== ws
			);



		console.log(
			"[SERVER] Player left:",
			ws.playerId
		);



		if (room.players.length === 0) {

			delete rooms[ws.roomId];

			console.log(
				"[SERVER] Deleted room:",
				ws.roomId
			);
		}

	});

});


console.log("[SERVER] Running...");
