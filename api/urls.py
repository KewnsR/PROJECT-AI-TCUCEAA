from django.urls import path
from .views import MessageView, RegisterView, LoginView, LogoutView, UserProfileView, DashboardView, ScholarshipApplicationView

urlpatterns = [
    path('messages/', MessageView.as_view(), name='messages'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/profile/', UserProfileView.as_view(), name='profile'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('scholarship/applications/', ScholarshipApplicationView.as_view(), name='scholarship-applications'),
]
