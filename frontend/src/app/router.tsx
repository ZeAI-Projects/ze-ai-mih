import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { App } from '@/app/App';
import { HomePage } from '@/features/home/pages/HomePage';
import { NotFoundPage } from '@/components/common/NotFoundPage';
import { ROUTES } from '@/constants/routes';

const AdminRequestAccessPage = lazy(() => import('@/features/admin/AdminRequestAccess').then(m => ({default:m.AdminRequestAccessPage})));
const AdminPortal = lazy(() => import('@/features/admin/AdminPortal').then(m => ({default:m.AdminPortal})));
const ProtectedAdminPage = lazy(() => import('@/features/admin/AdminPortal').then(m => ({default:m.ProtectedAdminPage})));
const DashboardPage = lazy(() => import('@/features/admin/pages/OperationsPages').then(m => ({default:m.DashboardPage})));
const TeamsPage = lazy(() => import('@/features/admin/pages/OperationsPages').then(m => ({default:m.TeamsPage})));
const ParticipantsPage = lazy(() => import('@/features/admin/pages/OperationsPages').then(m => ({default:m.ParticipantsPage})));
const RevenuePage = lazy(() => import('@/features/admin/pages/OperationsPages').then(m => ({default:m.RevenuePage})));
const StatisticsPage = lazy(() => import('@/features/admin/pages/OperationsPages').then(m => ({default:m.StatisticsPage})));
const HistoryPage = lazy(() => import('@/features/admin/pages/OperationsPages').then(m => ({default:m.HistoryPage})));
const ProfilePage = lazy(() => import('@/features/admin/pages/OperationsPages').then(m => ({default:m.ProfilePage})));
const FormEditorPage = lazy(() => import('@/features/admin/pages/ManagementPages').then(m => ({default:m.FormEditorPage})));
const SettingsPage = lazy(() => import('@/features/admin/pages/ManagementPages').then(m => ({default:m.SettingsPage})));
const AdminPermissionsPage = lazy(() => import('@/features/admin/pages/ManagementPages').then(m => ({default:m.AdminPermissionsPage})));
const MediaStudio = lazy(() => import('@/features/admin/MediaStudio').then(m => ({default:m.MediaStudio})));

function LegacySection({ section }: { section: string }) {
  const { search } = useLocation();
  return <Navigate to={`/${search}#${section}`} replace />;
}

export const router = createBrowserRouter([
  {element:<App/>,children:[
    {path:ROUTES.HOME,element:<HomePage/>},
    {path:ROUTES.ABOUT,element:<LegacySection section="about"/>},
    {path:ROUTES.GALLERY,element:<LegacySection section="gallery"/>},
    {path:ROUTES.REGISTER,element:<LegacySection section="register"/>},
    {path:'*',element:<NotFoundPage/>},
  ]},
  {path:'/admin/request-access',element:<Suspense fallback={<p role="status">Loading…</p>}><AdminRequestAccessPage/></Suspense>},
  {path:'/admin',element:<Suspense fallback={<p role="status">Loading admin…</p>}><AdminPortal/></Suspense>,children:[
    {index:true,element:<Navigate to="dashboard" replace/>},
    {path:'login',element:<Navigate to="../dashboard" replace/>},
    {path:'dashboard',element:<ProtectedAdminPage permission="DASHBOARD_VIEW"><DashboardPage/></ProtectedAdminPage>},
    {path:'teams',element:<ProtectedAdminPage permission="TEAMS_VIEW"><TeamsPage/></ProtectedAdminPage>},
    {path:'participants',element:<ProtectedAdminPage permission="PARTICIPANTS_VIEW"><ParticipantsPage/></ProtectedAdminPage>},
    {path:'revenue',element:<ProtectedAdminPage permission="SUPER_ADMIN"><RevenuePage/></ProtectedAdminPage>},
    {path:'statistics',element:<ProtectedAdminPage permission="STATISTICS_VIEW"><StatisticsPage/></ProtectedAdminPage>},
    {path:'history',element:<Navigate to="../audit-log" replace/>},
    {path:'audit-log',element:<ProtectedAdminPage permission="HISTORY_VIEW"><HistoryPage/></ProtectedAdminPage>},
    {path:'studio',element:<ProtectedAdminPage permission="SITE_PREVIEW"><MediaStudio/></ProtectedAdminPage>},
    {path:'editor',element:<Navigate to="../studio" replace/>},
    {path:'preview',element:<Navigate to="../studio" replace/>},
    {path:'media',element:<Navigate to="../studio" replace/>},
    {path:'form',element:<ProtectedAdminPage permission="FORM_VIEW"><FormEditorPage/></ProtectedAdminPage>},
    {path:'settings',element:<ProtectedAdminPage permission="EVENT_VIEW"><SettingsPage/></ProtectedAdminPage>},
    {path:'exports',element:<Navigate to="../teams" replace/>},
    {path:'admins',element:<ProtectedAdminPage permission="SUPER_ADMIN"><AdminPermissionsPage/></ProtectedAdminPage>},
    {path:'profile',element:<ProfilePage/>},
  ]},
]);
