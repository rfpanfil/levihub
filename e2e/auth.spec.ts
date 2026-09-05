import { test, expect } from '@playwright/test';

test.describe('Autenticação e Acesso', () => {
  test('deve acessar o sistema como visitante com sucesso', async ({ page }) => {
    await page.goto('/');
    
    // Verifica se a tela de login carregou
    await expect(page.getByText('Seja bem-vindo')).toBeVisible();
    
    // Clica no botão de visitante
    await page.click('button:has-text("Entrar como Visitante")');
    
    // Verifica se foi para a dashboard e se o banner de visitante aparece
    await expect(page.getByText('Você está no modo Visitante')).toBeVisible();
  });

  test('tela de recuperação de senha deve exibir formulário', async ({ page }) => {
    await page.goto('/');
    
    // Clica em esqueci a senha
    await page.click('text=Esqueceu sua senha?');
    
    // Verifica se a tela mudou
    await expect(page.getByText('Verificação de Segurança')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
