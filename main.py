from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io, requests
import json

app = FastAPI()

# Leidžiam prisijungimus iš bet kur (kad frontend galėtų pasiekti šį API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Ollama API adresas
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL = "llama3"

@app.post("/clean")
async def clean_excel(file: UploadFile = File(...)):
    try:
        # 1️⃣ Nuskaitome įkeltą failą (Excel arba CSV)
        if file.filename.endswith(".csv"):
            df = pd.read_csv(file.file)
        elif file.filename.endswith(".xlsx"):
            df = pd.read_excel(file.file)
        else:
            return {"error": "Įkelk .csv arba .xlsx failą."}

        # 2️⃣ Atliekame paprastą sutvarkymą
        df = df.drop_duplicates().dropna()

        # 3️⃣ Užduodame AI klausimą pagal stulpelius
        columns = ", ".join(df.columns)
        prompt = f"Sakyk, kokias duomenų analizes būtų verta atlikti, jei turiu stulpelius: {columns}."

        # 4️⃣ Kreipiamės į Ollama API
        response = requests.post(
            OLLAMA_URL,
            json={"model": MODEL, "prompt": prompt},
            stream=True
        )
        result = ""
        for line in response.iter_lines():
            if line:
                try:
                    data = line.decode("utf-8")
                    part = json.loads(data)
                    if "response" in part:
                        result += part["response"]
                except:
                    pass
        # Gautas AI atsakymas
        suggestions = result.strip()
        # Pakeičiam \n, \t į realias eilutes ir tarpelius
        suggestions = suggestions.replace("\n", " ").replace("\t", " ").replace("\r", " ").strip()

        return {
            "eiluciu_skaicius": len(df),
            "stulpeliai": list(df.columns),
            "AI_suggestions": suggestions
        }

    except Exception as e:
        return {"error": str(e)}
