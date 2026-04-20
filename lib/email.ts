// Server-only — email sending via Resend.
import { Resend } from 'resend';

const FROM = 'Monday Standup <noreply@mtip.ch>';

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
