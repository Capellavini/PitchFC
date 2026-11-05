export const cx = (...parts) => parts.filter(Boolean).join(' ');
export const STATE_LABELS = Object.freeze({
  scheduled: 'Agendado', live: 'Ao vivo', provisional: 'Por homologar',
  official: 'Oficial', review: 'Em revisão', postponed: 'Adiado', cancelled: 'Cancelado',
});
