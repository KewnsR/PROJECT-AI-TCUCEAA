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

# Fix existing admin user
username = 'admin@123'

try:
    admin_user = User.objects.get(username=username)
    print(f"Found admin user: {admin_user.username}")
    
    # Remove student profile if it exists
    try:
        student_profile = StudentProfile.objects.get(user=admin_user)
        student_profile.delete()
        print("✅ Removed student profile from admin user")
    except StudentProfile.DoesNotExist:
        print("ℹ️ Admin user already has no student profile")
    
    # Ensure user is superuser
    if not admin_user.is_superuser:
        admin_user.is_superuser = True
        admin_user.is_staff = True
        admin_user.save()
        print("✅ Made user a superuser")
    else:
        print("ℹ️ User is already a superuser")
        
    print(f"✅ Admin user fixed successfully!")
    
except User.DoesNotExist:
    print(f"❌ Admin user '{username}' not found")
