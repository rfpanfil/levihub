import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.describe('Gerador de Escalas', () => {
  test('no mobile (360px) deve baixar a imagem da escala inteira sem corte horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });

    const funcoesNomes = [
      'Voz e violão',
      'Crianças - Voz e violão',
      'Mídia',
      'Voz 1',
      'Voz 2',
      'Voz 3',
      'Guitarra',
      'Baixo',
      'Bateria',
    ];
    const ordemMatriz = funcoesNomes.map((nome, idx) => ({
      id: String(idx + 1),
      label: nome,
      aceita: [nome],
    }));

    const hoje = new Date();
    const mes = hoje.getMonth();
    const ano = hoje.getFullYear();
    const diasKeys: string[] = [];
    const cursor = new Date(ano, mes, 1);
    while (cursor.getMonth() === mes) {
      if (cursor.getDay() === 0) {
        diasKeys.push(`${cursor.getDate()}-${cursor.getMonth()}-${cursor.getFullYear()}`);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const escalaObj: Record<string, any[]> = {};
    diasKeys.forEach((dk) => {
      escalaObj[dk] = ordemMatriz.map((v, idx) => ({
        vaga: v,
        membro: { id: idx + 1, nome: idx % 3 === 0 ? 'Lucas' : 'Rafael' },
      }));
    });

    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://levihub.vercel.app',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    await page.route('**/*', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 200, headers: corsHeaders });
      } else {
        await route.fallback();
      }
    });

    await page.route('**/usuario/me', async (route) => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          email: 'me@levihub.com',
          role: 'admin',
          funcoes_padrao: funcoesNomes.join(','),
        }),
      });
    });

    await page.route('**/equipe', async (route) => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          equipe: [
            { id: 1, nome: 'Lucas', funcoes: funcoesNomes },
            { id: 2, nome: 'Rafael', funcoes: funcoesNomes },
          ],
        }),
      });
    });

    await page.route('**/funcoes', async (route) => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          funcoes: funcoesNomes.map((n, i) => ({
            id: i + 1,
            nome: n,
            permitidas_acumular: [],
            obrigatorias_acumular: [],
          })),
        }),
      });
    });

    await page.route('**/escala/vagas**', async (route) => {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ vagas_por_dia: {} }) });
    });

    await page.route('**/escala/disponibilidades**', async (route) => {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ indisponibilidades: {} }) });
    });

    await page.route('**/escala/regras**', async (route) => {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ regras: [] }) });
    });

    await page.route('**/escala/matriz**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({
            escalas_geradas: [escalaObj],
            ordem_matriz: ordemMatriz,
            escala_atual_index: 0,
          }),
        });
      } else {
        await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      }
    });

    await page.goto('/');
    await page.locator('button.nav-item').filter({ hasText: /Escalas/i }).click();
    await expect(page.locator('#escala-resultado-matriz')).toBeVisible();

    // Simula scroll horizontal no container mobile e scroll vertical até o botão
    await page.locator('#escala-resultado-matriz').evaluate((el) => {
      el.scrollLeft = 240;
    });

    const btnImprimir = page.getByRole('button', { name: /Imprimir \/ Baixar Imagem/i });
    await btnImprimir.scrollIntoViewIfNeeded();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      btnImprimir.click(),
    ]);

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const buf = fs.readFileSync(filePath!);
    const pngWidth = buf.readUInt32BE(16);
    expect(pngWidth).toBeGreaterThan(1100);
  });

  test('deve adicionar instrumento esquecido em um dia ou no mês todo sem alterar a escala já otimizada', async ({ page }) => {
    const hoje = new Date();
    const mes = hoje.getMonth();
    const ano = hoje.getFullYear();
    const diasKeys: string[] = [];
    const cursor = new Date(ano, mes, 1);
    while (cursor.getMonth() === mes) {
      if (cursor.getDay() === 0) {
        diasKeys.push(`${cursor.getDate()}-${cursor.getMonth()}-${cursor.getFullYear()}`);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const vagaVozViolao = { id: '1', label: 'Voz e violão', aceita: ['Voz e violão'] };
    const escalaOtimizada: Record<string, any[]> = {};
    diasKeys.forEach((dk, idx) => {
      escalaOtimizada[dk] = [
        { vaga: vagaVozViolao, membro: { id: idx === 0 ? 1 : 2, nome: idx === 0 ? 'LucasOtimizado' : 'RafaelOtimizado' } },
      ];
    });

    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://levihub.vercel.app',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    await page.route('**/*', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 200, headers: corsHeaders });
      } else {
        await route.fallback();
      }
    });

    await page.route('**/usuario/me', async (route) => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, email: 'me@levihub.com', role: 'admin', funcoes_padrao: 'Voz e violão' }),
      });
    });

    await page.route('**/equipe', async (route) => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          equipe: [
            { id: 1, nome: 'LucasOtimizado', funcoes: ['Voz e violão'] },
            { id: 2, nome: 'RafaelOtimizado', funcoes: ['Voz e violão'] },
            { id: 3, nome: 'EsterViolino', funcoes: ['Violino'] },
          ],
        }),
      });
    });

    await page.route('**/funcoes', async (route) => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          funcoes: [
            { id: 1, nome: 'Voz e violão', permitidas_acumular: [], obrigatorias_acumular: [] },
            { id: 99, nome: 'Violino', permitidas_acumular: [], obrigatorias_acumular: [] },
          ],
        }),
      });
    });

    await page.route('**/escala/vagas**', async (route) => {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ vagas_por_dia: {} }) });
    });
    await page.route('**/escala/disponibilidades**', async (route) => {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ indisponibilidades: {} }) });
    });
    await page.route('**/escala/regras**', async (route) => {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ regras: [] }) });
    });
    await page.route('**/escala/matriz**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({
            escalas_geradas: [escalaOtimizada],
            ordem_matriz: [vagaVozViolao],
            escala_atual_index: 0,
          }),
        });
      } else {
        await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      }
    });

    await page.goto('/');
    await page.locator('button.nav-item').filter({ hasText: /Escalas/i }).click();
    await expect(page.locator('#escala-resultado-matriz')).toContainText('LucasOtimizado');

    // Adiciona "Violino" apenas no 1º domingo sem clicar em Gerar Escala Automática
    const primeiroDiaKey = diasKeys[0];
    await page.locator(`#select_${primeiroDiaKey}`).selectOption('99');
    await page.locator(`#select_${primeiroDiaKey}`).locator('..').getByRole('button', { name: 'Adicionar' }).click();

    // Verifica que Violino + EsterViolino entraram na matriz e que LucasOtimizado / RafaelOtimizado permaneceram intactos!
    const matriz = page.locator('#escala-resultado-matriz');
    await expect(matriz).toContainText('Violino');
    await expect(matriz).toContainText('EsterViolino');
    await expect(matriz).toContainText('LucasOtimizado');
    await expect(matriz).toContainText('RafaelOtimizado');
  });

  test('no mobile deve permitir reordenar funções verticalmente arrastando pelo ícone ☰ com toque', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    const funcoesNomes = ['Voz e violão', 'Mídia', 'Baixo', 'Bateria', 'Som'];
    const ordemMatriz = funcoesNomes.map((nome, idx) => ({
      id: String(idx + 1),
      label: nome,
      aceita: [nome],
    }));

    const hoje = new Date();
    const mes = hoje.getMonth();
    const ano = hoje.getFullYear();
    const diasKeys: string[] = [];
    const cursor = new Date(ano, mes, 1);
    while (cursor.getMonth() === mes) {
      if (cursor.getDay() === 0) {
        diasKeys.push(`${cursor.getDate()}-${cursor.getMonth()}-${cursor.getFullYear()}`);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const escalaObj: Record<string, any[]> = {};
    diasKeys.forEach((dk) => {
      escalaObj[dk] = ordemMatriz.map((v, idx) => ({
        vaga: v,
        membro: { id: idx + 1, nome: idx % 2 === 0 ? 'Lucas' : 'Rafael' },
      }));
    });

    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://levihub.vercel.app',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    let ultimaOrdemSalva: string[] = [];

    await page.route('**/*', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 200, headers: corsHeaders });
      } else {
        await route.fallback();
      }
    });

    await page.route('**/usuario/me', async (route) => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, email: 'me@levihub.com', role: 'admin', funcoes_padrao: funcoesNomes.join(',') }),
      });
    });

    await page.route('**/equipe', async (route) => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          equipe: [
            { id: 1, nome: 'Lucas', funcoes: funcoesNomes },
            { id: 2, nome: 'Rafael', funcoes: funcoesNomes },
          ],
        }),
      });
    });

    await page.route('**/funcoes', async (route) => {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify({
          funcoes: funcoesNomes.map((n, i) => ({ id: i + 1, nome: n, permitidas_acumular: [], obrigatorias_acumular: [] })),
        }),
      });
    });

    await page.route('**/escala/vagas**', async (route) => {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ vagas_por_dia: {} }) });
    });
    await page.route('**/escala/disponibilidades**', async (route) => {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ indisponibilidades: {} }) });
    });
    await page.route('**/escala/regras**', async (route) => {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ regras: [] }) });
    });
    await page.route('**/escala/matriz**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: 'application/json',
          body: JSON.stringify({ escalas_geradas: [escalaObj], ordem_matriz: ordemMatriz, escala_atual_index: 0 }),
        });
      } else {
        const payload = JSON.parse(route.request().postData() || '{}');
        ultimaOrdemSalva = (payload.ordem_matriz || []).map((v: any) => v.label);
        await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      }
    });

    await page.goto('/');
    await page.locator('button.nav-item').filter({ hasText: /Escalas/i }).first().click();
    await expect(page.locator('#escala-resultado-matriz')).toBeVisible();
    await page.locator('#escala-resultado-matriz').scrollIntoViewIfNeeded();

    const somHandle = page.getByRole('button', { name: 'Arrastar função Som para cima ou para baixo' });
    const midiaRow = page.locator('#escala-resultado-matriz tbody tr').nth(1);
    const startBox = await somHandle.boundingBox();
    const targetBox = await midiaRow.boundingBox();
    expect(startBox).toBeTruthy();
    expect(targetBox).toBeTruthy();

    const cdp = await context.newCDPSession(page);
    const x = Math.round(startBox!.x + startBox!.width / 2);
    const startY = Math.round(startBox!.y + startBox!.height / 2);
    const endY = Math.round(targetBox!.y + targetBox!.height / 2);

    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: startY, radiusX: 5, radiusY: 5, id: 1 }],
    });
    for (let step = 1; step <= 6; step++) {
      const curY = Math.round(startY + ((endY - startY) * step) / 6);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: curY, radiusX: 5, radiusY: 5, id: 1 }],
      });
      await page.waitForTimeout(25);
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    await expect(page.locator('#escala-resultado-matriz tbody tr').nth(1).locator('td').first()).toContainText('Som');
    await expect.poll(() => ultimaOrdemSalva[1]).toBe('Som');
    await context.close();
  });
});
