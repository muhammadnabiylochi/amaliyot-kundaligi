import { useState } from 'react';
import {
  TrendingUp,
  Download,
  Printer,
} from 'lucide-react';
import {
  MOCK_WEEKLY_STATS,
} from '@/data/mock';
import { Card, Button } from '@/components/ui';

export default function ReportsPage() {
  const [period, setPeriod] = useState('2026-kuz');

  // Find max submissions to scale chart bars
  const maxWeekly = Math.max(...MOCK_WEEKLY_STATS.map((w) => w.submitted));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Hisobot va tahliliy statistika
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Universitet bo'yicha talabalar amaliyotining umumiy tahlili va ko'rsatkichlari
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="2026-kuz">2026-yil Kuzgi semestr</option>
            <option value="2026-bahor">2026-yil Bahorgi semestr</option>
            <option value="2025-yil">2025-yil butun davr</option>
          </select>

          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Excel (XLSX)
          </Button>

          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" />
            Chop etish
          </Button>
        </div>
      </div>

      {/* Summary KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-slate-200/80">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Jami amaliyotchi talabalar
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-2 block">128 nafar</span>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> +14% o'tgan yilga nisbatan
          </span>
        </Card>

        <Card className="p-5 border-slate-200/80">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Hamkor korxonalar soni
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-2 block">34 ta</span>
          <span className="text-[11px] text-slate-500 mt-1 block">IT, Moliya, Ishlab chiqarish</span>
        </Card>

        <Card className="p-5 border-slate-200/80">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Tasdiqlash ko'rsatkichi
          </span>
          <span className="text-2xl font-bold text-emerald-600 mt-2 block">89.4%</span>
          <span className="text-[11px] text-slate-500 mt-1 block">O'rtacha sifat darajasi</span>
        </Card>

        <Card className="p-5 border-slate-200/80">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Amaliyot soatlari jami
          </span>
          <span className="text-2xl font-bold text-indigo-600 mt-2 block">1,840 soat</span>
          <span className="text-[11px] text-slate-500 mt-1 block">Tizimda qayd qilingan</span>
        </Card>
      </div>

      {/* Weekly Activity Chart (Clean SVG representation) */}
      <Card className="p-6 border-slate-200/80 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Haftalar kesimida kundalik topshirish dinamikasi
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Yuborilgan va tasdiqlangan kunlik hisobotlar nisbati
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-indigo-600" />
              <span className="text-slate-600">Yuborilgan</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
              <span className="text-slate-600">Tasdiqlangan</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="pt-4">
          <div className="grid grid-cols-8 gap-3 sm:gap-6 items-end h-56 border-b border-slate-200 pb-2">
            {MOCK_WEEKLY_STATS.map((item, idx) => {
              const submittedHeight = Math.round((item.submitted / maxWeekly) * 100);
              const approvedHeight = Math.round((item.approved / maxWeekly) * 100);

              return (
                <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="flex items-end gap-1 w-full justify-center h-full">
                    {/* Submitted Bar */}
                    <div
                      className="w-3 sm:w-4 bg-indigo-600 rounded-t transition-all group-hover:bg-indigo-700"
                      style={{ height: `${submittedHeight}%` }}
                      title={`Yuborilgan: ${item.submitted}`}
                    />
                    {/* Approved Bar */}
                    <div
                      className="w-3 sm:w-4 bg-emerald-500 rounded-t transition-all group-hover:bg-emerald-600"
                      style={{ height: `${approvedHeight}%` }}
                      title={`Tasdiqlangan: ${item.approved}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium text-center truncate w-full">
                    {item.week.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Organization breakdown table */}
      <Card className="p-0 overflow-hidden border-slate-200/80">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Tashkilotlar kesimidagi statistika
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Amaliyot o'tash joylari bo'yicha talabalar taqsimoti
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-4">Tashkilot nomi</th>
                <th className="py-3 px-4">Talabalar</th>
                <th className="py-3 px-4">O'rtacha davomat</th>
                <th className="py-3 px-4">Tasdiqlangan yozuvlar</th>
                <th className="py-3 px-4 text-right">Muvaffaqiyat ko'rsatkichi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {[
                { name: 'Uzcard MChJ', students: 8, avgDays: '35 kun', approved: 240, rate: '92%' },
                { name: 'EPAM Systems', students: 6, avgDays: '28 kun', approved: 168, rate: '88%' },
                { name: 'Beeline Uzbekistan', students: 5, avgDays: '38 kun', approved: 190, rate: '95%' },
                { name: 'Click MChJ', students: 4, avgDays: '22 kun', approved: 88, rate: '82%' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-semibold text-slate-900">{row.name}</td>
                  <td className="py-3 px-4 text-slate-600">{row.students} nafar</td>
                  <td className="py-3 px-4 text-slate-600">{row.avgDays}</td>
                  <td className="py-3 px-4 text-slate-600">{row.approved} ta</td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-600">{row.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
