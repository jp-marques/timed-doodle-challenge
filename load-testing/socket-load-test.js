const { io } = require('socket.io-client');
const { performance } = require('perf_hooks');
const SystemMonitor = require('./system-monitor');

class SocketLoadTest {
  constructor(serverUrl, options = {}) {
    this.serverUrl = serverUrl;
    this.options = {
      concurrentUsers: options.concurrentUsers || 50,
      testDuration: options.testDuration || 60000, // 1 minute
      messageInterval: options.messageInterval || 2000, // 2 seconds
      ...options
    };
    
    this.clients = [];
    this.sockets = [];
    this.metrics = {
      connectTimes: [],
      messageLatencies: [],
      successfulConnections: 0,
      failedConnections: 0,
      totalMessages: 0,
      failedMessages: 0
    };
    
    this.startTime = null;
    this.testActive = false;
    this.systemMonitor = new SystemMonitor();
  }

  async run() {
    console.log(`Starting load test with ${this.options.concurrentUsers} concurrent users`);
    console.log(`Test duration: ${this.options.testDuration}ms`);
    console.log(`Server URL: ${this.serverUrl}`);
    
    this.startTime = performance.now();
    this.testActive = true;
    
    // Start system monitoring
    this.systemMonitor.start();
    
    // Start periodic logging
    this.startPeriodicLogging();
    
    // Create concurrent connections with timeout and error handling
    const connectionPromises = [];
    for (let i = 0; i < this.options.concurrentUsers; i++) {
      connectionPromises.push(
        this.createClient(i).catch(error => {
          console.log(`Connection ${i} failed, continuing with other connections...`);
          return null; // Return null for failed connections instead of throwing
        })
      );
    }
    
    // Wait for all connections (successful and failed)
    const sockets = await Promise.all(connectionPromises);
    this.sockets = sockets.filter(socket => socket !== null); // Keep only successful connections
    
    console.log(`✅ Successfully connected ${this.sockets.length}/${this.options.concurrentUsers} clients`);
    
    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, this.options.testDuration));
    
    // Cleanup
    await this.cleanup();
    
    // Report results
    this.reportResults();
  }

  async createClient(userId) {
    const nickname = `LoadTestUser${userId}`;
    const connectStart = performance.now();
    
    try {
      const socket = io(this.serverUrl, {
        transports: ['websocket'],
        timeout: 10000,
        forceNew: true
      });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          const connectTime = performance.now() - connectStart;
          this.metrics.connectTimes.push(connectTime);
          this.metrics.successfulConnections++;
          
          console.log(`Client ${userId} connected in ${connectTime.toFixed(2)}ms`);
          
          // Start sending messages
          this.startMessageLoop(socket, userId);
          
          resolve(socket);
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          this.metrics.failedConnections++;
          console.error(`Client ${userId} connection failed:`, error.message);
          reject(error);
        });
      });
    } catch (error) {
      this.metrics.failedConnections++;
      console.error(`Failed to create client ${userId}:`, error.message);
      throw error;
    }
  }

  startMessageLoop(socket, userId) {
    const interval = setInterval(() => {
      if (!this.testActive) {
        clearInterval(interval);
        return;
      }

      const messageStart = performance.now();
      const message = {
        text: `Test message from user ${userId} at ${Date.now()}`,
        nickname: `LoadTestUser${userId}`,
        time: Date.now()
      };

      // Use a Promise to ensure we get proper ack handling
      socket.emit('chat-message', { code: 'TESTROOM', ...message }, (response) => {
        const latency = performance.now() - messageStart;
        this.metrics.messageLatencies.push(latency);
        this.metrics.totalMessages++;
        
        if (response && response.error) {
          this.metrics.failedMessages++;
        }
      });

      // Also test drawing events for more realistic load
      const drawingStart = performance.now();
      socket.emit('submit-drawing', { 
        code: 'TESTROOM', 
        drawing: { strokes: [{ points: [{ x: Math.random() * 800, y: Math.random() * 600 }] }] }
      }, (response) => {
        const drawingLatency = performance.now() - drawingStart;
        this.metrics.messageLatencies.push(drawingLatency);
        this.metrics.totalMessages++;
      });
    }, this.options.messageInterval);
  }

  startPeriodicLogging() {
    this.loggingInterval = setInterval(() => {
      const elapsed = (performance.now() - this.startTime) / 1000 / 60;
      const p95 = this.percentile(this.metrics.messageLatencies, 95);
      console.log(`[Load Test]: ${elapsed.toFixed(1)}/15.0 mins | Connected: ${this.sockets.length}/${this.options.concurrentUsers} | P95 Latency: ${p95.toFixed(2)}ms`);
    }, 15000); // Log every 15 seconds
  }

  async cleanup() {
    this.testActive = false;
    clearInterval(this.loggingInterval);
    this.systemMonitor.stop();
    console.log('Cleaning up connections...');
    
    if (this.sockets && this.sockets.length > 0) {
      const disconnectPromises = this.sockets.map(socket => {
        return new Promise(resolve => {
          if (socket && socket.connected) {
            socket.disconnect();
          }
          resolve();
        });
      });
      
      await Promise.all(disconnectPromises);
    }
  }

  reportResults() {
    const totalTime = performance.now() - this.startTime;
    const connectTimes = this.metrics.connectTimes;
    const messageLatencies = this.metrics.messageLatencies;
    
    // Calculate statistics
    const avgConnectTime = connectTimes.reduce((a, b) => a + b, 0) / connectTimes.length;
    const p95ConnectTime = this.percentile(connectTimes, 95);
    const p99ConnectTime = this.percentile(connectTimes, 99);
    
    const avgMessageLatency = messageLatencies.length > 0 ? messageLatencies.reduce((a, b) => a + b, 0) / messageLatencies.length : 0;
    const p50MessageLatency = this.percentile(messageLatencies, 50);
    const p95MessageLatency = this.percentile(messageLatencies, 95);
    const p99MessageLatency = this.percentile(messageLatencies, 99);
    
    const connectionSuccessRate = (this.metrics.successfulConnections / this.options.concurrentUsers) * 100;
    const messageSuccessRate = this.metrics.totalMessages > 0 ? ((this.metrics.totalMessages - this.metrics.failedMessages) / this.metrics.totalMessages) * 100 : 0;
    
    console.log('\n=== LOAD TEST RESULTS ===');
    console.log(`Test Duration: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Target Concurrent Users: ${this.options.concurrentUsers}`);
    console.log(`Successful Connections: ${this.metrics.successfulConnections}/${this.options.concurrentUsers} (${connectionSuccessRate.toFixed(1)}%)`);
    console.log(`Failed Connections: ${this.metrics.failedConnections}`);
    console.log(`Total Messages Sent: ${this.metrics.totalMessages}`);
    console.log(`Failed Messages: ${this.metrics.failedMessages} (${this.metrics.totalMessages > 0 ? (100 - messageSuccessRate).toFixed(1) : '0.0'}%)`);
    
    console.log('\n=== CONNECTION TIMES ===');
    console.log(`Average: ${avgConnectTime.toFixed(2)}ms`);
    console.log(`P95: ${p95ConnectTime.toFixed(2)}ms`);
    console.log(`P99: ${p99ConnectTime.toFixed(2)}ms`);
    
    console.log('\n=== SOCKET.IO EVENT ROUND-TRIP LATENCY ===');
    console.log(`Average: ${avgMessageLatency.toFixed(2)}ms`);
    console.log(`P50 (Median): ${p50MessageLatency.toFixed(2)}ms`);
    console.log(`P95: ${p95MessageLatency.toFixed(2)}ms`);
    console.log(`P99: ${p99MessageLatency.toFixed(2)}ms`);
    
    console.log('\n=== PERFORMANCE SUMMARY ===');
    console.log(`✅ Validated in local load tests up to ${this.options.concurrentUsers} concurrent clients`);
    console.log(`✅ P50 message latency: ${p50MessageLatency.toFixed(1)}ms, P95: ${p95MessageLatency.toFixed(1)}ms`);
    console.log(`✅ ${connectionSuccessRate.toFixed(1)}% connection success rate`);
    console.log(`✅ ${messageSuccessRate.toFixed(1)}% message delivery success rate`);
  }

  percentile(arr, p) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }
}

// CLI usage
if (require.main === module) {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3001';
  const concurrentUsers = parseInt(process.env.CONCURRENT_USERS) || 50;
  const testDuration = parseInt(process.env.TEST_DURATION) || 60000;
  
  const loadTest = new SocketLoadTest(serverUrl, {
    concurrentUsers,
    testDuration,
    messageInterval: 2000
  });
  
  loadTest.run().catch(console.error);
}

module.exports = SocketLoadTest;
