import { test, expect } from '@playwright/test';

test.describe('Repertório de Músicas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Entrar como Visitante")');
    // Clica usando uma busca flexível na nav-item que contém o texto
    await page.locator('.nav-item').filter({ hasText: 'Repertório' }).click();
  });

  test('deve carregar a lista de músicas e barra de busca', async ({ page }) => {
    // Título da página principal de repertório
    await expect(page.getByText('O Meu Repertório Pessoal')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Adicionar Música' })).toBeVisible();
  });

  test('deve abrir modal de adicionar música', async ({ page }) => {
    await page.locator('button', { hasText: 'Adicionar Música' }).click();
    await expect(page.locator('input[placeholder="Ex: Entrada, Oferta..."]')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Salvar Música' })).toBeVisible();
  });
});
