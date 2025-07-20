from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal

class Message(models.Model):
    text = models.CharField(max_length=255)

    def __str__(self):
        return self.text

class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    student_id = models.CharField(max_length=20, unique=True)
    university = models.CharField(max_length=100, default='Taguig City University')
    course = models.CharField(max_length=100, blank=True)
    year_level = models.CharField(max_length=20, blank=True)
    is_first_time_applicant = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.student_id}"

class ScholarshipApplication(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('under_review', 'Under AI Review'),
    ]
    
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE)
    semester = models.CharField(max_length=50)
    academic_year = models.CharField(max_length=20)
    units_enrolled = models.IntegerField(null=True, blank=True)  # Will be extracted by AI
    swa_grade = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)  # Will be extracted by AI
    grade_document = models.FileField(upload_to='grade_documents/', null=True, blank=True)
    has_inc_withdrawn = models.BooleanField(default=False, null=True, blank=True)  # Will be determined by AI
    has_failed_dropped = models.BooleanField(default=False, null=True, blank=True)  # Will be determined by AI
    
    # AI Verification Results
    ai_verification_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    ai_confidence_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    ai_verification_notes = models.TextField(blank=True)
    
    # Allowance Calculation
    base_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('5000.00'))
    merit_incentive = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('5000.00'))
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Calculate merit incentive only if all required data is available
        # Calculate merit incentive based on official TCU requirements
        if (self.units_enrolled is not None and 
            self.swa_grade is not None and
            self.has_inc_withdrawn is not None and
            self.has_failed_dropped is not None and
            self.units_enrolled >= 15 and 
            self.swa_grade >= Decimal('88.75') and  # SWA 88.75 or higher required
            not self.has_inc_withdrawn and
            not self.has_failed_dropped):
            self.merit_incentive = Decimal('5000.00')
        else:
            # If data is not complete or requirements not met, no merit incentive
            self.merit_incentive = Decimal('0.00')
        
        # Calculate total allowance
        self.total_allowance = self.base_allowance + self.merit_incentive
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student.user.username} - {self.semester} {self.academic_year}"

class AIVerificationLog(models.Model):
    application = models.ForeignKey(ScholarshipApplication, on_delete=models.CASCADE)
    verification_type = models.CharField(max_length=50)  # 'grade_verification', 'document_analysis'
    input_data = models.TextField()
    ai_response = models.TextField()
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.application.student.user.username} - {self.verification_type}"
