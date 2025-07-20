import React, { useState } from 'react';

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
    student_id: '',
    password_confirm: ''
  });
  const [message, setMessage] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, apply, applications, admin-dashboard, admin-applications, admin-students
  const [gradeFormData, setGradeFormData] = useState({
    academic_year: '',
    semester: '',
    grade_document: null
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [adminApplications, setAdminApplications] = useState([]);
  const [adminApplicationsLoading, setAdminApplicationsLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [buttonLoading, setButtonLoading] = useState({});

  // Handle form input changes
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Handle grade form input changes
  const handleGradeFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setGradeFormData({
      ...gradeFormData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // Handle file upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setMessage('File size must be less than 5MB');
        return;
      }
      
      // Check file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        setMessage('Only PDF, JPG, and PNG files are allowed');
        return;
      }
      
      setGradeFormData({
        ...gradeFormData,
        grade_document: file
      });
      setMessage('');
    }
  };

  // Handle grade submission
  const handleGradeSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      // Check if we have a valid token
      if (!token) {
        throw new Error('Authentication token missing. Please log in again.');
      }

      if (!gradeFormData.academic_year || !gradeFormData.semester) {
        throw new Error('Please fill in all required fields.');
      }

      if (!gradeFormData.grade_document) {
        throw new Error('Please select a grade document to upload.');
      }

      console.log('Starting submission with data:', {
        academic_year: gradeFormData.academic_year,
        semester: gradeFormData.semester,
        file_name: gradeFormData.grade_document?.name,
        file_size: gradeFormData.grade_document?.size,
        file_type: gradeFormData.grade_document?.type
      });

      const formData = new FormData();
      formData.append('academic_year', gradeFormData.academic_year);
      formData.append('semester', gradeFormData.semester);
      formData.append('grade_document', gradeFormData.grade_document);

      // Log FormData contents
      for (let [key, value] of formData.entries()) {
        console.log(`FormData: ${key}`, value instanceof File ? `File: ${value.name}` : value);
      }

      console.log('Sending POST request to API...');
      const response = await fetch('http://127.0.0.1:8000/api/scholarship/applications/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          // Don't set Content-Type header for FormData - let browser set it with boundary
        },
        body: formData
      });

      console.log('Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        // Handle HTTP errors
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
          console.error('Parsed error data:', errorData);
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          
          if (response.status === 0 || errorText.includes('fetch')) {
            throw new Error('Network error: Cannot connect to server. Please make sure:\n1. Django server is running on http://127.0.0.1:8000\n2. Check your internet connection\n3. Disable any firewall/antivirus that might block the connection');
          }
          
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }
        
        // Handle specific error types
        if (errorData.error) {
          throw new Error(errorData.error);
        } else {
          const errorMsg = Object.values(errorData).flat().join(', ');
          throw new Error(errorMsg || `HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('Success response data:', data);
      
      setSubmitMessage(`✅ ${data.message || 'Grade document submitted successfully for AI verification!'}`);
      
      // Reset form
      setGradeFormData({
        academic_year: '',
        semester: '',
        grade_document: null
      });
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      
      // Refresh applications data
      setApplicationsLoading(true);
      try {
        const applicationsData = await fetchApplications(token);
        setApplications(applicationsData);
      } catch (fetchError) {
        console.error('Failed to refresh applications:', fetchError);
      }
      setApplicationsLoading(false);
      
      // Switch to applications view to see the result
      setTimeout(() => {
        setCurrentView('applications');
      }, 3000);
      
    } catch (error) {
      console.error('Full submission error:', error);
      console.error('Error stack:', error.stack);
      
      let errorMessage = error.message;
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = 'Network error: Cannot connect to the Django server. Please make sure the Django development server is running on http://127.0.0.1:8000';
      }
      
      setSubmitMessage(`❌ ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        })
      });

      const data = await response.json();
      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        setMessage(data.message);
        
        // Check if user is admin
        setIsAdmin(data.user.is_superuser || false);
        
        // Set appropriate default view
        if (data.user.is_superuser) {
          setCurrentView('admin-dashboard');
        } else {
          setCurrentView('dashboard');
        }
        
        // Fetch dashboard data after successful login
        if (data.user.is_superuser) {
          await fetchAdminDashboardData(data.token);
        } else {
          await fetchDashboardData(data.token);
        }
      } else {
        setMessage(data.username?.[0] || data.password?.[0] || 'Login failed');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    }
  };

  // Handle registration
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setMessage('Please agree to the Terms and Conditions');
      return;
    }
    
    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        setMessage(data.message);
        // Fetch dashboard data after successful registration
        await fetchDashboardData(data.token);
      } else {
        const errorMsg = Object.values(data).flat().join(', ');
        setMessage(errorMsg || 'Registration failed');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    }
  };

  // Load applications when switching to applications view
  React.useEffect(() => {
    if (currentView === 'applications' && token && !applicationsLoading) {
      setApplicationsLoading(true);
      fetchApplications(token).then(data => {
        setApplications(data);
        setApplicationsLoading(false);
      });
    }
  }, [currentView, token]);

  // Load admin applications when switching to admin applications view
  React.useEffect(() => {
    if (currentView === 'admin-applications' && token && isAdmin && !adminApplicationsLoading) {
      setAdminApplicationsLoading(true);
      fetchAdminApplications(token).then(data => {
        setAdminApplications(data);
        setAdminApplicationsLoading(false);
      });
    }
  }, [currentView, token, isAdmin]);

  // Fetch dashboard data
  const fetchDashboardData = async (authToken) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/dashboard/', {
        headers: {
          'Authorization': `Token ${authToken}`,
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Check if backend is redirecting admin users
        if (data.redirect_to_admin) {
          setIsAdmin(true);
          setCurrentView('admin-dashboard');
          await fetchAdminDashboardData(authToken);
        } else {
          setDashboardData(data);
        }
      } else {
        console.error('Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  // Fetch admin dashboard data
  const fetchAdminDashboardData = async (authToken) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/dashboard/', {
        headers: {
          'Authorization': `Token ${authToken}`,
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAdminData(data);
      } else {
        console.error('Failed to fetch admin dashboard data');
      }
    } catch (error) {
      console.error('Error fetching admin dashboard data:', error);
    }
  };

  // Fetch applications
  const fetchApplications = async (authToken) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/scholarship/applications/', {
        headers: {
          'Authorization': `Token ${authToken}`,
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
    return [];
  };

  // Fetch admin applications
  const fetchAdminApplications = async (authToken) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/applications/', {
        headers: {
          'Authorization': `Token ${authToken}`,
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Error fetching admin applications:', error);
    }
    return [];
  };

  // Update application status (approve/reject)
  const updateApplicationStatus = async (applicationId, newStatus, adminNotes = '') => {
    try {
      console.log(`Updating application ${applicationId} to status: ${newStatus}`);
      console.log(`Using token: ${token ? 'Token exists' : 'No token'}`);
      console.log(`Admin notes: ${adminNotes}`);

      const response = await fetch(`http://127.0.0.1:8000/api/admin/applications/${applicationId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          admin_notes: adminNotes
        })
      });

      console.log(`Response status: ${response.status}`);
      console.log(`Response ok: ${response.ok}`);

      if (response.ok) {
        const data = await response.json();
        console.log('Success response:', data);
        
        // Refresh admin applications
        const updatedApplications = await fetchAdminApplications(token);
        setAdminApplications(updatedApplications);
        return { success: true, message: data.message || 'Application updated successfully' };
      } else {
        // Try to get error response
        let errorMessage = 'Failed to update application';
        try {
          const errorData = await response.json();
          console.error('Error response:', errorData);
          errorMessage = errorData.error || errorData.message || `Server error: ${response.status}`;
        } catch (jsonError) {
          console.error('Could not parse error response as JSON:', jsonError);
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        return { success: false, message: errorMessage };
      }
    } catch (error) {
      console.error('Network error updating application:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Network error occurred';
      if (error.message.includes('fetch')) {
        errorMessage = 'Could not connect to server. Please check if the backend is running.';
      } else if (error.message.includes('Unexpected token')) {
        errorMessage = 'Server returned invalid response. Please try again.';
      }
      
      return { success: false, message: errorMessage };
    }
  };

  // Delete application
  const deleteApplication = async (applicationId) => {
    try {
      console.log(`Deleting application ${applicationId}`);
      console.log(`Using token: ${token ? 'Token exists' : 'No token'}`);

      const response = await fetch(`http://127.0.0.1:8000/api/admin/applications/${applicationId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Token ${token}`,
        }
      });

      console.log(`Delete response status: ${response.status}`);
      console.log(`Delete response ok: ${response.ok}`);

      if (response.ok) {
        let data = { message: 'Application deleted successfully' };
        try {
          data = await response.json();
          console.log('Delete success response:', data);
        } catch (jsonError) {
          console.log('No JSON response from delete, using default message');
        }
        
        // Refresh admin applications
        const updatedApplications = await fetchAdminApplications(token);
        setAdminApplications(updatedApplications);
        return { success: true, message: data.message || 'Application deleted successfully' };
      } else {
        // Try to get error response
        let errorMessage = 'Failed to delete application';
        try {
          const errorData = await response.json();
          console.error('Delete error response:', errorData);
          errorMessage = errorData.error || errorData.message || `Server error: ${response.status}`;
        } catch (jsonError) {
          console.error('Could not parse delete error response as JSON:', jsonError);
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        return { success: false, message: errorMessage };
      }
    } catch (error) {
      console.error('Network error deleting application:', error);
      console.error('Delete error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Network error occurred';
      if (error.message.includes('fetch')) {
        errorMessage = 'Could not connect to server. Please check if the backend is running.';
      } else if (error.message.includes('Unexpected token')) {
        errorMessage = 'Server returned invalid response. Please try again.';
      }
      
      return { success: false, message: errorMessage };
    }
  };

  // Handle logout
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  // Confirm logout action
  const confirmLogout = async () => {
    setShowLogoutModal(false);
    
    try {
      await fetch('http://127.0.0.1:8000/api/auth/logout/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    setToken(null);
    setUser(null);
    setDashboardData(null);
    setAdminData(null);
    setIsAdmin(false);
    localStorage.removeItem('token');
    setMessage('Logged out successfully');
    setCurrentView('dashboard');
  };

  // Cancel logout
  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  // Check if user is already logged in
  React.useEffect(() => {
    if (token) {
      fetch('http://127.0.0.1:8000/api/auth/profile/', {
        headers: {
          'Authorization': `Token ${token}`,
        }
      })
      .then(res => {
        if (res.ok) {
          return res.json();
        }
        throw new Error('Token invalid');
      })
      .then(data => {
        setUser(data);
        setIsAdmin(data.is_superuser || false);
        if (data.is_superuser) {
          setCurrentView('admin-dashboard');
          fetchAdminDashboardData(token);
        } else {
          setCurrentView('dashboard');
          fetchDashboardData(token);
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
      });
    }
  }, []);

  // Render Dashboard
  const renderDashboard = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '20px',
      marginTop: '20px'
    }}>
      {/* Allowance Info Card */}
      <div style={{
        backgroundColor: '#f0fff4',
        padding: '30px',
        borderRadius: '12px',
        border: '2px solid #9ae6b4',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>💰</div>
        <h3 style={{ color: '#276749', margin: '0 0 10px 0' }}>Monthly Allowance</h3>
        <p style={{ color: '#2f855a', fontSize: '24px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
          ₱5,000.00
        </p>
        <p style={{ color: '#68d391', fontSize: '14px', margin: '0' }}>
          Base allowance for all TCU students
        </p>
      </div>

      {/* Merit Incentive Card */}
      <div style={{
        backgroundColor: '#fef5e7',
        padding: '30px',
        borderRadius: '12px',
        border: '2px solid #f6e05e',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>🏆</div>
        <h3 style={{ color: '#975a16', margin: '0 0 10px 0' }}>Merit Incentive</h3>
        <p style={{ color: '#d69e2e', fontSize: '24px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
          +₱5,000.00
        </p>
        <p style={{ color: '#f6ad55', fontSize: '14px', margin: '0' }}>
          Additional reward for excellence
        </p>
      </div>

      {/* Statistics Card */}
      <div style={{
        backgroundColor: '#ebf8ff',
        padding: '30px',
        borderRadius: '12px',
        border: '2px solid #90cdf4',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>📊</div>
        <h3 style={{ color: '#2a69ac', margin: '0 0 10px 0' }}>Your Status</h3>
        <p style={{ color: '#3182ce', fontSize: '16px', margin: '5px 0' }}>
          Total Applications: {dashboardData?.statistics?.total_applications || 0}
        </p>
        <p style={{ color: '#3182ce', fontSize: '16px', margin: '5px 0' }}>
          Approved: {dashboardData?.statistics?.approved_applications || 0}
        </p>
        <p style={{ color: '#3182ce', fontSize: '16px', margin: '5px 0' }}>
          Pending: {dashboardData?.statistics?.pending_applications || 0}
        </p>
        <p style={{ color: '#3182ce', fontSize: '16px', margin: '5px 0' }}>
          Rejected: {dashboardData?.statistics?.rejected_applications || 0}
        </p>
        <p style={{ color: '#22543d', fontSize: '16px', margin: '5px 0', fontWeight: 'bold' }}>
          Total Received: ₱{(dashboardData?.statistics?.total_allowance_received || 0).toLocaleString()}
        </p>
      </div>

      {/* Recent Applications Section - Full Width */}
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        gridColumn: '1 / -1'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <div>
            <div style={{ fontSize: '24px', marginBottom: '5px' }}>📋</div>
            <h3 style={{ color: '#1a202c', margin: '0' }}>Recent Applications</h3>
          </div>
          <button
            onClick={() => setCurrentView('applications')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            View All Applications
          </button>
        </div>
        
        {dashboardData?.recent_applications?.length > 0 ? (
          <div style={{ display: 'grid', gap: '15px' }}>
            {dashboardData.recent_applications.map((app) => (
              <div
                key={app.id}
                style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '20px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: '#1a202c', margin: '0 0 8px 0' }}>
                    {app.academic_year} - {app.semester}
                  </h4>
                  <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#4a5568' }}>
                    <span>Units: {app.units_enrolled || 'N/A'}</span>
                    <span>SWA: {app.swa_grade || 'N/A'}</span>
                    <span>Base: ₱{app.base_allowance || '0'}</span>
                    <span>Merit: ₱{app.merit_incentive || '0'}</span>
                    <span style={{ fontWeight: 'bold', color: '#22543d' }}>
                      Total: ₱{app.total_allowance || '0'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                    Submitted: {app.created_at ? new Date(app.created_at).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                
                <div style={{ marginLeft: '20px' }}>
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: '15px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: app.verification_status === 'approved' ? '#c6f6d5' : 
                                   app.verification_status === 'pending' ? '#fef5e7' : 
                                   app.verification_status === 'under_review' ? '#e6fffa' : '#fed7d7',
                    color: app.verification_status === 'approved' ? '#22543d' : 
                           app.verification_status === 'pending' ? '#744210' : 
                           app.verification_status === 'under_review' ? '#234e52' : '#742a2a',
                    border: `2px solid ${app.verification_status === 'approved' ? '#68d391' : 
                                        app.verification_status === 'pending' ? '#f6ad55' : 
                                        app.verification_status === 'under_review' ? '#4fd1c7' : '#fc8181'}`
                  }}>
                    {(app.verification_status || 'pending').toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px',
            color: '#718096'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>📄</div>
            <h4 style={{ color: '#4a5568', marginBottom: '8px' }}>No Applications Yet</h4>
            <p style={{ margin: '0' }}>Submit your grades to apply for the TCU Scholarship</p>
            <button
              onClick={() => setCurrentView('apply')}
              style={{
                marginTop: '15px',
                padding: '12px 24px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Apply Now
            </button>
          </div>
        )}
      </div>

      {/* Requirements Card */}
      <div style={{
        backgroundColor: '#fff5f5',
        padding: '30px',
        borderRadius: '12px',
        border: '2px solid #fed7d7',
        gridColumn: '1 / -1'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '15px' }}>📋</div>
        <h3 style={{ color: '#c53030', margin: '0 0 15px 0' }}>Merit Incentive Requirements</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
          <div style={{ color: '#e53e3e', fontSize: '14px' }}>✓ Must be taking at least 15 units</div>
          <div style={{ color: '#e53e3e', fontSize: '14px' }}>✓ SWA of 88.75 or 1.75 GPA</div>
          <div style={{ color: '#e53e3e', fontSize: '14px' }}>✓ Not a first time applicant</div>
          <div style={{ color: '#e53e3e', fontSize: '14px' }}>✓ No INC, withdrawn, failed, or dropped subjects</div>
        </div>
      </div>
    </div>
  );

  // Render Grade Upload Form
  const renderGradeUpload = () => (
    <div style={{
      backgroundColor: 'white',
      padding: '30px',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      marginTop: '20px'
    }}>
      <h3 style={{ color: '#2d3748', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>📄</span>
        Submit Grade Documents for AI Verification
      </h3>
      
      {submitMessage && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          backgroundColor: submitMessage.includes('successful') ? '#f0fff4' : '#fed7d7',
          border: `1px solid ${submitMessage.includes('successful') ? '#9ae6b4' : '#feb2b2'}`,
          borderRadius: '8px',
          color: submitMessage.includes('successful') ? '#276749' : '#c53030',
          fontSize: '14px'
        }}>
          {submitMessage}
        </div>
      )}
      
      <form onSubmit={handleGradeSubmit} style={{ display: 'grid', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#4a5568', fontWeight: '500' }}>
              Academic Year *
            </label>
            <input
              type="text"
              name="academic_year"
              value={gradeFormData.academic_year}
              onChange={handleGradeFormChange}
              placeholder="2024-2025"
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#4a5568', fontWeight: '500' }}>
              Semester *
            </label>
            <select
              name="semester"
              value={gradeFormData.semester}
              onChange={handleGradeFormChange}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            >
              <option value="">Select Semester</option>
              <option value="1st Semester">Midterm</option>
              <option value="2nd Semester">Finals</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: '#4a5568', fontWeight: '500' }}>
            Upload Grade Document *
          </label>
          <div style={{
            border: '2px dashed #cbd5e0',
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            backgroundColor: '#f7fafc',
            cursor: 'pointer',
            position: 'relative'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>
              {gradeFormData.grade_document ? '✅' : '📁'}
            </div>
            <p style={{ color: '#4a5568', margin: '0 0 5px 0' }}>
              {gradeFormData.grade_document 
                ? `Selected: ${gradeFormData.grade_document.name}`
                : 'Click to upload or drag and drop'
              }
            </p>
            <p style={{ color: '#718096', fontSize: '14px', margin: '0' }}>
              PDF, JPG, PNG files (Max 5MB)
            </p>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              required
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer'
              }}
            />
          </div>
        </div>

        <div style={{
          backgroundColor: '#f0f8ff',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #bee3f8'
        }}>
          <h4 style={{ color: '#2b6cb0', margin: '0 0 10px 0', fontSize: '16px' }}>
            🤖 AI Verification Process
          </h4>
          <p style={{ color: '#3182ce', fontSize: '14px', margin: '0 0 10px 0' }}>
            Our AI system will automatically analyze your uploaded document to:
          </p>
          <ul style={{ color: '#3182ce', fontSize: '14px', margin: '0', paddingLeft: '20px' }}>
            <li>Extract units enrolled and SWA grade information</li>
            <li>Verify document authenticity and TCU formatting</li>
            <li>Calculate scholarship allowances (Base: ₱5,000 + Merit: up to ₱5,000)</li>
            <li>Determine eligibility based on academic performance</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: '16px',
            background: isSubmitting 
              ? 'linear-gradient(135deg, #a0aec0 0%, #718096 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
        >
          <span>{isSubmitting ? '⏳' : '🤖'}</span>
          {isSubmitting ? 'Submitting for AI Verification...' : 'Submit for AI Verification'}
        </button>
      </form>
    </div>
  );

  // Render Admin Dashboard
  const renderAdminDashboard = () => (
    <div style={{
      display: 'grid',
      gap: '25px',
      marginTop: '20px'
    }}>
      {/* Header Section */}
      <div style={{
        background: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)',
        padding: '40px',
        borderRadius: '15px',
        color: 'white',
        boxShadow: '0 10px 30px rgba(26, 32, 44, 0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: '0 0 10px 0', fontSize: '32px', fontWeight: '800' }}>👨‍💼 Admin Dashboard</h1>
            <p style={{ margin: '0', fontSize: '16px', color: 'rgba(255,255,255,0.8)' }}>
              TCU Scholarship Management System
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
              System Administrator Access
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '30px',
          borderRadius: '15px',
          color: 'white',
          boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '120px', opacity: '0.1' }}>👥</div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '5px' }}>
              {adminData?.overview?.total_students || 0}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              Registered Students
            </div>
            <div style={{ fontSize: '14px', opacity: '0.9' }}>
              Total students in the system
            </div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
          padding: '30px',
          borderRadius: '15px',
          color: 'white',
          boxShadow: '0 8px 25px rgba(72, 187, 120, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '120px', opacity: '0.1' }}>📋</div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '5px' }}>
              {adminData?.overview?.total_applications || 0}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              Total Applications
            </div>
            <div style={{ fontSize: '14px', opacity: '0.9' }}>
              All scholarship submissions
            </div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #f6ad55 0%, #ed8936 100%)',
          padding: '30px',
          borderRadius: '15px',
          color: 'white',
          boxShadow: '0 8px 25px rgba(246, 173, 85, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '120px', opacity: '0.1' }}>✅</div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '5px' }}>
              {adminData?.overview?.approved_applications || 0}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              Approved
            </div>
            <div style={{ fontSize: '14px', opacity: '0.9' }}>
              {adminData?.approval_rate || 0}% approval rate
            </div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #fc8181 0%, #e53e3e 100%)',
          padding: '30px',
          borderRadius: '15px',
          color: 'white',
          boxShadow: '0 8px 25px rgba(252, 129, 129, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '120px', opacity: '0.1' }}>⏳</div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '5px' }}>
              {adminData?.overview?.pending_applications || 0}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              Pending Review
            </div>
            <div style={{ fontSize: '14px', opacity: '0.9' }}>
              Awaiting AI verification
            </div>
          </div>
        </div>
      </div>

      {/* Financial Overview */}
      <div style={{
        background: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)',
        padding: '40px',
        borderRadius: '15px',
        color: 'white',
        boxShadow: '0 8px 25px rgba(26, 32, 44, 0.3)'
      }}>
        <h3 style={{ 
          color: 'white', 
          margin: '0 0 30px 0', 
          fontSize: '24px', 
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '32px' }}>💰</span>
          Financial Summary
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '30px' }}>
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px', color: '#48bb78' }}>
              ₱{(adminData?.overview?.total_disbursed || 0).toLocaleString()}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', fontWeight: '500' }}>
              Total Disbursed
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px', color: '#4299e1' }}>
              ₱{(adminData?.overview?.total_base_allowance || 0).toLocaleString()}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', fontWeight: '500' }}>
              Base Allowances
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px', color: '#f6ad55' }}>
              ₱{(adminData?.overview?.total_merit_incentive || 0).toLocaleString()}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', fontWeight: '500' }}>
              Merit Incentives
            </div>
          </div>
        </div>
      </div>

      {/* Student Management Section */}
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '15px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 15px rgba(0,0,0,0.08)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '30px',
          paddingBottom: '20px',
          borderBottom: '2px solid #f7fafc'
        }}>
          <h3 style={{ 
            color: '#1a202c', 
            margin: '0', 
            fontSize: '26px', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '32px' }}>👨‍🎓</span>
            Student Applications Overview
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setCurrentView('admin-students')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              👥 View All Students
            </button>
            <button
              onClick={() => setCurrentView('admin-applications')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#1a202c',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(26, 32, 44, 0.3)'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              📋 View All Applications
            </button>
          </div>
        </div>
        
        {adminData?.recent_applications?.length > 0 ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '2fr 1fr 1fr auto auto', 
              gap: '20px', 
              padding: '16px 24px', 
              backgroundColor: '#f7fafc',
              borderRadius: '10px',
              fontWeight: '600',
              color: '#4a5568',
              fontSize: '14px'
            }}>
              <div>STUDENT INFORMATION</div>
              <div style={{ textAlign: 'center' }}>ACADEMIC INFO</div>
              <div style={{ textAlign: 'center' }}>ALLOWANCE</div>
              <div style={{ textAlign: 'center' }}>STATUS</div>
              <div style={{ textAlign: 'center' }}>ACTION</div>
            </div>
            {adminData.recent_applications.slice(0, 8).map((app) => (
              <div
                key={app.id}
                style={{
                  padding: '24px',
                  backgroundColor: '#fafbfc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr auto auto',
                  gap: '20px',
                  alignItems: 'center',
                  transition: 'all 0.3s ease',
                  ':hover': {
                    boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#1a202c', marginBottom: '6px' }}>
                    {app.student_name || app.student_username || 'Unknown Student'}
                  </div>
                  <div style={{ color: '#4a5568', fontSize: '14px', marginBottom: '4px' }}>
                    📧 Email: {app.student_email || 'Not provided'}
                  </div>
                  <div style={{ color: '#718096', fontSize: '13px' }}>
                    🆔 Student ID: {app.student_id || 'Not provided'} | 📅 Applied: {new Date(app.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c', marginBottom: '4px' }}>
                    {app.academic_year}
                  </div>
                  <div style={{ fontSize: '14px', color: '#4a5568', marginBottom: '2px' }}>
                    {app.semester}
                  </div>
                  <div style={{ fontSize: '12px', color: '#718096' }}>
                    {app.units_enrolled || 0} units • SWA: {app.swa_grade || 'N/A'}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2f855a', marginBottom: '4px' }}>
                    ₱{(app.total_allowance || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#718096' }}>
                    Base: ₱{(app.base_allowance || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#718096' }}>
                    Merit: ₱{(app.merit_incentive || 0).toLocaleString()}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: app.verification_status === 'approved' ? '#c6f6d5' : 
                                   app.verification_status === 'pending' ? '#fef5e7' : 
                                   app.verification_status === 'under_review' ? '#e6fffa' : '#fed7d7',
                    color: app.verification_status === 'approved' ? '#22543d' : 
                           app.verification_status === 'pending' ? '#744210' : 
                           app.verification_status === 'under_review' ? '#234e52' : '#742a2a',
                    border: `2px solid ${app.verification_status === 'approved' ? '#68d391' : 
                                        app.verification_status === 'pending' ? '#f6ad55' : 
                                        app.verification_status === 'under_review' ? '#4fd1c7' : '#fc8181'}`
                  }}>
                    {(app.verification_status || 'pending').toUpperCase()}
                  </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <button
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#4299e1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 8px rgba(66, 153, 225, 0.3)'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = '#3182ce';
                      e.target.style.transform = 'scale(1.05)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = '#4299e1';
                      e.target.style.transform = 'scale(1)';
                    }}
                  >
                    🔍 Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>📋</div>
            <h4 style={{ color: '#4a5568', marginBottom: '12px', fontSize: '22px' }}>No Applications Yet</h4>
            <p style={{ color: '#718096', fontSize: '16px' }}>Applications will appear here once students start submitting their scholarship requests.</p>
          </div>
        )}
      </div>

      {/* Quick Actions & System Status */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '25px'
      }}>
        <div style={{
          backgroundColor: '#edf2f7',
          padding: '30px',
          borderRadius: '15px',
          border: '1px solid #cbd5e0'
        }}>
          <h3 style={{ 
            color: '#1a202c', 
            margin: '0 0 20px 0', 
            fontSize: '20px', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>⚡</span>
            Quick Actions
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <button style={{
              padding: '16px 20px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              textAlign: 'left',
              transition: 'all 0.3s ease'
            }}>
              📊 Generate Reports
            </button>
            <button style={{
              padding: '16px 20px',
              backgroundColor: '#48bb78',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              textAlign: 'left',
              transition: 'all 0.3s ease'
            }}>
              💸 Process Disbursements
            </button>
            <button style={{
              padding: '16px 20px',
              backgroundColor: '#ed8936',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              textAlign: 'left',
              transition: 'all 0.3s ease'
            }}>
              🔧 System Settings
            </button>
          </div>
        </div>

        <div style={{
          backgroundColor: '#f0fff4',
          padding: '30px',
          borderRadius: '15px',
          border: '2px solid #48bb78'
        }}>
          <h3 style={{ 
            color: '#22543d', 
            margin: '0 0 20px 0', 
            fontSize: '20px', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>⚙️</span>
            System Status
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <span style={{ color: '#2f855a', fontWeight: '500' }}>AI Verification</span>
              <span style={{ color: '#22543d', fontWeight: 'bold' }}>🟢 Online</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <span style={{ color: '#2f855a', fontWeight: '500' }}>Database</span>
              <span style={{ color: '#22543d', fontWeight: 'bold' }}>🟢 Connected</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <span style={{ color: '#2f855a', fontWeight: '500' }}>File Storage</span>
              <span style={{ color: '#22543d', fontWeight: 'bold' }}>🟢 Available</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render applications view
  const renderApplications = () => {
    if (applicationsLoading) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          fontSize: '18px',
          color: '#666'
        }}>
          Loading applications...
        </div>
      );
    }

    return (
      <div style={{ padding: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          marginBottom: '30px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            color: 'white'
          }}>
            📋
          </div>
          <h2 style={{ color: '#333', margin: '0' }}>My Applications</h2>
        </div>

        {applications.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#f8f9ff',
            borderRadius: '12px',
            border: '2px dashed #ccc'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📄</div>
            <h3 style={{ color: '#666', marginBottom: '10px' }}>No Applications Yet</h3>
            <p style={{ color: '#888' }}>Submit your grades to apply for the TCU Scholarship Allowance</p>
            <button
              onClick={() => setCurrentView('apply')}
              style={{
                marginTop: '20px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '25px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                transition: 'all 0.3s ease'
              }}
            >
              Submit Grades Now
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {applications.map((app) => (
              <div
                key={app.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e5e5e5'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px'
                }}>
                  <div>
                    <h3 style={{ color: '#333', margin: '0 0 8px 0' }}>
                      {app.academic_year} - {app.semester}
                    </h3>
                    <p style={{ color: '#666', margin: '0', fontSize: '14px' }}>
                      Submitted on {app.created_at ? new Date(app.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <span style={{
                    padding: '6px 16px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: app.verification_status === 'approved' ? '#c6f6d5' : 
                                   app.verification_status === 'pending' ? '#fef5e7' : 
                                   app.verification_status === 'under_review' ? '#e6fffa' : '#fed7d7',
                    color: app.verification_status === 'approved' ? '#22543d' : 
                           app.verification_status === 'pending' ? '#744210' : 
                           app.verification_status === 'under_review' ? '#234e52' : '#742a2a',
                    border: `2px solid ${app.verification_status === 'approved' ? '#68d391' : 
                                        app.verification_status === 'pending' ? '#f6ad55' : 
                                        app.verification_status === 'under_review' ? '#4fd1c7' : '#fc8181'}`
                  }}>
                    {(app.verification_status || 'pending').toUpperCase()}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '16px',
                  marginBottom: '16px'
                }}>
                  <div>
                    <strong style={{ color: '#555' }}>Units Enrolled:</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#333' }}>{app.units_enrolled || 'N/A'}</p>
                  </div>
                  <div>
                    <strong style={{ color: '#555' }}>SWA Grade:</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#333' }}>{app.swa_grade || 'N/A'}</p>
                  </div>
                  <div>
                    <strong style={{ color: '#555' }}>Base Allowance:</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#333' }}>₱{app.base_allowance || '0'}</p>
                  </div>
                  <div>
                    <strong style={{ color: '#555' }}>Merit Allowance:</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#333' }}>₱{app.merit_incentive || '0'}</p>
                  </div>
                  <div>
                    <strong style={{ color: '#555' }}>Total Allowance:</strong>
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      color: '#28a745', 
                      fontSize: '18px', 
                      fontWeight: 'bold' 
                    }}>
                      ₱{app.total_allowance || '0'}
                    </p>
                  </div>
                </div>

                {app.ai_verification_details && (
                  <div style={{
                    backgroundColor: '#f8f9ff',
                    padding: '16px',
                    borderRadius: '8px',
                    marginTop: '16px'
                  }}>
                    <h4 style={{ color: '#333', margin: '0 0 8px 0', fontSize: '14px' }}>
                      AI Verification Details:
                    </h4>
                    <p style={{ color: '#666', margin: '0', fontSize: '13px' }}>
                      {app.ai_verification_details}
                    </p>
                  </div>
                )}

                {app.grade_document && (
                  <div style={{ marginTop: '16px' }}>
                    <a
                      href={`http://127.0.0.1:8000${app.grade_document}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#667eea',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      📎 View Grade Document
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render Admin Applications View
  const renderAdminApplications = () => {
    if (adminApplicationsLoading) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          fontSize: '18px',
          color: '#666'
        }}>
          Loading applications...
        </div>
      );
    }

    return (
      <div style={{ padding: '20px' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          marginBottom: '30px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            color: 'white'
          }}>
            📋
          </div>
          <h2 style={{ color: '#333', margin: '0' }}>All Student Applications</h2>
          <button
            onClick={() => setCurrentView('admin-dashboard')}
            style={{
              marginLeft: 'auto',
              padding: '10px 20px',
              backgroundColor: '#4a5568',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Applications List */}
        {adminApplications.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#f8f9ff',
            borderRadius: '12px',
            border: '2px dashed #ccc'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📄</div>
            <h3 style={{ color: '#666', marginBottom: '10px' }}>No Applications Found</h3>
            <p style={{ color: '#888' }}>Student applications will appear here once they start submitting their grades.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {adminApplications.map((app) => (
              <div
                key={app.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e5e5e5'
                }}
              >
                {/* Header Section */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px'
                }}>
                  <div>
                    <h3 style={{ color: '#333', margin: '0 0 8px 0', fontSize: '18px' }}>
                      {app.student_name || app.student_username || 'Unknown Student'}
                    </h3>
                    <p style={{ color: '#666', margin: '0', fontSize: '14px' }}>
                      📧 {app.student_email} | 🆔 {app.student_id || 'N/A'} | 📅 {app.academic_year} - {app.semester}
                    </p>
                    <p style={{ color: '#888', margin: '4px 0 0 0', fontSize: '12px' }}>
                      Submitted: {app.created_at ? new Date(app.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  
                  {/* Status Badge */}
                  <span style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: app.ai_verification_status === 'approved' ? '#c6f6d5' : 
                                   app.ai_verification_status === 'pending' ? '#fef5e7' : 
                                   app.ai_verification_status === 'under_review' ? '#e6fffa' : '#fed7d7',
                    color: app.ai_verification_status === 'approved' ? '#22543d' : 
                           app.ai_verification_status === 'pending' ? '#744210' : 
                           app.ai_verification_status === 'under_review' ? '#234e52' : '#742a2a',
                    border: `2px solid ${app.ai_verification_status === 'approved' ? '#68d391' : 
                                        app.ai_verification_status === 'pending' ? '#f6ad55' : 
                                        app.ai_verification_status === 'under_review' ? '#4fd1c7' : '#fc8181'}`
                  }}>
                    {(app.ai_verification_status || 'pending').toUpperCase()}
                  </span>
                </div>

                {/* Academic Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: '16px',
                  marginBottom: '16px',
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px'
                }}>
                  <div>
                    <strong style={{ color: '#555', fontSize: '12px' }}>Units:</strong>
                    <p style={{ margin: '2px 0 0 0', color: '#333', fontSize: '14px', fontWeight: '600' }}>
                      {app.units_enrolled || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#555', fontSize: '12px' }}>SWA Grade:</strong>
                    <p style={{ margin: '2px 0 0 0', color: '#333', fontSize: '14px', fontWeight: '600' }}>
                      {app.swa_grade || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#555', fontSize: '12px' }}>Base:</strong>
                    <p style={{ margin: '2px 0 0 0', color: '#333', fontSize: '14px', fontWeight: '600' }}>
                      ₱{app.base_allowance || '0'}
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#555', fontSize: '12px' }}>Merit:</strong>
                    <p style={{ margin: '2px 0 0 0', color: '#333', fontSize: '14px', fontWeight: '600' }}>
                      ₱{app.merit_incentive || '0'}
                    </p>
                  </div>
                  <div>
                    <strong style={{ color: '#555', fontSize: '12px' }}>Total:</strong>
                    <p style={{ 
                      margin: '2px 0 0 0', 
                      color: '#28a745', 
                      fontSize: '16px', 
                      fontWeight: 'bold' 
                    }}>
                      ₱{app.total_allowance || '0'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end'
                }}>
                  {app.ai_verification_status !== 'approved' && (
                    <button
                      onClick={() => handleStatusUpdate(app.id, 'approved')}
                      disabled={buttonLoading[`${app.id}-approved`]}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: buttonLoading[`${app.id}-approved`] ? '#a0aec0' : '#48bb78',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: buttonLoading[`${app.id}-approved`] ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.3s ease',
                        opacity: buttonLoading[`${app.id}-approved`] ? 0.7 : 1
                      }}
                      onMouseOver={(e) => {
                        if (!buttonLoading[`${app.id}-approved`]) {
                          e.target.style.backgroundColor = '#38a169';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!buttonLoading[`${app.id}-approved`]) {
                          e.target.style.backgroundColor = '#48bb78';
                        }
                      }}
                    >
                      {buttonLoading[`${app.id}-approved`] ? '⏳ Processing...' : '✅ Approve'}
                    </button>
                  )}
                  
                  {app.ai_verification_status !== 'rejected' && (
                    <button
                      onClick={() => handleStatusUpdate(app.id, 'rejected')}
                      disabled={buttonLoading[`${app.id}-rejected`]}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: buttonLoading[`${app.id}-rejected`] ? '#a0aec0' : '#f56565',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: buttonLoading[`${app.id}-rejected`] ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.3s ease',
                        opacity: buttonLoading[`${app.id}-rejected`] ? 0.7 : 1
                      }}
                      onMouseOver={(e) => {
                        if (!buttonLoading[`${app.id}-rejected`]) {
                          e.target.style.backgroundColor = '#e53e3e';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!buttonLoading[`${app.id}-rejected`]) {
                          e.target.style.backgroundColor = '#f56565';
                        }
                      }}
                    >
                      {buttonLoading[`${app.id}-rejected`] ? '⏳ Processing...' : '❌ Reject'}
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleStatusUpdate(app.id, 'under_review')}
                    disabled={buttonLoading[`${app.id}-under_review`]}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: buttonLoading[`${app.id}-under_review`] ? '#a0aec0' : '#4299e1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: buttonLoading[`${app.id}-under_review`] ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      transition: 'all 0.3s ease',
                      opacity: buttonLoading[`${app.id}-under_review`] ? 0.7 : 1
                    }}
                    onMouseOver={(e) => {
                      if (!buttonLoading[`${app.id}-under_review`]) {
                        e.target.style.backgroundColor = '#3182ce';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!buttonLoading[`${app.id}-under_review`]) {
                        e.target.style.backgroundColor = '#4299e1';
                      }
                    }}
                  >
                    {buttonLoading[`${app.id}-under_review`] ? '⏳ Processing...' : '🔄 Review'}
                  </button>

                  <button
                    onClick={() => handleDeleteApplication(app.id)}
                    disabled={buttonLoading[`${app.id}-delete`]}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: buttonLoading[`${app.id}-delete`] ? '#a0aec0' : '#e53e3e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: buttonLoading[`${app.id}-delete`] ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      transition: 'all 0.3s ease',
                      opacity: buttonLoading[`${app.id}-delete`] ? 0.7 : 1
                    }}
                    onMouseOver={(e) => {
                      if (!buttonLoading[`${app.id}-delete`]) {
                        e.target.style.backgroundColor = '#c53030';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!buttonLoading[`${app.id}-delete`]) {
                        e.target.style.backgroundColor = '#e53e3e';
                      }
                    }}
                  >
                    {buttonLoading[`${app.id}-delete`] ? '⏳ Deleting...' : '🗑️ Delete'}
                  </button>

                  {app.grade_document && (
                    <a
                      href={`http://127.0.0.1:8000${app.grade_document}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#805ad5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        textDecoration: 'none',
                        display: 'inline-block',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseOver={(e) => e.target.style.backgroundColor = '#6b46c1'}
                      onMouseOut={(e) => e.target.style.backgroundColor = '#805ad5'}
                    >
                      📄 View Document
                    </a>
                  )}
                </div>

                {/* AI Verification Notes */}
                {app.ai_verification_notes && (
                  <div style={{
                    backgroundColor: '#f0f8ff',
                    padding: '12px',
                    borderRadius: '6px',
                    marginTop: '16px',
                    border: '1px solid #bee3f8'
                  }}>
                    <h5 style={{ color: '#2b6cb0', margin: '0 0 8px 0', fontSize: '13px' }}>
                      🤖 AI Verification Notes:
                    </h5>
                    <pre style={{ 
                      color: '#3182ce', 
                      margin: '0', 
                      fontSize: '11px', 
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word'
                    }}>
                      {app.ai_verification_notes}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Handle status update
  const handleStatusUpdate = async (applicationId, newStatus) => {
    const buttonKey = `${applicationId}-${newStatus}`;
    
    // Prevent multiple clicks
    if (buttonLoading[buttonKey]) {
      console.log('Button already loading, ignoring click');
      return;
    }
    
    setButtonLoading(prev => ({ ...prev, [buttonKey]: true }));
    
    try {
      console.log(`Starting status update: ${applicationId} -> ${newStatus}`);
      const result = await updateApplicationStatus(applicationId, newStatus);
      
      if (result.success) {
        console.log('Status update successful:', result.message);
        alert(`✅ ${result.message}`);
      } else {
        console.error('Status update failed:', result.message);
        alert(`❌ ${result.message}`);
      }
    } catch (error) {
      console.error('Unexpected error in handleStatusUpdate:', error);
      alert(`❌ Unexpected error: ${error.message}`);
    } finally {
      setButtonLoading(prev => ({ ...prev, [buttonKey]: false }));
    }
  };

  // Handle delete application
  const handleDeleteApplication = async (applicationId) => {
    const buttonKey = `${applicationId}-delete`;
    
    // Prevent multiple clicks
    if (buttonLoading[buttonKey]) {
      console.log('Delete button already loading, ignoring click');
      return;
    }
    
    // Use window.confirm instead of global confirm
    if (window.confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
      setButtonLoading(prev => ({ ...prev, [buttonKey]: true }));
      
      try {
        console.log(`Starting delete: ${applicationId}`);
        const result = await deleteApplication(applicationId);
        
        if (result.success) {
          console.log('Delete successful:', result.message);
          alert(`✅ ${result.message}`);
        } else {
          console.error('Delete failed:', result.message);
          alert(`❌ ${result.message}`);
        }
      } catch (error) {
        console.error('Unexpected error in handleDeleteApplication:', error);
        alert(`❌ Unexpected error: ${error.message}`);
      } finally {
        setButtonLoading(prev => ({ ...prev, [buttonKey]: false }));
      }
    }
  };

  // Modern Logout Confirmation Modal
  const LogoutModal = () => {
    if (!showLogoutModal) return null;
    
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '480px',
          width: '90%',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)',
          transform: 'scale(1)',
          animation: 'modalSlideIn 0.3s ease-out',
          position: 'relative'
        }}>
          {/* Header Icon */}
          <div style={{
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto',
              backgroundColor: '#fee2e2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              marginBottom: '16px'
            }}>
              🚪
            </div>
            <h2 style={{
              color: '#1f2937',
              margin: '0',
              fontSize: '24px',
              fontWeight: '700'
            }}>
              Confirm Logout
            </h2>
          </div>

          {/* Message */}
          <div style={{
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            <p style={{
              color: '#6b7280',
              fontSize: '16px',
              lineHeight: '1.6',
              margin: '0 0 8px 0'
            }}>
              Are you sure you want to logout?
            </p>
            <p style={{
              color: '#9ca3af',
              fontSize: '14px',
              margin: '0'
            }}>
              You will need to login again to access your dashboard.
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center'
          }}>
            <button
              onClick={cancelLogout}
              style={{
                padding: '14px 28px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '120px'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#e5e7eb';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#f3f4f6';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmLogout}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '120px',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* CSS Animations as inline styles in a style tag */}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes modalSlideIn {
            from {
              opacity: 0;
              transform: scale(0.9) translateY(-20px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}</style>
      </div>
    );
  };

  // If user is logged in, show appropriate dashboard
  if (user && token) {
    if (isAdmin) {
      // Admin Dashboard Interface
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)',
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '40px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
          }}>
            {/* Admin Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <div style={{ fontSize: '60px', marginBottom: '10px' }}>👑</div>
                <h1 style={{ color: '#1a202c', margin: '0', fontSize: '32px', fontWeight: '700' }}>
                  TCU Admin Dashboard
                </h1>
                <p style={{ color: '#4a5568', fontSize: '18px', margin: '5px 0 0 0', fontWeight: '500' }}>
                  Welcome, Administrator! 
                  <span style={{ marginLeft: '15px', color: '#e53e3e', fontSize: '14px', fontWeight: 'bold' }}>
                    🛡️ ADMIN ACCESS
                  </span>
                </p>
              </div>
              <button 
                onClick={handleLogout}
                style={{
                  padding: '15px 30px',
                  backgroundColor: '#e53e3e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(229, 62, 62, 0.3)'
                }}
              >
                🚪 Logout
              </button>
            </div>

            {/* Admin Navigation */}
            <div style={{
              display: 'flex',
              gap: '15px',
              marginBottom: '30px',
              borderBottom: '2px solid #e2e8f0',
              paddingBottom: '20px'
            }}>
              <button
                onClick={() => setCurrentView('admin-dashboard')}
                style={{
                  padding: '15px 25px',
                  backgroundColor: currentView === 'admin-dashboard' ? '#1a202c' : 'transparent',
                  color: currentView === 'admin-dashboard' ? 'white' : '#1a202c',
                  border: '2px solid #1a202c',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                👑 Admin Overview
              </button>
              <button
                onClick={() => setCurrentView('admin-applications')}
                style={{
                  padding: '15px 25px',
                  backgroundColor: currentView === 'admin-applications' ? '#1a202c' : 'transparent',
                  color: currentView === 'admin-applications' ? 'white' : '#1a202c',
                  border: '2px solid #1a202c',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                📋 All Applications
              </button>
              <button
                onClick={() => setCurrentView('admin-students')}
                style={{
                  padding: '15px 25px',
                  backgroundColor: currentView === 'admin-students' ? '#1a202c' : 'transparent',
                  color: currentView === 'admin-students' ? 'white' : '#1a202c',
                  border: '2px solid #1a202c',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                👥 Student Management
              </button>
            </div>

            {/* Admin Content */}
            {currentView === 'admin-dashboard' && renderAdminDashboard()}
            {currentView === 'admin-applications' && renderAdminApplications()}
            {currentView === 'admin-students' && <div>Admin Students View (Coming Soon)</div>}
          </div>
          <LogoutModal />
        </div>
      );
    } else {
      // Student Dashboard Interface (existing)
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '40px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
          }}>
            {/* Student Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <div style={{ fontSize: '60px', marginBottom: '10px' }}>🎓</div>
                <h1 style={{ color: '#4a5568', margin: '0', fontSize: '28px', fontWeight: '600' }}>
                  TCU Scholarship System
                </h1>
                <p style={{ color: '#718096', fontSize: '16px', margin: '5px 0 0 0' }}>
                  Welcome, {user.first_name || user.username}! 
                  {user.student_profile && (
                    <span style={{ marginLeft: '10px', color: '#667eea' }}>
                      ID: {user.student_profile.student_id}
                    </span>
                  )}
                </p>
              </div>
              <button 
                onClick={handleLogout}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#e53e3e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                Logout
              </button>
            </div>

            {/* Student Navigation */}
            <div style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '20px',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '20px'
            }}>
              <button
                onClick={() => setCurrentView('dashboard')}
                style={{
                  padding: '12px 20px',
                  backgroundColor: currentView === 'dashboard' ? '#667eea' : 'transparent',
                  color: currentView === 'dashboard' ? 'white' : '#667eea',
                  border: '1px solid #667eea',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                � Dashboard
              </button>
              <button
                onClick={() => setCurrentView('apply')}
                style={{
                  padding: '12px 20px',
                  backgroundColor: currentView === 'apply' ? '#667eea' : 'transparent',
                  color: currentView === 'apply' ? 'white' : '#667eea',
                  border: '1px solid #667eea',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                � Submit Grades
              </button>
              <button
                onClick={() => setCurrentView('applications')}
                style={{
                  padding: '12px 20px',
                  backgroundColor: currentView === 'applications' ? '#667eea' : 'transparent',
                  color: currentView === 'applications' ? 'white' : '#667eea',
                  border: '1px solid #667eea',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                📋 My Applications
              </button>
            </div>

            {/* Student Content */}
            {currentView === 'dashboard' && renderDashboard()}
            {currentView === 'apply' && renderGradeUpload()}
            {currentView === 'applications' && renderApplications()}
          </div>
          <LogoutModal />
        </div>
      );
    }
  }

  // Show login/register form
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '50px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: isLogin ? '450px' : '600px',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ 
            fontSize: '60px',
            marginBottom: '20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🎓
          </div>
          <h1 style={{
            color: '#2d3748',
            fontSize: '32px',
            fontWeight: '700',
            margin: '0 0 10px 0',
            letterSpacing: '-0.5px'
          }}>
            {isLogin ? 'TCU Scholarship System' : 'Student Registration'}
          </h1>
          <p style={{
            color: '#718096',
            fontSize: '16px',
            margin: '0 0 5px 0'
          }}>
            {isLogin 
              ? 'AI-Driven Scholarship Evaluation and Grant Distribution'
              : 'TCU Scholarship System'
            }
          </p>
          {!isLogin && (
            <p style={{ color: '#718096', fontSize: '14px', margin: '0' }}>
              AI-Driven Scholarship Evaluation and Grant Distribution
            </p>
          )}
          <p style={{
            color: '#a0aec0',
            fontSize: '14px',
            margin: '10px 0 0 0'
          }}>
            Taguig City University - CEAA
          </p>
        </div>

        {/* Error/Success Message */}
        {message && (
          <div style={{
            padding: '15px',
            marginBottom: '25px',
            backgroundColor: message.includes('successful') ? '#f0fff4' : '#fed7d7',
            border: `1px solid ${message.includes('successful') ? '#9ae6b4' : '#feb2b2'}`,
            borderRadius: '8px',
            color: message.includes('successful') ? '#276749' : '#c53030',
            fontSize: '14px'
          }}>
            {message}
          </div>
        )}

        <form onSubmit={isLogin ? handleLogin : handleRegister}>
          {isLogin ? (
            // Login Form
            <>
              <div style={{ marginBottom: '25px', position: 'relative' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                  color: '#4a5568',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <span style={{ marginRight: '8px' }}>👤</span>
                  Username or Email
                </div>
                <input
                  type="text"
                  name="username"
                  placeholder="kyoti"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: '#f8f9fa',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#667eea';
                    e.target.style.backgroundColor = 'white';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.backgroundColor = '#f8f9fa';
                  }}
                />
              </div>

              <div style={{ marginBottom: '30px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                  color: '#4a5568',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <span style={{ marginRight: '8px' }}>🔒</span>
                  Password
                </div>
                <input
                  type="password"
                  name="password"
                  placeholder="........"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: '#f8f9fa',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#667eea';
                    e.target.style.backgroundColor = 'white';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.backgroundColor = '#f8f9fa';
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
              >
                <span>🚀</span>
                LOGIN
              </button>
            </>
          ) : (
            // Registration Form
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                  color: '#4a5568',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <span style={{ marginRight: '8px' }}>👤</span>
                  Full Name
                </div>
                <input
                  type="text"
                  name="first_name"
                  placeholder=""
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: '#f8f9fa',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                  color: '#4a5568',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <span style={{ marginRight: '8px' }}>🆔</span>
                  Student ID
                </div>
                <input
                  type="text"
                  name="student_id"
                  placeholder=""
                  value={formData.student_id}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: '#f8f9fa',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                  color: '#4a5568',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <span style={{ marginRight: '8px' }}>👤</span>
                  Username
                </div>
                <input
                  type="text"
                  name="username"
                  placeholder="kyoti"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: '#f8f9fa',
                    outline: 'none'
                  }}
                />
                <small style={{ color: '#718096', fontSize: '12px' }}>At least 3 characters</small>
              </div>

              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                  color: '#4a5568',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <span style={{ marginRight: '8px' }}>📧</span>
                  Email Address
                </div>
                <input
                  type="email"
                  name="email"
                  placeholder=""
                  value={formData.email}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: '#f8f9fa',
                    outline: 'none'
                  }}
                />
                <small style={{ color: '#718096', fontSize: '12px' }}>Use your TCU email if available</small>
              </div>

              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                  color: '#4a5568',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <span style={{ marginRight: '8px' }}>🔒</span>
                  Password
                </div>
                <input
                  type="password"
                  name="password"
                  placeholder="........"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: '#f8f9fa',
                    outline: 'none'
                  }}
                />
                <small style={{ color: '#718096', fontSize: '12px' }}>At least 6 characters</small>
              </div>

              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                  color: '#4a5568',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <span style={{ marginRight: '8px' }}>🔒</span>
                  Confirm Password
                </div>
                <input
                  type="password"
                  name="password_confirm"
                  placeholder=""
                  value={formData.password_confirm}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: '#f8f9fa',
                    outline: 'none'
                  }}
                />
                <small style={{ color: '#718096', fontSize: '12px' }}>Must match password</small>
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#4a5568'
                }}>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  I agree to the{' '}
                  <span style={{ color: '#667eea', textDecoration: 'underline', margin: '0 4px' }}>
                    Terms and Conditions
                  </span>
                  {' '}and{' '}
                  <span style={{ color: '#667eea', textDecoration: 'underline', marginLeft: '4px' }}>
                    Privacy Policy
                  </span>
                </label>
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  <span>👥</span>
                  REGISTER STUDENT ACCOUNT
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Toggle between Login and Register */}
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          {isLogin ? (
            <>
              <p style={{ color: '#718096', fontSize: '16px', margin: '0 0 15px 0' }}>
                Need a student account?
              </p>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setMessage('');
                  setFormData({
                    username: '',
                    password: '',
                    email: '',
                    first_name: '',
                    last_name: '',
                    student_id: '',
                    password_confirm: ''
                  });
                  setAgreedToTerms(false);
                }}
                style={{
                  background: 'none',
                  border: '2px solid #667eea',
                  color: '#667eea',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#667eea';
                  e.target.style.color = 'white';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#667eea';
                }}
              >
                <span>👥</span>
                Register as Student
              </button>
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f7fafc', borderRadius: '8px' }}>
                <p style={{ color: '#4a5568', fontSize: '13px', margin: '0', fontStyle: 'italic' }}>
                  💡 <strong>Admin Access:</strong> Use admin credentials to access the admin dashboard directly.
                </p>
              </div>
            </>
          ) : (
            <>
              <p style={{ color: '#718096', fontSize: '16px', margin: '0 0 15px 0' }}>
                Already have an account?
              </p>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setMessage('');
                  setFormData({
                    username: '',
                    password: '',
                    email: '',
                    first_name: '',
                    last_name: '',
                    student_id: '',
                    password_confirm: ''
                  });
                  setAgreedToTerms(false);
                }}
                style={{
                  background: 'none',
                  border: '2px solid #667eea',
                  color: '#667eea',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#667eea';
                  e.target.style.color = 'white';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#667eea';
                }}
              >
                <span>🔗</span>
                Login Here
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
