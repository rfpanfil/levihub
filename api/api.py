# arquivo: api/api.py
# ARQUIVO LEGADO — mantido apenas para compatibilidade reversa.
#
# O código foi refatorado para uma arquitetura modular. O novo ponto de
# entrada é api/main.py. Este arquivo re-exporta o `app` para que qualquer
# processo que ainda referencie `uvicorn api.api:app` continue funcionando.
#
# Após validar a produção, este arquivo pode ser removido com segurança.
#
# Novo comando de start: uvicorn api.main:app --host 0.0.0.0 --port $PORT

from api.main import app  # noqa: F401  (re-exportação intencional)