import { test, expect } from '@playwright/test';

test.describe('Autenticação e Acesso', () => {
  test('deve acessar o sistema como visitante com sucesso', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.getByText('Seja bem-vindo')).toBeVisible();
    await page.click('button:has-text("Entrar como Visitante")');
    await expect(page.getByText('Você está no modo Visitante')).toBeVisible();
  });

  test('tela de recuperação de senha deve exibir formulário', async ({ page }) => {
    await page.goto('/');
    
    await page.click('text=Esqueci minha senha');
    await expect(page.getByText('Verificação de Segurança')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
