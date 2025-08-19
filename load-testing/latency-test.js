const { io } = require('socket.io-client');
const { performance } = require('perf_hooks');

class LatencyTest {
  constructor(serverUrl, options = {}) {
    this.serverUrl = serverUrl;
    this.options = {
      testDuration: options.testDuration || 30000, // 30 seconds
      messageInterval: options.messageInterval || 1000, // 1 second
      ...options
    };
    
    this.metrics = {
      latencies: [],
      totalMessages: 0,
      successfulMessages: 0,
      failedMessages: 0
    };
    
    this.socket = null;
    this.testActive = false;
  }

  async run() {
    console.log(`Starting latency test for ${this.options.testDuration / 1000}s`);
    console.log(`Server URL: ${this.serverUrl}`);
    console.log(`Message interval: ${this.options.messageInterval}ms`);
    
    this.testActive = true;
    
    try {
      await this.connect();
      await this.startLatencyTest();
      await this.waitForCompletion();
      this.reportResults();
    } catch (error) {
      console.error('Latency test failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket'],
        timeout: 10000,
        forceNew: true
      });

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        console.log('Connected to server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async startLatencyTest() {
    // Create a test room first
    await this.createTestRoom();
    
    // Start sending ping messages
    const interval = setInterval(() => {
      if (!this.testActive) {
        clearInterval(interval);
        return;
      }
      
      this.sendPingMessage();
    }, this.options.messageInterval);
  }

  async createTestRoom() {
    return new Promise((resolve, reject) => {
      this.socket.emit('host-room', { nickname: 'LatencyTester' }, (response) => {
        if (response && response.code) {
          this.roomCode = response.code;
          console.log(`Created test room: ${this.roomCode}`);
          resolve();
        } else {
          reject(new Error('Failed to create test room'));
        }
      });
    });
  }

  sendPingMessage() {
    const startTime = performance.now();
    const message = {
      text: `Ping ${Date.now()}`,
      nickname: 'LatencyTester',
      time: Date.now()
    };

    this.socket.emit('chat-message', { code: this.roomCode, ...message }, (ack) => {
      const latency = performance.now() - startTime;
      this.metrics.latencies.push(latency);
      this.metrics.totalMessages++;
      
      if (ack && !ack.error) {
        this.metrics.successfulMessages++;
      } else {
        this.metrics.failedMessages++;
      }
    });
  }

  async waitForCompletion() {
    return new Promise(resolve => {
      setTimeout(() => {
        this.testActive = false;
        resolve();
      }, this.options.testDuration);
    });
  }

  async cleanup() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  reportResults() {
    if (this.metrics.latencies.length === 0) {
      console.log('No latency data collected');
      return;
    }

    const latencies = this.metrics.latencies;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50Latency = this.percentile(latencies, 50);
    const p95Latency = this.percentile(latencies, 95);
    const p99Latency = this.percentile(latencies, 99);
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    
    const successRate = (this.metrics.successfulMessages / this.metrics.totalMessages) * 100;
    
    console.log('\n=== LATENCY TEST RESULTS ===');
    console.log(`Test Duration: ${this.options.testDuration / 1000}s`);
    console.log(`Total Messages: ${this.metrics.totalMessages}`);
    console.log(`Successful Messages: ${this.metrics.successfulMessages}`);
    console.log(`Failed Messages: ${this.metrics.failedMessages}`);
    console.log(`Success Rate: ${successRate.toFixed(1)}%`);
    
    console.log('\n=== LATENCY STATISTICS ===');
    console.log(`Average: ${avgLatency.toFixed(2)}ms`);
    console.log(`Median (P50): ${p50Latency.toFixed(2)}ms`);
    console.log(`P95: ${p95Latency.toFixed(2)}ms`);
    console.log(`P99: ${p99Latency.toFixed(2)}ms`);
    console.log(`Min: ${minLatency.toFixed(2)}ms`);
    console.log(`Max: ${maxLatency.toFixed(2)}ms`);
    
    console.log('\n=== PERFORMANCE SUMMARY ===');
    if (avgLatency < 50) {
      console.log(`✅ ~${Math.round(avgLatency)}ms median latency (excellent)`);
    } else if (avgLatency < 100) {
      console.log(`✅ ~${Math.round(avgLatency)}ms median latency (good)`);
    } else {
      console.log(`⚠️ ~${Math.round(avgLatency)}ms median latency (consider optimization)`);
    }
    
    if (p95Latency < 100) {
      console.log(`✅ P95 latency ${p95Latency.toFixed(0)}ms (excellent)`);
    } else if (p95Latency < 200) {
      console.log(`✅ P95 latency ${p95Latency.toFixed(0)}ms (good)`);
    } else {
      console.log(`⚠️ P95 latency ${p95Latency.toFixed(0)}ms (consider optimization)`);
    }
    
    if (successRate >= 99) {
      console.log(`✅ ${successRate.toFixed(1)}% message delivery success rate (excellent)`);
    } else if (successRate >= 95) {
      console.log(`✅ ${successRate.toFixed(1)}% message delivery success rate (good)`);
    } else {
      console.log(`⚠️ ${successRate.toFixed(1)}% message delivery success rate (needs attention)`);
    }
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
  const testDuration = parseInt(process.env.TEST_DURATION) || 30000;
  
  const latencyTest = new LatencyTest(serverUrl, {
    testDuration,
    messageInterval: 1000
  });
  
  latencyTest.run().catch(console.error);
}

module.exports = LatencyTest;
