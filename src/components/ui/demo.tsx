import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { RefreshCw, X } from "lucide-react"

function AlertVersionUpdate() {
  return (
    <Alert
      className="min-w-[400px]"
      layout="complex"
      isNotification
      size="lg"
      action={
        <Button
          variant="ghost"
          className="group -my-1.5 -me-2 size-8 p-0 hover:bg-transparent"
          aria-label="Close notification"
        >
          <X
            size={16}
            strokeWidth={2}
            className="opacity-60 transition-opacity group-hover:opacity-100"
          />
        </Button>
      }
    >
      <div className="flex gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
          aria-hidden="true"
        >
          <RefreshCw className="opacity-60" size={16} strokeWidth={2} />
        </div>
        <div className="flex grow flex-col gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Version 1.4 is now available!</p>
            <p className="text-sm text-muted-foreground">
              This update contains several bug fixes and performance improvements.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm">Install</Button>
            <Button size="sm" variant="link">Later</Button>
          </div>
        </div>
      </div>
    </Alert>
  )
}

export { AlertVersionUpdate }
