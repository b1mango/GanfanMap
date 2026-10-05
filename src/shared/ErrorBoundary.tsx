import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : '页面出现异常',
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('App ErrorBoundary caught', error, info)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="app-error-boundary" role="alert">
        <strong>页面出错了</strong>
        <p>{this.state.message || '请刷新后重试。本地数据仍保存在浏览器中。'}</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => window.location.reload()}
        >
          刷新页面
        </button>
      </div>
    )
  }
}
