import { cookies } from 'next/headers';
import { verifySignedToken, ADMIN_COOKIE_NAME } from '@/lib/auth';
import AdminClient from './AdminClient';
import AdminLogin from './AdminLogin';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const cookieStore = cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME);
  const verified = session ? verifySignedToken(session.value) : null;

  if (verified !== 'admin') {
    return <AdminLogin />;
  }

  return <AdminClient />;
}
