# Document Upload Fix - Complete Solution

## 🚀 Quick Start

### 1. Start Django Backend
```bash
# Double-click this file or run in terminal:
start_backend.bat
```
**Wait for the message**: "Starting development server at http://127.0.0.1:8000/"

### 2. Start React Frontend  
```bash
# In a new terminal or double-click:
start_frontend.bat
```

### 3. Test Upload
- Log into the application
- Go to "Submit Grade Documents" 
- Upload your grade document (PNG/JPG/PDF, max 5MB)
- Click "Submit for AI Verification"

## 🔧 Issues Fixed

### Backend Fixes:
✅ **CORS Configuration** - Added proper cross-origin request handling  
✅ **File Upload Settings** - Increased size limits to 5MB  
✅ **CSRF Protection** - Added exemption for API endpoints  
✅ **Media Files** - Created media directory and URL routing  
✅ **Error Handling** - Added comprehensive debugging and logging  
✅ **AI Verification** - Enhanced AI processing with better error handling  

### Frontend Fixes:
✅ **Network Error Handling** - Added detailed error messages  
✅ **File Validation** - Added proper file type and size checking  
✅ **Authentication** - Added token validation  
✅ **Debug Logging** - Added console logging for troubleshooting  

## 🧪 Testing Tools

### Test Django Configuration:
```bash
python test_file_upload.py
```

### Test Full Server:
```bash
python test_server.py
```

## 🚨 Troubleshooting

### "Network error. Please try again."
**Cause**: Django server is not running  
**Solution**: 
1. Run `start_backend.bat`
2. Wait for "Starting development server" message
3. Try uploading again

### "Authentication token missing"
**Cause**: User session expired  
**Solution**: Log out and log back in

### "File size must be less than 5MB"
**Cause**: File too large  
**Solution**: Compress your image or use PDF

### "Only PDF, JPG, and PNG files are allowed"
**Cause**: Wrong file format  
**Solution**: Convert to supported format

### Server won't start
**Check these steps**:
1. Virtual environment exists: `C:\xampp\htdocs\PROJECT-AI-TCUCEAA\venv\`
2. Dependencies installed: `pip install -r requirements.txt`
3. Database migrated: `python manage.py migrate`
4. Port 8000 not in use by another program

## 📁 File Structure Created
```
backend/
  media/                    # ✅ Created for file uploads
    grade_documents/        # ✅ Created for grade documents
```

## 🤖 AI Verification Features

The enhanced AI system now:
- ✅ Analyzes uploaded documents (simulated)
- ✅ Extracts units enrolled and SWA grades
- ✅ Checks eligibility for merit incentive (₱5,000)
- ✅ Calculates total allowances
- ✅ Provides detailed verification notes
- ✅ Handles errors gracefully

### Merit Incentive Requirements:
- Must be taking at least 15 units
- SWA of 1.75 or better  
- Not a first-time applicant
- No INC, withdrawn, failed, or dropped subjects

## 📞 Still Having Issues?

1. **Check browser console** (F12) for detailed error messages
2. **Verify Django server** is running on http://127.0.0.1:8000
3. **Test with the test scripts** to isolate the problem
4. **Check firewall/antivirus** settings that might block local connections

The network error should now be resolved. The enhanced error handling will give you specific details about any remaining issues.
