import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import AdminDashboard from './admin/AdminDashboard.jsx';
import SalesPanel from './SalesPanel.jsx';
import EvaluationPanel from './EvaluationPanel.jsx';
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
