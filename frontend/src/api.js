import axios from 'axios';

// Create a new Axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL ,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Use an interceptor to inject the token into every request
api.interceptors.request.use(
  (config) => {
    // MODIFIED: Retrieve 'access_token' to match the backend response
    const token = localStorage.getItem('access_token');
    
    // If the token exists, add it to the Authorization header
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    // Handle request errors
    return Promise.reject(error);
  }
);

export default api;