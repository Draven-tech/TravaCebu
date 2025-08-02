@echo off
echo Starting TravaCebu Proxy Server...
echo.
echo Installing dependencies if needed...
npm install express cors axios
echo.
echo Starting proxy server on http://localhost:3001
echo.
echo Make sure to start your Angular app in another terminal:
echo npm start
echo.
echo The proxy server will handle Google Places API calls and avoid CORS issues.
echo.
node proxy-server.js
pause 