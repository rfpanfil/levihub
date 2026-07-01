from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import cloudinary
import cloudinary.uploader

from api.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
from api.security import get_current_user

router = APIRouter(prefix="/upload", tags=["Uploads"])

# Configuração do Cloudinary
if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET
    )

@router.post("/")
async def upload_imagem(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Recebe um arquivo e faz o upload para o Cloudinary.
    Retorna a URL segura (HTTPS) da imagem hospedada.
    """
    if not CLOUDINARY_CLOUD_NAME:
        raise HTTPException(status_code=500, detail="Cloudinary não está configurado.")

    try:
        # Lê os bytes do arquivo enviado
        contents = await file.read()
        
        # Faz o upload para o Cloudinary na pasta 'levihub'
        result = cloudinary.uploader.upload(
            contents,
            folder="levihub",
            public_id=file.filename.split(".")[0], # Tenta usar o nome original
            resource_type="auto"
        )
        
        return {
            "message": "Upload realizado com sucesso",
            "url": result.get("secure_url"),
            "format": result.get("format")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no upload: {str(e)}")
