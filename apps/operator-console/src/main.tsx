import { CssBaseline, createTheme, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#73e0c4' },
    background: { default: '#0b1220', paper: '#121c2e' },
    warning: { main: '#ffb547' },
    error: { main: '#ff6b7a' },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', h4: { fontWeight: 750 } },
  components: { MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 700 } } } },
});
const client = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root application mount point.');
createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
