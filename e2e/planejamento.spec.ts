import { test, expect } from '@playwright/test';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://levihub.vercel.app',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

test.describe('Planejador de Repertório e Escala de Domingos (WhatsApp)', () => {
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
          body: JSON.stringify({ id: 1, email: 'teste@levihub.com', role: 'admin', nome: 'QA Bot' })
        });
      } else {
        await route.fallback();
      }
    });

    await page.route('**/usuario/preferencias-planejamento', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({
            preferencias: {
              whats_opts: { artista: true, tom: true, link: true, primeira_linha: false },
              visible_cols: ['artista', 'tom', 'categoria', 'tema_central']
            }
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'ok' })
        });
      }
    });

    await page.route('**/planejamento/', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ periodos: [{ id: 1, nome: '2º Semestre 2026', criado_em: '2026-07-01' }] })
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'ok', id: 2 })
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/');
    await expect(page.getByText('Sair')).toBeVisible({ timeout: 10000 });

    const btnPlanejamento = page.locator('button.nav-item').filter({ hasText: /Planejamento/i });
    await btnPlanejamento.waitFor({ state: 'visible' });
    await btnPlanejamento.click();
  });

  test('deve criar período, filtrar e salvar músicas no planejamento e escalar domingo p/ WhatsApp', async ({ page }) => {
    await page.route('**/planejamento/1/musicas', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({
            musicas: [],
            programacao_cultos: []
          })
        });
      } else if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Planejamento salvo com sucesso!' })
        });
      } else {
        await route.fallback();
      }
    });

    await page.route('**/musicas/custom', async route => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          musicas: [
            {
              id: 501,
              nome_musica: 'Bondade de Deus',
              artista: 'Isaías Saad',
              tom: 'G',
              categorias: ['lentas1'],
              tema_central: 'Fidelidade e Bondade de Deus',
              tags: 'bondade, fidelidade',
              ultimo_planejamento_em: null,
              ultimo_periodo_nome: null
            }
          ]
        })
      });
    });

    // Abre o período existente
    await page.getByText('2º Semestre 2026').click();
    await expect(page.getByRole('button', { name: /Adicionar Música/i })).toBeVisible();

    // Abre modal de seleção com filtros múltiplos (painel já inicia expandido)
    await page.getByRole('button', { name: /Adicionar Música/i }).click();
    await expect(page.getByRole('button', { name: 'Fidelidade e Bondade de Deus' })).toBeVisible();

    // Seleciona a música em rascunho e fecha o modal
    await page.getByRole('button', { name: '+ Selecionar' }).click();
    await page.getByRole('button', { name: /Concluir Seleção/i }).click();

    // Efetiva o salvamento no banco
    await page.getByRole('button', { name: /Salvar Planejamento/i }).first().click();
    await expect(page.getByText('Salvo ✓')).toBeVisible();
  });
});
