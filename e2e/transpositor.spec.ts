import { test, expect } from '@playwright/test';
import path from 'path';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://levihub.vercel.app',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

test.describe('Transpositor (File Upload & Funcionalidades)', () => {
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
          body: JSON.stringify({ id: 1, email: 'me@levihub.com', role: 'admin', nome: 'Meu Nome' })
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/');
    await expect(page.getByText('Sair')).toBeVisible({ timeout: 10000 });
  });

  test('deve preencher cifra manualmente e realizar upload de arquivo de cifra (Mock CRUD e Uploads)', async ({ page }) => {
    const btnTranspositor = page.locator('button.nav-item').filter({ hasText: 'Transpositor' });
    await btnTranspositor.waitFor({ state: 'visible' });
    await btnTranspositor.click();
    await page.getByText('Transpor Cifra Completa').click();
    
    // Testa preenchimento 100% de cifra
    await page.locator('textarea.cifra-textarea').fill('[C] Te adorarei [G] Meu Rei');
    
    // Simula a interceptação da API do transpositor (caso tenha)
    await page.route('**/transpor', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ cifra_transposta: '[D] Te adorarei [A] Meu Rei' })
        });
      } else {
        await route.fallback();
      }
    });

    // Clica no botão transpor
    await page.getByRole('button', { name: 'Transpor Cifra!' }).click();

    // Testa Upload de Arquivo
    const dummyTxt = path.resolve(__dirname, '../fixtures/dummy.txt');
    await page.locator('input[type="file"]').setInputFiles(dummyTxt);
    
    // Verifica se o arquivo foi carregado (ele deve limpar o textarea ou aparecer na tela)
    await expect(page.getByText('dummy.txt')).toBeVisible({ timeout: 5000 });
  });
});
