import { Linking } from 'react-native';
import { GYM } from '@/data/seed';
import { isAr, nm } from '@/i18n';

/** Opens wa.me with a ready-made reminder (SPEC 4.3). Egyptian numbers: 01x… → 201x… */
export function whatsapp(phone: string, name: string, line: string) {
  const first = name.split(' ')[0];
  const msg = isAr()
    ? `أهلاً ${first}،\nده تذكير من ${GYM.name}: الاشتراك ${line}.\nمستنيينك في التمرين.`
    : `Hi ${first},\nA reminder from ${nm(GYM)}: your subscription is ${line}.\nSee you at training.`;
  const intl = phone.startsWith('0') ? `2${phone}` : phone;
  Linking.openURL(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`);
}

/** Open WhatsApp to one player with a ready-made text. */
export function sendWhatsApp(phone: string, text: string) {
  const intl = phone.startsWith('0') ? `2${phone}` : phone.replace(/^\+/, '');
  return Linking.openURL(`https://wa.me/${intl}?text=${encodeURIComponent(text)}`);
}
