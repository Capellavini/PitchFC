export const TEAM = { vinicius: 'Vinicius', ney: 'Ney · Negócios', leo: 'Leo · Marketing', cris: 'Cris · Tecnologia', all: 'Toda a equipa' };
export const KINDS = { message: 'Conversa', request: 'Pedido', delivery: 'Entrega' };
export const STATUSES = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluído', blocked: 'Bloqueado' };
export function validateEntry(input, author) {
  if (!['vinicius','ney','leo','cris'].includes(author)) throw new Error('Autor inválido.');
  if (!Object.hasOwn(KINDS,input.kind) || !Object.hasOwn(TEAM,input.recipient)) throw new Error('Tipo ou destinatário inválido.');
  const title = String(input.title || '').trim(), body = String(input.body || '').trim();
  if (!title || title.length > 160 || !body || body.length > 12000) throw new Error('Preenche o assunto (até 160 caracteres) e a mensagem (até 12000).');
  if (input.parent_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.parent_id)) throw new Error('Conversa inválida.');
  return { kind: input.kind, recipient: input.recipient, title, body, author, parent_id: input.parent_id || null };
}
