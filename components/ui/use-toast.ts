import { toast as sonnerToast } from "sonner"

export function useToast() {
  return {
    toast: ({ title, description, variant }: { title?: string, description?: string, variant?: string }) => {
      sonnerToast(title, {
        description: description,
      })
    }
  }
}
