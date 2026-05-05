import { Settings } from "lucide-react"
import { PlaceholderView } from "@/components/placeholder-view"

export default function ConfiguracoesPage() {
  return (
    <PlaceholderView
      breadcrumb="/configuracoes"
      title="Configurações"
      icon={Settings}
      description="API keys, preferências de geração e tema — em breve."
    />
  )
}
