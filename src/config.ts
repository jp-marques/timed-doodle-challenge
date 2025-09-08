const PROD_FALLBACK = 'https://timed-doodle-challenge.onrender.com';

const config = {
  socketUrl:
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SOCKET_URL)
      ? (import.meta as any).env.VITE_SOCKET_URL
      : (import.meta.env.DEV ? 'http://localhost:3001' : PROD_FALLBACK),
};

export default config; 