import socket

def check_port(port):
    """Check if a port is open/in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.connect(('127.0.0.1', port))
            return True  # Port is open/server is running
        except socket.error:
            return False  # Port is closed/server is not running

def main():
    port = 8000
    if check_port(port):
        print(f"✅ Port {port} is open - Django server appears to be running")
    else:
        print(f"❌ Port {port} is closed - Django server is not running")
        print(f"💡 Start the Django server by running:")
        print(f"   C:/xampp/htdocs/PROJECT-AI-TCUCEAA/venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000")

if __name__ == "__main__":
    main()
