from django.urls import path
from .views import (MessageView, RegisterView, LoginView, LogoutView, 
                   UserProfileView, DashboardView, ScholarshipApplicationView,
                   AdminDashboardView, AdminApplicationsView, AdminStudentsView)

urlpatterns = [
    path('messages/', MessageView.as_view(), name='messages'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/profile/', UserProfileView.as_view(), name='profile'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('scholarship/apply/', ScholarshipApplicationView.as_view(), name='scholarship_apply'),
    path('scholarship/applications/', ScholarshipApplicationView.as_view(), name='scholarship_applications'),
    
    # Admin routes
    path('admin/dashboard/', AdminDashboardView.as_view(), name='admin_dashboard'),
    path('admin/applications/', AdminApplicationsView.as_view(), name='admin_applications'),
    path('admin/applications/<int:application_id>/', AdminApplicationsView.as_view(), name='admin_application_detail'),
    path('admin/students/', AdminStudentsView.as_view(), name='admin_students'),
]
