import nodemailer from 'nodemailer'

type MailResult = {
  sent: boolean
  reason?: string
}

const SMTP_HOST = process.env.SMTP_HOST ?? 'smtp.gmail.com'
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465)
const SMTP_SECURE = String(process.env.SMTP_SECURE ?? 'true').toLowerCase() !== 'false'
const SMTP_USER = process.env.SMTP_USER ?? ''
const SMTP_PASS = process.env.SMTP_PASS ?? ''
const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER

const transporter =
  SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      })
    : null

function canSendMail(): boolean {
  return Boolean(transporter && SMTP_FROM)
}

async function sendMail(to: string, subject: string, html: string, text: string): Promise<MailResult> {
  if (!canSendMail()) {
    return { sent: false, reason: 'SMTP is not configured. Set SMTP_USER, SMTP_PASS and SMTP_FROM.' }
  }

  try {
    await transporter!.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
      text,
    })
    return { sent: true }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown mail error'
    return { sent: false, reason }
  }
}

export async function sendPasswordResetOtpEmail(to: string, name: string, otp: string): Promise<MailResult> {
  const subject = 'Promoora CRM password reset OTP'
  const text = [
    `Hi ${name},`,
    '',
    `Your OTP for password reset is: ${otp}`,
    'This OTP is valid for 5 minutes only.',
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n')

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your OTP for password reset is:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:4px;margin:16px 0;">${otp}</p>
      <p>This OTP is valid for <strong>5 minutes</strong> only.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `

  return sendMail(to, subject, html, text)
}

export async function sendWelcomeMemberEmail(to: string, name: string, password: string): Promise<MailResult> {
  const subject = 'Welcome to Promoora CRM'
  const text = [
    `Hi ${name},`,
    '',
    'Your Promoora CRM account has been created by admin.',
    `Email: ${to}`,
    `Temporary password: ${password}`,
    '',
    'After login, go to Settings > Change password and reset your password immediately.',
  ].join('\n')

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your Promoora CRM account has been created by admin.</p>
      <p><strong>Email:</strong> ${to}<br/><strong>Temporary password:</strong> ${password}</p>
      <p>Please login and then go to <strong>Settings &gt; Change password</strong> to reset your password immediately.</p>
    </div>
  `

  return sendMail(to, subject, html, text)
}