/** wa.me link with the text prefilled. The organizer reads and sends it
 *  herself; nothing is sent from here (WhatsApp is a channel, not a bot). */
export const recapShareUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
