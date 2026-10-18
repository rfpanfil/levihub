import { test, expect } from '@playwright/test';
import path from 'path';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://levihub.vercel.app',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

test.describe('Repertório de Músicas (CRUD e Edição em Massa)', () => {
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
          body: JSON.stringify({ id: 1, email: 'e2e@teste.com', role: 'admin', nome: 'QA Bot' })
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/');
    await expect(page.getByText('Sair')).toBeVisible({ timeout: 10000 });

    const btnRepertorio = page.locator('button.nav-item').filter({ hasText: /Repert.rio/i });
    await btnRepertorio.waitFor({ state: 'visible' });
    await btnRepertorio.click();
  });

  test('deve criar uma nova música com múltiplas categorias e tema central obrigatório (Mock CRUD)', async ({ page }) => {
    await page.route('**/musicas/custom', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({
            musicas: [
              {
                id: 101,
                nome_musica: 'Vitória no Deserto',
                artista: 'Aline Barros',
                tags: 'vitoria, fe',
                categorias: ['agitadas1', 'junina'],
                tema_central: 'Vitória e Fé'
              }
            ]
          })
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 9999,
            nome_musica: 'Canção de Teste E2E',
            artista: 'Banda E2E',
            tags: 'louvor',
            categorias: ['agitadas1', 'Louvor Especial'],
            tema_central: 'Adoração',
            owner_id: 1
          })
        });
      } else {
        await route.fallback();
      }
    });

    await page.route('**/categorias', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({
            categorias: [
              { id: 1, nome: 'agitadas1' },
              { id: 2, nome: 'junina' }
            ]
          })
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ id: 99, nome: 'Louvor Especial' })
        });
      } else {
        await route.fallback();
      }
    });

    await page.locator('button', { hasText: 'Adicionar Música' }).click();

    await page.locator('input[placeholder*="A Ele a Gl"]').fill('Canção de Teste E2E');
    await page.locator('input[placeholder*="Diante do Trono"]').fill('Banda E2E');
    await page.locator('input[placeholder*="exaltação, animada, deus"]').fill('louvor, adoracao');
    await page.locator('input[placeholder*="Cole a URL do"]').fill('https://youtube.com/watch?v=123');

    // Seleciona categoria existente + cria nova categoria inline (múltipla seleção)
    await page.locator('button', { hasText: 'Criar Nova Categoria' }).click();
    await page.locator('input[placeholder*="pascoa"]').fill('Louvor Especial');

    // Seleciona/cria Tema Central obrigatório (fora dos campos avançados)
    await page.locator('button', { hasText: 'Criar Novo Tema Central' }).click();
    await page.locator('input[placeholder*="Santificação"]').fill('Adoração');

    await page.locator('button', { hasText: 'Salvar Música' }).click();
    await expect(page.locator('button', { hasText: 'Salvar Música' })).not.toBeVisible();
  });

  test('deve abrir Edição em Massa, filtrar músicas, analisar planilha e aprovar mudanças', async ({ page }) => {
    await page.route('**/musicas/custom', async route => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          musicas: [
            {
              id: 101,
              nome_musica: 'A Alegria',
              artista: 'Projeto Sola',
              tags: 'alegria, jubilo',
              categorias: ['agitadas1'],
              tema_central: 'Alegria',
              ultimo_planejamento_em: null,
              ultimo_periodo_nome: null
            }
          ]
        })
      });
    });

    await page.route('**/categorias', async route => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({ categorias: [{ id: 1, nome: 'agitadas1' }] })
      });
    });

    await page.route('**/excel/bulk-preview', async route => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              musica_id: 101,
              nome_musica: 'A Alegria',
              artista: 'Projeto Sola',
              changes: [
                {
                  field: 'tema_central',
                  label: 'Tema Central',
                  old_value: 'Alegria',
                  new_value: 'Júbilo',
                  message: 'Música "A Alegria" mudará de Tema Central de "Alegria" para "Júbilo"'
                }
              ]
            }
          ],
          total_linhas_analisadas: 1,
          campos_detectados: ['Tema Central']
        })
      });
    });

    await page.route('**/excel/bulk-commit', async route => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Edição em massa concluída! 1 música(s) atualizada(s) (1 alteração(ões) aplicada(s)).',
          updated: 1,
          total_changes: 1
        })
      });
    });

    page.on('dialog', dialog => dialog.accept());

    // Abre modal de Edição em Massa
    await page.locator('button', { hasText: 'Editar em Massa' }).click();
    await expect(page.getByText('Editar Repertório em Massa (via Excel)')).toBeVisible();

    // Vai para a Aba 2 (Enviar Excel Editado e Aprovar Mudanças)
    await page.locator('button', { hasText: '2️⃣ Enviar Excel Editado e Aprovar Mudanças' }).click();

    const dummyXlsx = path.resolve(__dirname, '../fixtures/dummy.xlsx');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'Edicao_Em_Massa_LeviHub.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04dummy')
    });

    await page.locator('button', { hasText: 'Analisar Mudanças da Planilha' }).click();

    await expect(page.getByText('Relatório de Alterações Detectadas')).toBeVisible();
    await expect(page.getByText('Júbilo')).toBeVisible();

    await page.locator('button', { hasText: /Aprovar e Aplicar/i }).click();
    await expect(page.getByText('Editar Repertório em Massa (via Excel)')).not.toBeVisible();
  });
});
