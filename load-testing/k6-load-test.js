import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const socketConnectTime = new Trend('socket_connect_time');
const roundTripTime = new Trend('round_trip_time');
const successfulConnections = new Counter('successful_connections');
const failedConnections = new Counter('failed_connections');
const messageLatency = new Trend('message_latency');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 200 },   // Ramp up to 200 users
    { duration: '2m', target: 200 },   // Stay at 200 users
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests must complete below 500ms
    'socket_connect_time': ['p(95)<1000'], // 95% of socket connections must complete below 1s
    'round_trip_time': ['p(95)<200'], // 95% of round trips must complete below 200ms
    'failed_connections': ['rate<0.1'], // Less than 10% connection failures
  },
};

const BASE_URL = __ENV.SERVER_URL || 'http://localhost:3001';

export default function () {
  const userId = __VU;
  const nickname = `TestUser${userId}`;
  
  // Test basic HTTP endpoint
  const healthCheck = http.get(`${BASE_URL}/`);
  check(healthCheck, {
    'health check status is 200': (r) => r.status === 200,
  });

  // Simulate WebSocket connection via HTTP upgrade
  const startTime = Date.now();
  
  // Create room
  const createRoomPayload = JSON.stringify({ nickname });
  const createRoomResponse = http.post(`${BASE_URL}/socket.io/`, createRoomPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (createRoomResponse.status === 200) {
    successfulConnections.add(1);
    socketConnectTime.add(Date.now() - startTime);
    
    // Simulate round-trip time for a message
    const messageStart = Date.now();
    const messagePayload = JSON.stringify({
      type: 'chat-message',
      data: { text: 'Test message', nickname, time: Date.now() }
    });
    
    const messageResponse = http.post(`${BASE_URL}/socket.io/`, messagePayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (messageResponse.status === 200) {
      messageLatency.add(Date.now() - messageStart);
      roundTripTime.add(Date.now() - startTime);
    }
  } else {
    failedConnections.add(1);
  }

  sleep(1);
}
