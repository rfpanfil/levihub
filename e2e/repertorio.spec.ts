import { test, expect } from '@playwright/test';

test.describe('Repertório de Músicas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Entrar como Visitante")');
    await page.click('text=Repertório');
  });

  test('deve carregar a lista de músicas e barra de busca', async ({ page }) => {
    await expect(page.getByPlaceholder('Ex: título, autor ou trecho...')).toBeVisible();
    await expect(page.getByText('Adicionar Música')).toBeVisible();
  });

  test('deve abrir modal de adicionar música', async ({ page }) => {
    await page.click('text=Adicionar Música');
    await expect(page.locator('input[placeholder="Ex: Entrada, Oferta..."]')).toBeVisible();
    await expect(page.locator('button:has-text("Salvar Música")')).toBeVisible();
  });
});
