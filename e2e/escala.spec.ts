import { test, expect } from '@playwright/test';

test.describe('Gerador de Escalas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Entrar como Visitante")');
    await page.click('text=Escalas');
  });

  test('deve renderizar os painéis do gerador de escalas verticalmente', async ({ page }) => {
    await expect(page.getByText('Configuração do Mês')).toBeVisible();
    await expect(page.getByText('Mês:')).toBeVisible();
    await expect(page.getByText('Ano:')).toBeVisible();
  });
});
