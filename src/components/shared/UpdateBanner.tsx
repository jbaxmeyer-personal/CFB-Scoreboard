import './UpdateBanner.css'
import { usePwaUpdate } from '../../hooks/usePwaUpdate'

export function UpdateBanner() {
  const { needRefresh, update } = usePwaUpdate()
  if (!needRefresh) return null

  return (
    <div className="update-banner" role="status">
      <span>A new version is available.</span>
      <button type="button" onClick={update}>
        Refresh
      </button>
    </div>
  )
}
