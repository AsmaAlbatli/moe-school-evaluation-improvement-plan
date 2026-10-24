@echo off
chcp 65001 >nul
title منصة تفريغ خطة التحسين في منصة تميز — تصميم المشرفة أسماء الباتلي
cd /d "%~dp0"

echo ============================================================
echo   منصة تفريغ خطة التحسين في منصة تميز
echo   تصميم المشرفة أسماء الباتلي
echo ============================================================
echo.
echo جارٍ تشغيل السيرفر المحلي على المنفذ 8792 ...
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    start "" http://127.0.0.1:8792/index.html
    python -m http.server 8792 --bind 127.0.0.1
    goto end
)

where py >nul 2>nul
if %errorlevel%==0 (
    start "" http://127.0.0.1:8792/index.html
    py -m http.server 8792 --bind 127.0.0.1
    goto end
)

echo لم يتم العثور على Python على هذا الجهاز.
echo يمكنك فتح المنصة مباشرة بالضغط نقرًا مزدوجًا على: index.html
echo.
pause
goto end

:end
echo.
echo تم إيقاف السيرفر.
pause
