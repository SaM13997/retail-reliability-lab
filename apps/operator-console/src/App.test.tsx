import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe('Operator Console', () => {
  it('shows the independent generated-data disclaimer and fleet health', async () => {
    renderApp();
    expect(screen.getByText(/independent portfolio demo/i)).toBeTruthy();
    expect(await screen.findByRole('heading', { name: /fleet health/i })).toBeTruthy();
  });

  it('pauses and resumes the transaction feed', async () => {
    const user = userEvent.setup();
    renderApp();
    const toggle = await screen.findByRole('button', { name: /pause live feed/i });
    await user.click(toggle);
    expect(screen.getByRole('button', { name: /resume live feed/i })).toBeTruthy();
  });

  it('optimistically assigns an incident and reports deterministic rollback', async () => {
    const user = userEvent.setup();
    renderApp();
    const assign = await screen.findByRole('button', { name: /assign payment terminal degraded/i });
    await user.click(assign);
    expect(await screen.findByText(/assignment could not be saved/i)).toBeTruthy();
  });
});
