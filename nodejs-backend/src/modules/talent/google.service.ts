import { google } from 'googleapis';
import { env } from '../../config/env';

function getAuth(scopes: string[]) {
  const email = (env as any).GOOGLE_CLIENT_EMAIL as string | undefined;
  const key = (env as any).GOOGLE_PRIVATE_KEY as string | undefined;
  if (!email || !key) return null;

  const impersonate = (env as any).GOOGLE_IMPERSONATE_EMAIL as string | undefined;

  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes,
    subject: impersonate ?? undefined,
  });
}

export function googleConfigured() {
  return !!(env as any).GOOGLE_CLIENT_EMAIL && !!(env as any).GOOGLE_PRIVATE_KEY;
}

export async function createMeetEvent(opts: {
  title: string;
  dateStr: string;
  timeStr: string;
  durationMinutes?: number;
  description?: string;
}) {
  // Try Google Meet Space API first (creates a persistent meeting room, no Workspace needed)
  const meetAuth = getAuth(['https://www.googleapis.com/auth/meetings.space.created']);
  if (meetAuth) {
    try {
      const meet = google.meet({ version: 'v2', auth: meetAuth });
      const space = await (meet.spaces as any).create({ requestBody: {} });
      const meetingUri = space.data.meetingUri as string | undefined;
      if (meetingUri) return { meetLink: meetingUri };
    } catch (meetErr) {
      // Meet Space API not enabled or not available — fall through to Calendar API
      console.warn('[google] Meet Space API failed, trying Calendar API:', (meetErr as Error).message);
    }
  }

  // Fallback: Google Calendar API with conferenceData (requires Google Workspace)
  const calAuth = getAuth(['https://www.googleapis.com/auth/calendar.events']);
  if (!calAuth) throw new Error('Google credentials not configured');

  const { title, dateStr, timeStr, durationMinutes = 60, description } = opts;

  const [timePart, period] = timeStr.split(' ');
  const [hStr, mStr] = timePart.split(':');
  let hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  if (period?.toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (period?.toUpperCase() === 'AM' && hours === 12) hours = 0;

  const start = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const calendar = google.calendar({ version: 'v3', auth: calAuth });
  const calendarId = ((env as any).GOOGLE_CALENDAR_ID as string | undefined) ?? 'primary';

  const event = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    requestBody: {
      summary: title,
      description: description ?? '',
      start: { dateTime: start.toISOString(), timeZone: 'Asia/Kolkata' },
      end:   { dateTime: end.toISOString(),   timeZone: 'Asia/Kolkata' },
      conferenceData: {
        createRequest: {
          requestId: `ph-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  const link = event.data.hangoutLink;
  if (!link) throw new Error('Could not generate a Meet link. Enable the Google Meet API or use a Google Workspace account.');
  return { meetLink: link, eventId: event.data.id };
}
