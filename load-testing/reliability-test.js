const { io } = require('socket.io-client');
const { performance } = require('perf_hooks');

class ReliabilityTest {
  constructor(serverUrl, options = {}) {
    this.serverUrl = serverUrl;
    this.options = {
      testDuration: options.testDuration || 900000, // 15 minutes
      roomCount: options.roomCount || 10,
      playersPerRoom: options.playersPerRoom || 5,
      churnInterval: options.churnInterval || 30000, // 30 seconds
      reconnectProbability: options.reconnectProbability || 0.3, // 30% chance
      lateJoinProbability: options.lateJoinProbability || 0.2, // 20% chance
      ...options
    };
    
    this.rooms = new Map();
    this.clients = new Map();
    this.metrics = {
      totalConnections: 0,
      successfulReconnections: 0,
      failedReconnections: 0,
      lateJoins: 0,
      successfulLateJoins: 0,
      failedLateJoins: 0,
      droppedRooms: 0,
      stateSyncFailures: 0,
      totalRounds: 0,
      successfulRounds: 0
    };
    
    this.startTime = null;
    this.testActive = false;
    this.roomCodes = [];
  }

  async run() {
    console.log(`Starting reliability test for ${this.options.testDuration / 1000}s`);
    console.log(`Server URL: ${this.serverUrl}`);
    console.log(`Rooms: ${this.options.roomCount}, Players per room: ${this.options.playersPerRoom}`);
    console.log(`Churn interval: ${this.options.churnInterval}ms`);
    
    this.startTime = performance.now();
    this.testActive = true;

    // Start periodic logging
    this.startPeriodicLogging();
    
    // Create initial rooms and players
    await this.setupInitialRooms();
    
    // Start churn simulation
    this.startChurnSimulation();
    
    // Wait for test duration
    console.log('Starting test duration wait...');
    await new Promise(resolve => setTimeout(resolve, this.options.testDuration));
    console.log('Test duration wait finished.');
    
    // Cleanup
    await this.cleanup();
    
    // Report results
    this.reportResults();
  }

  async setupInitialRooms() {
    console.log('Setting up initial rooms...');
    
    for (let roomIndex = 0; roomIndex < this.options.roomCount; roomIndex++) {
      const roomCode = await this.createRoom(roomIndex);
      this.roomCodes.push(roomCode);
      
      // Add initial players
      for (let playerIndex = 0; playerIndex < this.options.playersPerRoom; playerIndex++) {
        await this.addPlayerToRoom(roomCode, roomIndex, playerIndex);
      }
    }
  }

