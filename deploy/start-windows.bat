@echo off
rem Teukga - home PC launcher. Register in Task Scheduler with trigger "At log on".
rem Restarts the app 10 seconds after it stops.
cd /d "%~dp0.."
:loop
node src\server.js
echo Restarting in 10 seconds...
timeout /t 10 /nobreak > nul
goto loop
