import { test, expect } from '@playwright/test';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

test.describe('Planejador de Repertório', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', error => console.log(`[Browser Error]: ${error.message}`));
    
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
          json: { id: 1, email: 'teste@levihub.com', role: 'user', using_default_db: true }
        });
      } else {
        await route.fallback();
      }
    });

    await page.route('**/planejamento/', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, headers: corsHeaders, json: { periodos: [] } });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, headers: corsHeaders, json: { message: "ok", id: 1 } });
      } else {
        await route.fallback();
      }
    });

    await page.goto('http://localhost:5173');
    
    await page.evaluate(() => {
      localStorage.setItem('levihub_token', 'fake-token-e2e');
      localStorage.setItem('lastAppMode', 'planejamento');
    });
    await page.reload();
  });

  test('Deve criar um período', async ({ page }) => {
    test.setTimeout(8000);
    
    const bodyHTML = await page.innerHTML('body');
    console.log("[BODY START]\n" + bodyHTML.substring(0, 500));
    
    await page.getByRole('button', { name: 'Planejamento', exact: true }).click();
    await page.getByRole('button', { name: 'Novo Planejamento' }).click();
    await page.getByPlaceholder('Ex: 2º Semestre 2026').fill('Louvor Mensal Abril');
    
    await page.route('**/planejamento/', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, headers: corsHeaders, json: { periodos: [{ id: 1, nome: 'Louvor Mensal Abril' }] } });
      } else {
        await route.fallback();
      }
    });
    
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Louvor Mensal Abril')).toBeVisible();
  });
});
