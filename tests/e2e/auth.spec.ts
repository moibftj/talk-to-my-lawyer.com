import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Talk To My Lawyer/)
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel(/email/i).fill('invalid@example.com')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByText(/invalid/i)).toBeVisible()
  })

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: /sign up/i }).click()

    await expect(page).toHaveURL(/signup/)
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible()
  })
})

test.describe('Accessibility', () => {
  test('login page should have proper ARIA labels', async ({ page }) => {
    await page.goto('/login')

    // Check for proper form labels
    const emailInput = page.getByLabel(/email/i)
    await expect(emailInput).toBeVisible()

    const passwordInput = page.getByLabel(/password/i)
    await expect(passwordInput).toBeVisible()

    // Check submit button is accessible
    const submitButton = page.getByRole('button', { name: /sign in/i })
    await expect(submitButton).toBeVisible()
  })

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/login')

    // Tab through form elements
    await page.keyboard.press('Tab')
    const emailInput = page.getByLabel(/email/i)
    await expect(emailInput).toBeFocused()

    await page.keyboard.press('Tab')
    const passwordInput = page.getByLabel(/password/i)
    await expect(passwordInput).toBeFocused()
  })
})
