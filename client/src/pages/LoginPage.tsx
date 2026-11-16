import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n';

// Quick demo profiles are shown only in development or when VITE_DEMO_MODE=true
const DEMO = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();

  const [email, setEmail] = useState(DEMO ? 'admin@edu.uz' : '');
  const [password, setPassword] = useState(DEMO ? 'DevPassword123!' : '');
  const [role, setRole] = useState<string>('admin');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const result = await login(email, password);
    setIsLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setErrorMessage(result.error || "Elektron pochta yoki parol noto'g'ri.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-indigo-600 items-center justify-center text-white shadow-lg shadow-indigo-200 mb-4">
          <GraduationCap className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('Elektron Amaliyot Kundaligi')}
        </h2>
        <button type="button" onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">
          {lang === 'uz' ? 'Русский язык' : "O'zbek tili"}
        </button>
        <p className="mt-2 text-sm text-slate-600">
          {t("Professional ta'lim muassasalari talabalari amaliyotini boshqarish va monitoring qilish tizimi")}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="px-6 py-8 sm:p-8 shadow-sm border-slate-200">
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {DEMO && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                {t('Demo profillar (tezkor tanlash)')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'admin', label: t('Admin'), email: 'admin@edu.uz' },
                  { id: 'supervisor', label: t('Korxona'), email: 'sherzod.nazarov@uzcard.uz' },
                  { id: 'institution', label: t('Muassasa'), email: 'dilshod.toshmatov@edu.uz' },
                  { id: 'student', label: t('Talaba'), email: 'jasur.aliev@student.edu.uz' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setRole(item.id as any);
                      setEmail(item.email);
                      setPassword('DevPassword123!');
                    }}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all ${
                      role === item.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                {t('Elektron pochta')}
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nomi@edu.uz"
                icon={<Mail className="h-4 w-4" />}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  {t('Parol')}
                </label>
                <button type="button" onClick={() => setShowForgot((v) => !v)} className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">
                  {t('Parolni unutdingizmi?')}
                </button>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="h-4 w-4" />}
                required
              />
            </div>

            {showForgot && (
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-900">
                {t("Parolni tiklash uchun amaliyot bo'limi administratoriga murojaat qiling: u sizga vaqtinchalik parol beradi, birinchi kirishda uni o'zingiz almashtirasiz.")}
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              <span>{t('Tizimga kirish')}</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>{t("Parollar shifrlangan holda saqlanadi, kirish urinishlari cheklangan")}</span>
            </div>
          </div>
        </Card>

        {/* Development testing hint (demo mode only) */}
        {DEMO && (
          <div className="mt-4 p-3 rounded-lg bg-slate-100/80 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-700">💡 {t('Demo paroli')}:</div>
            <div>
              {t('Barcha demo profillar uchun parol')}: <code className="bg-white px-1.5 py-0.5 rounded border text-indigo-600 font-mono">DevPassword123!</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
