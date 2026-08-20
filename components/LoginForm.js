'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, register } from '@/app/actions';
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
        toast.success('Login berhasil');
        router.push('/');
        router.refresh();
      }
    }
  }

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <div className="login-left">
          <div className="login-brand">
            ArthaFlow<span>.</span>
          </div>
          <h1 className="login-tagline">
            Keuangan pribadi, tanpa keribetan.
          </h1>
          <p className="login-desc">
            Pantau pemasukan, pengeluaran, budget, dan tujuan keuangan dalam satu tempat.
          </p>
        </div>
        
        <div className="login-right">
          <h2 className="login-form-title">
            {isRegister ? 'Buat akun baru' : 'Masuk ke ArthaFlow'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label">Username</label>
              <input
                type="text"
                name="username"
                className="input"
                placeholder="Username"
                required
                autoFocus
              />
            </div>
            <div className="field" style={{ marginBottom: '1.5rem' }}>
              <label className="label">Password</label>
              <input
                type="password"
                name="password"
                className="input"
                placeholder="Password"
                required
              />
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Memproses...' : (isRegister ? 'Daftar' : 'Masuk')}
            </button>
          </form>

          <div className="login-switch">
            {isRegister ? 'Sudah punya akun? ' : 'Belum punya akun? '}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? 'Masuk' : 'Buat baru'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
