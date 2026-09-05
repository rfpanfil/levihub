import { test, expect } from '@playwright/test';

test.describe('Autenticação e Acesso', () => {
  test('deve acessar o sistema como visitante com sucesso', async ({ page }) => {
    await page.goto('/');
    
    // O texto correto na tela de login
    await expect(page.getByText('Sua escala e repertório em um só lugar')).toBeVisible();
    await page.click('button:has-text("Entrar como Visitante")');
    // Verifica texto no App principal após login
    await expect(page.getByText('Você está no modo Visitante')).toBeVisible();
  });

  test('tela de recuperação de senha deve exibir formulário inicial', async ({ page }) => {
    await page.goto('/');
    
    await page.click('text=Esqueci minha senha');
    // O título antes de enviar o e-mail é esse:
    await expect(page.getByText('Digite seu e-mail para receber um código de recuperação')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
