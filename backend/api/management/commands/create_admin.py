from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from api.models import StudentProfile

class Command(BaseCommand):
    help = 'Create an admin user with specified credentials'

    def handle(self, *args, **options):
        username = 'admin@123'
        email = 'admin@gmail.com'
        password = 'admin123'
        
        # Check if admin user already exists
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f'Admin user "{username}" already exists!')
            )
            return
        
        # Create admin user
        admin_user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
            first_name='Admin',
            last_name='User'
        )
        
        # DON'T create student profile for admin users
        # Admins should not have student profiles as they are system administrators
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully created admin user:\n'
                f'Username: {username}\n'
                f'Email: {email}\n'
                f'Password: {password}\n'
                f'Note: Admin users do not have student profiles.'
            )
        )
