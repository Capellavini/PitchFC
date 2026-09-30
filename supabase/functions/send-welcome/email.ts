// Pure email rendering for send-welcome — no Deno/Supabase APIs here, so it
// can also be rendered locally for the preview in docs/welcome-email-preview.html
// (Node 22: `node --experimental-strip-types` a script importing renderWelcome).
//
// Email-client safety: table layout, inline styles only, no web fonts, no
// external CSS, white body (dark-mode clients invert it cleanly). Brand
// colors are literal hex here on purpose — src/theme.js isn't reachable
// from an Edge Function, and an email can't read CSS variables anyway.

export const APP_URL = "https://pitch-fc.com";

export type Lang = "pt" | "pt-br" | "en";
export type Social = { label: string; handle: string; url: string };

const BRAND = {
  navy: "#0A0F18",
  lime: "#C8FF00",
  ink: "#0A0F18",
  text: "#1F2937",
  muted: "#6B7280",
  line: "#E5E7EB",
  soft: "#F4F6F8",
};

type Copy = {
  subject: (n: string) => string;
  preheader: (g: string | null) => string;
  hello: () => string;
  // `g` arrives HTML-escaped + bolded in the HTML part, plain in the text part.
  intro: (n: string, g: string | null) => string;
  howTitle: string;
  steps: [string, string][]; // [title, body]
  cta: string;
  botTip: (g: string, html: boolean) => string;
  signoff: string;
  follow: string;
  why: string;
};

const b = (s: string, html: boolean) => (html ? `<strong>${s}</strong>` : s);

const COPY: Record<Lang, Copy> = {
  pt: {
    subject: (n) => `Bem-vindo ao Pitch FC, ${n} ⚽`,
    preheader: (g) => (g ? `Já estás no plantel do ${g}. Vê como funciona.` : "A tua conta está confirmada. Vê como funciona."),
    hello: () => "Olá craque, bem-vindo ao Pitch FC!",
    intro: (n, g) => g
      ? `${n}, a tua conta está confirmada e já estás no plantel do ${g}. A partir de agora, o jogo da semana organiza-se aqui — sem caos no WhatsApp.`
      : `${n}, a tua conta está confirmada. A partir de agora, o jogo da semana organiza-se aqui — sem caos no WhatsApp.`,
    howTitle: "Como funciona",
    steps: [
      ["Confirma com um toque", "No separador \"Jogar\" dizes se vais ou não. Um toque e está feito!"],
      ["Matchday", "No dia do jogo, o Matchday regista golos, assistências e o MVP."],
      ["O teu PITCH ID", "O teu Perfil é o teu PITCH ID — a tua carreira acumula a cada jogo."],
    ],
    cta: "Abrir o PITCH",
    botTip: (g, h) => `${b("Dica:", h)} o grupo de WhatsApp do ${g} tem o ${b("@Pitch", h)}. Escreve ${b('"@Pitch vou"', h)} lá e a tua presença fica confirmada.`,
    signoff: "Bons jogos,",
    follow: "Segue o PITCH",
    why: "Recebeste este email porque criaste uma conta no PITCH.",
  },
  "pt-br": {
    subject: (n) => `Bem-vindo ao Pitch FC, ${n} ⚽`,
    preheader: (g) => (g ? `Você já está no elenco do ${g}. Veja como funciona.` : "Sua conta está confirmada. Veja como funciona."),
    hello: () => "Olá craque, bem-vindo ao Pitch FC!",
    intro: (n, g) => g
      ? `${n}, sua conta está confirmada e você já faz parte do elenco do ${g}. A partir de agora, o jogo da semana se organiza aqui — sem bagunça no WhatsApp.`
      : `${n}, sua conta está confirmada. A partir de agora, o jogo da semana se organiza aqui — sem bagunça no WhatsApp.`,
    howTitle: "Como funciona",
    steps: [
      ["Confirme com um toque", "Na aba \"Jogar\" você diz se vai ou não. Um toque e pronto!"],
      ["Matchday", "No dia do jogo, o Matchday registra gols, assistências e o MVP."],
      ["Seu PITCH ID", "Seu Perfil é seu PITCH ID — sua carreira cresce a cada jogo."],
    ],
    cta: "Abrir o PITCH",
    botTip: (g, h) => `${b("Dica:", h)} o grupo de WhatsApp do ${g} tem o ${b("@Pitch", h)}. Escreva ${b('"@Pitch vou"', h)} lá e sua presença fica confirmada.`,
    signoff: "Bom jogo,",
    follow: "Siga o PITCH",
    why: "Você recebeu este email porque criou uma conta no PITCH.",
  },
  en: {
    subject: (n) => `Welcome to Pitch FC, ${n} ⚽`,
    preheader: (g) => (g ? `You're in the ${g} squad. Here's how it works.` : "Your account is confirmed. Here's how it works."),
    hello: () => "Hey champ, welcome to Pitch FC!",
    intro: (n, g) => g
      ? `${n}, your account is confirmed and you're in the ${g} squad. From now on, the weekly game gets organised here — no more WhatsApp chaos.`
      : `${n}, your account is confirmed. From now on, the weekly game gets organised here — no more WhatsApp chaos.`,
    howTitle: "How it works",
    steps: [
      ["Confirm in one tap", "In the \"Play\" tab you say whether you're in or out. One tap and you're done!"],
      ["Matchday", "On game day, Matchday records goals, assists and the MVP."],
      ["Your PITCH ID", "Your profile is your PITCH ID — your career builds up with every game."],
    ],
    cta: "Open PITCH",
    botTip: (g, h) => `${b("Tip:", h)} the ${g} WhatsApp group has ${b("@Pitch", h)}. Type ${b('"@Pitch I\'m in"', h)} there to confirm.`,
    signoff: "See you on the pitch,",
    follow: "Follow PITCH",
    why: "You're getting this email because you created a PITCH account.",
  },
};