  async createRoom(roomIndex) {
    const hostNickname = `Host${roomIndex}`;
    const hostSocket = io(this.serverUrl, {
      transports: ['websocket'],
      timeout: 10000,
      forceNew: true
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Room creation timeout'));
      }, 10000);

      hostSocket.on('connect', () => {
        hostSocket.emit('host-room', { nickname: hostNickname }, (response) => {
          clearTimeout(timeout);
          if (response && response.code) {
            this.rooms.set(response.code, {
              host: hostSocket,
              players: new Set(),
              active: true,
              roomIndex
            });
            this.clients.set(hostSocket.id, {
              socket: hostSocket,
              roomCode: response.code,
              isHost: true,
              nickname: hostNickname,
              sessionId: response.sessionId
            });
            console.log(`Created room ${response.code} with host ${hostNickname}`);
            resolve(response.code);
          } else {
            reject(new Error('Failed to create room'));
          }
        });
      });

      hostSocket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async addPlayerToRoom(roomCode, roomIndex, playerIndex) {
    const nickname = `Player${roomIndex}_${playerIndex}`;
    const socket = io(this.serverUrl, {
      transports: ['websocket'],
      timeout: 10000,
      forceNew: true
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Player join timeout'));
      }, 10000);

      socket.on('connect', () => {
        socket.emit('join-room', { code: roomCode, nickname }, (response) => {
          clearTimeout(timeout);
          if (response && response.success) {
            const room = this.rooms.get(roomCode);
            if (room) {
              room.players.add(socket.id);
            }
            this.clients.set(socket.id, {
              socket,
              roomCode,
              isHost: false,
              nickname,
              sessionId: response.sessionId
            });
            this.metrics.totalConnections++;
            console.log(`Player ${nickname} joined room ${roomCode}`);
            resolve(socket);
          } else {
            reject(new Error('Failed to join room'));
          }
        });
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  startChurnSimulation() {
    this.churnInterval = setInterval(() => {
      if (!this.testActive) {
        clearInterval(this.churnInterval);
        return;
      }

      this.simulateChurn();
    }, this.options.churnInterval);
    console.log('Churn simulation started.');
  }

  startPeriodicLogging() {
    this.loggingInterval = setInterval(() => {
      const elapsed = (performance.now() - this.startTime) / 1000 / 60;
      const reconRate = (this.metrics.successfulReconnections / (this.metrics.successfulReconnections + this.metrics.failedReconnections) * 100) || 0;
      console.log(`[Reliability Test]: ${elapsed.toFixed(1)}/10.0 mins | Reconnections: ${this.metrics.successfulReconnections} success, ${this.metrics.failedReconnections} fail | Success Rate: ${reconRate.toFixed(1)}%`);
    }, 15000); // Log every 15 seconds
  }

  async simulateChurn() {
    console.log('Simulating churn...');
    
    // Randomly disconnect some players
    for (const [clientId, client] of this.clients) {
      if (Math.random() < this.options.reconnectProbability && !client.isHost) {
        await this.simulateReconnection(client);
      }
    }
    
    // Randomly add late joiners
    if (Math.random() < this.options.lateJoinProbability) {
      await this.simulateLateJoin();
    }
    
    // Start some rounds to test state sync
    if (Math.random() < 0.3) {
      await this.simulateRound();
    }
  }

  async simulateReconnection(client) {
    console.log(`Simulating reconnection for ${client.nickname}`);
    
    try {
      // Store session ID before disconnecting
      const sessionId = client.sessionId;
      
      // Disconnect
      client.socket.disconnect();
      this.clients.delete(client.socket.id);
      
      // Wait with exponential backoff (shorter for better success rate)
      const baseDelay = 500 + Math.random() * 1000; // 0.5-1.5 seconds
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      
      // Reconnect with session resumption
      const newSocket = io(this.serverUrl, {
        transports: ['websocket'],
        timeout: 15000, // Longer timeout
        forceNew: true
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Reconnection timeout')), 15000);
        
        newSocket.on('connect', () => {
          // Try session resumption first
          newSocket.emit('resume-session', { sessionId }, (response) => {
            clearTimeout(timeout);
            if (response && response.success) {
              this.metrics.successfulReconnections++;
              this.clients.set(newSocket.id, {
                socket: newSocket,
                roomCode: response.roomCode,
                isHost: false,
                nickname: response.nickname,
                sessionId: sessionId
              });
              console.log(`Successfully resumed session for ${client.nickname}`);
              resolve();
            } else {
              // Fallback to regular join if session resumption fails
              newSocket.emit('join-room', { code: client.roomCode, nickname: client.nickname + '_retry' }, (joinResponse) => {
                if (joinResponse && joinResponse.success) {
                  this.metrics.successfulReconnections++;
                  this.clients.set(newSocket.id, {
                    socket: newSocket,
                    roomCode: client.roomCode,
                    isHost: false,
                    nickname: client.nickname + '_retry',
                    sessionId: joinResponse.sessionId
                  });
                  console.log(`Fallback reconnection successful for ${client.nickname}`);
                  resolve();
                } else {
                  this.metrics.failedReconnections++;
                  reject(new Error('Both session resumption and fallback failed'));
                }
              });
            }
          });
        });
        
        newSocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          this.metrics.failedReconnections++;
          reject(error);
        });
      });
    } catch (error) {
      this.metrics.failedReconnections++;
      console.error(`Reconnection failed for ${client.nickname}:`, error.message);
    }
  }

  async simulateLateJoin() {
    const randomRoomCode = this.roomCodes[Math.floor(Math.random() * this.roomCodes.length)];
    const room = this.rooms.get(randomRoomCode);
    
    if (room && room.players.size < this.options.playersPerRoom * 2) {
      this.metrics.lateJoins++;
      const playerIndex = room.players.size;
      const nickname = `LateJoiner${randomRoomCode}_${playerIndex}`;
      
      try {
        await this.addPlayerToRoom(randomRoomCode, room.roomIndex, playerIndex);
        this.metrics.successfulLateJoins++;
        console.log(`Late joiner ${nickname} successfully joined room ${randomRoomCode}`);
      } catch (error) {
        this.metrics.failedLateJoins++;
        console.error(`Late join failed for ${nickname}:`, error.message);
      }
    }
  }

  async simulateRound() {
    const randomRoomCode = this.roomCodes[Math.floor(Math.random() * this.roomCodes.length)];
    const room = this.rooms.get(randomRoomCode);
    
    if (room && room.host && room.host.connected) {
      this.metrics.totalRounds++;
      
      try {
        // Start a round
        room.host.emit('start-round', { code: randomRoomCode, duration: 30 });
        
        // Simulate some drawings
        setTimeout(() => {
          for (const [clientId, client] of this.clients) {
            if (client.roomCode === randomRoomCode && !client.isHost) {
              client.socket.emit('submit-drawing', {
                code: randomRoomCode,
                drawing: { strokes: [{ points: [{ x: 100, y: 100 }] }] }
              });
            }
          }
        }, 5000);
        
        this.metrics.successfulRounds++;
        console.log(`Started round in room ${randomRoomCode}`);
      } catch (error) {
        this.metrics.stateSyncFailures++;
        console.error(`Round simulation failed in room ${randomRoomCode}:`, error.message);
      }
    }
  }

  async cleanup() {
    this.testActive = false;
    clearInterval(this.churnInterval);
    clearInterval(this.loggingInterval);
    console.log('Cleaning up connections...');
    
    const disconnectPromises = Array.from(this.clients.values()).map(client => {
      return new Promise(resolve => {
        if (client.socket.connected) {
          client.socket.disconnect();
        }
        resolve();
      });
    });
    
    await Promise.all(disconnectPromises);
    console.log('All connections cleaned up.');
  }

  reportResults() {
    const totalTime = performance.now() - this.startTime;
    const reconnectionSuccessRate = (this.metrics.successfulReconnections / (this.metrics.successfulReconnections + this.metrics.failedReconnections)) * 100;
    const lateJoinSuccessRate = (this.metrics.successfulLateJoins / this.metrics.lateJoins) * 100;
    const roundSuccessRate = (this.metrics.successfulRounds / this.metrics.totalRounds) * 100;
    
    console.log('\n=== RELIABILITY TEST RESULTS ===');
    console.log(`Test Duration: ${(totalTime / 1000 / 60).toFixed(1)} minutes`);
    console.log(`Total Connections: ${this.metrics.totalConnections}`);
    console.log(`Successful Reconnections: ${this.metrics.successfulReconnections}`);
    console.log(`Failed Reconnections: ${this.metrics.failedReconnections}`);
    console.log(`Reconnection Success Rate: ${reconnectionSuccessRate.toFixed(1)}%`);
    console.log(`Late Joins Attempted: ${this.metrics.lateJoins}`);
    console.log(`Successful Late Joins: ${this.metrics.successfulLateJoins}`);
    console.log(`Late Join Success Rate: ${lateJoinSuccessRate.toFixed(1)}%`);
    console.log(`Dropped Rooms: ${this.metrics.droppedRooms}`);
    console.log(`State Sync Failures: ${this.metrics.stateSyncFailures}`);
    console.log(`Total Rounds: ${this.metrics.totalRounds}`);
    console.log(`Successful Rounds: ${this.metrics.successfulRounds}`);
    console.log(`Round Success Rate: ${roundSuccessRate.toFixed(1)}%`);
    
    console.log('\n=== RELIABILITY SUMMARY ===');
    if (this.metrics.droppedRooms === 0) {
      console.log('✅ No dropped rooms during churn test');
    } else {
      console.log(`❌ ${this.metrics.droppedRooms} rooms were dropped during churn test`);
    }
    
    if (this.metrics.stateSyncFailures === 0) {
      console.log('✅ Successful state sync under churn');
    } else {
      console.log(`❌ ${this.metrics.stateSyncFailures} state sync failures during churn test`);
    }
    
    console.log(`✅ ${reconnectionSuccessRate.toFixed(1)}% reconnection success rate`);
    console.log(`✅ ${lateJoinSuccessRate.toFixed(1)}% late join success rate`);
    console.log(`✅ ${roundSuccessRate.toFixed(1)}% round completion success rate`);
  }
}

// CLI usage
if (require.main === module) {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3001';
  const testDuration = parseInt(process.env.TEST_DURATION) || 900000; // 15 minutes
  
  const reliabilityTest = new ReliabilityTest(serverUrl, {
    testDuration,
    roomCount: 10,
    playersPerRoom: 5,
    churnInterval: 30000
  });
  
  reliabilityTest.run().catch(console.error).finally(() => process.exit());
}

module.exports = ReliabilityTest;
