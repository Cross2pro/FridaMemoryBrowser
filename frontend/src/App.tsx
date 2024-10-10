import React from 'react'
import { Routes, Route } from 'react-router-dom'
import ProcessList from './components/ProcessList'
import ProcessDetails from './components/ProcessDetails'

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        <Route path="/" element={<ProcessList />} />
        <Route path="/process/:pid" element={<ProcessDetails />} />
      </Routes>
    </div>
  )
}

export default App