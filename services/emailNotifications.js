const RESEND_API_URL = 'https://api.resend.com/emails';

function formatInterviewDate(interviewAt) {
  const date = new Date(interviewAt);
  if (Number.isNaN(date.getTime())) return String(interviewAt || '');
  return date.toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' });
}

async function sendResendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[EMAIL] RESEND_API_KEY no configurada; correo omitido.');
    return { sent: false, skipped: true };
  }

  const from = process.env.RESEND_FROM || process.env.RESEND_FROM_EMAIL || 'AHP <onboarding@resend.dev>';

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: [to], subject, html })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[EMAIL] Error enviando con Resend:', response.status, errorText);
      return { sent: false, skipped: false };
    }

    return { sent: true, skipped: false };
  } catch (err) {
    console.error('[EMAIL] Fallo enviando correo:', err.message);
    return { sent: false, skipped: false };
  }
}

async function sendApplicationReceivedEmail({ correo, nombre, vacanteTitulo }) {
  const safeName = nombre || 'Candidato(a)';
  const safeVacante = vacanteTitulo || 'la vacante';
  return sendResendEmail({
    to: correo,
    subject: `Recibimos tu postulación: ${safeVacante}`,
    html: `
      <p>Hola ${safeName},</p>
      <p>Recibimos tu postulación para la vacante <strong>${safeVacante}</strong>.</p>
      <p><strong>Puesto aplicado:</strong> ${safeVacante}</p>
      <p>Gracias por tu interés. Nuestro equipo revisará tu perfil y te contactará en caso de avanzar al siguiente paso.</p>
      <p>Saludos,<br/>Academic Hiring Platform</p>
    `
  });
}

async function sendApplicationRejectedEmail({ correo, nombre, vacanteTitulo }) {
  const safeName = nombre || 'Candidato(a)';
  const safeVacante = vacanteTitulo || 'la vacante';
  return sendResendEmail({
    to: correo,
    subject: 'Actualización de tu postulación',
    html: `
      <p>Hola ${safeName},</p>
      <p>Te informamos que tu postulación para <strong>${safeVacante}</strong> no fue seleccionada en esta ocasión.</p>
      <p>Agradecemos tu tiempo e interés en nuestra organización.</p>
      <p>Saludos,<br/>Academic Hiring Platform</p>
    `
  });
}

async function sendApplicationAcceptedEmail({ correo, nombre, vacanteTitulo }) {
  const safeName = nombre || 'Candidato(a)';
  const safeVacante = vacanteTitulo || 'la vacante';
  return sendResendEmail({
    to: correo,
    subject: 'Resultado de tu proceso: has sido seleccionado',
    html: `
      <p>Hola ${safeName},</p>
      <p>Nos da gusto informarte que has sido seleccionado para <strong>${safeVacante}</strong>.</p>
      <p>En breve te compartiremos una oferta formal con los siguientes pasos para tu incorporación.</p>
      <p>Felicidades y bienvenido(a).<br/>Academic Hiring Platform</p>
    `
  });
}

async function sendInterviewScheduledEmail({ correo, nombre, vacanteTitulo, interviewAt }) {
  const safeName = nombre || 'Candidato(a)';
  const safeVacante = vacanteTitulo || 'la vacante';
  const prettyDate = formatInterviewDate(interviewAt);
  return sendResendEmail({
    to: correo,
    subject: 'Entrevista agendada',
    html: `
      <p>Hola ${safeName},</p>
      <p>Tu entrevista para <strong>${safeVacante}</strong> ha sido agendada.</p>
      <p><strong>Fecha y hora:</strong> ${prettyDate}</p>
      <p>Si necesitas reprogramar, responde a este correo.</p>
      <p>Saludos,<br/>Academic Hiring Platform</p>
    `
  });
}

module.exports = {
  sendApplicationAcceptedEmail,
  sendApplicationReceivedEmail,
  sendApplicationRejectedEmail,
  sendInterviewScheduledEmail
};