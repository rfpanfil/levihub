import { test, expect } from '@playwright/test';

test.describe('Gestão de Membros', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Entrar como Visitante")');
    await page.click('text=Membros');
  });

  test('deve listar membros e exibir filtros', async ({ page }) => {
    // A tela de membros tem tabela e barra de pesquisa
    await expect(page.getByPlaceholder(/pesquisar/i)).toBeVisible();
    await expect(page.getByText('Adicionar Membro')).toBeVisible();
  });

  test('deve abrir modal de cadastro de membro', async ({ page }) => {
    await page.click('text=Adicionar Membro');
    await expect(page.getByText('Novo Membro')).toBeVisible();
    await expect(page.locator('input[name="nome"]')).toBeVisible();
    await expect(page.locator('button:has-text("Salvar")')).toBeVisible();
  });
});
