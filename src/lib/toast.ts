import { toast } from 'sonner';

export function showSuccess(message: string): void {
  toast.success(message);
}

export function showError(message: string): void {
  toast.error(message);
}

export function showLoading(message: string): string | number {
  return toast.loading(message);
}

export function dismissToast(id: string | number): void {
  toast.dismiss(id);
}
