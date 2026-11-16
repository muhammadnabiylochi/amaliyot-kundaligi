import { useState, useEffect } from 'react';
import {
  UserPlus,
  Search,
} from 'lucide-react';
import {
  MockUser,
  UserRole,
} from '@/data/mock';
import { fetchUsers, toggleUserStatus as apiToggleStatus } from '@/lib/dataService';
import { Card, Button, Input } from '@/components/ui';
import { RoleBadge, UserStatusBadge } from '@/components/ui/Badge';

export default function UserManagementPage() {
  const [users, setUsers] = useState<MockUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchUsers().then((data) => {
      if (mounted) setUsers(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // New User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('student');
  const [newUserDept, setNewUserDept] = useState('');
  const [newUserGroup, setNewUserGroup] = useState('');

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;

    const created: MockUser = {
      id: `u${users.length + 1}`,
      name: newUserName,
      email: newUserEmail,
      role: newUserRole,
      department: newUserDept || 'Axborot texnologiyalari',
      group: newUserGroup || undefined,
      phone: '+998 90 000-00-00',
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setUsers([created, ...users]);
    setShowAddModal(false);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserDept('');
    setNewUserGroup('');
  };

  const toggleUserStatus = async (userId: string) => {
    setUsers(
      users.map((u) =>
        u.id === userId
          ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' }
          : u
      )
    );
    await apiToggleStatus(userId);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Foydalanuvchilarni boshqarish
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tizimdagi barcha talabalar, rahbarlar va administratorlar ro'yxati
          </p>
        </div>

        <Button size="sm" onClick={() => setShowAddModal(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Yangi foydalanuvchi qo'shish
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 border-slate-200/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Input
              type="text"
              placeholder="Qidiruv: ism, familiya, email yoki bo'lim..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Barcha rollar</option>
              <option value="student">Talaba</option>
              <option value="supervisor">Rahbar (Mentor)</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Barcha holatlar</option>
              <option value="active">Faol</option>
              <option value="inactive">Nofaol</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users Data Table */}
      <Card className="p-0 overflow-hidden border-slate-200/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-4">Foydalanuvchi</th>
                <th className="py-3 px-4">Roli</th>
                <th className="py-3 px-4">Fakultet / Tashkilot</th>
                <th className="py-3 px-4">Aloqa</th>
                <th className="py-3 px-4">Holati</th>
                <th className="py-3 px-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-semibold text-slate-700 shrink-0">
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{user.name}</div>
                        <div className="text-[11px] text-slate-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-800">{user.department}</span>
                    {user.group && (
                      <span className="block text-[11px] text-slate-400">Guruh: {user.group}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                    <div>{user.phone || '—'}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <UserStatusBadge status={user.status} />
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleUserStatus(user.id)}
                      className={`h-7 px-2 text-xs ${
                        user.status === 'active'
                          ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                          : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {user.status === 'active' ? "To'xtatish" : "Faollashtirish"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-500 px-4">
          Jami foydalanuvchilar: {filteredUsers.length} nafar
        </div>
      </Card>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                Yangi foydalanuvchi qo'shish
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  F.I.SH <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Familiya Ism Sharif"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Elektron pochta <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="nomi@edu.uz"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Tizimdagi roli
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="student">Talaba</option>
                    <option value="supervisor">Rahbar (Mentor)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Guruh (talaba bo'lsa)
                  </label>
                  <Input
                    type="text"
                    placeholder="IT-201"
                    value={newUserGroup}
                    onChange={(e) => setNewUserGroup(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Fakultet / Tashkilot bo'limi
                </label>
                <Input
                  type="text"
                  placeholder="Masalan: TATU yoki Uzcard MChJ"
                  value={newUserDept}
                  onChange={(e) => setNewUserDept(e.target.value)}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  Bekor qilish
                </Button>
                <Button type="submit" size="sm">
                  Saqlash
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
