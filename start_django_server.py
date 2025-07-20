#!/usr/bin/env python3
"""Django Server Startup Script"""

import os
import sys
import subprocess

def start_django_server():
    """Start the Django development server"""
    try:
        # Change to backend directory
        os.chdir(r'c:\xampp\htdocs\PROJECT-AI-TCUCEAA\backend')
        
        # Python executable path
        python_exe = r'C:/xampp/htdocs/PROJECT-AI-TCUCEAA/venv/Scripts/python.exe'
        
        print("🔧 Checking Django configuration...")
        
        # Run Django check
        result = subprocess.run([python_exe, 'manage.py', 'check'], 
                              capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            print("❌ Django configuration errors found:")
            print(result.stderr)
            print(result.stdout)
            return False
        else:
            print("✅ Django configuration is valid!")
            
        print("\n🚀 Starting Django server...")
        print("Server will be available at: http://127.0.0.1:8000")
        print("Press Ctrl+C to stop the server")
        print("-" * 50)
        
        # Start the server
        subprocess.run([python_exe, 'manage.py', 'runserver', '127.0.0.1:8000'])
        
    except subprocess.TimeoutExpired:
        print("❌ Django check timed out")
        return False
    except FileNotFoundError:
        print("❌ Python executable not found")
        print(f"Expected path: {python_exe}")
        return False
    except Exception as e:
        print(f"❌ Error starting Django server: {e}")
        return False

if __name__ == "__main__":
    start_django_server()
