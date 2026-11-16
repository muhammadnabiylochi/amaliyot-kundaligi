import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n';
import { Field, useConfirm, useToast } from '@/components/ui/extra';
import { ROLE_LABELS } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import {
  fetchTelegramStatus,
  generateTelegramLinkCode,
  unlinkTelegram,
  TelegramStatusResponse,
  TelegramLinkCodeResponse,
  changePassword,
  updateOwnProfile,
} from '@/lib/dataService';
import {
  User,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Unlink,
  ExternalLink,
  Clock,
  ShieldCheck,
  BellRing,
  KeyRound,
  Settings,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input } from '@/components/ui';

export default function ProfilePage(): JSX.Element {
  const { user, checkAuth } = useAuth();
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [pw, setPw] = useState({ current: '', next: '', repeat: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [phoneSaving, setPhoneSaving] = useState(false);

  useEffect(() => {
    setPhone(user?.phone ?? '');
  }, [user?.phone]);

  useEffect(() => {
    if (window.location.hash === '#password') {
      setTimeout(() => document.getElementById('password')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.repeat) return;
    setPwSaving(true);
    const r = await changePassword(pw.current, pw.next);
    setPwSaving(false);
    if (r.ok) {
      toast(t("Parol muvaffaqiyatli o'zgartirildi"));
      setPw({ current: '', next: '', repeat: '' });
      await checkAuth();
    } else {
      toast(r.error || t('Xatolik'), 'error');
    }
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneSaving(true);
    const r = await updateOwnProfile({ phone: phone.trim() || null });
    setPhoneSaving(false);
    if (r.ok) {
      toast(t('Profil yangilandi'));
      await checkAuth();
    } else toast(r.error || t('Xatolik'), 'error');
  };
  const [tgStatus, setTgStatus] = useState<TelegramStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [linkData, setLinkData] = useState<TelegramLinkCodeResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTelegramStatus();
      setTgStatus(data);
      if (data.isLinked) {
        setLinkData(null);
      }
    } catch (err: any) {
      setError(err.message || "Telegram holatini yuklashda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Countdown timer for 10-minute code expiry
  useEffect(() => {
    if (!linkData?.expiresAt) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const remainingMs = new Date(linkData.expiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(Math.floor(remainingMs / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [linkData]);

  const handleGenerateCode = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccessMsg(null);
      const res = await generateTelegramLinkCode();
      setLinkData(res);
      setCopied(false);
    } catch (err: any) {
      setError(err.message || 'Bog‘lash kodini yaratishda xatolik');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopy = () => {
    if (!linkData?.code) return;
    navigator.clipboard.writeText(linkData.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleUnlink = async () => {
    const ok = await confirm({
      title: t('Telegramni uzish'),
      message: t('Rostdan ham Telegram akkauntingizni ushbu hisobdan uzmoqchimisiz?'),
      confirmLabel: t('Uzish'),
      destructive: true,
    });
    if (!ok) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await unlinkTelegram();
      setSuccessMsg(res.message);
      await loadStatus();
    } catch (err: any) {
      setError(err.message || "Akkauntni uzishda xatolik yuz berdi");
    } finally {
      setActionLoading(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const botName = tgStatus?.botUsername ?? 'amaliyot_kundalik_uz_bot';
  const roleNames: Record<string, string> = Object.fromEntries(Object.entries(ROLE_LABELS).map(([k, v]) => [k, t(v)]));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('Foydalanuvchi profili va sozlamalar')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("Shaxsiy ma'lumotlar, xavfsizlik va Telegram bildirishnomalari")}</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-3 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* User Information Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
              <User className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Shaxsiy ma'lumotlar</CardTitle>
              <CardDescription>Tizimdagi qayd yozuvingiz tafsilotlari</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">To'liq ism-sharif</span>
              <span className="text-sm font-semibold text-slate-900">{user?.fullName}</span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">Elektron pochta</span>
              <span className="text-sm font-semibold text-slate-900">{user?.email}</span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">Foydalanuvchi roli</span>
              <span className="text-sm font-semibold text-indigo-700">
                {user ? roleNames[user.role] || user.role : '—'}
              </span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">{t('Xavfsizlik holati')}</span>
              {user?.mustChangePassword ? (
                <span className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4" /> {t('Vaqtinchalik parol — almashtiring')}
                </span>
              ) : (
                <span className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> {t('Faol va himoyalangan')}
                </span>
              )}
            </div>
            {user?.group && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 block mb-1">{t('Guruh va mutaxassislik')}</span>
                <span className="text-sm font-semibold text-slate-900">
                  {user.group}
                  {user.studyProgram ? ` — ${user.studyProgram}` : ''}
                </span>
              </div>
            )}
            {user?.studentNumber && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 block mb-1">{t('Talaba ID')}</span>
                <span className="text-sm font-semibold text-slate-900">{user.studentNumber}</span>
              </div>
            )}
            {user?.position && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 block mb-1">{t('Lavozim')}</span>
                <span className="text-sm font-semibold text-slate-900">{user.position}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>


      {/* Account settings: password, phone, language */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card id="password" className={user?.mustChangePassword ? 'border-amber-300 ring-2 ring-amber-100' : ''}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{t("Parolni o'zgartirish")}</CardTitle>
                <CardDescription>
                  {user?.mustChangePassword ? t('Siz vaqtinchalik parol bilan kirgansiz — yangisini o‘rnating') : t('Kamida 8 belgi, harf va raqam')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <Field label={t('Joriy parol')} required>
                <Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              </Field>
              <Field label={t('Yangi parol')} required>
                <Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </Field>
              <Field label={t('Yangi parolni takrorlang')} required error={pw.repeat && pw.repeat !== pw.next ? t('Parollar mos emas') : undefined}>
                <Input type="password" autoComplete="new-password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} />
              </Field>
              <Button type="submit" size="sm" isLoading={pwSaving} disabled={!pw.current || pw.next.length < 8 || pw.next !== pw.repeat}>
                {t('Parolni saqlash')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{t('Sozlamalar')}</CardTitle>
                <CardDescription>{t('Aloqa telefoni va interfeys tili')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleSavePhone} className="flex items-end gap-2">
              <Field label={t('Telefon raqami')} className="flex-1">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 000-00-00" />
              </Field>
              <Button type="submit" size="sm" variant="outline" isLoading={phoneSaving}>
                {t('Saqlash')}
              </Button>
            </form>
            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">{t('Interfeys tili')}</span>
              <div className="inline-flex p-1 rounded-lg bg-slate-100 gap-1">
                {(['uz', 'ru'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold ${lang === l ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600'}`}
                  >
                    {l === 'uz' ? "O'zbekcha" : 'Русский'}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Telegram Bot Integration Card */}
      <Card className="border-indigo-100 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-[#229ED9]/10 border border-[#229ED9]/20 flex items-center justify-center text-[#229ED9] shadow-xs">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-slate-900">Telegram Bot Bildirishnomalari</CardTitle>
                  {tgStatus?.isLinked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" /> Bog'langan
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      Bog'lanmagan
                    </span>
                  )}
                </div>
                <CardDescription className="text-slate-500 mt-0.5">
                  Rasmiy bot: <a href={tgStatus?.botUrl ?? `https://t.me/${botName}`} target="_blank" rel="noreferrer" className="text-[#229ED9] font-medium hover:underline">@{botName}</a>
                </CardDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadStatus}
              disabled={loading || actionLoading}
              className="self-start sm:self-auto gap-1.5 text-xs text-slate-600"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Yangilash
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Linked State */}
          {tgStatus?.isLinked ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Telegram hisobingiz tizimga muvaffaqiyatli ulangan
                  </h4>
                  <p className="text-xs text-slate-600">
                    Siz yangi kundalik topshirilishi, tasdiqlanishi, qaytarilishi, davomat va yakuniy baholar haqidagi barcha xabarlarni Telegram orqali qabul qilasiz.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                    {tgStatus.username && (
                      <span>Telegram: <strong className="text-slate-800">@{tgStatus.username}</strong></span>
                    )}
                    {tgStatus.telegramUserId && (
                      <span>Telegram ID: <strong className="text-slate-800">{tgStatus.telegramUserId}</strong></span>
                    )}
                    {tgStatus.linkedAt && (
                      <span>Bog'langan: <strong className="text-slate-800">{new Date(tgStatus.linkedAt).toLocaleDateString('uz-UZ')}</strong></span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={tgStatus?.botUrl ?? `https://t.me/${botName}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#229ED9] hover:bg-[#1e8bc0] transition-colors shadow-xs"
                  >
                    <Send className="h-3.5 w-3.5" /> Botni ochish
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnlink}
                    disabled={actionLoading}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 text-xs gap-1.5"
                  >
                    <Unlink className="h-3.5 w-3.5" /> Uzish
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Unlinked State */
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-indigo-600" />
                    Kundalik, davomat va baholash bildirishnomalarini Telegram'da oling
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xl">
                    Akkauntingizni <strong className="text-slate-700">@{botName}</strong> botiga bog'lang va kundalik holati, davomat va yakuniy ballar bo'yicha tezkor xabarlarni kuzatib boring.
                  </p>
                </div>

                {!linkData && (
                  <Button
                    onClick={handleGenerateCode}
                    disabled={actionLoading}
                    className="bg-[#229ED9] hover:bg-[#1e8bc0] text-white gap-2 text-xs font-semibold shrink-0 shadow-sm"
                  >
                    <Send className="h-4 w-4" /> Telegram’ni bog‘lash
                  </Button>
                )}
              </div>

              {/* Code Generation Section */}
              {linkData && (
                <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-4 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
                    <div>
                      <h5 className="text-sm font-bold text-indigo-950">Bir martalik bog'lash kodi</h5>
                      <p className="text-xs text-indigo-700 mt-0.5">Ushbu kodni botga yuborish orqali hisobingizni tasdiqlang</p>
                    </div>

                    {timeLeft !== null && (
                      <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${timeLeft > 60 ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800'}`}>
                        <Clock className="h-3.5 w-3.5" />
                        <span>Qolgan vaqt: {formatSeconds(timeLeft)}</span>
                      </div>
                    )}
                  </div>

                  {timeLeft !== null && timeLeft <= 0 ? (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                      <span>Kodning amal qilish muddati tugadi. Yangi kod yarating.</span>
                      <Button size="sm" variant="outline" onClick={handleGenerateCode} className="text-xs">
                        Qayta yaratish
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Code display box */}
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="w-full sm:w-auto flex-1 flex items-center justify-between sm:justify-start gap-4 px-6 py-3.5 bg-white rounded-xl border border-indigo-300 shadow-sm">
                          <span className="font-mono text-2xl sm:text-3xl font-black text-indigo-900 tracking-widest">
                            {linkData.code}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopy}
                            className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Kodni nusxalash"
                          >
                            {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
                          </button>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <a
                            href={linkData.deepLinkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-white bg-[#229ED9] hover:bg-[#1e8bc0] transition-colors shadow-sm"
                          >
                            <Send className="h-4 w-4" /> Bot orqali bog'lash <ExternalLink className="h-3 w-3" />
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={loadStatus}
                            className="py-3 px-3 text-xs"
                            title="Bog'lanishni tekshirish"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Instructions */}
                      <div className="p-3.5 rounded-xl bg-white/80 border border-indigo-100 text-xs text-slate-600 space-y-1.5">
                        <p className="font-semibold text-slate-800">Qadamlar:</p>
                        <ol className="list-decimal list-inside space-y-1 pl-1">
                          <li>Telegram'da <a href={tgStatus?.botUrl ?? `https://t.me/${botName}`} target="_blank" rel="noreferrer" className="text-[#229ED9] font-medium hover:underline">@{botName}</a> botini oching.</li>
                          <li>Botga <code className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold font-mono">/start</code> buyrug'ini yuboring.</li>
                          <li>Yuqoridagi 6 xonali kodni (<span className="font-mono font-bold text-indigo-900">{linkData.code}</span>) botga xabar sifatida yuboring.</li>
                          <li>Muvaffaqiyatli javob olgach, bu yerdagi "Yangilash" tugmasini bosing!</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
