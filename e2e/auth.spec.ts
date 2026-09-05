import { test, expect } from '@playwright/test';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://levihub.vercel.app',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

test.describe('Autenticação Total', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 200, headers: corsHeaders });
      } else {
        await route.fallback();
      }
    });
    
    // Login inicia sem usuario/me para forçar a tela de Login
    await page.route('**/usuario/me', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 401, headers: corsHeaders });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/');
  });

  test('deve preencher cadastro, código de verificacao e realizar login', async ({ page }) => {
    // 1. Clica em Criar Conta
    await page.locator('span', { hasText: 'Criar Conta' }).click();

    // 2. Preenche Cadastro
    await page.route('**/auth/register', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'User registered' })
        });
      } else {
        await route.fallback();
      }
    });

    await page.locator('input[type="email"]').fill('e2e@teste.com');
    await page.locator('input[type="password"]').first().fill('senha123');
    await page.locator('input[type="password"]').nth(1).fill('senha123');
    await page.locator('button', { hasText: 'Cadastrar' }).click();

    // 3. Recebe código de verificação
    await page.route('**/auth/verify', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Verified' })
        });
      } else {
        await route.fallback();
      }
    });
    await page.locator('input[maxLength="6"]').fill('123456');
    await page.locator('button', { hasText: 'Confirmar' }).click();

    // 4. Faz Login
    await page.route('**/auth/login', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ access_token: 'fake', token_type: 'bearer' })
        });
      } else {
        await route.fallback();
      }
    });

    await page.locator('input[type="email"]').fill('e2e@teste.com');
    await page.locator('input[type="password"]').first().fill('senha123');
    
    // Altera o mock de usuario/me para retornar success apos o login
    await page.route('**/usuario/me', async route => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, email: 'e2e@teste.com', role: 'admin' })
      });
    });

    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    
    // Espera entrar
    await expect(page.getByText('Sair')).toBeVisible({ timeout: 10000 });
  });
});