const SIGNATURE = "Vini | Founder | PITCH FC.";

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** First word of the signup name, else the email's local part, else a neutral word. */
export function firstName(name?: string | null, email?: string | null, lang: Lang = "pt"): string {
  const fromName = (name || "").trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = (email || "").split("@")[0].split(/[._+-]/)[0];
  if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  return lang === "en" ? "player" : "craque";
}

/**
 * Language priority: the user's own app language (when it isn't the PT-PT
 * default), then the invite group's WhatsApp-bot language, then PT-PT.
 * appLang uses the app's codes ("pt" | "pt-br" | "en"); groupLang the
 * bot's wa_bot_lang ("pt" | "ptbr" | "en" | "pt+en").
 */
export function pickLang(appLang?: string | null, groupLang?: string | null): Lang {
  const a = (appLang || "").toLowerCase();
  if (a === "pt-br" || a === "ptbr") return "pt-br";
  if (a === "en") return "en";
  if (groupLang === "ptbr") return "pt-br";
  if (groupLang === "en") return "en";
  return "pt";
}

/** wa.me link for an E.164 number (digits only, "+" and spaces tolerated). */
export function whatsappSocial(raw?: string | null): Social | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return { label: "WhatsApp", handle: `+${digits}`, url: `https://wa.me/${digits}` };
}

export type WelcomeInput = {
  firstName: string;
  groupName?: string | null; // null → generic welcome, no group line / bot tip
  lang: Lang;
  botEnabled: boolean;
  socials: Social[];
  appUrl?: string;
};

