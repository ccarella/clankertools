# Bundle Optimization Guide

This document describes the bundle optimization configurations applied to the ClankerTools project.

## Performance Optimizations

### Next.js Configuration

The `next.config.ts` file has been optimized with the following features:

1. **SWC Minification**: Enabled for faster and more efficient JavaScript minification
2. **Image Optimization**: Configured to support AVIF and WebP formats with proper security settings
3. **Package Import Optimization**: Applied to commonly used packages like `lucide-react`, `@radix-ui/react-*`, and `react-hook-form`
4. **Server Components**: External packages optimized for server-side rendering
5. **Production Optimizations**: Console logs removed in production builds
6. **Security Headers**: Added various security headers for better protection

### Bundle Analysis

To analyze the bundle size and identify optimization opportunities:

```bash
# Run the bundle analyzer
npm run analyze

# This will build the project and open a visual representation of the bundle
```

The bundle analyzer will show:
- Size of each module in your bundle
- Which packages are taking up the most space
- Opportunities for code splitting
- Duplicate dependencies

### Icon Optimization Strategy

While we initially attempted to optimize lucide-react imports using individual icon imports, we found that:

1. The `experimental.optimizePackageImports` feature in Next.js already provides significant optimization
2. Individual icon imports caused compatibility issues with Jest testing
3. The current approach maintains developer experience while still achieving good bundle size

### Current Optimizations

1. **Experimental Package Optimization**: The following packages are automatically optimized:
   - `lucide-react`: Icons are tree-shaken automatically
   - `@radix-ui/react-*`: UI components are optimized
   - `react-hook-form`: Form handling is optimized

2. **Webpack Configuration**: 
   - Server-side packages are excluded from client bundles
   - `@neynar/nodejs-sdk` is aliased to false on client-side to prevent bundling

3. **Output Configuration**:
   - Standalone output for optimized Docker deployments
   - Gzip compression enabled

### Monitoring Bundle Size

To keep track of bundle size over time:

1. Run `npm run analyze` before and after adding new dependencies
2. Look for unexpected increases in bundle size
3. Consider lazy loading for large components or features
4. Use dynamic imports for code that's not needed on initial page load

### Future Optimization Opportunities

1. **Code Splitting**: Implement route-based code splitting for larger features
2. **Dynamic Imports**: Use dynamic imports for heavy components like charts or editors
3. **External CDN**: Consider loading some libraries from CDN for better caching
4. **Preact**: For even smaller bundles, consider using Preact in production (requires testing)

### Best Practices

1. Always check bundle size impact when adding new dependencies
2. Prefer smaller alternatives when available (e.g., date-fns over moment.js)
3. Use dynamic imports for features that aren't immediately needed
4. Keep an eye on the bundle analyzer output for duplicate dependencies
5. Consider using CSS modules or Tailwind CSS instead of CSS-in-JS libraries for styling