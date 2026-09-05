import { test, expect } from '@playwright/test';

test.describe('Levi Roboto - Assistente Inteligente', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Entrar como Visitante")');
    await page.click('text=Levi Roboto');
  });

  test('deve renderizar chat do LeviRoboto e a caixa de input', async ({ page }) => {
    await expect(page.getByText('LeviRoboto')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
  });
});
