import React from 'react'
import { Routes, Route } from 'react-router-dom'
import ProcessList from './Pages/ProcessList/ProcessList'
import ProcessDetails from './Pages/ProcessDetails/ProcessDetails'
import ModuleDetails from './Pages/ProcessDetails/ModuleView/ModuleDetails'

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        <Route path="/" element={<ProcessList />} />
        <Route path="/process/:pid" element={<ProcessDetails />} />
        <Route path="/process/:pid/module/:moduleName" element={<ModuleDetails />} />


      </Routes>
    </div>
  )
}

export default App