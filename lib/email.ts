// Server-only — Resend email functions for the review module.
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'MTIP Reviews <onboarding@resend.dev>';

// ─── Helper ───────────────────────────────────────────────────────────────────

async function send(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping send to', to);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('[email] Failed to send to', to, err);
  }
}

function base(content: string) {
  return `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#888">MTIP</p>
      ${content}
      <hr style="margin:32px 0;border:none;border-top:1px solid #eee"/>
      <p style="margin:0;font-size:12px;color:#aaa">This email was sent by the MTIP internal review tool. Do not reply.</p>
    </div>
  `;
}

function btn(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">${label}</a>`;
}

// ─── Self-review invite ───────────────────────────────────────────────────────

export async function sendSelfReviewInvite(
  to: string,
  firstName: string,
  cycleName: string,
  dueDate: string | null,
  link: string,
) {
  const due = dueDate ? ` Due: <strong>${dueDate}</strong>.` : '';
  await send(
    to,
    `Your self-review is ready — ${cycleName}`,
    base(`
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600">Hi ${firstName},</h1>
      <p style="margin:0 0 8px">Your self-review for <strong>${cycleName}</strong> is now open.${due}</p>
      <p style="margin:0">Please take some time to reflect on your performance and fill in the form.</p>
      ${btn('Open my self-review', link)}
    `),
  );
}

// ─── Peer review invite ───────────────────────────────────────────────────────

export async function sendPeerReviewInvite(
  to: string,
  firstName: string,
  cycleName: string,
  dueDate: string | null,
  assignments: { subjectName: string; link: string }[],
) {
  const due = dueDate ? ` Due: <strong>${dueDate}</strong>.` : '';
  const list = assignments
    .map(
      (a) =>
        `<li style="margin-bottom:8px"><a href="${a.link}" style="color:#111;font-weight:500">${a.subjectName}</a></li>`,
    )
    .join('');

  await send(
    to,
    `Peer reviews to complete — ${cycleName}`,
    base(`
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600">Hi ${firstName},</h1>
      <p style="margin:0 0 8px">You have <strong>${assignments.length}</strong> peer review${assignments.length > 1 ? 's' : ''} to complete for <strong>${cycleName}</strong>.${due}</p>
      <p style="margin:0 0 12px">Your responses are anonymous — only the manager sees them.</p>
      <ul style="padding-left:20px;margin:0">${list}</ul>
    `),
  );
}

// ─── Manager review invite ────────────────────────────────────────────────────

export async function sendManagerReviewInvite(
  to: string,
  firstName: string,
  cycleName: string,
  dueDate: string | null,
  directReports: { name: string; link: string }[],
) {
  const due = dueDate ? ` Due: <strong>${dueDate}</strong>.` : '';
  const list = directReports
    .map(
      (r) =>
        `<li style="margin-bottom:8px"><a href="${r.link}" style="color:#111;font-weight:500">${r.name}</a></li>`,
    )
    .join('');

  await send(
    to,
    `Manager reviews ready — ${cycleName}`,
    base(`
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600">Hi ${firstName},</h1>
      <p style="margin:0 0 8px">Manager reviews for <strong>${cycleName}</strong> are now open.${due}</p>
      <p style="margin:0 0 12px">You can see each person's self-review and anonymized peer feedback before writing your own review.</p>
      <ul style="padding-left:20px;margin:0">${list}</ul>
    `),
  );
}

// ─── Review available (to employee) ──────────────────────────────────────────

export async function sendReviewAvailable(
  to: string,
  firstName: string,
  cycleName: string,
  link: string,
) {
  await send(
    to,
    `Your review is ready to read — ${cycleName}`,
    base(`
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600">Hi ${firstName},</h1>
      <p style="margin:0 0 8px">Your manager has completed and signed off your review for <strong>${cycleName}</strong>.</p>
      <p style="margin:0">You can now read it and acknowledge receipt.</p>
      ${btn('Read my review', link)}
    `),
  );
}

// ─── Reminder ─────────────────────────────────────────────────────────────────

export async function sendReviewReminder(
  to: string,
  firstName: string,
  outstandingForms: { label: string; link: string }[],
) {
  const list = outstandingForms
    .map(
      (f) =>
        `<li style="margin-bottom:8px"><a href="${f.link}" style="color:#111;font-weight:500">${f.label}</a></li>`,
    )
    .join('');

  await send(
    to,
    'Reminder: outstanding review forms',
    base(`
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600">Hi ${firstName},</h1>
      <p style="margin:0 0 12px">You still have the following review forms to complete:</p>
      <ul style="padding-left:20px;margin:0">${list}</ul>
    `),
  );
// Server-only — email sending via Resend.
import { Resend } from 'resend';

const FROM = 'Monday Standup <onboarding@resend.dev>';

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

/** Send a password reset code to a team member. */
export async function sendResetCode(opts: {
  to: string;
  firstName: string;
  code: string;
  resetUrl: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    // Log in dev so you can see the code without email
    console.log(`[email skipped — no RESEND_API_KEY] Reset code for ${opts.to}: ${opts.code}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to:   opts.to,
    subject: 'Your password reset code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#111;">
        <p style="margin:0 0 16px">Hi ${opts.firstName},</p>
        <p style="margin:0 0 24px">Here is your password reset code for the Monday standup tool:</p>
        <div style="background:#f4f4f5;border-radius:8px;padding:20px 24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:28px;font-weight:700;letter-spacing:6px;font-family:monospace;">${opts.code}</span>
        </div>
        <p style="margin:0 0 16px">
          <a href="${opts.resetUrl}" style="background:#111;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;">
            Reset my password
          </a>
        </p>
        <p style="margin:24px 0 0;font-size:12px;color:#666;">
          This code expires in 24 hours. If you didn't request this, ignore this email.
        </p>
      </div>
    `,
  });
}

/** Send a welcome email with login link to a new team member. */
export async function sendWelcome(opts: {
  to: string;
  firstName: string;
  checkinUrl: string;
  tempPassword: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email skipped — no RESEND_API_KEY] Welcome for ${opts.to}, temp pw: ${opts.tempPassword}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to:   opts.to,
    subject: 'Your Monday standup access',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#111;">
        <p style="margin:0 0 16px">Hi ${opts.firstName},</p>
        <p style="margin:0 0 16px">You've been added to the Monday standup tool. Here are your login details:</p>
        <p style="margin:0 0 8px"><strong>Your check-in link:</strong></p>
        <p style="margin:0 0 16px">
          <a href="${opts.checkinUrl}" style="color:#111;">${opts.checkinUrl}</a>
        </p>
        <p style="margin:0 0 8px"><strong>Temporary password:</strong></p>
        <div style="background:#f4f4f5;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-family:monospace;">
          ${opts.tempPassword}
        </div>
        <p style="margin:0 0 24px">
          <a href="${opts.checkinUrl}" style="background:#111;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;">
            Open my check-in
          </a>
        </p>
        <p style="margin:0;font-size:12px;color:#666;">
          You can change your password after logging in.
        </p>
      </div>
    `,
  });
}
