@echo off
echo Starting GeekFights Development Servers...
echo.

echo Starting Backend Server...
start "Backend Server" cmd /k "cd backend && node server.js"

echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak > nul

echo Starting Frontend Server...
start "Frontend Server" cmd /k "npm start"

echo.
echo Both servers are starting!
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to close this window...
pause > nul