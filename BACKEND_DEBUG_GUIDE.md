# Django Backend Debugging Guide

## Issue: Network Error when clicking Approve/Reject/Delete buttons

The buttons are showing "Network error occurred" because the Django backend server is not running or not accessible.

## Solution Steps:

### 1. Start the Django Backend Server

**Option A: Using the batch file**
```cmd
cd c:\xampp\htdocs\PROJECT-AI-TCUCEAA
start_backend.bat
```

**Option B: Manual start**
```cmd
cd c:\xampp\htdocs\PROJECT-AI-TCUCEAA\backend
C:/xampp/htdocs/PROJECT-AI-TCUCEAA/venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
```

### 2. Verify Server is Running

After starting the server, you should see output like:
```
System check identified no issues (0 silenced).
January XX, 2025 - XX:XX:XX
Django version 5.2.4, using settings 'backend.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CTRL-BREAK.
```

### 3. Test the API

Open a web browser and go to:
- http://127.0.0.1:8000/api/
- Should show Django REST framework page

### 4. Start the Frontend Server

In a NEW terminal window:
```cmd
cd c:\xampp\htdocs\PROJECT-AI-TCUCEAA\frontend
npm start
```

### 5. Test Admin Functionality

1. Go to http://localhost:3000 in your browser
2. Login with your admin account
3. Navigate to Admin Applications
4. Try clicking the Approve/Reject/Delete buttons

## Debug Information Added

I've added console logging to the backend API endpoints. When you click the buttons, you should see debug output in the Django server console showing:
- Request received
- User information
- Application details
- Success/error messages

## What Was Fixed

1. **Backend API endpoints**: Added proper error handling and debug logging
2. **CORS configuration**: Already properly configured for localhost:3000
3. **Frontend API calls**: Already properly structured with correct headers
4. **Authentication**: Token-based auth is properly configured

The network errors were likely caused by the Django server not being accessible at http://127.0.0.1:8000.

## If Still Having Issues

1. Check Windows Firewall isn't blocking port 8000
2. Make sure no other service is using port 8000
3. Try using localhost:8000 instead of 127.0.0.1:8000
4. Check the browser's developer console (F12) for detailed error messages
