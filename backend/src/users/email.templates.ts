/**
 * Jesta — branded email templates
 * All templates return a plain HTML string safe to send via Resend.
 */

export function verificationEmailHtml(opts: {
  fullName: string;
  code:     string;
}): string {
  const { fullName, code } = opts;

  // Split code into individual digit spans for styled display
  const digits = code.split('').map(d =>
    `<span style="display:inline-block; width:44px; height:56px; line-height:56px;
      background:rgba(124,58,237,0.15); border:1.5px solid rgba(124,58,237,0.4);
      border-radius:12px; font-size:28px; font-weight:900; color:#c4b5fd;
      text-align:center; margin:0 4px;">${d}</span>`
  ).join('');

  return /* html */`
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>קוד האימות שלך — Jesta ⚡</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background:#06030f;
      font-family:'Heebo','Segoe UI',Arial,sans-serif;
      color:#f5f3ff;
      -webkit-font-smoothing:antialiased;
    }
  </style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background:#06030f; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:560px; width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#9333ea 55%,#ec4899 100%);
                        border-radius:20px 20px 0 0; padding:36px 40px 32px; text-align:center;">
              <div style="display:inline-block; background:rgba(255,255,255,0.15);
                          border-radius:20px; padding:14px 18px; margin-bottom:18px;">
                <span style="font-size:42px; line-height:1;">⚡</span>
              </div>
              <div style="font-size:13px; font-weight:700; letter-spacing:5px;
                          color:rgba(255,255,255,0.7); text-transform:uppercase; margin-bottom:10px;">
                JESTA
              </div>
              <div style="font-size:26px; font-weight:900; color:#ffffff; line-height:1.3;">
                קוד האימות שלך
              </div>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#0d0824; padding:36px 40px;">

              <p style="font-size:16px; color:#e2d9f3; font-weight:700; margin-bottom:8px;">
                היי ${fullName} 👋
              </p>
              <p style="font-size:15px; color:#94a3b8; line-height:1.7; margin-bottom:28px;">
                הזן את הקוד הבא באפליקציה כדי לאמת את כתובת המייל שלך ולהתחיל לסגור ג׳סטות ⚡
              </p>

              <!-- OTP Code display -->
              <div style="text-align:center; padding:24px 0 32px;">
                ${digits}
              </div>

              <!-- Divider -->
              <div style="border-top:1px solid rgba(167,139,250,0.12); margin-bottom:24px;"></div>

              <!-- Expiry note -->
              <div style="background:rgba(124,58,237,0.12); border:1px solid rgba(124,58,237,0.2);
                          border-radius:12px; padding:14px 18px;">
                <p style="font-size:12.5px; color:#a78bfa; line-height:1.6; margin:0;">
                  ⏱ הקוד תקף ל-30 דקות. לא נרשמת? פשוט התעלם מהמייל הזה.
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#070516; border-radius:0 0 20px 20px;
                        padding:20px 40px; text-align:center;">
              <p style="font-size:11px; color:#374151; line-height:1.8;">
                נשלח על ידי <strong style="color:#6b7280;">Jesta</strong> —
                הפלטפורמה המספר 1 לעבודות מהירות לנוער בישראל.
                <br/>אין צורך להשיב למייל זה.
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
