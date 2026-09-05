import { test, expect } from '@playwright/test';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://levihub.vercel.app',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

test.describe('Perfil do Usuário', () => {
  test.beforeEach(async ({ page }) => {
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
          body: JSON.stringify({ id: 1, email: 'me@levihub.com', role: 'admin', nome: 'Meu Nome' })
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/');
    await expect(page.getByText('Sair')).toBeVisible({ timeout: 10000 });
  });

  test('deve editar o proprio perfil', async ({ page }) => {
    await page.route('**/usuario/credenciais', async route => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Profile updated' })
        });
      } else {
        await route.fallback();
      }
    });

    await page.locator('button.nav-item').filter({ hasText: 'Perfil' }).click();

    // Click on Alterar E-mail ou Senha first
    await page.locator('button').filter({ hasText: 'Alterar E-mail ou Senha' }).click();

    await page.screenshot({ path: 'debug-perfil.png' });
    await page.locator('input[type="email"]').fill('novo_email@levihub.com');
    await page.locator('input[type="password"]').fill('novasenha123');

    await page.locator('button').filter({ hasText: 'Salvar Alterações' }).click();
    await expect(page.getByText('Credenciais atualizadas com sucesso!')).toBeVisible({ timeout: 10000 });
  });
});
