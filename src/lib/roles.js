// Access rights and a person's job are separate, explicit fields.
export const JOB_ROLES = [
  { id: 'waiter', label: 'Ofitsiant' },
  { id: 'cashier', label: 'Kassir' },
  { id: 'cook', label: 'Oshpaz' },
  { id: 'baker', label: 'Nonvoy' },
  { id: 'delivery', label: 'Yetkazib beruvchi' },
  { id: 'cleaner', label: 'Tozalovchi' },
  { id: 'security', label: 'Qorovul' },
  { id: 'other', label: 'Boshqa xodim' },
];

export function getJobRole(user) {
  if (user?.role === 'boss' || user?.role === 'admin') return user.role;
  if (JOB_ROLES.some(job => job.id === user?.jobRole)) return user.jobRole;
  const position = String(user?.position || '').trim().toLowerCase();
  if (/ofits|afits|waiter|офици/.test(position)) return 'waiter';
  if (/kass|cash|касси/.test(position)) return 'cashier';
  if (/oshpaz|cook|povar|повар/.test(position)) return 'cook';
  if (/nonvoy|novvoy|baker|пекар/.test(position)) return 'baker';
  if (/yetkaz|kuryer|delivery|курьер/.test(position)) return 'delivery';
  if (/tozal|farrosh|clean|убор/.test(position)) return 'cleaner';
  if (/qorovul|security|охра/.test(position)) return 'security';
  return 'other';
}

export function jobLabel(user) {
  const job = getJobRole(user);
  if (job === 'boss') return 'Boshliq';
  if (job === 'admin') return 'Filial admini';
  return JOB_ROLES.find(item => item.id === job)?.label || 'Xodim';
}

export const getRoleLabel = jobLabel;
export function dashboardPath(user) {
  if (user?.role === 'boss') return '/boss';
  if (user?.role === 'admin') return '/admin';
  if (user?.role === 'employee') return `/employee/${getJobRole(user)}`;
  return '/login';
}

export function normalizeUserRole(user) {
  return { ...user, jobRole: getJobRole(user) };
}
