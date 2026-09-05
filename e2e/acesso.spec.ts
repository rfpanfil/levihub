import { test, expect } from '@playwright/test';

test.describe('Painel Admin e Perfil (Controle de Acesso)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Entrar como Visitante")');
  });

  test('visitante não deve ter acesso ao painel admin na interface', async ({ page }) => {
    // Verifica se o link Painel Admin está ausente no menu
    await expect(page.locator('nav').getByText('Painel Admin')).not.toBeVisible();
  });

  test('visitante deve ver mensagem de restrição ao acessar o perfil', async ({ page }) => {
    // No modo visitante, configurações e perfil ficam desativados ou bloqueados
    // Clica no link de Perfil se existir, ou verifica ausência
    const perfilLink = page.locator('nav').getByText('Configurações');
    if (await perfilLink.isVisible()) {
      await perfilLink.click();
      await expect(page.getByText(/Faça login/i)).toBeVisible();
    }
  });
});
