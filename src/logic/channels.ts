/**
 * Delivery channels for reminders. The reminders feature only talks to this interface,
 * so another channel (WhatsApp Business API, SMS, push to a player app…) can be added
 * later by implementing `NotificationChannel` and registering it in `CHANNELS`.
 */
import { Linking } from 'react-native';
import type { Player } from '@/data/types';

export interface NotificationChannel {
  /** stable id, stored in ReminderLog.channel */
  id: string;
  /** can this channel reach the player at all? */
  canSend(player: Player): boolean;
  /**
   * Hand the message over. Resolves true when it was handed to the channel
   * (for a link channel that means "the app opened"; the coach presses send there).
   */
  send(player: Player, message: string): Promise<boolean>;
}

/** Opens WhatsApp (wa.me) with the player's number and the message pre-filled. No automatic sending. */
export class WhatsAppLinkChannel implements NotificationChannel {
  id = 'whatsapp_link';

  canSend(player: Player) {
    return /^0?1[0125]\d{8}$/.test(player.phone);
  }

  async send(player: Player, message: string) {
    const intl = player.phone.startsWith('0') ? `2${player.phone}` : `20${player.phone}`;
    try {
      await Linking.openURL(`https://wa.me/${intl}?text=${encodeURIComponent(message)}`);
      return true;
    } catch {
      return false;
    }
  }
}

export const CHANNELS: Record<string, NotificationChannel> = { whatsapp_link: new WhatsAppLinkChannel() };
export const defaultChannel = CHANNELS.whatsapp_link;
