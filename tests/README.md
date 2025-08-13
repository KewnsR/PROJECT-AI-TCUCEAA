# Test Suite

This directory contains various test scripts for the PROJECT-AI-TCUCEAA application.

## Test Files

### Server and API Tests
- **`test_server.py`** - Comprehensive server testing including Django startup, API endpoints, and CORS
- **`test_admin_api.py`** - Tests admin login and administrative API endpoints
- **`test_admin_buttons.py`** - Tests admin UI button functionality and responses

### Feature-Specific Tests
- **`test_document_validation.py`** - Tests document validation logic for scholarship applications
- **`test_enhanced_ai.py`** - Tests AI functionality for unit extraction and merit calculation
- **`test_file_upload.py`** - Tests file upload functionality and API endpoints
- **`test_merit_allowance.py`** - Tests merit allowance calculation algorithms

## Running Tests

Before running any tests, ensure:
1. Django server is running (`python manage.py runserver`)
2. Virtual environment is activated
3. All dependencies are installed

### Running Individual Tests
```bash
python test_server.py           # Test server functionality
python test_admin_api.py        # Test admin API
python test_document_validation.py  # Test document validation
python test_enhanced_ai.py      # Test AI features
python test_file_upload.py     # Test file uploads
python test_merit_allowance.py # Test merit calculations
python test_admin_buttons.py   # Test admin UI
```

### Test Prerequisites
- Admin user created with username/password configured in test files
- Django server running on localhost:8000
- Proper media directory setup for file uploads

## Notes
- Some tests require specific admin credentials (check individual test files)
- File upload tests may create temporary files in the media directory
- AI tests require proper model configuration and sample data
