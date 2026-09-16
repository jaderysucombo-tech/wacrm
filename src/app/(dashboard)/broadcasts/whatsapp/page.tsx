import { ChannelCampaignPage } from '@/components/broadcasts/channel-campaign-page';

export default function BroadcastWhatsappPage() {
  return (
    <ChannelCampaignPage
      channel="sms"
      title="Difusión por WhatsApp"
      subtitle="Ejemplo de campaña orientada a contactos con WhatsApp disponible."
      subjectLabel="Título del mensaje"
      placeholderSubject="Actualización importante"
      placeholderMessage="Escribe el mensaje de WhatsApp que quieres enviar a tus contactos..."
    />
  );
}
