const config = {
  socketUrl: import.meta.env.DEV 
    ? 'http://localhost:3001'  // Local development
    : 'https://timed-doodle-challenge.onrender.com'  // Production
};

export default config; 