import nodemailer from 'nodemailer';
import path from 'path';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

function createTransport() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

export interface ApplicationMailData {
  fullName: string;
  email: string;
  phone: string;
  roleTitle: string;
  currentCompany?: string;
  totalExperience?: string;
  noticePeriod?: string;
  currentLocation?: string;
  linkedinUrl?: string;
  coverNote?: string;
  resumePath?: string; // local disk path e.g. /uploads/resumes/resume-xxx.pdf
}

export async function sendApplicationEmails(data: ApplicationMailData) {
  const transport = createTransport();

  if (!transport) {
    logger.info({ email: data.email }, '[mail] SMTP not configured — logging emails instead');
    logger.info('[mail] CANDIDATE email would be sent to: %s', data.email);
    logger.info('[mail] TA email would be sent to: %s', env.TA_EMAIL);
    return;
  }

  const appliedAt = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── 1. Candidate confirmation ──────────────────────────────────────────────
  const candidateHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#111111;padding:32px 40px">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#ff5c00">TAPMIND</p>
            <h1 style="margin:12px 0 0;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">Application Received</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 16px;font-size:15px;color:#333333">Hi <strong>${data.fullName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6">
              Thank you for applying for the <strong>${data.roleTitle}</strong> position at TapMind.
              We have successfully received your application and our talent team will review it shortly.
            </p>

            <!-- Details card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;border:1px solid #e8e8e8;margin-bottom:28px">
              <tr><td style="padding:20px 24px">
                <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#999999">YOUR APPLICATION</p>
                <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#111111">${data.roleTitle}</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="50%" style="padding:6px 0;font-size:13px;color:#777777">Applied on</td>
                    <td width="50%" style="padding:6px 0;font-size:13px;color:#333333;font-weight:600">${appliedAt}</td>
                  </tr>
                  ${data.currentCompany ? `<tr>
                    <td width="50%" style="padding:6px 0;font-size:13px;color:#777777">Current company</td>
                    <td width="50%" style="padding:6px 0;font-size:13px;color:#333333;font-weight:600">${data.currentCompany}</td>
                  </tr>` : ''}
                  ${data.totalExperience ? `<tr>
                    <td width="50%" style="padding:6px 0;font-size:13px;color:#777777">Experience</td>
                    <td width="50%" style="padding:6px 0;font-size:13px;color:#333333;font-weight:600">${data.totalExperience}</td>
                  </tr>` : ''}
                  ${data.noticePeriod ? `<tr>
                    <td width="50%" style="padding:6px 0;font-size:13px;color:#777777">Notice period</td>
                    <td width="50%" style="padding:6px 0;font-size:13px;color:#333333;font-weight:600">${data.noticePeriod}</td>
                  </tr>` : ''}
                </table>
              </td></tr>
            </table>

            <p style="margin:0 0 8px;font-size:14px;color:#555555;line-height:1.6">
              Our talent team will carefully review your profile. If your experience aligns with what we are looking for,
              we will reach out to you within <strong>5–7 business days</strong> to schedule the next steps.
            </p>
            <p style="margin:0 0 32px;font-size:14px;color:#555555;line-height:1.6">
              In the meantime, feel free to explore more about TapMind on our website.
            </p>

            <p style="margin:0;font-size:14px;color:#333333">Warm regards,<br><strong>TapMind Talent Team</strong></p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;border-top:1px solid #e8e8e8;padding:20px 40px;text-align:center">
            <p style="margin:0;font-size:11px;color:#aaaaaa">
              This is an automated email. Please do not reply directly to this message.<br>
              © ${new Date().getFullYear()} TapMind. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ── 2. TA team notification ────────────────────────────────────────────────
  const taHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#111111;padding:32px 40px">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#ff5c00">TAPMIND · TALENT</p>
            <h1 style="margin:12px 0 0;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">New Application Received</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6">
              A new candidate has applied for <strong>${data.roleTitle}</strong>. Details below:
            </p>

            <!-- Candidate card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;border:1px solid #e8e8e8;margin-bottom:28px">
              <tr><td style="padding:20px 24px">
                <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#999999">CANDIDATE</p>
                <p style="margin:0 0 20px;font-size:20px;font-weight:800;color:#111111">${data.fullName}</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="40%" style="padding:7px 0;font-size:13px;color:#777777;border-bottom:1px solid #eeeeee">Role</td>
                    <td width="60%" style="padding:7px 0;font-size:13px;color:#333333;font-weight:600;border-bottom:1px solid #eeeeee">${data.roleTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 0;font-size:13px;color:#777777;border-bottom:1px solid #eeeeee">Email</td>
                    <td style="padding:7px 0;font-size:13px;border-bottom:1px solid #eeeeee"><a href="mailto:${data.email}" style="color:#ff5c00;text-decoration:none;font-weight:600">${data.email}</a></td>
                  </tr>
                  <tr>
                    <td style="padding:7px 0;font-size:13px;color:#777777;border-bottom:1px solid #eeeeee">Phone</td>
                    <td style="padding:7px 0;font-size:13px;color:#333333;font-weight:600;border-bottom:1px solid #eeeeee">${data.phone}</td>
                  </tr>
                  ${data.currentLocation ? `<tr>
                    <td style="padding:7px 0;font-size:13px;color:#777777;border-bottom:1px solid #eeeeee">Location</td>
                    <td style="padding:7px 0;font-size:13px;color:#333333;font-weight:600;border-bottom:1px solid #eeeeee">${data.currentLocation}</td>
                  </tr>` : ''}
                  ${data.currentCompany ? `<tr>
                    <td style="padding:7px 0;font-size:13px;color:#777777;border-bottom:1px solid #eeeeee">Current company</td>
                    <td style="padding:7px 0;font-size:13px;color:#333333;font-weight:600;border-bottom:1px solid #eeeeee">${data.currentCompany}</td>
                  </tr>` : ''}
                  ${data.totalExperience ? `<tr>
                    <td style="padding:7px 0;font-size:13px;color:#777777;border-bottom:1px solid #eeeeee">Experience</td>
                    <td style="padding:7px 0;font-size:13px;color:#333333;font-weight:600;border-bottom:1px solid #eeeeee">${data.totalExperience}</td>
                  </tr>` : ''}
                  ${data.noticePeriod ? `<tr>
                    <td style="padding:7px 0;font-size:13px;color:#777777;border-bottom:1px solid #eeeeee">Notice period</td>
                    <td style="padding:7px 0;font-size:13px;color:#333333;font-weight:600;border-bottom:1px solid #eeeeee">${data.noticePeriod}</td>
                  </tr>` : ''}
                  ${data.linkedinUrl ? `<tr>
                    <td style="padding:7px 0;font-size:13px;color:#777777">LinkedIn</td>
                    <td style="padding:7px 0;font-size:13px"><a href="${data.linkedinUrl}" style="color:#ff5c00;text-decoration:none;font-weight:600">${data.linkedinUrl}</a></td>
                  </tr>` : ''}
                </table>
              </td></tr>
            </table>

            ${data.coverNote ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffdf8;border-left:3px solid #ff5c00;margin-bottom:28px">
              <tr><td style="padding:16px 20px">
                <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ff5c00">COVER NOTE</p>
                <p style="margin:0;font-size:14px;color:#555555;line-height:1.6">${data.coverNote}</p>
              </td></tr>
            </table>` : ''}

            ${data.resumePath ? `<p style="margin:0 0 8px;font-size:14px;color:#555555">The candidate's resume is attached to this email.</p>` : '<p style="margin:0 0 8px;font-size:14px;color:#999999"><em>No resume uploaded.</em></p>'}

            <p style="margin:28px 0 0;font-size:14px;color:#333333">— TapMind People Hub</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;border-top:1px solid #e8e8e8;padding:20px 40px;text-align:center">
            <p style="margin:0;font-size:11px;color:#aaaaaa">
              © ${new Date().getFullYear()} TapMind. This notification was triggered by a new careers page submission.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ── Attachments ────────────────────────────────────────────────────────────
  const attachments: nodemailer.SendMailOptions['attachments'] = [];
  if (data.resumePath) {
    const filename = `${data.fullName.replace(/\s+/g, '_')}_Resume${path.extname(data.resumePath)}`;
    if (data.resumePath.startsWith('http')) {
      // CDN URL — fetch the file and attach from buffer
      try {
        const r = await fetch(data.resumePath);
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          attachments.push({ filename, content: buf });
        }
      } catch { /* skip attachment on fetch failure */ }
    } else {
      // local fallback path
      const diskPath = path.join(__dirname, '..', '..', '..', data.resumePath);
      attachments.push({ filename, path: diskPath });
    }
  }

  try {
    await Promise.all([
      transport.sendMail({
        from: `"TapMind Careers" <${env.SMTP_FROM}>`,
        to: data.email,
        subject: `Application Received — ${data.roleTitle} at TapMind`,
        html: candidateHtml,
      }),
      transport.sendMail({
        from: `"TapMind People Hub" <${env.SMTP_FROM}>`,
        to: env.TA_EMAIL,
        subject: `New Application: ${data.fullName} — ${data.roleTitle}`,
        html: taHtml,
        attachments,
      }),
    ]);
    logger.info('[mail] Application emails sent — candidate: %s, TA: %s', data.email, env.TA_EMAIL);
  } catch (err) {
    logger.error({ err }, '[mail] Failed to send application emails');
  }
}

// ── Interview schedule email ───────────────────────────────────────────────

export interface ScheduleMailData {
  fullName: string;
  email: string;
  roleTitle: string;
  interviewDate: string;   // e.g. "27 Nov 2026"
  interviewTime: string;   // e.g. "11:00 AM"
  interviewType: string;   // "Video Call" | "Phone Call" | "In-Person"
  meetingLink?: string;
  notes?: string;
  scheduledBy: string;
  resumePath?: string;
}

export async function sendInterviewScheduleEmail(data: ScheduleMailData) {
  const transport = createTransport();

  if (!transport) {
    logger.info('[mail] SMTP not configured — interview schedule email would be sent to: %s', data.email);
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <tr>
          <td style="background:#111111;padding:32px 40px">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#ff5c00">TAPMIND</p>
            <h1 style="margin:12px 0 0;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">Interview Scheduled</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 16px;font-size:15px;color:#333333">Hi <strong>${data.fullName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#555555;line-height:1.6">
              We are excited to move forward with your application for <strong>${data.roleTitle}</strong> at TapMind.
              Your interview has been scheduled — details below.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;border:1px solid #e8e8e8;margin-bottom:28px">
              <tr><td style="padding:20px 24px">
                <p style="margin:0 0 16px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ff5c00">INTERVIEW DETAILS</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="45%" style="padding:7px 0;font-size:13px;color:#777777;border-bottom:1px solid #eeeeee">Date</td>
                    <td width="55%" style="padding:7px 0;font-size:13px;font-weight:700;color:#111111;border-bottom:1px solid #eeeeee">${data.interviewDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 0;font-size:13px;color:#777777;border-bottom:1px solid #eeeeee">Time</td>
                    <td style="padding:7px 0;font-size:13px;font-weight:700;color:#111111;border-bottom:1px solid #eeeeee">${data.interviewTime}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 0;font-size:13px;color:#777777;${data.meetingLink ? 'border-bottom:1px solid #eeeeee;' : ''}">Format</td>
                    <td style="padding:7px 0;font-size:13px;font-weight:700;color:#111111;${data.meetingLink ? 'border-bottom:1px solid #eeeeee;' : ''}">${data.interviewType}</td>
                  </tr>
                  ${data.meetingLink ? `<tr>
                    <td style="padding:7px 0;font-size:13px;color:#777777;">Meeting Link</td>
                    <td style="padding:7px 0;font-size:13px;"><a href="${data.meetingLink}" style="color:#ff5c00;text-decoration:none;font-weight:600;word-break:break-all;">${data.meetingLink}</a></td>
                  </tr>` : ''}
                </table>
              </td></tr>
            </table>

            ${data.notes ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffdf8;border-left:3px solid #ff5c00;margin-bottom:28px">
              <tr><td style="padding:16px 20px">
                <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ff5c00">NOTE FROM TALENT TEAM</p>
                <p style="margin:0;font-size:14px;color:#555555;line-height:1.6">${data.notes}</p>
              </td></tr>
            </table>` : ''}

            <p style="margin:0 0 8px;font-size:14px;color:#555555;line-height:1.6">
              Please confirm your availability by replying to this email.
              If you need to reschedule, reach out to us as early as possible.
            </p>
            <p style="margin:0 0 32px;font-size:14px;color:#555555;line-height:1.6">We look forward to speaking with you!</p>

            <p style="margin:0;font-size:14px;color:#333333">Warm regards,<br><strong>${data.scheduledBy}</strong><br>TapMind Talent Team</p>
          </td>
        </tr>

        <tr>
          <td style="background:#f9f9f9;border-top:1px solid #e8e8e8;padding:20px 40px;text-align:center">
            <p style="margin:0;font-size:11px;color:#aaaaaa">
              © ${new Date().getFullYear()} TapMind. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // attach resume for TA reference
  const attachments: nodemailer.SendMailOptions['attachments'] = [];
  if (data.resumePath) {
    const filename = `${data.fullName.replace(/\s+/g, '_')}_Resume${path.extname(data.resumePath)}`;
    if (data.resumePath.startsWith('http')) {
      try {
        const r = await fetch(data.resumePath);
        if (r.ok) attachments.push({ filename, content: Buffer.from(await r.arrayBuffer()) });
      } catch { /* skip */ }
    } else {
      attachments.push({ filename, path: path.join(__dirname, '..', '..', '..', data.resumePath) });
    }
  }

  try {
    await transport.sendMail({
      from: `"TapMind Talent Team" <${env.SMTP_FROM}>`,
      to: data.email,
      subject: `Interview Scheduled — ${data.roleTitle} at TapMind (${data.interviewDate}, ${data.interviewTime})`,
      html,
      attachments,
    });
    logger.info('[mail] Interview schedule email sent to %s', data.email);
  } catch (err) {
    logger.error({ err }, '[mail] Failed to send interview schedule email');
  }
}
