@echo off
chcp 65001 >nul
title منصة خطة تحسين نتائج التقويم المدرسي
cd /d "%~dp0"

echo ============================================================
echo   منصة خطة تحسين نتائج التقويم المدرسي
echo   وزارة التعليم
echo ============================================================
echo.
echo جارٍ تشغيل السيرفر المحلي على المنفذ 8899 ...
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    start "" http://127.0.0.1:8899/index.html
    python -m http.server 8899 --bind 127.0.0.1
    goto end
)

where py >nul 2>nul
if %errorlevel%==0 (
    start "" http://127.0.0.1:8899/index.html
    py -m http.server 8899 --bind 127.0.0.1
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