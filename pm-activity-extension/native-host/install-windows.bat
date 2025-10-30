@echo off
REM PM Activity Tracker - Windows Installation Script
REM This script sets up the native messaging host on Windows

echo PM Activity Tracker - Windows Installer
echo ==========================================
echo.

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "NATIVE_HOST_SCRIPT=%SCRIPT_DIR%pm_activity_logger.py"
set "MANIFEST_TEMPLATE=%SCRIPT_DIR%com.pm_agent.activity_logger.json"

REM Create directory structure
echo Creating directories...
mkdir "%USERPROFILE%\.pm-agent\native-host" 2>nul

REM Copy native host script
echo Installing native host script...
copy "%NATIVE_HOST_SCRIPT%" "%USERPROFILE%\.pm-agent\native-host\pm_activity_logger.py" >nul
if errorlevel 1 (
    echo ERROR: Failed to copy Python script
    pause
    exit /b 1
)

REM Get current username for path
set "USER_PATH=%USERPROFILE%\.pm-agent\native-host"

REM Create manifest with Windows path format
echo Creating native host manifest...
set "MANIFEST_FILE=%USERPROFILE%\.pm-agent\native-host\com.pm_agent.activity_logger.json"

REM Read template and replace path (note: this is simplified - you'll need to edit EXTENSION_ID_PLACEHOLDER manually)
copy "%MANIFEST_TEMPLATE%" "%MANIFEST_FILE%" >nul

echo.
echo Native host files installed to: %USER_PATH%
echo.
echo ==========================================
echo IMPORTANT: Complete these remaining steps:
echo ==========================================
echo.
echo 1. Load the extension in Chrome:
echo    - Open chrome://extensions
echo    - Enable 'Developer mode'
echo    - Click 'Load unpacked'
echo    - Select: %SCRIPT_DIR%..
echo.
echo 2. Copy the Extension ID from Chrome
echo.
echo 3. Update the manifest with your Extension ID:
echo    - Open: %MANIFEST_FILE%
echo    - Replace 'EXTENSION_ID_PLACEHOLDER' with your Extension ID
echo.
echo 4. Update the manifest path for Windows:
echo    - Change path to: %USERPROFILE:\=\\%\\.pm-agent\\native-host\\pm_activity_logger.py
echo    - Use DOUBLE backslashes (\\)
echo.
echo 5. Register with Windows Registry:
echo    Run Command Prompt as Administrator and execute:
echo.
echo    REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.pm_agent.activity_logger" /ve /t REG_SZ /d "%MANIFEST_FILE%" /f
echo.
echo 6. Verify Python is installed:
echo    python --version
echo.
echo    If Python is not found, you may need to:
echo    - Install Python from python.org
echo    - Add Python to PATH
echo    - Or create a .bat wrapper (see INSTALL.md)
echo.
echo 7. Restart Chrome completely
echo.
echo 8. Test the connection:
echo    - Open extension popup
echo    - Visit a supported site
echo    - Click 'Flush to PM Agent'
echo    - Check %USERPROFILE%\.pm-agent\activity.jsonl
echo.
echo Debug logs: %USERPROFILE%\.pm-agent\native_host_debug.log
echo.
echo See INSTALL.md for detailed Windows setup instructions.
echo.
pause
