@echo off
cd /d D:\kiosk-system

:loop
echo [%date% %time%] server starting >> server.log
"C:\Program Files\nodejs\node.exe" server.js >> server.log 2>&1
echo [%date% %time%] server stopped, restarting in 5s >> server.log
ping 127.0.0.1 -n 6 >nul
goto loop