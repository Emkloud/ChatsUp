import { useState } from 'react'
import api from '../lib/api'

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const endpoint = isRegister ? '/register' : '/login'
      const { data } = await api.post(endpoint, form)
      if (isRegister) {
        setSuccess('Account created. Please sign in.')
        setIsRegister(false)
        setForm({ username: '', password: '' })
      } else {
        localStorage.setItem('token', data.token)
        window.location.href = '/'
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8">
        <h1 className="text-2xl font-semibold mb-6 text-center">WhatsApp Clone</h1>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            className="w-full p-3 border rounded"
            value={form.username}
            onChange={(e)=>setForm({...form, username: e.target.value})}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 border rounded"
            value={form.password}
            onChange={(e)=>setForm({...form, password: e.target.value})}
            required
          />
          <button disabled={loading} className="w-full bg-green-600 text-white py-3 rounded">
            {loading ? 'Please wait...' : (isRegister ? 'Sign up' : 'Sign in')}
          </button>
        </form>
        {error && <div className="text-red-600 mt-4 text-center">{error}</div>}
        {success && <div className="text-green-600 mt-4 text-center">{success}</div>}
        <div className="text-center mt-6">
          <button className="text-green-700" onClick={()=>setIsRegister(!isRegister)}>
            {isRegister ? 'Have an account? Sign in' : "No account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  )
}
