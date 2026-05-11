/* eslint-disable react/no-unescaped-entities */
import { Button, Heading, Text } from "@react-email/components";
import { EmailShell, bodyStyle, headingStyle, primaryButton } from "./_shell";

/**
 * PaymentFailedEmail — sent when Stripe fires `invoice.payment_failed`.
 *
 * Stripe keeps the subscription active through the grace period
 * configured in Dashboard → Billing → Retry settings (default ~3
 * weeks of smart retries before cancellation). This email tells the
 * customer their card failed and links them at the Stripe Portal to
 * update payment details before access is lost.
 *
 * Tone: short, practical, no shame. The most common cause is a
 * card that needs renewing — not anything the customer did wrong.
 */
export function PaymentFailedEmail({
  appUrl,
  planLabel,
}: {
  appUrl: string;
  /** "Pro", "Team", "Scale", or whatever the plan label is. */
  planLabel: string;
}) {
  return (
    <EmailShell
      preview={`Your ContentRX ${planLabel} payment didn't go through.`}
    >
      <Heading as="h1" style={headingStyle}>
        Your ContentRX payment didn't go through.
      </Heading>
      <Text style={bodyStyle}>
        Stripe couldn't charge your card for your ContentRX{" "}
        {planLabel} subscription. Most often this is a card that
        needs renewing, not anything you did wrong.
      </Text>
      <Text style={bodyStyle}>
        Stripe will retry the charge a few times automatically. To
        avoid losing access, update your payment method when you get
        a chance.
      </Text>
      <Text style={{ marginTop: 20 }}>
        <Button href={`${appUrl}/dashboard/settings`} style={primaryButton}>
          Update payment method
        </Button>
      </Text>
      <Text style={{ ...bodyStyle, marginTop: 24, fontSize: 12 }}>
        Questions? Reply to this email — we read every message.
      </Text>
    </EmailShell>
  );
}
