#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 TimedDoodle Performance Testing Demo');
console.log('=' .repeat(50));

// Check if server is running
function checkServer() {
  try {
    const response = execSync('curl -s http://localhost:3001/', { encoding: 'utf8' });
    if (response.includes('Timed Doodle Challenge backend')) {
      console.log('✅ Server is running on http://localhost:3001');
      return true;
    }
  } catch (error) {
    console.log('❌ Server not running on http://localhost:3001');
    console.log('   Please start the server first: cd ../server && npm start');
    return false;
  }
}

// Run quick latency test
async function runQuickLatencyTest() {
  console.log('\n📊 Running quick latency test (10 seconds)...');
  try {
    // Use cross-platform environment variable setting
    const env = { ...process.env, TEST_DURATION: '10000' };
    const output = execSync('node latency-test.js', { 
      encoding: 'utf8',
      cwd: __dirname,
      env: env
    });
    
    // Extract key metrics
    const avgMatch = output.match(/Average: ([\d.]+)ms/);
    const p95Match = output.match(/P95: ([\d.]+)ms/);
    const successMatch = output.match(/Success Rate: ([\d.]+)%/);
    
    if (avgMatch && p95Match && successMatch) {
      console.log(`✅ Latency: ~${Math.round(parseFloat(avgMatch[1]))}ms avg, ${Math.round(parseFloat(p95Match[1]))}ms P95`);
      console.log(`✅ Success Rate: ${parseFloat(successMatch[1]).toFixed(1)}%`);
    }
  } catch (error) {
    console.log('❌ Latency test failed:', error.message);
  }
}

// Run quick load test
async function runQuickLoadTest() {
  console.log('\n⚡ Running quick load test (20 users, 30 seconds)...');
  try {
    // Use cross-platform environment variable setting
    const env = { ...process.env, CONCURRENT_USERS: '5', TEST_DURATION: '30000' };
    const output = execSync('node socket-load-test.js', { 
      encoding: 'utf8',
      cwd: __dirname,
      env: env
    });
    
    // Extract key metrics
    const connectionMatch = output.match(/Successful Connections: (\d+)\/(\d+) \(([\d.]+)%\)/);
    const avgLatencyMatch = output.match(/Average: ([\d.]+)ms/);
    
    if (connectionMatch && avgLatencyMatch) {
      console.log(`✅ Load: ${connectionMatch[1]}/${connectionMatch[2]} connections (${connectionMatch[3]}% success)`);
      console.log(`✅ Latency: ~${Math.round(parseFloat(avgLatencyMatch[1]))}ms average`);
    }
  } catch (error) {
    console.log('❌ Load test failed:', error.message);
  }
}

// Run bundle analysis
async function runBundleAnalysis() {
  console.log('\n📦 Running bundle analysis...');
  try {
    // First build the project from parent directory
    console.log('Building project...');
    execSync('npm run build', { 
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    // Then run bundle analysis
    const output = execSync('node bundle-analyzer.js', { 
      encoding: 'utf8',
      cwd: __dirname 
    });
    
    // Extract key metrics
    const bundleSizeMatch = output.match(/Total Bundle Size: ([\d.]+) MB/);
    const gzippedSizeMatch = output.match(/Gzipped Size: ([\d.]+) MB/);
    const ttiMatch = output.match(/Estimated Time to Interactive: ~(\d+)ms/);
    
    if (bundleSizeMatch && gzippedSizeMatch && ttiMatch) {
      const gzippedKB = parseFloat(gzippedSizeMatch[1]) * 1024;
      console.log(`✅ Bundle: ${gzippedKB.toFixed(0)}KB gzipped`);
      console.log(`✅ TTI: ~${ttiMatch[1]}ms estimated`);
    }
  } catch (error) {
    console.log('❌ Bundle analysis failed:', error.message);
  }
}

// Main demo function
async function runDemo() {
  if (!checkServer()) {
    return;
  }
  
  console.log('\n🎯 Running performance validation demo...');
  console.log('This will take about 1-2 minutes to complete.\n');
  
  try {
    await runQuickLatencyTest();
    await runQuickLoadTest();
    await runBundleAnalysis();
    
    console.log('\n🎉 Demo completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Run full test suite: npm run test:performance');
    console.log('2. Run individual tests: npm run test:load, npm run test:reliability');
    console.log('3. Check results in load-testing/results.json');
    console.log('4. View detailed reports in load-testing/performance-summary.txt');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Run demo if called directly
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { runDemo };
