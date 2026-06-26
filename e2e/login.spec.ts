import { test, expect } from '@playwright/test';

test.describe('Login & Redirection Flow', () => {
  test('should redirect home page to login', async ({ page }) => {
    // Go to the home page
    await page.goto('/');

    // It should redirect to login page (either /login or /login?type=recovery)
    await expect(page).toHaveURL(/\/login/);
  });

  test('should render the login form correctly', async ({ page }) => {
    await page.goto('/login');

    // Wait for the email input — reliable hydration anchor for this client component
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 15000 });


    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Check if the Sign In button is present
    const signInBtn = page.locator('button[type="submit"]');
    await expect(signInBtn).toBeVisible();
  });
});
