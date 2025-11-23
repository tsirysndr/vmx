import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sshkeys')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/sshkeys"!</div>
}
