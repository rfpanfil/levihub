import { test, expect } from '@playwright/test';

test.describe('Repertório de Músicas', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/usuario/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, email: 'e2e@teste.com', role: 'admin', nome: 'QA Bot' }),
      });
    });

    await page.goto('/');
    
    const btnRepertorio = page.locator('button').filter({ hasText: 'Repertório' });
    await btnRepertorio.waitFor({ state: 'visible' });
    await btnRepertorio.click();
  });

  test('deve carregar a lista de músicas e barra de busca', async ({ page }) => {
    await expect(page.getByText('O Meu Repertório Pessoal')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Adicionar Música' })).toBeVisible();
  });

  test('deve abrir modal de adicionar música', async ({ page }) => {
    await page.locator('button', { hasText: 'Adicionar Música' }).click();
    
    // O erro estava aqui: o robô procurava por "Ex: Entrada, Oferta..." (que é o campo de nova categoria), 
    // mas o primeiro campo principal de música na verdade usa o placeholder "Ex: A Ele a Glória" ou "Diante do Trono"
    await expect(page.locator('input[placeholder*="A Ele a Gl"]')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Salvar Música' })).toBeVisible();
  });
});
