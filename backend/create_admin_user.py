import os
import sys
import django

# Set the Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Setup Django
sys.path.append('.')
django.setup()

from django.contrib.auth.models import User
from api.models import StudentProfile

# Create admin user
username = 'admin@123'
email = 'admin@gmail.com'
password = 'admin123'

# Check if admin user already exists
if User.objects.filter(username=username).exists():
    print(f'Admin user "{username}" already exists!')
else:
    # Create admin user
    admin_user = User.objects.create_superuser(
        username=username,
        email=email,
        password=password,
        first_name='Admin',
        last_name='User'
    )
    
    # Create student profile for admin
    StudentProfile.objects.create(
        user=admin_user,
        student_id='ADMIN-001',
        university='Taguig City University',
        course='Administration',
        year_level='Admin',
        is_first_time_applicant=False
    )
    
    print(f'Successfully created admin user:')
    print(f'Username: {username}')
    print(f'Email: {email}')
    print(f'Password: {password}')
