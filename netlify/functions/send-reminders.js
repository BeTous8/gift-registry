/**
 * Netlify Scheduled Function: send-reminders
 * Runs every hour to send pending event reminders via email
 *
 * Schedule: "0 * * * *" (every hour at minute 0)
 */

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// Get readable label for reminder
function getReminderLabel(reminder) {
  // Support new flexible format (reminder_amount + reminder_unit)
  if (reminder.reminder_amount && reminder.reminder_unit) {
    const amount = reminder.reminder_amount;
    const unit = reminder.reminder_unit;
    // Singularize unit if amount is 1
    const unitLabel = amount === 1 ? unit.replace(/s$/, '') : unit;
    return `${amount} ${unitLabel}`;
  }

  // Fallback: support legacy reminder_type format
  const labels = {
    '1_hour': '1 hour',
    '2_hours': '2 hours',
    '1_day': '1 day',
    '2_days': '2 days',
    '3_days': '3 days',
    '1_week': '1 week',
    '2_weeks': '2 weeks',
    '1_month': '1 month',
  };
  return labels[reminder.reminder_type] || reminder.reminder_type || 'soon';
}

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return 'Date TBD';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

// Generate email HTML
function generateEmailHtml(eventTitle, eventDate, reminderLabel, ownerName, eventUrl, locationName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background-color: #F8F7FF;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F7FF; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #B8A9E8 0%, #FFCDB2 50%, #B5EAD7 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #2D2A3E; font-size: 24px; font-weight: 700;">Event Reminder</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #2D2A3E; font-size: 16px; line-height: 1.5;">
                ${ownerName ? `<strong>${ownerName}</strong> wanted to remind you about an upcoming event:` : 'Reminder: You have an upcoming event!'}
              </p>

              <!-- Event Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F7FF; border-radius: 12px; padding: 24px; margin: 20px 0;">
                <tr>
                  <td>
                    <h2 style="margin: 0 0 16px 0; color: #2D2A3E; font-size: 22px; font-weight: 600;">${eventTitle}</h2>
                    <p style="margin: 0 0 8px 0; color: #3D3A50; font-size: 14px;">
                      <strong>Date:</strong> ${eventDate}
                    </p>
                    ${locationName ? `<p style="margin: 0 0 8px 0; color: #3D3A50; font-size: 14px;"><strong>Location:</strong> ${locationName}</p>` : ''}
                    <p style="margin: 0; color: #B8A9E8; font-size: 14px; font-weight: 500;">
                      This event is in ${reminderLabel}!
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${eventUrl}" style="display: inline-block; background: linear-gradient(135deg, #B8A9E8 0%, #9381D4 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      View Event
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F7FF; padding: 20px 30px; text-align: center; border-top: 1px solid #E8E6F0;">
              <p style="margin: 0; color: #6B6880; font-size: 12px;">
                Sent by <a href="https://memoraapp.netlify.app" style="color: #B8A9E8; text-decoration: none;">Memora</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

exports.handler = async (event, context) => {
  console.log('Send reminders function triggered at:', new Date().toISOString());

  try {
    // Get current time
    const now = new Date().toISOString();

    // Fetch pending reminders where scheduled_for <= now and is_sent = false
    const { data: pendingReminders, error: fetchError } = await supabase
      .from('event_reminders')
      .select(`
        id,
        event_id,
        reminder_type,
        reminder_amount,
        reminder_unit,
        send_to_members,
        scheduled_for
      `)
      .eq('is_sent', false)
      .lte('scheduled_for', now)
      .limit(50); // Process up to 50 at a time

    if (fetchError) {
      console.error('Error fetching pending reminders:', fetchError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch pending reminders' })
      };
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      console.log('No pending reminders to send');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No pending reminders', count: 0 })
      };
    }

    console.log(`Found ${pendingReminders.length} pending reminders`);

    let sentCount = 0;
    let errorCount = 0;

    // Process each reminder
    for (const reminder of pendingReminders) {
      try {
        // Fetch event details
        const { data: event, error: eventError } = await supabase
          .from('events')
          .select(`
            id,
            title,
            event_date,
            slug,
            location,
            user_id
          `)
          .eq('id', reminder.event_id)
          .single();

        if (eventError || !event) {
          console.error(`Event not found for reminder ${reminder.id}:`, eventError);
          errorCount++;
          continue;
        }

        // Get owner info using Auth Admin API
        const { data: ownerData, error: ownerError } = await supabase.auth.admin.getUserById(event.user_id);
        if (ownerError) {
          console.error(`Failed to get owner for reminder ${reminder.id}:`, ownerError);
        }

        // Build recipient list
        const recipients = [];
        const ownerEmail = ownerData?.user?.email;
        const ownerName = ownerData?.user?.user_metadata?.full_name ||
                         ownerData?.user?.user_metadata?.name ||
                         'Event Host';

        // Always include owner
        if (ownerEmail) {
          recipients.push(ownerEmail);
        }

        // If send_to_members is true, fetch accepted members
        if (reminder.send_to_members) {
          const { data: members, error: membersError } = await supabase
            .from('event_members')
            .select('user_id')
            .eq('event_id', reminder.event_id)
            .eq('status', 'accepted');

          if (!membersError && members) {
            // Get each member's email using Auth Admin API
            for (const member of members) {
              try {
                const { data: memberData } = await supabase.auth.admin.getUserById(member.user_id);
                const memberEmail = memberData?.user?.email;
                if (memberEmail && !recipients.includes(memberEmail)) {
                  recipients.push(memberEmail);
                }
              } catch (memberErr) {
                console.error(`Failed to get member ${member.user_id}:`, memberErr);
              }
            }
          }
        }

        if (recipients.length === 0) {
          console.log(`No recipients found for reminder ${reminder.id}`);
          // Mark as sent anyway to prevent retry
          await supabase
            .from('event_reminders')
            .update({ is_sent: true, sent_at: now })
            .eq('id', reminder.id);
          continue;
        }

        // Generate email content
        const eventUrl = event.slug
          ? `https://memoraapp.netlify.app/event/${event.slug}`
          : 'https://memoraapp.netlify.app/dashboard';

        const locationName = event.location?.name || event.location?.formatted_address || null;

        const emailHtml = generateEmailHtml(
          event.title,
          formatDate(event.event_date),
          getReminderLabel(reminder),
          ownerName,
          eventUrl,
          locationName
        );

        // Send email to all recipients
        const { error: sendError } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Memora <invites@mail.mymemoraapp.com>',
          to: recipients,
          subject: `Reminder: ${event.title} is coming up!`,
          html: emailHtml
        });

        if (sendError) {
          console.error(`Failed to send reminder ${reminder.id}:`, sendError);
          errorCount++;
          continue;
        }

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from('event_reminders')
          .update({ is_sent: true, sent_at: now })
          .eq('id', reminder.id);

        if (updateError) {
          console.error(`Failed to mark reminder ${reminder.id} as sent:`, updateError);
          // Email was sent but DB update failed - log but count as partial success
          errorCount++;
          continue;
        }

        console.log(`Sent reminder ${reminder.id} to ${recipients.length} recipients`);
        sentCount++;

      } catch (reminderError) {
        console.error(`Error processing reminder ${reminder.id}:`, reminderError);
        errorCount++;
      }
    }

    console.log(`Completed: ${sentCount} sent, ${errorCount} errors`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Reminders processed',
        sent: sentCount,
        errors: errorCount,
        total: pendingReminders.length
      })
    };

  } catch (error) {
    console.error('Scheduled function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
