import { test, expect } from '@playwright/test';

test.describe('Gestão de Membros (CRUD)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/usuario/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, email: 'e2e@teste.com', role: 'admin', nome: 'QA Bot' }),
      });
    });

    await page.goto('/');
    
    const btnMembros = page.locator('.nav-item').filter({ hasText: 'Membros' });
    await btnMembros.waitFor({ state: 'visible' });
    await btnMembros.click();
  });

  test('deve criar um novo membro preenchendo formulário completo (Mock CRUD)', async ({ page }) => {
    await page.route('**/membros/', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 8888, nome: 'Lucas Silva E2E', email: 'lucas@e2e.com', owner_id: 1, ativo: true })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/membros', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 8888, nome: 'Lucas Silva E2E', ativo: true, funcoes: [] }
          ])
        });
      } else {
        await route.continue();
      }
    });

    await page.locator('button', { hasText: 'Adicionar Membro' }).click();
    
    await page.locator('input[placeholder="Ex: Lucas Silva"]').fill('Lucas Silva E2E');
    await page.locator('input[placeholder="email@exemplo.com"]').fill('lucas@e2e.com');

    await page.locator('button', { hasText: 'Salvar Membro' }).click();

    await expect(page.locator('button', { hasText: 'Salvar Membro' })).not.toBeVisible();
    await expect(page.getByText('Lucas Silva E2E')).toBeVisible();
  });
});
