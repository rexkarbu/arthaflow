'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, register } from '@/app/actions';
import { Lock, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginForm() {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);

    if (isRegister) {
      const res = await register(fd);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message || 'Akun berhasil dibuat. Silakan login.');
        setIsRegister(false);
        e.currentTarget.reset();
      }
      setLoading(false);
    } else {
      const res = await login(fd);
      if (res?.error) {
        toast.error(res.error);
        setLoading(false);
      } else {
        toast.success('Login berhasil!');
        router.push('/');
        router.refresh();
      }
    }
  }


  return (
    <div className="login-container">
      <div className="login-card card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--cyan)' }}>
          {isRegister ? <UserPlus size={40} /> : <Lock size={40} />}
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>ArthaFlow.</h2>
        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
          {isRegister ? 'Buat akun baru Anda.' : 'Masukkan username dan password.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <input
              type="text"
              name="username"
              className="input"
              placeholder="Username..."
              required
              autoFocus
              style={{ textAlign: 'center', letterSpacing: '1px' }}
            />
          </div>
          <div className="field">
            <input
              type="password"
              name="password"
              className="input"
              placeholder="Password..."
              required
              style={{ textAlign: 'center', letterSpacing: '2px' }}
            />
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Memeriksa...' : (isRegister ? 'Daftar' : 'Masuk')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem' }}>
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {isRegister ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Buat baru'}
          </button>
        </div>
      </div>
    </div>
  );
}
