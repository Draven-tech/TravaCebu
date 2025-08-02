@echo off
echo ========================================
echo    TravaCebu Development Setup
echo ========================================
echo.
echo Starting both proxy server and Angular app...
echo.

REM Install proxy dependencies
echo Installing proxy server dependencies...
npm install express cors axios

REM Start proxy server in background
echo Starting proxy server on http://localhost:3001...
start "TravaCebu Proxy Server" cmd /k "node proxy-server.js"

REM Wait a moment for proxy to start
timeout /t 3 /nobreak > nul

REM Start Angular app
echo Starting Angular app on http://localhost:8100...
echo.
echo Both servers are now running:
echo - Proxy Server: http://localhost:3001
echo - Angular App:  http://localhost:8100
echo.
echo Press Ctrl+C to stop both servers
echo.
npm start 