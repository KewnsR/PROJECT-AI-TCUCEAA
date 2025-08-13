# PROJECT-AI-TCUCEAA

An AI-powered scholarship application management system built with Django (backend) and React (frontend).

## Features

- **AI-Powered Document Verification**: Automated analysis and verification of scholarship application documents
- **Admin Dashboard**: Comprehensive interface for reviewing and managing applications
- **Student Portal**: Easy application submission with document upload capabilities
- **Merit-Based Analysis**: AI evaluation of academic credentials and qualifications
- **Real-time Status Updates**: Track application progress through various stages

## Technology Stack

### Backend
- **Django**: Web framework
- **Django REST Framework**: API development
- **SQLite**: Database (development)
- **Python**: Programming language

### Frontend
- **React**: Frontend framework
- **JavaScript**: Programming language
- **CSS**: Styling

## Project Structure

```
PROJECT-AI-TCUCEAA/
├── backend/                 # Django backend
│   ├── api/                # API application
│   ├── backend/            # Django project settings
│   ├── media/              # Uploaded files
│   └── manage.py           # Django management script
├── frontend/               # React frontend
│   ├── src/                # Source code
│   ├── public/             # Static assets
│   └── package.json        # Node.js dependencies
├── tests/                  # Test suite
│   └── README.md           # Test documentation
└── README.md               # This file
```

## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 14+
- npm or yarn

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install django djangorestframework pillow
   ```

3. Run database migrations:
   ```bash
   python manage.py migrate
   ```

4. Create a superuser:
   ```bash
   python manage.py createsuperuser
   ```

5. Start the Django server:
   ```bash
   python manage.py runserver
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/login/` - User login
- `POST /api/auth/logout/` - User logout

### Applications
- `GET /api/applications/` - List all applications
- `POST /api/applications/` - Create new application
- `GET /api/applications/{id}/` - Get specific application
- `PATCH /api/applications/{id}/` - Update application

### Admin
- `GET /api/admin/applications/` - Admin view of all applications
- `PATCH /api/admin/applications/{id}/` - Admin update application status

## Development Scripts

The project includes utility scripts:

- `start_backend.bat` - Start Django development server (Windows batch file)
- `start_django_server.py` - Start Django development server (Python script)

For testing, see the `/tests` directory which contains comprehensive test suite.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is for educational purposes as part of the TCUCEAA scholarship management system.

## Contact

For questions or support, please contact the development team.
