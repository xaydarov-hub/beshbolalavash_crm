import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import App from './App.jsx';

vi.mock('./lib/telegram.js', () => ({ sendTelegramMessage: vi.fn() }));

const employee = { id: 'waiter', name: 'Test Ofitsiant', phone: 'waiter.login', role: 'employee', jobRole: 'waiter', position: 'Ofitsiant', branchId: 'branch', active: true, salaryType: 'foiz', rate: 7, hireDate: '2026-01-01', workStart: '08:00', workEnd: '17:00' };
const snapshot = user => ({ databaseId: 'test-db', revision: 1, users: [user], branches: [{ id: 'branch', name: 'Test filial' }], attendance: [], dailySales: [], sales: {}, adjustments: [], evaluations: [], transfers: [], notifications: [], leaveRequests: [], auditLog: [], payrollHistory: [] });
const response = (user, state = snapshot(user), token = 'current-token') => new Response(JSON.stringify({ token, user, state }), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => { localStorage.clear(); window.history.replaceState(null, '', '/admin'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(['waiter', 'cashier', 'cook', 'baker', 'delivery', 'cleaner', 'security', 'other'])('opens the %s employee page from the server account even when the URL says admin', async jobRole => {
  const user = { ...employee, jobRole };
  localStorage.setItem('bbl-crm-token', 'current-token');
  global.fetch = vi.fn().mockImplementation(() => Promise.resolve(response(user)));
  render(<App />);
  await waitFor(() => expect(window.location.pathname).toBe(`/employee/${jobRole}`));
  expect(screen.queryByRole('button', { name: /^👥?\s*Xodimlar$/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /jarima \/ bonus/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /filiallar/i })).not.toBeInTheDocument();
  window.history.pushState(null, '', '/boss');
  fireEvent.popState(window);
  expect(window.location.pathname).toBe(`/employee/${jobRole}`);
});

it('replaces an admin page with the live employee account after a state refresh', async () => {
  let user = { ...employee, role: 'admin', jobRole: 'admin', position: 'Filial admini' };
  localStorage.setItem('bbl-crm-token', 'current-token');
  global.fetch = vi.fn().mockImplementation(() => Promise.resolve(response(user, { ...snapshot(user), revision: user.role === 'admin' ? 1 : 2 })));
  render(<App />);
  await screen.findByRole('button', { name: /jarima \/ bonus/i });
  user = employee;
  fireEvent.focus(window);
  await waitFor(() => expect(window.location.pathname).toBe('/employee/waiter'));
  expect(screen.queryByRole('button', { name: /jarima \/ bonus/i })).not.toBeInTheDocument();
});

it('does not display stale admin rights when the account is missing from server state', async () => {
  localStorage.setItem('bbl-crm-token', 'current-token');
  global.fetch = vi.fn().mockResolvedValue(response({ ...employee, role: 'admin' }, { ...snapshot(employee), users: [] }));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Hisob topilmadi');
  expect(screen.queryByRole('button', { name: /jarima \/ bonus/i })).not.toBeInTheDocument();
});

it('changes the password, replaces the session token and keeps the employee page', async () => {
  localStorage.setItem('bbl-crm-token', 'current-token');
  global.fetch = vi.fn().mockImplementation(url => Promise.resolve(response(employee, snapshot(employee), url.endsWith('/api/password') ? 'new-token' : 'current-token')));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Parolni almashtirish' }));
  fireEvent.change(screen.getByLabelText('Joriy parol'), { target: { value: 'old-password' } });
  fireEvent.change(screen.getByLabelText('Yangi parol', { exact: true }), { target: { value: 'new-password' } });
  fireEvent.change(screen.getByLabelText('Yangi parolni takrorlang'), { target: { value: 'new-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Parolni yangilash' }));
  expect(await screen.findByText(/Parol yangilandi\./)).toBeInTheDocument();
  expect(localStorage.getItem('bbl-crm-token')).toBe('new-token');
  expect(window.location.pathname).toBe('/employee/waiter');
  const write = fetch.mock.calls.find(([url]) => url.endsWith('/api/password'));
  expect(JSON.parse(write[1].body)).toEqual({ currentPassword: 'old-password', newPassword: 'new-password' });
});