export function renderWelcome({ firstName: n, groupName, lang, botEnabled, socials, appUrl = APP_URL }: WelcomeInput) {
  const c = COPY[lang];
  const g = groupName?.trim() || null;
  const gH = g ? escapeHtml(g) : null;
  const url = escapeHtml(appUrl);
  const showTip = !!(g && botEnabled);

  const stepRows = c.steps.map(([title, body], i) => `
          <tr>
            <td valign="top" width="36" style="padding:0 0 18px 0;">
              <div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:${BRAND.navy};color:${BRAND.lime};font-weight:900;font-size:14px;text-align:center;font-family:Arial,Helvetica,sans-serif;">${i + 1}</div>
            </td>
            <td valign="top" style="padding:3px 0 18px 10px;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:15px;font-weight:700;color:${BRAND.ink};line-height:1.3;">${escapeHtml(title)}</div>
              <div style="font-size:14px;color:${BRAND.text};line-height:1.5;margin-top:2px;">${escapeHtml(body)}</div>
            </td>
          </tr>`).join("");

  const tip = showTip ? `
        <tr>
          <td style="padding:0 28px 24px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.soft};border-radius:12px;">
              <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${BRAND.text};">💬 ${c.botTip(gH!, true)}</td></tr>
            </table>
          </td>
        </tr>` : "";

  const socialsHtml = socials.map((s) =>
    `<a href="${escapeHtml(s.url)}" style="color:${BRAND.ink};font-weight:700;text-decoration:none;">${escapeHtml(s.label)} ${escapeHtml(s.handle)}</a>`,
  ).join(` <span style="color:${BRAND.muted};">·</span> `);

  const html = `<!doctype html>
<html lang="${lang === "pt-br" ? "pt-BR" : lang === "en" ? "en" : "pt-PT"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(c.subject(n))}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.soft};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(c.preheader(g))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.soft};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid ${BRAND.line};">
        <tr>
          <td style="background:${BRAND.navy};padding:22px 28px;font-family:Arial,Helvetica,sans-serif;">
            <span style="font-size:26px;font-weight:900;font-style:italic;letter-spacing:1px;color:#FFFFFF;">PITCH</span><span style="font-size:26px;font-weight:900;color:${BRAND.lime};">.</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px 28px;font-family:Arial,Helvetica,sans-serif;">
            <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.25;font-weight:900;color:${BRAND.ink};">${escapeHtml(c.hello())}</h1>
            <p style="margin:0;font-size:15px;line-height:1.55;color:${BRAND.text};">${c.intro(escapeHtml(n), gH ? `<strong style="color:${BRAND.ink};">${gH}</strong>` : null)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 28px 6px 28px;font-family:Arial,Helvetica,sans-serif;">
            <div style="font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND.muted};margin-bottom:14px;">${escapeHtml(c.howTitle)}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${stepRows}
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:4px 28px 26px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="background:${BRAND.lime};border-radius:12px;">
                  <a href="${url}" style="display:inline-block;padding:15px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:900;color:${BRAND.ink};text-decoration:none;border-radius:12px;">${escapeHtml(c.cta)} →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>${tip}
        <tr>
          <td style="padding:0 28px 26px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${BRAND.text};">
            ${escapeHtml(c.signoff)}<br><strong style="color:${BRAND.ink};">${escapeHtml(SIGNATURE)}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px 24px 28px;border-top:1px solid ${BRAND.line};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${BRAND.muted};">
            ${socials.length ? `<div style="margin-bottom:6px;">${escapeHtml(c.follow)}: ${socialsHtml}</div>` : ""}
            <div>${escapeHtml(c.why)}</div>
            <div style="margin-top:6px;"><a href="${url}" style="color:${BRAND.muted};">pitch-fc.com</a></div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    c.hello(),
    "",
    c.intro(n, g),
    "",
    `${c.howTitle}:`,
    ...c.steps.map(([title, body], i) => `${i + 1}. ${title}: ${body}`),
    "",
    `${c.cta}: ${appUrl}`,
    ...(showTip ? ["", c.botTip(g!, false)] : []),
    "",
    c.signoff,
    SIGNATURE,
    "",
    "—",
    ...(socials.length ? [`${c.follow}: ${socials.map((s) => `${s.label} ${s.handle} (${s.url})`).join(" · ")}`] : []),
    c.why,
  ].join("\n");

  return { subject: c.subject(n), html, text };
}
