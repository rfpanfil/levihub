import { useQueryClient } from '@tanstack/react-query';

export function useCan() {
  const queryClient = useQueryClient();
  
  // Pegamos o usuário que já foi fetcheado pelo App.jsx (em cache)
  const user = queryClient.getQueryData(['usuario']);

  const can = (slug) => {
    if (!user) return false;
    
    // Admins e superadmins sempre podem tudo
    if (user.role === 'admin' || user.role === 'superadmin') {
      return true;
    }

    // Se o usuário tiver um array de slugs
    let userSlugs = [];
    if (user.slugs) {
      if (typeof user.slugs === 'string') {
        try {
          userSlugs = JSON.parse(user.slugs);
        } catch (e) {
          // parse error
        }
      } else if (Array.isArray(user.slugs)) {
        userSlugs = user.slugs;
      }
    }

    return userSlugs.includes(slug);
  };

  return can;
}
