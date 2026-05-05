export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';

export default function MePage() {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const memberToken = session ? verifySignedToken(session.value) : null;

  if (memberToken) {
    redirect(`/my-reviews?token=${memberToken}`);
  } else {
    redirect('/login');
  }
}
