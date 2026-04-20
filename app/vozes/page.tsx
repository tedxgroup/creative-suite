import { RiVoiceprintLine } from "@remixicon/react"
import { PlaceholderView } from "@/components/placeholder-view"

export default function VozesPage() {
  return (
    <PlaceholderView
      breadcrumb="/vozes"
      title="Vozes"
      icon={RiVoiceprintLine}
      description="Geração de TTS, voice changer e clonagem de vozes via ElevenLabs."
    />
  )
}
