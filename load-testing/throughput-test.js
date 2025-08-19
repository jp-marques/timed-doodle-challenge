const { io } = require('socket.io-client');
const { performance } = require('perf_hooks');

class ThroughputTest {
  constructor(serverUrl, options = {}) {
    this.serverUrl = serverUrl;
    this.options = {
      testDuration: parseInt(process.env.TEST_DURATION) || options.testDuration || 600000,
      roomCount: parseInt(process.env.ROOM_COUNT) || options.roomCount || 10,
      playersPerRoom: parseInt(process.env.PLAYERS_PER_ROOM) || options.playersPerRoom || 8,
      eventsPerSecond: parseInt(process.env.EVENTS_PER_SECOND) || options.eventsPerSecond || 5,
      ...options
    };

    this.clients = new Map();
    this.metrics = {
      totalEventsSent: 0,
      successfulEvents: 0,
      failedEvents: 0,
      latencies: []
    };

    this.testActive = false;
  }

  async run() {
    console.log(`Starting throughput test for ${this.options.testDuration / 1000}s`);
    this.startTime = performance.now();
    this.testActive = true;

    this.startPeriodicLogging();
    await this.setupRooms();
    this.startWorkload();

    await new Promise(resolve => setTimeout(resolve, this.options.testDuration));

    await this.cleanup();
    this.reportResults();
  }

  async setupRooms() {
    console.log(`Setting up ${this.options.roomCount} rooms with ${this.options.playersPerRoom} players each...`);
    
    for (let i = 0; i < this.options.roomCount; i++) {
      // Create a host for each room
      const hostNickname = `Host_${i}`;
      const hostSocket = io(this.serverUrl, { transports: ['websocket'], forceNew: true });
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Host connection timeout')), 10000);
        
        hostSocket.on('connect', () => {
          hostSocket.emit('host-room', { nickname: hostNickname }, (response) => {
            clearTimeout(timeout);
            if (response && response.code) {
              this.clients.set(hostSocket.id, { 
                socket: hostSocket, 
                roomCode: response.code, 
                nickname: hostNickname, 
                isHost: true 
              });
              
              // Add players to this room
              const playerPromises = [];
              for (let j = 0; j < this.options.playersPerRoom; j++) {
                const nickname = `Player_${i}_${j}`;
                const playerSocket = io(this.serverUrl, { transports: ['websocket'], forceNew: true });
                
                const playerPromise = new Promise((resolvePlayer, rejectPlayer) => {
                  const playerTimeout = setTimeout(() => rejectPlayer(new Error('Player connection timeout')), 10000);
                  
                  playerSocket.on('connect', () => {
                    playerSocket.emit('join-room', { code: response.code, nickname }, (joinResponse) => {
                      clearTimeout(playerTimeout);
                      if (joinResponse && joinResponse.success) {
                        this.clients.set(playerSocket.id, { 
                          socket: playerSocket, 
                          roomCode: response.code, 
                          nickname,
                          isHost: false 
                        });
                        resolvePlayer();
                      } else {
                        rejectPlayer(new Error('Failed to join room'));
                      }
                    });
                  });
                  
                  playerSocket.on('connect_error', (error) => {
                    clearTimeout(playerTimeout);
                    rejectPlayer(error);
                  });
                });
                
                playerPromises.push(playerPromise);
              }
              
              Promise.all(playerPromises).then(() => {
                console.log(`Room ${response.code} set up with ${this.options.playersPerRoom} players`);
                resolve();
              }).catch(reject);
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
    
    console.log(`✅ Setup complete: ${this.clients.size} total connections`);
  }

  startWorkload() {
    const intervalMs = 1000 / this.options.eventsPerSecond;
    console.log(`Starting workload: ${this.options.eventsPerSecond} events/sec per client (${intervalMs}ms interval)`);
    
    this.clients.forEach(client => {
      if (!client.isHost) { // Only players send events, not hosts
        const clientInterval = setInterval(() => {
          if (!this.testActive) {
            clearInterval(clientInterval);
            return;
          }
          
          const start = performance.now();
          const drawing = {
            strokes: [{
              points: [
                { x: Math.random() * 800, y: Math.random() * 600 },
                { x: Math.random() * 800, y: Math.random() * 600 }
              ]
            }]
          };
          
          client.socket.emit('submit-drawing', { 
            code: client.roomCode, 
            drawing 
          }, (response) => {
            const latency = performance.now() - start;
            this.metrics.latencies.push(latency);
            this.metrics.successfulEvents++;
            
            if (response && response.error) {
              this.metrics.failedEvents++;
            }
          });
          
          this.metrics.totalEventsSent++;
        }, intervalMs);
      }
    });
  }

  startPeriodicLogging() {
    this.loggingInterval = setInterval(() => {
      const elapsed = (performance.now() - this.startTime) / 1000 / 60;
      const p95 = this.percentile(this.metrics.latencies, 95);
      const eventsPerSecond = this.metrics.successfulEvents / (elapsed * 60);
      console.log(`[Throughput Test]: ${elapsed.toFixed(1)}/15.0 mins | ~${eventsPerSecond.toFixed(0)} events/sec | P95 Latency: ${p95.toFixed(2)}ms`);
    }, 15000); // Log every 15 seconds
  }

  async cleanup() {
    this.testActive = false;
    clearInterval(this.loggingInterval);
    this.clients.forEach(client => client.socket.disconnect());
  }

  reportResults() {
    const { totalEventsSent, successfulEvents, latencies } = this.metrics;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;
    const p95 = this.percentile(latencies, 95);
    console.log('Throughput Test Results:');
    console.log(`Total Events Sent: ${totalEventsSent}`);
    console.log(`Successful Events: ${successfulEvents}`);
    console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`P95 Latency: ${p95.toFixed(2)}ms`);
  }

  percentile(arr, p) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }
}

if (require.main === module) {
  const test = new ThroughputTest('http://localhost:3001');
  test.run().catch(console.error).finally(() => process.exit());
}

module.exports = ThroughputTest;
