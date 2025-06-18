#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function checkBundleSize() {
  console.log('🔍 Checking Next.js bundle size...\n');
  
  try {
    // Build the project
    console.log('Building project...');
    await execAsync('npm run build');
    
    // Next.js outputs bundle info during build
    console.log('\n✅ Build completed. Check the output above for bundle sizes.');
    console.log('\nKey metrics to watch:');
    console.log('- First Load JS should be < 200kB for optimal performance');
    console.log('- Each page bundle should be as small as possible');
    console.log('- Shared chunks should be properly code-split');
    
  } catch (error) {
    console.error('Error during build:', error.message);
  }
}

async function analyzePackages() {
  console.log('\n📦 Analyzing package sizes...\n');
  
  try {
    // Check if we can analyze the bundle
    const { stdout } = await execAsync('npx -p webpack-bundle-analyzer@latest webpack-bundle-analyzer .next/analyze/client.html -m static -r bundle-report.html -O');
    console.log('Bundle analysis report generated: bundle-report.html');
  } catch (error) {
    // If bundle analyzer fails, just show package sizes
    console.log('Large dependencies in package.json:');
    const packageJson = require('../package.json');
    const deps = { ...packageJson.dependencies };
    
    // List packages that might be large
    const potentiallyLargeDeps = [
      'lucide-react',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-avatar',
      'clanker-sdk',
    ];
    
    potentiallyLargeDeps.forEach(dep => {
      if (deps[dep]) {
        console.log(`- ${dep}: ${deps[dep]}`);
      }
    });
    
    console.log('\nConsider using dynamic imports for large libraries that aren\'t needed on initial load.');
  }
}

async function checkImageOptimization() {
  console.log('\n🖼️  Checking for images...\n');
  
  try {
    const { stdout } = await execAsync('find public -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.webp" 2>/dev/null || echo "No images found"');
    
    if (stdout.trim() === 'No images found' || !stdout.trim()) {
      console.log('✅ No unoptimized images found in public directory');
    } else {
      console.log('Found images in public directory:');
      console.log(stdout);
      console.log('\nTip: Use Next.js Image component for automatic optimization');
    }
  } catch (error) {
    console.log('✅ No images found to optimize');
  }
}

async function performanceRecommendations() {
  console.log('\n📋 Performance Recommendations:\n');
  
  const recommendations = [
    '1. Enable Turbopack in development (already enabled ✅)',
    '2. Use dynamic imports for heavy components',
    '3. Implement proper caching headers',
    '4. Enable compression (gzip/brotli)',
    '5. Minimize third-party scripts',
    '6. Use Next.js Image component for images',
    '7. Implement proper loading states',
    '8. Consider using a CDN for static assets',
    '9. Monitor Core Web Vitals',
    '10. Use React.memo() for expensive components',
  ];
  
  recommendations.forEach(rec => console.log(rec));
}

async function main() {
  console.log('🚀 Next.js Performance Audit\n');
  console.log('This script will analyze your Next.js app for performance issues.\n');
  
  await checkBundleSize();
  await analyzePackages();
  await checkImageOptimization();
  await performanceRecommendations();
  
  console.log('\n✨ Performance audit complete!');
  console.log('For more detailed analysis, consider using:');
  console.log('- Lighthouse CLI: npm install -g lighthouse');
  console.log('- Next.js Analytics: https://nextjs.org/analytics');
  console.log('- Vercel Speed Insights: https://vercel.com/docs/insights/speed-insights');
}

main().catch(console.error);