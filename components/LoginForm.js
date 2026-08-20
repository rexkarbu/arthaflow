'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, register } from '@/app/actions';
import ArthaFlowLogo from './ArthaFlowLogo';
import { toast } from 'sonner';

export default function LoginForm() {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const fd = new FormData(e.currentTarget);

    if (isRegister) {
      const res = await register(fd);
      if (res?.error) {
        setErrorMessage(res.error);
        toast.error(res.error);
      } else {
        toast.success(res?.message || 'Akun berhasil dibuat. Silakan login.');
        setIsRegister(false);
        setErrorMessage('');
        e.currentTarget.reset();
      }
      setLoading(false);
    } else {
      const res = await login(fd);
      if (res?.error) {
        setErrorMessage(res.error);
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
    <div className="auth-page">
      <div className="auth-shell">
        {/* Top Wordmark & Structural Rule */}
        <div className="auth-header">
          <div className="auth-brand">
            <ArthaFlowLogo variant="full" size={22} />
          </div>
        </div>
        <div className="auth-divider" />

        {/* Asymmetric Content Layout */}
        <div className="auth-content">
          {/* Left Context Column (Desktop) */}
          <div className="auth-intro">
            <h1 className="auth-headline">
              Keuangan pribadi,<br />lebih jelas.
            </h1>
            <div className="auth-signature-line" />
            <div className="auth-copy">
              <p>Catat apa yang masuk.</p>
              <p>Pahami ke mana uang pergi.</p>
              <p>Jaga rencana tetap berjalan.</p>
            </div>
          </div>

          {/* Right Form Column */}
          <div className="auth-form-zone">
            <div className="auth-form-wrap">
              <div className="auth-form-header">
                <h2 className="auth-form-title">
                  {isRegister ? 'Buat akun' : 'Masuk'}
                </h2>
                <p className="auth-form-desc">
                  {isRegister ? 'Mulai gunakan ArthaFlow.' : 'Gunakan akun ArthaFlow Anda.'}
                </p>
              </div>

              {errorMessage && (
                <div className="auth-error" role="alert">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-field">
                  <label htmlFor="auth-username" className="auth-label">Username</label>
                  <input
                    id="auth-username"
                    type="text"
                    name="username"
                    className="input auth-input"
                    placeholder="Username"
                    required
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="auth-password" className="auth-label">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    name="password"
                    className="input auth-input"
                    placeholder="Password"
                    required
                  />
                </div>

                <button type="submit" className="btn-submit auth-submit" disabled={loading}>
                  {loading ? 'Memproses...' : (isRegister ? 'Buat akun' : 'Masuk')}
                </button>
              </form>

              <div className="auth-switch">
                <span className="auth-switch-text">
                  {isRegister ? 'Sudah punya akun? ' : 'Belum punya akun? '}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setErrorMessage('');
                  }}
                  className="auth-switch-btn"
                >
                  {isRegister ? 'Masuk' : 'Buat akun'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
