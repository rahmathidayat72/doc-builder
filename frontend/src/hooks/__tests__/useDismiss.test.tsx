import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useDismiss } from '../useDismiss'

function Harness({ active, onDismiss }: { active: boolean; onDismiss: () => void }) {
  const ref = useDismiss<HTMLDivElement>(active, onDismiss)
  return (
    <div>
      <div ref={ref} data-testid="inside">
        <button type="button">dalam</button>
      </div>
      <button type="button" data-testid="outside">luar</button>
    </div>
  )
}

describe('useDismiss', () => {
  it('memanggil onDismiss saat klik di luar dan Escape, tidak saat klik di dalam', () => {
    const onDismiss = vi.fn()
    render(<Harness active onDismiss={onDismiss} />)

    fireEvent.mouseDown(screen.getByText('dalam'))
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(onDismiss).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })

  it('tidak aktif ketika active=false', () => {
    const onDismiss = vi.fn()
    render(<Harness active={false} onDismiss={onDismiss} />)

    fireEvent.mouseDown(screen.getByTestId('outside'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
