const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const zlib = require('zlib');

class BundleAnalyzer {
  constructor() {
    this.metrics = {
      bundleSize: 0,
      gzippedSize: 0,
      brotliSize: 0,
      assetCount: 0,
      largestAssets: []
    };
  }

  async analyzeBundle() {
    console.log('Analyzing client bundle...');
    
    try {
      // Build the project first (from parent directory)
      console.log('Building project...');
      const parentDir = path.join(process.cwd(), '..');
      execSync('npm run build', { 
        stdio: 'inherit',
        cwd: parentDir
      });
      
      // Analyze dist directory (in parent directory)
      const distPath = path.join(parentDir, 'dist');
      if (!fs.existsSync(distPath)) {
        throw new Error('Dist directory not found. Build may have failed.');
      }
      
      await this.analyzeDirectory(distPath);
      this.calculateGzippedSizes(distPath);
      this.reportResults();
      
    } catch (error) {
      console.error('Bundle analysis failed:', error.message);
      process.exit(1);
    }
  }

  async analyzeDirectory(dirPath, relativePath = '') {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativeItemPath = path.join(relativePath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        await this.analyzeDirectory(fullPath, relativeItemPath);
      } else if (stat.isFile()) {
        this.analyzeFile(fullPath, relativeItemPath, stat.size);
      }
    }
  }

  analyzeFile(filePath, relativePath, size) {
    // Only analyze JS, CSS, and HTML files
    const ext = path.extname(filePath).toLowerCase();
    if (['.js', '.css', '.html', '.map'].includes(ext)) {
      this.metrics.bundleSize += size;
      this.metrics.assetCount++;
      
      this.metrics.largestAssets.push({
        path: relativePath,
        size: size,
        sizeKB: (size / 1024).toFixed(2)
      });
    }
  }

  calculateGzippedSizes(distPath) {
    console.log('Calculating compressed sizes...');
    
    // Find the main JS bundle
    const jsFiles = this.findJsFiles(distPath);
    
    for (const file of jsFiles) {
      try {
        const fileContent = fs.readFileSync(file);
        // Calculate gzipped size
        this.metrics.gzippedSize += zlib.gzipSync(fileContent).length;
        
        // Calculate brotli size (if available)
        if (zlib.brotliCompressSync) {
          this.metrics.brotliSize += zlib.brotliCompressSync(fileContent).length;
        }
      } catch (e) {
        console.warn(`Could not calculate compressed size for ${file}`);
      }
    }
  }

  findJsFiles(dirPath) {
    const jsFiles = [];
    
    const findJsFilesRecursive = (currentPath) => {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          findJsFilesRecursive(fullPath);
        } else if (path.extname(item) === '.js') {
          jsFiles.push(fullPath);
        }
      }
    };
    
    findJsFilesRecursive(dirPath);
    return jsFiles;
  }

  reportResults() {
    // Sort assets by size
    this.metrics.largestAssets.sort((a, b) => b.size - a.size);
    
    console.log('\n=== BUNDLE ANALYSIS RESULTS ===');
    console.log(`Total Bundle Size: ${(this.metrics.bundleSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Gzipped Size: ${(this.metrics.gzippedSize / 1024 / 1024).toFixed(2)} MB`);
    if (this.metrics.brotliSize > 0) {
      console.log(`Brotli Size: ${(this.metrics.brotliSize / 1024 / 1024).toFixed(2)} MB`);
    }
    console.log(`Asset Count: ${this.metrics.assetCount}`);
    
    const compressionRatio = ((this.metrics.bundleSize - this.metrics.gzippedSize) / this.metrics.bundleSize * 100).toFixed(1);
    console.log(`Gzip Compression: ${compressionRatio}%`);
    
    console.log('\n=== LARGEST ASSETS ===');
    this.metrics.largestAssets.slice(0, 10).forEach((asset, index) => {
      console.log(`${index + 1}. ${asset.path}: ${asset.sizeKB} KB`);
    });
    
    console.log('\n=== PERFORMANCE SUMMARY ===');
    const bundleSizeKB = this.metrics.bundleSize / 1024;
    const gzippedSizeKB = this.metrics.gzippedSize / 1024;
    
    if (bundleSizeKB < 500) {
      console.log('✅ Bundle size under 500KB (excellent)');
    } else if (bundleSizeKB < 1000) {
      console.log('✅ Bundle size under 1MB (good)');
    } else {
      console.log(`⚠️ Bundle size ${bundleSizeKB.toFixed(0)}KB (consider optimization)`);
    }
    
    if (gzippedSizeKB < 150) {
      console.log('✅ Gzipped size under 150KB (excellent)');
    } else if (gzippedSizeKB < 300) {
      console.log('✅ Gzipped size under 300KB (good)');
    } else {
      console.log(`⚠️ Gzipped size ${gzippedSizeKB.toFixed(0)}KB (consider optimization)`);
    }
    
    // Estimate TTI based on bundle size
    const estimatedTTI = this.estimateTTI();
    console.log(`📊 Estimated Time to Interactive: ~${estimatedTTI}ms`);
  }

  estimateTTI() {
    // Rough estimation based on bundle size
    // This is a simplified model - real TTI depends on many factors
    const gzippedSizeKB = this.metrics.gzippedSize / 1024;
    
    // Base TTI for parsing and execution
    let tti = 200;
    
    // Add time based on bundle size (rough estimate)
    tti += gzippedSizeKB * 2; // ~2ms per KB for parsing/execution
    
    // Add network time (assuming 3G connection ~1.5Mbps)
    const networkTime = (gzippedSizeKB * 8) / 1500; // Convert KB to bits, divide by Mbps
    tti += networkTime * 1000; // Convert to ms
    
    return Math.round(tti);
  }
}

// CLI usage
if (require.main === module) {
  const analyzer = new BundleAnalyzer();
  analyzer.analyzeBundle().catch(console.error);
}

module.exports = BundleAnalyzer;
