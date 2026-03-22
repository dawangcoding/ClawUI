// SpeechRecognition polyfill stub
// @agentscope-ai/chat 的 useSpeech hook 通过 `SpeechRecognition` 是否存在来控制语音按钮的启用状态。
// 在 Electron 环境中 webkitSpeechRecognition 可能不可用，导致按钮被禁用。
// 此 stub 仅用于通过存在性检查，受控模式下不会被实例化。

const win = window as unknown as Record<string, unknown>

if (typeof window !== 'undefined' && !win.SpeechRecognition && !win.webkitSpeechRecognition) {
   win.webkitSpeechRecognition = class SpeechRecognitionStub {}
}
