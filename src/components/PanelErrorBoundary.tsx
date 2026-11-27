import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onClose: () => void;
}

interface State {
  failed: boolean;
}

/**
 * 탭 패널을 따로 불러오다 실패했을 때(오프라인, 재배포로 옛 청크가 사라진 경우 등)
 * 앱 전체가 빈 화면이 되지 않도록 해당 패널 자리에만 안내를 띄움
 */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('패널 로딩 실패:', error.message, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#040A12]/74 p-4">
        <div role="alert" className="w-[min(420px,92vw)] rounded border border-[#293D54] bg-[#0D1927] p-5 text-sm text-[#C9D6E2]">
          <div className="font-semibold text-[#F5D684]">패널을 불러오지 못했습니다</div>
          <p className="mt-2 text-[#9AB0C4]">
            네트워크가 끊겼거나 사이트가 새로 배포됐을 수 있습니다. 새로고침하면 대부분 해결됩니다.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={this.props.onClose}
              className="cursor-pointer rounded border border-[#26394E] px-3 py-1.5 text-xs text-[#9BB0C4] hover:text-[#E8E6DF]"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="cursor-pointer rounded border border-[#D4A84B]/70 bg-[#132436] px-3 py-1.5 text-xs font-medium text-[#F5D684]"
            >
              새로고침
            </button>
          </div>
        </div>
      </div>
    );
  }
}
