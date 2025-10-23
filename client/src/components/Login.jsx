import { useState } from 'react';
import axios from 'axios';
import { User, LogIn } from 'lucide-react';

export default function Login({ setToken }) {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const endpoint = isRegister ? '/api/register' : '/api/login';
      const { data } = await axios.post(endpoint, form);
      if (isRegister) {
        // registration success -> show message and switch to sign in
        setSuccess('Account created successfully. Please sign in.');
        setIsRegister(false);
        setForm({ username: '', password: '' });
      } else {
        localStorage.setItem('token', data.token);
        setToken(data.token);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-whatsapp-gray flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-whatsapp-green rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-whatsapp-dgray mb-2">WhatsApp</h1>
          <p className="text-whatsapp-lightgray">{isRegister ? 'Create account' : 'Sign in'}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Phone number, username, or email"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-whatsapp-green text-white py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? 'Loading...' : (isRegister ? 'Sign up' : 'Sign in')}
          </button>
        </form>

        {error && (
          <div className="mt-4 text-center text-red-600">{error}</div>
        )}
        {success && (
          <div className="mt-4 text-center text-green-600">{success}</div>
        )}

        <p className="text-center mt-6 text-whatsapp-lightgray">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-whatsapp-green font-semibold"
          >
            {isRegister ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}