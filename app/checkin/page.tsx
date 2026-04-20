import { cookies } from 'next/headers';
import { getMemberByToken } from '@/config/team';
import { getCheckin } from '@/lib/db';
import { getISOWeek, formatWeekLabel } from '@/lib/weeks';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import CheckinForm from './CheckinForm';
import PasswordGate from './PasswordGate';

// Always render fresh — reads DB and cookies on every request
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { token?: string };
}

export default function CheckinPage({ searchParams }: PageProps) {
  const token = searchParams.token?.trim();

  if (!token) {
    return <ErrorScreen title="No token provided" body="Please use your personal check-in link." />;
  }

  const member = getMemberByToken(token);

  if (!member) {
    return (
      <ErrorScreen
        title="Link not recognised"
        body="This check-in link doesn't seem right. Check with your team administrator."
      />
    );
  }

  // Check session cookie — must be signed and match this person's token
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const authenticatedToken = session ? verifySignedToken(session.value) : null;

  if (authenticatedToken !== token) {
    // Not logged in, or logged in as someone else
    return <PasswordGate token={token} memberName={member.name} />;
  }

  const now = new Date();
  const { week, year } = getISOWeek(now);
  const existing = getCheckin(token, week, year);
  const today = now.toISOString().split('T')[0];

  return (
    <CheckinForm
      member={member}
      existing={existing ?? null}
      isoWeek={week}
      isoYear={year}
      today={today}
      weekLabel={formatWeekLabel(week, year)}
      token={token}
    />
  );
}

function ErrorScreen({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">{title}</h1>
        <p className="text-sm text-gray-500">{body}</p>
      </div>
    </div>
  );
}
