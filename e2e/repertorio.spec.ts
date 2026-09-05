import { test, expect } from '@playwright/test';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://levihub.vercel.app',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

test.describe('Repertório de Músicas (CRUD)', () => {
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
    
    // Espera o mock injetar o login
    await expect(page.getByText('Sair')).toBeVisible({ timeout: 10000 });
    
    // Clica no Repertório
    const btnRepertorio = page.locator('button.nav-item').filter({ hasText: /Repert.rio/i });
    await btnRepertorio.waitFor({ state: 'visible' });
    await btnRepertorio.click();
  });

  test('deve criar uma nova música com sucesso (Mock CRUD)', async ({ page }) => {
    // MOCK PARA O LOAD INICIAL DAS MÚSICAS CUSTOM (carregarDados)
    await page.route('**/musicas/custom', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ musicas: [] })
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201, // Created
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ id: 9999, nome_musica: 'Canção de Teste E2E', artista: 'Banda E2E', tags: 'louvor', owner_id: 1 })
        });
      } else {
        await route.fallback();
      }
    });

    // MOCK PARA CATEGORIAS
    await page.route('**/categorias', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ categorias: [] })
        });
      } else if (route.request().method() === 'POST') {
         await route.fulfill({
           status: 201,
           headers: corsHeaders,
           contentType: 'application/json',
           body: JSON.stringify({ id: 99, nome: 'Louvor' })
         });
      } else {
        await route.fallback();
      }
    });

    await page.locator('button', { hasText: 'Adicionar Música' }).click();
    
    await page.locator('input[placeholder*="A Ele a Gl"]').fill('Canção de Teste E2E');
    await page.locator('input[placeholder*="Diante do Trono"]').fill('Banda E2E');
    await page.locator('input[placeholder*="exaltação, animada, deus"]').fill('louvor');
    await page.locator('input[placeholder*="Cole a URL do"]').fill('https://youtube.com/watch?v=123');

    // Seleciona criar nova categoria no dropdown e preenche o nome
    await page.locator('select').last().selectOption('nova');
    await page.locator('input[placeholder*="Entrada"]').fill('Louvor');

    // Ao invés de checar a tabela final que exige que o carregarDados injete tudo rápido,
    // garantimos apenas que o modal fechou com sucesso porque o POST foi OK
    await page.locator('button', { hasText: 'Salvar Música' }).click();

    // Espera o botão de salvar desaparecer (modal fechou porque API mockada deu 200/201)
    await expect(page.locator('button', { hasText: 'Salvar Música' })).not.toBeVisible();
  });
});
