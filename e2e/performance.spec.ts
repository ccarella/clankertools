import { test, expect } from '@playwright/test';

test.describe('Performance', () => {
  test('should load homepage within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have no accessibility violations on key pages', async ({ page }) => {
    const pages = ['/', '/create-token', '/profile'];
    
    for (const path of pages) {
      await page.goto(path);
      
      // Basic accessibility checks
      // Check for page title
      await expect(page).toHaveTitle(/clanker tools/i);
      
      // Check for main content
      const main = page.locator('main');
      await expect(main).toBeVisible();
      
      // Check for proper heading hierarchy
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
    }
  });

  test('should handle offline mode gracefully', async ({ page, context }) => {
    await page.goto('/');
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate
    await page.getByRole('link', { name: /profile/i }).click();
    
    // Should still work for client-side navigation
    await expect(page).toHaveURL('/profile');
    
    // Go back online
    await context.setOffline(false);
  });

  test('should have responsive design', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' },
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      
      // Check that content is visible and properly laid out
      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();
      
      // On mobile, bottom navigation should be visible
      if (viewport.name === 'Mobile') {
        const bottomNav = page.locator('nav').nth(1);
        await expect(bottomNav).toBeVisible();
      }
    }
  });
});