import { Link } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

export default function NotFoundPage(): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
      <h1 className="text-4xl font-bold text-gray-800 mb-2">404</h1>
      <p className="text-gray-600 mb-6">Sahifa topilmadi — Page not found.</p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Home className="h-4 w-4" />
        Bosh sahifaga qaytish
      </Link>
    </div>
  );
}
