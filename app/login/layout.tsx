// Standalone layout — bypasses the main app shell (no TopNav)
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
