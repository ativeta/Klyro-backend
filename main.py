from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import pandas as pd
import requests
import json
import base64
import io
import numpy as np

app = FastAPI()

# Enable CORS to allow frontend connections from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Ollama API configuration
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL = "llama3"


def clean_dataframe(df, options=None):
    """
    Advanced data cleaning function with detailed reporting

    Args:
        df: pandas DataFrame to clean
        options: dict with optional settings like 'fill_missing' and 'remove_outliers'

    Returns:
        tuple: (cleaned_dataframe, cleaning_report_dict)
    """
    report = {
        "initial_row_count": len(df),
        "actions_performed": [],
        "changes": {}
    }

    # 1. Remove empty columns (where all values are NaN)
    empty_cols = df.columns[df.isna().all()].tolist()
    if empty_cols:
        df = df.drop(columns=empty_cols)
        report["actions_performed"].append(f"Removed empty columns: {', '.join(empty_cols)}")

    # 2. Remove duplicate rows
    duplicate_count = df.duplicated().sum()
    if duplicate_count > 0:
        df = df.drop_duplicates()
        report["actions_performed"].append(f"Removed {int(duplicate_count)} duplicate rows")
        report["changes"]["duplicates_removed"] = int(duplicate_count)

    # 3. Remove completely empty rows (all values are NaN)
    empty_rows = df.isna().all(axis=1).sum()
    if empty_rows > 0:
        df = df.dropna(how='all')
        report["actions_performed"].append(f"Removed {int(empty_rows)} empty rows")

    # 4. Clean text data: trim whitespace and standardize null representations
    for col in df.select_dtypes(include=['object']).columns:
        df[col] = df[col].astype(str).str.strip()
        df[col] = df[col].replace(['nan', 'None', 'null', ''], pd.NA)

    # 5. Automatic data type detection and conversion
    for col in df.columns:
        if df[col].dtype == 'object':
            # Try converting to datetime if column name suggests date/time
            date_keywords = ['date', 'time', 'datetime', 'created', 'updated', 'timestamp']
            if any(keyword in col.lower() for keyword in date_keywords):
                try:
                    df[col] = pd.to_datetime(df[col], errors='coerce')
                    report["actions_performed"].append(f"Converted column '{col}' to datetime")
                except:
                    pass
            else:
                # Try converting to numeric if most values are numbers
                try:
                    converted = pd.to_numeric(df[col], errors='coerce')
                    success_rate = converted.notna().sum() / len(df)
                    if success_rate > 0.5:  # If more than 50% converts successfully
                        df[col] = converted
                        report["actions_performed"].append(f"Converted column '{col}' to numeric")
                except:
                    pass

    # 6. Fill missing values (optional, based on frontend checkbox)
    if options and options.get('fill_missing'):
        for col in df.columns:
            missing_count = df[col].isna().sum()
            if missing_count > 0:
                if df[col].dtype in ['int64', 'float64']:
                    # Fill numeric with mean
                    mean_val = df[col].mean()
                    df[col] = df[col].fillna(mean_val)
                    report["actions_performed"].append(
                        f"Filled {int(missing_count)} missing values in '{col}' with mean ({mean_val:.2f})"
                    )
                else:
                    # Fill categorical with mode (most frequent value)
                    mode_val = df[col].mode()[0] if not df[col].mode().empty else "Unknown"
                    df[col] = df[col].fillna(mode_val)
                    report["actions_performed"].append(
                        f"Filled {int(missing_count)} missing values in '{col}' with '{mode_val}'"
                    )

    # 7. Remove statistical outliers using IQR method (optional)
    if options and options.get('remove_outliers'):
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        total_outliers = 0
        for col in numeric_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR

            # Keep values within bounds or NaN (don't remove NaN rows here)
            mask = ((df[col] >= lower_bound) & (df[col] <= upper_bound)) | (df[col].isna())
            removed = (~mask).sum()
            if removed > 0:
                total_outliers += removed
                df = df[mask]

        if total_outliers > 0:
            report["actions_performed"].append(f"Removed {int(total_outliers)} outliers using IQR method")

    report["final_row_count"] = len(df)
    report["column_count"] = len(df.columns)

    return df, report


