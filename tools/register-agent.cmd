@echo off
setlocal
set "ELECTRON_RUN_AS_NODE=1"
if exist "%~dp0AgentOfficeStudio.exe" (
  "%~dp0AgentOfficeStudio.exe" "%~dp0resources\tools\register-agent.mjs" %*
) else (
  node "%~dp0register-agent.mjs" %*
)
endlocal
exit /b %errorlevel%
