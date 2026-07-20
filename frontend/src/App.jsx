import { useState } from 'react'
import RosterPage from './pages/RosterPage'
import BattingOrderPage from './pages/BattingOrderPage'
import './App.css'

const TABS = [
  { id: 'roster', label: 'Roster', Component: RosterPage },
  { id: 'batting-order', label: 'Batting Order', Component: BattingOrderPage },
]

function App() {
  const [activeTab, setActiveTab] = useState('roster')
  const ActivePage = TABS.find((tab) => tab.id === activeTab)?.Component ?? RosterPage

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">
          <svg className="icon diamond-icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#diamond-icon" />
          </svg>
          <h1>Lineup Coach</h1>
        </div>
        <nav className="tab-nav" aria-label="Main">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        <ActivePage />
      </main>

      <footer className="app-footer">
        <p>Softball Lineup Coach IDSS</p>
      </footer>
    </div>
  )
}

export default App
