import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import AdminDashboard from './admin/AdminDashboard.jsx';
import SalesPanel from './SalesPanel.jsx';
import EvaluationPanel from './EvaluationPanel.jsx';
import Employees from './boss/Employees.jsx';
import Branches from './boss/Branches.jsx';
import BossDashboard from './boss/BossDashboard.jsx';
import EmployeeDashboard from './employee/EmployeeDashboard.jsx';
import { todayISO } from '../lib/utils.js';
const employee = { id: 'e', role: 'employee', name: 'Abdulloh', branchId: 'b', position: 'Ofitsiant', salaryType: 'foiz', rate: 7 };
const admin = { id: 'a', role: 'admin', name: 'Admin', branchId: 'b' };
const state = { users: [employee], branches: [{ id: 'b', name: 'Filial' }], attendance: [], adjustments: [], evaluations: [], dailySales: [], sales: {}, transfers: [], leaveRequests: [] };
afterEach(cleanup);
it('admin can open employee history and see a selected employee', () => {
  render(<AdminDashboard state={state} session={admin} persist={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Xodim tarixi/ }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'e' } });
  expect(screen.getByRole('button', { name: /Barcha tarix/ })).toBeInTheDocument();
});
it('shows commission preview and confirms only after server save', async () => {
  const saveSale = vi.fn().mockResolvedValue({ dailySales: [{ employeeId: 'e', date: todayISO(), updatedAt: 'v1' }] });
  render(<SalesPanel state={state} session={admin} saveSale={saveSale} />);
  fireEvent.change(screen.getByPlaceholderText('10 000 000'), { target: { value: '10 000 000' } });
  expect(screen.getByText(/700.*000/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Savdoni saqlash' }));
  await waitFor(() => expect(screen.getByText('Serverga saqlandi.')).toBeInTheDocument());
  expect(saveSale).toHaveBeenCalledWith(expect.objectContaining({ amount: 10000000, employeeId: 'e', expectedUpdatedAt: null }));
});
it('displays save rejection without falsely confirming success', async () => {
  render(<SalesPanel state={state} session={admin} saveSale={vi.fn().mockRejectedValue(new Error('Server unavailable'))} />);
  fireEvent.change(screen.getByPlaceholderText('10 000 000'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Savdoni saqlash' }));
  await waitFor(() => expect(screen.getByText('Server unavailable')).toBeInTheDocument());
  expect(screen.queryByText('Serverga saqlandi.')).not.toBeInTheDocument();
});
it('employee can read sales but cannot enter or save them', () => {
  render(<SalesPanel state={state} session={employee} />);
  expect(screen.queryByPlaceholderText('10 000 000')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /saqlash/ })).not.toBeInTheDocument();
});
it('renders six accessible score choices for each of twelve criteria', () => {
  render(<EvaluationPanel state={state} session={admin} persist={vi.fn()} />);
  expect(screen.getAllByRole('button', { name: '5', exact: true })).toHaveLength(12);
  expect(screen.queryByRole('button', { name: '15', exact: true })).not.toBeInTheDocument();
});

it('requires an explicit branch, identifies its admin, and keeps a failed new-employee form', async () => {
  const persist = vi.fn().mockResolvedValue(false);
  render(<Employees state={{ ...state, users: [admin] }} session={{ role: 'boss', name: 'Boss' }} persist={persist} />);
  fireEvent.change(screen.getByLabelText('Ism-familiya'), { target: { value: 'New employee' } });
  fireEvent.change(screen.getByLabelText('Telefon yoki login'), { target: { value: '+998956604409' } });
  fireEvent.change(screen.getByLabelText('Boshlang‘ich parol'), { target: { value: 'new-test-password' } });
  fireEvent.change(screen.getByLabelText('Stavka (so‘m)'), { target: { value: '120000' } });
  expect(screen.getByLabelText('Filial')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Filial'), { target: { value: 'b' } });
  expect(screen.getByText(/quyidagi adminlarda ko‘rinadi: Admin/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xodimni qo‘shish' }));
  await waitFor(() => expect(persist).toHaveBeenCalledOnce());
  expect(screen.getByLabelText('Ism-familiya')).toHaveValue('New employee');
  expect(screen.getByText(/Saqlanmadi/)).toBeInTheDocument();
  const changed = persist.mock.calls[0][0]({ ...state, users: [admin], auditLog: [] });
  expect(changed.users[1]).toMatchObject({ phone: '956604409', branchId: 'b', role: 'employee' });
});

it('updates the existing admin page after another session adds an employee', () => {
  const view = render(<AdminDashboard state={{ ...state, users: [] }} session={admin} persist={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xodimlar', exact: true }));
  expect(screen.queryByText('Abdulloh')).not.toBeInTheDocument();
  view.rerender(<AdminDashboard state={state} session={admin} persist={vi.fn()} />);
  expect(screen.getByText('Abdulloh')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Profil va tarix' }));
  expect(screen.getByRole('button', { name: 'Barcha tarix' })).toBeInTheDocument();
});

it('does not mark an employee present until attendance is explicitly saved', () => {
  const persist = vi.fn();
  render(<AdminDashboard state={state} session={admin} persist={persist} />);
  expect(screen.getByRole('combobox')).toHaveValue('');
  expect(persist).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'keldi' } });
  const changed = persist.mock.calls[0][0]({ ...state, auditLog: [] });
  expect(changed.attendance[0]).toMatchObject({ employeeId: 'e', status: 'keldi' });
});

it('preserves a branch name after a rejected save', async () => {
  render(<Branches state={state} session={admin} persist={vi.fn().mockResolvedValue(false)} />);
  fireEvent.change(screen.getByPlaceholderText('Yangi filial nomi'), { target: { value: 'New branch' } });
  fireEvent.click(screen.getAllByRole('button')[0]);
  await waitFor(() => expect(screen.getByText(/Saqlanmadi/)).toBeInTheDocument());
  expect(screen.getByPlaceholderText('Yangi filial nomi')).toHaveValue('New branch');
});

it('opens all dashboard tabs with empty and populated data', () => {
  const complete = { ...state, users: [employee, admin], payrollHistory: [], auditLog: [], notifications: [] };
  for (const data of [complete, { ...complete, users: [] }]) {
    for (const [Dashboard, session] of [[BossDashboard, { role: 'boss', id: 'boss', name: 'Boss' }], [AdminDashboard, admin], [EmployeeDashboard, employee]]) {
      const view = render(<Dashboard state={data} session={session} persist={vi.fn()} saveSale={vi.fn()} />);
      const buttons = [...view.container.querySelectorAll('.tabs button')];
      for (const button of buttons) fireEvent.click(button);
      view.unmount();
    }
  }
});
