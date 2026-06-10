/**
 * Jesta — branded email templates
 * Email-client safe: table-based layout, inline styles only, no flexbox/grid.
 */

export function verificationEmailHtml(opts: {
  fullName: string;
  code:     string;
}): string {
  const { fullName, code } = opts;

  // Build the 6-digit OTP as a single-row 6-column table — never wraps on mobile
  const digits      = code.split('').slice(0, 6);
  const digitCells  = digits.map(d => `
        <td width="44" style="
          width: 44px;
          padding: 0 4px;
        ">
          <table width="44" cellpadding="0" cellspacing="0" role="presentation" style="width:44px;">
            <tr>
              <td align="center" style="
                width: 44px;
                height: 54px;
                background-color: #1a0d4a;
                border: 1.5px solid #5b21b6;
                border-radius: 10px;
                font-family: 'Helvetica Neue', Arial, sans-serif;
                font-size: 28px;
                font-weight: 900;
                color: #c4b5fd;
                letter-spacing: 0;
                text-align: center;
                vertical-align: middle;
              ">${d}</td>
            </tr>
          </table>
        </td>`).join('');

  return `<!DOCTYPE html>
<html lang="he" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <title>קוד האימות שלך — Jesta ⚡</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&display=swap');
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .fluid { width: 100% !important; max-width: 100% !important; }
      .stack-column { display: block !important; width: 100% !important; }
      .padding-sides { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="
  margin: 0;
  padding: 0;
  background-color: #06030f;
  font-family: 'Heebo', 'Helvetica Neue', Arial, sans-serif;
  direction: rtl;
">

<!-- ═══════════════════════════════════════════════════════
     OUTER WRAPPER
═══════════════════════════════════════════════════════ -->
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="
  background-color: #06030f;
  margin: 0;
  padding: 0;
">
  <tr>
    <td align="center" style="padding: 40px 16px;">

      <!-- ═══════════════════════════════════════════════
           EMAIL CONTAINER  (max 560px)
      ═══════════════════════════════════════════════ -->
      <table class="email-container" role="presentation" cellpadding="0" cellspacing="0"
        width="560" style="
          max-width: 560px;
          width: 100%;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        ">

        <!-- ───────────────────────────────────────────
             HEADER — gradient band
        ─────────────────────────────────────────── -->
        <tr>
          <td align="center" style="
            background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 45%, #9333ea 75%, #a855f7 100%);
            padding: 40px 40px 36px;
            border-radius: 20px 20px 0 0;
          ">

            <!-- Bolt icon badge -->
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="
                  background-color: rgba(255,255,255,0.15);
                  border-radius: 18px;
                  padding: 14px 20px;
                  margin-bottom: 18px;
                ">
                  <span style="font-size: 44px; line-height: 1; display: block;">⚡</span>
                </td>
              </tr>
            </table>

            <!-- Spacer -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr><td height="16" style="font-size:0; line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- Brand name -->
            <p style="
              margin: 0 0 10px;
              font-family: 'Heebo', 'Helvetica Neue', Arial, sans-serif;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 5px;
              color: rgba(255,255,255,0.65);
              text-transform: uppercase;
            ">JESTA · ג׳סטה</p>

            <!-- Headline -->
            <h1 style="
              margin: 0;
              font-family: 'Heebo', 'Helvetica Neue', Arial, sans-serif;
              font-size: 26px;
              font-weight: 900;
              color: #ffffff;
              line-height: 1.3;
            ">קוד האימות שלך</h1>

          </td>
        </tr>

        <!-- ───────────────────────────────────────────
             BODY — dark card
        ─────────────────────────────────────────── -->
        <tr>
          <td class="padding-sides" style="
            background-color: #0d0824;
            padding: 36px 40px 32px;
            direction: rtl;
          ">

            <!-- Greeting -->
            <p style="
              margin: 0 0 10px;
              font-family: 'Heebo', 'Helvetica Neue', Arial, sans-serif;
              font-size: 17px;
              font-weight: 700;
              color: #e2d9f3;
            ">היי ${fullName} 👋</p>

            <!-- Body copy -->
            <p style="
              margin: 0 0 28px;
              font-family: 'Heebo', 'Helvetica Neue', Arial, sans-serif;
              font-size: 15px;
              font-weight: 400;
              color: #94a3b8;
              line-height: 1.75;
            ">
              שמחים שהצטרפת לג׳סטה!<br />
              הזן את הקוד הבא באפליקציה כדי לאמת את כתובת המייל שלך
              ולהתחיל לסגור ג׳סטות ⚡
            </p>

            <!-- ─── OTP SECTION ─── -->
            <!-- Label -->
            <p style="
              margin: 0 0 14px;
              font-family: 'Heebo', 'Helvetica Neue', Arial, sans-serif;
              font-size: 12px;
              font-weight: 700;
              color: #7c3aed;
              letter-spacing: 2px;
              text-transform: uppercase;
            ">קוד חד-פעמי</p>

            <!-- OTP container — centered, single row guaranteed -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
              <tr>
                <td align="center">

                  <!-- Pill background -->
                  <table role="presentation" cellpadding="0" cellspacing="0" style="
                    background-color: #120840;
                    border: 1px solid rgba(91,33,182,0.45);
                    border-radius: 16px;
                    padding: 18px 16px;
                  ">
                    <tr>
                      <!-- Six digit cells in one row -->
                      ${digitCells}
                    </tr>
                  </table>

                </td>
              </tr>
            </table>
            <!-- ─── END OTP ─── -->

            <!-- Divider -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
              style="margin-bottom: 24px;">
              <tr>
                <td height="1" style="
                  background: linear-gradient(to left, transparent, rgba(167,139,250,0.18), transparent);
                  font-size: 0;
                  line-height: 0;
                ">&nbsp;</td>
              </tr>
            </table>

            <!-- Expiry / security note box -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="
                  background-color: rgba(91,33,182,0.12);
                  border: 1px solid rgba(91,33,182,0.25);
                  border-radius: 12px;
                  padding: 14px 18px;
                ">
                  <p style="
                    margin: 0;
                    font-family: 'Heebo', 'Helvetica Neue', Arial, sans-serif;
                    font-size: 13px;
                    font-weight: 400;
                    color: #a78bfa;
                    line-height: 1.65;
                    direction: rtl;
                  ">
                    <strong style="font-weight: 700;">⏱ הקוד תקף ל-30 דקות בלבד.</strong><br />
                    לא נרשמת לג׳סטה? פשוט התעלם מהמייל הזה — לא יקרה כלום.
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ───────────────────────────────────────────
             DIVIDER ACCENT LINE
        ─────────────────────────────────────────── -->
        <tr>
          <td height="3" style="
            background: linear-gradient(to left, #5b21b6, #9333ea, #ec4899);
            font-size: 0;
            line-height: 0;
          ">&nbsp;</td>
        </tr>

        <!-- ───────────────────────────────────────────
             FOOTER
        ─────────────────────────────────────────── -->
        <tr>
          <td class="padding-sides" align="center" style="
            background-color: #070516;
            border-radius: 0 0 20px 20px;
            padding: 22px 40px;
          ">
            <p style="
              margin: 0 0 6px;
              font-family: 'Heebo', 'Helvetica Neue', Arial, sans-serif;
              font-size: 12px;
              font-weight: 700;
              color: #4b5563;
              letter-spacing: 2px;
              text-transform: uppercase;
            ">JESTA · ג׳סטה</p>
            <p style="
              margin: 0;
              font-family: 'Heebo', 'Helvetica Neue', Arial, sans-serif;
              font-size: 11px;
              font-weight: 400;
              color: #374151;
              line-height: 1.8;
            ">
              הפלטפורמה המספר 1 לעבודות מהירות לנוער בישראל.<br />
              אין צורך להשיב למייל זה.
            </p>
          </td>
        </tr>

      </table>
      <!-- end email-container -->

    </td>
  </tr>
</table>
<!-- end outer wrapper -->

</body>
</html>`;
}
