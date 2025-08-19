const os = require('os');

class SystemMonitor {
  constructor() {
    this.metrics = {
      cpu: [],
      memory: [],
      startTime: null,
      peakCpu: 0,
      peakMemory: 0
    };
    this.isMonitoring = false;
    this.interval = null;
  }

  start(intervalMs = 5000) {
    if (this.isMonitoring) return;
    
    this.metrics.startTime = Date.now();
    this.isMonitoring = true;
    
    console.log('🔍 Starting system resource monitoring...');
    
    this.interval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
    
    // Initial collection
    this.collectMetrics();
  }

  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    console.log('🔍 System monitoring stopped');
    this.reportSummary();
  }

  collectMetrics() {
    const timestamp = Date.now();
    
    // CPU usage calculation (approximation)
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const cpuUsage = ((totalTick - totalIdle) / totalTick) * 100;
    
    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;
    const memUsageMB = usedMem / 1024 / 1024;
    
    // Track peaks
    this.metrics.peakCpu = Math.max(this.metrics.peakCpu, cpuUsage);
    this.metrics.peakMemory = Math.max(this.metrics.peakMemory, memUsageMB);
    
    this.metrics.cpu.push({ timestamp, usage: cpuUsage });
    this.metrics.memory.push({ timestamp, usageMB: memUsageMB, usagePercent: memUsagePercent });
    
    // Log every minute during long tests
    const elapsed = timestamp - this.metrics.startTime;
    if (elapsed % 60000 < 5000) { // Within 5 seconds of minute boundary
      console.log(`📊 System: CPU ${cpuUsage.toFixed(1)}%, Memory ${memUsageMB.toFixed(0)}MB (${memUsagePercent.toFixed(1)}%)`);
    }
  }

  reportSummary() {
    if (this.metrics.cpu.length === 0) return;
    
    const avgCpu = this.metrics.cpu.reduce((sum, m) => sum + m.usage, 0) / this.metrics.cpu.length;
    const avgMemory = this.metrics.memory.reduce((sum, m) => sum + m.usageMB, 0) / this.metrics.memory.length;
    
    console.log('\n=== SYSTEM RESOURCE SUMMARY ===');
    console.log(`Average CPU Usage: ${avgCpu.toFixed(1)}%`);
    console.log(`Peak CPU Usage: ${this.metrics.peakCpu.toFixed(1)}%`);
    console.log(`Average Memory Usage: ${avgMemory.toFixed(0)}MB`);
    console.log(`Peak Memory Usage: ${this.metrics.peakMemory.toFixed(0)}MB`);
    
    // Stability assessment
    const cpuStability = this.metrics.peakCpu < 80 ? '✅ Stable' : '⚠️ High CPU usage detected';
    const memoryStability = this.metrics.peakMemory < 2048 ? '✅ Stable' : '⚠️ High memory usage detected';
    
    console.log(`CPU Stability: ${cpuStability}`);
    console.log(`Memory Stability: ${memoryStability}`);
    
    return {
      avgCpu: avgCpu.toFixed(1),
      peakCpu: this.metrics.peakCpu.toFixed(1),
      avgMemory: avgMemory.toFixed(0),
      peakMemory: this.metrics.peakMemory.toFixed(0),
      cpuStable: this.metrics.peakCpu < 80,
      memoryStable: this.metrics.peakMemory < 2048
    };
  }

  getMetrics() {
    return {
      ...this.metrics,
      avgCpu: this.metrics.cpu.length > 0 ? this.metrics.cpu.reduce((sum, m) => sum + m.usage, 0) / this.metrics.cpu.length : 0,
      avgMemory: this.metrics.memory.length > 0 ? this.metrics.memory.reduce((sum, m) => sum + m.usageMB, 0) / this.metrics.memory.length : 0
    };
  }
}

module.exports = SystemMonitor;
