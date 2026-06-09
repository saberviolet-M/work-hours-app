interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = '确认',
  confirmVariant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const confirmButtonClass =
    confirmVariant === 'danger'
      ? 'px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors'
      : 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onCancel}
      />

      {/* 弹窗卡片 */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <p className="text-sm text-gray-600">{message}</p>

        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={confirmButtonClass}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
