const { io } = require('socket.io-client');

async function quickTest() {
  console.log('🚀 Quick Performance Test');
  console.log('Testing basic connection and latency...');
  
  const serverUrl = 'http://localhost:3001';
  const results = {
    connections: 0,
    failed: 0,
    latencies: []
  };
  
  // Test 3 connections
  for (let i = 0; i < 3; i++) {
    try {
      console.log(`Testing connection ${i + 1}/3...`);
      
      const start = Date.now();
      const socket = io(serverUrl, {
        transports: ['websocket'],
        timeout: 5000
      });
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        
        socket.on('connect', () => {
          clearTimeout(timeout);
          const latency = Date.now() - start;
          results.latencies.push(latency);
          results.connections++;
          console.log(`✅ Connection ${i + 1} successful (${latency}ms)`);
          
          // Send one test message
          socket.emit('chat-message', { 
            code: 'TEST', 
            text: 'Test message', 
            nickname: 'Tester', 
            time: Date.now() 
          });
          
          setTimeout(() => {
            socket.disconnect();
            resolve();
          }, 1000);
        });
        
        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
    } catch (error) {
      results.failed++;
      console.log(`❌ Connection ${i + 1} failed: ${error.message}`);
    }
  }
  
  // Report results
  console.log('\n�� Quick Test Results:');
  console.log(`✅ Successful connections: ${results.connections}/3`);
  console.log(`❌ Failed connections: ${results.failed}`);
  
  if (results.latencies.length > 0) {
    const avgLatency = results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length;
    console.log(`⚡ Average latency: ${Math.round(avgLatency)}ms`);
  }
  
  console.log('\n🎉 Quick test completed!');
}

quickTest().catch(console.error);