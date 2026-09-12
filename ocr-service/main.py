from fastapi import FastAPI, UploadFile, File, HTTPException
from PIL import Image
import pytesseract
import io
import os

app = FastAPI(
    title="PharmaFlow OCR Service",
    version="2.0.0"
)

TESSERACT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

if os.path.exists(TESSERACT_PATH):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH


@app.get("/health")
def health():
    try:
        version = str(pytesseract.get_tesseract_version())
        return {
            "status": "ok",
            "service": "ocr-service",
            "engine": "Tesseract OCR",
            "version": version
        }
    except Exception as e:
        return {
            "status": "degraded",
            "service": "ocr-service",
            "error": str(e)
        }


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")

    allowed = {
        "image/jpeg",
        "image/png",
        "image/jpg"
    }

    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail="OCR currently supports JPG and PNG prescription images"
        )

    try:
        content = await file.read()

        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        image = Image.open(io.BytesIO(content))
        image = image.convert("RGB")

        text = pytesseract.image_to_string(
            image,
            config="--psm 6"
        ).strip()

        if not text:
            text = "No readable text detected. Pharmacist review required."

        confidence_data = pytesseract.image_to_data(
            image,
            output_type=pytesseract.Output.DICT,
            config="--psm 6"
        )

        confidences = []

        for value in confidence_data.get("conf", []):
            try:
                number = float(value)
                if number >= 0:
                    confidences.append(number)
            except (ValueError, TypeError):
                pass

        confidence = (
            round(sum(confidences) / len(confidences) / 100, 2)
            if confidences
            else 0
        )

        return {
            "text": text,
            "confidence": confidence,
            "engine": "Tesseract OCR",
            "filename": file.filename
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"OCR processing failed: {str(e)}"
        )
