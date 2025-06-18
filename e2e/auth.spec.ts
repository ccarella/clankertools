import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display sign in button when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Check for sign in button
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeVisible();
  });

  test('should navigate to profile page', async ({ page }) => {
    await page.goto('/');
    
    // Click on profile link
    await page.getByRole('link', { name: /profile/i }).click();
    
    // Should be on profile page
    await expect(page).toHaveURL('/profile');
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
  });

  test('should show authentication status on profile page', async ({ page }) => {
    await page.goto('/profile');
    
    // Should show not authenticated message
    await expect(page.getByText(/sign in to view your profile/i)).toBeVisible();
  });

  test('should handle sign in flow', async ({ page }) => {
    // Mock the Farcaster SDK
    await page.addInitScript(() => {
      window.mockFarcasterUser = {
        fid: 12345,
        username: 'testuser',
        displayName: 'Test User',
      };
    });
    
    await page.goto('/');
    
    // The sign in button should be visible
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeVisible();
  });
});