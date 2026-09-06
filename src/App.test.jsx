import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App.jsx';

const state = {
  branches: [], users: [{ id: 'boss-1', role: 'boss', name: 'Besh Bola Lavash', phone: 'beshbola.hr' }],
  attendance: [], adjustments: [], sales: {}, leaveRequests: [], auditLog: [], notifications: [], evaluations: [], transfers: [],
};

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn((url, options = {}) => {
      if (url.endsWith('/api/login')) {
        return Promise.resolve({ ok: true, json: async () => ({ token: 'test-token', user: state.users[0], state }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ user: state.users[0], state }) });
    });
  });

  it('renders the login screen and accepts the boss credential', async () => {
    render(<App />);

    expect(screen.getByText('Tizimga kirish')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Telefon yoki login'), {
      target: { value: 'beshbola.hr' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••'), {
      target: { value: '1122334411' },
    });
    fireEvent.click(screen.getByRole('button', { name: /kirish/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /bosh sahifa/i })).toBeInTheDocument());
  });
});
