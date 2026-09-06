import { render, screen, fireEvent } from '@testing-library/react';
import App from './App.jsx';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the login screen and accepts a demo credential', () => {
    render(<App />);

    expect(screen.getByText('Tizimga kirish')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('901234567'), {
      target: { value: '901234567' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••'), {
      target: { value: '2018' },
    });
    fireEvent.click(screen.getByRole('button', { name: /kirish/i }));

    expect(screen.getByText('Bosh sahifa')).toBeInTheDocument();
  });
});
