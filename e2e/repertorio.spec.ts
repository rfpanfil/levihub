import { test, expect } from '@playwright/test';

test.describe('Repertório de Músicas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Entrar como Visitante")');
    await page.click('text=Repertório');
  });

  test('deve carregar a lista de músicas e barra de busca', async ({ page }) => {
    await expect(page.getByPlaceholder('Pesquisar música ou artista...')).toBeVisible();
    await expect(page.getByText('Adicionar Música')).toBeVisible();
  });

  test('deve abrir modal de adicionar música', async ({ page }) => {
    await page.click('text=Adicionar Música');
    await expect(page.getByText('Nova Música')).toBeVisible();
    await expect(page.locator('input[name="nome_musica"]')).toBeVisible();
    await expect(page.locator('input[name="artista"]')).toBeVisible();
    await expect(page.locator('button:has-text("Salvar")')).toBeVisible();
  });
});
