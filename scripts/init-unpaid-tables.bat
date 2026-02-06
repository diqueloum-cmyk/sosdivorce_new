@echo off
echo ============================================
echo Initialisation des tables unpaid_sessions
echo ============================================
echo.

set /p SETUP_KEY="Entrez votre SETUP_KEY: "

if "%SETUP_KEY%"=="" (
    echo ERREUR: SETUP_KEY requise
    exit /b 1
)

echo.
echo Envoi de la requete a l'API...
echo.

curl -X GET "https://sosdivorce.vercel.app/api/setup-db" ^
  -H "X-Setup-Key: %SETUP_KEY%" ^
  -H "Content-Type: application/json"

echo.
echo.
echo ============================================
echo Terminé!
echo ============================================
pause
