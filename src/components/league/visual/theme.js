import './community.css';
import './redesign.css';
// League-only tokens. The shared app palette remains untouched.
import { C as shared } from '../../../theme';
export * from '../../../theme';
export const C = { ...shared, bg: '#0A0F18', surface: '#101925', card: '#162130', border: '#2A3546', accent: '#C8FF00', text1: '#FFFFFF', text2: '#A7B2C5', text3: '#7C8BA3' };
export const R = { card: 10, control: 8, pill: 999 };
export const displayFont = { fontFamily: "'Pitch League Display', 'Arial Narrow', sans-serif", fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.02em' };
export const cardStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card, padding: 20 };

export const inputStyle = () => ({ width: '100%', boxSizing: 'border-box', minHeight: 44, background: C.card, color: C.text1, border: `1px solid ${C.border}`, borderRadius: R.control, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' });
