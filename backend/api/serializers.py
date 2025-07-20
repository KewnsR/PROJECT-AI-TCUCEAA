from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import StudentProfile, ScholarshipApplication, AIVerificationLog

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    student_id = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm', 'first_name', 'last_name', 'student_id')

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs

    def create(self, validated_data):
        student_id = validated_data.pop('student_id')
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        
        # Create student profile
        StudentProfile.objects.create(
            user=user,
            student_id=student_id
        )
        
        return user

class UserLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        if username and password:
            user = authenticate(username=username, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')
            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError('Must include username and password')

class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    student_profile = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'date_joined', 'is_superuser', 'student_profile')
    
    def get_student_profile(self, obj):
        try:
            return StudentProfileSerializer(obj.studentprofile).data
        except StudentProfile.DoesNotExist:
            return None

class ScholarshipApplicationSerializer(serializers.ModelSerializer):
    grade_document = serializers.FileField(required=False)
    verification_status = serializers.CharField(source='ai_verification_status', read_only=True)
    
    class Meta:
        model = ScholarshipApplication
        fields = '__all__'
        read_only_fields = ('student', 'ai_verification_status', 'ai_confidence_score', 'ai_verification_notes', 'total_allowance', 'merit_incentive')

class AdminScholarshipApplicationSerializer(serializers.ModelSerializer):
    student_username = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    student_id = serializers.SerializerMethodField()
    verification_status = serializers.CharField(source='ai_verification_status', read_only=True)
    
    class Meta:
        model = ScholarshipApplication
        fields = '__all__'
    
    def get_student_username(self, obj):
        return obj.student.user.username
    
    def get_student_name(self, obj):
        return f"{obj.student.user.first_name} {obj.student.user.last_name}".strip()
    
    def get_student_id(self, obj):
        return obj.student.student_id

class AIVerificationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIVerificationLog
        fields = '__all__'
