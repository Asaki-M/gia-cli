import cliProgress from 'cli-progress'
import ora from 'ora'

function isInteractiveTerminal() {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY)
}

export function createSpinner(text) {
  return ora({
    text,
    isEnabled: isInteractiveTerminal(),
  }).start()
}

export function createProgressBar({ total = 0, format = 'Progress |{bar}| {value}/{total}' } = {}) {
  if (!isInteractiveTerminal() || total <= 0) {
    return null
  }

  const progressBar = new cliProgress.SingleBar(
    {
      clearOnComplete: true,
      hideCursor: true,
      format,
    },
    cliProgress.Presets.shades_classic,
  )

  progressBar.start(total, 0)
  return progressBar
}
