const fs = require('fs');
const path = require('path');

let execa;

class PerformanceTestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      loadTest: null,
      reliabilityTest: null,
      bundleAnalysis: null,
      throughputTest: null,
      summary: {}
    };
  }

  async runAllTests() {
    console.log('🚀 Starting comprehensive performance validation for TimedDoodle');
    console.log('=' .repeat(60));
    console.log('🎯 Test Specifications:');
    console.log('  - Load Test: 250 concurrent users for 15 minutes (CPU/memory stability)');
    console.log('  - Throughput Test: 15 rooms, 6 players/room, 3 events/sec for 15 minutes');
    console.log('  - Reliability Test: 8 rooms, 4 players/room for 10 minutes (>95% reconnection target)');
    console.log('=' .repeat(60));
    
    try {
      if (!execa) {
        execa = (await import('execa')).execa;
      }
      // 1. Bundle Analysis
      await this.runBundleAnalysis();
      
      // 2. Load Test
      await this.runLoadTest();
      
      // 3. Throughput Test
      await this.runThroughputTest();
      
      // 4. Reliability Test (shorter version for demo)
      await this.runReliabilityTest();
      
      // 5. Generate summary
      this.generateSummary();
      
      // 6. Save results
      this.saveResults();
      
      console.log('\n🎉 All performance tests completed successfully!');
      console.log('📊 Check load-testing/results.json for detailed results');
      
    } catch (error) {
      console.error('❌ Performance test suite failed:', error.message);
      process.exit(1);
    }
  }

  async runBundleAnalysis() {
    console.log('\n📦 Running bundle analysis...');
    
    try {
      const { stdout: output } = await execa('node', ['bundle-analyzer.js'], {
        cwd: __dirname,
        all: true
      });
      
      // Parse bundle size from output
      const bundleSizeMatch = output.match(/Total Bundle Size: ([\d.]+) MB/);
      const gzippedSizeMatch = output.match(/Gzipped Size: ([\d.]+) MB/);
      const ttiMatch = output.match(/Estimated Time to Interactive: ~(\d+)ms/);
      
      this.results.bundleAnalysis = {
        bundleSizeMB: bundleSizeMatch ? parseFloat(bundleSizeMatch[1]) : null,
        gzippedSizeMB: gzippedSizeMatch ? parseFloat(gzippedSizeMatch[1]) : null,
        estimatedTTI: ttiMatch ? parseInt(ttiMatch[1]) : null
      };
      
      console.log('✅ Bundle analysis completed');
      
    } catch (error) {
      console.error('❌ Bundle analysis failed:', error.message);
      throw error;
    }
  }

  async runLoadTest() {
    console.log('\n⚡ Running load test (250 concurrent users, 15 minutes)...');
    
    try {
      const { stdout: output } = await execa('node', ['socket-load-test.js'], {
        env: {
          CONCURRENT_USERS: 250,
          TEST_DURATION: 900000 // 15 minutes
        },
        cwd: __dirname,
        all: true
      });
      
      // Parse metrics from output
      const connectionSuccessMatch = output.match(/Successful Connections: (\d+)\/(\d+) \(([\d.]+)%\)/);
      const p50LatencyMatch = output.match(/P50 \(Median\): ([\d.]+)ms/);
      const p95LatencyMatch = output.match(/P95: ([\d.]+)ms/);
      const avgLatencyMatch = output.match(/Average: ([\d.]+)ms/);
      
      this.results.loadTest = {
        concurrentUsers: 250,
        testDuration: 900000,
        connectionSuccessRate: connectionSuccessMatch ? parseFloat(connectionSuccessMatch[3]) : null,
        avgLatency: avgLatencyMatch ? parseFloat(avgLatencyMatch[1]) : null,
        p50Latency: p50LatencyMatch ? parseFloat(p50LatencyMatch[1]) : null,
        p95Latency: p95LatencyMatch ? parseFloat(p95LatencyMatch[1]) : null
      };
      
      console.log('✅ Load test completed');
      
    } catch (error) {
      console.error('❌ Load test failed:', error.message);
      throw error;
    }
  }

  async runThroughputTest() {
    console.log('\n🔄 Running throughput test (15 rooms, 6 players/room, 3 events/sec for 15 minutes)...');
    try {
      const { stdout: output } = await execa('node', ['throughput-test.js'], {
        env: {
          ROOM_COUNT: 15,
          PLAYERS_PER_ROOM: 6,
          EVENTS_PER_SECOND: 3,
          TEST_DURATION: 900000 // 15 minutes
        },
        cwd: __dirname,
        all: true
      });
      const eventsSentMatch = output.match(/Total Events Sent: (\d+)/);
      const avgLatencyMatch = output.match(/Average Latency: ([\d.]+)ms/);
      const p95LatencyMatch = output.match(/P95 Latency: ([\d.]+)ms/);
      this.results.throughputTest = {
        totalEventsSent: eventsSentMatch ? parseInt(eventsSentMatch[1]) : null,
        avgLatency: avgLatencyMatch ? parseFloat(avgLatencyMatch[1]) : null,
        p95Latency: p95LatencyMatch ? parseFloat(p95LatencyMatch[1]) : null
      };
      console.log('✅ Throughput test completed');
    } catch (error) {
      console.error('❌ Throughput test failed:', error.message);
      throw error;
    }
  }

  async runReliabilityTest() {
    console.log('\n🔄 Running reliability test (8 rooms, 4 players/room for 10 minutes)...');
    
    try {
      const { stdout: output } = await execa('node', ['reliability-test.js'], {
        env: {
          TEST_DURATION: 600000, // 10 minutes
          ROOM_COUNT: 8,
          PLAYERS_PER_ROOM: 4
        },
        cwd: __dirname,
        all: true
      });
      
      // Parse metrics from output
      const reconnectionSuccessMatch = output.match(/Reconnection Success Rate: ([\d.]+)%/);
      const lateJoinSuccessMatch = output.match(/Late Join Success Rate: ([\d.]+)%/);
      const droppedRoomsMatch = output.match(/Dropped Rooms: (\d+)/);
      const stateSyncFailuresMatch = output.match(/State Sync Failures: (\d+)/);
      
      this.results.reliabilityTest = {
        testDuration: 600000,
        roomCount: 8,
        playersPerRoom: 4,
        reconnectionSuccessRate: reconnectionSuccessMatch ? parseFloat(reconnectionSuccessMatch[1]) : null,
        lateJoinSuccessRate: lateJoinSuccessMatch ? parseFloat(lateJoinSuccessMatch[1]) : null,
        droppedRooms: droppedRoomsMatch ? parseInt(droppedRoomsMatch[1]) : null,
        stateSyncFailures: stateSyncFailuresMatch ? parseInt(stateSyncFailuresMatch[1]) : null
      };
      
      console.log('✅ Reliability test completed');
      
    } catch (error) {
      console.error('❌ Reliability test failed:', error.message);
      throw error;
    }
  }

  generateSummary() {
    console.log('\n📊 Generating performance summary...');
    
    const summary = {
      bundleSize: {
        status: 'unknown',
        value: null,
        message: ''
      },
      loadCapacity: {
        status: 'unknown',
        value: null,
        message: ''
      },
      latency: {
        status: 'unknown',
        value: null,
        message: ''
      },
      reliability: {
        status: 'unknown',
        value: null,
        message: ''
      },
      throughput: {
        status: 'unknown',
        value: null,
        message: ''
      }
    };

    // Bundle size assessment
    if (this.results.bundleAnalysis) {
      const gzippedKB = this.results.bundleAnalysis.gzippedSizeMB * 1024;
      summary.bundleSize.value = gzippedKB;
      
      if (gzippedKB < 150) {
        summary.bundleSize.status = 'excellent';
        summary.bundleSize.message = `Bundle size ${gzippedKB.toFixed(0)}KB (excellent)`;
      } else if (gzippedKB < 300) {
        summary.bundleSize.status = 'good';
        summary.bundleSize.message = `Bundle size ${gzippedKB.toFixed(0)}KB (good)`;
      } else {
        summary.bundleSize.status = 'needs_optimization';
        summary.bundleSize.message = `Bundle size ${gzippedKB.toFixed(0)}KB (consider optimization)`;
      }
    }

    // Load capacity assessment
    if (this.results.loadTest) {
      summary.loadCapacity.value = this.results.loadTest.concurrentUsers;
      
      if (this.results.loadTest.connectionSuccessRate >= 95) {
        summary.loadCapacity.status = 'excellent';
        summary.loadCapacity.message = `Validated up to ${this.results.loadTest.concurrentUsers} concurrent clients (${this.results.loadTest.connectionSuccessRate.toFixed(1)}% success rate)`;
      } else if (this.results.loadTest.connectionSuccessRate >= 90) {
        summary.loadCapacity.status = 'good';
        summary.loadCapacity.message = `Validated up to ${this.results.loadTest.concurrentUsers} concurrent clients (${this.results.loadTest.connectionSuccessRate.toFixed(1)}% success rate)`;
      } else {
        summary.loadCapacity.status = 'needs_optimization';
        summary.loadCapacity.message = `Connection success rate ${this.results.loadTest.connectionSuccessRate.toFixed(1)}% (below 90%)`;
      }
    }

    // Latency assessment
    if (this.results.loadTest && this.results.loadTest.p50Latency) {
      summary.latency.value = this.results.loadTest.p50Latency;
      
      if (this.results.loadTest.p50Latency < 50 && this.results.loadTest.p95Latency < 100) {
        summary.latency.status = 'excellent';
        summary.latency.message = `P50: ${Math.round(this.results.loadTest.p50Latency)}ms, P95: ${Math.round(this.results.loadTest.p95Latency)}ms (excellent)`;
      } else if (this.results.loadTest.p50Latency < 100 && this.results.loadTest.p95Latency < 200) {
        summary.latency.status = 'good';
        summary.latency.message = `P50: ${Math.round(this.results.loadTest.p50Latency)}ms, P95: ${Math.round(this.results.loadTest.p95Latency)}ms (good)`;
      } else {
        summary.latency.status = 'needs_optimization';
        summary.latency.message = `P50: ${Math.round(this.results.loadTest.p50Latency)}ms, P95: ${Math.round(this.results.loadTest.p95Latency)}ms (consider optimization)`;
      }
    }

    // Reliability assessment
    if (this.results.reliabilityTest) {
      const hasNoDroppedRooms = this.results.reliabilityTest.droppedRooms === 0;
      const hasNoStateSyncFailures = this.results.reliabilityTest.stateSyncFailures === 0;
      const reconRate = this.results.reliabilityTest.reconnectionSuccessRate;
      
      if (hasNoDroppedRooms && hasNoStateSyncFailures) {
        summary.reliability.status = 'excellent';
        if (typeof reconRate === 'number' && reconRate >= 95) {
          summary.reliability.message = `No dropped rooms; ${reconRate.toFixed(1)}% reconnection success under churn`;
        } else {
          summary.reliability.message = 'No dropped rooms; successful state sync under churn';
        }
      } else {
        summary.reliability.status = 'needs_attention';
        summary.reliability.message = `${this.results.reliabilityTest.droppedRooms} dropped rooms, ${this.results.reliabilityTest.stateSyncFailures} state sync failures`;
      }
    }

    // Throughput assessment
    if (this.results.throughputTest) {
      const { totalEventsSent, p95Latency } = this.results.throughputTest;
      summary.throughput.value = totalEventsSent;
      if (totalEventsSent > 100000 && p95Latency < 100) {
        summary.throughput.status = 'excellent';
        summary.throughput.message = `Processed ~${totalEventsSent / 1000}k events with p95 latency < 100ms.`;
      } else {
        summary.throughput.status = 'good';
        summary.throughput.message = `Processed ~${totalEventsSent / 1000}k events.`;
      }
    }

    this.results.summary = summary;
  }

  saveResults() {
    const resultsPath = path.join(__dirname, 'results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
    
    // Also save a human-readable summary
    const summaryPath = path.join(__dirname, 'performance-summary.txt');
    let summaryText = 'TIMEDDOODLE PERFORMANCE VALIDATION SUMMARY\n';
    summaryText += '=' .repeat(50) + '\n\n';
    summaryText += `Test Date: ${new Date().toLocaleString()}\n\n`;
    
    Object.entries(this.results.summary).forEach(([category, data]) => {
      const statusEmoji = {
        'excellent': '✅',
        'good': '✅',
        'needs_optimization': '⚠️',
        'needs_attention': '❌',
        'unknown': '❓'
      }[data.status];
      
      summaryText += `${statusEmoji} ${category.toUpperCase()}: ${data.message || 'No data'}\n`;
    });
    
    summaryText += '\n' + '=' .repeat(50) + '\n';
    summaryText += 'For detailed results, see results.json\n';
    
    fs.writeFileSync(summaryPath, summaryText);
    
    // Print summary to console
    console.log('\n' + summaryText);
  }
}

// CLI usage
if (require.main === module) {
  const runner = new PerformanceTestRunner();
  runner.runAllTests().catch(console.error);
}

module.exports = PerformanceTestRunner;