@app.post("/clean")
async def clean_excel(
        file: UploadFile = File(...),
        fill_missing: Optional[bool] = False,
        remove_outliers: Optional[bool] = False
):
    """
    Main endpoint to clean Excel/CSV files and get AI analysis suggestions

    Args:
        file: Uploaded Excel or CSV file
        fill_missing: Whether to fill missing values (default: False)
        remove_outliers: Whether to remove statistical outliers (default: False)

    Returns:
        JSON with cleaning report, AI suggestions, and base64 encoded cleaned file
    """
    try:
        # 1. Read the uploaded file based on extension
        if file.filename.endswith(".csv"):
            df = pd.read_csv(file.file)
        elif file.filename.endswith(".xlsx"):
            df = pd.read_excel(file.file)
        else:
            return {"error": "Please upload a .csv or .xlsx file"}

        # 2. Perform data cleaning with extended options
        options = {"fill_missing": fill_missing, "remove_outliers": remove_outliers}
        df_cleaned, cleaning_report = clean_dataframe(df, options=options)

        # 3. Prepare detailed column information for AI analysis
        columns_info = []
        for col in df_cleaned.columns:
            col_type = str(df_cleaned[col].dtype)
            unique_count = df_cleaned[col].nunique()
            null_count = df_cleaned[col].isna().sum()
            columns_info.append(f"{col} ({col_type}, {unique_count} unique, {null_count} nulls)")

        # 4. Create AI prompt requesting JSON format
        prompt = f"""Analyze this dataset and suggest exactly 3 types of analysis.

Return your answer in this exact JSON format:
{{
  "suggestions": [
    {{
      "title": "Analysis Name",
      "description": "Brief description",
      "steps": ["step 1", "step 2", "step 3"]
    }},
    {{
      "title": "Second Analysis Name", 
      "description": "Brief description",
      "steps": ["step 1", "step 2", "step 3"]
    }},
    {{
      "title": "Third Analysis Name",
      "description": "Brief description", 
      "steps": ["step 1", "step 2", "step 3"]
    }}
  ]
}}

Columns: {', '.join(columns_info)}
Cleaning performed: {'; '.join(cleaning_report['actions_performed'])}

Important: Return ONLY the JSON, no other text."""

        # 5. Call Ollama API with streaming response
        response = requests.post(
            OLLAMA_URL,
            json={"model": MODEL, "prompt": prompt},
            stream=True
        )

        # Process streaming response
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

        # Parse JSON response from AI
        try:
            # Find JSON in response (in case AI adds extra text)
            json_start = result.find('{')
            json_end = result.rfind('}') + 1
            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")
            json_str = result[json_start:json_end]
            suggestions_data = json.loads(json_str)

            # Validate structure
            if "suggestions" not in suggestions_data:
                raise ValueError("Invalid JSON structure")

        except Exception as e:
            # Fallback if JSON parsing fails
            print(f"JSON parsing failed: {e}, using fallback")
            suggestions_data = {
                "suggestions": [
                    {
                        "title": "Statistical Analysis",
                        "description": "Analyze data distribution and central tendencies",
                        "steps": ["Calculate mean and median", "Identify outliers", "Create distribution histogram"]
                    },
                    {
                        "title": "Correlation Analysis",
                        "description": "Find relationships between variables",
                        "steps": ["Create scatter plots", "Calculate correlation matrix",
                                  "Identify strong correlations"]
                    },
                    {
                        "title": "Trend Analysis",
                        "description": "Track patterns over time or categories",
                        "steps": ["Group data by time periods", "Calculate growth rates", "Visualize with line charts"]
                    }
                ]
            }

        # 6. Create Excel file in memory for download
        output = io.BytesIO()
        df_cleaned.to_excel(output, index=False, engine='openpyxl')
        output.seek(0)
        file_content = output.read()
        base64_content = base64.b64encode(file_content).decode('utf-8')

        # 7. Return comprehensive response with all metadata
        return {
            "initial_row_count": cleaning_report["initial_row_count"],
            "row_count": cleaning_report["final_row_count"],
            "rows_removed": cleaning_report["initial_row_count"] - cleaning_report["final_row_count"],
            "columns": list(df_cleaned.columns),
            "cleaning_report": cleaning_report["actions_performed"],
            "data_types": {col: str(dtype) for col, dtype in df_cleaned.dtypes.items()},
            "AI_suggestions": suggestions_data["suggestions"],  # Returns structured array for cards
            "cleaned_file_base64": base64_content,
            "filename": f"cleaned_{file.filename}"
        }

    except Exception as e:
        return {"error": str(e)}
