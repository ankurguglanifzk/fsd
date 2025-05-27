export const apiService = {
    login: async (username, password) => {
      const response = await fetch('http://localhost:5000/api/v1/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body:  JSON.stringify({ Username: username, Password: password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');
      return data;
    },
    logout: async () => {
      const response = await fetch('http://localhost:5000/api/v1/users/logout', {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        let errorMessage = `Logout failed with status: ${response.status}`;
        try {
          // Assuming the server might send a JSON error object with a 'message' field
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If parsing JSON fails, stick with the status-based message
          // Or try response.text() as a fallback
        }
        throw new Error(errorMessage);
      }
      // No explicit return needed for success, or could return true/response if useful
    },
    request: async (endpoint, options = {}) => {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        ...options,
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Request failed');
      return data;
    }
  };