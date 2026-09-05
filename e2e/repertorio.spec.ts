import { test, expect } from '@playwright/test';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

test.describe('Repertório de Músicas (CRUD)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/usuario/me', route => {
      route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, email: 'e2e@teste.com', role: 'admin', nome: 'QA Bot' }),
      });
    });

    await page.goto('/');
    
    const btnRepertorio = page.locator('.nav-item').filter({ hasText: 'Repertório' });
    await btnRepertorio.waitFor({ state: 'visible' });
    await btnRepertorio.click();
  });

  test('deve criar uma nova música com sucesso (Mock CRUD)', async ({ page }) => {
    await page.route('**/musicas/', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 200, headers: corsHeaders });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ id: 9999, nome: 'Canção de Teste E2E', artista: 'Banda E2E', tags: 'louvor', owner_id: 1 })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/musicas', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 200, headers: corsHeaders });
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 9999, nome: 'Canção de Teste E2E', artista: 'Banda E2E', tags: 'louvor', owner_id: 1 }
          ])
        });
      } else {
        await route.continue();
      }
    });

    await page.locator('button', { hasText: 'Adicionar Música' }).click();
    
    await page.locator('input[placeholder*="A Ele a Gl"]').fill('Canção de Teste E2E');
    await page.locator('input[placeholder*="Diante do Trono"]').fill('Banda E2E');
    await page.locator('input[placeholder*="exaltação, animada, deus"]').fill('louvor');

    await page.locator('button', { hasText: 'Salvar Música' }).click();

    await expect(page.locator('button', { hasText: 'Salvar Música' })).not.toBeVisible();
    await expect(page.getByText('Canção de Teste E2E')).toBeVisible();
  });
});
