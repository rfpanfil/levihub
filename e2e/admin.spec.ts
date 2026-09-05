import { test, expect } from '@playwright/test';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://levihub.vercel.app',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 200, headers: corsHeaders });
      } else {
        await route.fallback();
      }
    });
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('requestfailed', request => console.log('REQ FAILED:', request.url(), request.failure()?.errorText));
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log('REQ 400+:', response.url(), response.status());
      }
    });

    await page.route('**/usuario/me', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ id: 1, email: 'admin@levihub.com', role: 'admin', nome: 'Admin Supremo' })
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/');
    await expect(page.getByText('Sair')).toBeVisible({ timeout: 10000 });
  });

  test('deve atualizar email e senha de um usuario', async ({ page }) => {
    await page.route('**/admin/usuarios', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ usuarios: [{ id: 2, email: 'user@teste.com', role: 'user', created_at: '2023-01-01' }] })
        });
      } else {
        await route.fallback();
      }
    });

    await page.route('**/admin/usuarios/2', async route => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'User updated' })
        });
      } else {
        await route.fallback();
      }
    });

    await page.locator('button.nav-item').filter({ hasText: 'Admin' }).click();

    // Clica no botão Editar
    await page.screenshot({ path: 'debug-admin.png' });
    await page.locator('button').filter({ hasText: 'Editar' }).first().click();

    // Preenche campos
    await page.locator('input[type="email"]').fill('novo@teste.com');
    await page.locator('input[placeholder="Nova Senha (Opcional)"]').fill('senha123');

    // Salvar
    await page.locator('button').filter({ hasText: 'Salvar' }).click();
    
    // Verifica mensagem de sucesso
    await expect(page.locator('button').filter({ hasText: 'Salvar' })).not.toBeVisible();
  });
});
