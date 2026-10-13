@echo off
cd /d "%~dp0frontend"
if not exist node_modules (
  echo Installing React dependencies...
  npm install
)
npm run dev
pause
