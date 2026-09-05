import { test, expect } from '@playwright/test';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://levihub.vercel.app',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

test.describe('Gestão de Membros (CRUD)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercepta OPTIONS globalmente para contornar CORS nos testes
    await page.route('**/*', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 200, headers: corsHeaders });
      } else {
        await route.fallback();
      }
    });

    await page.route('**/usuario/me', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ id: 1, email: 'e2e@teste.com', role: 'admin', nome: 'QA Bot' })
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/');
    
    // Espera o login ser bem-sucedido via mock
    await expect(page.getByText('Sair')).toBeVisible({ timeout: 10000 });
    
    const btnMembros = page.locator('button.nav-item').filter({ hasText: 'Membros' });
    await btnMembros.waitFor({ state: 'visible' });
    await btnMembros.click();
  });

  test('deve criar um novo membro preenchendo formulário completo (Mock CRUD)', async ({ page }) => {
    // A API DE MEMBROS É /equipe
    await page.route('**/equipe', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ id: 8888, nome: 'Lucas Silva E2E', email: 'lucas@e2e.com', owner_id: 1, ativo: true })
        });
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 8888, nome: 'Lucas Silva E2E', ativo: true, funcoes: [] }
          ])
        });
      } else {
        await route.fallback();
      }
    });

    // A API TAMBÉM CHAMA /funcoes_padrao
    await page.route('**/funcoes_padrao', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      } else {
        await route.fallback();
      }
    });

    await page.locator('button', { hasText: 'Adicionar Membro' }).click();
    
    await page.locator('input[placeholder="Ex: Lucas Silva"]').fill('Lucas Silva E2E');
    await page.locator('input[placeholder="email@exemplo.com"]').fill('lucas@e2e.com');
    await page.locator('input[placeholder="(DD) 99999-9999"]').fill('(11) 99999-9999');

    await page.locator('button', { hasText: 'Salvar Membro' }).click();

    // Verifica que o modal fechou com sucesso
    await expect(page.locator('button', { hasText: 'Salvar Membro' })).not.toBeVisible();
  });
});
