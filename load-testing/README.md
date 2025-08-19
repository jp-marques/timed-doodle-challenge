# TimedDoodle Performance Testing Suite

This directory contains comprehensive load testing and performance validation tools for the TimedDoodle application.

## Quick Start

1. **Install dependencies:**
   ```bash
   cd load-testing
   npm install
   ```

2. **Start your server:**
   ```bash
   # In the server directory
   npm start
   ```

3. **Run all tests:**
   ```bash
   node run-all-tests.js
   ```

## Test Components

### 1. Load Testing (`socket-load-test.js`)
- Simulates 50-200 concurrent WebSocket connections
- Measures connection times and message latency
- Reports P95/P99 latency metrics
- **Usage:** `node socket-load-test.js`

### 2. Reliability Testing (`reliability-test.js`)
- Tests reconnection scenarios and late-join functionality
- Simulates network churn for 10-15 minutes
- Validates state synchronization under stress
- **Usage:** `node reliability-test.js`

### 3. Bundle Analysis (`bundle-analyzer.js`)
- Analyzes client bundle size and compression ratios
- Estimates Time to Interactive (TTI)
- Identifies largest assets
- **Usage:** `node bundle-analyzer.js`

### 4. K6 Load Testing (`k6-load-test.js`)
- HTTP-based load testing with k6
- Alternative to socket-based testing
- **Usage:** `k6 run k6-load-test.js` (requires k6 installation)

## Environment Variables

Configure test parameters using environment variables:

```bash
# Server configuration
SERVER_URL=http://localhost:3001

# Load test parameters
CONCURRENT_USERS=50
TEST_DURATION=60000  # 1 minute

# Reliability test parameters
ROOM_COUNT=10
PLAYERS_PER_ROOM=5
CHURN_INTERVAL=30000  # 30 seconds
```

## Expected Results

### Load Test Results
- **Connection Success Rate:** >95% for 50+ concurrent users
- **Message Latency:** <100ms median, <200ms P95
- **Connection Time:** <1s P95

### Reliability Test Results
- **Reconnection Success:** >90%
- **Late Join Success:** >95%
- **Dropped Rooms:** 0
- **State Sync Failures:** 0

### Bundle Analysis Results
- **Bundle Size:** <500KB (excellent), <1MB (good)
- **Gzipped Size:** <150KB (excellent), <300KB (good)
- **Estimated TTI:** <2s on 3G connection

## Performance Summary Format

The test suite generates reports in this format:

```
✅ BUNDLE SIZE: Bundle size 245KB (good)
✅ LOAD CAPACITY: Validated up to 50 concurrent clients (97.2% success rate)
✅ LATENCY: ~45ms median latency (excellent)
✅ RELIABILITY: No dropped rooms; successful state sync under churn
```

## Troubleshooting

### Common Issues

1. **Server not running:**
   ```bash
   # Start server first
   cd ../server && npm start
   ```

2. **Port conflicts:**
   ```bash
   # Use different port
   SERVER_URL=http://localhost:3002 node socket-load-test.js
   ```

3. **Memory issues with high concurrency:**
   ```bash
   # Reduce concurrent users
   CONCURRENT_USERS=20 node socket-load-test.js
   ```

4. **K6 not installed:**
   ```bash
   # Install k6 (macOS)
   brew install k6
   
   # Install k6 (Windows)
   choco install k6
   
   # Install k6 (Linux)
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

## Customization

### Adding Custom Metrics

Extend the test classes to add custom metrics:

```javascript
// In socket-load-test.js
this.metrics.customMetric = new Counter('custom_metric');
```

### Modifying Test Scenarios

Adjust test parameters in the constructor:

```javascript
const loadTest = new SocketLoadTest(serverUrl, {
  concurrentUsers: 100,
  testDuration: 120000,
  messageInterval: 1000
});
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/performance.yml
- name: Run Performance Tests
  run: |
    cd load-testing
    npm install
    node run-all-tests.js
```

## Performance Benchmarks

| Metric | Excellent | Good | Needs Optimization |
|--------|-----------|------|-------------------|
| Bundle Size | <150KB | <300KB | >300KB |
| Load Capacity | >200 users | >100 users | <100 users |
| Latency | <50ms | <100ms | >100ms |
| Reliability | 100% success | >95% success | <95% success |
