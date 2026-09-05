import { test, expect } from '@playwright/test';

test.describe('Levi Roboto - Transposição', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Entrar como Visitante")');
    await page.click('text=Levi Roboto');
  });

  test('deve renderizar controles de transposição de cifras', async ({ page }) => {
    await expect(page.getByText('Transposição de Cifras e Arquivos')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.getByText('Subir Tom')).toBeVisible();
    await expect(page.getByText('Descer Tom')).toBeVisible();
  });

  test('deve aceitar upload de arquivos docx', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Escolher arquivo');
    const fileChooser = await fileChooserPromise;
    expect(fileChooser.isMultiple()).toBe(false);
    // Simula validação visual do botão de envio
    await expect(page.getByText('Transpor Documento')).toBeVisible();
  });
});
