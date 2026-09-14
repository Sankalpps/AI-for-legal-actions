@echo off
echo ====================================
echo  LexAI - AI Legal Assistance
echo ====================================
echo.

REM Check for .env
if not exist "backend\.env" (
    echo [ERROR] backend\.env not found!
    echo Please copy backend\.env.example to backend\.env and add your GEMINI_API_KEY
    pause
    exit /b 1
)

REM Check if GEMINI_API_KEY is still placeholder
findstr /C:"your_gemini_api_key_here" "backend\.env" >nul
if %errorlevel% == 0 (
    echo [ERROR] GEMINI_API_KEY not set in backend\.env
    echo Please edit backend\.env and replace 'your_gemini_api_key_here' with your actual key
    echo Get a free key at: https://aistudio.google.com/app/apikey
    pause
    exit /b 1
)

echo [1/2] Starting Backend (FastAPI)...
start "LexAI Backend" cmd /k "cd /d %~dp0backend && .\venv\Scripts\python.exe main.py"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Frontend (React)...
start "LexAI Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ====================================
echo  LexAI is starting up!
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:3000
echo  API Docs: http://localhost:8000/docs
echo ====================================
echo.
pause
