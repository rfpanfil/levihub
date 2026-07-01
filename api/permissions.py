import json
from fastapi import HTTPException

def verificar_permissao(slug_exigido: str, current_user: dict):
    """
    Verifica se o usuário atual possui a permissão especificada (slug).
    Usuários com role 'admin' ou 'superadmin' têm acesso irrestrito.
    """
    if current_user.get("role") in ["admin", "superadmin"]:
        return True

    user_slugs = []
    slugs_raw = current_user.get("slugs")
    if slugs_raw:
        if isinstance(slugs_raw, str):
            try:
                user_slugs = json.loads(slugs_raw)
            except:
                pass
        elif isinstance(slugs_raw, list):
            user_slugs = slugs_raw

    if slug_exigido not in user_slugs:
        raise HTTPException(
            status_code=403, 
            detail=f"Acesso negado. Você precisa da permissão: {slug_exigido}"
        )
    
    return True
