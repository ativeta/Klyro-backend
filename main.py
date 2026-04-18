from fastapi import FastAPI, UploadFile, File
import pandas as pd
import io
app = FastAPI()
@app.get("/")
def sveikas():
    return {"message": "FastAPI serveris veikia!"}
@app.post("/clean")
async def clean_excel(file: UploadFile = File(...)):
    try:
        # Nuskaitom failą
        if file.filename.endswith(".csv"):
            df = pd.read_csv(file.file)
        elif file.filename.endswith(".xlsx"):
            df = pd.read_excel(file.file)
        else:
            return {"error": "Netinkamas failo formatas. Įkelk .csv arba .xlsx"}
        # Paprasti tvarkymo veiksmai
        df = df.drop_duplicates().dropna()
        # Grąžinam paprastą santrauką
        return {
            "eiluciu_skaicius": len(df),
            "stulpeliai": list(df.columns),
            "pavyzdys": df.head(5).to_dict(orient="records")
        }
    except Exception as e:
        return {"error": str(e)}