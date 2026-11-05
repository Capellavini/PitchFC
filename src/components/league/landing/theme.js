import { C as shared } from '../visual/theme';
export * from '../visual/theme';
// Public editorial surfaces stay light independently of the account's theme.
export const C = { ...shared, bg: '#F2F4F7', surface: '#F8F9FB', card: '#FFFFFF', border: '#DCE2EA', text1: '#151D2A', text2: '#526176', text3: '#64748B', accent: '#355BC4', accentDim: '#355BC410', accentBorder: '#355BC440', green: '#087951', red: '#BE2346', orange: '#875000', blue: '#245CB5' };
export const cardStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 };

export const inputStyle = () => ({ width: '100%', boxSizing: 'border-box', minHeight: 44, background: C.card, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 16, fontFamily: 'inherit' });
