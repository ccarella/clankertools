const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // Your existing Next.js config
  webpack: (config, { isServer }) => {
    // Performance hints for bundle size
    config.performance = {
      hints: 'warning',
      maxEntrypointSize: 512000, // 500KB
      maxAssetSize: 256000, // 250KB
    };

    return config;
  },
  
  // Configure bundle analyzer output
  analyzeServer: ['server', 'both'].includes(process.env.BUNDLE_ANALYZE),
  analyzeBrowser: ['browser', 'both'].includes(process.env.BUNDLE_ANALYZE),
  
  // Bundle analyzer options
  bundleAnalyzerConfig: {
    server: {
      analyzerMode: 'static',
      reportFilename: '../bundle-analyzer/server.html',
    },
    browser: {
      analyzerMode: 'static',
      reportFilename: '../bundle-analyzer/client.html',
    },
  },
});