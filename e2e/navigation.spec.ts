import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate between pages', async ({ page }) => {
    await page.goto('/');
    
    // Check home page is loaded
    await expect(page.getByRole('heading', { name: /clanker tools/i })).toBeVisible();
    
    // Navigate to create token
    await page.getByRole('link', { name: /create token/i }).click();
    await expect(page).toHaveURL('/create-token');
    
    // Navigate to profile
    await page.getByRole('link', { name: /profile/i }).click();
    await expect(page).toHaveURL('/profile');
    
    // Navigate back home
    await page.getByRole('link', { name: /home/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('should display navigation menu on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Bottom navigation should be visible on mobile
    const bottomNav = page.locator('nav').filter({ hasText: /home/i });
    await expect(bottomNav).toBeVisible();
    
    // Check all navigation items are present
    await expect(page.getByRole('link', { name: /home/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create token/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible();
  });

  test('should maintain navigation history', async ({ page }) => {
    await page.goto('/');
    
    // Navigate through multiple pages
    await page.getByRole('link', { name: /create token/i }).click();
    await page.getByRole('link', { name: /profile/i }).click();
    
    // Use browser back button
    await page.goBack();
    await expect(page).toHaveURL('/create-token');
    
    await page.goBack();
    await expect(page).toHaveURL('/');
  });

  test('should handle page refresh', async ({ page }) => {
    await page.goto('/profile');
    
    // Refresh the page
    await page.reload();
    
    // Should still be on profile page
    await expect(page).toHaveURL('/profile');
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
  });
});