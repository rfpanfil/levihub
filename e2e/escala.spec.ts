import { test, expect } from '@playwright/test';

test.describe('Gerador de Escalas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Entrar como Visitante")');
    await page.click('text=Escalas');
  });

  test('deve renderizar os passos do gerador de escalas', async ({ page }) => {
    // Passo 1: Configuração de Datas
    await expect(page.getByText('Mês da Escala')).toBeVisible();
    await expect(page.getByText('Dias de Culto')).toBeVisible();
    
    // Avançar para Vagas
    await page.click('button:has-text("Próximo")');
    await expect(page.getByText('Distribuição de Vagas')).toBeVisible();
  });
});
