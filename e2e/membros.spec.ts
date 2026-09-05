import { test, expect } from '@playwright/test';

test.describe('Gestão de Membros', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Entrar como Visitante")');
    await page.click('text=Membros');
  });

  test('deve listar membros e exibir filtros', async ({ page }) => {
    await expect(page.getByText('Adicionar Membro')).toBeVisible();
  });

  test('deve abrir modal de cadastro de membro', async ({ page }) => {
    await page.click('text=Adicionar Membro');
    await expect(page.getByText('Adicionar Novo Membro')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Salvar Membro' })).toBeVisible();
  });
});
