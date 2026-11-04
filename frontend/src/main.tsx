import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import '@/styles/variables.css';
import '@/styles/globals.css';
import '@/styles/experience.css';
import '@/styles/selects.css';
import '@/styles/system-theme.css';
import '@/styles/site-polish.css';
import '@/styles/dark-public.css';

const root = document.getElementById('root');
if (!root) throw new Error('The application root is missing.');

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
