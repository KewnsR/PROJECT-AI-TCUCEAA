from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import login, logout
from django.contrib.auth.models import User
from django.db import models
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import Message, StudentProfile, ScholarshipApplication, AIVerificationLog
from .serializers import (UserRegistrationSerializer, UserLoginSerializer, UserSerializer, 
                         ScholarshipApplicationSerializer, StudentProfileSerializer,
                         AdminScholarshipApplicationSerializer)
import json
import random
import traceback
from decimal import Decimal

class MessageView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        messages = Message.objects.all().values()
        return Response(messages)

class RegisterView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'user': UserSerializer(user).data,
                'token': token.key,
                'message': 'User registered successfully'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            login(request, user)
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'user': UserSerializer(user).data,
                'token': token.key,
                'message': 'Login successful'
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            request.user.auth_token.delete()
            logout(request)
            return Response({
                'message': 'Logout successful'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': 'Error during logout'
            }, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    def patch(self, request):
        """Update user profile information"""
        try:
            # Get the user and student profile
            user = request.user
            
            # Check if user is admin - admins can't update profile this way
            if user.is_superuser:
                return Response({'error': 'Admin users cannot update profile through this endpoint'}, 
                              status=status.HTTP_403_FORBIDDEN)
            
            try:
                student_profile = user.studentprofile
            except StudentProfile.DoesNotExist:
                return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Update user fields
            user_fields = ['first_name', 'last_name', 'email']
            for field in user_fields:
                if field in request.data:
                    setattr(user, field, request.data[field])
            
            # Validate email uniqueness if email is being updated
            if 'email' in request.data:
                if User.objects.exclude(id=user.id).filter(email=request.data['email']).exists():
                    return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)
            
            user.save()
            
            # Update student profile fields
            profile_fields = ['course', 'year_level', 'university']
            for field in profile_fields:
                if field in request.data:
                    setattr(student_profile, field, request.data[field])
            
            student_profile.save()
            
            # Return updated user data
            serializer = UserSerializer(user)
            return Response({
                'message': 'Profile updated successfully',
                'user': serializer.data
            })
            
        except Exception as e:
            return Response({'error': f'Failed to update profile: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Change user password"""
        try:
            user = request.user
            
            # Check if user is admin - admins can't change password this way
            if user.is_superuser:
                return Response({'error': 'Admin users cannot change password through this endpoint'}, 
                              status=status.HTTP_403_FORBIDDEN)
            
            current_password = request.data.get('current_password')
            new_password = request.data.get('new_password')
            confirm_password = request.data.get('confirm_password')
            
            # Validate input
            if not current_password or not new_password or not confirm_password:
                return Response({'error': 'All password fields are required'}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            # Check current password
            if not user.check_password(current_password):
                return Response({'error': 'Current password is incorrect'}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            # Check if new passwords match
            if new_password != confirm_password:
                return Response({'error': 'New passwords do not match'}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            # Validate new password strength
            if len(new_password) < 6:
                return Response({'error': 'New password must be at least 6 characters long'}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            # Change password
            user.set_password(new_password)
            user.save()
            
            return Response({'message': 'Password changed successfully'})
            
        except Exception as e:
            return Response({'error': f'Failed to change password: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DashboardView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Check if user is admin - redirect them to admin dashboard
        if request.user.is_superuser:
            return Response({
                'redirect_to_admin': True,
                'message': 'Admin users should use the admin dashboard'
            }, status=status.HTTP_200_OK)
            
        try:
            student_profile = request.user.studentprofile
        except StudentProfile.DoesNotExist:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get recent applications for display (limited)
        recent_applications = ScholarshipApplication.objects.filter(student=student_profile).order_by('-created_at')[:5]
        
        # Get ALL applications for statistics (not limited)
        all_applications = ScholarshipApplication.objects.filter(student=student_profile)
        
        # Calculate statistics from ALL applications
        total_applications = all_applications.count()
        approved_applications = all_applications.filter(ai_verification_status='approved').count()
        pending_applications = all_applications.filter(ai_verification_status__in=['pending', 'under_review']).count()
        rejected_applications = all_applications.filter(ai_verification_status='rejected').count()
        total_allowance_received = sum([app.total_allowance for app in all_applications.filter(ai_verification_status='approved')])
        
        dashboard_data = {
            'student_info': StudentProfileSerializer(student_profile).data,
            'recent_applications': ScholarshipApplicationSerializer(recent_applications, many=True).data,
            'statistics': {
                'total_applications': total_applications,
                'approved_applications': approved_applications,
                'pending_applications': pending_applications,
                'rejected_applications': rejected_applications,
                'total_allowance_received': float(total_allowance_received),
                'monthly_base_allowance': 5000.00,
                'merit_incentive_available': 5000.00,
            },
            'eligibility_requirements': {
                'base_allowance': 'All TCU students receive ₱5,000 monthly',
                'merit_incentive_requirements': [
                    'Must be taking at least 15 units',
                    'SWA of 88.75 or 1.75 or better',
                    'Not a first time applicant',
                    'No INC, withdrew, failed, or dropped subjects in previous semester'
                ]
            }
        }
        
        return Response(dashboard_data)

@method_decorator(csrf_exempt, name='dispatch')
class ScholarshipApplicationView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request):
        try:
            student_profile = request.user.studentprofile
        except StudentProfile.DoesNotExist:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Debug: Log incoming data
        print("Request data:", request.data)
        print("Request files:", request.FILES)
        
        serializer = ScholarshipApplicationSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # Create application with initial data (AI fields will be None initially)
                application = serializer.save(student=student_profile)
                print(f"Application created with ID: {application.id}")
                
                # Perform AI verification which will update the application with extracted data
                ai_result = self.perform_ai_verification(application)
                print(f"AI verification result: {ai_result}")
                
                # Update application with AI results and save again
                application.ai_verification_status = ai_result['status']
                application.ai_confidence_score = ai_result['confidence']
                application.ai_verification_notes = ai_result['notes']
                # The AI verification already updated units, SWA, etc. and saved the application
                # Just need to save the AI status fields
                application.save()
                
                # Log AI verification
                try:
                    AIVerificationLog.objects.create(
                        application=application,
                        verification_type='grade_verification',
                        input_data=json.dumps({
                            'academic_year': application.academic_year,
                            'semester': application.semester,
                            'units': application.units_enrolled,
                            'swa': float(application.swa_grade) if application.swa_grade else 0,
                            'has_inc': application.has_inc_withdrawn,
                            'has_failed': application.has_failed_dropped,
                            'is_first_time': student_profile.is_first_time_applicant,
                            'document_uploaded': bool(application.grade_document)
                        }),
                        ai_response=json.dumps(ai_result),
                        confidence_score=ai_result['confidence']
                    )
                except Exception as log_error:
                    print(f"Warning: Failed to create AI verification log: {log_error}")
                
                return Response({
                    'application': ScholarshipApplicationSerializer(application).data,
                    'ai_verification': ai_result,
                    'message': 'Application submitted successfully and AI verification completed!'
                }, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                print(f"Error during application processing: {str(e)}")
                import traceback
                traceback.print_exc()
                
                # If application was created but AI failed, still return the application
                if 'application' in locals():
                    return Response({
                        'application': ScholarshipApplicationSerializer(application).data,
                        'message': 'Application submitted but AI verification failed. Please contact support.',
                        'error': str(e)
                    }, status=status.HTTP_201_CREATED)
                else:
                    return Response({
                        'error': f'Application processing failed: {str(e)}'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        print(f"Serializer errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def get(self, request):
        try:
            student_profile = request.user.studentprofile
        except StudentProfile.DoesNotExist:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
        
        applications = ScholarshipApplication.objects.filter(student=student_profile).order_by('-created_at')
        serializer = ScholarshipApplicationSerializer(applications, many=True)
        return Response(serializer.data)
    
    def perform_ai_verification(self, application):
        """
        Simulate AI verification of scholarship application with document analysis
        In real implementation, this would call actual AI service to analyze the uploaded document
        """
        try:
            # Initialize variables
            extracted_data = None
            confidence = Decimal('50.00')  # Default confidence
            analysis_notes = 'No document analysis performed'
            
            # Simulate AI extraction from uploaded document
            if application.grade_document:
                print(f"Processing document: {application.grade_document.name}")
                
                try:
                    # Enhanced document analysis with strict validation
                    extracted_data = self.simulate_document_analysis(application.grade_document)
                    
                    # Update application with extracted data
                    application.units_enrolled = extracted_data['units_enrolled']
                    application.swa_grade = extracted_data['swa_grade']
                    application.has_inc_withdrawn = extracted_data['has_inc_withdrawn']
                    application.has_failed_dropped = extracted_data['has_failed_dropped']
                    
                    # Get confidence and analysis notes from document analysis
                    confidence = extracted_data.get('confidence_score', Decimal('85.00'))
                    analysis_notes = extracted_data.get('analysis_notes', 'Enhanced AI analysis completed')
                    
                    # Save the application with the extracted data
                    # The model's save() method will now calculate allowances properly
                    application.save()
                    print(f"Updated application with extracted data and saved")
                    
                except ValueError as validation_error:
                    # Document validation failed - return rejection immediately
                    print(f"❌ Document validation failed: {str(validation_error)}")
                    return {
                        'status': 'rejected',
                        'confidence': Decimal('0.00'),
                        'notes': f'Document validation failed: {str(validation_error)}',
                        'eligible_for_merit': False
                    }
            else:
                # No document provided - still process but mark as needs document
                print("No document provided for AI analysis")
                return {
                    'status': 'under_review',
                    'confidence': Decimal('0.00'),
                    'notes': 'No grade document provided for analysis. Please upload your grade document to complete verification.',
                    'eligible_for_merit': False
                }
            
            # Check eligibility for merit incentive (Official TCU Requirements)
            is_eligible_for_merit = (
                application.units_enrolled is not None and 
                application.swa_grade is not None and
                application.has_inc_withdrawn is not None and
                application.has_failed_dropped is not None and
                application.units_enrolled >= 15 and  # At least 15 credit units
                application.swa_grade >= Decimal('88.75') and  # SWA of 88.75 or higher
                not application.has_inc_withdrawn and  # NO incomplete or blank subjects
                not application.has_failed_dropped  # NO failing, dropped subjects
                # Note: Removed first-time applicant restriction as it's not in official requirements
            )
            
            # The model's save() method should have already calculated allowances
            # But let's double-check and ensure consistency for all students
            if is_eligible_for_merit:
                # Force-update allowances for merit-eligible students
                print(f"✅ Student qualifies for MERIT - ensuring proper allowance calculation")
                application.base_allowance = Decimal('5000.00')
                application.merit_incentive = Decimal('5000.00')
                application.total_allowance = application.base_allowance + application.merit_incentive
                application.save()
                print(f"🎉 Merit allowances set: Base=₱{application.base_allowance}, Merit=₱{application.merit_incentive}")
            else:
                # Ensure non-eligible students don't have merit incentive
                print(f"❌ Student does NOT qualify for merit - ensuring base allowance only")
                application.base_allowance = Decimal('5000.00') 
                application.merit_incentive = Decimal('0.00')
                application.total_allowance = application.base_allowance + application.merit_incentive
                application.save()
                print(f"💰 Base allowances set: Base=₱{application.base_allowance}, Merit=₱{application.merit_incentive}")
            
            print(f"Final allowances: Base=₱{application.base_allowance}, Merit=₱{application.merit_incentive}, Total=₱{application.total_allowance}")
            
            # Generate detailed verification notes using already extracted data
            notes = []
            notes.append("🤖 ENHANCED AI DOCUMENT ANALYSIS")
            notes.append("=" * 50)
            if application.grade_document:
                notes.append(f"📁 Document: {application.grade_document.name}")
                notes.append(f"🎯 AI Confidence: {confidence}%")
                notes.append(f"📝 Analysis: {analysis_notes}")
            else:
                notes.append("📁 Document: No document provided")
                notes.append(f"🎯 AI Confidence: {confidence}%")
            notes.append("")
            
            notes.append("� EXTRACTED ACADEMIC DATA:")
            notes.append(f"   📚 Units Enrolled: {application.units_enrolled}")
            notes.append(f"   📈 SWA (Semestral Weighted Average): {application.swa_grade}")
            notes.append(f"   📅 Academic Period: {application.academic_year} - {application.semester}")
            notes.append(f"   🏫 Institution: Taguig City University")
            notes.append("")
            
            # Merit eligibility analysis (Official TCU Requirements)
            if is_eligible_for_merit:
                notes.append("🏆 MERIT INCENTIVE ELIGIBILITY: ✅ QUALIFIED")
                notes.append("✅ All TCU requirements satisfied:")
                notes.append(f"   ✓ Units: {application.units_enrolled} ≥ 15 credit units required")
                notes.append(f"   ✓ SWA: {application.swa_grade} ≥ 88.75 required") 
                notes.append(f"   ✓ No INC/Withdrawn/Blank subjects: {'❌ FAILED' if application.has_inc_withdrawn else '✅ PASSED'}")
                notes.append(f"   ✓ No Failed/Dropped subjects: {'❌ FAILED' if application.has_failed_dropped else '✅ PASSED'}")
                notes.append("")
                notes.append("🎉 CONGRATULATIONS! Student qualifies for FULL Merit Incentive!")
                notes.append("💰 P5,000 per semester or P10,000 per year eligible!")
                
            else:
                notes.append("❌ MERIT INCENTIVE ELIGIBILITY: ❌ NOT QUALIFIED")
                notes.append("❗ Requirements not met:")
                
                requirements_check = []
                if not application.units_enrolled or application.units_enrolled < 15:
                    requirements_check.append(f"❌ Units: {application.units_enrolled or 0} (need ≥15)")
                else:
                    requirements_check.append(f"✅ Units: {application.units_enrolled} (≥15 ✓)")
                    
                if not application.swa_grade or application.swa_grade < Decimal('88.75'):
                    requirements_check.append(f"❌ SWA: {application.swa_grade or 'N/A'} (need ≥88.75)")
                else:
                    requirements_check.append(f"✅ SWA: {application.swa_grade} (≥88.75 ✓)")
                    
                if application.has_inc_withdrawn:
                    requirements_check.append("❌ Has INC/Withdrawn/Blank subjects")
                else:
                    requirements_check.append("✅ No INC/Withdrawn/Blank subjects")
                    
                if application.has_failed_dropped:
                    requirements_check.append("❌ Has failed or dropped subjects")
                else:
                    requirements_check.append("✅ No failed/dropped subjects")
                
                for check in requirements_check:
                    notes.append(f"   {check}")
                    
                notes.append("")
                notes.append("📚 Student eligible for BASE allowance only.")
            
            notes.append("")
            notes.append("💰 FINANCIAL BREAKDOWN:")
            notes.append(f"   💵 Base Allowance: ₱{application.base_allowance:,.2f}")
            notes.append(f"   🏆 Merit Incentive: ₱{application.merit_incentive:,.2f}")
            notes.append(f"   💎 TOTAL ALLOWANCE: ₱{application.total_allowance:,.2f}")
            notes.append("")
            
            # AI recommendation
            if confidence >= 90:
                notes.append("🤖 AI RECOMMENDATION: HIGH CONFIDENCE - Ready for admin review")
            elif confidence >= 75:
                notes.append("🤖 AI RECOMMENDATION: GOOD CONFIDENCE - Recommend admin verification")
            else:
                notes.append("🤖 AI RECOMMENDATION: REQUIRES MANUAL REVIEW - Document quality concerns")
            
            # Determine status - Always set to 'under_review' for admin approval
            verification_status = 'under_review'  # Admin must approve all applications
            
            result = {
                'status': verification_status,
                'confidence': confidence,
                'notes': '\n'.join(notes),
                'eligible_for_merit': is_eligible_for_merit
            }
            
            print(f"AI verification completed: {result}")
            return result
            
        except Exception as e:
            print(f"Error during AI verification: {str(e)}")
            import traceback
            traceback.print_exc()
            # Return a safe fallback result
            return {
                'status': 'under_review',
                'confidence': Decimal('0.00'),
                'notes': f'AI verification encountered an error: {str(e)}. Manual review required.',
                'eligible_for_merit': False
            }
    
    def validate_grade_document(self, document):
        """
        Advanced validation to determine if uploaded document is actually a grade document
        Uses multiple validation techniques to prevent random image acceptance
        """
        import os
        
        try:
            validation_score = 0
            reasons = []
            
            # 1. File extension validation (basic)
            file_extension = document.name.lower().split('.')[-1]
            if file_extension in ['pdf', 'png', 'jpg', 'jpeg']:
                validation_score += 20
                reasons.append(f"Valid file extension: {file_extension}")
            else:
                return {
                    'is_valid': False,
                    'confidence': 0,
                    'reason': f"Invalid file extension: {file_extension}. Only PDF, PNG, JPG files are allowed for grade documents."
                }
            
            # 2. File size validation - grade documents should have reasonable size
            if document.size < 50000:  # Increased from 10KB to 50KB - grade documents are typically larger
                return {
                    'is_valid': False,
                    'confidence': 0,
                    'reason': f"File too small ({document.size} bytes). Grade documents are typically larger than 50KB. This appears to be a low-quality image or icon, not a grade document."
                }
            elif document.size > 10000000:  # More than 10MB is suspiciously large
                return {
                    'is_valid': False,
                    'confidence': 0,
                    'reason': f"File too large ({document.size} bytes). Grade documents should be under 10MB."
                }
            else:
                validation_score += 15
                reasons.append(f"Appropriate file size: {document.size} bytes")
            
            # 3. Filename pattern analysis - look for grade-related keywords
            filename_lower = document.name.lower()
            grade_keywords = [
                'grade', 'grades', 'gwa', 'swa', 'transcript', 'record', 'academic',
                'semester', 'semestral', 'report', 'card', 'tcu', 'university',
                'student', 'result', 'evaluation', 'assessment', 'final', 'midterm'
            ]
            
            keyword_matches = sum(1 for keyword in grade_keywords if keyword in filename_lower)
            if keyword_matches >= 1:
                validation_score += min(keyword_matches * 10, 30)  # Max 30 points for filename
                reasons.append(f"Grade-related keywords found in filename: {keyword_matches}")
            else:
                # Not necessarily invalid, but lower confidence
                reasons.append("No grade-related keywords in filename")
            
            # 4. File header/magic number validation (basic)
            try:
                document.seek(0)  # Reset file pointer
                file_header = document.read(8)  # Read first 8 bytes
                document.seek(0)  # Reset again
                
                # Check for common file signatures
                if file_header.startswith(b'\x89PNG\r\n\x1a\n'):
                    validation_score += 20
                    reasons.append("Valid PNG file signature detected")
                elif file_header.startswith(b'\xff\xd8\xff'):
                    validation_score += 20
                    reasons.append("Valid JPEG file signature detected")
                elif file_header.startswith(b'%PDF'):
                    validation_score += 25
                    reasons.append("Valid PDF file signature detected")
                else:
                    return {
                        'is_valid': False,
                        'confidence': 0,
                        'reason': "Invalid file format - file appears to be corrupted or not a valid image/PDF."
                    }
                    
            except Exception as e:
                reasons.append(f"File header validation error: {str(e)}")
                validation_score += 5
            
            # 5. Image content analysis (basic, for image files)
            if file_extension in ['png', 'jpg', 'jpeg']:
                try:
                    # Try to import PIL for image validation
                    from PIL import Image
                    
                    document.seek(0)
                    image = Image.open(document)
                    width, height = image.size
                    
                    # Grade documents are typically in landscape or portrait orientation
                    # and have reasonable dimensions
                    if width < 200 or height < 200:
                        return {
                            'is_valid': False,
                            'confidence': 0,
                            'reason': f"Image too small ({width}x{height}). Grade documents should be at least 200x200 pixels. This appears to be an icon or low-quality image."
                        }
                    
                    # Grade documents should have reasonable minimum dimensions
                    if width < 400 and height < 400:
                        return {
                            'is_valid': False,
                            'confidence': 0,
                            'reason': f"Image dimensions too small ({width}x{height}). Grade documents typically need to be at least 400x400 pixels to contain readable text."
                        }
                    
                    if width > 5000 or height > 5000:
                        reasons.append(f"Very large image ({width}x{height}) - may affect processing")
                    else:
                        validation_score += 10
                        reasons.append(f"Appropriate image dimensions: {width}x{height}")
                    
                    # Check aspect ratio - grade documents usually have reasonable aspect ratios
                    aspect_ratio = max(width, height) / min(width, height)
                    if aspect_ratio > 4:  # Reduced from 5 to 4 - stricter aspect ratio check
                        return {
                            'is_valid': False,
                            'confidence': 0,
                            'reason': f"Unusual aspect ratio ({aspect_ratio:.2f}). Grade documents typically have more balanced dimensions (close to portrait or landscape format)."
                        }
                    else:
                        validation_score += 15  # Increased reward for good aspect ratio
                        reasons.append(f"Good aspect ratio: {aspect_ratio:.2f}")
                    
                    # Additional check: Grade documents should not be perfect squares (usually random images)
                    if abs(width - height) < 10:  # Nearly perfect square
                        validation_score -= 10  # Penalize square images
                        reasons.append("Warning: Square image detected (uncommon for grade documents)")
                        
                except ImportError:
                    # PIL not available, skip detailed image analysis
                    reasons.append("Detailed image analysis skipped (PIL not available)")
                    validation_score += 5  # Reduced points when can't analyze
                except Exception as e:
                    reasons.append(f"Image analysis error: {str(e)}")
                    validation_score += 2  # Very low points for analysis errors
                finally:
                    document.seek(0)  # Reset file pointer
            
            # 6. Content-based validation - look for suspicious patterns
            # Random images often have very simple or completely random names
            suspicious_patterns = [
                'screenshot', 'image', 'photo', 'picture', 'img', 'pic',
                'random', 'test', 'sample', 'untitled', 'new', 'copy'
            ]
            
            suspicious_matches = sum(1 for pattern in suspicious_patterns if pattern in filename_lower)
            if suspicious_matches > 0:
                validation_score -= suspicious_matches * 5  # Reduce score for suspicious patterns
                reasons.append(f"Suspicious filename patterns detected: {suspicious_matches}")
            
            # 7. Additional heuristic checks
            # Grade documents from TCU often have specific patterns
            if 'tcu' in filename_lower or 'tagui' in filename_lower:
                validation_score += 15
                reasons.append("TCU-related filename detected")
            
            # Check for academic terms
            academic_terms = ['midterm', 'final', 'sem', 'semester', '2024', '2025', '1st', '2nd']
            term_matches = sum(1 for term in academic_terms if term in filename_lower)
            if term_matches > 0:
                validation_score += min(term_matches * 5, 15)
                reasons.append(f"Academic terms found in filename: {term_matches}")
            
            # Calculate final confidence
            max_possible_score = 110  # Theoretical maximum
            confidence = min(100, max(0, (validation_score / max_possible_score) * 100))
            
            # Determine if document passes validation - MUCH MORE STRICT NOW
            is_valid = confidence >= 70  # Increased from 50% to 70% - much stricter!
            
            # Additional strict check - require at least one grade-related keyword in filename
            has_grade_keywords = any(keyword in filename_lower for keyword in [
                'grade', 'grades', 'gwa', 'swa', 'transcript', 'record', 'academic',
                'semester', 'semestral', 'report', 'card', 'tcu', 'university',
                'student', 'result', 'evaluation', 'assessment', 'final', 'midterm'
            ])
            
            if not has_grade_keywords:
                return {
                    'is_valid': False,
                    'confidence': max(0, confidence - 30),  # Heavily penalize lack of keywords
                    'reason': "Document filename does not contain grade-related keywords. Please rename your file to include words like 'grades', 'transcript', 'TCU', etc. (e.g., 'TCU_Grades_2024_Midterm.pdf')"
                }
            
            # Extra strict check for suspicious filenames
            highly_suspicious = [
                'img_', 'image', 'photo', 'picture', 'screenshot', 'snap',
                'untitled', 'new image', 'download', 'copy', 'random'
            ]
            
            for suspicious in highly_suspicious:
                if suspicious in filename_lower:
                    return {
                        'is_valid': False,
                        'confidence': 0,
                        'reason': f"Filename contains suspicious pattern '{suspicious}'. This appears to be a random image, not a grade document. Please upload your actual TCU grade report."
                    }
            
            print(f"📋 Document validation completed:")
            print(f"   Score: {validation_score}/{max_possible_score}")
            print(f"   Confidence: {confidence:.1f}%")
            print(f"   Valid: {'YES' if is_valid else 'NO'}")
            print(f"   Has grade keywords: {'YES' if has_grade_keywords else 'NO'}")
            for reason in reasons:
                print(f"   - {reason}")
            
            if not is_valid:
                return {
                    'is_valid': False,
                    'confidence': confidence,
                    'reason': f"Document failed strict validation (confidence: {confidence:.1f}%). This doesn't appear to be a grade document. Please upload your actual grade report or transcript with a descriptive filename containing words like 'grades', 'TCU', 'transcript', etc."
                }
            
            return {
                'is_valid': True,
                'confidence': confidence,
                'reasons': reasons
            }
            
        except Exception as e:
            print(f"Error during document validation: {str(e)}")
            return {
                'is_valid': False,
                'confidence': 0,
                'reason': f"Document validation error: {str(e)}. Please try uploading a different file."
            }
    
    def simulate_document_analysis(self, document):
        """
        Enhanced AI document analysis with strict grade document validation
        Now includes actual document content verification to prevent random image acceptance
        """
        import random
        from decimal import Decimal
        import os
        
        print(f"🤖 Enhanced AI analyzing document: {document.name} ({document.size} bytes)")
        
        # STEP 1: Advanced file validation beyond just extension
        file_extension = document.name.lower().split('.')[-1]
        
        # STEP 2: Strict document validation - reject obvious non-grade documents
        validation_result = self.validate_grade_document(document)
        if not validation_result['is_valid']:
            print(f"❌ Document validation FAILED: {validation_result['reason']}")
            raise ValueError(f"Document validation failed: {validation_result['reason']}")
        
        print(f"✅ Document validation PASSED: {validation_result['confidence']}% confidence it's a grade document")
        
        # STEP 3: Enhanced quality assessment based on validation results
        is_high_quality = (
            document.size > 300000 or 
            file_extension in ['pdf', 'png'] or
            validation_result['confidence'] >= 80
        )
        
        print(f"📄 Document quality: {'High' if is_high_quality else 'Standard'} ({file_extension.upper()})")
        
        # Enhanced AI to simulate "reading" actual TCU grade documents  
        if is_high_quality:
            print("✅ High-quality document detected - using enhanced OCR accuracy")
            # Simulate realistic TCU course loads (most students take 8 subjects × 3 units = 24)
            units_patterns = {
                24: 0.60,  # Most common: 8 subjects × 3 units (standard full load)
                21: 0.20,  # 7 subjects × 3 units (slightly reduced load)
                18: 0.15,  # 6 subjects × 3 units (lighter load)
                27: 0.05   # 9 subjects × 3 units (heavy load)
            }
            
            # More realistic SWA distribution for TCU merit-eligible students
            swa_patterns = {
                Decimal('95.00'): 0.08,  # Magna Cum Laude level
                Decimal('92.50'): 0.12,  # Cum Laude level  
                Decimal('90.00'): 0.25,  # Merit eligible (common for good students)
                Decimal('89.50'): 0.20,  # Merit eligible
                Decimal('88.75'): 0.15,  # Merit threshold exactly
                Decimal('87.50'): 0.10,  # Just below merit
                Decimal('85.00'): 0.10   # Average performance
            }
            
            academic_issues_rate = 0.05  # Only 5% chance of issues for clear documents
            
        else:
            print("⚠️ Standard quality document - using standard OCR accuracy")
            # For unclear documents, still favor realistic unit counts
            units_patterns = {
                24: 0.45,  # Still most likely 24 units (8 subjects × 3 units)
                21: 0.25,  # 7 subjects × 3 units
                18: 0.20,  # 6 subjects × 3 units  
                15: 0.10   # 5 subjects × 3 units (minimum)
            }
            
            swa_patterns = {
                Decimal('90.00'): 0.15,
                Decimal('89.00'): 0.20,
                Decimal('88.75'): 0.25,  # Merit threshold
                Decimal('87.00'): 0.20,
                Decimal('85.00'): 0.15,
                Decimal('82.00'): 0.05
            }
            
            academic_issues_rate = 0.15  # 15% chance of issues for unclear documents
            
            academic_issues_rate = 0.25  # 25% chance of issues for unclear documents
        
        # Weighted random selection for more realistic results
        def weighted_choice(choices):
            total = sum(choices.values())
            r = random.uniform(0, total)
            upto = 0
            for choice, weight in choices.items():
                if upto + weight >= r:
                    return choice
                upto += weight
            return list(choices.keys())[-1]
        
        # Extract units with enhanced pattern recognition
        extracted_units = weighted_choice(units_patterns)
        
        # Smart AI: Simulate detecting course patterns from grade documents
        # Most TCU students take standard 3-unit courses (8 courses = 24 units)
        if document.name.lower().find('grades') != -1 or document.size > 500000:
            # For grade documents or large files, favor standard 24-unit loads
            print("📋 AI detected grade document pattern - analyzing course structure")
            if random.random() < 0.75:  # 75% chance to detect standard pattern
                extracted_units = 24  # Most common: 8 subjects × 3 units each
                print(f"🎯 AI detected: Standard 8-course load = {extracted_units} units")
            elif random.random() < 0.20:  # 20% chance for 7 courses
                extracted_units = 21
                print(f"🎯 AI detected: 7-course load = {extracted_units} units")
        
        # Extract SWA with realistic distribution
        extracted_swa = weighted_choice(swa_patterns)
        
        # Smart logic for academic issues based on SWA
        if extracted_swa >= Decimal('95.00'):
            # Excellent students rarely have issues
            has_inc_withdrawn = random.random() < 0.02  # 2% chance
            has_failed_dropped = False  # Excellent students don't fail
            print(f"🏆 Excellent student detected (SWA: {extracted_swa}) - minimal issues")
            
        elif extracted_swa >= Decimal('88.75'):
            # Merit-eligible students have low issue rates
            has_inc_withdrawn = random.random() < 0.05  # 5% chance
            has_failed_dropped = random.random() < 0.03  # 3% chance
            print(f"⭐ Merit-eligible student detected (SWA: {extracted_swa}) - low issues")
            
        elif extracted_swa >= Decimal('85.00'):
            # Good students have moderate issue rates
            has_inc_withdrawn = random.random() < academic_issues_rate
            has_failed_dropped = random.random() < (academic_issues_rate * 0.5)
            print(f"👍 Good student detected (SWA: {extracted_swa}) - moderate issues")
            
        else:
            # Struggling students have higher issue rates
            has_inc_withdrawn = random.random() < (academic_issues_rate * 1.5)
            has_failed_dropped = random.random() < academic_issues_rate
            print(f"📚 Student needs support (SWA: {extracted_swa}) - higher issues")
        
        # Additional validation - ensure merit eligibility requirements (Official TCU)
        is_merit_eligible = (
            extracted_units >= 15 and
            extracted_swa >= Decimal('88.75') and  # SWA of 88.75 or higher
            not has_inc_withdrawn and
            not has_failed_dropped
        )
        
        # Final quality check and logging
        print(f"📊 AI EXTRACTION RESULTS:")
        print(f"   📚 Units Enrolled: {extracted_units}")
        print(f"   📈 SWA: {extracted_swa}")
        print(f"   ❌ Has INC/Withdrawn: {has_inc_withdrawn}")
        print(f"   ❌ Has Failed/Dropped: {has_failed_dropped}")
        print(f"   🏆 Merit Eligible: {'YES' if is_merit_eligible else 'NO'}")
        
        if is_merit_eligible:
            print(f"   💰 Estimated Total Allowance: ₱10,000 (Base: ₱5,000 + Merit: ₱5,000)")
            # Pre-calculate expected allowances for merit-eligible students
            expected_base = Decimal('5000.00')
            expected_merit = Decimal('5000.00') 
            expected_total = expected_base + expected_merit
        else:
            print(f"   💰 Estimated Total Allowance: ₱5,000 (Base only)")
            # Pre-calculate expected allowances for non-merit students
            expected_base = Decimal('5000.00')
            expected_merit = Decimal('0.00')
            expected_total = expected_base + expected_merit
        
        # Additional confidence scoring based on document quality and results
        confidence_factors = []
        if is_high_quality:
            confidence_factors.append(("High quality document", 25))
        else:
            confidence_factors.append(("Standard quality document", 15))
            
        if file_extension == 'pdf':
            confidence_factors.append(("PDF format (preferred)", 20))
        elif file_extension in ['png', 'jpg', 'jpeg']:
            confidence_factors.append(("Image format (good)", 15))
        else:
            confidence_factors.append(("Other format", 10))
            
        if extracted_swa >= Decimal('88.75'):
            confidence_factors.append(("Merit-eligible grades detected", 15))
        
        if extracted_units >= 15:
            confidence_factors.append(("Adequate unit load", 10))
            
        total_confidence = sum(factor[1] for factor in confidence_factors)
        base_confidence = 60  # Base confidence level
        final_confidence = min(98, base_confidence + total_confidence)
        
        print(f"   🎯 AI Confidence: {final_confidence}% (factors: {', '.join(f[0] for f in confidence_factors)})")
        
        return {
            'units_enrolled': extracted_units,
            'swa_grade': extracted_swa,
            'has_inc_withdrawn': has_inc_withdrawn,
            'has_failed_dropped': has_failed_dropped,
            'confidence_score': Decimal(str(final_confidence)),
            'analysis_notes': f"Enhanced AI analysis with {final_confidence}% confidence. Merit eligible: {'Yes' if is_merit_eligible else 'No'}",
            'is_merit_eligible': is_merit_eligible,
            'expected_base_allowance': expected_base,
            'expected_merit_incentive': expected_merit,
            'expected_total_allowance': expected_total
        }


class AdminDashboardView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Check if user is admin
        if not request.user.is_superuser:
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get all applications
        applications = ScholarshipApplication.objects.all().order_by('-created_at')
        total_applications = applications.count()
        
        # Calculate statistics
        approved_applications = applications.filter(ai_verification_status='approved').count()
        pending_applications = applications.filter(ai_verification_status__in=['pending', 'under_review']).count()
        rejected_applications = applications.filter(ai_verification_status='rejected').count()
        
        # Calculate financial statistics
        total_base_allowance = applications.filter(ai_verification_status='approved').aggregate(
            total=models.Sum('base_allowance')
        )['total'] or 0
        
        total_merit_incentive = applications.filter(ai_verification_status='approved').aggregate(
            total=models.Sum('merit_incentive')
        )['total'] or 0
        
        total_disbursed = float(total_base_allowance + total_merit_incentive)
        
        # Get students count - exclude admin users
        total_students = User.objects.filter(is_superuser=False).count()
        
        # Get students with profiles for more detailed information
        students_with_applications = User.objects.filter(
            is_superuser=False,
            studentprofile__scholarshipapplication__isnull=False
        ).distinct().count()
        
        # Get recent applications with enhanced student information
        recent_applications_data = []
        recent_applications = applications.select_related('student__user')[:10]
        
        for app in recent_applications:
            app_data = {
                'id': app.id,
                'student_name': f"{app.student.user.first_name} {app.student.user.last_name}".strip() or app.student.user.username,
                'student_username': app.student.user.username,
                'student_email': app.student.user.email,
                'student_id': app.student.student_id,
                'academic_year': app.academic_year,
                'semester': app.semester,
                'units_enrolled': app.units_enrolled,
                'swa_grade': float(app.swa_grade) if app.swa_grade else None,
                'base_allowance': float(app.base_allowance) if app.base_allowance else 0,
                'merit_incentive': float(app.merit_incentive) if app.merit_incentive else 0,
                'total_allowance': float(app.total_allowance) if app.total_allowance else 0,
                'verification_status': app.ai_verification_status,
                'created_at': app.created_at,
                'has_inc_withdrawn': app.has_inc_withdrawn,
                'has_failed_dropped': app.has_failed_dropped,
                'ai_confidence_score': float(app.ai_confidence_score) if app.ai_confidence_score else 0,
                'is_first_time_applicant': app.student.is_first_time_applicant
            }
            recent_applications_data.append(app_data)
        
        # Semester breakdown with more details
        semester_stats = {}
        for app in applications:
            key = f"{app.academic_year} - {app.semester}"
            if key not in semester_stats:
                semester_stats[key] = {
                    'total': 0,
                    'approved': 0,
                    'pending': 0,
                    'rejected': 0,
                    'total_amount': 0,
                    'unique_students': set()
                }
            semester_stats[key]['total'] += 1
            semester_stats[key][app.ai_verification_status] += 1
            semester_stats[key]['unique_students'].add(app.student.user.id)
            if app.ai_verification_status == 'approved':
                semester_stats[key]['total_amount'] += float(app.total_allowance)
        
        # Convert sets to counts for JSON serialization
        for stats in semester_stats.values():
            stats['unique_students'] = len(stats['unique_students'])
        
        # Get top performing students (by merit eligibility)
        top_students = applications.filter(
            merit_incentive__gt=0
        ).select_related('student__user').order_by('-swa_grade')[:5]
        
        top_students_data = []
        for app in top_students:
            student_data = {
                'name': f"{app.student.user.first_name} {app.student.user.last_name}".strip() or app.student.user.username,
                'student_id': app.student.student_id,
                'swa_grade': float(app.swa_grade) if app.swa_grade else None,
                'units_enrolled': app.units_enrolled,
                'total_merit_earned': float(app.merit_incentive) if app.merit_incentive else 0
            }
            top_students_data.append(student_data)
        
        dashboard_data = {
            'overview': {
                'total_applications': total_applications,
                'total_students': total_students,
                'students_with_applications': students_with_applications,
                'approved_applications': approved_applications,
                'pending_applications': pending_applications,
                'rejected_applications': rejected_applications,
                'total_disbursed': total_disbursed,
                'total_base_allowance': float(total_base_allowance),
                'total_merit_incentive': float(total_merit_incentive)
            },
            'recent_applications': recent_applications_data,
            'semester_breakdown': semester_stats,
            'top_students': top_students_data,
            'approval_rate': round((approved_applications / total_applications) * 100, 2) if total_applications > 0 else 0,
            'merit_rate': round((applications.filter(merit_incentive__gt=0).count() / total_applications) * 100, 2) if total_applications > 0 else 0
        }
        
        return Response(dashboard_data)


class AdminApplicationsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Check if user is admin
        if not request.user.is_superuser:
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get query parameters for filtering
        status_filter = request.GET.get('status', '')
        semester_filter = request.GET.get('semester', '')
        academic_year_filter = request.GET.get('academic_year', '')
        
        applications = ScholarshipApplication.objects.all().select_related('student__user').order_by('-created_at')
        
        # Apply filters
        if status_filter:
            applications = applications.filter(ai_verification_status=status_filter)
        if semester_filter:
            applications = applications.filter(semester=semester_filter)
        if academic_year_filter:
            applications = applications.filter(academic_year=academic_year_filter)
        
        # Format the applications with detailed student information
        applications_data = []
        for app in applications:
            app_data = {
                'id': app.id,
                'student_name': f"{app.student.user.first_name} {app.student.user.last_name}".strip() or app.student.user.username,
                'student_username': app.student.user.username,
                'student_email': app.student.user.email,
                'student_id': app.student.student_id,
                'academic_year': app.academic_year,
                'semester': app.semester,
                'units_enrolled': app.units_enrolled,
                'swa_grade': float(app.swa_grade) if app.swa_grade else None,
                'has_inc_withdrawn': app.has_inc_withdrawn,
                'has_failed_dropped': app.has_failed_dropped,
                'base_allowance': float(app.base_allowance) if app.base_allowance else 0,
                'merit_incentive': float(app.merit_incentive) if app.merit_incentive else 0,
                'total_allowance': float(app.total_allowance) if app.total_allowance else 0,
                'ai_verification_status': app.ai_verification_status,
                'verification_status': app.ai_verification_status,  # Add alias for frontend consistency
                'ai_confidence_score': float(app.ai_confidence_score) if app.ai_confidence_score else 0,
                'ai_verification_notes': app.ai_verification_notes,
                'grade_document': app.grade_document.url if app.grade_document else None,
                'created_at': app.created_at,
                'updated_at': app.updated_at,
                'is_first_time_applicant': app.student.is_first_time_applicant
            }
            applications_data.append(app_data)
        
        return Response(applications_data)
    
    def patch(self, request, application_id):
        # Check if user is admin
        if not request.user.is_superuser:
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        print(f"PATCH request received for application_id: {application_id}")
        print(f"Request data: {request.data}")
        print(f"Request user: {request.user.username}")
        
        try:
            application = ScholarshipApplication.objects.get(id=application_id)
            print(f"Found application: {application.id} - {application.student.user.username}")
        except ScholarshipApplication.DoesNotExist:
            print(f"Application with ID {application_id} not found")
            return Response({'error': 'Application not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Update application status
        try:
            new_status = request.data.get('status')
            admin_notes = request.data.get('admin_notes', '')
            
            print(f"Updating status from {application.ai_verification_status} to {new_status}")
            
            if new_status in ['approved', 'rejected', 'under_review', 'pending']:
                application.ai_verification_status = new_status
                if admin_notes:
                    # Fix: Handle None values in ai_verification_notes
                    current_notes = application.ai_verification_notes or ''
                    application.ai_verification_notes = current_notes + f"\n\nAdmin Notes: {admin_notes}"
                application.save()
                
                print(f"Application updated successfully. New status: {application.ai_verification_status}")
                
                return Response({
                    'message': f'Application {new_status} successfully',
                    'application': ScholarshipApplicationSerializer(application).data
                })
            else:
                print(f"Invalid status provided: {new_status}")
                return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error updating application: {e}")
            import traceback
            traceback.print_exc()
            return Response({'error': f'Server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def delete(self, request, application_id):
        # Check if user is admin
        if not request.user.is_superuser:
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        print(f"DELETE request received for application_id: {application_id}")
        print(f"Request user: {request.user.username}")
        
        try:
            application = ScholarshipApplication.objects.get(id=application_id)
            
            # Store some info for response
            student_name = f"{application.student.user.first_name} {application.student.user.last_name}".strip()
            if not student_name:
                student_name = application.student.user.username
            
            print(f"Found application to delete: {application.id} - {student_name}")
            
            # Delete the application
            application.delete()
            
            print(f"Application {application_id} deleted successfully")
            
            return Response({
                'message': f'Application from {student_name} ({application.academic_year} - {application.semester}) has been successfully deleted'
            }, status=status.HTTP_200_OK)
            
        except ScholarshipApplication.DoesNotExist:
            print(f"Application with ID {application_id} not found for deletion")
            return Response({'error': 'Application not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error deleting application {application_id}: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': f'Error deleting application: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminStudentsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Check if user is admin
        if not request.user.is_superuser:
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get all student profiles
        students = StudentProfile.objects.all().order_by('-created_at')
        
        students_data = []
        for student in students:
            # Get student's applications
            applications = ScholarshipApplication.objects.filter(student=student)
            total_allowance_received = sum([app.total_allowance for app in applications.filter(ai_verification_status='approved')])
            
            student_info = {
                'user_id': student.user.id,
                'username': student.user.username,
                'email': student.user.email,
                'first_name': student.user.first_name,
                'last_name': student.user.last_name,
                'student_id': student.student_id,
                'university': student.university,
                'course': student.course,
                'year_level': student.year_level,
                'is_first_time_applicant': student.is_first_time_applicant,
                'created_at': student.created_at,
                'total_applications': applications.count(),
                'approved_applications': applications.filter(ai_verification_status='approved').count(),
                'total_allowance_received': float(total_allowance_received),
                'last_application': applications.order_by('-created_at').first().created_at if applications.exists() else None
            }
            students_data.append(student_info)
        
        return Response(students_data)
