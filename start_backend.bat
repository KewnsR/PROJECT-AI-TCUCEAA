@echo off
echo ================================
echo    Starting Django Backend
echo ================================
echo.

echo Checking Django configuration...
cd /d "c:\xampp\htdocs\PROJECT-AI-TCUCEAA\backend"

:: Check if virtual environment exists
if exist "C:\xampp\htdocs\PROJECT-AI-TCUCEAA\venv\Scripts\python.exe" (
    echo Using virtual environment...
    
    echo Running Django checks...
    C:\xampp\htdocs\PROJECT-AI-TCUCEAA\venv\Scripts\python.exe manage.py check
    
    if %ERRORLEVEL% neq 0 (
        echo.
        echo ❌ Django configuration check failed!
        echo Please fix the errors above before starting the server.
        pause
        exit /b 1
    )
    
    echo ✅ Django configuration OK!
    echo.
    
    echo Applying migrations...
    C:\xampp\htdocs\PROJECT-AI-TCUCEAA\venv\Scripts\python.exe manage.py migrate
    
    echo.
    echo Starting Django development server...
    echo Server will be available at: http://127.0.0.1:8000
    echo.
    echo ⚠️  IMPORTANT: Keep this window open while using the application
    echo Press Ctrl+C to stop the server
    echo.
    
    C:\xampp\htdocs\PROJECT-AI-TCUCEAA\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
) else (
    echo ❌ Virtual environment not found!
    echo Please make sure the virtual environment exists at: C:\xampp\htdocs\PROJECT-AI-TCUCEAA\venv
    echo.
    echo Trying with system Python...
    python manage.py runserver 127.0.0.1:8000
)

echo.
echo Server stopped.
pause
